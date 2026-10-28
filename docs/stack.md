# The stack

What AI Qadam Video Kit is made of, what each part does, what is required and what is
optional, and how a video goes from `video.json` to an MP4. Versions are the ones pinned
in this repository.

## How a video is made

```
 brief.md ─── facts and their sources (the agent writes it with the person)
    │
 video.json ── format, scenes, voice lines, sounds, music: every time relative to its scene
    │
    ├─ node kit.mjs media add ──► assets/sources.json ──► assets/fetched/   footage, photos, music
    ├─ node kit.mjs voice ──────► assets/voice/<lang>/                       each take transcribed and checked
    │
 node kit.mjs sync                (every other command runs it first)
    │   index.html: scene hosts, voice, music with ducking, sounds, theme, fonts
    │   assets/kit/: motion runtime, Inter, generated music bed and interface sounds
    ▼
 compositions/<scene>.html ── HTML + CSS; motion from runtime/kit.js as a function of time
    │
 HyperFrames ── headless Chrome seeks every frame, ffmpeg encodes, Web Audio mixes
    │
 node kit.mjs render ── two-pass loudness to −16 LUFS, limiter, report ──► renders/<name>-<lang>.mp4
```

`node kit.mjs check` runs the kit's checks (timing, overlaps, translations, credits) and
then HyperFrames' (lint, runtime, layout, contrast, motion, audio). `stills` renders
frames to look at; `preview` opens a live player.

## Components

### Always installed (`npm install`)

| Part | What it does | Version | License |
| ---- | ------------ | ------- | ------- |
| Node.js | runs everything; the kit has no other runtime requirement | 22 or newer | MIT |
| kit (`kit.mjs`, `lib/`, `runtime/`, `skills/`) | CLI, timeline, sync, voice, media, checks; the motion runtime scenes use | this repo | MIT |
| [HyperFrames](https://github.com/heygen-com/hyperframes) | renders HTML to video, checks, stills, preview; telemetry switched off by the kit | 0.8.212, pinned | Apache-2.0 |
| Chrome (headless) | the browser HyperFrames captures frames with; downloaded on first use | managed by HyperFrames | Chrome terms |
| [ffmpeg-static](https://github.com/eugeneware/ffmpeg-static) | ffmpeg binary, used when the system has none; the kit reads its path and runs it as a separate program, never loading the package's code | 5.3.0 (ffmpeg 6.0) | GPL-3.0 (package and binary), downloaded at install |
| [@ffprobe-installer/ffprobe](https://github.com/SavageCore/node-ffprobe-installer) | ffprobe binary per platform | 2.1.2 | LGPL-2.1 |
| [Inter](https://rsms.me/inter/) | default typeface, Latin and Cyrillic | @fontsource-variable/inter 5.3.0 | OFL-1.1 |

The HyperFrames package also carries GSAP for its own studio; the kit's scenes do not use
it and it is not loaded into renders.

### Voice: one of these per video (`video.json` → `voice.provider`)

| Provider | Needs | Notes |
| -------- | ----- | ----- |
| `openrouter` | `OPENROUTER_API_KEY` | one key for many speech models: Microsoft MAI-Voice (native voices per language), Google Gemini TTS (delivery steered by words), ElevenLabs, MiniMax, Fish Audio; pay per character |
| `elevenlabs` | `ELEVENLABS_API_KEY` | word timings; premade voices are native English; library voices need a paid plan through the API; free plan output is non-commercial |
| `local` | Python 3.10–3.13 and `node kit.mjs tts setup <engine>` | free, offline: `qwen3-mlx` (Qwen3-TTS 1.7B via mlx-audio 0.6.2, Apple Silicon, Apache-2.0 model) or `piper` (piper-tts 1.8.0, GPL-3.0, any OS; voice licenses per voice). Engines run as separate processes; `tts/piper/run.py` is GPL-3.0-or-later because it imports piper |

With `OPENROUTER_API_KEY` set, every take from any provider is transcribed back (Google
Gemini 2.5 Flash through OpenRouter) and compared with the script; a mismatching take is
made again up to three times.

Without any of them the video still builds, with the voice lines timed by an estimate
and silent.

### Media: fetched by reference, never committed

| Source | Access | What | License |
| ------ | ------ | ---- | ------- |
| [Pexels](https://www.pexels.com) | clips found with the agent's web search, added by number (`pexels:<id>`) through the public download link | stock video | Pexels License: free, commercial use allowed, no redistribution of the raw files, no implied endorsement |
| [Wikimedia Commons](https://commons.wikimedia.org) | open API, no key: `media search`, `commons:File:<name>` | video, photos, audio | per file (CC0, CC BY, CC BY-SA, public domain) |
| [incompetech.com](https://incompetech.com) | open catalogue, no key: `media search --type audio`, `incompetech:<title>` | music by mood and tempo | CC BY 4.0, credit required |
| [Openverse](https://openverse.org) | free registration per user (`media openverse-register`) | CC photos and audio | per file; its API has been down since 2026-10-20 |

`media add` writes each item into `assets/sources.json` (url, page, author, license,
credit, trim); the kit downloads, trims, crops and scales it into `assets/fetched/` on the
first build and makes a preview. `check` lists CC BY credits that no scene shows.

### Generated by the kit

| What | How |
| ---- | --- |
| music bed | `lib/audio/music.mjs`, synthesised to the video's length (`calm`, `hijaz`), when no track is given |
| interface sounds | `lib/audio/sfx.mjs`: tap, key, pop, whoosh, success |
| final mix | HyperFrames' Web Audio graph (voice chain, music ducked under the voice), then ffmpeg loudness normalisation and a limiter |

## License of this repository

MIT, except `tts/piper/run.py` (GPL-3.0-or-later), the example's fonts (OFL) and voice
files (provider's terms); see the README. GPL and LGPL tools (ffmpeg, ffprobe, Piper) are
installed by the user and run as separate programs, so they do not change the license of
the kit or of the videos made with it.

## Where things are configured

| What | Where |
| ---- | ----- |
| keys | `.env` at the repository root (gitignored); see `.env.example` |
| local voice engines | `tts/<engine>/` (code), `.kit/tts/<engine>/` (installed, gitignored) |
| caches | `.kit/cache/` (incompetech catalogue), `~/.cache/hyperframes/` (Chrome, fonts), `~/.cache/huggingface/` (local models) |
| a video | `videos/<name>/`: `brief.md`, `video.json`, `compositions/`, `assets/` |

## Requirements by task

| To | You need |
| -- | -------- |
| render the example | Node 22+, `npm install`, internet on the first build (footage, music, Chrome) |
| make a new video without voice | the same |
| voice it | a key (OpenRouter or ElevenLabs) or a local engine |
| check voice takes | `OPENROUTER_API_KEY` |
| search photos and audio on Openverse | an Openverse registration, and the service being up |
