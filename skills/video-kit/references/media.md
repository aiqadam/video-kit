# Photos, footage, fonts and logos

## Footage and music you may not redistribute

Stock licenses (Pexels, Pixabay, Mixkit) allow use in a video but not handing out the
original files, so they never go into the repository. List them in
`assets/sources.json`; the kit downloads, trims, crops, scales and mutes them into
`assets/fetched/` (gitignored) on the first `sync`, `check`, `stills` or `render`:

```json
[{ "file": "clips/coals.mp4", "url": "https://www.pexels.com/download/video/8316467/",
   "page": "https://www.pexels.com/video/close-up-video-of-burning-charcoal-8316467/",
   "author": "Samer Daboul", "license": "Pexels License", "trim": [2, 6], "width": 1920 }]
```

`trim` is [from, to] in the source, `crop` an ffmpeg `w:h:x:y`, `width` the largest width
kept, `"mute": false` keeps the sound. Audio files are trimmed only. The entry is the
credit; `check` warns when `license` or `page`/`author` is missing.

Pexels: `https://www.pexels.com/download/video/<id>/` is the file; the id is the number at
the end of the clip's page URL. Its search pages list clips with their slugs. Music: the
incompetech.com catalogue (Kevin MacLeod, CC BY 4.0) has a JSON list at
`/music/royalty-free/pieces.json` with genre, feel and BPM; Free Music Archive and
Openverse have CC tracks too. Check every clip for minors before using it in anything
about tobacco, alcohol or other adult products.

## Where to look

1. **The person's own materials** first: their site, deck, app, brand kit.
2. **Wikimedia Commons**: free licenses with clear metadata. The API returns license and
   author with each file:
   `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=<words>%20filetype:bitmap&gsrnamespace=6&prop=imageinfo&iiprop=url|size|extmetadata&iiurlwidth=2400&format=json`
   (`iiurlwidth` gives a resized copy, which downloads faster than the original).
3. **Museum open-access collections** (The Met, Smithsonian, Rijksmuseum): CC0 objects.
4. **Openverse** (`api.openverse.org`) searches several CC sources at once.
5. Unsplash and Pexels have their own free licenses (not CC): usable in a video, but
   note the license name in the credits and do not redistribute them as a collection.

Prefer CC0 and public domain, then CC BY, then CC BY-SA. Skip NC (non-commercial) and
ND (no derivatives) for anything that may be used commercially or cropped.

## What not to use

- Photos of recognisable people next to a brand they do not work for.
- A real brand's logo redrawn or approximated. Use the official file, or the name in text.
- Images whose license you could not find.

## Preparing files

- Resize to at most 2400 px on the long side and save as JPEG quality ~85 (ffmpeg is in
  the kit: `node_modules/ffmpeg-static`, or the system one).
- Crop out calibration targets, rulers and museum backgrounds.
- Record what you changed ("cropped and resized") in the credits.

## Credits

`assets/CREDITS.md` has one row per file: file, what it is, source URL, author, license.
`*` works in the file column (`fonts/brand-*.woff2`). `node kit.mjs check` warns about
any file under `assets/` that is not listed.

## Fonts

Use fonts under the SIL Open Font License or similar. The kit ships Inter (Latin,
Cyrillic) as the default. For another family, copy its `.woff2` files (Fontsource
packages on npm have them split by script) into `assets/fonts/`, add them to
`video.json` → `fonts` with their `range`, include the license text, and credit them.
Check that the family covers every script the video uses (Cyrillic, Uzbek Latin `o‘ g‘`).
