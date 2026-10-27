// Exam countdown: days left and how many focus sessions a day it takes to reach the goal.

import { update, uid } from './store.js';

const DAY = 86400000;
export const DEFAULT_GOAL = 10;

// Whole days from today until the exam date ('YYYY-MM-DD'); 0 means today, negative means past.
export function daysUntil(date, now = Date.now()) {
  const [y, m, d] = date.split('-').map(Number);
  const today = new Date(now).setHours(0, 0, 0, 0);
  return Math.round((new Date(y, m - 1, d).getTime() - today) / DAY);
}

// Sessions count toward an exam if they finished after it was added and match its class (if it has one).
export function examPlan(exam, sessions, now = Date.now()) {
  const done = sessions.filter(s => s.ok && s.end >= exam.createdAt && (!exam.cls || s.cls === exam.cls)).length;
  const days = daysUntil(exam.date, now);
  const left = Math.max(exam.goal - done, 0);
  return { days, done, left, perDay: days > 0 ? Math.ceil(left / days) : left };
}

export function addExam(name, cls, date) {
  update(s => {
    s.exams.push({ id: uid(), name, cls, date, goal: DEFAULT_GOAL, createdAt: Date.now() });
    s.exams.sort((a, b) => a.date.localeCompare(b.date));
  });
}

export function removeExam(id) {
  update(s => { s.exams = s.exams.filter(e => e.id !== id); });
}

export function changeGoal(id, delta) {
  update(s => {
    const exam = s.exams.find(e => e.id === id);
    if (exam) exam.goal = Math.min(99, Math.max(1, exam.goal + delta));
  });
}
