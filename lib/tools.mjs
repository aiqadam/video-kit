// External tools: ffmpeg (the system one if present, else the npm ffmpeg-static binary)
// and the pinned HyperFrames CLI. Telemetry is off and HyperFrames skills are not
// installed: the kit's own instructions (AGENTS.md, skills/) are what the agent follows.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync, spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

function onPath(cmd) {
  const r = spawnSync(cmd, ['-version'], { stdio: 'ignore', shell: false });
  return r.status === 0;
}

let ffmpegCache, ffprobeCache;

export function ffmpegPath() {
  if (ffmpegCache) return ffmpegCache;
  if (process.env.FFMPEG_PATH && fs.existsSync(process.env.FFMPEG_PATH)) return (ffmpegCache = process.env.FFMPEG_PATH);
  if (onPath('ffmpeg')) return (ffmpegCache = 'ffmpeg');
  try {
    const p = require('ffmpeg-static');
    if (p && fs.existsSync(p)) return (ffmpegCache = p);
  } catch {}
  throw new Error('ffmpeg not found. Run `npm install` again (it downloads one), or install ffmpeg yourself.');
}

export function ffprobePath() {
  if (ffprobeCache) return ffprobeCache;
  if (process.env.FFPROBE_PATH && fs.existsSync(process.env.FFPROBE_PATH)) return (ffprobeCache = process.env.FFPROBE_PATH);
  if (onPath('ffprobe')) return (ffprobeCache = 'ffprobe');
  try {
    const p = require('ffprobe-static').path;
    if (p && fs.existsSync(p)) return (ffprobeCache = p);
  } catch {}
  throw new Error('ffprobe not found. Run `npm install` again, or install ffmpeg yourself.');
}

export function hfBin() {
  return path.join(path.dirname(require.resolve('hyperframes/package.json')), 'bin', 'hyperframes.mjs');
}

export function hfVersion() {
  return require('hyperframes/package.json').version;
}

function hfEnv() {
  const env = { ...process.env, HYPERFRAMES_NO_TELEMETRY: '1', DO_NOT_TRACK: '1', HYPERFRAMES_SKIP_SKILLS: '1' };
  try {
    const ff = ffmpegPath();
    if (ff !== 'ffmpeg') env.HYPERFRAMES_FFMPEG_PATH = env.FFMPEG_PATH = ff;
    const fp = ffprobePath();
    if (fp !== 'ffprobe') env.HYPERFRAMES_FFPROBE_PATH = env.FFPROBE_PATH = fp;
  } catch {}
  return env;
}

/** Runs `hyperframes <args>` in the video's folder; resolves with the exit code. */
export function hf(args, cwd, { quiet = false, capture = false } = {}) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [hfBin(), ...args], {
      cwd,
      env: hfEnv(),
      stdio: capture ? ['ignore', 'pipe', 'pipe'] : quiet ? ['ignore', 'ignore', 'inherit'] : 'inherit',
    });
    let out = '';
    if (capture) {
      child.stdout.on('data', (d) => (out += d));
      child.stderr.on('data', (d) => (out += d));
    }
    child.on('close', (code) => resolve(capture ? { code, out } : code));
  });
}

/** Loads KEY=VALUE pairs from .env in the workspace into process.env (existing values win). */
export function loadEnv(root) {
  const file = path.join(root, '.env');
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (!m || line.trim().startsWith('#')) continue;
    const val = m[2].replace(/^(['"])(.*)\1$/, '$2');
    if (process.env[m[1]] === undefined && val) process.env[m[1]] = val;
  }
}
