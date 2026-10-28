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
`kit.cursor`), text types, the next screen slides in. `videos/chilim-usta/compositions/
order.html` is a complete example: a phone, selections, typing and a confirmation.

- Strings come from the product itself, not your paraphrase.
- Demo data must be plausible and must not look like real customers' data; say "demo
  data" on screen when the person asks for it.
- When a later screen covers an earlier one, hide the earlier one once covered
  (`visibility: hidden`), or `check` reports overlapping text.

## Photos and footage

`<img>` with `object-fit: cover` inside a positioned box; move the box or scale the image
with `kit.set` for a slow push-in. Darken for text with a gradient `div` over it, not a
CSS filter. Video clips: see HyperFrames' format notes (`npx hyperframes docs compositions`).

## Portrait and square

Lay out for the shape: in portrait, a caption band at the top third and the product
below it; type sizes stay as large as in landscape. Keep text out of the bottom 15%
where phone players put their controls.
