// Elite affixes: modifiers a creature can carry that change how it fights. Each entry may define
//   hp / xp / coin: multipliers      dmgIn: multiplier on damage it takes      status: effects kept on it for good
//   hitStatus: effects its blows put on the player      leech: share of damage it deals that it heals back
//   thorns: share of damage it takes that is thrown back      shield: hits it absorbs before it can be hurt
//   onDeath: name of a death effect handled in systems/affixes.js      tip: one line for the field notes
export const AFFIXES = {
  armored:   { name: 'Armored',     color: '#9aa8c0', hp: 1.25, dmgIn: 0.65, xp: 1.2, tip: 'Takes a third less damage. Heavy blows still break through.' },
  swift:     { name: 'Swift',       color: '#ffe65a', status: [['haste', 0.6]], xp: 1.2, tip: 'Moves and strikes faster than its kind.' },
  vampiric:  { name: 'Vampiric',    color: '#d03a6a', leech: 0.6, xp: 1.3, tip: 'Heals when it hurts you. Do not trade blows.' },
  volatile:  { name: 'Volatile',    color: '#ff8a3a', onDeath: 'blast', xp: 1.3, tip: 'Explodes when it dies. Finish it from a distance.' },
  scorching: { name: 'Scorching',   color: '#ff6a2a', hitStatus: { burn: 1 }, xp: 1.3, tip: 'Its blows set you alight.' },
  frostbitten: { name: 'Frostbitten', color: '#8ad0ff', hitStatus: { chill: 1 }, xp: 1.3, tip: 'Its blows chill you to a crawl.' },
  brooding:  { name: 'Brooding',    color: '#7aff9a', onDeath: 'brood', xp: 1.3, tip: 'Bursts into hatchlings when it falls.' },
  mending:   { name: 'Mending',     color: '#7affb0', status: [['regen', 3]], hp: 1.15, xp: 1.2, tip: 'Knits itself back together. Burst it down.' },
  thorned:   { name: 'Thorned',     color: '#d8a0ff', thorns: 0.25, xp: 1.3, tip: 'Hurts you for hurting it. Use abilities at range.' },
  shielded:  { name: 'Shielded',    color: '#c8f0ff', shield: 3, xp: 1.4, tip: 'A bubble absorbs its first few hits.' },
};
export const AFFIX_IDS = Object.keys(AFFIXES);

// chance that a creature spawns as an elite, by difficulty tier index (calm..maelstrom)
export const ELITE_BASE = [0, 0.05, 0.1, 0.18];
export const ELITE_NG = 0.04;           // per New Game+ voyage
export const ELITE_CAP = 0.5;
export const ELITE_REWARD = { xp: 1.8, coin: 2, pearl: 0.25, ingredient: 1.5 };

// creatures that never roll affixes
export const NO_AFFIX = new Set(['hatchling', 'mender', 'spawnling', 'jellet', 'minnow', 'piranha', 'mimic']);
