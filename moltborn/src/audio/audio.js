// Procedural audio: every sound effect is synthesised with WebAudio (no sample files).
// AudioSys.sfx(name, {x,y}) plays positional one-shots; ambience() layers underwater beds; Music lives in music.js.
import { Music } from './music.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export class AudioSys {
  constructor(settings) {
    this.settings = settings; this.ctx = null; this.ready = false; this.listener = { x: 0, y: 0 }; this.last = {}; this.muted = false;
    this.music = new Music(this);
    this.duckT = 0; this.ambNodes = null; this.lowpassAmt = 0;
  }
  // must be called from a user gesture
  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const c = this.ctx = new AC();
    this.master = c.createGain(); this.master.gain.value = 0.9;
    this.comp = c.createDynamicsCompressor(); this.comp.threshold.value = -14; this.comp.ratio.value = 4;
    this.lp = c.createBiquadFilter(); this.lp.type = 'lowpass'; this.lp.frequency.value = 20000;
    this.master.connect(this.lp); this.lp.connect(this.comp); this.comp.connect(c.destination);
    this.sfxBus = c.createGain(); this.sfxBus.connect(this.master);
    this.musicBus = c.createGain(); this.musicBus.connect(this.master);
    this.ambBus = c.createGain(); this.ambBus.connect(this.master);
    // reverb send
    this.reverb = c.createConvolver(); this.reverb.buffer = this.impulse(2.2, 2.6);
    this.revSend = c.createGain(); this.revSend.gain.value = 0.25; this.revSend.connect(this.reverb); this.reverb.connect(this.master);
    this.noiseBuf = this.makeNoise(2);
    this.applyVolumes(); this.ready = true;
    this.music.init(c, this.musicBus, this.revSend);
    if (this.pendingAmb) this.ambience(this.pendingAmb);
  }
  applyVolumes() {
    if (!this.ctx) return;
    const s = this.settings, t = this.ctx.currentTime;
    this.sfxBus.gain.setTargetAtTime(this.muted ? 0 : (s.sfx ?? 0.8) * 0.9, t, 0.05);
    this.musicBus.gain.setTargetAtTime(this.muted ? 0 : (s.music ?? 0.7) * 0.55, t, 0.05);
    this.ambBus.gain.setTargetAtTime(this.muted ? 0 : (s.sfx ?? 0.8) * 0.5, t, 0.05);
  }
  impulse(sec, decay) {
    const c = this.ctx, n = Math.floor(c.sampleRate * sec), b = c.createBuffer(2, n, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay); }
    return b;
  }
  makeNoise(sec) { const c = this.ctx, n = c.sampleRate * sec, b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; return b; }
  setListener(x, y) { this.listener.x = x; this.listener.y = y; }
  // underwater muffling (menus, depth)
  setMuffle(k) { if (!this.ctx) return; this.lp.frequency.setTargetAtTime(20000 * Math.pow(1 - clamp(k, 0, 1), 3) + 500, this.ctx.currentTime, 0.1); }

  // ---- building blocks -------------------------------------------------------------------
  _out(o) {
    const c = this.ctx; let node = c.createGain(); node.gain.value = o.vol ?? 1;
    let tail = node;
    if (o.x !== undefined && o.y !== undefined) {
      const dx = o.x - this.listener.x, dy = o.y - this.listener.y, d = Math.hypot(dx, dy);
      node.gain.value *= clamp(1.2 - d / 360, 0.04, 1);
      if (c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = clamp(dx / 240, -0.8, 0.8); node.connect(p); tail = p; }
    }
    tail.connect(o.bus || this.sfxBus);
    if (o.rev) { const s = c.createGain(); s.gain.value = o.rev; tail.connect(s); s.connect(this.revSend); }
    return node;
  }
  tone(o) {
    const c = this.ctx, t = c.currentTime + (o.delay || 0), out = this._out(o), osc = c.createOscillator(), g = c.createGain();
    osc.type = o.type || 'sine'; osc.frequency.setValueAtTime(o.f, t);
    if (o.f2) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.f2), t + o.dur);
    if (o.detune) osc.detune.value = o.detune;
    const a = o.attack ?? 0.005; g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(o.v ?? 0.5, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    osc.connect(g); let n = g;
    if (o.filter) { const f = c.createBiquadFilter(); f.type = o.filter; f.frequency.value = o.ff || 1200; f.Q.value = o.q || 1; g.connect(f); n = f; }
    n.connect(out); osc.start(t); osc.stop(t + o.dur + 0.05);
    if (o.fm) { const m = c.createOscillator(), mg = c.createGain(); m.frequency.value = o.f * (o.fmr || 2); mg.gain.value = o.fm; m.connect(mg); mg.connect(osc.frequency); m.start(t); m.stop(t + o.dur + 0.05); }
  }
  noise(o) {
    const c = this.ctx, t = c.currentTime + (o.delay || 0), out = this._out(o), src = c.createBufferSource(), g = c.createGain(), f = c.createBiquadFilter();
    src.buffer = this.noiseBuf; src.loop = true; src.playbackRate.value = o.rate || 1;
    f.type = o.filter || 'bandpass'; f.Q.value = o.q || 1; f.frequency.setValueAtTime(o.f1 || 1000, t); if (o.f2) f.frequency.exponentialRampToValueAtTime(Math.max(20, o.f2), t + o.dur);
    const a = o.attack ?? 0.005; g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(o.v ?? 0.5, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    src.connect(f); f.connect(g); g.connect(out); src.start(t, Math.random() * 1.5); src.stop(t + o.dur + 0.05);
  }
  arp(notes, o = {}) { notes.forEach((f, i) => this.tone({ f, dur: o.dur || 0.2, type: o.type || 'triangle', v: o.v ?? 0.3, delay: i * (o.step || 0.07), rev: o.rev ?? 0.3, vol: o.vol })); }

  // ---- the sound library ---------------------------------------------------------------------
  sfx(name, o = {}) {
    if (!this.ready || this.muted) return;
    const now = this.ctx.currentTime, minGap = { hit: 0.04, claw: 0.04, coin: 0.03, die: 0.05, stroke: 0.1 }[name] ?? 0.03;
    if (this.last[name] && now - this.last[name] < minGap) return; this.last[name] = now;
    const r = RECIPES[name]; if (!r) return;
    try { r(this, o); } catch (e) { /* audio must never crash the game */ }
  }

  // ambient bed: filtered noise + occasional bubbles / creature calls, by biome
  ambience(kind) {
    if (!this.ready) { this.pendingAmb = kind; return; }
    if (this.ambKind === kind) return; this.ambKind = kind;
    const c = this.ctx;
    if (this.ambNodes) { const old = this.ambNodes; old.g.gain.setTargetAtTime(0, c.currentTime, 0.6); setTimeout(() => { try { old.src.stop(); old.lfo.stop(); } catch (e) {} }, 2500); clearInterval(old.timer); }
    const P = { shallows: [380, 0.5, 0.05], forest: [300, 0.6, 0.06], kingdom: [450, 0.4, 0.05], wrecks: [220, 0.7, 0.07], abyss: [120, 0.9, 0.09], trench: [90, 1, 0.1], domain: [260, 0.5, 0.07] }[kind] || [300, 0.5, 0.05];
    const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(), lfo = c.createOscillator(), lg = c.createGain();
    src.buffer = this.noiseBuf; src.loop = true; f.type = 'lowpass'; f.frequency.value = P[0]; f.Q.value = 2;
    lfo.frequency.value = 0.08 + Math.random() * 0.05; lg.gain.value = P[0] * 0.4; lfo.connect(lg); lg.connect(f.frequency);
    g.gain.value = 0; g.gain.setTargetAtTime(P[2] * 2, c.currentTime, 1.2);
    src.connect(f); f.connect(g); g.connect(this.ambBus); src.start(); lfo.start();
    const timer = setInterval(() => {
      if (!this.ctx || this.muted) return;
      if (Math.random() < 0.7) { const f0 = 500 + Math.random() * 900; this.tone({ f: f0, f2: f0 * 1.8, dur: 0.12, v: 0.06, bus: this.ambBus, rev: 0.4 }); if (Math.random() < 0.5) this.tone({ f: f0 * 1.2, f2: f0 * 2.4, dur: 0.1, v: 0.04, delay: 0.09, bus: this.ambBus }); }
      if (Math.random() < (kind === 'abyss' || kind === 'trench' ? 0.35 : 0.15)) { const f0 = 70 + Math.random() * 90; this.tone({ f: f0, f2: f0 * (0.6 + Math.random() * 0.8), dur: 2.2, v: 0.08, type: 'sawtooth', filter: 'lowpass', ff: 260, attack: 0.8, bus: this.ambBus, rev: 0.8 }); }
    }, 1800);
    this.ambNodes = { src, g, lfo, timer };
  }
}

const R = (name, fn) => (RECIPES[name] = fn);
const RECIPES = {};
R('hit', (a, o) => { a.noise({ dur: 0.1, f1: 1800, f2: 400, q: 0.8, v: 0.5, ...o }); a.tone({ f: 160, f2: 60, dur: 0.12, v: 0.5, type: 'triangle', ...o }); });
R('crit', (a, o) => { a.noise({ dur: 0.14, f1: 3200, f2: 500, v: 0.6, ...o }); a.tone({ f: 420, f2: 120, dur: 0.18, v: 0.45, type: 'square', filter: 'lowpass', ff: 1800, ...o }); a.tone({ f: 1200, f2: 1800, dur: 0.12, v: 0.2, delay: 0.02, ...o }); });
R('heavyhit', (a, o) => { a.noise({ dur: 0.22, f1: 900, f2: 120, v: 0.8, ...o }); a.tone({ f: 100, f2: 38, dur: 0.3, v: 0.8, type: 'sine', ...o }); });
R('claw', (a, o) => { a.noise({ dur: 0.07, f1: 4000, f2: 1500, q: 2, v: 0.3, ...o }); a.tone({ f: 900, f2: 300, dur: 0.06, v: 0.2, type: 'square', filter: 'highpass', ff: 600, ...o }); });
R('heavy', (a, o) => { a.noise({ dur: 0.25, f1: 1200, f2: 200, v: 0.55, ...o }); a.tone({ f: 120, f2: 50, dur: 0.3, v: 0.6, ...o }); });
R('swoosh', (a, o) => a.noise({ dur: 0.18, f1: 600, f2: 2400, q: 1.2, v: 0.28, attack: 0.06, ...o }));
R('dash', (a, o) => { a.noise({ dur: 0.2, f1: 400, f2: 1800, q: 0.8, v: 0.35, attack: 0.04, ...o }); });
R('stroke', (a, o) => { a.noise({ dur: 0.18, f1: 500, f2: 1200, q: 2, v: 0.18, attack: 0.03, ...o }); a.tone({ f: 300, f2: 520, dur: 0.1, v: 0.12, ...o }); });
R('alert', (a, o) => { a.tone({ f: 880, dur: 0.06, v: 0.25, type: 'square', ...o }); a.tone({ f: 1320, dur: 0.08, v: 0.25, type: 'square', delay: 0.07, ...o }); });
R('hurt', (a, o) => { a.tone({ f: 380, f2: 110, dur: 0.3, v: 0.6, type: 'sawtooth', filter: 'lowpass', ff: 1400, ...o }); a.noise({ dur: 0.15, f1: 1500, f2: 300, v: 0.4, ...o }); });
R('clang', (a, o) => { a.tone({ f: 1400, dur: 0.25, v: 0.3, type: 'square', filter: 'bandpass', ff: 2200, q: 4, ...o, rev: 0.2 }); a.tone({ f: 2100, dur: 0.15, v: 0.2, type: 'sine', ...o }); });
R('parry', (a, o) => { a.tone({ f: 1800, dur: 0.35, v: 0.35, type: 'sine', fm: 600, fmr: 1.5, rev: 0.5, ...o }); a.tone({ f: 2700, dur: 0.3, v: 0.2, delay: 0.02, ...o }); a.noise({ dur: 0.06, f1: 5000, v: 0.3, ...o }); });
R('riposte', (a, o) => { a.tone({ f: 900, f2: 2400, dur: 0.15, v: 0.3, type: 'sawtooth', filter: 'highpass', ff: 700, ...o }); a.noise({ dur: 0.1, f1: 4000, v: 0.3, ...o }); });
R('die', (a, o) => { a.tone({ f: 260, f2: 60, dur: 0.35, v: 0.5, type: 'triangle', ...o }); a.noise({ dur: 0.3, f1: 2000, f2: 200, v: 0.4, ...o }); });
R('bossdie', (a, o) => { for (let i = 0; i < 6; i++) { a.tone({ f: 200 - i * 20, f2: 40, dur: 0.8, v: 0.5, type: 'sawtooth', filter: 'lowpass', ff: 800, delay: i * 0.18, rev: 0.6 }); a.noise({ dur: 0.5, f1: 1500, f2: 100, v: 0.5, delay: i * 0.18 }); } a.arp([220, 330, 440, 660], { step: 0.2, dur: 1.2, delay: 1 }); });
R('death', (a, o) => { a.tone({ f: 300, f2: 40, dur: 1.1, v: 0.55, type: 'sawtooth', filter: 'lowpass', ff: 900, rev: 0.7 }); a.noise({ dur: 0.6, f1: 1200, f2: 80, v: 0.5 }); });
R('boom', (a, o) => { a.noise({ dur: 0.5, f1: 800, f2: 60, v: 0.9, ...o }); a.tone({ f: 90, f2: 30, dur: 0.5, v: 0.9, ...o }); });
R('slam', (a, o) => { a.noise({ dur: 0.4, f1: 600, f2: 60, v: 0.8, ...o }); a.tone({ f: 80, f2: 28, dur: 0.45, v: 0.9, ...o }); });
R('shoot', (a, o) => { a.tone({ f: 500, f2: 200, dur: 0.12, v: 0.3, type: 'square', filter: 'lowpass', ff: 1500, ...o }); });
R('spore', (a, o) => { a.tone({ f: 220, f2: 140, dur: 0.2, v: 0.35, type: 'triangle', ...o }); a.noise({ dur: 0.14, f1: 800, v: 0.2, ...o }); });
R('spit', (a, o) => { a.tone({ f: 600, f2: 1400, dur: 0.1, v: 0.3, ...o }); a.noise({ dur: 0.08, f1: 2500, v: 0.2, ...o }); });
R('cannon', (a, o) => { a.noise({ dur: 0.5, f1: 500, f2: 50, v: 1, ...o }); a.tone({ f: 70, f2: 26, dur: 0.5, v: 1, ...o }); });
R('zap', (a, o) => { a.tone({ f: 1800, f2: 200, dur: 0.18, v: 0.3, type: 'sawtooth', ...o }); a.noise({ dur: 0.2, f1: 5000, v: 0.3, ...o }); });
R('charge', (a, o) => { a.tone({ f: 140, f2: 480, dur: 0.6, v: 0.18, type: 'sawtooth', filter: 'lowpass', ff: 900, attack: 0.3, ...o }); });
R('charged', (a, o) => { a.tone({ f: 880, dur: 0.15, v: 0.3, ...o }); a.tone({ f: 1320, dur: 0.2, v: 0.3, delay: 0.07, ...o }); });
R('deny', (a, o) => { a.tone({ f: 160, dur: 0.12, v: 0.3, type: 'square', filter: 'lowpass', ff: 600, ...o }); });
R('sand', (a, o) => a.noise({ dur: 0.35, f1: 2200, f2: 900, q: 0.5, v: 0.35, ...o }));
R('beam', (a, o) => { a.tone({ f: 500, f2: 900, dur: 0.4, v: 0.3, type: 'sawtooth', filter: 'lowpass', ff: 2500, ...o }); a.noise({ dur: 0.35, f1: 3000, v: 0.25, ...o }); });
R('whirl', (a, o) => { a.noise({ dur: 1.2, f1: 300, f2: 900, q: 3, v: 0.35, attack: 0.3, ...o }); });
R('wave', (a, o) => { a.noise({ dur: 1.0, f1: 200, f2: 1400, q: 0.6, v: 0.6, attack: 0.35, ...o }); a.tone({ f: 90, f2: 150, dur: 1, v: 0.4, ...o }); });
R('slack', (a, o) => { a.tone({ f: 800, f2: 100, dur: 0.8, v: 0.35, type: 'sine', rev: 0.8, ...o }); });
R('ult', (a, o) => { a.tone({ f: 100, f2: 440, dur: 0.9, v: 0.5, type: 'sawtooth', filter: 'lowpass', ff: 1600, attack: 0.2, rev: 0.6 }); a.arp([440, 554, 659, 880, 1109], { step: 0.07, dur: 0.6, v: 0.3, rev: 0.6 }); a.noise({ dur: 0.9, f1: 400, f2: 3000, v: 0.4, attack: 0.3 }); });
R('revive', (a, o) => a.arp([330, 440, 554, 660, 880], { step: 0.09, dur: 0.5, rev: 0.6 }));
R('pressure', (a, o) => { a.tone({ f: 70, f2: 40, dur: 0.5, v: 0.5, type: 'sine', ...o }); a.noise({ dur: 0.4, f1: 200, f2: 60, v: 0.3, ...o }); });
R('chest', (a, o) => { a.noise({ dur: 0.1, f1: 600, v: 0.3, ...o }); a.arp([523, 659, 784, 1047], { step: 0.07, dur: 0.4, v: 0.3, rev: 0.5 }); });
R('unlock', (a, o) => { a.tone({ f: 900, dur: 0.05, v: 0.3, type: 'square', ...o }); a.tone({ f: 1200, dur: 0.05, v: 0.3, type: 'square', delay: 0.08, ...o }); a.noise({ dur: 0.2, f1: 400, f2: 100, v: 0.4, delay: 0.1, ...o }); });
R('rockbreak', (a, o) => { a.noise({ dur: 0.45, f1: 1400, f2: 120, v: 0.8 }); a.tone({ f: 120, f2: 40, dur: 0.4, v: 0.6 }); });
R('coin', (a, o) => { a.tone({ f: 1318, dur: 0.1, v: 0.25, type: 'square', filter: 'lowpass', ff: 3000 }); a.tone({ f: 1760, dur: 0.2, v: 0.25, type: 'square', filter: 'lowpass', ff: 3000, delay: 0.07 }); });
R('pickup', (a, o) => a.arp([660, 880], { step: 0.06, dur: 0.2, v: 0.3 }));
R('item', (a, o) => a.arp([523, 659, 784, 1047, 1319], { step: 0.07, dur: 0.5, v: 0.3, rev: 0.6 }));
R('levelup', (a, o) => { a.arp([392, 494, 587, 784, 988, 1175], { step: 0.07, dur: 0.6, v: 0.3, rev: 0.7 }); });
R('tick', (a, o) => a.tone({ f: 1000, dur: 0.03, v: 0.18, type: 'square', filter: 'lowpass', ff: 3000 }));
R('select', (a, o) => { a.tone({ f: 700, dur: 0.06, v: 0.25, type: 'square', filter: 'lowpass', ff: 3000 }); a.tone({ f: 1050, dur: 0.1, v: 0.25, type: 'square', filter: 'lowpass', ff: 3000, delay: 0.05 }); });
R('back', (a, o) => a.tone({ f: 500, f2: 300, dur: 0.1, v: 0.25, type: 'square', filter: 'lowpass', ff: 2000 }));
R('talk', (a, o) => a.tone({ f: 300 + Math.random() * 200, dur: 0.04, v: 0.12, type: 'square', filter: 'lowpass', ff: 1500 }));
R('save', (a, o) => a.arp([523, 784, 1047], { step: 0.1, dur: 0.6, v: 0.25, rev: 0.7 }));
R('rest', (a, o) => { a.arp([330, 392, 494, 659], { step: 0.14, dur: 1.2, v: 0.25, rev: 0.9, type: 'sine' }); });
R('evolve', (a, o) => { a.tone({ f: 60, f2: 800, dur: 3, v: 0.5, type: 'sawtooth', filter: 'lowpass', ff: 1800, attack: 1.2, rev: 0.8 }); a.noise({ dur: 3, f1: 200, f2: 6000, v: 0.4, attack: 1.4 }); a.arp([262, 330, 392, 523, 659, 784, 1047], { step: 0.28, dur: 1.6, v: 0.3, rev: 0.9, delay: 0 }); });
R('evolve_burst', (a, o) => { a.noise({ dur: 1.2, f1: 4000, f2: 100, v: 0.9 }); a.tone({ f: 80, f2: 20, dur: 1, v: 1 }); a.arp([523, 659, 784, 1047, 1319, 1568], { step: 0.06, dur: 1.5, v: 0.35, rev: 0.9 }); });
R('bosswarn', (a, o) => { a.tone({ f: 70, f2: 50, dur: 1.4, v: 0.7, type: 'sawtooth', filter: 'lowpass', ff: 400, rev: 0.9 }); a.noise({ dur: 1.4, f1: 100, f2: 500, v: 0.4, attack: 0.5 }); });
R('roar', (a, o) => { a.tone({ f: 110, f2: 55, dur: 1.1, v: 0.6, type: 'sawtooth', filter: 'lowpass', ff: 600, rev: 0.7 }); a.noise({ dur: 1.1, f1: 300, f2: 120, v: 0.5, q: 0.5 }); });
R('thunder', (a, o) => { a.noise({ dur: 1.4, f1: 700, f2: 60, v: 0.9, attack: 0.02 }); a.tone({ f: 60, f2: 25, dur: 1.2, v: 0.8 }); });
R('gong', (a, o) => { a.tone({ f: 110, dur: 3, v: 0.5, fm: 80, fmr: 1.41, rev: 0.8 }); a.tone({ f: 220, dur: 2.5, v: 0.25, rev: 0.8 }); });
