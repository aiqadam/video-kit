// How loud the music is on every frame, so scenes can move with it. The bed is decoded
// once with ffmpeg and measured per frame in a few bands; the numbers go to
// assets/kit/audio.js, which index.html loads before the runtime. Scenes read them through
// kit.audio(t, band) / s.audio(t, band): the same frame always gets the same value.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ffmpegPath } from '../tools.mjs';

const RATE = 22050;

// Each band: an ffmpeg filter before measuring, and how slowly the value falls after a peak.
const BANDS = {
  level: { filter: null, release: 0.18 },
  low: { filter: 'lowpass=f=140,lowpass=f=140', release: 0.14 },
  high: { filter: 'highpass=f=5000,highpass=f=5000', release: 0.08 },
};

/** Range of loudness mapped to 0..1, in dB below the band's loud end (its 97th percentile). */
const RANGE_DB = 30;

function decode(file, start, seconds, filter) {
  const args = ['-v', 'error', '-ss', String(start || 0), '-t', String(seconds), '-i', file, '-ac', '1', '-ar', String(RATE)];
  if (filter) args.push('-af', filter);
  args.push('-f', 'f32le', '-');
  const r = spawnSync(ffmpegPath(), args, { maxBuffer: 1 << 30 });
  if (r.status !== 0) throw new Error(`could not read the music for its envelope: ${String(r.stderr || '').slice(0, 200)}`);
  const b = r.stdout;
  return new Float32Array(b.buffer, b.byteOffset, Math.floor(b.length / 4));
}

/** RMS in dB for each frame, over a window as long as the frame and centred on its time. */
function framesDb(samples, fps, frames) {
  const hop = RATE / fps, out = new Float64Array(frames);
  for (let f = 0; f < frames; f++) {
    const a = Math.max(0, Math.floor(f * hop - hop / 2)), b = Math.min(samples.length, Math.floor(f * hop + hop / 2));
    let sum = 0;
    for (let i = a; i < b; i++) sum += samples[i] * samples[i];
    out[f] = 10 * Math.log10(sum / Math.max(1, b - a) + 1e-12);
  }
  return out;
}

function percentile(arr, p) {
  const s = Array.from(arr).sort((x, y) => x - y);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))];
}

/** dB to 0..1 against the band's loud end; instant rise, falling over `release` seconds. */
function shape(db, fps, release) {
  const top = percentile(db, 0.97), fall = Math.exp(-1 / (fps * release));
  const out = new Float64Array(db.length);
  let v = 0;
  for (let i = 0; i < db.length; i++) {
    const x = Math.min(1, Math.max(0, (db[i] - (top - RANGE_DB)) / RANGE_DB));
    v = x > v ? x : v * fall + x * (1 - fall);
    out[i] = v;
  }
  return out;
}

/** Onsets in the low band (kicks, hits): how far a frame jumps above the frames just before it. */
function hits(lowDb, fps) {
  const n = lowDb.length, back = Math.max(2, Math.round(fps * 0.2)), raw = new Float64Array(n);
  for (let i = 1; i < n; i++) {
    let sum = 0, k = 0;
    for (let j = Math.max(0, i - back); j < i; j++, k++) sum += lowDb[j];
    raw[i] = Math.max(0, lowDb[i] - sum / Math.max(1, k));
  }
  const top = percentile(raw, 0.98) || 1, fall = Math.exp(-1 / (fps * 0.15));
  const out = new Float64Array(n);
  let v = 0;
  for (let i = 0; i < n; i++) {
    const x = Math.min(1, raw[i] / top);
    v = x > v ? x : v * fall;
    out[i] = v;
  }
  return out;
}

const pack = (arr) => Array.from(arr, (x) => Math.round(x * 255)).join(',');

/**
 * Writes assets/kit/audio.js for the music file `src` (relative to the video) as heard
 * from music.start for the video's length. Made again only when any of those change.
 */
export function makeEnvelope(v, src, start) {
  const file = path.join(v.dir, src);
  const out = path.join(v.dir, 'assets', 'kit', 'audio.js');
  const st = fs.statSync(file);
  const stamp = `/* ${JSON.stringify({ src, size: st.size, mtime: Math.round(st.mtimeMs), start: start || 0, total: v.total, fps: v.fps, v: 1 })} */`;
  if (fs.existsSync(out) && fs.readFileSync(out, 'utf8').startsWith(stamp)) return out;

  const frames = Math.ceil(v.total * v.fps) + 1;
  const data = { fps: v.fps, frames };
  let lowDb;
  for (const [name, b] of Object.entries(BANDS)) {
    const db = framesDb(decode(file, start, v.total + 1, b.filter), v.fps, frames);
    if (name === 'low') lowDb = db;
    data[name] = pack(shape(db, v.fps, b.release));
  }
  data.hit = pack(hits(lowDb, v.fps));
  fs.writeFileSync(out, `${stamp}\nwindow.KIT_AUDIO = ${JSON.stringify(data)};\n`);
  return out;
}

export const AUDIO_BANDS = [...Object.keys(BANDS), 'hit'];
