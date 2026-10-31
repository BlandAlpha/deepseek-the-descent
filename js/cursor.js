/* ============================================================================
   CURSOR — signature dot + lerped ring
   DEEPSEEK / THE DESCENT  ·  atmosphere-lab
   ----------------------------------------------------------------------------
   Contract implemented (index.html + css/main.css own markup & styling):
     • reuses the existing .cursor / .cursor__ring / .cursor__label / .cursor__dot
       (creates that exact structure only if it is missing)
     • html.has-cursor is added once, only on fine pointer + hover devices
     • root classes: is-visible (first pointer movement, removed on leave),
       is-hover, is-down, is-hidden
     • [data-cursor="LABEL"] writes the label text; CSS reveals it on .is-hover
     • [data-magnetic] elements get a subtle spring (translate3d, max 10px)
     • window.Cursor = { refresh() } for dynamically added DOM
   No inline opacity / size / colour / z-index / will-change. Motion only.
   ============================================================================ */
(function () {
  'use strict';

  if (window.Cursor) { return; }

  var FINE_QUERY = '(hover: hover) and (pointer: fine)';
  var REDUCED_QUERY = '(prefers-reduced-motion: reduce)';
  var HOVER_SELECTOR = 'a[href], button, [role="button"], [role="link"], [role="tab"], [role="option"], [role="menuitem"], summary, [data-cursor], [data-magnetic], [data-nav], [tabindex]:not([tabindex="-1"])';
  var MAGNET_MAX = 10;
  var MAGNET_PAD = 56;
  var FOLLOW = 14;
  var supportsPointer = typeof window.PointerEvent === 'function';

  var mqFine = window.matchMedia ? window.matchMedia(FINE_QUERY) : null;
  var mqReduce = window.matchMedia ? window.matchMedia(REDUCED_QUERY) : null;

  var s = {
    active: false,
    root: null,
    ring: null,
    dot: null,
    labelEl: null,
    createdRoot: false,
    reduced: false,
    hidden: true,
    pointerSeen: false,
    hasShown: false,
    x: -120,
    y: -120,
    rx: -120,
    ry: -120,
    hoverEl: null,
    hover: false,
    labelText: '',
    down: false,
    raf: 0,
    lastFrame: 0,
    magnets: [],
    observer: null,
    refreshTimer: 0,
    hitFrame: 0,
    listeners: [],
    mediaBound: false
  };

  /* ---------------------------------------------------------------- utils -- */

  function fmt(v) { return Math.round(v * 100) / 100; }

  function on(target, type, fn, opts) {
    try {
      target.addEventListener(type, fn, opts || false);
      s.listeners.push([target, type, fn, opts || false]);
    } catch (e) { /* ignore */ }
  }

  function offAll() {
    for (var i = 0; i < s.listeners.length; i++) {
      var L = s.listeners[i];
      try { L[0].removeEventListener(L[1], L[2], L[3]); } catch (e) { /* ignore */ }
    }
    s.listeners = [];
  }

  function moveTransform(x, y) {
    return 'translate3d(' + fmt(x) + 'px,' + fmt(y) + 'px,0)';
  }

  /* ------------------------------------------------------------------ DOM -- */

  function makeEl(tag, cls) {
    var el = document.createElement(tag);
    if (cls) { el.className = cls; }
    return el;
  }

  function acquireDom() {
    var root = document.querySelector('.cursor');
    if (!root) {
      root = makeEl('div', 'cursor');
      root.setAttribute('aria-hidden', 'true');
      root.appendChild(makeEl('div', 'cursor__ring')).appendChild(makeEl('span', 'cursor__label'));
      root.appendChild(makeEl('div', 'cursor__dot'));
      (document.body || document.documentElement).appendChild(root);
      s.createdRoot = true;
    }

    var ring = root.querySelector('.cursor__ring');
    if (!ring) {
      ring = makeEl('div', 'cursor__ring');
      root.appendChild(ring);
      s.createdRoot = true;
    }
    var label = ring.querySelector('.cursor__label');
    if (!label) {
      label = makeEl('span', 'cursor__label');
      ring.appendChild(label);
      s.createdRoot = true;
    }
    var dot = root.querySelector('.cursor__dot');
    if (!dot) {
      dot = makeEl('div', 'cursor__dot');
      root.appendChild(dot);
      s.createdRoot = true;
    }

    s.root = root;
    s.ring = ring;
    s.labelEl = label;
    s.dot = dot;
  }

  /* ---------------------------------------------------------------- state -- */

  function show() {
    if (!s.active) { return; }
    if (s.hidden) {
      s.hidden = false;
      s.hasShown = true;
      if (s.root) {
        s.root.classList.remove('is-hidden');
        s.root.classList.add('is-visible');
      }
    }
    ensureLoop();
  }

  function hide(instant) {
    if (!s.hidden) {
      s.hidden = true;
      s.down = false;
      s.hover = false;
      s.hoverEl = null;
      s.labelText = '';
      if (s.root) {
        s.root.classList.remove('is-visible');
        s.root.classList.remove('is-hover');
        s.root.classList.remove('is-down');
        s.root.classList.add('is-hidden');
      }
      if (s.labelEl) { s.labelEl.textContent = ''; }
    }
    if (instant) {
      resetMagnets(true);
      cancelLoop();
    } else {
      ensureLoop();
    }
  }

  function setDot() {
    if (s.dot) { s.dot.style.transform = moveTransform(s.x, s.y); }
  }

  function setRing() {
    if (s.ring) { s.ring.style.transform = moveTransform(s.rx, s.ry); }
  }

  function updateHover(target) {
    if (!s.active) { return; }
    if (!target || target.nodeType !== 1 || target === document || target === window) {
      try { target = document.elementFromPoint(s.x, s.y); } catch (e) { target = null; }
    }
    var hoverEl = null;
    var label = '';
    if (target && target.closest) {
      if (s.root && s.root.contains(target)) {
        hoverEl = null;
      } else {
        try {
          hoverEl = target.closest(HOVER_SELECTOR);
          var labelEl = target.closest('[data-cursor]');
          if (labelEl) {
            var raw = labelEl.getAttribute('data-cursor');
            if (raw) {
              label = String(raw).replace(/\s+/g, ' ').trim();
              if (label.length > 24) { label = label.slice(0, 24).replace(/\s+$/, ''); }
            }
          }
        } catch (e) { hoverEl = null; label = ''; }
      }
    }

    var hover = !!hoverEl;
    if (hover === s.hover && hoverEl === s.hoverEl && label === s.labelText) { return; }
    s.hover = hover;
    s.hoverEl = hoverEl;
    s.labelText = label;
    if (s.root) { s.root.classList.toggle('is-hover', hover); }
    if (s.labelEl && s.labelEl.textContent !== label) {
      s.labelEl.textContent = label;
    }
  }

  /* -------------------------------------------------------------- magnet --- */

  function clearMagnet(item) {
    if (!item) { return; }
    if (item.applied && item.el) {
      try { item.el.style.transform = item.base || ''; } catch (e) { /* ignore */ }
    }
    item.applied = false;
    item.x = 0;
    item.y = 0;
    item.vx = 0;
    item.vy = 0;
  }

  function resetMagnets(instant) {
    for (var i = 0; i < s.magnets.length; i++) {
      clearMagnet(s.magnets[i]);
    }
    if (instant) { s.magnets = []; }
  }

  function refreshMagnets() {
    if (!s.active) { return; }
    if (s.reduced) {
      resetMagnets(true);
      return;
    }
    var nodes;
    try { nodes = document.querySelectorAll('[data-magnetic]'); } catch (e) { return; }
    var prev = s.magnets;
    var next = [];
    var i, j;
    for (i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (!el || (el.getClientRects && el.getClientRects().length === 0)) { continue; }
      var found = null;
      for (j = 0; j < prev.length; j++) {
        if (prev[j].el === el) { found = prev[j]; break; }
      }
      next.push(found || {
        el: el,
        base: el.style.transform || '',
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        applied: false
      });
    }
    for (i = 0; i < prev.length; i++) {
      var kept = false;
      for (j = 0; j < next.length; j++) { if (next[j] === prev[i]) { kept = true; break; } }
      if (!kept) { clearMagnet(prev[i]); }
    }
    s.magnets = next;
  }

  function updateMagnets(dt) {
    if (!s.active || s.reduced || !s.magnets.length) { return false; }
    var busy = false;
    var hidden = s.hidden;
    var px = s.x;
    var py = s.y;

    for (var i = 0; i < s.magnets.length; i++) {
      var item = s.magnets[i];
      var el = item.el;
      if (!el || !el.isConnected) { clearMagnet(item); continue; }

      var tx = 0;
      var ty = 0;
      if (!hidden) {
        var rect = el.getBoundingClientRect();
        if (rect.width > 0 || rect.height > 0) {
          /* proximity to the element's box (not its centre) so wide pills
             attract consistently from every side */
          var qx = Math.max(rect.left, Math.min(px, rect.right));
          var qy = Math.max(rect.top, Math.min(py, rect.bottom));
          var ox = px - qx;
          var oy = py - qy;
          var outside = Math.sqrt(ox * ox + oy * oy);
          if (outside < MAGNET_PAD) {
            var prox = 1 - outside / MAGNET_PAD;
            prox = prox * prox * (3 - 2 * prox);
            var cx = rect.left + rect.width * 0.5 - item.x;
            var cy = rect.top + rect.height * 0.5 - item.y;
            var vx = px - cx;
            var vy = py - cy;
            var len = Math.sqrt(vx * vx + vy * vy);
            if (len > 0.5) {
              var pull = MAGNET_MAX * prox;
              tx = vx / len * pull;
              ty = vy / len * pull;
            }
          }
        }
      }

      /* spring: stiff, gently overdamped, frame-rate independent */
      var k = 190;
      var c = 2 * 0.92 * Math.sqrt(k);
      item.vx += ((tx - item.x) * k - item.vx * c) * dt;
      item.vy += ((ty - item.y) * k - item.vy * c) * dt;
      item.x += item.vx * dt;
      item.y += item.vy * dt;

      var settled = Math.abs(tx - item.x) < 0.01 && Math.abs(ty - item.y) < 0.01 &&
        Math.abs(item.vx) < 0.01 && Math.abs(item.vy) < 0.01;

      if (settled) {
        item.x = tx;
        item.y = ty;
        item.vx = 0;
        item.vy = 0;
        if (tx === 0 && ty === 0) {
          if (item.applied) {
            try { el.style.transform = item.base || ''; } catch (e) { /* ignore */ }
            item.applied = false;
          }
        } else {
          try {
            el.style.transform = (item.base ? item.base + ' ' : '') + moveTransform(tx, ty);
            item.applied = true;
          } catch (e) { /* ignore */ }
        }
      } else {
        try {
          el.style.transform = (item.base ? item.base + ' ' : '') + moveTransform(item.x, item.y);
          item.applied = true;
        } catch (e) { /* ignore */ }
        busy = true;
      }
    }
    return busy;
  }

  /* --------------------------------------------------------------- motion --- */

  function ensureLoop() {
    if (!s.active || s.raf) { return; }
    if (document.visibilityState === 'hidden') { return; }
    s.lastFrame = (window.performance && performance.now) ? performance.now() : Date.now();
    s.raf = window.requestAnimationFrame(frame);
  }

  function cancelLoop() {
    if (s.raf) {
      try { window.cancelAnimationFrame(s.raf); } catch (e) { /* ignore */ }
      s.raf = 0;
    }
  }

  function frame(ts) {
    s.raf = 0;
    if (!s.active) { return; }
    if (document.visibilityState === 'hidden') { return; }

    var dt = (ts - s.lastFrame) / 1000;
    if (!isFinite(dt) || dt <= 0) { dt = 0.016; }
    if (dt > 0.04) { dt = 0.04; }
    s.lastFrame = ts;

    var k = s.reduced ? 1 : 1 - Math.exp(-dt * FOLLOW);
    s.rx += (s.x - s.rx) * k;
    s.ry += (s.y - s.ry) * k;
    setRing();

    var busy = updateMagnets(dt);
    var moving = Math.abs(s.x - s.rx) > 0.05 || Math.abs(s.y - s.ry) > 0.05;

    if (!s.hidden && (moving || busy)) {
      s.raf = window.requestAnimationFrame(frame);
    } else if (s.hidden && busy) {
      s.raf = window.requestAnimationFrame(frame);
    }
  }

  /* ------------------------------------------------------------- listeners -- */

  function bindEvents() {
    var moveType = supportsPointer ? 'pointermove' : 'mousemove';
    var downType = supportsPointer ? 'pointerdown' : 'mousedown';
    var upType = supportsPointer ? 'pointerup' : 'mouseup';
    var cancelType = supportsPointer ? 'pointercancel' : 'mouseup';

    on(window, moveType, onMove, { passive: true });
    on(window, downType, onDown, { passive: true });
    on(window, upType, onUp, { passive: true });
    on(window, cancelType, onUp, { passive: true });
    on(window, 'blur', onBlur, false);
    on(window, 'scroll', onScroll, { passive: true });

    if (supportsPointer) {
      on(document.documentElement, 'pointerleave', onLeave, false);
      on(document, 'pointerout', onPointerOut, { passive: true });
    } else {
      on(document, 'mouseleave', onLeave, false);
    }

    on(document, 'visibilitychange', onVisibility, false);
  }

  /* Media listeners outlive init/destroy so a hybrid device can return from
     coarse → fine without a reload. */
  function bindMediaOnce() {
    if (s.mediaBound) { return; }
    s.mediaBound = true;
    function bind(mq, fn) {
      if (!mq) { return; }
      try {
        if (typeof mq.addEventListener === 'function') { mq.addEventListener('change', fn, false); }
        else if (typeof mq.addListener === 'function') { mq.addListener(fn); }
      } catch (e) { /* ignore */ }
    }
    bind(mqReduce, onReducedChange);
    bind(mqFine, onFineChange);
  }

  function onMove(e) {
    if (!s.active) { return; }
    if (supportsPointer && e.pointerType === 'touch') { hide(true); return; }
    var x = e.clientX;
    var y = e.clientY;
    if (typeof x !== 'number' || typeof y !== 'number') { return; }
    s.pointerSeen = true;
    s.x = x;
    s.y = y;
    if (s.hidden) {
      /* Chrome can emit a synthetic pointermove at the viewport origin after
         layout/paint. Never reveal the cursor there before it has been shown. */
      if (!s.hasShown && x <= 1 && y <= 1) { return; }
      /* re-entry should fade in at the pointer, never sweep across the page */
      s.rx = x;
      s.ry = y;
      show();
      setDot();
      setRing();
    } else {
      setDot();
    }
    updateHover(e.target);
    ensureLoop();
  }

  function onDown(e) {
    if (!s.active) { return; }
    if (supportsPointer && e.pointerType === 'touch') { return; }
    if (typeof e.button === 'number' && e.button !== 0) { return; }
    s.down = true;
    if (s.root) { s.root.classList.add('is-down'); }
  }

  function onUp() {
    if (!s.active) { return; }
    s.down = false;
    if (s.root) { s.root.classList.remove('is-down'); }
  }

  function onLeave() {
    hide(false);
  }

  function onPointerOut(e) {
    if (!e.relatedTarget) { hide(false); }
  }

  function onBlur() {
    hide(true);
  }

  function onScroll() {
    if (!s.active || s.hidden) { return; }
    ensureLoop();
    if (s.hitFrame) { return; }
    s.hitFrame = window.requestAnimationFrame(function () {
      s.hitFrame = 0;
      if (!s.active || s.hidden) { return; }
      try { updateHover(document.elementFromPoint(s.x, s.y)); } catch (e) { /* ignore */ }
    });
  }

  function onVisibility() {
    if (!s.active) { return; }
    if (document.visibilityState === 'hidden') { hide(true); }
  }

  function onReducedChange() {
    s.reduced = !!(mqReduce && mqReduce.matches);
    if (!s.active) { return; }
    if (s.reduced) {
      resetMagnets(true);
      s.rx = s.x;
      s.ry = s.y;
      setRing();
      cancelLoop();
    } else {
      refreshMagnets();
      ensureLoop();
    }
  }

  function onFineChange() {
    if (!mqFine) { return; }
    if (mqFine.matches) {
      if (!s.active) { init(); }
    } else if (s.active) {
      destroy();
    }
  }

  /* --------------------------------------------------------------- observer -- */

  function observe() {
    if (typeof window.MutationObserver !== 'function') { return; }
    s.observer = new MutationObserver(function () {
      clearTimeout(s.refreshTimer);
      s.refreshTimer = setTimeout(function () {
        s.refreshTimer = 0;
        refresh();
      }, 140);
    });
    try {
      s.observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['data-magnetic']
      });
    } catch (e) { /* ignore */ }
  }

  /* ------------------------------------------------------------ lifecycle -- */

  function init() {
    if (s.active) { return; }
    if (!mqFine || !mqFine.matches) { return; }
    if (!document.body) { return; }
    try {
      s.reduced = !!(mqReduce && mqReduce.matches);
      acquireDom();
      if (!s.root || !s.ring || !s.dot) { return; }
      s.active = true;
      s.hidden = true;
      s.pointerSeen = false;
      s.hasShown = false;
      s.root.classList.remove('is-visible');
      s.root.classList.remove('is-hover');
      s.root.classList.remove('is-down');
      s.root.classList.add('is-hidden');
      if (s.labelEl) { s.labelEl.textContent = ''; }
      /* park the elements off-canvas until the first genuine move so a
         synthetic pointermove at (0,0) can never paint at the origin */
      s.x = -120;
      s.y = -120;
      s.rx = -120;
      s.ry = -120;
      setDot();
      setRing();
      bindEvents();
      observe();
      refreshMagnets();
      document.documentElement.classList.add('has-cursor');
    } catch (e) {
      destroy();
    }
  }

  function destroy() {
    s.active = false;
    cancelLoop();
    if (s.hitFrame) {
      try { window.cancelAnimationFrame(s.hitFrame); } catch (e) { /* ignore */ }
      s.hitFrame = 0;
    }
    clearTimeout(s.refreshTimer);
    s.refreshTimer = 0;
    if (s.observer) {
      try { s.observer.disconnect(); } catch (e) { /* ignore */ }
      s.observer = null;
    }
    offAll();
    resetMagnets(true);
    if (s.root) {
      s.root.classList.remove('is-visible');
      s.root.classList.remove('is-hover');
      s.root.classList.remove('is-down');
      s.root.classList.add('is-hidden');
      if (s.createdRoot && s.root.parentNode) { s.root.parentNode.removeChild(s.root); }
    }
    try { document.documentElement.classList.remove('has-cursor'); } catch (e) { /* ignore */ }
    if (s.labelEl) { s.labelEl.textContent = ''; }
    s.root = null;
    s.ring = null;
    s.dot = null;
    s.labelEl = null;
    s.createdRoot = false;
    s.hidden = true;
    s.pointerSeen = false;
    s.hover = false;
    s.hoverEl = null;
    s.down = false;
    s.magnets = [];
  }

  /* ---------------------------------------------------------------- public -- */

  function refresh() {
    try {
      if (!s.active) { return; }
      refreshMagnets();
      if (s.pointerSeen && !s.hidden) {
        try { updateHover(document.elementFromPoint(s.x, s.y)); } catch (e) { /* ignore */ }
        ensureLoop();
      }
    } catch (e) { /* ignore */ }
  }

  window.Cursor = { refresh: refresh };

  /* ------------------------------------------------------------------ boot -- */

  function boot() {
    bindMediaOnce();
    if (!mqFine || !mqFine.matches) { return; }
    if (document.body) { init(); }
    else { document.addEventListener('DOMContentLoaded', init, { once: true }); }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
