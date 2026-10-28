// Local voice engines: a Python worker per engine (tts/<engine>/run.py) in its own virtual
// environment under .kit/tts/<engine>/ (gitignored). `node kit.mjs tts setup <engine>`
// creates it; the voice provider "local" starts the worker once and sends it every line.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import readline from 'node:readline';
import { spawn, spawnSync } from 'node:child_process';
import { KIT_ROOT, workspaceRoot } from './video.mjs';

export function engines() {
  const dir = path.join(KIT_ROOT, 'tts');
  return fs.existsSync(dir)
    ? fs.readdirSync(dir).filter((n) => fs.existsSync(path.join(dir, n, 'engine.json'))).map((n) => engineInfo(n))
    : [];
}

export function engineInfo(name) {
  const file = path.join(KIT_ROOT, 'tts', name, 'engine.json');
  if (!fs.existsSync(file)) throw new Error(`No local voice engine "${name}". Known: ${engines().map((e) => e.name).join(', ')}.`);
  return { ...JSON.parse(fs.readFileSync(file, 'utf8')), dir: path.dirname(file) };
}

const platform = () => `${process.platform}-${os.arch()}`;
const venvDir = (name) => path.join(workspaceRoot(), '.kit', 'tts', name, 'venv');
const venvPython = (name) =>
  process.platform === 'win32' ? path.join(venvDir(name), 'Scripts', 'python.exe') : path.join(venvDir(name), 'bin', 'python');

/** A Python 3 that satisfies ">=3.a,<3.b", trying the usual names on every platform. */
function findPython(range) {
  const [, lo, hi] = /\>=3\.(\d+),<3\.(\d+)/.exec(range) || [null, '9', '14'];
  const names = [];
  for (let m = Number(hi) - 1; m >= Number(lo); m--) names.push(`python3.${m}`);
  names.push('python3', 'python', 'py');
  for (const n of names) {
    const args = n === 'py' ? [`-3`, '-c', 'import sys;print(sys.version_info[1])'] : ['-c', 'import sys;print(sys.version_info[0]*100+sys.version_info[1])'];
    const r = spawnSync(n, args, { encoding: 'utf8' });
    if (r.status !== 0) continue;
    const v = Number(String(r.stdout).trim());
    const minor = v > 100 ? v - 300 : v;
    if (minor >= Number(lo) && minor < Number(hi)) return n === 'py' ? ['py', '-3'] : [n];
  }
  return null;
}

/** Creates the engine's virtual environment and installs its requirements. */
export function setupEngine(name, log = console.log) {
  const e = engineInfo(name);
  if (!e.platforms.includes(platform())) throw new Error(`${name} runs on ${e.platforms.join(', ')}; this machine is ${platform()}.`);
  const py = findPython(e.python);
  if (!py) throw new Error(`${name} needs Python ${e.python}. Install it from python.org (or your package manager) and run this again.`);
  log(`Creating ${path.relative(process.cwd(), venvDir(name))} with ${py.join(' ')}…`);
  let r = spawnSync(py[0], [...py.slice(1), '-m', 'venv', venvDir(name)], { stdio: 'inherit' });
  if (r.status !== 0) throw new Error('Creating the virtual environment failed.');
  log('Installing packages (the first time takes a few minutes)…');
  r = spawnSync(venvPython(name), ['-m', 'pip', 'install', '-q', '--upgrade', 'pip'], { stdio: 'inherit' });
  r = spawnSync(venvPython(name), ['-m', 'pip', 'install', '-q', '-r', path.join(e.dir, 'requirements.txt')], { stdio: 'inherit' });
  if (r.status !== 0) throw new Error('Installing the packages failed; see the messages above.');
  log(`Ready. Use it in video.json: "voice": {"provider": "local", "engine": "${name}", "model": "${e.defaultModel}"}. The model downloads on first use.`);
}

export function engineReady(name) {
  return fs.existsSync(venvPython(name));
}

const workers = {};

/** Starts (once) the engine's worker and returns a function that speaks one request. */
function worker(name) {
  if (workers[name]) return workers[name];
  const e = engineInfo(name);
  if (!engineReady(name)) throw new Error(`Local engine "${name}" is not set up. Run: node kit.mjs tts setup ${name}`);
  const child = spawn(venvPython(name), [path.join(e.dir, 'run.py')], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, HF_HUB_DISABLE_TELEMETRY: '1', PYTHONUNBUFFERED: '1' },
  });
  let stderr = '';
  child.stderr.on('data', (d) => (stderr = (stderr + d).slice(-4000)));
  const pending = [];
  readline.createInterface({ input: child.stdout }).on('line', (line) => {
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      return; // library chatter on stdout
    }
    const p = pending.shift();
    if (p) (msg.error ? p.reject(new Error(msg.error)) : p.resolve());
  });
  child.on('exit', (code) => {
    while (pending.length) pending.shift().reject(new Error(`${name} worker stopped (${code}): ${stderr.trim().split('\n').slice(-3).join(' ')}`));
    delete workers[name];
  });
  process.on('exit', () => child.kill());
  child.unref();
  const speak = (req) =>
    new Promise((resolve, reject) => {
      pending.push({ resolve, reject });
      child.stdin.write(JSON.stringify(req) + '\n');
    });
  workers[name] = speak;
  return speak;
}

export function stopWorkers() {
  for (const k of Object.keys(workers)) delete workers[k];
}

/** Synthesises one line to a WAV file with a local engine. */
export async function speakLocal(text, o, outWav) {
  const speak = worker(o.engine || 'piper');
  await speak({ text, out: outWav, model: o.model, language: o.language, instructions: o.instructions, voiceId: o.voiceId, speed: o.speed });
}
