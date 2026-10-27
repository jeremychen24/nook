// Puts the pixel scene behind the timer and runs its animation.

import { Painter, loop } from '../pixel.js';
import { createCafe } from './cafe.js';

const SCENES = { cafe: createCafe };
const TIMES = ['dawn', 'day', 'sunset', 'dusk', 'night'];

// ?tod=night and ?rain=1 preview other skies (dev/phone.html uses these).
const params = new URLSearchParams(location.search);
const forcedTod = TIMES.includes(params.get('tod')) ? params.get('tod') : null;

let scene = null;
let painter = null;
let anim = null;
let rain = params.get('rain') === '1';

export function timeOfDay(date = new Date()) {
  const h = date.getHours() + date.getMinutes() / 60;
  if (h >= 5 && h < 7) return 'dawn';
  if (h >= 7 && h < 17.5) return 'day';
  if (h >= 17.5 && h < 19) return 'sunset';
  if (h >= 19 && h < 20.5) return 'dusk';
  return 'night';
}

export function mountScene(container, id = 'cafe') {
  anim?.stop();
  scene = SCENES[id]();
  const canvas = document.createElement('canvas');
  canvas.width = scene.W;
  canvas.height = scene.H;
  container.replaceChildren(canvas);
  painter = new Painter(canvas);
  const fps = matchMedia('(prefers-reduced-motion: reduce)').matches ? 1 : 10;
  anim = loop(t => scene.render(painter, { t, tod: forcedTod ?? timeOfDay(), rain, decor: {} }), fps);
  anim.start();
}

export const pauseScene = () => anim?.stop();
export const resumeScene = () => anim?.start();

// Rain follows the rain sound once sounds exist (phase 5).
export function setRain(on) {
  rain = on;
}
