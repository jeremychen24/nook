// Shared outdoor pieces for scene windows: sky colors by time of day, sun and moon,
// stars, drifting clouds and rain on the glass.

import { ditherBands, seeded, mix } from '../pixel.js';

const SKY = {
  dawn: ['#2e3a6e', '#6a5a8e', '#c9849a', '#f2b38a', '#f8d9a8'],
  day: ['#4a86c8', '#5f98d4', '#7cb0e0', '#a3c9ea', '#cfe2f1'],
  sunset: ['#2f2d66', '#6b3f78', '#b8566e', '#e98a5c', '#f7c27a'],
  dusk: ['#0f1433', '#1d2150', '#33306a', '#57407a', '#7d5584'],
  night: ['#070a1c', '#0b1028', '#111735', '#172044', '#1e2a52'],
};
const RAIN_SKY = {
  light: ['#4e5866', '#5e6875', '#6f7985', '#808a95', '#929ba5'],
  dark: ['#0b0e15', '#10141d', '#161b26', '#1c2230', '#232a3a'],
};
const CLOUD = { dawn: '#f0c6b4', day: '#f2f6fa', sunset: '#f2a07a', dusk: '#4a3f6a', night: '#18213f' };
// Outdoor colors are pulled toward this color, by this much, for each time of day.
const TINT = {
  dawn: ['#5a4a7a', 0.25],
  day: ['#ffffff', 0],
  sunset: ['#c0604a', 0.2],
  dusk: ['#1c1a40', 0.45],
  night: ['#070a1c', 0.6],
};

export const isDark = tod => tod === 'dusk' || tod === 'night';

// Whether windows, lamps and headlights outside are switched on.
export const lightsOn = env => isDark(env.tod) || (env.rain && env.tod !== 'day');

// Returns a function that shades an outdoor color for the time of day and weather.
export function toner(env) {
  const [color, amount] = TINT[env.tod];
  const cache = new Map();
  return hex => {
    let out = cache.get(hex);
    if (!out) {
      out = mix(hex, color, amount);
      if (env.rain) out = mix(out, isDark(env.tod) ? '#0b0e15' : '#4e5866', 0.25);
      cache.set(hex, out);
    }
    return out;
  };
}

// Sky gradient behind the glass, plus a sun or moon wherever the scene wants them.
// spots: { sunset: [x, y], dawn: [x, y], moon: [x, y] }
export function paintSky(p, env, glass, spots, height = glass.h) {
  const stops = env.rain ? (isDark(env.tod) ? RAIN_SKY.dark : RAIN_SKY.light) : SKY[env.tod];
  ditherBands(p, glass.x, glass.y, glass.w, height, stops);
  if (env.rain) return;
  const sun = spots[env.tod];
  if (sun && (env.tod === 'sunset' || env.tod === 'dawn')) {
    const [x, y] = sun;
    p.alpha(0.25, () => p.disc(x, y, 11, env.tod === 'sunset' ? '#ffcf7a' : '#ffe0a8'));
    p.disc(x, y, 6, env.tod === 'sunset' ? '#ffd98e' : '#ffe7bd');
  } else if (isDark(env.tod) && spots.moon) {
    const [x, y] = spots.moon;
    p.disc(x, y, 4, '#efe6c8');
    p.disc(x + 2, y - 1, 3, stops[0]); // bite out of the moon makes a crescent
  }
}

// Moving sky details for one window. starHeight limits stars to the top of the glass.
export function createSkyLife(glass, { starHeight = 34, seed = 11 } = {}) {
  const rnd = seeded(seed);
  const stars = Array.from({ length: Math.round(glass.w / 6) }, () => ({
    x: glass.x + Math.floor(rnd() * glass.w),
    y: glass.y + 1 + Math.floor(rnd() * starHeight),
    phase: Math.floor(rnd() * 40),
  }));
  const clouds = [0.1, 0.65, 1].map((f, i) => ({
    x: glass.x + f * glass.w,
    y: glass.y + 3 + ((i * 7) % 12),
    speed: 0.035 + i * 0.012,
  }));
  const newDrop = anywhere => ({
    x: glass.x + Math.random() * (glass.w + 30),
    y: anywhere ? glass.y + Math.random() * glass.h : glass.y - Math.random() * 20,
    v: 3 + Math.random() * 2,
  });
  const drops = Array.from({ length: Math.round(glass.w * 0.4) }, () => newDrop(true));
  const beads = Array.from({ length: Math.round(glass.w * 0.25) }, () => ({
    x: glass.x + Math.floor(Math.random() * glass.w),
    y: glass.y + Math.floor(Math.random() * glass.h),
  }));

  return {
    // hidden(x, y) says whether something in front (a building, a hill) covers that spot.
    stars(p, env, frame, hidden = () => false) {
      if (env.rain || !isDark(env.tod)) return;
      for (const s of stars) {
        if ((frame + s.phase) % 40 < 3) continue; // brief twinkle off
        if (!hidden(s.x, s.y)) p.px(s.x, s.y, '#cfd6ff');
      }
    },

    clouds(p, env) {
      const color = env.rain ? (isDark(env.tod) ? '#1a1f2a' : '#6b7480') : CLOUD[env.tod];
      for (const c of clouds) {
        c.x -= c.speed;
        if (c.x < glass.x - 18) c.x = glass.x + glass.w + 2;
        const x = Math.round(c.x);
        p.rect(x + 4, c.y, 6, 1, color);
        p.rect(x + 2, c.y + 1, 11, 1, color);
        p.rect(x, c.y + 2, 16, 2, color);
      }
    },

    rain(p) {
      p.alpha(0.45, () => {
        for (let i = 0; i < drops.length; i++) {
          const d = drops[i];
          d.y += d.v;
          d.x -= d.v / 4;
          if (d.y > glass.y + glass.h) drops[i] = newDrop(false);
          p.rect(d.x, d.y, 1, 3, '#c3d0e0');
        }
      });
      // Beads of water on the glass that now and then slide down a pixel.
      for (const b of beads) {
        if (Math.random() < 0.03) b.y++;
        if (b.y > glass.y + glass.h - 2) b.y = glass.y + Math.floor(Math.random() * 20);
        p.alpha(0.55, () => p.px(b.x, b.y, '#dbe5ee'));
        p.alpha(0.35, () => p.px(b.x, b.y + 1, '#6f7c8c'));
      }
    },
  };
}

// Draws the decorations in their slots (slot x is the item's center, y its bottom).
export function paintDecor(p, slots, decor, items) {
  for (const slot of slots) {
    const item = items[decor[slot.id]];
    if (item) item.draw(p, slot.x - Math.floor(item.w / 2), slot.y - item.h);
  }
}

// Steam rising from any decoration that has a steam point (mugs, tea).
export function drawSteam(p, slots, decor, items, t) {
  for (const slot of slots) {
    const item = items[decor[slot.id]];
    if (!item?.steam) continue;
    const sx = slot.x - Math.floor(item.w / 2) + item.steam[0];
    const sy = slot.y - item.h + item.steam[1];
    for (let i = 0; i < 3; i++) {
      const k = (t * 0.45 + i / 3) % 1;
      const x = sx + Math.round(Math.sin(k * 6 + i * 2) * 1.5);
      p.alpha((1 - k) * 0.55, () => p.rect(x, sy - Math.round(k * 14), 1, 2, '#f4ece0'));
    }
  }
}
