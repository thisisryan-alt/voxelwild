// Stillwater: all sound is synthesised live. Surf follows the breath cycle; wind, rain, fire,
// wildlife, insects, chimes and slow pentatonic music each have their own mixer channel.
(function (SW) {
  'use strict';
  const { U } = SW;
  const S = SW.S;
  const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const rand = Math.random;
  const CHANNELS = ['waves', 'wind', 'rain', 'wildlife', 'insects', 'fire', 'chimes', 'music'];

  const A = SW.audio = {
    ctx: null, on: false, master: 0.7, levels: Object.fromEntries(CHANNELS.map((c) => [c, 0.8])),
    CHANNELS,
    init() {
      if (this.ctx) return true;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      const ctx = this.ctx = new AC();
      this.out = ctx.createGain(); this.out.gain.value = 0;
      const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 3;
      this.out.connect(comp); comp.connect(ctx.destination);
      this.verb = ctx.createConvolver(); this.verb.buffer = this.impulse(4.5);
      this.verbIn = ctx.createGain(); this.verbIn.gain.value = 0.8;
      this.verbIn.connect(this.verb); this.verb.connect(this.out);
      this.ch = {};
      for (const c of CHANNELS) { const g = ctx.createGain(); g.gain.value = this.levels[c]; g.connect(this.out); this.ch[c] = g; }
      const brown = this.noise('brown'), pink = this.noise('pink');
      this.pink = pink;
      const src = (buf, offset) => { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.start(0, offset); return s; };
      const filt = (type, f, q) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; if (q) b.Q.value = q; return b; };
      const gain = (v = 0) => { const g = ctx.createGain(); g.gain.value = v; return g; };
      // surf: the swell builds on the inhale and washes out on the exhale
      this.surfLP = filt('lowpass', 400); this.surf = gain();
      src(brown, 0).connect(this.surfLP); this.surfLP.connect(this.surf); this.surf.connect(this.ch.waves);
      this.washBP = filt('bandpass', 1400, 0.6); this.wash = gain();
      const merger = ctx.createChannelMerger(2);
      src(pink, 0).connect(merger, 0, 0); src(pink, 2.7).connect(merger, 0, 1);
      merger.connect(this.washBP); this.washBP.connect(this.wash); this.wash.connect(this.ch.waves); this.wash.connect(this.verbIn);
      // wind
      this.windBP = filt('bandpass', 450, 1.2); this.wind = gain();
      src(pink, 1.3).connect(this.windBP); this.windBP.connect(this.wind); this.wind.connect(this.ch.wind);
      // rain: hiss plus a low patter on the water
      const rhp = filt('highpass', 500), rlp = filt('lowpass', 5200); this.rain = gain();
      src(pink, 3.9).connect(rhp); rhp.connect(rlp); rlp.connect(this.rain); this.rain.connect(this.ch.rain);
      this.rainLowLP = filt('lowpass', 300); this.rainLow = gain();
      src(brown, 2.2).connect(this.rainLowLP); this.rainLowLP.connect(this.rainLow); this.rainLow.connect(this.ch.rain);
      // fire: a low roar under the crackles
      this.fireLP = filt('lowpass', 180); this.fire = gain();
      src(brown, 4.1).connect(this.fireLP); this.fireLP.connect(this.fire); this.fire.connect(this.ch.fire);
      // pads
      this.padBus = filt('lowpass', 1100); const padGain = gain(0.9);
      this.padBus.connect(padGain); padGain.connect(this.ch.music); padGain.connect(this.verbIn);
      const now = ctx.currentTime;
      Object.assign(this, { nextChord: now + 3, chordIdx: 0, nextPhrase: now + 14, nextChime: now + 9, nextCricket: 0, nextDrip: 0, nextCrackle: 0, nextBirdAmbient: now + 6, noteIdx: 0, nextWindChime: now + 4 });
      return true;
    },
    impulse(seconds) {
      const ctx = this.ctx, len = (ctx.sampleRate * seconds) | 0, buf = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let c = 0; c < 2; c++) { const d = buf.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (rand() * 2 - 1) * Math.pow(1 - i / len, 2.8) * 0.5; }
      return buf;
    },
    noise(kind) {
      const ctx = this.ctx, len = ctx.sampleRate * 6, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
      let last = 0, b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < len; i++) {
        const w = rand() * 2 - 1;
        if (kind === 'brown') { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
        else {
          b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
          b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
          d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926;
        }
      }
      const fade = 2000;
      for (let i = 0; i < fade; i++) { const k = i / fade; d[len - fade + i] = d[len - fade + i] * (1 - k) + d[i] * k; }
      return buf;
    },
    setOn(on) {
      if (on && !this.init()) return false;
      this.on = on;
      if (this.ctx) {
        if (on && this.ctx.state === 'suspended') this.ctx.resume();
        this.out.gain.setTargetAtTime(on ? this.master : 0, this.ctx.currentTime, on ? 1.5 : 0.3);
      }
      return on;
    },
    setMaster(v) { this.master = v; if (this.ctx && this.on) this.out.gain.setTargetAtTime(v, this.ctx.currentTime, 0.2); },
    setChannel(name, v) { this.levels[name] = v; if (this.ctx) this.ch[name].gain.setTargetAtTime(v, this.ctx.currentTime, 0.2); },
    ready() { return this.ctx && this.on; },
    pan(p, dest) {
      const ctx = this.ctx;
      if (!ctx.createStereoPanner) return dest;
      const n = ctx.createStereoPanner(); n.pan.value = U.clamp(p || 0, -1, 1); n.connect(dest); return n;
    },
    env(g, t, peak, attack, release) {
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(peak, t + attack);
      g.gain.exponentialRampToValueAtTime(0.0001, t + attack + release);
    },
    tone(freq, t, dur, peak, dest, type = 'sine', attack = 0.01) {
      const o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = type; o.frequency.value = freq;
      this.env(g, t, peak, attack, dur);
      o.connect(g); g.connect(dest); o.start(t); o.stop(t + attack + dur + 0.05);
      return o;
    },
    bell(freq, vol, pan = 0, when = 0, dest) {
      if (!this.ready()) return;
      const ctx = this.ctx, t = when || ctx.currentTime, out = this.pan(pan, dest || this.ch.chimes);
      const g = ctx.createGain(); this.env(g, t, vol, 0.012, 3.4);
      g.connect(out); g.connect(this.verbIn);
      for (const [m, v] of [[1, 1], [2.003, 0.22], [3.01, 0.06]]) {
        const o = ctx.createOscillator(), og = ctx.createGain();
        o.frequency.value = freq * m; og.gain.value = v;
        o.connect(og); og.connect(g); o.start(t); o.stop(t + 3.5);
      }
    },
    noiseBurst(t, dur, freq, q, peak, dest, pan) {
      const ctx = this.ctx, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      s.buffer = this.pink; f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
      this.env(g, t, peak, 0.002, dur);
      s.connect(f); f.connect(g); g.connect(pan == null ? dest : this.pan(pan, dest));
      s.start(t, rand() * 5); s.stop(t + dur + 0.05);
    },

    // ------------------------------------------------------------- one-shots
    plop() {
      if (!this.ready()) return;
      const ctx = this.ctx, t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.setValueAtTime(560, t); o.frequency.exponentialRampToValueAtTime(150, t + 0.16);
      this.env(g, t, 0.16, 0.008, 0.3);
      o.connect(g); g.connect(this.ch.waves); g.connect(this.verbIn); o.start(t); o.stop(t + 0.35);
    },
    tick(i) {
      if (!this.ready()) return;
      const ctx = this.ctx, t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain(), f = 900 - i * 40;
      o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 0.6, t + 0.06);
      this.env(g, t, 0.07 * Math.pow(0.85, i), 0.004, 0.09);
      o.connect(g); g.connect(this.ch.waves); o.start(t); o.stop(t + 0.12);
      this.noiseBurst(t, 0.06, 2500, 1, 0.03, this.ch.waves);
    },
    splash(pan, vol = 1) { if (this.ready()) this.noiseBurst(this.ctx.currentTime, 0.28, 1300, 0.8, 0.07 * vol, this.ch.waves, pan); },
    whoosh() {
      if (!this.ready()) return;
      const ctx = this.ctx, t = ctx.currentTime, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      s.buffer = this.pink; f.type = 'bandpass'; f.Q.value = 2;
      f.frequency.setValueAtTime(400, t); f.frequency.exponentialRampToValueAtTime(1600, t + 0.35);
      this.env(g, t, 0.05, 0.1, 0.3);
      s.connect(f); f.connect(g); g.connect(this.ch.wind); s.start(t); s.stop(t + 0.5);
    },
    plantNote() {
      const scale = [74, 76, 78, 81, 83, 86];
      this.noteIdx = (this.noteIdx + 1 + ((rand() * 2) | 0)) % scale.length;
      this.bell(midi(scale[this.noteIdx]), 0.09, rand() * 0.6 - 0.3);
    },
    bloom() { if (!this.ready()) return; const t = this.ctx.currentTime; this.bell(midi(81), 0.05, -0.2, t); this.bell(midi(86), 0.045, 0.2, t + 0.45); },
    remove() { if (!this.ready()) return; const t = this.ctx.currentTime; this.bell(midi(78), 0.04, 0, t); this.bell(midi(74), 0.035, 0, t + 0.25); },
    wish() { if (!this.ready()) return; const t = this.ctx.currentTime; [81, 83, 86, 88, 90, 93].forEach((m, i) => this.bell(midi(m), 0.045, (i - 2.5) * 0.15, t + i * 0.09)); },
    chime(pan) { const hi = [86, 88, 90, 93, 95]; this.bell(midi(hi[(rand() * hi.length) | 0]) * 1.002, 0.035, pan); },
    release() {
      if (!this.ready()) return;
      const t = this.ctx.currentTime;
      this.bell(midi(62), 0.06, 0, t); this.bell(midi(69), 0.05, 0, t + 0.6); this.bell(midi(74), 0.045, 0, t + 1.2);
      this.whoosh();
    },
    bowl(times = 1) {
      if (!this.init()) return;
      if (this.ctx.state === 'suspended') this.ctx.resume();
      const ctx = this.ctx, bus = ctx.createGain();
      bus.gain.value = Math.max(0.35, this.master);
      bus.connect(ctx.destination);
      for (let n = 0; n < times; n++) {
        const t = ctx.currentTime + n * 4;
        for (const [m, dec, v] of [[1, 14, 0.12], [2.76, 9, 0.05], [5.4, 5, 0.025], [8.9, 3, 0.012]]) {
          for (const det of [-0.6, 0.6]) {
            const o = ctx.createOscillator(), g = ctx.createGain();
            o.frequency.value = 220 * m + det;
            g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + dec);
            o.connect(g); g.connect(bus); if (this.on) g.connect(this.verbIn); o.start(t); o.stop(t + dec + 0.1);
          }
        }
      }
    },
    bird(pan) {
      if (!this.ready()) return;
      const ctx = this.ctx, n = 2 + ((rand() * 4) | 0), base = 2300 + rand() * 1700, out = this.pan(pan, this.ch.wildlife);
      let t = ctx.currentTime + 0.05;
      for (let i = 0; i < n; i++) {
        const o = ctx.createOscillator(), g = ctx.createGain(), up = 1.2 + rand() * 0.3;
        o.frequency.setValueAtTime(base, t); o.frequency.exponentialRampToValueAtTime(base * up, t + 0.045); o.frequency.exponentialRampToValueAtTime(base * 0.88, t + 0.1);
        this.env(g, t, 0.022, 0.012, 0.1);
        o.connect(g); g.connect(out); g.connect(this.verbIn); o.start(t); o.stop(t + 0.13);
        t += 0.12 + rand() * 0.07;
      }
    },
    gull(pan) {
      if (!this.ready()) return;
      const ctx = this.ctx, out = this.pan(pan, this.ch.wildlife);
      let t = ctx.currentTime + 0.05;
      for (let i = 0; i < 3; i++) {
        const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
        o.type = 'sawtooth'; f.type = 'bandpass'; f.frequency.value = 1400; f.Q.value = 3;
        o.frequency.setValueAtTime(1500, t); o.frequency.exponentialRampToValueAtTime(1050, t + 0.35);
        this.env(g, t, 0.014, 0.05, 0.35);
        o.connect(f); f.connect(g); g.connect(out); g.connect(this.verbIn); o.start(t); o.stop(t + 0.45);
        t += 0.45;
      }
    },
    owl(pan) {
      if (!this.ready()) return;
      const ctx = this.ctx, out = this.pan(pan, this.ch.wildlife), t = ctx.currentTime + 0.05;
      for (const [start, dur] of [[0, 0.45], [0.75, 0.25], [1.1, 0.9]]) {
        const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
        f.type = 'lowpass'; f.frequency.value = 900;
        o.frequency.setValueAtTime(400, t + start); o.frequency.linearRampToValueAtTime(375, t + start + dur);
        g.gain.setValueAtTime(0, t + start); g.gain.linearRampToValueAtTime(0.06, t + start + 0.08); g.gain.linearRampToValueAtTime(0, t + start + dur);
        o.connect(f); f.connect(g); g.connect(out); g.connect(this.verbIn); o.start(t + start); o.stop(t + start + dur + 0.05);
      }
    },
    croak(pan) {
      if (!this.ready()) return;
      const ctx = this.ctx, out = this.pan(pan, this.ch.insects);
      let t = ctx.currentTime + 0.02;
      for (let i = 0; i < 2; i++) {
        const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain(), am = ctx.createOscillator(), amg = ctx.createGain();
        o.type = 'sawtooth'; o.frequency.value = 130 + rand() * 40; f.type = 'bandpass'; f.frequency.value = 520; f.Q.value = 2.5;
        am.frequency.value = 28; amg.gain.value = 0.035;
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.05, t + 0.03); g.gain.linearRampToValueAtTime(0, t + 0.22);
        am.connect(amg); amg.connect(g.gain);
        o.connect(f); f.connect(g); g.connect(out); o.start(t); am.start(t); o.stop(t + 0.25); am.stop(t + 0.25);
        t += 0.26;
      }
    },
    quack(pan, baby) {
      if (!this.ready()) return;
      const ctx = this.ctx, out = this.pan(pan, this.ch.wildlife);
      let t = ctx.currentTime + 0.02;
      for (let i = 0; i < (baby ? 3 : 2); i++) {
        const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain(), base = baby ? 1800 : 420;
        o.type = baby ? 'sine' : 'sawtooth'; f.type = 'bandpass'; f.frequency.value = baby ? 2200 : 1100; f.Q.value = 3;
        o.frequency.setValueAtTime(base, t); o.frequency.exponentialRampToValueAtTime(base * 0.75, t + 0.14);
        this.env(g, t, baby ? 0.02 : 0.05, 0.01, 0.15);
        o.connect(f); f.connect(g); g.connect(out); o.start(t); o.stop(t + 0.18);
        t += baby ? 0.13 : 0.2;
      }
    },
    purr() {
      if (!this.ready()) return;
      const ctx = this.ctx, t = ctx.currentTime, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
      s.buffer = this.pink; f.type = 'lowpass'; f.frequency.value = 260;
      lfo.frequency.value = 24; lg.gain.value = 0.07;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.14, t + 0.6); g.gain.setValueAtTime(0.14, t + 3.6); g.gain.linearRampToValueAtTime(0, t + 4.6);
      lfo.connect(lg); lg.connect(g.gain);
      s.connect(f); f.connect(g); g.connect(this.ch.wildlife); s.start(t); lfo.start(t); s.stop(t + 4.7); lfo.stop(t + 4.7);
    },
    whale(pan) {
      if (!this.ready()) return;
      const ctx = this.ctx, out = this.pan(pan, this.ch.wildlife), lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 900; lp.connect(out);
      const send = ctx.createGain(); send.gain.value = 1.4; lp.connect(send); send.connect(this.verbIn);
      let t = ctx.currentTime + 0.3;
      for (const [f0, f1, f2, dur] of [[180, 340, 210, 3.2], [260, 150, 120, 2.6], [140, 300, 280, 3.6]]) {
        const o = ctx.createOscillator(), g = ctx.createGain(), vib = ctx.createOscillator(), vg = ctx.createGain();
        o.type = 'triangle';
        o.frequency.setValueAtTime(f0, t); o.frequency.linearRampToValueAtTime(f1, t + dur * 0.5); o.frequency.linearRampToValueAtTime(f2, t + dur);
        vib.frequency.value = 5; vg.gain.value = 6; vib.connect(vg); vg.connect(o.frequency);
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.045, t + dur * 0.3); g.gain.linearRampToValueAtTime(0, t + dur);
        o.connect(g); g.connect(lp); o.start(t); vib.start(t); o.stop(t + dur + 0.1); vib.stop(t + dur + 0.1);
        t += dur + 0.8;
      }
    },
    oar() {
      if (!this.ready()) return;
      const t = this.ctx.currentTime;
      this.noiseBurst(t, 0.35, 700, 0.7, 0.05, this.ch.waves, -0.3);
      this.noiseBurst(t + 0.03, 0.35, 760, 0.7, 0.05, this.ch.waves, 0.3);
      this.noiseBurst(t + 0.25, 0.6, 1800, 0.5, 0.025, this.ch.waves, 0);
    },
    bleat(pan) {
      if (!this.ready()) return;
      const ctx = this.ctx, t = ctx.currentTime + 0.02, o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
      o.type = 'sawtooth'; o.frequency.setValueAtTime(330, t); o.frequency.linearRampToValueAtTime(300, t + 0.6);
      lfo.frequency.value = 9; lg.gain.value = 18; lfo.connect(lg); lg.connect(o.frequency);
      f.type = 'bandpass'; f.frequency.value = 1100; f.Q.value = 2.5;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.03, t + 0.08); g.gain.linearRampToValueAtTime(0, t + 0.65);
      o.connect(f); f.connect(g); g.connect(this.pan(pan, this.ch.wildlife)); g.connect(this.verbIn);
      o.start(t); lfo.start(t); o.stop(t + 0.7); lfo.stop(t + 0.7);
    },
    bark(pan) {
      if (!this.ready()) return;
      const ctx = this.ctx, out = this.pan(pan, this.ch.wildlife);
      let t = ctx.currentTime + 0.02;
      for (let i = 0; i < 2 + ((rand() * 2) | 0); i++) {
        const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
        o.type = 'sawtooth'; o.frequency.setValueAtTime(260, t); o.frequency.exponentialRampToValueAtTime(170, t + 0.2);
        f.type = 'lowpass'; f.frequency.value = 900;
        this.env(g, t, 0.035, 0.02, 0.22);
        o.connect(f); f.connect(g); g.connect(out); g.connect(this.verbIn); o.start(t); o.stop(t + 0.3);
        t += 0.32;
      }
    },
    chord(notes, t, soft) {
      const ctx = this.ctx;
      for (const m of notes) for (const [type, det, v] of [['sine', 0, 0.034], ['triangle', 5, 0.014]]) {
        const o = ctx.createOscillator(), g = ctx.createGain(), vol = v * (soft ? 0.7 : 1);
        o.type = type; o.frequency.value = midi(m); o.detune.value = det + (rand() - 0.5) * 4;
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 5); g.gain.setValueAtTime(vol, t + 13); g.gain.linearRampToValueAtTime(0, t + 21);
        o.connect(g); g.connect(this.padBus); o.start(t); o.stop(t + 21.2);
      }
    },

    // ---------------------------------------------------------------- update
    update(e) {
      if (!this.ready()) return;
      const ctx = this.ctx, now = ctx.currentTime, tc = 0.12, wx = S.weather, b = S.breath.b;
      this.surf.gain.setTargetAtTime(0.16 + 0.3 * b, now, tc);
      this.surfLP.frequency.setTargetAtTime(260 + 520 * b, now, tc);
      const x = S.breath.outT, w = x < 0.9 ? x / 0.9 : Math.exp(-(x - 0.9) * 0.75);
      this.wash.gain.setTargetAtTime(0.012 + 0.11 * w, now, tc);
      this.washBP.frequency.setTargetAtTime(900 + 1500 * w, now, tc);
      this.wind.gain.setTargetAtTime((0.03 + 0.05 * wx.wind) * (1 - wx.snow * 0.4), now, 0.5);
      this.windBP.frequency.setTargetAtTime(330 + 260 * wx.wind + 80 * Math.sin(S.t * 0.031), now, 0.5);
      this.rain.gain.setTargetAtTime(wx.rain * 0.16, now, 0.5);
      this.rainLow.gain.setTargetAtTime(wx.rain * 0.12, now, 0.5);
      if (wx.rain > 0.05 && now > this.nextDrip) {
        this.noiseBurst(now + 0.01, 0.03, 2500 + rand() * 3000, 2, 0.02 * wx.rain, this.ch.rain, rand() * 1.6 - 0.8);
        this.nextDrip = now + 0.02 + rand() * 0.12 / wx.rain;
      }
      this.fire.gain.setTargetAtTime(e.fire * 0.09, now, 0.4);
      if (e.fire > 0.02 && now > this.nextCrackle) {
        this.noiseBurst(now + 0.01, 0.006 + rand() * 0.02, 1500 + rand() * 3000, 1.5, (0.02 + rand() * 0.05) * e.fire, this.ch.fire, rand() * 0.4 - 0.2);
        this.nextCrackle = now + 0.04 + rand() * 0.25;
      }
      // music: slow pads with long rests, and a sparse melody now and then
      if (now > this.nextChord - 0.1) {
        const night = S.night > 0.55;
        const DAY = [[38, 45, 54, 57, 64], [35, 42, 50, 54, 57], [43, 50, 54, 59, 62], [45, 52, 57, 59, 64]];
        const NIGHT = [[35, 42, 50, 54, 59], [31, 38, 47, 50, 54], [33, 40, 47, 52, 57], [30, 37, 45, 49, 54]];
        this.chord((night ? NIGHT : DAY)[this.chordIdx % 4], this.nextChord, night);
        this.chordIdx++; this.nextChord += 26;
      }
      if (now > this.nextPhrase) {
        const scale = S.night > 0.55 ? [71, 74, 76, 78, 81, 83] : [74, 76, 78, 81, 83, 86, 88];
        let idx = (rand() * scale.length) | 0, t = now + 0.1;
        const n = 3 + ((rand() * 4) | 0);
        for (let i = 0; i < n; i++) {
          this.bell(midi(scale[idx]), 0.03 + rand() * 0.012, (rand() - 0.5) * 0.4, t, this.ch.music);
          idx = U.clamp(idx + ((rand() * 3) | 0) - 1, 0, scale.length - 1);
          t += [0.6, 0.9, 1.2][(rand() * 3) | 0];
        }
        this.nextPhrase = t + 12 + rand() * 14;
      }
      if (now > this.nextChime) {
        this.chime(rand() * 1.4 - 0.7);
        this.nextChime = now + 9 + rand() * 14;
      }
      if (e.chimes > 0 && now > this.nextWindChime) {
        for (let i = 0; i < 1 + ((rand() * 3) | 0); i++) this.chime(rand() * 1.2 - 0.6);
        this.nextWindChime = now + (2 + rand() * 5) / (0.4 + wx.wind) / Math.min(3, e.chimes);
      }
      if (S.dayness > 0.6 && wx.rain < 0.4 && e.trees > 0 && now > this.nextBirdAmbient) {
        this.bird(rand() * 1.6 - 0.8);
        this.nextBirdAmbient = now + 5 + rand() * 12;
      }
      const si = U.seasonIndex(S.season);
      if (S.night > 0.55 && (si === 1 || si === 2) && wx.rain < 0.5 && now > this.nextCricket) {
        const out = this.pan(rand() * 1.4 - 0.7, this.ch.insects), f = 4200 + rand() * 500;
        let t = now + 0.02;
        for (let i = 0; i < 3; i++) { this.tone(f, t, 0.025, 0.008, out, 'sine', 0.006); t += 0.05; }
        this.nextCricket = now + 0.7 + rand() * 1.2;
      }
    },
  };
  document.addEventListener('visibilitychange', () => {
    if (!A.ctx) return;
    if (document.hidden) A.ctx.suspend(); else if (A.on) A.ctx.resume();
  });
})(window.SW);
