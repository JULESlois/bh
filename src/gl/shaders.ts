import { RS, R_PHOTON, R_ISCO, R_OUT, R_ESC, T_DISP, NT_PEAK, TIME_SCALE } from '../physics/constants'

/**
 * All shaders. The scene pass performs general-relativistic ray tracing:
 * for each pixel a photon is launched backwards from the camera and its
 * null geodesic in the Schwarzschild metric is integrated with RK4.
 *
 * Spherical symmetry confines every geodesic to the plane spanned by the
 * camera position and the ray direction. In that plane, with u = 1/r,
 * the photon orbit obeys the Binet equation
 *
 *      d²u/dφ² = 3·M·u² − u          (G = c = 1, M = 1, r_s = 2)
 *
 * which is exact — the full Schwarzschild null geodesic equation after
 * eliminating the affine parameter. Initial conditions are set for a
 * static observer at the camera (the √(1 − r_s/r) factor below), and the
 * conserved impact parameter about the disk axis feeds the exact
 * redshift factor g = √(1 − 3M/r) / (1 + Ω·b) of Keplerian disk matter.
 */

const CONSTS = `
#define RS ${RS.toFixed(1)}
#define R_PHOTON ${R_PHOTON.toFixed(1)}
#define R_ISCO ${R_ISCO.toFixed(1)}
#define R_OUT ${R_OUT.toFixed(1)}
#define R_ESC ${R_ESC.toFixed(1)}
#define T_DISP ${T_DISP.toFixed(1)}
#define NT_PEAK ${NT_PEAK}
#define TIME_SCALE ${TIME_SCALE.toFixed(1)}
#define PI 3.14159265359
`

export const VERT = `#version 300 es
out vec2 vUv;
void main() {
  // fullscreen triangle, no buffers
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}
`

export const SCENE_FRAG = `#version 300 es
precision highp float;
precision highp int;
in vec2 vUv;
out vec4 outColor;

uniform vec2 uRes;
uniform float uTime;
uniform vec3 uCamPos;
uniform vec3 uCamRight;
uniform vec3 uCamUp;
uniform vec3 uCamFwd;
uniform float uTanHalfFov;
uniform float uDiskGain;
uniform float uStarGain;
uniform float uFalseColor;
uniform float uMarkPhoton;
uniform float uMarkIsco;
uniform vec3 uCompanionDir;
uniform int uSteps;
uniform float uStepScale;

${CONSTS}

// ---------- hashes / noise ----------------------------------------------
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
vec3 hash33(vec3 p) {
  p = fract(p * vec3(0.1031, 0.1030, 0.0973));
  p += dot(p, p.yxz + 33.33);
  return fract((p.xxy + p.yxx) * p.zyx);
}
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash12(i);
  float b = hash12(i + vec2(1.0, 0.0));
  float c = hash12(i + vec2(0.0, 1.0));
  float d = hash12(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * vnoise(p);
    p = p * 2.13 + 7.7;
    a *= 0.5;
  }
  return v;
}

// value noise periodic in the first axis (lattice wraps at the period) —
// the disk is a ring, so its texture must have no seam in azimuth
float vnoiseP(float a, float y, float period) {
  float ia = floor(a), fa = fract(a);
  float iy = floor(y), fy = fract(y);
  fa = fa * fa * (3.0 - 2.0 * fa);
  fy = fy * fy * (3.0 - 2.0 * fy);
  float a0 = mod(ia, period), a1 = mod(ia + 1.0, period);
  float h00 = hash12(vec2(a0, iy)), h10 = hash12(vec2(a1, iy));
  float h01 = hash12(vec2(a0, iy + 1.0)), h11 = hash12(vec2(a1, iy + 1.0));
  return mix(mix(h00, h10, fa), mix(h01, h11, fa), fy);
}
float fbmDisk(float chi, float y, float B) {
  float v = 0.0, amp = 0.5;
  float a = chi * 0.15915494309; // chi / 2π
  for (int i = 0; i < 4; i++) {
    v += amp * vnoiseP(a * B, y, B);
    B *= 2.0;
    y = y * 2.0 + 7.7;
    amp *= 0.5;
  }
  return v;
}

// ---------- Planck blackbody ---------------------------------------------
// Spectral radiance at three wavelengths (R 610nm, G 549nm, B 468nm),
// normalized to luminance 1. Physically the Doppler factor maps a Planck
// spectrum at T to a Planck spectrum at g·T, so beaming, gravitational
// redshift and color shift are all handled by evaluating this at T_obs.
vec3 blackbody(float T) {
  T = clamp(T, 500.0, 40000.0);
  vec3 lam = vec3(0.610, 0.549, 0.468); // micrometres
  vec3 lam5 = lam * lam * lam * lam * lam;
  vec3 rad = 1.0 / (lam5 * (exp(vec3(14387.8) / (lam * T)) - 1.0));
  float lum = dot(rad, vec3(0.2126, 0.7152, 0.0722));
  return rad / max(lum, 1e-12);
}

// ---------- sky ------------------------------------------------------------
vec3 stars(vec3 d) {
  vec3 col = vec3(0.0);
  for (int s = 0; s < 2; s++) {
    float S = (s == 0) ? 52.0 : 104.0;
    vec3 q = d * S;
    vec3 base = floor(q - 0.5);
    for (int i = 0; i < 8; i++) {
      vec3 o = vec3(float(i & 1), float((i >> 1) & 1), float((i >> 2) & 1));
      vec3 id = base + o;
      vec3 h = hash33(id + S * 0.731);
      if (h.x < 0.10) {
        vec3 sp = normalize(id + 0.5 + (h - 0.5) * 0.9);
        float a = length(d - sp);
        float br = pow(h.y, 18.0) * 13.0 + pow(h.y, 5.0) * 0.5;
        float w = 0.0011 + 0.0028 * pow(h.z, 9.0);
        float T = mix(2600.0, 11500.0, h.z * h.z);
        col += blackbody(T) * (br * exp(-a * a / (2.0 * w * w)) * 0.09);
      }
    }
  }
  return col;
}

vec3 galaxy(vec3 d) {
  vec3 n = normalize(vec3(0.38, 0.55, 0.74));
  float bandC = dot(d, n);
  float band = exp(-bandC * bandC / 0.022);
  if (band < 0.003) return vec3(0.0);
  vec3 t1 = normalize(cross(n, vec3(0.0, 1.0, 0.0)));
  vec3 t2 = cross(n, t1);
  vec2 uv = vec2(atan(dot(d, t2), dot(d, t1)), bandC);
  float m = fbm(vec2(uv.x * 2.6, uv.y * 13.0));
  float dust = fbm(vec2(uv.x * 6.5 + 3.3, uv.y * 26.0));
  vec3 c = mix(vec3(1.0, 0.83, 0.66), vec3(0.62, 0.72, 1.0), m);
  float g = band * (0.3 + 0.7 * m) * 0.05;
  g *= 0.3 + 0.7 * smoothstep(0.72, 0.25, dust * band);
  return c * g;
}

vec3 sky(vec3 d) {
  vec3 c = stars(d) + galaxy(d) + vec3(0.0016, 0.0018, 0.0024);
  c *= uStarGain;
  // companion star — a real point source that can pass behind the hole
  float ca = max(dot(d, uCompanionDir), 0.0);
  vec3 cc = blackbody(9400.0);
  c += cc * (pow(ca, 90000.0) * 5.5 + pow(ca, 2500.0) * 0.06) * (0.5 + 0.5 * uStarGain);
  return c;
}

// ---------- false-color ramp for g ----------------------------------------
vec3 gRamp(float g) {
  float t = clamp((g - 1.0) / 0.38, -1.0, 1.0);
  vec3 mid = vec3(0.62, 0.60, 0.57);
  vec3 red = vec3(0.80, 0.08, 0.03);
  vec3 blu = vec3(0.05, 0.55, 0.95);
  return (t < 0.0) ? mix(mid, red, -t) : mix(mid, blu, t);
}

// ---------- disk shading ----------------------------------------------------
// hp: hit point in the equatorial plane; rC: its radius; bAxis: conserved
// impact parameter of this ray about the disk axis (traced-ray sign).
vec3 diskShade(vec3 hp, float rC, float bAxis, out float alpha) {
  float phiAz = atan(hp.z, hp.x);
  float Om = pow(1.0 / rC, 1.5);                       // Keplerian Ω = √(M/r³)
  float g = sqrt(max(1.0 - 3.0 / rC, 0.0)) / (1.0 + Om * bAxis);
  g = clamp(g, 0.06, 5.0);

  // Novikov–Thorne effective temperature, zero torque at ISCO
  float prof = pow(1.0 / rC, 0.75) * pow(max(1.0 - sqrt(R_ISCO / rC), 0.0), 0.25);
  float Tem = T_DISP * (prof / float(NT_PEAK));

  // turbulence sheared by differential rotation (inner annuli lap outer)
  float chi = phiAz - Om * uTime;
  float n1 = fbmDisk(chi, rC * 0.55, 9.0);
  float n2 = fbmDisk(chi + 2.1, rC * 1.7 + 13.1, 24.0);
  float dens = 0.60 + 0.52 * n1 + 0.28 * (n2 - 0.5);
  Tem *= mix(1.0, dens, 0.65);

  float Tobs = g * Tem;                                 // Planck at g·T
  float inten = pow(Tobs / T_DISP, 4.0);                // ∝ g⁴ T⁴
  vec3 phys = blackbody(Tobs) * inten * 0.62 * max(uDiskGain, 1.0);
  phys = mix(vec3(dot(phys, vec3(0.2126, 0.7152, 0.0722))), phys, 1.22);

  alpha = smoothstep(R_ISCO, R_ISCO + 0.8, rC) * (1.0 - smoothstep(R_OUT - 6.5, R_OUT, rC));
  alpha *= 0.55 + 0.45 * smoothstep(0.15, 0.75, n1);
  alpha = clamp(alpha, 0.0, 0.96) * clamp(uDiskGain, 0.0, 1.0);

  vec3 fc = gRamp(g) * (0.4 + 0.6 * smoothstep(0.1, 0.9, dens));
  return mix(phys, fc * 1.15, uFalseColor);
}

void main() {
  vec2 ndc = vUv * 2.0 - 1.0;
  float aspect = uRes.x / uRes.y;
  vec3 dir = normalize(uCamFwd + uTanHalfFov * (ndc.x * aspect * uCamRight + ndc.y * uCamUp));

  vec3 pos = uCamPos;
  float rr = length(pos);
  vec3 e1 = pos / rr;
  float vrad = dot(dir, e1);
  vec3 tv = dir - vrad * e1;
  float vt = length(tv);

  vec3 col = vec3(0.0);
  float trans = 1.0;

  if (vt < 1e-5) {
    // exactly radial ray: plunges or escapes with no deflection
    outColor = vec4(vrad > 0.0 ? sky(dir) : vec3(0.0), 1.0);
    return;
  }

  vec3 e2 = tv / vt;

  // exact initial conditions for a static observer at r = rr
  float u = 1.0 / rr;
  float w = -u * (vrad / vt) * sqrt(max(1.0 - RS * u, 1e-5));

  // conserved impact parameter about the disk axis (+Y), traced-ray sign
  float Efac = sqrt(max(1.0 - RS / rr, 1e-5));
  float bAxis = cross(pos, dir).y / Efac;

  float phi = 0.0;
  float Yc = e1.y, Ys = e2.y;      // plane height: Y(φ) = Yc·cosφ + Ys·sinφ, times r
  float Yprev = Yc;
  float uPrev = u;
  float wPrev = w;
  float phiPrev = 0.0;
  bool escaped = false;

  for (int i = 0; i < 768; i++) {
    if (i >= uSteps) break;

    float h = clamp(0.17 / (1.0 + 9.0 * u), 0.014, 0.20) * uStepScale;

    // RK4 on (u, w):  u' = w,  w' = 3u² − u   [Binet, Schwarzschild null geodesic]
    float k1u = w, k1w = 3.0 * u * u - u;
    float u2 = u + 0.5 * h * k1u, w2 = w + 0.5 * h * k1w;
    float k2u = w2, k2w = 3.0 * u2 * u2 - u2;
    float u3 = u + 0.5 * h * k2u, w3 = w + 0.5 * h * k2w;
    float k3u = w3, k3w = 3.0 * u3 * u3 - u3;
    float u4 = u + h * k3u, w4 = w + h * k3w;
    float k4u = w4, k4w = 3.0 * u4 * u4 - u4;
    u += h * (k1u + 2.0 * k2u + 2.0 * k3u + k4u) / 6.0;
    w += h * (k1w + 2.0 * k2w + 2.0 * k3w + k4w) / 6.0;
    phi += h;

    if (u > 1.0 / RS) break;                              // crossed the horizon
    if (u < 1.0 / R_ESC && w < 0.0) { escaped = true; break; }
    if (phi > 6.0 * PI) break;                            // wound up near photon sphere

    float cphi = cos(phi), sphi = sin(phi);
    float Ynow = Yc * cphi + Ys * sphi;

    if (Ynow * Yprev < 0.0) {
      // equatorial plane crossing. Y(φ) is analytic, so Newton-polish the
      // crossing angle, then take one RK4 substep of exactly that size —
      // kills radial banding from coarse far-field steps.
      float ft = Yprev / (Yprev - Ynow);
      float phiL = mix(phiPrev, phi, ft);
      float dY = -Yc * sin(phiL) + Ys * cos(phiL);
      phiL -= (Yc * cos(phiL) + Ys * sin(phiL)) / (abs(dY) > 1e-6 ? dY : 1e-6);
      float hr = clamp(phiL - phiPrev, 0.0, h);
      float ru = uPrev, rw = wPrev;
      float r1u = rw, r1w = 3.0 * ru * ru - ru;
      float ru2 = ru + 0.5 * hr * r1u, rw2 = rw + 0.5 * hr * r1w;
      float r2u = rw2, r2w = 3.0 * ru2 * ru2 - ru2;
      float ru3 = ru + 0.5 * hr * r2u, rw3 = rw + 0.5 * hr * r2w;
      float r3u = rw3, r3w = 3.0 * ru3 * ru3 - ru3;
      float ru4 = ru + hr * r3u, rw4 = rw + hr * r3w;
      float r4u = rw4;
      float uC = ru + hr * (r1u + 2.0 * r2u + 2.0 * r3u + r4u) / 6.0;
      float phiC = phiPrev + hr;
      float rC = 1.0 / uC;
      if (rC < R_OUT + 2.0) {
        vec3 hp = (cos(phiC) * e1 + sin(phiC) * e2) * rC;

        // annotation rings — ray-traced like everything else, so they lens
        if (uMarkPhoton > 0.001) {
          float m = 1.0 - smoothstep(0.02, 0.15, abs(rC - R_PHOTON));
          if (m > 0.0) {
            float dash = step(0.0, sin(atan(hp.z, hp.x) * 22.0));
            col += trans * vec3(0.35, 0.95, 0.88) * m * dash * uMarkPhoton * 2.6;
          }
        }
        if (uMarkIsco > 0.001) {
          float m = 1.0 - smoothstep(0.03, 0.20, abs(rC - R_ISCO));
          if (m > 0.0) {
            float dash = step(0.0, sin(atan(hp.z, hp.x) * 30.0));
            col += trans * vec3(0.35, 0.95, 0.88) * m * dash * uMarkIsco * 2.2;
          }
        }

        if (rC >= R_ISCO && rC <= R_OUT) {
          float alpha;
          vec3 em = diskShade(hp, rC, bAxis, alpha);
          col += trans * alpha * em;
          trans *= 1.0 - alpha;
          if (trans < 0.02) break;
        }
      }
    }

    Yprev = Ynow;
    uPrev = u;
    wPrev = w;
    phiPrev = phi;
  }

  if (escaped) {
    float cphi = cos(phi), sphi = sin(phi);
    vec3 er = cphi * e1 + sphi * e2;
    vec3 et = -sphi * e1 + cphi * e2;
    vec3 edir = normalize(-w * er + u * et);
    vec3 s = sky(edir);
    s *= mix(1.0, 0.12, uFalseColor);                     // sky recedes in false color
    col += trans * s;
  }
  // captured rays keep whatever the disk contributed; the remainder is
  // the shadow — genuinely the darkest thing on this screen.

  outColor = vec4(col, 1.0);
}
`

export const BRIGHT_FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uTex;
void main() {
  vec3 c = texture(uTex, vUv).rgb;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  float k = max(l - 0.55, 0.0);
  k = k * k / (k + 0.6);
  outColor = vec4(c * (k / max(l, 1e-4)), 1.0);
}
`

export const BLUR_FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uTex;
uniform vec2 uDir; // texel-scaled blur direction
void main() {
  float w[5] = float[](0.227027, 0.1945946, 0.1216216, 0.054054, 0.016216);
  vec3 c = texture(uTex, vUv).rgb * w[0];
  for (int i = 1; i < 5; i++) {
    vec2 o = uDir * float(i);
    c += texture(uTex, vUv + o).rgb * w[i];
    c += texture(uTex, vUv - o).rgb * w[i];
  }
  outColor = vec4(c, 1.0);
}
`

export const COMPOSITE_FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uScene;
uniform sampler2D uBloom;
uniform vec2 uRes;
uniform float uTime;
uniform float uExposure;

vec3 aces(vec3 x) {
  const float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

void main() {
  vec2 c = vUv - 0.5;
  float r2 = dot(c, c);

  // faint physical-feeling chromatic aberration toward the frame edge
  float ca = 0.0035 * r2;
  vec3 scene;
  scene.r = texture(uScene, vUv + c * ca).r;
  scene.g = texture(uScene, vUv).g;
  scene.b = texture(uScene, vUv - c * ca).b;

  vec3 bloom = texture(uBloom, vUv).rgb;
  vec3 col = scene + bloom * 0.85;

  col *= uExposure;
  col *= 1.0 - 0.42 * smoothstep(0.12, 0.62, r2);        // vignette
  col = aces(col);
  col = pow(col, vec3(1.0 / 2.2));

  // dithering grain kills banding in the deep sky
  float g = hash12(vUv * uRes + fract(uTime) * 61.7) - 0.5;
  col += g * 0.012;

  outColor = vec4(col, 1.0);
}
`
