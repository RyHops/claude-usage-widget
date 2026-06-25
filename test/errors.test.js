'use strict';
const test = require('node:test');
const assert = require('node:assert');
const {
  classifyFetchError,
  isDestructive,
  isValidUsageShape,
  looksLikeAuthErrorBody,
} = require('../src/lib/errors');

test('classifyFetchError → cloudflare (specific signatures only)', () => {
  assert.strictEqual(classifyFetchError(new Error('CloudflareBlocked: Just a moment')), 'cloudflare');
  assert.strictEqual(classifyFetchError('CloudflareChallenge: Enable JavaScript'), 'cloudflare');
});

test('generic UnexpectedHTML is NON-destructive (unknown, not cloudflare)', () => {
  // Regression guard: a captive portal / ISP block / 5xx proxy page is HTML too,
  // and must NOT wipe a valid session. Only specific CF signatures log out.
  assert.strictEqual(classifyFetchError(new Error('UnexpectedHTML: <html><body>502 Bad Gateway')), 'unknown');
});

test('classifyFetchError → auth', () => {
  assert.strictEqual(classifyFetchError(new Error('SessionExpired')), 'auth');
  assert.strictEqual(classifyFetchError('Request failed: Unauthorized'), 'auth');
  assert.strictEqual(classifyFetchError('HTTP 403: forbidden'), 'auth');
});

test('classifyFetchError → network', () => {
  assert.strictEqual(classifyFetchError(new Error('LoadFailed: -106 ERR_INTERNET_DISCONNECTED')), 'network');
  assert.strictEqual(classifyFetchError(new Error('Request timeout')), 'network');
  assert.strictEqual(classifyFetchError('net::ERR_NAME_NOT_RESOLVED'), 'network');
  assert.strictEqual(classifyFetchError('getaddrinfo ENOTFOUND claude.ai'), 'network');
  assert.strictEqual(classifyFetchError('NetworkOffline: no internet connection'), 'network');
});

test('classifyFetchError → unknown', () => {
  assert.strictEqual(classifyFetchError(new Error('InvalidJSON: {weird}')), 'unknown');
  assert.strictEqual(classifyFetchError('UnexpectedResponse: usage payload missing expected fields'), 'unknown');
  assert.strictEqual(classifyFetchError(''), 'unknown');
  assert.strictEqual(classifyFetchError(null), 'unknown');
  assert.strictEqual(classifyFetchError(undefined), 'unknown');
});

test('cloudflare is checked before network even if both substrings present', () => {
  // A cloudflare body that also mentions a network-ish token must stay cloudflare.
  assert.strictEqual(classifyFetchError('CloudflareChallenge: ERR_ something'), 'cloudflare');
});

test('isDestructive: auth + cloudflare only', () => {
  assert.strictEqual(isDestructive('auth'), true);
  assert.strictEqual(isDestructive('cloudflare'), true);
  assert.strictEqual(isDestructive('network'), false);
  assert.strictEqual(isDestructive('unknown'), false);
});

test('isValidUsageShape: accepts real usage payloads', () => {
  assert.strictEqual(isValidUsageShape({ five_hour: { utilization: 10 } }), true);
  assert.strictEqual(isValidUsageShape({ seven_day: { utilization: 5 } }), true);
  assert.strictEqual(isValidUsageShape({ five_hour: {}, seven_day: {}, extra_usage: {} }), true);
});

test('isValidUsageShape: rejects error/empty/non-object bodies', () => {
  assert.strictEqual(isValidUsageShape({ error: { message: 'Unauthorized' } }), false);
  assert.strictEqual(isValidUsageShape({}), false);
  assert.strictEqual(isValidUsageShape(null), false);
  assert.strictEqual(isValidUsageShape('Just a moment'), false);
  assert.strictEqual(isValidUsageShape([]), false);
  assert.strictEqual(isValidUsageShape({ something: 1 }), false);
});

test('isValidUsageShape: rejects null/array usage windows (typeof null === object trap)', () => {
  assert.strictEqual(isValidUsageShape({ five_hour: null }), false);
  assert.strictEqual(isValidUsageShape({ five_hour: null, seven_day: null }), false);
  assert.strictEqual(isValidUsageShape({ five_hour: [] }), false);
});

test('looksLikeAuthErrorBody: only auth-signalled error bodies', () => {
  assert.strictEqual(looksLikeAuthErrorBody({ error: 'Unauthorized' }), true);
  assert.strictEqual(looksLikeAuthErrorBody({ error: { type: 'not_authenticated' } }), true);
  assert.strictEqual(looksLikeAuthErrorBody({ error: { code: 403 } }), true);
  assert.strictEqual(looksLikeAuthErrorBody({ error: 'rate_limited' }), false);
  assert.strictEqual(looksLikeAuthErrorBody({}), false);
  assert.strictEqual(looksLikeAuthErrorBody(null), false);
});

test('looksLikeAuthErrorBody: catches top-level detail/message shapes', () => {
  assert.strictEqual(looksLikeAuthErrorBody({ detail: 'Authentication credentials were not provided.' }), true);
  assert.strictEqual(looksLikeAuthErrorBody({ message: 'Forbidden' }), true);
  assert.strictEqual(looksLikeAuthErrorBody({ detail: 'rate limited, slow down' }), false);
});
