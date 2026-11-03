/**
 * Shared error handling for all API routes.
 * Implements the ApiError envelope from the contract (BE-4).
 */

// Error codes from the contract
export type ErrorCode =
  | 'ACCESS_DENIED'
  | 'RATE_LIMITED'
  | 'VALIDATION_FAILED'
  | 'UNSUPPORTED_LANGUAGE'
  | 'FILE_UNSUPPORTED'
  | 'UPSTREAM_TIMEOUT'
  | 'UPSTREAM_ERROR'
  | 'LLM_INVALID_OUTPUT'
  | 'INTERNAL';

export interface ApiErrorBody {
  code: ErrorCode;
  message: string;
  retryable: boolean;
  requestId: string;
}

const STATUS_MAP: Record<ErrorCode, number> = {
  ACCESS_DENIED: 403,
  RATE_LIMITED: 429,
  VALIDATION_FAILED: 400,
  UNSUPPORTED_LANGUAGE: 400,
  FILE_UNSUPPORTED: 400,
  UPSTREAM_TIMEOUT: 504,
  UPSTREAM_ERROR: 502,
  LLM_INVALID_OUTPUT: 502,
  INTERNAL: 500,
};

const RETRYABLE: Record<ErrorCode, boolean> = {
  ACCESS_DENIED: false,
  RATE_LIMITED: true,
  VALIDATION_FAILED: false,
  UNSUPPORTED_LANGUAGE: false,
  FILE_UNSUPPORTED: false,
  UPSTREAM_TIMEOUT: true,
  UPSTREAM_ERROR: true,
  LLM_INVALID_OUTPUT: true,
  INTERNAL: false,
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly retryable: boolean;
  readonly statusCode: number;

  constructor(code: ErrorCode, message: string) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.retryable = RETRYABLE[code];
    this.statusCode = STATUS_MAP[code];
  }
}

export function errorResponse(error: unknown, requestId: string): Response {
  if (error instanceof AppError) {
    const body: ApiErrorBody = {
      code: error.code,
      message: error.message,
      retryable: error.retryable,
      requestId,
    };
    return Response.json(body, { status: error.statusCode });
  }

  // Unknown errors become INTERNAL — never leak details
  const body: ApiErrorBody = {
    code: 'INTERNAL',
    message: 'An unexpected error occurred.',
    retryable: false,
    requestId,
  };
  return Response.json(body, { status: 500 });
}
