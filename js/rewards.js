// Coins and the room: earning coins for finished focus, buying decorations and scenes,
// placing decorations, and the plant that wilts when a session is left unfinished.

import { state, update } from './store.js';
import { ITEMS } from './decor.js';
import { SCENES } from './scenes/index.js';

export const WATER_COST = 10;
const STREAK_STEP = 5; // bonus coins per extra day in a row
const STREAK_CAP = 4; // ...for up to this many extra days

const dayOf = ms => new Date(ms).setHours(0, 0, 0, 0);

// Days in a row, ending on the day of `at`, with at least one finished focus session.
export function streakDays(sessions, at = Date.now()) {
  const days = new Set(sessions.filter(s => s.ok).map(s => dayOf(s.end)));
  let streak = 0;
  // Stepping back from midnight by half a day lands on the day before, even across DST changes.
  for (let day = dayOf(at); days.has(day); day = dayOf(day - 12 * 3600 * 1000)) streak++;
  return streak;
}

// One coin per minute of finished focus, plus a bonus for each extra day of the streak.
export function coinsFor(session, sessions) {
  const base = Math.round(session.ms / 60000);
  const streak = streakDays(sessions, session.end);
  const bonus = STREAK_STEP * Math.min(Math.max(streak - 1, 0), STREAK_CAP);
  return { base, bonus, streak };
}

export function award(session) {
  const reward = coinsFor(session, state.sessions);
  update(s => { s.coins += reward.base + reward.bonus; });
  return reward;
}

export function wilt() {
  if (!state.wilted) update(s => { s.wilted = true; });
}

export function water() {
  if (!state.wilted || state.coins < WATER_COST) return false;
  update(s => {
    s.coins -= WATER_COST;
    s.wilted = false;
  });
  return true;
}

export const priceOf = id => ITEMS[id]?.price ?? SCENES[id]?.price ?? Infinity;
export const owns = id => priceOf(id) === 0 || state.owned.includes(id);

export function buy(id) {
  const price = priceOf(id);
  if (owns(id) || state.coins < price) return false;
  update(s => {
    s.coins -= price;
    s.owned.push(id);
  });
  return true;
}

// Puts an owned decoration in a slot that fits it; 'none' leaves the slot empty.
export function place(sceneId, slotId, itemId) {
  const slot = SCENES[sceneId]?.slots.find(x => x.id === slotId);
  if (!slot) return false;
  if (itemId !== 'none' && (!owns(itemId) || !ITEMS[itemId]?.fits.includes(slot.kind))) return false;
  update(s => { (s.decor[sceneId] ??= {})[slotId] = itemId; });
  return true;
}

export const decorFor = sceneId => ({ ...SCENES[sceneId].defaults, ...state.decor[sceneId] });

export function switchScene(id) {
  if (!SCENES[id] || !owns(id)) return false;
  update(s => { s.scene = id; });
  return true;
}
