// Phone lock: keeps the screen awake while focusing and, in face-down mode, runs the timer
// only while the phone lies screen-down. Leaving Nook is handled by timer.checkReturn().

import { state } from './store.js';
import * as timer from './timer.js';

const SETTLE = 400; // ms the phone must hold a new position before it counts as a flip

let wakeLock = null;
let requesting = false;
let listening = false;
let sensorSeen = false;
let faceDown = false;
let pending = false;
let pendingSince = 0;
let armed = false; // Start was tapped; waiting for the phone to go face-down
let lifted = false; // paused because the phone was picked up
let notify = () => {};

export const onLockChange = fn => { notify = fn; };
export const canStayAwake = () => 'wakeLock' in navigator;

// What the lock screen shows: 'off', 'armed' (waiting for the flip), 'down', or 'lifted'.
export function lockView() {
  if (state.settings.mode !== 'facedown' || state.timer.phase !== 'focus') return 'off';
  if (armed) return 'armed';
  if (lifted) return 'lifted';
  return state.timer.status === 'running' ? 'down' : 'off';
}

// Start (or resume) a focus session in face-down mode. Resolves false when there's no
// usable motion sensor, so the caller can fall back to stand mode.
export async function armFaceDown() {
  if (!(await listen()) || !(await waitForSensor(1500))) return false;
  if (faceDown) timer.start();
  else armed = true;
  changed();
  return true;
}

// Cancels waiting for the flip, or clears the picked-up state when a session ends.
export function release() {
  armed = false;
  lifted = false;
  changed();
}

export async function syncWakeLock() {
  const t = state.timer;
  const want = !document.hidden && (armed || lifted || (t.phase === 'focus' && t.status === 'running'));
  if (want && !wakeLock && !requesting && navigator.wakeLock) {
    requesting = true;
    try {
      const lock = await navigator.wakeLock.request('screen');
      lock.addEventListener('release', () => { if (wakeLock === lock) wakeLock = null; });
      wakeLock = lock;
    } catch {} // e.g. low battery mode refuses it
    requesting = false;
  } else if (!want && wakeLock) {
    const lock = wakeLock;
    wakeLock = null;
    lock.release().catch(() => {});
  }
}

// iOS asks for motion access, and only from a tap, so this runs straight from the Start button.
async function listen() {
  if (listening) return true;
  const Orientation = window.DeviceOrientationEvent;
  if (!Orientation) return false;
  if (typeof Orientation.requestPermission === 'function') {
    try {
      if ((await Orientation.requestPermission()) !== 'granted') return false;
    } catch {
      return false;
    }
  }
  addEventListener('deviceorientation', onOrientation);
  listening = true;
  return true;
}

// Desktops have the API but never send readings, so wait briefly for a real one.
function waitForSensor(ms) {
  const until = Date.now() + ms;
  return new Promise(resolve => {
    const check = () => {
      if (sensorSeen) resolve(true);
      else if (Date.now() > until) resolve(false);
      else setTimeout(check, 100);
    };
    check();
  });
}

function onOrientation(e) {
  if (e.beta == null) return;
  sensorSeen = true;
  const down = Math.abs(e.beta) > 150; // screen facing the floor, give or take 30°
  const now = performance.now();
  if (down !== pending) {
    pending = down;
    pendingSince = now;
  } else if (down !== faceDown && now - pendingSince >= SETTLE) {
    setFaceDown(down);
  }
}

function setFaceDown(down) {
  faceDown = down;
  const t = state.timer;
  if (state.settings.mode !== 'facedown' || t.phase !== 'focus') return;
  if (down && armed) {
    armed = false;
    timer.start();
  } else if (down && lifted && t.status === 'paused') {
    lifted = false;
    timer.start();
  } else if (!down && t.status === 'running') {
    lifted = true;
    timer.pause();
  }
  changed();
}

function changed() {
  notify();
  syncWakeLock();
}
