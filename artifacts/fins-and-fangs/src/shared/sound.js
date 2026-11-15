// Tiny synthesised sound effects (no audio files). Muted state is per browser.
let ctx = null;
let muted = false;
try { muted = localStorage.getItem('games:mute') === '1'; } catch { /* optional */ }

// Browsers only allow sound after the first tap or key press.
function unlock() {
  try {
    if (!ctx) { const AC = globalThis.AudioContext || globalThis.webkitAudioContext; if (AC) ctx = new AC(); }
    if (ctx?.state === 'suspended') ctx.resume();
  } catch { /* no sound here */ }
}
if (typeof addEventListener === 'function') {
  addEventListener('pointerdown', unlock, { passive: true });
  addEventListener('keydown', unlock, { passive: true });
}

// [frequency Hz, start s, length s]
const TUNES = {
  move: [[520, 0, 0.07]],
  turn: [[660, 0, 0.09], [880, 0.1, 0.14]],
  win: [[523, 0, 0.1], [659, 0.1, 0.1], [784, 0.2, 0.1], [1047, 0.3, 0.25]],
  lose: [[392, 0, 0.14], [330, 0.15, 0.14], [262, 0.3, 0.3]],
  draw: [[440, 0, 0.12], [440, 0.16, 0.2]],
  react: [[990, 0, 0.06], [1320, 0.07, 0.1]],
};

export function play(name) {
  if (muted || !ctx || ctx.state !== 'running' || !TUNES[name]) return;
  try {
    const t0 = ctx.currentTime + 0.01;
    for (const [freq, at, len] of TUNES[name]) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t0 + at);
      gain.gain.exponentialRampToValueAtTime(0.09, t0 + at + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + at + len);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0 + at);
      osc.stop(t0 + at + len + 0.03);
    }
  } catch { /* no sound here */ }
}

export const isMuted = () => muted;
export function setMuted(m) {
  muted = Boolean(m);
  try { localStorage.setItem('games:mute', muted ? '1' : '0'); } catch { /* optional */ }
  if (!muted) { unlock(); play('move'); }
}
