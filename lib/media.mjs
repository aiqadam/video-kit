// Finding and adding outside media. `search` asks sources that have an open API;
// `add` turns a reference (pexels:<id>, commons:File:<name>, openverse:<audio|image>/<id>
// or a URL) into an entry in assets/sources.json with its license, downloads and trims it,
// and makes a preview to look at. Pexels has no open search: find clips with your own web
// search and add them by number.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { ffmpegPath } from './tools.mjs';
import { readSources, sourcesFile, fetchSources } from './fetch.mjs';
import { audioSeconds } from './voice.mjs';
import { workspaceRoot } from './video.mjs';

const UA = 'ai-qadam-video-kit/0.1 (+https://github.com/aiqadam/video-kit)';
const PEXELS_LICENSE = 'Pexels License (free to use, no attribution required; do not redistribute the original files)';

const clean = (html) => String(html || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

/** fetch with a 30 s limit and an error that says which service did not answer. */
async function call(url, init = {}) {
  try {
    return await fetch(url, { ...init, headers: { 'User-Agent': UA, ...(init.headers || {}) }, signal: AbortSignal.timeout(30000) });
  } catch (e) {
    if (e.name !== 'TimeoutError' && e.name !== 'AbortError') throw e;
    const host = new URL(url).host;
    const hint = host.includes('openverse') ? ' Its API was down from 2026-10-20 (github.com/WordPress/openverse/issues/5649); use --source commons meanwhile.' : '';
    throw new Error(`${host} did not answer in 30 s.${hint}`);
  }
}

async function getJson(url, headers = {}) {
  const res = await call(url, { headers });
  if (!res.ok) throw new Error(`${new URL(url).host} answered ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

// ── Wikimedia Commons: open API, no key, every file with license and author ──

const COMMONS = 'https://commons.wikimedia.org/w/api.php';
const COMMONS_TYPES = { video: 'filetype:video', image: 'filetype:bitmap', audio: 'filetype:audio' };

function commonsItem(page) {
  const ii = page.imageinfo[0];
  const m = ii.extmetadata || {};
  return {
    ref: `commons:${page.title}`,
    title: page.title.replace(/^File:/, ''),
    author: clean(m.Artist && m.Artist.value),
    license: clean(m.LicenseShortName && m.LicenseShortName.value),
    page: ii.descriptionurl,
    url: ii.url.split('?')[0],
    size: ii.width ? `${ii.width}×${ii.height}` : '',
    duration: ii.duration ? Number(ii.duration).toFixed(1) + ' s' : '',
  };
}

async function commonsSearch(query, type, limit) {
  const q = new URLSearchParams({
    action: 'query', format: 'json', generator: 'search', gsrnamespace: '6', gsrlimit: String(limit),
    gsrsearch: `${query} ${COMMONS_TYPES[type] || ''}`.trim(),
    prop: 'imageinfo', iiprop: 'url|size|extmetadata|mediatype', iiextmetadatafilter: 'LicenseShortName|Artist',
  });
  const j = await getJson(`${COMMONS}?${q}`);
  return Object.values((j.query && j.query.pages) || {}).sort((a, b) => a.index - b.index).map(commonsItem);
}

async function commonsResolve(title) {
  const q = new URLSearchParams({ action: 'query', format: 'json', titles: title, prop: 'imageinfo', iiprop: 'url|size|extmetadata', iiextmetadatafilter: 'LicenseShortName|Artist' });
  const page = Object.values((await getJson(`${COMMONS}?${q}`)).query.pages)[0];
  if (!page || !page.imageinfo) throw new Error(`Commons has no file "${title}".`);
  return commonsItem(page);
}

// ── Openverse: CC images and audio; needs a free registration (see `media openverse-register`) ──

const OPENVERSE = 'https://api.openverse.org/v1';
let ovToken = null;

async function openverseToken() {
  if (ovToken) return ovToken;
  const id = process.env.OPENVERSE_CLIENT_ID, secret = process.env.OPENVERSE_CLIENT_SECRET;
  if (!id || !secret) {
    throw new Error('Openverse search needs a free registration: node kit.mjs media openverse-register --email you@example.org (anonymous search does not answer).');
  }
  const res = await call(`${OPENVERSE}/auth_tokens/token/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: id, client_secret: secret }),
  });
  if (!res.ok) throw new Error(`Openverse token: ${res.status} ${(await res.text()).slice(0, 200)}`);
  ovToken = (await res.json()).access_token;
  return ovToken;
}

function openverseItem(kind, r) {
  return {
    ref: `openverse:${kind}/${r.id}`,
    title: r.title,
    author: r.creator || '',
    license: `${String(r.license || '').toUpperCase()} ${r.license_version || ''}`.trim(),
    page: r.foreign_landing_url,
    url: r.url,
    size: r.width ? `${r.width}×${r.height}` : '',
    duration: r.duration ? (r.duration / 1000).toFixed(1) + ' s' : '',
  };
}

async function openverseSearch(query, type, limit) {
  const kind = type === 'audio' ? 'audio' : 'images';
  const auth = { Authorization: `Bearer ${await openverseToken()}` };
  const j = await getJson(`${OPENVERSE}/${kind}/?${new URLSearchParams({ q: query, page_size: String(limit) })}`, auth);
  return (j.results || []).map((r) => openverseItem(kind === 'audio' ? 'audio' : 'image', r));
}

async function openverseResolve(ref) {
  const [kind, id] = ref.split('/');
  const auth = { Authorization: `Bearer ${await openverseToken()}` };
  return openverseItem(kind, await getJson(`${OPENVERSE}/${kind === 'audio' ? 'audio' : 'images'}/${id}/`, auth));
}

/** Registers a free Openverse application and returns its client id and secret. */
export async function openverseRegister(email, name = 'AI Qadam Video Kit user') {
  const res = await call(`${OPENVERSE}/auth_tokens/register/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: `${name} (${email.split('@')[0]})`, description: 'Finding CC-licensed images and audio for videos made with AI Qadam Video Kit (github.com/aiqadam/video-kit).', email }),
  });
  if (!res.ok) {
    const body = (await res.text()).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    throw new Error(`Openverse registration answered ${res.status}: ${body.slice(0, 160)}. If it is a 5xx, the service is down; try again later.`);
  }
  return res.json();
}

// ── incompetech.com: Kevin MacLeod's catalogue, CC BY 4.0, an open JSON list ──

const INCOMPETECH = 'https://incompetech.com/music/royalty-free';

async function incompetechCatalog() {
  const cache = path.join(workspaceRoot(), '.kit', 'cache', 'incompetech.json');
  if (fs.existsSync(cache) && Date.now() - fs.statSync(cache).mtimeMs < 7 * 864e5) return JSON.parse(fs.readFileSync(cache, 'utf8'));
  const list = await getJson(`${INCOMPETECH}/pieces.json`);
  fs.mkdirSync(path.dirname(cache), { recursive: true });
  fs.writeFileSync(cache, JSON.stringify(list));
  return list;
}

function incompetechItem(p) {
  const credit = `"${p.title}" Kevin MacLeod (incompetech.com) Licensed under Creative Commons: By Attribution 4.0 License http://creativecommons.org/licenses/by/4.0/`;
  return {
    ref: `incompetech:${p.title}`,
    title: p.title,
    author: 'Kevin MacLeod (incompetech.com)',
    license: 'CC BY 4.0',
    page: `${INCOMPETECH}/index.html?isrc=${p.isrc}`,
    url: `${INCOMPETECH}/mp3-royaltyfree/${encodeURIComponent(p.filename || p.title + '.mp3')}`,
    size: [p.bpm && p.bpm !== 'None' ? `${p.bpm} BPM` : '', p.feel, p.instruments].filter(Boolean).join(' · '),
    duration: String(p.length || '').replace(/^00:/, ''),
    credit,
  };
}

async function incompetechSearch(query, opt, limit) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const feels = String(opt.feel || '').toLowerCase().split(',').map((x) => x.trim()).filter(Boolean);
  const [lo, hi] = String(opt.bpm || '').split('-').map(Number);
  const seconds = (l) => String(l || '0:0').split(':').reduce((a, b) => a * 60 + Number(b), 0);
  const scored = (await incompetechCatalog())
    .map((p) => {
      const hay = [p.title, p.feel, p.instruments, p.description].join(' ').toLowerCase();
      const bpm = Number(p.bpm);
      if (feels.some((f) => !String(p.feel || '').toLowerCase().includes(f))) return null;
      if (lo && !(bpm >= lo && bpm <= (hi || lo))) return null;
      if (opt.min && seconds(p.length) < Number(opt.min)) return null;
      const hits = words.filter((w) => hay.includes(w)).length;
      return words.length && !hits ? null : { p, hits };
    })
    .filter(Boolean)
    .sort((a, b) => b.hits - a.hits);
  return scored.slice(0, limit).map((x) => incompetechItem(x.p));
}

async function incompetechResolve(title) {
  const p = (await incompetechCatalog()).find((x) => x.title.toLowerCase() === title.toLowerCase());
  if (!p) throw new Error(`incompetech has no track "${title}"; search with: node kit.mjs media search <words> --source incompetech`);
  return incompetechItem(p);
}

// ── search and add ──

export async function search(query, { source = 'commons', type = 'video', limit = 10, ...opt } = {}) {
  if (source === 'commons') return commonsSearch(query, type, limit);
  if (source === 'incompetech') return incompetechSearch(query, opt, limit);
  if (source === 'openverse') return openverseSearch(query, type, limit);
  if (source === 'pexels') {
    throw new Error('Pexels has no open search. Find clips with your own web search (pexels.com/search/videos/<words>/), then: node kit.mjs media add <video> pexels:<id>');
  }
  throw new Error(`Unknown source "${source}": commons, incompetech, openverse or pexels.`);
}

async function resolve(ref, opt) {
  if (/^pexels:\d+$/.test(ref)) {
    const id = ref.split(':')[1];
    return {
      url: `https://www.pexels.com/download/video/${id}/`,
      page: opt.page || `https://www.pexels.com/video/${id}/`,
      author: opt.author || '',
      license: PEXELS_LICENSE,
      title: `pexels-${id}`,
      kind: 'video',
    };
  }
  if (ref.startsWith('commons:')) return { ...(await commonsResolve(ref.slice(8))), kind: null };
  if (ref.startsWith('incompetech:')) return { ...(await incompetechResolve(ref.slice(12))), kind: 'audio' };
  if (ref.startsWith('openverse:')) return { ...(await openverseResolve(ref.slice(10))), kind: null };
  if (/^https?:\/\//.test(ref)) {
    if (!opt.license) throw new Error('For a plain URL give --license (and --author, --page): the kit will not add media it cannot credit.');
    return { url: ref, page: opt.page || ref, author: opt.author || '', license: opt.license, title: path.basename(new URL(ref).pathname), kind: null };
  }
  throw new Error('Refer to media as pexels:<id>, commons:File:<name>, incompetech:<title>, openverse:<audio|image>/<id> or a URL.');
}

const slug = (s) => String(s).toLowerCase().replace(/\.[a-z0-9]+$/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'media';

/**
 * Adds a reference to the video's sources.json, fetches it, and returns
 * {entry, file, info, preview} where preview is a contact strip of a video, if any.
 */
export async function addMedia(dir, ref, opt = {}) {
  const r = await resolve(ref, opt);
  const ext = path.extname(new URL(r.url).pathname).toLowerCase();
  const isAudio = /\.(mp3|wav|ogg|oga|flac|m4a)$/.test(ext) || opt.audio;
  const isImage = /\.(jpe?g|png|webp|gif|tiff?)$/.test(ext);
  const folder = isAudio ? 'music' : isImage ? 'images' : 'clips';
  const outExt = isAudio ? (ext === '.wav' ? '.wav' : '.mp3') : isImage ? '.jpg' : '.mp4';
  const file = opt.as || `${folder}/${slug(opt.name || r.title)}${outExt}`;
  const entry = { file, url: r.url, page: r.page, author: r.author, license: r.license };
  if (r.credit) entry.credit = r.credit;
  if (opt.trim) entry.trim = String(opt.trim).split(',').map(Number);
  if (opt.crop) entry.crop = opt.crop;
  if (!isAudio && !isImage) entry.width = Number(opt.width) || 1920;
  if (isImage) entry.image = true;

  const list = readSources(dir).filter((s) => s.file !== file);
  list.push(entry);
  fs.mkdirSync(path.dirname(sourcesFile(dir)), { recursive: true });
  fs.writeFileSync(sourcesFile(dir), JSON.stringify(list, null, 2) + '\n');
  await fetchSources(dir, () => {});

  const abs = path.join(dir, 'assets', 'fetched', file);
  const info = isImage ? '' : `${audioSeconds(abs).toFixed(2)} s`;
  let preview = null;
  if (!isAudio && !isImage) {
    preview = abs.replace(/\.mp4$/, '.preview.jpg');
    const len = audioSeconds(abs);
    const at = [0.1, 0.5, 0.9].map((p) => (len * p).toFixed(2));
    const args = ['-v', 'error', '-y'];
    for (const t of at) args.push('-ss', t, '-i', abs);
    args.push('-filter_complex', at.map((_, i) => `[${i}:v]scale=480:-2,setsar=1[v${i}]`).join(';') + ';' + at.map((_, i) => `[v${i}]`).join('') + 'hstack=inputs=3', '-frames:v', '1', preview);
    execFileSync(ffmpegPath(), args);
  }
  if (!entry.author) entry.warn = 'no author given: add --author (the credit should name who made it)';
  return { entry, file: abs, info, preview };
}
