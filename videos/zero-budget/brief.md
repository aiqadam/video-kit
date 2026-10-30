# Brief: Zero Budget — a promo video that costs nothing

The kit's third example: a promo video about making a promo video for zero dollars.
It is also a receipt: every scene adds one line to a bill whose total never moves off
$0.00. The model that writes the video, `opencode/mimo-v2.6-flash-free`, is the model
the video is about; the voice is generated offline on the same machine. Everything the
video claims about itself must be checkable in this repository.

## Product
The AI Qadam Video Kit (this repository) running inside opencode on
`opencode/mimo-v2.6-flash-free`, with local Kokoro 82M for voice: a stack whose every
layer is free. Repository: https://github.com/aiqadam/video-kit

## Audience and goal
Developers, founders and makers who see the video in a feed or on the repository page
and assume a promo like this needs a budget. After fifty seconds they should know
exactly which line items made it free — model, pipeline, voice, music, render — and
that the whole thing is reproducible from the repository.

## Format
- Length: about 50 seconds; every cut on a downbeat of the music
- Shape: landscape 16:9, 1920×1080, 30 fps
- Language: English
- Voice: female, calm and dry, a developer reading an invoice; never salesy. Kokoro 82M
  (Apache-2.0), speaker af_heart, generated offline on this Mac
- Music: a licensed CC BY track found with `media search` (incompetech, Kevin MacLeod),
  credited on screen
- Motif: a receipt. A running total pinned at $0.00 in the corner of every scene;
  each scene prints one more line of the bill; the last scene totals it.

## Facts
| Fact as it will be said | Source |
| ----------------------- | ------ |
| `opencode/mimo-v2.6-flash-free` is available through opencode and charges nothing for input, output or cached tokens | opencode model registry (`models` lookup), read 2026-10-30 |
| The video's brief, timeline and scenes were written by that model | this repository, `videos/zero-budget/`, session of 2026-10-30 |
| The kit is MIT | `LICENSE` |
| HyperFrames renders the frames; it is Apache-2.0 | `docs/stack.md`, "Always installed" |
| ffmpeg is GPL-3.0, Chrome is free to run headless | `docs/stack.md`, "Always installed" |
| The voice is Kokoro 82M via mlx-audio, Apache-2.0, offline on an Apple Silicon Mac | `docs/stack.md`, "Voice"; `node kit.mjs tts list` |
| Every voice take is transcribed back and checked against the script | `skills/video-kit/references/voice-and-sound.md`, "Every take is checked" |
| The mix is normalised to −16 LUFS | `README.md`, "Music" |
| The music is CC BY 4.0 and is credited on screen | the track's license, incompetech.com |
| The final MP4 is produced by one command, `node kit.mjs render zero-budget` | `AGENTS.md`, "Commands" |

## Materials
- Geist and JetBrains Mono, OFL-1.1, copied from `videos/kit-promo/assets/fonts/` with
  their license texts
- A CC BY music track fetched with `media add`, recorded in `assets/sources.json`
- Terminal output is redrawn in HTML from this repository's own commands and files
- No logos: `opencode`, `MiMo-V2.6-Flash Free` and `Kokoro` appear as plain text only

## Must not
- No claims of speed, quality or popularity; no comparison with paid tools and no
  "why pay" taunting — the video describes its own stack and its own prices, nothing else
- No logos of opencode, Kokoro, HyperFrames or any other product; plain mono text
- No invented numbers: the only figures on screen are prices ($0.00), licenses and the
  loudness target
- No AI-generated imagery
