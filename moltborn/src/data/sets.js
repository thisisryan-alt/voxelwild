// Equipment sets: wear two pieces of a set for the small bonus, all three for the large one. Bonus effects use the same
// keys as item `fx` (see systems/progression.js). `text` is the short line shown in the Items menu.
export const SETS = {
  shorekeeper: { name: 'Shorekeeper', pieces: ['shell_driftwood', 'claw_rusty', 'charm_pearlstring'], two: { fx: { hp: 0.08 }, text: '+8% health' }, three: { fx: { speed: 0.05, magnet: 30 }, text: '+5% speed, wider pickup reach' } },
  reefguard:   { name: 'Reefguard', pieces: ['shell_barnacle', 'claw_urchin', 'charm_spore'], two: { fx: { thorns: 0.06 }, text: 'Foes take more from striking you' }, three: { fx: { poison: 1, lifeOnKill: 2 }, text: 'Blows poison; kills heal a little' } },
  pearl_court: { name: 'Pearl Court', pieces: ['shell_pearl', 'claw_trident', 'charm_kingsigil'], two: { fx: { coinBonus: 0.15 }, text: '+15% coins' }, three: { fx: { crit: 0.08, discount: 0.1 }, text: '+8% crit, shops 10% cheaper' } },
  salvage:     { name: 'Wreck Salvage', pieces: ['shell_ironhull', 'claw_anchor', 'charm_ghostcoin'], two: { fx: { def: 2 }, text: '+2 defence' }, three: { fx: { heavyDmg: 0.2, execute: 0.15 }, text: 'Heavy blows +20%; finish the weak' } },
  cinder_forge: { name: 'Cinder Forge', pieces: ['shell_cinder', 'claw_cinder', 'charm_emberglass'], two: { fx: { heatResist: 0.3 }, text: '+30% heat resistance' }, three: { fx: { hitBurn: 0.2, dmg: 0.08 }, text: 'Blows may ignite; +8% damage' } },
  hermit_court: { name: 'Hermit Court', pieces: ['shell_hermitking', 'claw_hermit', 'charm_archivist'], two: { fx: { parryWindow: 0.2 }, text: 'A longer parry window' }, three: { fx: { parryTide: 3, dmg: 0.06 }, text: 'Parries refund Tide; +6% damage' } },
  tidebound:   { name: 'Tidebound', pieces: ['shell_tidewoven', 'claw_lumen', 'charm_tideglass'], two: { fx: { tideRegen: 0.15 }, text: 'Tide regenerates 15% faster' }, three: { fx: { tideCost: -0.15, abilityDmg: 0.15 }, text: 'Cheaper, stronger abilities' } },
};
export const SET_IDS = Object.keys(SETS);
export const SET_OF = {}; for (const [id, s] of Object.entries(SETS)) for (const p of s.pieces) SET_OF[p] = id;

// how many pieces of each set are worn; returns [{ id, set, count, fx[] }] for sets with at least two
export function activeSets(equip) {
  const worn = Object.values(equip || {}).filter(Boolean), out = [];
  for (const [id, s] of Object.entries(SETS)) {
    const count = s.pieces.filter((p) => worn.includes(p)).length; if (count < 2) continue;
    out.push({ id, set: s, count, fx: count >= 3 ? [s.two.fx, s.three.fx] : [s.two.fx] });
  }
  return out;
}
