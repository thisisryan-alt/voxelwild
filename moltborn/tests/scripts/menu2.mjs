// Menu extras: equipment comparison, set info, skill reset, map completion and travel. OUT prefix.
export default async (page, H) => {
  const out = process.env.OUT || '/tmp/m2';
  await H.load('?manual=1'); await H.adv(30);
  await H.eval(() => {
    const g = window.__game, s = g.state; s.form = 'warrior'; s.level = 14; s.coins = 900; s.sp = 0; s.skills = { tide1: true }; s.visited = { reef_nursery: true, reef_garden: true, reef_hollow: true };
    for (const id of ['shell_cinder', 'claw_cinder', 'charm_emberglass', 'shell_pearl', 'claw_coral']) g.addItem(id, 1); s.equip = { shell: 'shell_driftwood', claw: 'claw_cinder', charm: null };
    g.world.player.recalc(); g.openMenu('items'); const m = g.engine.top; m.sel.ITEMS.sub = 1; m.sel.ITEMS.i = 0;
  });
  await H.adv(4);
  const find = await H.eval(() => { const m = window.__game.engine.top, list = m.itemList(1); return list; }); console.log('[t] gear', JSON.stringify(find));
  await H.eval((id) => { const m = window.__game.engine.top; m.sel.ITEMS.i = m.itemList(1).indexOf(id); }, 'shell_cinder'); await H.adv(3); await H.canvas(`${out}_cmp.png`);
  // respec
  const rs = await H.eval(() => { const g = window.__game, s = g.state, m = g.engine.top; const { respec, respecCost } = window.__prog || {}; return { sp: s.sp, skills: Object.keys(s.skills).length }; });
  console.log('[t] before respec', JSON.stringify(rs));
  const rs2 = await H.eval(async () => { const g = window.__game, s = g.state; const { respec, respecCost } = await import('/src/systems/progression.js'); const cost = respecCost(s), c0 = s.coins; const ok = respec(s); return { cost, ok, sp: s.sp, skills: Object.keys(s.skills).length, coins: c0 - s.coins }; });
  console.log('[t] respec', JSON.stringify(rs2));
  await H.eval(() => { const g = window.__game; g.engine.pop(); g.openMenu('map'); g.engine.top.sel.MAP.i = 1; }); await H.adv(4); await H.canvas(`${out}_map.png`);
};
