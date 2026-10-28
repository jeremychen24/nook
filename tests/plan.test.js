import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { state, replaceState, defaults } from '../js/store.js';
import { abDay, busyOn, freeTimes, planDays, fmtTime } from '../js/plan.js';
import { buildIcs } from '../js/ics.js';

const MIN = 60000;
const at = (day, h, m = 0) => new Date(2026, 9, day, h, m).getTime(); // October 2026; the 26th is a Monday
const times = list => list.map(p => fmtTime(p.start));

beforeEach(() => replaceState(defaults()));

test('A/B days alternate on school days and skip weekends', () => {
  const ab = { on: true, date: '2026-10-26', letter: 'A' };
  const day = d => abDay(ab, new Date(2026, 9, d));
  assert.deepEqual([26, 27, 28, 29, 30].map(day), ['A', 'B', 'A', 'B', 'A']);
  assert.equal(day(31), null); // Saturday
  assert.equal(abDay(ab, new Date(2026, 10, 2)), 'B'); // the next Monday
  assert.equal(day(23), 'B'); // the Friday before the marked day
  assert.equal(abDay({ ...ab, on: false }, new Date(2026, 9, 27)), null);
});

test('classes count on their days, and A/B classes only on their day', () => {
  const schedule = [
    { id: '1', name: 'Bio', days: [1, 3, 5], start: '10:00', end: '10:50', ab: '' },
    { id: '2', name: 'Art', days: [1, 2, 3, 4, 5], start: '13:00', end: '14:30', ab: 'B' },
  ];
  const ab = { on: true, date: '2026-10-26', letter: 'A' };
  assert.deepEqual(busyOn(schedule, ab, new Date(2026, 9, 26)).map(b => b.name), ['Bio']); // Monday, A
  assert.deepEqual(busyOn(schedule, ab, new Date(2026, 9, 27)).map(b => b.name), ['Art']); // Tuesday, B
});

test('free time leaves 15 minutes after each class', () => {
  assert.deepEqual(freeTimes([{ start: 900, end: 960 }], 840, 1320), [[840, 900], [975, 1320]]);
  assert.deepEqual(freeTimes([], 1320, 1200), []);
});

test('with nothing scheduled, today gets the daily goal from the start of study hours', () => {
  assert.deepEqual(times(planDays(state, at(27, 10), 1)), ['3:00 PM', '3:30 PM', '4:00 PM', '4:30 PM']);
});

test('a class pushes sessions past it, and sessions never start in the past', () => {
  state.schedule.push({ id: 'c', name: 'Chem lab', days: [2], start: '15:00', end: '16:00', ab: '' });
  assert.equal(times(planDays(state, at(27, 10), 1))[0], '4:15 PM');
  assert.deepEqual(times(planDays(state, at(27, 21, 3), 1)), ['9:10 PM']); // only one fits before 10 PM
});

test('sessions already finished today count toward the goal', () => {
  state.sessions.push({ id: 's', taskId: null, cls: '', start: at(27, 9), end: at(27, 9, 25), ms: 25 * MIN, ok: true });
  assert.equal(planDays(state, at(27, 10), 1).length, 3);
});

test('tests come first at their daily pace, and stop on the test day', () => {
  state.exams.push({ id: 'e', name: 'Midterm', cls: 'BIO 150', date: '2026-10-31', goal: 10, createdAt: at(20, 0) });
  const plan = planDays(state, at(27, 10), 5);
  const labels = day => plan.filter(p => p.day === day).map(p => p.label);
  assert.deepEqual(labels('2026-10-27'), ['BIO 150', 'BIO 150', 'BIO 150', 'Focus']); // 10 left over 4 days
  assert.deepEqual(labels('2026-10-31'), ['Focus', 'Focus', 'Focus', 'Focus']); // test day, weekend hours
  assert.equal(plan.find(p => p.day === '2026-10-31').start, 600); // 10 AM on Saturday
});

test('a removed suggestion stays removed and the next free slot takes its place', () => {
  state.plan.skipped.push('2026-10-27T15:00');
  // 4:30 + 25 min focus + the 15 min long break after the fourth slot = 5:10
  assert.deepEqual(times(planDays(state, at(27, 10), 1)), ['3:30 PM', '4:00 PM', '4:30 PM', '5:10 PM']);
});

test('calendar file has UTC times, an alert, escaped text and CRLF lines', () => {
  const [p] = planDays(state, at(27, 10), 1);
  const ics = buildIcs([{ ...p, label: 'Calc, Ch. 4; review' }], at(27, 10));
  assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\n'));
  assert.ok(ics.endsWith('END:VCALENDAR\r\n'));
  assert.match(ics, /DTSTART:\d{8}T\d{6}Z\r\n/);
  assert.match(ics, /SUMMARY:Focus · Calc\\, Ch\. 4\\; review/);
  assert.match(ics, /TRIGGER:-PT5M/);
  assert.ok(ics.split('\r\n').every(line => line.length <= 75));
});
