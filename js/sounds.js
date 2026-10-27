// Sounds made with Web Audio, so there are no audio files to load.
// iOS only allows audio after a tap, so unlock() runs from the Start button.

let ctx = null;

export function unlock() {
  ctx ??= new (window.AudioContext || window.webkitAudioContext)();
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
