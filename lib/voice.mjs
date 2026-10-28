// Voiceover. Each line of video.json becomes assets/voice/<lang>/<id>.mp3 plus a .json with
// its text, length and word timings. A line is generated again only when its text, voice
// or model changes, so editing one line costs one request.
//
// Providers live in PROVIDERS below. ElevenLabs is the default; to add another, write a
// function with the same shape (text, opts) → {audio: Buffer, words, duration?}.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { ffmpegPath, ffprobePath } from './tools.mjs';

const EL_API = 'https://api.elevenlabs.io/v1';

/** Words with start/end seconds from ElevenLabs character alignment. */
function wordsFromAlignment(al) {
  if (!al || !al.characters) return [];
  const out = [];
  let cur = null;
  al.characters.forEach((ch, i) => {
    if (/\s/.test(ch)) {
      if (cur) out.push(cur);
      cur = null;
      return;
    }
    if (!cur) cur = { w: '', start: al.character_start_times_seconds[i], end: 0 };
    cur.w += ch;
    cur.end = al.character_end_times_seconds[i];
  });
  if (cur) out.push(cur);
  return out;
}

async function elevenlabs(text, o) {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new Error('ELEVENLABS_API_KEY is not set. Put it in .env (see .env.example) or the environment.');
  const body = { text, model_id: o.model || 'eleven_v3' };
  if (o.language) body.language_code = o.language;
  if (o.settings) body.voice_settings = o.settings;
  const res = await fetch(`${EL_API}/text-to-speech/${o.voiceId}/with-timestamps?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const raw = await res.text();
  if (!res.ok) {
    let msg = raw;
    try {
      const d = JSON.parse(raw).detail;
      msg = (d && (d.message || d.status)) || raw;
    } catch {}
    throw new Error(`ElevenLabs ${res.status}: ${msg}`);
  }
  const j = JSON.parse(raw);
  const words = wordsFromAlignment(j.normalized_alignment || j.alignment);
  return { audio: Buffer.from(j.audio_base64, 'base64'), words };
}

/**
 * OpenRouter: one key for many speech models (Microsoft MAI-Voice, Gemini TTS, ElevenLabs,
 * MiniMax, Fish Audio and others). `model` is the OpenRouter slug, `voiceId` the model's
 * voice, `instructions` a delivery note for models that take one (Gemini, OpenAI, Fish).
 * Models that only return raw PCM are converted to mp3 here. No word timings.
 */
async function openrouter(text, o) {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error('OPENROUTER_API_KEY is not set. Put it in .env (see .env.example) or the environment.');
  const body = { model: o.model, input: text, response_format: o.format || 'mp3' };
  if (o.voiceId) body.voice = o.voiceId;
  if (o.instructions) body.instructions = o.instructions;
  if (o.speed) body.speed = o.speed;
  if (o.options) body.provider = { options: o.options };
  let res = await fetch('https://openrouter.ai/api/v1/audio/speech', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'X-Title': 'AI Qadam Video Kit' },
    body: JSON.stringify(body),
  });
  // some models only speak PCM; ask again in the format they have
  if (res.status === 400 && body.response_format === 'mp3') {
    const msg = await res.text();
    if (!/pcm/i.test(msg)) throw new Error(`OpenRouter 400: ${msg.slice(0, 300)}`);
    body.response_format = 'pcm';
    res = await fetch('https://openrouter.ai/api/v1/audio/speech', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'X-Title': 'AI Qadam Video Kit' },
      body: JSON.stringify(body),
    });
  }
  if (!res.ok) {
    const raw = await res.text();
    let msg = raw;
    try {
      const e = JSON.parse(raw).error;
      msg = (e && (e.message || e.code)) || raw;
    } catch {}
    throw new Error(`OpenRouter ${res.status}: ${String(msg).slice(0, 300)}`);
  }
  const audio = Buffer.from(await res.arrayBuffer());
  const type = res.headers.get('content-type') || '';
  if (/mpeg|mp3/.test(type) || body.response_format === 'mp3') return { audio, words: [] };
  // raw 16-bit mono PCM (24 kHz unless the model says otherwise) → mp3
  const rate = Number((/rate=(\d+)/.exec(type) || [])[1]) || o.pcmRate || 24000;
  const mp3 = execFileSync(ffmpegPath(), ['-v', 'error', '-f', 's16le', '-ar', String(rate), '-ac', '1', '-i', 'pipe:0', '-c:a', 'libmp3lame', '-b:a', '160k', '-f', 'mp3', 'pipe:1'], { input: audio, maxBuffer: 1 << 28 });
  return { audio: mp3, words: [] };
}

export const PROVIDERS = { elevenlabs, openrouter };

const DEFAULTS = {
  elevenlabs: { voiceId: 'JBFqnCBsd6RMkjVDRZzb', model: 'eleven_v3' },
  openrouter: { model: 'google/gemini-3.8-flash-tts', voiceId: 'Charon' },
};

/** Length of an audio or video file in seconds. */
export function audioSeconds(file) {
  const out = execFileSync(ffprobePath(), ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], { encoding: 'utf8' });
  const s = parseFloat(out);
  if (!(s > 0)) throw new Error(`Cannot read the length of ${file}`);
  return s;
}

/** Even loudness for every line (-16 LUFS, true peak -1.5 dB), written back as mp3. */
function normalize(file) {
  const tmp = file.replace(/\.mp3$/, '.norm.mp3');
  // trim silence at both ends, so a line's time in video.json is its first word; the
  // bounds come from silencedetect (silenceremove on reversed audio cut into last words)
  const total = audioSeconds(file);
  const r = spawnSync(ffmpegPath(), ['-hide_banner', '-nostats', '-i', file, '-af', 'silencedetect=n=-50dB:d=0.05', '-f', 'null', '-'], { encoding: 'utf8' });
  const starts = [...String(r.stderr).matchAll(/silence_start: ([\d.]+)/g)].map((m) => Number(m[1]));
  const ends = [...String(r.stderr).matchAll(/silence_end: ([\d.]+)/g)].map((m) => Number(m[1]));
  let from = 0, to = total;
  if (starts.length && starts[0] < 0.01 && ends.length) from = Math.max(0, ends[0] - 0.05);
  const lastStart = starts[starts.length - 1];
  if (lastStart !== undefined && lastStart > from && (ends.length < starts.length || ends[ends.length - 1] >= total - 0.02)) to = Math.min(total, lastStart + 0.12);
  execFileSync(ffmpegPath(), ['-v', 'error', '-y', '-i', file, '-af', `atrim=start=${from.toFixed(3)}:end=${to.toFixed(3)},asetpts=N/SR/TB,loudnorm=I=-16:TP=-1.5:LRA=9`, '-ar', '44100', '-c:a', 'libmp3lame', '-b:a', '160k', tmp]);
  fs.renameSync(tmp, file);
}

/** Longest pause inside a line, seconds: a long one usually means a broken take. */
function longestPause(file) {
  const r = spawnSync(ffmpegPath(), ['-hide_banner', '-nostats', '-i', file, '-af', 'silencedetect=n=-45dB:d=0.3', '-f', 'null', '-'], { encoding: 'utf8' });
  return Math.max(0, ...[...String(r.stderr).matchAll(/silence_duration: ([\d.]+)/g)].map((m) => Number(m[1])));
}

/** What a take actually says, via a speech-capable model on OpenRouter. */
async function transcribe(file) {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, 'Content-Type': 'application/json', 'X-Title': 'AI Qadam Video Kit' },
    body: JSON.stringify({
      model: process.env.VOICE_CHECK_MODEL || 'google/gemini-2.5-flash',
      temperature: 0,
      messages: [{ role: 'user', content: [
        { type: 'text', text: 'Transcribe this speech exactly as pronounced, in the language spoken. Output only the transcript.' },
        { type: 'input_audio', input_audio: { data: fs.readFileSync(file).toString('base64'), format: 'mp3' } },
      ] }],
    }),
  });
  if (!res.ok) throw new Error(`transcription ${res.status}`);
  const j = await res.json();
  return String(j.choices?.[0]?.message?.content || '').trim();
}

// Cyrillic (Russian, Uzbek, Kazakh letters) to a plain Latin spelling, so a line written in
// one script and heard back in another can still be compared
const TRANSLIT = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'j', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm',
  н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'x', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sh', ъ: '',
  ы: 'i', ь: '', э: 'e', ю: 'yu', я: 'ya', ў: 'o', қ: 'q', ғ: 'g', ҳ: 'h', ә: 'a', ө: 'o', ү: 'u', ұ: 'u', і: 'i', ң: 'ng',
};

/** 0..1, how close two texts are, ignoring script, case, punctuation and stress marks. */
export function similarity(a, b) {
  const norm = (x) =>
    x.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
      .replace(/[\u0400-\u04ff]/g, (c) => TRANSLIT[c] ?? c)
      .replace(/[^\p{L}\p{N}]+/gu, '');
  const x = norm(a), y = norm(b);
  if (!x.length && !y.length) return 1;
  const d = Array.from({ length: y.length + 1 }, (_, j) => j);
  for (let i = 1; i <= x.length; i++) {
    let prev = d[0];
    d[0] = i;
    for (let j = 1; j <= y.length; j++) {
      const t = d[j];
      d[j] = Math.min(d[j] + 1, d[j - 1] + 1, prev + (x[i - 1] === y[j - 1] ? 0 : 1));
      prev = t;
    }
  }
  return 1 - d[y.length] / Math.max(x.length, y.length);
}

/**
 * Generates missing or changed lines for one language. Returns
 * {made: [ids], kept: [ids], failed: [{id, error}]}.
 */
export async function generateVoice(v, { force = [], log = console.log } = {}) {
  const cfg = v.spec.voice || {};
  const provider = cfg.provider || 'elevenlabs';
  const fn = PROVIDERS[provider];
  if (!fn) throw new Error(`Unknown voice provider "${provider}". Known: ${Object.keys(PROVIDERS).join(', ')}.`);
  const outDir = path.join(v.dir, 'assets', 'voice', v.lang);
  fs.mkdirSync(outDir, { recursive: true });
  const result = { made: [], kept: [], failed: [] };

  for (const l of v.lines) {
    if (l.text === undefined) {
      result.failed.push({ id: l.id, error: `no text for language "${v.lang}"` });
      continue;
    }
    const o = { ...DEFAULTS[provider], ...cfg, ...(cfg[v.lang] || {}), ...(l.voice || {}) };
    delete o[v.lang];
    const hash = createHash("sha256").update(JSON.stringify([provider, o.voiceId, o.model, o.language, o.settings, o.instructions, o.speed, l.text])).digest('hex').slice(0, 16);
    const mp3 = path.join(outDir, `${l.id}.mp3`);
    const metaFile = path.join(outDir, `${l.id}.json`);
    const old = fs.existsSync(metaFile) ? JSON.parse(fs.readFileSync(metaFile, 'utf8')) : null;
    if (old && old.hash === hash && fs.existsSync(mp3) && !force.includes(l.id)) {
      result.kept.push(l.id);
      continue;
    }
    try {
      log(`  ${l.id}: ${l.text}`);
      // with an OpenRouter key every take is transcribed back and compared with the text;
      // a take that says something else is made again, up to three times
      const verify = cfg.verify !== false && !!process.env.OPENROUTER_API_KEY;
      let r, heard = null, score = 1;
      for (let take = 1; take <= (verify ? 3 : 1); take++) {
        r = await fn(l.text, o);
        fs.writeFileSync(mp3, r.audio);
        normalize(mp3);
        if (!verify) break;
        heard = await transcribe(mp3).catch(() => null);
        score = heard === null ? 1 : similarity(l.text, heard);
        if (score >= 0.8) break;
        log(`    take ${take} said "${heard}"${take < 3 ? ', trying again' : ''}`);
      }
      if (verify && score < 0.8) log(`  ⚠ ${l.id}: no take matched the text; the closest said "${heard}". Rephrase the line or listen to it.`);
      const duration = audioSeconds(mp3);
      const pause = longestPause(mp3);
      if (pause > 1.2) log(`  ⚠ ${l.id}: a ${pause.toFixed(1)} s pause inside the line; listen to it, or make it again with --force ${l.id}`);
      const meta = { text: l.text, provider, voiceId: o.voiceId, model: o.model, hash, duration: Math.round(duration * 1000) / 1000, words: r.words || [] };
      if (heard !== null) meta.heard = heard;
      fs.writeFileSync(metaFile, JSON.stringify(meta, null, 2) + '\n');
      result.made.push(l.id);
    } catch (e) {
      result.failed.push({ id: l.id, error: e.message });
      if (/401|invalid_api_key|not set/.test(e.message)) break;
    }
  }
  return result;
}
