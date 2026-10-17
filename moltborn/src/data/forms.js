// Evolution data: forms (stages), branches, requirements. Every stage changes size, movement model,
// combo set and abilities — not just numbers.
export const FORM_ORDER = ['shore', 'warrior', 'abyssal', 'leviathan', 'mythic'];

export const FORMS = {
  shore: {
    id: 'shore', stage: 1, name: 'Shore Crab', epithet: 'The Overlooked',
    blurb: 'Small, brittle and easy to ignore. Heavy for a swimmer, nimble on the seabed.',
    biology: 'An ordinary scuttler. Its shell is thin — but each molt leaves a seam of unfinished chitin that never fully hardens.',
    hit: [14, 10], scale: 1,
    move: { ground: 82, groundAccel: 700, groundFric: 900, swim: 66, swimAccel: 280, drag: 1.5, gravity: 170, maxSink: 85, free: false,
      stroke: { vy: -105, cd: 0.28, max: 3 }, dash: { speed: 230, time: 0.15, cd: 0.6, iframes: 0.14 } },
    stats: { hp: 40, tide: 30, atk: 4, def: 0, pressure: 0, poise: 1 },
    combo: [
      { anim: 'attack1', dmg: 1.0, wind: 0.09, act: 0.08, rec: 0.14, lunge: 55, hb: [10, -6, 16, 12], kb: 70, poise: 4, stop: 3 },
      { anim: 'attack2', dmg: 1.2, wind: 0.09, act: 0.08, rec: 0.22, lunge: 60, hb: [10, -6, 17, 12], kb: 95, poise: 6, stop: 4 },
    ],
    heavy: { anim: 'attack3', dmg: 2.2, charge: 0, wind: 0.2, act: 0.1, rec: 0.35, lunge: 60, hb: [8, -8, 20, 16], kb: 150, poise: 30, stop: 6, shake: 2, guardBreak: true },
    block: 'tuck', ultName: 'Molt Burst',
    abilitySlots: 1, mutationSlots: 1,
    unlocks: ['Pinch combo', 'Scuttle dash', 'Shell tuck'],
  },
  warrior: {
    id: 'warrior', stage: 2, name: 'Warrior Crab', epithet: 'The Hardshell',
    blurb: 'A tempered carapace, a heavier claw and the discipline to wield both. Charged strikes shatter stone.',
    biology: 'The first true molt hardens the seam into plate. Stress stored in the muscle can be released as a shock through the claw.',
    hit: [14, 12], scale: 1.25,
    move: { ground: 92, groundAccel: 800, groundFric: 1000, swim: 76, swimAccel: 320, drag: 1.4, gravity: 140, maxSink: 80, free: false,
      stroke: { vy: -118, cd: 0.26, max: 5 }, dash: { speed: 250, time: 0.16, cd: 0.55, iframes: 0.16 } },
    stats: { hp: 75, tide: 45, atk: 8, def: 2, pressure: 0, poise: 3 },
    combo: [
      { anim: 'attack1', dmg: 1.0, wind: 0.08, act: 0.08, rec: 0.12, lunge: 60, hb: [12, -8, 20, 14], kb: 80, poise: 5, stop: 3 },
      { anim: 'attack2', dmg: 1.1, wind: 0.08, act: 0.08, rec: 0.12, lunge: 65, hb: [12, -8, 21, 14], kb: 90, poise: 5, stop: 3 },
      { anim: 'attack3', dmg: 1.9, wind: 0.12, act: 0.1, rec: 0.26, lunge: 85, hb: [10, -12, 26, 20], kb: 190, poise: 14, stop: 6, shake: 2 },
    ],
    heavy: { anim: 'heavy', dmg: 3.2, charge: 0.8, wind: 0.1, act: 0.12, rec: 0.38, lunge: 90, hb: [10, -12, 30, 22], kb: 260, poise: 60, stop: 8, shake: 4, guardBreak: true, shock: true, breaks: true },
    block: 'parry', ultName: 'Shatter Shell',
    abilitySlots: 2, mutationSlots: 1,
    unlocks: ['Charged heavy', 'Parry', 'Shatter cracked stone', 'Five strokes'],
  },
  abyssal: {
    id: 'abyssal', stage: 3, name: 'Abyssal Predator', epithet: 'The Deep Hunter',
    blurb: 'Dark-shelled, long-limbed, born to the pressure. Swims freely in every direction and hunts by light.',
    biology: 'Pressure forces the body to trade bone for gel. Gills bloom along the ribs and the shell darkens to drink every scrap of light.',
    hit: [22, 14], scale: 1.6,
    move: { ground: 100, groundAccel: 800, groundFric: 900, swim: 112, swimAccel: 460, drag: 2.3, gravity: 0, maxSink: 0, free: true,
      stroke: { vy: -130, cd: 0.2, max: 99 }, dash: { speed: 320, time: 0.18, cd: 0.45, iframes: 0.2, any: true } },
    stats: { hp: 125, tide: 60, atk: 14, def: 5, pressure: 2, poise: 5 },
    combo: [
      { anim: 'attack1', dmg: 1.0, wind: 0.07, act: 0.07, rec: 0.1, lunge: 90, hb: [12, -9, 24, 18], kb: 90, poise: 6, stop: 3 },
      { anim: 'attack2', dmg: 1.0, wind: 0.07, act: 0.07, rec: 0.1, lunge: 90, hb: [12, -9, 24, 18], kb: 90, poise: 6, stop: 3 },
      { anim: 'attack1', dmg: 1.2, wind: 0.07, act: 0.07, rec: 0.1, lunge: 100, hb: [12, -10, 26, 20], kb: 110, poise: 8, stop: 3 },
      { anim: 'attack3', dmg: 2.2, wind: 0.1, act: 0.1, rec: 0.26, lunge: 140, hb: [10, -14, 32, 26], kb: 220, poise: 18, stop: 7, shake: 3 },
    ],
    heavy: { anim: 'heavy', dmg: 3.6, charge: 0.7, wind: 0.08, act: 0.14, rec: 0.32, lunge: 220, hb: [4, -12, 40, 24], kb: 280, poise: 70, stop: 8, shake: 4, guardBreak: true, breaks: true, pierce: true },
    block: 'parry', ultName: 'Abyssal Maw',
    abilitySlots: 3, mutationSlots: 2,
    unlocks: ['Free swimming', 'Pressure resistance', 'Omni dash', 'Lure light'],
  },
  leviathan: {
    id: 'leviathan', stage: 4, name: 'Ancient Leviathan', epithet: 'The Elder Tide',
    blurb: 'A colossus of ancient armour and a lashing telson tail. Slow to turn, impossible to stop.',
    biology: 'The molt reaches back through the fossil record: eurypterid plate, trilobite crest, a tail that remembers being a spear. The lineage was never new — only forgotten.',
    hit: [40, 22], scale: 2.4,
    move: { ground: 90, groundAccel: 500, groundFric: 700, swim: 96, swimAccel: 320, drag: 2.0, gravity: 0, maxSink: 0, free: true,
      stroke: { vy: -120, cd: 0.25, max: 99 }, dash: { speed: 270, time: 0.2, cd: 0.6, iframes: 0.2, any: true } },
    stats: { hp: 240, tide: 80, atk: 24, def: 10, pressure: 4, poise: 40 },
    combo: [
      { anim: 'attack1', dmg: 1.0, wind: 0.1, act: 0.1, rec: 0.14, lunge: 90, hb: [18, -16, 40, 32], kb: 140, poise: 12, stop: 4, shake: 1 },
      { anim: 'attack2', dmg: 1.1, wind: 0.1, act: 0.1, rec: 0.14, lunge: 90, hb: [18, -16, 42, 32], kb: 140, poise: 12, stop: 4, shake: 1 },
      { anim: 'attack3', dmg: 1.8, wind: 0.14, act: 0.12, rec: 0.2, lunge: 60, hb: [-44, -18, 88, 36], kb: 200, poise: 22, stop: 6, shake: 3 },
      { anim: 'attack1', dmg: 2.6, wind: 0.18, act: 0.14, rec: 0.34, lunge: 120, hb: [10, -22, 60, 44], kb: 300, poise: 40, stop: 8, shake: 4 },
    ],
    heavy: { anim: 'heavy', dmg: 4.2, charge: 0.9, wind: 0.14, act: 0.16, rec: 0.45, lunge: 40, hb: [-60, -26, 120, 52], kb: 340, poise: 120, stop: 10, shake: 6, guardBreak: true, shock: true, breaks: true, seals: true, armor: true },
    block: 'parry', ultName: 'Leviathan Cataclysm',
    abilitySlots: 3, mutationSlots: 2,
    unlocks: ['Seal-breaking tail', 'Current resistance', 'Super-armour heavy', 'Tail sweep'],
  },
  mythic: {
    id: 'mythic', stage: 5, name: 'Thalassarch', epithet: 'The Mythic Sea Creature',
    blurb: 'A crowned, crystalline tide-lord. The ocean itself moves when it moves.',
    biology: 'The final molt sheds the last limit: shell turns to pearl and the pearl to tide. Water answers it the way it once answered only gods.',
    hit: [34, 20], scale: 2.8,
    move: { ground: 100, groundAccel: 700, groundFric: 700, swim: 132, swimAccel: 560, drag: 2.4, gravity: 0, maxSink: 0, free: true,
      stroke: { vy: -140, cd: 0.2, max: 99 }, dash: { speed: 360, time: 0.2, cd: 0.4, iframes: 0.24, any: true } },
    stats: { hp: 360, tide: 110, atk: 34, def: 16, pressure: 9, poise: 60 },
    combo: [
      { anim: 'attack1', dmg: 1.0, wind: 0.06, act: 0.07, rec: 0.09, lunge: 110, hb: [14, -14, 38, 28], kb: 110, poise: 8, stop: 3 },
      { anim: 'attack2', dmg: 1.0, wind: 0.06, act: 0.07, rec: 0.09, lunge: 110, hb: [14, -14, 38, 28], kb: 110, poise: 8, stop: 3 },
      { anim: 'attack1', dmg: 1.1, wind: 0.06, act: 0.07, rec: 0.09, lunge: 110, hb: [14, -14, 40, 28], kb: 120, poise: 8, stop: 3 },
      { anim: 'attack2', dmg: 1.2, wind: 0.06, act: 0.07, rec: 0.09, lunge: 110, hb: [14, -14, 42, 30], kb: 130, poise: 10, stop: 3 },
      { anim: 'attack3', dmg: 2.8, wind: 0.12, act: 0.12, rec: 0.28, lunge: 140, hb: [8, -24, 64, 48], kb: 320, poise: 40, stop: 9, shake: 5 },
    ],
    heavy: { anim: 'heavy', dmg: 4.8, charge: 0.8, wind: 0.1, act: 0.16, rec: 0.36, lunge: 160, hb: [-20, -30, 110, 60], kb: 360, poise: 140, stop: 10, shake: 6, guardBreak: true, shock: true, breaks: true, seals: true, gates: true, pierce: true },
    block: 'parry', ultName: 'The Last Tide',
    abilitySlots: 3, mutationSlots: 3,
    unlocks: ['Tide gates', 'Tidecall abilities', 'The Last Tide'],
  },
  primordial: {
    id: 'primordial', stage: 5, name: 'The Unmolted', epithet: 'First Tide Reborn',
    blurb: 'Not a shape at all: the Mother Tide wearing a crab’s outline, as she did before the gods.',
    biology: 'Seven memories of the first sea, kept in seven pearls, finally agree. The body stops being a thing and becomes a current.',
    hit: [34, 20], scale: 2.8,
    move: { ground: 100, groundAccel: 700, groundFric: 700, swim: 140, swimAccel: 600, drag: 2.4, gravity: 0, maxSink: 0, free: true,
      stroke: { vy: -140, cd: 0.2, max: 99 }, dash: { speed: 380, time: 0.2, cd: 0.35, iframes: 0.26, any: true } },
    stats: { hp: 400, tide: 130, atk: 38, def: 18, pressure: 9, poise: 70 },
    combo: null, // inherits mythic combo
    heavy: null, block: 'parry', ultName: 'First Tide',
    abilitySlots: 3, mutationSlots: 3, inherits: 'mythic',
    unlocks: ['Everything of the Thalassarch', 'Tide that answers no god'],
  },
};
FORMS.primordial.combo = FORMS.mythic.combo; FORMS.primordial.heavy = FORMS.mythic.heavy;

// Branches chosen at the Molt Shrine when evolving. They tint the body, tweak stats and add a signature ability.
export const BRANCHES = {
  bulwark:  { id: 'bulwark', form: 'warrior', name: 'Bulwark Line', desc: 'Plate over plate. Parries hit back; the shell turns blows.', mods: { hp: 1.25, def: 1.5, atk: 0.95, speed: 0.92, parryWindow: 1.4 }, ability: 'shellSlam', trait: 'Thorned plate: 20% of damage taken is returned.' },
  duelist:  { id: 'duelist', form: 'warrior', name: 'Duelist Line', desc: 'Light claws, long reach, ruthless timing. Fast combos and crits.', mods: { hp: 0.9, def: 0.8, atk: 1.1, speed: 1.1, crit: 0.15, comboSpeed: 1.2 }, ability: 'riposte', trait: 'Keen edge: +15% crit chance.' },
  venom:    { id: 'venom', form: 'abyssal', name: 'Venom Stalker', desc: 'Toxic spines and ambush strikes. Poison eats what claws cannot.', mods: { atk: 1.05, speed: 1.05, poison: 1 }, ability: 'venomSpines', trait: 'Hits apply poison; attacks from darkness hit harder.' },
  lumen:    { id: 'lumen', form: 'abyssal', name: 'Lumen Hunter', desc: 'A living lantern. Beams of light, radiant barriers and far sight.', mods: { tide: 1.3, light: 1 }, ability: 'lumenBeam', trait: 'Lure light reveals hidden passages and weakens shadow creatures.' },
  tidebreaker: { id: 'tidebreaker', form: 'leviathan', name: 'Tidebreaker', desc: 'Raw, crushing might. Slams that split the sea floor.', mods: { atk: 1.2, hp: 1.1, speed: 0.95 }, ability: 'quake', trait: 'Heavy attacks cause aftershocks.' },
  tideweaver:  { id: 'tideweaver', form: 'leviathan', name: 'Tideweaver', desc: 'Currents obey. Whirlpools, summoned tides and ranged mastery.', mods: { tide: 1.4, atk: 0.95, regen: 1.5 }, ability: 'maelstrom', trait: 'Tide regenerates faster; abilities cost less.' },
};

export const EVOLUTIONS = {
  warrior:   { from: 'shore', level: 4, ep: 5, item: 'brine_core', shrine: 'molt_reef', branches: ['bulwark', 'duelist'], title: 'The Hardshell Molt' },
  abyssal:   { from: 'warrior', level: 9, ep: 10, item: 'abyssal_core', shrine: 'molt_deep', branches: ['venom', 'lumen'], title: 'The Deep Molt' },
  leviathan: { from: 'abyssal', level: 15, ep: 12, item: 'titan_heart', shrine: 'molt_trench', branches: ['tidebreaker', 'tideweaver'], title: 'The Ancient Molt' },
  mythic:    { from: 'leviathan', level: 21, ep: 10, item: 'tide_sigil', shrine: 'molt_domain', branches: [], title: 'The Apotheosis' },
  primordial:{ from: 'leviathan', level: 21, ep: 10, item: 'tide_sigil', shrine: 'molt_domain', branches: [], title: 'The Unmolting', secret: true },
};

export const nextForms = (id) => Object.keys(EVOLUTIONS).filter((k) => EVOLUTIONS[k].from === id);

export const xpToNext = (lv) => Math.round(18 + lv * 13 + lv * lv * 1.6);
export const LEVEL_CAP = 30;
