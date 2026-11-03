export interface MailtoParams {
  to: string;
  subject: string;
  body: string;
}

export interface MailtoResult {
  url: string;
  isTruncated: boolean;
  copiedToClipboard: boolean;
  type: 'full' | 'clipboard_fallback';
}

const MAX_SAFE_URI_LENGTH = 1900; // Safe threshold under ~2000 chars

/**
 * Builds a mailto link safely. If the encoded length exceeds the safe URI limit
 * (common with Indic unicode scripts where 1 char = 9+ URI percent-encoded chars),
 * it flags for clipboard copy and uses a shortened placeholder body.
 */
export async function buildMailtoUrl(params: MailtoParams): Promise<MailtoResult> {
  const { to, subject, body } = params;

  const fullUrl = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(
    subject
  )}&body=${encodeURIComponent(body)}`;

  if (fullUrl.length <= MAX_SAFE_URI_LENGTH) {
    return {
      url: fullUrl,
      isTruncated: false,
      copiedToClipboard: false,
      type: 'full',
    };
  }

  // Fallback: Copy full text to clipboard
  let copied = false;
  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(body);
      copied = true;
    } catch (e) {
      console.warn('Clipboard write failed', e);
    }
  }

  const shortBody = '[Text copied to clipboard. Please paste here / कृपया यहाँ पेस्ट करें]';
  const fallbackUrl = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(
    subject
  )}&body=${encodeURIComponent(shortBody)}`;

  return {
    url: fallbackUrl,
    isTruncated: true,
    copiedToClipboard: copied,
    type: 'clipboard_fallback',
  };
}

/**
 * Builds a web Gmail compose link with the same URI length safety check.
 */
export async function buildGmailUrl(params: MailtoParams): Promise<MailtoResult> {
  const { to, subject, body } = params;

  const base = 'https://mail.google.com/mail/?view=cm&fs=1';
  const fullUrl = `${base}&to=${encodeURIComponent(to)}&su=${encodeURIComponent(
    subject
  )}&body=${encodeURIComponent(body)}`;

  if (fullUrl.length <= MAX_SAFE_URI_LENGTH) {
    return {
      url: fullUrl,
      isTruncated: false,
      copiedToClipboard: false,
      type: 'full',
    };
  }

  let copied = false;
  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(body);
      copied = true;
    } catch (e) {
      console.warn('Clipboard write failed', e);
    }
  }

  const shortBody = '[Text copied to clipboard. Please paste here]';
  const fallbackUrl = `${base}&to=${encodeURIComponent(to)}&su=${encodeURIComponent(
    subject
  )}&body=${encodeURIComponent(shortBody)}`;

  return {
    url: fallbackUrl,
    isTruncated: true,
    copiedToClipboard: copied,
    type: 'clipboard_fallback',
  };
}
