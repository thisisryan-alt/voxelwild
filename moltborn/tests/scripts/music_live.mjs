// Plays several tracks in real time (autoplay allowed) and reports scheduler errors via console warnings.
export default async (page, H) => {
  await H.load('?quick=1');
  const ids = ['reef', 'boss1', 'abyss', 'kingdom', 'boss_final', 'credits'];
  for (const id of ids) {
    await H.eval((id) => { const a = window.__game.audio; a.unlock(); a.music.play(id); }, id);
    await page.waitForTimeout(2500);
    const r = await H.eval(() => { const m = window.__game.audio.music; return { id: m.id, step: m.step, state: m.ctx.state, sec: m.sec }; });
    console.log('[t]', JSON.stringify(r));
  }
  await H.eval(() => window.__game.audio.music.stinger('victory')); await page.waitForTimeout(500);
};
