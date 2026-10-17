export default async (page, H) => {
  await H.load('?manual=1'); await H.adv(20);
  const arts = (process.env.ARTS || 'eggs,empty,dawn').split(',');
  for (const a of arts) for (const [k, fr] of [['a', 130], ['b', 400]]) {
    await H.eval(async ([a]) => { const g = window.__game; const m = await import('/src/ui/screens.js'); g.state.form = 'abyssal'; g.state.branches = { warrior: 'bulwark', abyssal: 'venom' }; while (g.engine.scenes.length > 1) g.engine.pop(); g.engine.push(new m.CutsceneScene(g, [{ art: a, text: 'Everyone else in your clutch is gone. Old Brine says you should stay small and hidden.', title: a === 'ocean' ? 'MOLTBORN' : undefined }], () => {})); }, [a]);
    await H.adv(fr); await H.canvas(`/tmp/cut_${a}_${k}.png`);
  }
};
