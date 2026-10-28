// A generated music bed: slow chords, a soft bass drone, a quiet pulse and air. Its only
// job is to carry the pace and stay out of the voice's way; a real track is better
// whenever there is one (video.json "music": {"source": "file"}).
import { SR, rng, noise, biquad, writeWav, peak } from './synth.mjs';

// Chords as [root, [notes]] in Hz, 6 s each, looping.
const STYLES = {
  // A minor, F, C, G: neutral and calm.
  calm: {
    bar: 6,
    chords: [
      [110.0, [220.0, 261.63, 329.63]],
      [87.31, [174.61, 261.63, 349.23]],
      [130.81, [196.0, 261.63, 329.63]],
      [98.0, [196.0, 246.94, 392.0]],
    ],
    step: 0.75,
  },
  // D Hijaz (D Eb F# G A Bb C): warm, Central Asian and Middle Eastern colour.
  hijaz: {
    bar: 6,
    chords: [
      [73.42, [146.83, 185.0, 220.0]],
      [98.0, [196.0, 233.08, 293.66]],
      [65.41, [130.81, 155.56, 196.0]],
      [73.42, [146.83, 185.0, 220.0]],
    ],
    scale: [293.66, 311.13, 369.99, 392.0, 440.0, 466.16, 523.25],
    step: 0.6,
  },
};

function envAR(len, attack, release) {
  const e = new Float64Array(len).fill(1);
  const a = Math.min(Math.floor(attack * SR), len >> 1);
  const r = Math.min(Math.floor(release * SR), len >> 1);
  for (let i = 0; i < a; i++) e[i] = Math.pow(i / a, 1.6);
  for (let i = 0; i < r; i++) e[len - r + i] = Math.pow(1 - i / r, 1.4);
  return e;
}

function addSine(mix, s0, s1, env, amp, f, phase) {
  const w = 2 * Math.PI * f;
  for (let i = s0; i < s1; i++) {
    const t = (i - s0) / SR;
    mix[i] += amp * env[i - s0] * Math.sin(w * t + phase);
  }
}

function delayFb(sig, ms, fb, wet) {
  const d = Math.floor((SR * ms) / 1000);
  const buf = Float64Array.from(sig);
  for (let pass = 0; pass < 4; pass++) {
    const prev = Float64Array.from(buf);
    for (let i = d; i < buf.length; i++) buf[i] += fb * prev[i - d];
  }
  const out = new Float64Array(sig.length);
  for (let i = 0; i < sig.length; i++) out[i] = sig[i] * (1 - wet) + buf[i] * wet;
  return out;
}

/** Writes a stereo WAV of `seconds` length. */
export function makeMusic(file, seconds, style = 'calm', seed = 7) {
  const S = STYLES[style] || STYLES.calm;
  const N = Math.floor(SR * seconds);
  const mix = new Float64Array(N);
  const bars = Math.ceil(seconds / S.bar);

  // pad: chords, three slightly detuned voices per note
  for (let b = 0; b < bars; b++) {
    const [, notes] = S.chords[b % S.chords.length];
    const s0 = Math.floor(b * S.bar * SR), s1 = Math.min(Math.floor((b * S.bar + S.bar + 1.2) * SR), N);
    if (s0 >= N) break;
    const env = envAR(s1 - s0, 1.6, 2.2);
    notes.forEach((f, k) => {
      for (const det of [-0.6, 0, 0.7]) {
        const amp = 0.085 / (1 + 0.35 * k), ph = 0.7 * k + 0.31 * det;
        addSine(mix, s0, s1, env, amp, f + det, ph);
        addSine(mix, s0, s1, env, 0.22 * amp, (f + det) * 2, ph);
      }
    });
  }

  // bass drone on the chord root
  for (let b = 0; b < bars; b++) {
    const [root] = S.chords[b % S.chords.length];
    const s0 = Math.floor(b * S.bar * SR), s1 = Math.min(Math.floor((b * S.bar + S.bar + 0.8) * SR), N);
    if (s0 >= N) break;
    const env = envAR(s1 - s0, 0.9, 1.6);
    addSine(mix, s0, s1, env, 0.22, root, 0);
    addSine(mix, s0, s1, env, 0.06, root * 2, 0.4);
  }

  // pulse: short pings over the chord (or the scale), swelling to 40% and easing off at 80%
  for (let i = 0; ; i++) {
    const tt = i * S.step;
    if (tt >= seconds - 0.5) break;
    const b = Math.floor(tt / S.bar);
    const notes = S.scale || S.chords[b % S.chords.length][1];
    const f = S.scale ? notes[(i * 3 + b) % notes.length] : notes[i % notes.length] * (i % 4 === 1 ? 2 : 1);
    const s0 = Math.floor(tt * SR), s1 = Math.min(s0 + Math.floor(0.5 * SR), N);
    const swell = Math.min(tt / (0.4 * seconds), 1) * (tt < 0.8 * seconds ? 1 : Math.max(0, 1 - (tt - 0.8 * seconds) / (0.12 * seconds)));
    for (let j = s0; j < s1; j++) {
      const t = (j - s0) / SR;
      mix[j] += 0.05 * swell * Math.exp(-t * 7.5) * Math.sin(2 * Math.PI * f * t);
    }
  }

  // air: very quiet low-passed noise
  const air = biquad(noise(N, rng(seed)), 'lowpass', 1200);
  for (let i = 0; i < N; i++) mix[i] += 0.012 * air[i];

  let out = delayFb(mix, 220, 0.34, 0.3);
  out = delayFb(out, 470, 0.22, 0.18);

  // master: rise to the middle, fade in and out
  const fi = Math.floor(3 * SR), fo = Math.floor(Math.min(5, seconds / 4) * SR);
  for (let i = 0; i < N; i++) {
    const t = i / SR;
    let g = 0.72 + 0.28 * Math.min(1, t / (0.4 * seconds));
    if (i < fi) g *= Math.pow(i / fi, 1.5);
    if (i > N - fo) g *= Math.pow((N - i) / fo, 1.2);
    out[i] *= g;
  }

  const p = peak(out) || 1;
  const d = Math.floor(0.011 * SR);
  const L = new Float64Array(N), R = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    L[i] = (out[i] / p) * 0.72;
    R[i] = ((i >= d ? out[i - d] : 0) * 0.94 + out[i] * 0.06) / p * 0.72;
  }
  writeWav(file, [L, R]);
}

export const MUSIC_STYLES = Object.keys(STYLES);
