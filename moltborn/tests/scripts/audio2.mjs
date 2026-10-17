export default async (page, H) => {
  await H.load('?manual=1');
  await H.eval(() => { const g = window.__game, a = g.audio; a.unlock(); window.__an = a.ctx.createAnalyser(); window.__an.fftSize = 2048; a.master.connect(window.__an); a.music.play('boss_final'); a.sfx('hit'); });
  await page.waitForTimeout(3500);
  const r = await H.eval(() => { const an = window.__an, d = new Float32Array(an.fftSize); an.getFloatTimeDomainData(d); let s = 0, pk = 0; for (const v of d) { s += v * v; pk = Math.max(pk, Math.abs(v)); } return { rms: Math.sqrt(s / d.length), peak: pk, state: window.__game.audio.ctx.state, step: window.__game.audio.music.step }; });
  console.log('[t]', JSON.stringify(r));
};
