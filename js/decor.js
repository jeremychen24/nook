// Decorations that sit in a scene's slots. Each has a name, a price in coins (0 = free),
// the kinds of slot it fits, and optionally a wilted look or a little animation.

import { sprite } from './pixel.js';

// Animation: steam rising from a point on the item.
const steam = (dx, dy) => (p, x, y, t) => {
  for (let i = 0; i < 3; i++) {
    const k = (t * 0.45 + i / 3) % 1;
    const sx = x + dx + Math.round(Math.sin(k * 6 + i * 2) * 1.5);
    p.alpha((1 - k) * 0.55, () => p.rect(sx, y + dy - Math.round(k * 14), 1, 2, '#f4ece0'));
  }
};

const mug = sprite([
  'rrrrrrr...',
  'wcccccw...',
  'wwwwwwwss.',
  'wwwwwww.s.',
  'swwwwww.s.',
  'swwwwwwss.',
  'sswwwws...',
  '.sssss....',
], { r: '#fff4e0', w: '#e8dcc8', s: '#b9a88e', c: '#4a2c1a' });

const tea = sprite([
  '..rrrrrr...',
  '..wttttwss.',
  '..wwwwww.s.',
  '..swwwwss..',
  'ddddddddddd',
  '.eeeeeeeee.',
], { r: '#fff4e0', w: '#e8dcc8', s: '#b9a88e', t: '#9a5a2a', d: '#d6c8ae', e: '#a8977a' });

const POT = { r: '#d07a4f', p: '#b8643f', q: '#8a4a2f' };

const plant = sprite([
  '.....h.....',
  '...h.gh.h..',
  '..gghgg.gg.',
  '.gg.ggdhgg.',
  '.gdgggdggd.',
  '..dg.gdgd..',
  '...ddgdd...',
  '.rrrrrrrrr.',
  '..ppppppq..',
  '..ppppppq..',
  '...pppppq..',
  '...qqqqq...',
], { h: '#8cc276', g: '#5f9a52', d: '#3f6e3a', ...POT });

const wiltedPlant = sprite([
  '...........',
  '...........',
  '....h......',
  '...dd.d....',
  '..d.ddd.d..',
  '.d..dd..d..',
  '.d.ddddd.d.',
  '.rrrrrrrrr.',
  '..ppppppq..',
  '..ppppppq..',
  '...pppppq..',
  '...qqqqq...',
], { h: '#a39a5a', d: '#7d6a3a', ...POT });

const notebook = sprite([
  'pppppppppgppppppppp',
  'plllllllpgplllllllp',
  'pppppppppgpnnnnnntp',
  'plllllllpgplllllllp',
  'kkkkkkkkkkkkkkkkkkk',
], { p: '#efe6d2', l: '#c4b79c', g: '#a8997c', n: '#e0b84a', t: '#3a2a1e', k: '#3f5a6b' });

const books = sprite([
  '.aaaaaaaaa..',
  '.aAaaaaAaa..',
  '.aaaaaaaaa..',
  'bbbbbbbbbbb.',
  'bBbbbbbbBbb.',
  'bbbbbbbbbbb.',
  '.cccccccccc.',
  '.cCccccccCc.',
  '.cccccccccc.',
], { a: '#7a2e2e', A: '#c9a35a', b: '#2e4a6b', B: '#c9a35a', c: '#3f5a36', C: '#c9a35a' });

const globe = sprite([
  '....oooo....',
  '..oolllooo..',
  '.ohllllooll.',
  '.oollooolll.',
  '.ooooooolll.',
  '.olloooooll.',
  '..ollloooo..',
  '...oooooo...',
  '.m..oooo..m.',
  '..mm....mm..',
  '....mmmm....',
  '.....ss.....',
  '.....ss.....',
  '...ssssss...',
], { o: '#3f6f8f', l: '#6a9a5a', h: '#8fb7d0', m: '#c48a3c', s: '#5a3a22' });

const apple = sprite([
  '...sg..',
  '.rr.rr.',
  'rRrrrrr',
  'rRrrrrd',
  'rrrrrrd',
  'rrrrrdd',
  '.rrrdd.',
  '..ddd..',
], { r: '#c0392b', R: '#e8705e', d: '#8e2a20', s: '#5a3a22', g: '#5f9a52' });

const pencils = sprite([
  '.t......',
  '.w...t..',
  '.y.t.w..',
  '.y.w.b.e',
  '.y.r.b.y',
  'cccccccc',
  'cCcccccc',
  'cCcccccc',
  'cCcccccc',
  'cCcccccc',
  'cCcccccc',
  'cccccccc',
  '.cccccc.',
], { t: '#3a2a1e', w: '#e8c99a', y: '#e0b84a', r: '#c0392b', b: '#3c6fb0', e: '#e89a9a', c: '#3f5a6b', C: '#5a7d92' });

const jars = sprite([
  'lllll.............',
  'jhjjj....lll......',
  'jhbbj....jhj...g.g',
  'jbbbj....jtj....g.',
  'jbbbj....jtj...ggg',
  'jbbbj....jjj...ppp',
  'jjjjj..........ppp',
], { l: '#c48a3c', j: '#7f9c98', h: '#b9d0cc', b: '#4a2c1a', t: '#9a8040', g: '#6aa35a', p: '#b8643f' });

const cat = sprite([
  '..o..o.........',
  '..oooo.........',
  '.okokooooooo...',
  '.owpwoooodooo..',
  '..wwoooooodoooo',
  '..woooooooooooo',
  '..OOOOOOOOOOoo.',
], { o: '#d98a3a', O: '#f0b060', d: '#a8642a', w: '#f2e8dc', k: '#3a2a1e', p: '#e8a0a0' });

const candle = sprite([
  '..k..',
  '.www.',
  '.wws.',
  '.wws.',
  '.wws.',
  '.wws.',
  'hhhhh',
  '.hhh.',
], { k: '#3a2a1e', w: '#efe6d2', s: '#c9bda4', h: '#b88a3c' });

const cactus = sprite([
  '...f...',
  '..gGg..',
  'g.gGg..',
  'gggGg.g',
  '.ggGgGg',
  '..gGgg.',
  '..dGd..',
  'rrrrrrr',
  '.ppppq.',
  '.ppppq.',
  '..qqq..',
], { f: '#e89a9a', g: '#4f8a46', G: '#6aa35a', d: '#3a6634', ...POT });

const laptop = sprite([
  '.bbbbbbbbbbbbbb.',
  '.bssssssssssssb.',
  '.bsllllllsssssb.',
  '.bsssllllsssssb.',
  '.bsllllllllsssb.',
  '.bssssssssssssb.',
  '.bbbbbbbbbbbbbb.',
  'kkkkkkkkkkkkkkkk',
  'kmmmmmmmmmmmmmmk',
  '.kkkkkkkkkkkkkk.',
], { b: '#3a3d44', s: '#1e2a3a', l: '#6fa7dc', k: '#9a9fa8', m: '#5a5e66' });

const fishbowl = sprite([
  '..rrrrrrrr..',
  '.g........g.',
  'gWWWWWWWWWWg',
  'gwwwwwwwwwwg',
  'gwwwwwwwwwwg',
  'gwwwwwwwpwwg',
  'gwpwwwwwpwwg',
  'gwpwwwwwpwwg',
  '.gssssssssg.',
  '..gggggggg..',
], { r: '#cfe3ee', g: '#a9c7d6', W: '#8fc3de', w: '#5f9fc4', p: '#4f8a46', s: '#d9c38a' });

const hourglass = sprite([
  'fffffff',
  '.f...f.',
  '.gsssg.',
  '..gsg..',
  '...s...',
  '..gsg..',
  '.gsssg.',
  '.f...f.',
  'fffffff',
], { f: '#5a3a22', g: '#cfe3ee', s: '#e0c27a' });

const trophy = sprite([
  'gggggggg',
  'gGggggdg',
  '.gGgggd.',
  '..gGgd..',
  '...gd...',
  '...gd...',
  '..gggd..',
  '.bbbbbb.',
  '.bbbbbb.',
], { g: '#e0b84a', G: '#f6d77a', d: '#a8842a', b: '#5a3a22' });

// Chalkboard menu, drawn with rectangles instead of a character grid.
const menu = {
  w: 20,
  h: 28,
  draw(p, x, y) {
    p.rect(x, y, 20, 28, '#3a2618');
    p.rect(x + 1, y + 1, 18, 26, '#24312b');
    p.rect(x + 1, y + 1, 18, 1, '#2f3f37');
    for (let i = 0; i < 12; i += 2) p.rect(x + 4 + i, y + 4 + (i % 4 ? 1 : 0), 2, 1, '#e2a65b');
    const lines = [9, 6, 8, 5, 7];
    lines.forEach((len, i) => {
      p.rect(x + 3, y + 9 + i * 3, len, 1, '#c9cfc7');
      p.rect(x + 14, y + 9 + i * 3, 2, 1, '#8f9a92');
    });
    p.rect(x + 7, y + 24, 5, 1, '#c9cfc7'); // a tiny cup doodle
    p.rect(x + 7, y + 22, 1, 2, '#c9cfc7');
    p.rect(x + 11, y + 22, 1, 2, '#c9cfc7');
    p.rect(x + 12, y + 22, 1, 1, '#c9cfc7');
  },
};

const painting = {
  w: 18,
  h: 15,
  draw(p, x, y) {
    p.rect(x, y, 18, 15, '#c9a35a');
    p.rect(x + 1, y + 1, 16, 13, '#8a6a2a');
    p.rect(x + 2, y + 2, 14, 11, '#7cb0e0');
    p.rect(x + 2, y + 2, 14, 3, '#5f98d4');
    p.disc(x + 12, y + 5, 2, '#ffd27a');
    p.rect(x + 4, y + 8, 6, 1, '#5f9a52');
    p.rect(x + 2, y + 9, 14, 4, '#5f9a52');
    p.rect(x + 10, y + 10, 6, 3, '#3f6e3a');
  },
};

const pennant = {
  w: 20,
  h: 10,
  draw(p, x, y) {
    p.rect(x, y, 1, 10, '#5a3a22');
    for (let r = 0; r < 8; r++) {
      const w = Math.round(19 * (1 - Math.abs(r - 3.5) / 4));
      p.rect(x + 1, y + 1 + r, w, 1, '#b5483d');
    }
    p.rect(x + 3, y + 4, 2, 2, '#eadcc4');
    p.rect(x + 6, y + 4, 2, 2, '#eadcc4');
    p.rect(x + 9, y + 4, 2, 2, '#eadcc4');
  },
};

// Animation: a flickering candle flame.
const flame = (p, x, y, t) => {
  const tall = Math.sin(t * 9) + Math.sin(t * 23) > 0.6;
  p.alpha(0.12, () => p.disc(x + 2, y - 3, 5, '#ffcf7a'));
  p.rect(x + 2, y - (tall ? 4 : 3), 1, tall ? 3 : 2, '#ffd27a');
  p.px(x + 2, y - 1, '#fff1c4');
};

// Animation: a goldfish swimming back and forth.
const fish = (p, x, y, t) => {
  const k = (Math.sin(t * 0.7) + 1) / 2;
  const right = Math.cos(t * 0.7) > 0;
  const fx = x + 3 + Math.round(k * 5);
  p.rect(fx, y + 4, 2, 1, '#f08a3a');
  p.px(right ? fx - 1 : fx + 2, y + 4, '#c0602a');
};

export const ITEMS = {
  mug: { name: 'Mug', price: 0, fits: ['desk'], ...mug, animate: steam(3, -1) },
  tea: { name: 'Tea', price: 0, fits: ['desk'], ...tea, animate: steam(4, -1) },
  plant: { name: 'Plant', price: 0, fits: ['desk', 'shelf'], ...plant, wilted: wiltedPlant },
  notebook: { name: 'Notebook', price: 0, fits: ['desk'], ...notebook },
  books: { name: 'Books', price: 0, fits: ['desk', 'shelf'], ...books },
  apple: { name: 'Apple', price: 0, fits: ['desk'], ...apple },
  pencils: { name: 'Pencils', price: 0, fits: ['desk'], ...pencils },
  globe: { name: 'Globe', price: 0, fits: ['shelf'], ...globe },
  jars: { name: 'Jars', price: 0, fits: ['shelf'], ...jars },
  menu: { name: 'Menu', price: 0, fits: ['wall'], ...menu },
  candle: { name: 'Candle', price: 40, fits: ['desk', 'shelf'], ...candle, animate: flame },
  pennant: { name: 'Pennant', price: 40, fits: ['wall'], ...pennant },
  cactus: { name: 'Cactus', price: 50, fits: ['desk', 'shelf'], ...cactus },
  hourglass: { name: 'Hourglass', price: 60, fits: ['desk', 'shelf'], ...hourglass },
  painting: { name: 'Painting', price: 80, fits: ['wall'], ...painting },
  laptop: { name: 'Laptop', price: 90, fits: ['desk'], ...laptop },
  trophy: { name: 'Trophy', price: 100, fits: ['desk', 'shelf'], ...trophy },
  cat: { name: 'Cat', price: 120, fits: ['desk'], ...cat },
  fishbowl: { name: 'Fishbowl', price: 150, fits: ['desk', 'shelf'], ...fishbowl, animate: fish },
};
