// Extra menu tabs: BEAST (bestiary), TROPHY (achievements and lifetime records) and CRAFT (the kitchen). They are
// added to MenuScene's prototype so the existing tab machinery (u_<TAB> to update, d_<TAB> to draw) just works.
import { panel, bar, text, button, COL, textWidth, wrapText } from './ui.js';
import { ENEMIES } from '../data/enemies.js';
import { BEASTS, REVEAL } from '../data/bestiary.js';
import { ACHIEVEMENTS, CATS, TIERS } from '../data/achievements.js';
import { RECIPES } from '../data/recipes.js';
import { ITEMS } from '../data/items.js';
import { STATUS } from '../systems/status.js';
import { ZONE_INFO } from '../data/zoneinfo.js';
import { BOSS_CLASSES } from '../entities/bosses.js';
import { enemyFrame } from '../gfx/sprites_enemies.js';
import { itemIcon } from '../gfx/sprites_ui.js';
import { drawFrame } from '../entities/entity.js';
import { drawTrophyGlyph } from '../systems/achievements.js';
import { clamp } from '../core/util.js';
import { SETS, SET_OF } from '../data/sets.js';
import { computeStats, respec, respecCost } from '../systems/progression.js';
import { buildZone } from '../data/zones.js';
import { BIOMES } from '../data/biomes.js';

export const EXTRA_TABS = ['BEAST', 'TROPHY', 'CRAFT'];
export const EXTRA_LABELS = { BEAST: 'BEAST', TROPHY: 'TROPHY', CRAFT: 'CRAFT' };

const BOSS_KEYS = ['grumbold', 'pearl_tyrant', 'hermit_king', 'mother_moray', 'sporemother', 'brass_colossus', 'aurelia', 'captain_rust', 'magmaw', 'lurelord', 'krael', 'hollow_maw', 'rift_warden', 'kyros', 'poseidon'];
const CREATURES = Object.keys(ENEMIES).filter((k) => BEASTS[k] && !BOSS_KEYS.includes(k) && !ENEMIES[k].noop);
const fmtSecs = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
const nameOf = (k) => (BOSS_KEYS.includes(k) ? (BOSS_CLASSES[k]?.def?.name || k) : ENEMIES[k]?.name || k);

function listNav(scene, inp, s, n, step = 1) {
  const g = scene.g;
  if (inp.pressed('up')) { s.i = (s.i + n - 1) % Math.max(1, n); g.audio.sfx('tick'); }
  if (inp.pressed('down')) { s.i = (s.i + 1) % Math.max(1, n); g.audio.sfx('tick'); }
  s.i = clamp(s.i, 0, Math.max(0, n - 1)); return step;
}
function listRows(ctx, x, y, w, rows, sel, vis, rowH, draw) {
  const top = Math.max(0, Math.min(sel - Math.floor(vis / 2), rows.length - vis));
  rows.slice(top, top + vis).forEach((r, k) => {
    const i = top + k, yy = y + k * rowH, on = i === sel;
    if (on) { ctx.fillStyle = '#1e4a7a'; ctx.fillRect(x, yy - 1, w, rowH); }
    draw(r, i, yy, on);
  });
  if (rows.length > vis) { // a thin scroll marker
    const h = 14 * vis, th = Math.max(6, Math.round(h * vis / rows.length)), ty = y + Math.round((h - th) * (top / Math.max(1, rows.length - vis)));
    ctx.fillStyle = '#2a3a58'; ctx.fillRect(x + w + 1, y - 1, 2, h); ctx.fillStyle = COL.borderLit; ctx.fillRect(x + w + 1, ty, 2, th);
  }
}

// ======================================================= BESTIARY =====================================================
const beast = {
  beastRows() { return [...CREATURES.map((k) => ({ k, boss: false })), ...BOSS_KEYS.map((k) => ({ k, boss: true }))]; },
  beastKills(row) { const r = this.g.state.records; return row.boss ? (this.g.state.bosses[row.k] ? 1 : 0) : (r.kills[row.k] || 0); },
  beastBoss(k) { return !!this.g.state.bosses[k]; },
  u_BEAST(inp, s) { listNav(this, inp, s, this.beastRows().length); },
  d_BEAST(ctx, s) {
    const rows = this.beastRows(), g = this.g, r = g.state.records;
    panel(ctx, 8, 20, 190, 230); panel(ctx, 204, 20, 268, 230);
    listRows(ctx, 10, 26, 186, rows, s.i, 17, 13, (row, i, y, on) => {
      const kills = this.beastKills(row), seen = kills > 0;
      if (row.boss) { ctx.fillStyle = '#c02838'; ctx.fillRect(11, y + 3, 2, 3); }
      text(ctx, seen ? nameOf(row.k) : '???', 14, y + 1, on ? '#ffffff' : seen ? COL.text : '#506080');
      if (seen) { const c = row.boss ? 'defeated' : 'x' + kills; text(ctx, c, 192 - textWidth(c), y + 1, COL.dim); }
    });
    const row = rows[s.i], kills = this.beastKills(row), B = BEASTS[row.k], d = ENEMIES[row.k];
    const known = kills >= REVEAL.lore;
    // portrait
    ctx.fillStyle = '#071226'; ctx.fillRect(210, 26, 72, 64); ctx.strokeStyle = '#2a3a58'; ctx.strokeRect(210.5, 26.5, 71, 63);
    if (known) this.beastPortrait(ctx, row, 246, 76);
    else text(ctx, '?', 243, 52, '#506080', { scale: 2 });
    text(ctx, known ? nameOf(row.k) : 'Unknown creature', 290, 28, known ? COL.gold : '#506080');
    text(ctx, known ? B.habitat : 'Not yet met', 290, 40, COL.dim);
    if (known) {
      const need = row.boss ? 0 : Math.max(0, REVEAL.stats - kills);
      if (row.boss || kills >= REVEAL.stats) {
        const hp = d?.hp ?? '?', stats = [`HP ${hp}`, `Damage ${d?.dmg ?? '?'}`, `XP ${d?.xp ?? '?'}`];
        text(ctx, stats.join('   '), 290, 54, COL.text);
        if (d?.drops?.length) text(ctx, 'Drops: ' + d.drops.map(([id]) => ITEMS[id]?.name || id).join(', '), 290, 66, '#c8e8c8');
      } else text(ctx, `Defeat ${need} more to learn its strength.`, 290, 54, '#506080');
      wrapText(B.note, 252).forEach((l, i) => text(ctx, l, 212, 98 + i * 10, COL.text));
      const ty = 98 + wrapText(B.note, 252).length * 10 + 8;
      const tipOk = row.boss ? (r.bossTries[row.k] || 0) >= 1 : kills >= REVEAL.tip;
      if (tipOk) { text(ctx, 'FIELD NOTE', 212, ty, COL.green); wrapText(B.tip, 252).forEach((l, i) => text(ctx, l, 212, ty + 11 + i * 10, '#c8f0d8')); }
      else text(ctx, row.boss ? 'Challenge it to learn its habits.' : `Defeat ${REVEAL.tip - kills} more for a field note.`, 212, ty, '#506080');
      if (row.boss) {
        const best = r.bossBest[row.k], flaw = r.flawless[row.k], tries = r.bossTries[row.k] || 0;
        text(ctx, `Attempts ${tries}   Best ${best ? fmtSecs(best) : '--'}   ${flaw ? 'FLAWLESS' : ''}`, 212, 226, flaw ? COL.gold : COL.dim);
      } else if (kills) text(ctx, `Defeated ${kills} time${kills === 1 ? '' : 's'}`, 212, 226, COL.dim);
    } else text(ctx, 'Defeat one to start its entry.', 212, 98, '#506080');
    const got = rows.filter((x) => this.beastKills(x) > 0).length; const lbl = `${got}/${rows.length}`;
    text(ctx, lbl, 190 - textWidth(lbl) + 8, 238, COL.dim);
  },
  beastPortrait(ctx, row, cx, base) {
    try {
      const sp = row.boss ? BOSS_CLASSES[row.k]?.def?.sprite : ENEMIES[row.k]?.sprite; if (!sp) return;
      const f = enemyFrame(row.k + (row.boss ? '' : ''), sp, 'move', Math.floor(this.t * 6));
      const k = clamp(Math.floor(54 / Math.max(f.canvas.width, f.canvas.height)), 1, 3);
      ctx.save(); ctx.beginPath(); ctx.rect(211, 27, 70, 62); ctx.clip(); ctx.translate(cx, base - f.canvas.height * k / 2 + f.ay * k * 0.2); ctx.scale(k, k);
      drawFrame(ctx, f, 0, f.canvas.height / 2 - 2, false, false, 1); ctx.restore();
    } catch (e) { /* a creature with an unusual sprite plan simply has no portrait */ }
  },
};

// ======================================================= TROPHIES =====================================================
const PAGES = [...CATS.map((c) => c.id), 'style', 'records'];
const trophy = {
  u_TROPHY(inp, s) {
    const g = this.g;
    if (inp.pressed('left')) { s.sub = (s.sub + PAGES.length - 1) % PAGES.length; s.i = 0; g.audio.sfx('tick'); }
    if (inp.pressed('right')) { s.sub = (s.sub + 1) % PAGES.length; s.i = 0; g.audio.sfx('tick'); }
    const page = PAGES[s.sub];
    if (page === 'style') return this.styleNav(inp, s);
    if (page !== 'records') listNav(this, inp, s, ACHIEVEMENTS.filter((a) => a.cat === page).length);
  },
  d_TROPHY(ctx, s) {
    const g = this.g, A = g.systems.achievements, page = PAGES[s.sub];
    PAGES.forEach((p, i) => { const c = CATS.find((x) => x.id === p); button(ctx, c ? c.short : p === 'style' ? 'Style' : 'Records', 8 + i * 64, 20, 62, 14, i === s.sub); });
    const pts = `${A.count()}/${A.total()}   ${A.points()} pts`; text(ctx, pts, 472 - textWidth(pts), 38, COL.gold);
    if (page === 'records') return this.drawRecords(ctx);
    if (page === 'style') return this.drawStyle(ctx, s);
    const list = ACHIEVEMENTS.filter((a) => a.cat === page), cx = A.context();
    panel(ctx, 8, 46, 230, 204); panel(ctx, 244, 46, 228, 204);
    listRows(ctx, 10, 52, 226, list, s.i, 14, 14, (a, i, y, on) => {
      const d = A.describe(a, cx), tier = TIERS[a.tier];
      ctx.fillStyle = d.got ? tier.color : '#2a3a58'; ctx.fillRect(14, y + 1, 8, 8); if (d.got) drawTrophyGlyph(ctx, 18, y + 5, '#05030a', a.cat);
      text(ctx, d.name, 28, y + 1, on ? '#ffffff' : d.got ? COL.text : COL.dim);
      if (!d.got && d.frac > 0) { bar(ctx, 190, y + 3, 40, 3, d.frac, '#3a8ae8', '#8ad0ff', '#0a1a3a'); }
    });
    const a = list[s.i]; if (!a) return;
    const d = A.describe(a, cx), tier = TIERS[a.tier];
    ctx.fillStyle = tier.color; ctx.fillRect(252, 54, 24, 24); ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(255, 57, 18, 18); drawTrophyGlyph(ctx, 264, 66, tier.color, a.cat);
    text(ctx, d.name, 284, 56, d.got ? COL.gold : COL.text); text(ctx, `${tier.name} - ${tier.pts} pts`, 284, 67, tier.color);
    wrapText(d.desc, 214).forEach((l, i) => text(ctx, l, 252, 90 + i * 10, COL.text));
    const y = 90 + wrapText(d.desc, 214).length * 10 + 10;
    if (d.got) { const at = g.state.trophies[a.id]?.at; text(ctx, 'EARNED' + (at ? `  at ${fmtSecs(Math.floor(at / 60))} played` : ''), 252, y, COL.green); }
    else if (!(a.hidden)) { bar(ctx, 252, y + 2, 140, 5, d.frac, '#3a8ae8', '#8ad0ff', '#0a1a3a'); text(ctx, `${d.now} / ${a.goal}`, 398, y, COL.dim); }
  },
  styleRows() { const C = this.g.systems.cosmetics; return [...C.titles().map((t) => ({ kind: 'title', ...t })), ...C.trails().map((t) => ({ kind: 'trail', ...t }))]; },
  styleNav(inp, s) {
    const g = this.g, rows = this.styleRows(); listNav(this, inp, s, rows.length);
    if (inp.pressed('confirm')) { const r = rows[s.i]; if (!r.owned) { g.audio.sfx('deny'); this.say('Locked: earn the trophy first'); } else { g.systems.cosmetics.equip(r.kind, r.id); g.audio.sfx('select'); this.say(`${r.kind === 'title' ? 'Title' : 'Wake'}: ${r.name}`); } }
  },
  drawStyle(ctx, s) {
    const g = this.g, C = g.systems.cosmetics, rows = this.styleRows(), pick = C.pick, n = C.counts();
    panel(ctx, 8, 46, 230, 204); panel(ctx, 244, 46, 228, 204);
    listRows(ctx, 10, 52, 226, rows, s.i, 14, 14, (r, i, y, on) => {
      const cur = pick[r.kind] === r.id; text(ctx, (r.kind === 'title' ? 'T ' : 'W ') + r.name, 16, y + 1, on ? '#ffffff' : r.owned ? COL.text : '#506080');
      if (cur) text(ctx, 'ON', 232 - textWidth('ON'), y + 1, COL.green); else if (!r.owned) text(ctx, 'locked', 232 - textWidth('locked'), y + 1, '#506080');
    });
    const r = rows[s.i]; text(ctx, r.kind === 'title' ? 'TITLE' : 'WAKE', 252, 52, COL.gold); text(ctx, r.name, 252, 64, '#ffffff');
    if (r.by) { const a = ACHIEVEMENTS.find((x) => x.id === r.by); text(ctx, r.owned ? 'Unlocked by:' : 'Earned by:', 252, 82, COL.dim); text(ctx, a ? a.name : r.by, 252, 92, r.owned ? COL.green : COL.text); if (a) wrapText(a.hidden && !r.owned ? 'A hidden trophy.' : a.desc, 214).forEach((l, i) => text(ctx, l, 252, 104 + i * 10, COL.dim)); }
    else text(ctx, 'Always available.', 252, 82, COL.dim);
    if (r.kind === 'trail') { const T = r; for (let i = 0; i < 18; i++) { const c = T.colors[i % T.colors.length]; ctx.fillStyle = c; const t = (this.t * 30 + i * 11) % 120; ctx.globalAlpha = 1 - t / 120; ctx.fillRect(260 + t, 170 + Math.round(Math.sin(i * 1.7 + this.t * 3) * 6), T.size || 2, T.size || 2); } ctx.globalAlpha = 1; }
    const l = `Titles ${n.titles[0]}/${n.titles[1]}   Wakes ${n.trails[0]}/${n.trails[1]}`; text(ctx, l, 252, 232, COL.dim);
  },
  drawRecords(ctx) {
    const g = this.g, st = g.systems.stats, rec = g.state.records;
    panel(ctx, 8, 46, 230, 204); panel(ctx, 244, 46, 228, 204);
    text(ctx, 'LIFETIME', 16, 52, COL.gold);
    st.summary().forEach(([k, v], i) => { const y = 66 + i * 14; text(ctx, k, 16, y, COL.dim); const s = String(v); text(ctx, s, 232 - textWidth(s), y, COL.text); });
    text(ctx, 'HABITS', 252, 52, COL.gold);
    const fav = st.favouriteBiome(), dead = st.deadliest(), play = Math.floor(g.state.playtime / 60);
    const lines = [
      ['Time played', `${Math.floor(play / 60)}h ${play % 60}m`], ['Favourite realm', fav ? fav : '--'], ['Deadliest foe', dead ? nameOf(dead) : '--'],
      ['Zones seen', `${st.zonesSeen()}/${Object.keys(ZONE_INFO).length}`], ['Things crafted', rec.crafted], ['Longest swim', `${Math.round(rec.swim / 16)} tiles`],
      ['Trophies', `${g.systems.achievements.count()}/${g.systems.achievements.total()}`], ['Recipes known', `${g.systems.crafting.knownCount()}/${RECIPES.length}`],
    ];
    lines.forEach(([k, v], i) => { const y = 66 + i * 14; text(ctx, k, 252, y, COL.dim); const s = String(v); text(ctx, s, 466 - textWidth(s), y, COL.text); });
    const best = Object.entries(rec.bossBest).sort((a, b) => a[1] - b[1]).slice(0, 4);
    if (best.length) { text(ctx, 'FASTEST BOSSES', 252, 186, COL.gold); best.forEach(([k, t], i) => { text(ctx, nameOf(k), 252, 198 + i * 11, COL.dim); const s = fmtSecs(t); text(ctx, s, 466 - textWidth(s), 198 + i * 11, COL.text); }); }
  },
};

// ======================================================= KITCHEN ======================================================
const craft = {
  craftRows() { return RECIPES; },
  u_CRAFT(inp, s) {
    const g = this.g, cr = g.systems.crafting, rows = this.craftRows();
    s.qty = s.qty || 1;
    listNav(this, inp, s, rows.length);
    if (inp.pressed('left')) { s.qty = s.qty === 1 ? 5 : s.qty === 5 ? 99 : 1; g.audio.sfx('tick'); }
    if (inp.pressed('right')) { s.qty = s.qty === 1 ? 99 : s.qty === 99 ? 5 : 1; g.audio.sfx('tick'); }
    if (inp.pressed('confirm')) {
      const r = rows[s.i];
      if (!cr.known(r.id)) { g.audio.sfx('deny'); this.say('You have not learned this recipe'); return; }
      if (!cr.have(r)) { g.audio.sfx('deny'); this.say('Missing ingredients'); return; }
      const n = Math.min(s.qty, cr.maxBatches(r)); const made = cr.craft(r.id, n);
      this.say(made ? `Made ${ITEMS[r.out].name}${made > 1 ? ' x' + made : ''}` : 'Could not cook that');
    }
  },
  d_CRAFT(ctx, s) {
    const g = this.g, cr = g.systems.crafting, rows = this.craftRows();
    panel(ctx, 8, 20, 190, 230); panel(ctx, 204, 20, 268, 230);
    listRows(ctx, 10, 26, 186, rows, s.i, 16, 14, (r, i, y, on) => {
      const known = cr.known(r.id), can = known && cr.have(r);
      ctx.globalAlpha = known ? 1 : 0.25; ctx.drawImage(itemIcon(r.out), 12, y - 3, 12, 12); ctx.globalAlpha = 1;
      text(ctx, known ? ITEMS[r.out].name : '???', 28, y + 1, on ? '#ffffff' : can ? COL.green : known ? COL.text : '#506080');
      if (can) text(ctx, 'x' + Math.min(99, cr.maxBatches(r)), 192 - textWidth('x' + cr.maxBatches(r)), y + 1, COL.dim);
    });
    const r = rows[s.i], known = cr.known(r.id), out = ITEMS[r.out];
    if (!known) {
      text(ctx, 'Unknown recipe', 212, 28, '#506080');
      wrapText('Gather the ingredients creatures leave behind. A recipe is learned the first time you have held everything it needs.', 252).forEach((l, i) => text(ctx, l, 212, 44 + i * 10, COL.dim));
      text(ctx, 'It uses:', 212, 100, COL.dim);
      Object.keys(r.needs).forEach((id, i) => { const seen = g.state.kitchen?.seen[id]; text(ctx, seen ? ITEMS[id].name : '???', 220, 112 + i * 12, seen ? COL.text : '#506080'); });
    } else {
      ctx.drawImage(itemIcon(r.out), 212, 26, 16, 16); text(ctx, out.name + (r.n > 1 ? ` x${r.n}` : ''), 234, 28, COL.gold);
      text(ctx, out.type === 'dish' ? 'Dish' : 'Tonic', 234, 39, COL.dim);
      wrapText(out.desc, 252).forEach((l, i) => text(ctx, l, 212, 54 + i * 10, COL.text));
      let y = 54 + wrapText(out.desc, 252).length * 10 + 6;
      const effects = [];
      const u = out.use || {};
      if (u.heal) effects.push(`Heals ${Math.round(u.heal * 100)}% health`); if (u.tide) effects.push(`Restores ${Math.round(u.tide * 100)}% Tide`); if (u.fury) effects.push(`+${u.fury} Fury`); if (u.cleanse) effects.push('Cleanses harmful effects');
      for (const b of u.buffs || []) effects.push(`${STATUS[b.id].name} for ${b.dur}s`);
      effects.forEach((e, i) => text(ctx, '+ ' + e, 212, y + i * 10, '#9ad8ff')); y += effects.length * 10 + 8;
      text(ctx, 'INGREDIENTS', 212, y, COL.gold); y += 11;
      Object.entries(r.needs).forEach(([id, n], i) => {
        const have = g.itemCount(id), ok = have >= n; ctx.drawImage(itemIcon(id), 214, y + i * 14 - 3, 12, 12);
        text(ctx, ITEMS[id].name, 230, y + i * 14, ok ? COL.text : '#8a6070'); const s2 = `${have}/${n}`; text(ctx, s2, 466 - textWidth(s2), y + i * 14, ok ? COL.green : COL.red);
      });
      text(ctx, r.note, 212, 214, '#7a90b0');
      text(ctx, `ENTER: cook x${Math.min(s.qty || 1, Math.max(1, cr.maxBatches(r))) }   ◀ ▶ amount (${s.qty === 99 ? 'max' : s.qty || 1})`, 212, 238, cr.have(r) ? COL.green : COL.dim);
    }
    const lbl = `${cr.knownCount()}/${rows.length} recipes`; text(ctx, lbl, 192 - textWidth(lbl), 238, COL.dim);
  },
};

// ======================================================= MAP: completion and shrine travel =============================================
const zoneCache = {};
function zoneTotals(id) {
  if (zoneCache[id]) return zoneCache[id];
  const z = buildZone(id), chests = z.props.filter((p) => p.type === 'chest' && !p.small), murals = z.props.filter((p) => p.type === 'mural'), forage = z.props.filter((p) => p.type === 'forage');
  return (zoneCache[id] = { chests: chests.map((p) => p.key || `${id}:chest:${Math.round(p.x)}:${Math.round(p.y)}`), murals: murals.map((p) => p.codex), forage: forage.length, boss: ZONE_INFO[id].boss || null });
}
const mapx = {
  mapList() { return Object.keys(ZONE_INFO).filter((id) => this.g.state.visited[id]).sort((a, b) => ZONE_INFO[a].map.x - ZONE_INFO[b].map.x || ZONE_INFO[a].map.y - ZONE_INFO[b].map.y); },
  travelNav(inp, s) {
    const g = this.g, T = g.systems.travel, list = this.mapList(); if (!list.length) return;
    s.i = clamp(s.i ?? 0, 0, list.length - 1);
    if (inp.pressed('left') || inp.pressed('up')) { s.i = (s.i + list.length - 1) % list.length; g.audio.sfx('tick'); }
    if (inp.pressed('right') || inp.pressed('down')) { s.i = (s.i + 1) % list.length; g.audio.sfx('tick'); }
    if (inp.pressed('confirm')) { const id = list[s.i]; if (!T.shrines[id]) { g.audio.sfx('deny'); this.say('No shrine known here yet'); return; } const why = T.blocked(); if (why) { g.audio.sfx('deny'); this.say(why); } else T.go(id); }
  },
  zoneCompletion(id) {
    const g = this.g, tot = zoneTotals(id), zs = g.state.zones[id] || {}, opened = zs.opened || {};
    const fog = typeof zs.fog === 'string' ? zs.fog : '', seen = fog ? fog.split('').filter((c) => c === '1').length / fog.length : 0;
    return { chests: [tot.chests.filter((k) => opened[k]).length, tot.chests.length], murals: [tot.murals.filter((c) => g.state.codex[c]).length, tot.murals.length], forage: tot.forage, boss: tot.boss, bossDown: tot.boss ? !!g.state.bosses[tot.boss] : false, explored: seen };
  },
  drawTravel(ctx, s) {
    const g = this.g, T = g.systems.travel, list = this.mapList(), cur = g.world.zone.id;
    text(ctx, 'Red = boss   Pink = shrine   Flashing = you', 14, 238, COL.dim);
    if (!list.length) return;
    const cw = 46, ch = 24, gx = 22, gy = 20;
    for (const id of Object.keys(T.shrines)) {
      if (!ZONE_INFO[id]) continue; const m = ZONE_INFO[id].map, x = 28 + m.x * (cw + gx), y = 40 + m.y * (ch + gy);
      ctx.fillStyle = '#ff9ad8'; ctx.fillRect(x + cw - 7, y + 2, 5, 5); ctx.fillStyle = '#05030a'; ctx.fillRect(x + cw - 6, y + 3, 3, 3); ctx.fillStyle = '#ffd8f0'; ctx.fillRect(x + cw - 5, y + 4, 1, 1);
    }
    const id = list[s.i = clamp(s.i ?? 0, 0, list.length - 1)], m = ZONE_INFO[id].map, x = 28 + m.x * (cw + gx), y = 40 + m.y * (ch + gy);
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1; ctx.strokeRect(x - 2.5, y - 2.5, cw + 5, ch + 5);
    // detail strip: what is left to find here
    const c = this.zoneCompletion(id), here = id === cur, why = T.blocked(), shrine = !!T.shrines[id];
    panel(ctx, 8, 198, 464, 36, { alpha: 0.85 });
    text(ctx, `${ZONE_INFO[id].name}${here ? '  (here)' : ''}`, 14, 202, '#ffffff'); text(ctx, BIOMES[ZONE_INFO[id].biome].name, 14, 212, COL.dim);
    const bits = [`Explored ${Math.round(c.explored * 100)}%`, `Chests ${c.chests[0]}/${c.chests[1]}`, `Murals ${c.murals[0]}/${c.murals[1]}`]; if (c.forage) bits.push(`Forage ${c.forage}`); if (c.boss) bits.push(c.bossDown ? 'Guardian defeated' : 'Guardian waits');
    bits.forEach((b, i) => text(ctx, b, 150 + (i % 3) * 100, 202 + Math.floor(i / 3) * 10, b.startsWith('Guardian w') ? '#ff8a7a' : b.endsWith('defeated') ? COL.green : (b.includes('/') && b.split(' ')[1].split('/')[0] === b.split('/')[1]) ? COL.green : COL.text));
    text(ctx, shrine ? (here ? 'You are at this shrine zone' : why ? why : 'ENTER: swim to this shrine') : 'No shrine known here', 14, 224, shrine && !why && !here ? COL.green : '#7a90b0');
  },
};

// ======================================================= EQUIPMENT SETS (items tab) ==================================
const sets = {
  // the set a piece belongs to: pieces worn, and what the two bonuses are
  drawSetInfo(ctx, id, x, y) {
    const sid = SET_OF[id]; if (!sid) return;
    const S = SETS[sid], worn = Object.values(this.g.state.equip), n = S.pieces.filter((p) => worn.includes(p)).length;
    text(ctx, `${S.name} set  ${n}/3`, x, y, n >= 2 ? COL.gold : COL.dim);
    text(ctx, `2: ${S.two.text}`, x, y + 10, n >= 2 ? COL.green : '#506080'); text(ctx, `3: ${S.three.text}`, x, y + 20, n >= 3 ? COL.green : '#506080');
  },
};

// ======================================================= EXTRAS: equipment comparison and skill reset ===================================
const CMP = [['maxHp', 'Health', 1], ['atk', 'Attack', 1], ['def', 'Defence', 1], ['speed', 'Speed', 100], ['crit', 'Crit %', 100], ['tideRegen', 'Tide regen', 10], ['maxTide', 'Tide', 1], ['coinBonus', 'Coins %', 100], ['magnet', 'Reach', 1], ['heatResist', 'Heat %', 100]];
const extras = {
  // how the selected piece of gear would change the swimmer's numbers; returns the number of lines drawn
  drawCompare(ctx, id, x, y) {
    const it = ITEMS[id]; if (!it || it.type !== 'equip') return 0;
    const st = this.g.state; if (st.equip[it.slot] === id) return 0;
    const cur = computeStats(st), nxt = computeStats({ ...st, equip: { ...st.equip, [it.slot]: id } });
    let n = 0;
    for (const [k, label, mul] of CMP) {
      const d = (nxt[k] - cur[k]) * mul; if (Math.abs(d) < 0.05) continue;
      const s = `${label} ${d > 0 ? '+' : ''}${Math.abs(d) < 10 ? d.toFixed(1) : Math.round(d)}`; text(ctx, s, x + (n % 2) * 100, y + Math.floor(n / 2) * 10, d > 0 ? COL.green : COL.red); n++; if (n >= 8) break;
    }
    return Math.ceil(n / 2);
  },
  // R in the skills tab: reset skills for a fee
  respecNav(inp, s) {
    const g = this.g, st = g.state;
    if (s.confirmRespec) {
      if (inp.pressed('confirm')) { s.confirmRespec = false; if (respec(st)) { g.world.player.recalc(); g.audio.sfx('revive'); this.say('Skills reset'); } else { g.audio.sfx('deny'); this.say('Not enough coins'); } }
      else if (inp.rawPressed('KeyN')) { s.confirmRespec = false; g.audio.sfx('back'); }
      return true;
    }
    if (inp.rawPressed('KeyR')) { if (!Object.keys(st.skills).length) { g.audio.sfx('deny'); this.say('No skills to reset'); } else { s.confirmRespec = true; g.audio.sfx('select'); } return true; }
    return false;
  },
  drawRespec(ctx, s) {
    const st = this.g.state, cost = respecCost(st);
    text(ctx, cost ? `R: reset skills (${cost} coins)` : 'R: reset skills (free for now)', 472 - textWidth(cost ? `R: reset skills (${cost} coins)` : 'R: reset skills (free for now)'), 20, '#7a90b0');
    if (s.confirmRespec) { panel(ctx, 110, 112, 260, 44, { border: '#ffb070' }); text(ctx, `Refund all skill points for ${cost} coins?`, 120, 120, '#ffd8a0'); text(ctx, 'ENTER = yes    N = no', 120, 136, COL.dim); }
  },
};

export function installMenuExtras(Menu) { Object.assign(Menu.prototype, beast, trophy, craft, mapx, sets, extras); }
