// Stillwater: bridges. Every island in a world is joined to the rest by a network of arched bridges, so
// the whole archipelago can be walked. The network is the shortest set of links that joins every island
// (a minimum spanning tree), plus a few short extra links so there are loops to wander. Each world builds
// its bridges in its own style: oak planks, red lacquer, weathered pale wood, bamboo, marble and gold, or
// black glass lit by embers. Bridges to islands that have not opened yet are closed by a rope.
(function (SW) {
  'use strict';
  const { U } = SW;
  const { clamp } = U;
  const K = SW.K, S = SW.S;
  const B = SW.bridges = { list: [], ready: false };
  let W;
  const STYLE = {
    stillwater: { plank: [0x9a7a5a, 0x8a6b4e, 0xa4845f], frame: 0x6e5440, lamp: 0xffe2b0, glow: 0xffa95c },
    lantern: { plank: [0x8a6a4a, 0x7c5e42, 0x94734f], frame: 0xa8382a, lamp: 0xffd08a, glow: 0xff9a50, roofs: 0x2e2a2a },
    frost: { plank: [0xb8afa2, 0xaca395, 0xc4bcb0], frame: 0x6a5c4e, lamp: 0xfff0d6, glow: 0xffc890 },
    coral: { plank: [0xd6bc7c, 0xc8ae6c, 0xe0c88c], frame: 0x8c7442, lamp: 0xffc070, glow: 0xff8a40 },
    heaven: { plank: [0xf4f0e6, 0xeae4d6, 0xf8f4ec], frame: 0xe2ba52, lamp: 0xfff6d8, glow: 0xffe0a0 },
    hell: { plank: [0x30282e, 0x282226, 0x3a3036], frame: 0x1c1618, lamp: 0xff8a40, glow: 0xff5a10 },
  };
  const HW = 0.85;   // half the walkable width

  const segDist = (x, z, ax, az, bx, bz) => {
    const vx = bx - ax, vz = bz - az, k = clamp(((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz || 1), 0, 1);
    return Math.hypot(x - ax - vx * k, z - az - vz * k);
  };
  function crosses(a, b) {   // do two segments cross?
    const o = (px, pz, qx, qz, rx, rz) => Math.sign((qx - px) * (rz - pz) - (qz - pz) * (rx - px));
    return o(a.ax, a.az, a.bx, a.bz, b.ax, b.az) !== o(a.ax, a.az, a.bx, a.bz, b.bx, b.bz) && o(b.ax, b.az, b.bx, b.bz, a.ax, a.az) !== o(b.ax, b.az, b.bx, b.bz, a.bx, a.bz);
  }

  // ------------------------------------------------------------------ planning
  // Where a straight crossing from island A to island B could run, offset sideways by `off` so it keeps
  // clear of the jetties (which point straight at home). Null if it would hit anything on the way.
  function layout(A, Bi, off, blockers, avoid) {
    const dx = Bi.x - A.x, dz = Bi.z - A.z, D = Math.hypot(dx, dz), ux = dx / D, uz = dz / D, px = -uz, pz = ux;
    const ax = A.x + px * off, az = A.z + pz * off, bx = Bi.x + px * off, bz = Bi.z + pz * off;
    const at = (t) => [ax + dx * t, az + dz * t];
    const step = 0.25 / D;
    let tA = null, tB = null;
    for (let t = 0.5; t >= 0; t -= step) { const [x, z] = at(t); if (W.heightAt(x, z) >= 0) { if (Math.hypot(x - A.x, z - A.z) < A.r * 1.8 + 4) tA = t; break; } }
    for (let t = 0.5; t <= 1; t += step) { const [x, z] = at(t); if (W.heightAt(x, z) >= 0) { if (Math.hypot(x - Bi.x, z - Bi.z) < Bi.r * 1.8 + 4) tB = t; break; } }
    if (tA == null || tB == null) return null;
    // run up to 1.6 blocks onto the land at each end, but no further than the land goes (an atoll's ring of
    // sand is thin, and the planks must not end over its lagoon)
    const reach = (t0, dir) => { let k = 0; while (k < 1.6 && W.heightAt(...at(t0 + dir * (k + 0.25) / D)) >= 0) k += 0.25; return t0 + dir * Math.max(k, 0.25) / D; };
    const s0 = reach(tA, -1), s1 = reach(tB, 1);
    const [x0, z0] = at(s0), [x1, z1] = at(s1), len = Math.hypot(x1 - x0, z1 - z0);
    if (len > 130 || len < 6) return null;
    const hA = Math.max(0, W.heightAt(...at(tA))), hB = Math.max(0, W.heightAt(...at(tB)));
    if (hA > 6 || hB > 6) return null;
    // clear of rocks, stacks and arches, of the other islands, and of jetties and boat landings
    for (let s = s0 + 2.5 / D; s < s1 - 2.5 / D; s += 1 / D) {
      const [x, z] = at(s);
      for (const b of blockers) if (Math.hypot(x - b[0], z - b[1]) < b[2]) return null;
    }
    for (const d of avoid) if (segDist(d.x, d.z, x0, z0, x1, z1) < d.r) return null;
    // the rails hold you on over the water; where the planks rest on land you can step off the side
    return { ax: x0, az: z0, bx: x1, bz: z1, ux, uz, px, pz, len, yA: hA + 0.16, yB: hB + 0.16, landA: at((tA + s0) / 2), landB: at((tB + s1) / 2),
      landTA: ((tA + s0) / 2 - s0) / (s1 - s0), landTB: ((tB + s1) / 2 - s0) / (s1 - s0),
      railFrom: (tA - s0) / (s1 - s0) + 0.8 / len, railTo: (tB - s0) / (s1 - s0) - 0.8 / len };
  }

  function plan() {
    const isl = K.ISLANDS, n = isl.length;
    const blockers = [];
    if (K.ARCH) blockers.push([K.ARCH.x, K.ARCH.z, (K.ARCH.span || 6) + 4]);
    if (K.ISLET) blockers.push([K.ISLET.x, K.ISLET.z, K.ISLET.r + 3]);
    for (const s of K.STACKS || []) blockers.push([s[0], s[1], (s[2] || 1) + 2.6]);
    for (const s of K.SKERRIES || []) blockers.push([s.x, s.z, s.r + 2.2]);
    // the dock, the jetties and where the boat moors stay clear
    const avoid = [];
    for (const d of W.decks) for (let k = 0; k <= 4; k++) avoid.push({ x: d.ax + (d.bx - d.ax) * k / 4, z: d.az + (d.bz - d.az) * k / 4, r: d.hw + 1.6 });
    for (const I of isl) if (I.landing) avoid.push({ x: I.landing.x, z: I.landing.z, r: 3.2 });
    const cand = [];
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      const A = isl[i], Bi = isl[j], D = Math.hypot(Bi.x - A.x, Bi.z - A.z);
      if (D > 150) continue;
      // nothing else in the way
      let clear = true;
      for (let k = 0; k < n && clear; k++) if (k !== i && k !== j && segDist(isl[k].x, isl[k].z, A.x, A.z, Bi.x, Bi.z) < isl[k].r + 6) clear = false;
      if (!clear) continue;
      let g = null;
      for (const off of [3.4, -3.4, 5.5, -5.5, 0]) { g = layout(A, Bi, off, blockers, avoid); if (g) break; }
      if (g) cand.push(Object.assign(g, { i, j, a: A, b: Bi }));
    }
    cand.sort((p, q) => p.len - q.len);
    const parent = isl.map((_, i) => i), find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
    const chosen = [];
    for (const c of cand) {
      const ra = find(c.i), rb = find(c.j);
      if (ra === rb || chosen.some((o) => crosses(o, c))) continue;
      parent[ra] = rb; chosen.push(c);
    }
    // a few short extra links, so there is more than one way round
    let extra = 0;
    for (const c of cand) {
      if (extra >= Math.ceil(n / 5) || c.len > 70 || chosen.includes(c)) continue;
      if (chosen.some((o) => crosses(o, c) || (o.i === c.i && o.j === c.j))) continue;
      chosen.push(c); extra++;
    }
    return chosen;
  }

  // ------------------------------------------------------------------ building
  const yAt = (br, s) => br.yA + (br.yB - br.yA) * s + br.arch * Math.sin(Math.PI * s);
  const dummy = new THREE.Object3D();
  dummy.rotation.order = 'YXZ';
  function build(list) {
    const st = STYLE[K.WORLD.id] || STYLE.stillwater;
    const planks = [], frame = [], lamps = [];
    const put = (arr, x, y, z, sx, sy, sz, yaw, pitch, col) => {
      dummy.position.set(x, y, z); dummy.rotation.set(pitch, yaw, 0); dummy.scale.set(sx, sy, sz); dummy.updateMatrix();
      arr.push({ m: dummy.matrix.clone(), c: col });
    };
    for (const br of list) {
      const yaw = Math.atan2(br.ux, br.uz), L = br.len;
      const slope = (s) => Math.atan((yAt(br, Math.min(1, s + 0.5 / L)) - yAt(br, Math.max(0, s - 0.5 / L))) / 1.0);
      const P = (s, side, up) => [br.ax + (br.bx - br.ax) * s + br.px * side, yAt(br, s) + up, br.az + (br.bz - br.az) * s + br.pz * side];
      // planks, each a slightly different shade
      const np = Math.ceil(L / 0.5);
      for (let i = 0; i < np; i++) {
        const s = (i + 0.5) / np, [x, y, z] = P(s, 0, -0.07), rnd = U.hash2(i, br.i * 31 + br.j, 7);
        put(planks, x, y, z, HW * 2 + 0.1, 0.12, L / np - 0.04, yaw, -slope(s), st.plank[(rnd * st.plank.length) | 0]);
      }
      // two stringers under the deck
      for (const side of [-HW + 0.1, HW - 0.1]) for (let i = 0; i < Math.ceil(L); i++) {
        const s = (i + 0.5) / Math.ceil(L), [x, y, z] = P(s, side, -0.2);
        put(frame, x, y, z, 0.14, 0.16, L / Math.ceil(L) + 0.06, yaw, -slope(s));
      }
      // rails and balusters
      const nr = Math.ceil(L / 1.0);
      for (const side of [-HW, HW]) {
        for (let i = 0; i < nr; i++) {
          const s = (i + 0.5) / nr, [x, y, z] = P(s, side, 0.62);
          put(frame, x, y, z, 0.09, 0.09, L / nr + 0.05, yaw, -slope(s));
        }
        for (let i = 0; i <= nr; i++) {
          const s = i / nr, [x, y, z] = P(s, side, 0.31);
          put(frame, x, y, z, 0.08, 0.62, 0.08, yaw, 0);
        }
      }
      // posts down into the sea every few blocks
      const npost = Math.max(2, Math.round(L / 3.6));
      for (let i = 1; i < npost; i++) {
        const s = i / npost;
        for (const side of [-HW + 0.05, HW - 0.05]) {
          const [x, y, z] = P(s, side, -0.25), floor = Math.max(W.heightAt(x, z), -5) + (K.WORLD.look.sea ? 0 : -0.5), top = y, h = top - floor;
          if (h > 0.3) put(frame, x, floor + h / 2, z, 0.2, h, 0.2, yaw, 0);
        }
      }
      // lamps on tall posts, alternating sides, and a pair at each end
      const nl = Math.max(1, Math.round(L / 13));
      const lampAt = (s, side) => {
        const [x, y, z] = P(s, side * (HW + 0.05), 0);
        put(frame, x, y + 0.7, z, 0.12, 1.4, 0.12, yaw, 0);
        put(frame, x, y + 1.44, z, 0.34, 0.06, 0.34, yaw, 0);
        put(lamps, x, y + 1.25, z, 0.26, 0.3, 0.26, yaw, 0);
        br.lamps.push(new THREE.Vector3(x, y + 1.25, z));
      };
      br.lamps = [];
      lampAt(0.6 / L, -1); lampAt(0.6 / L, 1); lampAt(1 - 0.6 / L, -1); lampAt(1 - 0.6 / L, 1);
      for (let i = 1; i < nl; i++) lampAt(i / nl, i % 2 ? 1 : -1);
    }
    const mk = (arr, mat, shadow) => {
      if (!arr.length) return null;
      const im = new THREE.InstancedMesh(W.boxGeo, mat, arr.length);
      arr.forEach((e, i) => { im.setMatrixAt(i, e.m); if (e.c != null) im.setColorAt(i, new THREE.Color(e.c)); });
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
      im.castShadow = shadow; im.receiveShadow = true; im.frustumCulled = false;
      W.scene.add(im);
      return im;
    };
    const plankMat = W.voxelMat(0xffffff, { edges: 0.2, texel: 10, texAmt: 0.08, wet: true });
    const frameMat = W.voxelMat(st.frame, { edges: 0.16, texel: 10, texAmt: 0.06, wet: true });
    B.lampMat = W.patch(new THREE.MeshPhongMaterial({ color: st.lamp, emissive: st.glow, emissiveIntensity: 0.3, shininess: 30 }), { edges: 0.25 });
    B.meshes = [mk(planks, plankMat, true), mk(frame, frameMat, true), mk(lamps, B.lampMat, false)].filter(Boolean);
    // closed rope at the end of any bridge onto an island that has not opened yet
    const ropeMat = W.voxelMat(K.WORLD.id === 'hell' ? 0x8a2a1a : 0xc8a870, { edges: 0.1 });
    for (const br of list) {
      br.gates = {};
      for (const [I, s] of [[br.a, 0.25 / br.len], [br.b, 1 - 0.25 / br.len]]) {
        const g = new THREE.Group(), [x, y, z] = [br.ax + (br.bx - br.ax) * s, yAt(br, s), br.az + (br.bz - br.az) * s];
        g.position.set(x, y, z); g.rotation.y = Math.atan2(br.ux, br.uz);
        for (const h of [0.35, 0.7]) { const m = new THREE.Mesh(W.boxGeo, ropeMat); m.scale.set(HW * 2, 0.06, 0.06); m.position.y = h; g.add(m); }
        g.visible = false;
        W.scene.add(g);
        br.gates[I.id] = g;
      }
    }
  }

  // ------------------------------------------------------------------ public
  B.init = function () {
    W = SW.world;
    const list = plan();
    for (const br of list) {
      br.arch = clamp(br.len * 0.035, 0.7, 2.2);
      // high enough in the middle for the rowboat to pass beneath
      const mid = (br.yA + br.yB) / 2 + br.arch;
      if (mid < K.WL + 2.2) br.arch += K.WL + 2.2 - mid;
      br.deck = { ax: br.ax, az: br.az, bx: br.bx, bz: br.bz, hw: HW, y: br.yA, yb: br.yB, arch: br.arch, rail: true, railFrom: br.railFrom, railTo: br.railTo, bridge: br };
      W.decks.push(br.deck);
    }
    build(list);
    B.list = list;
    B.ready = true;
  };
  B.yAt = yAt;
  // which bridges lead onto islands that are still closed
  B.setOpen = function (isOpen) {
    for (const br of B.list) for (const id in br.gates) br.gates[id].visible = !isOpen(id);
  };
  // the islands joined to an island, with the bridge
  B.links = (id) => B.list.filter((br) => br.a.id === id || br.b.id === id).map((br) => ({ br, other: br.a.id === id ? br.b : br.a }));
  B.update = function () {
    if (!B.lampMat) return;
    B.lampMat.emissiveIntensity = 0.3 + 1.6 * clamp(S.glow, 0, 1);
  };
})(window.SW);
