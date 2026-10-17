// Boss body plans (large, hand-composed from painter primitives). Registered into PLANS for enemyFrame().
import { PLANS } from './sprites_enemies.js';
import { claw, legsPose, eye } from './sprites_player.js';
import { Ramp } from './painter.js';
import { R } from './palette.js';

const TAU = Math.PI * 2, sin = Math.sin, cos = Math.cos;
const ROCK = new Ramp(['#1e1a12', '#3e3622', '#665a34', '#8e8050', '#c4b678']);
const ROCKFAR = new Ramp(['#12100a', '#2a2416', '#463e24', '#625634', '#8a7c50']);

PLANS.grumbold = (p, t, o) => {
  const pose = o.pose, rage = !!o.rage, cx = 62, by = 50 + (pose === 'idle' ? Math.round(sin(t * TAU)) : pose === 'stagger' ? 5 : 0);
  const C = { idle: { ext: 0.3, lift: 0.2, open: 0.3 }, walk: { ext: 0.4, lift: 0.1, open: 0.3 }, windup: { ext: -0.2, lift: 1, open: 1 }, swipe: { ext: 1, lift: -0.1, open: 0.5 }, slam: { ext: 0.7, lift: -0.9, open: 0.2 }, charge: { ext: 0.2, lift: 0, open: 0 }, stagger: { ext: 0, lift: -0.6, open: 0.8 }, roar: { ext: 0.2, lift: 1, open: 1 }, toss: { ext: 0.2, lift: 1, open: 0.2 } }[pose] || { ext: 0.3, lift: 0.2, open: 0.3 };
  const pl = { legs: pose === 'charge' || pose === 'walk' ? 'walk' : 'idle', legT: t, squash: pose === 'stagger' ? 0.6 : 0 };
  const sq = pl.squash;
  // far legs and claw
  legsPose(p, pl, cx - 24, by + 14, 80, 4, [ROCKFAR.c[2], ROCKFAR.c[3]], 11, 2);
  claw(p, cx + 24, by - 2, C.ext * 0.8, C.lift * 0.8 + 0.2, C.open, 3.6, ROCKFAR, true, { jaw: 1.1, palm: 1.2 });
  // carapace
  p.shape(ROCK, { dither: 0.5, texture: { seed: 4, p: 0.1 } }, (s) => { s.ellipse(cx, by, 31, 20 - sq * 5); });
  p.ellipse(cx - 2, by + 15 - sq * 3, 24, 5, new Ramp(['#3a2e20', '#5a4a30', '#8a7650', '#b4a070', '#d8c898']), { outline: false, dither: 0.3 });
  // armour plates + barnacles
  for (let k = 0; k < 5; k++) { p.line(cx - 22 + k * 11, by - 16, cx - 20 + k * 11, by + 8, ROCK.c[1]); p.px(cx - 23 + k * 11, by - 14, ROCK.c[4]); }
  for (const [bx, bY, r] of [[-20, -4, 3.5], [-8, -12, 3], [10, -13, 3.2], [20, -2, 3.6], [-24, 6, 2.8], [4, 6, 3], [14, 8, 2.6], [26, 8, 2.4]]) { p.shape(new Ramp(['#5a5a62', '#8a8a96', '#b4b4c0', '#dcdce8', '#ffffff']), { dither: 0.3 }, (s) => s.ellipse(cx + bx, by + bY, r, r * 0.8)); }
  for (let i = 0; i < 14; i++) p.px(cx - 26 + (i * 13) % 54, by - 10 + (i * 7) % 20, '#4a8a3a');
  // Brine Core — the weak point
  const coreGlow = pose === 'stagger' ? 1 : 0.5 + (rage ? 0.4 : 0) + 0.2 * sin(t * TAU);
  p.glow(cx - 1, by - 18, 12, '#ff9ad8', 0.5 * coreGlow); p.shape(R.coralPink, { dither: 0.2 }, (s) => s.poly([[cx - 6, by - 14], [cx - 1, by - 24], [cx + 5, by - 14], [cx, by - 10]])); p.px(cx - 1, by - 20, '#ffffff'); p.px(cx, by - 19, '#ffe0f0');
  if (rage) for (let k = 0; k < 6; k++) { p.line(cx - 18 + k * 7, by - 8, cx - 15 + k * 7, by + 2 + (k % 2) * 4, '#ff8a2a'); p.px(cx - 17 + k * 7, by - 4, '#ffe08a'); }
  legsPose(p, pl, cx - 22, by + 15, 81, 4, [ROCK.c[1], ROCK.c[4]], 11, 3);
  // eyes
  const ey = by - 24 + sq * 6; p.line(cx + 12, by - 17, cx + 14, ey + 3, ROCKFAR.c[2]); p.line(cx + 20, by - 15, cx + 21, ey + 3, ROCKFAR.c[2]);
  for (const ex of [cx + 14, cx + 21]) { p.ellipse(ex, ey, 3.2, 3.2, new Ramp(['#8a1010', '#c8301a', '#ffd84a', '#fff6a8', '#ffffff']), { dither: 0 }); p.px(ex + 1, ey, '#170d1c'); p.px(ex + 1, ey + 1, '#170d1c'); }
  p.line(cx + 9, ey - 4, cx + 17, ey - 2, '#170d1c'); p.line(cx + 25, ey - 4, cx + 18, ey - 2, '#170d1c');
  // near claw (big)
  claw(p, cx + 27, by + 2, C.ext, C.lift + 0.1, C.open, 4.4, ROCK, false, { jaw: 1.1, palm: 1.15 });
};
