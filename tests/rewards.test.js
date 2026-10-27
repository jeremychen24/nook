import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { state, replaceState, defaults } from '../js/store.js';
import * as rewards from '../js/rewards.js';

const MIN = 60000;
const DAY = 24 * 3600 * 1000;
const noon = new Date(2026, 9, 27, 12).getTime();
const done = (end, ms = 25 * MIN) => ({ id: String(end), taskId: null, cls: '', start: end - ms, end, ms, ok: true });

beforeEach(() => replaceState(defaults()));

test('one coin per focused minute', () => {
  const session = done(noon);
  assert.deepEqual(rewards.coinsFor(session, [session]), { base: 25, bonus: 0, streak: 1 });
});

test('streak bonus grows by 5 a day and stops at +20', () => {
  const days = n => Array.from({ length: n }, (_, i) => done(noon - i * DAY));
  assert.equal(rewards.coinsFor(done(noon), days(2)).bonus, 5);
  assert.equal(rewards.coinsFor(done(noon), days(3)).bonus, 10);
  assert.equal(rewards.coinsFor(done(noon), days(9)).bonus, 20);
});

test('a missed day resets the streak, and unfinished sessions do not count', () => {
  const sessions = [done(noon), done(noon - 2 * DAY), { ...done(noon - DAY), ok: false }];
  assert.equal(rewards.streakDays(sessions, noon), 1);
});

test('award adds the coins to the balance', () => {
  state.sessions.push(done(Date.now()));
  const r = rewards.award(state.sessions[0]);
  assert.equal(state.coins, r.base + r.bonus);
});

test('buying needs enough coins and only happens once', () => {
  assert.equal(rewards.buy('cat'), false);
  state.coins = 200;
  assert.equal(rewards.buy('cat'), true);
  assert.equal(state.coins, 80);
  assert.equal(rewards.buy('cat'), false);
  assert.equal(state.coins, 80);
  assert.ok(rewards.owns('cat'));
});

test('free items and the café are owned from the start; other scenes are not', () => {
  assert.ok(rewards.owns('mug'));
  assert.ok(rewards.owns('cafe'));
  assert.equal(rewards.owns('library'), false);
  assert.equal(rewards.switchScene('library'), false);
  state.coins = 200;
  rewards.buy('library');
  assert.equal(rewards.switchScene('library'), true);
  assert.equal(state.scene, 'library');
});

test('placing checks ownership and that the item fits the slot', () => {
  assert.equal(rewards.place('cafe', 'desk-r', 'cat'), false); // not owned
  state.coins = 500;
  rewards.buy('cat');
  rewards.buy('painting');
  assert.equal(rewards.place('cafe', 'desk-r', 'cat'), true);
  assert.equal(rewards.place('cafe', 'desk-r', 'painting'), false); // wall item on the counter
  assert.equal(rewards.place('cafe', 'wall', 'painting'), true);
  assert.equal(rewards.place('cafe', 'shelf', 'none'), true);
  assert.deepEqual(rewards.decorFor('cafe'), { wall: 'painting', shelf: 'none', 'desk-l': 'plant', 'desk-c': 'notebook', 'desk-r': 'cat' });
});

test('watering a wilted plant costs 10 coins', () => {
  rewards.wilt();
  assert.equal(state.wilted, true);
  assert.equal(rewards.water(), false); // no coins
  state.coins = 15;
  assert.equal(rewards.water(), true);
  assert.equal(state.coins, 5);
  assert.equal(state.wilted, false);
});
