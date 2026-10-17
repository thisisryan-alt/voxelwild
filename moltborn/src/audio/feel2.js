// Sounds for the newer activities: fishing (cast, bite, the reel's tension tick, the catch), selling, bounties, the tide
// clock changing hour and tidal surges. Recipes join the main sound library; Audio2 connects them to game events.
import { addRecipe } from './audio.js';

const jitter = (v, k = 0.12) => v * (1 + (Math.random() - 0.5) * 2 * k);

// ---- fishing ---------------------------------------------------------------------------------------------------------------------------------
// the cast: a whip of line and a small splash
addRecipe('cast', (a, o) => {
  a.noise({ dur: 0.18, f1: 1400, f2: 5200, q: 1.2, v: 0.18, attack: 0.02, ...o });
  a.noise({ dur: 0.22, f1: 900, f2: 200, q: 0.7, v: 0.2, delay: 0.16, ...o });
  a.tone({ f: 520, f2: 180, dur: 0.14, v: 0.12, type: 'sine', delay: 0.17, ...o });
});
// a nibble and then a real bite
addRecipe('nibble', (a, o) => { a.tone({ f: jitter(880), f2: 700, dur: 0.05, v: 0.1, type: 'triangle', ...o }); });
addRecipe('bite', (a, o) => {
  a.tone({ f: 660, dur: 0.08, v: 0.22, type: 'square', filter: 'lowpass', ff: 1800, ...o });
  a.tone({ f: 990, dur: 0.12, v: 0.22, type: 'square', filter: 'lowpass', ff: 2200, delay: 0.09, ...o });
});
// the reel: a click for the ratchet, pitched by how close the catch is
addRecipe('reel_tick', (a, o) => { const k = o.k ?? 0.5; a.tone({ f: 600 + k * 700, dur: 0.025, v: 0.07, type: 'square', filter: 'bandpass', ff: 2400, q: 3 }); });
addRecipe('line_snap', (a, o) => { a.noise({ dur: 0.07, f1: 6000, v: 0.3, ...o }); a.tone({ f: 1400, f2: 300, dur: 0.18, v: 0.16, type: 'sawtooth', delay: 0.03, ...o }); });
// a catch: bright, rising, with a splash underneath; legendary ones ring longer
addRecipe('catch', (a, o) => {
  a.noise({ dur: 0.25, f1: 700, f2: 3200, q: 0.9, v: 0.2, ...o });
  a.arp(o.big ? [523, 659, 784, 1047, 1319] : [523, 659, 784], { step: 0.08, dur: o.big ? 0.8 : 0.45, v: 0.2, rev: 0.6, delay: 0.1 });
});

// ---- trade -----------------------------------------------------------------------------------------------------------------------------------------
// coins counted out onto a counter
addRecipe('sell', (a, o) => {
  for (let i = 0; i < 4; i++) a.tone({ f: jitter(2100, 0.08) + i * 90, dur: 0.05, v: 0.12, type: 'triangle', delay: i * 0.055, ...o });
  a.noise({ dur: 0.05, f1: 5200, v: 0.08, delay: 0.02, ...o });
});
addRecipe('bounty', (a, o) => a.arp([392, 494, 587, 784], { step: 0.07, dur: 0.5, v: 0.2, rev: 0.6, type: 'triangle' }));
addRecipe('streak', (a, o) => a.arp([523, 659, 784, 1047, 1319, 1568], { step: 0.07, dur: 0.9, v: 0.22, rev: 0.8, type: 'sine' }));

// ---- the sea ---------------------------------------------------------------------------------------------------------------------------------------
// hour changes: a bell for dawn, soft bells for dusk, a low tone for night
addRecipe('hour_dawn', (a) => a.arp([784, 988, 1175], { step: 0.18, dur: 1.2, v: 0.12, rev: 0.9, type: 'sine' }));
addRecipe('hour_dusk', (a) => a.arp([659, 523, 440], { step: 0.2, dur: 1.2, v: 0.12, rev: 0.9, type: 'sine' }));
addRecipe('hour_night', (a) => { a.tone({ f: 110, f2: 82, dur: 2.6, v: 0.14, type: 'sine', attack: 0.7, rev: 0.9 }); a.arp([440, 330], { step: 0.4, dur: 1.6, v: 0.08, rev: 1, type: 'triangle', delay: 0.5 }); });
// the surge: the water pulling back, then the roar of it coming in
addRecipe('surge_warn', (a) => { a.noise({ dur: 2.6, f1: 1800, f2: 120, q: 0.6, v: 0.3, attack: 0.5, rev: 0.7 }); a.tone({ f: 70, f2: 44, dur: 2.4, v: 0.28, type: 'sine', attack: 0.6 }); });
addRecipe('surge_rush', (a) => { a.noise({ dur: 3.2, f1: 300, f2: 2600, q: 0.8, v: 0.4, attack: 0.9, rev: 0.6 }); a.tone({ f: 55, f2: 90, dur: 3.0, v: 0.3, type: 'sawtooth', filter: 'lowpass', ff: 300, attack: 0.8 }); });
addRecipe('flotsam', (a) => { for (let i = 0; i < 3; i++) a.tone({ f: jitter(1500, 0.2), dur: 0.05, v: 0.1, type: 'triangle', delay: 0.08 * i }); });

export class Audio2 {
  constructor(game) {
    this.g = game; game.systems.audio2 = this; this.tickT = 0;
    const ev = game.events, sfx = (n, o) => game.audio.sfx(n, o);
    ev.on('fish', (id, len, o) => sfx('catch', { big: !!(o && (o.big || o.fresh)) }));
    ev.on('sold', () => sfx('sell'));
    ev.on('bounty', () => sfx('bounty'));
    ev.on('bountyboard', () => sfx('streak'));
    ev.on('phase', (id) => { sfx(id === 'night' ? 'hour_night' : id === 'dusk' ? 'hour_dusk' : 'hour_dawn'); });
    ev.on('surge', (what) => { if (what === 'warn') sfx('surge_warn'); else if (what === 'rush') sfx('surge_rush'); else if (what === 'calm') sfx('flotsam'); });
  }
}
