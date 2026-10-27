// Sounds made with Web Audio, so there are no audio files to load.
// iOS only allows audio after a tap, so unlock() runs from taps. The silent switch mutes it.

let ctx = null;
let master = null; // ambient volume
let ambient = null; // { id, stop }
let volume = 0.6;

export function unlock() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = volume;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
}

// Two soft rising notes for the end of a phase. iOS has no vibration API, so this is the only alert.
export function chime() {
  if (!ctx) return;
  const t0 = ctx.currentTime;
  [659.25, 880].forEach((freq, i) => {
    const at = t0 + i * 0.18;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(0.25, at + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 1.2);
    osc.connect(gain).connect(ctx.destination);
    osc.start(at);
    osc.stop(at + 1.3);
  });
}

export function setVolume(v) {
  volume = v;
  if (master) master.gain.setTargetAtTime(v, ctx.currentTime, 0.05);
}

// Switches the background sound: 'off', 'rain', 'brown' or 'fire'. Needs unlock() first.
export function playAmbient(id) {
  if ((ambient?.id ?? 'off') === id || !ctx) return;
  ambient?.stop();
  ambient = AMBIENTS[id] ? { id, stop: AMBIENTS[id](ctx, master) } : null;
}

// Each builder starts a sound into `out` and returns a function that fades it out and stops it.
export const AMBIENTS = {
  rain(c, out) {
    const live = [];
    const mix = fadeIn(c, out);
    const bed = gain(c, 0.32);
    noise(c, live).connect(filter(c, 'highpass', 600)).connect(filter(c, 'lowpass', 6000)).connect(bed).connect(mix);
    noise(c, live).connect(filter(c, 'lowpass', 250)).connect(gain(c, 1.1)).connect(mix);
    wobble(c, bed.gain, 0.08, 0.09, live); // slow gusts
    const drops = sprinkle(c, mix, {
      rate: 18,
      length: () => 0.015 + Math.random() * 0.02,
      amp: () => 0.04 + Math.random() * 0.12,
      shape: () => filter(c, 'bandpass', 2500 + Math.random() * 4000, 3),
    });
    return stopper(c, mix, live, drops);
  },

  brown(c, out) {
    const live = [];
    const mix = fadeIn(c, out);
    // Gains across the three sounds are matched to about the same loudness (measured offline at 48 kHz).
    noise(c, live).connect(filter(c, 'lowpass', 220, 0.5)).connect(filter(c, 'lowpass', 600)).connect(gain(c, 2.3)).connect(mix);
    return stopper(c, mix, live);
  },

  fire(c, out) {
    const live = [];
    const mix = fadeIn(c, out);
    const roar = gain(c, 1.4);
    noise(c, live).connect(filter(c, 'lowpass', 500)).connect(roar).connect(mix);
    wobble(c, roar.gain, 0.6, 0.35, live); // flicker
    const crackles = sprinkle(c, mix, {
      rate: 9,
      length: () => 0.004 + Math.random() * 0.01,
      amp: () => 0.12 + Math.random() * 0.35,
      shape: () => filter(c, 'highpass', 1800),
    });
    const pops = sprinkle(c, mix, {
      rate: 0.7,
      length: () => 0.03,
      amp: () => 0.35,
      shape: () => filter(c, 'bandpass', 700, 2),
    });
    return stopper(c, mix, live, crackles, pops);
  },
};

// Building blocks

const buffers = new WeakMap(); // three seconds of white noise per audio context

function noiseBuffer(c) {
  if (!buffers.has(c)) {
    const buf = c.createBuffer(1, c.sampleRate * 3, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    buffers.set(c, buf);
  }
  return buffers.get(c);
}

// Looping white noise. Looped white noise has no seam to click on.
function noise(c, live) {
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c);
  src.loop = true;
  src.start(0, Math.random() * 3);
  live.push(src);
  return src;
}

function filter(c, type, freq, q = 0.7) {
  const f = c.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  return f;
}

function gain(c, value) {
  const g = c.createGain();
  g.gain.value = value;
  return g;
}

function fadeIn(c, out) {
  const g = gain(c, 0);
  g.gain.setTargetAtTime(1, c.currentTime, 0.5);
  g.connect(out);
  return g;
}

// Slowly varies a gain by ±depth at `rate` Hz.
function wobble(c, param, rate, depth, live) {
  const lfo = c.createOscillator();
  lfo.frequency.value = rate;
  lfo.connect(gain(c, depth)).connect(param);
  lfo.start();
  live.push(lfo);
}

// Short noise bursts at random moments (rate per second): rain drops, crackles, pops.
// Live contexts schedule a little ahead on a timer; offline ones schedule everything up front.
function sprinkle(c, out, { rate, length, amp, shape }) {
  let next = c.currentTime + Math.random() / rate;
  const fill = until => {
    while (next < until) {
      const len = length();
      const src = c.createBufferSource();
      src.buffer = noiseBuffer(c);
      const env = c.createGain();
      env.gain.setValueAtTime(0, next);
      env.gain.linearRampToValueAtTime(amp(), next + 0.002);
      env.gain.exponentialRampToValueAtTime(0.0001, next + len);
      src.connect(shape()).connect(env).connect(out);
      src.start(next, Math.random() * 2.5, len + 0.02);
      next += -Math.log(1 - Math.random()) / rate;
    }
  };
  if (typeof OfflineAudioContext !== 'undefined' && c instanceof OfflineAudioContext) {
    fill(c.length / c.sampleRate);
    return () => {};
  }
  fill(c.currentTime + 0.25);
  const timer = setInterval(() => fill(c.currentTime + 0.25), 100);
  return () => clearInterval(timer);
}

// Fades a sound out, then stops its sources and timers.
function stopper(c, mix, live, ...stops) {
  return () => {
    stops.forEach(stop => stop());
    mix.gain.setTargetAtTime(0, c.currentTime, 0.25);
    setTimeout(() => {
      live.forEach(node => node.stop());
      mix.disconnect();
    }, 1500);
  };
}
