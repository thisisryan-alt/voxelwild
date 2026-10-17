// Active abilities and ultimates. cast(p, w) runs when the player triggers one; p is the Player, w the World.
// Damage helpers scale with the player's attack and ability bonuses.
const dir = (p) => p.facing;
const hb = (w, p, o) => w.spawnHitbox({ team: 'player', owner: p, ability: true, ...o });
// the player's body is bigger than a point: a spot is free when its centre and four corners are open water
const fits = (w, p, x, y) => [[0, 0], [-1, -1], [1, -1], [-1, 1], [1, 1]].every(([a, b]) => !w.grid.solidPx(x + a * p.w * 0.4, y + b * p.h * 0.4));

export const ABILITIES = {
  bubbleShot: { name: 'Bubble Spit', icon: 'bubble', cost: 8, cd: 0.7, time: 0.28, anim: 'cast', desc: 'Spit a stunning bubble. Cheap, quick and good at range.',
    cast(p, w) { w.addProjectile({ kind: 'bubble', team: 'player', x: p.x + dir(p) * (p.w / 2 + 4), y: p.y - 2, vx: dir(p) * 190, vy: 0, dmg: p.abDmg(1.1), life: 1.2, stun: 0.5, poise: 14, kb: 60 }); w.fx.bubble(p.x + dir(p) * 10, p.y, 4, 4, -10); p.sfx('spit'); } },
  sandKick: { name: 'Sand Kick', icon: 'sand', cost: 12, cd: 2.2, time: 0.3, anim: 'cast', desc: 'Kick up a blinding cloud: foes are slowed and weakened.',
    cast(p, w) {
      const x = p.x + dir(p) * (p.w / 2 + 22);
      hb(w, p, { x: x - 26, y: p.y - 16, w: 52, h: 32, dmg: p.abDmg(0.5), life: 0.14, kb: 60, poise: 8, status: { slow: 3, weak: 4 }, stop: 2 });
      for (let i = 0; i < 26; i++) w.fx.add({ x: p.x + dir(p) * 10, y: p.y + 4, vx: dir(p) * (40 + Math.random() * 80), vy: (Math.random() - 0.5) * 50, life: 0.5, size: 2, color: ['#f6d9a6', '#e8c690', '#fff2d4'][i % 3], drag: 3, shrink: true });
      p.sfx('sand');
    } },
  riptide: { name: 'Riptide', icon: 'dash', cost: 14, cd: 2.4, time: 0.3, anim: 'dash', desc: 'Surge through enemies in a piercing slash.',
    cast(p, w) {
      p.dashAttack = { dmg: p.abDmg(1.8), t: 0.3 }; p.startDash(true, 1.5);
    } },
  shellSlam: { name: 'Shell Slam', icon: 'shell', cost: 16, cd: 3.5, time: 0.5, anim: 'heavy', desc: 'Bulwark: slam your plating down — a shock that breaks guards.',
    cast(p, w) {
      p.vy = 40; hb(w, p, { x: p.x - 44, y: p.y - 20, w: 88, h: 40, dmg: p.abDmg(2.4), life: 0.16, kb: 220, poise: 60, guardBreak: true, stop: 6, shake: 4, heavy: true, breaks: true });
      w.fx.ring(p.x, p.y + p.h / 2, 4, 60, 0.3, '#a8d8ff', 2); w.fx.burst(p.x, p.y + p.h / 2, ['#a8d8ff', '#ffffff'], 100, 0.4, 3); p.sfx('slam');
    } },
  riposte: { name: 'Riposte', icon: 'blade', cost: 14, cd: 3, time: 0.15, anim: 'block', desc: 'Duelist: a counter stance. If struck, you flash through the attacker and punish.',
    cast(p, w) { p.counterT = 0.8; w.fx.ring(p.x, p.y, 3, 24, 0.3, '#ff90a8'); p.sfx('riposte'); } },
  venomSpines: { name: 'Venom Spines', icon: 'spine', cost: 12, cd: 1.6, time: 0.3, anim: 'cast', desc: 'Venom Stalker: loose a fan of poison barbs.',
    cast(p, w) { for (let i = -1; i <= 1; i++) w.addProjectile({ kind: 'dart', team: 'player', x: p.x + dir(p) * 10, y: p.y + i * 3, vx: dir(p) * 200, vy: i * 26, dmg: p.abDmg(0.9), life: 0.9, status: { poison: 3 }, poise: 4, kb: 40 }); p.sfx('spit'); } },
  lumenBeam: { name: 'Lumen Beam', icon: 'beam', cost: 22, cd: 3.2, time: 0.45, anim: 'cast', desc: 'Lumen Hunter: a piercing line of light that burns shadow.',
    cast(p, w) {
      const L = 180, x = dir(p) > 0 ? p.x + 6 : p.x - 6 - L;
      hb(w, p, { x, y: p.y - 9, w: L, h: 18, dmg: p.abDmg(2.2), life: 0.3, kb: 90, poise: 20, stop: 3, pierce: true, multi: true, interval: 0.1 });
      w.addBeam({ x: p.x + dir(p) * 6, y: p.y, dir: dir(p), len: L, life: 0.3, color: '#d0ffff' }); p.sfx('beam'); w.shake(2);
    } },
  quake: { name: 'Seabed Quake', icon: 'quake', cost: 24, cd: 4, time: 0.55, anim: 'heavy', desc: 'Tidebreaker: split the seabed; shockwaves race out both ways.',
    cast(p, w) {
      for (const d of [-1, 1]) w.addProjectile({ kind: 'shard', team: 'player', x: p.x + d * 16, y: p.y + p.h / 2 - 8, vx: d * 150, vy: 0, dmg: p.abDmg(2.6), life: 1.1, pierce: true, poise: 40, kb: 200, ghost: true, trail: '#a8d8ff' });
      w.shake(6); w.fx.ring(p.x, p.y + p.h / 2, 4, 90, 0.35, '#ffe0a0', 3); p.sfx('slam'); w.breakAround(p.x, p.y + p.h / 2, 40, p.form.stage >= 4 ? 'seal' : 'crack');
    } },
  maelstrom: { name: 'Maelstrom', icon: 'whirl', cost: 26, cd: 5, time: 0.45, anim: 'cast', desc: 'Tideweaver: conjure a whirlpool that drags foes in and shreds them.',
    cast(p, w) { w.addField({ kind: 'whirl', x: p.x + dir(p) * 70, y: p.y, r: 54, life: 3.2, dps: p.abDmg(0.9), pull: 90, team: 'player' }); p.sfx('whirl'); } },
  tidalWave: { name: 'Tidal Wave', icon: 'wave', cost: 28, cd: 4, time: 0.5, anim: 'cast', desc: 'Raise a crushing wave that sweeps the field.',
    cast(p, w) { w.addProjectile({ kind: 'water', team: 'player', x: p.x + dir(p) * 20, y: p.y, w: 20, h: 54, vx: dir(p) * 150, vy: 0, dmg: p.abDmg(3), life: 2.2, pierce: true, poise: 50, kb: 260, scale: 2.4, ghost: true, trail: '#9af0ff' }); w.shake(3); p.sfx('wave'); } },
  slackTide: { name: 'Slack Tide', icon: 'clock', cost: 30, cd: 12, time: 0.4, anim: 'cast', desc: 'Stall the tide: everything but you moves at a third of speed for 4 seconds.',
    cast(p, w) { w.slowT = 4; w.slowFactor = 0.33; w.fx.ring(p.x, p.y, 4, 160, 0.6, '#a0f0ff', 2); p.sfx('slack'); } },
  pearlStorm: { name: 'Pearl Storm', icon: 'pearl', cost: 24, cd: 5, time: 0.4, anim: 'cast', desc: 'Loose a burst of homing pearls.',
    cast(p, w) { for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; w.addProjectile({ kind: 'pearl', team: 'player', x: p.x, y: p.y, vx: Math.cos(a) * 110, vy: Math.sin(a) * 110, dmg: p.abDmg(1.4), life: 2.2, homing: 5, poise: 8, kb: 70 }); } p.sfx('spit'); } },
  crescent: { name: 'Crescent Wave', icon: 'blade', cost: 14, cd: 2.2, time: 0.32, anim: 'attack3', desc: 'Carve a wave of force that races ahead and pierces everything in its path.',
    cast(p, w) {
      const col = p.fxColor(); w.fx.slash(p.x + dir(p) * 6, p.y, dir(p), 26, col, { life: 0.22, th: 9, arc: 1.25, tilt: -0.3 });
      w.addProjectile({ kind: 'crescent', team: 'player', x: p.x + dir(p) * 22, y: p.y, vx: dir(p) * 230, vy: 0, dmg: p.abDmg(1.7), life: 0.95, pierce: true, poise: 26, kb: 150, trail: col });
      p.sfx('heavy'); w.kickCam(dir(p) * 2, 0);
    } },
  aegis: { name: 'Aegis Bubble', icon: 'shell', cost: 18, cd: 10, time: 0.35, anim: 'block', desc: 'Wrap yourself in a pearl-bright bubble that swallows the next three blows.',
    cast(p, w) { p.aegis = 3; p.aegisT = 9; w.fx.ring(p.x, p.y, 6, 36, 0.4, '#c8f0ff', 3); w.fx.burst(p.x, p.y, ['#ffffff', '#c8f0ff'], 70, 0.4, 2); p.sfx('revive'); } },
  tideStep: { name: 'Tide Step', icon: 'dash', cost: 12, cd: 3, time: 0.2, anim: 'dash', desc: 'Vanish in a rush of foam and reappear up to 96 units away. Foes you pass are cut, and you cannot be touched for an instant.',
    cast(p, w) {
      const inp = p.game.input; let dx = inp.axisX() || p.facing, dy = p.free ? inp.axisY() : 0; const n = Math.hypot(dx, dy) || 1; dx /= n; dy /= n;
      let d = 0; while (d < 96 && fits(w, p, p.x + dx * (d + 4), p.y + dy * (d + 4))) d += 4;
      const x0 = p.x, y0 = p.y, col = p.fxColor();
      for (let i = 0; i <= d; i += 6) { w.fx.burst(x0 + dx * i, y0 + dy * i, ['#ffffff', col], 6, 0.35, 2); }
      w.fx.ring(x0, y0, 3, 26, 0.3, col, 2);
      hb(w, p, { x: Math.min(x0, x0 + dx * d) - p.w / 2, y: Math.min(y0, y0 + dy * d) - p.h / 2, w: Math.abs(dx * d) + p.w, h: Math.abs(dy * d) + p.h, dmg: p.abDmg(1.1), life: 0.1, kb: 120, poise: 20, stop: 3, pierce: true });
      p.x = x0 + dx * d; p.y = y0 + dy * d; p.vx = dx * 60; p.vy = dy * 60; p.invulnT = Math.max(p.invulnT, 0.5);
      w.fx.ring(p.x, p.y, 3, 26, 0.3, col, 2); p.sfx('dash'); w.kickCam(dx * 3, dy * 3);
    } },
  stormCall: { name: 'Storm Call', icon: 'beam', cost: 26, cd: 6, time: 0.5, anim: 'cast', desc: 'Call lightning down on up to four nearby foes. Stunned targets take double.',
    cast(p, w) {
      const list = w.enemies.filter((e) => e.alive && e.canBeHit() && Math.hypot(e.x - p.x, e.y - p.y) < 230).sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y)).slice(0, 4);
      if (!list.length) { const x = p.x + dir(p) * 70; w.fx.bolt(x + 6, p.y - 150, x, p.y, '#bfe8ff'); hb(w, p, { x: x - 14, y: p.y - 20, w: 28, h: 40, dmg: p.abDmg(1.4), life: 0.1, kb: 80, poise: 20, stop: 3 }); }
      for (const e of list) {
        w.fx.bolt(e.x + (Math.random() - 0.5) * 10, e.y - 150, e.x, e.y, '#bfe8ff');
        e.takeHit({ dmg: p.abDmg(2.0) * (e.stunT > 0 ? 2 : 1), dir: Math.sign(e.x - p.x) || 1, kb: 60, poise: 40, stop: 4, shake: 3, stun: 0.5, fromAbility: true, crit: e.stunT > 0 }, p);
      }
      w.flash = Math.max(w.flash, 0.08); w.shake(3); p.sfx('zap');
    } },
  tailLash: { name: 'Tail Lash', icon: 'tail', cost: 14, cd: 2.5, time: 0.4, anim: 'attack3', desc: 'A whip of the telson in a full circle.',
    cast(p, w) { hb(w, p, { x: p.x - 66, y: p.y - 30, w: 132, h: 60, dmg: p.abDmg(2), life: 0.18, kb: 240, poise: 40, stop: 5, shake: 3, heavy: true }); w.fx.ring(p.x, p.y, 10, 70, 0.25, '#ffffff', 2); p.sfx('slam'); } },
};

export const ULTS = {
  shore: { name: 'Molt Burst', cast(p, w) { p.invulnT = Math.max(p.invulnT, 0.6); hb(w, p, { x: p.x - 70, y: p.y - 60, w: 140, h: 120, dmg: p.abDmg(3), life: 0.2, kb: 200, poise: 60, status: { stun: 1.2 }, stop: 8, shake: 5 }); w.fx.ring(p.x, p.y, 4, 80, 0.45, '#ffd8a0', 3); w.fx.burst(p.x, p.y, ['#ffb070', '#ffffff'], 200, 0.5, 3); p.heal(Math.round(p.stats.maxHp * 0.15)); p.sfx('ult'); }, time: 0.6 },
  warrior: { name: 'Shatter Shell', cast(p, w) { p.invulnT = Math.max(p.invulnT, 1.0); p.spin = { t: 0.9, next: 0 }; p.sfx('ult'); w.shake(3); }, time: 0.9 },
  abyssal: { name: 'Abyssal Maw', cast(p, w) { w.addField({ kind: 'maw', x: p.x + p.facing * 80, y: p.y, r: 66, life: 2.4, dps: p.abDmg(1.4), pull: 140, team: 'player' }); w.shake(4); w.fx.ring(p.x, p.y, 8, 120, 0.5, '#7a62c8', 3); p.sfx('ult'); p.invulnT = Math.max(p.invulnT, 0.6); }, time: 0.7 },
  leviathan: { name: 'Leviathan Cataclysm', cast(p, w) { p.invulnT = Math.max(p.invulnT, 1.2); w.cataclysm(p, 6); w.shake(10); w.fx.ring(p.x, p.y, 10, 260, 0.7, '#ffe0a0', 4); p.sfx('ult'); }, time: 0.9 },
  mythic: { name: 'The Last Tide', cast(p, w) { p.invulnT = Math.max(p.invulnT, 1.2); for (const d of [-1, 1]) w.addProjectile({ kind: 'water', team: 'player', x: p.x + d * 24, y: p.y, w: 30, h: 120, vx: d * 240, vy: 0, dmg: p.abDmg(8), life: 2.4, pierce: true, poise: 160, kb: 300, scale: 4, ghost: true, trail: '#9af0ff' }); p.surge = 6; w.shake(8); w.fx.ring(p.x, p.y, 10, 240, 0.7, '#9af0ff', 4); p.sfx('ult'); }, time: 1.0 },
  primordial: { name: 'First Tide', cast(p, w) { p.invulnT = Math.max(p.invulnT, 1.6); for (const d of [-1, 1]) w.addProjectile({ kind: 'water', team: 'player', x: p.x + d * 24, y: p.y, w: 34, h: 140, vx: d * 260, vy: 0, dmg: p.abDmg(10), life: 2.6, pierce: true, poise: 200, kb: 320, scale: 4.6, ghost: true, trail: '#ffffff' }); p.surge = 8; p.heal(Math.round(p.stats.maxHp * 0.25)); w.shake(9); w.fx.ring(p.x, p.y, 10, 280, 0.8, '#ffffff', 4); p.sfx('ult'); }, time: 1.0 },
};
