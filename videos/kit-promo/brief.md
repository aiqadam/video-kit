# Brief: AI Qadam Video Kit

The kit's second example: a video about the kit, made with the kit. It shows its own
files on screen (this brief, its `video.json`, its stills), so those excerpts must match
the files they quote.

## Product
AI Qadam Video Kit: make promo and product videos by talking to any coding agent. The
agent writes a brief, lays out the scenes in HTML, records the voiceover, checks the frames
and renders an MP4. Open source, MIT. An AI Qadam Build project.
Repository: https://github.com/aiqadam/video-kit

## Audience and goal
Developers, founders and makers who land on the repository page or see the video in a
feed; the README embeds it. After a minute they should understand that a video here is
made in steps they can read and change, and open the repository.

## Format
- Length: 56 seconds, 29 bars of the music (125 BPM, a bar is 1.92 s); every cut on a downbeat
- Shape: landscape 16:9, 1920×1080, 30 fps
- Language: English
- Voice: male, calm and confident, like a builder showing their own tool; never salesy
- Music: "Realizer" by Kevin MacLeod (CC BY 4.0), bright synth groove
- Motif: "qadam" is Uzbek for "step"; the kit's workflow has seven steps, and the video
  walks them one by one (a staircase in the opening, a step counter in every scene)

## Facts
| Fact as it will be said | Source |
| ----------------------- | ------ |
| "Qadam" is Uzbek for "step" | https://en.wiktionary.org/wiki/qadam (Uzbek: "step"), read 2026-10-28 |
| The workflow has seven steps: brief, timeline, media, scenes, look, voice, render | `skills/video-kit/SKILL.md`, "The work, in order" |
| You describe the video; the agent writes the brief, scenes, voice, checks frames, renders an MP4 | `README.md`, first paragraph |
| Every number and claim in a video comes from its brief, with a source | `AGENTS.md`, rule 1 |
| Voice lines and all timing live in `video.json` | `README.md`, "One file for timing" |
| Footage and music are added by reference; license and author are recorded | `README.md`, "Media by reference"; `docs/stack.md` |
| Scenes are HTML; motion is a function of time, so every frame renders again exactly | `skills/video-kit/SKILL.md`, opening paragraph |
| The agent renders frames and looks at them before handing over | `AGENTS.md`, rule 2; `skills/video-kit/references/review.md` |
| Every voice take is transcribed back and checked against the script | `README.md`, "Voiceover" |
| The final mix is normalised to −16 LUFS | `README.md`, "Music" |
| The agent says what it did not see or hear | `AGENTS.md`, rule 3 |
| Works with any coding agent that can read files and run commands | `README.md`; GitHub repository description |
| Open source, MIT | `LICENSE`; GitHub repository |
| An AI Qadam Build project | `README.md`, first line |

## Materials
- AI Qadam full lockup, official file `brand/logo-full.svg` from
  https://github.com/aiqadam/brand.aiqadam.org, with the wordmark fill baked to the
  dark-surface colour `#FDFAF5` as the brand guidelines allow; used unchanged otherwise.
- Brand (https://brand.aiqadam.org, read 2026-10-28): dark-first; Circuit teal `#3CA29E`;
  Geist for display, Inter for body, JetBrains Mono for technical detail; eyebrow
  "AI Qadam · <context>" in JetBrains Mono caps; voice "honesty over hype".
- One frame of the kit's example `videos/tutun-lounge/` (scene "ritual", fifth shot, caption "До ровного жара"),
  rebuilt from the same Pexels clip by Samer Daboul.
- Terminal, files and frames are drawn in HTML from the repository's own files.

## Must not
- No logos of agents, editors or other products; the terminal is neutral.
- Do not recolour, animate apart, glow or shadow the AI Qadam mark; the four-dot motif
  appears only inside the logo.
- No claims of speed, quality or popularity (no "10× faster", no star counts).
- No AI-generated imagery (brand rule).
