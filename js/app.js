import { state, update, subscribe, on, replaceState, exportState } from './store.js';
import * as timer from './timer.js';
import { renderTasks, bindTasks, activeTask } from './tasks.js';
import { unlock, chime } from './sounds.js';
import { SCENES, mountScene, pauseScene, resumeScene, sceneThumbnail } from './scenes/index.js';
import { lockView, armFaceDown, release, syncWakeLock, onLockChange, canStayAwake } from './lock.js';
import { award, wilt, water, buy, place, owns, priceOf, decorFor, switchScene, WATER_COST } from './rewards.js';
import { ITEMS } from './decor.js';
import { Painter, makeCanvas } from './pixel.js';

const $ = sel => document.querySelector(sel);
const LABELS = { focus: 'Focus', short: 'Short break', long: 'Long break' };
const STEPS = { focusMin: [5, 90, 5], shortMin: [1, 30, 1], longMin: [5, 60, 5], longEvery: [2, 8, 1] };
const tasksView = $('#view-tasks');

// Tabs

function show(view) {
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === `view-${view}`));
  document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  syncSceneMotion();
}

// The scene only animates when it can be seen.
function syncSceneMotion() {
  if ($('#view-focus').classList.contains('active') && lockView() === 'off') resumeScene();
  else pauseScene();
}

$('.tabs').addEventListener('click', e => {
  const btn = e.target.closest('button[data-view]');
  if (btn) show(btn.dataset.view);
});

// Focus view

const fmt = ms => {
  const secs = Math.ceil(ms / 1000);
  return `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`;
};

function renderTime() {
  const text = fmt(timer.remaining());
  $('#time').textContent = text;
  $('#lockTime').textContent = text;
}

function renderFocus() {
  const t = state.timer;
  document.body.dataset.phase = t.phase;
  $('#phaseLabel').textContent = LABELS[t.phase];
  $('#startBtn').textContent = t.status === 'running' ? 'Pause' : t.status === 'paused' ? 'Resume' : 'Start';

  const every = state.settings.longEvery;
  const filled = t.phase === 'long' ? every : t.cycle % every;
  $('#dots').innerHTML = Array.from({ length: every }, (_, i) => `<i class="${i < filled ? 'on' : ''}"></i>`).join('');

  const task = activeTask();
  const chip = $('#taskChip');
  chip.textContent = task ? (task.cls ? `${task.cls} · ${task.name}` : task.name) : 'Pick a task';
  chip.classList.toggle('set', !!task);

  // The mode can only change between sessions, and only matters for focus.
  const picker = $('#modePicker');
  picker.hidden = t.phase !== 'focus';
  picker.querySelectorAll('[data-mode]').forEach(b => {
    b.classList.toggle('on', b.dataset.mode === state.settings.mode);
    b.disabled = t.status !== 'idle';
  });

  renderLock();
  renderTime();
}

const LOCK_MSG = { armed: 'Flip your phone face-down to start', lifted: 'Paused. Flip back to keep going' };

function renderLock() {
  const view = lockView();
  const el = $('#lockScreen');
  el.hidden = view === 'off';
  el.dataset.view = view;
  $('#lockMsg').textContent = LOCK_MSG[view] ?? '';
  $('#lockEnd').textContent = view === 'armed' ? 'Cancel' : 'End session';
  syncSceneMotion();
}

let warnedAwake = false;

$('#startBtn').addEventListener('click', async () => {
  unlock();
  const t = state.timer;
  if (t.status === 'running') return timer.pause();
  if (t.phase === 'focus' && state.settings.mode === 'facedown') {
    if (await armFaceDown()) return;
    timer.setSetting('mode', 'stand');
    toast('No motion sensor here, so using stand mode');
  }
  timer.start();
  if (!canStayAwake() && !warnedAwake) {
    warnedAwake = true;
    toast('Set Auto-Lock to Never so the screen stays on', 4000);
  }
});
$('#resetBtn').addEventListener('click', () => {
  release();
  timer.reset();
});
$('#skipBtn').addEventListener('click', () => {
  release();
  timer.skip();
});
$('#taskChip').addEventListener('click', () => show('tasks'));

$('#modePicker').addEventListener('click', e => {
  const btn = e.target.closest('[data-mode]');
  if (btn && !btn.disabled) timer.setSetting('mode', btn.dataset.mode);
});

$('#lockEnd').addEventListener('click', e => {
  e.stopPropagation();
  const wasArmed = lockView() === 'armed';
  release();
  if (!wasArmed) timer.reset();
});

// Tapping the black screen shows the End button for a moment, in case the sensor misreads.
let peekTimer;
$('#lockScreen').addEventListener('click', () => {
  const el = $('#lockScreen');
  el.classList.add('peek');
  clearTimeout(peekTimer);
  peekTimer = setTimeout(() => el.classList.remove('peek'), 4000);
});

let toastTimer;
function toast(msg, ms = 2400) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}

on('complete', ({ phase, session }) => {
  release();
  chime();
  if (!session) return toast('Break over');
  const { base, bonus, streak } = award(session);
  toast(bonus ? `Focus done · +${base + bonus} coins · ${streak}-day streak` : `Focus done · +${base} coins`, 3000);
});

on('failed', () => {
  release();
  wilt();
  toast('Session ended: you left Nook. Your plant wilted', 4000);
});

on('abandoned', () => {
  wilt();
  toast('Your plant wilted');
});

// Guided Access guide: shown once on iPhone, and from Settings any time.

const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

$('#guideBtn').addEventListener('click', () => { $('#guide').hidden = false; });
$('#guideDone').addEventListener('click', () => {
  $('#guide').hidden = true;
  if (!state.seenGuide) update(s => { s.seenGuide = true; });
});

// Scene

let mountedScene = null;

// What the scene shows from app state: decorations, the wilted plant, and live numbers
// (sessions finished today, how far the current focus has got) for the classroom board.
function sceneEnv(sceneId) {
  const midnight = new Date().setHours(0, 0, 0, 0);
  const today = state.sessions.filter(s => s.ok && s.end >= midnight).length;
  const t = state.timer;
  const progress = t.phase === 'focus' && t.status !== 'idle' ? 1 - timer.remaining() / t.length : 0;
  return { decor: state.decor[sceneId] ?? {}, wilted: state.wilted, info: { today, progress } };
}

function syncScene() {
  if (state.scene === mountedScene) return;
  mountedScene = state.scene;
  mountScene($('.scene'), state.scene, sceneEnv);
  syncSceneMotion();
}

// Decorate sheet

const COIN = $('.coin').outerHTML;
let pending = null; // a tapped scene or item that isn't bought yet: { slot?, id }
const thumbs = {};

function thumb(id) {
  if (!thumbs[id]) {
    if (SCENES[id]) thumbs[id] = sceneThumbnail(id);
    else {
      const item = ITEMS[id];
      const canvas = makeCanvas(item.w, item.h);
      item.draw(new Painter(canvas), 0, 0);
      thumbs[id] = canvas.toDataURL();
    }
  }
  return thumbs[id];
}

function tile(id, name, { on, attrs }) {
  const owned = owns(id);
  const item = ITEMS[id];
  const scale = item ? Math.max(1, Math.min(3, Math.floor(42 / Math.max(item.w, item.h)))) : 0;
  const size = item ? `width="${item.w * scale}" height="${item.h * scale}"` : '';
  const isPending = pending?.id === id && (!item || pending.slot === attrs.slot);
  const classes = ['tile', item ? '' : 'scene', on ? 'on' : '', owned ? '' : 'locked', isPending ? 'pending' : ''].join(' ');
  return `<button class="${classes}" data-pick="${id}">
    <span class="art"><img src="${thumb(id)}" alt="" ${size}></span>
    <span>${name}</span>
    ${owned ? '' : `<span class="tile-price">${COIN}${priceOf(id)}</span>`}
  </button>`;
}

function buyButton(id) {
  const price = priceOf(id);
  return state.coins >= price
    ? `<button class="primary small" data-buy="${id}">Buy · ${price}</button>`
    : `<button class="primary small" disabled>Need ${price - state.coins} more</button>`;
}

function renderRoom() {
  $('#coinCount').textContent = state.coins;
  if ($('#room').hidden) return;
  $('#roomCoins').textContent = state.coins;
  $('#wiltBanner').hidden = !state.wilted;
  $('#waterBtn').disabled = state.coins < WATER_COST;

  // Rows are rebuilt on every change; keep each row scrolled where it was.
  const scrolled = {};
  document.querySelectorAll('#room .tiles').forEach(row => {
    scrolled[row.closest('[data-slot]')?.dataset.slot ?? 'scenes'] = row.scrollLeft;
  });
  const restoreScroll = () => document.querySelectorAll('#room .tiles').forEach(row => {
    row.scrollLeft = scrolled[row.closest('[data-slot]')?.dataset.slot ?? 'scenes'] ?? 0;
  });

  $('#sceneTiles').innerHTML = Object.entries(SCENES)
    .map(([id, s]) => tile(id, s.name, { on: id === state.scene, attrs: {} }))
    .join('');
  $('#sceneBuy').innerHTML = pending && !pending.slot ? buyButton(pending.id) : '';

  const decor = decorFor(state.scene);
  $('#slotRows').innerHTML = SCENES[state.scene].slots.map(slot => {
    // Owned things first, then cheapest first.
    const choices = Object.keys(ITEMS)
      .filter(id => ITEMS[id].fits.includes(slot.kind))
      .sort((a, b) => owns(b) - owns(a) || priceOf(a) - priceOf(b));
    const none = `<button class="tile ${decor[slot.id] === 'none' ? 'on' : ''}" data-pick="none"><span class="art">–</span><span>Empty</span></button>`;
    return `<section data-slot="${slot.id}">
      <div class="row-head"><h2>${slot.label}</h2>${pending?.slot === slot.id ? buyButton(pending.id) : ''}</div>
      <div class="tiles">${none}${choices.map(id => tile(id, ITEMS[id].name, { on: decor[slot.id] === id, attrs: { slot: slot.id } })).join('')}</div>
    </section>`;
  }).join('');
  restoreScroll();
}

function openRoom() {
  pending = null;
  const sheet = $('#room');
  sheet.hidden = false;
  // Stop the sheet at the bottom of the scene so the decorations stay in view.
  const sceneBottom = $('.scene').getBoundingClientRect().bottom;
  $('.room-card').style.maxHeight = `${Math.max(innerHeight * 0.45, innerHeight - sceneBottom + 8)}px`;
  renderRoom();
}

$('#coinPill').addEventListener('click', openRoom);
$('#roomClose').addEventListener('click', () => { $('#room').hidden = true; });
$('#room').addEventListener('click', e => {
  if (e.target === e.currentTarget) $('#room').hidden = true; // tap above the sheet
});

$('#room .room-card').addEventListener('click', e => {
  const pick = e.target.closest('[data-pick]');
  const buyBtn = e.target.closest('[data-buy]');
  if (e.target.closest('#waterBtn')) {
    if (water()) toast('Plant watered');
  } else if (buyBtn) {
    const id = buyBtn.dataset.buy;
    const target = pending;
    pending = null;
    if (buy(id)) {
      if (target?.slot) place(state.scene, target.slot, id);
      else switchScene(id);
      toast(`Bought ${ITEMS[id]?.name ?? SCENES[id].name}`);
    }
  } else if (pick) {
    const id = pick.dataset.pick;
    const slot = pick.closest('[data-slot]')?.dataset.slot;
    if (id !== 'none' && !owns(id)) {
      pending = { slot, id };
      renderRoom();
    } else {
      pending = null;
      if (slot) place(state.scene, slot, id);
      else switchScene(id);
    }
  }
});

// Settings

function renderSettings() {
  for (const key of Object.keys(STEPS)) $(`[data-value="${key}"]`).textContent = state.settings[key];
  $('#autoStart').checked = state.settings.autoStart;
}

$('#view-settings').addEventListener('click', e => {
  const btn = e.target.closest('[data-key]');
  if (!btn) return;
  const key = btn.dataset.key;
  const [min, max, step] = STEPS[key];
  timer.setSetting(key, Math.min(max, Math.max(min, state.settings[key] + step * Number(btn.dataset.dir))));
});

$('#autoStart').addEventListener('change', e => timer.setSetting('autoStart', e.target.checked));

$('#exportBtn').addEventListener('click', async () => {
  const name = `nook-backup-${new Date().toISOString().slice(0, 10)}.json`;
  const file = new File([exportState()], name, { type: 'application/json' });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file] }); } catch {} // closing the share sheet throws
    return;
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});

$('#importInput').addEventListener('change', async e => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!Array.isArray(data?.tasks) || !Array.isArray(data?.sessions)) throw new Error('not a backup');
    if (confirm('Replace everything in Nook with this backup?')) {
      replaceState(data);
      toast('Backup restored');
    }
  } catch {
    toast('That file isn’t a Nook backup');
  }
});

// Start up

function renderAll() {
  renderFocus();
  renderTasks(tasksView);
  renderSettings();
  renderRoom();
  syncScene();
}

subscribe(() => {
  renderAll();
  syncWakeLock();
});
onLockChange(renderFocus);
bindTasks(tasksView);
// Scenes became something you buy; anyone on a locked one goes back to the café.
if (!owns(state.scene)) update(s => { s.scene = 'cafe'; });
timer.checkReturn(); // a session left running when the app was closed
timer.tick();
// Face-down sessions need a tap to turn the motion sensor back on, so they resume paused.
if (state.settings.mode === 'facedown' && state.timer.phase === 'focus' && state.timer.status === 'running') timer.pause();
renderAll();
syncWakeLock();
if (isIOS && !state.seenGuide) $('#guide').hidden = false;

setInterval(() => {
  timer.tick();
  renderTime();
  const t = state.timer;
  if (t.phase === 'focus' && t.status === 'running' && Date.now() - t.seenAt > 5000) timer.markSeen();
}, 250);

// Leaving Nook during a focus session ends it after timer.GRACE.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) return timer.markLeft();
  timer.checkReturn();
  timer.tick();
  renderTime();
  syncWakeLock();
});
addEventListener('pagehide', () => timer.markLeft());

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
