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

export const fmtMinutes = m => (m < 60 ? `${m}m` : `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ''}`);
export const fmtHour = h => `${h % 12 || 12} ${h < 12 ? 'am' : 'pm'}`;
