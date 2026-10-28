// The "are you sure?" screen for leaving a focus session early. Depending on the strictness
// setting, quitting takes a tap (gentle), a 3-second hold (firm), or a hold and then typing a
// sentence (strict). It shows an encouraging line, the progress so far, and what quitting costs.

import { state } from './store.js';
import * as timer from './timer.js';
import { release } from './lock.js';
import { coinsFor, streakDays } from './rewards.js';

const MIN = 60000;
const HOLD_MS = 3000;
export const STRICT_PHRASE = "I'm choosing to stop focusing";

const LINES = [
  'Future you is already proud of this. Don’t leave them hanging.',
  'The urge to quit is loudest right before it gets easy.',
  'Your plant is rooting for you.',
  'Nothing on your phone is as interesting as it’s pretending to be.',
  'You don’t have to feel like it. You just have to stay.',
  'Breaks are coming. This isn’t one of them.',
  'Distraction is a dare. You don’t have to take it.',
  'Stay a little longer. The hard part is starting, and you already did that.',
];
// Used once most of the session is done; {left} becomes the minutes to go.
const NEAR_END_LINES = [
  'Only {left} more minutes. You’ve done the hard part.',
  'You can see the finish from here. {left} minutes.',
  '{left} minutes. You’ve sat through worse.',
];

let action = null; // 'pause' | 'reset' | 'skip'
let line = '';
let cancelQuitHold = () => {};
const $ = sel => document.querySelector(sel);

// A focus session that has started and would be cut short.
export const inFocus = () => state.timer.phase === 'focus' && state.timer.status !== 'idle';

export function openQuit(kind) {
  action = kind;
  const t = state.timer;
  const done = 1 - timer.remaining() / t.length;
  const pool = done >= 0.6 ? NEAR_END_LINES : LINES;
  line = pool[Math.floor(Math.random() * pool.length)];

  const strict = state.settings.strict;
  $('#quitScreen').dataset.level = kind === 'pause' ? 'gentle' : strict;
  $('#quitTap').textContent = kind === 'pause' ? 'Pause anyway' : 'Quit anyway';
  $('#quitType').hidden = true;
  $('#quitPhrase').value = '';
  $('#quitScreen').hidden = false;
  renderQuit();
  $('#quitStay').focus();
}

export function closeQuit() {
  cancelQuitHold();
  action = null;
  $('#quitScreen').hidden = true;
}

// Called every tick while open, so the progress stays live.
export function renderQuit() {
  if (!action) return;
  const t = state.timer;
  const left = Math.max(1, Math.ceil(timer.remaining() / MIN));
  const spent = t.length - timer.remaining();
  $('#quitLine').textContent = line.replace('{left}', left);
  $('#quitBar').style.width = `${Math.min(100, (spent / t.length) * 100)}%`;
  $('#quitProgress').textContent = `${Math.floor(spent / MIN)} of ${Math.round(t.length / MIN)} minutes done · ${left} to go`;

  const stakes = [];
  if (action !== 'pause') {
    if (spent >= MIN) stakes.push('Your plant wilts');
    const { base, bonus } = coinsFor({ ms: t.length, end: Date.now() }, state.sessions);
    stakes.push(`No +${base + bonus} coins`);
    const midnight = new Date().setHours(0, 0, 0, 0);
    const streak = streakDays(state.sessions, midnight - 1); // through yesterday
    if (streak > 0 && !state.sessions.some(s => s.ok && s.end >= midnight)) {
      stakes.push(`Your ${streak}-day streak needs a finished session today`);
    }
  }
  $('#quitStakes').innerHTML = stakes.map(s => `<li>${s}</li>`).join('');
}

function confirmQuit() {
  const kind = action;
  closeQuit();
  if (kind === 'pause') return timer.pause();
  release();
  if (kind === 'skip') timer.skip();
  else timer.reset();
}

// Makes `button` call onDone after being held for three seconds (its .fill bar fills meanwhile);
// letting go early cancels. Returns a function that cancels a hold in progress.
export function holdToConfirm(button, onDone) {
  let pending = 0;
  const start = e => {
    e.preventDefault();
    if (pending) return;
    button.classList.add('holding');
    pending = setTimeout(() => {
      pending = 0;
      button.classList.remove('holding');
      onDone();
    }, HOLD_MS);
  };
  const cancel = () => {
    clearTimeout(pending);
    pending = 0;
    button.classList.remove('holding');
  };
  button.addEventListener('pointerdown', start);
  for (const type of ['pointerup', 'pointerleave', 'pointercancel']) button.addEventListener(type, cancel);
  button.addEventListener('contextmenu', e => e.preventDefault()); // long-press menus on phones
  button.addEventListener('keydown', e => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) start(e); });
  button.addEventListener('keyup', e => { if (e.key === ' ' || e.key === 'Enter') cancel(); });
  return cancel;
}

const normalize = s => s.toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, ' ').replace(/[.!]+$/, '').trim();

export function bindQuit() {
  $('#quitStay').addEventListener('click', closeQuit);
  $('#quitTap').addEventListener('click', confirmQuit);

  // Firm quits after the hold; Strict asks for the sentence next.
  cancelQuitHold = holdToConfirm($('#quitHold'), () => {
    if (state.settings.strict !== 'strict') return confirmQuit();
    $('#quitType').hidden = false;
    $('#quitPhrase').focus();
  });

  $('#quitPhrase').addEventListener('input', e => {
    $('#quitConfirm').disabled = normalize(e.target.value) !== normalize(STRICT_PHRASE);
  });
  $('#quitConfirm').addEventListener('click', confirmQuit);
}
