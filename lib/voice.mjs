// Voiceover. Each line of video.json becomes assets/voice/<lang>/<id>.mp3 plus a .json with
// its text, length and word timings. A line is generated again only when its text, voice
// or model changes, so editing one line costs one request.
//
// Providers live in PROVIDERS below. ElevenLabs is the default; to add another, write a
// function with the same shape (text, opts) → {audio: Buffer, words, duration?}.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
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

export const PROVIDERS = { elevenlabs };

const DEFAULTS = {
  elevenlabs: { voiceId: 'JBFqnCBsd6RMkjVDRZzb', model: 'eleven_v3' },
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
  execFileSync(ffmpegPath(), ['-v', 'error', '-y', '-i', file, '-af', 'loudnorm=I=-16:TP=-1.5:LRA=9', '-ar', '44100', '-c:a', 'libmp3lame', '-b:a', '160k', tmp]);
  fs.renameSync(tmp, file);
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
    const hash = createHash('sha256').update(JSON.stringify([provider, o.voiceId, o.model, o.language, o.settings, l.text])).digest('hex').slice(0, 16);
    const mp3 = path.join(outDir, `${l.id}.mp3`);
    const metaFile = path.join(outDir, `${l.id}.json`);
    const old = fs.existsSync(metaFile) ? JSON.parse(fs.readFileSync(metaFile, 'utf8')) : null;
    if (old && old.hash === hash && fs.existsSync(mp3) && !force.includes(l.id)) {
      result.kept.push(l.id);
      continue;
    }
    try {
      log(`  ${l.id}: ${l.text}`);
      const r = await fn(l.text, o);
      fs.writeFileSync(mp3, r.audio);
      normalize(mp3);
      const duration = audioSeconds(mp3);
      const meta = { text: l.text, provider, voiceId: o.voiceId, model: o.model, hash, duration: Math.round(duration * 1000) / 1000, words: r.words || [] };
      fs.writeFileSync(metaFile, JSON.stringify(meta, null, 2) + '\n');
      result.made.push(l.id);
    } catch (e) {
      result.failed.push({ id: l.id, error: e.message });
      if (/401|invalid_api_key|not set/.test(e.message)) break;
    }
  }
  return result;
}
