// Placing a creature into a sealed procedural zone (rift ambushes, the gauntlet): picks a column from the zone's spawn
// points, finds the floor or open water, shows a spawn ring and creates the enemy. Shared by arena.js and rifts.js.
import { ENEMIES } from '../data/enemies.js';
import { Enemy } from '../entities/enemy.js';
import { TS, isSolid } from '../world/tiles.js';

export function spawnFoe(world, type, r, opts = {}) {
  const z = world.zone, d = ENEMIES[type]; if (!d || !z.points?.length) return null;
  // `near` keeps ambushers close enough to wake up: columns within about 14 tiles of the swimmer
  let cols = z.points; if (opts.near !== undefined) { const close = cols.filter((c) => Math.abs((c + 0.5) * TS - opts.near) < 14 * TS); if (close.length) cols = close; }
  const tx = cols[Math.floor(r() * cols.length)], g = world.grid;
  let ty = opts.top ?? 6; while (ty < z.h - 2 && !isSolid(g.get(tx, ty))) ty++;
  const floor = d.anchor === 'feet', x = (tx + 0.5) * TS, y = floor ? ty * TS - d.h / 2 - 1 : Math.min(ty - 4, 10 + Math.floor(r() * 10)) * TS;
  world.fx.ring(x, y, 4, 22, 0.5, '#ffe8a0', 2); world.fx.burst(x, y, ['#ffe8a0', '#ffffff'], 50, 0.4, 2);
  const e = new Enemy(world, type, x, y, { facing: x < world.player.x ? 1 : -1 }); world.enemies.push(e);
  if (floor) e.y = ty * TS - e.h / 2 - 0.1;
  return e;
}

// column positions across a chamber, used as spawn points
export const spawnPoints = (w, margin = 8, step = 6) => { const out = []; for (let x = margin; x < w - margin; x += step) out.push(x); return out; };
