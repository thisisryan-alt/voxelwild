// Skill tree: four branches. effect keys feed progression.computeStats().
export const SKILL_BRANCHES = {
  claw:    { name: 'Claw',    color: '#ff7a4a', desc: 'Offence' },
  shell:   { name: 'Shell',   color: '#6ab0ff', desc: 'Defence' },
  current: { name: 'Current', color: '#7affc8', desc: 'Motion' },
  tide:    { name: 'Tide',    color: '#c07aff', desc: 'Magic' },
};
// col/row place nodes in the menu; req = prerequisite ids; minStage gates by evolution stage.
export const SKILLS = {
  claw1: { branch: 'claw', col: 0, row: 0, name: 'Sharpened Pincers', cost: 1, req: [], fx: { dmg: 0.10 }, desc: '+10% damage.' },
  claw2: { branch: 'claw', col: 0, row: 1, name: 'Combo Rhythm', cost: 1, req: ['claw1'], fx: { comboWindow: 0.25, atkSpeed: 0.05 }, desc: 'Longer combo window, slightly faster strikes.' },
  claw3: { branch: 'claw', col: 1, row: 1, name: 'Keen Eye', cost: 1, req: ['claw1'], fx: { crit: 0.08 }, desc: '+8% critical chance.' },
  claw4: { branch: 'claw', col: 0, row: 2, name: 'Heavy Hand', cost: 2, req: ['claw2'], minStage: 2, fx: { chargeSpeed: 0.25, heavyDmg: 0.15 }, desc: 'Heavy attacks charge faster and hit harder.' },
  claw5: { branch: 'claw', col: 1, row: 2, name: 'Executioner', cost: 2, req: ['claw3'], fx: { execute: 0.3 }, desc: '+30% damage to enemies below 30% health.' },
  claw6: { branch: 'claw', col: 0, row: 3, name: 'Frenzy', cost: 2, req: ['claw4', 'claw5'], fx: { furyGain: 0.4 }, desc: 'Fury builds 40% faster.' },
  claw7: { branch: 'claw', col: 1, row: 3, name: 'Cleaving Arc', cost: 2, req: ['claw5'], minStage: 3, fx: { reach: 0.2 }, desc: 'Strikes reach 20% wider.' },
  claw8: { branch: 'claw', col: 0, row: 4, name: 'Crescent Wave', cost: 2, req: ['claw6'], minStage: 2, ability: 'crescent', desc: 'Unlocks Crescent Wave: a piercing wave of force.' },
  claw9: { branch: 'claw', col: 1, row: 4, name: 'Bloodrush', cost: 3, req: ['claw7'], minStage: 3, fx: { killRush: 1 }, desc: 'Every kill grants +30% attack speed for 4 seconds.' },

  shell1: { branch: 'shell', col: 0, row: 0, name: 'Thick Plating', cost: 1, req: [], fx: { hp: 0.15 }, desc: '+15% maximum health.' },
  shell2: { branch: 'shell', col: 0, row: 1, name: 'Salt Skin', cost: 1, req: ['shell1'], fx: { def: 2 }, desc: '+2 defence.' },
  shell3: { branch: 'shell', col: 1, row: 1, name: 'Parry Mastery', cost: 2, req: ['shell1'], minStage: 2, fx: { parryWindow: 0.5 }, desc: 'Parry window 50% longer.' },
  shell4: { branch: 'shell', col: 0, row: 2, name: 'Thorned Shell', cost: 2, req: ['shell2'], fx: { thorns: 0.15 }, desc: 'Reflect 15% of damage taken.' },
  shell5: { branch: 'shell', col: 1, row: 2, name: 'Pearl Guard', cost: 2, req: ['shell3'], fx: { parryTide: 10 }, desc: 'Parries restore 10 Tide.' },
  shell6: { branch: 'shell', col: 0, row: 3, name: 'Fortitude', cost: 2, req: ['shell4'], fx: { poise: 15 }, desc: 'Harder to stagger.' },
  shell7: { branch: 'shell', col: 1, row: 3, name: 'Second Wind', cost: 3, req: ['shell5', 'shell6'], fx: { secondWind: 1 }, desc: 'Once per rest, a killing blow leaves you at 40% health.' },
  shell8: { branch: 'shell', col: 0, row: 4, name: 'Aegis Bubble', cost: 2, req: ['shell6'], minStage: 2, ability: 'aegis', desc: 'Unlocks Aegis Bubble: a bubble that swallows three blows.' },
  shell9: { branch: 'shell', col: 1, row: 4, name: 'Barnacle Crust', cost: 3, req: ['shell7'], minStage: 3, fx: { def: 3, hp: 0.1, poise: 10 }, desc: '+3 defence, +10% health and sturdier footing.' },

  cur1: { branch: 'current', col: 0, row: 0, name: 'Swift Scuttle', cost: 1, req: [], fx: { speed: 0.10 }, desc: '+10% movement speed.' },
  cur2: { branch: 'current', col: 0, row: 1, name: 'Long Dash', cost: 1, req: ['cur1'], fx: { dashDist: 0.25 }, desc: 'Dash 25% further.' },
  cur3: { branch: 'current', col: 1, row: 1, name: 'Slipstream', cost: 1, req: ['cur1'], fx: { dashCd: -0.25 }, desc: 'Dash recovers 25% faster.' },
  cur4: { branch: 'current', col: 0, row: 2, name: 'Extra Stroke', cost: 2, req: ['cur2'], fx: { strokes: 1 }, desc: '+1 swim stroke before touching ground.' },
  cur5: { branch: 'current', col: 1, row: 2, name: 'Riptide', cost: 2, req: ['cur3'], minStage: 2, ability: 'riptide', desc: 'Unlocks Riptide: a piercing dash-slash.' },
  cur6: { branch: 'current', col: 0, row: 3, name: 'Phase Dash', cost: 2, req: ['cur4'], fx: { iframes: 0.4 }, desc: 'Dash invulnerability lasts 40% longer.' },
  cur7: { branch: 'current', col: 1, row: 3, name: 'Wave Rider', cost: 2, req: ['cur5'], fx: { currentResist: 0.5 }, desc: 'Currents push you 50% less.' },
  cur8: { branch: 'current', col: 0, row: 4, name: 'Tide Step', cost: 2, req: ['cur6'], minStage: 2, ability: 'tideStep', desc: 'Unlocks Tide Step: a short, untouchable blink that cuts what it passes.' },
  cur9: { branch: 'current', col: 1, row: 4, name: 'Razor Wake', cost: 3, req: ['cur7'], minStage: 3, fx: { dashStrike: 1 }, desc: 'Your dash cuts every foe it passes through.' },

  tide1: { branch: 'tide', col: 0, row: 0, name: 'Deep Lungs', cost: 1, req: [], fx: { tide: 0.2 }, desc: '+20% maximum Tide.' },
  tide2: { branch: 'tide', col: 0, row: 1, name: 'Bubble Spit', cost: 1, req: ['tide1'], ability: 'bubbleShot', desc: 'Unlocks Bubble Spit: a stunning projectile.' },
  tide3: { branch: 'tide', col: 1, row: 1, name: 'Tidal Flow', cost: 1, req: ['tide1'], fx: { tideRegen: 0.5 }, desc: 'Tide regenerates 50% faster.' },
  tide4: { branch: 'tide', col: 0, row: 2, name: 'Sand Kick', cost: 2, req: ['tide2'], ability: 'sandKick', desc: 'Unlocks Sand Kick: slows and weakens a cone of enemies.' },
  tide5: { branch: 'tide', col: 1, row: 2, name: 'Resonance', cost: 2, req: ['tide3'], fx: { abilityDmg: 0.25 }, desc: 'Abilities deal 25% more damage.' },
  tide6: { branch: 'tide', col: 0, row: 3, name: 'Echo Pool', cost: 2, req: ['tide4'], fx: { cooldown: -0.15 }, desc: 'Abilities recover 15% faster.' },
  tide7: { branch: 'tide', col: 1, row: 3, name: 'Ultimate Surge', cost: 3, req: ['tide5', 'tide6'], fx: { ultCharge: 0.5 }, desc: 'Your ultimate charges 50% faster.' },
  tide8: { branch: 'tide', col: 0, row: 4, name: 'Storm Call', cost: 2, req: ['tide6'], minStage: 2, ability: 'stormCall', desc: 'Unlocks Storm Call: lightning on up to four foes.' },
  tide9: { branch: 'tide', col: 1, row: 4, name: 'Overflow', cost: 3, req: ['tide7'], minStage: 3, fx: { abKillTide: 1 }, desc: 'Kills by abilities refund 14 Tide.' },
};
