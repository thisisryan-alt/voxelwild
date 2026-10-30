// Stillwater: walking. The figure in the straw hat can step off the boat and wander any island:
// tap where to go (or use the arrow or WASD keys), wade the shallows, sit on benches and the ends
// of jetties, and soak in the hot springs.
(function (SW) {
  'use strict';
  const { U } = SW;
  const { clamp } = U;
  const S = SW.S;
  const WK = SW.walk = { active: false, pos: new THREE.Vector3(), facing: 0, moving: false, pose: 'stand' };
  let W, GD, L, A, fig;
  const P = {};
  let path = [], seatGoal = null, seat = null, stepDist = 0, kneel = 0, heldKeys = new Set();
  let goal = null, replans = 0, stuckT = 0, wayBest = Infinity;   // for finding a new way round when blocked
  const SPEED = 1.5;

  // ------------------------------------------------------------------ figure
  function build() {
    fig = new THREE.Group();
    const mats = {};
    const box = (parent, c, sx, sy, sz, x, y, z) => {
      const m = new THREE.Mesh(W.boxGeo, mats[c] || (mats[c] = W.voxelMat(c, { edges: 0.12, shininess: 24 })));
      m.scale.set(sx, sy, sz); m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m;
    };
    const piv = (parent, x, y, z) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };
    const shirt = 0x5f7f9a, trousers = 0x4a4f5e, skin = 0xe8c8a8, hat = 0xd8b04a;
    P.hips = piv(fig, 0, 0.5, 0);
    P.legL = piv(P.hips, -0.09, 0, 0); box(P.legL, trousers, 0.13, 0.5, 0.14, 0, -0.25, 0); box(P.legL, 0x3a3a3a, 0.14, 0.06, 0.18, 0, -0.48, 0.02);
    P.legR = piv(P.hips, 0.09, 0, 0); box(P.legR, trousers, 0.13, 0.5, 0.14, 0, -0.25, 0); box(P.legR, 0x3a3a3a, 0.14, 0.06, 0.18, 0, -0.48, 0.02);
    P.torso = piv(P.hips, 0, 0, 0);
    box(P.torso, shirt, 0.34, 0.4, 0.22, 0, 0.2, 0);
    P.armL = piv(P.torso, -0.22, 0.38, 0); box(P.armL, shirt, 0.1, 0.36, 0.12, 0, -0.17, 0); box(P.armL, skin, 0.09, 0.08, 0.1, 0, -0.39, 0);
    P.armR = piv(P.torso, 0.22, 0.38, 0); box(P.armR, shirt, 0.1, 0.36, 0.12, 0, -0.17, 0); box(P.armR, skin, 0.09, 0.08, 0.1, 0, -0.39, 0);
    P.head = piv(P.torso, 0, 0.42, 0);
    box(P.head, skin, 0.22, 0.22, 0.22, 0, 0.11, 0);
    box(P.head, 0x3a3030, 0.035, 0.035, 0.02, -0.05, 0.12, 0.11); box(P.head, 0x3a3030, 0.035, 0.035, 0.02, 0.05, 0.12, 0.11);
    box(P.head, hat, 0.46, 0.04, 0.46, 0, 0.24, 0); box(P.head, hat, 0.25, 0.1, 0.25, 0, 0.3, 0); box(P.head, 0x8a4a3a, 0.26, 0.03, 0.26, 0, 0.27, 0);
    fig.visible = false;
    W.scene.add(fig);
  }

  // ------------------------------------------------------------------ ground
  // Where a foot would land at (x, z): planks, land, or shallow water to wade in.
  function groundAt(x, z) {
    const c = W.colAt(x, z), d = W.deckAt(x, z);
    if (d != null && d >= c.h - 0.4) return { y: d, kind: 'wood' };
    for (const p of W.pools || []) if (Math.hypot(x - p.x, z - p.z) < p.r && c.h >= 0) return { y: c.h, kind: 'water', pool: p };
    if (c.h >= 0) {
      const winter = U.seasonIndex(S.season) === 3 && S.season % 1 > 0.15;
      const kind = c.rock ? (W.island.id === 'glacier' ? 'snow' : 'stone') : c.grassy ? (winter ? 'snow' : 'grass') : 'sand';
      return { y: c.h, kind };
    }
    if (c.h === -1) return { y: -1, kind: 'water' };
    return null;
  }
  const canStep = (y0, y1) => y1 - y0 <= 1.05 && y0 - y1 <= 3.05;
  // Solid things you walk around rather than through.
  const BLOCK = { cabin: 1.25, windmill: 0.85, lantern: 0.3, campfire: 0.45, cairn: 0.3, birdhouse: 0.15, chime: 0.15, bush: 0.55, wreck: 0, pavilion: 0, bench: 0 };
  function solidR(it) {
    const def = GD.CAT[it.k];
    if (!def || !def.solid) return 0;
    return BLOCK[it.k] != null ? BLOCK[it.k] : def.tree ? 0.32 : 0;
  }
  function collide(pos) {
    for (const it of GD.items) {
      const r = solidR(it);
      if (!r) continue;
      const dx = pos.x - it.x, dz = pos.z - it.z, d = Math.hypot(dx, dz);
      if (d < r + 0.2 && d > 0.001) { pos.x = it.x + dx / d * (r + 0.2); pos.z = it.z + dz / d * (r + 0.2); }
    }
  }

  // ------------------------------------------------------------- pathfinding
  // A* over the voxel columns near you, climbing at most one block at a time.
  function findPath(sx, sz, tx, tz) {
    const R = 45, N = 2 * R + 1, ox = Math.round(sx), oz = Math.round(sz);
    const gx = clamp(Math.round(tx), ox - R, ox + R), gz = clamp(Math.round(tz), oz - R, oz + R);
    const idx = (x, z) => (x - ox + R) * N + (z - oz + R);
    const g = new Float32Array(N * N).fill(Infinity), from = new Int32Array(N * N).fill(-1), closed = new Uint8Array(N * N);
    const ycache = new Float32Array(N * N).fill(NaN), wet = new Uint8Array(N * N);
    const yAt = (x, z) => {
      const i = idx(x, z);
      if (Number.isNaN(ycache[i])) {
        let best = null;
        for (const [ax, az] of [[0, 0], [0.35, 0], [-0.35, 0], [0, 0.35], [0, -0.35]]) { const gr = groundAt(x + ax, z + az); if (gr && (!best || gr.y > best.y)) best = gr; }
        ycache[i] = best ? best.y : -99;
        wet[i] = best && best.kind === 'water' ? 1 : 0;
      }
      return ycache[i];
    };
    const heap = [];
    const push = (f, i) => { heap.push([f, i]); let k = heap.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top; };
    const s = idx(ox, oz);
    if (yAt(ox, oz) < -50) return null;
    // cells taken by trees, bushes and buildings, which the walker would otherwise press against forever
    const blocked = new Uint8Array(N * N);
    for (const it of GD.items) {
      const r = solidR(it);
      if (!r || Math.abs(it.x - ox) > R + 3 || Math.abs(it.z - oz) > R + 3) continue;
      const reach = r + 0.4;
      for (let x = Math.ceil(it.x - reach); x <= Math.floor(it.x + reach); x++) for (let z = Math.ceil(it.z - reach); z <= Math.floor(it.z + reach); z++) {
        if (Math.abs(x - ox) <= R && Math.abs(z - oz) <= R && Math.hypot(x - it.x, z - it.z) < reach) blocked[idx(x, z)] = 1;
      }
    }
    blocked[s] = 0;
    const open = (x, z) => !blocked[idx(x, z)] && yAt(x, z) > -50;
    g[s] = 0; push(Math.hypot(gx - ox, gz - oz), s);
    let best = s, bestH = Math.hypot(gx - ox, gz - oz), steps = 0;
    while (heap.length && steps++ < 9000) {
      const [, i] = pop();
      if (closed[i]) continue;
      closed[i] = 1;
      const x = Math.floor(i / N) - R + ox, z = (i % N) - R + oz, y = ycache[i];
      const h = Math.hypot(gx - x, gz - z);
      if (h < bestH) { bestH = h; best = i; }
      if (h === 0) break;
      for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
        if (!dx && !dz) continue;
        const nx = x + dx, nz = z + dz;
        if (Math.abs(nx - ox) > R || Math.abs(nz - oz) > R) continue;
        if (!open(nx, nz)) continue;
        const ny = yAt(nx, nz);
        if (!canStep(y, ny)) continue;
        // a diagonal step must not clip the corner of a cliff, a tree or the sea
        if (dx && dz) {
          if (!open(x + dx, z) || !open(x, z + dz)) continue;
          const a = yAt(x + dx, z), b = yAt(x, z + dz);
          if (!canStep(y, a) || !canStep(y, b) || !canStep(a, ny) || !canStep(b, ny)) continue;
        }
        const j = idx(nx, nz), cost = g[i] + (dx && dz ? 1.414 : 1) * (wet[j] ? 2.5 : 1);
        if (cost < g[j]) { g[j] = cost; from[j] = i; push(cost + Math.hypot(gx - nx, gz - nz), j); }
      }
    }
    const cells = [];
    for (let i = best; i !== -1 && i !== s; i = from[i]) cells.push([Math.floor(i / N) - R + ox, (i % N) - R + oz]);
    cells.reverse();
    if (bestH === 0 && cells.length) cells[cells.length - 1] = [tx, tz];
    return { cells, reached: bestH < 1.5 };
  }

  // ------------------------------------------------------------------- public
  WK.init = function () { W = SW.world; GD = SW.garden; L = SW.life; A = SW.audio; build(); };
  WK.place = function (x, z, facing) {
    const gr = groundAt(x, z) || { y: Math.max(0, W.heightAt(x, z)) };
    WK.pos.set(x, gr.y, z); WK.facing = facing == null ? WK.facing : facing;
    path = []; seat = null; seatGoal = null; WK.pose = 'stand';
  };
  WK.spawn = function () {
    const I = W.island;
    if (I.id === 'home') WK.place(W.dock.start.x - I.out.x * 0.6, W.dock.start.z - I.out.y * 0.6, Math.atan2(-I.out.x, -I.out.y));
    else WK.place(I.shore.x + I.out.x * 0.9, I.shore.z + I.out.y * 0.9, Math.atan2(-I.out.x, -I.out.y));
  };
  WK.enter = function () { WK.active = true; WK.spawn(); fig.visible = true; L.setRower(false); };
  WK.exit = function () { WK.active = false; fig.visible = false; path = []; seat = null; L.setRower(true); L.walker = null; };
  WK.hide = function (hidden) { fig.visible = WK.active && !hidden; };
  WK.goTo = function (x, z) {
    const res = findPath(WK.pos.x, WK.pos.z, x, z);
    seatGoal = null;
    if (!res || !res.cells.length) return false;
    path = res.cells; seat = null;
    goal = { x, z }; replans = 0; stuckT = 0; wayBest = Infinity;
    return res.reached;
  };
  WK.goSit = function (st) {
    if (Math.hypot(st.x - WK.pos.x, st.z - WK.pos.z) < 0.5) { sitOn(st); return true; }
    const ok = WK.goTo(st.x, st.z);
    if (ok) { seatGoal = st; path.push([st.x, st.z]); }
    return ok;
  };
  // If the walker stops getting closer to the next step, look for another way from here (twice at most).
  function replan() {
    if (!goal || replans >= 2) return false;
    replans++;
    const res = findPath(WK.pos.x, WK.pos.z, goal.x, goal.z);
    if (!res || !res.cells.length) return false;
    path = res.cells;
    if (seatGoal) path.push([seatGoal.x, seatGoal.z]);
    return true;
  }
  WK.front = (d) => ({ x: WK.pos.x + Math.sin(WK.facing) * d, z: WK.pos.z + Math.cos(WK.facing) * d });
  WK.kneel = () => { kneel = 0.9; };
  WK.seatNear = function (x, z, r = 1.3) {
    let best = null, bd = r;
    for (const st of W.seats.concat(GD.feat.seat || [])) { const d = Math.hypot(st.x - x, st.z - z); if (d < bd) { bd = d; best = st; } }
    return best;
  };
  WK.isSitting = () => !!seat;
  function sitOn(st) {
    seat = st; path = []; seatGoal = null;
    WK.pos.set(st.x, st.y, st.z); WK.facing = st.angle != null ? Math.atan2(Math.cos(st.angle), Math.sin(st.angle)) : WK.facing;
    WK.pose = st.kind === 'soak' ? 'soak' : st.kind === 'edge' ? 'edge' : 'sit';
    if (st.kind === 'soak') { A.splash(0, 0.6); SW.emit('see', 'soak'); }
  }

  // Keys move relative to the camera; the camera's orbit angle is passed in.
  window.addEventListener('keydown', (e) => {
    if (!WK.active || /INPUT|TEXTAREA/.test(e.target.tagName) || e.metaKey || e.ctrlKey) return;
    const k = e.key.toLowerCase();
    if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) { heldKeys.add(k); e.preventDefault(); }
  });
  window.addEventListener('keyup', (e) => heldKeys.delete(e.key.toLowerCase()));
  window.addEventListener('blur', () => heldKeys.clear());

  WK.update = function (dt, t, camTheta) {
    if (!WK.active || !fig.visible) { L.walker = null; return; }
    const pos = WK.pos;
    let dx = 0, dz = 0;
    const fwd = (heldKeys.has('w') || heldKeys.has('arrowup') ? 1 : 0) - (heldKeys.has('s') || heldKeys.has('arrowdown') ? 1 : 0);
    const side = (heldKeys.has('d') || heldKeys.has('arrowright') ? 1 : 0) - (heldKeys.has('a') || heldKeys.has('arrowleft') ? 1 : 0);
    if (fwd || side) {
      path = []; seatGoal = null; seat = null;
      const fx = -Math.cos(camTheta), fz = -Math.sin(camTheta);
      dx = fx * fwd - fz * side; dz = fz * fwd + fx * side;
    } else if (path.length) {
      // move on to the next step in the same frame, so the stride never stops for a frame at each one
      let p = path[0], ex = p[0] - pos.x, ez = p[1] - pos.z, d = Math.hypot(ex, ez);
      while (d < (path.length > 1 ? 0.45 : 0.12)) {
        path.shift(); wayBest = Infinity; stuckT = 0;
        if (!path.length) { if (seatGoal) sitOn(seatGoal); break; }
        p = path[0]; ex = p[0] - pos.x; ez = p[1] - pos.z; d = Math.hypot(ex, ez);
      }
      if (path.length) {
        dx = ex; dz = ez;
        if (d < wayBest - 0.03) { wayBest = d; stuckT = 0; }
        else if ((stuckT += dt) > 0.9) {
          stuckT = 0; wayBest = Infinity;
          if (!replan()) { path = []; seatGoal = null; dx = dz = 0; }
        }
      }
    }
    const len = Math.hypot(dx, dz);
    const here = groundAt(pos.x, pos.z) || { y: pos.y, kind: 'sand' };
    WK.moving = len > 0.001 && !seat;
    if (WK.moving) {
      seat = null; WK.pose = 'stand';
      const v = SPEED * (here.kind === 'water' ? 0.55 : 1) * dt;
      dx /= len; dz /= len;
      const tryMove = (mx, mz) => {
        const nx = pos.x + mx * v, nz = pos.z + mz * v, g = groundAt(nx, nz);
        if (!g || !canStep(here.y, g.y)) return false;
        pos.x = nx; pos.z = nz;
        return true;
      };
      if (!tryMove(dx, dz) && !tryMove(dx, 0) && !tryMove(0, dz)) {
        // on a path, ease back toward the middle of this block and let the stuck check find another way
        const cx = Math.round(pos.x) - pos.x, cz = Math.round(pos.z) - pos.z, cl = Math.hypot(cx, cz);
        if (!path.length || cl < 0.02 || !tryMove(cx / cl, cz / cl)) WK.moving = false;
      }
      collide(pos);
      WK.facing += U.angDiff(WK.facing, Math.atan2(dx, dz)) * Math.min(1, dt * 9);
      stepDist += v;
      if (stepDist > 0.62) {
        stepDist = 0;
        const g = groundAt(pos.x, pos.z);
        if (g) {
          A.step(g.kind, W.panOf(pos));
          if (g.kind === 'water') { W.addRipple(pos.x, pos.z, 0.3); L.splash(pos.x, pos.z, 2); }
        }
      }
      const I = W.islandAt(pos.x, pos.z);
      if (I !== W.island && Math.hypot(pos.x - I.x, pos.z - I.z) < I.r + 6) W.setIsland(I.id);
    }
    if (!seat) { const g = groundAt(pos.x, pos.z); if (g) pos.y += (g.y - pos.y) * Math.min(1, dt * 10); }
    L.walker = pos;
    animate(dt, t);
  };

  function animate(dt, t) {
    const b = S.breath.b, walking = WK.moving;
    fig.position.copy(WK.pos);
    fig.rotation.y = WK.facing;
    kneel = Math.max(0, kneel - dt);
    let legX = 0, armX = 0, hipsY = 0.5, torsoX = 0, legZ = 0;
    if (walking) {
      const sw = Math.sin(t * 9) * 0.55;
      legX = sw; armX = -sw * 0.8;
      hipsY = 0.5 + Math.abs(Math.cos(t * 9)) * 0.03;
    }
    if (WK.pose === 'sit' || WK.pose === 'soak') { hipsY = 0.02; P.legL.rotation.x = P.legR.rotation.x = -1.5; }
    else if (WK.pose === 'edge') { hipsY = 0.02; P.legL.rotation.x = P.legR.rotation.x = -1.2 + Math.sin(t * 1.3) * 0.2; }
    else { P.legL.rotation.x = legX; P.legR.rotation.x = -legX; }
    if (kneel > 0) { const k = Math.sin(Math.PI * kneel / 0.9); hipsY -= 0.22 * k; torsoX = 0.5 * k; armX = -1.0 * k; P.legL.rotation.x = -0.9 * k; P.legR.rotation.x = 0.4 * k; }
    P.hips.position.y = hipsY;
    P.torso.rotation.x = torsoX;
    P.armL.rotation.x = armX; P.armR.rotation.x = kneel > 0 ? armX : -armX;
    if (!walking && kneel <= 0) {
      // at rest the figure breathes with the island
      P.torso.scale.y = 1 + 0.04 * b;
      P.armL.rotation.z = -0.06 - 0.04 * b; P.armR.rotation.z = 0.06 + 0.04 * b;
      P.head.rotation.x = WK.pose === 'stand' ? -0.05 : -0.12 - 0.05 * b;
    } else { P.torso.scale.y = 1; P.armL.rotation.z = P.armR.rotation.z = 0; P.head.rotation.x = 0; }
    P.legL.rotation.z = P.legR.rotation.z = legZ;
  }
})(window.SW);
