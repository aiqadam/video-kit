# AI Qadam Video Kit

An [AI Qadam Build](https://build.aiqadam.org) project.

Make promo, pitch and product videos by talking to a coding agent. You describe the
video; the agent writes a brief, lays out the scenes in HTML, records the voiceover,
checks the frames and renders an MP4.

It works with any agent that can read files and run commands (Claude Code, Codex,
OpenCode, Cursor, Gemini CLI and others) on macOS, Windows and Linux. The whole stack
is open source: rendering by [HyperFrames](https://github.com/heygen-com/hyperframes)
(Apache-2.0), motion by the kit's own runtime (MIT), ffmpeg installed with the packages.

## What you get

- **A workflow the agent follows**: brief with sourced facts → timeline → scenes →
  checks and stills → voice → render (`AGENTS.md`, `skills/video-kit/`).
- **One file for timing.** `video.json` holds the scenes, voice lines and sounds, each
  relative to its scene, so lengthening a scene never desynchronises the voice.
- **Product screens drawn in code** and acted out: taps, typing, screen changes.
- **Voiceover** three ways: ElevenLabs; OpenRouter (one key for Microsoft MAI-Voice with
  native voices per language, Gemini TTS, MiniMax, Fish Audio and more); or free local
  engines (Qwen3-TTS on Apple Silicon, Piper anywhere) with no account at all. Every take
  is transcribed back and checked against the script.
- **Music and interface sounds generated** to the video's length, or your own track.
  The music dips under the voice by itself.
- **Media by reference**: `media search` (Wikimedia Commons, Openverse) and `media add`
  (Pexels by clip number, Commons, Openverse, any URL with its license): the license and
  author are recorded, the file is fetched and trimmed, and a preview is made to look at.
- **Checks** for timing, overlaps, missing translations, uncredited assets, plus
  HyperFrames' layout, contrast and audio checks; the render reports its loudness.
- **Any shape**: landscape, portrait, square, or a custom size.

## Start

You need [Node.js](https://nodejs.org) 22 or newer.

```bash
git clone https://github.com/aiqadam/video-kit.git
cd video-kit
npm install
node kit.mjs doctor
```

or, without cloning:

```bash
npx github:aiqadam/video-kit init my-videos
cd my-videos && npm install
```

For a voiceover, copy `.env.example` to `.env` and put an
[ElevenLabs key](https://elevenlabs.io/app/developers/api-keys) or an
[OpenRouter key](https://openrouter.ai/settings/keys) in it, or install a free local
engine: `node kit.mjs tts list`, then `node kit.mjs tts setup qwen3-mlx` (Apple Silicon)
or `node kit.mjs tts setup piper` (any OS). Without a key
everything works except the voice: lines are timed by an estimate and stay silent.

Then open the folder in your coding agent and say what you need, in any language:

> Make a 40-second vertical video for our coffee shop's Instagram. Here is our menu and logo.

The agent asks for whatever is missing (facts, audience, voice) and builds it under
`videos/<name>/`.

## The example

`videos/tutun-lounge/` is a 42-second ad for an invented hookah lounge in Tashkent:
the ritual in close-ups (tobacco, bowl, foil, coals, the first draw), cut on the beat of a
CC BY track, big type, Russian narration with an Uzbek welcome. The footage comes from
Pexels; the kit downloads and trims it on the first build (`assets/sources.json`).

```bash
node kit.mjs render tutun-lounge
```

The file lands in `videos/tutun-lounge/renders/`.

## Commands

```
node kit.mjs new <name> [--format landscape|portrait|square] [--lang ru]
node kit.mjs plan <video>                  when each scene, line and sound plays
node kit.mjs check <video> [--quick]       kit checks, then HyperFrames checks
node kit.mjs stills <video> [scene@sec …]  PNG frames and a contact sheet
node kit.mjs voice <video> [--force id]    make new or changed voice lines
node kit.mjs preview <video>               scrub through it in the browser
node kit.mjs render <video> [--lang xx] [--quality draft|standard|high] [-o file]
node kit.mjs media search <words> | add <video> <ref>   find and add licensed media
node kit.mjs tts list | setup <engine>      free local voice engines
node kit.mjs doctor                        check Node, ffmpeg, browser, keys, engines
```

## Contributing

Issues and pull requests are welcome. Sign off your commits (`git commit -s`, the
[DCO](https://developercertificate.org/)); see `CONTRIBUTING.md`.

## Licenses

The kit is MIT. It installs HyperFrames (Apache-2.0), ffmpeg via `ffmpeg-static` and
`@ffprobe-installer/ffprobe` (the ffmpeg binaries are GPL; they are downloaded at
install, not shipped here), and Inter (OFL). HyperFrames' anonymous telemetry is switched off for every
command the kit runs. The example's photos and fonts are credited in
`videos/tutun-lounge/assets/CREDITS.md` and `sources.json`. What you render is yours; check the licenses of
the media and voices you add. The example's voice files were made with Google Gemini TTS
through OpenRouter; they are not covered by the MIT license, and their use follows the
provider's terms. For your own video, make the voice again with your own key.
