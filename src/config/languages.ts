/**
 * Language configuration (BE-2, NFR-3).
 * Shared between backend and frontend. Contains no secrets.
 */

export interface LanguageDef {
  code: string;
  label: string;
  nativeLabel: string;
  script: string;
  fontFamily: string;
  stt: boolean;
  sttMode?: string;
  tts: boolean;
  ttsVoice?: string;
  translate: boolean;
  llm: boolean;
  registerRules?: string;
}

export const languages = [
  {
    code: 'en-IN',
    label: 'English (India)',
    nativeLabel: 'English',
    script: 'Latin',
    fontFamily: "'Noto Sans', sans-serif",
    stt: true,
    sttMode: 'formal',
    tts: true,
    ttsVoice: 'en-IN-1',
    translate: true,
    llm: true,
  },
  {
    code: 'hi-IN',
    label: 'Hindi',
    nativeLabel: 'हिन्दी',
    script: 'Devanagari',
    fontFamily: "'Noto Sans Devanagari', sans-serif",
    stt: true,
    sttMode: 'code-mix',
    tts: true,
    ttsVoice: 'hi-IN-1',
    translate: true,
    llm: true,
    registerRules:
      "Use formal 'आप' (aap) forms for formal/polite/firm tones; informal 'तुम' (tum) or 'तू' (tu) only for friendly/warm creative tones.",
  },
  {
    code: 'bn-IN',
    label: 'Bengali',
    nativeLabel: 'বাংলা',
    script: 'Bengali',
    fontFamily: "'Noto Sans Bengali', sans-serif",
    stt: true,
    sttMode: 'code-mix',
    tts: true,
    ttsVoice: 'bn-IN-1',
    translate: true,
    llm: true,
    registerRules:
      "Use formal 'আপনি' (apni) for formal/polite tones; 'তুমি' (tumi) or 'তুই' (tui) for informal/friendly tones.",
  },
  {
    code: 'gu-IN',
    label: 'Gujarati',
    nativeLabel: 'ગુજરાતી',
    script: 'Gujarati',
    fontFamily: "'Noto Sans Gujarati', sans-serif",
    stt: true,
    sttMode: 'code-mix',
    tts: true,
    ttsVoice: 'gu-IN-1',
    translate: true,
    llm: true,
    registerRules:
      "Use formal 'તમે' (tamé) for formal/polite tones; 'તું' (tu) for friendly/creative tones.",
  },
  {
    code: 'kn-IN',
    label: 'Kannada',
    nativeLabel: 'ಕನ್ನಡ',
    script: 'Kannada',
    fontFamily: "'Noto Sans Kannada', sans-serif",
    stt: true,
    sttMode: 'code-mix',
    tts: true,
    ttsVoice: 'kn-IN-1',
    translate: true,
    llm: true,
    registerRules:
      "Use formal 'ನೀವು' (neevu) for formal/polite tones; 'ನೀನು' (neenu) for friendly/creative tones.",
  },
  {
    code: 'ml-IN',
    label: 'Malayalam',
    nativeLabel: 'മലയാളം',
    script: 'Malayalam',
    fontFamily: "'Noto Sans Malayalam', sans-serif",
    stt: true,
    sttMode: 'code-mix',
    tts: true,
    ttsVoice: 'ml-IN-1',
    translate: true,
    llm: true,
    registerRules:
      "Use formal 'താങ്കൾ' (thaangal) or 'നിങ്ങൾ' (ningal) for formal/polite tones; 'നീ' (nee) for familiar tones.",
  },
  {
    code: 'mr-IN',
    label: 'Marathi',
    nativeLabel: 'मराठी',
    script: 'Devanagari',
    fontFamily: "'Noto Sans Devanagari', sans-serif",
    stt: true,
    sttMode: 'code-mix',
    tts: true,
    ttsVoice: 'mr-IN-1',
    translate: true,
    llm: true,
    registerRules:
      "Use formal 'तुम्ही' (tumhi) or 'आपण' (aapan) for formal/polite tones; 'तू' (tu) for familiar/friendly tones.",
  },
  {
    code: 'or-IN',
    label: 'Odia',
    nativeLabel: 'ଓଡ଼ିଆ',
    script: 'Odia',
    fontFamily: "'Noto Sans Oriya', sans-serif",
    stt: true,
    sttMode: 'formal',
    tts: true,
    ttsVoice: 'or-IN-1',
    translate: true,
    llm: true,
    registerRules:
      "Use formal 'ଆପଣ' (aapana) for formal/polite tones; 'ତୁମେ' (tume) for friendly tones.",
  },
  {
    code: 'pa-IN',
    label: 'Punjabi',
    nativeLabel: 'ਪੰਜਾਬੀ',
    script: 'Gurmukhi',
    fontFamily: "'Noto Sans Gurmukhi', sans-serif",
    stt: true,
    sttMode: 'code-mix',
    tts: true,
    ttsVoice: 'pa-IN-1',
    translate: true,
    llm: true,
    registerRules:
      "Use formal 'ਤੁਸੀਂ' (tussi) for formal/polite tones; 'ਤੂੰ' (tu) for familiar/friendly tones.",
  },
  {
    code: 'ta-IN',
    label: 'Tamil',
    nativeLabel: 'தமிழ்',
    script: 'Tamil',
    fontFamily: "'Noto Sans Tamil', sans-serif",
    stt: true,
    sttMode: 'code-mix',
    tts: true,
    ttsVoice: 'ta-IN-1',
    translate: true,
    llm: true,
    registerRules:
      "Use formal 'நீங்கள்' (neengal) for formal/polite tones; 'நீ' (nee) for familiar/friendly tones.",
  },
  {
    code: 'te-IN',
    label: 'Telugu',
    nativeLabel: 'తెలుగు',
    script: 'Telugu',
    fontFamily: "'Noto Sans Telugu', sans-serif",
    stt: true,
    sttMode: 'code-mix',
    tts: true,
    ttsVoice: 'te-IN-1',
    translate: true,
    llm: true,
    registerRules:
      "Use formal 'మీరు' (meeru) for formal/polite tones; 'నువ్వు' (nuvvu) for familiar/friendly tones.",
  },
] as const satisfies readonly LanguageDef[];

export type LangCode = (typeof languages)[number]['code'];

export const languageMap: Record<string, LanguageDef> = Object.fromEntries(
  languages.map((l) => [l.code, l]),
);

export function getLanguage(code: string): LanguageDef | undefined {
  return languageMap[code];
}

export function isValidLang(code: string): boolean {
  return Boolean(languageMap[code]);
}

export function isSttSupported(code: string): boolean {
  if (code === 'auto') return true;
  return Boolean(languageMap[code]?.stt);
}

export function isTtsSupported(code: string): boolean {
  return Boolean(languageMap[code]?.tts);
}

export function isTranslateSupported(code: string): boolean {
  return Boolean(languageMap[code]?.translate);
}

export function isLlmSupported(code: string): boolean {
  return Boolean(languageMap[code]?.llm);
}
