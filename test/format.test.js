'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { formatDuration, formatTime, calculateTrend, computeVelocity } = require('../src/renderer/format');

test('UMD: evaluating in a browser-like context sets window.ClaudeUsageFormat', () => {
  // Simulate the renderer <script> load: no module.exports, just a window.
  const code = fs.readFileSync(path.join(__dirname, '../src/renderer/format.js'), 'utf8');
  const sandbox = { window: {} };
  vm.runInNewContext(code, sandbox);
  assert.ok(sandbox.window.ClaudeUsageFormat, 'named global must be defined');
  assert.strictEqual(typeof sandbox.window.ClaudeUsageFormat.formatTime, 'function');
  assert.strictEqual(typeof sandbox.window.ClaudeUsageFormat.calculateTrend, 'function');
  assert.strictEqual(typeof sandbox.window.ClaudeUsageFormat.computeVelocity, 'function');
});

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

test('formatDuration: minutes / hours / days buckets', () => {
  assert.strictEqual(formatDuration(0), '0m');
  assert.strictEqual(formatDuration(-5000), '0m');
  assert.strictEqual(formatDuration(5 * MIN), '5m');
  assert.strictEqual(formatDuration(2 * HOUR + 9 * MIN), '2h 9m');
  assert.strictEqual(formatDuration(23 * HOUR + 59 * MIN), '23h 59m');
  assert.strictEqual(formatDuration(2 * DAY + 3 * HOUR), '2d 3h');
});

test('formatTime: injectable now; null → placeholder', () => {
  const now = 1_000_000_000_000;
  const resetsAt = new Date(now + 90 * MIN).toISOString();
  assert.strictEqual(formatTime(resetsAt, now), '1h 30m');
  assert.strictEqual(formatTime(null, now), '--:--');
  assert.strictEqual(formatTime('', now), '--:--');
  // already elapsed
  assert.strictEqual(formatTime(new Date(now - MIN).toISOString(), now), '0m');
});

test('calculateTrend: up / down / flat with ±3 deadband and <3 points', () => {
  assert.strictEqual(calculateTrend([10, 20, 30]), 'up');
  assert.strictEqual(calculateTrend([30, 20, 5]), 'down');
  assert.strictEqual(calculateTrend([10, 11, 12]), 'flat'); // within ±3
  assert.strictEqual(calculateTrend([10, 20]), 'flat'); // too few points
  assert.strictEqual(calculateTrend([]), 'flat');
  assert.strictEqual(calculateTrend(null), 'flat');
});

test('calculateTrend: uses only the last 6 points', () => {
  // First value ignored; last-6 window is [0,0,0,0,0,50] → up.
  assert.strictEqual(calculateTrend([99, 0, 0, 0, 0, 0, 50]), 'up');
});

test('computeVelocity: %/hr from first/last; null on insufficient data', () => {
  const t0 = 1_000_000_000_000;
  const points = [
    { timestamp: t0, session: 10, weekly: 20 },
    { timestamp: t0 + HOUR, session: 40, weekly: 25 },
  ];
  const v = computeVelocity(points);
  assert.strictEqual(v.session, 30); // (40-10)/1h
  assert.strictEqual(v.weekly, 5);

  assert.strictEqual(computeVelocity([]), null);
  assert.strictEqual(computeVelocity([{ timestamp: t0, session: 1, weekly: 1 }]), null);
  assert.strictEqual(computeVelocity(null), null);
  // span too small (< 0.01h ≈ 36s)
  assert.strictEqual(computeVelocity([
    { timestamp: t0, session: 1, weekly: 1 },
    { timestamp: t0 + 1000, session: 9, weekly: 9 },
  ]), null);
});
