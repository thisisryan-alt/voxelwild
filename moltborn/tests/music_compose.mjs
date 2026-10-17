// Composer sanity: every track yields a 16-bar song with in-range, in-time, non-empty parts. Prints a sample for review.
import { TRACKS } from '../src/audio/music.js';
import { compose, describe, noteName } from '../src/audio/compose.js';
let bad = 0;
for (const [id, def] of Object.entries(TRACKS)) {
  const song = compose(id, def); const probs = [];
  song.bars.forEach((b, i) => {
    for (const part of ['mel', 'arp', 'bass']) for (const e of b[part]) { if (!(e.s >= 0 && e.s < 16) || !Number.isFinite(e.m) || e.m < 24 || e.m > 100 || !(e.d > 0)) probs.push(`bar ${i} ${part} ${JSON.stringify(e)}`); }
    if (!b.mel.length) probs.push(`bar ${i} no melody`); if (b.chord.length < 3) probs.push(`bar ${i} thin chord`);
    // melody intervals: flag leaps over an octave inside a bar
    for (let k = 1; k < b.mel.length; k++) if (Math.abs(b.mel[k].m - b.mel[k - 1].m) > 12) probs.push(`bar ${i} leap ${b.mel[k - 1].m}->${b.mel[k].m}`);
  });
  const mel = song.bars.flatMap((b) => b.mel.map((e) => e.m)), lo = Math.min(...mel), hi = Math.max(...mel);
  console.log(`${id.padEnd(14)} bars ${song.bars.length} lead ${noteName(lo)}..${noteName(hi)} notes/bar ${(mel.length / song.bars.length).toFixed(1)}${probs.length ? '  PROBLEMS: ' + probs.slice(0, 3).join('; ') : ''}`);
  bad += probs.length;
}
if (process.argv[2]) console.log('\n' + describe(compose(process.argv[2], TRACKS[process.argv[2]])));
process.exit(bad ? 1 : 0);
