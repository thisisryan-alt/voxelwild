// The in-world scene: ticks the World + HUD, routes menu/pause keys, runs fades and dialogue freezes.
import { Hud } from './hud.js';
import { DialogueBox } from './dialogue_ui.js';
import { drawText } from '../gfx/font.js';
import { PhotoScene } from './photo.js';

export class PlayScene {
  constructor(game) {
    this.g = game; this.opaque = true; this.hud = new Hud(game); this.dialogue = new DialogueBox(game);
    this.fade = { a: 1, target: 0, speed: 2.5, cb: null }; this.lock = 0; this.hold = 0; this.letterbox = 0; this.letterTarget = 0;
    game.playScene = this;
  }
  fadeOut(sec, cb) { this.fade.target = 1; this.fade.speed = 1 / sec; this.fade.cb = cb || null; this.lock++; }
  fadeIn(sec) { this.fade.target = 0; this.fade.speed = 1 / sec; this.fade.cb = null; this.lock = Math.max(0, this.lock - 1); }
  get busy() { return this.fade.a > 0.05 || this.dialogue.active; }
  update(dt) {
    const g = this.g, inp = g.input, w = g.world; if (!w) return;
    g.update(dt);
    // fade
    const f = this.fade;
    if (f.a !== f.target) { f.a += Math.sign(f.target - f.a) * f.speed * dt; if (Math.abs(f.a - f.target) < f.speed * dt) { f.a = f.target; if (f.target === 1 && f.cb) { const cb = f.cb; f.cb = null; if (g.deathCard) { this.hold = 1.8; this.holdCb = cb; } else cb(); } } }
    if (this.hold > 0) { this.hold -= dt; if (this.hold <= 0) { const cb = this.holdCb; this.holdCb = null; cb?.(); } }
    this.letterbox += (this.letterTarget - this.letterbox) * Math.min(1, dt * 4);
    this.hud.update(dt); g.systems.story?.pump(dt);
    const pl = w.player;
    pl.locked = this.dialogue.active || this.lock > 0 || !!w.cinematic;
    if (this.dialogue.active) { this.dialogue.update(dt); w.fx.update(dt); w.updateCamera(dt); g.audio.setListener(pl.x, pl.y); return; }
    if (!pl.locked) {
      if (inp.pressed('pause')) { g.openPause?.(); return; }
      if (inp.pressed('menu')) { g.openMenu?.(0); return; }
      if (inp.pressed('map')) { g.openMenu?.('map'); return; }
      if (inp.pressed('quicksave')) g.saveGame();
      if (inp.pressed('heal') && pl.alive) { if (g.hasItem('kelp_wrap') && pl.hp < pl.stats.maxHp) { g.addItem('kelp_wrap', -1); pl.heal(Math.round(pl.stats.maxHp * 0.4)); g.audio.sfx('pickup'); } else if (g.hasItem('brine_tonic') && pl.tide < pl.stats.maxTide * 0.7) { g.addItem('brine_tonic', -1); pl.addTide(pl.stats.maxTide * 0.5); g.audio.sfx('pickup'); } else g.audio.sfx('deny'); }
      if (inp.pressed('debug')) g.debug = !g.debug;
      if (inp.pressed('minimap')) g.systems.minimap?.cycle();
      if (inp.pressed('photo') && pl.alive && !w.cinematic) { g.engine.push(new PhotoScene(g)); return; }
      if (inp.pressed('interact') && w.near && pl.alive) { pl.interactT = 0.25; g.audio.sfx('select'); w.near.interact(g); inp.consume('interact'); }
    }
    if (g.freeze > 0) { g.freeze--; w.fx.update(dt * 0.3); w.shakeAmt *= 0.9; g.audio.music.update?.(dt, w); return; }
    w.update(dt);
    g.audio.setListener(pl.x, pl.y); g.audio.music.update?.(dt, w);
    if (this.g.cinematicHook) this.g.cinematicHook(dt);
  }
  draw(ctx) {
    const g = this.g, w = g.world; if (!w) { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 480, 270); return; }
    w.draw(ctx);
    if (this.letterbox > 0.5) { const h = Math.round(this.letterbox); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 480, h); ctx.fillRect(0, 270 - h, 480, h); }
    if (this.letterbox < 6 && !g.photoMode?.hideHud) this.hud.draw(ctx);
    this.dialogue.draw(ctx);
    if (this.fade.a > 0.001) { ctx.globalAlpha = Math.min(1, this.fade.a); ctx.fillStyle = '#02050c'; ctx.fillRect(0, 0, 480, 270); ctx.globalAlpha = 1; }
    const dc = this.g.deathCard;
    if (dc && this.fade.a > 0.5) { const a = (this.fade.a - 0.5) * 2; drawText(ctx, 'THE TIDE CLAIMS YOU', 240, 104, { color: '#ff8a7a', scale: 2, align: 'center', shadow: '#3a0a14', alpha: a }); if (dc.lose) drawText(ctx, `Your spirit purse holds ${dc.lose} coins. Find it where you fell.`, 240, 132, { color: '#ffd8a0', align: 'center', alpha: a }); drawText(ctx, dc.hint, 240, 154, { color: '#9ad8ff', align: 'center', alpha: a }); }
  }
}
