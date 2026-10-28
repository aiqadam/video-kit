#!/usr/bin/env node
// AI Qadam Video Kit command line. Run `video-kit help` for the commands.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { KIT_ROOT, KitError, loadVideo, workspaceRoot, FORMATS, rel } from '../lib/video.mjs';
import { sync } from '../lib/sync.mjs';
import { fetchSources } from '../lib/fetch.mjs';
import { checkVideo } from '../lib/check.mjs';
import { generateVoice, audioSeconds } from '../lib/voice.mjs';
import { hf, hfVersion, ffmpegPath, ffprobePath, loadEnv } from '../lib/tools.mjs';

const HELP = `AI Qadam Video Kit

  video-kit new <name> [--format landscape|portrait|square] [--lang ru]
                                   start videos/<name> from the template
  video-kit plan <video> [--lang]  when every scene, line and sound plays
  video-kit voice <video> [--lang] [--force id,id]
                                   make missing or changed voice lines
  video-kit check <video> [--lang] [--quick]
                                   the kit's checks, then HyperFrames' (skip with --quick)
  video-kit stills <video> [scene@seconds ...] [--lang]
                                   PNG frames to look at; default: every scene twice
  video-kit preview <video>        live preview in the browser
  video-kit render <video> [--lang] [--quality draft|standard|high] [-o file]
                                   the finished MP4, with its loudness measured
  video-kit sync <video> [--lang]  fetch outside media, regenerate index.html (the other commands do this)
  video-kit doctor                 check Node, ffmpeg, the browser and the voice key
  video-kit init <dir>             copy the kit into a new folder (for npx)

<video> is a name under videos/ or a path to a folder with video.json.
`;

function parse(argv) {
  const pos = [], opt = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-o') opt.o = argv[++i];
    else if (a.startsWith('--')) {
      const [k, val] = a.slice(2).split('=');
      if (val !== undefined) opt[k] = val;
      else if (argv[i + 1] && !argv[i + 1].startsWith('-')) opt[k] = argv[++i];
      else opt[k] = true;
    } else pos.push(a);
  }
  return { pos, opt };
}

const say = (s = '') => process.stdout.write(s + '\n');

/** Loads a video, fetches its outside media if missing, and regenerates index.html. */
async function prepare(name, opt) {
  const v = loadVideo(name, typeof opt.lang === 'string' ? opt.lang : undefined);
  await fetchSources(v.dir);
  sync(v);
  return v;
}

function printPlan(v) {
  say(`${v.name} · ${v.lang} · ${v.width}×${v.height} · ${v.fps} fps · ${v.total.toFixed(2)} s`);
  for (const s of v.scenes) {
    say(`  ${s.start.toFixed(2).padStart(7)}–${s.end.toFixed(2).padEnd(7)} scene ${s.id}`);
    for (const l of v.lines.filter((x) => x.scene === s.id)) {
      const tag = l.draft ? (l.stale ? ' [changed]' : ' [draft]') : '';
      say(`  ${l.start.toFixed(2).padStart(7)}–${l.end.toFixed(2).padEnd(7)}   ${l.id}${tag}: ${l.text ?? '(no text)'}`);
    }
    for (const fx of v.sfx.filter((x) => x.scene === s.id)) say(`  ${fx.start.toFixed(2).padStart(7)}           ♪ ${fx.sound}`);
  }
}

function report(findings) {
  const icon = { error: '✗', warn: '⚠', info: '·' };
  for (const f of findings) say(`  ${icon[f.level]} ${f.msg}`);
  const errors = findings.filter((f) => f.level === 'error').length;
  const warns = findings.filter((f) => f.level === 'warn').length;
  say(`  ${errors} error(s), ${warns} warning(s)`);
  return errors;
}

/** Integrated loudness, true peak and the level of the last seconds of a rendered file. */
function loudness(file, from) {
  const sp = (args) => {
    const r = spawnSync(ffmpegPath(), args, { encoding: 'utf8' });
    return (r.stderr || '') + (r.stdout || '');
  };
  const whole = sp(['-hide_banner', '-nostats', '-i', file, '-vn', '-af', 'ebur128=peak=true', '-f', 'null', '-']);
  const I = /I:\s+(-?[\d.]+) LUFS/.exec(whole.split('Summary:').pop() || '');
  const TP = /Peak:\s+(-?[\d.]+) dBFS/.exec(whole.split('Summary:').pop() || '');
  const tail = sp(['-hide_banner', '-nostats', '-ss', String(from), '-i', file, '-vn', '-af', 'volumedetect', '-f', 'null', '-']);
  const mean = /mean_volume:\s+(-?[\d.]+) dB/.exec(tail);
  return { lufs: I ? Number(I[1]) : null, peak: TP ? Number(TP[1]) : null, tailMean: mean ? Number(mean[1]) : null };
}

/**
 * Brings the mix to `target` LUFS with true peak at most -1.5 dB, two-pass loudnorm,
 * picture copied untouched. video.json "loudness": false leaves the mix as rendered.
 */
function normalizeLoudness(file, target) {
  const ff = (args) => spawnSync(ffmpegPath(), args, { encoding: 'utf8' });
  const probe = ff(['-hide_banner', '-nostats', '-i', file, '-vn', '-af', `loudnorm=I=${target}:TP=-1.5:LRA=11:print_format=json`, '-f', 'null', '-']);
  const m = /\{[^{}]*"input_i"[^{}]*\}/.exec(probe.stderr || '');
  if (!m) return;
  const s = JSON.parse(m[0]);
  if (!Number.isFinite(Number(s.input_i)) || Number(s.input_i) < -70) return;
  const tmp = file.replace(/\.mp4$/, '.norm.mp4');
  const filter = `loudnorm=I=${target}:TP=-1.5:LRA=11:measured_I=${s.input_i}:measured_TP=${s.input_tp}:measured_LRA=${s.input_lra}:measured_thresh=${s.input_thresh}:offset=${s.target_offset}:linear=true`;
  const r = ff(['-v', 'error', '-y', '-i', file, '-map', '0:v', '-map', '0:a', '-c:v', 'copy', '-af', filter, '-ar', '48000', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', tmp]);
  if (r.status === 0) fs.renameSync(tmp, file);
  else fs.rmSync(tmp, { force: true });
}

async function main() {
  const { pos, opt } = parse(process.argv.slice(2));
  const cmd = pos[0];
  const root = workspaceRoot();
  loadEnv(root);

  switch (cmd) {
    case undefined:
    case 'help':
    case '--help':
      say(HELP);
      return 0;

    case 'new': {
      const name = pos[1];
      if (!name || !/^[a-z0-9][a-z0-9-]*$/.test(name)) throw new KitError('Give the video a name of lowercase letters, digits and dashes.');
      const dest = path.join(root, 'videos', name);
      if (fs.existsSync(dest)) throw new KitError(`${rel(dest)} already exists.`);
      fs.cpSync(path.join(KIT_ROOT, 'templates', 'video'), dest, { recursive: true });
      const specFile = path.join(dest, 'video.json');
      const spec = JSON.parse(fs.readFileSync(specFile, 'utf8'));
      if (opt.format) {
        if (!FORMATS[opt.format]) throw new KitError('--format is landscape, portrait or square.');
        spec.format = opt.format;
      }
      if (typeof opt.lang === 'string') spec.lang = opt.lang;
      spec.title = name;
      fs.writeFileSync(specFile, JSON.stringify(spec, null, 2) + '\n');
      say(`Created ${rel(dest)}. Next: fill in brief.md, then video.json and the scenes.`);
      return 0;
    }

    case 'sync': {
      const v = await prepare(pos[1], opt);
      say(`Wrote ${rel(path.join(v.dir, 'index.html'))} (${v.total.toFixed(2)} s).`);
      return 0;
    }

    case 'plan': {
      printPlan(loadVideo(pos[1], typeof opt.lang === 'string' ? opt.lang : undefined));
      return 0;
    }

    case 'voice': {
      const v = loadVideo(pos[1], typeof opt.lang === 'string' ? opt.lang : undefined);
      const force = typeof opt.force === 'string' ? opt.force.split(',') : opt.force === true ? v.lines.map((l) => l.id) : [];
      say(`Voice for ${v.name} [${v.lang}]`);
      const r = await generateVoice(v, { force });
      say(`  made ${r.made.length}, unchanged ${r.kept.length}, failed ${r.failed.length}`);
      for (const f of r.failed) say(`  ✗ ${f.id}: ${f.error}`);
      const after = await prepare(pos[1], { lang: v.lang });
      const errors = report(checkVideo(after).filter((f) => f.level !== 'info' && /line/.test(f.msg)));
      return r.failed.length || errors ? 1 : 0;
    }

    case 'check': {
      const v = await prepare(pos[1], opt);
      say(`Kit checks: ${v.name} [${v.lang}]`);
      const errors = report(checkVideo(v));
      if (opt.quick) return errors ? 1 : 0;
      say('\nHyperFrames check:');
      const code = await hf(['check'], v.dir);
      return errors || code ? 1 : 0;
    }

    case 'stills': {
      const v = await prepare(pos[1], opt);
      let times = pos.slice(2).map((p) => {
        const m = /^([a-z][a-z0-9-]*)@([\d.]+)$/.exec(p);
        if (!m) return Number(p);
        const sc = v.scenes.find((s) => s.id === m[1]);
        if (!sc) throw new KitError(`No scene "${m[1]}".`);
        return sc.start + Number(m[2]);
      });
      if (!times.length) times = v.scenes.flatMap((s) => [s.start + Math.min(0.6, s.dur / 4) + s.fadeIn, s.start + s.dur * 0.6]);
      if (times.some((t) => !(t >= 0))) throw new KitError('Stills are scene@seconds (intro@1.5) or seconds from the start (12.4).');
      const out = path.join(v.dir, 'renders', 'stills');
      fs.rmSync(out, { recursive: true, force: true });
      const code = await hf(['snapshot', '--at', times.map((t) => t.toFixed(3)).join(','), '--no-end', '-o', out], v.dir, { quiet: true });
      if (code) return code;
      for (const f of fs.readdirSync(out).sort()) say(rel(path.join(out, f)));
      return 0;
    }

    case 'preview': {
      const v = await prepare(pos[1], opt);
      return hf(['preview'], v.dir);
    }

    case 'render': {
      const v = await prepare(pos[1], opt);
      const drafts = v.lines.filter((l) => l.draft);
      if (drafts.length) say(`Note: ${drafts.length} voice line(s) have no audio yet (${drafts.map((l) => l.id).join(', ')}); they will be silent.`);
      const quality = { draft: 'draft', standard: 'looks', high: 'delivery' }[opt.quality || 'standard'] || 'looks';
      const file = path.resolve(opt.o || path.join(v.dir, 'renders', `${v.name}-${v.lang}.mp4`));
      fs.mkdirSync(path.dirname(file), { recursive: true });
      const code = await hf(['render', '-o', file, '--quality', quality, '--quiet'], v.dir);
      if (code || !fs.existsSync(file)) return code || 1;
      const target = v.spec.loudness === undefined ? -16 : v.spec.loudness;
      if (target !== false) normalizeLoudness(file, target);
      const len = audioSeconds(file);
      const lv = loudness(file, Math.max(0, len - 3));
      say(`\n${rel(file)}`);
      say(`  length ${len.toFixed(2)} s (video.json: ${v.total.toFixed(2)} s)`);
      say(`  loudness ${lv.lufs ?? '?'} LUFS integrated, true peak ${lv.peak ?? '?'} dBFS, last 3 s mean ${lv.tailMean ?? '?'} dB`);
      say('  Measured, not listened to: watch and listen before sending it anywhere.');
      return 0;
    }

    case 'doctor': {
      const major = Number(process.versions.node.split('.')[0]);
      say(`${major >= 22 ? '✓' : '✗'} Node ${process.versions.node} (22 or newer needed)`);
      for (const [name, fn] of [['ffmpeg', ffmpegPath], ['ffprobe', ffprobePath]]) {
        try {
          say(`✓ ${name}: ${fn()}`);
        } catch (e) {
          say(`✗ ${name}: ${e.message}`);
        }
      }
      say(`✓ HyperFrames ${hfVersion()} (pinned; telemetry off)`);
      const r = await hf(['browser', 'ensure'], root, { capture: true });
      say(`${r.code === 0 ? '✓' : '✗'} browser for rendering${r.code === 0 ? '' : ': ' + r.out.trim().split('\n').pop()}`);
      const keys = ['ELEVENLABS_API_KEY', 'OPENROUTER_API_KEY'].filter((k) => process.env[k]);
      say(`${keys.length ? '✓' : '·'} voice keys: ${keys.length ? keys.join(', ') : 'none set: videos build without a voice until one is (see .env.example)'}`);
      return major >= 22 ? 0 : 1;
    }

    case 'init': {
      const dest = path.resolve(pos[1] || 'video-kit');
      if (fs.existsSync(dest) && fs.readdirSync(dest).length) throw new KitError(`${dest} is not empty.`);
      const skip = new Set(['node_modules', '.git', 'renders', '.hyperframes', '.env', '.DS_Store']);
      // generated inside each video by sync (see .gitignore)
      const generated = /videos[\\/][^\\/]+[\\/](index\.html|meta\.json|assets[\\/]kit)$/;
      fs.cpSync(KIT_ROOT, dest, {
        recursive: true,
        filter: (src) => !skip.has(path.basename(src)) && !generated.test(src),
      });
      const where = rel(dest).startsWith('..') ? dest : rel(dest);
      say(`Copied the kit to ${dest}.\n\n  cd ${where}\n  npm install\n  node kit.mjs doctor\n\nThen open the folder in your coding agent and describe the video you want.`);
      return 0;
    }

    default:
      throw new KitError(`Unknown command "${cmd}".\n\n${HELP}`);
  }
}

main().then(
  (code) => process.exit(code || 0),
  (e) => {
    process.stderr.write(e instanceof KitError ? `${e.message}\n` : `${e.stack || e}\n`);
    process.exit(1);
  },
);
