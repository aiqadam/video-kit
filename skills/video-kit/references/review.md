# Checking the work

Nobody can judge a video from its code. Render frames and look at them.

## The loop

1. `node kit.mjs plan <name>`: timing as numbers. Lines in order, no overlaps, nothing
   past the end.
2. `node kit.mjs check <name>`: the kit's checks (timing, missing files, strings, credits),
   then HyperFrames' (lint, runtime errors, layout, contrast, motion, audio). Fix every
   error; read every warning. `info` lines about overflow you intended can stay.
3. `node kit.mjs stills <name>`: two frames per scene, plus a contact sheet. Read the
   images. For a moment you changed: `node kit.mjs stills <name> order@6.8 order@7.4`.
4. Render only when the frames are right.

## What to look for in stills

- Nothing cut by the frame edge; no text over text; nothing important in the outer 5%.
- The smallest text that must be read is at least 28 px at 1080 px.
- The caption matches the picture: no promise the image does not show.
- Numbers on screen are exactly those in the brief.
- Every language: no leftover text in another language, nothing overflowing because a
  translation is longer.
- The first frame shows something (it is the thumbnail); the last frame holds still and
  works as a cover.
- Product screens look like the product: right strings, colours, spacing.

## Delivery note

When you hand over a render, say in a few lines:
- the file path, length and loudness `render` printed;
- what changed since the last version;
- which voice lines are drafts, if any;
- that you checked frames and measured the sound, and did not watch the motion or listen.
