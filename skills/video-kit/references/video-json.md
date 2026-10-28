# video.json

All timing lives here, in seconds. `node kit.mjs sync` turns it into the `index.html`
HyperFrames renders; every other command syncs first.

```json
{
  "title": "Acme launch",
  "format": "landscape",
  "fps": 30,
  "lang": "en",
  "locales": ["en", "ru"],
  "transition": 0.3,
  "maxSilence": 5,
  "theme": { "bg": "#101014", "ink": "#f4f2ee", "muted": "rgba(244,242,238,.62)", "accent": "#e0a43c", "display": "'Brand', serif" },
  "fonts": [{ "family": "Brand", "src": "assets/fonts/brand.woff2", "weight": "400 900", "range": "U+0000-00FF" }],
  "voice": { "provider": "elevenlabs", "voiceId": "JBFqnCBsd6RMkjVDRZzb", "model": "eleven_v3" },
  "music": { "source": "synth", "style": "calm", "volume": 0.4, "duck": 0.35 },
  "sfxVolume": 0.6,
  "strings": { "en": { "intro.title": "Meet Acme" }, "ru": { "intro.title": "Знакомьтесь, Acme" } },
  "scenes": [
    {
      "id": "intro",
      "dur": 6,
      "lines": [{ "id": "01", "at": 0.6, "text": { "en": "Meet Acme.", "ru": "Знакомьтесь, Acme." } }],
      "sfx": [{ "at": 0.2, "sound": "whoosh", "gain": 0.5 }]
    }
  ]
}
```

## Fields

| Field | Meaning |
| ----- | ------- |
| `format` | `landscape` 1920×1080, `portrait` 1080×1920, `square` 1080×1080, or `{"width", "height"}` |
| `fps` | 30 unless a spec says otherwise (25 for some venue screens and broadcast) |
| `lang` | default language; `--lang` on any command picks another |
| `transition` | crossfade between scenes, seconds; scenes overlap by this much |
| `maxSilence` | `check` warns when two voice lines are further apart than this |
| `theme` | CSS variables for every scene: `var(--bg)`, `var(--accent)` and so on; add your own keys |
| `fonts` | `@font-face` rules: one entry per file; `range` is the unicode-range when a family is split by script |
| `voice` | provider and its options; per-language overrides as `"voice": {"uz": {"voiceId": "…"}}`; per-line as `"voice"` on the line |
| `music` | `{"source": "synth", "style": "calm" or "hijaz"}`, `{"source": "file", "file": "assets/music/x.mp3"}` or `{"source": "none"}`; `volume` 0–1, `duck` is the level under the voice |
| `scenes[].id` | lowercase letters, digits, dashes; the scene file is `compositions/<id>.html` unless `src` says otherwise |
| `scenes[].dur` | the scene's length including its share of the crossfade |
| `lines[]` | `id` (unique in the video), `at` (seconds from the scene start), `text` (a string, or one per language) |
| `sfx[]` | `at`, `sound` (`tap`, `key`, `pop`, `whoosh`, `success`, or a file path), `gain` |

## The arithmetic

Scene *i* starts at the end of scene *i − 1* minus `transition`. The video's length is the
sum of `dur` minus `transition` for every cut. A line plays at its scene's start plus `at`.
`node kit.mjs plan` prints the result; read it instead of adding up by hand.

Lengthening a scene moves everything after it, lines and sounds included, because they
are relative to their scene. That is the point: never write absolute times anywhere else.

## Lines and their length

Before a line has audio its length is estimated from the text (about 14 characters a
second) and `plan` marks it `[draft]`. After `node kit.mjs voice` the real length is used.
Changing a line's text marks it `[changed]` until the voice is made again.

A scene can follow its voice: `s.line("03").start` and `s.word("03", "fourteen")` give
times inside the scene (see `scenes.md`), so text can land on the word that says it.

## Several languages

Give each line `text` per language, put on-screen text in `strings` (or
`strings/<lang>.json`) and mark it in the scene with `data-t="key"`. Then
`node kit.mjs render <name> --lang ru` renders that language. Write each language's text
for itself rather than translating at the end: lengths differ by 20% or more, so check
stills in every language.

## Formats

A video has one format. For another shape make a second video folder (`new`, then copy
the brief and `video.json`) and lay the scenes out again for that shape: a portrait frame
is not a cropped landscape one. Scenes can share CSS and markup patterns, not positions.
