// Pomodoro engine. Time left is worked out from saved timestamps instead of a running
// counter, because iOS pauses JavaScript whenever the app isn't on screen.

import { state, update, emit, uid } from './store.js';

const MIN = 60000;

// How long you can be out of Nook during a focus session before it ends.
export const GRACE = 10 * 1000;

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
    t.leftAt = 0;
    t.seenAt = Date.now();
  });
}

export function pause() {
  update(s => {
    const t = s.timer;
    if (t.status !== 'running') return;
    t.remaining = Math.max(0, t.endsAt - Date.now());
    t.status = 'paused';
    t.leftAt = 0;
  });
}

// Nook went to the background. Only matters while a focus session is running.
export function markLeft(now = Date.now()) {
  const t = state.timer;
  if (t.phase !== 'focus' || t.status !== 'running' || t.leftAt) return;
  update(s => { s.timer.leftAt = now; });
}

// Heartbeat while focusing, so a crash or force-quit (no background event) still counts as leaving.
export function markSeen(now = Date.now()) {
  update(s => { s.timer.seenAt = now; });
}

// Nook is back on screen or just opened. If you were away longer than GRACE before the
// session would have finished, the session ends unfinished. Returns true when that happens.
export function checkReturn(now = Date.now()) {
  const t = state.timer;
  const running = t.phase === 'focus' && t.status === 'running';
  const leftAt = t.leftAt || (t.seenAt && now - t.seenAt > GRACE ? t.seenAt : 0);
  if (!running || !leftAt) {
    if (t.leftAt) update(s => { s.timer.leftAt = 0; });
    return false;
  }
  const failed = Math.min(now, t.endsAt) - leftAt > GRACE;
  update(s => {
    s.timer.leftAt = 0;
    if (!failed) return;
    record(s, s.timer.length - Math.max(0, s.timer.endsAt - leftAt), false, leftAt, 'left');
    setPhase(s, 'focus', false);
  });
  if (failed) emit('failed', { reason: 'left' });
  return failed;
}

// Restarts the current phase. Focus time already spent is logged as an abandoned session.
export function reset() {
  let session = null;
  update(s => {
    session = logAbandoned(s);
    setPhase(s, s.timer.phase, false);
  });
  if (session) emit('abandoned', { session });
}

// Jumps to the next phase without credit.
export function skip() {
  let session = null;
  update(s => {
    session = logAbandoned(s);
    advance(s, false);
  });
  if (session) emit('abandoned', { session });
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
  t.leftAt = 0;
  t.seenAt = run ? now : 0;
}

// reason is set for sessions that ended unfinished because of something other than a tap, e.g. 'left'.
function record(s, ms, ok, end, reason) {
  const task = s.tasks.find(x => x.id === s.activeTaskId);
  const session = { id: uid(), taskId: task?.id ?? null, cls: task?.cls ?? '', start: end - ms, end, ms, ok };
  if (reason) session.reason = reason;
  s.sessions.push(session);
  return session;
}

// Logs a focus session given up after at least a minute; returns it, or null.
function logAbandoned(s) {
  const t = s.timer;
  if (t.phase !== 'focus' || t.status === 'idle') return null;
  const spent = t.length - remaining();
  return spent >= MIN ? record(s, spent, false, Date.now()) : null;
}
