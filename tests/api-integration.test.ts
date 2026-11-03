/**
 * API route integration tests (middleware, validation, access gate, error envelopes).
 * Run with: node --loader ./scripts/loader.mjs --experimental-strip-types tests/api-integration.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';

// Set environment variables for testing
process.env.ACCESS_CODE = 'test-secret-code';
process.env.SARVAM_API_KEY = 'sk_test_mock_sarvam_key';
process.env.SEARCH_API_KEY = 'test_search_key';

import { GET as healthGet } from '../src/app/api/health/route.ts';
import { POST as understandPost } from '../src/app/api/understand/route.ts';
import { POST as commandPost } from '../src/app/api/command/route.ts';
import { POST as translatePost } from '../src/app/api/translate/route.ts';
import { POST as recipientPost } from '../src/app/api/recipient/route.ts';
import { GET as visionStatusGet } from '../src/app/api/vision/status/route.ts';
import { checkRateLimit, checkDailyLimit } from '../src/server/rate-limit.ts';

function createRequest(
  url: string,
  method = 'POST',
  body?: unknown,
  headers?: Record<string, string>,
): Request {
  const h = new Headers(headers || {});
  if (body && !h.has('content-type')) {
    h.set('content-type', 'application/json');
  }
  return new Request(url, {
    method,
    headers: h,
    body: body ? JSON.stringify(body) : undefined,
  });
}

// ── 1. Health Route ──────────────────────────────────────────────────────────

test('GET /api/health succeeds without access code', async () => {
  const res = await healthGet();
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.ok, true);
  assert.equal(data.service, 'munshi-backend');
});

// ── 2. Access Code & Middleware Protection ───────────────────────────────────

test('Protected routes reject requests with missing access code (403 ACCESS_DENIED)', async () => {
  const req = createRequest('http://localhost:3000/api/understand', 'POST', {
    docTypeId: 'grievance',
    segments: [],
    docs: [],
    inputLang: 'hi-IN',
  });

  const res = await understandPost(req);
  assert.equal(res.status, 403);
  const data = await res.json();
  assert.equal(data.code, 'ACCESS_DENIED');
  assert.equal(data.retryable, false);
  assert.ok(data.requestId);
});

test('Protected routes reject requests with wrong access code', async () => {
  const req = createRequest(
    'http://localhost:3000/api/command',
    'POST',
    { text: 'make it firmer', draft: {}, case: {} },
    { 'x-access-code': 'wrong-code-here' },
  );

  const res = await commandPost(req);
  assert.equal(res.status, 403);
  const data = await res.json();
  assert.equal(data.code, 'ACCESS_DENIED');
});

test('Protected routes propagate x-request-id in error envelopes', async () => {
  const customReqId = 'req_custom_trace_987';
  const req = createRequest(
    'http://localhost:3000/api/command',
    'POST',
    {},
    {
      'x-access-code': 'test-secret-code',
      'x-request-id': customReqId,
    },
  );

  const res = await commandPost(req);
  assert.equal(res.status, 400); // validation failed
  const data = await res.json();
  assert.equal(data.requestId, customReqId);
  assert.equal(data.code, 'VALIDATION_FAILED');
});

// ── 3. Request Body Validation ───────────────────────────────────────────────

test('Validation: rejects malformed bodies with 400 VALIDATION_FAILED', async () => {
  const req = createRequest(
    'http://localhost:3000/api/understand',
    'POST',
    { docTypeId: 123 }, // Invalid type for docTypeId
    { 'x-access-code': 'test-secret-code' },
  );

  const res = await understandPost(req);
  assert.equal(res.status, 400);
  const data = await res.json();
  assert.equal(data.code, 'VALIDATION_FAILED');
});

test('Validation: GET /api/vision/status requires jobId parameter', async () => {
  const req = new Request('http://localhost:3000/api/vision/status', {
    headers: { 'x-access-code': 'test-secret-code' },
  });

  const res = await visionStatusGet(req);
  assert.equal(res.status, 400);
  const data = await res.json();
  assert.equal(data.code, 'VALIDATION_FAILED');
  assert.match(data.message, /Missing 'jobId'/);
});

// ── 4. Rate Limiter In-Memory Store ─────────────────────────────────────────

test('Rate limiter increments and blocks after limits are exceeded', async () => {
  const testIp = '192.0.2.99';

  // Rapid requests within window
  let allowed = true;
  for (let i = 0; i < 35; i++) {
    allowed = await checkRateLimit(testIp);
    if (!allowed) break;
  }
  // Max requests per minute is 30, so 31st+ must be blocked
  assert.equal(allowed, false);
});

test('Daily resource limits enforce caps on vision, stt, and lookups', async () => {
  const testIp = '198.51.100.42';

  // Daily lookup limit is 20
  for (let i = 0; i < 20; i++) {
    const ok = await checkDailyLimit(testIp, 'lookups', 1);
    assert.equal(ok, true);
  }

  // 21st must fail
  const blocked = await checkDailyLimit(testIp, 'lookups', 1);
  assert.equal(blocked, false);
});
