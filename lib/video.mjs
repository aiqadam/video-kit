// Reads a video project (videos/<name>/video.json) and works out its timeline: where each
// scene, voice line and sound starts. Everything else in the kit is derived from this.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const KIT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const FORMATS = {
  landscape: { width: 1920, height: 1080 },
  portrait: { width: 1080, height: 1920 },
  square: { width: 1080, height: 1080 },
};

/** Speaking rate for draft timing when a line has no audio yet, characters a second. */
const DRAFT_CPS = 14;

export class KitError extends Error {}

/** The workspace: where videos/ lives (the current directory or a parent of it). */
export function workspaceRoot(start = process.cwd()) {
  let dir = path.resolve(start);
  for (;;) {
    if (fs.existsSync(path.join(dir, 'videos')) && fs.existsSync(path.join(dir, 'package.json'))) return dir;
    const up = path.dirname(dir);
    if (up === dir) return path.resolve(start);
    dir = up;
  }
}

/** Accepts a video name (videos/<name>) or a path to the video's folder. */
export function videoDir(nameOrPath) {
  if (!nameOrPath) throw new KitError('Name the video: e.g. `video-kit render my-video`.');
  const direct = path.resolve(nameOrPath);
  if (fs.existsSync(path.join(direct, 'video.json'))) return direct;
  const named = path.join(workspaceRoot(), 'videos', nameOrPath);
  if (fs.existsSync(path.join(named, 'video.json'))) return named;
  throw new KitError(`No video.json in ${direct} or ${named}.`);
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    throw new KitError(`${file}: ${e.message}`);
  }
}

/** Text of a line in a language: a string, or {ru: "...", en: "..."}. */
export function lineText(line, lang) {
  if (typeof line.text === 'string') return line.text;
  if (line.text && typeof line.text === 'object') return line.text[lang];
  return undefined;
}

/** Strings for a language: video.json "strings" merged with strings/<lang>.json. */
function loadStrings(dir, spec, lang) {
  const inline = (spec.strings && spec.strings[lang]) || {};
  const file = path.join(dir, 'strings', `${lang}.json`);
  return { ...inline, ...(fs.existsSync(file) ? readJson(file) : {}) };
}

/** What we know about a generated voice line: {duration, words, ...}, or null. */
export function voiceMeta(dir, lang, id) {
  const file = path.join(dir, 'assets', 'voice', lang, `${id}.json`);
  return fs.existsSync(file) ? readJson(file) : null;
}

export function voiceAudio(dir, lang, id) {
  for (const ext of ['mp3', 'wav', 'm4a']) {
    const f = path.join(dir, 'assets', 'voice', lang, `${id}.${ext}`);
    if (fs.existsSync(f)) return f;
  }
  return null;
}

/**
 * Loads video.json and computes the plan for one language:
 *   {dir, name, spec, lang, width, height, fps, total, transition,
 *    scenes: [{id, start, dur, end, fadeIn, src}],
 *    lines: [{id, scene, start, end, duration, text, audio, draft, words}],
 *    sfx: [{scene, start, sound, gain}], strings}
 */
export function loadVideo(nameOrPath, langOverride) {
  const dir = videoDir(nameOrPath);
  const spec = readJson(path.join(dir, 'video.json'));
  const name = path.basename(dir);
  const lang = langOverride || spec.lang || (spec.locales && spec.locales[0]) || 'en';

  const fmt = typeof spec.format === 'object' ? spec.format : FORMATS[spec.format || 'landscape'];
  if (!fmt || !fmt.width || !fmt.height) {
    throw new KitError(`video.json: format must be landscape, portrait, square or {"width", "height"}.`);
  }
  const fps = spec.fps || 30;
  const transition = spec.transition === undefined ? 0.3 : spec.transition;

  if (!Array.isArray(spec.scenes) || spec.scenes.length === 0) throw new KitError('video.json: "scenes" is empty.');
  const ids = new Set();
  const scenes = [];
  let at = 0;
  spec.scenes.forEach((s, i) => {
    if (!s.id || !/^[a-z][a-z0-9-]*$/.test(s.id)) {
      throw new KitError(`video.json: scene ${i + 1} needs an id of lowercase letters, digits and dashes.`);
    }
    if (ids.has(s.id)) throw new KitError(`video.json: scene id "${s.id}" is used twice.`);
    ids.add(s.id);
    if (!(s.dur > 0)) throw new KitError(`video.json: scene "${s.id}" needs "dur" in seconds.`);
    const start = i === 0 ? 0 : at - transition;
    scenes.push({
      id: s.id,
      start: round(start),
      dur: s.dur,
      end: round(start + s.dur),
      fadeIn: i === 0 ? 0 : transition,
      src: s.src || `compositions/${s.id}.html`,
    });
    at = start + s.dur;
  });
  const total = round(at);

  const lines = [];
  const sfx = [];
  const lineIds = new Set();
  spec.scenes.forEach((s, i) => {
    const sc = scenes[i];
    for (const l of s.lines || []) {
      if (!l.id) throw new KitError(`video.json: a line in scene "${s.id}" has no id.`);
      if (lineIds.has(l.id)) throw new KitError(`video.json: line id "${l.id}" is used twice.`);
      lineIds.add(l.id);
      const text = lineText(l, lang);
      const meta = voiceMeta(dir, lang, l.id);
      const audio = voiceAudio(dir, lang, l.id);
      const fresh = meta && audio && text !== undefined && meta.text === text;
      const duration = fresh ? meta.duration : (text || '').length / DRAFT_CPS;
      const start = round(sc.start + (l.at || 0));
      lines.push({
        id: l.id,
        scene: s.id,
        sceneStart: sc.start,
        start,
        end: round(start + duration),
        duration,
        text,
        audio: fresh ? audio : null,
        draft: !fresh,
        stale: !!(meta && text !== undefined && meta.text !== text),
        words: fresh ? meta.words || [] : [],
        voice: l.voice,
      });
    }
    for (const fx of s.sfx || []) {
      sfx.push({ scene: s.id, start: round(sc.start + (fx.at || 0)), sound: fx.sound, gain: fx.gain === undefined ? 1 : fx.gain });
    }
  });

  return {
    dir,
    name,
    spec,
    lang,
    width: fmt.width,
    height: fmt.height,
    fps,
    total,
    transition,
    scenes,
    lines,
    sfx,
    strings: loadStrings(dir, spec, lang),
  };
}

export function round(x) {
  return Math.round(x * 1000) / 1000;
}

export function rel(p) {
  return path.relative(process.cwd(), p) || '.';
}
