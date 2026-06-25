'use strict';
const test = require('node:test');
const assert = require('node:assert');
const {
  validateBool,
  validateInt,
  validateEnum,
  sanitizeCSS,
  MAX_CSS_LENGTH,
} = require('../src/lib/validate');

test('validateBool: only real booleans pass; everything else is undefined', () => {
  assert.strictEqual(validateBool(true), true);
  assert.strictEqual(validateBool(false), false);
  assert.strictEqual(validateBool(undefined), undefined);
  assert.strictEqual(validateBool('true'), undefined);
  assert.strictEqual(validateBool(1), undefined);
  assert.strictEqual(validateBool(null), undefined);
});

test('validateInt: coerces + range-checks; out-of-range/NaN → undefined', () => {
  assert.strictEqual(validateInt(50, 1, 99), 50);
  assert.strictEqual(validateInt('75', 1, 99), 75);
  assert.strictEqual(validateInt(75.6, 1, 99), 76); // rounds
  assert.strictEqual(validateInt(0, 1, 99), undefined);
  assert.strictEqual(validateInt(100, 1, 99), undefined);
  assert.strictEqual(validateInt('abc', 1, 99), undefined);
  assert.strictEqual(validateInt(undefined, 1, 99), undefined);
  assert.strictEqual(validateInt(1, 1, 99), 1); // inclusive min
  assert.strictEqual(validateInt(99, 1, 99), 99); // inclusive max
});

test('validateEnum: membership only', () => {
  const themes = ['dark', 'light', 'system'];
  assert.strictEqual(validateEnum('dark', themes), 'dark');
  assert.strictEqual(validateEnum('LIGHT', themes), undefined); // case-sensitive
  assert.strictEqual(validateEnum('neon', themes), undefined);
  assert.strictEqual(validateEnum(undefined, themes), undefined);
});

test('sanitizeCSS: passes benign CSS', () => {
  const css = '.widget { color: #cba6f7; padding: 4px; }';
  assert.strictEqual(sanitizeCSS(css), css);
  assert.strictEqual(sanitizeCSS(''), '');
});

test('sanitizeCSS: strips dangerous patterns → empty string', () => {
  assert.strictEqual(sanitizeCSS('@import url(evil.css);'), '');
  assert.strictEqual(sanitizeCSS('.x { background: url(http://evil/x.png); }'), '');
  assert.strictEqual(sanitizeCSS('.x { width: expression(alert(1)); }'), '');
  assert.strictEqual(sanitizeCSS('.x { background: javascript:alert(1); }'), '');
  assert.strictEqual(sanitizeCSS('.x { -moz-binding: url(x); }'), '');
});

test('sanitizeCSS: rejects over-length and non-string input', () => {
  assert.strictEqual(sanitizeCSS('a'.repeat(MAX_CSS_LENGTH + 1)), '');
  assert.strictEqual(sanitizeCSS(null), '');
  assert.strictEqual(sanitizeCSS(123), '');
  assert.strictEqual(sanitizeCSS(undefined), '');
});
