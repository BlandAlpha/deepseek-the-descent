/* ============================================================================
   ORPHEUS — generative ambient engine
   DEEPSEEK / THE DESCENT  ·  atmosphere-lab
   ----------------------------------------------------------------------------
   Public contract (window.Ambient):
     init()                 lazy, safe before any gesture
     enable() -> Promise<boolean>
     disable()
     toggle() -> boolean
     isEnabled() -> boolean
     blip(kind)             'hover' | 'click' | 'route' | 'submit' | 'type'
     setIntensity(0..1)     depth → darker / heavier bed
   Internal only (QA): window.Ambient.__debug()

   Fully generative Web Audio. No samples, no network, no globals beyond
   window.Ambient. Runs from file://.
   ============================================================================ */
(function () {
  'use strict';

  if (window.Ambient) { return; }

  var AudioCtor = window.AudioContext || window.webkitAudioContext;
  var SUPPORTED = typeof AudioCtor === 'function';

  var FADE_IN = 1.2;
  var FADE_OUT = 1.2;
  var HIDDEN_FADE = 0.35;
  var EPS = 0.0001;
  var MAX_VOICES = 8;
  var BLIP_GAP = { hover: 0.06, click: 0.05, route: 0.09, submit: 0.3, type: 0.03 };
  var BLIP_PEAK = { hover: 0.0032, click: 0.008, route: 0.0036, submit: 0.0075, type: 0.0024 };

  var s = {
    ctx: null,
    built: false,
    enabled: false,
    hidden: typeof document !== 'undefined' && document.visibilityState === 'hidden',
    ready: false,
    intensity: 0.35,

    master: null,
    limiter: null,
    bed: null,
    reverbSend: null,
    reverbReturn: null,
    subFilter: null,
    subTrim: null,
    lowFilter: null,
    lowTrim: null,
    noiseLowGain: null,
    noiseMidFilter: null,
    noiseMidGain: null,
    noiseHighGain: null,
    airGain: null,
    blipBus: null,
    blipVerbSend: null,
    tickBuffer: null,

    sources: new Set(),
    transient: new Set(),
    persistent: 0,
    voices: new Set(),
    scheduler: 0,
    suspendTimer: 0,
    fadeToken: 0,
    pendingEnable: null,
    firstEnable: true,
    buildCount: 0,
    lastBlipAt: {},
    lastResumeTry: 0,
    pageHidden: false,
    destroyed: false
  };

  /* ---------------------------------------------------------------- utils -- */

  function clamp(x, a, b) {
    x = Number(x);
    if (!isFinite(x)) { return a; }
    return x < a ? a : (x > b ? b : x);
  }

  function rand(a, b) { return a + Math.random() * (b - a); }

  function pick(arr) { return arr[(Math.random() * arr.length) | 0]; }

  function noop() {}

  function now() { return s.ctx ? s.ctx.currentTime : 0; }

  function makeGain(v) {
    var g = s.ctx.createGain();
    g.gain.value = v;
    return g;
  }

  function makeFilter(type, freq, q) {
    var f = s.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    if (typeof q === 'number') { f.Q.value = q; }
    return f;
  }

  function makePan(pos) {
    if (!s.ctx.createStereoPanner) { return null; }
    var p = s.ctx.createStereoPanner();
    p.pan.value = clamp(pos, -1, 1);
    return p;
  }

  function addSource(node) {
    s.sources.add(node);
    try {
      node.addEventListener('ended', function () { s.sources.delete(node); });
    } catch (e) { /* older implementations */ }
  }

  function addTransient(node) {
    s.sources.add(node);
    s.transient.add(node);
    try {
      node.addEventListener('ended', function () {
        s.sources.delete(node);
        s.transient.delete(node);
      });
    } catch (e) { /* older implementations */ }
  }

  /* After the master fade has finished we are about to suspend. Any one-shot
     still in flight (or frozen while suspended) is released here so repeated
     toggles can never accumulate voices either side of a suspend. */
  function releaseTransients() {
    if (!s.transient.size) { return; }
    var list = Array.from(s.transient);
    for (var i = 0; i < list.length; i++) {
      try { list[i].stop(); } catch (e) { /* not started / already stopped */ }
    }
  }

  function persistentOsc(type, freq) {
    var o = s.ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    o.start();
    addSource(o);
    s.persistent++;
    return o;
  }

  function persistentBuffer(buffer) {
    var src = s.ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    src.start(0, Math.random() * Math.min(1, buffer.duration - 0.01) * 0.5);
    addSource(src);
    s.persistent++;
    return src;
  }

  function addVoice(tag, seconds) {
    if (!s.ctx || s.voices.size >= MAX_VOICES) { return null; }
    var token = { tag: tag, end: s.ctx.currentTime + seconds };
    s.voices.add(token);
    var tid = setTimeout(function () {
      s.voices.delete(token);
    }, Math.max(60, Math.ceil((seconds + 0.25) * 1000)));
    token.timer = tid;
    return token;
  }

  /* ------------------------------------------------------------- buffers -- */

  /* Crossfaded seamless loop:  generate L + fade, then crossfade the head with
     the continuation so end→start and start→continuation are both seamless.  */
  function makeNoiseBuffer(seconds, kind) {
    var ctx = s.ctx;
    var sr = ctx.sampleRate;
    var len = Math.max(1, Math.floor(sr * seconds));
    var fade = Math.min(len >> 2, Math.floor(sr * 0.5));
    var total = len + fade;
    var buf = ctx.createBuffer(2, len, sr);

    for (var ch = 0; ch < 2; ch++) {
      var tmp = new Float32Array(total);
      var i, white, last = 0, b0 = 0, b1 = 0, b2 = 0;
      for (i = 0; i < total; i++) {
        white = Math.random() * 2 - 1;
        if (kind === 'pink') {
          b0 = 0.99765 * b0 + white * 0.0990460;
          b1 = 0.96300 * b1 + white * 0.2965164;
          b2 = 0.57000 * b2 + white * 1.0526913;
          tmp[i] = (b0 + b1 + b2 + white * 0.1848) * 0.12;
        } else {
          last = (last + 0.02 * white) / 1.02;
          tmp[i] = last * 2.2;
        }
      }

      var peak = 0;
      for (i = 0; i < total; i++) { peak = Math.max(peak, Math.abs(tmp[i])); }
      var norm = peak > 0.0001 ? 0.85 / peak : 1;
      for (i = 0; i < total; i++) { tmp[i] *= norm; }

      var d = buf.getChannelData(ch);
      for (i = 0; i < len; i++) {
        if (i < fade) {
          var w = i / fade;
          d[i] = tmp[len + i] * (1 - w) + tmp[i] * w;
        } else {
          d[i] = tmp[i];
        }
      }
    }

    return buf;
  }

  /* Dark, wide impulse response.  ConvolverNode normalizes it for us. */
  function makeImpulse(seconds, decay, damping) {
    var ctx = s.ctx;
    var sr = ctx.sampleRate;
    var len = Math.max(1, Math.floor(sr * seconds));
    var buf = ctx.createBuffer(2, len, sr);
    var taps = [0.013, 0.027, 0.043, 0.061, 0.081, 0.107];

    for (var ch = 0; ch < 2; ch++) {
      var d = buf.getChannelData(ch);
      var y = 0, i, x, p;
      for (i = 0; i < len; i++) {
        x = Math.random() * 2 - 1;
        y += damping * (x - y);
        p = i / len;
        d[i] = y * Math.pow(1 - p, decay);
      }
      for (var k = 0; k < taps.length; k++) {
        var idx = Math.floor((taps[k] + (ch === 1 ? 0.004 : 0)) * sr);
        if (idx < len) {
          d[idx] += (Math.random() * 2 - 1) * 0.4 * Math.pow(0.7, k);
        }
      }
      var inFade = Math.min(48, len);
      for (i = 0; i < inFade; i++) { d[i] *= i / inFade; }
    }
    return buf;
  }

  function makeTickBuffer() {
    var ctx = s.ctx;
    var len = Math.floor(ctx.sampleRate * 0.06);
    var buf = ctx.createBuffer(1, Math.max(1, len), ctx.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < d.length; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2.4);
    }
    return buf;
  }

  /* --------------------------------------------------------------- graph -- */

  function buildGraph() {
    var ctx = s.ctx;
    s.buildCount++;

    /* master → soft limiter → speakers */
    s.master = makeGain(EPS);
    s.limiter = ctx.createDynamicsCompressor();
    s.limiter.threshold.value = -18;
    s.limiter.knee.value = 18;
    s.limiter.ratio.value = 4;
    s.limiter.attack.value = 0.006;
    s.limiter.release.value = 0.25;
    s.master.connect(s.limiter);
    s.limiter.connect(ctx.destination);

    /* generated tank reverb */
    var conv = ctx.createConvolver();
    conv.normalize = true;
    conv.buffer = makeImpulse(4.6, 2.7, 0.30);
    var revTone = makeFilter('lowpass', 5000, 0.4);
    s.reverbSend = makeGain(1);
    s.reverbReturn = makeGain(0.52);
    s.reverbSend.connect(revTone);
    revTone.connect(conv);
    conv.connect(s.reverbReturn);
    s.reverbReturn.connect(s.master);

    /* bed (slow breathing applied by an LFO) */
    s.bed = makeGain(0.9);
    s.bed.connect(s.master);
    var breath = persistentOsc('sine', 0.017);
    var breathAmt = makeGain(0.07);
    breath.connect(breathAmt);
    breathAmt.connect(s.bed.gain);

    buildDrones();
    buildCurrent();
    buildAir();

    /* tiny UI voices */
    s.blipBus = makeGain(0.9);
    s.blipBus.connect(s.master);
    s.blipVerbSend = makeGain(0.2);
    s.blipBus.connect(s.blipVerbSend);
    s.blipVerbSend.connect(s.reverbSend);
    s.tickBuffer = makeTickBuffer();

    applyIntensityNow();
  }

  function buildDrones() {
    var ctx = s.ctx;

    /* deepest layer — weight under the words */
    s.subFilter = makeFilter('lowpass', 150, 0.55);
    s.subTrim = makeGain(0.34);
    s.subFilter.connect(s.subTrim);
    s.subTrim.connect(s.bed);

    /* low layer — the moving body of the drone */
    s.lowFilter = makeFilter('lowpass', 420, 0.7);
    s.lowTrim = makeGain(0.5);
    s.lowFilter.connect(s.lowTrim);
    s.lowTrim.connect(s.bed);

    /* ultra-slow drift, different periods so the beating never repeats */
    var driftA = persistentOsc('sine', 0.013);
    var driftAG = makeGain(9);
    driftA.connect(driftAG);
    var driftB = persistentOsc('sine', 0.019);
    var driftBG = makeGain(6);
    driftB.connect(driftBG);

    /* filter breathing */
    var lfoLow = persistentOsc('sine', 0.011);
    var lfoLowAmt = makeGain(70);
    lfoLow.connect(lfoLowAmt);
    lfoLowAmt.connect(s.lowFilter.frequency);
    var lfoSub = persistentOsc('sine', 0.023);
    var lfoSubAmt = makeGain(22);
    lfoSub.connect(lfoSubAmt);
    lfoSubAmt.connect(s.subFilter.frequency);

    function drone(type, freq, cents, level, dest, driftGain) {
      var o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = freq;
      o.detune.value = cents;
      var g = makeGain(level);
      o.connect(g);
      g.connect(dest);
      if (driftGain) { driftGain.connect(o.detune); }
      o.start();
      addSource(o);
      s.persistent++;
      return o;
    }

    drone('sine', 55.000, -6, 0.052, s.subFilter, driftAG);
    drone('sine', 55.000, 7, 0.030, s.subFilter, driftBG);
    drone('triangle', 82.4069, 2, 0.026, s.lowFilter, driftAG);
    drone('sawtooth', 110.000, -5, 0.010, s.lowFilter, driftBG);
    drone('triangle', 164.8138, 4, 0.0060, s.lowFilter, driftAG);
    drone('sine', 220.000, -8, 0.0022, s.lowFilter, driftBG);
  }

  function buildCurrent() {
    var ctx = s.ctx;
    var brown = makeNoiseBuffer(7.5, 'brown');
    var pink = makeNoiseBuffer(6.7, 'pink');

    /* low current — brown noise under a drifting low-pass */
    var lowSrc = persistentBuffer(brown);
    var lowF = makeFilter('lowpass', 320, 0.5);
    s.noiseLowGain = makeGain(0.048);
    lowSrc.connect(lowF);
    lowF.connect(s.noiseLowGain);
    s.noiseLowGain.connect(s.bed);
    var lfoA = persistentOsc('sine', 0.016);
    var lfoAAmt = makeGain(70);
    lfoA.connect(lfoAAmt);
    lfoAAmt.connect(lowF.frequency);
    var lfoAmp = persistentOsc('sine', 0.009);
    var lfoAmpAmt = makeGain(0.012);
    lfoAmp.connect(lfoAmpAmt);
    lfoAmpAmt.connect(s.noiseLowGain.gain);

    /* mid current — band-passed pink, slow stereo drift */
    var midSrc = persistentBuffer(pink);
    s.noiseMidFilter = makeFilter('bandpass', 900, 0.85);
    s.noiseMidGain = makeGain(0.014);
    midSrc.connect(s.noiseMidFilter);
    s.noiseMidFilter.connect(s.noiseMidGain);
    var pan = makePan(0);
    if (pan) {
      s.noiseMidGain.connect(pan);
      pan.connect(s.bed);
      var panLfo = persistentOsc('sine', 0.007);
      var panAmt = makeGain(0.32);
      panLfo.connect(panAmt);
      panAmt.connect(pan.pan);
    } else {
      s.noiseMidGain.connect(s.bed);
    }
    var midSend = makeGain(0.24);
    s.noiseMidGain.connect(midSend);
    midSend.connect(s.reverbSend);
    var lfoB = persistentOsc('sine', 0.023);
    var lfoBAmt = makeGain(240);
    lfoB.connect(lfoBAmt);
    lfoBAmt.connect(s.noiseMidFilter.frequency);
    var lfoGain = persistentOsc('sine', 0.013);
    var lfoGainAmt = makeGain(0.005);
    lfoGain.connect(lfoGainAmt);
    lfoGainAmt.connect(s.noiseMidGain.gain);
  }

  function buildAir() {
    var ctx = s.ctx;

    /* whispered surface far above — high shimmer air */
    var air = persistentBuffer(makeNoiseBuffer(8.2, 'pink'));
    var hp = makeFilter('highpass', 3600, 0.6);
    s.airGain = makeGain(0.0032);
    air.connect(hp);
    hp.connect(s.airGain);
    s.airGain.connect(s.bed);
    var airSend = makeGain(0.4);
    s.airGain.connect(airSend);
    airSend.connect(s.reverbSend);
    var lfoAir = persistentOsc('sine', 0.0065);
    var lfoAirAmt = makeGain(0.0016);
    lfoAir.connect(lfoAirAmt);
    lfoAirAmt.connect(s.airGain.gain);
  }

  /* --------------------------------------------------------------- voices -- */

  function bell(time, freq, peak, attack, decay, panPos) {
    var ctx = s.ctx;
    var env = makeGain(EPS);
    var tone = makeFilter('lowpass', 5600, 0.3);
    var pan = makePan(panPos);
    var out = pan || tone;
    env.connect(tone);
    if (pan) { tone.connect(pan); }
    out.connect(s.master);
    var send = makeGain(0.85);
    out.connect(send);
    send.connect(s.reverbSend);

    env.gain.setValueAtTime(EPS, time);
    env.gain.linearRampToValueAtTime(peak, time + attack);
    env.gain.exponentialRampToValueAtTime(EPS, time + attack + decay);

    var stop = time + attack + decay + 0.15;
    var partials = [
      { mul: 1, amp: 1 },
      { mul: 2.004, amp: 0.18 },
      { mul: 3.011, amp: 0.05 }
    ];
    for (var i = 0; i < partials.length; i++) {
      var o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = freq * partials[i].mul;
      o.detune.value = rand(-3, 3);
      var g = makeGain(partials[i].amp);
      o.connect(g);
      g.connect(env);
      o.start(time);
      o.stop(stop);
      addTransient(o);
    }
    return stop;
  }

  function scheduleShimmer() {
    var ctx = s.ctx;
    var t = now() + 0.05;
    var notes = [880, 987.77, 1046.5, 1174.66, 1318.51, 1567.98];
    var token = addVoice('shimmer', 10);
    if (!token) { return; }
    bell(t, pick(notes), rand(0.0024, 0.0042), rand(1.1, 2.2), rand(5.5, 8.5), rand(-0.75, 0.75));
  }

  function pingOnce(time, freq, peak, dur, panPos) {
    var ctx = s.ctx;
    var env = makeGain(EPS);
    var tone = makeFilter('lowpass', 4600, 0.4);
    var pan = makePan(panPos);
    env.connect(tone);
    var out = tone;
    if (pan) { tone.connect(pan); out = pan; }
    out.connect(s.master);
    var send = makeGain(0.92);
    out.connect(send);
    send.connect(s.reverbSend);

    env.gain.setValueAtTime(EPS, time);
    env.gain.exponentialRampToValueAtTime(peak, time + 0.008);
    env.gain.exponentialRampToValueAtTime(EPS, time + dur);

    var o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(freq, time);
    o.frequency.exponentialRampToValueAtTime(freq * 0.984, time + dur * 0.55);
    var g = makeGain(1);
    o.connect(g);
    g.connect(env);
    o.start(time);
    o.stop(time + dur + 0.12);
    addTransient(o);

    var o2 = ctx.createOscillator();
    o2.type = 'sine';
    o2.frequency.value = freq * 2.004;
    var g2 = makeGain(0.12);
    o2.connect(g2);
    g2.connect(env);
    o2.start(time);
    o2.stop(time + dur + 0.12);
    addTransient(o2);
  }

  function schedulePing(soft) {
    var t = now() + 0.08;
    var f = pick([659.25, 739.99, 783.99, 880, 987.77, 1108.73]);
    var peak = soft ? 0.006 : rand(0.007, 0.011);
    var dur = rand(2.7, 4.4);
    var pan = Math.random() < 0.5 ? rand(-0.8, -0.35) : rand(0.35, 0.8);
    var token = addVoice('ping', dur + 1.6);
    if (!token) { return; }
    pingOnce(t, f, peak, dur, pan);
    /* a soft returning echo from the far wall */
    pingOnce(t + rand(0.55, 0.85), f, peak * 0.3, dur * 0.72, -pan * 0.8);
  }

  /* ------------------------------------------------------------- blips ----- */

  function blipEnv(gainNode, time, peak, decay) {
    gainNode.gain.setValueAtTime(EPS, time);
    gainNode.gain.exponentialRampToValueAtTime(peak, time + 0.004);
    gainNode.gain.exponentialRampToValueAtTime(EPS, time + decay);
  }

  function noiseTick(time, peak, freq, q, decay, panPos) {
    var ctx = s.ctx;
    var src = ctx.createBufferSource();
    src.buffer = s.tickBuffer;
    src.playbackRate.value = rand(0.75, 1.3);
    var bp = makeFilter('bandpass', freq, q);
    var g = makeGain(EPS);
    var pan = makePan(panPos);
    if (pan) {
      src.connect(bp); bp.connect(g); g.connect(pan); pan.connect(s.blipBus);
    } else {
      src.connect(bp); bp.connect(g); g.connect(s.blipBus);
    }
    blipEnv(g, time, peak, decay);
    src.start(time);
    src.stop(time + decay + 0.03);
    addTransient(src);
  }

  function blip(kind) {
    try {
      if (!SUPPORTED || !s.enabled || !s.built || s.hidden || !s.ctx) { return; }
      if (s.ctx.state !== 'running') { return; }
      kind = typeof kind === 'string' ? kind : 'click';
      if (!BLIP_GAP.hasOwnProperty(kind)) { kind = 'click'; }
      var ctx = s.ctx;
      var t = ctx.currentTime;
      var gap = BLIP_GAP[kind];
      if (s.lastBlipAt[kind] && t - s.lastBlipAt[kind] < gap) { return; }
      s.lastBlipAt[kind] = t;
      if (s.voices.size >= MAX_VOICES) { return; }
      var peak = BLIP_PEAK[kind];

      if (kind === 'hover') {
        var token = addVoice('blip', 0.12);
        if (!token) { return; }
        var f = rand(2000, 2600);
        var o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.setValueAtTime(f, t);
        o.frequency.exponentialRampToValueAtTime(f * 0.82, t + 0.045);
        var g = makeGain(EPS);
        var pan = makePan(rand(-0.25, 0.25));
        o.connect(g);
        if (pan) { g.connect(pan); pan.connect(s.blipBus); } else { g.connect(s.blipBus); }
        blipEnv(g, t, peak, 0.07);
        o.start(t);
        o.stop(t + 0.1);
        addTransient(o);

      } else if (kind === 'route') {
        var token2 = addVoice('blip', 0.5);
        if (!token2) { return; }
        var freqs = Math.random() < 0.5 ? [659.25, 987.77] : [783.99, 1174.66];
        for (var i = 0; i < 2; i++) {
          var ot = ctx.createOscillator();
          ot.type = 'sine';
          ot.frequency.value = freqs[i];
          var gt = makeGain(EPS);
          var pt = makePan(i === 0 ? -0.18 : 0.18);
          ot.connect(gt);
          if (pt) { gt.connect(pt); pt.connect(s.blipBus); } else { gt.connect(s.blipBus); }
          var start = t + i * 0.065;
          gt.gain.setValueAtTime(EPS, start);
          gt.gain.exponentialRampToValueAtTime(peak, start + 0.006);
          gt.gain.exponentialRampToValueAtTime(EPS, start + 0.24);
          ot.start(start);
          ot.stop(start + 0.3);
          addTransient(ot);
        }

      } else if (kind === 'submit') {
        var token3 = addVoice('blip', 2.4);
        if (!token3) { return; }
        var base = 440;
        var freqs2 = [base, base * 1.5, base * 2.0];
        var amps = [1, 0.55, 0.22];
        for (var k = 0; k < freqs2.length; k++) {
          var os = ctx.createOscillator();
          os.type = 'sine';
          os.frequency.value = freqs2[k];
          os.detune.value = rand(-2, 2);
          var gs = makeGain(EPS);
          var ps = makePan(rand(-0.15, 0.15));
          os.connect(gs);
          if (ps) { gs.connect(ps); ps.connect(s.blipBus); } else { gs.connect(s.blipBus); }
          gs.gain.setValueAtTime(EPS, t);
          gs.gain.linearRampToValueAtTime(peak * amps[k], t + 0.012);
          gs.gain.exponentialRampToValueAtTime(EPS, t + 1.9);
          os.start(t);
          os.stop(t + 2.0);
          addTransient(os);
        }

      } else if (kind === 'type') {
        var token4 = addVoice('blip', 0.08);
        if (!token4) { return; }
        noiseTick(t, peak, rand(2600, 4400), 2.2, 0.028, rand(-0.3, 0.3));

      } else { /* click */
        var token5 = addVoice('blip', 0.2);
        if (!token5) { return; }
        var oc = ctx.createOscillator();
        oc.type = 'triangle';
        oc.frequency.setValueAtTime(520, t);
        oc.frequency.exponentialRampToValueAtTime(300, t + 0.07);
        var gc = makeGain(EPS);
        var pc = makePan(rand(-0.12, 0.12));
        oc.connect(gc);
        if (pc) { gc.connect(pc); pc.connect(s.blipBus); } else { gc.connect(s.blipBus); }
        blipEnv(gc, t, peak * 0.65, 0.1);
        oc.start(t);
        oc.stop(t + 0.14);
        addTransient(oc);
        noiseTick(t, peak * 0.35, rand(1400, 2200), 1.4, 0.035, rand(-0.2, 0.2));
      }
    } catch (e) { /* audio must never interrupt the interface */ }
  }

  /* -------------------------------------------------------------- mix ----- */

  function applyIntensityNow() {
    if (!s.built) { return; }
    var x = s.intensity;
    if (s.subFilter) { s.subFilter.frequency.value = 150 - 30 * x; }
    if (s.lowFilter) { s.lowFilter.frequency.value = 420 - 120 * x; }
    if (s.lowTrim) { s.lowTrim.gain.value = 0.5 - 0.06 * x; }
    if (s.subTrim) { s.subTrim.gain.value = 0.34 + 0.06 * x; }
    if (s.noiseMidFilter) { s.noiseMidFilter.frequency.value = 900 - 260 * x; }
    if (s.noiseMidGain) { s.noiseMidGain.gain.value = 0.014 - 0.002 * x; }
    if (s.noiseHighGain) { s.noiseHighGain.gain.value = 0.0032 - 0.0014 * x; }
    if (s.airGain) { s.airGain.gain.value = 0.0032 - 0.0012 * x; }
    if (s.reverbReturn) { s.reverbReturn.gain.value = 0.52 - 0.08 * x; }
    if (s.bed) { s.bed.gain.value = 0.9 - 0.05 * x; }
  }

  function smoothParam(param, value, tc) {
    if (!param || !s.ctx) { return; }
    try {
      var t = s.ctx.currentTime;
      param.cancelScheduledValues(t);
      param.setTargetAtTime(value, t, tc || 0.6);
    } catch (e) { /* ignore */ }
  }

  function setIntensity(x) {
    try {
      var next = clamp(x, 0, 1);
      if (s.built && Math.abs(next - s.intensity) < 0.002) {
        s.intensity = next;
        return;
      }
      s.intensity = next;
      if (!s.built) { return; }
      var v = s.intensity;
      smoothParam(s.subFilter.frequency, 150 - 30 * v);
      smoothParam(s.lowFilter.frequency, 420 - 120 * v);
      smoothParam(s.lowTrim.gain, 0.5 - 0.06 * v);
      smoothParam(s.subTrim.gain, 0.34 + 0.06 * v);
      smoothParam(s.noiseMidFilter.frequency, 900 - 260 * v);
      smoothParam(s.noiseMidGain.gain, 0.014 - 0.002 * v);
      smoothParam(s.airGain.gain, 0.0032 - 0.0012 * v);
      smoothParam(s.reverbReturn.gain, 0.52 - 0.08 * v);
      smoothParam(s.bed.gain, 0.9 - 0.05 * v);
    } catch (e) { /* ignore */ }
  }

  /* ------------------------------------------------------------- volume --- */

  function rampMaster(target, seconds) {
    if (!s.master || !s.ctx) { return; }
    var t = s.ctx.currentTime;
    var g = s.master.gain;
    try {
      if (typeof g.cancelAndHoldAtTime === 'function') {
        g.cancelAndHoldAtTime(t);
      } else {
        g.cancelScheduledValues(t);
        g.setValueAtTime(g.value, t);
      }
      if (seconds <= 0) {
        g.setValueAtTime(target, t);
      } else {
        g.linearRampToValueAtTime(target, t + seconds);
      }
    } catch (e) {
      try { g.value = target; } catch (e2) { /* ignore */ }
    }
  }

  function fadeIn(seconds) {
    s.fadeToken++;
    clearSuspendTimer();
    rampMaster(1, seconds);
  }

  function fadeOutAndSuspend(seconds) {
    s.fadeToken++;
    clearSuspendTimer();
    rampMaster(EPS, seconds);
    var token = s.fadeToken;
    s.suspendTimer = setTimeout(function () {
      s.suspendTimer = 0;
      if (token !== s.fadeToken) { return; }
      if (!s.ctx) { return; }
      try {
        if (s.ctx.state === 'running') {
          releaseTransients();
          var p = s.ctx.suspend();
          if (p && typeof p.catch === 'function') { p.catch(noop); }
        }
      } catch (e) { /* ignore */ }
    }, Math.ceil((seconds + 0.18) * 1000));
  }

  function clearSuspendTimer() {
    if (s.suspendTimer) {
      clearTimeout(s.suspendTimer);
      s.suspendTimer = 0;
    }
  }

  function stopScheduler() {
    if (s.scheduler) {
      clearInterval(s.scheduler);
      s.scheduler = 0;
    }
  }

  function startScheduler() {
    stopScheduler();
    var t = now();
    s.nextShimmer = t + rand(6, 13);
    s.nextPing = t + rand(9, 16);
    s.scheduler = setInterval(tick, 800);
  }

  function tick() {
    try {
      if (!s.enabled || s.hidden || !s.ctx || s.ctx.state !== 'running') { return; }
      var t = now();
      if (t >= s.nextShimmer) {
        scheduleShimmer();
        s.nextShimmer = t + rand(8, 19);
      }
      if (t >= s.nextPing) {
        schedulePing(false);
        s.nextPing = t + rand(14, 30);
      }
    } catch (e) { /* ignore */ }
  }

  function silentPulse() {
    try {
      var ctx = s.ctx;
      var buf = ctx.createBuffer(1, 1, ctx.sampleRate);
      var src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      addTransient(src);
      src.start(0);
      src.stop(0.001);
    } catch (e) { /* ignore */ }
  }

  /* --------------------------------------------------------------- state -- */

  function onCtxStateChange() {
    try {
      if (!s.ctx || !s.enabled || s.hidden || s.pendingEnable || s.pageHidden) { return; }
      if (s.ctx.state !== 'suspended') { return; }
      var stamp = Date.now();
      if (stamp - s.lastResumeTry < 2500) { return; }
      s.lastResumeTry = stamp;
      var p = s.ctx.resume();
      if (p && typeof p.catch === 'function') { p.catch(noop); }
    } catch (e) { /* ignore */ }
  }

  function onVisibilityChange() {
    try {
      var hidden = document.visibilityState === 'hidden';
      if (hidden === s.hidden) { return; }
      s.hidden = hidden;
      if (!s.built || !s.ctx) { return; }
      if (hidden) {
        stopScheduler();
        if (s.enabled) {
          fadeOutAndSuspend(HIDDEN_FADE);
        } else {
          fadeOutAndSuspend(0.1);
        }
      } else if (s.enabled) {
        resumeAndFade(FADE_IN);
      }
    } catch (e) { /* ignore */ }
  }

  function resumeAndFade(seconds) {
    if (!s.ctx || !s.enabled) { return; }
    var after = function () {
      if (!s.enabled || s.hidden) { return; }
      startScheduler();
      fadeIn(seconds || FADE_IN);
    };
    try {
      if (s.ctx.state === 'running') {
        after();
      } else {
        var p = s.ctx.resume();
        if (p && typeof p.then === 'function') { p.then(after).catch(noop); } else { after(); }
      }
    } catch (e) { /* ignore */ }
  }

  function onPageHide() {
    try {
      s.pageHidden = true;
      stopScheduler();
      if (!s.ctx || !s.built) { return; }
      /* fade first, then suspend — never chop the tail into a click */
      fadeOutAndSuspend(0.16);
    } catch (e) { /* ignore */ }
  }

  function onPageShow(e) {
    try {
      s.pageHidden = false;
      if (e && e.persisted && s.enabled && !document.hidden) {
        resumeAndFade(FADE_IN);
      }
    } catch (err) { /* ignore */ }
  }

  function enable() {
    if (!SUPPORTED) { return Promise.resolve(false); }
    s.ready = true;
    if (s.enabled && s.ctx && s.ctx.state === 'running' && !s.hidden) {
      return Promise.resolve(true);
    }
    if (s.pendingEnable) { return s.pendingEnable; }

    s.enabled = true;
    var promise = new Promise(function (resolve) {
      try {
        if (!s.ctx) {
          s.ctx = new AudioCtor();
          s.ctx.addEventListener('statechange', onCtxStateChange);
        }
        if (!s.built) {
          buildGraph();
          s.built = true;
        }
        silentPulse();

        var afterResume = function () {
          if (!s.enabled) { resolve(true); return; }
          if (s.hidden) {
            s.fadeToken++;
            clearSuspendTimer();
            rampMaster(EPS, 0.05);
          } else {
            startScheduler();
            fadeIn(FADE_IN);
          }
          if (s.firstEnable) {
            s.firstEnable = false;
            try { schedulePing(true); } catch (e) { /* ignore */ }
          }
          resolve(true);
        };

        if (s.ctx.state === 'running') {
          afterResume();
        } else {
          var p = s.ctx.resume();
          if (p && typeof p.then === 'function') {
            p.then(afterResume).catch(function () {
              s.enabled = false;
              resolve(false);
            });
          } else {
            afterResume();
          }
        }
      } catch (e) {
        s.enabled = false;
        resolve(false);
      }
    });

    s.pendingEnable = promise.then(function (ok) {
      s.pendingEnable = null;
      if (!ok) { s.enabled = false; }
      return ok;
    });
    return s.pendingEnable;
  }

  function disable() {
    s.enabled = false;
    try {
      stopScheduler();
      if (!s.ctx || !s.built) { return; }
      fadeOutAndSuspend(FADE_OUT);
    } catch (e) { /* ignore */ }
  }

  function toggle() {
    try {
      if (!SUPPORTED) { return false; }
      if (s.enabled) {
        disable();
        return false;
      }
      enable();
      /* if the context ctor threw synchronously, enable() has already
         restored enabled=false — report the real intent */
      return s.enabled;
    } catch (e) {
      return false;
    }
  }

  function isEnabled() {
    return !!(SUPPORTED && s.enabled);
  }

  function init() {
    s.ready = true;
  }

  function debug() {
    try {
      return {
        supported: SUPPORTED,
        ready: s.ready,
        built: s.built,
        buildCount: s.buildCount,
        enabled: s.enabled,
        hidden: s.hidden,
        ctxState: s.ctx ? s.ctx.state : 'none',
        sampleRate: s.ctx ? s.ctx.sampleRate : 0,
        persistentSources: s.persistent,
        liveSources: s.sources.size,
        voices: s.voices.size,
        timers: (s.scheduler ? 1 : 0) + (s.suspendTimer ? 1 : 0),
        intensity: s.intensity,
        masterGain: s.master ? s.master.gain.value : 0,
        context: s.ctx,
        master: s.master,
        blipBus: s.blipBus
      };
    } catch (e) {
      return { supported: SUPPORTED, error: true };
    }
  }

  /* ------------------------------------------------------------- wire up --- */

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onVisibilityChange, false);
  }
  window.addEventListener('pagehide', onPageHide, false);
  window.addEventListener('pageshow', onPageShow, false);

  window.Ambient = {
    init: init,
    enable: enable,
    disable: disable,
    toggle: toggle,
    isEnabled: isEnabled,
    blip: blip,
    setIntensity: setIntensity,
    __debug: debug
  };
})();