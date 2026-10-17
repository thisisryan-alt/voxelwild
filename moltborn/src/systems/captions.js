// Sound captions (an accessibility option): important sounds are described in small text near the bottom of the screen,
// with an arrow when the source is off to one side. Only sounds that carry information are captioned; interface blips and
// footsteps are not. Captions are drawn by the HUD.
import { setting } from './settings.js';
import { text, textWidth, panel } from '../ui/ui.js';

const CAPTIONS = {
  alert: ['Something notices you', '#ffd08a'], clang: ['Blow blocked', '#c8d8f0'], parry: ['Parry!', '#9ad8ff'], riposte: ['Riposte', '#ffd0a0'], die: ['A creature falls', '#d0c0b0'], bossdie: ['The guardian falls', '#ffd84a'],
  boom: ['Explosion', '#ffb070'], slam: ['Heavy slam', '#ffb070'], shoot: ['Projectile fired', '#e8c0a0'], spit: ['Spitting', '#e8c0a0'], spore: ['Spores released', '#b8e0a0'], cannon: ['Cannon fire', '#ff9a7a'],
  zap: ['Electric crackle', '#9ad8ff'], charge: ['Charging up', '#ffe08a'], beam: ['Beam', '#ffb0ff'], whirl: ['Whirlpool', '#8ac8ff'], wave: ['A wave rolls in', '#8ac8ff'], roar: ['A roar', '#ff8a7a'], thunder: ['Thunder', '#c8c0ff'],
  bosswarn: ['Danger: a guardian stirs', '#ff6a5a'], chest: ['Chest opens', '#ffd84a'], rockbreak: ['Rock shatters', '#c8b8a8'], whale: ['A distant whale call', '#9ac8e8'], rumble: ['The ground rumbles', '#b8a8c8'],
  heartbeat: ['Your heartbeat', '#ff8a8a'], trophy: ['Trophy earned', '#ffd84a'], levelup: ['Level up', '#ffd84a'], revive: ['Revived', '#a8ffc8'], pressure: ['Pressure crushes you', '#b8a4ff'], hurt: ['You are hit', '#ff8a7a'],
  wave_start: ['A wave begins', '#ffe8a0'], wave_clear: ['Wave cleared', '#9ad8ff'], rift: ['The rift stirs', '#c8a8ff'], shutter: ['Camera shutter', '#e8e8e8'], travel: ['Shrine travel', '#c8e8ff'], relic: ['Relic gained', '#ff9ae0'],
};
const SKIP_GAP = 0.6;     // seconds before the same caption can repeat

export class Captions {
  constructor(game) {
    this.g = game; game.systems.captions = this; this.live = []; this.last = {};
    game.audio.onSfx = (name, o) => this.hear(name, o);
  }
  hear(name, o = {}) {
    if (!setting(this.g, 'captions')) return; const c = CAPTIONS[name]; if (!c) return;
    const now = performance.now() / 1000; if (this.last[name] && now - this.last[name] < SKIP_GAP) return; this.last[name] = now;
    const p = this.g.world?.player; let side = 0;
    if (o.x !== undefined && p) { const dx = o.x - p.x; if (Math.abs(dx) > 140) side = Math.sign(dx); if (Math.hypot(dx, (o.y ?? p.y) - p.y) > 420) return; }
    this.live.push({ text: c[0], color: c[1], side, t: 0 }); if (this.live.length > 4) this.live.shift();
  }
  update(dt) { for (const c of this.live) c.t += dt; this.live = this.live.filter((c) => c.t < 2.6); }
  draw(ctx) {
    if (!this.live.length || !setting(this.g, 'captions')) return;
    this.live.forEach((c, i) => {
      const a = Math.min(1, (2.6 - c.t) * 2, c.t * 6), s = (c.side < 0 ? '< ' : '') + c.text + (c.side > 0 ? ' >' : ''), w = textWidth(s) + 10, y = 232 - (this.live.length - 1 - i) * 13;
      ctx.globalAlpha = a * 0.9; panel(ctx, 240 - w / 2, y, w, 12, { alpha: 0.75, border: '#2a3a58' }); text(ctx, s, 245 - w / 2, y + 3, c.color); ctx.globalAlpha = 1;
    });
  }
}
