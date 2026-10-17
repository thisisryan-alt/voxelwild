// Verifies WebAudio code paths run (no exceptions) for every SFX and track, using an OfflineAudioContext-free headless run.
export default async (page, H) => {
  await H.load('?manual=1');
  const r = await H.eval(async () => {
    const g = window.__game, a = g.audio; a.unlock(); await new Promise((r) => setTimeout(r, 100));
    const out = { state: a.ctx && a.ctx.state, sfx: 0, tracks: 0, errs: [] };
    const { TRACKS } = await import('/src/audio/music.js');
    window.addEventListener('error', (e) => out.errs.push(e.message));
    const names = ['hit','crit','heavyhit','claw','heavy','swoosh','dash','stroke','alert','hurt','clang','parry','riposte','die','bossdie','death','boom','slam','shoot','spore','spit','cannon','zap','charge','charged','deny','sand','beam','whirl','wave','slack','ult','revive','pressure','chest','unlock','rockbreak','coin','pickup','item','levelup','tick','select','back','talk','save','rest','evolve','evolve_burst','bosswarn','roar','thunder','gong'];
    for (const n of names) { a.last = {}; a.sfx(n, { x: g.world.player.x, y: g.world.player.y }); out.sfx++; }
    for (const id of Object.keys(TRACKS)) { a.music.play(id); a.music.setIntensity(0.8); for (let i = 0; i < 40; i++) { a.music.tick(); a.music.next = 0; } out.tracks++; }
    for (const k of ['shallows','forest','kingdom','wrecks','abyss','trench','domain']) a.ambience(k);
    return out;
  });
  console.log('[t]', JSON.stringify(r));
};
