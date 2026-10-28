import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { state, replaceState, defaults } from '../js/store.js';
import { monthGrid, taskTotals, longestStreak } from '../js/stats.js';
import { checkBadges, badgeContext, BADGE_COINS } from '../js/badges.js';

const MIN = 60000;
const at = (month, day, h, m = 0) => new Date(2026, month, day, h, m).getTime();
const done = (end, extra = {}) => ({ id: `${end}`, taskId: null, cls: '', start: end - 25 * MIN, end, ms: 25 * MIN, ok: true, ...extra });

beforeEach(() => replaceState(defaults()));

test('a month grid starts on Monday and covers whole weeks', () => {
  const weeks = monthGrid([done(at(9, 12, 15)), done(at(9, 12, 18)), done(at(9, 30, 9), { ok: false })], 2026, 9);
  assert.equal(weeks[0][0].key, '2026-09-28'); // October 2026 starts on a Thursday
  assert.equal(weeks.at(-1).at(-1).key, '2026-11-01');
  assert.ok(weeks.every(w => w.length === 7));
  const day12 = weeks.flat().find(d => d.key === '2026-10-12');
  assert.deepEqual([day12.minutes, day12.sessions, day12.inMonth], [50, 2, true]);
  assert.equal(weeks.flat().find(d => d.key === '2026-10-30').minutes, 0); // unfinished doesn't count
});

test('task totals use finished sessions of tasks that still exist', () => {
  const tasks = [{ id: 'a', name: 'Essay', cls: 'ENGL' }, { id: 'b', name: 'Problem set', cls: 'MATH' }];
  const sessions = [done(at(9, 1, 10), { taskId: 'a' }), done(at(9, 2, 10), { taskId: 'a' }), done(at(9, 3, 10), { taskId: 'b' }), done(at(9, 4, 10), { taskId: 'gone' })];
  const totals = taskTotals(sessions, tasks);
  assert.deepEqual(totals.map(t => [t.name, t.minutes, t.sessions]), [['Essay', 50, 2], ['Problem set', 25, 1]]);
  assert.equal(totals[0].last, at(9, 2, 10));
});

test('longest streak finds the best run of days, across a month boundary', () => {
  const days = [[9, 29], [9, 30], [9, 31], [10, 1], [10, 5], [10, 6]].map(([m, d]) => done(at(m, d, 12)));
  assert.equal(longestStreak(days), 4);
  assert.equal(longestStreak([]), 0);
});

test('badges unlock once, pay coins, and stay earned', () => {
  state.sessions.push(done(at(9, 27, 23, 30)), done(at(9, 27, 15)), done(at(9, 27, 16)));
  const first = checkBadges().map(b => b.id).sort();
  assert.deepEqual(first, ['first', 'hour', 'owl']); // 3 x 25 = 75 minutes that day
  assert.equal(state.coins, 3 * BADGE_COINS);
  assert.equal(checkBadges().length, 0);
  state.sessions = [];
  assert.equal(checkBadges().length, 0);
  assert.ok(state.badges.owl); // kept even though the sessions are gone
});

test('a quit breaks the clean run', () => {
  const list = Array.from({ length: 12 }, (_, i) => done(at(9, 1, 8, i * 30), { ok: i !== 5 }));
  state.sessions.push(...list);
  assert.equal(badgeContext().bestRun, 6);
});
