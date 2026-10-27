import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeStats, fmtMinutes, fmtHour } from '../js/stats.js';
import { daysUntil, examPlan } from '../js/exams.js';

const MIN = 60000;
const at = (day, hour) => new Date(2026, 9, day, hour).getTime(); // October 2026
const session = (end, { ms = 25 * MIN, ok = true, cls = '' } = {}) => ({ id: String(end), taskId: null, cls, start: end - ms, end, ms, ok });
const now = at(27, 18); // a Tuesday

test('today, this week, and the last seven days oldest first', () => {
  const s = computeStats([session(at(27, 10)), session(at(27, 15)), session(at(25, 9)), session(at(19, 9))], now);
  assert.equal(s.todayMin, 50);
  assert.equal(s.weekMin, 75); // the 19th is more than a week back
  assert.deepEqual(s.days.map(d => d.label), ['Wed', 'Thu', 'Fri', 'Sat', 'Sun', 'Mon', 'Tue']);
  assert.equal(s.days[4].minutes, 25); // Sunday the 25th
});

test('finish rate counts unfinished sessions in the last 30 days', () => {
  const s = computeStats([session(at(27, 10)), session(at(26, 10)), session(at(26, 12), { ok: false, ms: 5 * MIN })], now);
  assert.equal(s.finishRate, 2 / 3);
  assert.equal(computeStats([], now).finishRate, null);
});

test('classes are sorted by time and the tail folds into Other', () => {
  const list = ['A', 'B', 'C', 'D', 'E', 'F'].flatMap((cls, i) =>
    Array.from({ length: 6 - i }, (_, k) => session(at(20 + k, 10 + i), { cls })));
  const s = computeStats(list, now);
  assert.deepEqual(s.classes.map(c => c.name), ['A', 'B', 'C', 'D', 'Other']);
  assert.equal(s.classes[4].minutes, (2 + 1) * 25);
});

test('best hour is when the most finished focus started', () => {
  const s = computeStats([session(at(27, 21)), session(at(26, 21)), session(at(25, 9))], now);
  assert.equal(s.bestHour, 20); // sessions ending at 9pm started at 8:35pm
  assert.equal(computeStats([], now).bestHour, null);
});

test('a streak through yesterday still shows today', () => {
  const s = computeStats([session(at(26, 10)), session(at(25, 10))], now);
  assert.equal(s.streak, 2);
});

test('formatting', () => {
  assert.equal(fmtMinutes(45), '45m');
  assert.equal(fmtMinutes(60), '1h');
  assert.equal(fmtMinutes(95), '1h 35m');
  assert.equal(fmtHour(0), '12 am');
  assert.equal(fmtHour(13), '1 pm');
});

test('exam days left counts calendar days', () => {
  assert.equal(daysUntil('2026-10-27', now), 0);
  assert.equal(daysUntil('2026-10-31', now), 4);
  assert.equal(daysUntil('2026-11-05', now), 9); // across the end of daylight saving time
  assert.equal(daysUntil('2026-10-20', now), -7);
});

test('exam plan spreads the remaining sessions over the days left', () => {
  const exam = { id: 'e', name: 'Midterm', cls: 'BIO 150', date: '2026-10-31', goal: 10, createdAt: at(20, 0) };
  const sessions = [
    session(at(25, 10), { cls: 'BIO 150' }),
    session(at(26, 10), { cls: 'BIO 150' }),
    session(at(26, 12), { cls: 'MATH 221' }), // other class
    session(at(19, 10), { cls: 'BIO 150' }), // before the exam was added
  ];
  assert.deepEqual(examPlan(exam, sessions, now), { days: 4, done: 2, left: 8, perDay: 2 });
});
