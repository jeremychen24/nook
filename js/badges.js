// Badges: small goals that unlock as you use Nook. Each one is kept once earned (even if the
// thing that earned it changes later) and is worth a few coins.

import { state, update } from './store.js';
import { ITEMS } from './decor.js';
import { SCENES } from './scenes/index.js';
import { examPlan } from './exams.js';
import { longestStreak } from './stats.js';

export const BADGE_COINS = 20;
const MIN = 60000;

export const BADGES = [
  { id: 'first', icon: '🌱', name: 'First focus', hint: 'Finish a focus session', test: c => c.finished >= 1 },
  { id: 'ten', icon: '⭐', name: 'Ten down', hint: 'Finish 10 sessions', test: c => c.finished >= 10 },
  { id: 'fifty', icon: '🌟', name: 'Fifty', hint: 'Finish 50 sessions', test: c => c.finished >= 50 },
  { id: 'century', icon: '💯', name: 'Century', hint: 'Finish 100 sessions', test: c => c.finished >= 100 },
  { id: 'hour', icon: '⏳', name: 'Hour club', hint: 'Focus 1 hour in a day', test: c => c.bestDay >= 60 },
  { id: 'deep', icon: '🧠', name: 'Deep day', hint: 'Focus 3 hours in a day', test: c => c.bestDay >= 180 },
  { id: 'marathon', icon: '🏃', name: 'Marathon', hint: 'Focus 5 hours in a day', test: c => c.bestDay >= 300 },
  { id: 'roll', icon: '🔥', name: 'On a roll', hint: 'Focus 3 days in a row', test: c => c.streak >= 3 },
  { id: 'week', icon: '📅', name: 'Full week', hint: 'Focus 7 days in a row', test: c => c.streak >= 7 },
  { id: 'month', icon: '🏆', name: 'Unstoppable', hint: 'Focus 30 days in a row', test: c => c.streak >= 30 },
  { id: 'clean', icon: '✨', name: 'Clean run', hint: 'Finish 10 in a row without quitting', test: c => c.bestRun >= 10 },
  { id: 'owl', icon: '🦉', name: 'Night owl', hint: 'Finish a session after 11 PM', test: c => c.owl },
  { id: 'bird', icon: '🐦', name: 'Early bird', hint: 'Start a session before 7 AM', test: c => c.bird },
  { id: 'ready', icon: '🎯', name: 'Test ready', hint: 'Reach a test’s session goal', test: c => c.ready },
  { id: 'planner', icon: '🗓️', name: 'Planner', hint: 'Add classes and send a plan to your calendar', test: c => c.planned },
  { id: 'decorator', icon: '🪴', name: 'Decorator', hint: 'Buy a decoration', test: c => c.bought >= 1 },
  { id: 'collector', icon: '🧸', name: 'Collector', hint: 'Own 5 decorations', test: c => c.bought >= 5 },
  { id: 'explorer', icon: '🗺️', name: 'Explorer', hint: 'Unlock every scene', test: c => c.allScenes },
];

const dayOf = ms => new Date(ms).setHours(0, 0, 0, 0);

// Everything the badge goals look at, worked out from saved data.
export function badgeContext(s = state) {
  const done = s.sessions.filter(x => x.ok);
  const perDay = new Map();
  for (const x of done) perDay.set(dayOf(x.end), (perDay.get(dayOf(x.end)) ?? 0) + x.ms);

  let run = 0;
  let bestRun = 0;
  for (const x of [...s.sessions].sort((a, b) => a.end - b.end)) {
    run = x.ok ? run + 1 : 0;
    bestRun = Math.max(bestRun, run);
  }

  return {
    finished: done.length,
    bestDay: Math.max(0, ...perDay.values()) / MIN,
    streak: longestStreak(s.sessions),
    bestRun,
    owl: done.some(x => { const h = new Date(x.end).getHours(); return h >= 23 || h < 4; }),
    bird: done.some(x => { const h = new Date(x.start).getHours(); return h >= 4 && h < 7; }),
    ready: s.exams.some(e => examPlan(e, s.sessions).done >= e.goal),
    planned: s.schedule.length > 0 && s.plan.exported.length > 0,
    bought: s.owned.filter(id => ITEMS[id]).length,
    allScenes: Object.entries(SCENES).every(([id, scene]) => scene.price === 0 || s.owned.includes(id)),
  };
}

// Unlocks badges whose goals are now met and pays their coins. Returns the new ones.
export function checkBadges(s = state) {
  const ctx = badgeContext(s);
  const fresh = BADGES.filter(b => !s.badges[b.id] && b.test(ctx));
  if (fresh.length) {
    update(st => {
      for (const b of fresh) st.badges[b.id] = Date.now();
      st.coins += fresh.length * BADGE_COINS;
    });
  }
  return fresh;
}
