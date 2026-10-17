// The fishing scene: cast, wait for a bite, answer it, then keep the fish inside the catch zone until the meter is full.
// Hold ENTER (or SPACE / J) to lift the zone, let go to let it fall. ESC reels in and walks away from the spot.
import { panel, text, COL, drawText, textWidth, wrapText } from './ui.js';
import { RARITY, WAIT, HOOK_WINDOW } from '../data/fish.js';
import { Reel } from '../systems/fishing.js';
import { biteSpeedup } from '../entities/companion.js';
import { itemIcon } from '../gfx/sprites_ui.js';
import { rng } from '../core/util.js';

export class FishingScene {
  constructor(game, spot) {
    this.g = game; this.spot = spot; this.opaque = false; this.t = 0; this.state = 'wait'; this.cast = 0;
    this.F = game.systems.fishing; this.r = rng(Math.floor(game.state.playtime * 9) + spot.seed);
    this.wait = (WAIT[0] + this.r() * (WAIT[1] - WAIT[0])) * (1 - biteSpeedup(game.state.companion?.level || 0)); this.catchInfo = null; this.reel = null; this.msg = ''; this.result = null; this.bite = 0; this.bob = 0; this.ripples = [];
  }
  onEnter() { this.g.audio.sfx('cast'); this.g.audio.setMuffle?.(0.3); }
  onExit() { this.g.audio.setMuffle?.(0); }

  leave(cooled = 0) { if (cooled) this.F.cool(this.spot.zs, this.spot.key, cooled); this.g.engine.pop(); }
  update(dt) {
    const g = this.g, inp = g.input, F = this.F; this.t += dt; this.bob += dt;
    if (this.ripples.length) this.ripples = this.ripples.filter((r) => (r.t += dt) < 1.4);
    if (this.state === 'wait') {
      if (inp.pressed('cancel')) { g.audio.sfx('back'); this.leave(); return; }
      this.cast += dt; if (this.cast > this.wait) {
        this.catchInfo = F.pick(this.spot, Math.floor(this.t * 10)); if (!this.catchInfo) { this.state = 'empty'; this.t = 0; return; }
        this.state = 'bite'; this.bite = 0; g.audio.sfx('bite'); this.ripples.push({ t: 0 }, { t: -0.2 });
      }
    } else if (this.state === 'bite') {
      this.bite += dt; if (this.bite % 0.35 < dt) { this.ripples.push({ t: 0 }); g.audio.sfx('nibble'); }
      if (inp.pressed('confirm') || inp.pressed('attack')) { this.state = 'reel'; this.reel = new Reel(this.catchInfo.fish, F.skill(), this.catchInfo.seed); g.audio.sfx('select'); }
      else if (this.bite > HOOK_WINDOW) { this.state = 'away'; this.t = 0; this.msg = 'It slipped the hook.'; g.audio.sfx('deny'); F.cool(this.spot.zs, this.spot.key, 0.3); }
      else if (inp.pressed('cancel')) { this.leave(); }
    } else if (this.state === 'reel') {
      const st = this.reel.step(dt, inp.isDown('confirm') || inp.isDown('attack') || inp.isDown('jump'));
      this.tickT = (this.tickT || 0) - dt; if (this.tickT <= 0 && this.reel.inside) { this.tickT = 0.16; g.audio.sfx('reel_tick', { k: this.reel.progress }); }
      if (st === 'won') { this.result = F.landed(this.catchInfo); this.state = 'caught'; this.t = 0; this.spot && F.cool(this.spot.zs, this.spot.key, 1); }
      else if (st === 'lost') { this.state = 'away'; this.t = 0; this.msg = 'The line goes slack. It is gone.'; g.audio.sfx('line_snap'); F.cool(this.spot.zs, this.spot.key, 0.5); }
      else if (inp.pressed('cancel')) { this.state = 'away'; this.t = 0; this.msg = 'You let it go.'; F.cool(this.spot.zs, this.spot.key, 0.5); }
    } else if (this.state === 'caught' || this.state === 'away' || this.state === 'empty') {
      if (this.t > 0.5 && (inp.pressed('confirm') || inp.pressed('cancel'))) this.leave();
    }
  }

  draw(ctx) {
    const g = this.g, F = this.F, ci = this.catchInfo;
    ctx.fillStyle = 'rgba(2,8,20,0.62)'; ctx.fillRect(0, 0, 480, 270);
    panel(ctx, 90, 40, 300, 190, { alpha: 0.96 }); drawText(ctx, 'FISHING', 240, 46, { color: COL.gold, align: 'center', shadow: '#000' });
    // the water window with the bobber
    ctx.fillStyle = '#05102a'; ctx.fillRect(100, 62, 150, 118); const gr = ctx.createLinearGradient(0, 62, 0, 180); gr.addColorStop(0, '#2a7aa8'); gr.addColorStop(1, '#0a2a50'); ctx.fillStyle = gr; ctx.fillRect(101, 63, 148, 116);
    for (let i = 0; i < 5; i++) { ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(104 + ((i * 37 + this.t * 6) % 140), 70 + i * 20, 8, 1); }
    const bx = 175, by = 98 + Math.round(Math.sin(this.bob * 2.2) * 1.5) + (this.state === 'bite' ? Math.round(Math.sin(this.bite * 38) * 3 + 4) : 0);
    ctx.fillStyle = '#d8f4ff'; ctx.fillRect(bx + 1, 63, 1, by - 63);
    for (const r of this.ripples) { if (r.t < 0) continue; ctx.globalAlpha = Math.max(0, 0.7 - r.t / 2); ctx.strokeStyle = '#d8f4ff'; ctx.strokeRect(bx - r.t * 18 + 0.5, 98 - r.t * 4 + 0.5, r.t * 36 + 4, r.t * 8 + 2); ctx.globalAlpha = 1; }
    ctx.fillStyle = '#05030a'; ctx.fillRect(bx - 3, by - 3, 8, 8); ctx.fillStyle = '#ff4a3a'; ctx.fillRect(bx - 2, by - 2, 6, 6); ctx.fillStyle = '#ffffff'; ctx.fillRect(bx - 2, by - 2, 6, 2);
    if (this.state === 'bite') { const s = '!'; drawText(ctx, s, bx + 12, 80, { color: '#ffd84a', scale: 3, shadow: '#000' }); }
    if (this.state === 'wait') { const dots = '.'.repeat(1 + Math.floor(this.t * 2) % 3); text(ctx, 'Waiting' + dots, 104, 168, COL.dim); }
    // the right-hand panel: instructions or the reel
    const rx = 262;
    if (this.state === 'wait') { wrapText('Something is down there. When the float dips, press ENTER to set the hook.', 120).forEach((l, i) => text(ctx, l, rx, 70 + i * 10, COL.text)); text(ctx, `Biome: ${g.world.zone.biome}   Hour: ${F.phase()}`, rx, 130, COL.dim); text(ctx, `Species: ${F.speciesCaught()} caught`, rx, 142, COL.dim); }
    else if (this.state === 'bite') text(ctx, 'NOW! Press ENTER', rx, 100, '#ffd84a');
    else if (this.state === 'reel') this.drawReel(ctx, rx);
    else if (this.state === 'caught') this.drawCaught(ctx, rx);
    else { const m = this.state === 'empty' ? 'Nothing seems to be biting here.' : this.msg; wrapText(m, 120).forEach((l, i) => text(ctx, l, rx, 80 + i * 10, COL.red)); }
    const hint = this.state === 'reel' ? 'Hold ENTER to lift the zone    ESC let go' : this.state === 'caught' || this.state === 'away' || this.state === 'empty' ? 'ENTER to continue' : 'ESC walk away';
    text(ctx, hint, 240 - textWidth(hint) / 2, 214, '#9ad8ff');
  }
  drawReel(ctx, rx) {
    const R = this.reel, x = rx + 8, y = 66, h = 112, w = 16;
    ctx.fillStyle = '#05030a'; ctx.fillRect(x - 1, y - 1, w + 2, h + 2); ctx.fillStyle = '#16284a'; ctx.fillRect(x, y, w, h);
    const zy = y + Math.round((1 - R.zone - R.zoneH) * h), zh = Math.round(R.zoneH * h);
    ctx.fillStyle = R.inside ? '#5ad88a' : '#3a8a58'; ctx.fillRect(x, zy, w, zh); ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(x, zy, w, 1);
    const fy = y + Math.round((1 - R.pos) * h); ctx.drawImage(itemIcon('fish_' + R.fish.id), x - 1, fy - 8, 16, 16);
    // the meter
    const mx = x + 30; ctx.fillStyle = '#05030a'; ctx.fillRect(mx - 1, y - 1, 10, h + 2); ctx.fillStyle = '#16284a'; ctx.fillRect(mx, y, 8, h);
    const ph = Math.round(R.progress * h); ctx.fillStyle = R.progress > 0.66 ? '#7aff9a' : R.progress > 0.33 ? '#ffd84a' : '#ff6a5a'; ctx.fillRect(mx, y + h - ph, 8, ph);
    text(ctx, R.rarity.name, mx + 18, y, R.rarity.color); text(ctx, 'Catch', mx + 18, y + 12, COL.dim);
    if (R.inside) text(ctx, 'Good!', mx + 18, y + 24, COL.green);
  }
  drawCaught(ctx, rx) {
    const f = this.catchInfo.fish, len = this.catchInfo.len, R = RARITY[f.rarity], res = this.result;
    ctx.save(); ctx.translate(rx + 6, 70); ctx.scale(2, 2); ctx.drawImage(itemIcon('fish_' + f.id), 0, 0); ctx.restore();
    text(ctx, f.name, rx + 44, 72, COL.gold); text(ctx, R.name, rx + 44, 84, R.color); text(ctx, `${len} cm`, rx + 44, 96, COL.text);
    wrapText(f.note, 126).slice(0, 3).forEach((l, i) => text(ctx, l, rx, 112 + i * 10, COL.dim));
    const flags = [res.fresh && 'NEW SPECIES', res.record && !res.fresh && 'RECORD', res.big && 'BIG ONE'].filter(Boolean); flags.forEach((s, i) => text(ctx, s, rx, 148 + i * 10, '#ffd84a'));
  }
}
