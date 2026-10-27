// Small pixel-art toolkit: a painter for whole-pixel shapes, baked sprites, dithered
// gradients, seeded randomness and a throttled animation loop.

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

export class Painter {
  constructor(canvas) {
    this.canvas = canvas;
    this.g = canvas.getContext('2d');
  }

  rect(x, y, w, h, color) {
    this.g.fillStyle = color;
    this.g.fillRect(Math.round(x), Math.round(y), w, h);
  }

  px(x, y, color) {
    this.rect(x, y, 1, 1, color);
  }

  // Filled ellipse built from whole-pixel rows, so it stays crisp when scaled up.
  ellipse(cx, cy, rx, ry, color) {
    for (let dy = -ry; dy <= ry; dy++) {
      const half = Math.floor(rx * Math.sqrt(1 - (dy * dy) / (ry * ry || 1)));
      this.rect(cx - half, cy + dy, half * 2 + 1, 1, color);
    }
  }

  disc(cx, cy, r, color) {
    this.ellipse(cx, cy, r, r, color);
  }

  // One-pixel line (Bresenham).
  line(x0, y0, x1, y1, color) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.px(x0, y0, color);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }

  alpha(a, fn) {
    const prev = this.g.globalAlpha;
    this.g.globalAlpha = prev * a;
    fn();
    this.g.globalAlpha = prev;
  }

  image(img, x, y) {
    this.g.drawImage(img, Math.round(x), Math.round(y));
  }

  clear(x = 0, y = 0, w = this.canvas.width, h = this.canvas.height) {
    this.g.clearRect(x, y, w, h);
  }
}

// A sprite from rows of characters; each character maps to a color and '.' is transparent.
// It's baked to a canvas the first time it's drawn.
export function sprite(rows, colors) {
  const w = rows[0].length;
  const h = rows.length;
  let baked = null;
  return {
    w,
    h,
    draw(p, x, y) {
      if (!baked) {
        baked = makeCanvas(w, h);
        const g = baked.getContext('2d');
        rows.forEach((row, ry) => {
          for (let rx = 0; rx < w; rx++) {
            const color = colors[row[rx]];
            if (!color) continue;
            g.fillStyle = color;
            g.fillRect(rx, ry, 1, 1);
          }
        });
      }
      p.image(baked, x, y);
    },
  };
}

const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

// Vertical gradient through the given colors as solid bands with dithered seams.
export function ditherBands(p, x, y, w, h, stops) {
  for (let row = 0; row < h; row++) {
    const f = (row / Math.max(1, h - 1)) * (stops.length - 1);
    const i = Math.min(Math.floor(f), stops.length - 2);
    const blend = (f - i - 0.55) / 0.45; // only the last part of each band blends into the next
    if (blend <= 0) {
      p.rect(x, y + row, w, 1, stops[i]);
      continue;
    }
    for (let col = 0; col < w; col++) {
      const next = blend * 16 > BAYER[(y + row) & 3][(x + col) & 3];
      p.px(x + col, y + row, next ? stops[i + 1] : stops[i]);
    }
  }
}

// Deterministic random numbers (mulberry32), so textures look the same on every draw.
export function seeded(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function mix(a, b, t) {
  if (t <= 0) return a;
  const x = parseInt(a.slice(1), 16);
  const y = parseInt(b.slice(1), 16);
  const ch = (v, s) => (v >> s) & 255;
  const lerp = s => Math.round(ch(x, s) + (ch(y, s) - ch(x, s)) * t);
  return `#${((1 << 24) | (lerp(16) << 16) | (lerp(8) << 8) | lerp(0)).toString(16).slice(1)}`;
}

export const pick = list => list[Math.floor(Math.random() * list.length)];

// requestAnimationFrame throttled to a low frame rate. The browser already pauses it in the background.
export function loop(draw, fps) {
  let raf = 0;
  let last = -Infinity;
  const frame = ts => {
    raf = requestAnimationFrame(frame);
    if (ts - last < 1000 / fps - 4) return;
    last = ts;
    draw(ts / 1000);
  };
  return {
    start() {
      if (!raf) raf = requestAnimationFrame(frame);
    },
    stop() {
      cancelAnimationFrame(raf);
      raf = 0;
    },
  };
}
