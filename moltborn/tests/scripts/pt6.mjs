// Fresh-game real-key: level up via debug, spend skill, equip ability, then walk to garden shop etc.
export default async (page, H) => {
  await H.load('?manual=1');
  const tap = async (k, n = 3) => { await page.keyboard.down(k); await H.adv(n); await page.keyboard.up(k); await H.adv(3); };
  await H.eval(() => { const g = window.__game; g.giveXp(200); });
  await H.adv(30); await H.canvas('/tmp/pt/50_lvl.png');
  console.log('[t]', await H.eval(() => { const s = window.__game.state; return JSON.stringify({ lvl: s.level, sp: s.sp, ep: s.ep, form: s.form }); }));
  await tap('Tab'); await H.adv(10); await tap('KeyE'); await H.adv(10); await H.canvas('/tmp/pt/51_skills.png');
  await tap('Enter'); await H.adv(10); await H.canvas('/tmp/pt/52_bought.png');
  console.log('[t] skills', await H.eval(() => JSON.stringify(window.__game.state.skills)));
  await tap('KeyE'); await H.adv(10); await H.canvas('/tmp/pt/53_ability.png');
  await tap('KeyE'); await H.adv(10); await H.canvas('/tmp/pt/54_evolve.png');
};
