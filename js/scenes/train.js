// The train: a window seat on a local train, the countryside rolling past in layers (far
// mountains, hills with houses, fields, then power poles and their sagging wires up close), with
// petals on the wind. Drawn on a 180×196 grid; a wider canvas shows more windows along the car,
// all looking onto the same moving countryside.

import { Painter, makeCanvas, seeded } from '../pixel.js';
import { ITEMS } from '../decor.js';
import { lightsOn, toner, paintSky, createSkyLife, paintDecor, animateDecor, sideSpots } from './outside.js';

const BASE_W = 180;
const H = 196;
const BAND = { y: 28, h: 90 }; // the outside shows through windows within this height
const WIN = { x: 14, w: 152 }; // the main window, in the 180-wide middle
const SIDE_WIN = 48; // width of the extra windows on a wide canvas
const LEDGE = 126; // top of the window ledge; ledge items stand here

export const SLOTS = [
  { id: 'rack', kind: 'shelf', label: 'Luggage rack', x: 146, y: 11 },
  { id: 'desk-l', kind: 'desk', label: 'Ledge left', x: 46, y: LEDGE },
  { id: 'desk-c', kind: 'desk', label: 'Ledge middle', x: 90, y: LEDGE },
  { id: 'desk-r', kind: 'desk', label: 'Ledge right', x: 134, y: LEDGE },
];
export const DEFAULTS = { rack: 'books', 'desk-l': 'tea', 'desk-c': 'notebook', 'desk-r': 'plant' };

// Countryside layers: how fast each slides by (pixels per frame) and its colors.
const SPEED = { mountains: 0.25, hills: 0.8, field: 1.6, posts: 2.4, poles: 3.2 };
const POLE_GAP = 72;

// A repeating ridge line: smoothly joins random heights `step` apart, the same every lap.
function makeRidge(seed, period, step, low, high) {
  const rnd = seeded(seed);
  const points = Array.from({ length: period / step }, () => low + rnd() * (high - low));
  return x => {
    const at = ((x % period) + period) % period;
    const i = Math.floor(at / step);
    const f = (at - i * step) / step;
    const a = points[i];
    const b = points[(i + 1) % points.length];
    return Math.round(a + (b - a) * (1 - Math.cos(f * Math.PI)) / 2);
  };
}

const mountain = makeRidge(7, 480, 24, 52, 80);
const hill = makeRidge(13, 360, 30, 82, 94);
const HILL_PERIOD = 360;

// Houses along the hills: [position along the hills, width, height, roof color]
const HOUSES = (() => {
  const rnd = seeded(21);
  const roofs = ['#8c3b3b', '#3e5c76', '#5a5a52', '#7a4a2a'];
  const out = [];
  for (let at = 10; at < HILL_PERIOD - 20; at += 30 + Math.floor(rnd() * 40)) {
    out.push([at, 8 + Math.floor(rnd() * 5), 5 + Math.floor(rnd() * 3), roofs[Math.floor(rnd() * roofs.length)]]);
  }
  return out;
})();

export function createTrain(W = BASE_W) {
  const OX = Math.round((W - BASE_W) / 2);
  const windows = [[OX + WIN.x, WIN.w], ...sideSpots(W, OX, BASE_W, 64).map(x => [x - SIDE_WIN / 2, SIDE_WIN])];
  const sky = makeCanvas(W, H);
  const interior = makeCanvas(W, H);
  const life = createSkyLife({ x: 0, y: BAND.y, w: W, h: 40 }, { starHeight: 30, seed: 41 });
  const spots = { sunset: [OX + 58, 76], dawn: [OX + 124, 74], moon: [OX + 136, 42] };
  let skyKey = '';
  let interiorKey = '';
  let frame = 0;

  const petals = Array.from({ length: 9 }, () => newPetal(true));
  const drops = Array.from({ length: Math.round(W / 4) }, () => newDrop(true));
  const beads = Array.from({ length: Math.round(W / 8) }, () => ({ x: Math.random() * W, y: BAND.y + Math.random() * BAND.h }));

  function render(p, env) {
    frame++;
    const tone = toner(env);
    if (`${env.tod}:${env.rain}` !== skyKey) {
      const sp = new Painter(sky);
      sp.clear();
      paintSky(sp, env, { x: 0, y: BAND.y, w: W, h: BAND.h }, spots, 64);
      skyKey = `${env.tod}:${env.rain}`;
    }
    const decor = { ...DEFAULTS, ...env.decor };
    const decorKey = JSON.stringify(decor) + env.wilted;
    if (decorKey !== interiorKey) {
      paintInterior(new Painter(interior), decor, env.wilted);
      interiorKey = decorKey;
    }

    p.clear();
    p.image(sky, 0, 0);
    life.stars(p, env, frame, (x, y) => y >= mountain(x + frame * SPEED.mountains));
    life.clouds(p, env);
    drawCountry(p, env, tone);
    if (env.rain) drawRain(p);
    else if (env.tod !== 'night') drawPetals(p);
    p.image(interior, 0, 0);
    drawStraps(p, env.t);
    p.shifted(OX, () => animateDecor(p, SLOTS, decor, ITEMS, env.t));
  }

  // Outside, back to front. Everything slides left as the train rolls on.

  function drawCountry(p, env, tone) {
    const lights = lightsOn(env);
    const bottom = BAND.y + BAND.h;

    const mOff = frame * SPEED.mountains;
    const mColor = tone('#7d93b4');
    const snow = tone('#e8eef4');
    for (let x = 0; x < W; x++) {
      const top = mountain(x + mOff);
      p.rect(x, top, 1, bottom - top, mColor);
      if (top < 58) p.rect(x, top, 1, 2, snow);
    }

    const hOff = frame * SPEED.hills;
    const hColor = tone('#5f8a4f');
    for (let x = 0; x < W; x++) {
      const top = hill(x + hOff);
      p.rect(x, top, 1, bottom - top, hColor);
    }
    // Houses ride the hills; each sits on the hill line where it is.
    for (const [at, w, h, roof] of HOUSES) {
      for (let lap = 0; lap * HILL_PERIOD < W + HILL_PERIOD; lap++) {
        const x = Math.round(((at - hOff) % HILL_PERIOD + HILL_PERIOD) % HILL_PERIOD + lap * HILL_PERIOD - HILL_PERIOD / 2);
        if (x < -w || x > W) continue;
        const base = hill(at) + 2;
        p.rect(x, base - h, w, h, tone('#e2d8c4'));
        p.rect(x - 1, base - h - 2, w + 2, 2, tone(roof));
        p.rect(x + 2, base - h + 2, 2, 2, lights ? '#f4c66e' : tone('#6d8295'));
      }
    }

    const fOff = frame * SPEED.field;
    p.rect(0, 100, W, bottom - 100, tone('#86a85e'));
    p.rect(0, 100, W, 1, tone('#9cbc6e'));
    for (const y of [104, 109, 114]) p.rect(0, y, W, 1, tone('#6f9150'));
    // Short fence posts close to the track blur past.
    const postOff = (frame * SPEED.posts) % 12;
    for (let x = -postOff; x < W; x += 12) p.rect(x, 110, 1, 5, tone('#5a4a3a'));

    // Power poles, with two wires sagging between each pair.
    const pOff = frame * SPEED.poles;
    const first = Math.floor(pOff / POLE_GAP) * POLE_GAP;
    const poleColor = tone('#3a3632');
    const wireColor = tone('#2a2826');
    for (let world = first; world - pOff < W + POLE_GAP; world += POLE_GAP) {
      const x = Math.round(world - pOff);
      for (const dy of [0, 4]) {
        for (let i = 0; i <= POLE_GAP; i++) {
          const u = i / POLE_GAP;
          p.px(x + i, 40 + dy + Math.round(7 * 4 * u * (1 - u)), wireColor);
        }
      }
      p.rect(x - 1, 34, 2, bottom - 34, poleColor);
      p.rect(x - 4, 39, 8, 1, poleColor);
      p.px(x - 4, 38, tone('#cfcfc4'));
      p.px(x + 3, 38, tone('#cfcfc4'));
    }
  }

  function newPetal(anywhere) {
    return {
      x: anywhere ? Math.random() * W : W + Math.random() * 40,
      y: BAND.y + 10 + Math.random() * 70,
      v: 1.4 + Math.random() * 1.6,
      phase: Math.random() * 6,
    };
  }

  function drawPetals(p) {
    for (let i = 0; i < petals.length; i++) {
      const pt = petals[i];
      pt.x -= pt.v;
      pt.y += Math.sin(frame / 5 + pt.phase) * 0.4 + 0.1;
      if (pt.x < -2 || pt.y > BAND.y + BAND.h) petals[i] = newPetal(false);
      p.px(pt.x, pt.y, '#f4b6c2');
      if ((frame + i) % 4 < 2) p.px(pt.x + 1, pt.y, '#f8d0d8');
    }
  }

  function newDrop(anywhere) {
    return { x: anywhere ? Math.random() * W : W + Math.random() * 30, y: BAND.y + Math.random() * BAND.h, v: 6 + Math.random() * 3 };
  }

  // Rain on a moving train streaks sideways across the glass.
  function drawRain(p) {
    p.alpha(0.4, () => {
      for (let i = 0; i < drops.length; i++) {
        const d = drops[i];
        d.x -= d.v;
        d.y += 1.2;
        if (d.x < -5 || d.y > BAND.y + BAND.h) drops[i] = newDrop(false);
        p.rect(d.x, d.y, 4, 1, '#c3d0e0');
      }
    });
    for (const b of beads) {
      b.x -= 0.3;
      if (b.x < 0) b.x = W;
      p.alpha(0.5, () => p.px(b.x, b.y, '#dbe5ee'));
    }
  }

  // Inside: ceiling and luggage rack, ads, windows cut into the wall, a ledge, the heater,
  // and the green seat back in front.

  function paintInterior(p, decor, wilted) {
    p.clear();
    p.rect(0, 0, W, H, '#d3c9b3');
    p.rect(0, 0, W, 7, '#bdb3a0');
    p.rect(0, 2, W, 3, '#f6f3ea'); // light strip
    p.alpha(0.06, () => p.rect(0, 7, W, 20, '#fff8e8'));

    // Ads between the rack and the windows
    const ads = [['#e98a5c', '#f7c27a'], ['#6fa7cf', '#e8eef4'], ['#9fd3a0', '#f2efe4'], ['#c8a8e0', '#f4b6c2']];
    for (let x = 8, i = 0; x < W - 20; x += 46, i++) {
      const [bg, fg] = ads[i % ads.length];
      p.rect(x, 17, 24, 9, '#f2efe4');
      p.rect(x + 1, 18, 22, 7, bg);
      p.rect(x + 3, 20, 8, 3, fg);
      p.rect(x + 13, 20, 8, 1, fg);
      p.rect(x + 13, 22, 6, 1, fg);
    }

    // Luggage rack: two rails on brackets
    p.rect(0, 11, W, 1, '#9a968e');
    p.rect(0, 14, W, 2, '#77736c');
    for (let x = 10; x < W; x += 48) p.rect(x, 7, 2, 9, '#6a665f');

    // Windows: a frame, then the glass cut out with its corners rounded
    for (const [x, w] of windows) {
      p.rect(x - 3, BAND.y - 3, w + 6, BAND.h + 6, '#9b968c');
      p.rect(x - 3, BAND.y - 3, w + 6, 1, '#b8b3a8');
      p.clear(x, BAND.y, w, BAND.h);
      for (const [cx, cy] of [[x, BAND.y], [x + w - 1, BAND.y], [x, BAND.y + BAND.h - 1], [x + w - 1, BAND.y + BAND.h - 1]]) p.px(cx, cy, '#9b968c');
      p.alpha(0.06, () => {
        for (let i = 0; i < Math.min(30, w - 10); i++) p.rect(x + 6 + i, BAND.y + BAND.h - 8 - i, 3, 1, '#ffffff');
      });
    }
    // The main window is split in two panes
    p.rect(OX + WIN.x + WIN.w / 2 - 1, BAND.y, 2, BAND.h, '#9b968c');

    // Ledge, wall and heater under the windows
    p.rect(0, LEDGE, W, 4, '#7a6a58');
    p.rect(0, LEDGE, W, 1, '#9a8a74');
    p.rect(0, LEDGE + 4, W, 1, '#5a4e40');
    p.rect(0, 134, W, 12, '#a39b8a');
    for (let x = 2; x < W; x += 4) p.rect(x, 136, 2, 8, '#8a8272');

    // Seat back in green velvet, with seams between seats
    const nap = seeded(17);
    p.rect(0, 148, W, H - 148, '#3d6b57');
    p.rect(0, 148, W, 2, '#5f9479');
    p.rect(0, 150, W, 1, '#4f7f68');
    for (let i = 0; i < W * 2; i++) p.px(Math.floor(nap() * W), 152 + Math.floor(nap() * (H - 152)), '#355e4c');
    for (let x = 30; x < W; x += 60) p.rect(x, 150, 1, H - 150, '#2f5444');

    p.shifted(OX, () => paintDecor(p, SLOTS, decor, ITEMS, wilted));
  }

  // Hand straps hang from the rack and sway with the train.
  function drawStraps(p, t) {
    for (let x = 22, i = 0; x < W; x += 36, i++) {
      const sway = Math.round(Math.sin(t * 1.3 + i * 0.8) * 1.2);
      p.rect(x, 16, 1, 4, '#5a5550');
      p.rect(x + sway, 20, 1, 3, '#5a5550');
      const rx = x + sway;
      p.rect(rx - 1, 23, 3, 1, '#e8e2d4');
      p.rect(rx - 2, 24, 1, 3, '#e8e2d4');
      p.rect(rx + 2, 24, 1, 3, '#e8e2d4');
      p.rect(rx - 1, 27, 3, 1, '#e8e2d4');
    }
  }

  return { W, H, render };
}
