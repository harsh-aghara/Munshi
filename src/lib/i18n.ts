import enMessages from '@/messages/en';
import hiMessages from '@/messages/hi';

type MessageCatalog = Record<string, string>;

const catalogs: Record<string, MessageCatalog> = {
  'en-IN': enMessages,
  'en': enMessages,
  'hi-IN': hiMessages,
  'hi': hiMessages,
};

export function t(key: string, lang: string = 'en-IN', params?: Record<string, string | number>): string {
  const currentCatalog = catalogs[lang] || catalogs[lang.split('-')[0]] || enMessages;
  let text = currentCatalog[key] || (enMessages as MessageCatalog)[key] || key;

  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    }
  }

  return text;
}
