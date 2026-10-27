// Puts the pixel scene behind the timer and runs its animation.

import { Painter, loop, makeCanvas } from '../pixel.js';
import * as cafe from './cafe.js';
import * as library from './library.js';
import * as classroom from './classroom.js';

// price is in coins; slots and defaults say where decorations go and what's there to start.
export const SCENES = {
  cafe: { name: 'Café', price: 0, slots: cafe.SLOTS, defaults: cafe.DEFAULTS, create: cafe.createCafe },
  library: { name: 'Library', price: 200, slots: library.SLOTS, defaults: library.DEFAULTS, create: library.createLibrary },
  classroom: { name: 'Classroom', price: 200, slots: classroom.SLOTS, defaults: classroom.DEFAULTS, create: classroom.createClassroom },
};
const TIMES = ['dawn', 'day', 'sunset', 'dusk', 'night'];

// ?tod=night, ?rain=1 and ?scene=library preview other looks (dev/phone.html uses these).
const params = new URLSearchParams(globalThis.location?.search ?? '');
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

// getEnv(sceneId) supplies what the scene shows from app state: { decor, wilted, info }.
export function mountScene(container, id, getEnv = () => ({})) {
  anim?.stop();
  const shown = SCENES[forcedScene ?? id] ? forcedScene ?? id : 'cafe';
  scene = SCENES[shown].create();
  const canvas = document.createElement('canvas');
  canvas.width = scene.W;
  canvas.height = scene.H;
  container.replaceChildren(canvas);
  painter = new Painter(canvas);
  const fps = matchMedia('(prefers-reduced-motion: reduce)').matches ? 1 : 10;
  anim = loop(t => scene.render(painter, { t, tod: forcedTod ?? timeOfDay(), rain, ...getEnv(shown) }), fps);
  anim.start();
}

export const pauseScene = () => anim?.stop();
export const resumeScene = () => anim?.start();

// A still picture of a scene with its default decorations, as an image URL (for the shop).
export function sceneThumbnail(id) {
  const s = SCENES[id].create();
  const canvas = makeCanvas(s.W, s.H);
  s.render(new Painter(canvas), { t: 0, tod: forcedTod ?? timeOfDay(), rain: false, decor: {}, wilted: false });
  return canvas.toDataURL();
}

// Rain follows the rain sound once sounds exist (phase 5).
export function setRain(on) {
  rain = on;
}
