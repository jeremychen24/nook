// Spare key: Nook keeps a copy of the Guided Access passcode so nobody can get locked out by a
// lost note. Outside a focus session it shows right away. During one it shows after a five-minute
// wait (leaving the screen restarts it), or at once with an emergency hold that ends the session.

import { state, update } from './store.js';
import * as timer from './timer.js';
import { release } from './lock.js';
import { holdToConfirm, inFocus } from './quit.js';

const WAIT_MS = 5 * 60 * 1000;
const $ = sel => document.querySelector(sel);
let waitUntil = 0;
let ticker = 0;

export function saveSpareKey(code) {
  update(s => { s.spareKey = { code, savedAt: Date.now() }; });
}

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
  $('#spareText').textContent = 'To end Guided Access, triple-click the side button and enter this code.';
  $('#spareCode').textContent = state.spareKey.code;
  $('#spareClose').textContent = 'Done';
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
