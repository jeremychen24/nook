// Puts the pixel scene behind the timer and runs its animation.

import { Painter, loop } from '../pixel.js';
import { createCafe } from './cafe.js';
import { createLibrary } from './library.js';
import { createClassroom } from './classroom.js';

export const SCENES = {
  cafe: { name: 'Café', create: createCafe },
  library: { name: 'Library', create: createLibrary },
  classroom: { name: 'Classroom', create: createClassroom },
};
const TIMES = ['dawn', 'day', 'sunset', 'dusk', 'night'];

// ?tod=night, ?rain=1 and ?scene=library preview other looks (dev/phone.html uses these).
const params = new URLSearchParams(location.search);
const forcedTod = TIMES.includes(params.get('tod')) ? params.get('tod') : null;
const forcedScene = SCENES[params.get('scene')] ? params.get('scene') : null;

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

// info() supplies live numbers some scenes show, e.g. the classroom's chalkboard.
export function mountScene(container, id, info = () => ({})) {
  anim?.stop();
  scene = SCENES[forcedScene ?? id]?.create() ?? createCafe();
  const canvas = document.createElement('canvas');
  canvas.width = scene.W;
  canvas.height = scene.H;
  container.replaceChildren(canvas);
  painter = new Painter(canvas);
  const fps = matchMedia('(prefers-reduced-motion: reduce)').matches ? 1 : 10;
  anim = loop(t => scene.render(painter, { t, tod: forcedTod ?? timeOfDay(), rain, decor: {}, info: info() }), fps);
  anim.start();
}

export const pauseScene = () => anim?.stop();
export const resumeScene = () => anim?.start();

// Rain follows the rain sound once sounds exist (phase 5).
export function setRain(on) {
  rain = on;
}
