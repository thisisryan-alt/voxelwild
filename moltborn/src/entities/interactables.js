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
    if (this.kind === 'molt') game.openMoltShrine(this);
    game.rest(this);
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

export const INTERACTABLES = { chest: Chest, shrine: Shrine, mural: Mural, sign: Sign, lockdoor: LockDoor, npc: NpcEntity };
