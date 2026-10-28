// The kit's own checks: things HyperFrames cannot know about, because they live in
// video.json and brief.md: voice timing, missing translations, uncredited assets.
import fs from 'node:fs';
import path from 'node:path';
import { readSources } from './fetch.mjs';

/** Returns [{level: 'error'|'warn'|'info', msg}]. */
export function checkVideo(v) {
  const out = [];
  const err = (msg) => out.push({ level: 'error', msg });
  const warn = (msg) => out.push({ level: 'warn', msg });
  const info = (msg) => out.push({ level: 'info', msg });

  for (const s of v.scenes) {
    if (!fs.existsSync(path.join(v.dir, s.src))) err(`scene "${s.id}": ${s.src} does not exist`);
  }
  if (!fs.existsSync(path.join(v.dir, 'brief.md'))) warn('no brief.md: write down the facts and their sources before the scenes');

  // voice timing
  const lines = [...v.lines].sort((a, b) => a.start - b.start);
  const maxGap = v.spec.maxSilence === undefined ? 5 : v.spec.maxSilence;
  lines.forEach((l, i) => {
    const sc = v.scenes.find((s) => s.id === l.scene);
    if (l.text === undefined) err(`line ${l.id}: no text for language "${v.lang}"`);
    if (l.stale) warn(`line ${l.id}: text changed since its audio was made; run \`video-kit voice ${v.name}\``);
    else if (l.draft) info(`line ${l.id}: no audio yet, timed by an estimate (${l.duration.toFixed(1)} s)`);
    if (l.end > v.total - 0.3) err(`line ${l.id} ends at ${l.end.toFixed(2)} s, past the end of the video (${v.total} s) less 0.3 s`);
    else if (sc && l.end > sc.end + 0.5) warn(`line ${l.id} runs ${(l.end - sc.end).toFixed(1)} s past the end of scene "${sc.id}"`);
    const next = lines[i + 1];
    if (next && l.end > next.start - 0.15) {
      err(`line ${l.id} (ends ${l.end.toFixed(2)} s) overlaps line ${next.id} (starts ${next.start.toFixed(2)} s): move ${next.id} later or shorten ${l.id}`);
    }
    if (next && next.start - l.end > maxGap) warn(`${(next.start - l.end).toFixed(1)} s of silence between lines ${l.id} and ${next.id} (limit ${maxGap} s)`);
  });

  // strings used by scenes but missing in this language
  const keys = new Set();
  for (const s of v.scenes) {
    const f = path.join(v.dir, s.src);
    if (!fs.existsSync(f)) continue;
    for (const m of fs.readFileSync(f, 'utf8').matchAll(/data-t(?:-html)?="([^"]+)"/g)) keys.add(m[1]);
  }
  for (const k of keys) if (!(k in v.strings)) warn(`string "${k}" has no text in "${v.lang}"`);

  // every image, video, audio or font file under assets/ needs a line in assets/CREDITS.md
  const credits = path.join(v.dir, 'assets', 'CREDITS.md');
  const listed = fs.existsSync(credits) ? fs.readFileSync(credits, 'utf8') : '';
  const media = /\.(png|jpe?g|webp|gif|svg|mp4|webm|mov|mp3|wav|m4a|ogg|woff2?|ttf|otf)$/i;
  const walk = (d) =>
    fs.existsSync(d)
      ? fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => {
          const p = path.join(d, e.name);
          if (e.isDirectory()) return ['kit', 'voice', 'fetched'].includes(e.name) && d === path.join(v.dir, 'assets') ? [] : walk(p);
          return media.test(e.name) ? [p] : [];
        })
      : [];
  // entries may use * as a wildcard: fonts/playfair-*.woff2
  const patterns = [...listed.matchAll(/[\w./*-]+\.[\w*]+/g)].map(
    (m) => new RegExp('^' + m[0].replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*') + '$'),
  );
  for (const f of walk(path.join(v.dir, 'assets'))) {
    const name = path.relative(path.join(v.dir, 'assets'), f).split(path.sep).join('/');
    if (!patterns.some((p) => p.test(name))) warn(`assets/${name} is not in assets/CREDITS.md (source and license)`);
  }

  // fetched media carry their credit in assets/sources.json
  for (const s of readSources(v.dir)) {
    if (!s.license) warn(`assets/sources.json: ${s.file} has no "license"`);
    if (!s.page && !s.author) warn(`assets/sources.json: ${s.file} has neither "page" nor "author"`);
  }

  const music = v.spec.music;
  if (music && music.source === 'file' && !/music/i.test(listed) && !readSources(v.dir).some((s) => music.file.endsWith(s.file))) {
    warn('the music file is not credited in assets/CREDITS.md or assets/sources.json');
  }
  return out;
}
