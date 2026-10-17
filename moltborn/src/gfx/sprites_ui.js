// UI icons (16x16), pickups and small HUD art, painted with the same toolkit as everything else.
import { Painter } from './painter.js';
import { R, OUTLINE } from './palette.js';
import { ITEMS } from '../data/items.js';

const cache = new Map();
const mk = (key, w, h, fn) => { let c = cache.get(key); if (!c) { const p = new Painter(w, h, OUTLINE); fn(p); c = p.toCanvas(); cache.set(key, c); } return c; };

const ICONS = {
  coin: (p) => { p.ellipse(8, 8, 6, 6.5, R.gold, { dither: 0.3 }); p.ellipse(8, 8, 3.4, 4, R.gold.tint(0, 1, 0.8), { outline: false, dither: 0 }); p.px(6, 5, '#fff6a8'); p.px(7, 4, '#fff6a8'); },
  pearl: (p, c = R.pearl) => { p.ellipse(8, 8, 5.5, 5.5, c, { dither: 0.3 }); p.px(6, 6, '#ffffff'); p.px(5, 7, '#ffffff'); },
  potion: (p, c) => { p.rect(6, 2, 4, 3, R.bone, {}); p.shape(c, { dither: 0.4 }, (s) => s.ellipse(8, 10, 5.5, 5)); p.px(6, 8, c.c[4]); p.px(6, 9, c.c[4]); },
  shell: (p, c) => { p.shape(c, { dither: 0.4 }, (s) => s.poly([[8, 14], [2, 9], [3, 4], [8, 2], [13, 4], [14, 9]])); for (let k = 0; k < 4; k++) p.line(8, 13, 4 + k * 2.7, 4, c.c[1]); },
  claw: (p, c) => { p.chain([[3, 13], [7, 9], [10, 7]], 2.2, 2, c, {}); p.capsule(10, 7, 14, 3, 1.8, 0.8, c, {}); p.capsule(10, 8, 14, 10, 1.6, 0.8, c, {}); },
  charm: (p, c) => { p.line(4, 2, 8, 6, R.chain.c[3]); p.line(12, 2, 8, 6, R.chain.c[3]); p.shape(c, { dither: 0.3 }, (s) => s.ellipse(8, 10, 4.5, 4.5)); p.px(6, 8, c.c[4]); },
  mutation: (p, c) => { for (let i = 0; i < 6; i++) { const y = 2 + i * 2.2, x = 8 + Math.sin(i * 1.1) * 4; p.ellipse(x, y, 1.6, 1.4, c, { outline: true }); } p.line(4, 3, 12, 12, c.c[1]); p.line(12, 3, 4, 12, c.c[1]); },
  key: (p, c) => { p.ellipse(5, 5, 3, 3, c, {}); p.px(5, 5, '#170d1c'); p.capsule(7, 7, 13, 13, 1.1, 1.1, c, {}); p.rect(11, 12, 3, 1.5, c, { outline: false, flat: 3 }); },
  gem: (p, c) => { p.shape(c, { dither: 0.3 }, (s) => s.poly([[8, 2], [14, 6], [11, 14], [5, 14], [2, 6]])); p.line(2, 6, 14, 6, c.c[4]); p.px(7, 4, '#fff'); },
  rune: (p, c) => { p.shape(R.rock, {}, (s) => s.rect(3, 2, 10, 12)); p.line(8, 4, 8, 12, c.c[4]); p.line(5, 7, 11, 7, c.c[4]); p.line(5, 10, 11, 5, c.c[3]); },
  drop: (p, c) => { p.shape(c, { dither: 0.3 }, (s) => { s.poly([[8, 1], [13, 10], [8, 15], [3, 10]]); s.ellipse(8, 10, 5, 4.5); }); p.px(6, 9, '#fff'); },
  heart: (p) => { p.shape(R.fishRed, { dither: 0.3 }, (s) => { s.ellipse(5, 6, 3.6, 3.6); s.ellipse(11, 6, 3.6, 3.6); s.poly([[2, 8], [14, 8], [8, 14]]); }); p.px(4, 4, '#fff'); },
  scroll: (p, c) => { p.shape(R.sand, {}, (s) => s.rect(3, 3, 10, 10)); p.line(5, 6, 11, 6, '#6a3a06'); p.line(5, 8, 11, 8, '#6a3a06'); p.line(5, 10, 9, 10, '#6a3a06'); },
};
const COL = { gold: R.gold, pink: R.coralPink, blue: R.steel, red: R.crimson, green: R.venom, white: R.pearl, purple: R.abyssal, cyan: R.lumen, brown: R.wood, rust: R.rust, bone: R.bone, orange: R.coralOrange, black: new (R.gold.constructor)(['#07040f', '#150a2a', '#2a1450', '#4a2490', '#8a5ae0']) };

const ITEM_ICON = {
  kelp_wrap: ['potion', 'green'], brine_tonic: ['potion', 'cyan'], fury_ink: ['potion', 'red'], pearl: ['pearl', 'white'], black_pearl: ['pearl', 'black'],
  brine_core: ['gem', 'pink'], abyssal_core: ['gem', 'purple'], titan_heart: ['heart'], tide_sigil: ['gem', 'cyan'],
  brineguard_key: ['key', 'gold'], captain_key: ['key', 'rust'], lantern_stone: ['gem', 'orange'], trench_gate_rune: ['rune', 'cyan'], spiral_shell: ['shell', 'pink'], ledger: ['scroll'], stolen_regalia: ['charm', 'gold'],
};
export function itemIcon(id) {
  return mk('item:' + id, 16, 16, (p) => {
    const it = ITEMS[id] || {};
    let spec = ITEM_ICON[id];
    if (!spec) {
      if (id.startsWith('mp')) spec = ['pearl', ['pink', 'green', 'gold', 'rust', 'orange', 'purple', 'cyan'][(+id.slice(2) - 1) % 7]];
      else if (it.type === 'equip') spec = [it.slot, it.slot === 'shell' ? 'blue' : it.slot === 'claw' ? 'orange' : 'gold'];
      else if (it.type === 'mutation') spec = ['mutation', 'green'];
      else if (it.type === 'dye') spec = ['drop', 'pink'];
      else spec = ['gem', 'white'];
    }
    const [k, c] = spec; ICONS[k](p, COL[c]);
  });
}
export const iconCoin = () => mk('coin', 16, 16, ICONS.coin);
// spinning coin frames (width oscillates) for pickups
export function coinFrame(i) {
  return mk('coinspin' + i, 12, 12, (p) => {
    const w = [5, 4, 2, 1, 2, 4][i % 6];
    p.ellipse(6, 6, w, 5.2, R.gold, { dither: 0.2 });
    if (w > 3) { p.ellipse(6, 6, w - 2, 3.2, R.gold.tint(0, 1, 0.85), { outline: false, dither: 0 }); p.px(5, 3, '#fff6a8'); }
  });
}
export function pearlFrame(kind = 'white') { return mk('pearl:' + kind, 10, 10, (p) => ICONS.pearl.call(null, p, kind === 'black' ? COL.black : R.pearl) ); }
export const orbFrame = (kind) => mk('orb:' + kind, 12, 12, (p) => {
  const c = kind === 'tide' ? R.lumen : kind === 'fury' ? R.crimson : R.venom;
  p.shape(c, { dither: 0.3 }, (s) => s.ellipse(6, 6, 4, 4)); p.px(5, 4, '#fff'); p.glow(6, 6, 9, c.hex[3], 0.4);
});
export const chestFrame = (open, tint = 0) => mk('chest' + open + tint, 22, 18, (p) => {
  const wood = tint ? R.wood.tint(0, 0.5, 1.4) : R.wood;
  p.shape(wood, { dither: 0.3 }, (s) => s.rect(1, 8, 20, 9));
  p.shape(wood, { dither: 0.3 }, (s) => open ? s.rect(1, 1, 20, 6) : s.ellipse(11, 8, 10, 5));
  if (open) { p.rect(3, 8, 16, 3, R.gold, { outline: false, flat: 2 }); for (let i = 0; i < 6; i++) p.px(4 + i * 2.5, 8 + (i % 2), '#fff6a8'); }
  p.line(1, 12, 21, 12, R.gold.c[1]); p.rect(9, 11, 4, 4, R.gold, {});
});
export const shrineFrame = (kind, active) => mk('shrine' + kind + active, 34, 40, (p) => {
  const mat = kind === 'molt' ? R.coralPink : R.pearl;
  p.shape(R.rock, {}, (s) => s.ellipse(17, 36, 15, 4));
  p.shape(mat, { dither: 0.4 }, (s) => { s.poly([[8, 36], [6, 22], [12, 10], [17, 2], [22, 10], [28, 22], [26, 36]]); });
  p.line(17, 6, 17, 32, mat.c[1]); p.line(11, 14, 17, 20, mat.c[1]); p.line(23, 14, 17, 20, mat.c[1]);
  if (active) p.glow(17, 18, 18, kind === 'molt' ? '#ffb0d8' : '#a0f0ff', 0.5);
  p.ellipse(17, 19, 3, 3.5, active ? R.gold : R.rockDark, { outline: false });
});
export const muralFrame = (v) => mk('mural' + v, 34, 30, (p) => {
  p.shape(R.rock, { dither: 0.2 }, (s) => s.rect(1, 1, 32, 28));
  p.rect(4, 4, 26, 22, R.sand.tint(0, 0.7, 0.6), { outline: false, flat: 1 });
  const g = R.gold.hex[2];
  p.line(8, 20, 14, 10, g); p.line(14, 10, 20, 20, g); p.line(20, 20, 26, 8, g); p.ellipse(17, 10, 3, 3, R.gold, { outline: false });
  for (let i = 0; i < 4; i++) p.px(7 + i * 6, 23, g);
});
export const npcFrame = null;

// ---- ability / skill icons (14x14) --------------------------------------------------------------------
const AB = {
  bubble: (p) => { p.ellipse(7, 7, 5, 5, R.lumen, { dither: 0 }); p.px(5, 5, '#fff'); p.px(6, 5, '#fff'); p.px(5, 6, '#fff'); },
  sand: (p) => { for (let i = 0; i < 9; i++) p.ellipse(3 + (i % 3) * 4, 3 + Math.floor(i / 3) * 4, 1.6, 1.6, R.sand, { dither: 0 }); },
  dash: (p) => { p.poly([[1, 7], [9, 2], [9, 5], [13, 5], [13, 9], [9, 9], [9, 12]], R.steel, {}); },
  shell: (p) => { p.shape(R.steel, { dither: 0.3 }, (s) => s.poly([[7, 13], [1, 8], [2, 3], [7, 1], [12, 3], [13, 8]])); p.line(7, 12, 7, 3, R.steel.c[1]); },
  blade: (p) => { p.capsule(2, 12, 12, 2, 1.4, 0.8, R.crimson, {}); p.line(3, 9, 6, 12, R.gold.c[3]); },
  spine: (p) => { for (let i = 0; i < 3; i++) p.line(2, 4 + i * 3, 12, 3 + i * 3, R.venom.c[4]); p.px(12, 3, '#fff'); },
  beam: (p) => { p.rect(1, 5, 12, 4, R.lumen, {}); p.px(12, 6, '#fff'); p.glow(7, 7, 8, '#d0ffff', 0.5); },
  quake: (p) => { p.poly([[1, 12], [5, 4], [8, 9], [10, 2], [13, 12]], R.coralOrange, {}); },
  whirl: (p) => { p.ellipse(7, 7, 6, 6, R.lumen, { dither: 0.2 }); p.ellipse(7, 7, 3.5, 3.5, R.lumen.tint(0, 1, 0.5), { outline: false, dither: 0 }); p.line(7, 7, 11, 5, '#fff'); },
  wave: (p) => { p.shape(R.divine, { dither: 0.3 }, (s) => { s.ellipse(8, 8, 6, 4); s.poly([[1, 12], [4, 3], [6, 9]]); }); },
  clock: (p) => { p.ellipse(7, 7, 6, 6, R.pearl, { dither: 0 }); p.line(7, 7, 7, 3, '#170d1c'); p.line(7, 7, 10, 8, '#170d1c'); },
  pearl: (p) => { p.ellipse(7, 7, 5, 5, R.pearl, { dither: 0.2 }); p.px(5, 5, '#fff'); },
  tail: (p) => { p.chain([[2, 11], [6, 4], [12, 3]], 1.8, 1, R.leviathan, {}); },
  ult: (p) => { p.poly([[7, 0], [9, 5], [14, 5], [10, 8], [12, 13], [7, 10], [2, 13], [4, 8], [0, 5], [5, 5]], R.gold, {}); },
};
export function abilityIcon(name) { return mk('ab:' + name, 14, 14, (p) => (AB[name] || AB.pearl)(p)); }

// ---- little form glyphs for the evolution chart (26x18) -----------------------------------------------------------
const FORM_GLYPH = {
  shore: (p) => { p.shape(R.shore, { dither: 0.3 }, (s) => s.ellipse(11, 11, 8, 5)); p.ellipse(18, 9, 2.6, 2.6, R.shore, {}); p.px(8, 4, '#fff'); p.px(12, 4, '#fff'); p.line(4, 15, 3, 17, R.shoreFar.hex[2]); p.line(11, 16, 11, 17, R.shoreFar.hex[2]); p.line(17, 15, 18, 17, R.shoreFar.hex[2]); },
  warrior: (p) => { p.shape(R.steel, { dither: 0.3 }, (s) => s.ellipse(11, 10, 9, 6)); p.ellipse(20, 8, 3.4, 3.4, R.steel, {}); p.poly([[6, 5], [8, 0], [10, 5]], R.bone, {}); p.px(14, 3, '#fff'); p.px(17, 3, '#fff'); p.line(4, 15, 3, 17, R.steel.hex[1]); p.line(12, 16, 12, 17, R.steel.hex[1]); },
  abyssal: (p) => { p.shape(R.abyssal, { dither: 0.3 }, (s) => { s.capsule(4, 10, 16, 9, 3.6, 3); s.ellipse(18, 9, 4, 3.4); }); p.line(18, 6, 22, 1, R.chain.hex[3]); p.glow(22, 1, 4, '#a0f8ff', 0.8); p.px(22, 1, '#fff'); p.px(19, 8, '#a0f8ff'); for (let i = 0; i < 3; i++) p.line(6 + i * 3, 13, 4 + i * 3, 16, R.abyssal.hex[2]); },
  leviathan: (p) => { p.chain([[2, 12], [3, 6], [6, 3]], 1.6, 1, R.leviathan, {}); p.shape(R.leviathan, { dither: 0.3 }, (s) => { s.ellipse(11, 11, 8, 4.5); s.ellipse(19, 10, 5, 4.2); }); p.px(21, 8, '#ffb44a'); p.px(18, 8, '#ffb44a'); p.line(7, 15, 6, 17, R.leviathan.hex[2]); p.line(12, 15, 12, 17, R.leviathan.hex[2]); },
  mythic: (p) => { p.shape(R.pearl, { dither: 0.3 }, (s) => { s.ellipse(12, 11, 9, 5.5); s.ellipse(19, 9, 4, 4); }); for (let i = 0; i < 4; i++) p.poly([[14 + i * 2, 5], [15 + i * 2, 0 + (i === 1 ? 0 : 2)], [16 + i * 2, 5]], R.divine, {}); p.px(18, 8, '#9af0ff'); p.px(21, 8, '#9af0ff'); p.glow(13, 11, 10, '#9af0ff', 0.3); },
  primordial: (p) => { p.shape(R.pearl, { dither: 0.3 }, (s) => { s.ellipse(12, 11, 9, 5.5); s.ellipse(19, 9, 4, 4); }); for (let i = 0; i < 4; i++) p.poly([[14 + i * 2, 5], [15 + i * 2, 0 + (i === 1 ? 0 : 2)], [16 + i * 2, 5]], R.gold, {}); for (let i = 0; i < 8; i++) p.px(3 + (i * 7) % 22, 2 + (i * 5) % 14, '#fff'); p.glow(13, 11, 12, '#ffffff', 0.4); },
};
export function formIcon(id) { return mk('form:' + id, 26, 18, (p) => (FORM_GLYPH[id] || FORM_GLYPH.shore)(p)); }
