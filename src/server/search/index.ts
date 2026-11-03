/**
 * Recipient search and lookup pipeline (BE-17, PRD Section 9).
 * - Ambiguity detection (returns needs_clarification)
 * - Search query formulation
 * - Search API adapter (Tavily, Serper, Brave)
 * - Safe fetching via SSRF protection
 * - Regex address extraction (Rule R1: NEVER LLM-generated)
 * - Official domain ranking (.gov.in, .nic.in, .ac.in, org domain)
 * - MX record verification via node:dns
 */
import dns from 'node:dns/promises';
import { ssrfSafeFetch } from './ssrf';
import { extractContactsFromText } from '../extract';
import {
  type Contact,
  type LookupResult,
  type RecipientHint,
} from '@/contracts';
import { AppError } from '../errors';

interface SearchResultItem {
  title: string;
  url: string;
  snippet?: string;
}

/**
 * Searches the web using configured search provider.
 */
async function executeWebSearch(query: string): Promise<SearchResultItem[]> {
  const provider = (process.env.SEARCH_PROVIDER || 'tavily').toLowerCase();
  const apiKey = process.env.SEARCH_API_KEY;

  if (!apiKey) {
    throw new AppError(
      'INTERNAL',
      'Missing SEARCH_API_KEY environment variable for recipient lookup.',
    );
  }

  if (provider === 'tavily') {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        search_depth: 'basic',
        max_results: 5,
      }),
    });
    if (!res.ok) {
      throw new AppError(
        'UPSTREAM_ERROR',
        `Tavily search failed with status ${res.status}`,
      );
    }
    const data = await res.json();
    return (data.results || []).map((r: { title: string; url: string; content?: string }) => ({
      title: r.title,
      url: r.url,
      snippet: r.content,
    }));
  }

  if (provider === 'serper') {
    const res = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ q: query, num: 5 }),
    });
    if (!res.ok) {
      throw new AppError(
        'UPSTREAM_ERROR',
        `Serper search failed with status ${res.status}`,
      );
    }
    const data = await res.json();
    return (data.organic || []).map((r: { title: string; link: string; snippet?: string }) => ({
      title: r.title,
      url: r.link,
      snippet: r.snippet,
    }));
  }

  if (provider === 'brave') {
    const url = new URL('https://api.search.brave.com/res/v1/web/search');
    url.searchParams.set('q', query);
    url.searchParams.set('count', '5');
    const res = await fetch(url.toString(), {
      headers: {
        Accept: 'application/json',
        'X-Subscription-Token': apiKey,
      },
    });
    if (!res.ok) {
      throw new AppError(
        'UPSTREAM_ERROR',
        `Brave search failed with status ${res.status}`,
      );
    }
    const data = await res.json();
    return (data.web?.results || []).map((r: { title: string; url: string; description?: string }) => ({
      title: r.title,
      url: r.url,
      snippet: r.description,
    }));
  }

  throw new AppError(
    'INTERNAL',
    `Unsupported SEARCH_PROVIDER: ${provider}. Supported: tavily, serper, brave`,
  );
}

/**
 * Verifies if a domain has valid MX records.
 */
export async function checkDomainMx(domain: string): Promise<boolean> {
  try {
    const mxRecords = await dns.resolveMx(domain);
    return mxRecords && mxRecords.length > 0;
  } catch {
    return false;
  }
}

/**
 * Checks if a domain is official government / academic or matches the organization.
 */
export function isOfficialDomain(domain: string, orgName?: string): boolean {
  const d = domain.toLowerCase();
  if (
    d.endsWith('.gov.in') ||
    d.endsWith('.nic.in') ||
    d.endsWith('.ac.in') ||
    d.endsWith('.edu') ||
    d.endsWith('.gov')
  ) {
    return true;
  }
  if (orgName) {
    const cleanOrg = orgName.toLowerCase().replace(/[^a-z0-9]/g, '');
    const cleanDomain = d.split('.')[0] || '';
    if (cleanOrg.includes(cleanDomain) || cleanDomain.includes(cleanOrg)) {
      return true;
    }
  }
  return false;
}

/**
 * Main recipient lookup function.
 */
export async function lookupRecipient(
  hint: RecipientHint,
  clarificationAnswer?: string,
): Promise<LookupResult> {
  const org = (hint.org || '').trim();
  const dept = (hint.dept || '').trim();
  const location = (hint.location || clarificationAnswer || '').trim();

  // 1. Ambiguity detection (PRD Step 1)
  // If org is overly generic or location is missing for branch-dependent entities
  const genericOrgWords = ['bank', 'police', 'hospital', 'college', 'school', 'electricity', 'water'];
  const isGenericOrg =
    genericOrgWords.includes(org.toLowerCase()) ||
    org.toLowerCase().startsWith('the ') && genericOrgWords.some((w) => org.toLowerCase().includes(w));

  if (isGenericOrg && !dept && !location) {
    return {
      status: 'needs_clarification',
      candidates: [],
      clarification: {
        question: `Which branch or specific office of ${org} are you contacting?`,
      },
    };
  }

  // If org is bank/branch but location is completely unspecified
  if (
    (org.toLowerCase().includes('bank') || org.toLowerCase().includes('electricity')) &&
    !location &&
    !clarificationAnswer
  ) {
    return {
      status: 'needs_clarification',
      candidates: [],
      clarification: {
        question: `Could you specify the city or branch location for ${org}?`,
      },
    };
  }

  // 2. Query formulation
  const queries: string[] = [];
  if (location) {
    queries.push(`${org} ${location} branch email contact`);
    queries.push(`${org} ${location} grievance email`);
  } else if (dept) {
    queries.push(`${org} ${dept} customer care email`);
  } else {
    queries.push(`${org} customer care email grievance`);
    queries.push(`${org} official contact email`);
  }

  const searchResults: SearchResultItem[] = [];
  for (const q of queries.slice(0, 2)) {
    try {
      const items = await executeWebSearch(q);
      searchResults.push(...items);
    } catch {
      // Continue to next query if one fails
    }
  }

  // Deduplicate URLs
  const uniqueResults = new Map<string, SearchResultItem>();
  for (const item of searchResults) {
    if (!uniqueResults.has(item.url)) {
      uniqueResults.set(item.url, item);
    }
  }

  const candidates: Contact[] = [];
  const seenEmails = new Set<string>();
  let portalUrl: string | undefined;

  // 3. Fetch top results through SSRF-safe fetcher & extract
  for (const item of Array.from(uniqueResults.values()).slice(0, 4)) {
    try {
      const pageText = await ssrfSafeFetch(item.url);
      const extracted = extractContactsFromText(pageText, 'web');

      if (!portalUrl && extracted.portalUrls.length > 0) {
        portalUrl = extracted.portalUrls[0];
      }

      for (const c of extracted.contacts) {
        if (seenEmails.has(c.email)) continue;
        seenEmails.add(c.email);

        const domain = c.email.split('@')[1] || '';
        const isOfficial = isOfficialDomain(domain, org);

        // Verify MX
        const mxOk = await checkDomainMx(domain);

        candidates.push({
          id: `cnt_web_${candidates.length + 1}`,
          email: c.email,
          label: `${org} (${domain})`,
          origin: 'web',
          trust: isOfficial ? 'official' : 'third_party',
          sourceUrl: item.url,
          snippet: c.snippet || item.snippet || `Found on ${item.url}`,
          mxOk,
        });

        if (candidates.length >= 3) break;
      }
      if (candidates.length >= 3) break;
    } catch {
      // Continue if a page fails SSRF or fetch timeout
    }
  }

  // Sort: official first, then mxOk
  candidates.sort((a, b) => {
    if (a.trust === 'official' && b.trust !== 'official') return -1;
    if (b.trust === 'official' && a.trust !== 'official') return 1;
    if (a.mxOk && !b.mxOk) return -1;
    if (!a.mxOk && b.mxOk) return 1;
    return 0;
  });

  const topCandidates = candidates.slice(0, 3);

  if (topCandidates.length > 0) {
    return {
      status: 'ok',
      candidates: topCandidates,
      portalUrl,
    };
  }

  return {
    status: 'not_found',
    candidates: [],
    portalUrl,
  };
}
