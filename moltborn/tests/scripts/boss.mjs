// Boss soak test: ZONE=forest_heart node tools/run.mjs tests/scripts/boss.mjs  (optional FORM, FRAMES, SHOTS)
export default async (page, H) => {
  const zone = process.env.ZONE, form = process.env.FORM || 'warrior', frames = +(process.env.FRAMES || 2400);
  await H.load('?manual=1');
  const G = (fn, a) => H.eval(fn, a);
  await H.adv(100);
  await G(([zone, form]) => {
    const g = window.__game, s = g.state;
    const chain = { warrior: ['bulwark'], abyssal: ['bulwark', 'venom'], leviathan: ['bulwark', 'venom', 'tideweaver'], mythic: ['bulwark', 'venom', 'tideweaver'] }[form];
    s.form = form; s.level = { shore: 3, warrior: 8, abyssal: 14, leviathan: 20, mythic: 26 }[form] || 8; s.sp = 0;
    if (chain) { s.branches = {}; ['warrior', 'abyssal', 'leviathan'].slice(0, chain.length).forEach((f, i) => { s.branches[f] = chain[i]; }); }
    s.abilities = ['bubbleShot']; s.slots = ['bubbleShot', null, null]; g.buildWorld(zone, Object.keys(g.world.zone.entries)[0], { silentBanner: true }); const p = g.world.player; p.recalc(); p.hp = p.stats.maxHp; p.tide = p.stats.maxTide;
  }, [zone, form]);
  const info = () => G(() => { const w = window.__game.world, b = w.boss; return b ? { hp: Math.round(b.hp), eng: b.engaged, ph: b.phaseIdx, atk: b.lastAtk, stg: Math.round(b.staggerT * 10) / 10, php: Math.round(w.player.hp), mx: w.player.stats.maxHp, dead: b.dying } : null; });
  await G(() => { const w = window.__game.world, b = w.boss; const a = b.arena; const p = w.player; const t = b.trigger; p.x = (t.x + t.w * 0.5) * 16; p.y = (t.y + t.h - 3) * 16; w.snapCamera(); });
  if (process.env.HPFRAC) await G((f) => { const b = window.__game.world.boss; b.engage(); b.hp = b.maxHp * f; b.checkPhase?.(); }, +process.env.HPFRAC);
  let last = '';
  for (let f = 0; f < frames; f += 20) {
    await G(() => {
      const g = window.__game, w = g.world, b = w.boss, p = w.player, inp = g.input; if (!b || !b.alive) return;
      if (g.playScene.dialogue.active) { inp.inject('confirm', true); g.advance(1); inp.inject('confirm', false); g.advance(1); return; }
      p.tide = p.stats.maxTide; p.fury = Math.min(100, p.fury + 1);
      const dx = b.x - p.x, dy = b.y - p.y; inp.inject('left', dx < -30); inp.inject('right', dx > 30); inp.inject('up', dy < -20); inp.inject('down', dy > 20);
      inp.inject('attack', Math.abs(dx) < 70 && Math.abs(dy) < 50 && (g.engine.time * 10 | 0) % 2 === 0);
      inp.inject('block', false);
      if (p.hp < p.stats.maxHp * 0.3) p.hp = p.stats.maxHp * 0.6;
      g.advance(20); for (const k of ['left', 'right', 'up', 'down', 'attack']) inp.inject(k, false);
    });
    const i = await info(); const j = JSON.stringify(i); if (j !== last && f % 100 === 0) { console.log('[t]', f, j); last = j; }
    if (process.env.SHOTS && f % 400 === 0) await H.canvas(`/tmp/boss_${zone}_${f}.png`);
    if (!i || i.dead) break;
  }
  console.log('[t] final', JSON.stringify(await info()), JSON.stringify(await G(() => ({ bosses: window.__game.state.bosses, top: window.__game.engine.top.constructor.name }))));
};
