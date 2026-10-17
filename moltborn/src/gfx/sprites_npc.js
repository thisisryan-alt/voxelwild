// NPC sprites: friendly sea-folk painted on the same toolkit. def.sprite = {kind, ...}
import { Painter } from './painter.js';
import { R, OUTLINE } from './palette.js';
import { Ramp } from './painter.js';

const cache = new Map();
const sin = Math.sin;
const KINDS = {
  // hermit crab elder in a spiral shell
  hermit(p, t, o) {
    const cx = 18, by = 30, b = sin(t * 6.28) > 0.5 ? -1 : 0;
    p.shape(o.shell || R.coralPink, { dither: 0.5, texture: { seed: 3, p: 0.08 } }, (s) => { s.ellipse(cx - 4, by - 14 + b, 11, 11); s.ellipse(cx - 9, by - 8, 6, 6); });
    for (let k = 0; k < 3; k++) p.line(cx - 10 + k * 2, by - 18 + b + k, cx - 2 + k, by - 12 + b + k * 2, (o.shell || R.coralPink).c[1]);
    HERO_CRAB(p, cx + 4, by, o.body || R.shoreFar, b);
    if (o.beard) p.shape(R.pearl, {}, (s) => s.ellipse(cx + 13, by - 8 + b, 3, 4));
  },
  // seahorse
  seahorse(p, t, o) {
    const cx = 15, by = 36, b = Math.round(sin(t * 6.28) * 1);
    p.chain([[cx - 4, by - 2], [cx - 10, by - 6 + b], [cx - 6, by - 12 + b], [cx - 6, by - 16]], 3, 1.5, o.ramp, {});
    p.shape(o.ramp, { dither: 0.5 }, (s) => { s.ellipse(cx, by - 18 + b, 6, 9); s.capsule(cx + 2, by - 28 + b, cx + 11, by - 27 + b, 3, 2); s.ellipse(cx + 1, by - 27 + b, 4.5, 4.5); });
    for (let i = 0; i < 4; i++) p.line(cx - 4, by - 24 + i * 4 + b, cx + 4, by - 23 + i * 4 + b, o.ramp.c[1]);
    p.poly([[cx - 4, by - 34 + b], [cx - 1, by - 38 + b], [cx + 2, by - 34 + b]], o.crest || R.gold, {});
    p.ellipse(cx + 3, by - 28 + b, 1.5, 1.5, R.eyeWhite, { outline: false }); p.px(cx + 4, by - 28 + b, '#170d1c');
    p.poly([[cx - 4, by - 14 + b], [cx - 11, by - 18 + b], [cx - 5, by - 20 + b]], o.ramp.tint(0.05, 1, 1.1), {});
    if (o.robe) p.shape(o.robe, { dither: 0.4 }, (s) => s.poly([[cx - 6, by - 20 + b], [cx + 6, by - 20 + b], [cx + 8, by - 6], [cx - 8, by - 6]]));
  },
  // octopus
  octopus(p, t, o) {
    const cx = 18, b = Math.round(sin(t * 6.28) * 1);
    for (let i = 0; i < 6; i++) { const x0 = cx - 10 + i * 4; p.chain([[x0, 22 + b], [x0 + sin(t * 6.28 + i) * 3, 30], [x0 + (i - 2.5) * 2 + sin(t * 6.28 + i + 1) * 3, 36]], 1.8, 0.8, o.ramp, {}); }
    p.shape(o.ramp, { dither: 0.5, texture: { seed: 8, p: 0.07 } }, (s) => { s.ellipse(cx, 14 + b, 11, 11); });
    p.ellipse(cx - 4, 18 + b, 2.2, 2.4, R.eyeWhite, { outline: false }); p.ellipse(cx + 4, 18 + b, 2.2, 2.4, R.eyeWhite, { outline: false });
    p.px(cx - 3, 19 + b, '#170d1c'); p.px(cx + 5, 19 + b, '#170d1c');
    if (o.hat) { p.shape(R.void, {}, (s) => { s.rect(cx - 8, 3 + b, 16, 3); s.rect(cx - 5, -3 + b, 10, 7); }); p.line(cx - 5, 1 + b, cx + 4, 1 + b, R.gold.c[2]); }
    p.line(cx - 2, 22 + b, cx + 2, 22 + b, '#170d1c');
  },
  // small fish child / merchant fish
  fish(p, t, o) {
    const cx = 18, cy = 18 + Math.round(sin(t * 6.28) * 1.5);
    p.poly([[cx - 8, cy], [cx - 16, cy - 6 + sin(t * 12) * 2], [cx - 14, cy], [cx - 16, cy + 6 + sin(t * 12) * 2]], o.ramp.tint(0.02, 1, 0.9), {});
    p.shape(o.ramp, { dither: 0.5 }, (s) => s.ellipse(cx, cy, 10, (o.h || 8)));
    p.ellipse(cx + 1, cy + 3, 7, 3, o.belly || R.belly, { outline: false, dither: 0.3 });
    p.ellipse(cx + 5, cy - 2, 2.4, 2.4, R.eyeWhite, { outline: false }); p.px(cx + 6, cy - 2, '#170d1c'); p.px(cx + 6, cy - 1, '#170d1c');
    if (o.hat) p.shape(o.hat, {}, (s) => s.poly([[cx - 4, cy - 7], [cx + 1, cy - 14], [cx + 6, cy - 7]]));
    if (o.scarf) p.rect(cx + 1, cy + 5, 8, 3, o.scarf, {});
    if (o.bag) p.shape(R.wood, {}, (s) => s.ellipse(cx - 5, cy + 8, 4, 4));
  },
  // ghost sailor
  ghost(p, t, o) {
    const cx = 18, b = Math.round(sin(t * 6.28) * 1.5);
    p.shape(R.ghost, { dither: 0.6, outline: '#183038' }, (s) => { s.ellipse(cx, 12 + b, 8, 9); s.poly([[cx - 8, 14 + b], [cx - 9, 34 + b], [cx - 4, 29 + b], [cx, 35 + b], [cx + 4, 29 + b], [cx + 9, 34 + b], [cx + 8, 14 + b]]); });
    p.ellipse(cx - 3, 11 + b, 1.8, 2.4, R.void, { outline: false }); p.ellipse(cx + 3, 11 + b, 1.8, 2.4, R.void, { outline: false });
    p.px(cx - 3, 11 + b, '#9affff'); p.px(cx + 3, 11 + b, '#9affff');
    p.shape(R.rust, {}, (s) => s.poly([[cx - 8, 5 + b], [cx + 8, 5 + b], [cx + 5, 0 + b], [cx - 5, 0 + b]]));
  },
  // anglerfish villager
  angler(p, t, o) {
    const cx = 18, cy = 20 + Math.round(sin(t * 6.28) * 1.5);
    p.poly([[cx - 8, cy], [cx - 16, cy - 6 + sin(t * 9) * 2], [cx - 14, cy], [cx - 16, cy + 6]], R.abyssal, {});
    p.shape(R.abyssal, { dither: 0.5 }, (s) => s.ellipse(cx, cy, 11, 9));
    p.chain([[cx + 2, cy - 7], [cx + 4, cy - 16], [cx + 12, cy - 18]], 0.7, 0.5, R.chain, { outline: false });
    p.glow(cx + 12, cy - 18, 8, '#9affff', 0.8); p.ellipse(cx + 12, cy - 18, 1.8, 1.8, R.glass, {});
    p.ellipse(cx + 5, cy - 2, 2.2, 2.2, R.eyeWhite, { outline: false }); p.px(cx + 6, cy - 2, '#170d1c');
    p.line(cx + 4, cy + 3, cx + 11, cy + 4, '#170d1c'); p.px(cx + 8, cy + 5, '#fff'); p.px(cx + 10, cy + 5, '#fff');
  },
  // spectral crab / ancient moltborn
  elder(p, t, o) {
    const cx = 18, by = 30, b = Math.round(sin(t * 6.28) * 1);
    HERO_CRAB(p, cx, by, R.pearl, b, true);
    p.glow(cx, by - 12, 22, '#c0f0ff', 0.4);
  },
  // titan face (for dialogue) — chained leviathan bust
  titan(p, t, o) {
    p.shape(R.leviathan, { dither: 0.5 }, (s) => { s.ellipse(20, 20, 16, 14); }); p.ellipse(14, 17, 3, 3, R.eyeWhite, { outline: false }); p.ellipse(26, 17, 3, 3, R.eyeWhite, { outline: false });
    p.px(14, 17, '#ff4a3a'); p.px(26, 17, '#ff4a3a'); p.line(10, 26, 30, 26, R.chain.c[3]);
  },
  // guard
  guard(p, t, o) {
    const cx = 18, by = 32, b = Math.round(sin(t * 6.28) * 0.8);
    HERO_CRAB(p, cx, by, o.ramp || R.crimson, b);
    p.shape(R.steel, {}, (s) => s.ellipse(cx + 3, by - 17 + b, 9, 4));
    p.line(cx + 14, by - 4, cx + 14, by - 30, R.trident.c[3]); p.poly([[cx + 12, by - 30], [cx + 14, by - 35], [cx + 16, by - 30]], R.trident, {});
  },
};
import { FORMS as HERO } from './sprites_player.js';
function HERO_CRAB(p, cx, by, ramp, b, ghost) {
  const pose = { bob: b, legs: 'idle', legT: 0, c1: { ext: 0.3, lift: 0.3, open: 0.4 }, c2: { ext: 0.1, lift: 0.4, open: 0.4 }, squash: 0, eyeY: 0, shut: false, glow: 0, tail: 0, lunge: 0 };
  const q = new Painter(42, 30, OUTLINE); HERO.shore.paint(q, pose, { ramp, far: ramp.tint(0, 1, 0.75) });
  for (let y = 0; y < 30; y++) for (let x = 0; x < 42; x++) { const c = q.d[y * 42 + x]; if (c >>> 24) { const px = cx - 21 + x, py = by - 27 + y; if (px >= 0 && py >= 0 && px < p.w && py < p.h) p.d[py * p.w + px] = c; } }
}

export function npcFrame(sprite, i) {
  const key = JSON.stringify([sprite.kind, sprite.k || '']) + (i % 4);
  let f = cache.get(key); if (f) return f;
  const W = 40, H = 42, p = new Painter(W, H, OUTLINE);
  KINDS[sprite.kind](p, (i % 4) / 4, sprite.o || {});
  f = { canvas: p.toCanvas(), w: W, h: H, ax: 20, ay: 36, _flash: null }; cache.set(key, f); return f;
}
export { Ramp };
