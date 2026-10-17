// Generative, adaptive music: a lookahead step-sequencer driving synthesised pads, bass, arpeggios, melody and percussion.
// Every track is data (tempo, scale, progression, instrument styles). Layers fade with an `intensity` value that the game
// feeds from combat danger and boss phases, so exploration music turns tense as enemies close in and bosses grow louder.
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const SC = {
  major: [0, 2, 4, 5, 7, 9, 11], pent: [0, 2, 4, 7, 9], dorian: [0, 2, 3, 5, 7, 9, 10], lydian: [0, 2, 4, 6, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10], phryg: [0, 1, 3, 5, 7, 8, 10], mixo: [0, 2, 4, 5, 7, 9, 10], whole: [0, 2, 4, 6, 8, 10], harm: [0, 2, 3, 5, 7, 8, 11], minpent: [0, 3, 5, 7, 10],
};
// prog: scale-degree roots per bar (0-based degree, chord = degrees d, d+2, d+4)
export const TRACKS = {
  title:   { bpm: 72, root: 50, scale: 'lydian', prog: [0, 4, 5, 3], pad: 'warm', lead: 'bell', arp: 'harp', perc: 'none', lp: 0.5, bass: 'soft' },
  reef:    { bpm: 88, root: 60, scale: 'major', prog: [0, 5, 3, 4], pad: 'warm', lead: 'bell', arp: 'pluck', perc: 'soft', lp: 0.5, bass: 'soft' },
  forest:  { bpm: 74, root: 50, scale: 'dorian', prog: [0, 6, 3, 0], pad: 'choir', lead: 'flute', arp: 'harp', perc: 'soft', lp: 0.45, bass: 'soft' },
  kingdom: { bpm: 98, root: 52, scale: 'lydian', prog: [0, 1, 4, 0], pad: 'strings', lead: 'harp', arp: 'harp', perc: 'timp', lp: 0.5, bass: 'soft' },
  graveyard: { bpm: 62, root: 45, scale: 'phryg', prog: [0, 1, 0, 4], pad: 'strings', lead: 'bell', arp: 'bell', perc: 'soft', lp: 0.35, bass: 'drone', detune: 18 },
  abyss:   { bpm: 52, root: 38, scale: 'minor', prog: [0, 0, 5, 0], pad: 'choir', lead: 'ping', arp: 'ping', perc: 'none', lp: 0.25, bass: 'drone', sparse: true },
  trench:  { bpm: 56, root: 42, scale: 'phryg', prog: [0, 0, 1, 0], pad: 'choir', lead: 'bell', arp: 'ping', perc: 'taiko', lp: 0.3, bass: 'drone', sparse: true },
  domain:  { bpm: 80, root: 50, scale: 'minor', prog: [0, 5, 2, 6], pad: 'strings', lead: 'brass', arp: 'harp', perc: 'taiko', lp: 0.4, bass: 'pulse', choir: true },
  boss1:   { bpm: 126, root: 40, scale: 'minpent', prog: [0, 0, 3, 4], pad: 'strings', lead: 'brass', arp: 'pluck', perc: 'heavy', boss: true, lp: 0.6, bass: 'drive' },
  boss2:   { bpm: 118, root: 45, scale: 'mixo', prog: [0, 6, 0, 3], pad: 'choir', lead: 'flute', arp: 'pluck', perc: 'taiko', boss: true, lp: 0.6, bass: 'drive' },
  boss3:   { bpm: 112, root: 47, scale: 'harm', prog: [0, 3, 4, 0], pad: 'strings', lead: 'harp', arp: 'harp', perc: 'timp', boss: true, lp: 0.6, bass: 'drive' },
  boss4:   { bpm: 100, root: 43, scale: 'minor', prog: [0, 5, 6, 4], pad: 'strings', lead: 'accordion', arp: 'pluck', perc: 'heavy', boss: true, lp: 0.55, bass: 'oompah' },
  boss5:   { bpm: 88, root: 38, scale: 'phryg', prog: [0, 0, 1, 0], pad: 'choir', lead: 'ping', arp: 'ping', perc: 'taiko', boss: true, lp: 0.5, bass: 'pulse' },
  boss6:   { bpm: 102, root: 36, scale: 'minor', prog: [0, 6, 5, 0], pad: 'choir', lead: 'brass', arp: 'pluck', perc: 'taiko', boss: true, lp: 0.6, bass: 'drive', choir: true },
  boss7:   { bpm: 140, root: 45, scale: 'dorian', prog: [0, 6, 3, 4], pad: 'strings', lead: 'brass', arp: 'pluck', perc: 'heavy', boss: true, lp: 0.6, bass: 'drive' },
  boss8:   { bpm: 84, root: 37, scale: 'whole', prog: [0, 1, 2, 3], pad: 'choir', lead: 'ping', arp: 'ping', perc: 'taiko', boss: true, lp: 0.4, bass: 'pulse' },
  boss_final: { bpm: 132, root: 38, scale: 'minor', prog: [0, 5, 2, 6], pad: 'strings', lead: 'brass', arp: 'pluck', perc: 'heavy', boss: true, lp: 0.7, bass: 'drive', choir: true },
  ending_sad: { bpm: 60, root: 50, scale: 'minor', prog: [0, 5, 3, 4], pad: 'strings', lead: 'harp', arp: 'harp', perc: 'none', lp: 0.7, bass: 'soft' },
  ending_good: { bpm: 76, root: 55, scale: 'major', prog: [0, 4, 5, 3], pad: 'warm', lead: 'bell', arp: 'harp', perc: 'none', lp: 0.7, bass: 'soft' },
  ending_secret: { bpm: 66, root: 52, scale: 'lydian', prog: [0, 4, 1, 5], pad: 'choir', lead: 'bell', arp: 'harp', perc: 'none', lp: 0.7, bass: 'soft' },
  credits: { bpm: 72, root: 50, scale: 'major', prog: [0, 5, 3, 4], pad: 'warm', lead: 'flute', arp: 'harp', perc: 'none', lp: 0.6, bass: 'soft' },
};
const PERC = {
  none: {}, soft: { k: '1.......1.......', h: '..x...x...x...x.', s: '' },
  timp: { k: '1.......1...1...', h: '', s: '....t.......t...' },
  taiko: { k: '1.....1.1.......', h: '', s: '........t.....t.' },
  heavy: { k: '1..1..1.1..1..1.', h: 'x.x.x.x.x.x.x.x.', s: '....s.......s...' },
};
const BASS = {
  soft: '1.......1.......', drone: '1...............', pulse: '1.1.1.1.1.1.1.1.', drive: '1.11.1.11.11.1.1', oompah: '1...1...1...1...',
};

export class Music {
  constructor(audio) { this.audio = audio; this.id = null; this.def = null; this.ready = false; this.pending = null; this.intensity = 0; this.target = 0; this.step = 0; this.next = 0; this.timer = null; this.tempoMul = 1; this.duckMul = 1; this.gen = 0; this.motif = []; this.seed = 1; this.phase = 0; }
  init(ctx, bus, rev) {
    this.ctx = ctx; this.bus = bus; this.rev = rev; this.ready = true;
    this.master = ctx.createGain(); this.master.gain.value = 1; this.master.connect(bus);
    this.layerG = {}; for (const k of ['pad', 'bass', 'arp', 'lead', 'perc']) { const g = ctx.createGain(); g.gain.value = 0; g.connect(this.master); const r = ctx.createGain(); r.gain.value = k === 'perc' ? 0.05 : 0.35; g.connect(r); r.connect(rev); this.layerG[k] = g; }
    this.noise = (() => { const b = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return b; })();
    this.timer = setInterval(() => this.tick(), 30);
    if (this.pending) { const p = this.pending; this.pending = null; this.play(p); }
  }
  rng() { this.seed = (this.seed * 1664525 + 1013904223) >>> 0; return this.seed / 4294967296; }
  play(id) {
    if (!TRACKS[id]) id = 'reef';
    if (!this.ready) { this.pending = id; return; }
    if (this.id === id) return;
    const ctx = this.ctx, t = ctx.currentTime;
    // crossfade: fade the master of the old track, start a fresh master for the new one
    if (this.master) { const old = this.master; old.gain.cancelScheduledValues(t); old.gain.setTargetAtTime(0, t, 0.5); setTimeout(() => { try { old.disconnect(); } catch (e) {} }, 3000); }
    this.master = ctx.createGain(); this.master.gain.value = 0; this.master.gain.setTargetAtTime(this.duckMul, t + 0.05, 0.8); this.master.connect(this.bus);
    for (const k of Object.keys(this.layerG)) { const g = ctx.createGain(); g.gain.value = 0; g.connect(this.master); const r = ctx.createGain(); r.gain.value = k === 'perc' ? 0.05 : 0.35; g.connect(r); r.connect(this.rev); this.layerG[k] = g; }
    this.id = id; this.def = TRACKS[id]; this.step = 0; this.next = t + 0.12; this.seed = [...id].reduce((a, c) => a * 31 + c.charCodeAt(0), 7) >>> 0; this.tempoMul = 1; this.phase = 0;
    this.motif = this.makeMotif(); this.gen++; this.target = this.def.boss ? 0.6 : 0.1; this.intensity = this.def.boss ? 0.6 : 0.1;
  }
  stop(fade = 1.5) { if (!this.ready || !this.master) return; this.master.gain.setTargetAtTime(0, this.ctx.currentTime, fade / 3); this.id = null; this.def = null; }
  setIntensity(v) { this.target = Math.max(0, Math.min(1, v)); }
  setBossPhase(n) { this.phase = n; this.tempoMul = 1 + n * 0.05; }
  duck(level = 0.2, secs = 4) { this.duckMul = level; if (this.ready && this.master) this.master.gain.setTargetAtTime(level, this.ctx.currentTime, 0.2); clearTimeout(this._dt); this._dt = setTimeout(() => { this.duckMul = 1; if (this.master) this.master.gain.setTargetAtTime(1, this.ctx.currentTime, 0.8); }, secs * 1000); }
  // called every game frame: adapt intensity to danger
  update(dt, world) {
    if (!this.ready || !this.def || !world) return;
    const pl = world.player; let d = 0;
    if (world.boss && world.boss.engaged && !world.boss.dying) { d = 0.65 + 0.1 * (world.boss.phaseIdx || 0); if (world.boss.phaseIdx !== this.phase) this.setBossPhase(world.boss.phaseIdx); }
    else { for (const e of world.enemies) { if (!e.alive || e.def.boss) continue; const dist = Math.hypot(e.x - pl.x, e.y - pl.y); if (dist < 200 && e.state !== 'hidden' && !e.disguised && e.state !== 'idle') d += 0.1 * (1 - dist / 260); } if (pl.combatT > 0) d += 0.2; if (pl.hp / pl.stats.maxHp < 0.3) d += 0.15; }
    this.target = Math.min(1, d);
    this.intensity += (this.target - this.intensity) * Math.min(1, dt * (this.target > this.intensity ? 1.6 : 0.35));
    if (this.def.boss) this.intensity = Math.max(this.intensity, 0.55);
    this.applyLayers();
  }
  applyLayers() {
    const i = this.intensity, t = this.ctx.currentTime, d = this.def, boss = d.boss, set = (k, v) => this.layerG[k].gain.setTargetAtTime(v * 0.7, t, 0.4);
    const sm = (a, b, x) => { const u = Math.max(0, Math.min(1, (x - a) / (b - a))); return u * u * (3 - 2 * u); };
    set('pad', 0.55); set('bass', d.sparse ? 0.4 + i * 0.4 : 0.35 + 0.35 * sm(0.05, 0.5, i)); set('arp', d.sparse ? 0.25 : 0.12 + 0.35 * sm(0.15, 0.6, i)); set('lead', boss ? 0.45 : 0.5 * (1 - sm(0.45, 0.8, i)) + 0.12);
    set('perc', d.perc === 'none' ? 0 : boss ? 0.7 : 0.7 * sm(0.3, 0.7, i));
  }
  makeMotif() { const sc = SC[this.def.scale], m = []; let deg = 2; for (let i = 0; i < 8; i++) { deg = Math.max(0, Math.min(sc.length * 2 - 1, deg + Math.floor(this.rng() * 5) - 2)); m.push(deg); } return m; }
  tick() {
    if (!this.def || !this.ready || this.ctx.state !== 'running') { if (this.ctx && this.ctx.state === 'running' && this.def) this.next = Math.max(this.next, this.ctx.currentTime); return; }
    if (this.ctx.currentTime - (this.lastApply || 0) > 0.4) { this.lastApply = this.ctx.currentTime; this.applyLayers(); }
    const spb = 60 / (this.def.bpm * this.tempoMul) / 4; let guard = 0;
    while (this.next < this.ctx.currentTime + 0.2 && guard++ < 8) { try { this.sched(this.step, this.next); } catch (e) {} this.next += spb; this.step++; }
  }
  degMidi(deg) { const sc = SC[this.def.scale], o = Math.floor(deg / sc.length); return this.def.root + sc[((deg % sc.length) + sc.length) % sc.length] + 12 * o; }
  sched(step, t) {
    const d = this.def, bar = Math.floor(step / 16), s = step % 16, chordRoot = d.prog[bar % d.prog.length], spb = 60 / (d.bpm * this.tempoMul) / 4, i = this.intensity;
    const chord = [chordRoot, chordRoot + 2, chordRoot + 4, chordRoot + 7].map((x) => this.degMidi(x));
    // pad: one chord per bar
    if (s === 0) this.pad(d.pad, chord, t, spb * 16, d);
    if (s === 0 && d.choir && (d.boss || i > 0.3)) this.pad('choir', [chord[0] + 12, chord[2] + 12], t, spb * 16, d, 0.5);
    // bass
    const bp = BASS[d.bass] || BASS.soft; const ch = bp[s]; if (ch === '1') this.bass(d.bass, this.degMidi(chordRoot) - 12, t, spb * (d.bass === 'drone' ? 16 : 3));
    // arpeggio
    if (!d.sparse || s % 4 === 0) { const every = d.boss ? 2 : 2; if (s % every === 0 && (d.sparse ? this.rng() < 0.35 : this.rng() < (d.boss ? 0.95 : 0.7))) { const pat = [0, 1, 2, 3, 2, 1, 3, 2][(s / every) % 8]; this.arp(d.arp, chord[pat % chord.length] + 12 + (s % 8 === 0 ? 0 : 0), t, spb * 2); } }
    // lead melody: sparse phrases
    const phrase = Math.floor(bar / 2) % 2; if (s % 4 === 0 && this.rng() < (d.boss ? 0.7 : d.sparse ? 0.22 : 0.4) && (bar % 4 !== 3 || this.rng() < 0.3)) { const k = (bar * 4 + s / 4 + phrase) % this.motif.length, m = this.degMidi(this.motif[k]) + 12; this.lead(d.lead, m, t, spb * (this.rng() < 0.4 ? 6 : 3)); }
    if (bar % 8 === 7 && s === 15) this.motif[Math.floor(this.rng() * this.motif.length)] += Math.floor(this.rng() * 3) - 1;
    // percussion
    const P = PERC[d.perc] || PERC.none;
    if (P.k && P.k[s] === '1') this.kick(t, d.perc === 'taiko' || d.perc === 'timp');
    if (P.s && (P.s[s] === 's' || P.s[s] === 't')) P.s[s] === 's' ? this.snare(t) : this.tom(t);
    if (P.h && P.h[s] === 'x') this.hat(t, s % 4 === 0 ? 0.5 : 0.3);
  }
  // ---------- instruments ----------
  out(k) { return this.layerG[k]; }
  osc(type, f, t, dur, vol, dest, o = {}) {
    const c = this.ctx, g = c.createGain(), os = c.createOscillator(); os.type = type; os.frequency.value = f; if (o.detune) os.detune.value = o.detune;
    const a = o.attack ?? 0.01, r = o.release ?? 0.1; g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + a); g.gain.setValueAtTime(vol, t + Math.max(a, dur - r)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + r * 0.5);
    let n = os; os.connect(g);
    if (o.lp) { const f2 = c.createBiquadFilter(); f2.type = 'lowpass'; f2.frequency.setValueAtTime(o.lp, t); if (o.lpTo) f2.frequency.linearRampToValueAtTime(o.lpTo, t + (o.lpT || dur)); f2.Q.value = o.q || 0.7; g.connect(f2); n = f2; }
    if (o.bp) { const f2 = c.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.value = o.bp; f2.Q.value = o.bpq || 4; n.connect(f2); n = f2; }
    n.connect(dest); os.start(t); os.stop(t + dur + r + 0.05);
    if (o.vib) { const l = c.createOscillator(), lg = c.createGain(); l.frequency.value = 5.2; lg.gain.value = f * 0.01 * o.vib; l.connect(lg); lg.connect(os.frequency); l.start(t); l.stop(t + dur + r + 0.05); }
  }
  pad(kind, notes, t, dur, d, vol = 1) {
    const out = this.out('pad'), det = d.detune || 7;
    for (const m of notes) {
      const f = mtof(m);
      if (kind === 'choir') { for (const dt of [-det, det]) { this.osc('sawtooth', f, t, dur, 0.035 * vol, out, { attack: 0.9, release: 1.2, detune: dt, lp: 3000, bp: 800, bpq: 2, vib: 1 }); } this.osc('sawtooth', f, t, dur, 0.02 * vol, out, { attack: 0.9, release: 1.2, bp: 1250, bpq: 3, vib: 1 }); }
      else if (kind === 'strings') { for (const dt of [-det, 0, det]) this.osc('sawtooth', f, t, dur, 0.03 * vol, out, { attack: 0.5, release: 0.9, detune: dt, lp: 1800 }); }
      else { this.osc('triangle', f, t, dur, 0.06 * vol, out, { attack: 0.8, release: 1.4 }); this.osc('sine', f * 2, t, dur, 0.02 * vol, out, { attack: 1.0, release: 1.4, detune: 4 }); }
    }
  }
  bass(kind, m, t, dur) { const f = mtof(m); this.osc('sine', f, t, dur, kind === 'drone' ? 0.16 : 0.2, this.out('bass'), { attack: kind === 'drone' ? 1.2 : 0.01, release: kind === 'drone' ? 1.5 : 0.12 }); this.osc('sawtooth', f, t, dur, 0.06, this.out('bass'), { attack: 0.01, release: 0.1, lp: kind === 'drive' ? 700 : 400 }); }
  arp(kind, m, t, dur) {
    const f = mtof(m), out = this.out('arp');
    if (kind === 'bell' || kind === 'ping') { this.osc('sine', f, t, dur * 2, 0.07, out, { attack: 0.005, release: 0.6 }); this.osc('sine', f * 2.76, t, dur, 0.02, out, { attack: 0.005, release: 0.3 }); }
    else if (kind === 'harp') this.osc('triangle', f, t, dur * 2, 0.08, out, { attack: 0.004, release: 0.5, lp: 2600 });
    else this.osc('square', f, t, dur, 0.04, out, { attack: 0.005, release: 0.08, lp: 1800 });
  }
  lead(kind, m, t, dur) {
    const f = mtof(m), out = this.out('lead');
    if (kind === 'bell') { this.osc('sine', f, t, dur * 2, 0.11, out, { attack: 0.005, release: 1.0 }); this.osc('sine', f * 2.76, t, dur, 0.03, out, { attack: 0.005, release: 0.4 }); this.osc('sine', f * 5.4, t, dur * 0.5, 0.012, out, { attack: 0.002, release: 0.2 }); }
    else if (kind === 'flute') { this.osc('sine', f, t, dur, 0.1, out, { attack: 0.06, release: 0.3, vib: 1.2 }); this.osc('triangle', f * 2, t, dur, 0.025, out, { attack: 0.08, release: 0.3 }); }
    else if (kind === 'harp') this.osc('triangle', f, t, dur * 2, 0.11, out, { attack: 0.004, release: 0.6, lp: 3200 });
    else if (kind === 'brass') { this.osc('sawtooth', f, t, dur, 0.06, out, { attack: 0.05, release: 0.25, lp: 500, lpTo: 2400, lpT: 0.2 }); this.osc('sawtooth', f, t, dur, 0.05, out, { attack: 0.05, release: 0.25, detune: 8, lp: 500, lpTo: 2200, lpT: 0.2 }); }
    else if (kind === 'accordion') { for (const dt of [-12, 0, 12]) this.osc('sawtooth', f, t, dur, 0.035, out, { attack: 0.03, release: 0.15, detune: dt, lp: 2200, bp: 1400, bpq: 1, vib: 0.8 }); }
    else if (kind === 'ping') this.osc('sine', f * 2, t, dur * 3, 0.08, out, { attack: 0.004, release: 1.8 });
    else this.osc('triangle', f, t, dur, 0.08, out, { attack: 0.01, release: 0.3 });
  }
  noiseHit(t, dur, vol, type, f, q, dest) { const c = this.ctx, s = c.createBufferSource(), g = c.createGain(), fl = c.createBiquadFilter(); s.buffer = this.noise; fl.type = type; fl.frequency.value = f; fl.Q.value = q; g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); s.connect(fl); fl.connect(g); g.connect(dest); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05); }
  kick(t, big) { const c = this.ctx, o = c.createOscillator(), g = c.createGain(); o.frequency.setValueAtTime(big ? 110 : 150, t); o.frequency.exponentialRampToValueAtTime(big ? 38 : 45, t + (big ? 0.3 : 0.14)); g.gain.setValueAtTime(big ? 0.55 : 0.4, t); g.gain.exponentialRampToValueAtTime(0.0001, t + (big ? 0.55 : 0.2)); o.connect(g); g.connect(this.out('perc')); o.start(t); o.stop(t + 0.6); if (big) this.noiseHit(t, 0.18, 0.15, 'lowpass', 400, 0.5, this.out('perc')); }
  snare(t) { this.noiseHit(t, 0.14, 0.25, 'bandpass', 1900, 0.8, this.out('perc')); const c = this.ctx, o = c.createOscillator(), g = c.createGain(); o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(110, t + 0.08); g.gain.setValueAtTime(0.18, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12); o.connect(g); g.connect(this.out('perc')); o.start(t); o.stop(t + 0.15); }
  tom(t) { const c = this.ctx, o = c.createOscillator(), g = c.createGain(); o.frequency.setValueAtTime(190, t); o.frequency.exponentialRampToValueAtTime(80, t + 0.25); g.gain.setValueAtTime(0.35, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4); o.connect(g); g.connect(this.out('perc')); o.start(t); o.stop(t + 0.45); }
  hat(t, v) { this.noiseHit(t, 0.04, v * 0.12, 'highpass', 8000, 0.7, this.out('perc')); }
}
