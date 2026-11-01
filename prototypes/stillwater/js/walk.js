// Stillwater: walking. The figure in the straw hat can step off the boat and wander the whole archipelago:
// over the bridges between the islands, along the beaches, up the hills, through the shallows and, in a
// sea of water, out into the deep to swim. In Heaven the clouds hold you up; Hell's lava does not.
// Tap where to go (the route finds its way over the bridges), or use WASD or the arrow keys, Shift to run
// and Space to jump. Sit on benches and the ends of jetties, and soak in the hot springs.
(function (SW) {
  'use strict';
  const { U } = SW;
  const { clamp, smooth } = U;
  const S = SW.S, K = SW.K;
  const SEA = (K.WORLD.look || {}).sea || '';
  const WK = SW.walk = { active: false, pos: new THREE.Vector3(), facing: 0, moving: false, pose: 'stand', medium: 'land', running: false, runToggle: false, airborne: false, speed: 0, fp: false };
  let W, GD, L, A, fig;
  const P = {};
  let path = [], legs = [], seatGoal = null, seat = null, stepDist = 0, kneel = 0;
  const heldKeys = new Set();
  let goal = null, replans = 0, stuckT = 0, wayBest = Infinity;   // for finding a new way round when blocked
  let vx = 0, vz = 0, vy = 0, squash = 0, phase = 0, idleT = 0, turnRate = 0, routeLeft = 0, lockedToastT = -99, heatToastT = -99;
  const joy = { x: 0, z: 0 };   // the on-screen stick, in camera space: x right, z forward
  const WALK = 1.7, RUN = 3.7, JOG = 2.9, SWIM = 1.15, SWIM_FAST = 1.9, JUMP_V = 7.4, GRAV = 16;

  // ------------------------------------------------------------------ figure
  function build() {
    fig = new THREE.Group();
    const mats = {};
    const box = (parent, c, sx, sy, sz, x, y, z) => {
      const m = new THREE.Mesh(W.boxGeo, mats[c] || (mats[c] = W.voxelMat(c, { edges: 0.12, shininess: 24, rim: true })));
      m.scale.set(sx, sy, sz); m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m;
    };
    const piv = (parent, x, y, z) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };
    const shirt = 0x5f7f9a, trousers = 0x4a4f5e, skin = 0xe8c8a8, hat = 0xd8b04a, shoe = 0x3a3a3a;
    P.body = piv(fig, 0, 0.75, 0);   // pivots at the chest, to tip forward when swimming
    P.hips = piv(P.body, 0, -0.25, 0);
    // legs bend at the knee, arms at the elbow
    for (const [k, x] of [['L', -0.09], ['R', 0.09]]) {
      const leg = P['leg' + k] = piv(P.hips, x, 0, 0);
      box(leg, trousers, 0.13, 0.26, 0.14, 0, -0.13, 0);
      const shin = P['shin' + k] = piv(leg, 0, -0.25, 0);
      box(shin, trousers, 0.125, 0.25, 0.135, 0, -0.12, 0); box(shin, shoe, 0.14, 0.06, 0.19, 0, -0.23, 0.025);
    }
    P.torso = piv(P.hips, 0, 0, 0);
    box(P.torso, shirt, 0.34, 0.4, 0.22, 0, 0.2, 0);
    box(P.torso, 0x4e6a82, 0.35, 0.05, 0.23, 0, 0.02, 0);   // belt line
    for (const [k, x] of [['L', -0.22], ['R', 0.22]]) {
      const arm = P['arm' + k] = piv(P.torso, x, 0.38, 0);
      box(arm, shirt, 0.1, 0.19, 0.12, 0, -0.09, 0);
      const fore = P['fore' + k] = piv(arm, 0, -0.18, 0);
      box(fore, shirt, 0.095, 0.15, 0.115, 0, -0.07, 0); box(fore, skin, 0.09, 0.08, 0.1, 0, -0.18, 0);
    }
    P.head = piv(P.torso, 0, 0.42, 0);
    box(P.head, skin, 0.22, 0.22, 0.22, 0, 0.11, 0);
    box(P.head, 0x3a3030, 0.035, 0.035, 0.02, -0.05, 0.12, 0.11); box(P.head, 0x3a3030, 0.035, 0.035, 0.02, 0.05, 0.12, 0.11);
    box(P.head, 0x6a4a3a, 0.23, 0.08, 0.06, 0, 0.16, -0.09);   // hair at the back under the hat
    P.hat = piv(P.head, 0, 0, 0);
    box(P.hat, hat, 0.46, 0.04, 0.46, 0, 0.24, 0); box(P.hat, hat, 0.25, 0.1, 0.25, 0, 0.3, 0); box(P.hat, 0x8a4a3a, 0.26, 0.03, 0.26, 0, 0.27, 0);
    fig.visible = false;
    W.scene.add(fig);
    initPrints();
    // a soft contact shadow under the feet, which grounds the figure even where the sun's shadow is faint
    const bg = new THREE.PlaneGeometry(1, 1); bg.rotateX(-Math.PI / 2);
    blobU = { uA: { value: 1 } };
    blob = new THREE.Mesh(bg, new THREE.ShaderMaterial({
      uniforms: blobU, transparent: true, depthWrite: false, blending: THREE.MultiplyBlending, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform float uA; varying vec2 vUv; void main(){ float d = length(vUv - 0.5) * 2.0; float a = smoothstep(1.0, 0.15, d) * uA; gl_FragColor = vec4(vec3(1.0 - 0.5 * a), 1.0); }',
    }));
    blob.renderOrder = 2; blob.visible = false; blob.frustumCulled = false;
    W.scene.add(blob);
  }
  let blob = null, blobU = null;

  // -------------------------------------------------------------- footprints
  // Prints in sand and snow (and on the cloud in Heaven) that slowly fill in. They darken what is under
  // them by multiplying, which leaves the distance stored in the alpha channel alone (see post.js).
  const PRINTS = 140;
  let prints = null, printI = 0, printSide = 0;
  const printData = [];
  const pd = new THREE.Object3D();
  function initPrints() {
    const mat = new THREE.MeshBasicMaterial({ color: SEA === 'cloud' ? 0xd8dcf0 : 0xcabfb0, blending: THREE.MultiplyBlending, transparent: true, depthWrite: false, fog: false });
    prints = new THREE.InstancedMesh(W.boxGeo, mat, PRINTS);
    prints.frustumCulled = false;
    prints.renderOrder = 2;
    for (let i = 0; i < PRINTS; i++) { printData.push({ age: 99, x: 0, y: -99, z: 0, a: 0 }); pd.scale.setScalar(0); pd.updateMatrix(); prints.setMatrixAt(i, pd.matrix); }
    W.scene.add(prints);
  }
  function leavePrint(x, y, z, a) {
    const d = printData[printI];
    printSide = 1 - printSide;
    const side = printSide ? 0.09 : -0.09;
    Object.assign(d, { age: 0, x: x + Math.cos(a) * side, y: y + 0.012, z: z - Math.sin(a) * side, a });
    printI = (printI + 1) % PRINTS;
  }
  function updatePrints(dt) {
    let any = false;
    for (let i = 0; i < PRINTS; i++) {
      const d = printData[i];
      if (d.age > 60) continue;
      d.age += dt;
      const k = d.age > 60 ? 0 : 1 - smooth(25, 60, d.age);
      pd.position.set(d.x, d.y, d.z); pd.rotation.set(0, d.a, 0); pd.scale.set(0.11 * k, 0.01, 0.2 * k); pd.updateMatrix();
      prints.setMatrixAt(i, pd.matrix);
      any = true;
    }
    if (any) prints.instanceMatrix.needsUpdate = true;
  }

  // ------------------------------------------------------------------ ground
  const B0 = K.MINX + 6, B1 = K.MINX + K.G - 6;   // the edge of the world
  // Where a foot would land at (x, z): planks, land, shallow water to wade in, deep water to swim in, or
  // (in Heaven) the top of the cloud. Null where you cannot go.
  function groundAt(x, z) {
    if (x < B0 || x > B1 || z < B0 || z > B1) return null;
    const c = W.colAt(x, z), dh = W.deckHit(x, z);
    if (dh && dh.y >= c.h - 0.4) return { y: dh.y, kind: 'wood', deck: dh.d, t: dh.t };
    for (const p of W.pools || []) if (Math.hypot(x - p.x, z - p.z) < p.r && c.h >= 0) return { y: c.h, kind: 'water', pool: p };
    if (c.h >= 0) {
      const winter = U.seasonIndex(S.season) === 3 && S.season % 1 > 0.15;
      const kind = c.rock ? (W.island.shape === 'glacier' ? 'snow' : 'stone') : c.grassy ? (winter ? 'snow' : 'grass') : 'sand';
      return { y: c.h, kind };
    }
    if (SEA === 'lava') return null;
    if (SEA === 'cloud') return { y: K.WL + 0.05, kind: 'cloud' };
    if (c.h === -1) return { y: -1, kind: 'water' };
    return { y: -1, kind: 'swim' };   // steps are counted from the seabed of the shallows; the swimmer floats
  }
  WK.groundAt = groundAt;
  // up one block (or onto planks laid on top of one), down three
  const canStep = (y0, y1) => y1 - y0 <= 1.25 && y0 - y1 <= 3.05;
  // would a step from a bridge's planks to (x, z) go over its rail? (true over the water, not at the ends)
  const overRail = (d, x, z) => {
    if (!d || !d.rail) return false;
    const vx = d.bx - d.ax, vz = d.bz - d.az, tt = ((x - d.ax) * vx + (z - d.az) * vz) / (vx * vx + vz * vz);
    return tt > d.railFrom && tt < d.railTo;
  };
  // Solid things you walk around rather than through.
  const BLOCK = { cabin: 1.25, windmill: 0.85, lantern: 0.3, campfire: 0.45, cairn: 0.3, birdhouse: 0.15, chime: 0.15, bush: 0.55, wreck: 0, pavilion: 0, bench: 0, bamboo: 0.45, hive: 0.4, oldtree: 1.5, moongate: 0, driftwood: 0, igloo: 1.3, beachhut: 0.9, fountain: 1.0, haloarch: 0, hammock: 0, sled: 0, pillar: 0.3, obsidian: 0.45, brazier: 0.35, snowman: 0.35, icecrystal: 0.35, bonsai: 0.3, hibiscus: 0.5, lanternpost: 0.2, tikitorch: 0.15, emberlantern: 0.2, harp: 0.3 };
  function solidR(it) {
    const def = GD.CAT[it.k];
    if (!def || !def.solid) return 0;
    return BLOCK[it.k] != null ? BLOCK[it.k] : def.tree ? 0.32 : 0;
  }
  function collide(pos) {
    for (const it of GD.items) {
      if (Math.abs(pos.x - it.x) > 2 || Math.abs(pos.z - it.z) > 2) continue;
      const r = solidR(it);
      if (!r) continue;
      const dx = pos.x - it.x, dz = pos.z - it.z, d = Math.hypot(dx, dz);
      if (d < r + 0.2 && d > 0.001) { pos.x = it.x + dx / d * (r + 0.2); pos.z = it.z + dz / d * (r + 0.2); }
    }
  }
  // An island that has not opened yet cannot be walked onto (its shallows and its bridges' far ends can).
  function lockedAt(x, z) {
    if (!SW.progress) return null;
    const I = W.islandAt(x, z);
    if (I.id === 'home' || SW.progress.islandOpen(I.id)) return null;
    return Math.hypot(x - I.x, z - I.z) < I.r * 1.9 + 2 && W.heightAt(x, z) >= 0 ? I : null;
  }

  // ------------------------------------------------------------- pathfinding
  // A* over the voxel columns near you, climbing at most one block at a time. Swimming costs more than
  // wading, which costs more than walking, so routes keep to land and bridges where they can.
  function findPath(sx, sz, tx, tz, R = 45) {
    const N = 2 * R + 1, ox = Math.round(sx), oz = Math.round(sz);
    const gx = clamp(Math.round(tx), ox - R, ox + R), gz = clamp(Math.round(tz), oz - R, oz + R);
    const idx = (x, z) => (x - ox + R) * N + (z - oz + R);
    const g = new Float32Array(N * N).fill(Infinity), from = new Int32Array(N * N).fill(-1), closed = new Uint8Array(N * N);
    const ycache = new Float32Array(N * N).fill(NaN), wet = new Uint8Array(N * N), cellDeck = new Array(N * N);
    const yAt = (x, z) => {
      const i = idx(x, z);
      if (Number.isNaN(ycache[i])) {
        let best = null;
        for (const [ax, az] of [[0, 0], [0.35, 0], [-0.35, 0], [0, 0.35], [0, -0.35]]) { const gr = groundAt(x + ax, z + az); if (gr && (!best || gr.y > best.y)) best = gr; }
        if (best && lockedAt(x, z)) best = null;
        ycache[i] = best ? best.y : -99;
        cellDeck[i] = best && best.deck;
        wet[i] = !best ? 0 : best.kind === 'swim' ? 2 : best.kind === 'water' || best.kind === 'cloud' ? 1 : 0;
      }
      return ycache[i];
    };
    const heap = [];
    const push = (f, i) => { heap.push([f, i]); let k = heap.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top; };
    const s = idx(ox, oz);
    if (yAt(ox, oz) < -50) { const gr = groundAt(sx, sz); if (!gr) return null; ycache[s] = gr.y; }
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
    const limit = R * R * 5;
    while (heap.length && steps++ < limit) {
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
        if (cellDeck[i] && cellDeck[idx(nx, nz)] !== cellDeck[i] && overRail(cellDeck[i], nx, nz)) continue;
        // a diagonal step must not clip the corner of a cliff, a tree or the sea
        if (dx && dz) {
          if (!open(x + dx, z) || !open(x, z + dz)) continue;
          const a = yAt(x + dx, z), b = yAt(x, z + dz);
          if (!canStep(y, a) || !canStep(y, b) || !canStep(a, ny) || !canStep(b, ny)) continue;
        }
        const j = idx(nx, nz), cost = g[i] + (dx && dz ? 1.414 : 1) * (wet[j] === 2 ? 4 : wet[j] ? 2.5 : 1);
        if (cost < g[j]) { g[j] = cost; from[j] = i; push(cost + Math.hypot(gx - nx, gz - nz), j); }
      }
    }
    const cells = [];
    for (let i = best; i !== -1 && i !== s; i = from[i]) cells.push([Math.floor(i / N) - R + ox, (i % N) - R + oz]);
    cells.reverse();
    if (bestH === 0 && cells.length) cells[cells.length - 1] = [tx, tz];
    return { cells, reached: bestH < 1.5 };
  }

  // Routes between islands go over the bridges: a small graph of bridge ends, joined across each bridge
  // and across each island, searched for the shortest way. Each leg is walked in turn: on foot to the
  // next bridge (found with A*), then straight along the planks.
  function bridgeAt(x, z) { const g = groundAt(x, z); return g && g.deck && g.deck.bridge ? { br: g.deck.bridge, t: g.t } : null; }
  function islandNear(x, z) { const I = W.islandAt(x, z); return Math.hypot(x - I.x, z - I.z) < I.r * 1.9 + 3 ? I : null; }
  function planRoute(tx, tz) {
    const BR = SW.bridges.list;
    const open = (I) => I.id === 'home' || !SW.progress || SW.progress.islandOpen(I.id);
    const ends = [];   // { br, side, I, x, z }
    for (const br of BR) {
      ends.push({ br, side: 0, I: br.a, x: br.landA[0], z: br.landA[1] });
      ends.push({ br, side: 1, I: br.b, x: br.landB[0], z: br.landB[1] });
    }
    const n = ends.length, START = n, GOAL = n + 1, dist = new Array(n + 2).fill(Infinity), prev = new Array(n + 2).fill(-1), done = new Array(n + 2).fill(false);
    const edges = Array.from({ length: n + 2 }, () => []);
    const link = (i, j, c) => { edges[i].push([j, c]); };
    for (let i = 0; i < n; i++) {
      if (!open(ends[i].I)) continue;
      const mate = i ^ 1;
      if (open(ends[mate].I)) link(i, mate, ends[i].br.len);
      for (let j = 0; j < n; j++) if (j !== i && ends[j].I === ends[i].I && open(ends[j].I)) link(i, j, Math.hypot(ends[i].x - ends[j].x, ends[i].z - ends[j].z) * 1.25);
    }
    const pos = WK.pos, onBr = bridgeAt(pos.x, pos.z), hereI = onBr ? null : islandNear(pos.x, pos.z);
    const tBr = bridgeAt(tx, tz), tI = tBr ? null : islandNear(tx, tz);
    if (onBr && tBr && onBr.br === tBr.br) return { legs: [{ cross: onBr.br, from: onBr.t, to: tBr.t }, { x: tx, z: tz, last: true }], len: Math.abs(tBr.t - onBr.t) * onBr.br.len };
    if (onBr) {
      const i0 = ends.findIndex((e) => e.br === onBr.br && e.side === 0);
      link(START, i0, onBr.t * onBr.br.len); link(START, i0 + 1, (1 - onBr.t) * onBr.br.len);
    } else if (hereI) {
      for (let i = 0; i < n; i++) if (ends[i].I === hereI && open(hereI)) link(START, i, Math.hypot(ends[i].x - pos.x, ends[i].z - pos.z) * 1.25);
    } else return null;
    if (tBr) {
      const i0 = ends.findIndex((e) => e.br === tBr.br && e.side === 0);
      link(i0, GOAL, tBr.t * tBr.br.len); link(i0 + 1, GOAL, (1 - tBr.t) * tBr.br.len);
    } else if (tI) {
      if (!open(tI)) return { locked: tI };
      for (let i = 0; i < n; i++) if (ends[i].I === tI) link(i, GOAL, Math.hypot(ends[i].x - tx, ends[i].z - tz) * 1.25);
    } else return null;
    dist[START] = 0;
    for (;;) {
      let u = -1, best = Infinity;
      for (let i = 0; i < n + 2; i++) if (!done[i] && dist[i] < best) { best = dist[i]; u = i; }
      if (u < 0 || u === GOAL) break;
      done[u] = true;
      for (const [v, c] of edges[u]) if (dist[u] + c < dist[v]) { dist[v] = dist[u] + c; prev[v] = u; }
    }
    if (!Number.isFinite(dist[GOAL])) return null;
    const seq = [];
    for (let v = prev[GOAL]; v !== START && v >= 0; v = prev[v]) seq.unshift(v);
    // turn the node sequence into legs
    const out = [];
    let at = onBr ? { br: onBr.br, t: onBr.t } : null;
    for (let k = 0; k < seq.length; k++) {
      const e = ends[seq[k]], next = ends[seq[k + 1]];
      if (at) { out.push({ cross: e.br, from: at.t, to: e.side ? 1 : 0 }); at = null; }
      else out.push({ x: e.x, z: e.z });
      if (next && next.br === e.br && next.side !== e.side) { out.push({ cross: e.br, from: e.side ? 1 : 0, to: next.side ? 1 : 0 }); k++; }
    }
    if (tBr && seq.length) { const e = ends[seq[seq.length - 1]]; out.push({ cross: tBr.br, from: e.side ? 1 : 0, to: tBr.t }); }
    out.push({ x: tx, z: tz, last: true });
    return { legs: out, len: dist[GOAL] };
  }
  // the planks to walk along a bridge, from one point (0 to 1 along it) to another
  function crossing(br, from, to) {
    // from end to end means from land to land
    const a = clamp(from, br.landTA, br.landTB), b = clamp(to, br.landTA, br.landTB), n = Math.max(1, Math.ceil(Math.abs(b - a) * br.len));
    const pts = [];
    for (let i = 1; i <= n; i++) { const s = a + (b - a) * i / n; pts.push([br.ax + (br.bx - br.ax) * s, br.az + (br.bz - br.az) * s]); }
    return pts;
  }
  function pathLen(p) { let d = 0, x = WK.pos.x, z = WK.pos.z; for (const [a, b] of p) { d += Math.hypot(a - x, b - z); x = a; z = b; } return d; }
  // start the next leg of a route; false if there is no way on
  function nextLeg() {
    while (legs.length) {
      const leg = legs.shift();
      if (leg.cross) { path = crossing(leg.cross, leg.from, leg.to); goal = null; stuckT = 0; wayBest = Infinity; if (path.length) return true; continue; }
      if (Math.hypot(leg.x - WK.pos.x, leg.z - WK.pos.z) < 0.8 && !leg.last) continue;
      const res = findPath(WK.pos.x, WK.pos.z, leg.x, leg.z);
      if (!res || !res.cells.length) return false;
      path = res.cells;
      goal = { x: leg.x, z: leg.z }; replans = 0; stuckT = 0; wayBest = Infinity;
      return true;
    }
    return false;
  }

  // ------------------------------------------------------------------- public
  WK.init = function () { W = SW.world; GD = SW.garden; L = SW.life; A = SW.audio; build(); };
  WK.place = function (x, z, facing) {
    const gr = groundAt(x, z) || { y: Math.max(0, W.heightAt(x, z)) };
    WK.pos.set(x, gr.y, z); WK.facing = facing == null ? WK.facing : facing;
    path = []; legs = []; seat = null; seatGoal = null; WK.pose = 'stand'; vx = vz = vy = 0; WK.airborne = false;
  };
  WK.spawn = function () {
    const I = W.island, face = Math.atan2(-I.out.x, -I.out.y);
    if (I.id === 'home') { WK.place(W.dock.start.x - I.out.x * 0.6, W.dock.start.z - I.out.y * 0.6, face); return; }
    // step ashore by the landing, on firm ground (never into the lava, or out of your depth)
    for (let k = 0.9; k > -4; k -= 0.5) {
      const x = I.shore.x + I.out.x * k, z = I.shore.z + I.out.y * k, g = groundAt(x, z);
      if (g && g.kind !== 'swim' && !lockedAt(x, z)) { WK.place(x, z, face); return; }
    }
    WK.place(I.shore.x, I.shore.z, face);
  };
  WK.enter = function () { WK.active = true; WK.hidden = false; WK.spawn(); fig.visible = !WK.fp; L.setRower(false); };
  WK.exit = function () { WK.active = false; fig.visible = false; if (blob) blob.visible = false; path = []; legs = []; seat = null; L.setRower(true); L.walker = null; heldKeys.clear(); joy.x = joy.z = 0; };
  WK.hide = function (hidden) { fig.visible = WK.active && !hidden && !WK.fp; WK.hidden = hidden; };
  WK.setFirstPerson = function (on) { WK.fp = on; fig.visible = WK.active && !WK.hidden && !on; };
  // Walk to (x, z): nearby by A*, further afield over the bridges. Returns false if there is no way, or
  // a reason ('locked' with the island) when the place has not opened yet.
  WK.goTo = function (x, z) {
    seatGoal = null; legs = [];
    const lockI = lockedAt(x, z);
    if (lockI) { WK.lastFail = { locked: lockI }; return false; }
    WK.lastFail = null;
    const far = Math.hypot(x - WK.pos.x, z - WK.pos.z) > 30;
    const hereI = islandNear(WK.pos.x, WK.pos.z), thereI = islandNear(x, z);
    if ((hereI && thereI && hereI !== thereI) || bridgeAt(WK.pos.x, WK.pos.z) || bridgeAt(x, z)) {
      const r = planRoute(x, z);
      if (r && r.locked) { WK.lastFail = { locked: r.locked }; return false; }
      if (r) {
        legs = r.legs; seat = null;
        if (nextLeg()) { routeLeft = r.len; return true; }
        legs = [];
      }
    }
    const res = findPath(WK.pos.x, WK.pos.z, x, z, far ? 70 : 45);
    if (!res || !res.cells.length) return false;
    path = res.cells; seat = null;
    goal = { x, z }; replans = 0; stuckT = 0; wayBest = Infinity;
    routeLeft = pathLen(path);
    return res.reached;
  };
  WK.goIsland = function (I) {
    // somewhere open and grassy near the middle, or the landing
    const C = I.cols, pool = (C.grass.length ? C.grass : C.sand.length ? C.sand : C.rock).slice().sort((a, b) => Math.hypot(a[0] - I.x, a[1] - I.z) - Math.hypot(b[0] - I.x, b[1] - I.z));
    if (!pool.length && I.shape === 'custom') { WK.lastFail = null; return false; }   // your island, not shaped yet: only sea there
    for (const c of pool.slice(0, 12)) if (WK.goTo(c[0], c[1])) return true;
    return I.shore ? WK.goTo(I.shore.x, I.shore.z) : false;
  };
  WK.goSit = function (st) {
    if (Math.hypot(st.x - WK.pos.x, st.z - WK.pos.z) < 0.5) { sitOn(st); return true; }
    const ok = WK.goTo(st.x, st.z);
    if (ok) { seatGoal = st; if (!legs.length) path.push([st.x, st.z]); }
    return ok;
  };
  WK.stop = function () { path = []; legs = []; seatGoal = null; };
  WK.routing = () => path.length > 0 || legs.length > 0;
  // If the walker stops getting closer to the next step, look for another way from here (twice at most).
  function replan() {
    if (!goal || replans >= 2) return false;
    replans++;
    const res = findPath(WK.pos.x, WK.pos.z, goal.x, goal.z);
    if (!res || !res.cells.length) return false;
    path = res.cells;
    if (seatGoal && !legs.length) path.push([seatGoal.x, seatGoal.z]);
    return true;
  }
  WK.front = (d) => ({ x: WK.pos.x + Math.sin(WK.facing) * d, z: WK.pos.z + Math.cos(WK.facing) * d });
  // Planting by hand: kneel, dig a little hole with both hands, set the seed in, then rise with the arms
  // lifted as it begins to grow. place() is called as the seed goes in. Sowing as you walk is a quick toss
  // of seed from the hand that doesn't break your stride.
  let act = null;   // { type: 'plant' | 'toss', t, dur, place, placed, digs }
  WK.plantAnim = function (place) {
    if (!WK.active || (act && act.type === 'plant')) return false;
    seat = null; path = []; legs = []; seatGoal = null; vx = vz = 0; WK.pose = 'stand';
    act = { type: 'plant', t: 0, dur: 1.75, place, placed: false, digs: 0 };
    return true;
  };
  WK.toss = function () { if (!act) act = { type: 'toss', t: 0, dur: 0.55 }; };
  WK.busy = () => !!act && act.type === 'plant';
  WK.kneel = () => { kneel = 0.9; };
  WK.seatNear = function (x, z, r = 1.3) {
    let best = null, bd = r;
    for (const st of W.seats.concat(GD.feat.seat || [])) { const d = Math.hypot(st.x - x, st.z - z); if (d < bd) { bd = d; best = st; } }
    return best;
  };
  WK.isSitting = () => !!seat;
  WK.standUp = function () { if (seat) { seat = null; WK.pose = 'stand'; } };
  function sitOn(st) {
    seat = st; path = []; legs = []; seatGoal = null;
    WK.pos.set(st.x, st.y, st.z); WK.facing = st.angle != null ? Math.atan2(Math.cos(st.angle), Math.sin(st.angle)) : WK.facing;
    WK.pose = st.kind === 'soak' ? 'soak' : st.kind === 'edge' ? 'edge' : 'sit';
    vx = vz = 0;
    if (st.kind === 'soak') { A.splash(0, 0.6); SW.emit('see', 'soak'); }
  }
  WK.jump = function () {
    if (!WK.active || WK.airborne || !fig.visible) return;
    if (seat) { WK.standUp(); return; }
    const g = groundAt(WK.pos.x, WK.pos.z);
    if (g && g.kind === 'swim') { vy = 3.2; WK.airborne = true; L.splash(WK.pos.x, WK.pos.z, 6); return; }   // a little leap from the water
    vy = JUMP_V; WK.airborne = true; squash = 0;
    A.step(g ? g.kind : 'grass', W.panOf(WK.pos));
  };
  // the on-screen stick (touch): x to the right, z forward, each -1..1
  WK.stick = function (x, z) { joy.x = x; joy.z = z; if (x || z) { path = []; legs = []; seatGoal = null; } };

  // Keys move relative to the camera; the camera's orbit angle is passed in.
  const MOVE_KEYS = ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'];
  window.addEventListener('keydown', (e) => {
    if (!WK.active || /INPUT|TEXTAREA/.test(e.target.tagName) || e.metaKey || e.ctrlKey) return;
    const k = e.key.toLowerCase();
    if (MOVE_KEYS.includes(k)) { heldKeys.add(k); e.preventDefault(); }
    if (k === 'shift') heldKeys.add('shift');
    if (k === ' ') { e.preventDefault(); if (!e.repeat) WK.jump(); }
  });
  window.addEventListener('keyup', (e) => { const k = e.key.toLowerCase(); heldKeys.delete(k); if (k === ' ' && WK.active) e.preventDefault(); });
  window.addEventListener('blur', () => heldKeys.clear());

  WK.update = function (dt, t, camTheta) {
    if (!WK.active || WK.hidden) { L.walker = null; if (blob) blob.visible = false; return; }
    const pos = WK.pos;
    let dx = 0, dz = 0, want = 0;
    const has = (a, b) => heldKeys.has(a) || heldKeys.has(b);
    const planting = !!act && act.type === 'plant';
    const fwd = planting ? 0 : (has('w', 'arrowup') ? 1 : 0) - (has('s', 'arrowdown') ? 1 : 0) + joy.z;
    const side = planting ? 0 : (has('d', 'arrowright') ? 1 : 0) - (has('a', 'arrowleft') ? 1 : 0) + joy.x;
    if (act) {
      act.t += dt;
      if (planting) {
        const f = WK.front(0.75), g = groundAt(f.x, f.z);
        // soil flies as the hands dig, then the seed goes in
        if (act.digs < 3 && act.t > 0.42 + act.digs * 0.2) { act.digs++; if (g) L.dust(f.x, g.y, f.z, g.kind === 'grass' ? 'soil' : g.kind, 4); A.step(g && g.kind === 'snow' ? 'snow' : 'sand', W.panOf(pos)); }
        if (!act.placed && act.t > 1.02) { act.placed = true; if (act.place) act.place(); }
        // arms up, and a little hop for joy as it starts to grow
        if (!act.hopped && act.t > 1.42 && !WK.airborne) { act.hopped = true; vy = 3.4; WK.airborne = true; }
      }
      if (act.t >= act.dur) act = null;
    }
    const here = groundAt(pos.x, pos.z) || { y: pos.y, kind: 'sand' };
    const swimming = here.kind === 'swim';
    WK.running = heldKeys.has('shift') || WK.runToggle;
    if (fwd || side) {
      path = []; legs = []; seatGoal = null; seat = null;
      const fx = -Math.cos(camTheta), fz = -Math.sin(camTheta);
      dx = fx * fwd - fz * side; dz = fz * fwd + fx * side;
      const m = Math.hypot(dx, dz);
      if (m > 1) { dx /= m; dz /= m; }
      want = Math.min(1, m);
    } else if (path.length) {
      // move on to the next step in the same frame, so the stride never stops for a frame at each one
      let p = path[0], ex = p[0] - pos.x, ez = p[1] - pos.z, d = Math.hypot(ex, ez);
      while (d < (path.length > 1 || legs.length ? 0.45 : 0.12)) {
        path.shift(); wayBest = Infinity; stuckT = 0;
        if (!path.length && legs.length && !nextLeg()) { legs = []; }
        if (!path.length) { if (seatGoal) sitOn(seatGoal); break; }
        p = path[0]; ex = p[0] - pos.x; ez = p[1] - pos.z; d = Math.hypot(ex, ez);
      }
      if (path.length) {
        dx = ex / (d || 1); dz = ez / (d || 1); want = 1;
        // slow down for the last step, so arrival is gentle
        if (path.length === 1 && !legs.length) want = clamp(d / 0.6, 0.35, 1);
        if (d < wayBest - 0.03) { wayBest = d; stuckT = 0; }
        else if ((stuckT += dt) > 0.9) {
          stuckT = 0; wayBest = Infinity;
          if (!replan()) { path = []; legs = []; seatGoal = null; dx = dz = 0; want = 0; }
        }
      }
    }
    // speed for the ground underfoot: slower in water and on the cloud, quicker running; long routes jog
    let top = swimming ? (WK.running ? SWIM_FAST : SWIM) : WK.running ? RUN : WALK;
    if (!WK.running && path.length && !(fwd || side) && routeLeft > 14) top = swimming ? SWIM_FAST : JOG;
    if (here.kind === 'water') top *= 0.6;
    if (here.kind === 'cloud') top *= 0.85;
    if (seat || planting) { want = 0; }
    const ax = dx * top * want, az = dz * top * want;
    const acc = 1 - Math.exp(-dt * (WK.airborne ? 2.5 : want > 0 ? 9 : 11));
    vx += (ax - vx) * acc; vz += (az - vz) * acc;
    const sp = Math.hypot(vx, vz);
    WK.speed = sp;
    WK.moving = sp > 0.08 && !seat;
    WK.medium = here.kind;
    if (WK.moving) {
      seat = null; if (WK.pose !== 'stand') WK.pose = 'stand';
      const mx = vx * dt, mz = vz * dt;
      const tryMove = (ux, uz) => {
        const nx = pos.x + ux, nz = pos.z + uz, g = groundAt(nx, nz);
        if (!g) { if (SEA === 'lava' && S.t - heatToastT > 6 && W.heightAt(nx, nz) < 0) { heatToastT = S.t; SW.ui && SW.ui.toast('Too hot to go further. Take a bridge, or the boat.', 3, true); } return false; }
        const lk = lockedAt(nx, nz);
        if (lk && !lockedAt(pos.x, pos.z)) { if (S.t - lockedToastT > 5) { lockedToastT = S.t; SW.emit('lockedIsland', lk); } return false; }
        const fromY = WK.airborne ? pos.y : here.y;
        // a little more forgiving than the route finder, so every route it finds can be walked
        if (g.y - fromY > (WK.airborne ? 0.3 : 1.45)) return false;
        if (!WK.airborne && fromY - g.y > ((g.kind === 'swim' || g.kind === 'water') ? 6.5 : 3.05)) return false;
        // bridge rails keep you on the planks over the water, unless you jump over them
        if (here.deck && g.deck !== here.deck && overRail(here.deck, nx, nz) && !(WK.airborne && pos.y > here.y + 0.75)) return false;
        pos.x = nx; pos.z = nz;
        return true;
      };
      if (!tryMove(mx, mz) && !tryMove(mx, 0) && !tryMove(0, mz)) {
        // on a path, ease back toward the middle of this block and let the stuck check find another way
        const cx = Math.round(pos.x) - pos.x, cz = Math.round(pos.z) - pos.z, cl = Math.hypot(cx, cz);
        if (!path.length || cl < 0.02 || !tryMove(cx / cl * sp * dt, cz / cl * sp * dt)) { vx *= 0.3; vz *= 0.3; }
      }
      collide(pos);
      routeLeft = Math.max(0, routeLeft - sp * dt);
      const want2 = Math.atan2(vx, vz), dTurn = U.angDiff(WK.facing, want2) * Math.min(1, dt * (swimming ? 5 : 10));
      WK.facing += dTurn; turnRate += (dTurn / Math.max(dt, 1e-4) - turnRate) * Math.min(1, dt * 6);
      phase += sp * dt * (swimming ? 2.4 : WK.running || sp > 2.4 ? 3.3 : 5.2);
      stepDist += sp * dt;
      const stride = swimming ? 1.3 : sp > 2.4 ? 0.95 : 0.62;
      if (stepDist > stride && !WK.airborne) {
        stepDist = 0;
        const g = groundAt(pos.x, pos.z);
        if (g) {
          if (g.kind === 'swim') { A.splash(W.panOf(pos), 0.25); W.addRipple(pos.x, pos.z, 0.45); L.splash(pos.x, pos.z, 4); }
          else {
            A.step(g.kind === 'cloud' ? 'snow' : g.kind, W.panOf(pos));
            if (g.kind === 'water') { W.addRipple(pos.x, pos.z, 0.3); L.splash(pos.x, pos.z, 2); }
            if (g.kind === 'sand' || g.kind === 'snow' || g.kind === 'cloud') leavePrint(pos.x, g.y, pos.z, WK.facing);
            if (sp > 2.4 || g.kind === 'cloud') L.dust(pos.x, g.y, pos.z, g.kind, sp > 2.4 ? 3 : 2);
          }
        }
      }
      const I = W.islandAt(pos.x, pos.z);
      if (I !== W.island && Math.hypot(pos.x - I.x, pos.z - I.z) < I.r + 6) W.setIsland(I.id);
    } else { turnRate *= Math.max(0, 1 - dt * 6); vx *= 0.5; vz *= 0.5; }
    // up and down: jumping and falling, or following the ground
    if (!seat) {
      const g = groundAt(pos.x, pos.z);
      const gy = g ? g.y : pos.y;
      if (WK.airborne) {
        vy -= GRAV * dt; pos.y += vy * dt;
        const floor = g && g.kind === 'swim' ? -1 : gy;
        if (pos.y <= floor && vy < 0) {
          WK.airborne = false; squash = clamp(-vy / 10, 0.15, 1); pos.y = floor;
          if (g && (g.kind === 'swim' || g.kind === 'water')) { L.splash(pos.x, pos.z, g.kind === 'swim' ? 14 : 6); W.addRipple(pos.x, pos.z, 0.6); A.splash(W.panOf(pos), g.kind === 'swim' ? 0.8 : 0.4); }
          else if (g) { A.step(g.kind === 'cloud' ? 'snow' : g.kind, W.panOf(pos)); if (g.kind !== 'wood' && g.kind !== 'stone') L.dust(pos.x, g.y, pos.z, g.kind, 5); }
        }
      } else if (pos.y - gy > 0.7 && g) { WK.airborne = true; vy = 0; }   // walked off a ledge: fall
      else pos.y += (gy - pos.y) * Math.min(1, dt * 12);
    }
    squash = Math.max(0, squash - dt * 3);
    if (WK.moving || WK.airborne) idleT = 0; else idleT += dt;
    L.walker = pos;
    updatePrints(dt);
    animate(dt, t, here);
    // the contact shadow lies on whatever is underfoot, fading as you rise in a jump
    const gb = seat ? null : groundAt(pos.x, pos.z);
    blob.visible = !!gb && gb.kind !== 'swim' && gb.kind !== 'water';
    if (blob.visible) {
      const up = Math.max(0, pos.y - gb.y);
      blob.position.set(pos.x, gb.y + 0.035, pos.z);
      blob.scale.setScalar((0.75 + 0.2 * WK.speed / RUN) * (1 + up * 0.3));
      blobU.uA.value = clamp(1 - up / 2.2, 0, 1);
    }
  };

  // ---------------------------------------------------------------- animation
  function animate(dt, t, here) {
    const b = S.breath.b, sp = WK.speed, moving = WK.moving;
    const swim = here.kind === 'swim' && !WK.airborne && !seat;
    const run = smooth(1.9, 3.2, sp), walkAmt = smooth(0.08, 0.6, sp);
    fig.position.copy(WK.pos);
    fig.rotation.y = WK.facing;
    kneel = Math.max(0, kneel - dt);
    const s = Math.sin(phase), c = Math.cos(phase);
    // defaults: standing
    let hipsY = 0.5, torsoX = 0, torsoZ = 0, bodyX = 0, bodyY = 0, headX = 0, headY = 0;
    let legL = 0, legR = 0, shinL = 0, shinR = 0, armL = 0, armR = 0, foreL = 0, foreR = 0, armLz = -0.06, armRz = 0.06;
    if (swim) {
      // breaststroke: tipped forward with the head up, arms sweeping round, legs kicking
      const k = smooth(0.1, 0.8, sp), st = phase * 1.0;
      bodyX = 0.15 + 1.05 * k; bodyY = -0.22 + 0.1 * k + 0.03 * Math.sin(t * 2.2);
      headX = -0.9 * k - 0.1;
      const sweep = Math.sin(st), out = Math.max(0, Math.cos(st));
      armL = armR = -2.3 + 0.9 * sweep * k - (1 - k) * 0.6 * Math.sin(t * 2.4);
      armLz = -0.3 - 0.9 * out * k; armRz = 0.3 + 0.9 * out * k;
      foreL = foreR = -0.4 - 0.6 * out;
      legL = 0.3 * Math.sin(st * 2) * k + 0.2 * Math.sin(t * 3); legR = -legL;
      shinL = shinR = 0.6 + 0.4 * Math.max(0, Math.sin(st)) * k;
    } else if (WK.airborne) {
      const up = clamp(vy / JUMP_V, -1, 1);
      legL = -0.7; legR = 0.35; shinL = 1.1; shinR = 0.5;
      armL = -1.3 - 0.8 * up; armR = -0.7 - 0.6 * up; armLz = -0.35; armRz = 0.35; foreL = foreR = -0.3;
      torsoX = 0.1; hipsY = 0.5;
    } else if (moving) {
      // a stride whose length and lean grow with speed; knees bend on the forward swing
      const amp = (0.5 + 0.45 * run) * walkAmt;
      legL = s * amp; legR = -s * amp;
      shinL = Math.max(0, -c) * (0.5 + 0.9 * run) * walkAmt + 0.05; shinR = Math.max(0, c) * (0.5 + 0.9 * run) * walkAmt + 0.05;
      armL = -s * (0.45 + 0.6 * run) * walkAmt; armR = s * (0.45 + 0.6 * run) * walkAmt;
      foreL = foreR = -(0.15 + 1.0 * run);
      hipsY = 0.5 + Math.abs(c) * (0.025 + 0.06 * run) - 0.03 * run;
      torsoX = 0.05 + 0.2 * run;
      headX = -0.05 * run;
      torsoZ = clamp(-turnRate * 0.04, -0.2, 0.2);
      if (here.kind === 'water') { legL *= 1.2; legR *= 1.2; armLz = -0.35; armRz = 0.35; }   // wading: arms out for balance
    } else {
      // at rest the figure breathes with the island, and now and then looks about
      armLz = -0.06 - 0.04 * b; armRz = 0.06 + 0.04 * b; foreL = foreR = -0.08;
      headX = WK.pose === 'stand' ? -0.05 : -0.12 - 0.05 * b;
      headY = 0.55 * Math.sin(t * 0.21) * smooth(4, 7, idleT) + 0.25 * Math.sin(t * 0.53) * smooth(4, 7, idleT);
      if (here.kind === 'water') hipsY = 0.5;
    }
    if (WK.pose === 'sit' || WK.pose === 'soak') { hipsY = 0.02; legL = legR = -1.5; shinL = shinR = 1.4; armL = armR = -0.35; foreL = foreR = -0.6; }
    else if (WK.pose === 'edge') { hipsY = 0.02; legL = legR = -1.45; shinL = 1.3 + Math.sin(t * 1.3) * 0.25; shinR = 1.3 - Math.sin(t * 1.3) * 0.25; armL = armR = 0.25; }
    if (kneel > 0) { const k = Math.sin(Math.PI * kneel / 0.9); hipsY -= 0.22 * k; torsoX = 0.5 * k; armL = -1.0 * k; armR = -1.0 * k; legL = -0.9 * k; legR = 0.4 * k; shinL = 1.4 * k; shinR = 0.6 * k; }
    if (act && act.type === 'plant') {
      // down on one knee, dig with alternating hands, cup the seed in, then rise with arms lifted to the sky
      const k = act.t, down = smooth(0, 0.32, k) * (1 - smooth(1.12, 1.45, k));
      const dig = smooth(0.32, 0.4, k) * (1 - smooth(0.86, 0.94, k)), cup = smooth(0.86, 0.94, k) * (1 - smooth(1.08, 1.16, k));
      const rise = smooth(1.1, 1.38, k) * (1 - smooth(1.5, 1.75, k));
      hipsY = 0.5 - 0.3 * down; torsoX = 0.75 * down - 0.18 * rise;
      legL = -1.25 * down; shinL = 1.35 * down; legR = 0.15 * down; shinR = 1.95 * down;
      const sw = Math.sin(k * 24);
      armL = (-1.0 - 0.45 * sw) * dig - 1.05 * cup - 2.75 * rise; armR = (-1.0 + 0.45 * sw) * dig - 1.05 * cup - 2.75 * rise;
      armLz = -0.06 - 0.12 * dig + 0.08 * cup - 0.55 * rise; armRz = 0.06 + 0.12 * dig - 0.08 * cup + 0.55 * rise;
      foreL = foreR = -0.55 * dig - 0.9 * cup - 0.1 * rise;
      headX = 0.35 * (dig + cup) - 0.45 * rise; headY = 0;
    } else if (act && act.type === 'toss') {
      // an easy underarm throw of seed from the right hand, mid-stride
      const k = act.t / act.dur, sw = Math.sin(Math.PI * k);
      armR = -0.4 + 0.9 * Math.cos(Math.PI * k) * sw - 1.1 * sw; armRz = 0.06 + 0.35 * sw; foreR = -0.4 * sw;
    }
    hipsY -= 0.12 * squash;
    // ease toward the pose so changes are never abrupt
    const e = 1 - Math.exp(-dt * (moving || act ? 18 : 9));
    const to = (o, prop, v) => { o[prop] += (v - o[prop]) * e; };
    to(P.body.rotation, 'x', bodyX); to(P.body.position, 'y', 0.75 + bodyY);
    to(P.hips.position, 'y', hipsY - 0.75);
    to(P.torso.rotation, 'x', torsoX); to(P.torso.rotation, 'z', torsoZ);
    to(P.legL.rotation, 'x', legL); to(P.legR.rotation, 'x', legR);
    to(P.shinL.rotation, 'x', shinL); to(P.shinR.rotation, 'x', shinR);
    to(P.armL.rotation, 'x', armL); to(P.armR.rotation, 'x', armR);
    to(P.armL.rotation, 'z', armLz); to(P.armR.rotation, 'z', armRz);
    to(P.foreL.rotation, 'x', foreL); to(P.foreR.rotation, 'x', foreR);
    to(P.head.rotation, 'x', headX); to(P.head.rotation, 'y', headY);
    P.torso.scale.y = !moving && !swim ? 1 + 0.04 * b : 1;
    // in deep water, rings spread from the swimmer
    if (swim && Math.random() < dt * (moving ? 2.5 : 0.8)) W.addRipple(WK.pos.x, WK.pos.z, moving ? 0.35 : 0.2);
  }
})(window.SW);
