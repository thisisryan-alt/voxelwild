export default async (page, H) => {
  await H.load('?manual=1'); await H.adv(30);
  for (const id of ['abyss_descent', 'trench_bones']) for (const dm of [0, 1]) {
    await H.eval(async ([id, dm]) => { const g = window.__game; const { buildZone } = await import('/src/data/zones.js'); const z = buildZone(id); g.buildWorld(id, Object.keys(z.entries)[0], { silentBanner: true }); g.world.darkMul = dm; const p = g.world.player; p.stats.maxHp = 999; p.hp = 999; g.state.level = 12; }, [id, dm]);
    await H.adv(120); await H.canvas(`/tmp/lit_${id}_${dm}.png`);
  }
};
