// Axis-separated AABB vs tile-grid movement. Bodies use centre x,y and full w,h.
import { TS, T, isSolid, isOneWay } from './tiles.js';

const EPS = 0.001;

function overlapsSolid(grid, b, ox = 0, oy = 0, vy = 0, prevBottom = null, drop = false) {
  const x0 = Math.floor((b.x + ox - b.w / 2) / TS), x1 = Math.floor((b.x + ox + b.w / 2 - EPS) / TS);
  const y0 = Math.floor((b.y + oy - b.h / 2) / TS), y1 = Math.floor((b.y + oy + b.h / 2 - EPS) / TS);
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
    const t = grid.get(tx, ty);
    if (isSolid(t)) return true;
    if (t === T.PLATFORM && vy > 0 && !drop && prevBottom !== null && prevBottom <= ty * TS + 1) return true;
  }
  return false;
}
export const bodyBlocked = (grid, b, ox = 0, oy = 0) => overlapsSolid(grid, b, ox, oy);

// Moves the body by v*dt, resolving tile collisions. Sets b.onGround, b.hitX (-1/0/1), b.hitY (-1/0/1).
export function moveBody(grid, b, dt, o = {}) {
  b.hitX = 0; b.hitY = 0;
  if (o.ghost) { b.x += b.vx * dt; b.y += b.vy * dt; b.onGround = false; return; }
  const mx = Math.abs(b.vx * dt), my = Math.abs(b.vy * dt);
  const steps = Math.max(1, Math.ceil(Math.max(mx, my) / 6));
  const sx = (b.vx * dt) / steps, sy = (b.vy * dt) / steps;
  for (let i = 0; i < steps; i++) {
    if (sx) {
      b.x += sx;
      if (overlapsSolid(grid, b)) {
        // resolve to the tile edge
        if (sx > 0) { const tx = Math.floor((b.x + b.w / 2) / TS); b.x = tx * TS - b.w / 2 - EPS; b.hitX = 1; }
        else { const tx = Math.floor((b.x - b.w / 2) / TS); b.x = (tx + 1) * TS + b.w / 2 + EPS; b.hitX = -1; }
        b.vx = 0;
        if (o.step && b.onGround && !o.noStep) {
          // 1-tile step assist: hop up if the space above the step is free
          if (!overlapsSolid(grid, b, Math.sign(sx) * 2, -TS)) { b.stepRise = TS; }
        }
        break;
      }
    }
  }
  if (b.stepRise > 0) {
    const rise = Math.min(b.stepRise, 4);
    if (!overlapsSolid(grid, b, 0, -rise)) { b.y -= rise; b.stepRise -= rise; if (b.stepRise <= 0 && !b.hitX) b.x += Math.sign(b.facing || 1) * 1.5; } else b.stepRise = 0;
    b.vy = Math.min(b.vy, 0);
  }
  b.onGround = false;
  for (let i = 0; i < steps; i++) {
    if (sy) {
      const prevBottom = b.y + b.h / 2;
      b.y += sy;
      if (overlapsSolid(grid, b, 0, 0, sy, prevBottom, !!b.drop)) {
        if (sy > 0) {
          // find floor row
          const ty = Math.floor((b.y + b.h / 2) / TS);
          b.y = ty * TS - b.h / 2 - EPS; b.hitY = 1; b.onGround = true;
        } else { const ty = Math.floor((b.y - b.h / 2) / TS); b.y = (ty + 1) * TS + b.h / 2 + EPS; b.hitY = -1; }
        b.vy = 0;
        break;
      }
    }
  }
  if (!b.onGround) {
    // probe just below (so resting bodies report ground)
    if (b.vy >= 0 && overlapsSolid(grid, b, 0, 1.2, 1, b.y + b.h / 2, !!b.drop)) b.onGround = true;
  }
}

// Line-of-sight over tiles (coarse)
export function hasLOS(grid, x1, y1, x2, y2) {
  const d = Math.hypot(x2 - x1, y2 - y1), n = Math.ceil(d / 8);
  for (let i = 1; i < n; i++) { const t = i / n; if (grid.solidPx(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t)) return false; }
  return true;
}
