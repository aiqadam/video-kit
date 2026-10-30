// Media fetched at build time. Stock footage and music licenses often allow use in a
// video but not redistributing the original files, so a video lists them in
// assets/sources.json and the kit downloads and prepares them into assets/fetched/
// (gitignored) the first time they are needed.
//
//   [{"file": "clips/coals.mp4", "url": "https://…", "page": "https://…",
//     "author": "…", "license": "Pexels License",
//     "trim": [1.5, 7], "crop": "1080:1080:0:420", "width": 1920, "mute": true}]
//
// Video entries are cut to `trim` (seconds), cropped (ffmpeg crop w:h:x:y), scaled to
// `width` and re-encoded to H.264 without sound unless "mute": false. Audio entries
// (mp3, wav, m4a, ogg) are trimmed when asked and converted when the format differs;
// images (jpg, png, webp) are cropped and scaled.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { ffmpegPath } from './tools.mjs';

const AUDIO = /\.(mp3|wav|m4a|ogg|flac)$/i;
const IMAGE = /\.(jpe?g|png|webp)$/i;

/**
 * Downloads one file. Two hosts behave badly: undici gives up on a slow connect after ten
 * seconds, and a throttled server can send headers and then trickle nothing for minutes.
 * So fetch is given twenty seconds, and curl is the fallback — in 64 KB ranges, because
 * those same hosts answer a small range in a second but never finish a whole file. The
 * result is the same bytes either way.
 */
const UA = 'Mozilla/5.0 (ai-qadam-video-kit)';
const CHUNK = 64 * 1024;

function rangeDownload(url, dest) {
  const head = spawnSync('curl', ['-sSIL', '-A', UA, url], { encoding: 'utf8' });
  const m = /content-length:\s*(\d+)/i.exec(head.stdout || '');
  if (!m) throw new Error('curl: no content-length from the host');
  const size = Number(m[1]);
  const fd = fs.openSync(dest, 'w');
  try {
    for (let off = 0; off < size; off += CHUNK) {
      const end = Math.min(off + CHUNK - 1, size - 1);
      let got = null;
      for (let attempt = 0; attempt < 3 && !got; attempt++) {
        const r = spawnSync('curl', ['-sS', '--max-time', '60', '-A', UA, '-r', `${off}-${end}`, url], { maxBuffer: CHUNK * 4 });
        if (r.status === 0 && r.stdout && r.stdout.length === end - off + 1) got = r.stdout;
      }
      if (!got) throw new Error(`curl: no bytes for ${off}-${end} of ${size}`);
      fs.writeSync(fd, got);
    }
  } finally {
    fs.closeSync(fd);
  }
}

async function download(url, dest) {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow', signal: AbortSignal.timeout(20_000) });
    if (!res.ok) throw new Error(`answered ${res.status}`);
    fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
    return;
  } catch (e) {
    fs.rmSync(dest, { force: true });
    try {
      rangeDownload(url, dest);
    } catch (e2) {
      throw new Error(`${e.message}; ${e2.message}`);
    }
  }
}

export function sourcesFile(dir) {
  return path.join(dir, 'assets', 'sources.json');
}

export function readSources(dir) {
  const f = sourcesFile(dir);
  if (!fs.existsSync(f)) return [];
  const list = JSON.parse(fs.readFileSync(f, 'utf8'));
  if (!Array.isArray(list)) throw new Error('assets/sources.json must be a list.');
  return list;
}

/** Downloads and prepares every missing entry; returns the files it made. */
export async function fetchSources(dir, log = (s) => process.stdout.write(s + '\n')) {
  const made = [];
  const stampOf = (s) => JSON.stringify([s.url, s.trim, s.crop, s.width, s.mute]);
  for (const s of readSources(dir)) {
    if (!s.file || !s.url) throw new Error('Every entry in assets/sources.json needs "file" and "url".');
    const out = path.join(dir, 'assets', 'fetched', s.file);
    const stamp = out + '.source';
    if (fs.existsSync(out) && fs.existsSync(stamp) && fs.readFileSync(stamp, 'utf8') === stampOf(s)) continue;
    fs.mkdirSync(path.dirname(out), { recursive: true });
    log(`  fetching ${s.file}`);
    const raw = out + '.download';
    await download(s.url, raw);
    try {
      const srcExt = path.extname(new URL(s.url).pathname).toLowerCase();
      if (AUDIO.test(s.file)) {
        if (s.trim || srcExt !== path.extname(out).toLowerCase()) {
          const args = ['-v', 'error', '-y'];
          if (s.trim) args.push('-ss', String(s.trim[0]), '-to', String(s.trim[1]));
          args.push('-i', raw, '-vn');
          if (out.endsWith('.wav')) args.push('-c:a', 'pcm_s16le');
          else args.push('-c:a', 'libmp3lame', '-b:a', '192k');
          execFileSync(ffmpegPath(), [...args, out]);
          fs.rmSync(raw);
        } else fs.renameSync(raw, out);
      } else if (IMAGE.test(s.file)) {
        const vf = [];
        if (s.crop) vf.push(`crop=${s.crop}`);
        vf.push(`scale='min(${s.width || 2400},iw)':-2`);
        execFileSync(ffmpegPath(), ['-v', 'error', '-y', '-i', raw, '-vf', vf.join(','), '-frames:v', '1', '-q:v', '3', out]);
        fs.rmSync(raw);
      } else {
        const vf = [];
        if (s.crop) vf.push(`crop=${s.crop}`);
        vf.push(`scale='min(${s.width || 1920},iw)':-2`);
        const args = ['-v', 'error', '-y'];
        if (s.trim) args.push('-ss', String(s.trim[0]), '-to', String(s.trim[1]));
        args.push('-i', raw, '-vf', vf.join(','), '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p', '-movflags', '+faststart');
        if (s.mute === false) args.push('-c:a', 'aac', '-b:a', '160k');
        else args.push('-an');
        args.push(out);
        execFileSync(ffmpegPath(), args);
        fs.rmSync(raw);
      }
    } catch (e) {
      fs.rmSync(raw, { force: true });
      throw new Error(`${s.file}: preparing failed: ${String(e.stderr || e.message).trim()}`);
    }
    fs.writeFileSync(stamp, stampOf(s));
    made.push(s.file);
  }
  return made;
}
