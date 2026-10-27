// Task list: add tasks, pick the one you're focusing on, mark them done.
// Session counts come from the session log, not a stored counter.

import { state, update, uid } from './store.js';

const CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
const CROSS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M7 7l10 10M17 7L7 17"/></svg>';

let filter = null; // class shown in the list, or null for all

export function addTask(name, cls, est) {
  update(s => {
    const task = { id: uid(), name, cls, est, done: false, createdAt: Date.now() };
    s.tasks.unshift(task);
    if (!s.activeTaskId) s.activeTaskId = task.id;
  });
}

export function selectTask(id) {
  update(s => {
    if (s.tasks.find(t => t.id === id)?.done) return;
    s.activeTaskId = s.activeTaskId === id ? null : id;
  });
}

export function toggleDone(id) {
  update(s => {
    const task = s.tasks.find(t => t.id === id);
    if (!task) return;
    task.done = !task.done;
    if (task.done && s.activeTaskId === id) s.activeTaskId = null;
  });
}

export function removeTask(id) {
  update(s => {
    s.tasks = s.tasks.filter(t => t.id !== id);
    if (s.activeTaskId === id) s.activeTaskId = null;
  });
}

export const activeTask = () => state.tasks.find(t => t.id === state.activeTaskId) ?? null;

export const sessionsFor = id => state.sessions.filter(x => x.ok && x.taskId === id).length;

export const classes = () =>
  [...new Set(state.tasks.map(t => t.cls).filter(Boolean))].sort((a, b) => a.localeCompare(b));

const esc = str =>
  String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function renderTasks(root) {
  const all = classes();
  if (filter && !all.includes(filter)) filter = null;

  root.querySelector('#classList').innerHTML = all.map(c => `<option value="${esc(c)}">`).join('');
  root.querySelector('#classFilter').innerHTML = all.length < 2 ? '' : [null, ...all]
    .map(c => `<button class="tag${c === filter ? ' on' : ''}" data-filter="${esc(c ?? '')}">${esc(c ?? 'All')}</button>`)
    .join('');

  const shown = state.tasks.filter(t => !filter || t.cls === filter).sort((a, b) => a.done - b.done);
  root.querySelector('#taskList').innerHTML = shown.map(t => {
    const n = sessionsFor(t.id);
    return `<li class="task${t.done ? ' done' : ''}${t.id === state.activeTaskId ? ' active' : ''}" data-id="${t.id}">
      <button class="pick" data-act="select" aria-label="Focus on this task"></button>
      <div class="body" data-act="select">
        <div class="name">${esc(t.name)}</div>
        <div class="meta">${t.cls ? `<span class="tag">${esc(t.cls)}</span>` : ''}<span class="count${n > t.est ? ' over' : ''}">${n}/${t.est}</span></div>
      </div>
      <button class="icon-btn small" data-act="done" aria-label="${t.done ? 'Mark not done' : 'Mark done'}">${CHECK}</button>
      <button class="icon-btn small" data-act="remove" aria-label="Delete task">${CROSS}</button>
    </li>`;
  }).join('');

  root.querySelector('#tasksEmpty').hidden = state.tasks.length > 0;
}

export function bindTasks(root) {
  const name = root.querySelector('#taskName');
  const cls = root.querySelector('#taskClass');
  const est = root.querySelector('#taskEst');

  root.querySelector('#taskForm').addEventListener('submit', e => {
    e.preventDefault();
    const text = name.value.trim();
    if (!text) return;
    addTask(text, cls.value.trim(), Math.min(20, Math.max(1, Number(est.value) || 1)));
    name.value = '';
    name.blur();
  });

  root.querySelector('#taskList').addEventListener('click', e => {
    const id = e.target.closest('.task')?.dataset.id;
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (!id || !act) return;
    if (act === 'select') selectTask(id);
    else if (act === 'done') toggleDone(id);
    else if (act === 'remove') removeTask(id);
  });

  root.querySelector('#classFilter').addEventListener('click', e => {
    const btn = e.target.closest('[data-filter]');
    if (!btn) return;
    filter = btn.dataset.filter || null;
    renderTasks(root);
  });
}
