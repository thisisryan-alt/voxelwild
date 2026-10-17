// The main menu: Status, Skills, Abilities, Evolution, Items, Quests, Map, Codex.
import { panel, bar, text, button, COL, drawText, textWidth, wrapText } from './ui.js';
import { SKILLS, SKILL_BRANCHES } from '../data/skills.js';
import { ABILITIES, ULTS } from '../combat/abilities.js';
import { FORMS, BRANCHES, EVOLUTIONS, FORM_ORDER, xpToNext } from '../data/forms.js';
import { ITEMS, DYES } from '../data/items.js';
import { QUESTS } from '../data/quests.js';
import { LORE, LORE_CATS } from '../data/lore.js';
import { ZONE_INFO, ZONE_LINKS } from '../data/zoneinfo.js';
import { BIOMES } from '../data/biomes.js';
import { canBuySkill, buySkill, stageOf } from '../systems/progression.js';
import { abilityIcon, itemIcon, formIcon } from '../gfx/sprites_ui.js';
import { playerFrame, variantFor } from '../gfx/sprites_player.js';
import { drawFrame } from '../entities/entity.js';

import { EXTRA_TABS, installMenuExtras } from './menu_extra.js';

const TABS = ['STATUS', 'SKILLS', 'ABILITIES', 'EVOLUTION', 'ITEMS', 'QUESTS', 'MAP', 'CODEX', ...EXTRA_TABS];
const TAB_LABEL = { SKILLS: 'SKILL', ABILITIES: 'ABIL', EVOLUTION: 'EVOLVE', QUESTS: 'QUEST' };
const fmtTime = (s) => `${Math.floor(s / 3600)}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}`;

export class MenuScene {
  constructor(game, tab = 0) {
    this.g = game; this.opaque = true; this.tab = typeof tab === 'string' ? TABS.indexOf(tab.toUpperCase()) : tab; if (this.tab < 0) this.tab = 0;
    this.t = 0; this.sel = {}; for (const n of TABS) this.sel[n] = { i: 0, j: 0, sub: 0, scroll: 0 };
    this.msg = null; this.msgT = 0;
  }
  onEnter() { this.g.audio.sfx('select'); this.g.audio.setMuffle?.(0.5); }
  onExit() { this.g.audio.setMuffle?.(0); }
  say(m) { this.msg = m; this.msgT = 2; }
  update(dt) {
    const g = this.g, inp = g.input; this.t += dt; this.msgT -= dt;
    if (inp.pressed('cancel') || inp.pressed('menu') || inp.pressed('pause')) { g.audio.sfx('back'); g.engine.pop(); return; }
    if (inp.pressed('tabL')) { this.tab = (this.tab + TABS.length - 1) % TABS.length; g.audio.sfx('tick'); this.msgT = 0; return; }
    if (inp.pressed('tabR')) { this.tab = (this.tab + 1) % TABS.length; g.audio.sfx('tick'); this.msgT = 0; return; }
    this['u_' + TABS[this.tab]](inp, this.sel[TABS[this.tab]]);
  }
  draw(ctx) {
    ctx.fillStyle = '#071226'; ctx.fillRect(0, 0, 480, 270);
    const g1 = ctx.createLinearGradient(0, 0, 0, 270); g1.addColorStop(0, '#0e2a4a'); g1.addColorStop(1, '#040a18'); ctx.fillStyle = g1; ctx.fillRect(0, 0, 480, 270);
    for (let i = 0; i < 14; i++) { const x = (i * 71 + this.t * 6 * (1 + (i % 3))) % 500 - 10, y = 270 - ((this.t * 14 * (1 + (i % 4) * 0.5) + i * 53) % 290); ctx.fillStyle = 'rgba(160,220,255,0.25)'; ctx.fillRect(Math.round(x), Math.round(y), 2, 2); }
    // tabs
    const tw = 456 / TABS.length, tx0 = 12;
    TABS.forEach((n, i) => { const sel = i === this.tab, x = tx0 + i * tw; ctx.fillStyle = sel ? '#1e4a7a' : '#0c1830'; ctx.fillRect(x, 0, tw - 1, 16); ctx.fillStyle = sel ? COL.borderLit : '#2a3a58'; ctx.fillRect(x, 15, tw - 1, 1); const lb = TAB_LABEL[n] || n; text(ctx, lb, x + tw / 2 - textWidth(lb) / 2, 4, sel ? '#ffffff' : COL.dim); });
    text(ctx, 'Q', 3, 4, '#6a9ad0'); text(ctx, 'E', 472, 4, '#6a9ad0');
    this['d_' + TABS[this.tab]](ctx, this.sel[TABS[this.tab]]);
    // footer
    text(ctx, 'Q/E: tabs   Arrows: move   ENTER: select   ESC: close', 8, 259, COL.dim);
    if (this.msgT > 0 && this.msg) { const w = textWidth(this.msg) + 14; panel(ctx, 240 - w / 2, 236, w, 14, { border: COL.gold }); text(ctx, this.msg, 247 - w / 2, 240, COL.gold); }
  }

  // ===================== STATUS =====================
  u_STATUS(inp, s) {
    const st = this.g.state, owned = ['default', ...Object.keys(DYES).filter((k) => k !== 'default' && st.dyes?.[DYES[k]?.item])];
    if (owned.length > 1) { const i = owned.indexOf(st.dye); if (inp.pressed('left')) { st.dye = owned[(i + owned.length - 1) % owned.length]; this.g.audio.sfx('tick'); } if (inp.pressed('right')) { st.dye = owned[(i + 1) % owned.length]; this.g.audio.sfx('tick'); } }
  }
  d_STATUS(ctx, s) {
    const g = this.g, st = g.state, p = g.world.player, S = p.stats, F = FORMS[st.form];
    panel(ctx, 8, 20, 200, 230);
    // showcase pool
    ctx.save(); ctx.beginPath(); ctx.rect(12, 24, 192, 110); ctx.clip();
    const gr = ctx.createLinearGradient(0, 24, 0, 134); gr.addColorStop(0, '#2a8ab8'); gr.addColorStop(1, '#0c3a6a'); ctx.fillStyle = gr; ctx.fillRect(12, 24, 192, 110);
    ctx.fillStyle = '#c89c5e'; ctx.fillRect(12, 116, 192, 18); ctx.fillStyle = '#eecb94'; ctx.fillRect(12, 116, 192, 3);
    const f = playerFrame(st.form, variantFor(st), 'idle', Math.floor(this.t * 4) % 4);
    drawFrame(ctx, f, 108, 118 + (F.stage >= 3 ? -8 : 0));
    ctx.restore();
    text(ctx, F.name, 14, 138, COL.gold); text(ctx, F.epithet, 14, 148, COL.dim);
    wrapText(F.blurb, 188).forEach((l, i) => text(ctx, l, 14, 162 + i * 10, COL.text));
    const owned = Object.keys(DYES).filter((k) => k !== 'default' && st.dyes?.[DYES[k]?.item]);
    if (owned.length) text(ctx, `◀ Mutation: ${st.dye} ▶`, 14, 238, '#ff9ad8');
    panel(ctx, 214, 20, 258, 230);
    const row = (i, k, v, c = COL.text) => { text(ctx, k, 222, 26 + i * 10, COL.dim); text(ctx, String(v), 464 - textWidth(String(v)), 26 + i * 10, c); };
    row(0, 'Level', st.level, COL.gold); row(1, 'Health', `${Math.ceil(p.hp)} / ${S.maxHp}`, '#ff8a7a'); row(2, 'Tide', `${Math.floor(p.tide)} / ${S.maxTide}`, '#8ad0ff');
    row(3, 'Attack', S.atk.toFixed(1)); row(4, 'Defence', S.def.toFixed(1)); row(5, 'Critical', Math.round(S.crit * 100) + '%'); row(6, 'Speed', (S.speed >= 1 ? '+' : '') + Math.round((S.speed - 1) * 100) + '%');
    row(7, 'Pressure resistance', S.pressure); row(8, 'Poise', Math.round(S.poise)); row(9, 'Strokes', F.move.free ? 'free swim' : S.strokes);
    bar(ctx, 222, 140, 242, 5, st.xp / xpToNext(st.level), '#3a8ae8', '#8ad0ff', '#0a1a3a'); text(ctx, `XP ${st.xp} / ${xpToNext(st.level)}`, 222, 148, COL.dim);
    row(14, 'Evolution Points', st.ep, '#ff9ad8'); row(15, 'Skill Points', st.sp, '#9ad8ff'); row(16, 'Coins', st.coins, COL.gold);
    row(17, 'Enemies defeated', st.stats.kills); row(18, 'Times fallen', st.stats.deaths); row(19, 'Secrets found', g.systems.codex.count() + ' / ' + g.systems.codex.total()); row(20, 'Play time', fmtTime(st.playtime));
    const br = Object.values(st.branches).map((b) => BRANCHES[b]); if (br.length) { br.forEach((b, i) => text(ctx, '• ' + b.name + ': ' + b.trait, 222, 98 + i * 10, '#ffd84a')); }
  }

  // ===================== SKILLS =====================
  u_SKILLS(inp, s) {
    const keys = Object.keys(SKILL_BRANCHES), g = this.g;
    if (inp.pressed('left')) { s.i = (s.i + 7) % 8; g.audio.sfx('tick'); } if (inp.pressed('right')) { s.i = (s.i + 1) % 8; g.audio.sfx('tick'); }
    if (inp.pressed('up')) { s.j = (s.j + 4) % 5; g.audio.sfx('tick'); } if (inp.pressed('down')) { s.j = (s.j + 1) % 5; g.audio.sfx('tick'); }
    if (inp.pressed('confirm')) {
      const id = this.nodeAt(s);
      if (id) { if (buySkill(g.state, id)) { g.audio.sfx('levelup'); g.world.player.recalc(); this.say('Learned ' + SKILLS[id].name); } else { g.audio.sfx('deny'); this.say(g.state.skills[id] ? 'Already learned' : 'Cannot learn yet'); } }
    }
  }
  nodeAt(s) { const b = Object.keys(SKILL_BRANCHES)[s.i >> 1], col = s.i & 1; return Object.keys(SKILLS).find((k) => SKILLS[k].branch === b && SKILLS[k].col === col && SKILLS[k].row === s.j); }
  d_SKILLS(ctx, s) {
    const st = this.g.state; const bs = Object.keys(SKILL_BRANCHES);
    text(ctx, `Skill Points: ${st.sp}`, 10, 20, '#9ad8ff'); text(ctx, 'Earned by levelling (1/level) and by defeating bosses.', 120, 20, COL.dim);
    bs.forEach((b, bi) => {
      const x0 = 8 + bi * 116, B = SKILL_BRANCHES[b];
      panel(ctx, x0, 32, 112, 150, { border: B.color }); text(ctx, B.name + ' — ' + B.desc, x0 + 6, 36, B.color);
      const pos = (n) => [x0 + 18 + n.col * 48, 52 + n.row * 26];
      for (const [id, n] of Object.entries(SKILLS)) { if (n.branch !== b) continue; for (const r of n.req) { const a = pos(SKILLS[r]), c = pos(n); ctx.fillStyle = st.skills[r] && st.skills[id] ? B.color : '#2a3a58'; ctx.fillRect(a[0] + 9, a[1] + 18, 1, c[1] - a[1] - 18); if (a[0] !== c[0]) ctx.fillRect(Math.min(a[0], c[0]) + 9, c[1] - 4, Math.abs(a[0] - c[0]) + 1, 1); ctx.fillRect(c[0] + 9, c[1] - 4, 1, 4); } }
      for (const [id, n] of Object.entries(SKILLS)) {
        if (n.branch !== b) continue; const [x, y] = pos(n), own = st.skills[id], can = canBuySkill(st, id), sel = (s.i >> 1) === bi && (s.i & 1) === n.col && s.j === n.row;
        panel(ctx, x, y, 20, 20, { fill: own ? '#3a3010' : can ? '#10284a' : '#0a1020', border: sel ? '#ffffff' : own ? COL.gold : can ? B.color : '#2a3a58' });
        ctx.globalAlpha = own || can ? 1 : 0.35; ctx.drawImage(abilityIcon(n.ability ? ABILITIES[n.ability].icon : ({ claw: 'blade', shell: 'shell', current: 'dash', tide: 'pearl' })[b]), x + 3, y + 3); ctx.globalAlpha = 1;
        if (!own) text(ctx, String(n.cost), x + 13, y + 12, can ? '#ffffff' : '#506080', { shadow: '#000' });
        if (sel) { ctx.strokeStyle = '#ffffff'; ctx.strokeRect(x - 1.5, y - 1.5, 23, 23); }
      }
    });
    const id = this.nodeAt(s), n = id && SKILLS[id];
    panel(ctx, 8, 188, 464, 62);
    if (n) {
      const own = st.skills[id]; text(ctx, n.name, 16, 194, own ? COL.gold : '#ffffff'); text(ctx, own ? 'LEARNED' : `Cost: ${n.cost} SP`, 464 - textWidth(own ? 'LEARNED' : `Cost: ${n.cost} SP`), 194, own ? COL.green : COL.blue);
      wrapText(n.desc, 440).forEach((l, i) => text(ctx, l, 16, 206 + i * 10, COL.text));
      const need = []; for (const r of n.req) if (!st.skills[r]) need.push(SKILLS[r].name); if (n.minStage && stageOf(st) < n.minStage) need.push(`Evolution stage ${n.minStage}`);
      if (need.length && !own) text(ctx, 'Requires: ' + need.join(', '), 16, 236, '#ff9a7a');
      else if (!own) text(ctx, st.sp >= n.cost ? 'ENTER to learn' : 'Not enough Skill Points', 16, 236, st.sp >= n.cost ? COL.green : '#ff9a7a');
    }
  }

  // ===================== ABILITIES =====================
  u_ABILITIES(inp, s) {
    const st = this.g.state, list = st.abilities, F = FORMS[st.form];
    if (inp.pressed('up')) { s.i = (s.i + list.length - 1) % Math.max(1, list.length); this.g.audio.sfx('tick'); } if (inp.pressed('down')) { s.i = (s.i + 1) % Math.max(1, list.length); this.g.audio.sfx('tick'); }
    for (let k = 0; k < 3; k++) {
      if (inp.pressed('ab' + (k + 1)) || (inp.pressed('left') && false)) {
        const id = list[s.i]; if (!id) continue; if (k >= F.abilitySlots) { this.say('Slot locked until a later evolution'); this.g.audio.sfx('deny'); continue; }
        for (let j = 0; j < 3; j++) if (st.slots[j] === id) st.slots[j] = null; st.slots[k] = id; this.g.audio.sfx('select'); this.say(`${ABILITIES[id].name} -> slot ${k + 1}`);
      }
    }
    if (inp.pressed('confirm')) { const id = list[s.i]; if (id) { const free = [0, 1, 2].filter((k) => k < F.abilitySlots).find((k) => !st.slots[k]); if (free !== undefined) { st.slots[free] = id; this.g.audio.sfx('select'); } else this.say('Press 1, 2 or 3 to assign a slot'); } }
  }
  d_ABILITIES(ctx, s) {
    const st = this.g.state, F = FORMS[st.form], list = st.abilities;
    panel(ctx, 8, 20, 200, 230); text(ctx, 'Learned Abilities', 16, 25, COL.gold);
    if (!list.length) text(ctx, 'None yet. Learn them in the\nSkills tab, or by molting.', 16, 40, COL.dim);
    list.forEach((id, i) => { const y = 38 + i * 22, sel = i === s.i; if (sel) { ctx.fillStyle = '#1e4a7a'; ctx.fillRect(10, y - 2, 196, 20); } ctx.drawImage(abilityIcon(ABILITIES[id].icon), 14, y); text(ctx, ABILITIES[id].name, 34, y + 3, sel ? '#fff' : COL.text); const slot = st.slots.indexOf(id); if (slot >= 0) text(ctx, `[${slot + 1}]`, 184, y + 3, COL.gold); });
    panel(ctx, 214, 20, 258, 230);
    const id = list[s.i];
    if (id) { const a = ABILITIES[id]; text(ctx, a.name, 222, 25, COL.gold); text(ctx, `Tide ${a.cost}   Cooldown ${a.cd}s`, 222, 37, COL.blue); wrapText(a.desc, 240).forEach((l, i) => text(ctx, l, 222, 52 + i * 10, COL.text)); }
    text(ctx, 'Equipped', 222, 120, COL.gold);
    for (let k = 0; k < 3; k++) { const x = 222 + k * 50; const locked = k >= F.abilitySlots; panel(ctx, x, 134, 44, 44, { border: locked ? '#2a3a58' : COL.border }); if (!locked && st.slots[k]) { ctx.drawImage(abilityIcon(ABILITIES[st.slots[k]].icon), x + 15, y2(138)); } text(ctx, locked ? 'locked' : String(k + 1), x + 4, 166, locked ? '#506080' : '#9ad8ff'); }
    function y2(v) { return v; }
    const U = ULTS[st.form] || ULTS.shore; text(ctx, 'Ultimate (Q)', 222, 190, COL.gold); text(ctx, U.name, 222, 202, '#ffd8a0'); wrapText('Fury builds as you fight. At 100%, press Q. With an ability selected, press 1, 2 or 3 to assign it to that slot.', 244).forEach((l, i) => text(ctx, l, 222, 216 + i * 10, COL.dim));
  }

  // ===================== EVOLUTION =====================
  u_EVOLUTION(inp, s) { if (inp.pressed('left')) { s.i = Math.max(0, s.i - 1); this.g.audio.sfx('tick'); } if (inp.pressed('right')) { s.i = Math.min(5, s.i + 1); this.g.audio.sfx('tick'); } }
  d_EVOLUTION(ctx, s) {
    const st = this.g.state, ev = this.g.systems.evolution;
    const ids = [...FORM_ORDER, 'primordial']; const cur = st.form, curIdx = cur === 'primordial' ? 4 : FORM_ORDER.indexOf(cur);
    panel(ctx, 8, 20, 464, 70);
    ids.forEach((id, i) => {
      const x = 22 + i * 76, y = 38, F = FORMS[id], reached = id === 'primordial' ? st.form === 'primordial' : FORM_ORDER.indexOf(id) <= curIdx && !(st.form === 'primordial' && false), sec = id === 'primordial' && !ev.secretUnlocked('primordial') && st.form !== 'primordial';
      if (i > 0 && i < 5) { ctx.fillStyle = reached ? COL.gold : '#2a3a58'; ctx.fillRect(x - 30, y + 8, 18, 1); text(ctx, '→', x - 22, y + 4, reached ? COL.gold : '#2a3a58'); }
      if (i === 5) { ctx.fillStyle = '#6a4a9a'; ctx.fillRect(x - 30, y + 8, 18, 1); }
      panel(ctx, x - 4, y - 8, 36, 28, { fill: reached ? '#2a2810' : '#0a1020', border: s.i === i ? '#ffffff' : reached ? COL.gold : '#2a3a58' });
      ctx.globalAlpha = sec ? 0.25 : reached ? 1 : 0.5; if (sec) ctx.filter = 'brightness(0)'; ctx.drawImage(formIcon(id), x - 1, y - 4); ctx.filter = 'none'; ctx.globalAlpha = 1;
      text(ctx, sec ? '???' : F.name.split(' ')[0], x + 14 - textWidth(sec ? '???' : F.name.split(' ')[0]) / 2, y + 23, reached ? COL.gold : COL.dim);
    });
    const id = ids[s.i], F = FORMS[id], sec = id === 'primordial' && !ev.secretUnlocked('primordial') && st.form !== 'primordial';
    panel(ctx, 8, 96, 464, 154);
    if (sec) { text(ctx, '???', 16, 102, '#c0a0ff'); text(ctx, 'Some forms are not on any chart.\nSeven memories of the first sea might know more.', 16, 116, COL.dim); return; }
    text(ctx, F.name, 16, 102, COL.gold); text(ctx, F.epithet, 16 + textWidth(F.name) + 8, 102, COL.dim);
    wrapText(F.biology, 440).forEach((l, i) => text(ctx, l, 16, 116 + i * 10, COL.text));
    const unlocks = F.unlocks.join('  •  '); wrapText('Gains: ' + unlocks, 440).forEach((l, i) => text(ctx, l, 16, 148 + i * 10, '#9ad8ff'));
    const E = EVOLUTIONS[id];
    if (E && FORM_ORDER.concat(['primordial']).indexOf(id) > (curIdx) && E.from === cur) {
      text(ctx, 'Requirements', 16, 172, COL.gold);
      const r = ev.requirements(id, null); r.list.slice(0, 3).forEach((q, i) => { text(ctx, (q.ok ? '✓ ' : '• ') + q.label + (q.need ? `  (${q.have}/${q.need})` : ''), 16, 184 + i * 10, q.ok ? COL.green : '#ff9a7a'); });
      text(ctx, 'Molt at: ' + (id === 'warrior' ? "Grumbold's Den" : id === 'abyssal' ? "The Captain's Bridge" : id === 'leviathan' ? "Krael's Chain" : 'Apotheosis Shrine'), 16, 218, COL.blue);
      if (E.branches.length) text(ctx, 'Branches: ' + E.branches.map((b) => BRANCHES[b].name).join(' / '), 16, 230, '#ffd84a');
    } else if (E && E.from !== cur && id !== cur && FORM_ORDER.indexOf(id) > curIdx) text(ctx, 'A later molt. Keep growing.', 16, 172, COL.dim);
    else if (id === cur) text(ctx, 'Your current form.' + (BRANCHES[st.branches[id]] ? '  Branch: ' + BRANCHES[st.branches[id]].name : ''), 16, 172, COL.green);
  }

  // ===================== ITEMS =====================
  itemList(sub) {
    const st = this.g.state, inv = st.inv, list = [];
    const owned = Object.keys(inv).filter((id) => ITEMS[id]);
    if (sub === 0) for (const id of owned) if (['consumable', 'dish', 'ingredient', 'material'].includes(ITEMS[id].type)) list.push(id);
    if (sub === 1) for (const id of owned) if (ITEMS[id].type === 'equip') list.push(id);
    if (sub === 2) for (const id of st.mutOwned) list.push(id);
    if (sub === 3) for (const id of owned) if (['key', 'evo', 'lore'].includes(ITEMS[id].type)) list.push(id);
    return list;
  }
  u_ITEMS(inp, s) {
    const g = this.g, st = g.state, list = this.itemList(s.sub);
    if (inp.pressed('left')) { s.sub = (s.sub + 3) % 4; s.i = 0; g.audio.sfx('tick'); } if (inp.pressed('right')) { s.sub = (s.sub + 1) % 4; s.i = 0; g.audio.sfx('tick'); }
    if (inp.pressed('up')) { s.i = (s.i + list.length - 1) % Math.max(1, list.length); g.audio.sfx('tick'); } if (inp.pressed('down')) { s.i = (s.i + 1) % Math.max(1, list.length); g.audio.sfx('tick'); }
    s.i = Math.min(s.i, Math.max(0, list.length - 1));
    if (inp.pressed('confirm') && list[s.i]) {
      const id = list[s.i], it = ITEMS[id], p = g.world.player;
      if (it.type === 'consumable' || it.type === 'dish') {
        const why = g.systems.crafting.use(id); if (why) { g.audio.sfx('deny'); this.say(why); return; }
        this.say((it.type === 'dish' ? 'Ate ' : 'Used ') + it.name);
      } else if (it.type === 'equip') { st.equip[it.slot] = st.equip[it.slot] === id ? null : id; p.recalc(); g.audio.sfx('select'); this.say(st.equip[it.slot] ? 'Equipped ' + it.name : 'Unequipped'); }
      else if (it.type === 'mutation') {
        const i = st.mutations.indexOf(id); if (i >= 0) st.mutations.splice(i, 1); else if (st.mutations.length < FORMS[st.form].mutationSlots) st.mutations.push(id); else { this.say('No free mutation slot'); g.audio.sfx('deny'); return; }
        p.recalc(); g.audio.sfx('select'); this.say(i >= 0 ? 'Mutation removed' : 'Mutation active');
      }
    }
  }
  d_ITEMS(ctx, s) {
    const g = this.g, st = g.state, F = FORMS[st.form], list = this.itemList(s.sub);
    const subs = ['Supplies', 'Gear', 'Mutations', 'Key items'];
    subs.forEach((n, i) => button(ctx, n, 8 + i * 60, 20, 58, 14, i === s.sub));
    panel(ctx, 8, 38, 232, 154);
    if (!list.length) text(ctx, 'Nothing here yet.', 16, 46, COL.dim);
    const vis = 12, top = Math.max(0, Math.min(s.i - 6, list.length - vis));
    list.slice(top, top + vis).forEach((id, k) => {
      const i = top + k, y = 42 + k * 12, sel = i === s.i, it = ITEMS[id]; if (sel) { ctx.fillStyle = '#1e4a7a'; ctx.fillRect(10, y - 1, 228, 12); }
      ctx.drawImage(itemIcon(id), 10, y - 3, 12, 12);
      text(ctx, it.name, 26, y + 1, sel ? '#fff' : COL.text);
      const eq = st.equip.shell === id || st.equip.claw === id || st.equip.charm === id || st.mutations.includes(id); const cnt = st.inv[id] > 1 && it.type !== 'mutation' ? 'x' + st.inv[id] : eq ? 'E' : '';
      if (cnt) text(ctx, cnt, 234 - textWidth(cnt), y + 1, eq ? COL.gold : COL.dim);
    });
    panel(ctx, 246, 38, 226, 154);
    const id = list[s.i]; if (id) { const it = ITEMS[id]; ctx.drawImage(itemIcon(id), 252, 44); text(ctx, it.name, 272, 48, COL.gold); wrapText(it.desc, 214).forEach((l, i) => text(ctx, l, 252, 66 + i * 10, COL.text)); if (it.type === 'consumable' || it.type === 'dish') text(ctx, 'ENTER: use', 252, 176, COL.green); else if (it.type === 'ingredient') text(ctx, 'Cook it in the CRAFT tab', 252, 176, COL.dim); else if (it.type === 'equip') text(ctx, st.equip[it.slot] === id ? 'ENTER: unequip' : 'ENTER: equip', 252, 176, COL.green); else if (it.type === 'mutation') text(ctx, st.mutations.includes(id) ? 'ENTER: remove' : 'ENTER: activate', 252, 176, COL.green); if (st.upgrades[id]) text(ctx, 'Reforged +' + st.upgrades[id], 252, 164, '#ffd8a0'); }
    panel(ctx, 8, 196, 464, 54);
    ['shell', 'claw', 'charm'].forEach((sl, i) => { const x = 14 + i * 76, id = st.equip[sl]; panel(ctx, x, 202, 24, 24, { border: id ? COL.gold : '#2a3a58' }); if (id) ctx.drawImage(itemIcon(id), x + 4, 206); text(ctx, sl.toUpperCase(), x + 28, 205, COL.dim); text(ctx, id ? ITEMS[id].name.slice(0, 11) : 'empty', x + 28, 215, id ? COL.text : '#506080'); });
    text(ctx, `Mutation slots`, 250, 203, COL.dim);
    for (let i = 0; i < 3; i++) { const x = 250 + i * 28, locked = i >= F.mutationSlots, id = st.mutations[i]; panel(ctx, x, 213, 24, 24, { border: locked ? '#2a3a58' : id ? '#7aff9a' : COL.border }); if (id) ctx.drawImage(itemIcon(id), x + 4, 217); else if (locked) text(ctx, 'x', x + 9, 221, '#2a3a58'); }
    text(ctx, `Pearls ${g.itemCount('pearl')}   Black ${g.itemCount('black_pearl')}`, 340, 203, '#d0dcf8'); text(ctx, `Coins ${st.coins}`, 340, 215, COL.gold);
  }

  // ===================== QUESTS =====================
  questList() { const q = this.g.systems.quests, st = this.g.state.quests; const act = Object.keys(st).filter((id) => st[id].state === 'active' && !QUESTS[id].hidden || (QUESTS[id]?.hidden && st[id].state === 'active')); const done = Object.keys(st).filter((id) => st[id].state === 'done'); const main = act.filter((i) => QUESTS[i].type === 'main'), side = act.filter((i) => QUESTS[i].type === 'side'); return [...main, ...side, ...done]; }
  u_QUESTS(inp, s) { const list = this.questList(); if (inp.pressed('up')) { s.i = (s.i + list.length - 1) % Math.max(1, list.length); this.g.audio.sfx('tick'); } if (inp.pressed('down')) { s.i = (s.i + 1) % Math.max(1, list.length); this.g.audio.sfx('tick'); } }
  d_QUESTS(ctx, s) {
    const st = this.g.state.quests, list = this.questList();
    panel(ctx, 8, 20, 190, 230); panel(ctx, 204, 20, 268, 230);
    if (!list.length) text(ctx, 'No quests yet.', 16, 28, COL.dim);
    const vis = 18, top = Math.max(0, Math.min(s.i - 8, list.length - vis));
    list.slice(top, top + vis).forEach((id, k) => { const i = top + k, y = 26 + k * 12, q = QUESTS[id], sel = i === s.i, done = st[id].state === 'done'; if (sel) { ctx.fillStyle = '#1e4a7a'; ctx.fillRect(10, y - 1, 186, 12); } text(ctx, (q.type === 'main' ? '◆ ' : '• ') + q.name, 14, y + 1, done ? '#608060' : sel ? '#fff' : q.type === 'main' ? COL.gold : COL.text); });
    const id = list[s.i]; if (id) {
      const q = QUESTS[id], qs = st[id]; text(ctx, q.name, 212, 26, COL.gold); text(ctx, q.type === 'main' ? 'Main story' : 'Side quest' + (q.giver ? ' — ' + (this.g.npcs.get(q.giver)?.name || '') : ''), 212, 37, COL.dim);
      wrapText(q.desc, 252).forEach((l, i) => text(ctx, l, 212, 52 + i * 10, COL.text));
      const y0 = 52 + wrapText(q.desc, 252).length * 10 + 10; q.steps.forEach((stp, i) => { const done = qs.state === 'done' || i < qs.step, cur = i === qs.step && qs.state === 'active'; if (done || cur) wrapText((done ? '✓ ' : '▶ ') + stp.text, 250).forEach((l, k) => text(ctx, l, 212, y0 + i * 22 + k * 10, done ? COL.green : '#ffffff')); });
    }
  }

  // ===================== MAP =====================
  u_MAP(inp, s) {}
  d_MAP(ctx, s) {
    const g = this.g, st = g.state, cur = g.world.zone.id; panel(ctx, 8, 20, 464, 230);
    const ids = Object.keys(ZONE_INFO), cw = 46, ch = 24, gx = 22, gy = 20;
    const X = (m) => 28 + m.x * (cw + gx), Y = (m) => 40 + m.y * (ch + gy);
    // links
    for (const [a, b] of ZONE_LINKS) { const A = ZONE_INFO[a], B = ZONE_INFO[b]; const va = st.visited[a], vb = st.visited[b]; if (!(va || vb)) continue; if (B.secret && !st.visited[b]) continue; ctx.fillStyle = va && vb ? '#6a9ad0' : '#2a3a58'; const x1 = X(A.map) + cw / 2, y1 = Y(A.map) + ch / 2, x2 = X(B.map) + cw / 2, y2 = Y(B.map) + ch / 2; if (y1 === y2) ctx.fillRect(Math.min(x1, x2), y1, Math.abs(x2 - x1), 2); else ctx.fillRect(x1, Math.min(y1, y2), 2, Math.abs(y2 - y1)); }
    for (const id of ids) {
      const Z = ZONE_INFO[id], v = st.visited[id]; if (Z.secret && !v) continue; const x = X(Z.map), y = Y(Z.map), B = BIOMES[Z.biome];
      const adj = ZONE_LINKS.some(([a, b]) => (a === id && st.visited[b]) || (b === id && st.visited[a]));
      if (!v && !adj) continue;
      ctx.fillStyle = '#05030a'; ctx.fillRect(x - 1, y - 1, cw + 2, ch + 2); ctx.fillStyle = v ? B.top : '#1a2a48'; ctx.fillRect(x, y, cw, ch); if (v) { ctx.fillStyle = B.bottom; ctx.fillRect(x, y + ch / 2, cw, ch / 2); }
      if (id === cur && Math.floor(this.t * 3) % 2) { ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1; ctx.strokeRect(x - 1.5, y - 1.5, cw + 3, ch + 3); ctx.fillStyle = '#ff5a4a'; ctx.fillRect(x + cw / 2 - 2, y + ch / 2 - 2, 5, 5); }
      if (!v) text(ctx, '?', x + cw / 2 - 2, y + 8, '#6a8ab0');
      else { if (Z.boss) { const d = st.bosses[Z.boss]; ctx.fillStyle = d ? '#406040' : '#e03a3a'; ctx.fillRect(x + 3, y + 3, 5, 5); ctx.fillStyle = '#05030a'; ctx.fillRect(x + 4, y + 5, 1, 1); ctx.fillRect(x + 6, y + 5, 1, 1); } if (Z.molt) { ctx.fillStyle = '#ff9ad8'; ctx.fillRect(x + cw - 8, y + 3, 5, 5); } }
    }
    text(ctx, 'Red = boss   Pink = Molt Shrine   Flashing = you', 14, 238, COL.dim);
    text(ctx, ZONE_INFO[cur]?.name || '', 466 - textWidth(ZONE_INFO[cur]?.name || ''), 238, COL.gold);
  }

  // ===================== CODEX =====================
  codexList() { return Object.keys(LORE); }
  u_CODEX(inp, s) { const l = this.codexList(); if (inp.pressed('up')) { s.i = (s.i + l.length - 1) % l.length; this.g.audio.sfx('tick'); } if (inp.pressed('down')) { s.i = (s.i + 1) % l.length; this.g.audio.sfx('tick'); } }
  d_CODEX(ctx, s) {
    const st = this.g.state.codex, list = this.codexList();
    panel(ctx, 8, 20, 190, 230); panel(ctx, 204, 20, 268, 230);
    const vis = 18, top = Math.max(0, Math.min(s.i - 8, list.length - vis));
    list.slice(top, top + vis).forEach((id, k) => { const i = top + k, y = 26 + k * 12, sel = i === s.i; if (sel) { ctx.fillStyle = '#1e4a7a'; ctx.fillRect(10, y - 1, 186, 12); } text(ctx, st[id] ? LORE[id].title.slice(0, 29) : '???', 14, y + 1, st[id] ? (sel ? '#fff' : COL.text) : '#506080'); });
    const id = list[s.i]; if (id && st[id]) { const e = LORE[id]; text(ctx, e.title, 212, 26, COL.gold); text(ctx, LORE_CATS[e.cat] || '', 212, 37, COL.dim); wrapText(e.text, 252).forEach((l, i) => text(ctx, l, 212, 54 + i * 10, COL.text)); }
    else text(ctx, 'Undiscovered.\nMurals, pearls and old records\nwill fill this page.', 212, 30, '#506080');
    text(ctx, `${Object.keys(st).length}/${list.length}`, 190 - textWidth(`${Object.keys(st).length}/${list.length}`) + 8, 238, COL.dim);
  }
}
installMenuExtras(MenuScene);
export { TABS };
