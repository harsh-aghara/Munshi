/**
 * Universal Web Search & Entity Resolution Planner (PRD Section 9, BE-17).
 * Dynamically plans factual web search queries to ground user input, verify real-world
 * events, and resolve official authorities and contacts without hardcoding.
 */
import { callSarvamLlm } from '../sarvam/llm';
import { z } from 'zod';

export const WebSearchPlanSchema = z.object({
  needsSearch: z.boolean(),
  queries: z.array(z.string()).default([]),
  targetEntity: z.string().optional(),
});

export type WebSearchPlan = z.infer<typeof WebSearchPlanSchema>;

const SYSTEM_PROMPT = `You are Munshi's Universal Web Search & Entity Resolution Planner.
Your job is to analyze user input for a document, letter, complaint, or query and determine if real-world internet search is needed for:
1. Verifying or grounding real-world events, news, or incidents (e.g. "this happened today", accidents, policies, schemes).
2. Finding official contact information (official email, portal, address) for any authority, government department, company, bank, or organization.
3. Disambiguating mistaken or colloquial titles (for example, if a regional government is called "PM" or "President" when the real office is Chief Minister, Governor, Mayor, etc.).

RULES:
- Strip conversational filler like "write a letter to", "tell them", "draft an email", "this happened today".
- Formulate 1-2 objective, factual web search queries designed to find official contacts (.gov, .nic, official portals) or verified factual news/reporting.
- For creative writing (poems, personal greetings, fiction), set needsSearch=false and queries=[].
- Return ONLY valid JSON matching schema: { "needsSearch": boolean, "queries": string[], "targetEntity": string }`;

/**
 * Dynamically plans web search queries from user input or recipient hints.
 */
export async function planWebSearch(
  input: string,
  context?: { docTypeId?: string; isRecipientLookup?: boolean },
): Promise<WebSearchPlan> {
  const cleanInput = input.trim();
  if (!cleanInput) {
    return { needsSearch: false, queries: [] };
  }

  // Fast check: if no search API key is configured, skip search
  if (!process.env.SEARCH_API_KEY) {
    return { needsSearch: false, queries: [] };
  }

  try {
    const plan = await callSarvamLlm<WebSearchPlan>({
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: context?.isRecipientLookup
            ? `Recipient Target: "${cleanInput}"`
            : `User Input: "${cleanInput}"\nWriting Type: "${context?.docTypeId || 'auto'}"`,
        },
      ],
      schema: WebSearchPlanSchema,
      temperature: 0.1,
    });

    if (plan && Array.isArray(plan.queries) && plan.queries.length > 0) {
      return {
        needsSearch: Boolean(plan.needsSearch),
        queries: plan.queries.slice(0, 2),
        targetEntity: plan.targetEntity?.trim() || undefined,
      };
    }
  } catch (err) {
    console.warn('Dynamic web search planning fallback due to error:', err);
  }

  // Fallback heuristic if LLM call fails
  const stripped = cleanInput
    .replace(/^(?:write\s+(?:a\s+letter\s+)?to|letter\s+to|complaint\s+to|draft\s+an?\s+(?:email|letter)\s+to|send\s+to|contact)\s+/i, '')
    .trim();

  if (context?.isRecipientLookup) {
    return {
      needsSearch: true,
      queries: [
        `${stripped} official contact email address`,
        `${stripped} official portal`,
      ],
      targetEntity: stripped,
    };
  }

  const hasEventOrEntity =
    /\b(?:today|yesterday|incident|accident|news|bank|police|minister|commissioner|collector|portal|complaint|grievance|office)\b/i.test(
      cleanInput,
    );

  if (hasEventOrEntity) {
    return {
      needsSearch: true,
      queries: [`${stripped} official contact information`],
      targetEntity: stripped,
    };
  }

  return { needsSearch: false, queries: [] };
}
