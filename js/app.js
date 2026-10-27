import { state, update, subscribe, on, replaceState, exportState } from './store.js';
import * as timer from './timer.js';
import { renderTasks, bindTasks, activeTask } from './tasks.js';
import { unlock, chime } from './sounds.js';
import { SCENES, mountScene, pauseScene, resumeScene } from './scenes/index.js';
import { lockView, armFaceDown, release, syncWakeLock, onLockChange, canStayAwake } from './lock.js';

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

on('complete', ({ phase }) => {
  release();
  chime();
  toast(phase === 'focus' ? 'Focus done' : 'Break over');
});

on('failed', () => {
  release();
  toast('Session ended: you left Nook', 4000);
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

// Live numbers for the scene: sessions finished today and how far the current focus has got.
function sceneInfo() {
  const midnight = new Date().setHours(0, 0, 0, 0);
  const today = state.sessions.filter(s => s.ok && s.end >= midnight).length;
  const t = state.timer;
  const progress = t.phase === 'focus' && t.status !== 'idle' ? 1 - timer.remaining() / t.length : 0;
  return { today, progress };
}

function syncScene() {
  if (state.scene === mountedScene) return;
  mountedScene = state.scene;
  mountScene($('.scene'), state.scene, sceneInfo);
  syncSceneMotion();
}

$('#scenePicker').addEventListener('click', e => {
  const btn = e.target.closest('[data-scene]');
  if (btn) update(s => { s.scene = btn.dataset.scene; });
});

// Settings

function renderSettings() {
  for (const key of Object.keys(STEPS)) $(`[data-value="${key}"]`).textContent = state.settings[key];
  $('#autoStart').checked = state.settings.autoStart;
  $('#scenePicker').innerHTML = Object.entries(SCENES)
    .map(([id, s]) => `<button data-scene="${id}" class="${id === state.scene ? 'on' : ''}">${s.name}</button>`)
    .join('');
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
  syncScene();
}

subscribe(() => {
  renderAll();
  syncWakeLock();
});
onLockChange(renderFocus);
bindTasks(tasksView);
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
