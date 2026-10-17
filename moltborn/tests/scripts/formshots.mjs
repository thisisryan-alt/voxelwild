// In-game screenshots of every hero form: Z=zone E=entry (defaults reef_garden/west)  ->  /tmp/fs_<form>.png
export default async (page, H) => {
  await H.load('?manual=1'); await H.adv(10);
  const forms = [['shore', {}], ['warrior', { warrior: 'bulwark' }], ['abyssal', { warrior: 'bulwark', abyssal: 'venom' }], ['leviathan', { warrior: 'bulwark', abyssal: 'venom', leviathan: 'tidebreaker' }], ['mythic', { warrior: 'bulwark', abyssal: 'venom', leviathan: 'tideweaver' }], ['primordial', {}]];
  const z = process.env.Z || 'reef_garden', e = process.env.E || 'west';
  for (const [f, br] of forms) {
    await H.eval(([f, br, z, e]) => { const g = window.__game, s = g.state; s.form = f; s.branches = br; s.level = 12; g.buildWorld(z, e, { silentBanner: true }); const p = g.world.player; p.recalc(); p.hp = p.stats.maxHp; p.x += 60; g.world.snapCamera(); }, [f, br, z, e]);
    await H.adv(80); await H.canvas(`/tmp/fs_${f}.png`);
  }
};
