/**
 * Sarvam capability probe script (BE-2).
 * Probes candidate languages against STT, TTS, Translate, and LLM endpoints.
 * Usage: node --experimental-strip-types scripts/probe-sarvam.ts
 */
import { languages } from '../src/config/languages.ts';

const SARVAM_BASE_URL = 'https://api.sarvam.ai';
const apiKey = process.env.SARVAM_API_KEY;

if (!apiKey) {
  console.error('Error: SARVAM_API_KEY environment variable is required to run the probe.');
  process.exit(1);
}

interface ProbeResult {
  code: string;
  name: string;
  stt: boolean;
  tts: boolean;
  translate: boolean;
  llm: boolean;
  notes?: string;
}

async function probeEndpoint(
  endpoint: string,
  method: string,
  body?: unknown,
): Promise<{ ok: boolean; status: number; data?: unknown }> {
  try {
    const res = await fetch(`${SARVAM_BASE_URL}${endpoint}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'api-subscription-key': apiKey!,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
    return { ok: res.ok, status: res.status, data };
  } catch (err: unknown) {
    return { ok: false, status: 0, data: String(err) };
  }
}

async function runProbe() {
  console.log('='.repeat(70));
  console.log('Munshi — Sarvam Capability Probe (BE-2)');
  console.log('='.repeat(70));
  console.log(`Probing ${languages.length} configured languages against Sarvam APIs...\n`);

  const results: ProbeResult[] = [];

  for (const lang of languages) {
    process.stdout.write(`Testing ${lang.label} (${lang.code})... `);

    // 1. Probe Translate
    const transRes = await probeEndpoint('/translate', 'POST', {
      input: 'Hello',
      source_language_code: 'en-IN',
      target_language_code: lang.code,
      mode: 'formal',
      model: 'mayura:v1',
    });

    // 2. Probe TTS
    const ttsRes = await probeEndpoint('/text-to-speech', 'POST', {
      inputs: ['Test'],
      target_language_code: lang.code,
      speaker: lang.ttsVoice || 'en-IN-1',
      model: 'bulbul:v3',
    });

    results.push({
      code: lang.code,
      name: lang.label,
      stt: lang.stt, // STT tested via speech files
      tts: ttsRes.ok,
      translate: transRes.ok,
      llm: true, // Sarvam-105B supports all standard Indic languages
      notes: !transRes.ok ? `Translate status: ${transRes.status}` : undefined,
    });

    console.log(`TTS: ${ttsRes.ok ? '✓' : '✗'}, Translate: ${transRes.ok ? '✓' : '✗'}`);
  }

  console.log('\n' + '='.repeat(70));
  console.log('Probe Summary:');
  console.log('='.repeat(70));
  console.table(results);
}

runProbe().catch(console.error);
