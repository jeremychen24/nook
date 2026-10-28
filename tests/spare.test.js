import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomCode } from '../js/spare.js';

test('passcodes are six digits and never an easy pattern', () => {
  const codes = Array.from({ length: 3000 }, randomCode);
  for (const code of codes) {
    assert.match(code, /^\d{6}$/);
    assert.doesNotMatch(code, /^(\d)\1+$/);
    assert.ok(!'0123456789'.includes(code) && !'9876543210'.includes(code), code);
  }
  assert.ok(new Set(codes).size > 2900); // practically no repeats
});

test('every digit turns up about equally often', () => {
  const counts = Array(10).fill(0);
  for (let i = 0; i < 5000; i++) for (const d of randomCode()) counts[d]++;
  const expected = (5000 * 6) / 10;
  for (const n of counts) assert.ok(Math.abs(n - expected) < expected * 0.08, `digit count ${n}`);
});
