# Asset credits

Footage and music are not stored in this repository: their sources, authors and licenses
are in `sources.json`, and the kit downloads and trims them into `fetched/` on the first
build. Pexels footage is used under the Pexels License; the music is CC BY 4.0.

Music: "Desert City" Kevin MacLeod (incompetech.com), licensed under Creative Commons:
By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/

| File | What | Source | Author | License |
| ---- | ---- | ------ | ------ | ------- |
| fonts/oswald-*.woff2 | Oswald, latin, latin-ext and cyrillic subsets (@fontsource-variable/oswald 5.3.0) | [Google Fonts](https://fonts.google.com/specimen/Oswald) | Vernon Adams, Kalapi Gajjar, Cyreal | [OFL 1.1](fonts/OFL-oswald.txt) |

The voice files in voice/ were generated with Google Gemini 3.8 Flash TTS (voice Sulafat)
through OpenRouter. They are not covered by the repository's MIT license; their use
follows the provider's terms. To make your own, set a key and run
`node kit.mjs voice tutun-lounge --force`.
