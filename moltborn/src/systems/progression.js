// Derived stats and progression rules: level/xp, skills, equipment, mutations, forms.
import { FORMS, BRANCHES, xpToNext, LEVEL_CAP } from '../data/forms.js';
import { SKILLS } from '../data/skills.js';
import { ITEMS } from '../data/items.js';
import { defaults as settingDefaults } from './settings.js';
import { newRecords } from './stats.js';
import { RELICS } from '../data/relics.js';
import { activeSets } from '../data/sets.js';

export function newState() {
  return {
    version: 1, playtime: 0,
    form: 'shore', branches: {}, dye: 'default',
    level: 1, xp: 0, ep: 0, sp: 0,
    hp: null, tide: null, fury: 0,
    coins: 0, inv: { kelp_wrap: 2 }, equip: { shell: null, claw: null, charm: null }, mutations: [], mutOwned: [],
    skills: {}, abilities: [], slots: [null, null, null],
    flags: {}, quests: {}, codex: {}, zones: {}, visited: {}, bosses: {},
    checkpoint: { zone: 'reef_nursery', entry: 'start' }, purse: null,
    stats: { kills: 0, deaths: 0, coinsEarned: 0, secrets: 0, parries: 0 },
    settings: settingDefaults(),
    upgrades: {}, records: newRecords(), trophies: {},
  };
}

export function stageOf(state) { return FORMS[state.form].stage; }
export function branchOf(state) {
  for (const b of Object.values(BRANCHES)) if (state.branches[b.form] === b.id && FORMS[state.form].stage >= FORMS[b.form].stage) { /* any branch of an earlier-or-current form applies */ }
  return state.branches;
}

export function computeStats(state) {
  const F = FORMS[state.form], base = F.stats;
  const s = {
    maxHp: base.hp + (state.level - 1) * 4, maxTide: base.tide + (state.level - 1) * 1.2, atk: base.atk + (state.level - 1) * 0.5, def: base.def,
    crit: 0.05, critMult: 1.6, speed: 1, dmg: 0, heavyDmg: 0, abilityDmg: 0, comboWindow: 0, atkSpeed: 0, chargeSpeed: 0, execute: 0, furyGain: 0, reach: 0,
    thorns: 0, parryWindow: 0, parryTide: 0, poise: base.poise, secondWind: 0, dashDist: 0, dashCd: 0, strokes: 0, iframes: 0, currentResist: 0,
    tideRegen: 0, cooldown: 0, ultCharge: 0, tideCost: 0, pressure: base.pressure, light: 0, magnet: 40, coinBonus: 0, discount: 0, lifeOnKill: 0, poison: 0, poisonResist: 0, sense: 0, crit2: 0, regen: 0, killRush: 0, dashStrike: 0, abKillTide: 0, heatResist: 0, hitBurn: 0, hitChill: 0, hitBleed: 0,
  };
  const mult = { hp: 1, atk: 1, def: 1, tide: 1, speed: 1 };
  // branches earned so far all contribute
  for (const bid of Object.values(state.branches)) {
    const b = BRANCHES[bid]; if (!b) continue;
    for (const [k, v] of Object.entries(b.mods)) {
      if (['hp', 'atk', 'def', 'tide', 'speed'].includes(k)) mult[k] *= v;
      else if (k === 'crit' || k === 'poison' || k === 'light') s[k] += v;
      else if (k === 'parryWindow') s.parryWindow += v - 1;
      else if (k === 'comboSpeed') s.atkSpeed += v - 1;
      else if (k === 'regen') s.tideRegen += v - 1;
    }
  }
  const apply = (fx) => { for (const [k, v] of Object.entries(fx || {})) { if (k === 'hp' || k === 'tide') mult[k] += v; else if (k === 'atk' || k === 'def') s[k] += v; else if (k === 'speed') s.speed += v; else if (k in s) s[k] += v; } };
  for (const id of Object.keys(state.skills)) apply(SKILLS[id]?.fx);
  for (const slot of ['shell', 'claw', 'charm']) { const id = state.equip[slot]; if (id) { const lv = state.upgrades[id] || 0; const fx = ITEMS[id].fx; apply(fx); if (lv) { if (fx.atk) s.atk += lv * 1.5; if (fx.def) s.def += lv * 1; } } }
  for (const a of activeSets(state.equip)) for (const fx of a.fx) apply(fx);
  for (const id of state.mutations) apply(ITEMS[id]?.fx);
  for (const id of state.riftRelics || []) apply(RELICS[id]?.fx);
  s.maxHp = Math.round(s.maxHp * mult.hp); s.maxTide = Math.round(s.maxTide * mult.tide);
  s.atk = s.atk * mult.atk * (1 + s.dmg); s.def = s.def * mult.def; s.speed = s.speed * mult.speed;
  s.strokes = F.move.stroke.max + s.strokes;
  s.tideRegen = 3.2 * (1 + s.tideRegen);
  s.parryWindow = 0.16 * (1 + s.parryWindow);
  s.comboWindow = 0.45 * (1 + s.comboWindow);
  return s;
}

export function grantXp(state, amount) {
  if (state.level >= LEVEL_CAP) return { levels: 0 };
  state.xp += amount; let levels = 0;
  while (state.level < LEVEL_CAP && state.xp >= xpToNext(state.level)) { state.xp -= xpToNext(state.level); state.level++; state.sp++; levels++; }
  return { levels };
}

export function canBuySkill(state, id) {
  const n = SKILLS[id]; if (!n || state.skills[id]) return false;
  if (state.sp < n.cost) return false;
  if (n.minStage && stageOf(state) < n.minStage) return false;
  return n.req.every((r) => state.skills[r]);
}
export function buySkill(state, id) {
  if (!canBuySkill(state, id)) return false;
  const n = SKILLS[id]; state.sp -= n.cost; state.skills[id] = true;
  if (n.ability && !state.abilities.includes(n.ability)) { state.abilities.push(n.ability); const i = state.slots.indexOf(null); if (i >= 0 && i < FORMS[state.form].abilitySlots) state.slots[i] = n.ability; }
  return true;
}

// ---- respec: give the skill points back, for a price ---------------------------------------------------------------------------------
export const respecCost = (state) => (state.level < 6 ? 0 : 40 + state.level * 12);
export function respec(state) {
  const spent = Object.keys(state.skills).reduce((n, id) => n + (SKILLS[id]?.cost || 0), 0); if (!spent) return false;
  const cost = respecCost(state); if (state.coins < cost) return false;
  const branchAbilities = new Set(Object.values(state.branches).map((b) => BRANCHES[b]?.ability).filter(Boolean));
  for (const id of Object.keys(state.skills)) {
    const a = SKILLS[id]?.ability; if (!a || branchAbilities.has(a)) continue;
    state.abilities = state.abilities.filter((x) => x !== a); state.slots = state.slots.map((x) => (x === a ? null : x));
  }
  state.sp += spent; state.skills = {}; state.coins -= cost; return true;
}
