// The café: a window counter looking out on a city street.
// Everything is drawn in code on a 180×196 grid. The view outside follows the real time of day.

import { Painter, makeCanvas, sprite, seeded, mix, pick } from '../pixel.js';
import { ITEMS } from '../decor.js';
import { isDark, lightsOn, toner, paintSky, createSkyLife, paintDecor, drawSteam } from './outside.js';

const W = 180;
const H = 196;
const GLASS = { x: 32, y: 30, w: 116, h: 112 }; // inside edge of the window frame
const PANES = [[32, 30, 56, 24], [92, 30, 56, 24], [32, 58, 56, 84], [92, 58, 56, 84]];
const LAMPS = [58, 122];
const SIDEWALK = 122;

const SLOTS = [
  { id: 'wall', x: 14, y: 74 },
  { id: 'shelf', x: 166, y: 96 },
  { id: 'desk-l', x: 46, y: 153 },
  { id: 'desk-c', x: 92, y: 153 },
  { id: 'desk-r', x: 134, y: 153 },
];
const DEFAULTS = { wall: 'menu', shelf: 'jars', 'desk-l': 'plant', 'desk-c': 'notebook', 'desk-r': 'mug' };
const SKY_SPOTS = { sunset: [76, 56], dawn: [104, 50], moon: [136, 40] };

const FAR = { dawn: '#4f4c78', day: '#8aa3bd', sunset: '#5a3f6a', dusk: '#232750', night: '#121a38' };
const BUILDINGS = [
  { x: 32, w: 36, top: 70, wall: '#7c4637', trim: '#5a2f25', shop: 'door' },
  { x: 68, w: 42, top: 62, wall: '#a8957a', trim: '#7d6b54', shop: 'awning' },
  { x: 110, w: 38, top: 76, wall: '#566a70', trim: '#3d4d52', shop: 'door' },
];
const SKYLINE = [[32, 58, 7], [39, 64, 9], [50, 52, 7], [60, 60, 8], [84, 48, 6], [92, 56, 10], [108, 62, 7], [118, 50, 8], [130, 58, 12], [142, 66, 6]];

const COATS = ['#3e5c76', '#8c3b3b', '#2f4f3a', '#6b4f8a', '#b07a3a', '#2b2b30', '#7a6a5a', '#c9b8a0'];
const SKIN = ['#f1c9a5', '#d9a07a', '#a86b48', '#6e4630'];
const HAIR = ['#2a1d16', '#5a3a22', '#c99a52', '#1b1b1e', '#8a8a8a'];
const UMBRELLAS = ['#c94f4f', '#3c6fb0', '#e0b84a', '#2b2b30', '#5f9a52'];
const CARS = ['#b8453a', '#3c6fb0', '#e0c25a', '#d8d4cc', '#2b2e33', '#4f8a6a'];

const SHADE = sprite([
  '....ddd....',
  '...dbbbd...',
  '..dbhbbbd..',
  '.dbhbbbbbd.',
  'dbbbbbbbbbd',
  '...yyyyy...',
], { d: '#7a4e22', b: '#c48a3c', h: '#e6b06a', y: '#fff1c4' });

export function createCafe() {
  const sky = makeCanvas(W, H);
  const city = makeCanvas(W, H);
  const interior = makeCanvas(W, H);
  const life = createSkyLife(GLASS);
  let outsideKey = '';
  let interiorKey = '';
  let frame = 0;

  const walkers = [spawnWalker(52), spawnWalker(118)];
  const cars = [];
  const lamps = LAMPS.map(x => ({ x, dim: 0 }));

  function render(p, env) {
    frame++;
    const tone = toner(env);
    const key = `${env.tod}:${env.rain}`;
    if (key !== outsideKey) {
      paintSky(new Painter(sky), env, GLASS, SKY_SPOTS, 96);
      paintCity(new Painter(city), env, tone);
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
    life.stars(p, env, frame, (x, y) => y >= skylineTopAt(x));
    life.clouds(p, env);
    p.image(city, 0, 0);
    drawWalkers(p, env, tone);
    drawCars(p, env, tone);
    if (env.rain) life.rain(p);
    p.image(interior, 0, 0);
    drawLamps(p, env.tod === 'day' ? 0.55 : 1);
    drawSteam(p, SLOTS, decor, ITEMS, env.t);
  }

  // Outside

  function paintCity(p, env, tone) {
    p.clear();
    const lights = lightsOn(env);
    const far = env.rain ? (isDark(env.tod) ? '#151a24' : '#6c7682') : FAR[env.tod];
    const rnd = seeded(42);
    for (const [x, top, w] of SKYLINE) {
      p.rect(x, top, w, 90 - top, far);
      if (lights) {
        for (let i = 0; i < 3; i++) {
          if (rnd() < 0.6) p.px(x + 1 + Math.floor(rnd() * (w - 2)), top + 3 + Math.floor(rnd() * 14), '#c9a35a');
        }
      }
    }

    for (const b of BUILDINGS) paintBuilding(p, b, tone, lights, rnd);

    p.rect(GLASS.x, SIDEWALK, GLASS.w, 4, tone('#8a8780'));
    for (let x = GLASS.x + 6; x < GLASS.x + GLASS.w; x += 11) p.rect(x, SIDEWALK, 1, 4, tone('#77746e'));
    p.rect(GLASS.x, SIDEWALK + 4, GLASS.w, 1, tone('#5d5e60'));
    p.rect(GLASS.x, SIDEWALK + 5, GLASS.w, 15, tone('#383b40'));
    for (let x = GLASS.x + 2; x < GLASS.x + GLASS.w; x += 14) p.rect(x, 134, 6, 1, tone('#b5ae8f'));

    // Street lamp in front of the right building
    const pole = tone('#2a2d33');
    p.rect(134, 97, 1, 25, pole);
    p.rect(130, 96, 5, 1, pole);
    p.rect(129, 97, 4, 1, pole);
    p.rect(130, 98, 2, 1, lights ? '#fff0b8' : tone('#9aa3a8'));
    if (lights) {
      p.alpha(0.08, () => p.disc(131, 101, 10, '#ffd98a'));
      p.alpha(0.12, () => p.disc(131, 100, 5, '#ffd98a'));
      p.alpha(0.22, () => p.ellipse(131, 124, 9, 1, '#ffd98a'));
    }
  }

  function paintBuilding(p, b, tone, lights, rnd) {
    const { x, w, top } = b;
    const trim = tone(b.trim);
    p.rect(x, top, w, SIDEWALK - top, tone(b.wall));
    p.rect(x, top, w, 2, trim);
    p.rect(x, top + 2, w, 1, tone(mix(b.trim, '#000000', 0.35)));

    const cols = Math.floor((w - 4) / 8);
    const startX = x + Math.floor((w - (cols * 8 - 4)) / 2);
    for (let wy = top + 6; wy + 6 <= 100; wy += 11) {
      for (let c = 0; c < cols; c++) {
        const wx = startX + c * 8;
        const lit = lights && rnd() < 0.45;
        p.rect(wx - 1, wy - 1, 6, 8, trim);
        if (lit) {
          p.rect(wx, wy, 4, 6, '#f4c66e');
          p.rect(wx, wy + 4, 4, 2, '#d39a4c');
        } else {
          p.rect(wx, wy, 4, 6, tone(lights ? '#1d2436' : '#9db4c6'));
          if (!lights) p.rect(wx, wy, 1, 3, tone('#d3e1ea'));
        }
      }
    }

    // Ground floor shop
    p.rect(x, 103, w, 1, trim);
    const shopGlass = lights ? '#e9b062' : tone('#5d7385');
    if (b.shop === 'awning') {
      for (let ax = x + 3, i = 0; ax < x + w - 3; ax += 3, i++) {
        p.rect(ax, 104, 3, 4, tone(i % 2 ? '#eadcc4' : '#b5483d'));
        if (i % 2 === 0) p.rect(ax, 108, 3, 1, tone('#b5483d'));
      }
      p.rect(x + 5, 110, w - 17, 11, trim);
      p.rect(x + 6, 111, w - 19, 10, shopGlass);
      p.rect(x + 6 + Math.floor((w - 19) / 2), 111, 1, 10, trim);
      p.rect(x + w - 10, 110, 6, 12, tone('#3b2a22'));
    } else {
      p.rect(x + 4, 110, 6, 12, tone('#3b2a22'));
      p.rect(x + 9, 116, 1, 1, tone('#c9a35a'));
      p.rect(x + 13, 105, w - 17, 3, trim);
      p.rect(x + 13, 109, w - 17, 10, trim);
      p.rect(x + 14, 110, w - 19, 8, shopGlass);
    }
  }

  function spawnWalker(x) {
    const dir = Math.random() < 0.5 ? 1 : -1;
    return {
      x: x ?? (dir > 0 ? GLASS.x - 7 : GLASS.x + GLASS.w + 2),
      dir,
      speed: 0.35 + Math.random() * 0.35,
      dist: 0,
      tall: Math.random() < 0.5 ? 0 : 1,
      coat: pick(COATS),
      skin: pick(SKIN),
      hair: pick(HAIR),
      umbrella: pick(UMBRELLAS),
    };
  }

  function drawWalkers(p, env, tone) {
    if (walkers.length < 3 && Math.random() < 0.015) walkers.push(spawnWalker());
    for (let i = walkers.length - 1; i >= 0; i--) {
      const w = walkers[i];
      w.x += w.speed * w.dir;
      w.dist += w.speed;
      if (w.x < GLASS.x - 9 || w.x > GLASS.x + GLASS.w + 4) {
        walkers.splice(i, 1);
        continue;
      }
      const x = Math.round(w.x);
      const feet = SIDEWALK + 3;
      const top = feet - 11 - w.tall;
      const legs = tone('#2a2a33');
      if (Math.floor(w.dist / 2) % 2) {
        p.rect(x + 1, feet - 3, 1, 3, legs);
        p.rect(x + 3, feet - 3, 1, 3, legs);
      } else {
        p.rect(x + 2, feet - 3, 1, 3, legs);
      }
      p.rect(x, top + 4, 5, 4 + w.tall, tone(w.coat));
      p.rect(x + 1, top + 1, 3, 3, tone(w.skin));
      p.rect(x + 1, top, 3, 1, tone(w.hair));
      p.rect(w.dir > 0 ? x + 1 : x + 3, top + 1, 1, 2, tone(w.hair));
      if (env.rain) {
        p.rect(x + 2, top - 2, 1, 2, '#1b1b1e');
        p.rect(x, top - 4, 5, 1, tone(w.umbrella));
        p.rect(x - 2, top - 3, 9, 1, tone(w.umbrella));
      }
    }
  }

  function drawCars(p, env, tone) {
    if (!cars.length && Math.random() < 0.006) {
      const dir = Math.random() < 0.5 ? 1 : -1;
      cars.push({ x: dir > 0 ? GLASS.x - 24 : GLASS.x + GLASS.w + 2, dir, speed: 2 + Math.random(), color: pick(CARS) });
    }
    const lights = isDark(env.tod) || env.rain;
    for (let i = cars.length - 1; i >= 0; i--) {
      const c = cars[i];
      c.x += c.speed * c.dir;
      if (c.x < GLASS.x - 26 || c.x > GLASS.x + GLASS.w + 4) {
        cars.splice(i, 1);
        continue;
      }
      const x = Math.round(c.x);
      const y = 132;
      const body = tone(c.color);
      const glass = tone('#9fb7c8');
      p.rect(x + 5, y - 1, 11, 3, body);
      p.rect(x + 6, y, 4, 2, glass);
      p.rect(x + 11, y, 4, 2, glass);
      p.rect(x, y + 2, 22, 4, body);
      p.rect(x, y + 5, 22, 1, tone(mix(c.color, '#000000', 0.35)));
      p.rect(x + 3, y + 6, 4, 2, '#111214');
      p.rect(x + 15, y + 6, 4, 2, '#111214');
      const front = c.dir > 0 ? x + 21 : x;
      const back = c.dir > 0 ? x : x + 21;
      p.px(front, y + 3, lights ? '#fff3c0' : tone('#e8e0c8'));
      p.px(back, y + 3, lights ? '#ff5a4a' : tone('#9c3a30'));
      if (lights) p.alpha(0.18, () => p.rect(c.dir > 0 ? x + 22 : x - 12, y + 3, 12, 2, '#fff3c0'));
    }
  }

  // Inside

  function paintInterior(p, decor) {
    p.clear();
    paintBrick(p, 0, 0, W, 146);
    p.alpha(0.22, () => {
      p.rect(0, 0, 8, 146, '#000000');
      p.rect(W - 8, 0, 8, 146, '#000000');
      p.rect(0, 0, W, 12, '#000000');
    });

    // Ceiling beam
    p.rect(0, 0, W, 6, '#1f150f');
    p.rect(0, 6, W, 1, '#3a2719');
    p.rect(0, 7, W, 1, '#140d09');

    // Window frame, then the glass panes are cut out of it
    p.rect(GLASS.x - 4, GLASS.y - 4, GLASS.w + 8, GLASS.h + 8, '#24170f');
    p.rect(GLASS.x - 4, GLASS.y - 4, GLASS.w + 8, 1, '#4a3222');
    p.rect(GLASS.x - 4, GLASS.y - 4, 1, GLASS.h + 8, '#3a2719');
    for (const [x, y, w, h] of PANES) {
      p.clear(x, y, w, h);
      p.rect(x - 1, y - 1, w + 2, 1, '#120b07');
      p.rect(x - 1, y + h, w + 2, 1, '#5a3d29');
    }
    // Faint reflections on the lower panes
    p.alpha(0.07, () => {
      for (const [x, y] of PANES.slice(2)) {
        for (let i = 0; i < 30; i++) p.rect(x + 8 + i, y + 44 - i, 4, 1, '#ffffff');
        for (let i = 0; i < 20; i++) p.rect(x + 20 + i, y + 50 - i, 1, 1, '#ffffff');
      }
    });

    // Counter along the window
    const grain = seeded(5);
    p.rect(0, 146, W, 12, '#7a5236');
    p.rect(0, 146, W, 1, '#9a6c47');
    for (let i = 0; i < 16; i++) {
      p.rect(Math.floor(grain() * W), 148 + Math.floor(grain() * 9), 6 + Math.floor(grain() * 18), 1, '#6c4730');
    }
    p.rect(0, 158, W, 1, '#a87750');
    p.rect(0, 159, W, 3, '#5a3a25');
    p.rect(0, 162, W, H - 162, '#2c1e17');
    p.rect(0, 162, W, 2, '#1c130e');
    for (let x = 7; x < W; x += 15) p.rect(x, 164, 1, H - 164, '#22170f');

    // Shelf on the right wall
    p.rect(154, 96, 24, 2, '#6b4830');
    p.rect(154, 98, 24, 1, '#2a1b12');
    p.rect(158, 99, 1, 3, '#1f150f');
    p.rect(173, 99, 1, 3, '#1f150f');

    // Pendant lamps
    for (const x of LAMPS) {
      p.rect(x, 7, 1, 21, '#120c08');
      SHADE.draw(p, x - 5, 28);
    }

    paintDecor(p, SLOTS, decor, ITEMS);
  }

  function paintBrick(p, x0, y0, w, h) {
    const rnd = seeded(3);
    const colors = ['#5b3528', '#643b2c', '#523024', '#6b4231'];
    p.rect(x0, y0, w, h, '#2a1b15');
    for (let y = y0, row = 0; y < y0 + h; y += 4, row++) {
      for (let x = x0 - (row % 2 ? 5 : 0); x < x0 + w; x += 10) {
        p.rect(x, y, 9, 3, colors[Math.floor(rnd() * colors.length)]);
        if (rnd() < 0.3) p.rect(x, y, 3, 1, '#7a4b37');
      }
    }
  }

  function drawLamps(p, strength) {
    for (const lamp of lamps) {
      if (lamp.dim > 0) lamp.dim--;
      else if (Math.random() < 0.006) lamp.dim = 2 + Math.floor(Math.random() * 3);
      const k = (lamp.dim > 0 ? 0.55 : 1) * strength;
      p.alpha(0.035 * k, () => p.disc(lamp.x, 36, 30, '#ffcf7a'));
      p.alpha(0.05 * k, () => p.disc(lamp.x, 36, 18, '#ffcf7a'));
      p.alpha(0.08 * k, () => p.disc(lamp.x, 35, 9, '#ffdc96'));
      p.alpha(0.1 * k, () => p.ellipse(lamp.x, 151, 22, 4, '#ffd38a'));
    }
  }

  return { W, H, render };
}

function skylineTopAt(x) {
  let top = Infinity;
  for (const [sx, st, sw] of SKYLINE) if (x >= sx && x < sx + sw) top = Math.min(top, st);
  for (const b of BUILDINGS) if (x >= b.x && x < b.x + b.w) top = Math.min(top, b.top);
  return top;
}
