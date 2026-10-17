// World objects the player can use with E: chests, rest/molt shrines, murals, signs, locked doors, NPCs.
import { Entity, drawFrame } from './entity.js';
import { chestFrame, shrineFrame, muralFrame } from '../gfx/sprites_ui.js';
import { propSprite } from '../gfx/sprites_world.js';
import { npcFrame } from '../gfx/sprites_npc.js';
import { T, TS } from '../world/tiles.js';

export class Interactable extends Entity {
  constructor(world, o, w = 20, h = 20) { super(world, o.x, o.y - h / 2, w, h); this.o = o; this.key = o.key || `${world.zone.id}:${o.type}:${Math.round(o.x)}:${Math.round(o.y)}`; this.range = o.range || 24; }
  get zs() { return this.world.game.zoneState(this.world.zone.id); }
  prompt() { return null; }
  canInteract(pl) { return Math.abs(pl.x - this.x) < this.range && Math.abs(pl.y - this.y) < this.range + 6; }
  interact(game) {}
  onHit() {}
}

export class Chest extends Interactable {
  constructor(world, o) { super(world, o, 22, 16); this.opened = !!this.zs.opened?.[this.key]; this.openT = this.opened ? 1 : 0; this.sparkT = 0; }
  prompt() { return this.opened ? null : 'Open'; }
  update(dt) { this.t += dt; if (this.opening) { this.openT = Math.min(1, this.openT + dt * 3); } if (!this.opened && this.world.game.state.stats && this.world.player && this.world.player.stats.sense) { this.sparkT -= dt; if (this.sparkT < 0 && Math.hypot(this.world.player.x - this.x, this.world.player.y - this.y) < 120) { this.sparkT = 0.5; this.world.fx.sparkle(this.x + (Math.random() - 0.5) * 14, this.y - 8); } } }
  interact(game) {
    if (this.opened) return;
    this.opened = true; this.opening = true;
    (this.zs.opened ||= {})[this.key] = true;
    this.world.game.audio.sfx('chest');
    this.world.player.interactT = 0.3;
    const loot = this.o.loot || { coins: [8, 16] };
    this.world.fx.ring(this.x, this.y - 6, 3, 30, 0.4, '#ffd84a', 2); this.world.fx.burst(this.x, this.y - 8, ['#ffd84a', '#fff6a8', '#ffffff'], 90, 0.6, 2);
    game.grantLoot(loot, this.x, this.y - 10, true);
    game.events.emit('chest', this);
  }
  draw(ctx, cam) {
    const c = chestFrame(this.opened && this.openT > 0.4, this.o.tint || 0);
    ctx.drawImage(c, Math.round(this.x - cam.x - 11), Math.round(this.y + 8 - cam.y - 18));
    if (!this.opened) { ctx.globalAlpha = 0.25 + 0.15 * Math.sin(this.t * 3); ctx.fillStyle = '#fff6a8'; ctx.fillRect(Math.round(this.x - cam.x) - 1, Math.round(this.y - 12 - cam.y), 2, 2); ctx.globalAlpha = 1; }
  }
}

export class Shrine extends Interactable {
  constructor(world, o) { super(world, o, 30, 36); this.kind = o.kind || 'rest'; this.name = o.name || 'Pearl Shrine'; this.range = 28; this.o.y = o.y; }
  prompt() { return this.kind === 'molt' ? 'Molt Shrine' : 'Rest'; }
  update(dt) { this.t += dt; if (Math.random() < 0.03) this.world.fx.bubble(this.x, this.y - 10, 1, 6, -14); if (Math.random() < 0.04) this.world.fx.sparkle(this.x + (Math.random() - 0.5) * 20, this.y - 6 - Math.random() * 20, this.kind === 'molt' ? '#ffb0d8' : '#a0f0ff'); }
  interact(game) {
    if (this.kind === 'molt') game.openMoltShrine(this); else game.rest(this);
  }
  draw(ctx, cam) {
    const active = this.world.game.state.checkpoint.zone === this.world.zone.id && this.world.game.state.checkpoint.shrine === this.key;
    const c = shrineFrame(this.kind, active || this.kind === 'molt');
    ctx.drawImage(c, Math.round(this.x - cam.x - 17), Math.round(this.y + this.h / 2 - cam.y - 40));
  }
}

export class Mural extends Interactable {
  constructor(world, o) { super(world, o, 30, 26); this.codex = o.codex; this.range = 26; this.seen = !!world.game.state.codex[o.codex]; }
  prompt() { return this.seen ? 'Read again' : 'Examine'; }
  interact(game) { this.seen = true; game.readLore(this.codex, this); }
  draw(ctx, cam) {
    ctx.drawImage(muralFrame(this.o.v || 0), Math.round(this.x - cam.x - 17), Math.round(this.y + 15 - cam.y - 30));
    if (!this.seen) { ctx.globalAlpha = 0.5 + 0.4 * Math.sin(this.t * 4); ctx.fillStyle = '#ffd84a'; ctx.fillRect(Math.round(this.x - cam.x) - 1, Math.round(this.y - 22 - cam.y), 2, 2); ctx.globalAlpha = 1; }
  }
}

export class Sign extends Interactable {
  constructor(world, o) { super(world, o, 14, 18); this.text = o.text; }
  prompt() { return 'Read'; }
  interact(game) { game.say(this.o.speaker || 'Marker', this.text); }
  draw(ctx, cam) { const x = Math.round(this.x - cam.x), y = Math.round(this.y + 9 - cam.y); ctx.fillStyle = '#170d1c'; ctx.fillRect(x - 1, y - 14, 3, 14); ctx.fillRect(x - 8, y - 20, 17, 9); ctx.fillStyle = '#946034'; ctx.fillRect(x, y - 13, 1, 13); ctx.fillRect(x - 7, y - 19, 15, 7); ctx.fillStyle = '#c08a52'; ctx.fillRect(x - 7, y - 19, 15, 1); ctx.fillStyle = '#2a1810'; ctx.fillRect(x - 5, y - 16, 11, 1); ctx.fillRect(x - 5, y - 14, 7, 1); }
}

// A door of locked tiles that opens when the player has the required key item
export class LockDoor extends Interactable {
  constructor(world, o) { super(world, o, o.tw * TS, o.th * TS); this.x = o.x; this.y = o.y; this.range = 30; this.open = !!this.zs.opened?.[this.key]; if (this.open) this.clearTiles(true); }
  prompt() { return this.open ? null : 'Unlock'; }
  canInteract(pl) { if (this.open) return false; return Math.abs(pl.x - this.x) < this.w / 2 + 22 && Math.abs(pl.y - this.y) < this.h / 2 + 18; }
  clearTiles(silent) { const g = this.world.grid, tx0 = Math.floor((this.x - this.w / 2) / TS), ty0 = Math.floor((this.y - this.h / 2) / TS); for (let j = 0; j < this.o.th; j++) for (let i = 0; i < this.o.tw; i++) g.set(tx0 + i, ty0 + j, T.AIR); if (!silent) { this.world.layer.renderRegion(tx0 - 1, ty0 - 1, tx0 + this.o.tw, ty0 + this.o.th); } else this.pending = [tx0, ty0]; }
  interact(game) {
    if (this.open) return;
    const key = this.o.key_item;
    if (this.o.need && !this.o.need(game)) { game.say('Sealed', this.o.lockText || 'It will not open.'); return; }
    if (key && !game.hasItem(key)) { game.say('Locked', this.o.lockText || 'The door is sealed. A key must exist somewhere in this place.'); return; }
    this.open = true; (this.zs.opened ||= {})[this.key] = true; this.clearTiles(false);
    game.audio.sfx('unlock'); this.world.fx.burst(this.x, this.y, ['#ffd84a', '#fff'], 100, 0.5, 3); game.toast('Unlocked');
    if (this.o.flag) game.setFlag(this.o.flag);
  }
  draw() {}
}

export class NpcEntity extends Interactable {
  constructor(world, o) { super(world, o, 16, 22); this.id = o.npc; this.range = 30; this.dir = o.facing || 1; this.look = 0; }
  get def() { return this.world.game.npcs.get(this.id); }
  prompt() { return 'Talk'; }
  update(dt) { this.t += dt; const pl = this.world.player; if (pl) this.dir = pl.x >= this.x ? 1 : -1; }
  interact(game) { this.world.game.dialogue.start(this.id, this); }
  draw(ctx, cam) {
    const d = this.def; if (!d) return;
    const f = npcFrame(d.sprite, Math.floor(this.t * 4));
    drawFrame(ctx, f, this.x - cam.x, this.y + this.h / 2 - cam.y, this.dir < 0 !== !!d.flip);
    if (this.world.game.questMarker(this.id)) { const m = this.world.game.questMarker(this.id); ctx.fillStyle = m === '!' ? '#ffd84a' : '#9ad8ff'; const y = Math.round(this.y - this.h / 2 - 14 - cam.y + Math.sin(this.t * 4) * 1.5); ctx.fillRect(Math.round(this.x - cam.x) - 1, y, 3, 6); ctx.fillRect(Math.round(this.x - cam.x) - 1, y + 8, 3, 2); }
  }
}

// Singing kelp bulb: struck in the order low, high, middle plays the old tune (Choir of Kelp quest)
export class Bulb extends Interactable {
  constructor(world, o) { super(world, o, 14, 16); this.tone = o.tone; this.glowT = 0; this.range = 0; }
  prompt() { return null; }
  canInteract() { return false; }
  update(dt) { this.t += dt; this.glowT = Math.max(0, this.glowT - dt); }
  onHit() {
    const w = this.world, g = w.game; if (g.flag('choir_done') || this.glowT > 0.2) return;
    this.glowT = 0.7; const f = [196, 392, 294][this.tone]; g.audio.tone?.({ f, dur: 0.6, v: 0.35, type: 'sine', rev: 0.7 }); w.fx.ring(this.x, this.y, 2, 24, 0.4, ['#6ab0ff', '#ffb0d8', '#9affb0'][this.tone], 2);
    const seq = (w.choirSeq ||= []); seq.push(this.tone); if (seq.length > 3) seq.shift();
    if (seq.length === 3 && seq[0] === 0 && seq[1] === 1 && seq[2] === 2) { g.setFlag('choir_done'); g.toast('The kelp sings back.', '#9affb0'); g.audio.sfx('item'); w.fx.burst(this.x, this.y - 20, ['#9affb0', '#fff'], 120, 1, 3); g.grantLoot({ coins: 40, xp: 30 }, this.x, this.y - 10, false); }
  }
  draw(ctx, cam) {
    const c = [['#4a7ad8', '#7ab0f2', '#c0e0ff'], ['#c85a96', '#e87e90', '#ffd0e0'], ['#2f8a2c', '#58b82a', '#c0ffb0']][this.tone], x = Math.round(this.x - cam.x), y = Math.round(this.y + 8 - cam.y), lit = this.glowT > 0;
    ctx.fillStyle = '#170d1c'; ctx.fillRect(x - 1, y - 8, 3, 8); ctx.fillRect(x - 6, y - 18, 13, 11); ctx.fillStyle = lit ? c[2] : c[0]; ctx.fillRect(x - 5, y - 17, 11, 9); ctx.fillStyle = lit ? '#ffffff' : c[1]; ctx.fillRect(x - 4, y - 16, 4, 3);
    if (lit) { ctx.globalAlpha = 0.4; ctx.fillStyle = c[2]; ctx.beginPath(); ctx.arc(x, y - 12, 14, 0, 6.3); ctx.fill(); ctx.globalAlpha = 1; }
  }
}

// A brazier lit with a Lantern Stone (Lantern Pact quest)
export class Brazier extends Interactable {
  constructor(world, o) { super(world, o, 14, 18); this.lit = !!this.zs.opened?.[this.key]; }
  prompt() { return this.lit ? null : 'Light'; }
  interact(game) {
    if (this.lit) return;
    if (!game.hasItem('lantern_stone')) { game.say('Brazier', 'A cold bowl of dark stone. It wants a Lantern Stone.'); return; }
    game.addItem('lantern_stone', -1); this.lit = true; (this.zs.opened ||= {})[this.key] = true; game.audio.sfx('unlock');
    this.world.fx.burst(this.x, this.y - 6, ['#ffd84a', '#ff9a3a', '#fff'], 100, 0.8, 2);
    const n = this.world.interactables.filter((i) => i instanceof Brazier && i.lit).length;
    game.toast(`Brazier lit (${n}/${this.o.total || 3})`, '#ffd84a'); if (n >= (this.o.total || 3)) { game.setFlag('lanterns_lit'); game.audio.sfx('item'); }
  }
  draw(ctx, cam) {
    const x = Math.round(this.x - cam.x), y = Math.round(this.y + 9 - cam.y);
    ctx.fillStyle = '#170d1c'; ctx.fillRect(x - 6, y - 8, 13, 9); ctx.fillRect(x - 2, y - 12, 5, 6); ctx.fillStyle = '#6a6a7a'; ctx.fillRect(x - 5, y - 7, 11, 7); ctx.fillStyle = '#9a9aaa'; ctx.fillRect(x - 5, y - 7, 11, 1);
    if (this.lit) { const f = Math.floor(this.t * 8) % 3; ctx.fillStyle = '#ff9a3a'; ctx.fillRect(x - 3, y - 14 - f, 7, 7 + f); ctx.fillStyle = '#ffd84a'; ctx.fillRect(x - 2, y - 12 - f, 5, 5); ctx.fillStyle = '#fff6a8'; ctx.fillRect(x - 1, y - 10, 3, 3); }
  }
  get glowing() { return this.lit; }
}
export const INTERACTABLES = { bulb: Bulb, brazier: Brazier, chest: Chest, shrine: Shrine, mural: Mural, sign: Sign, lockdoor: LockDoor, npc: NpcEntity };

// The Tide Board: a notice board of dares. Reading it opens the rift / gauntlet menu (ui/board_scene.js).
export class TideBoard extends Interactable {
  constructor(world, o) { super(world, o, 26, 28); this.range = 30; this.t = 0; }
  prompt() { return 'Read the Tide Board'; }
  interact(game) { import('../ui/board_scene.js').then(({ BoardScene }) => game.engine.push(new BoardScene(game))); }
  get glowing() { return true; }
  draw(ctx, cam) {
    this.t += 1 / 60;
    const x = Math.round(this.x - cam.x), y = Math.round(this.y + 14 - cam.y), glow = 0.5 + 0.5 * Math.sin(this.t * 2.2);
    ctx.fillStyle = '#170d1c'; ctx.fillRect(x - 12, y - 28, 25, 20); ctx.fillRect(x - 10, y - 9, 3, 9); ctx.fillRect(x + 7, y - 9, 3, 9);
    ctx.fillStyle = '#7a4c2a'; ctx.fillRect(x - 11, y - 27, 23, 18); ctx.fillStyle = '#a8703c'; ctx.fillRect(x - 11, y - 27, 23, 2); ctx.fillStyle = '#946034'; ctx.fillRect(x - 9, y - 8, 1, 8); ctx.fillRect(x + 8, y - 8, 1, 8);
    ctx.fillStyle = '#e8dcc0'; ctx.fillRect(x - 9, y - 24, 7, 8); ctx.fillRect(x + 1, y - 22, 8, 10); ctx.fillStyle = '#c0b090'; ctx.fillRect(x - 9, y - 24, 7, 1); ctx.fillRect(x + 1, y - 22, 8, 1);
    ctx.fillStyle = '#6a8ab0'; for (let i = 0; i < 3; i++) { ctx.fillRect(x - 8, y - 21 + i * 2, 5, 1); ctx.fillRect(x + 2, y - 19 + i * 2, 6, 1); }
    ctx.fillStyle = '#c03a3a'; ctx.fillRect(x - 6, y - 25, 2, 2); ctx.fillRect(x + 4, y - 23, 2, 2);
    ctx.globalAlpha = 0.25 + glow * 0.3; ctx.fillStyle = '#9af0ff'; ctx.fillRect(x - 2, y - 30, 4, 2); ctx.fillRect(x - 1, y - 33, 2, 3); ctx.globalAlpha = 1;
  }
}
INTERACTABLES.board = TideBoard;
