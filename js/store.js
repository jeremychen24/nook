// App state: one object saved to localStorage, plus change and event notifications.

const KEY = 'nook:v1';

export function defaults() {
  return {
    version: 1,
    settings: {
      focusMin: 25, shortMin: 5, longMin: 15, longEvery: 4, autoStart: false, mode: 'stand', strict: 'firm',
      sky: 'auto', rain: false, sound: 'off', volume: 0.6, planWide: false,
    },
    timer: { phase: 'focus', status: 'idle', length: 25 * 60000, remaining: 25 * 60000, endsAt: 0, cycle: 0, leftAt: 0, seenAt: 0 },
    tasks: [],
    activeTaskId: null,
    sessions: [],
    scene: 'cafe',
    seenGuide: false,
    coins: 0,
    owned: [], // ids of bought decorations and scenes
    decor: {}, // { sceneId: { slotId: itemId } }, on top of each scene's defaults
    wilted: false,
    spareKey: { code: '', savedAt: 0 }, // copy of the Guided Access passcode, see spare.js
    notes: [], // thoughts parked during focus: { id, text, at }
    exams: [], // { id, name, cls, date: 'YYYY-MM-DD', goal, createdAt }
    schedule: [], // weekly classes and commitments: { id, name, days: [0–6, Sun = 0], start: 'HH:MM', end: 'HH:MM', ab: '' | 'A' | 'B' }
    plan: {
      goal: 4, // focus sessions a day at least; tests can add more
      hours: { weekday: ['15:00', '22:00'], weekend: ['10:00', '20:00'] }, // when you're willing to study
      ab: { on: false, date: '', letter: 'A' }, // A/B days: `date` was a `letter` day
      skipped: [], // ids of suggestions the user removed
    },
  };
}

function normalize(data) {
  const base = defaults();
  if (!data || typeof data !== 'object') return base;
  return {
    ...base,
    ...data,
    settings: { ...base.settings, ...data.settings },
    timer: { ...base.timer, ...data.timer },
    tasks: Array.isArray(data.tasks) ? data.tasks : [],
    sessions: Array.isArray(data.sessions) ? data.sessions : [],
    plan: {
      ...base.plan,
      ...data.plan,
      hours: { ...base.plan.hours, ...data.plan?.hours },
      ab: { ...base.plan.ab, ...data.plan?.ab },
    },
  };
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return normalize(JSON.parse(raw));
  } catch {}
  return defaults();
}

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {}
}

export const state = load();

const listeners = new Set();

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function update(fn) {
  fn(state);
  save();
  for (const listener of listeners) listener(state);
}

// Swaps in a whole new state, e.g. from an imported backup.
export function replaceState(data) {
  update(s => {
    for (const key of Object.keys(s)) delete s[key];
    Object.assign(s, normalize(data));
  });
}

export const exportState = () => JSON.stringify(state, null, 2);

const bus = new EventTarget();
export const emit = (type, detail) => bus.dispatchEvent(new CustomEvent(type, { detail }));
export const on = (type, fn) => bus.addEventListener(type, e => fn(e.detail));

export const uid = () =>
  globalThis.crypto?.randomUUID?.() ?? Date.now().toString(36) + Math.random().toString(36).slice(2);
