import type {
  ApiError,
  CaseState,
  CommandResult,
  Doc,
  Draft,
  DraftEvent,
  LookupResult,
  Segment,
  VisionStatusResponse,
} from '@/contracts';
import { useMunshiStore } from '@/store/useMunshiStore';

export class MunshiApiClient {
  private static getHeaders(customHeaders: Record<string, string> = {}): Record<string, string> {
    const accessCode = useMunshiStore.getState().accessCode || '';
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    return {
      'X-Access-Code': accessCode,
      'X-Request-Id': requestId,
      ...customHeaders,
    };
  }

  private static async handleResponse<T>(res: Response): Promise<T> {
    if (!res.ok) {
      let err: ApiError;
      try {
        const json = await res.json();
        err = json.error || json;
        if (!err.code) {
          err = {
            code: res.status === 401 || res.status === 403 ? 'ACCESS_DENIED' : 'INTERNAL',
            message: err.message || res.statusText || 'Request failed',
            retryable: res.status >= 500,
            requestId: res.headers.get('x-request-id') || '',
          };
        }
      } catch {
        err = {
          code: res.status === 401 || res.status === 403 ? 'ACCESS_DENIED' : 'INTERNAL',
          message: res.statusText || 'Request failed',
          retryable: res.status >= 500,
          requestId: res.headers.get('x-request-id') || '',
        };
      }

      if (err.code === 'ACCESS_DENIED') {
        useMunshiStore.getState().setAccessDenied(true);
      }
      throw err;
    }

    return res.json() as Promise<T>;
  }

  // GET /api/health
  public static async health(signal?: AbortSignal): Promise<{ ok: boolean }> {
    const res = await fetch('/api/health', { signal });
    return this.handleResponse<{ ok: boolean }>(res);
  }

  // POST /api/stt
  public static async speechToText(
    audioBlob: Blob,
    lang: string = 'auto',
    signal?: AbortSignal
  ): Promise<{ segments: Segment[] }> {
    const cleanType = (audioBlob.type || 'audio/webm').split(';')[0].trim().toLowerCase() || 'audio/webm';
    const cleanBlob = new Blob([audioBlob], { type: cleanType });
    const formData = new FormData();
    formData.append('audio', cleanBlob, 'audio.webm');
    formData.append('lang', lang);

    const headers = this.getHeaders();
    const res = await fetch('/api/stt', {
      method: 'POST',
      headers,
      body: formData,
      signal,
    });

    return this.handleResponse<{ segments: Segment[] }>(res);
  }

  // POST /api/vision
  public static async uploadDocument(
    file: File,
    signal?: AbortSignal
  ): Promise<{ jobId: string }> {
    const formData = new FormData();
    formData.append('file', file);

    const headers = this.getHeaders();
    const res = await fetch('/api/vision', {
      method: 'POST',
      headers,
      body: formData,
      signal,
    });

    return this.handleResponse<{ jobId: string }>(res);
  }

  // GET /api/vision/status?jobId=
  public static async getVisionStatus(
    jobId: string,
    signal?: AbortSignal
  ): Promise<VisionStatusResponse> {
    const headers = this.getHeaders();
    const res = await fetch(`/api/vision/status?jobId=${encodeURIComponent(jobId)}`, {
      headers,
      signal,
    });

    return this.handleResponse<VisionStatusResponse>(res);
  }

  // Helper: Poll Vision status with exponential backoff
  public static async pollVisionStatus(
    jobId: string,
    onProgress?: (progress: number) => void,
    signal?: AbortSignal
  ): Promise<VisionStatusResponse> {
    let delay = 1000;
    const maxDelay = 8000;
    const startTime = Date.now();
    const timeout = 120000; // 2 min max

    while (Date.now() - startTime < timeout) {
      if (signal?.aborted) {
        throw new DOMException('Aborted', 'AbortError');
      }

      const status = await this.getVisionStatus(jobId, signal);
      if (status.progress && onProgress) {
        onProgress(status.progress);
      }

      if (status.state === 'done') {
        return status;
      }
      if (status.state === 'failed') {
        throw (status as any).error || {
          code: 'UPSTREAM_ERROR',
          message: 'Vision processing failed',
          retryable: true,
          requestId: '',
        };
      }

      await new Promise((r) => setTimeout(r, delay));
      delay = Math.min(delay * 1.5, maxDelay);
    }

    throw {
      code: 'UPSTREAM_TIMEOUT',
      message: 'Document vision processing timed out',
      retryable: true,
      requestId: '',
    };
  }

  // POST /api/understand
  public static async understand(
    payload: {
      docTypeId: string;
      customBrief?: string;
      params?: Record<string, string | number | boolean>;
      segments: Segment[];
      docs: Doc[];
      inputLang: string;
      previousCase?: CaseState;
      answers?: Record<string, string> | { key: string; answer: string }[];
    },
    signal?: AbortSignal
  ): Promise<CaseState> {
    // Format answers as Record<string, string> if passed as array
    let answersObj: Record<string, string> | undefined = undefined;
    if (payload.answers) {
      if (Array.isArray(payload.answers)) {
        answersObj = {};
        for (const item of payload.answers) {
          answersObj[item.key] = item.answer;
        }
      } else {
        answersObj = payload.answers;
      }
    }

    const requestBody = {
      docTypeId: payload.docTypeId,
      customBrief: payload.customBrief,
      params: payload.params,
      segments: payload.segments,
      docs: payload.docs,
      inputLang: payload.inputLang,
      previousCase: payload.previousCase,
      answers: answersObj,
    };

    const headers = this.getHeaders({ 'Content-Type': 'application/json' });
    const res = await fetch('/api/understand', {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
      signal,
    });

    return this.handleResponse<CaseState>(res);
  }

  // POST /api/draft (Stream readable)
  public static async streamDraft(
    payload: {
      case: CaseState;
      letterLang: string;
      tone: { id: string } | { custom: string };
      params: Record<string, string | number | boolean>;
      today: string;
      mode?: 'rewrite';
      instruction?: string;
      toneChange?: { id: string } | { custom: string };
      currentDraft?: Draft;
    },
    onEvent: (event: DraftEvent) => void,
    signal?: AbortSignal
  ): Promise<Draft> {
    const headers = this.getHeaders({
      'Content-Type': 'application/json',
      Accept: 'application/x-ndjson, application/json',
    });

    const res = await fetch('/api/draft', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal,
    });

    if (!res.ok) {
      await this.handleResponse(res);
    }

    if (!res.body) {
      throw {
        code: 'INTERNAL',
        message: 'No readable stream available in draft response',
        retryable: true,
        requestId: '',
      };
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let finalDraft: Draft | null = null;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          let jsonStr = trimmed;
          if (trimmed.startsWith('data:')) {
            jsonStr = trimmed.slice(5).trim();
          }

          try {
            const event = JSON.parse(jsonStr) as DraftEvent;
            onEvent(event);
            if (event.type === 'done') {
              finalDraft = event.draft;
            } else if (event.type === 'error') {
              throw event.error;
            }
          } catch (parseErr) {
            console.error('Error parsing draft stream chunk:', parseErr, trimmed);
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    if (!finalDraft) {
      throw {
        code: 'LLM_INVALID_OUTPUT',
        message: 'Draft generation completed without final draft output',
        retryable: true,
        requestId: '',
      };
    }

    return finalDraft;
  }

  // POST /api/command
  public static async executeCommand(
    payload: {
      text: string;
      draft?: Draft;
      case?: CaseState;
    },
    signal?: AbortSignal
  ): Promise<CommandResult> {
    // Schema requires draft and case
    const safeDraft: Draft = payload.draft || {
      caseId: payload.case?.caseId || 'default',
      version: 1,
      lang: 'en-IN',
      docType: payload.case?.docType || 'general_letter',
      layout: 'letter',
      tone: { id: 'formal' },
      blocks: [],
    };

    const safeCase: CaseState = payload.case || {
      caseId: 'default',
      docType: 'general_letter',
      docTypeSource: 'user',
      params: {},
      inputLang: 'en-IN',
      segments: [],
      evidence: [],
      docs: [],
      facts: [],
      missing: [],
      contacts: [],
      round: 0,
    };

    const headers = this.getHeaders({ 'Content-Type': 'application/json' });
    const res = await fetch('/api/command', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        text: payload.text,
        draft: safeDraft,
        case: safeCase,
      }),
      signal,
    });

    return this.handleResponse<CommandResult>(res);
  }

  // POST /api/translate
  public static async translateDraft(
    draft: Draft,
    targetLang: string,
    signal?: AbortSignal
  ): Promise<Draft> {
    const headers = this.getHeaders({ 'Content-Type': 'application/json' });
    const res = await fetch('/api/translate', {
      method: 'POST',
      headers,
      body: JSON.stringify({ draft, targetLang }),
      signal,
    });

    return this.handleResponse<Draft>(res);
  }

  // POST /api/tts
  public static async textToSpeech(
    text: string,
    lang: string,
    signal?: AbortSignal
  ): Promise<string[]> {
    const headers = this.getHeaders({ 'Content-Type': 'application/json' });
    const res = await fetch('/api/tts', {
      method: 'POST',
      headers,
      body: JSON.stringify({ text, lang }),
      signal,
    });

    const data = await this.handleResponse<{ audios: string[] }>(res);
    return data.audios || [];
  }

  // POST /api/recipient
  public static async lookupRecipient(
    payload: {
      hint: { raw: string; org: string; dept?: string; location?: string };
      clarificationAnswer?: string;
    },
    signal?: AbortSignal
  ): Promise<LookupResult> {
    const headers = this.getHeaders({ 'Content-Type': 'application/json' });
    const res = await fetch('/api/recipient', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal,
    });

    return this.handleResponse<LookupResult>(res);
  }
}
