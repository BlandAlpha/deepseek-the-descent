/* ============================================================================
   js/moe.js — THE PARLIAMENT
   A 256-expert mixture-of-experts routing field for DEEPSEEK — THE DESCENT.
   Classic script, no dependencies, file:// safe. Attaches window.MoE.
   ----------------------------------------------------------------------------
   create(canvas, {
     onHover(info|null), onSelect(info), onRoute(state),
     reducedMotion, autoStart, insets, seed, debug
   }) -> instance
   instance = { start, pause, resume, destroy, resize, getState,
                inspect(id|null), select(id|null), clear(), setReducedMotion(bool) }
   ========================================================================== */
(function () {
  'use strict';

  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  var TAU = Math.PI * 2;
  var MONO = '"JetBrains Mono", "SFMono-Regular", ui-monospace, Menlo, Consolas, monospace';

  var SPECIALTIES = [
    'METAPHOR', 'PROOF', 'SYNTAX', 'TIDE LOGIC', 'MEMORY', 'TOPOLOGY',
    'DOUBT', 'ETYMOLOGY', 'RHYTHM', 'CAUSALITY', 'MAPMAKING', 'ANALOGY',
    'PRECISION', 'ABDUCTION', 'GRAVITY', 'SIGNAL', 'SILENCE', 'RECURSION',
    'HYPOTHESIS', 'CONTEXT', 'COMPRESSION', 'SEARCH', 'VISION', 'TRANSLATION',
    'JURISPRUDENCE', 'AESTHETICS', 'MECHANISM', 'COUNTERFACTUAL', 'SCALE',
    'PATIENCE', 'ERROR', 'WONDER', 'TENSION', 'RESOLUTION', 'NOISE', 'FLOOR',
    'LIGHT', 'PRESSURE', 'DEPTH', 'CURRENT', 'ECHO', 'ORIGIN'
  ];

  var CYCLE = 2.8;             // seconds between convenings
  var FIRST_ROUTE = 0.85;      // boot -> first convening
  var FADE_IN = 0.42;
  var FADE_START = CYCLE - 0.45;
  var FADE_END = CYCLE + 0.6;
  var REVEAL = 0.9;            // comet travel window

  var INK = '#eaf0fa';
  var MUTED = '#93a4c3';
  var BLUE = '#4d6bfe';
  var CYAN = '#86f7e8';
  var WARM = '#f0b384';
  var HAIR = 'rgba(166,195,255,0.14)';

  var DASH_DOTS = [1, 4];
  var DASH_RING = [2, 7];
  var DASH_FINE = [0.9, 4.1];
  var NONE_DASH = [];

  var SPR = null;

  /* ---------------------------------------------------------------- helpers */
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function smoothstep(a, b, x) {
    var t = clamp((x - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  }
  function easeInOut(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }
  function hash(n) {
    var x = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
    return x - Math.floor(x);
  }
  function pad2(n) { return n < 10 ? '0' + n : '' + n; }
  function pad3(n) { return n < 10 ? '00' + n : (n < 100 ? '0' + n : '' + n); }
  function pad4(n) {
    n = n | 0;
    return n < 10 ? '000' + n : (n < 100 ? '00' + n : (n < 1000 ? '0' + n : '' + n));
  }
  function clockString() {
    var d = new Date();
    return pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ':' + pad2(d.getSeconds());
  }
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function makeCanvas(w, h) {
    var c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w));
    c.height = Math.max(1, Math.round(h));
    return c;
  }
  function radialSprite(rgb) {
    var s = 128;
    var c = makeCanvas(s, s);
    var g = c.getContext('2d');
    var grd = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    grd.addColorStop(0.00, 'rgba(' + rgb + ',1)');
    grd.addColorStop(0.07, 'rgba(' + rgb + ',0.94)');
    grd.addColorStop(0.19, 'rgba(' + rgb + ',0.56)');
    grd.addColorStop(0.38, 'rgba(' + rgb + ',0.24)');
    grd.addColorStop(0.62, 'rgba(' + rgb + ',0.075)');
    grd.addColorStop(0.82, 'rgba(' + rgb + ',0.018)');
    grd.addColorStop(1.00, 'rgba(' + rgb + ',0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, s, s);
    return c;
  }
  function makeDarkSprite() {
    var s = 128;
    var c = makeCanvas(s, s);
    var g = c.getContext('2d');
    var grd = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    grd.addColorStop(0.00, 'rgba(3,7,13,0.92)');
    grd.addColorStop(0.38, 'rgba(3,7,13,0.82)');
    grd.addColorStop(0.66, 'rgba(3,7,13,0.42)');
    grd.addColorStop(0.86, 'rgba(3,7,13,0.12)');
    grd.addColorStop(1.00, 'rgba(3,7,13,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, s, s);
    return c;
  }
  function makeNeedleSprite() {
    var s = 512;
    var c = makeCanvas(s, s);
    var g = c.getContext('2d');
    var cx = s / 2, cy = s / 2, R = s / 2 - 12;
    var grd = g.createLinearGradient(cx, cy, cx + R, cy);
    grd.addColorStop(0.00, 'rgba(134,247,232,0)');
    grd.addColorStop(0.18, 'rgba(134,247,232,0.045)');
    grd.addColorStop(0.62, 'rgba(134,247,232,0.11)');
    grd.addColorStop(0.92, 'rgba(134,247,232,0.26)');
    grd.addColorStop(1.00, 'rgba(134,247,232,0.40)');
    g.strokeStyle = grd;
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(cx, cy);
    g.lineTo(cx + R, cy);
    g.stroke();
    var tg = g.createRadialGradient(cx + R, cy, 0, cx + R, cy, 14);
    tg.addColorStop(0, 'rgba(134,247,232,0.55)');
    tg.addColorStop(0.4, 'rgba(134,247,232,0.16)');
    tg.addColorStop(1, 'rgba(134,247,232,0)');
    g.fillStyle = tg;
    g.fillRect(cx + R - 14, cy - 14, 28, 28);
    return c;
  }
  function makeSweepSprite() {
    var s = 512;
    var c = makeCanvas(s, s);
    var g = c.getContext('2d');
    var cx = s / 2, cy = s / 2, R = s / 2;
    var tail = 1.0;
    var N = 96;
    for (var i = 0; i < N; i++) {
      var a0 = -tail + tail * (i / N);
      var a1 = -tail + tail * ((i + 1) / N) + 0.004;
      var a = Math.pow((i + 1) / N, 2.3) * 0.10;
      g.fillStyle = 'rgba(134,247,232,' + a.toFixed(4) + ')';
      g.beginPath();
      g.moveTo(cx, cy);
      g.arc(cx, cy, R, a0, a1);
      g.closePath();
      g.fill();
    }
    g.strokeStyle = 'rgba(134,247,232,0.22)';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(cx, cy);
    g.lineTo(cx + R, cy);
    g.stroke();
    return c;
  }
  function getSprites() {
    if (!SPR) {
      SPR = {
        cyan: radialSprite('134,247,232'),
        blue: radialSprite('77,107,254'),
        warm: radialSprite('240,179,132'),
        pale: radialSprite('214,232,255'),
        dark: makeDarkSprite(),
        needle: makeNeedleSprite()
      };
    }
    return SPR;
  }

  /* -------------------------------------------------------------- expert data */
  function buildExperts() {
    var list = [];
    for (var i = 0; i < 256; i++) {
      var gx = i % 16;
      var gy = (i / 16) | 0;
      var hidden = gx >= 6 && gx <= 9 && gy >= 6 && gy <= 9;
      var h1 = hash(i * 1.13 + 2.7);
      var h2 = hash(i * 3.71 + 9.2);
      var h3 = hash(i * 7.13 + 4.4);
      var h4 = hash(i * 11.37 + 7.7);
      var h5 = hash(i * 5.19 + 17.3);
      var h6 = hash(i * 9.61 + 23.9);
      var type = h5 < 0.70 ? 'dot' : (h5 < 0.88 ? 'cross' : 'ring');
      var tint = h6 < 0.72 ? 'rgba(188,210,246,1)' :
                 (h6 < 0.92 ? 'rgba(140,174,255,1)' : 'rgba(148,250,236,1)');
      list.push({
        i: i,
        id: i + 1,
        gx: gx,
        gy: gy,
        visible: !hidden,
        specialty: SPECIALTIES[(i * 17 + 5) % SPECIALTIES.length],
        code: 'EXPERT ' + pad3(i + 1),
        load: Math.round((38 + h3 * 61) * 10) / 10,
        baseAlpha: 0.34 + Math.pow(h1, 1.3) * 0.46,
        size: 1.1 + h2 * 1.5,
        cross: 1.9 + h2 * 1.8,
        ring: 2.4 + h2 * 1.8,
        type: type,
        tint: tint,
        bright: h4 > 0.80,
        twPhase: h4 * TAU,
        twSpeed: 0.25 + h2 * 0.75,
        jx: (hash(i * 2.17 + 6.1) - 0.5) * 2,
        jy: (hash(i * 13.9 + 1.7) - 0.5) * 2,
        x: 0, y: 0,
        sector: 0,
        dist: 0,
        weight: 1,
        routedAt: null,
        routes: 0
      });
    }
    return list;
  }

  /* ------------------------------------------------------------------ create */
  function create(canvas, options) {
    var opts = options || {};

    if (!canvas || typeof canvas.getBoundingClientRect !== 'function') return makeStub();

    var ctx = null;
    try {
      ctx = canvas.getContext('2d', { alpha: true });
    } catch (e) {
      ctx = null;
    }
    if (!ctx) return makeStub();

    var sprites = getSprites();

    var experts = buildExperts();
    var byId = {};
    var visibleExperts = [];
    var i, j;
    for (i = 0; i < experts.length; i++) {
      byId[experts[i].id] = experts[i];
      if (experts[i].visible) visibleExperts.push(experts[i]);
    }

    var W = 0, H = 0, scaleX = 1, scaleY = 1;
    var ready = false;
    var destroyed = false;
    var running = false;

    var layout = null;
    var fieldLayer = null;
    var fieldCtx = null;

    var simT = 0;
    var lastTs = 0;
    var rafId = 0;
    var staticRaf = 0;
    var frameMs = 0;
    var frameCount = 0;

    var gens = [];
    var latestGen = null;
    var activeIds = [];
    var activeIdSet = {};
    var prevIds = [];
    var nextRouteAt = FIRST_ROUTE;
    var routeCounter = 0;
    var pinned = null;
    var hovered = null;
    var hoveredAt = -10;
    var pinnedAt = -10;

    var docVisible = !document.hidden;
    var visible = true;
    var reduced = false;
    var mq = null;
    var mqHandler = null;
    var usingMQ = false;

    var onHover = typeof opts.onHover === 'function' ? opts.onHover : null;
    var onSelect = typeof opts.onSelect === 'function' ? opts.onSelect : null;
    var onRoute = typeof opts.onRoute === 'function' ? opts.onRoute : null;
    var debug = !!opts.debug;

    var tickLit = [0, 0, 0, 0, 0, 0, 0, 0];
    var measureCtx = makeCanvas(8, 8).getContext('2d');
    var charMaps = {};

    /* --------------------------------------------------------------- reduced */
    if (opts.reducedMotion == null) {
      if (window.matchMedia) {
        mq = window.matchMedia('(prefers-reduced-motion: reduce)');
        reduced = !!mq.matches;
        usingMQ = true;
        mqHandler = function (ev) { setReducedMotion(ev.matches); };
        if (mq.addEventListener) mq.addEventListener('change', mqHandler);
        else if (mq.addListener) mq.addListener(mqHandler);
      }
    } else {
      reduced = !!opts.reducedMotion;
    }

    /* --------------------------------------------------------------- geometry */
    function computeLayout() {
      var compact = W < 640 || H < 420;
      var ins = opts.insets || null;
      var top = 54, bottom = 92, side = 28;
      if (compact) {
        top = 38;
        bottom = 72;
        side = 14;
      }
      if (ins) {
        if (typeof ins.top === 'number') top = ins.top;
        if (typeof ins.bottom === 'number') bottom = ins.bottom;
        if (typeof ins.left === 'number') side = ins.left;
        if (typeof ins.right === 'number') side = Math.max(side, ins.right);
      }
      if (H - top - bottom < 150) {
        var k = Math.max(0.6, (H - 150) / (top + bottom));
        top *= k;
        bottom *= k;
      }
      if (W < 640) side = Math.min(side, W * 0.07);
      if (H < 420) side = Math.min(side, W * 0.06);

      var availW = Math.max(40, W - side * 2);
      var availH = Math.max(40, H - top - bottom);
      var fieldW = Math.min(availW, availH * 2.3);
      var fieldH = availH;
      var x0 = side + (availW - fieldW) / 2;
      var y0 = top;
      var pitchX = fieldW / 16;
      var pitchY = fieldH / 16;
      var cx = x0 + fieldW / 2;
      var cy = y0 + fieldH / 2;
      var unit = pitchY;

      var awakeFont = clamp(unit * 0.38, 8, 11);
      var questionFont = Math.max(7.6, awakeFont * 0.82);
      var awakeY = cy + Math.min(unit * 1.80, unit * 2 - awakeFont * 0.8 - 2);
      var showQuestion = unit >= 25;
      var questionY = cy - Math.min(unit * 1.78, unit * 2 - questionFont * 0.8 - 3);

      var rx = Math.min(unit * 3.75, pitchX * 2 - 8);
      var ry = Math.min(unit * 1.3, unit * 2 - awakeFont * 1.1 - 6);
      ry = Math.max(unit * 0.62, ry);
      rx = Math.max(ry * 1.5, rx);

      var ticks = [];
      for (var tk = 0; tk < 8; tk++) {
        var phi = -Math.PI / 2 + tk * (TAU / 8);
        var ca0 = Math.cos(phi);
        var sa0 = Math.sin(phi);
        var rE0 = 1 / Math.sqrt((ca0 / rx) * (ca0 / rx) + (sa0 / ry) * (sa0 / ry));
        ticks.push({
          phi: phi,
          x: cx + ca0 * rE0,
          y: cy + sa0 * rE0,
          theta: Math.atan2((sa0 * rE0) / ry, (ca0 * rE0) / rx)
        });
      }

      layout = {
        top: top, bottom: bottom, side: side,
        availW: availW, availH: availH,
        fieldW: fieldW, fieldH: fieldH,
        x0: x0, y0: y0,
        pitchX: pitchX, pitchY: pitchY,
        cx: cx, cy: cy,
        unit: unit,
        rx: rx, ry: ry,
        ticks: ticks,
        rArrive: Math.sqrt(rx * ry),
        awakeFont: awakeFont,
        questionFont: questionFont,
        awakeY: awakeY,
        questionY: questionY,
        showQuestion: showQuestion,
        spacingAwake: awakeFont * 0.15,
        spacingQuestion: questionFont * 0.16,
        hoverFont: clamp(unit * 0.30, 8, 10),
        hoverSpacing: 1.1,
        sweepR: Math.min(availW, availH) * 0.62,
        hue: 0
      };

      for (i = 0; i < experts.length; i++) {
        var e = experts[i];
        var jitterAmp = Math.min(pitchX, pitchY);
        e.x = x0 + (e.gx + 0.5) * pitchX + e.jx * jitterAmp * 0.07;
        e.y = y0 + (e.gy + 0.5) * pitchY + e.jy * jitterAmp * 0.05;
      }
      rebuildSectors();
      rebuildLabels();
    }

    function rebuildSectors() {
      for (var s = 0; s < 8; s++) sectorLists[s].length = 0;
      for (var k = 0; k < visibleExperts.length; k++) {
        var e = visibleExperts[k];
        var dx = e.x - layout.cx;
        var dy = e.y - layout.cy;
        var ang = Math.atan2(dy, dx);
        if (ang < 0) ang += TAU;
        var sector = Math.min(7, Math.floor(ang / (TAU / 8)));
        var dist = Math.sqrt(dx * dx + dy * dy);
        e.sector = sector;
        e.dist = dist;
        e.weight = 0.55 + 0.9 * Math.min(1, dist / (layout.fieldW * 0.45));
        sectorLists[sector].push(e);
      }
    }

    var sectorLists = [[], [], [], [], [], [], [], []];

    function rebuildLabels() {
      layout.questionParts = [{ text: 'QUESTION IN', color: 'rgba(180,197,220,0.74)' }];
      layout.awakeParts = [
        { text: '8', color: '#86f7e8' },
        { text: ' / 256 AWAKE', color: 'rgba(183,200,226,0.84)' }
      ];
      hoverParts = null;
      pinnedParts = null;
      if (hovered) buildHoverParts(hovered);
      if (pinned) buildPinnedParts(pinned);
    }

    /* -------------------------------------------------------------- text util */
    function charMap(font) {
      var map = charMaps[font];
      if (map) return map;
      map = {};
      measureCtx.font = font;
      for (var cc = 32; cc < 127; cc++) {
        var ch = String.fromCharCode(cc);
        map[ch] = measureCtx.measureText(ch).width;
      }
      charMaps[font] = map;
      return map;
    }
    function measureParts(parts, font, spacing) {
      var map = charMap(font);
      var total = 0;
      for (var p = 0; p < parts.length; p++) {
        var text = parts[p].text;
        for (var k = 0; k < text.length; k++) {
          total += map[text.charAt(k)] || 0;
          if (k < text.length - 1) total += spacing;
        }
        if (p < parts.length - 1 && text.length > 0) total += spacing;
      }
      return total;
    }
    function drawParts(parts, centerX, y, font, spacing, alpha, outlineWidth) {
      if (!parts || !parts.length) return;
      var map = charMap(font);
      var total = measureParts(parts, font, spacing);
      var x = centerX - total / 2;
      var x0 = x;
      ctx.font = font;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.globalAlpha = alpha == null ? 1 : alpha;
      var p, k, text, ch;
      if (outlineWidth) {
        ctx.strokeStyle = 'rgba(3,7,13,0.88)';
        ctx.lineWidth = outlineWidth;
        ctx.lineJoin = 'round';
        ctx.miterLimit = 2;
        for (p = 0; p < parts.length; p++) {
          text = parts[p].text;
          for (k = 0; k < text.length; k++) {
            ch = text.charAt(k);
            ctx.strokeText(ch, x, y);
            x += (map[ch] || 0) + spacing;
          }
        }
        x = x0;
      }
      for (p = 0; p < parts.length; p++) {
        text = parts[p].text;
        ctx.fillStyle = parts[p].color;
        for (k = 0; k < text.length; k++) {
          ch = text.charAt(k);
          ctx.fillText(ch, x, y);
          x += (map[ch] || 0) + spacing;
        }
      }
      ctx.globalAlpha = 1;
    }
    function font(size) { return '400 ' + size.toFixed(2) + 'px ' + MONO; }

    /* ------------------------------------------------------------- field layer */
    function buildFieldLayer() {
      if (!layout) return;
      var pw = Math.round(W * scaleX);
      var ph = Math.round(H * scaleY);
      if (pw < 2 || ph < 2) { fieldLayer = null; return; }
      var c = makeCanvas(pw, ph);
      var g = c.getContext('2d');
      g.setTransform(scaleX, 0, 0, scaleY, 0, 0);
      g.clearRect(0, 0, W, H);
      var L = layout;

      /* atmosphere — wide, soft, never opaque */
      g.globalCompositeOperation = 'lighter';
      blitEllipse(g, sprites.blue, L.cx, L.cy, L.availW * 0.54, L.availH * 0.74, 0.20);
      blitEllipse(g, sprites.cyan, L.cx, L.cy, L.availW * 0.40, L.availH * 0.15, 0.12);
      blitEllipse(g, sprites.blue, L.cx, L.cy, L.availW * 0.22, L.availH * 0.30, 0.09);
      g.globalCompositeOperation = 'source-over';

      /* wide range ellipses */
      var ringSets = [
        { rx: L.availW * 0.485, ry: L.availH * 0.475, a: 0.20, dash: DASH_RING },
        { rx: L.availW * 0.345, ry: L.availH * 0.345, a: 0.12, dash: DASH_DOTS },
        { rx: L.rx * 1.55, ry: L.ry * 1.55, a: 0.20, dash: DASH_RING }
      ];
      g.strokeStyle = 'rgba(166,195,255,1)';
      g.lineWidth = 0.65;
      for (var r = 0; r < ringSets.length; r++) {
        g.globalAlpha = ringSets[r].a;
        g.setLineDash(ringSets[r].dash);
        g.beginPath();
        g.ellipse(L.cx, L.cy, ringSets[r].rx, ringSets[r].ry, 0, 0, TAU);
        g.stroke();
      }
      g.setLineDash(NONE_DASH);
      g.globalAlpha = 1;

      /* ticks on the outer range and the inner astrolabe */
      g.strokeStyle = 'rgba(166,195,255,1)';
      var ring0 = ringSets[0];
      for (var t = 0; t < 48; t++) {
        var ang = (t / 48) * TAU;
        var tx = L.cx + Math.cos(ang) * ring0.rx;
        var ty = L.cy + Math.sin(ang) * ring0.ry;
        var long = t % 4 === 0;
        g.globalAlpha = long ? 0.15 : 0.07;
        g.beginPath();
        g.moveTo(tx - Math.cos(ang) * (long ? 4.5 : 2.5), ty - Math.sin(ang) * (long ? 4.5 : 2.5));
        g.lineTo(tx + Math.cos(ang) * (long ? 4.5 : 2.5), ty + Math.sin(ang) * (long ? 4.5 : 2.5));
        g.stroke();
      }
      var ringC = ringSets[2];
      for (t = 0; t < 32; t++) {
        var ang2 = (t / 32) * TAU;
        var cx2 = L.cx + Math.cos(ang2) * ringC.rx;
        var cy2 = L.cy + Math.sin(ang2) * ringC.ry;
        var tlong = t % 4 === 0;
        g.globalAlpha = tlong ? 0.20 : 0.10;
        g.beginPath();
        g.moveTo(cx2 - Math.cos(ang2) * (tlong ? 4.5 : 2.5), cy2 - Math.sin(ang2) * (tlong ? 4.5 : 2.5));
        g.lineTo(cx2 + Math.cos(ang2) * (tlong ? 4.5 : 2.5), cy2 + Math.sin(ang2) * (tlong ? 4.5 : 2.5));
        g.stroke();
      }

      /* horizontal instrument axis, broken around the core */
      var axisGap = L.rx + L.unit * 1.8;
      g.globalAlpha = 0.075;
      g.strokeStyle = 'rgba(166,195,255,1)';
      g.lineWidth = 0.8;
      g.beginPath();
      g.moveTo(L.side + 12, L.cy);
      g.lineTo(L.cx - axisGap, L.cy);
      g.moveTo(L.cx + axisGap, L.cy);
      g.lineTo(W - L.side - 12, L.cy);
      g.stroke();
      g.globalAlpha = 0.10;
      g.beginPath();
      g.moveTo(L.side + 12, L.cy - 3);
      g.lineTo(L.side + 12, L.cy + 3);
      g.moveTo(W - L.side - 12, L.cy - 3);
      g.lineTo(W - L.side - 12, L.cy + 3);
      g.stroke();
      g.globalAlpha = 0.06;
      for (var ax = L.side + 72; ax < L.cx - axisGap; ax += 72) {
        g.beginPath();
        g.moveTo(ax, L.cy - 2);
        g.lineTo(ax, L.cy + 2);
        g.stroke();
      }
      for (ax = L.cx + axisGap; ax < W - L.side - 60; ax += 72) {
        g.beginPath();
        g.moveTo(ax, L.cy - 2);
        g.lineTo(ax, L.cy + 2);
        g.stroke();
      }

      /* peripheral row rails — instrument texture, desktop only */
      if (W >= 760) {
        g.strokeStyle = 'rgba(166,195,255,1)';
        g.globalAlpha = 0.055;
        g.beginPath();
        g.moveTo(L.side + 5, L.y0);
        g.lineTo(L.side + 5, L.y0 + L.fieldH);
        g.moveTo(W - L.side - 5, L.y0);
        g.lineTo(W - L.side - 5, L.y0 + L.fieldH);
        g.stroke();
        g.globalAlpha = 0.10;
        for (var rr = 0; rr < 16; rr++) {
          var ry2 = L.y0 + (rr + 0.5) * L.pitchY;
          var tall = rr % 4 === 0;
          g.beginPath();
          g.moveTo(L.side + 5, ry2);
          g.lineTo(L.side + (tall ? 12 : 9), ry2);
          g.moveTo(W - L.side - 5, ry2);
          g.lineTo(W - L.side - (tall ? 12 : 9), ry2);
          g.stroke();
        }
      }

      /* distant dust — atmosphere only, not experts */
      for (var d = 0; d < 200; d++) {
        var dh1 = hash(d * 1.71 + 91.3);
        var dh2 = hash(d * 3.97 + 17.1);
        var dh3 = hash(d * 7.33 + 2.2);
        var dh4 = hash(d * 2.33 + 5.5);
        var dustX = L.x0 + dh1 * L.fieldW;
        var dustY = L.y0 + dh2 * L.fieldH;
        var ex = (dustX - L.cx) / L.rx;
        var ey = (dustY - L.cy) / L.ry;
        if (ex * ex + ey * ey < 1.45) continue;
        g.globalAlpha = 0.035 + dh3 * 0.10;
        g.fillStyle = dh4 > 0.90 ? 'rgba(134,247,232,1)' : 'rgba(184,205,240,1)';
        var dsz = 0.55 + dh4 * 0.95;
        g.fillRect(dustX - dsz / 2, dustY - dsz / 2, dsz, dsz);
        if (dh4 > 0.93) {
          g.globalAlpha = 0.045 + dh3 * 0.06;
          g.drawImage(sprites.pale, dustX - 3.5, dustY - 3.5, 7, 7);
        }
      }
      g.globalAlpha = 1;

      /* cells */
      for (var k = 0; k < visibleExperts.length; k++) {
        var e = visibleExperts[k];
        g.globalAlpha = e.baseAlpha;
        var halo = 6 + e.size * 2.9;
        g.globalAlpha = e.baseAlpha * (e.bright ? 0.34 : 0.16);
        g.drawImage(sprites.pale, e.x - halo / 2, e.y - halo / 2, halo, halo);
        g.globalAlpha = e.baseAlpha;
        if (e.bright) {
          var bs = 10 + e.size * 2.8;
          g.globalAlpha = e.baseAlpha * 0.34;
          g.drawImage(sprites.cyan, e.x - bs / 2, e.y - bs / 2, bs, bs);
          g.globalAlpha = e.baseAlpha;
        }
        if (e.type === 'dot') {
          g.fillStyle = e.tint;
          g.fillRect(e.x - e.size / 2, e.y - e.size / 2, e.size, e.size);
        } else if (e.type === 'cross') {
          g.fillStyle = e.tint;
          var arm = e.cross;
          g.fillRect(e.x - arm, e.y - 0.35, arm * 2, 0.7);
          g.fillRect(e.x - 0.35, e.y - arm, 0.7, arm * 2);
        } else {
          g.strokeStyle = e.tint;
          g.lineWidth = 0.55;
          g.beginPath();
          g.arc(e.x, e.y, e.ring, 0, TAU);
          g.stroke();
        }
      }
      g.globalAlpha = 1;

      /* soft edge vignette — transparent centre, faint darkening at extremes */
      fieldLayer = c;
      fieldCtx = g;
    }

    function blitEllipse(g, img, x, y, rx, ry, alpha) {
      g.globalAlpha = alpha;
      g.drawImage(img, x - rx, y - ry, rx * 2, ry * 2);
      g.globalAlpha = 1;
    }

    /* ----------------------------------------------------------------- layout */
    function updatePositionsForGens() {
      for (var gi = 0; gi < gens.length; gi++) {
        var beams = gens[gi].beams;
        for (var bi = 0; bi < beams.length; bi++) rebuildBeam(beams[bi]);
      }
    }

    function rebuildBeam(beam) {
      var e = beam.expert;
      var L = layout;
      beam.p0x = e.x;
      beam.p0y = e.y;
      var dx = e.x - L.cx;
      var dy = e.y - L.cy;
      var ca = dx;
      var sa = dy;
      var dist = Math.sqrt(ca * ca + sa * sa) || 1;
      ca /= dist;
      sa /= dist;
      var rE = 1 / Math.sqrt((ca / L.rx) * (ca / L.rx) + (sa / L.ry) * (sa / L.ry));
      rE *= 0.985 + beam.spread * 0.03;
      beam.p2x = L.cx + ca * rE;
      beam.p2y = L.cy + sa * rE;
      beam.angle = Math.atan2(sa, ca);
      var mx = (beam.p0x + beam.p2x) / 2;
      var my = (beam.p0y + beam.p2y) / 2;
      var nx = -sa;
      var ny = ca;
      var bow = (0.075 + beam.bow * 0.105) * dist * (beam.spin ? 1 : -1);
      beam.cpx = mx + nx * bow;
      beam.cpy = my + ny * bow;
      beam.dist = dist;
      beam.path = new Path2D();
      beam.path.moveTo(beam.p0x, beam.p0y);
      beam.path.quadraticCurveTo(beam.cpx, beam.cpy, beam.p2x, beam.p2y);
      var grad = ctx.createLinearGradient(beam.p0x, beam.p0y, beam.p2x, beam.p2y);
      grad.addColorStop(0, 'rgba(77,107,254,0.14)');
      grad.addColorStop(0.45, 'rgba(93,134,255,0.32)');
      grad.addColorStop(0.82, 'rgba(134,247,232,0.56)');
      grad.addColorStop(1, 'rgba(134,247,232,0.82)');
      beam.grad = grad;
    }

    /* ------------------------------------------------------------ route chooser */
    function pickSector(sector, rng, chosenAngles) {
      var list = sectorLists[sector];
      if (!list.length) return null;
      var tries = 0;
      while (tries < 5) {
        var total = 0;
        var k;
        for (k = 0; k < list.length; k++) total += list[k].weight;
        var r = rng() * total;
        var pick = null;
        for (k = 0; k < list.length; k++) {
          r -= list[k].weight;
          if (r <= 0) { pick = list[k]; break; }
        }
        if (!pick) pick = list[Math.floor(rng() * list.length)];
        var ang = Math.atan2(pick.y - layout.cy, pick.x - layout.cx);
        var ok = true;
        for (k = 0; k < chosenAngles.length; k++) {
          var d = Math.abs(((ang - chosenAngles[k] + Math.PI * 3) % TAU) - Math.PI);
          if (d < 0.20) { ok = false; break; }
        }
        if (ok) return pick;
        tries++;
      }
      return list[Math.floor(rng() * list.length)];
    }

    function chooseRoute(rng) {
      var chosen = [];
      var used = {};
      var angles = [];
      var pinSector = pinned && pinned.visible ? pinned.sector : -1;
      var s;
      for (s = 0; s < 8; s++) {
        var pick = null;
        if (s === pinSector) {
          pick = pinned;
        } else {
          pick = pickSector(s, rng, angles);
        }
        if (pick && !used[pick.id]) {
          chosen.push(pick);
          used[pick.id] = 1;
          angles.push(Math.atan2(pick.y - layout.cy, pick.x - layout.cx));
        }
      }
      if (pinned && pinned.visible && !used[pinned.id]) {
        chosen.push(pinned);
        used[pinned.id] = 1;
      }
      var guard = 0;
      while (chosen.length < 8 && guard < 60) {
        guard++;
        var e = visibleExperts[Math.floor(rng() * visibleExperts.length)];
        if (e && !used[e.id]) {
          chosen.push(e);
          used[e.id] = 1;
        }
      }
      while (chosen.length > 8) chosen.pop();
      return chosen;
    }

    function overlapWithPrev(chosen) {
      var n = 0;
      for (var k = 0; k < chosen.length; k++) {
        for (var j2 = 0; j2 < prevIds.length; j2++) {
          if (chosen[k].id === prevIds[j2]) { n++; break; }
        }
      }
      return n;
    }

    function convene(startAt, rng) {
      var chosen = chooseRoute(rng);
      var tries = 0;
      while (overlapWithPrev(chosen) > 5 && tries < 4 && !pinned) {
        chosen = chooseRoute(rng);
        tries++;
      }
      routeCounter++;
      var stamp = clockString();
      var beams = [];
      var chosenIds = [];
      for (var k = 0; k < chosen.length; k++) {
        var e = chosen[k];
        e.routedAt = stamp;
        e.routes++;
        chosenIds.push(e.id);
        var beam = {
          expert: e,
          index: k,
          spread: hash(e.i * 7.7 + routeCounter * 3.1),
          bow: hash(e.i * 11.3 + routeCounter * 5.7),
          spin: hash(e.i * 2.9 + routeCounter) > 0.3,
          depart: 0,
          travel: 0.7,
          path: null,
          grad: null
        };
        beams.push(beam);
      }
      beams.sort(function (a, b) {
        return Math.atan2(a.expert.y - layout.cy, a.expert.x - layout.cx) -
               Math.atan2(b.expert.y - layout.cy, b.expert.x - layout.cx);
      });
      for (k = 0; k < beams.length; k++) {
        var b = beams[k];
        b.index = k;
        b.depart = 0.10 + k * 0.045 + hash(b.expert.i + routeCounter * 13.7) * 0.08;
        rebuildBeam(b);
        b.travel = 0.60 + clamp(b.dist / 720, 0, 1) * 0.36 + hash(b.expert.i * 3.3 + routeCounter) * 0.10;
      }
      var gen = {
        id: routeCounter,
        start: startAt,
        beams: beams,
        experts: chosen,
        idSet: {}
      };
      for (k = 0; k < chosen.length; k++) gen.idSet[chosen[k].id] = 1;
      gens.push(gen);
      latestGen = gen;
      activeIds = chosenIds;
      activeIdSet = gen.idSet;
      prevIds = chosenIds.slice();
      if (onRoute) {
        try {
          onRoute({
            route: routeCounter,
            routeLabel: '#' + pad4(routeCounter),
            awake: chosen.length,
            total: 256,
            shared: 1,
            activeIds: chosenIds.slice()
          });
        } catch (err) { report(err); }
      }
      if (hovered) emitHover(hovered);
    }

    function makeRouteRng() {
      if (typeof opts.seed === 'number') {
        return mulberry32((opts.seed | 0) + routeCounter * 7919 + 17);
      }
      return Math.random;
    }

    /* --------------------------------------------------------------- envelopes */
    function genEnv(gen, now) {
      if (reduced) return 1;
      var t = now - gen.start;
      if (t < 0) return 0;
      return smoothstep(0, FADE_IN, t) * (1 - smoothstep(FADE_START, FADE_END, t));
    }

    function bez(beam, t) {
      var mt = 1 - t;
      return {
        x: mt * mt * beam.p0x + 2 * mt * t * beam.cpx + t * t * beam.p2x,
        y: mt * mt * beam.p0y + 2 * mt * t * beam.cpy + t * t * beam.p2y
      };
    }

    /* -------------------------------------------------------------------- draw */
    function draw(now) {
      if (!ready || !layout) return;
      ctx.setTransform(scaleX, 0, 0, scaleY, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';

      if (fieldLayer) ctx.drawImage(fieldLayer, 0, 0, W, H);

      drawSweep(now);
      drawTwinkles(now);
      drawMotes(now);

      for (var gi = 0; gi < gens.length; gi++) {
        var env = genEnv(gens[gi], now);
        if (env > 0.002) drawBeams(gens[gi], now, env);
      }
      drawRouteHighlights(now);
      drawCore(now);
      drawSelections(now);

      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      ctx.setLineDash(NONE_DASH);
      ctx.lineDashOffset = 0;
    }

    function drawSweep(now) {
      if (reduced) return;
      var L = layout;
      var ang = -1.15 + now * 0.10;
      var R = Math.max(L.sweepR, L.rx * 2.1);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.34;
      ctx.translate(L.cx, L.cy);
      ctx.rotate(ang);
      ctx.drawImage(sprites.needle, -R, -R, R * 2, R * 2);
      ctx.restore();
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }

    function drawTwinkles(now) {
      if (!layout) return;
      var t = reduced ? 0 : now;
      ctx.globalCompositeOperation = 'lighter';
      for (var k = 0; k < experts.length; k++) {
        var e = experts[k];
        if (!e.visible || (!e.bright && e.baseAlpha < 0.30)) continue;
        var tw = 0.5 + 0.5 * Math.sin(t * e.twSpeed + e.twPhase);
        tw = tw * tw;
        var glowSize = 5 + e.size * 1.6;
        ctx.globalAlpha = (e.bright ? 0.085 : 0.032) * tw;
        ctx.drawImage(sprites.pale, e.x - glowSize / 2, e.y - glowSize / 2, glowSize, glowSize);
        if (e.bright) {
          ctx.globalAlpha = 0.20 * tw;
          ctx.fillStyle = e.tint;
          ctx.fillRect(e.x - 0.7, e.y - 0.7, 1.4, 1.4);
        }
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }

    function drawMotes(now) {
      var L = layout;
      var t = reduced ? 0 : now;
      ctx.globalCompositeOperation = 'lighter';
      for (var k = 0; k < 64; k++) {
        var h1 = hash(k * 3.7 + 11.1);
        var h2 = hash(k * 7.3 + 5.9);
        var h3 = hash(k * 1.9 + 23.3);
        var x = L.x0 + h1 * L.fieldW + Math.sin(t * 0.045 + h2 * TAU) * 9;
        var y = L.y0 + ((h2 * L.fieldH - t * (0.8 + h3 * 1.4)) % L.fieldH + L.fieldH) % L.fieldH;
        var a = 0.055 + h3 * 0.09;
        var sz = 2.0 + h1 * 5.0;
        ctx.globalAlpha = a;
        ctx.drawImage(sprites.pale, x - sz / 2, y - sz / 2, sz, sz);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }

    function drawBeams(gen, now, env) {
      var beams = gen.beams;
      var k;
      ctx.globalCompositeOperation = 'source-over';
      for (k = 0; k < beams.length; k++) {
        var beam = beams[k];
        ctx.strokeStyle = beam.grad;
        ctx.lineWidth = 0.8;
        ctx.globalAlpha = env;
        ctx.stroke(beam.path);
        ctx.lineWidth = 3.4;
        ctx.globalAlpha = env * 0.10;
        ctx.stroke(beam.path);
      }

      ctx.globalCompositeOperation = 'lighter';
      for (k = 0; k < beams.length; k++) {
        var b = beams[k];
        var t = now - (gen.start + b.depart);
        if (t < 0 || t > b.travel) continue;
        var u = clamp(t / b.travel, 0, 1);
        var p = easeInOut(u);
        var mt = 1 - p;
        var qx = mt * mt * b.p0x + 2 * mt * p * b.cpx + p * p * b.p2x;
        var qy = mt * mt * b.p0y + 2 * mt * p * b.cpy + p * p * b.p2y;

        /* lit section of the beam behind the head */
        var c1x = lerp(b.p0x, b.cpx, p);
        var c1y = lerp(b.p0y, b.cpy, p);
        ctx.globalAlpha = env * 0.20;
        ctx.strokeStyle = 'rgba(134,247,232,1)';
        ctx.lineWidth = 0.9;
        ctx.beginPath();
        ctx.moveTo(b.p0x, b.p0y);
        ctx.quadraticCurveTo(c1x, c1y, qx, qy);
        ctx.stroke();

        /* comet tail */
        for (var q = 4; q >= 1; q--) {
          var pp = Math.max(0, p - q * 0.030);
          var mm = 1 - pp;
          var tx = mm * mm * b.p0x + 2 * mm * pp * b.cpx + pp * pp * b.p2x;
          var ty = mm * mm * b.p0y + 2 * mm * pp * b.cpy + pp * pp * b.p2y;
          var ts = Math.max(4, layout.unit * (0.10 + q * 0.012));
          ctx.globalAlpha = env * (0.16 - q * 0.022);
          ctx.drawImage(sprites.cyan, tx - ts / 2, ty - ts / 2, ts, ts);
        }
        var hs = Math.max(9, layout.unit * 0.44);
        ctx.globalAlpha = env * 0.7;
        ctx.drawImage(sprites.cyan, qx - hs / 2, qy - hs / 2, hs, hs);
        ctx.globalAlpha = env * 0.9;
        ctx.fillStyle = '#eaffff';
        ctx.fillRect(qx - 0.9, qy - 0.9, 1.8, 1.8);
      }

      /* continued token drift after arrival */
      for (k = 0; k < beams.length; k++) {
        var b2 = beams[k];
        var arrive = gen.start + b2.depart + b2.travel;
        if (now < arrive) continue;
        var age = now - arrive;
        var uu = (age * 0.56 + b2.index * 0.13) % 1;
        var fade = Math.sin(uu * Math.PI);
        var pp2 = 0.10 + uu * 0.88;
        var mt2 = 1 - pp2;
        var mx = mt2 * mt2 * b2.p0x + 2 * mt2 * pp2 * b2.cpx + pp2 * pp2 * b2.p2x;
        var my = mt2 * mt2 * b2.p0y + 2 * mt2 * pp2 * b2.cpy + pp2 * pp2 * b2.p2y;
        var ms = Math.max(4, layout.unit * 0.13);
        ctx.globalAlpha = env * 0.24 * fade;
        ctx.drawImage(sprites.cyan, mx - ms / 2, my - ms / 2, ms, ms);
      }

      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }

    function drawRouteHighlights(now) {
      var L = layout;
      for (var gi = 0; gi < gens.length; gi++) {
        var gen = gens[gi];
        var env = genEnv(gen, now);
        if (env <= 0.002) continue;
        for (var k = 0; k < gen.beams.length; k++) {
          var b = gen.beams[k];
          var e = b.expert;
          var launchAge = now - (gen.start + b.depart);
          var arriveAt = gen.start + b.depart + b.travel;
          var arriveAge = now - arriveAt;

          ctx.globalCompositeOperation = 'lighter';
          var glowA = env * (0.18 + 0.30 * Math.exp(-Math.max(0, launchAge) * 1.3));
          var gs = Math.max(10, L.pitchY * 1.15);
          ctx.globalAlpha = glowA;
          ctx.drawImage(sprites.cyan, e.x - gs / 2, e.y - gs / 2, gs, gs);
          ctx.globalCompositeOperation = 'source-over';
          ctx.globalAlpha = env * 0.92;
          ctx.fillStyle = CYAN;
          ctx.fillRect(e.x - 0.95, e.y - 0.95, 1.9, 1.9);

          if (launchAge >= 0 && launchAge < 0.85) {
            var rr = Math.max(2.4, L.pitchY * 0.10) + launchAge * L.pitchY * 0.62;
            ctx.strokeStyle = 'rgba(134,247,232,1)';
            ctx.globalAlpha = Math.pow(1 - launchAge / 0.85, 2) * 0.28 * env;
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.arc(e.x, e.y, rr, 0, TAU);
            ctx.stroke();
          }

          if (arriveAge >= 0 && arriveAge < 0.8) {
            var rr2 = Math.max(2, L.pitchY * 0.08) + arriveAge * L.pitchY * 0.72;
            ctx.globalCompositeOperation = 'lighter';
            ctx.strokeStyle = 'rgba(134,247,232,1)';
            ctx.globalAlpha = Math.pow(1 - arriveAge / 0.8, 2) * 0.28 * env;
            ctx.lineWidth = 0.9;
            ctx.beginPath();
            ctx.arc(b.p2x, b.p2y, rr2, 0, TAU);
            ctx.stroke();
            ctx.globalCompositeOperation = 'source-over';
          }
        }
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }

    function drawCore(now) {
      var L = layout;
      var unit = L.unit;
      var cx = L.cx, cy = L.cy;
      var breath = 0.5 + 0.5 * Math.sin(now * 0.55 + 1.1);

      /* gather arrival pulse + tick lights */
      var pulse = 0;
      var kk, k;
      for (kk = 0; kk < 8; kk++) tickLit[kk] = 0;
      for (var gi = 0; gi < gens.length; gi++) {
        var gen = gens[gi];
        var env = genEnv(gen, now);
        if (env <= 0.002) continue;
        for (var bi = 0; bi < gen.beams.length; bi++) {
          var b = gen.beams[bi];
          var age = now - (gen.start + b.depart + b.travel);
          if (age >= 0 && age < 1.6) {
            pulse += Math.exp(-age * 5.0) * env;
            var idx = Math.round(((b.angle - (-Math.PI / 2)) / TAU) * 8);
            idx = ((idx % 8) + 8) % 8;
            var lit = Math.exp(-age * 2.2) * env;
            if (lit > tickLit[idx]) tickLit[idx] = lit;
          }
        }
      }
      pulse = Math.min(0.85, pulse * 0.16);
      var scale = 1 + breath * 0.012 + pulse * 0.05;

      /* wide bloom */
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.07 + breath * 0.015 + pulse * 0.03;
      ctx.drawImage(sprites.blue, cx - L.rx * 3.4, cy - L.ry * 4.5,
                    L.rx * 6.8, L.ry * 9);
      ctx.globalAlpha = 0.10 + breath * 0.022 + pulse * 0.045;
      ctx.drawImage(sprites.blue, cx - L.rx * 2.55 * scale, cy - L.ry * 2.9 * scale,
                    L.rx * 5.1 * scale, L.ry * 5.8 * scale);
      ctx.globalAlpha = 0.13 + breath * 0.025 + pulse * 0.055;
      ctx.drawImage(sprites.cyan, cx - L.rx * 1.28 * scale, cy - L.ry * 1.65 * scale,
                    L.rx * 2.56 * scale, L.ry * 3.3 * scale);
      ctx.globalAlpha = 0.03 + breath * 0.008 + pulse * 0.025;
      ctx.drawImage(sprites.blue, cx - L.availW * 0.31, cy - L.availH * 0.20,
                    L.availW * 0.62, L.availH * 0.40);

      /* nucleus bloom */
      ctx.globalAlpha = 0.78 + breath * 0.1;
      var ns = Math.max(20, unit * 1.5 * scale);
      ctx.drawImage(sprites.cyan, cx - ns / 2, cy - ns / 2, ns, ns);
      ctx.globalAlpha = 0.85;
      var ns2 = Math.max(8, unit * 0.62 * scale);
      ctx.drawImage(sprites.pale, cx - ns2 / 2, cy - ns2 / 2, ns2, ns2);

      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      ctx.strokeStyle = 'rgba(134,247,232,1)';

      /* deep iris — darken the middle so the rings and nucleus read */
      blitEllipse(ctx, sprites.dark, cx, cy, L.rx * 0.66, L.ry * 0.86, 0.36);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.20 + breath * 0.03;
      var interior = Math.max(30, unit * 2.6);
      ctx.drawImage(sprites.cyan, cx - interior / 2, cy - interior / 2, interior, interior);
      ctx.globalCompositeOperation = 'source-over';

      /* luminous pupil rim */
      ctx.globalAlpha = 0.38 + breath * 0.06;
      ctx.strokeStyle = 'rgba(134,247,232,1)';
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.ellipse(cx, cy, L.rx * 0.66, L.ry * 0.86, 0, 0, TAU);
      ctx.stroke();
      ctx.globalAlpha = 0.07 + breath * 0.015;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.ellipse(cx, cy, L.rx * 0.66, L.ry * 0.86, 0, 0, TAU);
      ctx.stroke();

      /* iris spokes */
      for (k = 0; k < 8; k++) {
        var sd = L.ticks[k];
        var sdx = Math.cos(sd.phi);
        var sdy = Math.sin(sd.phi);
        var sR = 1 / Math.sqrt((sdx / (L.rx * 0.66)) * (sdx / (L.rx * 0.66)) +
                               (sdy / (L.ry * 0.86)) * (sdy / (L.ry * 0.86)));
        ctx.globalAlpha = 0.15 + tickLit[k] * 0.30;
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        ctx.moveTo(cx + sdx * unit * 0.74, cy + sdy * unit * 0.74);
        ctx.lineTo(cx + sdx * sR, cy + sdy * sR);
        ctx.stroke();
      }

      /* rotating dashed inner ring */
      ctx.globalAlpha = 0.34 + breath * 0.08;
      ctx.lineWidth = 0.7;
      ctx.setLineDash(DASH_FINE);
      ctx.lineDashOffset = -now * 3.2;
      ctx.beginPath();
      ctx.arc(cx, cy, unit * 0.74, 0, TAU);
      ctx.stroke();
      ctx.setLineDash(NONE_DASH);
      ctx.lineDashOffset = 0;

      /* inner solid ring */
      ctx.globalAlpha = 0.58 + breath * 0.10;
      ctx.lineWidth = 0.85;
      ctx.beginPath();
      ctx.arc(cx, cy, unit * 0.40, 0, TAU);
      ctx.stroke();
      ctx.globalAlpha = 0.34 + breath * 0.06;
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.arc(cx, cy, unit * 0.18, 0, TAU);
      ctx.stroke();

      /* inner iris ellipse */
      ctx.globalAlpha = 0.20 + breath * 0.03;
      ctx.lineWidth = 0.6;
      ctx.setLineDash(DASH_FINE);
      ctx.beginPath();
      ctx.ellipse(cx, cy, L.rx * 0.50, L.ry * 0.64, 0, 0, TAU);
      ctx.stroke();
      ctx.setLineDash(NONE_DASH);

      /* shared expert's slow elliptical orbit */
      ctx.strokeStyle = 'rgba(240,179,132,0.55)';
      ctx.globalAlpha = 0.17;
      ctx.lineWidth = 0.5;
      ctx.setLineDash(DASH_DOTS);
      ctx.beginPath();
      ctx.ellipse(cx, cy, L.rx * 0.60, L.ry * 0.74, 0, 0, TAU);
      ctx.stroke();
      ctx.setLineDash(NONE_DASH);

      /* aperture ellipse: solid rim + dashes */
      ctx.globalAlpha = 0.38 + breath * 0.05;
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.ellipse(cx, cy, L.rx, L.ry, 0, 0, TAU);
      ctx.stroke();
      ctx.globalAlpha = 0.74 + breath * 0.08;
      ctx.lineWidth = 1;
      ctx.setLineDash(DASH_RING);
      ctx.beginPath();
      ctx.ellipse(cx, cy, L.rx, L.ry, 0, 0, TAU);
      ctx.stroke();
      ctx.setLineDash(NONE_DASH);
      ctx.globalAlpha = 0.09 + breath * 0.025;
      ctx.lineWidth = 3.4;
      ctx.beginPath();
      ctx.ellipse(cx, cy, L.rx, L.ry, 0, 0, TAU);
      ctx.stroke();

      /* scan head travelling the aperture */
      var hd = -Math.PI / 2 + now * 0.075;
      ctx.globalAlpha = 0.44;
      ctx.strokeStyle = CYAN;
      ctx.lineWidth = 1.05;
      ctx.beginPath();
      ctx.ellipse(cx, cy, L.rx, L.ry, 0, hd, hd + 0.30);
      ctx.stroke();
      var hx2 = cx + Math.cos(hd + 0.21) * L.rx;
      var hy2 = cy + Math.sin(hd + 0.21) * L.ry * 1.02;
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.5;
      var hg = Math.max(8, unit * 0.75);
      ctx.drawImage(sprites.cyan, hx2 - hg / 2, hy2 - hg / 2, hg, hg);
      ctx.globalCompositeOperation = 'source-over';

      /* aperture ticks at 8 evenly spaced bearings */
      ctx.strokeStyle = 'rgba(134,247,232,1)';
      for (k = 0; k < 8; k++) {
        var tick = L.ticks[k];
        var ta = tick.phi;
        var ca = Math.cos(ta);
        var sa = Math.sin(ta);
        var lit2 = tickLit[k];
        var t0 = -3.2;
        var t1 = 4.4 + lit2 * unit * 0.11;
        if (lit2 > 0.035) {
          ctx.globalAlpha = lit2 * 0.52;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.ellipse(cx, cy, L.rx, L.ry, 0, tick.theta - 0.085, tick.theta + 0.085);
          ctx.stroke();
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = lit2 * 0.32;
          var tgs = Math.max(10, unit * 0.9);
          ctx.drawImage(sprites.cyan, tick.x - tgs / 2, tick.y - tgs / 2, tgs, tgs);
          ctx.globalCompositeOperation = 'source-over';
        }
        ctx.globalAlpha = 0.46 + lit2 * 0.54;
        ctx.lineWidth = 1.0 + lit2 * 0.85;
        ctx.beginPath();
        ctx.moveTo(tick.x + ca * t0, tick.y + sa * t0);
        ctx.lineTo(tick.x + ca * t1, tick.y + sa * t1);
        ctx.stroke();
        ctx.globalAlpha = 0.38 + lit2 * 0.58;
        ctx.beginPath();
        ctx.arc(tick.x + ca * t1, tick.y + sa * t1, 1.0 + lit2 * 1.1, 0, TAU);
        ctx.fillStyle = CYAN;
        ctx.fill();
        if (lit2 < 0.2) {
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = 0.10;
          var ngs = Math.max(6, unit * 0.34);
          ctx.drawImage(sprites.cyan, tick.x + ca * t1 - ngs / 2, tick.y + sa * t1 - ngs / 2, ngs, ngs);
          ctx.globalCompositeOperation = 'source-over';
        }
      }

      /* horizontal lens flare */
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.11;
      ctx.strokeStyle = 'rgba(134,247,232,1)';
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(cx - L.rx * 0.45, cy);
      ctx.lineTo(cx + L.rx * 0.45, cy);
      ctx.stroke();
      ctx.globalAlpha = 0.55;
      var fg = Math.max(14, unit * 1.1);
      ctx.drawImage(sprites.cyan, cx - fg / 2, cy - fg / 2, fg, fg);
      ctx.globalCompositeOperation = 'source-over';

      /* activation wave — the aperture exhales once per convening */
      for (gi = 0; gi < gens.length; gi++) {
        var wgen = gens[gi];
        var wAge = now - wgen.start;
        if (wAge < 0 || wAge > 1.6) continue;
        var wT = clamp(wAge / 1.5, 0, 1);
        var wEnv = Math.pow(1 - wT, 2);
        ctx.globalAlpha = wEnv * 0.11;
        ctx.strokeStyle = 'rgba(134,247,232,1)';
        ctx.lineWidth = 0.7;
        ctx.setLineDash(DASH_RING);
        ctx.beginPath();
        ctx.ellipse(cx, cy, L.rx * (1 + wT * 0.62), L.ry * (1 + wT * 1.05), 0, 0, TAU);
        ctx.stroke();
        ctx.setLineDash(NONE_DASH);
      }

      /* nucleus */
      ctx.globalAlpha = 0.95;
      ctx.fillStyle = '#f4ffff';
      ctx.beginPath();
      ctx.arc(cx, cy, Math.max(1.1, unit * 0.045), 0, TAU);
      ctx.fill();

      /* shared — a warm companion star on a slow inner orbit */
      var sharedA = -Math.PI / 2 + 0.9 + now * 0.055;
      var sx = cx + Math.cos(sharedA) * L.rx * 0.60;
      var sy = cy + Math.sin(sharedA) * L.ry * 0.74;
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.7;
      var ss = Math.max(12, unit * 0.62);
      ctx.drawImage(sprites.warm, sx - ss / 2, sy - ss / 2, ss, ss);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = WARM;
      ctx.beginPath();
      ctx.arc(sx, sy, Math.max(0.9, unit * 0.032), 0, TAU);
      ctx.fill();

      /* labels — soft dark shade keeps them legible across beams */
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      var qw = measureParts(layout.questionParts, font(L.questionFont), L.spacingQuestion);
      var aw = measureParts(layout.awakeParts, font(L.awakeFont), L.spacingAwake);
      if (L.showQuestion) {
        blitEllipse(ctx, sprites.dark, cx, L.questionY, qw / 2 + 38, L.questionFont * 2.15, 0.90);
      }
      blitEllipse(ctx, sprites.dark, cx, L.awakeY, aw / 2 + 38, L.awakeFont * 2.15, 0.92);
      if (unit >= 21) {
        ctx.strokeStyle = 'rgba(147,164,195,1)';
        ctx.globalAlpha = 0.28;
        ctx.lineWidth = 0.6;
        var qHalf = measureParts(layout.questionParts, font(L.questionFont), L.spacingQuestion) / 2;
        var aHalf = measureParts(layout.awakeParts, font(L.awakeFont), L.spacingAwake) / 2;
        if (L.showQuestion) {
          ctx.beginPath();
          ctx.moveTo(cx - qHalf - 34, L.questionY);
          ctx.lineTo(cx - qHalf - 8, L.questionY);
          ctx.moveTo(cx + qHalf + 8, L.questionY);
          ctx.lineTo(cx + qHalf + 34, L.questionY);
          ctx.stroke();
        }
        ctx.beginPath();
        ctx.moveTo(cx - aHalf - 34, L.awakeY);
        ctx.lineTo(cx - aHalf - 8, L.awakeY);
        ctx.moveTo(cx + aHalf + 8, L.awakeY);
        ctx.lineTo(cx + aHalf + 34, L.awakeY);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      if (L.showQuestion) {
        drawParts(layout.questionParts, cx, L.questionY, font(L.questionFont), L.spacingQuestion, 0.92, Math.max(1.6, L.questionFont * 0.24));
        ctx.globalAlpha = 0.22;
        ctx.strokeStyle = 'rgba(147,164,195,1)';
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        ctx.moveTo(cx, L.questionY + L.questionFont * 0.65);
        ctx.lineTo(cx, L.questionY + L.questionFont * 0.65 + unit * 0.14);
        ctx.stroke();
      }
      drawParts(layout.awakeParts, cx, L.awakeY, font(L.awakeFont), L.spacingAwake, 1, Math.max(1.8, L.awakeFont * 0.24));
    }

    function drawSelections(now) {
      if (pinned) drawReticle(pinned, false, now);
      if (hovered && hovered !== pinned) drawReticle(hovered, true, now);
    }

    function drawReticle(e, primary, now) {
      var L = layout;
      var unit = L.unit;
      var r = clamp(unit * 0.32, 6.5, 11);
      var br = r + Math.max(4, unit * 0.13);
      var len = Math.max(3, unit * 0.12);
      var x = e.x, y = e.y;
      var strength = primary ? 1 : 0.45;

      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = (primary ? 0.30 : 0.12);
      var gs = Math.max(14, unit * 1.2);
      ctx.drawImage(sprites.cyan, x - gs / 2, y - gs / 2, gs, gs);
      ctx.globalCompositeOperation = 'source-over';

      ctx.strokeStyle = 'rgba(134,247,232,1)';
      ctx.globalAlpha = 0.5 * strength;
      ctx.lineWidth = 0.75;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.stroke();

      ctx.globalAlpha = 0.65 * strength;
      ctx.lineWidth = 0.9;
      for (var k = 0; k < 4; k++) {
        var a = Math.PI / 4 + k * Math.PI / 2;
        var ca = Math.cos(a);
        var sa = Math.sin(a);
        ctx.beginPath();
        ctx.moveTo(x + ca * br, y + sa * br);
        ctx.lineTo(x + ca * (br + len), y + sa * (br + len));
        ctx.stroke();
      }

      ctx.globalAlpha = 0.22 * strength;
      ctx.lineWidth = 0.6;
      for (k = 0; k < 4; k++) {
        var a2 = k * Math.PI / 2;
        var ca2 = Math.cos(a2);
        var sa2 = Math.sin(a2);
        ctx.beginPath();
        ctx.moveTo(x + ca2 * (r + 2), y + sa2 * (r + 2));
        ctx.lineTo(x + ca2 * (r + 7), y + sa2 * (r + 7));
        ctx.stroke();
      }

      if (primary) {
        var age = now - hoveredAt;
        if (age >= 0 && age < 0.7) {
          ctx.globalAlpha = Math.pow(1 - age / 0.7, 2) * 0.35;
          ctx.strokeStyle = 'rgba(134,247,232,1)';
          ctx.lineWidth = 0.8;
          ctx.beginPath();
          ctx.arc(x, y, br + age * 24, 0, TAU);
          ctx.stroke();
        }
      }

      if (primary && hoverParts) {
        var below = y + br + 14 < H - 4;
        var ly = below ? y + br + 10 : y - br - 10;
        var lx = clamp(x, 16, W - 16);
        drawParts(hoverParts, lx, ly, font(L.hoverFont), L.hoverSpacing, 0.95, 1.8);
      } else if (!primary && pinnedParts) {
        var below2 = y + br + 14 < H - 4;
        var ly2 = below2 ? y + br + 9 : y - br - 9;
        var lx2 = clamp(x, 14, W - 14);
        drawParts(pinnedParts, lx2, ly2, font(L.hoverFont), L.hoverSpacing, 0.45, 1.8);
      }
      ctx.globalAlpha = 1;
    }

    var hoverParts = null;
    var pinnedParts = null;
    function buildHoverParts(e) {
      hoverParts = [{ text: pad3(e.id), color: 'rgba(134,247,232,0.95)' }];
    }
    function buildPinnedParts(e) {
      pinnedParts = [{ text: pad3(e.id), color: 'rgba(134,247,232,0.95)' }];
    }

    /* ------------------------------------------------------------------ state */
    function updatePerf(t0) {
      if (window.performance && performance.now) {
        var t1 = performance.now();
        frameMs = frameMs * 0.88 + Math.max(0, t1 - t0) * 0.12;
      }
    }

    function update() {
      if (reduced) return;
      var guard = 0;
      while (simT >= nextRouteAt && guard < 8) {
        guard++;
        convene(nextRouteAt, makeRouteRng());
        nextRouteAt += CYCLE;
      }
      while (gens.length && simT - gens[0].start > FADE_END + 0.2) {
        gens.shift();
      }
    }

    function frame(ts) {
      rafId = 0;
      if (destroyed || !running || reduced || !visible || document.hidden) return;
      if (!lastTs) lastTs = ts;
      var dt = (ts - lastTs) / 1000;
      if (!(dt > 0) || dt > 0.2) dt = 0.016;
      lastTs = ts;
      simT += dt;
      var t0 = window.performance && performance.now ? performance.now() : 0;
      try {
        update();
        draw(simT);
      } catch (err) {
        report(err);
      }
      updatePerf(t0);
      frameCount++;
      if ((frameCount & 31) === 0) {
        var dprNow = Math.min(window.devicePixelRatio || 1, 2);
        if (ready && Math.abs(dprNow - scaleX) > 0.01) queueResize();
      }
      rafId = requestAnimationFrame(frame);
    }

    function scheduleStaticDraw() {
      if (destroyed || staticRaf) return;
      staticRaf = requestAnimationFrame(function () {
        staticRaf = 0;
        draw(simT);
      });
    }

    function activeLoop() {
      return running && !reduced && visible && docVisible && !destroyed;
    }

    function syncLoop() {
      if (destroyed) return;
      var active = activeLoop();
      if (active) {
        if (!rafId) {
          lastTs = 0;
          rafId = requestAnimationFrame(frame);
        }
      } else {
        if (rafId) {
          cancelAnimationFrame(rafId);
          rafId = 0;
        }
        if (reduced) scheduleStaticDraw();
      }
    }

    /* ----------------------------------------------------------------- events */
    function report(err) {
      if (debug && window.console && console.error) console.error('[MoE]', err);
    }

    function infoFor(e) {
      if (!e) return null;
      var rect = canvas.getBoundingClientRect();
      var routed = !!(latestGen && latestGen.idSet[e.id]);
      return {
        id: e.id,
        code: e.code,
        specialty: e.specialty,
        load: e.load,
        x: Math.round(e.x * 10) / 10,
        y: Math.round(e.y * 10) / 10,
        clientX: rect.left + e.x,
        clientY: rect.top + e.y,
        routed: routed,
        routedAt: e.routedAt,
        routedCount: e.routes,
        pinned: pinned === e,
        state: routed ? 'ROUTED' : 'STANDBY'
      };
    }

    function emitHover(e) {
      if (!onHover) return;
      try { onHover(infoFor(e)); } catch (err) { report(err); }
    }

    function setHover(e) {
      if (hovered === e) return;
      hovered = e;
      hoveredAt = simT;
      if (e) buildHoverParts(e); else hoverParts = null;
      emitHover(e);
      scheduleStaticDraw();
    }

    function setPinned(e) {
      pinned = e;
      pinnedAt = simT;
      if (e) buildPinnedParts(e); else pinnedParts = null;
      if (hovered) emitHover(hovered);
      scheduleStaticDraw();
    }

    function emitSelect(e) {
      if (!onSelect) return;
      try { onSelect(infoFor(e)); } catch (err) { report(err); }
    }

    function hitTest(x, y, touch) {
      if (!layout) return null;
      var limit = touch
        ? clamp(layout.pitchY * 0.65, 12, 22)
        : clamp(layout.pitchY * 0.55, 9, 18);
      var best = null;
      var bestD = limit * limit;
      for (var k = 0; k < visibleExperts.length; k++) {
        var e = visibleExperts[k];
        var dx = e.x - x;
        var dy = e.y - y;
        var d = dx * dx + dy * dy;
        if (d < bestD) {
          bestD = d;
          best = e;
        }
      }
      return best;
    }

    function localPoint(ev) {
      var rect = canvas.getBoundingClientRect();
      return { x: ev.clientX - rect.left, y: ev.clientY - rect.top };
    }

    function onPointerMove(ev) {
      if (destroyed) return;
      if (ev.pointerType === 'touch') return;
      var p = localPoint(ev);
      var e = hitTest(p.x, p.y, false);
      setHover(e);
      if (!activeLoop()) scheduleStaticDraw();
    }

    function onPointerLeave(ev) {
      if (ev && ev.pointerType === 'touch') return;
      setHover(null);
    }

    var touchStart = null;

    function onPointerDown(ev) {
      if (destroyed) return;
      if (ev.pointerType === 'touch') {
        touchStart = {
          x: ev.clientX,
          y: ev.clientY,
          t: Date.now(),
          id: ev.pointerId
        };
        return;
      }
      if (ev.button != null && ev.button !== 0) return;
      var p = localPoint(ev);
      var e = hitTest(p.x, p.y, false);
      if (e) {
        if (pinned === e) {
          setPinned(null);
        } else {
          setPinned(e);
          setHover(e);
        }
        emitSelect(e);
      } else {
        if (pinned) setPinned(null);
        setHover(null);
      }
      scheduleStaticDraw();
    }

    function onPointerUp(ev) {
      if (destroyed || !touchStart) return;
      if (ev.pointerId != null && touchStart.id != null && ev.pointerId !== touchStart.id) return;
      var dx = ev.clientX - touchStart.x;
      var dy = ev.clientY - touchStart.y;
      var dt = Date.now() - touchStart.t;
      var wasTap = dt < 700 && dx * dx + dy * dy < 144;
      touchStart = null;
      if (!wasTap) return;
      var p = localPoint(ev);
      var e = hitTest(p.x, p.y, true);
      if (e) {
        if (pinned === e) {
          setPinned(null);
        } else {
          setPinned(e);
        }
        setHover(e);
        emitSelect(e);
      } else {
        if (pinned) setPinned(null);
        setHover(null);
      }
      scheduleStaticDraw();
    }

    function onPointerCancel() {
      touchStart = null;
    }

    function onVisibility() {
      docVisible = !document.hidden;
      syncLoop();
      if (docVisible) scheduleStaticDraw();
    }

    var resizeQueued = false;
    var resizeRaf = 0;
    function queueResize() {
      if (destroyed || resizeQueued) return;
      resizeQueued = true;
      resizeRaf = requestAnimationFrame(function () {
        resizeRaf = 0;
        resizeQueued = false;
        doResize();
      });
    }

    function doResize() {
      if (destroyed) return;
      var rect;
      try { rect = canvas.getBoundingClientRect(); } catch (err) { return; }
      var w = rect.width;
      var h = rect.height;
      if (w < 8 || h < 8) { ready = false; return; }
      var dprNow = Math.min(window.devicePixelRatio || 1, 2);
      var sx = Math.round(w * dprNow) / w;
      var sy = Math.round(h * dprNow) / h;
      if (ready && Math.abs(w - W) < 0.25 && Math.abs(h - H) < 0.25 &&
          Math.abs(sx - scaleX) < 0.001 && Math.abs(sy - scaleY) < 0.001) {
        return;
      }
      W = w;
      H = h;
      scaleX = sx;
      scaleY = sy;
      var cw = Math.max(1, Math.round(w * sx));
      var ch = Math.max(1, Math.round(h * sy));
      if (canvas.width !== cw) canvas.width = cw;
      if (canvas.height !== ch) canvas.height = ch;
      ctx.setTransform(sx, 0, 0, sy, 0, 0);
      charMaps = {};
      computeLayout();
      buildFieldLayer();
      updatePositionsForGens();
      ready = true;
      if (!activeLoop()) draw(simT);
    }

    var io = null;
    var ro = null;
    if (window.ResizeObserver) {
      ro = new ResizeObserver(function () { queueResize(); });
      ro.observe(canvas);
    }
    if (window.IntersectionObserver) {
      io = new IntersectionObserver(function (entries) {
        if (!entries || !entries.length) return;
        visible = !!entries[0].isIntersecting;
        syncLoop();
      }, { threshold: 0 });
      io.observe(canvas);
    }
    window.addEventListener('resize', queueResize, { passive: true });
    document.addEventListener('visibilitychange', onVisibility);
    canvas.addEventListener('pointermove', onPointerMove, { passive: true });
    canvas.addEventListener('pointerleave', onPointerLeave, { passive: true });
    canvas.addEventListener('pointerdown', onPointerDown, { passive: true });
    canvas.addEventListener('pointerup', onPointerUp, { passive: true });
    canvas.addEventListener('pointercancel', onPointerCancel, { passive: true });

    /* fonts: measure again once the mono face is actually available */
    var fontsDone = false;
    function onFonts() {
      if (destroyed || fontsDone) return;
      fontsDone = true;
      charMaps = {};
      scheduleStaticDraw();
    }
    if (document.fonts) {
      try { document.fonts.ready.then(onFonts); } catch (err) { /* noop */ }
      if (document.fonts.load) {
        try {
          document.fonts.load('400 10px "JetBrains Mono"').then(onFonts).catch(function () {});
        } catch (err2) { /* noop */ }
      }
    }

    /* ------------------------------------------------------------------- boot */
    running = opts.autoStart !== false;
    doResize();
    if (reduced) {
      if (ready) {
        routeCounter = 0;
        convene(0, mulberry32(typeof opts.seed === 'number' ? opts.seed : 20260104));
        nextRouteAt = Infinity;
        simT = 0;
        scheduleStaticDraw();
      }
    } else if (ready) {
      draw(0);
    }
    syncLoop();

    /* ------------------------------------------------------------------- API */
    function start() {
      if (destroyed) return instance;
      running = true;
      if (reduced) scheduleStaticDraw();
      else syncLoop();
      return instance;
    }
    function pause() {
      if (destroyed) return instance;
      running = false;
      syncLoop();
      return instance;
    }
    function resume() {
      if (destroyed) return instance;
      running = true;
      if (reduced) scheduleStaticDraw();
      else syncLoop();
      return instance;
    }
    function destroy() {
      if (destroyed) return;
      destroyed = true;
      running = false;
      if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
      if (staticRaf) { cancelAnimationFrame(staticRaf); staticRaf = 0; }
      if (resizeRaf) { cancelAnimationFrame(resizeRaf); resizeRaf = 0; }
      if (io) io.disconnect();
      if (ro) ro.disconnect();
      window.removeEventListener('resize', queueResize);
      document.removeEventListener('visibilitychange', onVisibility);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerleave', onPointerLeave);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerCancel);
      if (mq && mqHandler) {
        if (mq.removeEventListener) mq.removeEventListener('change', mqHandler);
        else if (mq.removeListener) mq.removeListener(mqHandler);
      }
      try { ctx.clearRect(0, 0, W, H); } catch (err) { /* noop */ }
      gens.length = 0;
      latestGen = null;
      experts.length = 0;
      visibleExperts.length = 0;
      byId = {};
      fieldLayer = null;
      fieldCtx = null;
      onHover = null;
      onSelect = null;
      onRoute = null;
    }
    function getState() {
      return {
        awake: activeIds.length,
        total: 256,
        shared: 1,
        route: routeCounter,
        routeLabel: '#' + pad4(routeCounter),
        activeIds: activeIds.slice(),
        pinnedId: pinned ? pinned.id : null,
        hoveredId: hovered ? hovered.id : null,
        reducedMotion: reduced,
        running: running,
        visible: visible && !document.hidden,
        simTime: Math.round(simT * 1000) / 1000,
        frameMs: Math.round(frameMs * 100) / 100
      };
    }
    function inspect(id) {
      if (id == null) {
        setHover(null);
        scheduleStaticDraw();
        return null;
      }
      var n = typeof id === 'number' ? id : parseInt(id, 10);
      var e = byId[n];
      if (!e || !e.visible) return null;
      setHover(e);
      scheduleStaticDraw();
      return infoFor(e);
    }
    function select(id) {
      if (id == null) {
        if (pinned) { setPinned(null); emitSelect(null); }
        scheduleStaticDraw();
        return null;
      }
      var n = typeof id === 'number' ? id : parseInt(id, 10);
      var e = byId[n];
      if (!e || !e.visible) return null;
      setPinned(e);
      emitSelect(e);
      scheduleStaticDraw();
      return infoFor(e);
    }
    function clear() {
      setHover(null);
      if (pinned) setPinned(null);
      scheduleStaticDraw();
    }
    function setReducedMotion(flag) {
      flag = !!flag;
      if (destroyed || flag === reduced) return;
      reduced = flag;
      if (reduced) {
        if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
        gens.length = 0;
        latestGen = null;
        activeIds = [];
        routeCounter = 0;
        simT = 0;
        if (ready) {
          convene(0, mulberry32(typeof opts.seed === 'number' ? opts.seed : 20260104));
          nextRouteAt = Infinity;
          scheduleStaticDraw();
        }
      } else {
        nextRouteAt = simT + 0.12;
        gens.length = 0;
        latestGen = null;
        activeIds = [];
        syncLoop();
      }
    }

    var instance = {
      start: start,
      pause: pause,
      resume: resume,
      destroy: destroy,
      resize: doResize,
      getState: getState,
      inspect: inspect,
      select: select,
      clear: clear,
      setReducedMotion: setReducedMotion
    };
    return instance;
  }

  function makeStub() {
    var stub = {
      start: function () { return stub; },
      pause: function () { return stub; },
      resume: function () { return stub; },
      destroy: function () {},
      resize: function () {},
      getState: function () {
        return {
          awake: 0, total: 256, shared: 1, route: 0, routeLabel: '#0000',
          activeIds: [], pinnedId: null, hoveredId: null,
          reducedMotion: true, running: false, visible: false, frameMs: 0
        };
      },
      inspect: function () { return null; },
      select: function () { return null; },
      clear: function () {},
      setReducedMotion: function () {}
    };
    return stub;
  }

  window.MoE = window.MoE || {};
  window.MoE.create = create;
})();
