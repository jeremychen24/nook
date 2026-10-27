import { state, subscribe, on, replaceState, exportState } from './store.js';
import * as timer from './timer.js';
import { renderTasks, bindTasks, activeTask } from './tasks.js';
import { unlock, chime } from './sounds.js';
import { mountScene, pauseScene, resumeScene } from './scenes/index.js';

const $ = sel => document.querySelector(sel);
const LABELS = { focus: 'Focus', short: 'Short break', long: 'Long break' };
const STEPS = { focusMin: [5, 90, 5], shortMin: [1, 30, 1], longMin: [5, 60, 5], longEvery: [2, 8, 1] };
const tasksView = $('#view-tasks');

// Tabs

function show(view) {
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === `view-${view}`));
  document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  if (view === 'focus') resumeScene();
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
  $('#time').textContent = fmt(timer.remaining());
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
  renderTime();
}

$('#startBtn').addEventListener('click', () => {
  unlock();
  if (state.timer.status === 'running') timer.pause();
  else timer.start();
});
$('#resetBtn').addEventListener('click', () => timer.reset());
$('#skipBtn').addEventListener('click', () => timer.skip());
$('#taskChip').addEventListener('click', () => show('tasks'));

let toastTimer;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2400);
}

on('complete', ({ phase }) => {
  chime();
  toast(phase === 'focus' ? 'Focus done' : 'Break over');
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
}

subscribe(renderAll);
bindTasks(tasksView);
mountScene($('.scene'));
timer.tick();
renderAll();

setInterval(() => {
  timer.tick();
  renderTime();
}, 250);

document.addEventListener('visibilitychange', () => {
  if (document.hidden) return;
  timer.tick();
  renderTime();
});

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
