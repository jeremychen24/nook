// Numbers for the Stats tab, worked out from the session log.

import { streakDays } from './rewards.js';

const MIN = 60000;
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MAX_CLASSES = 5; // more than this fold into "Other"

const minutesOf = list => Math.round(list.reduce((sum, s) => sum + s.ms, 0) / MIN);

// Local midnight `back` days before the day of `ms` (calendar math, so DST is handled).
function dayStart(ms, back = 0) {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - back);
  return d.getTime();
}

export function computeStats(sessions, now = Date.now()) {
  const done = sessions.filter(s => s.ok);

  const days = [];
  for (let back = 6; back >= 0; back--) {
    const start = dayStart(now, back);
    const end = dayStart(now, back - 1);
    days.push({ label: DAY_NAMES[new Date(start).getDay()], start, minutes: minutesOf(done.filter(s => s.end >= start && s.end < end)) });
  }

  // Finish rate and classes look at the last 30 days.
  const recent = sessions.filter(s => s.end >= dayStart(now, 29));
  const finishRate = recent.length ? recent.filter(s => s.ok).length / recent.length : null;

  const byClass = new Map();
  for (const s of recent) {
    if (s.ok) byClass.set(s.cls || 'No class', (byClass.get(s.cls || 'No class') ?? 0) + s.ms);
  }
  let classes = [...byClass].map(([name, ms]) => ({ name, minutes: Math.round(ms / MIN) })).sort((a, b) => b.minutes - a.minutes);
  if (classes.length > MAX_CLASSES) {
    const rest = classes.slice(MAX_CLASSES - 1);
    classes = [...classes.slice(0, MAX_CLASSES - 1), { name: 'Other', minutes: rest.reduce((sum, c) => sum + c.minutes, 0) }];
  }

  // Minutes of finished focus by the hour each session started, all time.
  const hours = Array(24).fill(0);
  for (const s of done) hours[new Date(s.start).getHours()] += s.ms / MIN;
  const best = Math.max(...hours);

  return {
    todayMin: days[6].minutes,
    weekMin: days.reduce((sum, d) => sum + d.minutes, 0),
    // A streak is still alive today if it ran through yesterday.
    streak: streakDays(sessions, now) || streakDays(sessions, dayStart(now, 1)),
    finished: done.length,
    finishRate,
    days,
    classes,
    hours: hours.map(Math.round),
    bestHour: best > 0 ? hours.indexOf(best) : null,
  };
}

const dayKey = ms => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// One month as weeks (Monday first) of days: { key, day, minutes, sessions, inMonth }.
// Days from the neighbouring months fill out the first and last weeks.
export function monthGrid(sessions, year, month) {
  const totals = new Map();
  for (const s of sessions) {
    if (!s.ok) continue;
    const t = totals.get(dayKey(s.end)) ?? { ms: 0, n: 0 };
    t.ms += s.ms;
    t.n++;
    totals.set(dayKey(s.end), t);
  }
  const last = new Date(year, month + 1, 0);
  const d = new Date(year, month, 1);
  d.setDate(1 - ((d.getDay() + 6) % 7)); // back to Monday
  const weeks = [];
  while (d <= last) {
    const week = [];
    for (let i = 0; i < 7; i++) {
      const t = totals.get(dayKey(d));
      week.push({ key: dayKey(d), day: d.getDate(), minutes: t ? Math.round(t.ms / MIN) : 0, sessions: t?.n ?? 0, inMonth: d.getMonth() === month });
      d.setDate(d.getDate() + 1);
    }
    weeks.push(week);
  }
  return weeks;
}

// Finished focus per task (tasks that still exist), most time first.
export function taskTotals(sessions, tasks, limit = 6) {
  const byId = new Map(tasks.map(t => [t.id, t]));
  const totals = new Map();
  for (const s of sessions) {
    if (!s.ok || !byId.has(s.taskId)) continue;
    const t = totals.get(s.taskId) ?? { ms: 0, sessions: 0, last: 0 };
    t.ms += s.ms;
    t.sessions++;
    t.last = Math.max(t.last, s.end);
    totals.set(s.taskId, t);
  }
  return [...totals]
    .map(([id, t]) => ({ name: byId.get(id).name, cls: byId.get(id).cls, minutes: Math.round(t.ms / MIN), sessions: t.sessions, last: t.last }))
    .sort((a, b) => b.minutes - a.minutes)
    .slice(0, limit);
}

// The most days in a row ever with a finished focus session.
export function longestStreak(sessions) {
  const days = [...new Set(sessions.filter(s => s.ok).map(s => dayKey(s.end)))].sort();
  let best = 0;
  let run = 0;
  let prev = null;
  for (const key of days) {
    const [y, m, d] = key.split('-').map(Number);
    const yesterday = dayKey(new Date(y, m - 1, d - 1).getTime());
    run = prev === yesterday ? run + 1 : 1;
    best = Math.max(best, run);
    prev = key;
  }
  return best;
}

export const fmtMinutes = m => (m < 60 ? `${m}m` : `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ''}`);
export const fmtHour = h => `${h % 12 || 12} ${h < 12 ? 'am' : 'pm'}`;
