import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { state, replaceState, defaults } from '../js/store.js';
import * as timer from '../js/timer.js';
import { addTask } from '../js/tasks.js';

const MIN = 60000;
let now;
Date.now = () => now;

beforeEach(() => {
  now = 1_000_000;
  replaceState(defaults());
});

// Runs the current phase to its end and ticks once.
function finishPhase() {
  if (state.timer.status !== 'running') timer.start();
  now = state.timer.endsAt;
  timer.tick();
}

test('counts down from the saved end time', () => {
  timer.start();
  now += 10 * MIN;
  assert.equal(timer.remaining(), 15 * MIN);
});

test('pause freezes the time left', () => {
  timer.start();
  now += 5 * MIN;
  timer.pause();
  now += 30 * MIN;
  assert.equal(timer.remaining(), 20 * MIN);
  timer.start();
  now += 20 * MIN;
  timer.tick();
  assert.equal(state.timer.phase, 'short');
});

test('finishing focus logs a session and moves to a short break', () => {
  finishPhase();
  assert.equal(state.sessions.length, 1);
  assert.equal(state.sessions[0].ok, true);
  assert.equal(state.sessions[0].ms, 25 * MIN);
  assert.equal(state.timer.phase, 'short');
  assert.equal(state.timer.status, 'idle');
  assert.equal(timer.remaining(), 5 * MIN);
});

test('every 4th focus is followed by a long break', () => {
  const phases = [];
  for (let i = 0; i < 8; i++) {
    finishPhase();
    phases.push(state.timer.phase);
  }
  assert.deepEqual(phases, ['short', 'focus', 'short', 'focus', 'short', 'focus', 'long', 'focus']);
});

test('auto-start runs straight into the break', () => {
  timer.setSetting('autoStart', true);
  finishPhase();
  assert.equal(state.timer.phase, 'short');
  assert.equal(state.timer.status, 'running');
  now += 2 * MIN;
  assert.equal(timer.remaining(), 3 * MIN);
});

test('a session that ended while the app was closed still counts', () => {
  timer.start();
  now += 3 * 60 * MIN;
  timer.tick();
  assert.equal(state.sessions.length, 1);
  assert.equal(state.sessions[0].ok, true);
  assert.equal(state.sessions[0].end, 1_000_000 + 25 * MIN);
});

test('skipping focus after a minute logs it as abandoned, with no cycle credit', () => {
  timer.start();
  now += 8 * MIN;
  timer.skip();
  assert.equal(state.sessions.length, 1);
  assert.equal(state.sessions[0].ok, false);
  assert.equal(state.sessions[0].ms, 8 * MIN);
  assert.equal(state.timer.cycle, 0);
  assert.equal(state.timer.phase, 'short');
});

test('restarting within the first minute logs nothing', () => {
  timer.start();
  now += 30 * 1000;
  timer.reset();
  assert.equal(state.sessions.length, 0);
  assert.equal(timer.remaining(), 25 * MIN);
});

test('changing a length while idle updates the clock, while running it waits', () => {
  timer.setSetting('focusMin', 50);
  assert.equal(timer.remaining(), 50 * MIN);
  timer.start();
  timer.setSetting('focusMin', 30);
  assert.equal(timer.remaining(), 50 * MIN);
});

test('sessions remember the active task and class', () => {
  addTask('Problem set 4', 'MATH 221', 3);
  finishPhase();
  const [session] = state.sessions;
  assert.equal(session.taskId, state.tasks[0].id);
  assert.equal(session.cls, 'MATH 221');
});
