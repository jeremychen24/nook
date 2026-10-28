// Art scenes: painted anime backgrounds by みんちりえ (https://min-chi.material.jp/), shown in
// place of pixel art. Each has a day, evening and night painting that follow the sky clock.
// The paintings in art/ aren't Nook's own and aren't offered for reuse; see art/NOTICE.md.

import { seeded } from '../pixel.js';

export const CREDIT = { name: 'みんちりえ', url: 'https://min-chi.material.jp/' };

// focus is where the picture stays centred when a tall screen crops its sides (0 left, 1 right).
// Outdoor scenes get falling rain; indoors, rain only greys the room.
export const ART = {
  homeroom: { name: 'Homeroom', focus: 0.55 },
  reading: { name: 'Reading room', focus: 0.5 },
  coffee: { name: 'Coffee shop', focus: 0.42 },
  commute: { name: 'Train car', focus: 0.5 },
  busstop: { name: 'Bus stop', focus: 0.45, outdoor: true },
  crossing: { name: 'Crossing', focus: 0.62, outdoor: true },
};

// Nook's five times of day share three paintings.
const PAINTING = { dawn: 'eve', day: 'day', sunset: 'eve', dusk: 'night', night: 'night' };
const SCALE = 5; // canvas pixels per scene pixel, so the paintings stay sharp
const FADE = 1.5; // seconds to cross-fade to a new time of day

export const artUrl = (id, tod, small = false) =>
  new URL(`../../art/${id}/${PAINTING[tod] ?? 'day'}${small ? '-small' : ''}.jpg`, import.meta.url).href;

// Loaded once and shared, so switching back to a painting is instant.
const images = new Map();
function load(url) {
  if (!images.has(url)) {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    images.set(url, img);
  }
  return images.get(url);
}
const ready = img => img.complete && img.naturalWidth > 0;

export function createArt(id, width = 180) {
  const { focus, outdoor } = ART[id];
  const W = width * SCALE;
  const H = 196 * SCALE;
  const rnd = seeded(id.length * 7919);
  const drops = Array.from({ length: Math.round(W / 5) }, () => ({
    x: rnd() * W * 1.2,
    y: rnd() * H,
    speed: 0.9 + rnd() * 0.5, // canvas heights per second
    len: 26 + rnd() * 26,
  }));

  let shown = null; // the painting on screen
  let leaving = null; // the one fading out: { img, since }
  let drawn = '';

  // Scales img to cover the canvas, keeping the focus point in view.
  function cover(g, img) {
    const s = Math.max(W / img.naturalWidth, H / img.naturalHeight);
    const w = img.naturalWidth * s;
    const h = img.naturalHeight * s;
    const x = Math.min(0, Math.max(W - w, W / 2 - w * focus));
    g.drawImage(img, x, (H - h) / 2, w, h);
  }

  function rain(g, t) {
    g.strokeStyle = 'rgba(210, 222, 240, .32)';
    g.lineWidth = 1.6;
    g.beginPath();
    for (const d of drops) {
      const y = (d.y + t * d.speed * H) % (H + d.len) - d.len;
      const x = d.x - (y + d.len) * 0.14;
      g.moveTo(x, y);
      g.lineTo(x - d.len * 0.14, y + d.len);
    }
    g.stroke();
  }

  return {
    W,
    H,
    smooth: true,
    render(p, { t = 0, tod, rain: raining }) {
      const next = load(artUrl(id, tod));
      if (next !== shown && ready(next)) {
        leaving = { img: shown, since: t };
        shown = next;
      }
      const fade = leaving ? Math.min(1, (t - leaving.since) / FADE) : 1;
      const falling = raining && outdoor;
      // A still painting only needs drawing again when something about it changes.
      const key = `${shown?.src}:${raining}`;
      if (!leaving && !falling && key === drawn) return;
      drawn = key;

      const g = p.g;
      g.imageSmoothingQuality = 'high';
      g.fillStyle = '#16171a';
      g.fillRect(0, 0, W, H);
      if (leaving?.img) cover(g, leaving.img);
      if (shown) p.alpha(fade, () => cover(g, shown));
      if (fade >= 1) leaving = null;
      if (raining && shown) {
        g.fillStyle = 'rgba(38, 48, 66, .28)';
        g.fillRect(0, 0, W, H);
      }
      if (falling && shown) rain(g, t);
    },
  };
}
