// Bounty templates for the Tide Board. A bounty counts something the swimmer does anyway (kills of one creature, chests,
// forage patches...) from the moment the board is generated, so progress is read straight from the records in the save and
// nothing has to listen for events. `get(records)` returns the counter, `range` how many to ask for, `pay` scales the reward.
export const STAT_BOUNTIES = {
  chests:  { label: (n) => `Open ${n} treasure chest${n > 1 ? 's' : ''}`, get: (r) => r.chests, range: [2, 4], pay: 1.0, icon: 'chest' },
  forage:  { label: (n) => `Harvest ${n} forage patch${n > 1 ? 'es' : ''}`, get: (r) => r.forage, range: [3, 7], pay: 0.8, icon: 'leaf' },
  crafted: { label: (n) => `Cook or craft ${n} thing${n > 1 ? 's' : ''}`, get: (r) => r.crafted, range: [2, 4], pay: 0.9, icon: 'pot' },
  elites:  { label: (n) => `Defeat ${n} elite${n > 1 ? 's' : ''}`, get: (r) => r.elites, range: [1, 3], pay: 1.5, icon: 'skull' },
  rifts:   { label: (n) => `Complete ${n} Tidal Rift${n > 1 ? 's' : ''}`, get: (r) => r.rifts, range: [1, 1], pay: 2.4, icon: 'rift', needs: (s) => !!s.bosses.grumbold },
  gauntlet: { label: (n) => `Fell ${n} foes in the Pearl Gauntlet`, get: (r) => r.arenaKills, range: [12, 24], pay: 1.4, icon: 'ring', needs: (s) => !!s.bosses.grumbold },
  dashes:  { label: (n) => `Dash ${n} times`, get: (r) => r.dashes, range: [40, 90], pay: 0.5, icon: 'wave' },
  rests:   { label: (n) => `Rest at ${n} shrine${n > 1 ? 's' : ''}`, get: (r) => r.rests, range: [1, 2], pay: 0.5, icon: 'shrine' },
  crits:   { label: (n) => `Land ${n} critical hits`, get: (r) => r.crits, range: [15, 40], pay: 0.8, icon: 'star' },
  healed:  { label: (n) => `Recover ${n} health`, get: (r) => r.healed, range: [150, 400], pay: 0.6, icon: 'drop' },
};
// a creature the swimmer has already met, asked for in numbers that fit how tough it is
export const HUNT = { minN: 5, maxN: 16, starters: ['pinchling', 'minnow', 'urchin'], pay: 1.0 };

export const STREAK_BONUS = [0, 0, 1, 1, 2, 2, 3];   // pearls for a full board, by consecutive days (capped at the last entry)
export const REROLL_COST = 50;
export const BOARD_SIZE = 4;
