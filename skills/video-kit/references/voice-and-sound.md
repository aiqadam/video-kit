# Voice and sound

## Voice

`node kit.mjs voice <name> [--lang xx] [--force id,id]` makes every line whose text,
voice or model changed, into `assets/voice/<lang>/<id>.mp3` plus `<id>.json` (text,
length, word timings). Unchanged lines are kept, so editing one line costs one request.
Each file is normalised to −16 LUFS.

The key comes from `ELEVENLABS_API_KEY` in `.env` at the repository root, or from the
environment. An ElevenLabs key starts with `sk_`; a key *ID* does not work.

### ElevenLabs models

| Model | Use |
| ----- | --- |
| `eleven_v3` (default) | most natural, 70+ languages, including Uzbek, Kazakh and other languages `multilingual_v2` lacks |
| `eleven_multilingual_v2` | 29 languages, very stable; good for long English or Russian narration |
| `eleven_flash_v2_5` | fast and cheap drafts |

Voices: the default is George (`JBFqnCBsd6RMkjVDRZzb`). Any voice from the person's
ElevenLabs library works by its id; premade voices work on free plans. Set it in
`video.json` → `voice.voiceId`, per language (`voice.ru.voiceId`) or per line.

### Every take is checked

With `OPENROUTER_API_KEY` set, `voice` transcribes each take back (Gemini Flash, a
fraction of a cent) and compares it with the text, across scripts: "Хуш келибсиз" and
"Xush kelibsiz" count as the same. A take that says something else is made again, up to
three times; what was heard goes into the line's `.json` as `heard`. When no take matches,
rephrase the line rather than forcing it. `"verify": false` in `voice` turns this off.

Silence at both ends of a take is trimmed, so a line's `at` in `video.json` is its first
word, and a pause longer than 1.2 s inside a line is reported.

### Writing lines that sound right

- Write numbers as words when the reading matters ("one thousand five hundred", not
  "1,500"; "twenty twenty-six" or "two thousand twenty-six", as the person prefers).
- Spell brand names phonetically if they are misread ("Nai-kee", "Ky-row"), and write
  abbreviations as letters with hyphens ("A-M-L").
- Short lines are the riskiest: models drop or swap words in them, and they trail off on
  a soft last word ("…вместе с ним"). End a line on a firm word; avoid a leading or
  trailing ellipsis, which makes the voice fade.
- The narration tells the story the pictures do not; it never reads the captions aloud.
  Start each line on the cut of the shot it is about.
- Delivery comes from `instructions` (Gemini, OpenAI, Fish): name the role and the pace
  ("a stylish host inviting a guest in; natural, lively pace, not sleepy"). "Slow and
  intimate" made a 40-second ad sound like a lullaby.
- Brand names: mark the stress (`Тутýн`) or write them in the language of the voice.
- One sentence or two per line. Lines in another language are fine inside one video;
  eleven_v3 detects the language per line.
- The narrator should not be silent for long: gaps under about 5 s.

### Choosing a voice for a language

ElevenLabs' premade voices are native English speakers: in Russian, Uzbek or Kazakh they
sound foreign. Native voices from the ElevenLabs library need a paid plan through the
API ("Free users cannot use library voices via the API"). With a free plan, use
OpenRouter for other languages. Make two or three samples of the first lines and let the
person choose by ear; you cannot hear them.

### OpenRouter

One key (`OPENROUTER_API_KEY`) reaches many speech models:

```json
"voice": { "provider": "openrouter", "model": "microsoft/mai-voice-2.1", "voiceId": "ru-RU-Lev:MAI-Voice-2.1" }
"voice": { "provider": "openrouter", "model": "google/gemini-3.8-flash-tts", "voiceId": "Charon",
           "instructions": "Speak slowly, low and warm, relaxed, like late at night." }
```

| Model | Good for |
| ----- | -------- |
| `microsoft/mai-voice-2.1` | native voices per language (`ru-RU-Lev`, `ru-RU-Masha`, …) |
| `google/gemini-3.8-flash-tts` | any language, delivery steered by `instructions` |
| `elevenlabs/eleven-v3` | the ElevenLabs premade voices, billed through OpenRouter |
| `minimax/speech-2.8-hd`, `fish-audio/s2.1-pro` | expressive narration |

The current list with voices and prices:
`https://openrouter.ai/api/v1/models?output_modalities=speech`. `speed` changes the pace
where the model supports it. OpenRouter returns no word timings, so `s.word()` falls back
to the line start.

### Other providers

`lib/voice.mjs` has a `PROVIDERS` table. A provider is
`async (text, options) → {audio: Buffer (mp3), words: [{w, start, end}]}`.
To add one (OpenAI, Google, Azure, a local model), write that function, register it
under a name, and set `voice.provider` in `video.json`. Keys go in `.env`.

## Music

- `"music": {"source": "synth", "style": "calm"}` generates a quiet ambient bed to the
  video's length; `"hijaz"` gives Central Asian and Middle Eastern colour. It is a
  placeholder that stays out of the voice's way, not a composed track.
- `"music": {"source": "file", "file": "assets/music/track.mp3"}` uses the person's track
  (credit it). It is trimmed to the video and faded at the end.
- The music dips under the voice automatically (`duck`, default 0.35 of its level).

## Interface sounds

`sfx` entries in `video.json` place `tap`, `key`, `pop`, `whoosh` and `success`, or a
file. Every sound needs a cause on screen at the same moment: a tap on a tap, a key per
typed letter, a pop when a number lands, a whoosh on a fast cut. Few and exact.

## Checking sound

`render` normalises the finished mix to `loudness` (default −16 LUFS, true peak −1.5 dB) and prints integrated loudness, true peak and the level of the last 3 s. Aim for
about −16 to −14 LUFS with true peak below −1 dB. A last-3-seconds level far below the
rest means the music stopped early. You cannot hear the mix; say so.
