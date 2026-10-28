/*
 * AI Qadam Video Kit runtime (MIT).
 *
 * Motion as a pure function of time, on top of HyperFrames. Every scene registers one
 * timeline whose seek(t) redraws the scene for scene-local time t (seconds). Nothing here
 * reads the clock while rendering, so the same t always gives the same frame.
 *
 * The generated index.html sets window.KIT = {lang, strings, scenes, lines, fps} before
 * this file loads. Scenes use the global `kit`.
 */
(function () {
  'use strict';

  var K = (window.KIT = window.KIT || {});
  K.strings = K.strings || {};
  K.scenes = K.scenes || {};
  K.lines = K.lines || {};

  // ── numbers ──────────────────────────────────────────────────────────────

  function clamp(x, a, b) {
    if (a === undefined) a = 0;
    if (b === undefined) b = 1;
    return Math.min(b, Math.max(a, x));
  }

  function lerp(a, b, p) {
    return a + (b - a) * p;
  }

  /** CSS-style cubic-bezier easing. */
  function bezier(x1, y1, x2, y2) {
    function at(a1, a2, s) {
      return ((1 - 3 * a2 + 3 * a1) * s + (3 * a2 - 6 * a1)) * s * s + 3 * a1 * s;
    }
    function slope(a1, a2, s) {
      return 3 * (1 - 3 * a2 + 3 * a1) * s * s + 2 * (3 * a2 - 6 * a1) * s + 3 * a1;
    }
    return function (p) {
      if (p <= 0) return 0;
      if (p >= 1) return 1;
      var s = p;
      for (var i = 0; i < 8; i++) {
        var d = slope(x1, x2, s);
        if (Math.abs(d) < 1e-6) break;
        s -= (at(x1, x2, s) - p) / d;
      }
      return at(y1, y2, clamp(s));
    };
  }

  var ease = {
    linear: function (p) { return p; },
    in: function (p) { return p * p * p; },
    out: function (p) { return 1 - Math.pow(1 - p, 3); },
    inOut: function (p) { return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2; },
    outBack: function (p) {
      var c1 = 1.70158, c3 = c1 + 1;
      return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2);
    },
    /** Slow start, long soft landing: camera moves. */
    camera: bezier(0.45, 0, 0.15, 1),
    bezier: bezier,
  };

  /** 0 → 1 between times a and b, eased (ease.out by default), clamped outside. */
  function prog(t, a, b, e) {
    if (b <= a) return t >= b ? 1 : 0;
    return (e || ease.out)(clamp((t - a) / (b - a)));
  }

  /**
   * Piecewise interpolation, clamped at both ends:
   *   interp(t, [0, 1, 2], [0, 100, 50])
   * e is one easing for every segment or an array with one per segment.
   */
  function interp(t, times, values, e) {
    var n = times.length;
    if (t <= times[0]) return values[0];
    if (t >= times[n - 1]) return values[n - 1];
    for (var i = 0; i < n - 1; i++) {
      if (t <= times[i + 1]) {
        var f = Array.isArray(e) ? e[i] : e;
        var p = (f || ease.linear)((t - times[i]) / (times[i + 1] - times[i]));
        return lerp(values[i], values[i + 1], p);
      }
    }
    return values[n - 1];
  }

  /**
   * Damped spring from 0 to 1, closed form (no stepping, so any t gives the same value).
   * Defaults settle in about 0.6 s with a small overshoot.
   */
  function spring(t, o) {
    o = o || {};
    if (t <= 0) return 0;
    var k = o.stiffness || 170, m = o.mass || 1, c = o.damping === undefined ? 18 : o.damping;
    var w0 = Math.sqrt(k / m), z = c / (2 * Math.sqrt(k * m));
    if (z < 1) {
      var wd = w0 * Math.sqrt(1 - z * z);
      return 1 - Math.exp(-z * w0 * t) * (Math.cos(wd * t) + (z * w0 / wd) * Math.sin(wd * t));
    }
    if (z === 1) return 1 - Math.exp(-w0 * t) * (1 + w0 * t);
    var r1 = -w0 * (z - Math.sqrt(z * z - 1)), r2 = -w0 * (z + Math.sqrt(z * z - 1));
    return 1 - (r2 * Math.exp(r1 * t) - r1 * Math.exp(r2 * t)) / (r2 - r1);
  }

  function rgbOf(c) {
    var h = String(c).replace('#', '');
    if (h.length === 3) h = h.replace(/(.)/g, '$1$1');
    return [0, 2, 4].map(function (i) { return parseInt(h.slice(i, i + 2), 16); });
  }

  /** Mix two hex colours: color('#2f8f6b', '#2b5fb3', 0.5) → 'rgb(…)'. */
  function color(a, b, p) {
    var x = rgbOf(a), y = rgbOf(b);
    return 'rgb(' + x.map(function (v, i) { return Math.round(lerp(v, y[i], clamp(p))); }).join(',') + ')';
  }

  // ── elements ─────────────────────────────────────────────────────────────

  /**
   * Set an element's look. Shorthands x, y (px), scale, rotate (deg), opacity, blur (px)
   * build transform/filter; any other key is a CSS property.
   */
  function set(el, s) {
    if (!el) return;
    var tr = '', st = el.style;
    if (s.x !== undefined || s.y !== undefined) tr += 'translate(' + (s.x || 0) + 'px,' + (s.y || 0) + 'px) ';
    if (s.scale !== undefined) tr += 'scale(' + s.scale + ') ';
    if (s.rotate !== undefined) tr += 'rotate(' + s.rotate + 'deg) ';
    if (tr) st.transform = tr.trim();
    if (s.opacity !== undefined) st.opacity = String(clamp(s.opacity));
    if (s.blur !== undefined) st.filter = s.blur > 0.05 ? 'blur(' + s.blur + 'px)' : '';
    for (var key in s) {
      if (!Object.prototype.hasOwnProperty.call(s, key)) continue;
      if (/^(x|y|scale|rotate|opacity|blur)$/.test(key)) continue;
      if (key.indexOf('--') === 0) st.setProperty(key, s[key]);
      else st[key] = s[key];
    }
  }

  /** Rise and fade in from `from`; fade out from `until` if given. */
  function reveal(el, t, from, o) {
    o = o || {};
    var len = o.len || 0.5, dy = o.y === undefined ? 24 : o.y;
    var p = prog(t, from, from + len);
    var out = o.until === undefined ? 1 : 1 - prog(t, o.until, o.until + (o.outLen || 0.4), ease.linear);
    set(el, { opacity: p * out, y: (1 - p) * dy, x: o.x || 0 });
    return p * out;
  }

  /** Spring pop-in: scale 0.9 → 1 with a little overshoot, fade in. */
  function pop(el, t, from, o) {
    o = o || {};
    var v = Math.min(1.2, spring(t - from, o));
    set(el, { opacity: Math.min(1, v * 1.4), scale: (o.base || 0.9) + (1 - (o.base || 0.9)) * v });
    return v;
  }

  function splitWords(el) {
    if (el.__kitWords) return el.__kitWords;
    var text = el.textContent.trim().replace(/\s+/g, ' ');
    el.textContent = '';
    el.__kitWords = text.split(' ').map(function (w, i, all) {
      var span = document.createElement('span');
      span.textContent = w;
      span.style.display = 'inline-block';
      el.appendChild(span);
      if (i < all.length - 1) el.appendChild(document.createTextNode(' '));
      return span;
    });
    return el.__kitWords;
  }

  /**
   * Kinetic line: words arrive one by one. accent: words (without punctuation) that get
   * the class `accent` (style it in the scene, e.g. color: var(--accent)).
   */
  function words(el, t, from, o) {
    if (!el) return;
    o = o || {};
    var step = o.step === undefined ? 0.1 : o.step, len = o.len || 0.4;
    var accent = o.accent || [];
    splitWords(el).forEach(function (span, i) {
      var p = prog(t, from + i * step, from + i * step + len);
      var bare = span.textContent.replace(/[.,!?:;«»"“”]/g, '');
      if (accent.indexOf(bare) >= 0) span.classList.add('accent');
      set(span, { opacity: p, y: (1 - p) * 18, scale: 1.18 - 0.18 * p, blur: (1 - p) * 8 });
    });
  }

  /** Typewriter: shows the element's text letter by letter at cps characters a second. */
  function type(el, t, from, o) {
    if (!el) return 0;
    o = o || {};
    if (el.__kitText === undefined) el.__kitText = el.textContent;
    var full = el.__kitText, cps = o.cps || 16;
    var n = clamp(Math.floor((t - from) * cps), 0, full.length);
    el.textContent = full.slice(0, n);
    return n / Math.max(1, full.length);
  }

  /** Counter that runs from `start` (0) to `to` and lands at from + len. */
  function count(el, t, from, to, o) {
    if (!el) return;
    o = o || {};
    var v = lerp(o.start || 0, to, prog(t, from, from + (o.len || 1.2)));
    var d = o.decimals || 0;
    var text = new Intl.NumberFormat(o.locale || K.lang || 'en', {
      minimumFractionDigits: d,
      maximumFractionDigits: d,
    }).format(v);
    el.textContent = (o.prefix || '') + text + (o.suffix || '');
  }

  /**
   * Virtual camera over a world layer. keys: [{t, x, y, s}], where (x, y) is the world
   * point at the frame centre and s the zoom. At zoom s the centre cannot come closer than
   * vw / 2s to the world's left edge or vh / 2s to its top, or empty space shows.
   */
  function camera(world, t, keys, o) {
    if (!world || !keys || !keys.length) return;
    o = o || {};
    var vw = o.vw || K.width || 1920, vh = o.vh || K.height || 1080;
    var e = o.ease || ease.camera;
    var times = keys.map(function (k) { return k.t; });
    var x = interp(t, times, keys.map(function (k) { return k.x; }), e);
    var y = interp(t, times, keys.map(function (k) { return k.y; }), e);
    var s = interp(t, times, keys.map(function (k) { return k.s; }), e);
    world.style.transformOrigin = '0 0';
    world.style.transform = 'translate(' + (vw / 2 - x * s) + 'px,' + (vh / 2 - y * s) + 'px) scale(' + s + ')';
  }

  /**
   * One shot inside a scene, visible over [from, to). Comes in with a zoom and blur
   * (enter < 1 flies in, > 1 pulls back), drifts slowly, and leaves by flying through
   * the frame. last: the scene's last shot, which leaves the fade to the scene cut.
   */
  function beat(el, t, from, to, o) {
    if (!el) return false;
    o = o || {};
    if (t < from || t >= to) {
      el.style.visibility = 'hidden';
      return false;
    }
    el.style.visibility = 'visible';
    var local = t - from, enter = o.enter === undefined ? 0.8 : o.enter, last = !!o.last;
    var e = spring(local, { stiffness: 150, damping: 30, mass: 0.6 });
    var x = prog(t, to - (last ? 0.4 : 0.3), to, ease.in);
    var scale = lerp(enter, 1, e) * (1 + (0.04 * local) / (to - from)) * (1 + (last ? 0.25 : 1.2) * x);
    var opacity = Math.min(1, local / 0.12) * (last ? 1 : 1 - x);
    set(el, { scale: scale, opacity: opacity, blur: (1 - e) * 14 + (last ? 0 : x * 10) });
    return true;
  }

  /**
   * Cursor or finger along keys [{t, x, y, tap}] (px in the element's parent). Returns how
   * pressed it is (0..1) so a button can react: kit.set(btn, {scale: 1 - 0.06 * press}).
   */
  function cursor(el, t, keys, o) {
    if (!el || !keys.length) return 0;
    o = o || {};
    var times = keys.map(function (k) { return k.t; });
    var x = interp(t, times, keys.map(function (k) { return k.x; }), ease.inOut);
    var y = interp(t, times, keys.map(function (k) { return k.y; }), ease.inOut);
    var press = 0;
    keys.forEach(function (k) {
      if (k.tap) press = Math.max(press, interp(t, [k.t - 0.08, k.t, k.t + 0.18], [0, 1, 0]));
    });
    var show = o.from === undefined ? 1 : prog(t, o.from, o.from + 0.25);
    set(el, { x: x, y: y, scale: 1 - 0.15 * press, opacity: show });
    return press;
  }

  // ── strings and voice lines ──────────────────────────────────────────────

  /** Text for a key in the current language; the key itself when missing. */
  function tr(key) {
    var s = K.strings[key];
    return s === undefined ? key : s;
  }

  function fillStrings(root) {
    if (!root) return;
    root.querySelectorAll('[data-t]').forEach(function (el) {
      var s = K.strings[el.getAttribute('data-t')];
      if (s !== undefined) el.textContent = s;
    });
    root.querySelectorAll('[data-t-html]').forEach(function (el) {
      var s = K.strings[el.getAttribute('data-t-html')];
      if (s !== undefined) el.innerHTML = s;
    });
  }

  // ── timelines ────────────────────────────────────────────────────────────

  /**
   * A timeline HyperFrames can seek. Rendering and snapshots only seek; play() exists for
   * the live preview and advances by the wall clock there.
   */
  function timeline(id, draw, duration) {
    var t = 0, paused = true, raf = 0, t0 = 0, base = 0, rate = 1;
    function frame(now) {
      if (paused) return;
      var d = duration();
      t = Math.min(d, base + ((now - t0) / 1000) * rate);
      draw(t);
      if (t < d) raf = requestAnimationFrame(frame);
    }
    var tl = {
      parent: null,
      seek: function (s) {
        t = Math.max(0, Number(s) || 0);
        base = t;
        if (!paused && typeof performance !== 'undefined') t0 = performance.now();
        draw(t);
        return tl;
      },
      totalTime: function (s) { return s === undefined ? t : tl.seek(s); },
      time: function () { return t; },
      progress: function (p) { return p === undefined ? t / Math.max(1e-9, duration()) : tl.seek(p * duration()); },
      duration: function () { return duration(); },
      totalDuration: function () { return duration(); },
      play: function () {
        if (!paused) return tl;
        paused = false;
        base = t;
        t0 = performance.now();
        raf = requestAnimationFrame(frame);
        return tl;
      },
      pause: function () {
        paused = true;
        if (raf) cancelAnimationFrame(raf);
        return tl;
      },
      paused: function (p) {
        if (p === undefined) return paused;
        return p ? tl.pause() : tl.play();
      },
      timeScale: function (r) { if (r !== undefined) rate = r; return rate; },
      globalTime: function (x) { return Number(x) || 0; },
      getChildren: function () { return []; },
      add: function () {},
      set: function () {},
      kill: function () { tl.pause(); },
    };
    tl.__kit = id;
    return tl;
  }

  function hostOf(id) {
    return document.querySelector('[data-composition-id="' + id + '"][data-composition-src]');
  }

  /**
   * Register a scene. render(t, s) draws it for scene-local time t; s gives
   *   s.$(selector)   an element inside the scene (cached)
   *   s.dur           the scene's length in seconds
   *   s.line(id)      a voice line {start, end, words: [{w, start, end}]}, scene-local
   *   s.word(id, w)   when word w (or its n-th occurrence: w#2) starts in line id
   * Returns the timeline: window.__timelines["<id>"] = kit.scene("<id>", ...).
   */
  function scene(id, render) {
    var host = hostOf(id);
    var root = (host && host.querySelector('[data-composition-id="' + id + '"]')) || host;
    var meta = K.scenes[id] || {};
    var dur = meta.dur || (host ? parseFloat(host.getAttribute('data-duration')) : 0) || 0;
    var cache = {};
    var s = {
      id: id,
      dur: dur,
      root: root,
      $: function (sel) {
        if (!(sel in cache)) cache[sel] = root ? root.querySelector(sel) : document.querySelector(sel);
        return cache[sel];
      },
      line: function (lineId) {
        var l = K.lines[lineId];
        if (!l) return { start: 0, end: 0, words: [] };
        var off = l.sceneStart || 0;
        return {
          start: l.start - off,
          end: l.end - off,
          words: (l.words || []).map(function (w) { return { w: w.w, start: w.start - off, end: w.end - off }; }),
        };
      },
      word: function (lineId, w) {
        var l = s.line(lineId), want = String(w).toLowerCase(), nth = 1;
        var m = /^(.*)#(\d+)$/.exec(want);
        if (m) { want = m[1]; nth = Number(m[2]); }
        for (var i = 0; i < l.words.length; i++) {
          if (l.words[i].w.toLowerCase().replace(/[.,!?:;«»"“”]/g, '') === want && --nth === 0) return l.words[i].start;
        }
        return l.start;
      },
    };
    fillStrings(root);
    var fadeIn = meta.fadeIn || 0;
    function draw(t) {
      if (root && fadeIn > 0) root.style.opacity = String(prog(t, 0, fadeIn, ease.linear));
      render(t, s);
    }
    draw(0);
    return timeline(id, draw, function () { return dur; });
  }

  /** The root composition's timeline. */
  function root() {
    var el = document.querySelector('[data-composition-id="main"]');
    var dur = parseFloat((el && el.getAttribute('data-duration')) || '0');
    return timeline('main', function () {}, function () { return dur; });
  }

  window.kit = {
    clamp: clamp,
    lerp: lerp,
    ease: ease,
    prog: prog,
    interp: interp,
    spring: spring,
    color: color,
    set: set,
    reveal: reveal,
    pop: pop,
    words: words,
    type: type,
    count: count,
    camera: camera,
    beat: beat,
    cursor: cursor,
    t: tr,
    scene: scene,
    root: root,
  };
})();
