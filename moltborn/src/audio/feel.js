// The small sounds that make movement and combat feel physical: footsteps that change with the floor, landings,
// a rising chime on long combos, a heartbeat when health is low, the whale song, the rumble of a tremor, kitchen and
// camera sounds, and depth muffling that dulls everything as the swimmer descends. Recipes are registered into the
// main sound library; AudioFeel connects them to game events.
import { addRecipe } from './audio.js';
import { setting } from '../systems/settings.js';
import { clamp } from '../core/util.js';

const jitter = (v, k = 0.12) => v * (1 + (Math.random() - 0.5) * 2 * k);

// ---- recipes -----------------------------------------------------------------------------------------------------------------
addRecipe('step_sand', (a, o) => a.noise({ dur: 0.09, f1: jitter(1800), f2: 700, q: 0.4, v: 0.1, attack: 0.01, ...o }));
addRecipe('step_stone', (a, o) => { a.tone({ f: jitter(260), f2: 120, dur: 0.07, v: 0.12, type: 'triangle', ...o }); a.noise({ dur: 0.04, f1: 3000, v: 0.08, ...o }); });
addRecipe('step_wood', (a, o) => { a.tone({ f: jitter(190), f2: 110, dur: 0.09, v: 0.16, type: 'square', filter: 'lowpass', ff: 700, ...o }); a.noise({ dur: 0.05, f1: 1200, v: 0.06, ...o }); });
addRecipe('step_bone', (a, o) => { a.tone({ f: jitter(520), f2: 300, dur: 0.05, v: 0.1, type: 'square', filter: 'bandpass', ff: 900, q: 3, ...o }); });
addRecipe('step_coral', (a, o) => { a.noise({ dur: 0.07, f1: jitter(2600), f2: 1200, q: 1.5, v: 0.09, ...o }); a.tone({ f: jitter(420), f2: 260, dur: 0.05, v: 0.06, ...o }); });
addRecipe('step_rock', (a, o) => { a.tone({ f: jitter(150), f2: 70, dur: 0.08, v: 0.14, type: 'triangle', ...o }); a.noise({ dur: 0.06, f1: 1400, f2: 500, v: 0.07, ...o }); });
addRecipe('land', (a, o) => { const k = o.hard ?? 0.5; a.tone({ f: 120 - k * 40, f2: 45, dur: 0.12 + k * 0.1, v: 0.2 + k * 0.3, type: 'sine', ...o }); a.noise({ dur: 0.08 + k * 0.08, f1: 1600, f2: 300, v: 0.12 + k * 0.2, ...o }); });
addRecipe('heartbeat', (a, o) => { const v = 0.25 + (o.k ?? 0.5) * 0.3; a.tone({ f: 62, f2: 40, dur: 0.16, v, type: 'sine' }); a.tone({ f: 56, f2: 38, dur: 0.18, v: v * 0.8, type: 'sine', delay: 0.2 }); });
addRecipe('whale', (a) => {
  // a long falling call with a slow second voice beneath it
  a.tone({ f: 190, f2: 120, dur: 3.2, v: 0.14, type: 'sine', attack: 0.8, rev: 0.9 }); a.tone({ f: 260, f2: 150, dur: 2.8, v: 0.08, type: 'sine', attack: 1, delay: 0.4, rev: 0.9 });
  a.tone({ f: 95, f2: 70, dur: 3.6, v: 0.1, type: 'triangle', attack: 1.2, rev: 0.8, filter: 'lowpass', ff: 400 });
});
addRecipe('rumble', (a, o) => { a.noise({ dur: 3.4, f1: 120, f2: 60, q: 0.6, v: 0.5, attack: 0.6, rev: 0.6, ...o }); a.tone({ f: 48, f2: 34, dur: 3.2, v: 0.4, type: 'sine', attack: 0.5 }); });
addRecipe('craft', (a, o) => { a.tone({ f: 1760, dur: 0.07, v: 0.16, type: 'triangle' }); a.tone({ f: 1320, dur: 0.1, v: 0.16, type: 'triangle', delay: 0.07 }); a.noise({ dur: 0.1, f1: 4500, v: 0.08, delay: 0.02 }); });
addRecipe('eat', (a, o) => { a.tone({ f: 180, f2: 110, dur: 0.1, v: 0.25, type: 'sine' }); a.tone({ f: 150, f2: 90, dur: 0.12, v: 0.2, type: 'sine', delay: 0.14 }); a.arp([523, 659, 784], { step: 0.06, dur: 0.2, v: 0.12, rev: 0.4, vol: 1 }); });
addRecipe('recipe', (a, o) => a.arp([659, 784, 988, 1318], { step: 0.07, dur: 0.4, v: 0.16, rev: 0.5 }));
addRecipe('shutter', (a, o) => { a.noise({ dur: 0.03, f1: 5000, v: 0.4 }); a.tone({ f: 1200, f2: 400, dur: 0.05, v: 0.25, type: 'square', delay: 0.04 }); a.noise({ dur: 0.04, f1: 3500, v: 0.3, delay: 0.09 }); });
addRecipe('travel', (a, o) => { a.noise({ dur: 0.9, f1: 300, f2: 3200, q: 1, v: 0.35, attack: 0.3 }); a.arp([330, 440, 554, 740], { step: 0.1, dur: 0.6, v: 0.18, rev: 0.7 }); });
addRecipe('rift', (a, o) => { a.tone({ f: 70, f2: 220, dur: 1.2, v: 0.3, type: 'sawtooth', filter: 'lowpass', ff: 900, attack: 0.5, rev: 0.7 }); a.noise({ dur: 1.0, f1: 200, f2: 2000, q: 1.5, v: 0.3, attack: 0.4 }); });
addRecipe('relic', (a, o) => a.arp([392, 523, 659, 784, 1047, 1319], { step: 0.08, dur: 0.7, v: 0.2, rev: 0.8, type: 'sine' }));
addRecipe('wave_clear', (a, o) => { a.arp([523, 659, 784], { step: 0.09, dur: 0.4, v: 0.2, rev: 0.5 }); });
addRecipe('wave_start', (a, o) => { a.tone({ f: 220, f2: 330, dur: 0.3, v: 0.3, type: 'square', filter: 'lowpass', ff: 1200 }); a.tone({ f: 330, f2: 440, dur: 0.3, v: 0.3, type: 'square', filter: 'lowpass', ff: 1200, delay: 0.2 }); });
addRecipe('bark', (a, o) => { a.tone({ f: jitter(880, 0.3), f2: jitter(660, 0.3), dur: 0.05, v: 0.05, type: 'triangle' }); });

const PENTA = [0, 2, 4, 7, 9];

export class AudioFeel {
  constructor(game) {
    this.g = game; game.systems.audiofeel = this; this.lastCombo = 0; this.muffle = 0; this.stepSide = 0;
    const ev = game.events, sfx = (n, o) => game.audio.sfx(n, o);
    ev.on('footstep', (mat, speed) => { const p = game.world?.player; sfx('step_' + (mat || 'rock'), { x: p?.x, y: p?.y, vol: clamp(speed / 160, 0.5, 1) * (this.stepSide++ % 2 ? 0.9 : 1) }); });
    ev.on('land', (hard) => { const p = game.world?.player; sfx('land', { x: p?.x, y: p?.y, hard }); });
    ev.on('heartbeat', (k) => sfx('heartbeat', { k }));
    ev.on('ambevent', (kind) => { if (kind === 'whale') sfx('whale'); });
    ev.on('crafted', () => sfx('craft'));
    ev.on('ate', () => sfx('eat'));
    ev.on('recipe', () => sfx('recipe'));
    ev.on('hitdealt', () => this.comboChime());
    ev.on('rift', (what) => { if (what === 'enter') sfx('rift'); });
    ev.on('photo', () => sfx('shutter'));
    ev.on('travel', () => sfx('travel'));
  }

  // a quiet pentatonic note that climbs with the combo, so a long chain sounds like it is building to something
  comboChime() {
    const p = this.g.world?.player; if (!p || (p.combo || 0) < 4) return;
    const n = p.combo - 4, f = 523 * Math.pow(2, (PENTA[n % 5] + 12 * Math.floor(n / 5) % 24) / 12);
    const a = this.g.audio; if (!a.ready || a.muted) return;
    a.tone({ f: Math.min(f, 2600), dur: 0.14, v: 0.07, type: 'triangle', rev: 0.4, bus: a.sfxBus });
  }

  // called every play frame: the deeper (and the more hurt) the swimmer, the duller the world sounds
  update(dt) {
    const g = this.g, w = g.world, a = g.audio; if (!w || !a.ready) return;
    const p = w.player, depth = clamp(p.y / Math.max(1, w.zone.h * 16), 0, 1);
    let target = setting(g, 'deepMuffle') ? depth * 0.4 : 0;
    const post = g.systems.post; if (post) target += post.lowHp * 0.25;
    this.muffle += (target - this.muffle) * Math.min(1, dt * 2);
    a.setMuffle(this.muffle);
  }
}
