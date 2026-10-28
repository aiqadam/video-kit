# Asset credits

Footage and music are not stored in this repository: their sources, authors and licenses
are in `sources.json`, and the kit downloads and trims them into `fetched/` on the first
build. The Pexels clip is used under the Pexels License; the music is CC BY 4.0.

Music: "Realizer" Kevin MacLeod (incompetech.com), licensed under Creative Commons:
By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/

| File | What | Source | Author | License |
| ---- | ---- | ------ | ------ | ------- |
| brand/logo-full-dark.svg | AI Qadam full lockup; `brand/logo-full.svg` with the wordmark fill baked to the dark-surface colour `#FDFAF5`, as the brand guidelines allow | [aiqadam/brand.aiqadam.org](https://github.com/aiqadam/brand.aiqadam.org) | AI Qadam Community | © AI Qadam, not open source; used under the [Brand Usage Policy](https://brand.aiqadam.org/brand-use.html) |
| fonts/geist-*.woff2 | Geist, latin and latin-ext subsets (@fontsource-variable/geist 5.3.0) | [vercel/geist-font](https://github.com/vercel/geist-font) | The Geist Project Authors | [OFL 1.1](fonts/OFL-geist.txt) |
| fonts/jetbrains-mono-*.woff2 | JetBrains Mono, latin and latin-ext subsets (@fontsource-variable/jetbrains-mono 5.3.0) | [JetBrains/JetBrainsMono](https://github.com/JetBrains/JetBrainsMono) | The JetBrains Mono Project Authors | [OFL 1.1](fonts/OFL-jetbrains-mono.txt) |
| fonts/oswald-*.woff2 | Oswald, latin and cyrillic subsets, for the frame quoted from tutun-lounge (@fontsource-variable/oswald 5.3.0) | [Google Fonts](https://fonts.google.com/specimen/Oswald) | Vernon Adams, Kalapi Gajjar, Cyreal | [OFL 1.1](fonts/OFL-oswald.txt) |
| frames/*.jpg | Stills of this video, made with `node kit.mjs stills kit-promo` | this repository | AI Qadam Video Kit | MIT, like the repository |

The voice files in voice/ were generated with Google Gemini 3.8 Flash TTS (voice Iapetus)
through OpenRouter. They are not covered by the repository's MIT license; their use
follows the provider's terms. To make your own, set a key and run
`node kit.mjs voice kit-promo --force`.
