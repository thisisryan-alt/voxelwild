export default async (page, H) => {
  await H.load('?manual=1');
  const G = (fn, a) => H.eval(fn, a);
  const to = process.env.TO || 'warrior', br = process.env.BR || 'bulwark';
  await H.adv(120);
  await G(([to, br]) => { const g = window.__game; g.buildWorld('reef_nursery', 'start', {}); g.state.level = 20; g.state.ep = 99; for (const k of ['brine_core', 'abyssal_core', 'titan_heart', 'tide_sigil']) g.state.inv[k] = 1; if (to === 'abyssal') { g.state.form = 'warrior'; g.state.branches.warrior = 'bulwark'; } if (to === 'leviathan') { g.state.form = 'abyssal'; g.state.branches = { warrior: 'bulwark', abyssal: 'venom' }; } if (to === 'mythic') { g.state.form = 'leviathan'; g.state.branches = { warrior: 'bulwark', abyssal: 'venom', leviathan: 'tideweaver' }; } g.world.player.recalc(); import('/src/ui/evolve_scene.js').then((m) => { g.engine.push(new m.EvolveScene(g, to, br === 'none' ? null : br)); }); }, [to, br]);
  await H.adv(2);
  let t = 0; for (const [name, until] of [['a', 1.0], ['b', 2.4], ['c', 3.15], ['d', 3.5], ['e', 4.4], ['f', 6.0]]) { const n = Math.round((until - t) * 60); await H.adv(n); t = until; await H.canvas(`/tmp/ev_${name}.png`); }
};
