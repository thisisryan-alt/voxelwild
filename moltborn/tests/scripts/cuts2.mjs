export default async (page, H) => {
  await H.load('?manual=1'); await H.adv(20);
  const arts = (process.env.ARTS || 'forest,kingdom,graveyard,abyss,trench,domain,boss:grumbold,boss:mother_moray,boss:aurelia,boss:captain_rust,boss:lurelord,boss:krael,boss:kyros,boss:hollow_maw,form:warrior,form:abyssal,form:leviathan,form:mythic,form:primordial').split(',');
  for (const a of arts) {
    await H.eval(async ([a]) => { const g = window.__game; const m = await import('/src/ui/screens.js'); g.state.form = 'abyssal'; g.state.branches = { warrior: 'bulwark', abyssal: 'venom', leviathan: 'tideweaver' }; while (g.engine.scenes.length > 1) g.engine.pop(); g.engine.push(new m.CutsceneScene(g, [{ art: a, text: 'The sea has been quiet since. Quiet like a held breath.' }], () => {})); }, [a]);
    await H.adv(200); await H.canvas(`/tmp/cs_${a.replace(':', '_')}.png`);
  }
};
