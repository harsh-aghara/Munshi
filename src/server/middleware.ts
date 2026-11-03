/**
 * API middleware: access-code gate, rate limiting, request ID, validation (BE-3).
 * Every /api route except /api/health uses this.
 */
import type { ZodSchema } from 'zod';
import { timingSafeEqual } from 'crypto';
import { AppError, errorResponse } from './errors';
import { log } from './logger';
import { checkRateLimit } from './rate-limit';

function getRequestId(req: Request): string {
  return req.headers.get('x-request-id') || crypto.randomUUID();
}

function getClientIp(req: Request): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    '127.0.0.1'
  );
}

function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return timingSafeEqual(bufA, bufB);
}

export interface ApiContext {
  requestId: string;
  ip: string;
}

type RouteHandler<T = unknown> = (
  body: T,
  ctx: ApiContext,
  req: Request,
) => Promise<Response>;

/**
 * Wraps an API route handler with access-code check, rate limiting,
 * request-id propagation, body validation, error handling, and logging.
 */
export function apiHandler<T>(options: {
  schema?: ZodSchema<T>;
  handler: RouteHandler<T>;
  skipBodyParse?: boolean; // for FormData routes like STT and Vision
}) {
  return async (req: Request): Promise<Response> => {
    const startTime = Date.now();
    const requestId = getRequestId(req);
    const ip = getClientIp(req);
    const route = new URL(req.url).pathname;

    try {
      // 1. Access code check
      const accessCode = process.env.ACCESS_CODE;
      if (!accessCode) {
        throw new AppError('INTERNAL', 'Server misconfigured: ACCESS_CODE not set.');
      }
      const provided = req.headers.get('x-access-code') || '';
      if (!constantTimeCompare(provided, accessCode)) {
        throw new AppError('ACCESS_DENIED', 'Invalid or missing access code.');
      }

      // 2. Rate limit
      const allowed = await checkRateLimit(ip);
      if (!allowed) {
        throw new AppError('RATE_LIMITED', 'Too many requests. Please try again later.');
      }

      // 3. Parse and validate body
      let body: T = undefined as T;
      if (options.schema && !options.skipBodyParse) {
        const raw = await req.json();
        const result = options.schema.safeParse(raw);
        if (!result.success) {
          const issues = result.error.issues
            .map((i) => `${i.path.join('.')}: ${i.message}`)
            .join('; ');
          throw new AppError('VALIDATION_FAILED', `Invalid request: ${issues}`);
        }
        body = result.data;
      }

      // 4. Call handler
      const response = await options.handler(body, { requestId, ip }, req);

      // 5. Log (no personal content)
      log.info('request', {
        requestId,
        route,
        latencyMs: Date.now() - startTime,
        status: response.status,
      });

      return response;
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      if (error instanceof AppError) {
        log.warn(error.message, { requestId, route, latencyMs, status: error.statusCode });
      } else {
        log.error(
          error instanceof Error ? error.message : 'Unknown error',
          { requestId, route, latencyMs, status: 500, error: error instanceof Error ? error.stack : undefined },
        );
      }
      return errorResponse(error, requestId);
    }
  };
}

/**
 * Variant for FormData routes (STT, Vision).
 * Validates the form data inside the handler since Zod can't parse FormData directly.
 */
export function formDataHandler(
  handler: (formData: FormData, ctx: ApiContext, req: Request) => Promise<Response>,
) {
  return apiHandler<undefined>({
    skipBodyParse: true,
    handler: async (_body, ctx, req) => {
      const contentType = req.headers.get('content-type') || '';
      if (!contentType.includes('multipart/form-data')) {
        throw new AppError('VALIDATION_FAILED', 'Expected multipart/form-data.');
      }
      const formData = await req.formData();
      return handler(formData, ctx, req);
    },
  });
}
