// Spare key: Nook keeps a copy of the Guided Access passcode so nobody can get locked out by a
// lost note. Outside a focus session it shows right away. During one it shows after a five-minute
// wait (leaving the screen restarts it), or at once with an emergency hold that ends the session.
// Once it has been shown it's marked as seen, and Nook suggests changing to a new code. Nook can't
// change the iPhone's passcode itself, so the copy only changes when the user says they've set it.

import { state, update } from './store.js';
import * as timer from './timer.js';
import { release } from './lock.js';
import { holdToConfirm, inFocus } from './quit.js';

const WAIT_MS = 5 * 60 * 1000;
const $ = sel => document.querySelector(sel);
let waitUntil = 0;
let ticker = 0;

// A random six-digit passcode, skipping ones that are easy to guess (all one digit, or a run).
export function randomCode() {
  let code;
  do {
    // Bytes under 250 keep each digit equally likely.
    const digits = [...crypto.getRandomValues(new Uint8Array(12))].filter(b => b < 250).slice(0, 6);
    code = digits.length === 6 ? digits.map(b => b % 10).join('') : '';
  } while (!code || /^(\d)\1+$/.test(code) || '0123456789'.includes(code) || '9876543210'.includes(code));
  return code;
}

export function saveSpareKey(code) {
  update(s => { s.spareKey = { code, savedAt: Date.now(), seen: false }; });
}

// The saved code has been shown, so it's worth changing.
export const spareKeySeen = () => Boolean(state.spareKey.code && state.spareKey.seen);

export function openSpare() {
  $('#spareScreen').hidden = false;
  if (inFocus()) startWait();
  else reveal();
}

export function closeSpare() {
  clearInterval(ticker);
  waitUntil = 0;
  $('#spareScreen').hidden = true;
}

function startWait() {
  waitUntil = Date.now() + WAIT_MS;
  $('#spareScreen').dataset.state = 'waiting';
  $('#spareText').textContent = 'You’re in a focus session, so the code shows after this wait. Leaving this screen restarts it.';
  $('#spareClose').textContent = 'Back to focus';
  clearInterval(ticker);
  ticker = setInterval(renderWait, 250);
  renderWait();
}

function renderWait() {
  const left = Math.max(0, waitUntil - Date.now());
  const secs = Math.ceil(left / 1000);
  $('#spareLeft').textContent = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
  $('#spareBar').style.width = `${100 - (left / WAIT_MS) * 100}%`;
  if (!left) reveal();
}

function reveal() {
  clearInterval(ticker);
  $('#spareScreen').dataset.state = 'shown';
  $('#spareText').textContent = 'To end Guided Access, triple-click the power button and enter this code.';
  $('#spareCode').textContent = state.spareKey.code;
  $('#spareClose').textContent = 'Done';
  if (!state.spareKey.seen) update(s => { s.spareKey.seen = true; });
}

export function bindSpare() {
  $('#spareClose').addEventListener('click', closeSpare);
  holdToConfirm($('#spareHold'), () => {
    if (inFocus()) {
      release();
      timer.reset(); // an emergency still ends the session
    }
    reveal();
  });
}
