// Decorations that sit in a scene's slots (wall, shelf, desk).
// Phase 4 adds prices and the shop; for now each scene shows its default set.

import { sprite } from './pixel.js';

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
], { h: '#8cc276', g: '#5f9a52', d: '#3f6e3a', r: '#d07a4f', p: '#b8643f', q: '#8a4a2f' });

const notebook = sprite([
  'pppppppppgppppppppp',
  'plllllllpgplllllllp',
  'pppppppppgpnnnnnntp',
  'plllllllpgplllllllp',
  'kkkkkkkkkkkkkkkkkkk',
], { p: '#efe6d2', l: '#c4b79c', g: '#a8997c', n: '#e0b84a', t: '#3a2a1e', k: '#3f5a6b' });

const jars = sprite([
  'lllll.............',
  'jhjjj....lll......',
  'jhbbj....jhj...g.g',
  'jbbbj....jtj....g.',
  'jbbbj....jtj...ggg',
  'jbbbj....jjj...ppp',
  'jjjjj..........ppp',
], { l: '#c48a3c', j: '#7f9c98', h: '#b9d0cc', b: '#4a2c1a', t: '#9a8040', g: '#6aa35a', p: '#b8643f' });

const tea = sprite([
  '..rrrrrr...',
  '..wttttwss.',
  '..wwwwww.s.',
  '..swwwwss..',
  'ddddddddddd',
  '.eeeeeeeee.',
], { r: '#fff4e0', w: '#e8dcc8', s: '#b9a88e', t: '#9a5a2a', d: '#d6c8ae', e: '#a8977a' });

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

// fits lists the kinds of slot an item can go in.
export const ITEMS = {
  mug: { fits: ['desk'], ...mug, steam: [3, -1] },
  tea: { fits: ['desk'], ...tea, steam: [4, -1] },
  plant: { fits: ['desk', 'shelf'], ...plant },
  notebook: { fits: ['desk'], ...notebook },
  books: { fits: ['desk', 'shelf'], ...books },
  apple: { fits: ['desk'], ...apple },
  pencils: { fits: ['desk'], ...pencils },
  globe: { fits: ['shelf'], ...globe },
  jars: { fits: ['shelf'], ...jars },
  menu: { fits: ['wall'], ...menu },
};
