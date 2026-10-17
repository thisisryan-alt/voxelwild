// Idealised DPS against one boss: ZONE, FORM, LEVEL, SKILLS, SECS. Player invulnerable, next to the boss, mashing attack.
export default async (page, H) => {
  const zone = process.env.ZONE, form = process.env.FORM || 'warrior', lvl = +(process.env.LEVEL || 10), sk = (process.env.SKILLS || 'claw1,claw2,claw3,claw4,shell1,shell2').split(','), secs = +(process.env.SECS || 30);
  await H.load('?manual=1'); await H.adv(60);
  const r = await H.eval(([zone, form, lvl, sk, secs]) => {
    const g = window.__game, s = g.state; s.form = form; s.level = lvl; s.skills = Object.fromEntries(sk.map((k) => [k, true])); s.branches = { warrior: 'bulwark', abyssal: 'venom', leviathan: 'tideweaver' };
    g.buildWorld(zone, undefined, { silentBanner: true }); g.systems.story.queue.length = 0; const w = g.world, p = w.player; p.recalc(); const b = w.boss;
    const t = b.trigger; p.x = (t.x + t.w * 0.5) * 16; p.y = (t.y + t.h - 3) * 16; b.engage?.(); b.x = p.x + 40; p.stats.maxHp = 99999; p.hp = 99999;
    for (let k = 0; k < 400 && g.playScene.dialogue?.active; k++) { g.input.inject('confirm', true); g.advance(1); g.input.inject('confirm', false); g.advance(2); }
    const hp0 = b.hp, inp = g.input; let f = 0;
    for (; f < 60 * secs && b.alive && !b.dying; f += 5) {
      p.invulnT = 99; const dx = b.x - p.x; for (const k of ['left', 'right', 'attack', 'heavy']) inp.inject(k, false);
      inp.inject(dx < -30 ? 'left' : dx > 30 ? 'right' : '', true); p.facing = dx >= 0 ? 1 : -1; inp.inject('attack', Math.floor(f / 5) % 2 === 0); g.advance(5);
      if (b.staggerT > 0 || b.pose === 'hide') p.hp = 99999;
    }
    return { zone, form, lvl, atk: +p.stats.atk.toFixed(1), hp0, left: Math.round(b.hp), secs: +(f / 60).toFixed(1), dps: +((hp0 - b.hp) / (f / 60)).toFixed(1) };
  }, [zone, form, lvl, sk, secs]);
  console.log('[t]', JSON.stringify(r));
};
