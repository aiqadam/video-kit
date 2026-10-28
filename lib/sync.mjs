// Builds what HyperFrames renders from video.json: index.html (scene hosts, voice, music,
// sounds), plus the runtime, fonts, sounds and music under assets/kit/. Run before every
// preview, check and render, so video.json stays the only place timing is set.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { KIT_ROOT, round } from './video.mjs';
import { makeMusic, MUSIC_STYLES } from './audio/music.mjs';
import { makeSfx, SOUND_NAMES } from './audio/sfx.mjs';
import { audioSeconds } from './voice.mjs';

const require = createRequire(import.meta.url);

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const posix = (p) => p.split(path.sep).join('/');

function copyRuntime(dir) {
  const kitDir = path.join(dir, 'assets', 'kit');
  fs.mkdirSync(path.join(kitDir, 'fonts'), { recursive: true });
  for (const f of ['kit.js', 'kit.css']) fs.copyFileSync(path.join(KIT_ROOT, 'runtime', f), path.join(kitDir, f));
  const inter = path.join(path.dirname(require.resolve('@fontsource-variable/inter/package.json')), 'files');
  for (const sub of ['cyrillic', 'cyrillic-ext', 'latin', 'latin-ext']) {
    const name = `inter-${sub}-wght-normal.woff2`;
    fs.copyFileSync(path.join(inter, name), path.join(kitDir, 'fonts', name));
  }
  return kitDir;
}

/** The music bed for this video: a file from video.json, or generated to the right length. */
function music(v, kitDir) {
  const m = v.spec.music === undefined ? { source: 'synth' } : v.spec.music;
  if (!m || m.source === 'none') return null;
  if (m.source === 'file') {
    const f = path.join(v.dir, m.file || '');
    if (!m.file || !fs.existsSync(f)) throw new Error(`video.json music.file not found: ${m.file}`);
    return { src: posix(m.file), m };
  }
  const style = MUSIC_STYLES.includes(m.style) ? m.style : 'calm';
  const seconds = round(v.total + 1);
  const file = path.join(kitDir, 'music.wav');
  const stamp = path.join(kitDir, 'music.json');
  const want = JSON.stringify({ style, seconds, seed: m.seed || 7 });
  if (!fs.existsSync(file) || !fs.existsSync(stamp) || fs.readFileSync(stamp, 'utf8') !== want) {
    makeMusic(file, seconds, style, m.seed || 7);
    fs.writeFileSync(stamp, want);
  }
  return { src: 'assets/kit/music.wav', m };
}

/** Volume lane that dips the music while anyone speaks. t is from the music's start. */
function duckLane(lines, duck) {
  const spans = [];
  for (const l of lines) {
    const a = Math.max(0, l.start - 0.25), b = l.end + 0.35;
    const last = spans[spans.length - 1];
    if (last && a - last[1] < 0.8) last[1] = Math.max(last[1], b);
    else spans.push([a, b]);
  }
  const points = [{ t: 0, v: 1 }];
  for (const [a, b] of spans) {
    points.push({ t: round(Math.max(0, a)), v: 1 }, { t: round(a + 0.25), v: duck }, { t: round(b), v: duck }, { t: round(b + 0.6), v: 1 });
  }
  points.sort((p, q) => p.t - q.t);
  return { version: 1, lanes: [{ target: 'volume', points: points.slice(0, 512) }] };
}

const VOICE_FX = {
  version: 1,
  nodes: [
    { type: 'highpass', id: 'hp', label: 'Remove rumble', params: { frequency: 85 } },
    { type: 'peaking', id: 'clarity', label: 'Clarity', params: { frequency: 3000, gain: 2, q: 1 } },
    { type: 'compressor', id: 'comp', label: 'Even level', params: { threshold: -20, ratio: 3, attack: 8, release: 200 } },
  ],
};

const MASTER_FX = {
  version: 1,
  nodes: [{ type: 'limiter', id: 'lim', label: 'No clipping', params: { limit: -1.5 } }],
};

function fontFaces(v) {
  return (v.spec.fonts || [])
    .map(
      (f) =>
        `@font-face { font-family: '${f.family}'; src: url('${posix(f.src)}'); font-weight: ${f.weight || '100 900'}; font-style: ${f.style || 'normal'}; font-display: block;${f.range ? ` unicode-range: ${f.range};` : ''} }`,
    )
    .join('\n      ');
}

function themeVars(v) {
  const theme = { bg: '#101014', ink: '#f4f2ee', muted: 'rgba(244,242,238,0.62)', accent: '#e0a43c', font: "'Kit Inter'", display: "'Kit Inter'", ...(v.spec.theme || {}) };
  const vars = Object.entries(theme).map(([k, val]) => `--${k}: ${val};`);
  vars.push(`--kit-w: ${v.width}px;`, `--kit-h: ${v.height}px;`);
  return vars.join(' ');
}

/** Writes index.html and everything it needs; returns the path of index.html. */
export function sync(v) {
  const kitDir = copyRuntime(v.dir);
  makeSfx(path.join(kitDir, 'sfx'));
  const bed = music(v, kitDir);

  const KIT = {
    lang: v.lang,
    width: v.width,
    height: v.height,
    fps: v.fps,
    total: v.total,
    strings: v.strings,
    scenes: Object.fromEntries(v.scenes.map((s) => [s.id, { start: s.start, dur: s.dur, fadeIn: s.fadeIn }])),
    lines: Object.fromEntries(v.lines.map((l) => [l.id, { start: l.start, end: l.end, sceneStart: l.sceneStart, words: l.words }])),
  };

  const hosts = v.scenes.map(
    (s, i) =>
      `<div id="scene-${s.id}" class="clip" data-composition-id="${s.id}" data-composition-src="${esc(s.src)}" data-start="${s.start}" data-duration="${s.dur}" data-track-index="${i % 2}" style="z-index: ${i + 1}"></div>`,
  );

  const voices = v.lines
    .filter((l) => l.audio)
    .map(
      (l) =>
        `<audio id="vo-${l.id}" class="clip" src="${esc(posix(path.relative(v.dir, l.audio)))}" data-start="${l.start}" data-duration="${round(l.duration + 0.05)}" data-track-index="10" data-volume="1" data-audio-group="voiceover"></audio>`,
    );

  const lengths = {};
  const soundLength = (file) => {
    if (!(file in lengths)) {
      lengths[file] = file.endsWith('.wav') && file.includes(`${path.sep}kit${path.sep}sfx`)
        ? (fs.statSync(file).size - 44) / (2 * 44100)
        : audioSeconds(file);
    }
    return lengths[file];
  };
  const sounds = v.sfx.map((fx, i) => {
    const src = SOUND_NAMES.includes(fx.sound) ? `assets/kit/sfx/${fx.sound}.wav` : posix(fx.sound);
    const file = path.join(v.dir, src);
    if (!fs.existsSync(file)) throw new Error(`Sound "${fx.sound}" in scene "${fx.scene}" is neither built in (${SOUND_NAMES.join(', ')}) nor a file in the video folder.`);
    const dur = round(Math.min(soundLength(file), v.total - fx.start));
    return `<audio id="sfx-${i + 1}" class="clip" src="${esc(src)}" data-start="${fx.start}" data-duration="${dur}" data-track-index="${11 + (i % 3)}" data-volume="${fx.gain}" data-audio-group="sfx"></audio>`;
  });

  let bedTag = '';
  if (bed) {
    const vol = bed.m.volume === undefined ? 0.4 : bed.m.volume;
    const lane = duckLane(v.lines.filter((l) => l.audio), bed.m.duck === undefined ? 0.35 : bed.m.duck);
    bedTag = `<audio id="music" class="clip" src="${esc(bed.src)}" data-start="0" data-duration="${v.total}" data-track-index="14" data-volume="${vol}"${bed.m.start ? ` data-media-start="${bed.m.start}"` : ''} data-fade-out="2.5" data-audio-group="music" data-automation="${esc(JSON.stringify(lane))}"></audio>`;
  }

  const sfxGain = v.spec.sfxVolume === undefined ? 0.6 : v.spec.sfxVolume;
  const html = `<!doctype html>
<!-- Generated by video-kit sync from video.json. Do not edit: change video.json or the scene files and sync again. -->
<html lang="${esc(v.lang)}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=${v.width}, height=${v.height}" />
    <script>
      window.KIT = ${JSON.stringify(KIT)};
    </script>
    <script src="assets/kit/kit.js"></script>
    <link rel="stylesheet" href="assets/kit/kit.css" />
    <style>
      ${fontFaces(v)}
      :root { ${themeVars(v)} }
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="${v.total}" data-width="${v.width}" data-height="${v.height}" data-fps="${v.fps}">
      ${hosts.join('\n      ')}
      ${voices.join('\n      ')}
      ${sounds.join('\n      ')}
      ${bedTag}
      <hf-audio-group id="voiceover" data-volume="1" data-fx-chain="${esc(JSON.stringify(VOICE_FX))}"></hf-audio-group>
      <hf-audio-group id="music" data-volume="1"></hf-audio-group>
      <hf-audio-group id="sfx" data-volume="${sfxGain}"></hf-audio-group>
    </div>
    <script>
      window.__timelines = window.__timelines || {};
      window.__timelines["main"] = kit.root();
    </script>
  </body>
</html>
`;
  const out = path.join(v.dir, 'index.html');
  fs.writeFileSync(out, html);
  const meta = path.join(v.dir, 'meta.json');
  if (!fs.existsSync(meta)) fs.writeFileSync(meta, JSON.stringify({ id: v.name, name: v.name }, null, 2) + '\n');
  return out;
}

export { MASTER_FX };
