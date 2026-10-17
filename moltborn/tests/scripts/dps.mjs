// Idealised DPS: stand next to the boss, invulnerable, mash attack (and heavy) for 20 s.
export default async (page, H) => {
  const cfgs = [['reef_arena', 'shore', 6, 'claw1,claw2,claw3,shell1,shell2'], ['forest_heart', 'warrior', 8, 'claw1,claw2,claw3,claw4,shell1,shell2'], ['kingdom_court', 'abyssal', 11, 'claw1,claw2,claw3,claw4,claw5,shell1,shell2,shell3'], ['grave_captain', 'abyssal', 13, 'claw1,claw2,claw3,claw4,claw5,shell1,shell2,shell3,shell4'], ['abyss_throat', 'leviathan', 16, 'claw1,claw2,claw3,claw4,claw5,claw6,shell1,shell2,shell3,shell4'], ['trench_titan', 'leviathan', 18, 'claw1,claw2,claw3,claw4,claw5,claw6,claw7,shell1,shell2,shell3,shell4,shell5'], ['domain_halls', 'mythic', 21, 'claw1,claw2,claw3,claw4,claw5,claw6,claw7,shell1,shell2,shell3,shell4,shell5,shell6'], ['domain_throne', 'mythic', 24, 'claw1,claw2,claw3,claw4,claw5,claw6,claw7,shell1,shell2,shell3,shell4,shell5,shell6']];
  await H.load('?manual=1'); await H.adv(60);
  for (const [zone, form, lvl, sk] of cfgs) {
    const r = await H.eval(([zone, form, lvl, sk]) => {
      const g = window.__game, s = g.state; s.form = form; s.level = lvl; s.skills = Object.fromEntries(sk.split(',').map((k) => [k, true]));
      s.branches = { warrior: 'bulwark', abyssal: 'venom', leviathan: 'tideweaver' };
      g.buildWorld(zone, Object.keys(g.world.zone.entries)[0], { silentBanner: true }); const w = g.world, p = w.player; p.recalc(); const b = w.boss;
      const t = b.trigger; p.x = (t.x + t.w * 0.5) * 16; p.y = (t.y + t.h - 3) * 16; b.engage?.(); b.x = p.x + 40; b.y = p.y; p.stats.maxHp = 99999;
      const hp0 = b.hp; let done = 0; const inp = g.input;
      let f = 0; for (; f < 60 * 120; f += 5) {
        if (!b.alive || b.dying) break;
        p.invulnT = 5; p.hp = 99999; const hb = b.hurtBox(); p.x = hb.x - 14; p.y = Math.min(hb.y + hb.h - 6, hb.y + hb.h / 2); p.facing = 1; p.vx = p.vy = 0; b.armor = b.armor; 
        inp.inject('attack', (f / 5) % 3 !== 2); g.advance(5);
      }
      inp.inject('attack', false);
      const sec = f / 60; return { zone, form, lvl, atk: +p.stats.atk.toFixed(1), hp: b.maxHp, secs: +sec.toFixed(0), dps: +((hp0 - Math.max(0, b.hp)) / sec).toFixed(1), left: Math.round(b.hp) };
    }, [zone, form, lvl, sk]);
    console.log('[t]', JSON.stringify(r));
  }
};
