// The classroom: a chalkboard that keeps score, a wall clock showing the real time,
// and a window onto the schoolyard. A tally mark goes up for each focus session finished
// today, and a line of chalk writing grows as the current session runs.

import { Painter, makeCanvas, seeded } from '../pixel.js';
import { ITEMS } from '../decor.js';
import { lightsOn, toner, paintSky, createSkyLife, paintDecor, drawSteam } from './outside.js';

const W = 180;
const H = 196;
const GLASS = { x: 131, y: 29, w: 40, h: 88 };
const PANES = [[131, 29, 19, 29], [152, 29, 19, 29], [131, 60, 19, 28], [152, 60, 19, 28], [131, 90, 19, 27], [152, 90, 19, 27]];
const BOARD = { x: 13, y: 33, w: 106, h: 62 };
const CLOCK = { x: 66, y: 18 };
const CHALK = '#e8efe6';

const SLOTS = [
  { id: 'sill', x: 152, y: 120 },
  { id: 'desk-l', x: 38, y: 153 },
  { id: 'desk-c', x: 92, y: 153 },
  { id: 'desk-r', x: 146, y: 153 },
];
const DEFAULTS = { sill: 'plant', 'desk-l': 'apple', 'desk-c': 'notebook', 'desk-r': 'pencils' };
const SKY_SPOTS = { sunset: [144, 82], dawn: [162, 84], moon: [162, 40] };

// Chalk "words" for the progress line: [x, y, width] with a few letter bumps on top.
const WRITING = (() => {
  const rnd = seeded(8);
  const words = [];
  for (const y of [80, 87]) {
    let x = BOARD.x + 5;
    while (x < BOARD.x + BOARD.w - 8) {
      const w = 3 + Math.floor(rnd() * 7);
      const bumps = Array.from({ length: w }, () => rnd() < 0.4);
      words.push({ x, y, w, bumps });
      x += w + 2;
    }
  }
  return words;
})();
const WRITING_LENGTH = WRITING.reduce((sum, w) => sum + w.w, 0);

export function createClassroom() {
  const sky = makeCanvas(W, H);
  const yard = makeCanvas(W, H);
  const interior = makeCanvas(W, H);
  const life = createSkyLife(GLASS, { starHeight: 40, seed: 31 });
  let outsideKey = '';
  let interiorKey = '';
  let frame = 0;
  let flicker = 0;

  function render(p, env) {
    frame++;
    const key = `${env.tod}:${env.rain}`;
    if (key !== outsideKey) {
      const skyPainter = new Painter(sky);
      skyPainter.clear();
      paintSky(skyPainter, env, GLASS, SKY_SPOTS, 70);
      const yardPainter = new Painter(yard);
      yardPainter.clear();
      paintYard(yardPainter, env);
      outsideKey = key;
    }
    const decor = { ...DEFAULTS, ...env.decor };
    const decorKey = JSON.stringify(decor);
    if (decorKey !== interiorKey) {
      paintInterior(new Painter(interior), decor);
      interiorKey = decorKey;
    }

    p.clear();
    p.image(sky, 0, 0);
    life.stars(p, env, frame, (x, y) => y > 86);
    life.clouds(p, env);
    p.image(yard, 0, 0);
    if (env.rain) life.rain(p);
    p.image(interior, 0, 0);
    drawChalk(p, env.info ?? { today: 0, progress: 0 });
    drawClock(p);
    drawCeilingLight(p);
    drawSteam(p, SLOTS, decor, ITEMS, env.t);
  }

  // Outside: trees, a fence and a far hill.

  function paintYard(p, env) {
    const tone = toner(env);
    p.ellipse(152, 100, 30, 9, tone('#6a8f5a'));
    p.rect(GLASS.x, 104, GLASS.w, 13, tone('#5e8a4a'));
    p.rect(141, 96, 2, 10, tone('#4a3020'));
    p.disc(142, 90, 9, tone('#3f6e38'));
    p.disc(140, 87, 4, tone('#4f8a46'));
    p.rect(163, 100, 2, 8, tone('#4a3020'));
    p.disc(164, 96, 6, tone('#3a6634'));
    const fence = tone('#a3a399');
    p.rect(GLASS.x, 106, GLASS.w, 1, fence);
    p.rect(GLASS.x, 110, GLASS.w, 1, fence);
    for (let x = GLASS.x + 1; x < GLASS.x + GLASS.w; x += 5) p.rect(x, 104, 1, 9, fence);
    if (lightsOn(env)) p.alpha(0.5, () => p.rect(GLASS.x, 104, GLASS.w, 13, '#0b1020'));
  }

  // Inside

  function paintInterior(p, decor) {
    p.clear();
    p.rect(0, 0, W, 104, '#76846f');
    p.alpha(0.12, () => {
      p.rect(0, 8, W, 6, '#000000');
      p.rect(0, 8, W, 3, '#000000');
    });
    // Ceiling and light panel
    p.rect(0, 0, W, 8, '#2f332d');
    p.rect(62, 2, 56, 5, '#9aa39a');

    // Wainscot
    p.rect(0, 104, W, 42, '#5c4632');
    p.rect(0, 104, W, 2, '#7a5e44');
    p.rect(0, 106, W, 1, '#3c2c1e');
    for (let x = 9; x < W; x += 18) p.rect(x, 107, 1, 39, '#4c3a29');

    // Chalkboard with frame, faint erased chalk, and a tray
    p.rect(BOARD.x - 3, BOARD.y - 3, BOARD.w + 6, BOARD.h + 6, '#6b4a2e');
    p.rect(BOARD.x - 3, BOARD.y - 3, BOARD.w + 6, 1, '#8a6440');
    p.rect(BOARD.x, BOARD.y, BOARD.w, BOARD.h, '#2e4a3b');
    const smudge = seeded(4);
    p.alpha(0.08, () => {
      for (let i = 0; i < 7; i++) {
        p.rect(BOARD.x + 4 + Math.floor(smudge() * 80), BOARD.y + 4 + Math.floor(smudge() * 50), 14 + Math.floor(smudge() * 20), 2, '#dfe9e1');
      }
    });
    p.rect(BOARD.x - 5, BOARD.y + BOARD.h + 3, BOARD.w + 10, 3, '#7a5a3a');
    p.rect(30, BOARD.y + BOARD.h + 2, 5, 1, '#f2f2ea');
    p.rect(38, BOARD.y + BOARD.h + 2, 4, 1, '#f2e27a');
    p.rect(96, BOARD.y + BOARD.h + 1, 10, 2, '#3a3a3a');
    p.rect(96, BOARD.y + BOARD.h + 2, 10, 1, '#b9b2a0');

    // Clock face (hands are drawn each frame)
    p.disc(CLOCK.x, CLOCK.y, 8, '#2b2b2b');
    p.disc(CLOCK.x, CLOCK.y, 7, '#f2efe4');
    for (const [dx, dy] of [[0, -6], [6, 0], [0, 6], [-6, 0]]) p.px(CLOCK.x + dx, CLOCK.y + dy, '#2b2b2b');

    // Window with a white painted frame
    p.rect(GLASS.x - 3, GLASS.y - 3, GLASS.w + 6, GLASS.h + 6, '#e6e2d6');
    p.rect(GLASS.x - 3, GLASS.y + GLASS.h + 2, GLASS.w + 6, 1, '#b9b4a6');
    for (const [x, y, w, h] of PANES) {
      p.clear(x, y, w, h);
      p.rect(x, y - 1, w, 1, '#b9b4a6');
    }
    p.alpha(0.07, () => {
      for (let i = 0; i < 16; i++) p.rect(134 + i, 112 - i, 3, 1, '#ffffff');
    });
    p.rect(126, 120, 50, 3, '#e6e2d6');
    p.rect(126, 123, 50, 1, '#4c4a40');

    // Student desk
    p.rect(0, 146, W, 12, '#b5895a');
    p.rect(0, 146, W, 1, '#d0a374');
    p.rect(0, 149, W, 1, '#9a7048');
    const grain = seeded(9);
    for (let i = 0; i < 12; i++) {
      p.rect(Math.floor(grain() * W), 151 + Math.floor(grain() * 6), 8 + Math.floor(grain() * 16), 1, '#a27a4e');
    }
    p.rect(0, 158, W, 3, '#8a6440');
    p.rect(0, 161, W, H - 161, '#2a2721');
    p.rect(0, 161, W, 2, '#1d1b17');
    p.rect(20, 163, 2, H - 163, '#3a3a36');
    p.rect(W - 22, 163, 2, H - 163, '#3a3a36');

    paintDecor(p, SLOTS, decor, ITEMS);
  }

  function drawChalk(p, { today, progress }) {
    p.alpha(0.85, () => {
      // Heading scribble
      for (const [x, w] of [[18, 6], [26, 4], [32, 7]]) p.rect(x, 39, w, 1, CHALK);
      p.rect(18, 41, 21, 1, CHALK);

      // Tally marks for today's finished sessions, in groups of five
      const shown = Math.min(today, 40);
      for (let i = 0; i < shown; i++) {
        const group = Math.floor(i / 5);
        const gx = 18 + (group % 6) * 16;
        const gy = 48 + Math.floor(group / 6) * 12;
        const n = i % 5;
        if (n < 4) p.rect(gx + n * 3, gy, 1, 8, CHALK);
        else p.line(gx - 1, gy + 6, gx + 10, gy + 1, CHALK);
      }

      // Writing that grows with the current session
      let left = Math.round(progress * WRITING_LENGTH);
      for (const word of WRITING) {
        if (left <= 0) break;
        const w = Math.min(word.w, left);
        p.rect(word.x, word.y, w, 1, CHALK);
        for (let i = 0; i < w; i++) if (word.bumps[i]) p.px(word.x + i, word.y - 1, CHALK);
        left -= word.w;
      }
    });
  }

  function drawClock(p) {
    const now = new Date();
    const sec = now.getSeconds();
    const min = now.getMinutes() + sec / 60;
    const hour = (now.getHours() % 12) + min / 60;
    const hand = (turns, len, color) => {
      const a = turns * Math.PI * 2;
      p.line(CLOCK.x, CLOCK.y, CLOCK.x + Math.sin(a) * len, CLOCK.y - Math.cos(a) * len, color);
    };
    hand(hour / 12, 3.5, '#2b2b2b');
    hand(min / 60, 5.5, '#2b2b2b');
    hand(sec / 60, 5.5, '#c0392b');
  }

  function drawCeilingLight(p) {
    if (flicker > 0) flicker--;
    else if (Math.random() < 0.004) flicker = 1 + Math.floor(Math.random() * 3);
    const on = flicker === 0 || flicker % 2 === 0;
    p.rect(63, 3, 54, 3, on ? '#eef5ea' : '#b9c2b6');
    if (on) {
      p.alpha(0.05, () => p.ellipse(90, 8, 60, 14, '#f4fff0'));
    }
  }

  return { W, H, render };
}
