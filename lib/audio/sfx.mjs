// Interface sounds, synthesized: each one belongs to something visible on screen.
import path from 'node:path';
import { SR, rng, noise, bandpass, writeWav } from './synth.mjs';

const len = (s) => Math.floor(s * SR);

const SOUNDS = {
  /** A finger tap or click on a button. */
  tap(r) {
    const n = len(0.09), x = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      x[i] = 0.5 * (Math.sin(2 * Math.PI * 1900 * t) * Math.exp(-t * 90) + 0.5 * Math.sin(2 * Math.PI * 620 * t) * Math.exp(-t * 60));
    }
    return x;
  },
  /** One key of typing; place several a few frames apart. */
  key(r) {
    const n = len(0.03), x = bandpass(noise(n, r), 1800, 5200);
    for (let i = 0; i < n; i++) x[i] *= 0.35 * Math.exp((-i / SR) * 170);
    return x;
  },
  /** A badge, chip or number landing. */
  pop(r) {
    const n = len(0.16), x = new Float64Array(n);
    let ph = 0;
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      ph += (2 * Math.PI * (520 + (700 * t) / 0.16)) / SR;
      x[i] = 0.3 * Math.sin(ph) * Math.exp(-t * 26);
    }
    return x;
  },
  /** A scene cut or a large card moving fast. */
  whoosh(r) {
    const n = len(0.5), nz = noise(n, r);
    const lo = bandpass(nz, 400, 1500), hi = bandpass(nz, 1500, 5000), x = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const p = i / n;
      x[i] = 0.3 * (lo[i] * Math.sin(Math.PI * p) ** 2 + 0.6 * hi[i] * Math.sin(Math.PI * p ** 0.7) ** 3);
    }
    return x;
  },
  /** A soft two-note confirmation: an order placed, a payment done. */
  success(r) {
    const n = len(0.7), x = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      const a = Math.sin(2 * Math.PI * 784 * t) * Math.exp(-t * 7);
      const b = t > 0.12 ? Math.sin(2 * Math.PI * 1175 * (t - 0.12)) * Math.exp(-(t - 0.12) * 6) : 0;
      x[i] = 0.22 * (a + b) * Math.min(1, t / 0.004);
    }
    return x;
  },
};

export const SOUND_NAMES = Object.keys(SOUNDS);

/** Writes <dir>/<name>.wav for every built-in sound; returns the folder. */
export function makeSfx(dir) {
  SOUND_NAMES.forEach((name, k) => {
    const x = SOUNDS[name](rng(11 + k));
    writeWav(path.join(dir, `${name}.wav`), [x]);
  });
  return dir;
}
