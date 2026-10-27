// The library: tall bookshelves, an arched window onto a park, and a reading desk
// with a green banker's lamp and an open book whose pages turn now and then.

import { Painter, makeCanvas, seeded } from '../pixel.js';
import { ITEMS } from '../decor.js';
import { lightsOn, toner, paintSky, createSkyLife, paintDecor, drawSteam } from './outside.js';

const W = 180;
const H = 196;
const CX = 90; // center of the arched window
const ARCH_BASE = 58;
const RADIUS = 32;
const GLASS = { x: CX - RADIUS, y: ARCH_BASE - RADIUS, w: RADIUS * 2, h: 102 };
const BOARDS = [30, 54, 78, 102, 126];
const LAMP_X = 146;

const SLOTS = [
  { id: 'shelf-l', x: 24, y: 78 },
  { id: 'shelf-r', x: 156, y: 102 },
  { id: 'desk-l', x: 40, y: 153 },
  { id: 'desk-r', x: 118, y: 153 },
];
const DEFAULTS = { 'shelf-l': 'globe', 'shelf-r': 'plant', 'desk-l': 'tea', 'desk-r': 'books' };
// Gaps left in the shelves for the shelf slots: [board y, from x, to x]
const GAPS = [[78, 13, 35], [102, 145, 167]];
const SKY_SPOTS = { sunset: [72, 94], dawn: [108, 94], moon: [104, 40] };
const BOOK_COLORS = ['#6b2a26', '#2e4a6b', '#3f5a36', '#7a5a2a', '#4a3a5e', '#8a6a3a', '#2f2f3a', '#5e3a2a', '#8f4a3a'];

export function createLibrary() {
  const sky = makeCanvas(W, H);
  const land = makeCanvas(W, H);
  const interior = makeCanvas(W, H);
  const life = createSkyLife(GLASS, { starHeight: 40, seed: 23 });
  let outsideKey = '';
  let interiorKey = '';
  let frame = 0;
  const motes = Array.from({ length: 9 }, () => newMote());

  function render(p, env) {
    frame++;
    const key = `${env.tod}:${env.rain}`;
    if (key !== outsideKey) {
      const skyPainter = new Painter(sky);
      skyPainter.clear();
      paintSky(skyPainter, env, GLASS, SKY_SPOTS, 80);
      const landPainter = new Painter(land);
      landPainter.clear();
      paintPark(landPainter, env);
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
    life.stars(p, env, frame, (x, y) => y > 92);
    life.clouds(p, env);
    p.image(land, 0, 0);
    if (env.rain) life.rain(p);
    p.image(interior, 0, 0);
    drawLampLight(p, env.t);
    drawPageTurn(p, env.t);
    drawMotes(p);
    drawSteam(p, SLOTS, decor, ITEMS, env.t);
  }

  // Outside: a park with hills, two trees, a small house and a lamp post.

  function paintPark(p, env) {
    const tone = toner(env);
    const lights = lightsOn(env);
    p.ellipse(74, 112, 36, 12, tone('#4f7a46'));
    p.ellipse(118, 118, 38, 14, tone('#3f6a3a'));
    p.rect(GLASS.x, 116, GLASS.w, 14, tone('#3a6236'));

    // House on the far hill
    for (let i = 0; i < 5; i++) p.rect(94 - 2 - i * 1.5, 99 + i, 4 + i * 3, 1, tone('#7a3a2e'));
    p.rect(88, 104, 13, 8, tone('#b8a48a'));
    p.rect(91, 106, 3, 3, lights ? '#f4c66e' : tone('#6d8295'));
    p.rect(97, 107, 2, 5, tone('#5a3a2a'));

    // Trees
    p.rect(69, 104, 2, 10, tone('#4a3020'));
    p.disc(70, 99, 8, tone('#2f5a2e'));
    p.disc(68, 97, 4, tone('#3f7a3a'));
    p.rect(113, 108, 2, 8, tone('#4a3020'));
    p.disc(114, 104, 6, tone('#2a5229'));
    p.disc(112, 102, 3, tone('#3a6e36'));

    // Lamp post on the path
    p.rect(82, 108, 1, 12, tone('#2a2d33'));
    p.rect(81, 106, 3, 2, tone('#2a2d33'));
    p.px(82, 107, lights ? '#fff0b8' : tone('#9aa3a8'));
    if (lights) {
      p.alpha(0.12, () => p.disc(82, 108, 6, '#ffd98a'));
      p.alpha(0.2, () => p.ellipse(82, 120, 6, 1, '#ffd98a'));
    }
  }

  // Inside

  function paintInterior(p, decor) {
    p.clear();
    // Wood paneling
    p.rect(0, 0, W, 146, '#33201a');
    for (let x = 52; x < 130; x += 13) {
      p.rect(x, 8, 1, 138, '#2a1913');
      p.rect(x + 1, 8, 1, 138, '#3d271e');
    }
    p.rect(0, 0, W, 6, '#1c110c');
    p.rect(0, 6, W, 1, '#3a2418');

    // Arched window: fill the frame shape, then cut the glass out of it
    archShape(p, RADIUS + 4, 4, (x, y, w) => p.rect(x, y, w, 1, '#24140d'));
    archShape(p, RADIUS, 0, (x, y, w) => p.clear(x, y, w, 1));
    p.rect(CX - 1, GLASS.y, 2, GLASS.h, '#24140d');
    p.rect(GLASS.x, ARCH_BASE, GLASS.w, 2, '#24140d');
    p.rect(GLASS.x, 92, GLASS.w, 2, '#24140d');
    for (let i = 4; i < RADIUS; i++) {
      const d = Math.round(i * Math.SQRT1_2);
      p.px(CX - 1 - d, ARCH_BASE - d, '#24140d');
      p.px(CX + d, ARCH_BASE - d, '#24140d');
    }
    p.rect(CX - RADIUS - 8, 132, RADIUS * 2 + 16, 3, '#5a3624');
    p.rect(CX - RADIUS - 8, 132, RADIUS * 2 + 16, 1, '#7a4a30');
    p.rect(CX - RADIUS - 8, 135, RADIUS * 2 + 16, 1, '#1a0e09');
    // Faint reflection
    p.alpha(0.06, () => {
      for (let i = 0; i < 26; i++) p.rect(GLASS.x + 6 + i, 120 - i, 3, 1, '#ffffff');
    });

    paintShelf(p, 0, 50, 1);
    paintShelf(p, 130, 180, 2);

    // Desk with a green leather top
    p.rect(0, 146, W, 12, '#4e2a1c');
    p.rect(10, 147, 160, 10, '#9c7a3c');
    p.rect(11, 148, 158, 8, '#2f4a36');
    p.rect(0, 158, W, 1, '#6e3d28');
    p.rect(0, 159, W, 3, '#3a1f14');
    p.rect(0, 162, W, H - 162, '#22130c');
    for (let x = 4; x < W; x += 44) {
      p.rect(x, 166, 40, 1, '#2e1a10');
      p.rect(x, 166, 1, H - 166, '#2e1a10');
    }

    // Banker's lamp
    p.rect(LAMP_X - 6, 151, 12, 2, '#b88a3c');
    p.rect(LAMP_X - 5, 150, 10, 1, '#d6a85a');
    p.rect(LAMP_X, 141, 1, 9, '#b88a3c');
    [[136, 5, 11], [137, 7, 15], [138, 8, 17], [139, 9, 19]].forEach(([y, half, w]) => {
      p.rect(LAMP_X - half, y, w, 1, y === 139 ? '#245a3d' : '#2f6b4a');
    });
    p.rect(LAMP_X - 9, 140, 19, 1, '#b88a3c');
    p.rect(LAMP_X - 4, 137, 5, 1, '#6fb08a');
    p.rect(LAMP_X + 6, 141, 1, 4, '#d6a85a');

    // Open book
    p.rect(72, 152, 34, 2, '#5a2a1e');
    p.rect(73, 147, 15, 5, '#efe6d2');
    p.rect(89, 147, 15, 5, '#efe6d2');
    p.rect(88, 147, 1, 6, '#b3a68c');
    p.px(87, 147, '#d9cfb8');
    p.px(89, 147, '#d9cfb8');
    for (const y of [148, 150]) {
      p.rect(75, y, 11, 1, '#b8ab90');
      p.rect(91, y, 11, 1, '#b8ab90');
    }

    paintDecor(p, SLOTS, decor, ITEMS);
  }

  // Calls row(x, y, width) for each row of the arched window shape, grown by `grow` pixels.
  function archShape(p, r, grow, row) {
    for (let y = ARCH_BASE - r; y < GLASS.y + GLASS.h + grow; y++) {
      const half = y < ARCH_BASE ? Math.floor(Math.sqrt(r * r - (ARCH_BASE - y) ** 2)) : r;
      row(CX - half, y, half * 2);
    }
  }

  function paintShelf(p, x0, x1, seed) {
    const rnd = seeded(seed);
    p.rect(x0, 8, x1 - x0, 140, '#1f120c');
    p.rect(x0, 8, 3, 140, '#24140d');
    p.rect(x1 - 3, 8, 3, 140, '#24140d');
    for (const board of BOARDS) {
      let x = x0 + 3;
      while (x < x1 - 4) {
        const w = 3 + Math.floor(rnd() * 3);
        if (x + w > x1 - 3) break;
        const gap = GAPS.find(([gy, from, to]) => gy === board && x + w > from && x < to);
        if (gap) {
          x = gap[2];
          continue;
        }
        const h = 13 + Math.floor(rnd() * 8);
        const color = BOOK_COLORS[Math.floor(rnd() * BOOK_COLORS.length)];
        p.rect(x, board - h, w, h, color);
        p.rect(x, board - h + 3, w, 1, '#c9a35a');
        if (rnd() < 0.5) p.rect(x, board - 4, w, 1, '#c9a35a');
        p.rect(x + w - 1, board - h, 1, h, '#00000033');
        x += w + (rnd() < 0.2 ? 1 : 0);
      }
      p.rect(x0, board, x1 - x0, 2, '#6b4126');
      p.rect(x0, board + 2, x1 - x0, 1, '#1a0e09');
    }
  }

  function drawLampLight(p, t) {
    const k = 0.95 + Math.sin(t * 1.3) * 0.05;
    p.alpha(0.06 * k, () => p.disc(LAMP_X, 141, 16, '#ffe3a0'));
    p.alpha(0.05 * k, () => {
      for (let y = 141; y < 152; y++) {
        const half = 7 + (y - 141) * 1.6;
        p.rect(LAMP_X - half, y, half * 2, 1, '#ffe3a0');
      }
    });
    p.alpha(0.16 * k, () => p.ellipse(LAMP_X, 152, 24, 3, '#ffe3a0'));
  }

  // A page lifts from the right side and settles on the left, every ten seconds.
  function drawPageTurn(p, t) {
    const k = ((t % 10) - 9) / 0.9;
    if (k < 0 || k > 1) return;
    const lift = Math.round(Math.sin(k * Math.PI) * 3);
    const w = Math.round(15 * Math.abs(1 - 2 * k));
    const x = k < 0.5 ? 89 : 88 - w;
    if (w > 0) p.rect(x, 147 - lift, w, 5, '#f7f0e0');
  }

  function newMote() {
    return { x: 118 + Math.random() * 50, y: 112 + Math.random() * 36, vx: (Math.random() - 0.5) * 0.15, vy: -0.05 - Math.random() * 0.08 };
  }

  function drawMotes(p) {
    for (let i = 0; i < motes.length; i++) {
      const m = motes[i];
      m.x += m.vx;
      m.y += m.vy;
      if (m.y < 108 || m.x < 114 || m.x > 172) motes[i] = { ...newMote(), y: 148 };
      p.alpha(0.35 + 0.3 * Math.sin((frame + i * 7) / 6), () => p.px(m.x, m.y, '#ffe9b0'));
    }
  }

  return { W, H, render };
}
