// App state: one object saved to localStorage, plus change and event notifications.

const KEY = 'nook:v1';

export function defaults() {
  return {
    version: 1,
    settings: { focusMin: 25, shortMin: 5, longMin: 15, longEvery: 4, autoStart: false, mode: 'stand' },
    timer: { phase: 'focus', status: 'idle', length: 25 * 60000, remaining: 25 * 60000, endsAt: 0, cycle: 0, leftAt: 0, seenAt: 0 },
    tasks: [],
    activeTaskId: null,
    sessions: [],
    scene: 'cafe',
    seenGuide: false,
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
