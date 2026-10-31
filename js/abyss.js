/* ============================================================
   DEEPSEEK — THE DESCENT / 深潜
   js/abyss.js — persistent WebGL abyss
   Single fullscreen fragment shader. No textures, no libraries.
   Public: window.Abyss.create(canvas, { reducedMotion })
   ============================================================ */
(function (win, doc) {
  'use strict';

  var VERT_SRC = 'attribute vec2 aPos;\n' +
    'void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }';

  var FRAG_BODY = `uniform vec2  uRes;
uniform float uTime;
uniform float uProgress;
uniform vec2  uPointer;
uniform vec2  uPulsePos;
uniform float uPulseTime;
uniform float uPulseStrength;

const vec3 C_CYAN = vec3(0.525, 0.969, 0.910);
const vec3 C_BLUE = vec3(0.302, 0.420, 0.996);
const vec3 C_WARM = vec3(0.941, 0.702, 0.518);
const mat2 M2 = mat2(0.80, 0.60, -0.60, 0.80);

float hash12(vec2 p){
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
vec2 hash22(vec2 p){
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}
float vnoise(vec2 p){
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float a = hash12(i);
  float b = hash12(i + vec2(1.0, 0.0));
  float c = hash12(i + vec2(0.0, 1.0));
  float d = hash12(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float fbm2(vec2 p){
  float v = 0.0;
  float a = 0.5;
  v += a * vnoise(p);
  p = M2 * p * 2.03 + vec2(5.7, 1.3);
  a *= 0.5;
  v += a * vnoise(p);
  return v / 0.75;
}
float fbm3(vec2 p){
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 3; i++){
    v += a * vnoise(p);
    p = M2 * p * 2.03 + vec2(5.7, 1.3);
    a *= 0.5;
  }
  return v / 0.875;
}
float fbm4(vec2 p){
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++){
    v += a * vnoise(p);
    p = M2 * p * 2.03 + vec2(5.7, 1.3);
    a *= 0.5;
  }
  return v / 0.9375;
}

// One particle per cell, anchored in world space. Offsets stay away from
// cell borders so a single tap is sufficient and nothing ever pops.
vec3 particleLayer(vec2 p, float scale, float speed, float seed, float fill, float bright, float sizePx, float up){
  vec2 q = p * scale;
  q = mat2(0.94, 0.34, -0.34, 0.94) * q;
  q.x += sin(uTime * 0.035 + p.y * 1.7 + seed) * 0.5;
  q.y += uTime * speed * up + seed * 9.7;
  vec2 cell = floor(q);
  vec2 f = q - cell;
  vec2 h = hash22(cell + seed * 7.3);
  vec2 pos = 0.24 + 0.52 * h;
  float h1 = hash12(cell * 0.817 + seed * 11.3);
  float dist = length(f - pos);
  float sz = max(0.0008, sizePx * (0.6 + 1.8 * h1) * scale / uRes.y);
  float tw = 0.70 + 0.30 * sin(uTime * (0.3 + 0.8 * h1) + h1 * 37.0 + seed);
  float core = exp(-dist * dist / (sz * sz * 0.5));
  float halo = exp(-dist * dist / (sz * sz * 5.0)) * 0.18;
  float glint = 0.0;
  if (h1 > 0.955){
    vec2 dd = abs(f - pos);
    glint = (exp(-dd.x / (sz * 7.0)) * exp(-dd.y / (sz * 0.7)) +
             exp(-dd.y / (sz * 7.0)) * exp(-dd.x / (sz * 0.7))) * 0.30;
  }
  float present = 1.0 - smoothstep(fill - 0.10, fill, h1);
  vec3 c = mix(vec3(0.55, 0.72, 0.78), C_CYAN, h.y * h.y * 0.9);
  if (h1 > 0.989) c = mix(c, C_WARM, 0.8);
  return c * (core + halo + glint) * tw * bright * present;
}

void main(){
  vec2 frag = gl_FragCoord.xy;
  vec2 res = uRes;
  float aspect = res.x / res.y;
  float portrait = clamp((1.10 - aspect) / 0.62, 0.0, 1.0);
  vec2 uv = frag / res;
  vec2 p = (frag - 0.5 * res) / res.y;
  float t = uTime;
  float d = clamp(uProgress, 0.0, 1.0);
  vec2 m = uPointer;

  // ------------------------------------------------------------
  // stage weights
  // ------------------------------------------------------------
  float wSurf  = 1.0 - smoothstep(0.040, 0.155, d);
  float wPhoto = smoothstep(0.03, 0.08, d) * (1.0 - smoothstep(0.15, 0.24, d));
  float wTwi   = smoothstep(0.14, 0.22, d) * (1.0 - smoothstep(0.30, 0.38, d));
  float wMid   = smoothstep(0.28, 0.36, d) * (1.0 - smoothstep(0.42, 0.50, d));
  float wAbyss = smoothstep(0.42, 0.50, d) * (1.0 - smoothstep(0.60, 0.70, d));
  float wHadal = smoothstep(0.58, 0.70, d);

  vec2 par = m * vec2(0.022, 0.016);

  // ------------------------------------------------------------
  // water body — darkness first
  // ------------------------------------------------------------
  vec3 cTop = vec3(0.055, 0.145, 0.165);
  cTop = mix(cTop, vec3(0.016, 0.044, 0.062), smoothstep(0.025, 0.080, d));
  cTop = mix(cTop, vec3(0.0060, 0.0160, 0.0420), smoothstep(0.11, 0.21, d));
  cTop = mix(cTop, vec3(0.0022, 0.0048, 0.0160), smoothstep(0.26, 0.36, d));
  cTop = mix(cTop, vec3(0.0014, 0.0026, 0.0088), smoothstep(0.40, 0.52, d));
  cTop = mix(cTop, vec3(0.0006, 0.0009, 0.0030), smoothstep(0.56, 0.70, d));

  vec3 cBot = vec3(0.0014, 0.0040, 0.0105);
  cBot = mix(cBot, vec3(0.0013, 0.0028, 0.0080), smoothstep(0.15, 0.35, d));
  cBot = mix(cBot, vec3(0.0007, 0.0013, 0.0045), smoothstep(0.35, 0.60, d));
  cBot = mix(cBot, vec3(0.0004, 0.0007, 0.0022), smoothstep(0.55, 0.80, d));
  cBot = mix(cBot, vec3(0.0003, 0.0004, 0.0012), smoothstep(0.80, 1.0, d));

  float gradPow = mix(1.20, 1.85, smoothstep(0.08, 0.50, d));
  vec3 col = mix(cBot, cTop, pow(clamp(uv.y, 0.0, 1.0), gradPow));
  col += vec3(0.0010, 0.0024, 0.0065) * (1.0 - smoothstep(0.0, 0.9, uv.y)) * (1.0 - wSurf * 0.6);

  // faint blue glow low-centre in twilight
  float low = exp(-pow(length((p - vec2(0.0, -0.22)) * vec2(1.0, 1.7)) / 0.24, 2.0));
  col += vec3(0.020, 0.042, 0.090) * low * (wTwi * 0.90 + wMid * 0.25);

  // ------------------------------------------------------------
  // light from the surface
  // ------------------------------------------------------------
  float sunX = mix(-0.34, -0.14, portrait);
  vec2 sunP = vec2(sunX + m.x * 0.012, 0.98 + m.y * 0.006);
  vec2 sv = p - sunP;
  float sd = length(sv * vec2(1.0, 1.06));
  vec3 sunCol = vec3(0.40, 0.72, 0.71);
  float sunAmp = wSurf * 1.05 + wPhoto * 0.13 + wTwi * 0.03;

  col += vec3(0.038, 0.088, 0.096) * pow(clamp(uv.y, 0.0, 1.0), 2.4) * (wSurf * 0.85 + wPhoto * 0.13);
  col += sunCol * (exp(-sd * sd * 3.2) * 0.70 + exp(-sd * 2.1) * 0.095) * sunAmp;

  // a slanted veil of light from the upper left
  float veil = exp(-pow((p.y - (0.55 - p.x * 0.9)) / 0.42, 2.0));
  vec3 veilCol = vec3(0.022, 0.052, 0.058);
  col += veilCol * veil * pow(clamp(uv.y, 0.0, 1.0), 1.4) * (wSurf * 0.78 + wPhoto * 0.10);

  // god rays
  float ray = 0.0;
  float rayAmp = wSurf * 1.20 + wPhoto * 0.16 + wTwi * 0.035;
  if (rayAmp > 0.001){
    float rr = length(sv);
    float ang = atan(sv.x, -sv.y);
    float angWarp = fbm2(vec2(ang * 2.4, 4.1 + t * 0.010));
    float shafts = 0.5 + 0.5 * sin(ang * 16.0 + angWarp * 7.0 + 0.7);
    shafts = pow(shafts, 5.0);
    float fineShafts = 0.5 + 0.5 * sin(ang * 34.0 + angWarp * 12.0 + 1.3);
    fineShafts = pow(fineShafts, 12.0);
    float broad = smoothstep(0.38, 0.68, fbm2(vec2(ang * 4.2, 1.2 + t * 0.007)) * 0.65 +
                                            fbm2(vec2(ang * 9.5, 2.6 - t * 0.005)) * 0.35);
    broad = broad * broad;
    float along = 0.48 + 0.52 * fbm2(vec2(ang * 5.0, rr * 1.7 - t * 0.020));
    float atten = exp(-rr * 0.48) * smoothstep(0.10, 0.55, rr);
    ray = (shafts * 0.58 + broad * 0.62 + fineShafts * 0.30) * along * atten;
    col += vec3(0.34, 0.64, 0.64) * ray * rayAmp * 0.62;
  }

  // caustic ceiling
  float caM = smoothstep(0.50, 0.94, uv.y) * (wSurf * 0.95 + wPhoto * 0.16) * (0.35 + 0.65 * exp(-sd * sd * 1.6));
  if (caM > 0.002){
    vec2 cp = (p + par * 0.5) * vec2(8.0, 10.0) + vec2(0.0, -t * 0.045);
    float w1 = fbm2(cp * 0.34 + vec2(t * 0.020, 1.0));
    float w2 = fbm2(cp * 0.50 + vec2(3.0, -t * 0.015));
    float wave = sin(cp.x * 1.55 + w1 * 5.5) + sin(cp.y * 1.95 - w2 * 5.0) + sin((cp.x * 0.7 - cp.y * 0.9) * 1.7 + (w1 + w2) * 3.2);
    float web = pow(clamp(1.0 - abs(wave) * 0.20, 0.0, 1.0), 22.0);
    vec2 cp2 = cp * 2.2 + 4.0;
    float v2 = sin(cp2.x * 1.4 + w2 * 6.0 + t * 0.05) * sin(cp2.y * 1.7 - w2 * 5.0 - t * 0.04);
    float web2 = pow(clamp(1.0 - abs(v2) * 1.45, 0.0, 1.0), 26.0) * 0.8;
    float coarse = pow(clamp(1.0 - abs(sin(cp.x * 0.37 + w1 * 3.0) + sin(cp.y * 0.44 - w2 * 2.5)) * 0.55, 0.0, 1.0), 10.0) * 0.35;
    float caustic = (web * 0.7 + web2 * 0.55 + coarse * 0.5) * (0.30 + 0.70 * w1);
    col += vec3(0.42, 0.72, 0.69) * caustic * caM * 0.36;
  }

  // ------------------------------------------------------------
  // volumetric nebula — sparse, filamentary, dark negative space
  // ------------------------------------------------------------
  vec2 fp = p + par * 1.2;
  fp *= mix(1.0, 1.2, portrait);
  fp.y += d * 0.50;
  vec2 warpA = vec2(
    fbm2(fp * 1.05 + vec2(2.3, 7.7) + vec2(0.0, t * 0.006)),
    fbm2(fp * 1.05 + vec2(8.1, 1.9) - vec2(0.0, t * 0.005))
  );
  vec2 warp = (warpA - 0.5) * 2.2;

  float f1 = fbm4(fp * 2.55 + warp * 0.9 + vec2(0.0, -t * 0.004));
  float f2 = fbm3(fp * 7.2 + warp * 1.8 + vec2(t * 0.006, 0.0));
  float f3 = vnoise(fp * 18.0 + warp * 3.2 + vec2(t * 0.020, -t * 0.010));
  float dens = f1 * 0.50 + f2 * 0.34 + f3 * 0.16;
  dens += (f3 - 0.5) * 0.10;

  float cloud = smoothstep(0.44, 0.64, dens);
  float cloudHi = pow(cloud, 1.5);
  float envBase = warpA.y * 0.60 + warpA.x * 0.40;
  float env = smoothstep(0.43, 0.71, envBase);
  float band = exp(-pow((p.y + 0.04 + p.x * 0.22) / 0.32, 2.0));
  env *= mix(0.14, 1.0, band);
  env *= mix(0.55, 1.0, smoothstep(0.10, 0.68, length(p * vec2(0.85, 1.25))));

  vec3 cloudCol = vec3(0.018, 0.058, 0.068);
  cloudCol = mix(cloudCol, vec3(0.014, 0.038, 0.070), smoothstep(0.06, 0.16, d));
  cloudCol = mix(cloudCol, vec3(0.028, 0.040, 0.135), smoothstep(0.16, 0.26, d));
  cloudCol = mix(cloudCol, vec3(0.030, 0.050, 0.190), smoothstep(0.30, 0.42, d));
  cloudCol = mix(cloudCol, vec3(0.020, 0.090, 0.120), smoothstep(0.44, 0.56, d));
  cloudCol = mix(cloudCol, vec3(0.008, 0.022, 0.038), smoothstep(0.60, 0.74, d));
  cloudCol = mix(cloudCol, vec3(0.004, 0.010, 0.018), smoothstep(0.84, 0.94, d));

  float fogAmp = 0.055;
  fogAmp = mix(fogAmp, 0.160, smoothstep(0.03, 0.10, d));
  fogAmp = mix(fogAmp, 0.380, smoothstep(0.13, 0.23, d));
  fogAmp = mix(fogAmp, 0.400, smoothstep(0.28, 0.38, d));
  fogAmp = mix(fogAmp, 0.340, smoothstep(0.44, 0.54, d));
  fogAmp = mix(fogAmp, 0.150, smoothstep(0.60, 0.72, d));
  fogAmp = mix(fogAmp, 0.055, smoothstep(0.84, 0.94, d));

  float cloudLit = cloudHi * env * fogAmp * (0.55 + 0.75 * f3);
  col += cloudCol * cloudLit;
  float wisp = smoothstep(0.43, 0.56, dens) * (1.0 - smoothstep(0.56, 0.70, dens));
  col += cloudCol * wisp * env * fogAmp * 0.15;

  // electric filaments
  float filN = f2 + (f3 - 0.5) * 0.22;
  float fil = 1.0 - abs(filN * 2.0 - 1.0);
  fil = pow(clamp(fil, 0.0, 1.0), 14.0);
  float breakup = 0.12 + 0.88 * smoothstep(0.28, 0.66, warpA.x + 0.18 * sin(fp.x * 2.0 + t * 0.03));
  float filaments = fil * breakup * env * (0.55 + 0.60 * f3);
  float ribbon = 1.0 - abs(f1 * 2.0 - 1.0);
  ribbon = pow(clamp(ribbon, 0.0, 1.0), 18.0) * env * smoothstep(0.35, 0.70, warpA.y);
  float fine = 1.0 - abs(f3 * 2.0 - 1.0);
  fine = pow(clamp(fine, 0.0, 1.0), 22.0) * env * smoothstep(0.30, 0.62, cloud);

  vec3 filCol = vec3(0.30, 0.55, 0.55);
  filCol = mix(filCol, vec3(0.10, 0.40, 0.50), smoothstep(0.06, 0.16, d));
  filCol = mix(filCol, vec3(0.18, 0.28, 0.95), smoothstep(0.20, 0.32, d));
  filCol = mix(filCol, vec3(0.22, 0.55, 1.00), smoothstep(0.32, 0.44, d));
  filCol = mix(filCol, vec3(0.25, 0.92, 0.85), smoothstep(0.46, 0.58, d));
  filCol = mix(filCol, vec3(0.08, 0.20, 0.24), smoothstep(0.72, 0.84, d));
  filCol = mix(filCol, vec3(0.05, 0.10, 0.14), smoothstep(0.86, 0.95, d));

  float filAmp = 0.020;
  filAmp = mix(filAmp, 0.095, smoothstep(0.04, 0.12, d));
  filAmp = mix(filAmp, 0.165, smoothstep(0.16, 0.26, d));
  filAmp = mix(filAmp, 0.320, smoothstep(0.30, 0.40, d));
  filAmp = mix(filAmp, 0.360, smoothstep(0.44, 0.54, d));
  filAmp = mix(filAmp, 0.145, smoothstep(0.60, 0.72, d));
  filAmp = mix(filAmp, 0.045, smoothstep(0.84, 0.94, d));

  col += filCol * filaments * filAmp;
  col += filCol * ribbon * filAmp * 0.22;
  col += vec3(0.18, 0.52, 0.62) * fine * filAmp * 0.36;

  // deep vertical curtains (very restrained)
  if (wTwi + wMid + wAbyss > 0.01){
    float curtain = fbm3(vec2(fp.x * 5.5, fp.y * 1.3 - t * 0.010));
    curtain = pow(smoothstep(0.62, 0.88, curtain), 2.0);
    col += vec3(0.024, 0.050, 0.135) * curtain * env * (wTwi * 0.30 + wMid * 0.35 + wAbyss * 0.20) * 0.10;
  }

  // ------------------------------------------------------------
  // breathing presence — smaller, more distant, broken rim
  // ------------------------------------------------------------
  float presW = smoothstep(0.32, 0.46, d) * (1.0 - smoothstep(0.62, 0.76, d));
  vec2 pc = vec2(0.0, mix(-0.04, -0.11, smoothstep(0.32, 0.55, d))) - m * vec2(0.015, 0.012);
  float pSize = mix(1.0, 0.78, portrait);
  vec2 v = (p - pc) / pSize;
  float r = length(v);
  float occ = 1.0;
  float arcMask = 1.0;
  if (presW > 0.002){
    float pa = atan(v.y, v.x);
    float breathe = 0.5 + 0.5 * sin(t * 0.28 + 0.7);
    float rimN = fbm2(vec2(cos(pa) * 1.4, sin(pa) * 1.4) + vec2(r * 1.6, t * 0.010));
    float rimN2 = fbm2(vec2(cos(pa) * 3.2, sin(pa) * 3.2) + vec2(9.0, r * 2.0 - t * 0.008));
    float r0 = 0.118 + 0.006 * breathe + (rimN - 0.5) * 0.030 + (rimN2 - 0.5) * 0.010;
    float seedN = fbm2(vec2(cos(pa) * 2.2, sin(pa) * 2.2) + 4.2);
    arcMask = smoothstep(0.40, 0.68, seedN + 0.16 * sin(pa * 2.0 + t * 0.05));

    occ = smoothstep(r0 * 0.30, r0 * 1.32, r + (rimN - 0.5) * 0.06);
    col *= mix(1.0, 0.22 + 0.78 * occ, presW * 0.82);

    float cw = 1.0 / (uRes.y * pSize);
    float rimR = exp(-pow((r - r0 - cw) / 0.014, 2.0));
    float rimG = exp(-pow((r - r0) / 0.014, 2.0));
    float rimB = exp(-pow((r - r0 + cw) / 0.014, 2.0));

    vec3 rimCol = vec3(0.16, 0.44, 0.58);
    rimCol = mix(rimCol, vec3(0.22, 0.92, 0.82), smoothstep(0.46, 0.58, d));
    rimCol = mix(rimCol, vec3(0.18, 0.30, 0.42), smoothstep(0.62, 0.74, d));

    float rimAmp = 0.24 * (0.55 + 0.45 * breathe) * (0.25 + 0.75 * arcMask);
    rimAmp *= 0.52 + 0.62 * smoothstep(-0.6, 0.9, -v.y / max(r, 0.001));
    col += rimCol * vec3(rimR, rimG, rimB) * rimAmp * presW;

    float halo = exp(-max(r - r0, 0.0) * 6.0) * smoothstep(0.0, r0, r) * 0.075;
    float inner = exp(-pow(r / (r0 * 0.95), 2.0)) * smoothstep(0.10, 0.34, r) * 0.018;
    float tendN = fbm2(vec2(pa * 1.5, r * 3.6 - t * 0.02) + 2.7);
    float tend = pow(clamp(tendN, 0.0, 1.0), 3.2) * exp(-abs(r - r0 * 0.96) * 3.4) * smoothstep(r0 * 0.5, r0, r) * 0.10;
    float trail = smoothstep(-0.02, -0.20, v.y) * exp(-abs(v.x) * 5.5) * pow(clamp(0.5 + 0.5 * sin(v.x * 11.0 + rimN * 4.0 + t * 0.04), 0.0, 1.0), 7.0) * 0.055;
    col += rimCol * (halo + inner + tend + trail) * presW;
  }

  // ------------------------------------------------------------
  // particles — sparse bioluminescent snow
  // ------------------------------------------------------------
  float snowLit = 0.70 + 0.55 * uv.y;
  float motesRay = 0.78 + 0.50 * ray;
  float pFill = mix(1.0, 1.20, portrait);
  vec3 motes = particleLayer(p, 6.5, 0.006, 1.3, 0.85 * pFill, 0.40, 1.2, 1.0) * snowLit * motesRay;
  motes += particleLayer(p, 12.0, 0.011, 6.1, 0.60 * pFill, 0.30, 1.6, 1.0) * (0.85 + 0.30 * uv.y);
  vec3 sparkTint = mix(vec3(0.65, 0.85, 0.95), C_CYAN, smoothstep(0.30, 0.70, d));
  motes += particleLayer(p, 7.5, 0.004, 9.7, 0.12 * pFill, 0.62, 2.6, -1.0) * sparkTint;
  motes += particleLayer(p, 4.6, 0.003, 4.4, 0.30 * pFill, 0.048, 7.5, 1.0) * vec3(0.55, 0.80, 0.82);
  float moteAmp = mix(0.58, 1.0, smoothstep(0.04, 0.30, d));
  moteAmp *= mix(1.0, 0.50, smoothstep(0.85, 1.0, d));
  moteAmp *= mix(1.0, 0.40, presW * (1.0 - occ));
  col += motes * moteAmp;

  // ------------------------------------------------------------
  // sonar
  // ------------------------------------------------------------
  float sonar = 0.0;
  for (int i = 0; i < 2; i++){
    float ph = fract(t / 15.0 + 0.5 * float(i) + 0.10);
    float rad = ph * 1.05;
    float w = mix(0.0008, 0.0038, ph);
    float dx = (r - rad) / w;
    sonar += exp(-dx * dx) * pow(1.0 - ph, 2.0) * smoothstep(0.0, 0.03, ph);
  }
  sonar *= presW * 0.045 * (0.55 + 0.45 * arcMask);
  col += vec3(0.20, 0.68, 0.72) * sonar;

  // manual pulse
  if (uPulseTime >= 0.0 && uPulseTime < 6.0 && uPulseStrength > 0.001){
    float rr2 = length(p - uPulsePos);
    float rad2 = uPulseTime * 0.55;
    float w2 = 0.0020 + uPulseTime * 0.0022;
    float dx2 = (rr2 - rad2) / w2;
    float ring2 = exp(-dx2 * dx2) * exp(-uPulseTime * 1.25);
    float glow2 = exp(-pow(rr2 / (0.10 + uPulseTime * 0.07), 2.0)) * exp(-uPulseTime * 2.2) * 0.25;
    col += (vec3(0.42, 0.95, 0.92) * ring2 + vec3(0.16, 0.42, 0.55) * glow2) * uPulseStrength;
  }

  // ------------------------------------------------------------
  // hadal lamp — only in the last few percent
  // ------------------------------------------------------------
  float hw = smoothstep(0.955, 0.995, d);
  if (hw > 0.002){
    float flick = 1.0 + 0.07 * sin(t * 0.8) + 0.035 * sin(t * 1.9 + 1.3);
    vec2 lamp = vec2(mix(0.15, 0.015, portrait), -0.42);
    float lr = length((p - lamp) * vec2(1.0, 1.6));
    float glow = exp(-pow(lr / 0.050, 2.0)) * 0.120 + exp(-lr * 4.8) * 0.034;
    float haze = exp(-pow((uv.y - 0.015) / 0.070, 2.0)) * exp(-pow((uv.x - 0.54) / 0.42, 2.0)) * 0.026;
    col += C_WARM * (glow + haze) * flick * hw;
  }

  // ------------------------------------------------------------
  // grade
  // ------------------------------------------------------------
  float vd = length(p * vec2(0.95, 1.0));
  float vig = smoothstep(1.12, 0.24, vd);
  col *= mix(0.36, 1.0, vig);
  col *= mix(0.90, 1.0, smoothstep(0.0, 0.10, uv.y));

  float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(vec3(lum), col, 0.93);
  col = col / (1.0 + col * 0.22);

  float gt = uTime;
  float grain = hash12(frag + floor(gt * 24.0) * vec2(37.0, 61.0));
  col += (grain - 0.5) * 0.0095;
  col += (hash12(frag.yx * 1.7 + 19.0) - 0.5) * 0.0060;
  gl_FragColor = vec4(max(col, 0.0), 1.0);
}`;

  var DEFAULT_BUDGET = 1900000;
  var DPR_CAP = 1.75;

  function nowMs() {
    return (win.performance && win.performance.now) ? win.performance.now() : Date.now();
  }

  function inertInstance(canvas) {
    var inst = {
      isLive: false,
      setScroll: function () {},
      setPointer: function () {},
      pulse: function () {},
      resize: function () {},
      destroy: function () {}
    };
    try {
      if (canvas) {
        canvas.setAttribute('data-abyss-fallback', 'true');
        if (canvas.classList) canvas.classList.add('abyss-fallback');
      }
    } catch (e) {}
    return inst;
  }

  function precisionPrefix(gl) {
    try {
      var pf = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT);
      if (pf && pf.precision > 0) return 'precision highp float;\n';
    } catch (e) {}
    return 'precision mediump float;\n';
  }

  function compileShader(gl, type, src, errOut) {
    var sh = gl.createShader(type);
    if (!sh) return null;
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      if (errOut) errOut.msg = (type === gl.VERTEX_SHADER ? 'vertex: ' : 'fragment: ') + gl.getShaderInfoLog(sh);
      gl.deleteShader(sh);
      return null;
    }
    return sh;
  }

  function makeProgram(gl, errOut) {
    errOut = errOut || { msg: '' };
    var vs = compileShader(gl, gl.VERTEX_SHADER, VERT_SRC, errOut);
    if (!vs) return null;
    var fs = compileShader(gl, gl.FRAGMENT_SHADER, precisionPrefix(gl) + FRAG_BODY, errOut);
    if (!fs) { gl.deleteShader(vs); return null; }
    var prog = gl.createProgram();
    if (!prog) { gl.deleteShader(vs); gl.deleteShader(fs); return null; }
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.bindAttribLocation(prog, 0, 'aPos');
    gl.linkProgram(prog);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      errOut.msg = 'link: ' + gl.getProgramInfoLog(prog);
      gl.deleteProgram(prog);
      return null;
    }
    return prog;
  }

  function create(canvas, options) {
    options = options || {};
    if (!canvas || typeof canvas.getContext !== 'function') return inertInstance(canvas);

    var prior = canvas.__abyssInstance;
    if (prior && typeof prior.destroy === 'function') {
      try { prior.destroy(); } catch (e) {}
    }

    var ctxAttrs = {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: !!options.preserveDrawingBuffer,
      powerPreference: 'high-performance'
    };
    var gl = null;
    try {
      gl = canvas.getContext('webgl', ctxAttrs) || canvas.getContext('experimental-webgl', ctxAttrs);
    } catch (e) { gl = null; }
    if (!gl) return inertInstance(canvas);
    // paint a dark buffer before any shader work so a failed program can
    // never leave a white flash on top of the page
    try {
      gl.clearColor(0.016, 0.027, 0.055, 1.0);
      gl.clear(gl.COLOR_BUFFER_BIT);
    } catch (e) {}
    var darkClear = function () {
      try {
        if (gl && !gl.isContextLost()) {
          gl.clearColor(0.016, 0.027, 0.055, 1.0);
          gl.clear(gl.COLOR_BUFFER_BIT);
          gl.viewport(0, 0, canvas.width || 1, canvas.height || 1);
        }
      } catch (e) {}
    };

    var reducedExplicit = (typeof options.reducedMotion === 'boolean');
    var mq = null;
    try {
      mq = win.matchMedia ? win.matchMedia('(prefers-reduced-motion: reduce)') : null;
    } catch (e) { mq = null; }
    var reduced = reducedExplicit ? options.reducedMotion : !!(mq && mq.matches);

    var shaderErr = { msg: '' };
    var program = makeProgram(gl, shaderErr);
    if (!program) {
      try { canvas.setAttribute('data-abyss-error', shaderErr.msg || 'shader compile/link failed'); } catch (e) {}
      darkClear();
      return inertInstance(canvas);
    }

    var buffer = gl.createBuffer();
    if (!buffer) {
      try { gl.deleteProgram(program); } catch (e) {}
      return inertInstance(canvas);
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);

    var U = {
      res: gl.getUniformLocation(program, 'uRes'),
      time: gl.getUniformLocation(program, 'uTime'),
      progress: gl.getUniformLocation(program, 'uProgress'),
      pointer: gl.getUniformLocation(program, 'uPointer'),
      pulsePos: gl.getUniformLocation(program, 'uPulsePos'),
      pulseTime: gl.getUniformLocation(program, 'uPulseTime'),
      pulseStrength: gl.getUniformLocation(program, 'uPulseStrength')
    };

    var state = {
      scroll: 0,
      targetScroll: 0,
      pointerX: 0,
      pointerY: 0,
      targetPointerX: 0,
      targetPointerY: 0,
      time: (typeof options.startTime === 'number' && isFinite(options.startTime)) ? options.startTime : 0,
      pulseStart: -1,
      pulsePos: [0, 0],
      pulseStrength: 0,
      cssW: 1,
      cssH: 1,
      renderW: 0,
      renderH: 0,
      raf: 0,
      running: false,
      lastNow: 0,
      lastPaint: 0,
      adaptive: options.adaptive !== false,
      budget: (typeof options.pixelBudget === 'number' && options.pixelBudget > 10000) ? options.pixelBudget : DEFAULT_BUDGET,
      perfFrames: 0,
      perfSum: 0,
      slowWindows: 0,
      downgrades: 0,
      maxScale: 0.90
    };

    if (typeof options.initialProgress === 'number' && isFinite(options.initialProgress)) {
      var ip = Math.max(0, Math.min(1, options.initialProgress));
      state.scroll = ip;
      state.targetScroll = ip;
    }

    var inst = {
      isLive: true,
      setScroll: function (progress) {
        var val = Number(progress);
        if (!isFinite(val)) return;
        state.targetScroll = Math.max(0, Math.min(1, val));
      },
      setPointer: function (nx, ny) {
        var x = Number(nx), y = Number(ny);
        if (!isFinite(x) || !isFinite(y)) return;
        state.targetPointerX = Math.max(-1, Math.min(1, x));
        state.targetPointerY = Math.max(-1, Math.min(1, y));
      },
      pulse: function (x, y, strength) {
        if (reduced) return;
        var s = (typeof strength === 'number' && isFinite(strength)) ? Math.max(0, Math.min(1, strength)) : 0.8;
        var sx = (typeof x === 'number' && isFinite(x)) ? x / Math.max(1, state.cssW) : 0.5;
        var sy = (typeof y === 'number' && isFinite(y)) ? y / Math.max(1, state.cssH) : 0.5;
        var aspect = state.cssW / state.cssH;
        state.pulsePos[0] = (sx - 0.5) * aspect;
        state.pulsePos[1] = 0.5 - sy;
        state.pulseStart = state.time;
        state.pulseStrength = Math.max(0.001, s);
      },
      resize: function () { resize(true); },
      destroy: function () { destroy(); }
    };
    try { canvas.__abyssInstance = inst; } catch (e) {}

    function computeSize() {
      var cssW = 0, cssH = 0;
      try {
        var rect = canvas.getBoundingClientRect();
        cssW = rect.width;
        cssH = rect.height;
      } catch (e) {}
      if (!cssW || !cssH) {
        cssW = win.innerWidth || 1;
        cssH = win.innerHeight || 1;
      }
      cssW = Math.max(1, cssW);
      cssH = Math.max(1, cssH);
      state.cssW = cssW;
      state.cssH = cssH;
      var dpr = Math.min(win.devicePixelRatio || 1, DPR_CAP);
      var portraitLimit = (cssH > cssW * 1.25) ? 0.84 : 0.90;
      var scale = Math.sqrt(state.budget / Math.max(1, cssW * cssH * dpr * dpr));
      scale = Math.min(portraitLimit, state.maxScale, scale);
      scale = Math.max(0.30, scale);
      var w = Math.max(2, Math.round(cssW * dpr * scale));
      var h = Math.max(2, Math.round(cssH * dpr * scale));
      if (canvas.width !== w) canvas.width = w;
      if (canvas.height !== h) canvas.height = h;
      state.renderW = w;
      state.renderH = h;
      try { gl.viewport(0, 0, w, h); } catch (e) {}
    }

    function resize(paintNow) {
      try {
        computeSize();
        if (paintNow) paint();
      } catch (e) {}
    }

    function draw(dt) {
      if (!state.running && dt !== 0) return;
      var time = state.time;
      var kS = 1 - Math.exp(-Math.max(0, dt) * 7.0);
      var kP = 1 - Math.exp(-Math.max(0, dt) * 5.0);
      state.scroll += (state.targetScroll - state.scroll) * kS;
      var tx = reduced ? 0 : state.targetPointerX;
      var ty = reduced ? 0 : state.targetPointerY;
      state.pointerX += (tx - state.pointerX) * kP;
      state.pointerY += (ty - state.pointerY) * kP;

      gl.useProgram(program);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.uniform2f(U.res, state.renderW, state.renderH);
      gl.uniform1f(U.time, time);
      gl.uniform1f(U.progress, state.scroll);
      gl.uniform2f(U.pointer, state.pointerX, state.pointerY);

      var pulseAge = -1;
      if (state.pulseStart >= 0) {
        pulseAge = time - state.pulseStart;
        if (pulseAge > 6 || pulseAge < 0) {
          pulseAge = -1;
          state.pulseStart = -1;
          state.pulseStrength = 0;
        }
      }
      gl.uniform2f(U.pulsePos, state.pulsePos[0], state.pulsePos[1]);
      gl.uniform1f(U.pulseTime, pulseAge);
      gl.uniform1f(U.pulseStrength, state.pulseStrength);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    function paint() {
      try { draw(0); } catch (e) {}
    }

    function frame(now) {
      if (!state.running) return;
      state.raf = win.requestAnimationFrame(frame);
      var dt = state.lastNow ? (now - state.lastNow) / 1000 : 0.016;
      state.lastNow = now;
      if (dt < 0) dt = 0.016;
      if (dt > 0.05) dt = 0.05;

      if (reduced) {
        if (now - state.lastPaint < 66) return;
        state.lastPaint = now;
      }

      state.time += dt * (reduced ? 0.10 : 1.0);

      if (state.adaptive && !reduced && state.time > 1.5) {
        state.perfFrames++;
        state.perfSum += dt;
        if (state.perfFrames >= 75) {
          var avg = state.perfSum / state.perfFrames;
          if (avg > 0.0215) {
            state.slowWindows++;
            if (state.slowWindows >= 1 && state.downgrades < 2) {
              state.budget = Math.max(650000, state.budget * 0.62);
              state.maxScale = Math.max(0.55, state.maxScale * 0.86);
              state.downgrades++;
              state.slowWindows = 0;
              resize(false);
            }
          } else {
            state.slowWindows = 0;
          }
          state.perfFrames = 0;
          state.perfSum = 0;
        }
      }

      try {
        draw(dt);
      } catch (e) {
        state.running = false;
        if (state.raf) win.cancelAnimationFrame(state.raf);
        inst.isLive = false;
      }
    }

    function start() {
      if (state.running || !inst.isLive) return;
      state.running = true;
      state.lastNow = 0;
      state.lastPaint = 0;
      state.raf = win.requestAnimationFrame(frame);
    }

    function stop() {
      state.running = false;
      if (state.raf) {
        win.cancelAnimationFrame(state.raf);
        state.raf = 0;
      }
    }

    function onVisibility() {
      if (doc.hidden) {
        stop();
      } else {
        state.lastNow = 0;
        state.lastPaint = 0;
        start();
      }
    }

    function onResize() {
      resize(false);
      paint();
    }

    function onContextLost(ev) {
      try { ev.preventDefault(); } catch (e) {}
      stop();
      inst.isLive = false;
    }

    function onContextRestored() {
      try {
        var restoredErr = { msg: '' };
        var nextProgram = makeProgram(gl, restoredErr);
        if (!nextProgram) {
          try { canvas.setAttribute('data-abyss-error', restoredErr.msg || 'context restore failed'); } catch (e) {}
          return;
        }
        var nextBuffer = gl.createBuffer();
        if (!nextBuffer) {
          gl.deleteProgram(nextProgram);
          return;
        }
        program = nextProgram;
        buffer = nextBuffer;
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
        U.res = gl.getUniformLocation(program, 'uRes');
        U.time = gl.getUniformLocation(program, 'uTime');
        U.progress = gl.getUniformLocation(program, 'uProgress');
        U.pointer = gl.getUniformLocation(program, 'uPointer');
        U.pulsePos = gl.getUniformLocation(program, 'uPulsePos');
        U.pulseTime = gl.getUniformLocation(program, 'uPulseTime');
        U.pulseStrength = gl.getUniformLocation(program, 'uPulseStrength');
        try { canvas.removeAttribute('data-abyss-error'); } catch (e) {}
        darkClear();
        inst.isLive = true;
        resize(true);
        start();
      } catch (e) {}
    }

    function onReducedChange(ev) {
      if (!reducedExplicit) {
        reduced = !!ev.matches;
        state.lastPaint = 0;
      }
    }

    function destroy() {
      stop();
      try {
        if (mq && mq.removeEventListener) mq.removeEventListener('change', onReducedChange);
        else if (mq && mq.removeListener) mq.removeListener(onReducedChange);
      } catch (e) {}
      try { win.removeEventListener('resize', onResize); } catch (e) {}
      try { doc.removeEventListener('visibilitychange', onVisibility); } catch (e) {}
      try { canvas.removeEventListener('webglcontextlost', onContextLost); } catch (e) {}
      try { canvas.removeEventListener('webglcontextrestored', onContextRestored); } catch (e) {}
      try {
        if (gl && !gl.isContextLost()) {
          gl.useProgram(null);
          if (buffer) gl.deleteBuffer(buffer);
          if (program) gl.deleteProgram(program);
        }
      } catch (e) {}
      buffer = null;
      program = null;
      inst.isLive = false;
      try { if (canvas.__abyssInstance === inst) delete canvas.__abyssInstance; } catch (e) {}
    }

    try {
      win.addEventListener('resize', onResize, { passive: true });
    } catch (e) {
      try { win.addEventListener('resize', onResize, false); } catch (e2) {}
    }
    try { doc.addEventListener('visibilitychange', onVisibility, false); } catch (e) {}
    try { canvas.addEventListener('webglcontextlost', onContextLost, false); } catch (e) {}
    try { canvas.addEventListener('webglcontextrestored', onContextRestored, false); } catch (e) {}
    try {
      if (mq) {
        if (mq.addEventListener) mq.addEventListener('change', onReducedChange);
        else if (mq.addListener) mq.addListener(onReducedChange);
      }
    } catch (e) {}

    try {
      computeSize();
      paint();
      start();
    } catch (e) {
      stop();
      inst.isLive = false;
    }

    return inst;
  }

  win.Abyss = { create: create };
})(window, document);