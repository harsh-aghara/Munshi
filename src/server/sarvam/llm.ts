/**
 * Typed Sarvam LLM wrapper with safety and schema validation (BE-1, BE-5).
 * - Delimited untrusted data
 * - JSON schema validation with 1 retry on malformed output
 * - Clean error mapping to LLM_INVALID_OUTPUT
 */
import type { ZodSchema } from 'zod';
import { sarvamFetch } from './client';
import { AppError } from '../errors';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface SarvamChatCompletionResponse {
  id?: string;
  choices?: Array<{
    message?: {
      role: string;
      content: string;
    };
    finish_reason?: string;
  }>;
}

export interface CallLlmOptions<T> {
  messages: ChatMessage[];
  schema?: ZodSchema<T>;
  temperature?: number;
  maxTokens?: number;
  model?: string;
  signal?: AbortSignal;
}

const DEFAULT_MODEL = process.env.SARVAM_MODEL || 'sarvam-105b-conversations';

/**
 * Extracts and parses JSON from text that might include markdown code fences (```json ... ```).
 */
export function extractJsonFromText(raw: string): unknown {
  const trimmed = raw.trim();
  // Strip code block fences if present
  const match = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  const jsonStr = match ? match[1].trim() : trimmed;
  return JSON.parse(jsonStr);
}

/**
 * Calls Sarvam LLM with schema validation and automatic 1-turn repair on schema failure.
 */
export async function callSarvamLlm<T = string>(
  options: CallLlmOptions<T>,
): Promise<T> {
  const {
    messages,
    schema,
    temperature = 0.2,
    maxTokens = 2048,
    model = DEFAULT_MODEL,
    signal,
  } = options;

  const effectiveMaxTokens =
    model === 'sarvam-105b' ? Math.max(maxTokens, 4096) : maxTokens;

  async function makeRequest(msgs: ChatMessage[]): Promise<string> {
    const res = await sarvamFetch<SarvamChatCompletionResponse>(
      '/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: msgs,
          temperature,
          max_tokens: effectiveMaxTokens,
        }),
      },
      { timeoutMs: 40_000, signal },
    );

    const choice = res.choices?.[0];
    const content = choice?.message?.content;
    if (!content || !content.trim()) {
      if (choice?.finish_reason === 'length') {
        throw new AppError(
          'LLM_INVALID_OUTPUT',
          'Sarvam LLM exceeded token budget during reasoning.',
        );
      }
      throw new AppError(
        'LLM_INVALID_OUTPUT',
        'Sarvam LLM returned empty response choices.',
      );
    }
    return content;
  }

  // First attempt
  const firstResponse = await makeRequest(messages);

  if (!schema) {
    return firstResponse as unknown as T;
  }

  // Try parsing JSON against schema
  try {
    const parsed = extractJsonFromText(firstResponse);
    const valid = schema.safeParse(parsed);
    if (valid.success) {
      return valid.data;
    }

    // Attempt repair once
    const repairMessages: ChatMessage[] = [
      ...messages,
      { role: 'assistant', content: firstResponse },
      {
        role: 'user',
        content: `Your previous response did not adhere to the required JSON schema. Issues: ${valid.error.issues
          .map((i) => `${i.path.join('.')}: ${i.message}`)
          .join('; ')}. Please return ONLY the corrected, raw JSON object matching the schema.`,
      },
    ];

    const secondResponse = await makeRequest(repairMessages);
    const secondParsed = extractJsonFromText(secondResponse);
    const secondValid = schema.safeParse(secondParsed);

    if (secondValid.success) {
      return secondValid.data;
    }

    throw new AppError(
      'LLM_INVALID_OUTPUT',
      `LLM failed schema validation after repair attempt: ${secondValid.error.message}`,
    );
  } catch (err: unknown) {
    if (err instanceof AppError) throw err;

    // Retry repair if JSON parse failed initially
    try {
      const repairMessages: ChatMessage[] = [
        ...messages,
        { role: 'assistant', content: firstResponse },
        {
          role: 'user',
          content: `Your previous response was not valid JSON. Please return ONLY a valid, parseable JSON object with no conversational text.`,
        },
      ];
      const secondResponse = await makeRequest(repairMessages);
      const secondParsed = extractJsonFromText(secondResponse);
      const secondValid = schema.safeParse(secondParsed);
      if (secondValid.success) {
        return secondValid.data;
      }
    } catch {
      // Fall through to LLM_INVALID_OUTPUT
    }

    throw new AppError(
      'LLM_INVALID_OUTPUT',
      `Failed to parse valid JSON from LLM output: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}
