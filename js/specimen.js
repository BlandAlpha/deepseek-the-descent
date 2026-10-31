/* ============================================================
   DEEPSEEK — THE DESCENT
   js/specimen.js — six generative "specimen" fields
   Canvas 2D · no dependencies · file:// safe
   ============================================================ */
(function () {
  'use strict';

  var TAU = Math.PI * 2;
  var CYAN = [134, 247, 232];
  var BLUE = [77, 107, 254];
  var ICE = [190, 211, 245];

  function rgba(c, a) { return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
  function hash(n) { var x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }

  /* ---------- shared decorative layers ---------- */

  var dustCache = null;
  function makeDust(seed, n) {
    var r = mulberry32(seed), out = [];
    for (var i = 0; i < n; i++) {
      out.push({
        x: r(), y: r(), z: .25 + r() * .75,
        size: .4 + r() * 1.5,
        phase: r() * TAU,
        drift: .5 + r() * 1.5
      });
    }
    return out;
  }

  function drawDust(ctx, w, h, t, dust, alpha) {
    for (var i = 0; i < dust.length; i++) {
      var p = dust[i];
      var y = (p.y - t * .004 * p.drift) % 1; if (y < 0) y += 1;
      var x = p.x + Math.sin(t * .08 * p.drift + p.phase) * .008;
      var tw = .35 + .65 * (.5 + .5 * Math.sin(t * .7 * p.drift + p.phase));
      ctx.beginPath();
      ctx.arc(x * w, y * h, p.size * p.z, 0, TAU);
      ctx.fillStyle = rgba(ICE, alpha * p.z * tw);
      ctx.fill();
    }
  }

  function drawRulers(ctx, w, h) {
    var pad = 14;
    ctx.save();
    ctx.lineWidth = .5;
    ctx.strokeStyle = 'rgba(166,195,255,.15)';
    ctx.beginPath();
    var x, y;
    for (x = pad; x < w - pad; x += 11) {
      var major = Math.round((x - pad) / 11) % 5 === 0;
      ctx.moveTo(x, h - pad);
      ctx.lineTo(x, h - pad - (major ? 5 : 2.5));
    }
    for (y = pad; y < h - pad; y += 11) {
      var majY = Math.round((y - pad) / 11) % 5 === 0;
      ctx.moveTo(pad, y);
      ctx.lineTo(pad + (majY ? 5 : 2.5), y);
    }
    ctx.stroke();
    ctx.strokeStyle = 'rgba(166,195,255,.08)';
    ctx.strokeRect(pad + .5, pad + .5, w - pad * 2, h - pad * 2);
    ctx.restore();
  }

  function drawOrbits(ctx, w, h, t, R) {
    var cx = w / 2, cy = h / 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(t * .015);
    for (var k = 0; k < 4; k++) {
      var r = R * (.44 + k * .055);
      ctx.beginPath();
      ctx.setLineDash([1, 6 + k * 2]);
      ctx.lineDashOffset = -t * (7 + k * 3);
      ctx.strokeStyle = 'rgba(166,195,255,' + (.09 - k * .013) + ')';
      ctx.lineWidth = .7;
      ctx.arc(0, 0, r, 0, TAU);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    for (var i = 0; i < 72; i++) {
      var a = i / 72 * TAU;
      var inner = R * .505, outer = R * (i % 6 === 0 ? .52 : .515);
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * inner, Math.sin(a) * inner);
      ctx.lineTo(Math.cos(a) * outer, Math.sin(a) * outer);
      ctx.strokeStyle = 'rgba(134,247,232,' + (i % 6 === 0 ? .3 : .11) + ')';
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawBase(ctx, w, h, t, dust, px, py) {
    var cx = w / 2 + (px - .5) * 10;
    var cy = h / 2 + (py - .5) * 8;
    var R = Math.min(w, h) * .5;

    var g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * .92);
    g.addColorStop(0, 'rgba(38,64,116,.22)');
    g.addColorStop(.45, 'rgba(15,34,68,.13)');
    g.addColorStop(1, 'rgba(2,5,11,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    var g2 = ctx.createRadialGradient(cx, cy + R * .04, 0, cx, cy + R * .04, R * .3);
    g2.addColorStop(0, 'rgba(134,247,232,.055)');
    g2.addColorStop(1, 'rgba(134,247,232,0)');
    ctx.fillStyle = g2;
    ctx.fillRect(0, 0, w, h);

    drawDust(ctx, w, h, t, dust, .32);

    ctx.save();
    ctx.strokeStyle = 'rgba(166,195,255,.055)';
    ctx.lineWidth = .5;
    ctx.beginPath();
    ctx.moveTo(cx - 9, cy); ctx.lineTo(cx + 9, cy);
    ctx.moveTo(cx, cy - 9); ctx.lineTo(cx, cy + 9);
    ctx.stroke();
    ctx.restore();
  }

  /* ---------- 0 · REASONING / neural coil ---------- */
  function modeCoil(ctx, w, h, t, px, py) {
    var cx = w / 2 + (px - .5) * 12, cy = h / 2 + (py - .5) * 10;
    var R = Math.min(w, h) * .5;
    drawOrbits(ctx, w, h, t, R);

    var pts = [[], []], i, k, s;
    var N = 110;
    for (k = 0; k < 2; k++) {
      for (i = 0; i <= N; i++) {
        s = i / N;
        var ang = s * Math.PI * 4.6 + t * .24 + k * Math.PI;
        var rad = R * (.075 + .30 * Math.sin(s * Math.PI * .92 + .25));
        var x = cx + Math.cos(ang) * rad * 1.02 + Math.sin(s * 5.2 + t * .15) * R * .018;
        var y = cy - R * .36 + s * R * .72 + Math.sin(ang) * rad * .34;
        pts[k].push([x, y]);
      }
    }
    // rungs
    ctx.save();
    ctx.lineWidth = .55;
    for (i = 0; i <= N; i += 5) {
      var a = pts[0][i], b = pts[1][i];
      if (!a || !b) continue;
      var alpha = .05 + .14 * Math.sin(i / N * Math.PI);
      ctx.strokeStyle = rgba(BLUE, alpha);
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    }
    // strands
    for (k = 0; k < 2; k++) {
      ctx.beginPath();
      for (i = 0; i <= N; i++) {
        var p = pts[k][i];
        if (i === 0) ctx.moveTo(p[0], p[1]); else ctx.lineTo(p[0], p[1]);
      }
      var grad = ctx.createLinearGradient(0, cy - R * .4, 0, cy + R * .4);
      grad.addColorStop(0, rgba(CYAN, .78));
      grad.addColorStop(.5, rgba(ICE, .5));
      grad.addColorStop(1, rgba(BLUE, .38));
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1.15;
      ctx.shadowColor = rgba(CYAN, .45);
      ctx.shadowBlur = 9;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
    // nodes + traveling pulses
    for (k = 0; k < 2; k++) {
      for (i = 8; i < N; i += 14) {
        var q = pts[k][i];
        ctx.beginPath(); ctx.arc(q[0], q[1], 1.8, 0, TAU);
        ctx.fillStyle = rgba(CYAN, .65); ctx.fill();
        ctx.beginPath(); ctx.arc(q[0], q[1], 5.5, 0, TAU);
        ctx.strokeStyle = rgba(CYAN, .12); ctx.stroke();
      }
      var ph = (t * .09 + k * .34) % 1;
      var idx = Math.floor(ph * N);
      var pp = pts[k][idx];
      if (pp) {
        var gg = ctx.createRadialGradient(pp[0], pp[1], 0, pp[0], pp[1], 15);
        gg.addColorStop(0, rgba(CYAN, .9)); gg.addColorStop(1, rgba(CYAN, 0));
        ctx.fillStyle = gg;
        ctx.beginPath(); ctx.arc(pp[0], pp[1], 15, 0, TAU); ctx.fill();
        ctx.fillStyle = '#eafffb';
        ctx.beginPath(); ctx.arc(pp[0], pp[1], 2.1, 0, TAU); ctx.fill();
      }
    }
    // argument glyphs — tiny descending ticks
    ctx.save();
    ctx.strokeStyle = 'rgba(166,195,255,.16)';
    ctx.lineWidth = .6;
    for (i = 0; i < 3; i++) {
      var yy = cy - R * .18 + i * 13 + Math.sin(t * .3 + i) * 2;
      ctx.beginPath(); ctx.moveTo(cx + R * .36, yy); ctx.lineTo(cx + R * (.46 + i * .018), yy); ctx.stroke();
    }
    ctx.restore();
  }

  /* ---------- 1 · CODE / lattice growth ---------- */
  var circuitCache = null;
  function buildCircuit(seed) {
    var r = mulberry32(seed);
    var segs = [], nodes = [], buses = [];
    function grow(x, y, dir, len, level) {
      var dx = dir === 0 ? 1 : dir === 2 ? -1 : 0;
      var dy = dir === 1 ? 1 : dir === 3 ? -1 : 0;
      var x2 = clamp(x + dx * len, .06, .94);
      var y2 = clamp(y + dy * len, .06, .94);
      segs.push({ x1: x, y1: y, x2: x2, y2: y2, level: level });
      nodes.push({ x: x2, y: y2, level: level });
      if (level <= 0) return;
      var turn = r() < .5 ? 1 : -1;
      if (r() < .78) grow(x2, y2, (dir + turn + 4) % 4, len * (.58 + r() * .22), level - 1);
      if (r() < .48) grow(x2, y2, dir, len * (.46 + r() * .22), level - 1);
      if (r() < .22) grow(x2, y2, (dir - turn + 4) % 4, len * .55, level - 1);
    }
    grow(.5, .5, 0, .09, 5); grow(.5, .5, 1, .09, 5);
    grow(.5, .5, 2, .09, 5); grow(.5, .5, 3, .09, 5);
    for (var i = 0; i < 7; i++) {
      var yy = .13 + i * .125 + (r() - .5) * .02;
      buses.push({ x1: .06 + r() * .16, y1: yy, x2: .78 + r() * .16, y2: yy, h: true, off: r() });
    }
    for (var j = 0; j < 5; j++) {
      var xx = .13 + j * .185 + (r() - .5) * .02;
      buses.push({ x1: xx, y1: .06 + r() * .14, x2: xx, y2: .8 + r() * .14, h: false, off: r() });
    }
    var pulses = [];
    segs.forEach(function (s, si) {
      if (si % 2 === 0) pulses.push({ id: si, off: r(), speed: .08 + r() * .25, dir: r() < .5 ? 1 : -1 });
    });
    buses.forEach(function (b, bi) {
      if (bi % 2 === 0) pulses.push({ bus: bi, off: r(), speed: .06 + r() * .17, dir: r() < .5 ? 1 : -1 });
    });
    return { segs: segs, nodes: nodes, buses: buses, pulses: pulses };
  }

  function modeCode(ctx, w, h, t, px, py) {
    if (!circuitCache) circuitCache = buildCircuit(71);
    var cx = w / 2, cy = h / 2, R = Math.min(w, h) * .5;
    var par = 5;
    var spread = 1.86;
    var mapX = function (v) { return (.5 + (v - .5) * spread) * w; };
    var mapY = function (v) { return (.5 + (v - .5) * spread) * h; };
    ctx.save();
    ctx.translate((px - .5) * -par, (py - .5) * -par);

    // instrumentation grid
    ctx.fillStyle = 'rgba(166,195,255,.11)';
    for (var gx = .10; gx < .93; gx += .083) {
      for (var gy = .10; gy < .93; gy += .083) {
        ctx.fillRect(gx * w - .55, gy * h - .55, 1.1, 1.1);
      }
    }

    // measuring frame
    ctx.strokeStyle = 'rgba(166,195,255,.09)';
    ctx.lineWidth = .6;
    ctx.strokeRect(cx - R * .72, cy - R * .72, R * 1.44, R * 1.44);
    ctx.strokeStyle = 'rgba(166,195,255,.045)';
    ctx.strokeRect(cx - R * .57, cy - R * .57, R * 1.14, R * 1.14);
    // corner brackets
    ctx.strokeStyle = 'rgba(134,247,232,.34)';
    [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(function (q) {
      var x = cx + q[0] * R * .72, y = cy + q[1] * R * .72;
      ctx.beginPath();
      ctx.moveTo(x - q[0] * 10, y); ctx.lineTo(x, y); ctx.lineTo(x, y - q[1] * 10);
      ctx.stroke();
    });

    // data buses
    circuitCache.buses.forEach(function (b) {
      var x1 = b.x1 * w, y1 = b.y1 * h, x2 = b.x2 * w, y2 = b.y2 * h;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
      ctx.strokeStyle = 'rgba(126,153,255,.4)';
      ctx.lineWidth = .8;
      ctx.stroke();
      var dist = Math.hypot(x2 - x1, y2 - y1);
      var n = Math.floor(dist / (R * .10));
      for (var i = 1; i < n; i++) {
        var q = i / n;
        var xx = x1 + (x2 - x1) * q, yy = y1 + (y2 - y1) * q;
        ctx.beginPath();
        if (b.h) { ctx.moveTo(xx, yy - 2.5); ctx.lineTo(xx, yy + 2.5); }
        else { ctx.moveTo(xx - 2.5, yy); ctx.lineTo(xx + 2.5, yy); }
        ctx.strokeStyle = 'rgba(166,195,255,.18)';
        ctx.stroke();
      }
    });

    // circuit tree
    circuitCache.segs.forEach(function (s) {
      var x1 = mapX(s.x1), y1 = mapY(s.y1), x2 = mapX(s.x2), y2 = mapY(s.y2);
      var leaf = s.level <= 1;
      ctx.beginPath();
      ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
      ctx.strokeStyle = leaf ? 'rgba(134,247,232,.82)' : 'rgba(166,195,255,' + (0.40 + (4 - s.level) * .05) + ')';
      ctx.lineWidth = leaf ? 1.35 : 1;
      ctx.shadowColor = leaf ? 'rgba(134,247,232,.4)' : 'rgba(77,107,254,.24)';
      ctx.shadowBlur = leaf ? 7 : 4;
      ctx.stroke();
      ctx.shadowBlur = 0;
    });

    // junction nodes and component pads
    circuitCache.nodes.forEach(function (n, i) {
      var x = mapX(n.x), y = mapY(n.y);
      if (n.level <= 1) {
        ctx.strokeStyle = 'rgba(134,247,232,.7)';
        ctx.strokeRect(x - 2.4, y - 2.4, 4.8, 4.8);
        ctx.fillStyle = 'rgba(234,240,250,.8)';
        ctx.fillRect(x - .9, y - .9, 1.8, 1.8);
        if (i % 4 === 0) {
          var pw = 13, ph = 7;
          ctx.strokeStyle = 'rgba(166,195,255,.4)';
          ctx.lineWidth = .7;
          ctx.strokeRect(x - pw / 2, y - ph / 2, pw, ph);
          ctx.beginPath();
          ctx.moveTo(x - pw / 2 - 3, y); ctx.lineTo(x - pw / 2, y);
          ctx.moveTo(x + pw / 2, y); ctx.lineTo(x + pw / 2 + 3, y);
          ctx.strokeStyle = 'rgba(166,195,255,.3)';
          ctx.stroke();
        }
      } else if (i % 2 === 0) {
        ctx.fillStyle = 'rgba(166,195,255,.42)';
        ctx.fillRect(x - .8, y - .8, 1.6, 1.6);
      }
    });

    // packets
    circuitCache.pulses.forEach(function (p, i) {
      var x, y, len;
      if (typeof p.id === 'number') {
        var s = circuitCache.segs[p.id]; if (!s) return;
        var f = (t * p.speed + p.off) % 1; var pp = p.dir > 0 ? f : 1 - f;
        x = mapX(s.x1 + (s.x2 - s.x1) * pp);
        y = mapY(s.y1 + (s.y2 - s.y1) * pp);
      } else {
        var b = circuitCache.buses[p.bus]; if (!b) return;
        var f2 = (t * p.speed + p.off) % 1; var pp2 = p.dir > 0 ? f2 : 1 - f2;
        x = (b.x1 + (b.x2 - b.x1) * pp2) * w;
        y = (b.y1 + (b.y2 - b.y1) * pp2) * h;
      }
      var col = i % 4 === 0 ? CYAN : ICE;
      var gg = ctx.createRadialGradient(x, y, 0, x, y, 7);
      gg.addColorStop(0, rgba(col, .3)); gg.addColorStop(1, rgba(col, 0));
      ctx.fillStyle = gg;
      ctx.beginPath(); ctx.arc(x, y, 7, 0, TAU); ctx.fill();
      ctx.fillStyle = rgba(col, .95);
      ctx.fillRect(x - 1.3, y - 1.3, 2.6, 2.6);
    });

    // processor
    ctx.translate(cx, cy);
    var bs = R * .105 + Math.sin(t * 1.05) * R * .004;
    ctx.strokeStyle = 'rgba(134,247,232,.62)';
    ctx.lineWidth = .9;
    ctx.strokeRect(-bs, -bs, bs * 2, bs * 2);
    ctx.strokeStyle = 'rgba(134,247,232,.22)';
    ctx.setLineDash([2, 5]);
    ctx.lineDashOffset = -t * 10;
    ctx.strokeRect(-bs * 1.38, -bs * 1.38, bs * 2.76, bs * 2.76);
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(234,240,250,.85)';
    ctx.fillRect(-1.8, -1.8, 3.6, 3.6);
    for (var p2 = 0; p2 < 4; p2++) {
      ctx.rotate(Math.PI / 2);
      for (var k2 = -1; k2 <= 1; k2++) {
        ctx.beginPath();
        ctx.moveTo(k2 * bs * .5, -bs * 1.38);
        ctx.lineTo(k2 * bs * .5, -bs * 1.9);
        ctx.strokeStyle = 'rgba(166,195,255,.32)';
        ctx.stroke();
      }
    }
    ctx.restore();

    // slow scanner line (no slab)
    var sweep = (t * .028) % 1;
    var sx = (.12 + sweep * .76) * w;
    ctx.strokeStyle = 'rgba(134,247,232,.2)';
    ctx.shadowColor = 'rgba(134,247,232,.4)'; ctx.shadowBlur = 6;
    ctx.beginPath(); ctx.moveTo(sx, h * .16); ctx.lineTo(sx, h * .84); ctx.stroke();
    ctx.shadowBlur = 0;
  }

  /* ---------- 2 · MATHEMATICS / interference ---------- */
  function modeMath(ctx, w, h, t, px, py) {
    var cx = w / 2 + (px - .5) * 8, cy = h / 2 + (py - .5) * 6;
    var R = Math.min(w, h) * .5;
    var ax = cx - R * .34, bx = cx + R * .34;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    var sources = [[ax, cy, CYAN], [bx, cy, BLUE]];
    sources.forEach(function (s, si) {
      for (var i = 1; i <= 40; i++) {
        var rr = i * R * .0125 + Math.sin(t * .18 + i * .3) * .8;
        ctx.beginPath();
        ctx.arc(s[0], s[1], rr, 0, TAU);
        ctx.strokeStyle = rgba(s[2], .036 + (i % 5 === 0 ? .022 : 0));
        ctx.lineWidth = i % 5 === 0 ? .75 : .45;
        ctx.stroke();
      }
    });
    ctx.restore();

    // Lissajous proofs
    function curve(fx, fy, phase, color, alpha, width) {
      ctx.beginPath();
      for (var i = 0; i <= 320; i++) {
        var th = i / 320 * TAU;
        var x = cx + R * .52 * Math.sin(fx * th + t * .11 + phase);
        var y = cy + R * .52 * Math.sin(fy * th + t * .07);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = rgba(color, alpha);
      ctx.lineWidth = width;
      ctx.shadowColor = rgba(color, .4);
      ctx.shadowBlur = 7;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
    curve(3, 2, 0, CYAN, .5, .85);
    curve(4, 5, Math.PI / 2, BLUE, .28, .6);

    // axes
    ctx.save();
    ctx.strokeStyle = 'rgba(166,195,255,.13)';
    ctx.lineWidth = .5;
    ctx.beginPath();
    ctx.moveTo(cx - R * .6, cy); ctx.lineTo(cx + R * .6, cy);
    ctx.moveTo(cx, cy - R * .6); ctx.lineTo(cx, cy + R * .6);
    ctx.stroke();
    // tick marks on axes
    for (var k = -4; k <= 4; k++) {
      if (!k) continue;
      var off = k * R * .13;
      ctx.beginPath(); ctx.moveTo(cx + off, cy - 3); ctx.lineTo(cx + off, cy + 3); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx - 3, cy + off); ctx.lineTo(cx + 3, cy + off); ctx.stroke();
    }
    ctx.restore();

    // moving solution points
    for (var j = 0; j < 3; j++) {
      var a = t * .2 + j * TAU / 3;
      var qx = cx + R * .52 * Math.sin(3 * a);
      var qy = cy + R * .52 * Math.sin(2 * a);
      var gg = ctx.createRadialGradient(qx, qy, 0, qx, qy, 10);
      gg.addColorStop(0, rgba(CYAN, .6)); gg.addColorStop(1, rgba(CYAN, 0));
      ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(qx, qy, 10, 0, TAU); ctx.fill();
    }
    // tiny circle annotation
    ctx.strokeStyle = 'rgba(134,247,232,.3)';
    ctx.beginPath(); ctx.arc(ax, cy, R * .053, 0, TAU); ctx.stroke();
  }

  /* ---------- 3 · LANGUAGE / tidal script ---------- */
  function modeLanguage(ctx, w, h, t, px, py) {
    var R = Math.min(w, h) * .5;
    var cx = w / 2, cy = h / 2;
    var parX = (px - .5) * 9, parY = (py - .5) * 7;
    var i, x;

    // ghost glyphs — language below language
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '300 ' + Math.round(R * 1.02) + 'px "Noto Serif SC","Songti SC",serif';
    ctx.fillStyle = 'rgba(166,195,255,.045)';
    ctx.fillText('深', w * .33, h * .52);
    ctx.fillText('声', w * .69, h * .4);
    ctx.font = '300 ' + Math.round(R * .6) + 'px "Noto Serif SC","Songti SC",serif';
    ctx.fillStyle = 'rgba(134,247,232,.035)';
    ctx.fillText('光', w * .58, h * .76);
    ctx.restore();

    // tidal field
    ctx.save();
    ctx.translate(parX * .5, parY * .5);
    for (i = 0; i < 36; i++) {
      var yy = h * .14 + (i / 35) * h * .72;
      var amp = R * (.014 + .043 * Math.abs(Math.sin(i * .67 + 1.1)));
      var freq = 1.2 + (i % 7) * .27;
      var phase = t * .13 + i * .38;
      var bright = i === 17 || i === 18 || i === 19;
      ctx.beginPath();
      for (x = -10; x <= w + 10; x += 4) {
        var nx = x / w;
        var envelope = Math.sin(clamp(nx, 0, 1) * Math.PI) * .9 + .1;
        var y = yy + Math.sin(nx * TAU * freq + phase) * amp * envelope + Math.sin(nx * 7.5 + phase * .5) * amp * .3;
        if (x === -10) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = bright ? rgba(CYAN, .62) : (i % 5 === 0 ? rgba(BLUE, .28) : 'rgba(166,195,255,.15)');
      ctx.lineWidth = bright ? 1.05 : .55;
      if (bright) { ctx.shadowColor = rgba(CYAN, .5); ctx.shadowBlur = 9; }
      ctx.stroke();
      ctx.shadowBlur = 0;

      if (i % 2 === 0) {
        for (var m = 0; m < 3; m++) {
          var mx = ((t * (.012 + m * .005) + i * .127 + m * .31) % 1) * w;
          var my = yy + Math.sin(mx / w * TAU * freq + phase) * amp * .82;
          ctx.fillStyle = rgba(ICE, .26);
          ctx.fillRect(mx, my - .5, 2.8 + (m % 2), 1);
        }
      }
    }
    ctx.restore();

    // central current braid
    ctx.save();
    ctx.translate(0, 0);
    var braid = [
      { dy: -.018, a: .6, w: 1.3, c: CYAN },
      { dy: .012, a: .38, w: 1, c: ICE },
      { dy: .04, a: .2, w: .7, c: BLUE }
    ];
    braid.forEach(function (b) {
      ctx.beginPath();
      for (x = 0; x <= w; x += 4) {
        var nx = x / w;
        var env = Math.sin(nx * Math.PI);
        var y = cy + b.dy * h + Math.sin(nx * TAU * 1.7 + t * .22) * R * .05 * env + Math.sin(nx * 13 - t * .1) * R * .006;
        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = rgba(b.c, b.a);
      ctx.lineWidth = b.w;
      ctx.shadowColor = rgba(b.c, .45); ctx.shadowBlur = 10;
      ctx.stroke();
      ctx.shadowBlur = 0;
    });
    // luminous word-nodes riding the braid
    for (var d = 0; d < 7; d++) {
      var fx = (t * .018 + d / 7) % 1;
      var xx2 = fx * w;
      var yy2 = cy + Math.sin(fx * TAU * 1.7 + t * .22) * R * .05 * Math.sin(fx * Math.PI);
      var gg = ctx.createRadialGradient(xx2, yy2, 0, xx2, yy2, 13);
      gg.addColorStop(0, rgba(CYAN, .4)); gg.addColorStop(1, rgba(CYAN, 0));
      ctx.fillStyle = gg;
      ctx.beginPath(); ctx.arc(xx2, yy2, 13, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(234,250,247,.85)';
      ctx.fillRect(xx2 - 1.4, yy2 - 1.4, 2.8, 2.8);
    }
    ctx.restore();

    // script arcs
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-t * .008);
    for (var k = 0; k < 4; k++) {
      ctx.beginPath();
      ctx.setLineDash([2, 9]);
      ctx.lineDashOffset = t * 3.5;
      ctx.arc(0, 0, R * (.2 + k * .075), -0.8 + k * .2, 1.3 + k * .1);
      ctx.strokeStyle = 'rgba(134,247,232,' + (.16 - k * .032) + ')';
      ctx.lineWidth = .7;
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.restore();

    // drifting particles
    for (var p = 0; p < 20; p++) {
      var ppx = ((p * .127 + t * .005 * (1 + p % 3)) % 1) * w;
      var ppy = ((p * .219 + Math.sin(t * .05 + p) * .03) % 1) * h;
      ctx.beginPath(); ctx.arc(ppx, ppy, .7 + (p % 3) * .3, 0, TAU);
      ctx.fillStyle = 'rgba(166,195,255,.25)'; ctx.fill();
    }

    // reading lamp
    var g = ctx.createRadialGradient(cx - R * .12 + parX, cy - R * .05, 0, cx - R * .12 + parX, cy - R * .05, R * .46);
    g.addColorStop(0, 'rgba(77,107,254,.12)');
    g.addColorStop(1, 'rgba(77,107,254,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  }

  /* ---------- 4 · VISION / iris ---------- */
  function modeVision(ctx, w, h, t, px, py) {
    var cx = w / 2 + (px - .5) * 10, cy = h / 2 + (py - .5) * 8;
    var R = Math.min(w, h) * .5;
    var pr = R * .105;

    // outer halo
    var halo = ctx.createRadialGradient(cx, cy, pr, cx, cy, R * .62);
    halo.addColorStop(0, 'rgba(77,107,254,.16)');
    halo.addColorStop(.5, 'rgba(77,107,254,.05)');
    halo.addColorStop(1, 'rgba(77,107,254,0)');
    ctx.fillStyle = halo;
    ctx.beginPath(); ctx.arc(cx, cy, R * .62, 0, TAU); ctx.fill();

    // iris fibers
    ctx.save();
    ctx.translate(cx, cy);
    for (var i = 0; i < 170; i++) {
      var a = i / 170 * TAU + Math.sin(i * 7.1) * .006;
      var len = R * (.19 + .07 * hash(i) + .018 * Math.sin(t * .5 + i * .7));
      var r1 = pr * 1.22;
      var r2 = r1 + len;
      var ca = .06 + .32 * (0.5 + .5 * Math.sin(i * .35 + t * .32));
      var col = i % 7 === 0 ? CYAN : ICE;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * r1, Math.sin(a) * r1);
      ctx.lineTo(Math.cos(a + Math.sin(t * .18 + i) * .012) * r2, Math.sin(a) * r2);
      ctx.strokeStyle = rgba(col, ca);
      ctx.lineWidth = i % 7 === 0 ? .9 : .55;
      ctx.stroke();
    }
    // structural rings
    [.33, .39, .47].forEach(function (f, k) {
      ctx.beginPath();
      ctx.arc(0, 0, R * f, 0, TAU);
      ctx.strokeStyle = 'rgba(166,195,255,' + (.16 - k * .035) + ')';
      ctx.lineWidth = .6;
      ctx.setLineDash(k === 1 ? [1, 7] : []);
      ctx.stroke();
    });
    ctx.setLineDash([]);

    // scanner
    var scan = t * .22;
    ctx.beginPath();
    ctx.arc(0, 0, R * .34, scan, scan + .75);
    ctx.strokeStyle = 'rgba(134,247,232,.55)';
    ctx.lineWidth = 1.1;
    ctx.shadowColor = rgba(CYAN, .5); ctx.shadowBlur = 12;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // pupil
    var pupil = ctx.createRadialGradient(-pr * .25, -pr * .25, 0, 0, 0, pr);
    pupil.addColorStop(0, '#0a1a2e');
    pupil.addColorStop(.6, '#030a12');
    pupil.addColorStop(1, '#010306');
    ctx.beginPath(); ctx.arc(0, 0, pr, 0, TAU); ctx.fillStyle = pupil; ctx.fill();
    ctx.beginPath(); ctx.arc(0, 0, pr, 0, TAU);
    ctx.strokeStyle = 'rgba(134,247,232,.5)'; ctx.lineWidth = .9; ctx.stroke();

    // rim light
    ctx.beginPath(); ctx.arc(0, 0, pr * 1.15, -2.4, -1.2);
    ctx.strokeStyle = 'rgba(134,247,232,.35)'; ctx.lineWidth = .8; ctx.stroke();

    // specular
    ctx.beginPath();
    ctx.arc(-pr * .34, -pr * .38, pr * .13, 0, TAU);
    ctx.fillStyle = 'rgba(220,240,255,.6)'; ctx.fill();

    // focus reticle
    for (var k = 0; k < 4; k++) {
      ctx.rotate(Math.PI / 2);
      ctx.beginPath();
      ctx.moveTo(R * .58, 0); ctx.lineTo(R * .61, 0);
      ctx.strokeStyle = 'rgba(166,195,255,.3)'; ctx.stroke();
    }
    ctx.restore();
  }

  /* ---------- 5 · AGENTS / swarm ---------- */
  function modeAgents(ctx, w, h, t, px, py) {
    var cx = w / 2 + (px - .5) * 12, cy = h / 2 + (py - .5) * 10;
    var R = Math.min(w, h) * .5;
    var goalX = cx + Math.sin(t * .17) * R * .13;
    var goalY = cy + Math.cos(t * .13) * R * .1;

    // field haze
    var haze = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * .62);
    haze.addColorStop(0, 'rgba(77,107,254,.1)');
    haze.addColorStop(.6, 'rgba(77,107,254,.03)');
    haze.addColorStop(1, 'rgba(77,107,254,0)');
    ctx.fillStyle = haze; ctx.fillRect(0, 0, w, h);

    // orbit instrument
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-t * .014);
    for (var ring = 0; ring < 3; ring++) {
      ctx.beginPath();
      ctx.setLineDash([1, 9]);
      ctx.arc(0, 0, R * (.2 + ring * .11), 0, TAU);
      ctx.strokeStyle = 'rgba(166,195,255,' + (.13 - ring * .03) + ')';
      ctx.lineWidth = .55;
      ctx.stroke();
    }
    ctx.setLineDash([]);
    for (var q = 0; q < 24; q++) {
      var aa = q / 24 * TAU;
      var rr = R * .5;
      ctx.beginPath();
      ctx.moveTo(Math.cos(aa) * rr, Math.sin(aa) * rr);
      ctx.lineTo(Math.cos(aa) * (rr + (q % 4 === 0 ? 9 : 4)), Math.sin(aa) * (rr + (q % 4 === 0 ? 9 : 4)));
      ctx.strokeStyle = 'rgba(166,195,255,' + (q % 4 === 0 ? .3 : .12) + ')';
      ctx.stroke();
    }
    ctx.restore();

    // goal
    var goalGlow = ctx.createRadialGradient(goalX, goalY, 0, goalX, goalY, R * .2);
    goalGlow.addColorStop(0, 'rgba(134,247,232,.24)');
    goalGlow.addColorStop(.55, 'rgba(134,247,232,.05)');
    goalGlow.addColorStop(1, 'rgba(134,247,232,0)');
    ctx.fillStyle = goalGlow;
    ctx.beginPath(); ctx.arc(goalX, goalY, R * .2, 0, TAU); ctx.fill();
    [0, 1, 2, 3].forEach(function (k) {
      var rr = (t * .06 + k / 4) % 1;
      ctx.beginPath();
      ctx.arc(goalX, goalY, R * (.018 + rr * .19), 0, TAU);
      ctx.strokeStyle = 'rgba(134,247,232,' + (1 - rr) * .26 + ')';
      ctx.lineWidth = .6; ctx.stroke();
    });
    ctx.strokeStyle = 'rgba(134,247,232,.5)';
    ctx.beginPath(); ctx.moveTo(goalX - 7, goalY); ctx.lineTo(goalX + 7, goalY); ctx.moveTo(goalX, goalY - 7); ctx.lineTo(goalX, goalY + 7); ctx.stroke();
    ctx.fillStyle = 'rgba(234,250,247,.95)';
    ctx.beginPath(); ctx.arc(goalX, goalY, 2.4, 0, TAU); ctx.fill();

    // agents
    var agents = [];
    var N = 24;
    for (var i = 0; i < N; i++) {
      var base = i / N * TAU;
      var rad = R * (.16 + .3 * (.5 + .5 * Math.sin(t * .1 + i * 1.37)));
      var a = base + t * .045 * (i % 3 === 0 ? -1 : 1) + Math.sin(t * .2 + i) * .09;
      var x = cx + Math.cos(a) * rad;
      var y = cy + Math.sin(a) * rad * .84;
      agents.push({ x: x, y: y, i: i, a: a, rad: rad });
    }

    // constellation
    ctx.save();
    ctx.lineWidth = .55;
    for (var j = 0; j < agents.length; j++) {
      for (var k = 0; k < j; k++) {
        var A = agents[j], B = agents[k];
        var d = Math.hypot(A.x - B.x, A.y - B.y);
        if (d < R * .27) {
          ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y);
          ctx.strokeStyle = 'rgba(166,195,255,' + (1 - d / (R * .27)) * .22 + ')';
          ctx.stroke();
        }
      }
    }
    // dispatch routes
    agents.forEach(function (ag) {
      if (ag.i % 2 !== 0) return;
      var mx = (ag.x + goalX) / 2 + Math.sin(t * .4 + ag.i) * 16;
      var my = (ag.y + goalY) / 2 + Math.cos(t * .32 + ag.i) * 16;
      ctx.beginPath();
      ctx.moveTo(ag.x, ag.y);
      ctx.quadraticCurveTo(mx, my, goalX, goalY);
      ctx.strokeStyle = 'rgba(77,107,254,.2)';
      ctx.setLineDash([2, 5]);
      ctx.lineDashOffset = -t * 10;
      ctx.stroke();
      ctx.setLineDash([]);
    });
    ctx.restore();

    // comet trails and heads
    agents.forEach(function (ag) {
      ctx.beginPath();
      for (var s = 14; s >= 0; s--) {
        var tt = t - s * .038;
        var rad2 = R * (.16 + .3 * (.5 + .5 * Math.sin(tt * .1 + ag.i * 1.37)));
        var a2 = ag.i / N * TAU + tt * .045 * (ag.i % 3 === 0 ? -1 : 1) + Math.sin(tt * .2 + ag.i) * .09;
        var x2 = cx + Math.cos(a2) * rad2;
        var y2 = cy + Math.sin(a2) * rad2 * .84;
        if (s === 14) ctx.moveTo(x2, y2); else ctx.lineTo(x2, y2);
      }
      ctx.strokeStyle = 'rgba(190,211,245,.16)';
      ctx.lineWidth = .6;
      ctx.stroke();

      ctx.beginPath();
      for (var s2 = 5; s2 >= 0; s2--) {
        var tt2 = t - s2 * .045;
        var rad3 = R * (.16 + .3 * (.5 + .5 * Math.sin(tt2 * .1 + ag.i * 1.37)));
        var a3 = ag.i / N * TAU + tt2 * .045 * (ag.i % 3 === 0 ? -1 : 1) + Math.sin(tt2 * .2 + ag.i) * .09;
        var x3 = cx + Math.cos(a3) * rad3;
        var y3 = cy + Math.sin(a3) * rad3 * .84;
        ctx.beginPath(); ctx.arc(x3, y3, clamp(1.6 - s2 * .2, .3, 1.6), 0, TAU);
        ctx.fillStyle = 'rgba(134,247,232,' + (.07 + (5 - s2) * .055) + ')';
        ctx.fill();
      }

      var g2 = ctx.createRadialGradient(ag.x, ag.y, 0, ag.x, ag.y, 9);
      g2.addColorStop(0, 'rgba(134,247,232,.3)'); g2.addColorStop(1, 'rgba(134,247,232,0)');
      ctx.fillStyle = g2;
      ctx.beginPath(); ctx.arc(ag.x, ag.y, 9, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(ag.x, ag.y, ag.i % 4 === 0 ? 2.3 : 1.7, 0, TAU);
      ctx.fillStyle = ag.i % 4 === 0 ? 'rgba(134,247,232,.95)' : 'rgba(234,240,250,.82)';
      ctx.fill();
    });

    // travel sparks toward goal
    for (var sp = 0; sp < 6; sp++) {
      var f = (t * .16 + sp / 6) % 1;
      var ag = agents[sp * 3 % agents.length];
      var sx = ag.x + (goalX - ag.x) * f;
      var sy = ag.y + (goalY - ag.y) * f + Math.sin(f * Math.PI) * 16;
      ctx.beginPath(); ctx.arc(sx, sy, 1.1, 0, TAU);
      ctx.fillStyle = 'rgba(134,247,232,.55)'; ctx.fill();
    }
  }

  var MODES = [modeCoil, modeCode, modeMath, modeLanguage, modeVision, modeAgents];

  /* ---------- instance ---------- */
  function create(canvas, options) {
    options = options || {};
    if (!canvas || !canvas.getContext) return null;
    var ctx = canvas.getContext('2d');
    if (!ctx) return null;

    var reduced = options.reducedMotion;
    if (reduced === undefined) {
      reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    }

    var w = 0, h = 0, dpr = 1, t = 5.2, mode = options.mode || 0;
    var raf = null, running = false, visible = false, inView = true;
    var lastTime = 0, fade = 1, fadeStart = 0;
    var buffer = document.createElement('canvas');
    var bctx = buffer.getContext('2d');
    var pointer = { x: .5, y: .5, tx: .5, ty: .5 };
    var dust = makeDust(214, 46);
    var ro = null, io = null;

    function sizeCanvas() {
      var rect = canvas.getBoundingClientRect();
      var cw = Math.max(1, Math.round(rect.width));
      var ch = Math.max(1, Math.round(rect.height));
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (cw === w && ch === h && canvas.width === Math.round(cw * dpr)) return;
      w = cw; h = ch;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      buffer.width = canvas.width;
      buffer.height = canvas.height;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      bctx.setTransform(1, 0, 0, 1, 0, 0);
    }

    function snapshot() {
      if (!w || !h) return;
      bctx.clearRect(0, 0, buffer.width, buffer.height);
      try { bctx.drawImage(canvas, 0, 0); } catch (e) { /* noop */ }
      fade = 0; fadeStart = performance.now();
    }

    function draw(now, dt) {
      if (!w || !h) return;
      // pointer easing
      pointer.x += (pointer.tx - pointer.x) * .06;
      pointer.y += (pointer.ty - pointer.y) * .06;

      var anim = reduced ? 0 : dt;
      if (!reduced) t += Math.min(anim, .05);

      ctx.clearRect(0, 0, w, h);
      drawBase(ctx, w, h, t, dust, pointer.x, pointer.y);

      var progress = fadeStart ? clamp((now - fadeStart) / 820, 0, 1) : 1;
      fade = easeOut(progress);
      var currentAlpha = reduced ? 1 : fade;

      ctx.save();
      ctx.globalAlpha = currentAlpha;
      var fn = MODES[mode % MODES.length];
      if (fn) {
        ctx.save();
        fn(ctx, w, h, t, pointer.x, pointer.y);
        ctx.restore();
      }
      ctx.restore();

      if (!reduced && fade < 1) {
        ctx.save();
        ctx.globalAlpha = 1 - fade;
        ctx.drawImage(buffer, 0, 0, w, h);
        ctx.restore();
        // gentle light bloom to cover the cut
        var cx = w / 2, cy = h / 2;
        var g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.min(w, h) * .6);
        g.addColorStop(0, 'rgba(134,247,232,' + (.10 * (1 - fade)) + ')');
        g.addColorStop(1, 'rgba(134,247,232,0)');
        ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      }
      drawRulers(ctx, w, h);
    }

    function frame(now) {
      raf = null;
      if (!running) return;
      var dt = Math.min((now - (lastTime || now)) / 1000, .05);
      lastTime = now;
      draw(now, reduced ? 0 : dt);
      raf = requestAnimationFrame(frame);
    }

    function start() {
      if (running) return;
      running = true; lastTime = 0;
      if (raf == null) raf = requestAnimationFrame(frame);
    }
    function stop() {
      running = false;
      if (raf != null) { cancelAnimationFrame(raf); raf = null; }
    }

    function onVisibility() {
      if (document.hidden) stop();
      else if (visible) start();
    }

    function setMode(m) {
      m = ((m % MODES.length) + MODES.length) % MODES.length;
      if (m === mode) return;
      snapshot();
      mode = m;
      if (reduced) { fade = 1; fadeStart = 0; draw(performance.now(), 0); }
    }

    function onResize() {
      var oldW = w, oldH = h;
      sizeCanvas();
      if (oldW && oldH && (oldW !== w || oldH !== h)) {
        fade = 1; fadeStart = 0;
      }
      if (reduced) draw(performance.now(), 0);
    }

    // pointer
    function onPointerMove(e) {
      var r = canvas.getBoundingClientRect();
      pointer.tx = clamp((e.clientX - r.left) / Math.max(1, r.width), 0, 1);
      pointer.ty = clamp((e.clientY - r.top) / Math.max(1, r.height), 0, 1);
    }
    function onPointerLeave() { pointer.tx = .5; pointer.ty = .5; }
    canvas.addEventListener('pointermove', onPointerMove, { passive: true });
    canvas.addEventListener('pointerleave', onPointerLeave, { passive: true });

    sizeCanvas();
    if ('ResizeObserver' in window) {
      ro = new ResizeObserver(onResize);
      ro.observe(canvas);
    } else {
      window.addEventListener('resize', onResize);
    }
    if ('IntersectionObserver' in window) {
      io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          visible = en.isIntersecting;
          if (visible && !document.hidden) start(); else stop();
        });
      }, { rootMargin: '120px' });
      io.observe(canvas);
    } else {
      visible = true; start();
    }
    document.addEventListener('visibilitychange', onVisibility);

    draw(performance.now(), 0);

    return {
      setMode: setMode,
      start: start,
      stop: stop,
      resize: onResize,
      destroy: function () {
        stop();
        canvas.removeEventListener('pointermove', onPointerMove);
        canvas.removeEventListener('pointerleave', onPointerLeave);
        document.removeEventListener('visibilitychange', onVisibility);
        if (ro) ro.disconnect();
        if (io) io.disconnect();
        window.removeEventListener('resize', onResize);
      }
    };
  }

  window.Specimen = { create: create, modes: MODES.length };
})();
