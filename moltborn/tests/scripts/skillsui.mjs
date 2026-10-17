// Screenshot of the skill tree (all nodes learned in one branch pair, cursor on the new row).
export default async (page, H) => {
  await H.load('?manual=1'); await H.adv(30);
  await H.eval(() => { const g = window.__game, s = g.state; s.form = 'warrior'; s.branches = { warrior: 'bulwark' }; s.level = 30; s.sp = 12; for (const k of ['claw1', 'claw2', 'claw3', 'claw5', 'claw4', 'claw6', 'tide1', 'tide2', 'tide3']) s.skills[k] = true; g.world.player.recalc(); g.openMenu('SKILLS'); });
  await H.adv(10);
  await H.eval(() => { const g = window.__game, m = g.engine.top; m.sel.SKILLS = { i: 1, j: 4, sub: 0, scroll: 0 }; });
  await H.adv(6);
  await H.canvas('/tmp/claude-0/cs/skills.png');
};
