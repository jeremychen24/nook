// Pomodoro engine. Time left is worked out from saved timestamps instead of a running
// counter, because iOS pauses JavaScript whenever the app isn't on screen.

import { state, update, emit, uid } from './store.js';

const MIN = 60000;

export function lengthOf(phase, settings = state.settings) {
  const mins = phase === 'focus' ? settings.focusMin : phase === 'short' ? settings.shortMin : settings.longMin;
  return mins * MIN;
}

export function remaining(now = Date.now()) {
  const t = state.timer;
  return t.status === 'running' ? Math.max(0, t.endsAt - now) : t.remaining;
}

export function start() {
  update(s => {
    const t = s.timer;
    if (t.status === 'running') return;
    t.endsAt = Date.now() + t.remaining;
    t.status = 'running';
  });
}

export function pause() {
  update(s => {
    const t = s.timer;
    if (t.status !== 'running') return;
    t.remaining = Math.max(0, t.endsAt - Date.now());
    t.status = 'paused';
  });
}

// Restarts the current phase. Focus time already spent is logged as an abandoned session.
export function reset() {
  update(s => {
    logAbandoned(s);
    setPhase(s, s.timer.phase, false);
  });
}

// Jumps to the next phase without credit.
export function skip() {
  update(s => {
    logAbandoned(s);
    advance(s, false);
  });
}

// Called often; finishes the phase once its end time has passed.
export function tick(now = Date.now()) {
  const t = state.timer;
  if (t.status !== 'running' || now < t.endsAt) return;
  const phase = t.phase;
  let session = null;
  update(s => {
    if (phase === 'focus') session = record(s, s.timer.length, true, s.timer.endsAt);
    advance(s, true, now);
  });
  emit('complete', { phase, session });
}

// Applies right away if the timer hasn't started, otherwise from the next phase.
export function setSetting(key, value) {
  update(s => {
    s.settings[key] = value;
    if (s.timer.status === 'idle') setPhase(s, s.timer.phase, false);
  });
}

function advance(s, credited, now = Date.now()) {
  const t = s.timer;
  let next = 'focus';
  if (t.phase === 'focus') {
    if (credited) t.cycle++;
    next = credited && t.cycle % s.settings.longEvery === 0 ? 'long' : 'short';
  }
  setPhase(s, next, credited && s.settings.autoStart, now);
}

function setPhase(s, phase, run, now = Date.now()) {
  const t = s.timer;
  t.phase = phase;
  t.length = lengthOf(phase, s.settings);
  t.remaining = t.length;
  t.status = run ? 'running' : 'idle';
  t.endsAt = run ? now + t.length : 0;
}

function record(s, ms, ok, end) {
  const task = s.tasks.find(x => x.id === s.activeTaskId);
  const session = { id: uid(), taskId: task?.id ?? null, cls: task?.cls ?? '', start: end - ms, end, ms, ok };
  s.sessions.push(session);
  return session;
}

function logAbandoned(s) {
  const t = s.timer;
  if (t.phase !== 'focus' || t.status === 'idle') return;
  const spent = t.length - remaining();
  if (spent >= MIN) record(s, spent, false, Date.now());
}
