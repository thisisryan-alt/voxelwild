// The sounds added for fishing, selling, bounties, the tide clock and surges: every recipe plays without an exception and the
// events that should trigger them do. Run: node tools/run.mjs tests/scripts/audio3.mjs
export default async (page, H) => {
  await H.load('?manual=1'); await H.adv(20);
  const r = await H.eval(async () => {
    const g = window.__game, a = g.audio; a.unlock(); await new Promise((res) => setTimeout(res, 100));
    const out = { played: [], errs: [], viaEvents: [] };
    window.addEventListener('error', (e) => out.errs.push(e.message));
    const names = ['cast', 'nibble', 'bite', 'reel_tick', 'line_snap', 'catch', 'sell', 'bounty', 'streak', 'hour_dawn', 'hour_dusk', 'hour_night', 'surge_warn', 'surge_rush', 'flotsam'];
    for (const n of names) { a.last = {}; try { a.sfx(n, { k: 0.5, big: n === 'catch' }); out.played.push(n); } catch (e) { out.errs.push(n + ': ' + e.message); } }
    // events reach the right recipes
    const real = a.sfx.bind(a), heard = []; a.sfx = (n, o) => { heard.push(n); return real(n, o); };
    const ev = g.events; ev.emit('fish', 'silverfin', 20, { fresh: true }); ev.emit('sold', 'fish_silverfin', 1, 12); ev.emit('bounty', {}); ev.emit('bountyboard', 3); ev.emit('phase', 'night'); ev.emit('phase', 'dusk'); ev.emit('phase', 'day'); ev.emit('surge', 'warn'); ev.emit('surge', 'rush'); ev.emit('surge', 'calm');
    a.sfx = real; out.viaEvents = heard;
    return out;
  });
  console.log('[t]', JSON.stringify(r));
  if (r.errs.length || r.played.length !== 15) process.exitCode = 1;
};
