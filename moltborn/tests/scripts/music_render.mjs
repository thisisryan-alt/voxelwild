// Renders each track offline (12 s at a given intensity) and reports peak, RMS, band balance and silence/NaN problems.
export default async (page, H) => {
  await H.load('?manual=1'); await H.adv(10);
  const ids = (process.env.TRACKS || '').split(',').filter(Boolean);
  const out = await H.eval(async ([ids, inten, secs, layer]) => {
    const { Music, TRACKS } = await import('/src/audio/music.js');
    const res = [];
    for (const id of (ids.length ? ids : Object.keys(TRACKS))) {
      const sr = 32000, ctx = new OfflineAudioContext(2, sr * secs, sr), bus = ctx.createGain(); bus.connect(ctx.destination);
      const rev = ctx.createGain(); rev.gain.value = 0.3; rev.connect(bus);
      const m = new Music({}); m.init(ctx, bus, rev); m.dispose(); m.play(id);
      m.intensity = inten; m.target = inten; m.sec = 'A';
      m.applyLayers(); if (layer) for (const k of Object.keys(m.layerG)) if (k !== layer) m.layerG[k].gain.cancelScheduledValues(0), m.layerG[k].gain.value = 0;
      const spb = 60 / m.def.bpm / 4; let t = m.next, step = 0; while (t < secs - 0.2) { m.sched(step++, t); t += spb; }
      const buf = await ctx.startRendering(); const L = buf.getChannelData(0), R = buf.getChannelData(1);
      let peak = 0, sum = 0, nan = 0, clip = 0; for (let i = 0; i < L.length; i++) { const v = Math.max(Math.abs(L[i]), Math.abs(R[i])); if (!Number.isFinite(v)) nan++; if (v > peak) peak = v; if (v >= 0.99) clip++; sum += L[i] * L[i]; }
      // crude spectrum: energy below 250 Hz / 250-2000 / above 2000 from first-difference filters
      let lo = 0, mid = 0, hi = 0, a = 0, b = 0; for (let i = 1; i < L.length; i++) { a += 0.05 * (L[i] - a); b += 0.4 * (L[i] - b); const low = a, band = b - a, high = L[i] - b; lo += low * low; mid += band * band; hi += high * high; }
      const tot = lo + mid + hi || 1;
      // loudest-second vs quietest-second to check the groove is steady, and silent seconds
      const seg = []; for (let s0 = 1; s0 < secs - 1; s0++) { let e = 0; for (let i = s0 * sr; i < (s0 + 1) * sr; i++) e += L[i] * L[i]; seg.push(Math.sqrt(e / sr)); }
      res.push({ id, peak: +peak.toFixed(2), rms: +Math.sqrt(sum / L.length).toFixed(3), lo: +(lo / tot).toFixed(2), mid: +(mid / tot).toFixed(2), hi: +(hi / tot).toFixed(2), minSec: +Math.min(...seg).toFixed(3), maxSec: +Math.max(...seg).toFixed(3), nan, clip });
    }
    return res;
  }, [ids, +(process.env.INT || 0.5), +(process.env.SECS || 14), process.env.LAYER || '']);
  for (const r of out) console.log('[t]', JSON.stringify(r));
};
