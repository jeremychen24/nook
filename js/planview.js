// The Plan tab: suggested sessions, tests, weekly classes and study hours.

import { state } from './store.js';
import { esc, CROSS } from './tasks.js';
import { examPlan, addExam, removeExam, changeGoal } from './exams.js';
import { planDays, addBlock, removeBlock, changePlan, skipSuggestion, setAbToday, abDay, fmtTime, toMin, dateKey, DAY_NAMES } from './plan.js';
import { buildIcs } from './ics.js';

const WEEK = [1, 2, 3, 4, 5, 6, 0]; // Monday first
const SHOW_DAYS = 3; // days listed under "Coming up"; Add to Calendar covers a week
let pickedDays = [1, 2, 3, 4, 5];

function dayTitle(key) {
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  if (key === dateKey(today)) return 'Today';
  if (key === dateKey(tomorrow)) return 'Tomorrow';
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function daysText(days) {
  const has = d => days.includes(d);
  if (days.length === 7) return 'Every day';
  if (days.length === 5 && [1, 2, 3, 4, 5].every(has)) return 'Weekdays';
  if (days.length === 2 && has(0) && has(6)) return 'Weekends';
  return WEEK.filter(has).map(d => DAY_NAMES[d]).join(' ');
}

// "4:00 PM" for today, "Tomorrow 4:00 PM" otherwise. Used by the Focus screen's next-up line.
export const whenText = session =>
  session.day === dateKey(new Date()) ? fmtTime(session.start) : `${dayTitle(session.day)} ${fmtTime(session.start)}`;

// Sets an input's value unless the user is typing in it.
function setValue(input, value) {
  if (document.activeElement !== input) input.value = value;
}

export function renderPlan(root) {
  const plan = planDays();
  const days = [...new Set(plan.map(p => p.day))].slice(0, SHOW_DAYS);
  root.querySelector('#planList').innerHTML = days.map(key => `
    <h3 class="day-title">${dayTitle(key)}</h3>
    <ul class="plan-list">${plan.filter(p => p.day === key).map(p => `
      <li data-id="${p.id}">
        <span class="when">${fmtTime(p.start)}</span>
        ${p.cls ? `<span class="tag">${esc(p.cls)}</span>` : `<span class="what">${esc(p.label)}</span>`}
        <button class="icon-btn small" data-skip aria-label="Remove this session">${CROSS}</button>
      </li>`).join('')}
    </ul>`).join('');
  root.querySelector('#planEmpty').hidden = plan.length > 0;
  root.querySelector('#planEmpty').textContent = 'No free time in your study hours for the next week';
  root.querySelector('#calBtn').hidden = plan.length === 0;

  root.querySelector('#examList').innerHTML = state.exams.map(exam => {
    const pace = examPlan(exam, state.sessions);
    const past = pace.days < 0;
    const when = past ? 'Past' : pace.days === 0 ? 'Today' : `${pace.days}`;
    const note = pace.left === 0 ? 'Goal reached' : past ? '' : `${pace.perDay} a day`;
    return `<li class="exam${past ? ' done' : ''}" data-id="${exam.id}">
      <div class="exam-days"><b>${when}</b>${pace.days > 0 ? `<span>${pace.days === 1 ? 'day' : 'days'}</span>` : ''}</div>
      <div class="body">
        <div class="name">${esc(exam.name)}</div>
        <div class="meta">${exam.cls ? `<span class="tag">${esc(exam.cls)}</span>` : ''}<span class="count">${pace.done}/${exam.goal}</span>${note ? `<span>${note}</span>` : ''}</div>
      </div>
      <button class="icon-btn small" data-act="less" aria-label="Lower the session goal">−</button>
      <button class="icon-btn small" data-act="more" aria-label="Raise the session goal">+</button>
      <button class="icon-btn small" data-act="remove" aria-label="Delete test">${CROSS}</button>
    </li>`;
  }).join('');

  const blocks = [...state.schedule].sort((a, b) =>
    WEEK.indexOf(WEEK.find(d => a.days.includes(d))) - WEEK.indexOf(WEEK.find(d => b.days.includes(d))) || a.start.localeCompare(b.start));
  root.querySelector('#blockList').innerHTML = blocks.map(b => `
    <li class="exam" data-id="${b.id}">
      <div class="body">
        <div class="name">${esc(b.name)}</div>
        <div class="meta"><span>${daysText(b.days)}</span><span>${fmtTime(toMin(b.start))}–${fmtTime(toMin(b.end))}</span>${b.ab ? `<span class="tag">${b.ab} days</span>` : ''}</div>
      </div>
      <button class="icon-btn small" data-act="remove" aria-label="Delete">${CROSS}</button>
    </li>`).join('');

  root.querySelector('#dayPicker').innerHTML = WEEK.map(d =>
    `<button type="button" data-day="${d}" class="${pickedDays.includes(d) ? 'on' : ''}" aria-label="${DAY_NAMES[d]}">${DAY_NAMES[d][0]}</button>`).join('');

  const { hours, goal, ab } = state.plan;
  root.querySelectorAll('[data-hours]').forEach(input => setValue(input, hours[input.dataset.hours][input.dataset.end]));
  root.querySelector('#goalValue').textContent = goal;
  root.querySelector('#abToggle').checked = ab.on;
  root.querySelector('#abRow').hidden = !ab.on;
  root.querySelector('#blockAB').hidden = !ab.on;
  const schoolDay = new Date();
  while (schoolDay.getDay() === 0 || schoolDay.getDay() === 6) schoolDay.setDate(schoolDay.getDate() + 1);
  const letter = abDay(ab, schoolDay);
  root.querySelector('#abLabel').textContent = dateKey(schoolDay) === dateKey(new Date()) ? 'Today is' : 'Monday is';
  root.querySelectorAll('[data-ab]').forEach(b => b.classList.toggle('on', b.dataset.ab === letter));
}

// Adds the next week of suggestions to the phone's calendar. iPhones open a calendar file
// straight into Calendar's "Add All" screen; computers download it to open in any calendar app.
function addToCalendar() {
  const ics = buildIcs(planDays(state, Date.now(), 7));
  const iOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (iOS) {
    location.href = `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;
    return;
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
  a.download = 'nook-study-plan.ics';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export function bindPlan(root, { toast }) {
  const $ = sel => root.querySelector(sel);

  $('#calBtn').addEventListener('click', addToCalendar);
  $('#planList').addEventListener('click', e => {
    const id = e.target.closest('[data-skip]') && e.target.closest('li')?.dataset.id;
    if (id) skipSuggestion(id);
  });

  $('#examForm').addEventListener('submit', e => {
    e.preventDefault();
    const name = $('#examName').value.trim();
    if (!name || !$('#examDate').value) return;
    addExam(name, $('#examClass').value.trim(), $('#examDate').value);
    $('#examName').value = '';
    $('#examName').blur();
  });
  $('#examList').addEventListener('click', e => {
    const id = e.target.closest('.exam')?.dataset.id;
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (!id || !act) return;
    if (act === 'less') changeGoal(id, -1);
    else if (act === 'more') changeGoal(id, 1);
    else if (act === 'remove') removeExam(id);
  });

  $('#dayPicker').addEventListener('click', e => {
    const day = Number(e.target.closest('[data-day]')?.dataset.day);
    if (Number.isNaN(day)) return;
    pickedDays = pickedDays.includes(day) ? pickedDays.filter(d => d !== day) : [...pickedDays, day];
    renderPlan(root);
  });
  $('#blockForm').addEventListener('submit', e => {
    e.preventDefault();
    const name = $('#blockName').value.trim();
    const start = $('#blockStart').value;
    const end = $('#blockEnd').value;
    if (!name) return;
    if (!pickedDays.length) return toast('Pick at least one day');
    if (!start || !end || end <= start) return toast('The end time needs to be after the start');
    addBlock({ name, days: [...pickedDays], start, end, ab: state.plan.ab.on ? $('#blockAB').value : '' });
    $('#blockName').value = '';
    $('#blockName').blur();
  });
  $('#blockList').addEventListener('click', e => {
    const id = e.target.closest('[data-act="remove"]') && e.target.closest('li')?.dataset.id;
    if (id) removeBlock(id);
  });

  root.querySelectorAll('[data-hours]').forEach(input => input.addEventListener('change', () => {
    const { hours: kind, end } = input.dataset;
    const range = [...state.plan.hours[kind]];
    range[end] = input.value;
    if (!input.value || range[1] <= range[0]) {
      toast('Study hours need to end after they start');
      input.value = state.plan.hours[kind][end];
      return;
    }
    changePlan(p => { p.hours[kind] = range; });
  }));
  root.addEventListener('click', e => {
    const goal = e.target.closest('[data-goal]');
    const ab = e.target.closest('[data-ab]');
    if (goal) changePlan(p => { p.goal = Math.min(10, Math.max(0, p.goal + Number(goal.dataset.goal))); });
    if (ab) setAbToday(ab.dataset.ab);
  });
  $('#abToggle').addEventListener('change', e => {
    if (e.target.checked && !state.plan.ab.date) setAbToday('A');
    else changePlan(p => { p.ab.on = e.target.checked; });
  });
}
