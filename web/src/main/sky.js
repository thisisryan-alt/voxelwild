// Time of day and the single-scattering sky model (port of Rendering.SkyModel + TimeOfDay). The same model is drawn
// by the sky shader and used here for sunlight colour, hemisphere ambient and fog colour, so lighting matches the sky.
import { smoothstep, lerp, saturate } from '../shared/noise.js';

export const SKY = {
  R: 6360e3, RA: 6420e3, HR: 8000, HM: 1200,
  betaR: [5.802e-6, 13.558e-6, 33.1e-6], mieScat: 3.996e-6, mieExt: 4.4e-6, g: 0.8, sun: 20, exposure: 0.4,
};

function raySphere(o, d, r) {
  const b = o[0] * d[0] + o[1] * d[1] + o[2] * d[2];
  const c = o[0] * o[0] + o[1] * o[1] + o[2] * o[2] - r * r;
  const disc = b * b - c;
  if (disc < 0) return [-1, -1];
  const s = Math.sqrt(disc);
  return [-b - s, -b + s];
}
function lightDepth(p, d, steps) {
  if (raySphere(p, d, SKY.R)[0] > 0) return null;
  const t = raySphere(p, d, SKY.RA)[1], ds = t / steps;
  let r = 0, m = 0;
  for (let i = 0; i < steps; i++) {
    const s = ds * (i + 0.5);
    const h = Math.hypot(p[0] + d[0] * s, p[1] + d[1] * s, p[2] + d[2] * s) - SKY.R;
    r += Math.exp(-h / SKY.HR) * ds; m += Math.exp(-h / SKY.HM) * ds;
  }
  return [r, m];
}
export function sunTransmittance(sun, alt = 100) {
  const od = lightDepth([0, SKY.R + alt, 0], sun, 16);
  if (!od) return [0, 0, 0];
  return SKY.betaR.map((b) => Math.exp(-(b * od[0] + SKY.mieExt * od[1])));
}
export function skyRadiance(v, sun, alt = 100, steps = 10) {
  const o = [0, SKY.R + alt, 0];
  let tMax = raySphere(o, v, SKY.RA)[1];
  const g = raySphere(o, v, SKY.R);
  if (g[0] > 0) tMax = g[0];
  const ds = tMax / steps;
  let odR = 0, odM = 0;
  const sR = [0, 0, 0], sM = [0, 0, 0];
  for (let i = 0; i < steps; i++) {
    const s = ds * (i + 0.5);
    const p = [o[0] + v[0] * s, o[1] + v[1] * s, o[2] + v[2] * s];
    const h = Math.hypot(p[0], p[1], p[2]) - SKY.R;
    const dR = Math.exp(-h / SKY.HR) * ds, dM = Math.exp(-h / SKY.HM) * ds;
    odR += dR; odM += dM;
    const ol = lightDepth(p, sun, 4);
    if (!ol) continue;
    for (let c = 0; c < 3; c++) {
      const att = Math.exp(-(SKY.betaR[c] * (odR + ol[0]) + SKY.mieExt * (odM + ol[1])));
      sR[c] += dR * att; sM[c] += dM * att;
    }
  }
  const mu = v[0] * sun[0] + v[1] * sun[1] + v[2] * sun[2];
  const pR = 3 / (16 * Math.PI) * (1 + mu * mu);
  const g2 = SKY.g * SKY.g;
  const pM = 3 / (8 * Math.PI) * ((1 - g2) * (1 + mu * mu)) / ((2 + g2) * Math.pow(Math.max(1 + g2 - 2 * SKY.g * mu, 1e-4), 1.5));
  return [0, 1, 2].map((c) => SKY.exposure * SKY.sun * (sR[c] * SKY.betaR[c] * pR + sM[c] * SKY.mieScat * pM));
}

export function sunDirectionAt(hour, tilt = 32) {
  const h = (hour / 24) * Math.PI * 2 - Math.PI, t = tilt * Math.PI / 180;
  const v = [Math.sin(h), Math.cos(h) * Math.cos(t), Math.cos(h) * Math.sin(t)];
  const l = Math.hypot(...v);
  return v.map((x) => x / l);
}

/** Tileable cloud noise (R shapes, G detail) as RGBA8 pixels. */
export function cloudNoise(size, seed) {
  const px = new Uint8Array(size * size * 4);
  const lattice = (freq, s) => {
    const g = new Float32Array(freq * freq);
    let a = s >>> 0;
    for (let i = 0; i < g.length; i++) { a = (a + 0x6D2B79F5) >>> 0; let t = Math.imul(a ^ (a >>> 15), a | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); g[i] = ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
    return (u, v) => {
      const x = u * freq, y = v * freq, x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
      const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
      const at = (i, j) => g[((i % freq) + freq) % freq + (((j % freq) + freq) % freq) * freq];
      return lerp(lerp(at(x0, y0), at(x0 + 1, y0), sx), lerp(at(x0, y0 + 1), at(x0 + 1, y0 + 1), sx), sy);
    };
  };
  const octs = [4, 8, 16, 32, 64].map((f, i) => lattice(f, seed + i * 977));
  const det = [16, 32, 64, 128].map((f, i) => lattice(f, seed + 5000 + i * 131));
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size, v = y / size;
    let s = 0, amp = 0.5, n = 0;
    octs.forEach((f, i) => { let val = f(u, v); if (i > 0) val = 1 - Math.abs(val * 2 - 1) * 0.8; s += val * amp; n += amp; amp *= 0.5; });
    let d = 0; amp = 0.5; let nd = 0;
    det.forEach((f) => { d += f(u, v) * amp; nd += amp; amp *= 0.5; });
    const o = (x + y * size) * 4;
    px[o] = Math.round(saturate((s / n - 0.2) / 0.6) * 255); px[o + 1] = Math.round(saturate(d / nd) * 255); px[o + 2] = 0; px[o + 3] = 255;
  }
  return px;
}

/** Everything the renderer needs about the sky and light at an hour of a day. */
export class TimeOfDay {
  constructor() {
    this.hour = 8; this.day = 0; this.running = true; this.dayMinutes = 20; this.lunarDays = 8;
    this.state = {};
    this.nextAmbient = 0;
    this.update(0, { cloudCover: 0.4, sunDim: 1 });
  }

  advance(dt) {
    if (!this.running) return;
    this.hour += dt * 24 / (this.dayMinutes * 60);
    if (this.hour >= 24) { this.hour -= 24; this.day++; }
  }

  update(time, weather) {
    const sun = sunDirectionAt(this.hour);
    const phase = ((this.day + this.hour / 24) / this.lunarDays) % 1;
    const moon = sunDirectionAt(this.hour - phase * 24);
    const illum = (1 - Math.cos(phase * Math.PI * 2)) * 0.5;
    const sunWeight = smoothstep(-0.05, 0.04, sun[1]);
    const daylight = smoothstep(-0.1, 0.15, sun[1]);
    const trans = sunTransmittance(sun);
    const peak = Math.max(...trans, 1e-4);
    const useSun = sunWeight >= 0.5 || moon[1] < 0;
    const lightScale = SKY.exposure * SKY.sun / Math.PI;
    const dim = weather.sunDim;
    let lightDir, lightColor;
    if (useSun) { lightDir = sun; lightColor = trans.map((c) => c * lightScale * sunWeight * dim); }
    else {
      lightDir = moon;
      const k = 0.32 * illum * smoothstep(-0.02, 0.12, moon[1]) * (1 - sunWeight) * dim;
      lightColor = [0.62 * k, 0.72 * k, 1.0 * k];
    }
    const s = this.state;
    s.sun = sun; s.moon = moon; s.illum = illum; s.daylight = daylight; s.sunWeight = sunWeight;
    s.lightDir = lightDir; s.lightColor = lightColor; s.lightIsSun = useSun;
    s.sunVisible = smoothstep(-0.03, 0.01, sun[1]);
    s.starRot = (this.day + this.hour / 24) * Math.PI * 2 * 1.0027;
    s.exposure = lerp(1.0, 2.6, 1 - daylight);

    if (time >= this.nextAmbient || !s.ambUp) {
      this.nextAmbient = time + 0.3;
      const night = [0.010, 0.014, 0.028];
      const moonAmb = [0.62, 0.72, 1].map((c) => c * 0.04 * illum * saturate(moon[1] * 3));
      const zenith = skyRadiance([0, 1, 0], sun, 100, 8);
      let horizon = [0, 0, 0];
      for (let k = 0; k < 6; k++) {
        const a = k * Math.PI / 3, e = 6 * Math.PI / 180;
        const r = skyRadiance([Math.cos(a) * Math.cos(e), Math.sin(e), Math.sin(a) * Math.cos(e)], sun, 100, 8);
        horizon = horizon.map((v, i) => v + r[i] / 6);
      }
      // upper-hemisphere average ~ blend of zenith and horizon; ground bounce from sun + sky on 22% albedo
      const up = zenith.map((z, i) => (z * 0.45 + horizon[i] * 0.55));
      const ground = trans.map((t, i) => 0.22 * (t * SKY.sun * SKY.exposure * saturate(sun[1]) / Math.PI + up[i]));
      const cloudGrey = weather.cloudCover * 0.6;
      const mixGrey = (c) => { const l = (c[0] + c[1] + c[2]) / 3; return c.map((v) => lerp(v, l, cloudGrey) * (1 - weather.cloudCover * 0.35)); };
      s.ambUp = mixGrey(up).map((v, i) => v + night[i] + moonAmb[i]);
      s.ambHorizon = mixGrey(horizon).map((v, i) => v + night[i] * 0.8 + moonAmb[i] * 0.8);
      s.ambDown = ground.map((v, i) => v * (1 - weather.cloudCover * 0.3) + night[i] * 0.4);
      s.fogColor = mixGrey(horizon).map((v, i) => v + night[i] * 1.2 + moonAmb[i]);
      s.fogSun = trans.map((t) => t * sunWeight * SKY.exposure * 1.5 * dim);
      s.sunColorClouds = trans.map((t, i) => t * lightScale * 0.9 * sunWeight + moonAmb[i] * 8);
      s.zenith = zenith.map((v, i) => v + night[i] * 3);
      s.skyDirty = true;
    }
    return s;
  }
}
