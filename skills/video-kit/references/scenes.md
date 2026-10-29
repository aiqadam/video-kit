# Writing scenes

A scene is `compositions/<id>.html`. Its id matches `video.json`. Everything it shows is
drawn by one function of `t`, the seconds since the scene started.

## Anatomy

```html
<template>
  <div id="root" data-composition-id="intro">
    <style>
      #root { position: absolute; inset: 0; overflow: hidden; background: var(--bg); }
      #intro-title { font-family: var(--display); font-size: 140px; font-weight: 700; }
    </style>
    <div id="intro-title">Meet Acme</div>
    <script>
      window.__timelines["intro"] = kit.scene("intro", function (t, s) {
        kit.words(s.$("#intro-title"), t, 0.4, { accent: ["Acme"] });
      });
    </script>
  </div>
</template>
```

- The file is a `<template>` with one root `<div id="root" data-composition-id="<id>">`.
  Style the root as `#root`, inside the scene's own `<style>`.
- Prefix every other id with the scene id; all scenes share one page.
- Register exactly as above: `window.__timelines["<id>"] = kit.scene("<id>", fn)`.
  HyperFrames' lint looks for that literal assignment.
- Asset paths are relative to the video folder: `assets/photos/x.jpg`, no leading `/`.
- `render(t, s)` must give the same picture for the same `t` whatever was drawn before:
  set every property you animate on every call, not only while it changes.
- No CSS `transition`, `animation`, timers, `Date`, `Math.random` or network requests.
- The first scene's first frame is the thumbnail: have something on screen at `t = 0`.

## The kit API (`window.kit`)

Times are seconds inside the scene. `el` is an element, usually `s.$("#id")`.

| Call | Does |
| ---- | ---- |
| `kit.scene(id, (t, s) => …)` | registers the scene; returns its timeline |
| `s.$(selector)` | element inside the scene, cached |
| `s.dur` | the scene's length |
| `s.line(id)` | voice line `{start, end, words: [{w, start, end}]}` in scene time |
| `s.word(id, "word")`, `s.word(id, "word#2")` | when that word starts (falls back to the line start) |
| `kit.prog(t, a, b, ease?)` | 0 → 1 between `a` and `b`, eased out by default |
| `kit.interp(t, [t0, t1, …], [v0, v1, …], ease?)` | piecewise value, clamped |
| `kit.spring(t, {stiffness, damping, mass})` | 0 → 1 with a little overshoot |
| `kit.ease.linear / in / out / inOut / outBack / camera`, `kit.ease.bezier(x1, y1, x2, y2)` | easings |
| `kit.color(a, b, p)` | mix two hex colours |
| `kit.set(el, {x, y, scale, rotate, opacity, blur, …css})` | apply a look |
| `kit.reveal(el, t, from, {y, len, until})` | rise and fade in (and out from `until`) |
| `kit.pop(el, t, from, {base})` | spring in |
| `kit.words(el, t, from, {step, len, accent: ["word"]})` | words arrive one by one; accent words get class `accent` |
| `kit.type(el, t, from, {cps})` | typewriter |
| `kit.count(el, t, from, to, {len, decimals, prefix, suffix, locale})` | counter, formatted for the video's language |
| `kit.beat(el, t, from, to, {enter, last})` | a shot within the scene: zooms in, drifts, flies out at `to` |
| `kit.camera(world, t, [{t, x, y, s}])` | virtual camera over a larger layer |
| `kit.cursor(el, t, [{t, x, y, tap}], {from})` | moves a finger or pointer; returns how pressed it is (0–1) |
| `kit.t("key")` | on-screen string for the current language |

Elements with `data-t="key"` (or `data-t-html`) are filled from the strings of the
rendered language when the scene loads.

## Composition

- One idea per scene, one focal point per moment. Text that must be read stays on screen
  for at least 0.5 s plus 0.3 s a word.
- Use `kit.beat` for several shots inside one scene: each flies through the frame into the
  next, which keeps a fast cut readable.
- Use `kit.camera` when the scene is a large surface (a page, a map, a dashboard) and the
  story moves across it. At zoom `s` the centre cannot come closer than `width / 2s` to
  the layer's left edge or `height / 2s` to its top, or empty space shows.
- Pace: movement without hurry and without dead air. No whip pans, flashes or shakes.

## Product screens

Showing the real product beats any illustration. Redraw its screens in HTML from the
source (colours, radii, type sizes, labels) or from screenshots, at a size that reads in
the video, and act them out: the finger moves, the button dips (`press` from
`kit.cursor`), text types, the next screen slides in: put `.kit-cursor` inside the
screen, drive it with `kit.cursor`, change the UI on each tap time.

- Strings come from the product itself, not your paraphrase.
- Demo data must be plausible and must not look like real customers' data; say "demo
  data" on screen when the person asks for it.
- When a later screen covers an earlier one, hide the earlier one once covered
  (`visibility: hidden`), or `check` reports overlapping text.
- `videos/kit-promo/` is a worked example: a terminal that types, files whose lines light
  up with the voice, an x-ray wipe, a pull-back into a player.

## Photos and footage

`<img>` with `object-fit: cover` inside a positioned box; move the box or scale the image
with `kit.set` for a slow push-in. Darken for text with a gradient `div` over it, not a
CSS filter.

Footage is a timed `<video>` inside an untimed wrapper; animate the wrapper, never the
video. Times are scene-local; a nonzero start says so explicitly:

```html
<div class="tl-shot" id="ritual-s2">
  <video id="ritual-v2" class="clip" src="assets/fetched/clips/packing.mp4"
         data-start="2.791" data-hf-media-start-basis="local" data-duration="2.791"
         data-playback-rate="0.5" data-track-index="1" muted playsinline></video>
</div>
```

The video shows only over its window, which makes a hard cut. `data-playback-rate`
below 1 gives slow motion; it looks smooth only from 50/60 fps sources. Stock footage
goes through `assets/sources.json` (`media.md`), trimmed to the part you use.

## Cutting to music

With a music bed, the music is the clock. Find the beat (`npx hyperframes beats` in the
video folder writes the beat times), set `music.start` so a downbeat falls at 0, and
make every scene and shot a whole number of bars (at 86 BPM a bar is 4 × 60 / 86 =
2.791 s). `videos/tutun-lounge/` is cut this way: one shot a bar, words on the beat.

## Portrait and square

Lay out for the shape: in portrait, a caption band at the top third and the product
below it; type sizes stay as large as in landscape. Keep text out of the bottom 15%
where phone players put their controls.

Wide paintings in a tall frame: scale them to most of the frame's height and pan across
rather than cropping to the middle, and keep the caption below the part that matters.
`videos/ottoman-empire/` does this, with a label on each picture saying what it is.
