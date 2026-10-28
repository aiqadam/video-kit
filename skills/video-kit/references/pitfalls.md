# Pitfalls

Each of these has already cost someone time.

**Times written in two places drift.** A scene got longer, the voice lines did not move,
and the narration ran 6–9 s behind the picture. Here every time is relative to its scene
in `video.json`; do not keep absolute times anywhere else.

**The music stopped before the end.** A mix that ducks music under the voice can cut the
music where the voice track ends. `render` prints the level of the last 3 s; if it is far
below the rest, something stopped.

**State left over from another frame.** Rendering seeks to frames in any order. A scene
that only sets an element while it animates shows the wrong state when the renderer jumps
in later. Set every animated property on every call.

**CSS transitions and animations.** They run on the wall clock, not on `t`, so frames
differ between preview and render. Compute everything from `t`.

**A later screen over an earlier one.** Covered text still counts as overlapping text in
`check`. Hide what is fully covered.

**A key ID instead of a key.** ElevenLabs keys start with `sk_`. The ID shown in the key
list fails with "API key ID used as API key".

**Model without the language.** `eleven_multilingual_v2` has no Uzbek or Kazakh; it reads
them with the wrong phonetics. Use `eleven_v3` for those.

**Reading numbers.** "1500" may be read as "fifteen hundred" where the audience expects
"one thousand five hundred". Write numbers in words in the line text.

**Translation after the fact.** The second language came out 20–25% longer and broke the
layout. Write every language's text and check its stills.

**Photos with museum furniture.** Open-access museum photos often include colour charts
and rulers at the edges; they show up as soon as the image is a background. Crop them.

**A logo redrawn "close enough".** It is someone's trademark and it will be noticed.
Use the official file or plain text.
