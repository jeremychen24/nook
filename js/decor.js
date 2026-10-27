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

export const ITEMS = {
  mug: { slot: 'desk', ...mug, steam: [3, -1] },
  plant: { slot: 'desk', ...plant },
  notebook: { slot: 'desk', ...notebook },
  jars: { slot: 'shelf', ...jars },
  menu: { slot: 'wall', ...menu },
};
