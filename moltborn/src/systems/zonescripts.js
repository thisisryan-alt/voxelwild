// Zone-specific scripted events that react to world changes (sealed vaults, puzzle doors).
import { T } from '../world/tiles.js';
import { Enemy } from '../entities/enemy.js';

export class ZoneScripts {
  constructor(game) { this.g = game; game.systems.zonescripts = this; game.events.on('tilebroken', () => this.check()); game.events.on('zone', () => this.check()); }
  check() {
    const g = this.g, w = g.world; if (!w) return;
    if (w.zone.id === 'trench_temple' && !g.flag('hatchlings_freed')) {
      // the vault is open once no Seal tile remains in the strip x=8..9, y=44..57
      let left = 0; for (let y = 44; y < 58; y++) for (let x = 8; x < 10; x++) if (w.grid.get(x, y) === T.SEAL) left++;
      if (left === 0) {
        g.setFlag('hatchlings_freed'); w.decor = w.decor.filter((d) => d.spr !== undefined && !(d.type === 'cocoons'));
        for (let i = 0; i < 6; i++) { const e = new Enemy(w, 'hatchling', (3 + i * 1.6) * 16, 61 * 16 - 6, { facing: 1 }); w.enemies.push(e); }
        w.fx.burst(8 * 16, 54 * 16, ['#ffd8f0', '#ffffff'], 140, 1.2, 3); g.audio.sfx('revive'); g.toast('The sleeping hatchlings wake.', '#ffd8f0'); w.flash = 0.4;
      }
    }
    if (g.flag('hatchlings_freed') && w.zone.id === 'trench_temple' && !w.hatchSpawned) { w.hatchSpawned = true; if (!w.enemies.some((e) => e.type === 'hatchling')) for (let i = 0; i < 6; i++) w.enemies.push(new Enemy(w, 'hatchling', (3 + i * 1.6) * 16, 61 * 16 - 6, { facing: 1 })); w.decor = w.decor.filter((d) => d.cocoon !== true); }
  }
}
