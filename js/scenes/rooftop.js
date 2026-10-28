// The rooftop: a city skyline with lit windows and neon signs, an elevated train gliding across
// now and then, seen over a chain-link fence. On the roof: a water tower, a glowing vending
// machine, a bench for decorations and a cat on the ledge. Rain leaves puddles that catch the
// neon. Drawn on a 180×196 grid; on a wider canvas the city and the roof simply carry on.

import { Painter, makeCanvas, seeded, mix } from '../pixel.js';
import { ITEMS } from '../decor.js';
import { isDark, lightsOn, toner, paintSky, createSkyLife, paintDecor, animateDecor, sideSpots } from './outside.js';

const BASE_W = 180;
const H = 196;
const SKY_H = 124; // sky and city above the roof's edge
const LEDGE = 118; // top of the low wall at the roof's edge
const FLOOR = 126;
const BENCH = 134; // bench seat top; bench items stand here

export const SLOTS = [
  { id: 'machine', kind: 'shelf', label: 'Vending machine', x: 153, y: 84 },
  { id: 'desk-l', kind: 'desk', label: 'Bench left', x: 77, y: BENCH },
  { id: 'desk-c', kind: 'desk', label: 'Bench middle', x: 96, y: BENCH },
  { id: 'desk-r', kind: 'desk', label: 'Bench right', x: 115, y: BENCH },
];
export const DEFAULTS = { machine: 'plant', 'desk-l': 'mug', 'desk-c': 'notebook', 'desk-r': 'pencils' };

const NEON = ['#ff5fa2', '#4fe3ff', '#ffd25f', '#b98cff'];

export function createRooftop(W = BASE_W) {
  const OX = Math.round((W - BASE_W) / 2);
  const sky = makeCanvas(W, H);
  const city = makeCanvas(W, H);
  const roof = makeCanvas(W, H);
  const life = createSkyLife({ x: 0, y: 0, w: W, h: SKY_H }, { starHeight: 60, seed: 53 });
  const spots = { sunset: [OX + 96, 60], dawn: [OX + 60, 62], moon: [OX + 128, 26] };
  let outsideKey = '';
  let roofKey = '';
  let frame = 0;
  let train = null;

  // The skyline, built once for this width: [x, width, top, wall color, window rows lit pattern seed]
  const towers = (() => {
    const rnd = seeded(61);
    const out = [];
    for (let x = -4; x < W; ) {
      const w = 10 + Math.floor(rnd() * 16);
      const top = 42 + Math.floor(rnd() * 46);
      out.push({ x, w, top, wall: ['#3a4256', '#46506a', '#545e78', '#3f475e'][Math.floor(rnd() * 4)], seed: Math.floor(rnd() * 1e6) });
      x += w + (rnd() < 0.3 ? 2 : 0);
    }
    return out;
  })();
  // Neon signs on some towers: [x, y, w, h, color]
  const signs = towers
    .filter((t, i) => i % 3 === 1 && t.w >= 12)
    .map((t, i) => (i % 2 ? [t.x + 2, t.top + 6, 3, 14, NEON[i % NEON.length]] : [t.x + 2, t.top + 4, t.w - 4, 4, NEON[i % NEON.length]]));
  const flicker = signs.map(() => 0);

  const skylineTop = x => Math.min(...towers.filter(t => x >= t.x && x < t.x + t.w).map(t => t.top), SKY_H);

  function render(p, env) {
    frame++;
    const tone = toner(env);
    const lights = lightsOn(env);
    const key = `${env.tod}:${env.rain}`;
    if (key !== outsideKey) {
      const sp = new Painter(sky);
      sp.clear();
      paintSky(sp, env, { x: 0, y: 0, w: W, h: SKY_H }, spots, 100);
      paintCity(new Painter(city), env, tone, lights);
      outsideKey = key;
    }
    const decor = { ...DEFAULTS, ...env.decor };
    const decorKey = `${JSON.stringify(decor)}${env.wilted}${key}`;
    if (decorKey !== roofKey) {
      paintRoof(new Painter(roof), env, tone, decor);
      roofKey = decorKey;
    }

    p.clear();
    p.image(sky, 0, 0);
    life.stars(p, env, frame, (x, y) => y >= skylineTop(x));
    life.clouds(p, env);
    p.image(city, 0, 0);
    drawNeon(p, lights);
    drawTrain(p, lights, tone);
    if (env.rain) life.rain(p);
    p.image(roof, 0, 0);
    drawGlow(p, env, lights);
    drawCat(p, env.t, tone);
    p.shifted(OX, () => animateDecor(p, SLOTS, decor, ITEMS, env.t));
  }

  // City

  function paintCity(p, env, tone, lights) {
    p.clear();
    // A hazy far row first, then the towers in front
    const far = seeded(67);
    for (let x = 0; x < W; x += 6) {
      const top = 70 + Math.floor(far() * 30);
      p.rect(x, top, 6, SKY_H - top, tone(isDark(env.tod) ? '#1c2238' : '#8fa3bf'));
    }
    for (const t of towers) {
      p.rect(t.x, t.top, t.w, SKY_H - t.top, tone(t.wall));
      p.rect(t.x, t.top, t.w, 1, tone(mix(t.wall, '#ffffff', 0.15)));
      const rnd = seeded(t.seed);
      for (let y = t.top + 4; y < SKY_H - 2; y += 4) {
        for (let x = t.x + 2; x < t.x + t.w - 2; x += 3) {
          const on = rnd() < (lights ? 0.38 : 0.0);
          p.rect(x, y, 2, 2, on ? (rnd() < 0.5 ? '#f4c66e' : '#cfe8ff') : tone(mix(t.wall, '#9db4c6', 0.35)));
        }
      }
    }
    // The elevated track the train runs on
    p.rect(0, 104, W, 2, tone('#2a2d36'));
    for (let x = 4; x < W; x += 22) p.rect(x, 106, 2, SKY_H - 106, tone('#2a2d36'));
  }

  // Neon is off by day, glows at night and flickers now and then.
  function drawNeon(p, lights) {
    signs.forEach(([x, y, w, h, color], i) => {
      if (flicker[i] > 0) flicker[i]--;
      else if (Math.random() < 0.004) flicker[i] = 2 + Math.floor(Math.random() * 4);
      const on = lights && !(flicker[i] > 0 && flicker[i] % 2);
      if (on) p.alpha(0.18, () => p.rect(x - 2, y - 2, w + 4, h + 4, color));
      p.rect(x, y, w, h, on ? color : mix(color, '#3a4256', 0.7));
    });
  }

  // Every so often a train crosses on the elevated track.
  function drawTrain(p, lights, tone) {
    if (!train && Math.random() < 0.004) train = { x: -60, v: 1.6 + Math.random() };
    if (!train) return;
    train.x += train.v;
    if (train.x > W + 4) {
      train = null;
      return;
    }
    const x = Math.round(train.x);
    p.rect(x, 97, 58, 7, tone('#c8ccd4'));
    p.rect(x, 101, 58, 1, tone('#3c6fb0'));
    for (let i = 0; i < 6; i++) p.rect(x + 3 + i * 9, 98, 6, 2, lights ? '#f4e3a8' : tone('#6d8295'));
  }

  // The roof: low wall, fence, floor, water tower, vending machine, bench, and odds and ends on
  // a wider roof.

  function paintRoof(p, env, tone, decor) {
    p.clear();
    const lit = lightsOn(env);
    const shade = c => mix(c, '#0b1020', isDark(env.tod) ? 0.45 : env.rain ? 0.25 : 0);

    // Chain-link fence along the edge: posts, a top rail and a light diagonal mesh that the city
    // shows through
    p.alpha(0.16, () => {
      for (let x = 0; x < W + 24; x += 7) {
        p.line(x, 96, x - 22, LEDGE, shade('#c4cad2'));
        p.line(x - 22, 96, x, LEDGE, shade('#c4cad2'));
      }
    });
    for (let x = 6; x < W; x += 32) p.rect(x, 93, 2, LEDGE - 93, shade('#7a8088'));
    p.rect(0, 94, W, 1, shade('#8a9098'));

    // Low wall and floor
    p.rect(0, LEDGE, W, FLOOR - LEDGE, shade('#7a7d84'));
    p.rect(0, LEDGE, W, 1, shade('#9a9da4'));
    p.rect(0, FLOOR, W, H - FLOOR, shade('#55585e'));
    for (let y = FLOOR + 8; y < H; y += 10) p.rect(0, y, W, 1, shade('#4a4d53'));
    for (let x = 12; x < W; x += 24) p.rect(x, FLOOR, 1, H - FLOOR, shade('#4a4d53'));

    // Puddles in the rain
    if (env.rain) {
      const rnd = seeded(71);
      for (let i = 0; i < W / 30; i++) {
        p.alpha(0.35, () => p.ellipse(Math.floor(rnd() * W), FLOOR + 14 + Math.floor(rnd() * 40), 10 + Math.floor(rnd() * 8), 2, shade('#8fa3bf')));
      }
    }

    // A wider roof gets air-conditioner units and vent pipes along the extra space
    sideSpots(W, OX, BASE_W, 56).forEach((x, i) => {
      if (i % 2) {
        p.rect(x - 2, FLOOR - 10, 4, 22, shade('#8a8f96'));
        p.rect(x - 4, FLOOR - 12, 8, 3, shade('#6f747b'));
      } else {
        p.rect(x - 11, FLOOR + 2, 22, 14, shade('#b8bcc2'));
        p.ellipse(x - 3, FLOOR + 9, 5, 5, shade('#6f747b'));
        p.rect(x + 5, FLOOR + 5, 4, 8, shade('#8a8f96'));
      }
    });

    p.shifted(OX, () => {
      // Water tower on legs
      for (const lx of [12, 20, 28, 36]) p.rect(lx, 74, 2, FLOOR - 74 + 4, shade('#5a5d63'));
      p.rect(10, 92, 30, 1, shade('#5a5d63'));
      p.rect(8, 52, 34, 22, shade('#8a8f96'));
      p.rect(8, 52, 34, 2, shade('#a3a8ae'));
      for (const by of [58, 64, 70]) p.rect(8, by, 34, 1, shade('#70757c'));
      for (let i = 0; i < 6; i++) p.rect(10 + i * 2, 46 + i, 30 - i * 4, 1, shade('#6f747b'));

      // Vending machine
      p.rect(138, 84, 30, FLOOR - 84 + 4, shade('#e8e6e0'));
      p.rect(138, 84, 30, 3, shade('#c0392b'));
      p.rect(141, 89, 24, 18, lit ? '#d8ecff' : shade('#b9c6d4'));
      const cans = ['#c0392b', '#3c6fb0', '#e0b84a', '#5f9a52', '#e89a9a', '#2b2b30'];
      for (let r = 0; r < 3; r++) for (let c = 0; c < 6; c++) p.rect(142 + c * 4, 91 + r * 6, 2, 3, cans[(r * 2 + c) % cans.length]);
      p.rect(141, 110, 24, 3, shade('#2a2d36'));
      p.rect(160, 116, 4, 4, shade('#9aa3a8'));
      p.rect(141, 120, 18, 4, shade('#2a2d36'));

      // Bench
      p.rect(66, BENCH, 60, 3, shade('#8a6440'));
      p.rect(66, BENCH, 60, 1, shade('#a87750'));
      p.rect(66, BENCH + 3, 60, 1, shade('#5a3a25'));
      for (const lx of [70, 120]) p.rect(lx, BENCH + 4, 2, 10, shade('#3a3a3e'));

      paintDecor(p, SLOTS, decor, ITEMS, env.wilted);
    });
  }

  // Light from the vending machine (always on) and from the neon after dark.
  function drawGlow(p, env, lights) {
    p.shifted(OX, () => {
      const k = Math.random() < 0.01 ? 0.5 : 1; // a rare buzz
      p.alpha((lights ? 0.12 : 0.05) * k, () => p.disc(153, 98, 22, '#cfe8ff'));
      p.alpha((lights ? 0.2 : 0.06) * k, () => p.ellipse(153, FLOOR + 10, 26, 5, '#cfe8ff'));
    });
    if (env.rain && lights) {
      // Puddles catch the neon
      signs.slice(0, 4).forEach(([x, , w, , color], i) => {
        p.alpha(0.12, () => p.rect(x, FLOOR + 18 + (i % 2) * 14, Math.max(4, w), 2, color));
      });
    }
  }

  // A black cat on the ledge, flicking its tail.
  function drawCat(p, t, tone) {
    const x = OX + 118;
    const y = LEDGE;
    const c = tone('#1b1b1e');
    p.rect(x, y - 5, 7, 5, c); // body
    p.rect(x + 5, y - 8, 4, 4, c); // head
    p.px(x + 5, y - 9, c);
    p.px(x + 8, y - 9, c);
    const flick = Math.sin(t * 2.2) > 0.6;
    p.rect(x - 2, y - (flick ? 6 : 3), 2, flick ? 4 : 2, c);
    p.px(x + 7, y - 7, '#9fd36e'); // an eye catching the light
  }

  return { W, H, render };
}
