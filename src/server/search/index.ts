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
import { extractContactsFromText, isDummyEmail } from '../extract';
import { planWebSearch } from './planner';
import {
  type Contact,
  type LookupResult,
  type RecipientHint,
} from '@/contracts';
import { AppError } from '../errors';

export interface SearchResultItem {
  title: string;
  url: string;
  snippet?: string;
}

export interface WebSearchOptions {
  maxResults?: number;
  includeAnswer?: boolean;
}

export interface WebSearchResponse {
  results: SearchResultItem[];
  answer?: string;
}

export interface WebGroundingResult {
  query: string;
  answer?: string;
  results: SearchResultItem[];
  contacts: Contact[];
}

/**
 * Normalizes colloquial or mistaken titles, such as "PM of <state>" -> "Chief Minister of <state> CMO".
 * In Indian governance, states are led by Chief Ministers (CMO); only the central union government has a Prime Minister (PMO).
 */
export function normalizeRecipientQuery(text: string): {
  normalized: string;
  wasNormalized: boolean;
  officialDesignation?: string;
} {
  const match = text.match(
    /\b(?:pm|prime\s+minister)\s+(?:of\s+)?([a-zA-Z\s]+?)(?=(?:\s+(?:regarding|about|for|to|official|contact|email|office|grievance)|\s*$))/i,
  );
  if (match) {
    const rawTarget = match[1].trim();
    if (rawTarget && !/^(?:india|bharat)$/i.test(rawTarget)) {
      const stateName = rawTarget
        .split(/\s+/)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ');
      const officialDesignation = `Chief Minister of ${stateName}`;
      const normalized = text.replace(match[0], `${officialDesignation} CMO`);
      return { normalized, wasNormalized: true, officialDesignation };
    }
  }
  return { normalized: text, wasNormalized: false };
}

/**
 * Computes a domain and keyword relevance score to prioritize matching official contacts.
 */
export function scoreContactRelevance(
  email: string,
  targetTerms: string,
): number {
  let score = 0;
  const lowerEmail = email.toLowerCase();
  const domain = lowerEmail.split('@')[1] || '';
  const keywords = targetTerms
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2);

  for (const kw of keywords) {
    if (domain.includes(kw) || lowerEmail.includes(kw)) score += 100;
  }
  if (domain.endsWith('.gov.in') || domain.endsWith('.nic.in')) score += 50;
  else if (domain.endsWith('.ac.in') || domain.endsWith('.edu')) score += 20;
  return score;
}

/**
 * Searches the web using configured search provider.
 */
export async function executeWebSearch(
  query: string,
  options: WebSearchOptions = {},
): Promise<WebSearchResponse> {
  const provider = (process.env.SEARCH_PROVIDER || 'tavily').toLowerCase();
  const apiKey = process.env.SEARCH_API_KEY;
  const maxResults = options.maxResults ?? 5;
  const includeAnswer = options.includeAnswer ?? true;

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
        include_answer: includeAnswer,
        max_results: maxResults,
      }),
    });
    if (!res.ok) {
      throw new AppError(
        'UPSTREAM_ERROR',
        `Tavily search failed with status ${res.status}`,
      );
    }
    const data = await res.json();
    return {
      results: (data.results || []).map((r: { title: string; url: string; content?: string }) => ({
        title: r.title,
        url: r.url,
        snippet: r.content,
      })),
      answer: typeof data.answer === 'string' && data.answer.trim().length > 0 ? data.answer.trim() : undefined,
    };
  }

  if (provider === 'serper') {
    const res = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ q: query, num: maxResults }),
    });
    if (!res.ok) {
      throw new AppError(
        'UPSTREAM_ERROR',
        `Serper search failed with status ${res.status}`,
      );
    }
    const data = await res.json();
    return {
      results: (data.organic || []).map((r: { title: string; link: string; snippet?: string }) => ({
        title: r.title,
        url: r.link,
        snippet: r.snippet,
      })),
      answer: data.answerBox?.snippet || data.answerBox?.answer,
    };
  }

  if (provider === 'brave') {
    const url = new URL('https://api.search.brave.com/res/v1/web/search');
    url.searchParams.set('q', query);
    url.searchParams.set('count', String(maxResults));
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
    return {
      results: (data.web?.results || []).map((r: { title: string; url: string; description?: string }) => ({
        title: r.title,
        url: r.url,
        snippet: r.description,
      })),
      answer: undefined,
    };
  }

  throw new AppError(
    'INTERNAL',
    `Unsupported SEARCH_PROVIDER: ${provider}. Supported: tavily, serper, brave`,
  );
}

/**
 * Searches the web for grounding information and extracts verified contacts
 * from both search synthesized answers and snippet content.
 */
export async function searchWebForGrounding(
  query: string,
  options: WebSearchOptions & { targetEntity?: string } = {},
): Promise<WebGroundingResult> {
  let searchRes: WebSearchResponse;
  try {
    searchRes = await executeWebSearch(query, options);
  } catch (err) {
    console.warn('Web search failed for query:', query, err);
    return { query, results: [], contacts: [] };
  }

  const targetEntity = options.targetEntity || query;
  const { results, answer } = searchRes;
  const combinedText = [answer, ...results.map((r) => r.snippet || '')]
    .filter(Boolean)
    .join('\n');

  const extracted = extractContactsFromText(combinedText, 'web');
  const contacts: Contact[] = [];
  const seenEmails = new Set<string>();

  for (const c of extracted.contacts) {
    if (seenEmails.has(c.email) || isDummyEmail(c.email)) continue;
    seenEmails.add(c.email);

    const domain = c.email.split('@')[1] || '';
    const isOfficial = isOfficialDomain(domain, targetEntity);
    const mxOk = await checkDomainMx(domain);

    if (!mxOk) continue;

    contacts.push({
      id: `cnt_web_${contacts.length + 1}`,
      email: c.email,
      label: `${targetEntity} (${domain})`,
      origin: 'web',
      trust: isOfficial ? 'official' : 'third_party',
      sourceUrl: results[0]?.url,
      snippet: c.snippet || answer || `Extracted from web search for ${query}`,
      mxOk: true,
    });
  }

  contacts.sort((a, b) => {
    const scoreA =
      scoreContactRelevance(a.email, `${targetEntity}`) +
      (a.trust === 'official' ? 50 : 0) +
      (a.mxOk ? 30 : 0);
    const scoreB =
      scoreContactRelevance(b.email, `${targetEntity}`) +
      (b.trust === 'official' ? 50 : 0) +
      (b.mxOk ? 30 : 0);
    return scoreB - scoreA;
  });

  return {
    query,
    answer,
    results,
    contacts,
  };
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
  const rawOrg = (hint.org || '').trim();
  const dept = (hint.dept || '').trim();
  const location = (hint.location || clarificationAnswer || '').trim();

  // Normalize any colloquial Indian governance titles (e.g. "PM of Gujarat" -> "Chief Minister of Gujarat")
  const norm = normalizeRecipientQuery(rawOrg);
  const org = norm.wasNormalized ? norm.normalized : rawOrg;

  // 1. Ambiguity detection (PRD Step 1)
  // If org is overly generic or location is missing for branch-dependent entities
  const genericOrgWords = ['bank', 'police', 'hospital', 'college', 'school', 'electricity', 'water'];
  const isGenericOrg =
    genericOrgWords.includes(org.toLowerCase()) ||
    (org.toLowerCase().startsWith('the ') && genericOrgWords.some((w) => org.toLowerCase().includes(w)));

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

  // 2. Query formulation via universal search planner
  const targetDesc = [rawOrg, dept, location].filter(Boolean).join(' ');
  const searchPlan = await planWebSearch(targetDesc, { isRecipientLookup: true });
  const officialLabel = searchPlan.targetEntity || norm.officialDesignation || rawOrg;

  const queries: string[] = [];
  if (searchPlan.queries && searchPlan.queries.length > 0) {
    queries.push(...searchPlan.queries);
  }
  if (norm.wasNormalized && norm.officialDesignation && !queries.some((q) => q.includes(norm.officialDesignation!))) {
    queries.push(`${norm.officialDesignation} official contact email CMO address`);
  }
  if (queries.length === 0) {
    if (location) {
      queries.push(`${rawOrg} ${location} branch email contact`);
      queries.push(`${rawOrg} ${location} grievance email`);
    } else if (dept) {
      queries.push(`${rawOrg} ${dept} customer care email`);
    } else {
      queries.push(`${rawOrg} customer care email grievance`);
      queries.push(`${rawOrg} official contact email`);
    }
  }

  const searchResults: SearchResultItem[] = [];
  const searchAnswers: string[] = [];
  for (const q of queries.slice(0, 2)) {
    try {
      const searchRes = await executeWebSearch(q);
      searchResults.push(...searchRes.results);
      if (searchRes.answer) {
        searchAnswers.push(searchRes.answer);
      }
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

  // 3a. Extract contacts directly from synthesized search answers and snippets (clean & fast)
  const directSnippets = [
    ...searchAnswers,
    ...searchResults.map((r) => r.snippet || ''),
  ]
    .filter(Boolean)
    .join('\n');

  if (directSnippets) {
    const directExtracted = extractContactsFromText(directSnippets, 'web');
    if (!portalUrl && directExtracted.portalUrls.length > 0) {
      portalUrl = directExtracted.portalUrls[0];
    }
    for (const c of directExtracted.contacts) {
      if (seenEmails.has(c.email) || isDummyEmail(c.email)) continue;
      seenEmails.add(c.email);

      const domain = c.email.split('@')[1] || '';
      const isOfficial = isOfficialDomain(domain, officialLabel);
      const mxOk = await checkDomainMx(domain);

      candidates.push({
        id: `cnt_web_${candidates.length + 1}`,
        email: c.email,
        label: `${officialLabel} (${domain})`,
        origin: 'web',
        trust: isOfficial ? 'official' : 'third_party',
        sourceUrl: searchResults[0]?.url,
        snippet: c.snippet || `Found via search for ${officialLabel}`,
        mxOk,
      });
    }
  }

  // 3b. Fetch top results through SSRF-safe fetcher & extract (for additional/fallback contacts)
  for (const item of Array.from(uniqueResults.values()).slice(0, 4)) {
    try {
      const pageText = await ssrfSafeFetch(item.url);
      const extracted = extractContactsFromText(pageText, 'web');

      if (!portalUrl && extracted.portalUrls.length > 0) {
        portalUrl = extracted.portalUrls[0];
      }

      for (const c of extracted.contacts) {
        if (seenEmails.has(c.email) || isDummyEmail(c.email)) continue;
        seenEmails.add(c.email);

        const domain = c.email.split('@')[1] || '';
        const isOfficial = isOfficialDomain(domain, officialLabel);
        const mxOk = await checkDomainMx(domain);

        candidates.push({
          id: `cnt_web_${candidates.length + 1}`,
          email: c.email,
          label: `${officialLabel} (${domain})`,
          origin: 'web',
          trust: isOfficial ? 'official' : 'third_party',
          sourceUrl: item.url,
          snippet: c.snippet || item.snippet || `Found on ${item.url}`,
          mxOk,
        });

        if (candidates.length >= 6) break;
      }
      if (candidates.length >= 6) break;
    } catch {
      // Continue if a page fails SSRF or fetch timeout
    }
  }

  // Sort: domain relevance + official first + mxOk
  candidates.sort((a, b) => {
    const scoreA =
      scoreContactRelevance(a.email, `${officialLabel} ${location}`) +
      (a.trust === 'official' ? 50 : 0) +
      (a.mxOk ? 30 : 0);
    const scoreB =
      scoreContactRelevance(b.email, `${officialLabel} ${location}`) +
      (b.trust === 'official' ? 50 : 0) +
      (b.mxOk ? 30 : 0);
    return scoreB - scoreA;
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
