// Creatures that came through the rifts. They join the roster in data/enemies.js and fill the later chambers of Tidal Rifts.
import { Ramp } from '../gfx/painter.js';
import '../gfx/sprites_rift_foes.js';

const glass = new Ramp(['#0a0618', '#241048', '#4a2a90', '#8a60d8', '#e0ccff']);

export const RIFT_FOES = {
  shardling: {
    name: 'Shardling', hp: 18, dmg: 9, w: 12, h: 18, xp: 14, coins: [2, 5], poise: 6, ai: 'blinker', anchor: 'center', fps: 8, flying: true, mass: 0.7,
    shoot: { kind: 'shard', speed: 110, count: 1, aim: 'player', life: 2.2, sfx: 'spore' },
    sprite: { plan: 'shardling', w: 40, h: 36, ax: 20, ay: 18, frames: 4, o: { ramp: glass } },
    p: { speed: 40, aggro: 230, keep: 110, fade: 0.5, blinkMin: 70, blinkMax: 130, wind: 0.45, burst: 3, cd: 2.4 },
  },
  latchleech: {
    name: 'Latchleech', hp: 14, dmg: 6, w: 22, h: 9, xp: 12, coins: [1, 4], poise: 4, ai: 'latcher', anchor: 'center', fps: 9, flying: true, mass: 0.6,
    sprite: { plan: 'latchleech', w: 44, h: 22, ax: 22, ay: 11, frames: 4, o: {} },
    p: { speed: 55, aggro: 210, leapR: 90, wind: 0.4, leap: 200, leapTime: 0.5, tick: 0.7, hold: 6, cd: 2.2 },
  },
  tidecaller: {
    name: 'Tidecaller', hp: 30, dmg: 8, w: 18, h: 30, xp: 22, coins: [4, 9], poise: 12, ai: 'caller', anchor: 'center', fps: 6, flying: true, mass: 1.2,
    sprite: { plan: 'tidecaller', w: 44, h: 52, ax: 22, ay: 28, frames: 4, o: {} },
    p: { speed: 28, aggro: 270, wind: 0.9, gustTime: 1.9, force: 160, cd: 4.5 },
  },
  glassgolem: {
    name: 'Glass Golem', hp: 74, dmg: 16, w: 26, h: 38, xp: 34, coins: [6, 12], poise: 40, ai: 'bulwark', anchor: 'feet', fps: 5, mass: 3, splits: { type: 'shardling', n: 2 },
    sprite: { plan: 'glassgolem', w: 56, h: 56, ax: 28, ay: 54, frames: 4, o: {} },
    p: { speed: 16, aggro: 160, strike: 30, wind: 0.8, recover: 0.9, cd: 2.2 },
  },
};
