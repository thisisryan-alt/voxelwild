// Pure composer: turns a track definition into a fixed, repeatable song (chords, melody, arpeggio, bass, drums).
// No audio here, so it can be tested in Node. Each track gets its own motifs from a seed derived from its id, so a given
// area always has the same tune; it is built from a short motif that is sequenced, inverted and resolved over four bars.
export const SC = {
  major: [0, 2, 4, 5, 7, 9, 11], pent: [0, 2, 4, 7, 9, 12, 14], dorian: [0, 2, 3, 5, 7, 9, 10], lydian: [0, 2, 4, 6, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10],
  phryg: [0, 1, 3, 5, 7, 8, 10], mixo: [0, 2, 4, 5, 7, 9, 10], whole: [0, 2, 4, 6, 8, 10, 12], harm: [0, 2, 3, 5, 7, 8, 11], minpent: [0, 3, 5, 7, 10, 12, 15],
};

export function seedOf(id) { return [...id].reduce((a, c) => Math.imul(a, 31) + c.charCodeAt(0), 7) >>> 0; }
export function mulberry(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

const RHY = {
  sparse: [[0, 8], [0, 6, 10], [0, 10], [4, 12], [0, 12], [2, 8]],
  lilt: [[0, 3, 6, 10], [0, 4, 6, 8, 12], [0, 2, 4, 8, 12], [0, 3, 8, 11], [0, 4, 8, 10]],
  flow: [[0, 2, 4, 6, 8, 10, 12, 14], [0, 2, 4, 8, 10, 12], [0, 4, 6, 8, 12, 14], [0, 2, 6, 8, 10, 14]],
  march: [[0, 4, 6, 8, 12], [0, 2, 4, 8, 10, 12], [0, 4, 8, 10, 12], [0, 3, 4, 8, 12]],
  drive: [[0, 3, 6, 8, 11, 14], [0, 2, 3, 6, 8, 10, 12, 14], [0, 3, 4, 8, 10, 12], [0, 3, 6, 10, 12, 14]],
};
const ARP = {
  up: (n) => Array.from({ length: 8 }, (_, i) => ({ s: i * 2, k: [0, 1, 2, 3, 2, 1, 3, 2][i % 8] })),
  harp: () => [0, 2, 4, 6, 8, 10, 12, 14].map((s, i) => ({ s, k: [0, 1, 2, 3, 4, 3, 2, 1][i] })),
  sparse: (n, r) => [0, 6, 10].filter(() => r() < 0.8).map((s) => ({ s, k: Math.floor(r() * 4) })),
  pulse: () => [0, 3, 6, 8, 11, 14].map((s, i) => ({ s, k: [0, 2, 1, 3, 2, 1][i] })),
  drive: () => Array.from({ length: 16 }, (_, i) => ({ s: i, k: [0, 2, 1, 3][(i >> 1) % 4] })).filter((e) => e.s % 2 === 0 || e.s % 4 === 3),
  none: () => [],
};
const BASSPAT = {
  soft: [[0, 'r', 6], [8, 'r5', 6]],
  drone: [[0, 'r', 16]],
  pulse: [[0, 'r', 2], [2, 'r', 2], [4, 'r', 2], [6, 'r8', 2], [8, 'r', 2], [10, 'r', 2], [12, 'r5', 2], [14, 'r8', 2]],
  drive: [[0, 'r', 1], [2, 'r', 1], [3, 'r', 1], [5, 'r', 1], [6, 'r8', 1], [8, 'r', 1], [10, 'r', 1], [11, 'r5', 1], [13, 'r', 1], [14, 'r8', 1]],
  oompah: [[0, 'r', 3], [4, 'r5', 3], [8, 'r', 3], [12, 'r5', 3]],
};
export const DRUMS = {
  none: {},
  soft: { k: '1.......1.......', h: '..x...x...x...x.', r: '', s: '', t: '' },
  hand: { k: '1.....1.1.......', h: 'x.x.x.x.x.x.x.x.', r: '....r.......r...', s: '', t: '' },
  timp: { k: '1.......1...1...', h: '', s: '', t: '....t.......t...' },
  taiko: { k: '1.....1.1.......', h: '', s: '', t: '........t.....t.' },
  heavy: { k: '1..1..1.1..1..1.', h: 'x.x.x.x.x.x.x.x.', s: '....s.......s...', t: '' },
  march: { k: '1...1...1...1...', h: '', s: '..s...s...s...s.', t: '' },
};
const FILL = { soft: '', hand: '..............tt', timp: '...........t.t.t', taiko: '..........t.t.tt', heavy: '..........s.ssss', march: '............ssss' };

export function songLength(def) { return (def.form || ['A', 'A2', 'B', 'A3']).length * 4; }

export function compose(id, def) {
  const r = mulberry(seedOf(id)), sc = SC[def.scale] || SC.major, n = sc.length;
  const degMidi = (d) => def.root + sc[((d % n) + n) % n] + 12 * Math.floor(d / n);
  const style = def.style || (def.sparse ? 'sparse' : def.boss ? 'drive' : 'lilt');
  const leadBase = def.root < 46 ? 7 : 0;
  const progA = def.prog.length >= 4 ? def.prog.slice(0, 4) : [...def.prog, ...def.prog, ...def.prog, ...def.prog].slice(0, 4);
  const progB = def.progB || [progA[1], progA[2], progA[3], progA[0]];
  const form = def.form || ['A', 'A2', 'B', 'A3'];

  const mkMotif = (st) => {
    const rhy = RHY[st][Math.floor(r() * RHY[st].length)].slice(), ivs = [0];
    for (let i = 1; i < rhy.length; i++) { const w = [-2, -1, -1, 1, 1, 2, 3, -3][Math.floor(r() * 8)]; let v = ivs[i - 1] + w; if (v > 4) v -= 2 * Math.abs(w); if (v < -3) v += 2 * Math.abs(w); ivs.push(v); }
    if (new Set(ivs).size < 2) ivs[ivs.length - 1] += 1;
    return { rhy, ivs };
  };
  const motifs = { A: mkMotif(style), B: mkMotif(style === 'sparse' ? 'sparse' : style === 'flow' ? 'lilt' : style) };
  const isTone = (d, R) => { const k = (((d - R) % n) + n) % n; return k === 0 || k === 2 || k === 4; };
  const snap = (d, R) => { for (const o of [0, 1, -1, 2, -2]) if (isTone(d + o, R)) return d + o; return d; };

  const fit = (m) => { while (m > 84) m -= 12; while (m < 55) m += 12; return m; };
  const bars = []; let prevMean = 62;
  form.forEach((secName, si) => {
    const kind = secName[0], variant = secName.length > 1 ? +secName.slice(1) || 0 : 0, prog = kind === 'B' ? progB : progA, M = motifs[kind === 'B' ? 'B' : 'A'];
    const anchors = kind === 'B' ? [5, 7, 6, 3] : [3, 5, 4, 2];
    for (let b = 0; b < 4; b++) {
      const R = prog[b], nextR = prog[(b + 1) % 4], bar = { sec: secName, R, mel: [], arp: [], bass: [], chord: [] };
      // pad voicing, nearest inversion to the previous chord
      const degs = [R, R + 2, R + 4].concat(def.rich ? [R + 6] : []);
      let voice = degs.map(degMidi).sort((a, c) => a - c);
      let best = voice, bd = 1e9;
      for (let inv = 0; inv < voice.length; inv++) { const v = voice.slice(inv).concat(voice.slice(0, inv).map((m) => m + 12)); while (Math.min(...v) < 48) v.forEach((_, i) => (v[i] += 12)); while (Math.max(...v) > 74) v.forEach((_, i) => (v[i] -= 12)); const mean = v.reduce((a, c) => a + c, 0) / v.length; if (Math.abs(mean - prevMean) < bd) { bd = Math.abs(mean - prevMean); best = v; } }
      bar.chord = best.slice().sort((a, c) => a - c); prevMean = best.reduce((a, c) => a + c, 0) / best.length;
      // melody: the motif, sequenced up in bar 2, inverted in bar 3, cadence in bar 4
      const anchor = anchors[b] + leadBase;
      let start = snap(anchor + (variant === 1 && b < 2 ? 2 : 0), R);
      if (b === 3) {
        const d1 = snap(anchor + 1, R), steps = [0, 4, 8], degs2 = [d1, d1 - 1, snap(d1 - 2, R)];
        if (si === form.length - 1) degs2[2] = R + n * Math.round((d1 - 2 - R) / n);
        steps.forEach((s, i) => bar.mel.push({ s, m: fit(degMidi(degs2[i]) + 12), d: i === 2 ? 12 : 4 }));
      } else {
        const inv = b === 2 && variant !== 2 ? -1 : 1, shift = b === 1 ? 1 : variant === 2 && b === 2 ? 2 : 0;
        M.rhy.forEach((s, i) => {
          let d = start + shift + M.ivs[i] * inv; if (s % 8 === 0) d = snap(d, R);
          const nxt = M.rhy[i + 1] ?? 16; bar.mel.push({ s, m: fit(degMidi(d) + 12), d: Math.max(2, nxt - s - (kind === 'B' ? 0 : 1)) });
        });
      }
      // arpeggio
      const tones = [degMidi(R), degMidi(R + 2), degMidi(R + 4), degMidi(R + 7)].map((m) => m + 12);
      const ap = (ARP[def.arpPat] || ARP[def.boss ? 'pulse' : def.sparse ? 'sparse' : def.arp === 'harp' ? 'harp' : 'up'])(4, r);
      for (const e of ap) bar.arp.push({ s: e.s, m: tones[e.k % tones.length] + (e.k >= 4 ? 12 : 0), d: 2 });
      // bass
      const root = degMidi(R) - 12, fifth = degMidi(R + 4) - 12;
      const bp = BASSPAT[def.bass] || BASSPAT.soft;
      for (const [s, k, d] of bp) { let m = k === 'r' ? root : k === 'r5' ? fifth : root + 12; if (b === 3 && s === bp[bp.length - 1][0] && def.bass !== 'drone') m = degMidi(nextR + (r() < 0.5 ? -1 : 1)) - 12; bar.bass.push({ s, m: Math.max(28, m), d }); }
      bar.fill = b === 3; bar.crash = b === 0 && si % 2 === 0;
      bars.push(bar);
    }
  });
  return { bars, style, motifs };
}

// ---- helpers for tests / debugging -----------------------------------------------------------------------------
const NN = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const noteName = (m) => NN[m % 12] + (Math.floor(m / 12) - 1);
export function describe(song) {
  return song.bars.map((b, i) => `${String(i).padStart(2)} ${b.sec.padEnd(2)} R${b.R} [${b.chord.map(noteName).join(' ')}]  mel: ${b.mel.map((e) => `${e.s}:${noteName(e.m)}`).join(' ')}`).join('\n');
}
export { FILL, BASSPAT, ARP };
