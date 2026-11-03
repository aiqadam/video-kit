// Music generated from a description through OpenRouter (Google Lyria by default). A track
// is made once by `video-kit music`, kept in assets/music/ and made again only when its
// prompt or model changes, so a video renders the same bed every time.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { audioSeconds } from '../voice.mjs';
import { ffmpegPath } from '../tools.mjs';

export const MUSIC_DEFAULTS = { model: 'google/lyria-3-pro-preview' };

// Models master their tracks loud (Lyria around -11 LUFS, louder than the voice at -16).
// Every generated track is brought to this level, so music.volume means the same for all.
export const MUSIC_LUFS = -18;

/** Brings an mp3 to MUSIC_LUFS in place (one-pass loudnorm, true peak -2 dB). */
export function levelTrack(file) {
  const tmp = file.replace(/\.mp3$/, '.level.mp3');
  const r = spawnSync(ffmpegPath(), ['-v', 'error', '-y', '-i', file, '-af', `loudnorm=I=${MUSIC_LUFS}:TP=-2:LRA=11`, '-ar', '44100', '-c:a', 'libmp3lame', '-b:a', '192k', tmp], { encoding: 'utf8' });
  if (r.status !== 0) {
    fs.rmSync(tmp, { force: true });
    throw new Error(`could not level the music: ${(r.stderr || '').slice(0, 200)}`);
  }
  fs.renameSync(tmp, file);
}

/** The prompt as sent: the description, plus the length the video needs unless it names one. */
export function musicPrompt(m, seconds) {
  const p = String(m.prompt || '').trim();
  if (!p) throw new Error('video.json music.prompt is empty: describe the track (instruments, tempo, mood, "no vocals").');
  if (m.length === false || /\bseconds?\b/i.test(p)) return p;
  return `${p} About ${Math.ceil(seconds)} seconds long, with a clear ending.`;
}

/** What identifies a track: model, seed and description (not the video's length, which moves often). */
export function musicHash(m) {
  const o = { ...MUSIC_DEFAULTS, ...m };
  return createHash('sha256').update(JSON.stringify([o.model, o.seed, String(o.prompt || '').trim(), o.length])).digest('hex').slice(0, 16);
}

/** One track from OpenRouter: streams the audio back and returns it as an mp3 Buffer. */
export async function generateTrack(prompt, o = {}) {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error('OPENROUTER_API_KEY is not set (.env at the repository root).');
  const body = { model: o.model || MUSIC_DEFAULTS.model, modalities: ['text', 'audio'], audio: { format: 'mp3' }, stream: true, messages: [{ role: 'user', content: prompt }] };
  if (o.seed !== undefined) body.seed = o.seed;
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'X-Title': 'AI Qadam Video Kit' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const dec = new TextDecoder();
  let buf = '', b64 = '', err = '';
  for await (const chunk of res.body) {
    buf += dec.decode(chunk, { stream: true });
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (data === '[DONE]') continue;
      let j;
      try {
        j = JSON.parse(data);
      } catch {
        continue;
      }
      if (j.error) err = j.error.message || JSON.stringify(j.error);
      const a = j.choices?.[0]?.delta?.audio;
      if (a?.data) b64 += a.data;
    }
  }
  const audio = Buffer.from(b64, 'base64');
  if (audio.length < 10000) throw new Error(err || 'the model returned no audio');
  return audio;
}

const dirOf = (v) => path.join(v.dir, 'assets', 'music');

/** The generated track video.json asks for, if it has been made: {file, meta} or null. */
export function generatedMusic(v) {
  const m = v.spec.music || {};
  const file = path.join(dirOf(v), 'generated.mp3');
  const metaFile = path.join(dirOf(v), 'generated.json');
  if (!fs.existsSync(file) || !fs.existsSync(metaFile)) return null;
  const meta = JSON.parse(fs.readFileSync(metaFile, 'utf8'));
  return { file, meta, current: meta.hash === musicHash(m) };
}

function save(file, audio, meta) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, audio);
  levelTrack(file);
  meta.lufs = MUSIC_LUFS;
  meta.duration = Math.round(audioSeconds(file) * 1000) / 1000;
  fs.writeFileSync(file.replace(/\.mp3$/, '.json'), JSON.stringify(meta, null, 2) + '\n');
  return meta;
}

/** Makes assets/music/generated.mp3 for video.json "music" when missing, changed or forced. */
export async function generateMusic(v, { force = false, log = console.log } = {}) {
  const m = { ...MUSIC_DEFAULTS, ...(v.spec.music || {}) };
  const have = generatedMusic(v);
  if (have && have.current && !force) {
    log(`  unchanged: ${path.relative(v.dir, have.file)} (${have.meta.duration} s)`);
    return have.meta;
  }
  const prompt = musicPrompt(m, v.total);
  log(`  ${m.model}: ${prompt}`);
  const audio = await generateTrack(prompt, m);
  return save(path.join(dirOf(v), 'generated.mp3'), audio, { model: m.model, prompt, seed: m.seed, hash: musicHash(m) });
}

/** One track per entry of video.json "musicSamples" into renders/music-samples/, in parallel. */
export async function musicSamples(v, { log = console.log } = {}) {
  const list = v.spec.musicSamples || [];
  const out = path.join(v.dir, 'renders', 'music-samples');
  const made = await Promise.all(
    list.map(async (c, i) => {
      const o = { ...MUSIC_DEFAULTS, ...c };
      const name = c.name || `sample-${i + 1}`;
      try {
        const prompt = musicPrompt(o, v.total);
        const audio = await generateTrack(prompt, o);
        const meta = save(path.join(out, `${name}.mp3`), audio, { model: o.model, prompt: o.prompt, seed: o.seed, sample: name });
        log(`  ${path.relative(v.dir, path.join(out, name + '.mp3'))} (${meta.duration} s)`);
        return name;
      } catch (e) {
        log(`  ✗ ${name}: ${e.message}`);
        return null;
      }
    }),
  );
  return made.filter(Boolean);
}

/**
 * Keeps a sample the person chose: copies it to assets/music/generated.mp3 and returns the
 * "music" settings that describe it, so the next `music` run does not make it again.
 */
export function useSample(v, name) {
  const src = path.join(v.dir, 'renders', 'music-samples', `${name}.mp3`);
  const metaSrc = src.replace(/\.mp3$/, '.json');
  if (!fs.existsSync(src) || !fs.existsSync(metaSrc)) throw new Error(`No sample "${name}" in renders/music-samples/: run \`video-kit music <video> --samples\` first.`);
  const s = JSON.parse(fs.readFileSync(metaSrc, 'utf8'));
  const music = { ...(v.spec.music || {}), source: 'openrouter', model: s.model, prompt: s.prompt };
  if (s.seed !== undefined) music.seed = s.seed;
  else delete music.seed;
  delete music.file;
  delete music.style;
  const meta = { model: s.model, prompt: musicPrompt(music, v.total), seed: s.seed, hash: musicHash(music), from: name };
  save(path.join(dirOf(v), 'generated.mp3'), fs.readFileSync(src), meta);
  return music;
}
