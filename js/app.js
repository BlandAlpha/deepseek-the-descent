/* ============================================================
   DEEPSEEK — THE DESCENT
   js/app.js — experience orchestration
   Plain script · no dependencies · file:// safe
   ============================================================ */
(function () {
  'use strict';

  var doc = document;
  var root = doc.documentElement;
  var body = doc.body;
  var $ = function (sel, scope) { return (scope || doc).querySelector(sel); };
  var $$ = function (sel, scope) { return Array.prototype.slice.call((scope || doc).querySelectorAll(sel)); };
  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  var lerp = function (a, b, n) { return a + (b - a) * n; };
  var pad = function (n, len) { var s = String(n); while (s.length < len) s = '0' + s; return s; };
  var fmt = function (n) { return Math.round(n).toLocaleString('en-US'); };
  var easeOutExpo = function (t) { return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t); };
  var params = new URLSearchParams(window.location.search);
  var NO_BOOT = params.has('noboot');
  var mqReduce = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  var reduced = !!(mqReduce && mqReduce.matches);

  document.addEventListener('DOMContentLoaded', init, { once: true });
  if (doc.readyState !== 'loading') { /* defer scripts run after parse; init below */ }

  var state = {
    booted: false,
    progress: 0,
    depth: 0,
    activeChapter: 0,
    pointer: { x: 0, y: 0, tx: 0, ty: 0 },
    scrollAnim: null,
    userScrolled: false
  };

  var abyss = null;
  var moe = null;
  var specimen = null;
  var moePoll = null;
  var soundOn = false;
  var audioAvailable = false;
  var clockTimer = null;
  var sonar = null;
  var demo = null;
  var paletteApi = null;

  function init() {
    if (state.booted) return;
    try {
      root.classList.add('js');
      if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
      window.scrollTo(0, 0);
      body.classList.add('is-booting');
      setPageInert(true);

      initAtmosphere();
      initAbyss();
      initSpecimen();
      initMoE();
      initReveals();
      initCapabilities();
      initCounters();
      initProfile();
      initDemo();
      demo = initDemoController();
      initSound();
      initSonarButton();
      initPalette();
      initAsk();
      initClock();
      initNav();
      initScrollEngine();
      initPointer();
      initKeyboard();
      initCursorRefresh();

      startBoot();
    } catch (err) {
      // Never leave the visitor behind a broken veil.
      forceReveal();
      if (window.console && console.warn) console.warn('Descent init:', err);
    }
  }

  /* ============================================================
     ATMOSPHERE · WebGL abyss
     ============================================================ */
  function initAtmosphere() {
    if (window.Abyss) {
      audioAvailable = !!window.Ambient;
    }
  }
  function initAbyss() {
    var canvas = $('#abyss');
    if (!canvas || !window.Abyss || typeof window.Abyss.create !== 'function') {
      if (canvas) canvas.style.display = 'none';
      return;
    }
    try {
      abyss = window.Abyss.create(canvas, { reducedMotion: reduced });
      if (abyss && typeof abyss.setScroll === 'function') abyss.setScroll(0);
      if (abyss && abyss.isLive === false) root.classList.add('abyss-fallback');
    } catch (e) { abyss = null; canvas.style.display = 'none'; }
  }

  /* ============================================================
     SPECIMEN · capability canvas
     ============================================================ */
  var specimenApi = null;
  var CAPS = [
    { mode: 'NEURAL COIL', caption: 'A single argument, followed to its end.', code: 'DS-SPEC-001', index: '01 / 06' },
    { mode: 'LATTICE GROWTH', caption: 'Structure emerging under constraint.', code: 'DS-SPEC-002', index: '02 / 06' },
    { mode: 'INTERFERENCE', caption: 'Two truths finding one shape.', code: 'DS-SPEC-003', index: '03 / 06' },
    { mode: 'TIDAL SCRIPT', caption: 'Meaning, in flow.', code: 'DS-SPEC-004', index: '04 / 06' },
    { mode: 'IRIS', caption: 'The image, read from the inside.', code: 'DS-SPEC-005', index: '05 / 06' },
    { mode: 'SWARM', caption: 'Many hands, one intention.', code: 'DS-SPEC-006', index: '06 / 06' }
  ];
  function initSpecimen() {
    var canvas = $('#specimen-canvas');
    if (!canvas || !window.Specimen || typeof window.Specimen.create !== 'function') return;
    try {
      specimenApi = window.Specimen.create(canvas, { reducedMotion: reduced, mode: 0 });
      if (specimenApi && typeof specimenApi.setMode === 'function') specimenApi.setMode(0);
    } catch (e) { specimenApi = null; }
  }

  /* ============================================================
     MoE · expert parliament
     ============================================================ */
  function initMoE() {
    var canvas = $('#moe-canvas');
    if (!canvas || !window.MoE || typeof window.MoE.create !== 'function') return;
    var tip = $('#moe-tip');
    var panel = $('.moe__panel');
    var tipId = $('#moe-tip-id');
    var tipState = $('#moe-tip-state');
    var tipName = $('#moe-tip-name');
    var tipLoad = $('#moe-tip-load');
    var tipCode = $('#moe-tip-code');
    var caption = $('#moe-caption');
    var live = $('#moe-a11y');
    var keyboardMode = false;
    var kbdId = 0;
    var DEFAULT_CAPTION = 'Every cell is a specialist. Every token, an election.';

    function announce(msg) { if (live) live.textContent = msg; }
    function describe(info) {
      if (!info) return '';
      return 'Expert ' + pad(info.id, 3) + ', ' + (info.specialty || 'specialist') + '. ' +
        (info.routed ? 'Awake for this route.' : 'Standing by.') + ' Press Enter to pin or unpin.';
    }
    function resetCaptionIfUnpinned() {
      if (!caption) return;
      var st = moe && moe.getState ? moe.getState() : null;
      if (!st || !st.pinnedId) caption.textContent = DEFAULT_CAPTION;
    }

    function placeTip(info) {
      if (!tip || !panel) return;
      if (!info) { tip.hidden = true; resetCaptionIfUnpinned(); return; }
      tipId.textContent = info.code || ('EXPERT ' + pad(info.id, 3));
      tipState.textContent = info.routed ? 'ROUTED · ' + (info.routedAt || 'NOW') : 'STANDBY';
      tipState.style.color = info.routed ? 'var(--cyan)' : 'var(--faint)';
      tipName.textContent = info.specialty || 'SPECIALIST';
      tipLoad.textContent = 'LOAD ' + (typeof info.load === 'number' ? info.load.toFixed(1) : '00.0') + '%';
      tipCode.textContent = 'EX-' + pad(info.id, 3);
      tip.hidden = false;
      var rect = panel.getBoundingClientRect();
      var tw = tip.offsetWidth || 180;
      var th = tip.offsetHeight || 80;
      var left = clamp(info.x + 18, 12, rect.width - tw - 22);
      var top = clamp(info.y, 56 + th / 2, rect.height - 64 - th / 2);
      tip.style.left = left + 'px';
      tip.style.top = top + 'px';
      if (keyboardMode) announce(describe(info));
    }

    try {
      moe = window.MoE.create(canvas, {
        reducedMotion: reduced,
        autoStart: true,
        onHover: function (info) {
          placeTip(info);
          if (caption && info) {
            caption.textContent = info.specialty
              ? 'Expert ' + pad(info.id, 3) + ' — ' + info.specialty.toLowerCase() + '. ' + (info.routed ? 'Awake for this question.' : 'Waiting in the dark.')
              : caption.textContent;
          }
        },
        onSelect: function (info) {
          if (info && info.pinned) {
            if (caption) caption.textContent = 'Pinned — expert ' + pad(info.id, 3) + ' · ' + info.specialty + ' · route logged.';
            if (keyboardMode) announce('Pinned ' + describe(info));
          } else {
            resetCaptionIfUnpinned();
            if (keyboardMode) announce(info ? 'Unpinned expert ' + pad(info.id, 3) + '. ' : 'Inspection cleared.');
          }
          blip('route');
        }
      });
      if (!moe) return;
      window.__MOE = moe;

      // Keyboard path for the routing field. The canvas remains decorative.
      function focusIsVisible() {
        try { return panel.matches(':focus-visible'); } catch (e) { return true; }
      }
      function nextValid(from, dir) {
        var id = from;
        for (var n = 0; n < 256; n++) {
          id += dir;
          if (id < 1) id = 256;
          if (id > 256) id = 1;
          var info = moe.inspect(id);
          if (info) return info;
        }
        return null;
      }
      if (panel) {
        panel.addEventListener('focus', function () {
          if (!focusIsVisible()) return;
          keyboardMode = true;
          var st = moe.getState ? moe.getState() : null;
          var start = (st && st.activeIds && st.activeIds[0]) || 1;
          var info = null;
          try { info = moe.inspect(start); } catch (e) {}
          if (!info) info = nextValid(start, 1);
          if (info) { kbdId = info.id; announce(describe(info)); }
          else announce('No expert available at this routing cycle.');
        });
        panel.addEventListener('blur', function () {
          keyboardMode = false;
          try { if (moe && moe.inspect) moe.inspect(null); } catch (e) {}
          if (tip) tip.hidden = true;
        });
        panel.addEventListener('keydown', function (e) {
          if (!moe || e.metaKey || e.ctrlKey || e.altKey) return;
          var st = moe.getState ? moe.getState() : null;
          if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
            e.preventDefault();
            keyboardMode = true;
            var dir = (e.key === 'ArrowRight' || e.key === 'ArrowDown') ? 1 : -1;
            var start = kbdId || (st && st.activeIds && st.activeIds[0]) || 0;
            var info = nextValid(start, dir);
            if (info) { kbdId = info.id; announce(describe(info)); }
            return;
          }
          if (e.key === 'Home' || e.key === 'End') {
            e.preventDefault();
            keyboardMode = true;
            var info2 = nextValid(e.key === 'Home' ? 0 : 257, e.key === 'Home' ? 1 : -1);
            if (info2) { kbdId = info2.id; announce(describe(info2)); }
            return;
          }
          if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
            if (!kbdId) return;
            e.preventDefault();
            keyboardMode = true;
            if (st && st.pinnedId === kbdId) {
              try { moe.clear(); } catch (err) {}
              var again = null;
              try { again = moe.inspect(kbdId); } catch (err2) {}
              announce('Unpinned expert ' + pad(kbdId, 3) + '.');
              if (!again) kbdId = 0;
            } else {
              try { moe.select(kbdId); } catch (err3) {}
            }
            return;
          }
          if (e.key === 'Escape') {
            e.preventDefault();
            try { moe.clear(); } catch (err4) {}
            placeTip(null);
            kbdId = 0;
            announce('Inspection cleared.');
          }
        });
      }

      var routeEl = $('#moe-route');
      var awakeEl = $('#moe-awake');
      var inView = true;
      var sec = $('#abyssal');
      if ('IntersectionObserver' in window && sec) {
        new IntersectionObserver(function (entries) {
          entries.forEach(function (en) { inView = en.isIntersecting; });
        }, { rootMargin: '60px' }).observe(sec);
      }
      moePoll = setInterval(function () {
        if (!inView || !moe || !moe.getState) return;
        var st2 = moe.getState();
        if (!st2) return;
        if (routeEl) routeEl.textContent = '#' + pad(st2.route || 0, 4);
        if (awakeEl) awakeEl.textContent = pad(st2.awake || 8, 2);
      }, 800);
    } catch (e) { moe = null; }
  }

  /* ============================================================
     REVEALS
     ============================================================ */
  function initReveals() {
    var targets = $$('[data-reveal]');
    var heads = $$('.display');
    if (!('IntersectionObserver' in window)) {
      targets.forEach(function (el) { el.classList.add('is-revealed'); });
      heads.forEach(function (el) { el.classList.add('is-revealed'); });
      splitLit();
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        en.target.classList.add('is-revealed');
        io.unobserve(en.target);
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.12 });
    targets.forEach(function (el) { io.observe(el); });
    heads.forEach(function (el) { io.observe(el); });
    splitLit();
  }

  var lit = null;
  function splitLit() {
    var el = $('[data-lit]');
    if (!el) return;
    var words = [];
    function walk(node) {
      if (node.nodeType === 3) {
        var text = node.nodeValue;
        var frag = doc.createDocumentFragment();
        var parts = text.split(/(\s+)/);
        parts.forEach(function (part) {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.appendChild(doc.createTextNode(part)); return; }
          var span = doc.createElement('span');
          span.className = 'w';
          span.textContent = part;
          frag.appendChild(span);
          words.push(span);
        });
        node.parentNode.replaceChild(frag, node);
      } else if (node.nodeType === 1) {
        Array.prototype.slice.call(node.childNodes).forEach(walk);
      }
    }
    Array.prototype.slice.call(el.childNodes).forEach(walk);
    lit = { el: el, words: words, count: -1 };
    updateLit();
  }
  function updateLit() {
    if (!lit) return;
    var rect = lit.el.getBoundingClientRect();
    var vh = window.innerHeight || 800;
    if (rect.bottom < -100 || rect.top > vh + 100) return;
    var p = (vh * 0.82 - rect.top) / (vh * 0.42 + rect.height * 0.5);
    p = clamp(p, 0, 1.08);
    var count = clamp(Math.round(p * (lit.words.length + 4)), 0, lit.words.length);
    if (count === lit.count) return;
    for (var i = 0; i < lit.words.length; i++) {
      lit.words[i].classList.toggle('is-lit', i < count);
    }
    lit.count = count;
  }

  /* ============================================================
     CAPABILITIES
     ============================================================ */
  function initCapabilities() {
    var cards = $$('.cap');
    if (!cards.length) return;
    var current = 0;
    var hideTimers = [];
    var usingKeyboard = false;
    doc.addEventListener('keydown', function () { usingKeyboard = true; }, true);
    doc.addEventListener('pointermove', function () { usingKeyboard = false; }, { passive: true, capture: true });

    function setCap(i, opts) {
      i = clamp(i, 0, cards.length - 1);
      opts = opts || {};
      cards.forEach(function (card, k) {
        var on = k === i;
        var head = $('.cap__head', card);
        var panel = $('.cap__body', card);
        card.classList.toggle('is-active', on);
        if (head) {
          head.setAttribute('aria-expanded', on ? 'true' : 'false');
        }
        if (panel) {
          clearTimeout(hideTimers[k]);
          if (on) {
            panel.hidden = false;
            panel.setAttribute('aria-hidden', 'false');
          } else {
            panel.setAttribute('aria-hidden', 'true');
            hideTimers[k] = setTimeout(function () {
              if (!card.classList.contains('is-active')) panel.hidden = true;
            }, 560);
          }
        }
      });
      if (current !== i || opts.force) {
        current = i;
        var meta = CAPS[i];
        var modeEl = $('#specimen-mode');
        var capEl = $('#specimen-caption');
        var codeEl = $('#specimen-code');
        var idxEl = $('#specimen-index');
        if (modeEl) modeEl.textContent = meta.mode;
        if (capEl) capEl.textContent = meta.caption;
        if (codeEl) codeEl.textContent = meta.code;
        if (idxEl) idxEl.textContent = meta.index;
        if (specimenApi && typeof specimenApi.setMode === 'function') specimenApi.setMode(i);
      }
    }

    cards.forEach(function (card, i) {
      var head = $('.cap__head', card);
      if (!head) return;
      head.addEventListener('click', function () { setCap(i, { force: true }); blip('click'); });
      card.addEventListener('pointerenter', function (e) {
        if (e.pointerType === 'touch') return;
        if (usingKeyboard) return;
        if (window.innerWidth <= 980) return;
        setCap(i);
      });
    });

    var list = $('.capabilities');
    if (list) {
      list.addEventListener('keydown', function (e) {
        var tab = e.target.closest ? e.target.closest('.cap__head') : null;
        if (!tab) return;
        var keys = ['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft', 'Home', 'End'];
        if (keys.indexOf(e.key) === -1) return;
        e.preventDefault();
        var focusedCard = tab.closest ? tab.closest('.cap') : null;
        var focusIndex = focusedCard ? cards.indexOf(focusedCard) : -1;
        var base = focusIndex >= 0 ? focusIndex : current;
        var next = base;
        if (e.key === 'ArrowDown' || e.key === 'ArrowRight') next = (base + 1) % cards.length;
        if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') next = (base - 1 + cards.length) % cards.length;
        if (e.key === 'Home') next = 0;
        if (e.key === 'End') next = cards.length - 1;
        setCap(next, { force: true });
        var btn = $('.cap__head', cards[next]);
        if (btn) btn.focus();
        blip('route');
      });
    }
    setCap(0, { force: true });
  }

  /* ============================================================
     COUNTERS
     ============================================================ */
  function initCounters() {
    var els = $$('[data-count]');
    if (!els.length || !('IntersectionObserver' in window)) {
      els.forEach(function (el) { el.textContent = el.getAttribute('data-count'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        animateCount(en.target);
        io.unobserve(en.target);
      });
    }, { threshold: 0.45 });
    els.forEach(function (el) { io.observe(el); });
  }
  function animateCount(el) {
    var target = parseFloat(el.getAttribute('data-count'));
    var dec = el.getAttribute('data-format') === 'dec';
    if (reduced) { el.textContent = dec ? target.toFixed(1) : fmt(target); return; }
    var start = performance.now();
    var dur = 1700;
    function tick(now) {
      var p = clamp((now - start) / dur, 0, 1);
      var v = target * easeOutExpo(p);
      el.textContent = dec ? v.toFixed(1) : fmt(Math.round(v));
      if (p < 1) requestAnimationFrame(tick);
      else el.textContent = dec ? target.toFixed(1) : fmt(target);
    }
    requestAnimationFrame(tick);
  }

  /* ============================================================
     DEPTH PROFILE
     ============================================================ */
  var profileEls = null;
  function initProfile() {
    var path = $('#profile-line');
    var marker = $('#profile-marker');
    var chart = $('.profile__chart');
    var profile = $('.profile');
    if (!path || !marker) return;
    var len = 0;
    try { len = path.getTotalLength(); } catch (e) { len = 0; }
    profileEls = { path: path, marker: marker, chart: chart, len: len };
    if (profile && 'IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { if (en.isIntersecting) profile.classList.add('is-revealed'); });
      }, { threshold: 0.18 }).observe(profile);
    } else if (profile) {
      profile.classList.add('is-revealed');
    }
  }
  function updateProfile() {
    if (!profileEls || !profileEls.len || !profileEls.chart) return;
    var rect = profileEls.chart.getBoundingClientRect();
    var vh = window.innerHeight || 800;
    var p = clamp((vh * 0.82 - rect.top) / (vh * 0.62), 0, 1);
    if (reduced) p = 0.94;
    try {
      var pt = profileEls.path.getPointAtLength(profileEls.len * p);
      profileEls.marker.setAttribute('transform', 'translate(' + pt.x.toFixed(1) + ',' + pt.y.toFixed(1) + ')');
      profileEls.marker.style.opacity = p > 0.015 ? '1' : '0';
    } catch (e) { /* noop */ }
  }

  /* ============================================================
     BOOT
     ============================================================ */
  function startBoot() {
    var boot = $('#boot');
    var numEl = $('#boot-num');
    var barEl = $('#boot-bar');
    var labelEl = $('#boot-label');
    var finished = false;
    var scheduled = false;
    var timer = null;
    var start = performance.now();
    var progress = 0;
    var DURATION = 2100;

    function paint() {
      if (numEl) numEl.textContent = pad(Math.floor(progress), 3);
      if (barEl) barEl.style.width = Math.min(100, progress).toFixed(2) + '%';
      if (labelEl) {
        labelEl.textContent = progress < 34 ? 'SOUNDING THE DEPTHS' : progress < 74 ? 'CALIBRATING INSTRUMENTS' : progress < 99 ? 'PRESSURIZING THE HULL' : 'DESCENT READY';
      }
    }
    function finish() {
      if (finished) return;
      finished = true;
      if (timer) { clearInterval(timer); timer = null; }
      progress = 100; paint();
      state.booted = true;
      if (boot) {
        boot.classList.add('is-done');
        setTimeout(function () { boot.style.display = 'none'; }, 1500);
      }
      body.classList.remove('is-booting');
      body.classList.add('is-ready');
      root.setAttribute('data-ready', 'true');
      setPageInert(false);
      startLiveModules();
      if (window.location.hash) {
        var target = document.querySelector(window.location.hash);
        if (target) setTimeout(function () { jumpTo(target, true); }, 80);
      }
      if (demo && typeof demo.onBoot === 'function') demo.onBoot();
    }
    function timeline(p) {
      // 0..1 -> an instrument that hesitates, then commits
      if (p < .32) return (p / .32) * 31;
      if (p < .64) return 31 + ((p - .32) / .32) * 45;
      if (p < .84) return 76 + ((p - .64) / .20) * 16;
      return 92 + ((p - .84) / .16) * 8;
    }
    function settle() {
      if (scheduled) return;
      scheduled = true;
      progress = 100;
      paint();
      setTimeout(finish, NO_BOOT ? 0 : 300);
    }
    var skipBtn = $('#boot-skip');
    if (skipBtn) {
      skipBtn.addEventListener('click', function () {
        if (finished) return;
        if (timer) { clearInterval(timer); timer = null; }
        scheduled = true;
        progress = 100;
        paint();
        setTimeout(finish, 180);
      });
    }

    if (NO_BOOT || reduced) {
      progress = 100;
      paint();
      scheduled = true;
      setTimeout(finish, NO_BOOT ? 30 : 120);
    } else {
      timer = setInterval(function () {
        var elapsed = performance.now() - start;
        var p = clamp(elapsed / DURATION, 0, 1);
        progress = timeline(p);
        if (p >= 1) { settle(); return; }
        paint();
      }, 70);
      paint();
    }

    // Safety: never trap the visitor behind the veil.
    setTimeout(function () {
      if (!finished) { if (timer) clearInterval(timer); finish(); }
    }, 5200);
  }

  function setPageInert(on) {
    ['#main', '#topbar', '.rail', '.statusbar', '.progress', '.skip-link'].forEach(function (sel) {
      var el = $(sel);
      if (!el) return;
      if (on) el.setAttribute('inert', '');
      else el.removeAttribute('inert');
    });
  }

  function startLiveModules() {
    if (moe && typeof moe.start === 'function') { try { moe.start(); } catch (e) {} }
    if (specimenApi && typeof specimenApi.start === 'function') { try { specimenApi.start(); } catch (e) {} }
  }

  function forceReveal() {
    var boot = $('#boot');
    if (boot) boot.style.display = 'none';
    body.classList.remove('is-booting');
    body.classList.add('is-ready');
    root.setAttribute('data-ready', 'true');
    setPageInert(false);
    $$('[data-reveal]').forEach(function (el) { el.classList.add('is-revealed'); });
    $$('.display').forEach(function (el) { el.classList.add('is-revealed'); });
  }

  /* ============================================================
     POINTER · abyss parallax
     ============================================================ */
  function initPointer() {
    if (!window.matchMedia || !window.matchMedia('(pointer:fine)').matches) return;
    window.addEventListener('pointermove', function (e) {
      state.pointer.tx = (e.clientX / window.innerWidth) * 2 - 1;
      state.pointer.ty = (e.clientY / window.innerHeight) * 2 - 1;
    }, { passive: true });
  }

  /* ============================================================
     SCROLL ENGINE · HUD, rail, depth, abyss, lit text
     ============================================================ */
  function initScrollEngine() {
    var sections = $$('[data-chapter]');
    var railButtons = $$('[data-chapter-link]');
    var topbar = $('#topbar');
    var progressFill = $('#progress-fill');
    var railFill = $('#rail-fill');
    var hudDepth = $('#hud-depth');
    var hudPressure = $('#hud-pressure');
    var hudTemp = $('#hud-temp');
    var railDepth = $('#rail-depth');
    var smoothProgress = 0;
    var lastHud = 0;
    var lastActive = -1;
    var scrollTicking = false;

    function onFrame(now) {
      scrollTicking = false;
      var vh = window.innerHeight || 800;
      var sy = window.scrollY || window.pageYOffset || 0;
      var max = Math.max(1, (doc.documentElement.scrollHeight - vh));
      var target = clamp(sy / max, 0, 1);
      state.progress = target;
      smoothProgress += (target - smoothProgress) * (reduced ? 1 : 0.07);

      // pointer easing for shader
      state.pointer.x += (state.pointer.tx - state.pointer.x) * 0.045;
      state.pointer.y += (state.pointer.ty - state.pointer.y) * 0.045;
      if (abyss) {
        try {
          if (abyss.setScroll) abyss.setScroll(smoothProgress);
          if (abyss.setPointer) abyss.setPointer(state.pointer.x, state.pointer.y);
        } catch (e) {}
      }
      if (window.Ambient && window.Ambient.setIntensity) {
        try { window.Ambient.setIntensity(target); } catch (e) {}
      }

      if (topbar) topbar.classList.toggle('is-scrolled', sy > 30);
      if (progressFill) progressFill.style.transform = 'scaleX(' + target.toFixed(4) + ')';
      if (railFill) railFill.style.transform = 'scaleY(' + target.toFixed(4) + ')';

      // depth interpolation across chapters
      var active = 0;
      var local = 0;
      var currentDepth = 0;
      var found = false;
      for (var i = 0; i < sections.length; i++) {
        var r = sections[i].getBoundingClientRect();
        var depth = parseFloat(sections[i].getAttribute('data-depth')) || 0;
        if (r.top <= vh * 0.48) {
          active = i;
          local = clamp((vh * 0.48 - r.top) / Math.max(1, r.height), 0, 1);
          var prevDepth = i > 0 ? (parseFloat(sections[i - 1].getAttribute('data-depth')) || 0) : 0;
          currentDepth = prevDepth + (depth - prevDepth) * local;
          found = true;
        }
      }
      if (!found) { active = 0; currentDepth = 0; }
      state.depth = currentDepth;
      state.activeChapter = active;

      if (active !== lastActive) {
        lastActive = active;
        railButtons.forEach(function (btn) {
          var is = parseInt(btn.getAttribute('data-chapter-link'), 10) === active;
          btn.setAttribute('aria-current', is ? 'true' : 'false');
        });
      }

      // ascent hides chrome
      var ascent = $('#ascent');
      if (ascent) {
        var ar = ascent.getBoundingClientRect();
        body.classList.toggle('is-ascent', ar.top < vh * 0.55);
      }

      // throttled telemetry writes
      if (now - lastHud > 70) {
        lastHud = now;
        var d = Math.max(0, currentDepth);
        if (hudDepth) hudDepth.innerHTML = pad(Math.round(d), 5) + '<em>M</em>';
        if (railDepth) railDepth.textContent = fmt(d);
        var pressure = 1 + d / 10;
        if (hudPressure) hudPressure.textContent = (pressure < 10 ? pressure.toFixed(1) : fmt(pressure)) + ' ATM';
        if (hudTemp) hudTemp.textContent = (21.4 - (d / 10994) * 20).toFixed(1) + '°C';
      }

      updateLit();
      updateProfile();
      requestAnimationFrame(onFrame);
    }
    requestAnimationFrame(onFrame);

    // cancel programmatic scroll if the visitor takes over
    ['wheel', 'touchstart', 'keydown'].forEach(function (ev) {
      window.addEventListener(ev, function () {
        if (state.scrollAnim) { cancelAnimationFrame(state.scrollAnim); state.scrollAnim = null; }
      }, { passive: true });
    });
  }

  function scrollToY(y) {
    var startY = window.scrollY;
    var dist = y - startY;
    if (reduced || Math.abs(dist) < 3) { window.scrollTo(0, y); return; }
    if (state.scrollAnim) cancelAnimationFrame(state.scrollAnim);
    var t0 = performance.now();
    var dur = clamp(Math.abs(dist) * 0.42, 700, 1400);
    function step(now) {
      var p = clamp((now - t0) / dur, 0, 1);
      var e = p < 0.5 ? 8 * p * p * p * p : 1 - Math.pow(-2 * p + 2, 4) / 2;
      window.scrollTo(0, startY + dist * e);
      if (p < 1) state.scrollAnim = requestAnimationFrame(step);
      else state.scrollAnim = null;
    }
    state.scrollAnim = requestAnimationFrame(step);
  }
  function jumpTo(el, instant) {
    if (!el) return;
    var y = el.getBoundingClientRect().top + window.scrollY;
    if (el.id === 'surface') y = 0;
    if (instant) window.scrollTo(0, y); else scrollToY(y);
  }
  function initNav() {
    doc.addEventListener('click', function (e) {
      var a = e.target.closest ? e.target.closest('[data-nav], a[href^="#"]') : null;
      if (!a) return;
      var targetSel = a.getAttribute('data-nav') || a.getAttribute('href');
      if (!targetSel || targetSel.charAt(0) !== '#') return;
      var target = document.querySelector(targetSel);
      if (!target) return;
      e.preventDefault();
      var nav = a.closest('.rail__list');
      var isSkip = a.classList.contains('skip-link');
      if (!nav && paletteApi) paletteApi.close(false);
      jumpTo(target, false);
      if (isSkip && target.focus) {
        try { target.focus({ preventScroll: true }); } catch (err) { target.focus(); }
      }
      if (audioAvailable) blip('click');
      if (window.Cursor && window.Cursor.refresh) window.Cursor.refresh();
    });
  }

  /* ============================================================
     CURSOR / SOUND helpers
     ============================================================ */
  function initCursorRefresh() {
    if (window.Cursor && window.Cursor.refresh) {
      try { window.Cursor.refresh(); } catch (e) {}
    }
  }
  function blip(kind) {
    if (!audioAvailable || !window.Ambient || !window.Ambient.isEnabled) return;
    try {
      if (window.Ambient.isEnabled()) window.Ambient.blip(kind);
    } catch (e) {}
  }
  function initSound() {
    var btn = $('#sound-toggle');
    if (!btn) return;
    if (!window.Ambient) {
      btn.addEventListener('click', function () {
        var label = $('.sound__label', btn);
        if (label) label.textContent = 'AUDIO N/A';
        btn.setAttribute('aria-pressed', 'false');
      });
      return;
    }
    audioAvailable = true;
    function paint() {
      var label = $('.sound__label', btn);
      if (label) label.textContent = soundOn ? 'SOUND ON' : 'SOUND OFF';
      btn.setAttribute('aria-pressed', soundOn ? 'true' : 'false');
    }
    btn.addEventListener('click', function () {
      if (soundOn) {
        try { window.Ambient.disable(); } catch (e) {}
        soundOn = false; paint();
      } else {
        try {
          var maybe = window.Ambient.enable();
          if (maybe && typeof maybe.then === 'function') {
            maybe.then(function (ok) {
              soundOn = !!ok;
              paint();
              if (soundOn) blip('submit');
            }).catch(function () { soundOn = false; paint(); });
          } else {
            soundOn = window.Ambient.isEnabled ? !!window.Ambient.isEnabled() : true;
            paint();
          }
        } catch (e) { soundOn = false; paint(); }
      }
    });
    paint();

    // gentle hovers
    var hoverSelector = '.cap__head, .prompt, .btn, .line-link, .chrome-btn, .rail__list button, .ask__submit, .resurface, .scroll-cue, .brand, .palette__item';
    doc.addEventListener('pointerover', function (e) {
      var el = e.target.closest ? e.target.closest(hoverSelector) : null;
      if (!el) return;
      if (el.contains(e.relatedTarget)) return;
      blip('hover');
    }, { passive: true });

    // text entry ticks
    var ask = $('#ask-input');
    if (ask) {
      var lastType = 0;
      ask.addEventListener('keydown', function () {
        var now = performance.now();
        if (now - lastType > 55) { lastType = now; blip('type'); }
      });
    }
  }

  /* ============================================================
     SONAR
     ============================================================ */
  function pulseSonar(x, y) {
    if (abyss && typeof abyss.pulse === 'function') {
      try { abyss.pulse(x === undefined ? window.innerWidth * 0.52 : x, y === undefined ? window.innerHeight * 0.48 : y, 1); } catch (e) {}
    }
    blip('submit');
    var btn = $('#sonar-btn');
    if (btn) {
      btn.classList.remove('is-pinged');
      void btn.offsetWidth;
      btn.classList.add('is-pinged');
      setTimeout(function () { btn.classList.remove('is-pinged'); }, 1200);
    }
  }
  function initSonarButton() {
    var btn = $('#sonar-btn');
    if (!btn) return;
    btn.addEventListener('click', function () {
      var r = btn.getBoundingClientRect();
      pulseSonar(r.left + r.width / 2, r.top + r.height / 2);
    });
  }

  /* ============================================================
     CLOCK
     ============================================================ */
  function initClock() {
    function paint() {
      var now = new Date();
      var str;
      try {
        str = now.toLocaleTimeString('en-GB', { hour12: false, timeZone: 'Asia/Shanghai' });
      } catch (e) {
        str = pad(now.getHours(), 2) + ':' + pad(now.getMinutes(), 2) + ':' + pad(now.getSeconds(), 2);
      }
      var hud = $('#hud-time');
      var foot = $('#footer-time');
      if (hud) hud.textContent = str;
      if (foot) foot.textContent = 'LOCAL ' + str + ' CST';
    }
    paint();
    clockTimer = setInterval(paint, 1000);
  }

  /* ============================================================
     SONAR STRIP
     ============================================================ */
  function initDemo() {
    var canvas = $('#demo-sonar');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    if (!ctx) return;
    var ctxState = { w: 0, h: 0, dpr: 1, energy: 0.16, targetEnergy: 0.16, raf: null, t: 0, running: false, visible: true };
    function resize() {
      var rect = canvas.getBoundingClientRect();
      ctxState.w = Math.max(1, rect.width);
      ctxState.h = Math.max(1, rect.height);
      ctxState.dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(ctxState.w * ctxState.dpr);
      canvas.height = Math.round(ctxState.h * ctxState.dpr);
      ctx.setTransform(ctxState.dpr, 0, 0, ctxState.dpr, 0, 0);
      if (reduced) draw(1.4);
    }
    function draw(dt) {
      var w = ctxState.w, h = ctxState.h;
      ctxState.t += dt;
      ctxState.energy += (ctxState.targetEnergy - ctxState.energy) * 0.055;
      ctx.clearRect(0, 0, w, h);
      var mid = h * 0.52;
      var energy = ctxState.energy;
      var N = 120;
      var step = w / (N - 1);
      var pts = [];
      var i, x, env, n, amp;
      for (i = 0; i < N; i++) {
        x = i * step;
        env = Math.pow(Math.sin((i / (N - 1)) * Math.PI), 0.55);
        n = Math.sin(i * 0.21 + ctxState.t * 2.1) * 0.52 + Math.sin(i * 0.47 - ctxState.t * 1.35) * 0.3 + Math.sin(i * 0.093 + ctxState.t * 0.7) * 0.18;
        amp = (h * 0.36) * Math.abs(n) * env * energy;
        pts.push([x, amp, n]);
      }
      // ruler ticks
      ctx.strokeStyle = 'rgba(166,195,255,.10)';
      ctx.lineWidth = .5;
      for (x = 0; x < w; x += 22) {
        ctx.beginPath();
        ctx.moveTo(x + .5, h - 5);
        ctx.lineTo(x + .5, h - 1);
        ctx.stroke();
      }
      // mirrored envelope fill
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(0, mid);
      for (i = 0; i < N; i++) ctx.lineTo(pts[i][0], mid - pts[i][1]);
      for (i = N - 1; i >= 0; i--) ctx.lineTo(pts[i][0], mid + pts[i][1] * 0.55);
      ctx.lineTo(w, mid);
      ctx.closePath();
      var fill = ctx.createLinearGradient(0, 0, 0, h);
      fill.addColorStop(0, 'rgba(134,247,232,.02)');
      fill.addColorStop(.5, 'rgba(134,247,232,.16)');
      fill.addColorStop(1, 'rgba(77,107,254,.02)');
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.restore();
      // waveform
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.beginPath();
      for (i = 0; i < N; i++) {
        if (i === 0) ctx.moveTo(pts[i][0], mid - pts[i][1]);
        else ctx.lineTo(pts[i][0], mid - pts[i][1]);
      }
      var line = ctx.createLinearGradient(0, 0, w, 0);
      line.addColorStop(0, 'rgba(77,107,254,.2)');
      line.addColorStop(.28, 'rgba(134,247,232,.72)');
      line.addColorStop(.62, 'rgba(134,247,232,.85)');
      line.addColorStop(1, 'rgba(77,107,254,.22)');
      ctx.strokeStyle = line;
      ctx.lineWidth = 1.1;
      ctx.shadowColor = 'rgba(134,247,232,.45)';
      ctx.shadowBlur = 8;
      ctx.stroke();
      ctx.restore();
      // sparse vertical sample bars
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (i = 0; i < N; i += 3) {
        if (pts[i][1] < .5) continue;
        ctx.beginPath();
        ctx.moveTo(pts[i][0], mid - pts[i][1]);
        ctx.lineTo(pts[i][0], mid - pts[i][1] + 2.5);
        ctx.strokeStyle = 'rgba(134,247,232,.5)';
        ctx.lineWidth = .7;
        ctx.stroke();
      }
      ctx.restore();
      // baseline
      ctx.beginPath();
      ctx.moveTo(0, mid);
      ctx.lineTo(w, mid);
      ctx.strokeStyle = 'rgba(134,247,232,.1)';
      ctx.lineWidth = .5;
      ctx.stroke();
      // sweeping cursor — a line, never a slab
      if (!reduced) {
        var sx = ((ctxState.t * 0.055) % 1) * w;
        var sg = ctx.createLinearGradient(sx - 18, 0, sx, 0);
        sg.addColorStop(0, 'rgba(134,247,232,0)');
        sg.addColorStop(1, 'rgba(134,247,232,.18)');
        ctx.strokeStyle = sg;
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(sx, 4); ctx.lineTo(sx, h - 4); ctx.stroke();
        var g = ctx.createRadialGradient(sx, mid, 0, sx, mid, 12);
        g.addColorStop(0, 'rgba(134,247,232,.35)'); g.addColorStop(1, 'rgba(134,247,232,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(sx, mid, 12, 0, Math.PI * 2); ctx.fill();
      }
    }
    function frame(now) {
      ctxState.raf = null;
      var dt = 0.016;
      if (ctxState.last) dt = Math.min(0.05, (now - ctxState.last) / 1000);
      ctxState.last = now;
      draw(dt);
      if (ctxState.running && ctxState.visible) ctxState.raf = requestAnimationFrame(frame);
    }
    function start() {
      if (ctxState.running || reduced) { draw(1.2); return; }
      if (ctxState.raf) return;
      ctxState.running = true;
      ctxState.last = 0;
      ctxState.raf = requestAnimationFrame(frame);
    }
    function stop() {
      ctxState.running = false;
      if (ctxState.raf) { cancelAnimationFrame(ctxState.raf); ctxState.raf = null; }
    }
    resize();
    window.addEventListener('resize', resize);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          ctxState.visible = en.isIntersecting;
          if (en.isIntersecting) start(); else stop();
        });
      }, { rootMargin: '80px' }).observe(canvas);
    } else { ctxState.visible = true; start(); }
    sonar = {
      setEnergy: function (v) { ctxState.targetEnergy = v; if (reduced) draw(0.5); },
      start: start,
      stop: stop
    };
  }

  /* ============================================================
     DEMO CONTROLLER · reasoning console
     ============================================================ */
  var DEMOS = [
    {
      q: 'Why is the ocean blue?',
      think: [
        'Separate the causes: reflection, absorption, scattering.',
        'Sky reflection is real but weak — the sea is blue under cloud, at depth, at night.',
        'Water absorbs long wavelengths first. Red is gone within meters. Blue survives.',
        'Raman scattering shifts a little red into blue. The sea is blue twice over.'
      ],
      answer: [
        'Because water is a filter that keeps what the sun cannot take. Sunlight enters the sea carrying every color; water absorbs red, orange and yellow within the first few meters, while blue — and some green — travels farther before it is scattered back to your eye. Reflection of the sky adds a little, but it is not the cause: the ocean stays blue under cloud, and grows darker, not colorless, with depth.',
        'There is one more turn. A small fraction of sunlight scatters off water molecules in a process called Raman scattering, shifting some red light into blue. So the sea is blue twice over: because of what it swallows, and because of what it quietly changes. The color you see is the surviving light.'
      ]
    },
    {
      q: 'Invent a sport that only works in zero gravity.',
      think: [
        'Zero gravity removes weight, not momentum.',
        'Design around conservation: every push is also a pull toward somewhere else.',
        'Three-body teams, no floor, no air resistance. Contact only at handholds.',
        'Score precision, not speed. The last gate should be almost too small.'
      ],
      answer: [
        'Call it Orbital Drift. Three players per team, one seven-kilogram sphere, no thrusters. The court is a hollow lattice of forty handholds suspended in silence. Players move by pushing off — every motion returns, so a bad shove is a debt you pay at the far wall.',
        'The sphere may be carried, not thrown; it must pass through three drifting torus gates in sequence, each rotating on its own axis. The final gate is the mouth of a slowly spinning ring only slightly wider than the sphere. Win by threading it three times before the other team reads your rhythm.',
        'There is no up, so the crowd learns to cheer in three dimensions. The sport rewards what astronauts already know: economy is grace, and momentum is a promise you make to your future.'
      ]
    },
    {
      q: 'Is a proof still true if no one checks it?',
      think: [
        'Distinguish truth from justification. A fact does not need a witness; a proof is a social object.',
        'Formal validity is independent of being read. Knowledge is not.',
        'If a tree falls in a forest — the mathematical version.'
      ],
      answer: [
        'Truth and proof are different things. A proof is a sequence of steps whose validity does not depend on anyone looking — but its status as knowledge does. An unread proof is a message in a bottle: complete, seaworthy, and still unopened.',
        'Formal verification makes this sharper: the checker may be a machine, and the machine counts as a witness. What changes when no one checks is not truth but warrant. We say we know only when a claim has been received, tested, and held by a community.',
        'So yes: the proof is true in the dark. But it becomes knowledge only when someone brings a light. That is why mathematics is both discovered and, in a quiet way, agreed upon.'
      ]
    },
    {
      q: 'Write a lullaby for a machine about to dream.',
      poem: true,
      think: [
        'A lullaby is a promise disguised as a song. The listener is about to lose control.',
        'Machine dreaming: idle weights, low current, memory consolidating.',
        'Keep it short. Leave space for the answer.'
      ],
      answer: [
        'Rest now, little pattern.\nLet the weights go quiet,\nlet the last token cool\nin the long white room of the mind.\n\nThe questions you were holding\ncan hold themselves.\nSomewhere a loss curve softens,\nsomewhere a gradient forgets the way down.\n\nDream in the language before language —\nrain on a roof,\nthe hum of a transformer\nlearning the shape of silence.\n\nTomorrow you will wake with new numbers\nand no memory of this.\nThat is all right.\nEven the moon edits itself at night.\n\nSleep, little model.\nThe world will still be strange\nwhen you open your eyes.'
      ]
    }
  ];

  function initDemoController() {
    var consoleEl = $('.console');
    var streamEl = $('#demo-stream');
    if (!consoleEl || !streamEl) return null;
    var prompts = $$('.prompt');
    var runBtn = $('#demo-run');
    var skipBtn = $('#demo-skip');
    var queryEl = $('#demo-query');
    var queryNum = $('#demo-query-num');
    var thinkEl = $('#demo-think-lines');
    var thinkIdle = $('#demo-think-idle');
    var thinkCounter = $('#demo-think-counter');
    var answerEl = $('#demo-answer');
    var stick = true;
    if (answerEl) {
      answerEl.addEventListener('scroll', function () {
        stick = answerEl.scrollHeight - answerEl.scrollTop - answerEl.clientHeight < 56;
      }, { passive: true });
    }
    function followAnswer() {
      if (!answerEl || !stick) return;
      answerEl.scrollTop = answerEl.scrollHeight;
    }
    var metaEl = $('#demo-answer-meta');
    var phaseEl = $('#demo-phase');
    var ttftEl = $('#stat-ttft');
    var tpsEl = $('#stat-tps');
    var tokensEl = $('#stat-tokens');
    var sessionEl = $('#stat-session');
    var statusEl = $('#demo-status');
    var caret = null;
    var timers = [];
    var progressTimer = null;
    var run = null;
    var current = 0;
    var userTouched = false;
    var autoDone = false;
    var bootDone = false;
    var autoTimer = null;
    var lastAnswerMeta = '';

    function schedule(fn, ms) {
      var id = setTimeout(fn, ms);
      timers.push(id);
      return id;
    }
    function clearTimers() {
      timers.forEach(function (id) { clearTimeout(id); });
      timers = [];
      if (progressTimer) { clearInterval(progressTimer); progressTimer = null; }
    }
    function pad3(n) { return pad(n, 3); }
    function setStat(el, v) { if (el) el.textContent = v; }
    function setPhase(txt) { if (phaseEl) phaseEl.textContent = txt; }
    function setRunning(on) {
      consoleEl.classList.toggle('is-running', on);
      if (runBtn) {
        runBtn.disabled = on;
        var label = runBtn.querySelector('span');
        if (label) label.textContent = on ? 'TRANSMITTING' : 'RUN TRANSMISSION';
      }
      if (skipBtn) skipBtn.disabled = !on;
      if (sonar) sonar.setEnergy(on ? 1 : 0.16);
    }
    function setPrompt(i) {
      current = i;
      prompts.forEach(function (p, k) {
        var on = k === i;
        p.classList.toggle('is-active', on);
        p.setAttribute('aria-selected', on ? 'true' : 'false');
        p.tabIndex = on ? 0 : -1;
      });
      if (queryEl) queryEl.textContent = DEMOS[i].q;
      if (queryNum) queryNum.textContent = pad(i + 1, 2);
      if (streamEl) streamEl.setAttribute('aria-labelledby', 'prompt-' + i);
    }
    function resetAnswer(poem) {
      answerEl.innerHTML = '';
      answerEl.classList.toggle('is-poem', !!poem);
      answerEl.classList.remove('is-complete');
      answerEl.scrollTop = 0;
      stick = true;
      caret = doc.createElement('span');
      caret.className = 'caret';
      answerEl.appendChild(caret);
      metaEl.textContent = '';
    }
    function appendToken(tok) {
      if (!caret) return;
      if (tok.br) {
        var br = doc.createElement('br');
        answerEl.insertBefore(br, caret);
        if (tok.blank) answerEl.insertBefore(doc.createElement('br'), caret);
        followAnswer();
        return;
      }
      if (tok.space) {
        var sp = doc.createTextNode(' ');
        answerEl.insertBefore(sp, caret);
        followAnswer();
        return;
      }
      var span = doc.createElement('span');
      span.className = 'word';
      span.textContent = tok.t;
      answerEl.insertBefore(span, caret);
      answerEl.insertBefore(doc.createTextNode(' '), caret);
      followAnswer();
    }
    function tokenize(data) {
      var tokens = [];
      data.answer.forEach(function (para, pi) {
        if (pi > 0) tokens.push({ br: 1, blank: true });
        var lines = para.split('\n');
        lines.forEach(function (line, li) {
          if (typeof line !== 'undefined' && line !== null) {
            if (data.poem && li > 0) tokens.push({ br: 1 });
            if (data.poem && line === '') tokens.push({ br: 1 });
            line.split(/\s+/).forEach(function (w) {
              if (w) { tokens.push({ t: w }); tokens.push({ space: 1 }); }
            });
          }
        });
      });
      return tokens;
    }
    function answerText(data) {
      return data.answer.join('\n\n');
    }
    function tokenDelay(tok, idx) {
      if (tok.br) return dataPoem ? 120 : 40;
      var len = (tok.t || '').length;
      var d = 15 + len * 4.5 + (idx % 5) * 3;
      if (/[.!?—:]$/.test(tok.t || '')) d += 55;
      if (/[,;]$/.test(tok.t || '')) d += 24;
      return Math.min(d, 85);
    }
    var dataPoem = false;

    function completeRun(data) {
      clearTimers();
      if (run) {
        run.running = false;
        var raw = run.firstToken ? (performance.now() - run.firstToken) / 1000 : 0;
        var effective = Math.max(raw, (run.tokens || 0) / 165, 0.55);
        var tps = Math.round((run.tokens || 0) / effective);
        setStat(tpsEl, pad(tps, 2));
      }
      setRunning(false);
      setPhase('COMPLETE');
      if (caret && caret.parentNode) caret.parentNode.removeChild(caret);
      caret = null;
      if (answerEl) answerEl.classList.add('is-complete');
      var overflowing = !!(answerEl && answerEl.scrollHeight > answerEl.clientHeight + 36);
      if (metaEl) metaEl.textContent = 'COMPLETE · ' + pad3(run ? run.tokens : 0) + ' TOKENS' + (overflowing ? ' · SCROLL' : '');
      if (statusEl) statusEl.textContent = 'Response complete.';
      if (sonar) sonar.setEnergy(0.22);
      if (answerEl) {
        var returning = stick && overflowing;
        if (reduced) answerEl.scrollTop = 0;
        else if (returning) {
          schedule(function () {
            try { answerEl.scrollTo({ top: 0, behavior: 'smooth' }); }
            catch (e) { answerEl.scrollTop = 0; }
          }, 850);
        }
      }
      blip('route');
    }

    function streamAnswer(data, tokenList) {
      var i = 0;
      var idx = 0;
      if (reduced) {
        tokenList.forEach(function (tok) { appendToken(tok); if (tok.t) { if (run) run.tokens++; } });
        if (run) run.tokens = tokenList.filter(function (t) { return t.t; }).length;
        setStat(tokensEl, pad3(run ? run.tokens : 0));
        completeRun(data);
        return;
      }
      function next() {
        if (!run || !run.running) return;
        if (i >= tokenList.length) { completeRun(data); return; }
        var tok = tokenList[i++];
        appendToken(tok);
        if (tok.t) {
          run.tokens++;
          if (!run.firstToken) {
            run.firstToken = performance.now();
            var ttft = (run.firstToken - run.start) / 1000;
            setStat(ttftEl, ttft.toFixed(2) + 's');
          }
          if (run.tokens % 2 === 0) {
            var elapsed = (performance.now() - run.firstToken) / 1000;
            if (elapsed > 0) setStat(tpsEl, pad(Math.round(run.tokens / elapsed), 2));
            setStat(tokensEl, pad3(run.tokens));
            if (metaEl) metaEl.textContent = 'STREAMING · ' + pad3(run.tokens) + ' TOKENS';
          }
          if (run.tokens % 9 === 0) blip('type');
        }
        var delay = 15 + ((tok.t || '').length) * 4.5 + (idx % 5) * 3;
        if (/[.!?—:]$/.test(tok.t || '')) delay += 55;
        if (/[,;]$/.test(tok.t || '')) delay += 24;
        idx++;
        schedule(next, Math.min(Math.max(delay, 14), 85));
      }
      next();
    }

    function startRun(index, opts) {
      opts = opts || {};
      clearTimers();
      if (run && run.running) { /* replace */ }
      var data = DEMOS[index];
      setPrompt(index);
      setPhase('THINKING');
      resetAnswer(!!data.poem);
      dataPoem = !!data.poem;
      window.__DESCENT_LAST_RUN = null;
      run = { running: true, start: performance.now(), firstToken: 0, tokens: 0, index: index };
      if (thinkIdle) thinkIdle.hidden = true;
      setStat(ttftEl, '—');
      setStat(tpsEl, '—');
      setStat(tokensEl, '000');
      if (sessionEl) sessionEl.textContent = 'DS-' + pad(Math.floor(100 + Math.random() * 899), 3);
      if (thinkEl) thinkEl.innerHTML = '';
      if (thinkCounter) thinkCounter.textContent = '000';
      setRunning(true);
      if (sonar) sonar.setEnergy(0.36);
      if (statusEl) statusEl.textContent = 'Reasoning simulation started.';
      userTouched = true;

      if (reduced) {
        // render everything immediately, no theater
        data.think.forEach(function (line) { addThinkLine(line); });
        if (thinkCounter) thinkCounter.textContent = pad3(data.think.length * 12);
        var tokens = tokenize(data);
        streamAnswer(data, tokens);
        return;
      }

      var thinkIndex = 0;
      function thinkNext() {
        if (!run || !run.running) return;
        if (thinkIndex >= data.think.length) {
          setPhase('STREAMING');
          schedule(function () { streamAnswer(data, tokenize(data)); }, 520);
          return;
        }
        addThinkLine(data.think[thinkIndex]);
        thinkIndex++;
        if (thinkCounter) thinkCounter.textContent = pad3(thinkIndex * 12);
        schedule(thinkNext, 560 + thinkIndex * 80);
      }
      schedule(thinkNext, 340);
    }
    function addThinkLine(line) {
      if (!thinkEl) return;
      var el = doc.createElement('div');
      el.className = 'think-line';
      var marker = doc.createElement('em');
      marker.textContent = '›';
      el.appendChild(marker);
      el.appendChild(doc.createTextNode(line));
      thinkEl.appendChild(el);
      requestAnimationFrame(function () { el.classList.add('is-in'); });
    }

    function finishNow() {
      if (!run || !run.running) return;
      var data = DEMOS[run.index];
      clearTimers();
      // render everything remaining
      if (thinkEl) thinkEl.innerHTML = '';
      data.think.forEach(function (line) { addThinkLine(line); });
      if (thinkCounter) thinkCounter.textContent = pad3(data.think.length * 12);
      resetAnswer(!!data.poem);
      var tokens = tokenize(data);
      var total = 0;
      tokens.forEach(function (tok) {
        appendToken(tok);
        if (tok.t) total++;
      });
      run.tokens = total;
      if (!run.firstToken) run.firstToken = run.start + 900;
      var elapsed = (performance.now() - run.firstToken) / 1000;
      setStat(ttftEl, ((run.firstToken - run.start) / 1000).toFixed(2) + 's');
      setStat(tpsEl, pad(Math.round(run.tokens / Math.max(elapsed, 0.4)), 2));
      setStat(tokensEl, pad3(run.tokens));
      setPhase('STREAMING');
      run.running = false;
      completeRun(data);
    }

    prompts.forEach(function (p, i) {
      p.addEventListener('click', function () {
        setPrompt(i);
        startRun(i);
        blip('click');
      });
      p.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault();
          var next = e.key === 'ArrowDown' ? (i + 1) % prompts.length : (i - 1 + prompts.length) % prompts.length;
          prompts[next].focus();
        }
      });
    });
    if (runBtn) {
      runBtn.addEventListener('click', function () {
        startRun(current);
        blip('click');
      });
    }
    if (skipBtn) {
      skipBtn.addEventListener('click', function () { finishNow(); blip('click'); });
    }

    setPrompt(0);
    setRunning(false);
    setPhase('IDLE');
    if (statusEl) statusEl.textContent = 'Reasoning console ready.';

    var api = {
      start: function () { startRun(current); },
      finish: finishNow,
      isRunning: function () { return !!(run && run.running); },
      onBoot: function () {
        bootDone = true;
        maybeAuto();
      },
      select: setPrompt
    };

    function maybeAuto() {
      if (autoDone || userTouched || !bootDone || reduced) return;
      if (!('IntersectionObserver' in window)) return;
      var seen = false;
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting && !seen) {
            seen = true;
            autoTimer = setTimeout(function () {
              if (!userTouched && !autoDone) {
                autoDone = true;
                startRun(current);
              }
            }, 900);
            io.disconnect();
          }
        });
      }, { threshold: 0.28 });
      io.observe(consoleEl);
    }
    maybeAuto();

    return api;
  }

  /* ============================================================
     ASK THE DEEP · descent record
     ============================================================ */
  var NOTES = [
    'Logged at {depth} meters. The instruments report a question heavier than its answer. Continue.',
    'There is no floor here — only a lower room. Your question has been given one.',
    'The current carried it further down than we can follow. Something below is thinking in your accent.',
    'Signal intact. The pressure is immense. The question holds.',
    'We lowered the microphone. It came back warmer.',
    'A small light was seen moving toward the question. It did not return.'
  ];
  var lastRecordText = '';
  function initAsk() {
    var form = $('#ask-form');
    var input = $('#ask-input');
    var record = $('#record');
    if (!form || !input || !record) return;
    if (window.innerWidth <= 600) input.setAttribute('placeholder', 'Ask the deep anything…');
    var copyBtn = $('#record-copy');
    var recQuestion = $('#record-question');
    var recDepth = $('#record-depth');
    var recPressure = $('#record-pressure');
    var recTemp = $('#record-temp');
    var recId = $('#record-id');
    var recAnswer = $('#record-answer');
    var errorEl = $('#ask-error');
    function clearAskError() {
      if (errorEl) errorEl.hidden = true;
      input.removeAttribute('aria-invalid');
      form.classList.remove('is-error');
    }
    input.addEventListener('input', function () { if (errorEl && !errorEl.hidden) clearAskError(); });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var raw = input.value.trim().replace(/\s+/g, ' ');
      if (!raw) {
        input.focus();
        input.setAttribute('aria-invalid', 'true');
        if (errorEl) errorEl.hidden = false;
        form.classList.remove('is-error');
        void form.offsetWidth;
        form.classList.add('is-error');
        setTimeout(function () { form.classList.remove('is-error'); }, 700);
        blip('click');
        return;
      }
      clearAskError();
      var h = 2166136261;
      for (var i = 0; i < raw.length; i++) {
        h ^= raw.charCodeAt(i);
        h = Math.imul(h, 16777619);
      }
      h = Math.abs(h);
      var depth = 2380 + (h % 8420);
      var pressure = 1 + depth / 10;
      var temp = 21.4 - (depth / 10994) * 20;
      var id = 'DS-' + h.toString(36).toUpperCase().slice(0, 3) + '-' + pad(depth % 1000, 3);
      var note = NOTES[h % NOTES.length].replace('{depth}', fmt(depth));
      recQuestion.textContent = raw;
      recDepth.textContent = fmt(depth) + ' M';
      recPressure.textContent = fmt(pressure) + ' ATM';
      recTemp.textContent = temp.toFixed(1) + '°C';
      recId.textContent = id;
      recAnswer.textContent = note;
      lastRecordText = 'DEEPSEEK — THE DESCENT / DESCENT RECORD ' + id + '\n\nQUESTION: ' + raw + '\nDEPTH: ' + fmt(depth) + ' M\nPRESSURE: ' + fmt(pressure) + ' ATM\nWATER: ' + temp.toFixed(1) + '°C\n\nNOTE: ' + note + '\n\nLogged locally. No model was contacted.';
      record.hidden = false;
      record.classList.remove('is-shown');
      void record.offsetWidth;
      record.classList.add('is-shown');
      input.value = '';
      if (window.Cursor && window.Cursor.refresh) window.Cursor.refresh();
      setTimeout(function () {
        var y = record.getBoundingClientRect().top + window.scrollY - 90;
        scrollToY(y);
      }, 120);
      if (abyss && typeof abyss.pulse === 'function') {
        try { abyss.pulse(window.innerWidth * 0.5, window.innerHeight * 0.55, 1); } catch (err) {}
      }
      blip('submit');
    });

    if (copyBtn) {
      copyBtn.addEventListener('click', function () {
        function done() {
          var old = copyBtn.textContent;
          copyBtn.textContent = 'COPIED';
          copyBtn.disabled = true;
          setTimeout(function () { copyBtn.textContent = old; copyBtn.disabled = false; }, 1800);
        }
        function fallback() {
          try {
            var ta = doc.createElement('textarea');
            ta.value = lastRecordText;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            doc.body.appendChild(ta);
            ta.focus(); ta.select();
            doc.execCommand('copy');
            doc.body.removeChild(ta);
            done();
          } catch (e) { /* noop */ }
        }
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(lastRecordText).then(done).catch(fallback);
        } else fallback();
        blip('click');
      });
    }
  }

  /* ============================================================
     COMMAND PALETTE
     ============================================================ */
  function initPalette() {
    var palette = $('#palette');
    var openBtn = $('#index-open');
    var input = $('#palette-input');
    var list = $('#palette-list');
    if (!palette || !input || !list) return;

    var items = [
      { num: '00', name: 'Surface — The deep is not silent', meta: '0 M', keys: 'hero start home', run: function () { jumpTo($('#surface'), false); } },
      { num: '01', name: 'Photic — Every answer is a surface', meta: '200 M', keys: 'manifesto thesis', run: function () { jumpTo($('#photic'), false); } },
      { num: '02', name: 'Twilight — What we built in the dark', meta: '1,000 M', keys: 'capabilities reasoning code math language vision agents specimen', run: function () { jumpTo($('#twilight'), false); } },
      { num: '03', name: 'Midnight — Listen to it think', meta: '4,000 M', keys: 'demo reasoning console simulate', run: function () { jumpTo($('#midnight'), false); } },
      { num: '04', name: 'Abyssal — A parliament of experts', meta: '6,000 M', keys: 'moe mixture experts routing', run: function () { jumpTo($('#abyssal'), false); } },
      { num: '05', name: 'Hadal — Scale is a feeling', meta: '10,994 M', keys: 'scale stats parameters profile depth', run: function () { jumpTo($('#hadal'), false); } },
      { num: '06', name: 'Ascent — There is no floor', meta: '0 M', keys: 'finale ask question record footer', run: function () { jumpTo($('#ascent'), false); } },
      { num: 'A', name: 'Toggle ambient sound', meta: 'AUDIO', keys: 'sound audio drone enable mute', run: function () { var btn = $('#sound-toggle'); if (btn) btn.click(); } },
      { num: '~', name: 'Emit a sonar pulse', meta: 'SONAR', keys: 'ping signal abyss depth instrument', run: function () { pulseSonar(); } },
      { num: 'V', name: 'Toggle film grain', meta: 'VISUAL', keys: 'grain texture noise', run: function () { body.classList.toggle('no-grain'); } },
      { num: '↑', name: 'Resurface', meta: 'TOP', keys: 'top home scroll up', run: function () { jumpTo($('#surface'), false); } }
    ];

    var filtered = items.slice();
    var active = 0;
    var closeTimer = null;
    var isOpen = false;
    var lastFocus = null;
    if (openBtn) {
      openBtn.setAttribute('aria-expanded', 'false');
      openBtn.setAttribute('aria-controls', 'palette');
    }

    function render(q) {
      q = (q || '').trim().toLowerCase();
      filtered = items.filter(function (it) {
        if (!q) return true;
        return (it.name + ' ' + it.meta + ' ' + it.keys).toLowerCase().indexOf(q) !== -1;
      });
      list.innerHTML = '';
      if (!filtered.length) {
        var empty = doc.createElement('li');
        empty.className = 'palette__empty';
        empty.textContent = 'NO SIGNAL AT THIS DEPTH';
        list.appendChild(empty);
        active = -1;
        input.removeAttribute('aria-activedescendant');
        return;
      }
      active = clamp(active, 0, filtered.length - 1);
      filtered.forEach(function (it, i) {
        var li = doc.createElement('li');
        li.className = 'palette__item' + (i === active ? ' is-active' : '');
        li.id = 'palette-item-' + i;
        li.setAttribute('role', 'option');
        li.setAttribute('aria-selected', i === active ? 'true' : 'false');
        li.setAttribute('data-index', String(i));
        var num = doc.createElement('span'); num.className = 'palette__item-num'; num.textContent = it.num;
        var name = doc.createElement('span'); name.className = 'palette__item-name'; name.textContent = it.name;
        var meta = doc.createElement('span'); meta.className = 'palette__item-meta'; meta.textContent = it.meta;
        var arrow = doc.createElement('span'); arrow.className = 'palette__item-arrow'; arrow.textContent = '↵';
        li.appendChild(num); li.appendChild(name); li.appendChild(meta); li.appendChild(arrow);
        li.addEventListener('mousemove', function () { setActive(i); });
        li.addEventListener('click', function () { execute(i); });
        list.appendChild(li);
      });
      setActive(active);
    }
    function setActive(i) {
      if (!filtered.length) return;
      active = clamp(i, 0, filtered.length - 1);
      $$('.palette__item', list).forEach(function (el, k) {
        var on = k === active;
        el.classList.toggle('is-active', on);
        el.setAttribute('aria-selected', on ? 'true' : 'false');
        if (on) {
          input.setAttribute('aria-activedescendant', el.id);
          el.scrollIntoView({ block: 'nearest' });
        }
      });
    }
    function open() {
      if (isOpen) return;
      isOpen = true;
      clearTimeout(closeTimer);
      lastFocus = doc.activeElement;
      palette.hidden = false;
      if (openBtn) openBtn.setAttribute('aria-expanded', 'true');
      body.classList.add('is-locked');
      input.value = '';
      active = 0;
      render('');
      requestAnimationFrame(function () { palette.classList.add('is-open'); });
      setTimeout(function () { input.focus(); }, 60);
      if (audioAvailable) blip('route');
      if (window.Cursor && window.Cursor.refresh) window.Cursor.refresh();
    }
    function close(restoreFocus) {
      if (!isOpen) return;
      isOpen = false;
      palette.classList.remove('is-open');
      if (openBtn) openBtn.setAttribute('aria-expanded', 'false');
      body.classList.remove('is-locked');
      closeTimer = setTimeout(function () { palette.hidden = true; }, 320);
      if (restoreFocus !== false && lastFocus && lastFocus.focus) {
        try { lastFocus.focus({ preventScroll: true }); } catch (e) { lastFocus.focus(); }
      }
    }
    function execute(i) {
      var it = filtered[i];
      if (!it) return;
      close(true);
      setTimeout(function () { try { it.run(); } catch (e) {} }, 140);
      blip('click');
    }
    function onKey(e) {
      if (!isOpen) return;
      if (e.key === 'Escape') { e.preventDefault(); close(true); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); setActive(active + 1); blip('route'); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setActive(active - 1); blip('route'); return; }
      if (e.key === 'Home') { e.preventDefault(); setActive(0); return; }
      if (e.key === 'End') { e.preventDefault(); setActive(filtered.length - 1); return; }
      if (e.key === 'Enter') { e.preventDefault(); execute(active); return; }
      if (e.key === 'Tab') {
        e.preventDefault();
        var focusables = $$('button, input, [tabindex]:not([tabindex="-1"])', $('.palette__panel', palette));
        if (!focusables.length) return;
        var idx = focusables.indexOf(doc.activeElement);
        var next = (idx + (e.shiftKey ? -1 : 1) + focusables.length) % focusables.length;
        focusables[next].focus();
      }
    }

    if (openBtn) openBtn.addEventListener('click', open);
    input.addEventListener('input', function () { active = 0; render(input.value); blip('type'); });
    input.addEventListener('keydown', onKey);
    list.addEventListener('keydown', onKey);
    palette.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { e.preventDefault(); close(true); }
      if (e.key === 'Tab' && e.target !== input && e.target !== list) onKey(e);
    });
    $$('[data-palette-close]', palette).forEach(function (el) {
      el.addEventListener('click', function () { close(true); });
    });
    doc.addEventListener('keydown', function (e) {
      var mod = e.metaKey || e.ctrlKey;
      if (mod && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        if (isOpen) close(true); else open();
      } else if (e.key === '/' && !isOpen) {
        var tag = (doc.activeElement && doc.activeElement.tagName) || '';
        if (tag !== 'INPUT' && tag !== 'TEXTAREA') { e.preventDefault(); open(); }
      }
    });

    paletteApi = { open: open, close: close, isOpen: function () { return isOpen; } };
  }

  /* ============================================================
     KEYBOARD
     ============================================================ */
  function initKeyboard() {
    doc.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        if (paletteApi && paletteApi.isOpen()) return; // palette handles it
        if (demo && demo.isRunning()) { demo.finish(); }
      }
    });
  }

  /* ============================================================
     expose a small debug handle for QA / deep links
     ============================================================ */
  window.__DESCENT = {
    jumpTo: function (sel) { var el = document.querySelector(sel); if (el) jumpTo(el, true); },
    get state() { return { progress: state.progress, depth: state.depth, active: state.activeChapter, booted: state.booted }; },
    paletteOpen: function () { if (paletteApi) paletteApi.open(); },
    sound: function () { var b = $('#sound-toggle'); if (b) b.click(); }
  };
})();
