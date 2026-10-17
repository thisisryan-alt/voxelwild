// Enemy roster. ai names refer to entities/ai.js; sprite.plan to gfx/sprites_enemies.js.
import { Ramp } from '../gfx/painter.js';
import { R } from '../gfx/palette.js';

const rockcrab = new Ramp(['#241e14', '#463c26', '#6e6234', '#9a8a4a', '#d0c078']);
const bonecrab = R.bone.tint(0, 0.7, 0.9);
const crab = (ramp, o = {}) => ({ plan: 'crab', w: 58, h: 34, ax: 24, ay: 31, frames: 6, o: { ramp, ...o } });
const fish = (len, hgt, ramp, o = {}) => ({ plan: 'fish', w: len + 22, h: hgt + 16, ax: (len + 22) / 2, ay: (hgt + 16) / 2, frames: 4, o: { len, hgt, ramp, ...o } });

export const ENEMIES = {
  // ---- Starting Reef -----------------------------------------------------------------
  pinchling: { name: 'Pinchling', hp: 12, dmg: 6, w: 16, h: 11, xp: 8, coins: [1, 3], poise: 6, ai: 'patrolCharge', anchor: 'feet', fps: 10, mass: 1, sprite: crab(rockcrab),
    p: { speed: 24, range: 56, aggro: 96, wind: 0.5, charge: 130, chargeTime: 0.45, cd: 1.8 } },
  minnow: { name: 'Reef Minnow', hp: 4, dmg: 3, w: 10, h: 7, xp: 2, coins: [0, 1], poise: 2, ai: 'swarm', fps: 10, flying: true, mass: 0.6, sprite: fish(12, 6, R.fishYellow, { fin: R.fishYellow.tint(0, 1, 0.8), tail: 2, angry: false, belly: R.belly }),
    p: { speed: 60, aggro: 120, wind: 0.35, dash: 150, cd: 1.6 } },
  urchin: { name: 'Spine Urchin', hp: 10, dmg: 6, w: 13, h: 13, xp: 4, coins: [1, 2], poise: 99, noStagger: true, ai: 'spiky', anchor: 'center', fps: 2, spiky: true, sprite: { plan: 'urchin', w: 32, h: 32, ax: 16, ay: 16, frames: 2, o: { ramp: R.abyssal.tint(0.08, 1.2, 1.1), r: 6 } }, p: {} },
  hermit: { name: 'Hermit Bruiser', hp: 36, dmg: 9, w: 20, h: 16, xp: 12, coins: [3, 6], poise: 24, ai: 'guard', anchor: 'feet', fps: 8, mass: 1.6, sprite: crab(R.coralPink.tint(0.04, 0.8, 1), { helm: false, shield: true }),
    p: { speed: 20, aggro: 110, strike: 22, wind: 0.5, recover: 0.7, cd: 1.6 } },
  hatchling: { name: 'Hatchling', hp: 99, dmg: 0, w: 10, h: 8, xp: 0, coins: null, poise: 99, ai: 'patrolCharge', anchor: 'feet', fps: 10, friendly: true, contact: false, sprite: { plan: 'crab', w: 58, h: 34, ax: 24, ay: 31, frames: 6, o: { ramp: new Ramp(['#5c2a3a', '#a8506a', '#e88a9a', '#ffc0c8', '#fff0f0']) } }, p: { speed: 14, range: 40, aggro: 0, wind: 9, charge: 0, chargeTime: 0, cd: 99 } },
  // ---- Sunken Forest -----------------------------------------------------------------
  moray: { name: 'Thornback Moray', hp: 24, dmg: 10, w: 24, h: 12, xp: 14, coins: [3, 6], poise: 14, ai: 'ambush', anchor: 'center', fps: 8, ghost: true, flying: true, sprite: { plan: 'eel', w: 64, h: 28, ax: 54, ay: 14, frames: 6, o: { ramp: R.venom, segs: 9, seg: 5, r: 4.5, amp: 3, teeth: true, fin: R.venom.tint(0.1, 1, 1.1) } },
    p: { trigger: 80, wind: 0.5, lunge: 200, reach: 64, cd: 2.4 } },
  venomjelly: { name: 'Venom Jelly', hp: 11, dmg: 5, w: 16, h: 14, xp: 6, coins: [1, 3], poise: 5, ai: 'drifter', anchor: 'center', fps: 6, flying: true, status: { poison: 2 }, sprite: { plan: 'jelly', w: 28, h: 34, ax: 14, ay: 11, frames: 6, o: { ramp: R.jelly, bell: 8, len: 16, tent: 5, eyes: true } },
    p: { speed: 15, aggro: 130 } },
  sporepod: { name: 'Spore Pod', hp: 16, dmg: 6, w: 14, h: 24, xp: 8, coins: [2, 4], poise: 99, noStagger: true, ai: 'turret', anchor: 'feet', fps: 5, contact: false,
    shoot: { kind: 'spore', speed: 70, count: 3, spread: 0.35, arc: 34, grav: 70, life: 2.6, aim: 'player', status: { poison: 1 }, sfx: 'spore' },
    sprite: { plan: 'plant', w: 30, h: 34, ax: 15, ay: 32, frames: 4, o: { ramp: R.fishYellow, glow: '#d8ff70' } }, p: { range: 150, wind: 0.7, cd: 2.4 } },
  piranha: { name: 'Snapjaw', hp: 7, dmg: 5, w: 12, h: 8, xp: 3, coins: [1, 2], poise: 3, ai: 'swarm', fps: 12, flying: true, mass: 0.7, sprite: fish(14, 8, R.fishRed, { teeth: true, belly: R.belly, tail: 2.5 }),
    p: { speed: 74, aggro: 130, wind: 0.28, dash: 190, cd: 1.1 } },
  mossback: { name: 'Mossback Turtle', hp: 32, dmg: 11, w: 24, h: 16, xp: 14, coins: [3, 6], poise: 30, ai: 'shellback', anchor: 'feet', fps: 5, mass: 2, sprite: { plan: 'turtle', w: 44, h: 30, ax: 22, ay: 26, frames: 4, o: { shell: R.seaweed.tint(0, 0.8, 0.75), skin: R.fishGreen } }, p: { speed: 18, aggro: 100, strike: 22, wind: 0.55, cd: 2 } },
  // ---- Coral Kingdom -----------------------------------------------------------------
  brineguard: { name: 'Brineguard Soldier', hp: 40, dmg: 11, w: 20, h: 16, xp: 18, coins: [4, 8], poise: 26, ai: 'guard', anchor: 'feet', fps: 8, mass: 1.5, sprite: crab(R.crimson, { helm: true, shield: true }),
    p: { speed: 28, aggro: 130, strike: 26, wind: 0.45, recover: 0.6, cd: 1.3 } },
  archerfish: { name: 'Spitting Archer', hp: 15, dmg: 7, w: 14, h: 9, xp: 9, coins: [2, 5], poise: 5, ai: 'kiter', fps: 10, flying: true, mass: 0.8, shoot: { kind: 'water', speed: 120, aim: 'player', lead: true, sfx: 'spit' },
    sprite: fish(16, 9, R.fishBlue, { belly: R.pearl, tail: 2.5 }), p: { speed: 55, aggro: 180, hover: 90, wind: 0.5, cd: 2.0, shoots: true } },
  puffer: { name: 'Blowfish', hp: 13, dmg: 9, w: 16, h: 14, xp: 8, coins: [2, 4], poise: 99, noStagger: true, ai: 'puffer', fps: 6, flying: true, dropOnBurst: false, sprite: fish(16, 14, R.fishGreen.tint(0.12, 1, 1.1), { spines: true, belly: R.sand, tail: 1.5, angry: true }), p: { speed: 28, aggro: 130, wind: 0.8, burstR: 34 } },
  anemone_c: { name: 'Corrupted Anemone', hp: 22, dmg: 9, w: 16, h: 18, xp: 11, coins: [3, 5], poise: 99, noStagger: true, ai: 'turret', anchor: 'feet', fps: 5, contact: false, status: { poison: 2 },
    shoot: { kind: 'orb', speed: 60, count: 5, spread: 0.9, aim: 'player', life: 2.6, sfx: 'spore' }, sprite: { plan: 'plant', w: 30, h: 34, ax: 15, ay: 32, frames: 4, o: { ramp: R.coralPink.tint(0.1), glow: '#ff90ff', stalk: R.coralPink } }, p: { range: 160, wind: 0.8, cd: 2.8 } },
  // ---- Ship Graveyard ----------------------------------------------------------------
  ghostsailor: { name: 'Drowned Sailor', hp: 20, dmg: 9, w: 14, h: 18, xp: 14, coins: [3, 7], poise: 10, ai: 'phase', anchor: 'center', fps: 5, ghost: true, flying: true,
    shoot: { kind: 'fire', speed: 70, count: 3, spread: 0.5, aim: 'player', life: 2.4, ghost: true, sfx: 'spore' }, sprite: { plan: 'ghost', w: 34, h: 36, ax: 15, ay: 18, frames: 6, o: {} }, p: { speed: 24, aggro: 170, wind: 0.6, cd: 3 } },
  cannon: { name: 'Rust Cannon', hp: 34, dmg: 14, w: 26, h: 16, xp: 15, coins: [4, 8], poise: 99, noStagger: true, ai: 'turret', anchor: 'feet', fps: 2, contact: false, noBlink: true, mass: 99,
    shoot: { kind: 'cannonball', speed: 150, count: 1, aim: 'player', lead: true, life: 3, sfx: 'cannon' }, sprite: { plan: 'cannon', w: 40, h: 26, ax: 20, ay: 24, frames: 2, o: {} }, p: { range: 220, wind: 0.8, cd: 3.2 } },
  ironturtle: { name: 'Ironhide Turtle', hp: 60, dmg: 13, w: 26, h: 18, xp: 22, coins: [5, 10], poise: 40, ai: 'shellback', anchor: 'feet', fps: 5, mass: 3, sprite: { plan: 'turtle', w: 44, h: 30, ax: 22, ay: 26, frames: 4, o: { shell: R.rust, skin: R.fishGrey, spikes: true } }, p: { speed: 16, aggro: 110, strike: 24, wind: 0.6, cd: 2.2 } },
  barracuda: { name: 'Barracuda', hp: 24, dmg: 12, w: 26, h: 9, xp: 14, coins: [3, 6], poise: 10, ai: 'kiter', fps: 12, flying: true, sprite: fish(30, 9, R.fishGrey, { teeth: true, belly: R.pearl, tail: 3, dorsalH: 1 }), p: { speed: 70, aggro: 200, hover: 90, wind: 0.5, dash: 250, cd: 1.6 } },
  mimic: { name: 'Mimic Chest', hp: 44, dmg: 15, w: 20, h: 16, xp: 30, coins: [15, 30], poise: 30, ai: 'mimic', anchor: 'feet', fps: 6, mass: 2, elite: true, ep: 1, sprite: { plan: 'crab', w: 58, h: 34, ax: 24, ay: 31, frames: 6, o: { ramp: R.wood } }, p: { reveal: 40, speed: 40 } },
  // ---- The Abyss ---------------------------------------------------------------------
  lanternfish: { name: 'Lantern Lurker', hp: 28, dmg: 13, w: 18, h: 12, xp: 20, coins: [4, 9], poise: 12, ai: 'kiter', fps: 8, flying: true, sprite: fish(20, 12, R.abyssal, { lure: true, teeth: true, belly: R.lumen.tint(0, 1, 0.7), tail: 2.5 }), p: { speed: 55, aggro: 150, hover: 70, wind: 0.6, dash: 230, cd: 2 } },
  gulper: { name: 'Gulper Eel', hp: 46, dmg: 17, w: 30, h: 16, xp: 28, coins: [5, 11], poise: 22, ai: 'ambush', anchor: 'center', fps: 7, ghost: true, flying: true, sprite: { plan: 'eel', w: 80, h: 36, ax: 66, ay: 18, frames: 6, o: { ramp: R.void.tint(0.02, 1.3, 1.6), segs: 10, seg: 6, r: 6.5, amp: 3, teeth: true, fin: R.abyssal } }, p: { trigger: 90, wind: 0.6, lunge: 210, reach: 80, cd: 2.6 } },
  inksquid: { name: 'Gloom Squid', hp: 20, dmg: 11, w: 20, h: 12, xp: 17, coins: [3, 7], poise: 8, ai: 'kiter', fps: 8, flying: true, shoot: { kind: 'ink', speed: 105, count: 3, spread: 0.3, aim: 'player', sfx: 'spit' }, sprite: { plan: 'squid', w: 44, h: 28, ax: 26, ay: 14, frames: 6, o: { ramp: R.abyssal.tint(0.1, 1, 1.1), glow: '#ff90ff' } }, p: { speed: 50, aggro: 190, hover: 100, wind: 0.6, cd: 2.2, shoots: true } },
  voidwisp: { name: 'Void Wisp', hp: 16, dmg: 12, w: 14, h: 14, xp: 15, coins: [3, 6], poise: 6, ai: 'phase', anchor: 'center', fps: 8, ghost: true, flying: true, shoot: { kind: 'orb', speed: 80, count: 1, aim: 'player', homing: 0, life: 2.4, ghost: true, sfx: 'spore' }, sprite: { plan: 'wisp', w: 36, h: 24, ax: 24, ay: 12, frames: 4, o: { ramp: R.abyssal, glow: '#c8a0ff', r: 5 } }, p: { speed: 30, aggro: 160, wind: 0.5, cd: 2.4 } },
  deepjelly: { name: 'Abyssal Jelly', hp: 24, dmg: 12, w: 22, h: 18, xp: 16, coins: [3, 7], poise: 8, ai: 'drifter', anchor: 'center', fps: 5, flying: true, status: { poison: 3 }, sprite: { plan: 'jelly', w: 36, h: 44, ax: 18, ay: 14, frames: 6, o: { ramp: R.lumen, bell: 11, len: 20, tent: 6, glow: '#58d0e8', eyes: true } }, p: { speed: 14, aggro: 140 } },
  // ---- Trench of the Forgotten ---------------------------------------------------------
  bonecrawler: { name: 'Bone Crawler', hp: 56, dmg: 17, w: 20, h: 14, xp: 30, coins: [6, 12], poise: 24, ai: 'patrolCharge', anchor: 'feet', fps: 10, mass: 1.5, sprite: crab(bonecrab), p: { speed: 30, range: 70, aggro: 120, wind: 0.45, charge: 150, chargeTime: 0.5, cd: 1.5 } },
  hollowshade: { name: 'Hollow Shade', hp: 34, dmg: 18, w: 16, h: 16, xp: 28, coins: [5, 10], poise: 10, ai: 'phase', anchor: 'center', fps: 8, ghost: true, flying: true, shoot: { kind: 'orb', speed: 90, count: 3, spread: 0.4, aim: 'player', life: 2.4, ghost: true, sfx: 'spore' }, sprite: { plan: 'wisp', w: 36, h: 24, ax: 24, ay: 12, frames: 4, o: { ramp: R.void.tint(0, 1.5, 2), glow: '#a040c0', r: 6 } }, p: { speed: 34, aggro: 180, wind: 0.5, cd: 2.2 } },
  wardenbone: { name: 'Chained Warden', hp: 80, dmg: 20, w: 22, h: 36, xp: 40, coins: [8, 16], poise: 50, ai: 'guard', anchor: 'feet', fps: 6, mass: 2.4, elite: true, ep: 1, sprite: { plan: 'knight', w: 52, h: 48, ax: 20, ay: 46, frames: 4, o: { ramp: R.bone.tint(0, 0.6, 0.85) } }, p: { speed: 26, aggro: 150, strike: 34, wind: 0.55, recover: 0.7, cd: 1.5 } },
  // ---- Poseidon's Domain ------------------------------------------------------------------
  guardian: { name: 'Corrupted Guardian', hp: 95, dmg: 22, w: 22, h: 36, xp: 50, coins: [10, 20], poise: 60, ai: 'guard', anchor: 'feet', fps: 6, mass: 3, elite: true, ep: 1, sprite: { plan: 'knight', w: 52, h: 48, ax: 20, ay: 46, frames: 4, o: { ramp: R.divine } }, p: { speed: 28, aggro: 170, strike: 38, wind: 0.5, recover: 0.6, cd: 1.2 } },
  stormhorse: { name: 'Storm Seahorse', hp: 44, dmg: 17, w: 16, h: 22, xp: 34, coins: [6, 12], poise: 12, ai: 'kiter', fps: 8, flying: true, shoot: { kind: 'shard', speed: 130, count: 3, spread: 0.3, aim: 'player', lead: true, sfx: 'zap' }, sprite: fish(18, 14, R.divine, { tail: 2, fin: R.glass, belly: R.marble }), p: { speed: 60, aggro: 210, hover: 110, wind: 0.5, cd: 1.8, shoots: true } },
  tidewisp: { name: 'Tidal Elemental', hp: 62, dmg: 19, w: 20, h: 20, xp: 38, coins: [7, 14], poise: 20, ai: 'drifter', anchor: 'center', fps: 8, flying: true, sprite: { plan: 'wisp', w: 36, h: 24, ax: 24, ay: 12, frames: 4, o: { ramp: R.divine, glow: '#40e0d0', r: 7 } }, p: { speed: 22, aggro: 170 } },
  tridentstatue: { name: 'Trident Sentinel', hp: 80, dmg: 24, w: 22, h: 40, xp: 42, coins: [8, 16], poise: 99, noStagger: true, ai: 'turret', anchor: 'feet', fps: 2, contact: false, mass: 99,
    shoot: { kind: 'trident', speed: 160, count: 1, aim: 'player', lead: true, life: 3, sfx: 'zap' }, sprite: { plan: 'knight', w: 52, h: 48, ax: 20, ay: 46, frames: 4, o: { ramp: R.marble } }, p: { range: 240, wind: 0.7, cd: 2.4 } },
  // ---- Expansion roster: new behaviours (see entities/ai.js) --------------------------------------------------------------
  mantis: { name: 'Mantis Shrimp', hp: 38, dmg: 11, w: 22, h: 14, xp: 26, coins: [4, 9], poise: 20, ai: 'flurry', anchor: 'feet', fps: 8, mass: 1.3,
    sprite: { plan: 'shrimp', w: 72, h: 34, ax: 38, ay: 31, frames: 4, o: { cx: 38, ramp: R.fishGreen, accent: R.coralRed } }, p: { speed: 34, aggro: 150, strike: 26, wind: 0.42, cd: 1.4, recover: 0.95 } },
  mender: { name: 'Tidepool Mender', hp: 16, dmg: 0, w: 14, h: 11, xp: 14, coins: [3, 6], poise: 4, ai: 'healer', anchor: 'feet', fps: 8, mass: 0.6, contact: false,
    sprite: { plan: 'shrimp', w: 50, h: 26, ax: 26, ay: 23, frames: 4, o: { cx: 26, s: 0.7, ramp: R.belly, accent: R.seaweed, glow: '#9affc0', heal: true } }, p: { speed: 36, flee: 66, range: 160, wind: 0.8, cd: 3.2, heal: 0.3 } },
  spawncoral: { name: 'Brood Coral', hp: 44, dmg: 8, w: 28, h: 22, xp: 24, coins: [4, 9], poise: 99, noStagger: true, ai: 'summoner', anchor: 'feet', fps: 4, mass: 99, contact: false,
    sprite: { plan: 'brood', w: 44, h: 38, ax: 22, ay: 36, frames: 4, o: { ramp: R.coralPink, glow: '#ffb0d8' } }, p: { range: 180, wind: 0.8, cd: 4.5, max: 3, batch: 2, kid: 'spawnling' } },
  spawnling: { name: 'Brood Spawnling', hp: 5, dmg: 4, w: 10, h: 6, xp: 1, coins: null, poise: 2, ai: 'swarm', fps: 12, flying: true, mass: 0.5,
    sprite: fish(10, 5, R.coralPink, { teeth: true, belly: R.belly, tail: 2 }), p: { speed: 66, aggro: 220, wind: 0.35, dash: 160, cd: 1.3 } },
  splitjelly: { name: 'Mother Jelly', hp: 30, dmg: 8, w: 22, h: 20, xp: 18, coins: [3, 6], poise: 8, ai: 'drifter', anchor: 'center', fps: 5, flying: true, status: { poison: 2 }, splits: { type: 'jellet', n: 3 },
    sprite: { plan: 'jelly', w: 44, h: 52, ax: 22, ay: 16, frames: 6, o: { ramp: R.fishYellow, bell: 12, len: 18, tent: 6, glow: '#ffe080', eyes: true } }, p: { speed: 12, aggro: 130 } },
  jellet: { name: 'Jellet', hp: 6, dmg: 4, w: 9, h: 9, xp: 3, coins: [0, 1], poise: 2, ai: 'drifter', anchor: 'center', fps: 7, flying: true, status: { poison: 1 }, mass: 0.5,
    sprite: { plan: 'jelly', w: 20, h: 24, ax: 10, ay: 8, frames: 6, o: { ramp: R.fishYellow, bell: 5, len: 8, tent: 4, eyes: true } }, p: { speed: 24, aggro: 120 } },
  hookjaw: { name: 'Hookjaw', hp: 34, dmg: 13, w: 24, h: 10, xp: 24, coins: [4, 9], poise: 14, ai: 'hooker', fps: 9, flying: true,
    sprite: fish(26, 10, R.leviathan, { teeth: true, hook: true, belly: R.bone, tail: 2.5, spots: true }), p: { speed: 56, aggro: 200, hover: 120, wind: 0.65, cd: 3, hookSpeed: 230, pull: 250 } },
  tuskram: { name: 'Tusk Ram', hp: 60, dmg: 18, w: 30, h: 13, xp: 32, coins: [5, 11], poise: 30, ai: 'rammer', fps: 8, flying: true, mass: 2.5,
    sprite: { plan: 'fish', w: 78, h: 30, ax: 39, ay: 15, frames: 4, o: { len: 34, hgt: 14, ramp: R.fishBlue, tusk: true, belly: R.pearl, tail: 3, teeth: false } }, p: { speed: 50, aggro: 230, wind: 0.95, charge: 300, chargeTime: 0.85, stunT: 1.7, cd: 3 } },
  fumecap: { name: 'Fumecap', hp: 26, dmg: 7, w: 16, h: 22, xp: 16, coins: [2, 5], poise: 99, noStagger: true, ai: 'cloudlayer', anchor: 'feet', fps: 4, mass: 99, contact: false,
    sprite: { plan: 'cap', w: 36, h: 34, ax: 18, ay: 32, frames: 4, o: { ramp: R.venom, glow: '#b8ff70' } }, p: { range: 170, wind: 0.7, cd: 3.4, cloudR: 34, cloudLife: 4.5, cloudDps: 4 } },
};
