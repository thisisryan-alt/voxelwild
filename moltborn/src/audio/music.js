// Adaptive music. compose.js writes each track as a fixed 16-bar song (chords, melody, arpeggio, bass, drums);
// this file plays it with synthesised instruments and fades layers in and out with an `intensity` value that the game
// feeds from combat danger and boss phases, so exploration music turns tense as enemies close in and bosses build.
import { compose, DRUMS, FILL } from './compose.js';
export { SC } from './compose.js';

// per-layer trim so that bass, pad, arpeggio and lead sit at sensible relative loudness
export const LAYER_TRIM = { pad: 2.2, bass: 0.45, arp: 3, lead: 2.6, perc: 1 };
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

// prog = scale-degree roots for four bars; progB (optional) = the contrasting section; style picks the melodic rhythm.
export const TRACKS = {
  title:   { bpm: 72, root: 50, scale: 'lydian', prog: [0, 1, 4, 5], progB: [5, 4, 1, 0], style: 'sparse', rich: true, pad: 'warm', lead: 'bell', arp: 'harp', perc: 'none', lp: 0.5, bass: 'soft' },
  reef:    { bpm: 88, root: 60, scale: 'major', prog: [0, 4, 5, 3], progB: [3, 4, 2, 5], style: 'lilt', swing: 0.1, pad: 'warm', lead: 'marimba', arp: 'pluck', perc: 'hand', lp: 0.5, bass: 'soft' },
  forest:  { bpm: 74, root: 50, scale: 'dorian', prog: [0, 6, 3, 0], progB: [0, 2, 3, 6], style: 'lilt', rich: true, pad: 'choir', lead: 'flute', arp: 'harp', perc: 'soft', lp: 0.45, bass: 'soft' },
  kingdom: { bpm: 98, root: 52, scale: 'lydian', prog: [0, 1, 4, 0], progB: [5, 4, 1, 0], style: 'march', rich: true, pad: 'strings', lead: 'harp', arp: 'harp', perc: 'timp', lp: 0.5, bass: 'soft' },
  graveyard: { bpm: 62, root: 45, scale: 'phryg', prog: [0, 1, 0, 5], progB: [0, 3, 1, 0], style: 'lilt', swing: 0.14, pad: 'strings', lead: 'musicbox', arp: 'bell', perc: 'soft', lp: 0.35, bass: 'drone', detune: 18 },
  abyss:   { bpm: 52, root: 38, scale: 'minor', prog: [0, 0, 5, 0], progB: [0, 5, 3, 0], form: ['A', 'B', 'A', 'B'], pad: 'choir', lead: 'ping', arp: 'ping', perc: 'none', lp: 0.25, bass: 'drone', sparse: true },
  trench:  { bpm: 56, root: 42, scale: 'phryg', prog: [0, 0, 1, 0], progB: [0, 5, 1, 0], form: ['A', 'B', 'A', 'B'], pad: 'choir', lead: 'bell', arp: 'ping', perc: 'taiko', lp: 0.3, bass: 'drone', sparse: true },
  domain:  { bpm: 80, root: 50, scale: 'minor', prog: [0, 5, 2, 6], progB: [3, 5, 6, 0], style: 'march', rich: true, pad: 'strings', lead: 'brass', arp: 'harp', perc: 'taiko', lp: 0.4, bass: 'pulse', choir: true },
  // the newer places: a still night pool, the inside of a rift, and a rift trial against the clock
  moonpool: { bpm: 58, root: 52, scale: 'lydian', prog: [0, 4, 1, 4], progB: [3, 4, 0, 5], style: 'sparse', rich: true, pad: 'warm', lead: 'musicbox', arp: 'harp', perc: 'none', lp: 0.4, bass: 'soft' },
  riftdeep: { bpm: 84, root: 44, scale: 'harm', prog: [0, 5, 3, 4], progB: [0, 3, 5, 4], style: 'march', rich: true, pad: 'choir', lead: 'bell', arp: 'ping', perc: 'soft', lp: 0.4, bass: 'pulse' },
  trial:   { bpm: 122, root: 43, scale: 'phryg', prog: [0, 1, 0, 6], progB: [0, 3, 1, 0], style: 'drive', pad: 'strings', lead: 'ping', arp: 'pluck', perc: 'taiko', lp: 0.55, bass: 'drive' },
  boss1:   { bpm: 126, root: 40, scale: 'minpent', prog: [0, 0, 3, 4], style: 'drive', pad: 'strings', lead: 'brass', arp: 'pluck', perc: 'heavy', boss: true, lp: 0.6, bass: 'drive' },
  boss2:   { bpm: 118, root: 45, scale: 'mixo', prog: [0, 6, 0, 3], style: 'drive', pad: 'choir', lead: 'flute', arp: 'pluck', perc: 'taiko', boss: true, lp: 0.6, bass: 'drive' },
  boss3:   { bpm: 112, root: 47, scale: 'harm', prog: [0, 3, 4, 0], progB: [5, 3, 4, 0], style: 'drive', pad: 'strings', lead: 'harp', arp: 'harp', perc: 'timp', boss: true, lp: 0.6, bass: 'drive' },
  boss4:   { bpm: 100, root: 43, scale: 'minor', prog: [0, 5, 6, 4], style: 'march', pad: 'strings', lead: 'accordion', arp: 'pluck', perc: 'march', boss: true, lp: 0.55, bass: 'oompah' },
  boss5:   { bpm: 88, root: 38, scale: 'phryg', prog: [0, 0, 1, 0], style: 'drive', pad: 'choir', lead: 'ping', arp: 'ping', perc: 'taiko', boss: true, lp: 0.5, bass: 'pulse' },
  boss6:   { bpm: 102, root: 36, scale: 'minor', prog: [0, 6, 5, 0], progB: [3, 6, 5, 4], style: 'drive', pad: 'choir', lead: 'brass', arp: 'pluck', perc: 'taiko', boss: true, lp: 0.6, bass: 'drive', choir: true },
  boss7:   { bpm: 140, root: 45, scale: 'dorian', prog: [0, 6, 3, 4], style: 'drive', pad: 'strings', lead: 'brass', arp: 'pluck', perc: 'heavy', boss: true, lp: 0.6, bass: 'drive' },
  boss8:   { bpm: 84, root: 37, scale: 'whole', prog: [0, 1, 2, 3], style: 'sparse', pad: 'choir', lead: 'ping', arp: 'ping', perc: 'taiko', boss: true, lp: 0.4, bass: 'pulse' },
  boss_final: { bpm: 132, root: 38, scale: 'minor', prog: [0, 5, 2, 6], progB: [3, 5, 6, 0], style: 'drive', rich: true, pad: 'strings', lead: 'brass', arp: 'pluck', perc: 'heavy', boss: true, lp: 0.7, bass: 'drive', choir: true },
  ending_sad: { bpm: 60, root: 50, scale: 'minor', prog: [0, 5, 3, 4], progB: [5, 3, 4, 0], style: 'sparse', rich: true, pad: 'strings', lead: 'harp', arp: 'harp', perc: 'none', lp: 0.7, bass: 'soft' },
  ending_good: { bpm: 76, root: 55, scale: 'major', prog: [0, 4, 5, 3], progB: [3, 4, 2, 5], style: 'lilt', rich: true, pad: 'warm', lead: 'bell', arp: 'harp', perc: 'none', lp: 0.7, bass: 'soft' },
  ending_secret: { bpm: 66, root: 52, scale: 'lydian', prog: [0, 1, 4, 5], progB: [5, 4, 1, 0], style: 'sparse', rich: true, pad: 'choir', lead: 'bell', arp: 'harp', perc: 'none', lp: 0.7, bass: 'soft' },
  credits: { bpm: 72, root: 50, scale: 'major', prog: [0, 5, 3, 4], progB: [3, 4, 2, 5], style: 'lilt', rich: true, pad: 'warm', lead: 'flute', arp: 'harp', perc: 'none', lp: 0.6, bass: 'soft' },
};

export class Music {
  constructor(audio) { this.audio = audio; this.id = null; this.def = null; this.song = null; this.ready = false; this.pending = null; this.intensity = 0; this.target = 0; this.step = 0; this.next = 0; this.timer = null; this.tempoMul = 1; this.duckMul = 1; this.gen = 0; this.layerG = { pad: null, bass: null, arp: null, lead: null, perc: null }; this.sec = 'A'; this.phase = 0; this.lastApply = 0; }

  init(ctx, bus, rev) {
    this.ctx = ctx; this.bus = bus; this.rev = rev; this.ready = true;
    this.noise = (() => { const b = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return b; })();
    // tempo-synced ping-pong delay shared by arpeggio and lead
    const mk = (pan) => { const d = ctx.createDelay(2), p = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain(); if (p.pan) p.pan.value = pan; d.connect(p); p.connect(bus); return { d, p }; };
    this.dl = mk(-0.55); this.dr = mk(0.55);
    this.dIn = ctx.createGain(); this.dIn.gain.value = 1;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600; this.dIn.connect(lp); lp.connect(this.dl.d);
    const fbL = ctx.createGain(), fbR = ctx.createGain(); fbL.gain.value = fbR.gain.value = 0.36;
    this.dl.d.connect(fbL); fbL.connect(this.dr.d); this.dr.d.connect(fbR); fbR.connect(this.dl.d);
    this.stGain = ctx.createGain(); this.stGain.gain.value = 1; this.stGain.connect(bus); const sr = ctx.createGain(); sr.gain.value = 0.4; this.stGain.connect(sr); sr.connect(rev);
    this.makeMaster(0);
    this.timer = setInterval(() => this.tick(), 30);
    if (this.pending) { const p = this.pending; this.pending = null; this.play(p); }
  }
  dispose() { clearInterval(this.timer); this.timer = null; }

  makeMaster(startGain, t = this.ctx.currentTime) {
    const ctx = this.ctx; this.master = ctx.createGain(); this.master.gain.value = startGain; this.master.connect(this.bus);
    for (const k of Object.keys(this.layerG)) {
      const g = ctx.createGain(); g.gain.value = 0; g.connect(this.master);
      const r = ctx.createGain(); r.gain.value = k === 'perc' ? 0.05 : k === 'pad' ? 0.45 : 0.32; g.connect(r); r.connect(this.rev);
      if (k === 'arp' || k === 'lead') { const s = ctx.createGain(); s.gain.value = k === 'arp' ? 0.3 : 0.2; g.connect(s); s.connect(this.dIn); }
      this.layerG[k] = g;
    }
  }

  play(id) {
    if (!TRACKS[id]) id = 'reef';
    if (!this.ready) { this.pending = id; return; }
    if (this.id === id) return;
    const ctx = this.ctx, t = ctx.currentTime;
    if (this.master) { const old = this.master; old.gain.cancelScheduledValues(t); old.gain.setTargetAtTime(0, t, 0.5); setTimeout(() => { try { old.disconnect(); } catch (e) {} }, 3000); }
    this.makeMaster(0, t); this.master.gain.setTargetAtTime(this.duckMul, t + 0.05, 0.8);
    this.id = id; this.def = TRACKS[id]; this.song = compose(id, this.def); this.step = 0; this.tempoMul = 1; this.phase = 0; this.sec = 'A'; this.gen++;
    this.next = t + (this.def.boss ? 1.15 : 0.12);
    const beat = 60 / this.def.bpm, dt = Math.min(1.9, beat * 0.75); this.dl.d.delayTime.setValueAtTime(dt, t); this.dr.d.delayTime.setValueAtTime(dt, t);
    this.target = this.def.boss ? 0.6 : 0.1; this.intensity = this.def.boss ? 0.6 : 0.1;
    if (this.def.boss) this.riser(t, 1.1);
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
    const i = this.intensity, t = this.ctx.currentTime, d = this.def, boss = d.boss, B = this.sec === 'B' ? 1 : 0, set = (k, v) => this.layerG[k].gain.setTargetAtTime(v * 0.7 * LAYER_TRIM[k] * (boss && (k === 'lead' || k === 'arp' || k === 'perc') ? 1.3 : 1), t, 0.4);
    const sm = (a, b, x) => { const u = Math.max(0, Math.min(1, (x - a) / (b - a))); return u * u * (3 - 2 * u); };
    set('pad', 0.55); set('bass', d.sparse ? 0.4 + i * 0.4 : 0.35 + 0.35 * sm(0.05, 0.5, i)); set('arp', (d.sparse ? 0.25 : 0.12 + 0.35 * sm(0.15, 0.6, i)) + B * 0.08); set('lead', (boss ? 0.45 : 0.5 * (1 - sm(0.45, 0.8, i)) + 0.12) + B * 0.06);
    set('perc', d.perc === 'none' ? 0 : boss ? 0.7 : 0.7 * sm(0.3, 0.7, i));
  }

  tick() {
    if (!this.def || !this.ready || this.ctx.state !== 'running') { if (this.ctx && this.ctx.state === 'running' && this.def) this.next = Math.max(this.next, this.ctx.currentTime); return; }
    if (this.ctx.currentTime - this.lastApply > 0.4) { this.lastApply = this.ctx.currentTime; this.applyLayers(); }
    const spb = 60 / (this.def.bpm * this.tempoMul) / 4; let guard = 0;
    while (this.next < this.ctx.currentTime + 0.2 && guard++ < 8) { try { this.sched(this.step, this.next); } catch (e) { console.warn('music', e); } this.next += spb; this.step++; }
  }

  sched(step, t) {
    const d = this.def, song = this.song, nb = song.bars.length, barIdx = Math.floor(step / 16), bar = song.bars[barIdx % nb], s = step % 16;
    const spb = 60 / (d.bpm * this.tempoMul) / 4, ts = s % 2 && d.swing ? t + spb * d.swing : t, i = this.intensity;
    if (s === 0) {
      this.sec = bar.sec;
      this.pad(d.pad, bar.chord, t, spb * 16, d);
      if (d.choir && (d.boss || i > 0.3)) this.pad('choir', [bar.chord[0] + 12, bar.chord[2] + 12], t, spb * 16, d, 0.5);
      if (bar.crash && barIdx > 0 && d.perc !== 'none' && (d.boss || i > 0.3)) this.crash(t);
    }
    for (const e of bar.bass) if (e.s === s) this.bass(d.bass, e.m, ts, spb * e.d);
    for (const e of bar.arp) if (e.s === s) this.arp(d.arp, e.m, ts, spb * 2, bar.sec === 'B' ? 1 : 0.85, ((e.s >> 1) % 2 ? 0.35 : -0.35));
    // the melody holds back for the first bar and breathes on alternate bars in sparse tracks
    if (barIdx >= 1 && !(d.sparse && barIdx % 2 === 1)) for (const e of bar.mel) if (e.s === s) this.lead(d.lead, e.m, ts, spb * e.d, bar.sec === 'B' ? 1 : 0.88);
    const P = DRUMS[d.perc] || {};
    if (P.k && P.k[s] === '1') this.kick(t, d.perc === 'taiko' || d.perc === 'timp');
    if (P.s && P.s[s] === 's') this.snare(t);
    if (P.t && P.t[s] === 't') this.tom(t);
    if (P.h && P.h[s] === 'x') this.hat(t, s % 4 === 0 ? 0.5 : 0.3);
    if (P.r && P.r[s] === 'r') this.rim(t);
    const F = FILL[d.perc]; if (bar.fill && F && F[s] && F[s] !== '.') (F[s] === 's' ? this.snare(t, 0.7) : this.tom(t, 0.8));
  }

  // ---------- voice building blocks ----------
  out(k) { return this.layerG[k]; }
  pan(node, v, dest) { if (!v || !this.ctx.createStereoPanner) { node.connect(dest); return; } const p = this.ctx.createStereoPanner(); p.pan.value = v; node.connect(p); p.connect(dest); }
  osc(type, f, t, dur, vol, dest, o = {}) {
    const c = this.ctx, g = c.createGain(), os = c.createOscillator(); os.type = type; os.frequency.value = f; if (o.detune) os.detune.value = o.detune;
    const a = o.attack ?? 0.01, r = o.release ?? 0.1, end = t + dur + r * 0.5;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + a);
    if (o.decay) { g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol * (o.sustain ?? 0.3)), t + a + o.decay); g.gain.setValueAtTime(Math.max(0.0002, vol * (o.sustain ?? 0.3)), Math.max(t + a + o.decay, t + dur - r)); }
    else g.gain.setValueAtTime(vol, t + Math.max(a, dur - r));
    g.gain.exponentialRampToValueAtTime(0.0001, end);
    let n = os; os.connect(g); n = g;
    if (o.lp) { const f2 = c.createBiquadFilter(); f2.type = 'lowpass'; f2.frequency.setValueAtTime(o.lp, t); if (o.lpTo) f2.frequency.exponentialRampToValueAtTime(Math.max(40, o.lpTo), t + (o.lpT || dur)); f2.Q.value = o.q || 0.7; n.connect(f2); n = f2; }
    if (o.bp) { const f2 = c.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.value = o.bp; f2.Q.value = o.bpq || 4; n.connect(f2); n = f2; }
    this.pan(n, o.pan, dest); os.start(t); os.stop(end + 0.05);
    if (o.vib) { const l = c.createOscillator(), lg = c.createGain(); l.frequency.value = o.vibRate || 5.2; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f * 0.011 * o.vib, t + (o.vibDelay ?? 0.1) + 0.3); l.connect(lg); lg.connect(os.frequency); l.start(t); l.stop(end + 0.05); }
    if (o.trem) { const l = c.createOscillator(), lg = c.createGain(); l.frequency.value = o.trem; lg.gain.value = vol * 0.3; l.connect(lg); lg.connect(g.gain); l.start(t); l.stop(end + 0.05); }
    return os;
  }
  // two-operator FM: bells, mallets, glassy pings
  fm(f, ratio, index, t, dur, vol, dest, o = {}) {
    const c = this.ctx, car = c.createOscillator(), mod = c.createOscillator(), mg = c.createGain(), g = c.createGain();
    car.frequency.value = f; mod.frequency.value = f * ratio; mg.gain.setValueAtTime(index * f, t); mg.gain.exponentialRampToValueAtTime(Math.max(1, index * f * (o.mEnd ?? 0.02)), t + dur * (o.mDur ?? 0.6));
    mod.connect(mg); mg.connect(car.frequency); car.connect(g);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + (o.attack ?? 0.004)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    this.pan(g, o.pan, dest); car.start(t); mod.start(t); car.stop(t + dur + 0.05); mod.stop(t + dur + 0.05);
  }
  noiseHit(t, dur, vol, type, f, q, dest, fTo) { const c = this.ctx, s = c.createBufferSource(), g = c.createGain(), fl = c.createBiquadFilter(); s.buffer = this.noise; fl.type = type; fl.frequency.setValueAtTime(f, t); if (fTo) fl.frequency.exponentialRampToValueAtTime(fTo, t + dur); fl.Q.value = q; g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); s.connect(fl); fl.connect(g); g.connect(dest); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05); }

  // ---------- pads ----------
  pad(kind, notes, t, dur, d, vol = 1) {
    const out = this.out('pad'), det = d.detune || 7, c = this.ctx;
    notes.forEach((m, k) => {
      const f = mtof(m), pn = (k % 2 ? 1 : -1) * 0.35;
      if (kind === 'choir') {
        for (const dt of [-det, det]) {
          const o = c.createOscillator(), g = c.createGain(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = dt;
          g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.022 * vol, t + 1.0); g.gain.setValueAtTime(0.022 * vol, t + dur - 0.9); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.7);
          const sum = c.createGain(); sum.gain.value = 1;
          for (const [ff, q] of [[700, 6], [1150, 8], [2600, 6]]) { const b = c.createBiquadFilter(); b.type = 'bandpass'; b.frequency.value = ff; b.Q.value = q; o.connect(b); b.connect(g); }
          g.connect(sum); this.pan(sum, pn * (dt > 0 ? 1 : -1), out); o.start(t); o.stop(t + dur + 0.8);
          const l = c.createOscillator(), lg = c.createGain(); l.frequency.value = 5; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f * 0.006, t + 2); l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(t + dur + 0.8);
        }
        this.osc('sine', f, t, dur, 0.018 * vol, out, { attack: 1.0, release: 1.0 });
      } else if (kind === 'strings') {
        for (const [dt, pp] of [[-det, -0.5], [-det * 0.3, -0.15], [det * 0.3, 0.15], [det, 0.5]]) this.osc('sawtooth', f, t, dur, 0.015 * vol, out, { attack: 0.55, release: 0.9, detune: dt, lp: 900, lpTo: 2300, lpT: dur * 0.8, pan: pp });
      } else {
        this.osc('triangle', f, t, dur, 0.055 * vol, out, { attack: 0.8, release: 1.4, pan: pn, lp: 1800, lpTo: 3200, lpT: dur });
        this.osc('sine', f * 2, t, dur, 0.018 * vol, out, { attack: 1.0, release: 1.4, detune: 5, pan: -pn });
      }
    });
  }
  // ---------- bass ----------
  bass(kind, m, t, dur) {
    const f = mtof(m), out = this.out('bass');
    if (kind === 'drone') { this.osc('sine', f, t, dur, 0.16, out, { attack: 1.2, release: 1.5 }); this.osc('sawtooth', f, t, dur, 0.035, out, { attack: 1.4, release: 1.5, lp: 160, detune: 4 }); }
    else if (kind === 'drive') { this.osc('sawtooth', f, t, Math.max(0.1, dur * 0.9), 0.05, out, { attack: 0.004, release: 0.05, lp: 900, lpTo: 220, lpT: 0.12, q: 2 }); this.osc('sine', f, t, dur, 0.15, out, { attack: 0.004, release: 0.06 }); }
    else if (kind === 'pulse') { this.osc('square', f, t, dur, 0.05, out, { attack: 0.005, release: 0.06, lp: 700, lpTo: 260, lpT: 0.15 }); this.osc('sine', f, t, dur, 0.13, out, { attack: 0.005, release: 0.08 }); }
    else if (kind === 'oompah') { this.osc('triangle', f, t, dur, 0.16, out, { attack: 0.006, release: 0.1, lp: 900 }); this.osc('sine', f, t, dur, 0.14, out, { attack: 0.006, release: 0.1 }); }
    else { this.osc('sine', f, t, dur, 0.2, out, { attack: 0.01, release: 0.14 }); this.osc('triangle', f * 2, t, dur * 0.6, 0.05, out, { attack: 0.01, release: 0.1, lp: 1200, lpTo: 400, lpT: 0.3 }); }
  }
  // ---------- arpeggio ----------
  arp(kind, m, t, dur, vel = 1, pan = 0) {
    const f = mtof(m), out = this.out('arp');
    if (kind === 'bell') this.fm(f, 3.5, 0.9, t, dur * 3, 0.06 * vel, out, { pan });
    else if (kind === 'ping') this.fm(f, 2.01, 0.5, t, dur * 5, 0.06 * vel, out, { pan, mDur: 0.4 });
    else if (kind === 'harp') this.osc('triangle', f, t, dur * 2.5, 0.09 * vel, out, { attack: 0.003, release: 0.5, lp: 4200, lpTo: 900, lpT: 0.35, pan });
    else { this.osc('sawtooth', f, t, dur, 0.06 * vel, out, { attack: 0.004, release: 0.08, lp: 2600, lpTo: 500, lpT: 0.12, q: 1.5, pan }); }
  }
  // ---------- lead ----------
  lead(kind, m, t, dur, vel = 1) {
    const f = mtof(m), out = this.out('lead');
    if (kind === 'bell') { this.fm(f, 3.5, 1.4, t, Math.max(1.2, dur * 2), 0.11 * vel, out); this.osc('sine', f * 2, t, dur, 0.02 * vel, out, { attack: 0.004, release: 0.5 }); }
    else if (kind === 'marimba') { this.osc('sine', f, t, dur * 1.2, 0.13 * vel, out, { attack: 0.002, decay: 0.28, sustain: 0.05, release: 0.15 }); this.osc('sine', f * 4, t, 0.14, 0.04 * vel, out, { attack: 0.001, release: 0.05 }); this.noiseHit(t, 0.02, 0.05 * vel, 'bandpass', 2400, 2, out); }
    else if (kind === 'musicbox') { this.osc('sine', f, t, dur * 1.6, 0.1 * vel, out, { attack: 0.002, decay: 0.5, sustain: 0.08, release: 0.3 }); this.osc('sine', f * 5.43, t, 0.3, 0.025 * vel, out, { attack: 0.001, release: 0.15, detune: 6 }); }
    else if (kind === 'flute') { this.osc('sine', f, t, dur, 0.1 * vel, out, { attack: 0.07, release: 0.3, vib: 1.1, vibDelay: 0.2 }); this.osc('triangle', f * 2, t, dur, 0.02 * vel, out, { attack: 0.09, release: 0.3 }); this.noiseHit(t, 0.1, 0.02 * vel, 'bandpass', 3000, 1.2, out); }
    else if (kind === 'harp') this.osc('triangle', f, t, dur * 2, 0.11 * vel, out, { attack: 0.004, release: 0.6, lp: 4600, lpTo: 1100, lpT: 0.4 });
    else if (kind === 'brass') { for (const dt of [-7, 7]) this.osc('sawtooth', f, t, dur, 0.045 * vel, out, { attack: 0.06, release: 0.22, detune: dt, lp: 450, lpTo: 2600, lpT: 0.16, q: 1.2, vib: 0.5, vibDelay: 0.25 }); this.osc('square', f / 2, t, dur, 0.02 * vel, out, { attack: 0.05, release: 0.2, lp: 700 }); }
    else if (kind === 'accordion') { for (const dt of [-12, 0, 12]) this.osc('sawtooth', f, t, dur, 0.03 * vel, out, { attack: 0.03, release: 0.15, detune: dt, lp: 2200, bp: 1400, bpq: 1, trem: 6 }); }
    else if (kind === 'ping') { this.fm(f * 2, 2.0, 0.7, t, dur * 3 + 1.2, 0.08 * vel, out, { mDur: 0.5 }); }
    else this.osc('triangle', f, t, dur, 0.08 * vel, out, { attack: 0.01, release: 0.3 });
  }
  // ---------- percussion ----------
  kick(t, big) { const c = this.ctx, o = c.createOscillator(), g = c.createGain(); o.frequency.setValueAtTime(big ? 110 : 150, t); o.frequency.exponentialRampToValueAtTime(big ? 38 : 45, t + (big ? 0.3 : 0.14)); g.gain.setValueAtTime(big ? 0.55 : 0.4, t); g.gain.exponentialRampToValueAtTime(0.0001, t + (big ? 0.55 : 0.2)); o.connect(g); g.connect(this.out('perc')); o.start(t); o.stop(t + 0.6); if (big) this.noiseHit(t, 0.08, 0.1, 'lowpass', 400, 0.7, this.out('perc')); }
  snare(t, v = 1) { this.noiseHit(t, 0.14, 0.25 * v, 'bandpass', 1900, 0.8, this.out('perc')); const c = this.ctx, o = c.createOscillator(), g = c.createGain(); o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(110, t + 0.08); g.gain.setValueAtTime(0.18 * v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12); o.connect(g); g.connect(this.out('perc')); o.start(t); o.stop(t + 0.15); }
  tom(t, v = 1) { const c = this.ctx, o = c.createOscillator(), g = c.createGain(); o.frequency.setValueAtTime(190, t); o.frequency.exponentialRampToValueAtTime(80, t + 0.25); g.gain.setValueAtTime(0.35 * v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4); o.connect(g); g.connect(this.out('perc')); o.start(t); o.stop(t + 0.45); }
  hat(t, v) { this.noiseHit(t, 0.04, v * 0.12, 'highpass', 8000, 0.7, this.out('perc')); }
  rim(t) { this.noiseHit(t, 0.03, 0.12, 'bandpass', 1800, 4, this.out('perc')); this.osc('square', 820, t, 0.02, 0.05, this.out('perc'), { attack: 0.001, release: 0.02 }); }
  crash(t) { this.noiseHit(t, 1.6, 0.09, 'highpass', 5200, 0.6, this.out('perc')); this.noiseHit(t, 0.5, 0.05, 'bandpass', 3000, 1, this.out('perc')); }
  // rising noise sweep into a boss track
  riser(t, secs) {
    const c = this.ctx, s = c.createBufferSource(), g = c.createGain(), fl = c.createBiquadFilter(); s.buffer = this.noise; s.loop = true; fl.type = 'bandpass'; fl.Q.value = 1.2; fl.frequency.setValueAtTime(300, t); fl.frequency.exponentialRampToValueAtTime(7000, t + secs);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.16, t + secs); g.gain.linearRampToValueAtTime(0.0001, t + secs + 0.05); s.connect(fl); fl.connect(g); g.connect(this.stGain); s.start(t); s.stop(t + secs + 0.1);
    const o = c.createOscillator(), og = c.createGain(); o.type = 'sawtooth'; o.frequency.setValueAtTime(70, t); o.frequency.exponentialRampToValueAtTime(280, t + secs); og.gain.setValueAtTime(0.0001, t); og.gain.exponentialRampToValueAtTime(0.06, t + secs); og.gain.linearRampToValueAtTime(0.0001, t + secs + 0.05);
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; o.connect(lp); lp.connect(og); og.connect(this.stGain); o.start(t); o.stop(t + secs + 0.1);
  }
  // short musical flourishes over whatever is playing
  stinger(kind) {
    if (!this.ready || this.ctx.state !== 'running') return;
    const c = this.ctx, t = c.currentTime + 0.05, root = 60 + (((this.def?.root ?? 60) - 60) % 12 + 12) % 12 - (this.def && this.def.root > 66 ? 12 : 0);
    const lines = { victory: [0, 4, 7, 12, 16, 19, 24], level: [0, 7, 12, 16, 19], discover: [0, 7, 12], fall: [12, 10, 7, 3, 0] }[kind] || [0, 7, 12];
    lines.forEach((iv, k) => this.fm(mtof(root + iv + (kind === 'fall' ? -12 : 0)), 3.5, 1.2, t + k * (kind === 'victory' ? 0.11 : 0.08), kind === 'victory' ? 2.2 : 1.2, 0.1, this.stGain));
    if (kind === 'victory') for (const iv of [0, 4, 7]) this.osc('triangle', mtof(root - 12 + iv), t + 0.5, 2.4, 0.06, this.stGain, { attack: 0.3, release: 1.2 });
    if (this.master && this.def) { this.master.gain.setTargetAtTime(this.duckMul * 0.45, t, 0.1); this.master.gain.setTargetAtTime(this.duckMul, t + (kind === 'victory' ? 3 : 1.4), 0.5); }
  }
}
