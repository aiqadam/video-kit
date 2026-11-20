/* Dutar Protocol: one lit stage (the cover photo) with living threads of sound over it.
 *
 * Every scene mounts the same layers and draws them with STAGE.render(s, T, p), where T is
 * the time in the whole video (s.start + t) and p says what this moment looks like. Scenes
 * own their p; this file only draws, so a cut between scenes is invisible as long as the
 * two scenes agree on p at the cut.
 *
 * Positions are in "world" pixels: the photo laid over 1920 x 1080. Landmarks:
 *   pegs (600, 170), neck from (705, 345) to (872, 625), doira centre (1148, 705).
 *
 *   STAGE.mount(s)                   adds the layers to the scene root (once)
 *   STAGE.render(s, T, p)            draws one frame
 *   STAGE.tau(T)                     the threads' clock: stops during the hang at 130-134 s
 *   STAGE.shots(T, list)             camera that holds a shot and moves to the next:
 *       list [{t, x, y, s, move}]: shot from t, reached after `move` s (default 1), then
 *       a slow push-in until the next. Neighbouring scenes list the shots around their
 *       cut (the last one before, the first one after), so the camera runs on through it.
 *   STAGE.BAR                        one bar, 2 s (120 BPM)
 *
 * p: {
 *   cam: {x, y, s}                   world point at the frame centre, zoom (1..1.7)
 *   drive                            0..1, how hard the picture hits with the kick: a
 *                                    push of the camera, a lift of the light, a jump in
 *                                    the threads. Scenes ramp it across their cuts.
 *   bright, warm, cool               photo exposure 0..1.2; gold and teal grade 0..1
 *   spot: {x, y, r, a}               light pool on the photo; a = how dark outside it
 *   threads: {n, count, amp, spread, mix, lock, inter, alpha, straight, drawX, gapHalf,
 *             reach, cy, ring, ringRot, fade(i)}
 *             ring 0..1 winds the threads onto the doira, left ends first
 *             n threads show (fractional fades the last in); count fixes their layout, so a
 *             thread arriving does not move the others. lock 0 keeps the teal-to-gold run
 *             along x, 1 colours every thread `mix` (0 teal, 1 gold); inter 0..1 blends that
 *             towards alternate teal and gold threads.
 *   packets: a                       light pulses running along straight threads, one per eighth
 *   girih: {p, a}, halo: a, ticks: a, frets: a, rim: a, skin: a, ember: {r, a}, burst: a,
 *   dust: a
 * }
 * Deterministic: no clock, no Math.random; noise comes from a seeded generator.
 */
(function () {
  if (window.STAGE) return;
  var W = 1920, H = 1080, BAR = 2;
  var TEAL = [95, 214, 200], GOLD = [242, 196, 138];
  var DOIRA = { x: 1148, y: 705, rx: 205, ry: 228 };
  var NECK = [705, 345, 872, 625];

  function rng(seed) {
    return function () { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  }
  function clamp(x, a, b) { return Math.min(b === undefined ? 1 : b, Math.max(a || 0, x)); }
  function mix(a, b, p) { return a + (b - a) * p; }
  function rgba(c, a) { return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + clamp(a) + ')'; }
  function tint(p) {
    p = clamp(p);
    return [Math.round(mix(TEAL[0], GOLD[0], p)), Math.round(mix(TEAL[1], GOLD[1], p)), Math.round(mix(TEAL[2], GOLD[2], p))];
  }

  /** The threads' clock: runs with the video except during the hang (130-134 s), where it stops. */
  function tau(T) {
    if (T < 130) return T;
    if (T < 134) return 130;
    return T - 4;
  }

  /** The camera along a list of shots (see the header). */
  function shots(T, list) {
    function held(sh, at) {
      var d = Math.max(0, at - sh.t);
      return { x: sh.x + 1.2 * d, y: sh.y, s: sh.s * (1 + 0.004 * d) };
    }
    var i = 0;
    while (i + 1 < list.length && T >= list[i + 1].t) i++;
    var cur = held(list[i], T);
    if (i === 0) return cur;
    var sh = list[i], p = kit.prog(T, sh.t, sh.t + (sh.move || 1), kit.ease.camera);
    var from = held(list[i - 1], sh.t);
    return { x: mix(from.x, cur.x, p), y: mix(from.y, cur.y, p), s: mix(from.s, cur.s, p) };
  }

  // ── layers ──────────────────────────────────────────────────────────────

  var GRAIN;
  function grainUrl() {
    if (GRAIN) return GRAIN;
    var c = document.createElement('canvas');
    c.width = c.height = 256;
    var g = c.getContext('2d'), img = g.createImageData(256, 256), R = rng(11);
    for (var i = 0; i < img.data.length; i += 4) {
      var v = Math.floor(R() * 255);
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    return (GRAIN = c.toDataURL('image/png'));
  }

  function el(tag, cls, parent, before) {
    var e = document.createElement(tag);
    e.className = cls;
    if (before) parent.insertBefore(e, before);
    else parent.appendChild(e);
    return e;
  }

  var CSS = [
    '.stage-world { position: absolute; left: 0; top: 0; width: 1920px; height: 1080px; transform-origin: 0 0; }',
    '.stage-photo { position: absolute; left: -7.5px; top: 0; width: 1935px; height: 1080px; }',
    '.stage-spot { position: absolute; left: 0; top: 0; width: 1920px; height: 1080px; }',
    '.stage-warm, .stage-cool { position: absolute; inset: 0; mix-blend-mode: soft-light; }',
    '.stage-warm { background: #ff9a3c; }',
    '.stage-cool { background: #2fc4c0; }',
    '.stage-fx { position: absolute; left: 0; top: 0; width: 1920px; height: 1080px; }',
    '.stage-vignette { position: absolute; inset: 0; background: radial-gradient(ellipse 75% 70% at 50% 50%, rgba(0,0,0,0) 55%, rgba(0,0,0,.72) 100%); }',
    '.stage-grain { position: absolute; inset: 0; opacity: .07; mix-blend-mode: overlay; background-size: 256px 256px; }',
  ].join('\n');

  function mount(s) {
    if (s.__stage) return s.__stage;
    if (!document.getElementById('stage-css')) {
      var st = document.createElement('style');
      st.id = 'stage-css';
      st.textContent = CSS;
      document.head.appendChild(st);
    }
    // the scene's own root; HyperFrames may run the script before it is attached, so look
    // it up when drawing and try again on the next frame if it is not there yet
    var all = document.querySelectorAll('[data-composition-id="' + s.id + '"]');
    var root = (s.root && s.root.isConnected && s.root) || all[all.length - 1];
    if (!root) return null;
    var first = root.querySelector('.stage-over');
    if (first) root = first.parentNode;
    var world = el('div', 'stage-world', root, first);
    var img = el('img', 'stage-photo', world);
    img.src = 'assets/photos/stage.jpg';
    img.alt = '';
    var spot = el('div', 'stage-spot', world);
    var warm = el('div', 'stage-warm', root, first);
    var cool = el('div', 'stage-cool', root, first);
    var fx = el('canvas', 'stage-fx', root, first);
    fx.width = W;
    fx.height = H;
    el('div', 'stage-vignette', root, first);
    var grain = el('div', 'stage-grain', root, first);
    grain.style.backgroundImage = 'url(' + grainUrl() + ')';
    return (s.__stage = { world: world, img: img, spot: spot, warm: warm, cool: cool, fx: fx, g: fx.getContext('2d'), grain: grain });
  }

  // ── drawing ─────────────────────────────────────────────────────────────

  function glow(g, x, y, r, c, a) {
    if (a <= 0.003 || r <= 0) return;
    var gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, rgba(c, a));
    gr.addColorStop(0.35, rgba(c, a * 0.45));
    gr.addColorStop(1, rgba(c, 0));
    g.fillStyle = gr;
    g.fillRect(x - r, y - r, 2 * r, 2 * r);
  }

  /** Points of thread i (world), or null where it is hidden. */
  function threadPoints(T, i, th, au) {
    var n = Math.max(1, th.count || Math.ceil(th.n)), u = n > 1 ? i / (n - 1) : 0.5, k = u - 0.5;
    var ta = tau(T), cy = th.cy === undefined ? 400 : th.cy;
    var amp = th.amp * (0.7 + 0.6 * au.low) * (1 + 0.5 * au.drive * au.hit);
    var pts = [], cx = 960;
    for (var x = -120; x <= W + 120; x += 6) {
      var hidden = (th.drawX !== undefined && x > th.drawX) ||
        (th.gapHalf && Math.abs(x - cx) < th.gapHalf) ||
        (th.reach !== undefined && Math.abs(x - cx) > th.reach);
      var env = 0.55 + 0.45 * Math.sin(0.0019 * x - 0.21 * ta + 1.3);
      var c = cy + 40 * Math.sin(0.0026 * x + 0.9) + 25 * Math.sin(0.0051 * x - 0.4 + 0.15 * ta);
      var wave = amp * env * (0.35 + 0.65 * u) * Math.sin(0.0062 * x - 2.7 * ta + 0.25 * k);
      var yw = c + wave + th.spread * k * 0.3;
      var ys = cy + th.spread * k;
      var px = x, py = mix(yw, ys, th.straight || 0);
      if (th.ring) {
        var xn = (x + 120) / (W + 240), w = clamp(th.ring * 2 - xn);
        w = w * w * (3 - 2 * w);
        var a = Math.PI + (2 * Math.PI * (x + 120)) / (W + 240) + (th.ringRot || 0);
        var rr = 1 + (k * th.spread) / 300 + (0.06 * wave) / Math.max(40, th.amp);
        var rx = DOIRA.x + (DOIRA.rx + 70) * rr * Math.cos(a), ry = DOIRA.y + (DOIRA.ry + 70) * rr * Math.sin(a);
        px = mix(px, rx, w);
        py = mix(py, ry, w);
      }
      pts.push(hidden ? null : [px, py]);
    }
    return pts;
  }

  function strokePts(g, pts) {
    g.beginPath();
    var on = false;
    for (var j = 0; j < pts.length; j++) {
      var q = pts[j];
      if (!q) { on = false; continue; }
      if (on) g.lineTo(q[0], q[1]);
      else { g.moveTo(q[0], q[1]); on = true; }
    }
    g.stroke();
  }

  function threads(g, T, th, au, s) {
    if (!th || th.n <= 0 || th.alpha <= 0) return;
    var n = Math.ceil(th.n);
    for (var i = 0; i < n; i++) {
      var a = th.alpha * clamp(th.n - i) * (0.7 + (0.3 + 0.5 * au.drive) * au.level) * (th.fade ? th.fade(i) : 1);
      if (a <= 0.003) continue;
      var pts = threadPoints(T, i, th, au);
      var m0 = 0, m1 = 1;
      if (th.lock) {
        var m = mix(th.mix, i % 2 ? 0.95 : 0.05, th.inter || 0);
        m0 = mix(0, m, th.lock);
        m1 = mix(1, m, th.lock);
      }
      var gr = g.createLinearGradient(200, 0, 1600, 0);
      gr.addColorStop(0, rgba(tint(m0), a));
      gr.addColorStop(1, rgba(tint(m1), a));
      g.strokeStyle = gr;
      g.globalAlpha = 0.13;
      g.lineWidth = 7 / s;
      strokePts(g, pts);
      g.globalAlpha = 1;
      g.lineWidth = 1.6 / s;
      strokePts(g, pts);
    }
  }

  /**
   * Pulses of light along the threads once they are straight: one leaves the left edge on
   * every eighth note, on a thread chosen by its number, and crosses in 2.4 s.
   */
  function packets(g, T, a, th, au, s) {
    if (a <= 0 || !th) return;
    var n = th.count || Math.ceil(th.n), ta = tau(T), cy = th.cy === undefined ? 400 : th.cy;
    var step = 0.25, cross = 2.4, speed = (W + 240) / cross;
    for (var j = Math.floor((ta - cross) / step); j <= Math.floor(ta / step); j++) {
      var age = ta - j * step;
      if (age < 0 || age > cross) continue;
      var i = ((j * 5) % n + n) % n, k = (n > 1 ? i / (n - 1) : 0.5) - 0.5;
      var x = -120 + age * speed, y = cy + th.spread * k;
      var bright = a * (j % 2 ? 0.55 : 1) * (0.45 + 0.8 * au.high);
      var gr = g.createLinearGradient(x - 160, 0, x, 0);
      gr.addColorStop(0, rgba(TEAL, 0));
      gr.addColorStop(1, rgba([200, 255, 245], bright));
      g.strokeStyle = gr;
      g.lineWidth = 2.4 / s;
      g.beginPath();
      g.moveTo(x - 160, y);
      g.lineTo(x, y);
      g.stroke();
      glow(g, x, y, 16 / s, [200, 255, 245], bright * 0.8);
    }
  }

  /** Eight-pointed star lattice (two squares a star), drawn star by star outward from the doira. */
  var STARS;
  function stars() {
    if (STARS) return STARS;
    var C = 180, out = [];
    for (var y = -C; y <= H + C; y += C) {
      for (var x = -C; x <= W + C; x += C) {
        var pts = [];
        for (var v = 0; v < 16; v++) {
          var ang = (v * Math.PI) / 8 + Math.PI / 16, r = v % 2 ? 0.765 * 0.42 * C : 0.42 * C;
          pts.push([x + r * Math.cos(ang), y + r * Math.sin(ang)]);
        }
        var per = 0;
        for (v = 0; v < 16; v++) {
          var p = pts[v], q = pts[(v + 1) % 16];
          per += Math.hypot(q[0] - p[0], q[1] - p[1]);
        }
        out.push({ x: x, y: y, pts: pts, per: per, d: Math.hypot(x - DOIRA.x, y - DOIRA.y) });
      }
    }
    return (STARS = out);
  }

  function girih(g, o, s) {
    if (!o || o.a <= 0) return;
    var reach = o.p * 1700;
    g.lineWidth = 1.2 / s;
    stars().forEach(function (st) {
      var pr = clamp((reach - st.d) / 260);
      if (pr <= 0) return;
      g.strokeStyle = rgba(TEAL, o.a * (0.5 + 0.5 * pr));
      g.setLineDash([st.per * pr, st.per]);
      g.beginPath();
      st.pts.forEach(function (q, v) { if (v) g.lineTo(q[0], q[1]); else g.moveTo(q[0], q[1]); });
      g.closePath();
      g.stroke();
      // a link to the right and one down, so the stars read as one lattice
      var link = clamp(pr * 2 - 1);
      if (link > 0) {
        g.setLineDash([]);
        g.beginPath();
        g.moveTo(st.pts[0][0], st.pts[0][1]);
        g.lineTo(mix(st.pts[0][0], st.x + 180 - 0.42 * 180, link), st.pts[0][1]);
        g.moveTo(st.pts[4][0], st.pts[4][1]);
        g.lineTo(st.pts[4][0], mix(st.pts[4][1], st.y + 180 - 0.42 * 180, link));
        g.stroke();
      }
    });
    g.setLineDash([]);
  }

  /** 48 ticks round the doira; one lights on every eighth note, with a short trail. */
  function ticks(g, T, a, au, s) {
    if (a <= 0) return;
    var N = 48, head = Math.floor(tau(T) / 0.25), frac = (tau(T) / 0.25) % 1;
    g.lineWidth = 2 / s;
    for (var i = 0; i < N; i++) {
      var back = (((head - i) % N) + N) % N;
      var lit = back < 8 ? Math.pow(1 - (back + frac) / 8, 2) : 0;
      var ang = -Math.PI / 2 + (2 * Math.PI * i) / N;
      var c = Math.cos(ang), sn = Math.sin(ang), r0 = 1.06, r1 = 1.06 + (i % 4 ? 0.05 : 0.09);
      g.strokeStyle = rgba(lit > 0.4 ? GOLD : TEAL, a * (0.18 + lit * (0.6 + 0.6 * au.high)));
      g.beginPath();
      g.moveTo(DOIRA.x + DOIRA.rx * r0 * c, DOIRA.y + DOIRA.ry * r0 * sn);
      g.lineTo(DOIRA.x + DOIRA.rx * r1 * c, DOIRA.y + DOIRA.ry * r1 * sn);
      g.stroke();
    }
  }

  /** Glints climbing the frets, one a beat. */
  function frets(g, T, a, s) {
    if (a <= 0) return;
    var beat = tau(T) / 0.5, k = Math.floor(beat), f = beat - k, N = 12;
    for (var back = 0; back < 3; back++) {
      var idx = (((k - back) % N) + N) % N, p = 1 - idx / (N - 1);
      var x = mix(NECK[0], NECK[2], p), y = mix(NECK[1], NECK[3], p);
      glow(g, x, y, 26 / s, GOLD, a * Math.pow(1 - (back + f) / 3, 2) * 0.9);
    }
  }

  function rim(g, a, s) {
    if (a <= 0) return;
    g.save();
    g.translate(DOIRA.x, DOIRA.y);
    g.scale(1, DOIRA.ry / DOIRA.rx);
    for (var pass = 0; pass < 2; pass++) {
      g.strokeStyle = rgba(GOLD, a * (pass ? 0.8 : 0.18));
      g.lineWidth = (pass ? 2.2 : 12) / s;
      g.beginPath();
      g.arc(0, 0, DOIRA.rx + 4, Math.PI * 0.72, Math.PI * 1.42);
      g.stroke();
    }
    g.restore();
  }

  /** An eight-pointed star round the doira, turning slowly: the ornament the threads arrive at. */
  function halo(g, T, a, s) {
    if (a <= 0) return;
    var R = 330, rot = 0.05 * T;
    g.lineWidth = 1.6 / s;
    for (var sq = 0; sq < 2; sq++) {
      g.strokeStyle = rgba(sq ? TEAL : GOLD, a);
      g.beginPath();
      for (var v = 0; v <= 4; v++) {
        var ang = rot + (sq * Math.PI) / 4 + (v * Math.PI) / 2 + Math.PI / 4;
        var x = DOIRA.x + R * Math.cos(ang), y = DOIRA.y + R * 1.1 * Math.sin(ang);
        if (v) g.lineTo(x, y);
        else g.moveTo(x, y);
      }
      g.stroke();
    }
    g.strokeStyle = rgba(GOLD, a * 0.5);
    g.beginPath();
    g.ellipse(DOIRA.x, DOIRA.y, R * 0.74, R * 0.81, 0, 0, 6.283);
    g.stroke();
  }

  function skin(g, a) {
    if (a <= 0.003) return;
    g.save();
    g.translate(DOIRA.x, DOIRA.y);
    g.scale(1, DOIRA.ry / DOIRA.rx);
    glow(g, 0, 0, DOIRA.rx * 1.05, [255, 190, 120], a);
    g.restore();
  }

  var DUST;
  function dust(g, T, a, au, s) {
    if (a <= 0) return;
    if (!DUST) {
      var R = rng(5);
      DUST = [];
      for (var i = 0; i < 120; i++) DUST.push({ x: R(), y: R(), v: 0.4 + R(), r: 0.6 + R() * 1.6, ph: R() * 6.283 });
    }
    var ta = tau(T);
    DUST.forEach(function (d) {
      var x = 250 + ((d.x * 1300 + 7 * ta * d.v) % 1300);
      var y = 1080 - ((d.y * 1080 + 11 * ta * d.v) % 1080);
      // brighter near the beam, which falls from the top left towards the instruments
      var off = Math.abs((x - 380) * 0.82 - (y - 0) * 0.57);
      var beam = Math.exp(-off / 230);
      var tw = 0.55 + 0.45 * Math.sin(T * 1.7 * d.v + d.ph);
      var al = a * beam * tw * (0.5 + 0.8 * au.high);
      if (al < 0.01) return;
      g.fillStyle = rgba([255, 236, 210], al);
      g.beginPath();
      g.arc(x, y, d.r / s, 0, 6.283);
      g.fill();
    });
  }

  // ── a frame ─────────────────────────────────────────────────────────────

  function render(s, T, p) {
    var L = mount(s);
    if (!L) return;
    var drive = clamp(p.drive || 0);
    var au = { level: kit.audio(T), low: kit.audio(T, 'low'), high: kit.audio(T, 'high'), hit: kit.audio(T, 'hit'), drive: drive };
    var cam = p.cam, sc = cam.s * (1 + 0.018 * drive * au.hit);
    var tx = W / 2 - cam.x * sc, ty = H / 2 - cam.y * sc;

    L.world.style.transform = 'translate(' + tx + 'px,' + ty + 'px) scale(' + sc + ')';
    L.img.style.filter = 'brightness(' + (p.bright || 0) * (1 + 0.22 * drive * au.hit) + ') saturate(' + mix(0.9, 1.15, p.warm || 0) + ')';
    var sp = p.spot || { a: 0 };
    L.spot.style.opacity = String(clamp(sp.a));
    if (sp.a > 0) {
      L.spot.style.background = 'radial-gradient(ellipse ' + sp.r * 1.25 + 'px ' + sp.r + 'px at ' + sp.x + 'px ' + sp.y + 'px, rgba(0,0,0,0) 0%, rgba(0,0,0,.55) 55%, rgba(0,0,0,1) 100%)';
    }
    L.warm.style.opacity = String(clamp(p.warm || 0) * 0.55);
    L.cool.style.opacity = String(clamp(p.cool || 0) * 0.6);
    var frame = Math.round(T * 30);
    L.grain.style.backgroundPosition = ((frame * 73) % 256) + 'px ' + ((frame * 151) % 256) + 'px';

    var g = L.g;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 1;
    g.clearRect(0, 0, W, H);
    g.globalCompositeOperation = 'lighter';
    g.setTransform(sc, 0, 0, sc, tx, ty);

    dust(g, T, p.dust || 0, au, sc);
    skin(g, (p.skin || 0) * au.hit);
    rim(g, p.rim || 0, sc);
    girih(g, p.girih, sc);
    halo(g, T, p.halo || 0, sc);
    ticks(g, T, p.ticks || 0, au, sc);
    frets(g, T, p.frets || 0, sc);
    threads(g, T, p.threads, au, sc);
    packets(g, T, p.packets || 0, p.threads, au, sc);
    if (p.ember && p.ember.a > 0) {
      var e = p.ember, cy = (p.threads && p.threads.cy) || 540;
      glow(g, 960, cy, e.r * (1 + 0.25 * au.level), GOLD, e.a);
      glow(g, 960, cy, e.r * 0.25, [255, 245, 225], e.a);
    }
    if (p.burst > 0) {
      g.setTransform(1, 0, 0, 1, 0, 0);
      glow(g, W / 2, H / 2, 1300, [255, 210, 150], p.burst * 0.85);
    }
    g.globalCompositeOperation = 'source-over';
  }

  window.STAGE = { mount: mount, render: render, tau: tau, shots: shots, BAR: BAR, DOIRA: DOIRA, NECK: NECK };
})();
