import { state, update, subscribe, on, replaceState, exportState } from './store.js';
import * as timer from './timer.js';
import { renderTasks, bindTasks, activeTask, addNote, removeNote, noteToTask } from './tasks.js';
import { unlock, chime, playAmbient, setVolume } from './sounds.js';
import { computeStats, fmtMinutes, fmtHour } from './stats.js';
import { weekChart, classChart, hourChart } from './charts.js';
import { SCENES, mountScene, pauseScene, resumeScene, sceneThumbnail } from './scenes/index.js';
import { lockView, armFaceDown, release, syncWakeLock, onLockChange, canStayAwake } from './lock.js';
import { award, wilt, water, buy, place, owns, priceOf, decorFor, switchScene, WATER_COST } from './rewards.js';
import { ITEMS } from './decor.js';
import { Painter, makeCanvas } from './pixel.js';
import { nextSession } from './plan.js';
import { renderPlan, bindPlan, whenText } from './planview.js';

const $ = sel => document.querySelector(sel);
const LABELS = { focus: 'Focus', short: 'Short break', long: 'Long break' };
const STEPS = { focusMin: [5, 90, 5], shortMin: [1, 30, 1], longMin: [5, 60, 5], longEvery: [2, 8, 1] };
const tasksView = $('#view-tasks');
const planView = $('#view-plan');

// Tabs

function show(view) {
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === `view-${view}`));
  document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  syncSceneMotion();
  renderStats();
}

// The scene only animates when it can be seen: on wide screens it's always behind the panels.
function syncSceneMotion() {
  const visible = isWide() || $('#view-focus').classList.contains('active');
  if (visible && lockView() === 'off') resumeScene();
  else pauseScene();
}

// Layout: phones stack the scene above the timer; wide screens put it behind everything.
const wideQuery = matchMedia('(min-width: 900px) and (min-aspect-ratio: 1/1)');
const isWide = () => wideQuery.matches;

// Scene pixels across (it's always 196 tall). Wide screens: enough to fill the window. Phones: 180,
// unless the space above the timer is too short for that, in which case the scene is drawn wider
// so all of it fits instead of being cropped.
function sceneWidth() {
  const fill = (w, h) => Math.min(560, Math.max(180, Math.round((196 * w) / h)));
  if (isWide()) return fill(innerWidth, innerHeight);
  const stage = $('#stage');
  const w = stage.clientWidth;
  const h = stage.clientHeight;
  if (!w || !h) return null; // hidden behind another tab: keep the scene as it is
  return h < (w * 196) / 180 ? fill(w, h) : 180;
}

function syncLayout() {
  document.documentElement.classList.toggle('desktop', isWide());
  if (isWide()) document.body.prepend($('#stage'));
  else $('#view-focus').prepend($('#stage'));
  syncScene();
  syncSceneMotion();
  renderPlan(planView); // expanded Plan only applies on big screens
}

wideQuery.addEventListener('change', syncLayout);
// The space for the scene changes with the window and with what the timer area shows
// (a break tip, the next-session line), so redraw when it does.
let resizeTimer;
const resized = () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(syncScene, 150);
};
addEventListener('resize', resized);
new ResizeObserver(resized).observe($('#stage'));

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

  // Breaks: an off-screen suggestion, and any thoughts parked during focus.
  const onBreak = t.phase !== 'focus';
  const coach = $('#coach');
  coach.hidden = !onBreak;
  if (onBreak) coach.textContent = breakTip(t);
  const notes = state.notes.length;
  $('#notesChip').hidden = !onBreak || !notes;
  $('#notesChip').textContent = `${notes} parked ${notes === 1 ? 'thought' : 'thoughts'}`;
  chip.hidden = onBreak && notes > 0;

  // Between sessions, the next planned one from the Plan tab.
  const next = t.phase === 'focus' && t.status === 'idle' ? nextSession() : null;
  $('#nextUp').hidden = !next;
  if (next) $('#nextUp').textContent = `Next · ${whenText(next)} · ${next.label}`;
  $('#noteBtn').hidden = onBreak;

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

const BREAK_TIPS = [
  'Stand up and stretch',
  'Refill your water',
  'Look out a window for a bit',
  'Take five slow breaths',
  'Walk around the room',
  'Roll your shoulders and neck',
  'Rest your eyes for a minute',
  'Tidy your desk',
];
const LONG_BREAK_TIPS = ['Take a short walk outside', 'Get a snack', 'Step away from every screen', 'Stretch properly for a few minutes'];

// Same tip for the whole break, a different one next break.
function breakTip(t) {
  const tips = t.phase === 'long' ? LONG_BREAK_TIPS : BREAK_TIPS;
  return tips[(t.cycle + Math.floor(t.cycle / tips.length)) % tips.length];
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
$('#nextUp').addEventListener('click', () => show('plan'));

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
  const { sky, rain, sound } = state.settings;
  return { decor: state.decor[sceneId] ?? {}, wilted: state.wilted, info: { today, progress }, sky, rain: rain || sound === 'rain' };
}

// Redraws the scene when it changes, or when the window needs a different width.
function syncScene() {
  const width = sceneWidth() ?? (mountedScene ? Number(mountedScene.split(':')[1]) : 180);
  const key = `${state.scene}:${width}`;
  if (key === mountedScene) return;
  mountedScene = key;
  mountScene($('.scene'), state.scene, sceneEnv, width);
  syncSceneMotion();
}

// Decorate sheet

const COIN = $('.coin').outerHTML;
const SKIES = [['auto', 'Auto'], ['dawn', 'Dawn'], ['day', 'Day'], ['sunset', 'Sunset'], ['dusk', 'Dusk'], ['night', 'Night']];
let pending = null; // a tapped scene or item that isn't bought yet: { slot?, id }
const thumbs = {};

function thumb(id) {
  if (SCENES[id]) return (thumbs[`${id}:${state.settings.sky}`] ??= sceneThumbnail(id, state.settings.sky));
  if (!thumbs[id]) {
    const item = ITEMS[id];
    const canvas = makeCanvas(item.w, item.h);
    item.draw(new Painter(canvas), 0, 0);
    thumbs[id] = canvas.toDataURL();
  }
  return thumbs[id];
}

function tile(id, name, { on, attrs }) {
  const owned = owns(id);
  const item = ITEMS[id];
  const scale = item ? Math.max(1, Math.min(3, Math.floor(42 / Math.max(item.w, item.h)))) : 0;
  const size = item ? `width="${item.w * scale}" height="${item.h * scale}"` : '';
  const isPending = pending?.id === id && (!item || pending.slot === attrs.slot);
  const classes = ['tile', item ? '' : 'scene-tile', on ? 'on' : '', owned ? '' : 'locked', isPending ? 'pending' : ''].join(' ');
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
  $('#skyPicker').innerHTML = SKIES
    .map(([id, name]) => `<button data-sky="${id}" class="${id === state.settings.sky ? 'on' : ''}">${name}</button>`)
    .join('');
  $('#rainToggle').checked = state.settings.rain;

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
  // On phones, stop the sheet at the bottom of the scene so the decorations stay in view.
  // (Wide screens show it in the side panel instead.)
  const sceneBottom = $('.scene').getBoundingClientRect().bottom;
  $('.room-card').style.maxHeight = isWide() ? '' : `${Math.max(innerHeight * 0.45, innerHeight - sceneBottom + 8)}px`;
  renderRoom();
}

$('#coinPill').addEventListener('click', openRoom);
$('#roomClose').addEventListener('click', () => { $('#room').hidden = true; });
$('#room').addEventListener('click', e => {
  if (e.target === e.currentTarget) $('#room').hidden = true; // tap above the sheet
});

$('#rainToggle').addEventListener('change', e => timer.setSetting('rain', e.target.checked));

$('#room .room-card').addEventListener('click', e => {
  const pick = e.target.closest('[data-pick]');
  const buyBtn = e.target.closest('[data-buy]');
  const sky = e.target.closest('[data-sky]');
  if (sky) {
    timer.setSetting('sky', sky.dataset.sky);
  } else if (e.target.closest('#waterBtn')) {
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

// Sound sheet

const SOUND_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">';
const SOUNDS = [
  ['off', 'Off', `${SOUND_ICON}<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M17 9l4 6M21 9l-4 6"/></svg>`],
  ['rain', 'Rain', `${SOUND_ICON}<path d="M7 15a4 4 0 1 1 1-7.9A5 5 0 0 1 18 9a3 3 0 0 1 0 6z"/><path d="M8 18l-1 2M12 18l-1 2M16 18l-1 2"/></svg>`],
  ['brown', 'Brown noise', `${SOUND_ICON}<path d="M3 12c2-4 4-4 6 0s4 4 6 0 4-4 6 0"/></svg>`],
  ['fire', 'Fire', `${SOUND_ICON}<path d="M12 21c-4 0-6-3-6-6 0-4 4-6 4-10 3 2 4 4 4 6 1-1 2-2 2-3 2 2 2 4 2 7 0 3-2 6-6 6z"/></svg>`],
];

function renderSound() {
  const [, name, icon] = SOUNDS.find(([id]) => id === state.settings.sound) ?? SOUNDS[0];
  $('#soundIcon').innerHTML = icon;
  $('#soundName').textContent = state.settings.sound === 'off' ? '' : name;
  if ($('#soundSheet').hidden) return;
  $('#soundTiles').innerHTML = SOUNDS
    .map(([id, label, svg]) => `<button class="tile ${id === state.settings.sound ? 'on' : ''}" data-sound="${id}"><span class="art">${svg}</span><span>${label}</span></button>`)
    .join('');
  $('#volume').value = state.settings.volume;
}

$('#soundPill').addEventListener('click', () => {
  $('#soundSheet').hidden = false;
  renderSound();
});

$('#soundTiles').addEventListener('click', e => {
  const btn = e.target.closest('[data-sound]');
  if (!btn) return;
  unlock();
  playAmbient(btn.dataset.sound);
  timer.setSetting('sound', btn.dataset.sound);
});

$('#volume').addEventListener('input', e => {
  setVolume(Number(e.target.value));
  timer.setSetting('volume', Number(e.target.value));
});

// iOS won't play audio until a tap, so a saved sound resumes on the first tap anywhere.
addEventListener('pointerdown', () => {
  unlock();
  setVolume(state.settings.volume);
  playAmbient(state.settings.sound);
}, { once: true, capture: true });

// Parked thoughts

function renderNotes() {
  if ($('#notesSheet').hidden) return;
  const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  $('#noteList').innerHTML = state.notes.map(n => `<li data-id="${n.id}">
      <span>${esc(n.text)}</span>
      <button class="ghost" data-note="task">Make task</button>
      <button class="icon-btn small" data-note="done" aria-label="Clear">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>
      </button>
    </li>`).join('');
  $('#notesEmpty').hidden = state.notes.length > 0;
}

function openNotes() {
  $('#notesSheet').hidden = false;
  renderNotes();
  // On a break you're here to read them; during focus, to write one.
  if (state.timer.phase === 'focus') $('#noteText').focus();
}

$('#noteBtn').addEventListener('click', openNotes);
$('#notesChip').addEventListener('click', openNotes);

$('#noteForm').addEventListener('submit', e => {
  e.preventDefault();
  const text = $('#noteText').value.trim();
  if (!text) return;
  addNote(text);
  $('#noteText').value = '';
  if (state.timer.phase === 'focus' && state.timer.status !== 'idle') {
    $('#notesSheet').hidden = true;
    toast('Parked for your break');
  }
});

$('#noteList').addEventListener('click', e => {
  const id = e.target.closest('li')?.dataset.id;
  const act = e.target.closest('[data-note]')?.dataset.note;
  if (act === 'task') noteToTask(id);
  else if (act === 'done') removeNote(id);
});

// Any sheet's close button, or a tap on its dimmed backdrop, closes it.
document.querySelectorAll('.sheet').forEach(sheet => {
  sheet.addEventListener('click', e => {
    if (e.target !== sheet && !e.target.closest('[data-close]')) return;
    sheet.hidden = true;
    if (sheet.id === 'guide' && !state.seenGuide) update(s => { s.seenGuide = true; });
  });
});

// Stats

function renderStats() {
  if (!$('#view-stats').classList.contains('active')) return;
  const s = computeStats(state.sessions);
  $('#statToday').textContent = fmtMinutes(s.todayMin);
  $('#statWeek').textContent = fmtMinutes(s.weekMin);
  $('#statStreak').textContent = `${s.streak} ${s.streak === 1 ? 'day' : 'days'}`;
  $('#statRate').textContent = s.finishRate === null ? '–' : `${Math.round(s.finishRate * 100)}%`;

  const empty = s.finished === 0;
  $('#statsEmpty').hidden = !empty;
  $('#statCharts').innerHTML = empty ? '' : `
    <h2>Last 7 days</h2>
    <div class="chart">${weekChart(s.days)}<div class="chart-tip" hidden></div></div>
    ${s.classes.length ? `<h2>By class · 30 days</h2><div class="chart">${classChart(s.classes)}<div class="chart-tip" hidden></div></div>` : ''}
    <h2>Time of day</h2>
    <div class="chart">${hourChart(s.hours, s.bestHour)}<div class="chart-tip" hidden></div></div>
    <p class="caption">You start the most focus around ${fmtHour(s.bestHour)}</p>`;
}

// Tooltips: hover on a computer, tap on a phone. They add detail; every value is also in the tables.
function showTip(e) {
  const target = e.target.closest('[data-tip]');
  const chart = e.target.closest('.chart');
  document.querySelectorAll('.chart-tip').forEach(t => { if (!chart || !chart.contains(t)) t.hidden = true; });
  if (!target || !chart) return;
  const tip = chart.querySelector('.chart-tip');
  const box = target.getBoundingClientRect();
  const frame = chart.getBoundingClientRect();
  tip.textContent = target.dataset.tip;
  tip.style.left = `${Math.min(Math.max(box.left + box.width / 2 - frame.left, 40), frame.width - 40)}px`;
  tip.style.top = `${box.top - frame.top + 8}px`;
  tip.hidden = false;
}
$('#statCharts').addEventListener('pointerover', showTip);
$('#statCharts').addEventListener('pointerdown', showTip);
$('#statCharts').addEventListener('pointerleave', () => document.querySelectorAll('.chart-tip').forEach(t => { t.hidden = true; }));

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
  renderPlan(planView);
  renderFocus();
  renderTasks(tasksView);
  renderSettings();
  renderSound();
  renderNotes();
  renderStats();
  renderRoom();
  syncScene();
}

subscribe(() => {
  renderAll();
  syncWakeLock();
});
onLockChange(renderFocus);
bindTasks(tasksView);
bindPlan(planView, { toast });
// Scenes became something you buy; anyone on a locked one goes back to the café.
if (!owns(state.scene)) update(s => { s.scene = 'cafe'; });
timer.checkReturn(); // a session left running when the app was closed
timer.tick();
// Face-down sessions need a tap to turn the motion sensor back on, so they resume paused.
if (state.settings.mode === 'facedown' && state.timer.phase === 'focus' && state.timer.status === 'running') timer.pause();
syncLayout();
renderAll();
syncWakeLock();
if (isIOS && !state.seenGuide) $('#guide').hidden = false;

let lastMinute = new Date().getMinutes();
setInterval(() => {
  timer.tick();
  renderTime();
  const t = state.timer;
  if (t.phase === 'focus' && t.status === 'running' && Date.now() - t.seenAt > 5000) timer.markSeen();
  // Suggestions and the next-up line depend on the clock, so refresh them each minute.
  if (new Date().getMinutes() !== lastMinute) {
    lastMinute = new Date().getMinutes();
    renderFocus();
    renderPlan(planView);
  }
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
