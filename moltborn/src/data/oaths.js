// Oaths: optional handicaps a swimmer can swear before a Tidal Rift. Each makes the run harder in one clear way and adds to
// the reward. Up to MAX_OATHS can be sworn. They are applied for the whole run and forgotten when it ends.
//   mult: folded into the rift's foe multipliers (hp / dmg / xp / coin)    haste: every foe keeps a haste status
//   dark: a floor on how dark every chamber is                              fx: stat changes on the swimmer, as for equipment
//   reward: added to the coin and experience bonus paid at the end of the run
export const MAX_OATHS = 3;

export const OATHS = {
  iron:  { name: 'Oath of Iron',  color: '#9aa8c0', mult: { hp: 1.25 }, reward: 0.15, desc: 'Foes have 25% more health.' },
  fury:  { name: 'Oath of Fury',  color: '#ff6a5a', mult: { dmg: 1.2 }, reward: 0.15, desc: 'Foes hit 20% harder.' },
  haste: { name: 'Oath of Haste', color: '#ffe65a', haste: true, reward: 0.2, desc: 'Every foe swims and strikes faster.' },
  fog:   { name: 'Oath of Fog',   color: '#8a7ac8', dark: 0.3, reward: 0.1, desc: 'Every chamber is dark and close.' },
  frail: { name: 'Oath of Frailty', color: '#d8a0ff', fx: { hp: -0.25 }, reward: 0.2, desc: 'You have 25% less health.' },
};
export const OATH_IDS = Object.keys(OATHS);

// drop unknown and duplicate ids and anything beyond the limit
export function cleanOaths(list) {
  const out = []; for (const id of list || []) if (OATHS[id] && !out.includes(id) && out.length < MAX_OATHS) out.push(id); return out;
}
// the extra reward share for a set of oaths (0.35 means +35% coins and experience)
export const rewardBonus = (list) => cleanOaths(list).reduce((n, id) => n + OATHS[id].reward, 0);
// foe multipliers from a set of oaths, to be multiplied into a rift's own
export function oathMult(list) {
  const m = { hp: 1, dmg: 1, xp: 1, coin: 1 };
  for (const id of cleanOaths(list)) for (const [k, v] of Object.entries(OATHS[id].mult || {})) m[k] *= v;
  return m;
}
export const oathHaste = (list) => cleanOaths(list).some((id) => OATHS[id].haste);
export const oathDark = (list) => cleanOaths(list).reduce((d, id) => Math.max(d, OATHS[id].dark || 0), 0);
