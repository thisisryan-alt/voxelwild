// Port of Audio.SoundSynth + GameAudio: every sound synthesised from noise and sines (no audio files), played
// through WebAudio with a master/SFX/ambience mix. Ambience beds cross-fade with the environment.
import { B, isWater } from '../shared/blocks.js';

const SR = 32000, TAU = Math.PI * 2;
export const Surface = { Grass: 0, Dirt: 1, Stone: 2, Sand: 3, Gravel: 4, Wood: 5, Leaves: 6, Snow: 7, Glass: 8, Water: 9 };

export function surfaceFor(b) {
  if (isWater(b)) return Surface.Water;
  switch (b) {
    case B.Grass: case B.SnowyGrass: case B.Moss: case B.TallGrass: case B.FlowerRed: case B.FlowerYellow: case B.DeadBush: case B.Glowcap: case B.Cactus:
      return Surface.Grass;
    case B.Dirt: case B.Mud: return Surface.Dirt;
    case B.Sand: return Surface.Sand;
    case B.Gravel: return Surface.Gravel;
    case B.Snow: return Surface.Snow;
    case B.Ice: return Surface.Glass;
    case B.Planks: case B.OakLog: case B.BirchLog: case B.SpruceLog: case B.JungleLog: case B.Torch: return Surface.Wood;
    case B.OakLeaves: case B.BirchLeaves: case B.SpruceLeaves: case B.JungleLeaves: return Surface.Leaves;
    default: return Surface.Stone;
  }
}

class Rng {
  constructor(seed) { this.s = (Math.imul(seed >>> 0, 747796405) + 2891336453) >>> 0 || 1; }
  next() { let s = this.s; s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; this.s = s >>> 0; return (this.s >>> 8) / 16777216; }
  signed() { return this.next() * 2 - 1; }
  range(a, b) { return a + (b - a) * this.next(); }
}
const coef = (hz) => 1 - Math.exp(-TAU * Math.min(hz, SR * 0.45) / SR);
const V = (o) => ({ length: 0.2, hp: 100, lp: 4000, attack: 0.005, decay: 0.05, noise: 1, grains: 0, grainDecay: 0, tone: 0, toneDecay: 0.05, toneAmp: 0, toneDrop: 0, ...o });
function stepVoice(s) {
  switch (s) {
    case Surface.Grass: return V({ length: 0.22, hp: 1400, lp: 7000, attack: 0.006, decay: 0.06, noise: 0.5, grains: 900, grainDecay: 0.003 });
    case Surface.Dirt: return V({ length: 0.18, hp: 90, lp: 1300, attack: 0.003, decay: 0.045, noise: 1, grains: 200, grainDecay: 0.004, tone: 95, toneDecay: 0.04, toneAmp: 0.35, toneDrop: 0.3 });
    case Surface.Stone: return V({ length: 0.14, hp: 700, lp: 4200, attack: 0.001, decay: 0.028, noise: 1, grains: 120, grainDecay: 0.002, tone: 240, toneDecay: 0.02, toneAmp: 0.2 });
    case Surface.Sand: return V({ length: 0.3, hp: 500, lp: 3800, attack: 0.03, decay: 0.09, noise: 0.8, grains: 500, grainDecay: 0.002 });
    case Surface.Gravel: return V({ length: 0.26, hp: 400, lp: 5200, attack: 0.008, decay: 0.07, noise: 0.4, grains: 1400, grainDecay: 0.005 });
    case Surface.Wood: return V({ length: 0.2, hp: 150, lp: 2600, attack: 0.001, decay: 0.03, noise: 0.6, tone: 190, toneDecay: 0.07, toneAmp: 0.8, toneDrop: 0.08 });
    case Surface.Leaves: return V({ length: 0.32, hp: 2200, lp: 9000, attack: 0.02, decay: 0.1, noise: 0.6, grains: 700, grainDecay: 0.006 });
    case Surface.Snow: return V({ length: 0.28, hp: 300, lp: 2600, attack: 0.02, decay: 0.08, noise: 0.3, grains: 1800, grainDecay: 0.004 });
    case Surface.Glass: return V({ length: 0.2, hp: 2500, lp: 9000, attack: 0.001, decay: 0.015, noise: 0.7, tone: 2600, toneDecay: 0.06, toneAmp: 0.35 });
    default: return V({ length: 0.35, hp: 350, lp: 2600, attack: 0.01, decay: 0.12, noise: 1, grains: 300, grainDecay: 0.01 });
  }
}
function fadeOut(o, sec) { const n = Math.min(o.length, Math.floor(sec * SR)); for (let i = 0; i < n; i++) o[o.length - 1 - i] *= i / n; }
function normalize(o, peak) { let m = 0; for (const v of o) m = Math.max(m, Math.abs(v)); if (m < 1e-9) return o; const k = peak / m; for (let i = 0; i < o.length; i++) o[i] *= k; return o; }
function render(v, seed, pitch) {
  const n = Math.floor(v.length * SR), o = new Float32Array(n), rng = new Rng(seed);
  const aL = coef(v.lp * pitch), aH = coef(v.hp * pitch);
  let lp = 0, hp = 0, grain = 0, phase = 0;
  const gm = v.grainDecay > 0 ? Math.exp(-1 / (v.grainDecay * SR)) : 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const env = t < v.attack ? t / v.attack : Math.exp(-(t - v.attack) / v.decay);
    if (v.grains > 0 && rng.next() < v.grains / SR) grain = rng.range(0.4, 1);
    const x = rng.signed() * (v.noise * env + grain);
    grain *= gm;
    lp += aL * (x - lp); hp += aH * (lp - hp);
    let s = lp - hp;
    if (v.toneAmp > 0) {
      const f = v.tone * pitch * (1 - v.toneDrop * Math.min(t / 0.1, 1));
      phase += TAU * f / SR;
      s += v.toneAmp * Math.sin(phase) * Math.exp(-t / v.toneDecay) * (t < 0.002 ? t / 0.002 : 1);
    }
    o[i] = s;
  }
  fadeOut(o, 0.01);
  return normalize(o, 0.8);
}
const pitchOf = (seed, spread) => 1 + new Rng(seed ^ 0x9E3779B9).signed() * spread;

const SYNTH = {
  step: (s, k) => render(stepVoice(s), k * 7919 + s * 104729 + 1, pitchOf(k, 0.08)),
  break: (s, k) => { const v = stepVoice(s); v.length *= 1.8; v.decay *= 2.2; v.grains = v.grains * 1.5 + 300; v.grainDecay = Math.max(v.grainDecay, 0.004); v.noise = Math.max(v.noise, 0.6); return render(v, k * 31337 + s * 7 + 11, pitchOf(k + 99, 0.06) * 0.8); },
  hit: (s, k) => { const v = stepVoice(s); v.length = Math.min(v.length, 0.12); v.decay *= 0.6; v.attack = 0.001; return render(v, k * 4099 + s * 13 + 5, pitchOf(k + 7, 0.05) * 1.15); },
  place: (s, k) => { const v = stepVoice(s); v.length = 0.12; v.attack = 0.001; v.decay = 0.025; v.lp *= 0.7; v.tone = v.tone > 0 ? v.tone : 150; v.toneAmp = Math.max(v.toneAmp, 0.4); v.toneDecay = 0.03; return render(v, k * 211 + s * 3 + 17, pitchOf(k + 3, 0.05)); },
  splash: (k) => {
    const n = Math.floor(0.9 * SR), o = new Float32Array(n), rng = new Rng(k * 977 + 41);
    const aL = coef(3200), aH = coef(300); let lp = 0, hp = 0;
    for (let i = 0; i < n; i++) { const t = i / SR; const env = Math.min(t / 0.01, 1) * Math.exp(-t / 0.18); lp += aL * (rng.signed() - lp); hp += aH * (lp - hp); o[i] = (lp - hp) * env; }
    for (let b = 0; b < 7; b++) bubble(o, rng.range(0.05, 0.6), rng.range(500, 1400), 0.25, rng);
    fadeOut(o, 0.05); return normalize(o, 0.8);
  },
  hurt: (k) => {
    const n = Math.floor(0.25 * SR), o = new Float32Array(n), rng = new Rng(k * 131 + 7), aL = coef(700); let lp = 0, ph = 0;
    for (let i = 0; i < n; i++) { const t = i / SR; lp += aL * (rng.signed() - lp); ph += TAU * (140 - 60 * Math.min(t / 0.2, 1)) / SR; o[i] = (Math.sin(ph) * 0.9 + lp * 0.8) * Math.min(t / 0.003, 1) * Math.exp(-t / 0.06); }
    fadeOut(o, 0.02); return normalize(o, 0.8);
  },
  orb: () => {
    // a small bright chime, like picking up experience
    const n = Math.floor(0.25 * SR), o = new Float32Array(n);
    for (let i = 0; i < n; i++) { const t = i / SR; o[i] = (Math.sin(TAU * 1760 * t) * 0.6 + Math.sin(TAU * 2637 * t) * 0.3 + Math.sin(TAU * 3520 * t) * 0.1) * Math.min(t / 0.003, 1) * Math.exp(-t / 0.07); }
    fadeOut(o, 0.02); return normalize(o, 0.4);
  },
  levelUp: () => {
    // a rising three-note arpeggio
    const n = Math.floor(0.9 * SR), o = new Float32Array(n);
    [[0, 784], [0.12, 988], [0.24, 1319]].forEach(([at, f]) => { for (let i = Math.floor(at * SR); i < n; i++) { const t = i / SR - at; o[i] += (Math.sin(TAU * f * t) + Math.sin(TAU * f * 2 * t) * 0.3) * Math.min(t / 0.005, 1) * Math.exp(-t / 0.25) * 0.5; } });
    fadeOut(o, 0.05); return normalize(o, 0.55);
  },
  enchant: () => {
    // a shimmering swell of detuned high partials
    const n = Math.floor(1.4 * SR), o = new Float32Array(n), fs = [1046, 1318, 1568, 2093, 2637];
    for (let i = 0; i < n; i++) { const t = i / SR, env = Math.min(t / 0.25, 1) * Math.exp(-Math.max(0, t - 0.25) / 0.35); let v = 0; for (let k = 0; k < fs.length; k++) v += Math.sin(TAU * fs[k] * t * (1 + 0.003 * Math.sin(TAU * (5 + k) * t))) * Math.sin(TAU * (3 + k * 1.7) * t + k) ** 2; o[i] = v * env / fs.length; }
    fadeOut(o, 0.05); return normalize(o, 0.5);
  },
  anvil: () => {
    // a ringing metal clang
    const n = Math.floor(0.8 * SR), o = new Float32Array(n), fs = [523, 1187, 1797, 2531, 3302];
    for (let i = 0; i < n; i++) { const t = i / SR; let v = 0; for (let k = 0; k < fs.length; k++) v += Math.sin(TAU * fs[k] * t) * Math.exp(-t / (0.25 / (1 + k * 0.6))) / (1 + k * 0.5); o[i] = v * Math.min(t / 0.001, 1); }
    fadeOut(o, 0.05); return normalize(o, 0.6);
  },
  bossLoop: () => {
    // four bars of a driving minor riff at 140 bpm: bass ostinato, kick, clap, hats and a dark pad
    const beat = 60 / 140, n = Math.floor(16 * beat * SR), o = new Float32Array(n), rng = new Rng(4242), e8 = beat / 2;
    const riff = [0, 0, 12, 0, 3, 0, 10, 7, 0, 0, 12, 0, 8, 7, 5, 3], chords = [[0, 3, 7], [-4, 0, 3], [-7, -3, 0], [-5, -1, 2]];
    const hz = (semi, base) => base * Math.pow(2, semi / 12);
    for (let s = 0; s < 32; s++) {
      const at = Math.floor(s * e8 * SR), f = hz(riff[s % 16] + (s >= 16 && s % 16 >= 12 ? -2 : 0), 55), len = Math.floor(e8 * SR);
      let lp = 0; const a = coef(900);
      for (let i = 0; i < len && at + i < n; i++) {
        const t = i / SR, ph = f * t;
        const saw = 2 * (ph - Math.floor(ph + 0.5)) + 0.5 * (2 * (ph * 1.005 - Math.floor(ph * 1.005 + 0.5)));
        lp += a * (saw - lp);
        o[at + i] += lp * 0.55 * Math.min(t / 0.004, 1) * Math.exp(-t / 0.18);
      }
    }
    for (let q = 0; q < 16; q++) {
      const at = Math.floor(q * beat * SR);
      // kick on every beat
      let ph = 0;
      for (let i = 0; i < 0.3 * SR && at + i < n; i++) { const t = i / SR; ph += TAU * (45 + 90 * Math.exp(-t / 0.03)) / SR; o[at + i] += Math.sin(ph) * Math.exp(-t / 0.13) * 0.9; }
      // a clap on 2 and 4
      if (q % 2 === 1) { let lp = 0, hp = 0; const aL = coef(2600), aH = coef(700); for (let i = 0; i < 0.22 * SR && at + i < n; i++) { const t = i / SR; lp += aL * (rng.signed() - lp); hp += aH * (lp - hp); o[at + i] += (lp - hp) * Math.exp(-t / 0.06) * 1.2; } }
      // hats on the off-beats
      const ah = Math.floor((q + 0.5) * beat * SR); let hp2 = 0; const aH2 = coef(7000);
      for (let i = 0; i < 0.05 * SR && ah + i < n; i++) { const x = rng.signed(); hp2 += aH2 * (x - hp2); o[ah + i] += (x - hp2) * Math.exp(-i / SR / 0.015) * 0.25; }
    }
    for (let bar = 0; bar < 4; bar++) {
      const at = Math.floor(bar * 4 * beat * SR), len = Math.floor(4 * beat * SR);
      for (const semi of chords[bar]) {
        const f = hz(semi, 220);
        for (let i = 0; i < len && at + i < n; i++) { const t = i / SR; o[at + i] += (Math.sin(TAU * f * t) + Math.sin(TAU * f * 1.004 * t) * 0.7) * 0.06 * Math.min(t / 0.3, 1) * Math.min((len - i) / SR / 0.2, 1) * (0.75 + 0.25 * Math.sin(TAU * 4 * t)); }
      }
    }
    return normalize(o, 0.75);
  },
  pop: () => {
    const n = Math.floor(0.09 * SR), o = new Float32Array(n); let ph = 0;
    for (let i = 0; i < n; i++) { const t = i / SR; ph += TAU * (650 + 900 * t / 0.09) / SR; o[i] = Math.sin(ph) * Math.min(t / 0.004, 1) * Math.exp(-t / 0.03); }
    fadeOut(o, 0.01); return normalize(o, 0.5);
  },
  click: () => {
    const n = Math.floor(0.04 * SR), o = new Float32Array(n);
    for (let i = 0; i < n; i++) { const t = i / SR; o[i] = (Math.sin(TAU * 2200 * t) * 0.7 + Math.sin(TAU * 3300 * t) * 0.3) * Math.exp(-t / 0.008); }
    fadeOut(o, 0.005); return normalize(o, 0.45);
  },
  eat: (k) => {
    // three crunchy bites
    const o = new Float32Array(Math.floor(0.7 * SR)), rng = new Rng(k * 71 + 3);
    for (let b = 0; b < 3; b++) {
      const s = render(V({ length: 0.12, hp: 600, lp: 3500, attack: 0.002, decay: 0.03, noise: 0.8, grains: 900, grainDecay: 0.003 }), k * 13 + b, rng.range(0.9, 1.1));
      o.set(s.subarray(0, Math.min(s.length, o.length - Math.floor(b * 0.22 * SR))), Math.floor(b * 0.22 * SR));
    }
    return normalize(o, 0.6);
  },
  thunder: (k, near) => {
    const length = near ? 7 : 8, n = Math.floor(length * SR), o = new Float32Array(n), rng = new Rng(Math.imul(k, 2654435761) + 3);
    const sw = 4 + Math.floor(rng.next() * 3), at = [], wd = [], am = [];
    for (let i = 0; i < sw; i++) { at.push((near ? 0.1 : 0.5) + rng.next() * 3.2); wd.push(rng.range(0.3, 1.3)); am.push(rng.range(0.5, 1)); }
    const aL = coef(near ? 320 : 160), aL2 = coef(near ? 900 : 350), aC = coef(3000);
    let brown = 0, lp = 0, lp2 = 0, cl = 0;
    for (let i = 0; i < n; i++) {
      const t = i / SR; let env = 0;
      for (let j = 0; j < sw; j++) { const d = (t - at[j]) / wd[j]; env += am[j] * Math.exp(-d * d); }
      env *= Math.exp(-t / 3.5) * Math.min(t / 0.05, 1);
      const w = rng.signed();
      brown = brown * 0.995 + w * 0.1; lp += aL * (brown - lp); lp2 += aL2 * (w - lp2);
      let s = lp * 3 * env + lp2 * 0.15 * env;
      if (near && t < 0.35) { cl += aC * (w - cl); s += (w - cl) * Math.exp(-t / 0.06) * 1.2; }
      o[i] = s;
    }
    fadeOut(o, 1.5); return normalize(o, 0.9);
  },
};
function bubble(o, start, f0, vol, rng) {
  const s = Math.floor(start * SR), n = Math.floor(0.08 * SR), rise = rng.range(1, 3); let ph = 0;
  for (let i = 0; i < n && s + i < o.length; i++) { const t = i / SR; ph += TAU * f0 * (1 + rise * t / 0.08) / SR; o[s + i] += Math.sin(ph) * Math.exp(-t / 0.02) * vol; }
}

// ---------------------------------------------------------------- ambience loops
function makeLoop(seconds, seed, fill) {
  const n = Math.floor(seconds * SR), f = Math.floor(0.5 * SR);
  const raw = new Float32Array(n + f), rng = new Rng(Math.imul(seed, 2246822519) + 19);
  fill(raw, rng);
  const o = raw.slice(0, n);
  for (let i = 0; i < f; i++) { const w = i / f; o[i] = raw[i] * w + raw[n + i] * (1 - w); }
  return normalize(o, 0.7);
}
const BEDS = {
  wind: () => makeLoop(10, 1, (o, rng) => {
    let brown = 0, lp = 0, lp2 = 0; const g1 = rng.range(0, 6), g2 = rng.range(0, 6), g3 = rng.range(0, 6), c2 = coef(90);
    for (let i = 0; i < o.length; i++) {
      const t = i / SR, gust = 0.55 + 0.25 * Math.sin(t * 0.63 + g1) + 0.15 * Math.sin(t * 1.37 + g2) + 0.08 * Math.sin(t * 2.9 + g3);
      const w = rng.signed(); brown = brown * 0.998 + w * 0.05;
      lp += coef(200 + 500 * gust) * (w - lp); lp2 += c2 * (brown - lp2);
      o[i] = (lp * 0.6 + lp2 * 2.5) * gust;
    }
  }),
  rain: () => makeLoop(6, 1, (o, rng) => {
    let lp = 0, hp = 0, drop = 0, dl = 0; const aL = coef(6500), aH = coef(900), aD = coef(2500);
    for (let i = 0; i < o.length; i++) {
      const w = rng.signed(); lp += aL * (w - lp); hp += aH * (lp - hp);
      if (rng.next() < 90 / SR) drop = rng.range(0.5, 1.5);
      dl += aD * (rng.signed() * drop - dl); drop *= 0.9985 ** (44100 / SR);
      o[i] = (lp - hp) * 0.6 + dl * 0.5;
    }
  }),
  birds: () => makeLoop(14, 1, (o, rng) => {
    const secs = o.length / SR; let t = rng.range(0.2, 1);
    while (t < secs - 1.5) {
      const chirps = 2 + Math.floor(rng.next() * 5), f0 = rng.range(2200, 4800), sweep = rng.range(-0.5, 0.6), len = rng.range(0.05, 0.14), gap = rng.range(0.06, 0.16), vol = rng.range(0.25, 0.8);
      for (let c = 0; c < chirps; c++) {
        const s = Math.floor(t * SR), n = Math.floor(len * SR), ff = f0 * rng.range(0.95, 1.05); let ph = 0;
        for (let i = 0; i < n && s + i < o.length; i++) { const u = i / n; ph += TAU * ff * (1 + sweep * u) / SR; const env = Math.sin(Math.PI * u); o[s + i] += (Math.sin(ph) + 0.2 * Math.sin(2 * ph)) * env * env * vol; }
        t += len + gap;
      }
      t += rng.range(0.6, 2.4);
    }
  }),
  crickets: () => makeLoop(6, 1, (o, rng) => {
    for (let k = 0; k < 3; k++) {
      const car = rng.range(4200, 5200), pr = rng.range(28, 40), cr = rng.range(1.4, 2.6), pulses = 3 + Math.floor(rng.next() * 3), off = rng.range(0, 1), vol = rng.range(0.3, 0.7);
      for (let i = 0; i < o.length; i++) {
        const t = i / SR, cp = (t * cr + off) % 1, pp0 = cp * pr / cr;
        if (pp0 >= pulses) continue;
        const pp = pp0 % 1, gate = pp < 0.6 ? Math.sin(Math.PI * pp / 0.6) : 0;
        o[i] += Math.sin(TAU * car * t) * gate * vol;
      }
    }
  }),
  cave: () => makeLoop(12, 1, (o, rng) => {
    let brown = 0, lp = 0; const aL = coef(110);
    for (let i = 0; i < o.length; i++) { brown = brown * 0.999 + rng.signed() * 0.04; lp += aL * (brown - lp); o[i] = lp * 3; }
    const secs = o.length / SR, drips = 3 + Math.floor(rng.next() * 3);
    for (let d = 0; d < drips; d++) {
      const s = Math.floor(rng.range(0.3, secs - 0.5) * SR), n = Math.floor(0.12 * SR), f0 = rng.range(1400, 2600), vol = rng.range(0.3, 0.6); let ph = 0;
      for (let i = 0; i < n && s + i < o.length; i++) { const t = i / SR; ph += TAU * f0 * (1 + 1.5 * t / 0.12) / SR; o[s + i] += Math.sin(ph) * Math.exp(-t / 0.025) * vol; }
      const e = Math.floor(SR / 5);
      for (let i = 0; i < n && s + i + e < o.length; i++) o[s + i + e] += o[s + i] * 0.25;
    }
  }),
  // the Nether: a deep, slow rumble with far-off groans
  nether: () => makeLoop(16, 3, (o, rng) => {
    let brown = 0, lp = 0, lp2 = 0; const aL = coef(70), aL2 = coef(240);
    for (let i = 0; i < o.length; i++) {
      const t = i / SR, swell = 0.6 + 0.4 * Math.sin(t * 0.39) * Math.sin(t * 0.23 + 1.1);
      brown = brown * 0.9995 + rng.signed() * 0.03; lp += aL * (brown - lp); lp2 += aL2 * (rng.signed() - lp2);
      o[i] = (lp * 4 + lp2 * 0.08) * swell;
    }
    for (let g = 0; g < 3; g++) {
      const s0 = rng.range(0.5, 12), len = rng.range(1.8, 3.2), f0 = rng.range(55, 95), vol = rng.range(0.25, 0.45); let ph = 0;
      for (let i = 0, n = Math.floor(len * SR), s = Math.floor(s0 * SR); i < n && s + i < o.length; i++) {
        const u = i / n; ph += TAU * f0 * (1 - 0.25 * u) / SR;
        o[s + i] += (Math.sin(ph) + 0.4 * Math.sin(ph * 2.01) + 0.2 * Math.sin(ph * 3.03)) * Math.sin(Math.PI * u) ** 2 * vol;
      }
    }
  }),
  // lava: thick bubbling with the odd pop
  lava: () => makeLoop(8, 5, (o, rng) => {
    let brown = 0, lp = 0; const aL = coef(180);
    for (let i = 0; i < o.length; i++) { brown = brown * 0.998 + rng.signed() * 0.05; lp += aL * (brown - lp); o[i] = lp * 2.2; }
    for (let b = 0; b < 26; b++) bubble(o, rng.range(0, o.length / SR - 0.2), rng.range(90, 260), rng.range(0.15, 0.4), rng);
    for (let k = 0; k < 5; k++) {
      const s = Math.floor(rng.range(0.2, o.length / SR - 0.2) * SR), n = Math.floor(0.05 * SR);
      for (let i = 0; i < n && s + i < o.length; i++) o[s + i] += rng.signed() * Math.exp(-i / (0.008 * SR)) * 0.8;
    }
  }),
  // the End: a hollow, slowly beating drone
  end: () => makeLoop(12, 7, (o, rng) => {
    let lp = 0; const aL = coef(900);
    for (let i = 0; i < o.length; i++) {
      const t = i / SR;
      const drone = Math.sin(TAU * 49 * t) * 0.5 + Math.sin(TAU * 49.6 * t) * 0.5 + Math.sin(TAU * 73.5 * t) * 0.25 * (0.5 + 0.5 * Math.sin(t * 0.5));
      lp += aL * (rng.signed() - lp);
      o[i] = drone * 0.5 + lp * 0.05 * (0.6 + 0.4 * Math.sin(t * 0.8));
    }
  }),
  underwater: () => makeLoop(6, 1, (o, rng) => {
    let brown = 0, lp = 0; const aL = coef(260);
    for (let i = 0; i < o.length; i++) { brown = brown * 0.997 + rng.signed() * 0.06; lp += aL * (brown - lp); o[i] = lp * 2; }
    for (let b = 0; b < 10; b++) bubble(o, rng.range(0, o.length / SR - 0.2), rng.range(300, 900), 0.15, rng);
  }),
};

/** One seamless loop from recorded clips: laid end to end with crossfades, the tail folded over the head. */
function loopFrom(ctx, clips, fadeSec = 0.4) {
  const rate = ctx.sampleRate, F = Math.floor(fadeSec * rate);
  const chans = Math.max(...clips.map((c) => c.numberOfChannels));
  const total = clips.reduce((a, c) => a + c.length - F, 0);
  const out = ctx.createBuffer(chans, total, rate);
  for (let ch = 0; ch < chans; ch++) {
    const o = out.getChannelData(ch);
    let pos = 0;
    for (const c of clips) {
      const d = c.getChannelData(Math.min(ch, c.numberOfChannels - 1));
      for (let i = 0; i < d.length; i++) {
        const k = i < F ? i / F : i >= d.length - F ? (d.length - i) / F : 1;
        o[(pos + i) % total] += d[i] * k;
      }
      pos += d.length - F;
    }
  }
  return out;
}

export class GameAudio {
  constructor() {
    this.ctx = null; this.cache = new Map(); this.beds = {}; this.volumes = { master: 0.8, sfx: 1, ambience: 0.7 };
    this.variant = 0;
    this.rawSamples = null; this.samples = null; this.sampleBeds = {};
  }

  /** Recorded sounds from the texture set (encoded ArrayBuffers per group), or null for the synthesised ones. */
  setSamples(raw) {
    this.rawSamples = raw;
    if (this.ctx) this.decodeSamples();
  }
  async decodeSamples() {
    const raw = this.rawSamples;
    let out = null;
    if (raw) {
      out = {};
      for (const [g, list] of Object.entries(raw)) {
        out[g] = (await Promise.all(list.map((b) => this.ctx.decodeAudioData(b.slice(0)).catch(() => null)))).filter(Boolean);
      }
    }
    if (this.rawSamples !== raw) return;
    this.samples = out;
    for (const b of Object.values(this.sampleBeds)) { try { b.src.stop(); } catch { /* not started */ } b.g.disconnect(); }
    this.sampleBeds = {};
    if (!out) return;
    // recorded beds replace (rain) or add to (water, waterfall) the synthesised ambience
    for (const name of ['rain', 'water', 'waterfall']) {
      if (!out[name] || !out[name].length) continue;
      const src = this.ctx.createBufferSource();
      src.buffer = loopFrom(this.ctx, out[name]);
      src.loop = true;
      const g = this.ctx.createGain(); g.gain.value = 0;
      src.connect(g); g.connect(this.amb);
      src.start(this.ctx.currentTime + 0.05);
      this.sampleBeds[name] = { src, g };
    }
  }
  /** A random recorded clip of a group, or null. */
  sample(group) {
    const list = this.samples && this.samples[group];
    return list && list.length ? list[Math.floor(Math.random() * list.length)] : null;
  }
  /** Must be called from a user gesture. */
  start() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain(); this.master.connect(this.ctx.destination);
    this.sfx = this.ctx.createGain(); this.sfx.connect(this.master);
    this.amb = this.ctx.createGain(); this.amb.connect(this.master);
    this.applyVolumes();
    if (this.rawSamples) this.decodeSamples();
    // ambience beds are built a little later so the first frame is not delayed
    setTimeout(() => {
      for (const name of Object.keys(BEDS)) {
        const src = this.ctx.createBufferSource();
        src.buffer = this.buffer(BEDS[name]());
        src.loop = true;
        const g = this.ctx.createGain(); g.gain.value = 0;
        src.connect(g); g.connect(this.amb);
        src.start(this.ctx.currentTime + Math.random() * 0.1);
        this.beds[name] = g;
      }
    }, 300);
  }
  applyVolumes() {
    if (!this.ctx) return;
    this.master.gain.value = this.volumes.master; this.sfx.gain.value = this.volumes.sfx; this.amb.gain.value = this.volumes.ambience;
  }
  buffer(data) { const b = this.ctx.createBuffer(1, data.length, SR); b.copyToChannel(data, 0); return b; }
  get(key, make) { let b = this.cache.get(key); if (!b) { b = this.buffer(make()); this.cache.set(key, b); } return b; }

  play(buffer, volume = 1, rate = 1, pan = 0) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const src = this.ctx.createBufferSource();
    src.buffer = buffer; src.playbackRate.value = rate;
    const g = this.ctx.createGain(); g.gain.value = volume;
    let node = src;
    if (pan && this.ctx.createStereoPanner) { const p = this.ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); node.connect(p); node = p; }
    node.connect(g); g.connect(this.sfx);
    src.start();
  }
  nextVariant() { this.variant = (this.variant + 1) % 6; return this.variant; }
  step(block, volume = 0.35) {
    const s = surfaceFor(block), k = this.nextVariant();
    const rec = s === Surface.Grass && this.sample('grassStep');
    if (rec) return this.play(rec, volume * 1.1, 0.85 + Math.random() * 0.3);
    this.play(this.get(`step${s}_${k}`, () => SYNTH.step(s, k)), volume);
  }
  hit(block) { const s = surfaceFor(block), k = this.nextVariant(); this.play(this.get(`hit${s}_${k}`, () => SYNTH.hit(s, k)), 0.4); }
  break(block) {
    const s = surfaceFor(block), k = this.nextVariant() % 3;
    const rec = s === Surface.Stone && this.sample('stoneBreak');
    if (rec) return this.play(rec, 0.6, 0.9 + Math.random() * 0.2);
    this.play(this.get(`brk${s}_${k}`, () => SYNTH.break(s, k)), 0.7);
  }
  place(block) { const s = surfaceFor(block), k = this.nextVariant() % 3; this.play(this.get(`plc${s}_${k}`, () => SYNTH.place(s, k)), 0.6); }
  splash() { const k = this.nextVariant() % 3; this.play(this.get(`spl${k}`, () => SYNTH.splash(k)), 0.6); }
  hurt() { const k = this.nextVariant() % 3; this.play(this.get(`hurt${k}`, () => SYNTH.hurt(k)), 0.8); }
  /** A short grunt or squeal, pitched per mob. */
  mobHurt(type) {
    const pitch = { chicken: 1.9, pig: 1.25, sheep: 1.4, cow: 0.75, wolf: 1.3, spider: 1.1, ghast: 1.6, blaze: 0.9, creeper: 1.0 }[type] || 0.85;
    const k = this.nextVariant() % 3;
    this.play(this.get(`hurt${k}`, () => SYNTH.hurt(k)), 0.45, pitch * (0.9 + Math.random() * 0.2));
  }
  shoot(kind) { const k = this.nextVariant() % 3; this.play(this.get(`hit${2}_${k}`, () => SYNTH.hit(2, k)), kind === 'arrow' ? 0.25 : 0.5, kind === 'arrow' ? 1.8 : 0.6); }
  explosion() { const k = this.nextVariant() % 3; this.play(this.get(`thunder1_${k}`, () => SYNTH.thunder(k, true)), 1, 1.6); }
  pop() { const rec = this.sample('pop'); this.play(rec || this.get('pop', SYNTH.pop), rec ? 0.3 : 0.35, 0.9 + Math.random() * 0.3); }
  click() { this.play(this.get('click', SYNTH.click), 0.4); }
  /** A looping fight track, faded in and out. */
  bossMusic(on) {
    if (!this.ctx || this.ctx.state !== 'running' || !on === !this.bossSrc) return;
    const t = this.ctx.currentTime;
    if (on) {
      const src = this.ctx.createBufferSource(), g = this.ctx.createGain();
      src.buffer = this.get('bossLoop', SYNTH.bossLoop); src.loop = true;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.4, t + 2);
      src.connect(g); g.connect(this.sfx); src.start();
      this.bossSrc = src; this.bossGain = g;
    } else {
      const g = this.bossGain;
      g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value, t); g.gain.linearRampToValueAtTime(0, t + 3);
      this.bossSrc.stop(t + 3.1); this.bossSrc = null;
    }
  }
  orb() { this.play(this.get('orb', SYNTH.orb), 0.3, 0.85 + Math.random() * 0.4); }
  levelUp() { this.play(this.get('levelUp', SYNTH.levelUp), 0.5); }
  enchant() { this.play(this.get('enchant', SYNTH.enchant), 0.6); }
  anvil() { this.play(this.get('anvil', SYNTH.anvil), 0.45, 0.9 + Math.random() * 0.2); }
  eat() { const k = this.nextVariant() % 2; this.play(this.get(`eat${k}`, () => SYNTH.eat(k)), 0.6); }
  thunder(near, delay = 0) {
    const k = this.nextVariant() % 3;
    const buf = this.get(`thunder${near ? 1 : 0}_${k}`, () => SYNTH.thunder(k, near));
    setTimeout(() => this.play(buf, near ? 1 : 0.6), delay * 1000);
  }

  /** Ambience mix targets 0..1 per bed, smoothed. */
  setAmbience(t, dt) {
    if (!this.ctx) return;
    const k = 1 - Math.exp(-dt * 1.5);
    for (const [name, g] of Object.entries(this.beds)) {
      const cur = g.gain.value, target = this.sampleBeds[name] ? 0 : t[name] || 0;
      g.gain.value = cur + (target - cur) * k;
    }
    for (const [name, b] of Object.entries(this.sampleBeds)) {
      const cur = b.g.gain.value, target = t[name] || 0;
      b.g.gain.value = cur + (target - cur) * k;
    }
  }
}
