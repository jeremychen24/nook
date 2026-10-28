// Study planner: weekly classes (with optional A/B days), study hours and tests become
// suggested focus sessions for the coming days.

import { state, update, uid } from './store.js';
import { examPlan } from './exams.js';

const BUFFER = 15; // minutes kept free after each class
const MAX_PER_DAY = 10;
export const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const toMin = hhmm => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};
const hhmm = min => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
export const fmtTime = min => `${Math.floor(min / 60) % 12 || 12}:${String(min % 60).padStart(2, '0')} ${min < 720 ? 'AM' : 'PM'}`;
export const dateKey = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const isWeekend = d => d.getDay() === 0 || d.getDay() === 6;
const roundUp = (min, step) => Math.ceil(min / step) * step;

const fromKey = key => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
};

// 'A' or 'B' when A/B days are on, null on weekends or when they're off.
// School days (Mon–Fri) alternate, counting from a date the user marked as an A or B day.
export function abDay(ab, date) {
  if (!ab?.on || !ab.date || isWeekend(date)) return null;
  const day = fromKey(dateKey(date));
  const cursor = fromKey(ab.date);
  const step = day >= cursor ? 1 : -1;
  let schoolDays = 0;
  while (dateKey(cursor) !== dateKey(day)) {
    cursor.setDate(cursor.getDate() + step);
    if (!isWeekend(cursor)) schoolDays++;
  }
  if (schoolDays % 2 === 0) return ab.letter;
  return ab.letter === 'A' ? 'B' : 'A';
}

// Classes and other commitments on a date, as minutes since midnight, earliest first.
export function busyOn(schedule, ab, date) {
  const letter = abDay(ab, date);
  return schedule
    .filter(b => b.days.includes(date.getDay()) && (!b.ab || b.ab === letter))
    .map(b => ({ start: toMin(b.start), end: toMin(b.end), name: b.name }))
    .sort((x, y) => x.start - y.start);
}

// Free stretches between `from` and `to` (minutes), keeping BUFFER clear after each busy block.
export function freeTimes(busy, from, to) {
  const free = [];
  let t = from;
  for (const b of busy) {
    if (b.start > t) free.push([t, Math.min(b.start, to)]);
    t = Math.max(t, b.end + BUFFER);
  }
  if (t < to) free.push([t, to]);
  return free.filter(([a, z]) => z > a);
}

// Suggested sessions for the next `days` days, today first. Each day gets one session per test
// still ahead (at that test's daily pace, nearest test first), topped up to the daily goal, placed
// back to back with Pomodoro breaks in the free time inside study hours. Ids are the date and time,
// so a suggestion the user removed stays removed.
export function planDays(s = state, now = Date.now(), days = 7) {
  const { focusMin, shortMin, longMin, longEvery } = s.settings;
  const { goal, hours, ab, skipped } = s.plan;
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const nowMin = new Date(now).getHours() * 60 + new Date(now).getMinutes();
  const doneToday = s.sessions.filter(x => x.ok && x.end >= today.getTime()).length;

  const tests = s.exams
    .map(exam => ({ exam, pace: examPlan(exam, s.sessions, now) }))
    .filter(t => t.pace.days > 0 && t.pace.left > 0)
    .sort((a, b) => a.exam.date.localeCompare(b.exam.date));

  const out = [];
  for (let i = 0; i < days; i++) {
    const day = new Date(today);
    day.setDate(day.getDate() + i);
    const key = dateKey(day);

    const wanted = [];
    for (const { exam, pace } of tests) {
      if (key >= exam.date) continue; // no planning on or after the test day
      for (let k = 0; k < pace.perDay; k++) wanted.push({ label: exam.cls || exam.name, cls: exam.cls, examId: exam.id });
    }
    while (wanted.length < goal) wanted.push({ label: 'Focus', cls: '', examId: null });
    const need = Math.max(0, Math.min(wanted.length, MAX_PER_DAY) - (i === 0 ? doneToday : 0));

    const [from, to] = (isWeekend(day) ? hours.weekend : hours.weekday).map(toMin);
    const start = i === 0 ? Math.max(from, roundUp(nowMin + 5, 5)) : from;
    let placed = 0;
    let slot = 0; // counts every slot, removed or not, so break lengths stay in rhythm
    for (const [a, z] of freeTimes(busyOn(s.schedule, ab, day), start, to)) {
      let t = roundUp(a, 5);
      while (placed < need && t + focusMin <= z) {
        const id = `${key}T${hhmm(t)}`;
        if (!skipped.includes(id)) {
          out.push({ id, day: key, start: t, end: t + focusMin, at: new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, t).getTime(), ...wanted[placed] });
          placed++;
        }
        slot++;
        t += focusMin + (slot % longEvery === 0 ? longMin : shortMin);
      }
    }
  }
  return out;
}

// The next suggested session that hasn't started yet, or null.
export const nextSession = (s = state, now = Date.now()) => planDays(s, now, 2).find(p => p.at > now) ?? null;

// Changes

export function addBlock(block) {
  update(s => { s.schedule.push({ id: uid(), ...block }); });
}

export function removeBlock(id) {
  update(s => { s.schedule = s.schedule.filter(b => b.id !== id); });
}

export function changePlan(fn) {
  update(s => fn(s.plan));
}

// Hides one suggestion. Old entries are dropped so the list doesn't grow forever.
export function skipSuggestion(id) {
  const today = dateKey(new Date());
  update(s => { s.plan.skipped = [...s.plan.skipped.filter(k => k >= today), id]; });
}

// Marks today (or the next school day, on a weekend) as an A or B day.
export function setAbToday(letter, now = Date.now()) {
  const d = new Date(now);
  while (isWeekend(d)) d.setDate(d.getDate() + 1);
  changePlan(p => { p.ab = { on: true, date: dateKey(d), letter }; });
}
