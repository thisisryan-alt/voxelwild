export default async (page, H) => {
  await H.load('?manual=1'); await H.adv(10);
  const forms = [['shore', {}], ['warrior', { warrior: 'bulwark' }], ['abyssal', { warrior: 'bulwark', abyssal: 'venom' }], ['leviathan', { warrior: 'bulwark', abyssal: 'venom', leviathan: 'tidebreaker' }], ['mythic', { warrior: 'bulwark', abyssal: 'venom', leviathan: 'tideweaver' }], ['primordial', {}]];
  for (const [f, br] of forms) {
    await H.eval(([f, br]) => { const g = window.__game, s = g.state; s.form = f; s.branches = br; s.level = 12; g.buildWorld('reef_garden', 'west', { silentBanner: true }); const p = g.world.player; p.recalc(); p.x += 60; g.world.snapCamera(); }, [f, br]);
    await H.adv(80); await H.canvas(`/tmp/fs_${f}.png`);
  }
};
