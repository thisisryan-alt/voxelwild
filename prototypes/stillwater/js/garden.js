// Stillwater: the garden. Plants and decorations are voxels that grow in over time and follow
// the seasons: leaves turn and fall, flowers rest through winter, snow settles on the pines.
(function (SW) {
  'use strict';
  const { K, U } = SW;
  const { clamp, mulberry32, hex, pal4 } = U;
  const GD = SW.garden = { items: [], feat: {}, version: 0 };
  const S = SW.S;
  let W;
  const M4 = new THREE.Matrix4(), tmpC = new THREE.Color(), V = THREE.Vector3;

  // ---------------------------------------------------------------- palettes
  const PALS = {
    oak: pal4([0xa8d66f, 0x98c964, 0xb5de80, 0x9fd06c], [0x6f9e5a, 0x7fae63, 0x5f8f4e, 0x8fbb6b, 0x76a65e], [0xd9892f, 0xe0a43a, 0xc96a2b, 0xb5552a, 0xd8b24a], null),
    maple: pal4([0xb4d877, 0x9fcf6e, 0xc9d97a], [0x5f9450, 0x6e9f58, 0x7aa860], [0xd2452f, 0xe0623a, 0xb8352a, 0xf08a3c, 0xc94a3a], null),
    birch: pal4([0xc2e28a, 0xb0d97a], [0x8dc06a, 0x9ccb73, 0x86b864], [0xf0c84a, 0xe8b83a, 0xf5d76a], null),
    cherry: pal4([0xf4c1cf, 0xf7d3dc, 0xeeadc0, 0xfbe6ec, 0xf0b7c8], [0x7aa860, 0x6c9a55, 0x86b466], [0xd8774a, 0xc9603c, 0xe39b5a], null),
    pine: pal4([0x426f4c, 0x4a7a56, 0x3a6344], [0x3f6b4a, 0x47775a, 0x365e40], [0x3f6b4a, 0x47775a, 0x365e40], [0x3c6447, 0xe9eff2, 0xf3f6f8, 0x456e50]),
    pineSnow: pal4(...Array(4).fill([0x3c6447, 0xe9eff2, 0xf3f6f8, 0x456e50, 0xe4ecef])),
    willow: pal4([0xb9dc84, 0xa6d276, 0xc4e290], [0x8cbc68, 0x7caf5c, 0x98c672], [0xd9c35a, 0xcbb04a, 0xe2cf72], null),
    palm: pal4([0x5f9a4e, 0x6aa857, 0x4f8a44], [0x5f9a4e, 0x6aa857, 0x4f8a44], [0x6a9a4e, 0x7aa457, 0x5f8a44], [0x58884a, 0x648f50]),
    bush: pal4([0x8fc46a, 0x7fb860], [0x5f9450, 0x6a9e58, 0x578a4a], [0x9a8a3e, 0xa86a34, 0x8a7a3a], [0x5d7552, 0xe6edf0, 0x66805a]),
    berry: pal4([0x8fc46a], [0xc9384a, 0xd94a5a, 0xb02a3a], [0x8a2a5a, 0x7a2a4a], null),
    stem: pal4([0x6c9a55], [0x6c9a55, 0x5f8f4e], [0x9a8a50], null),
    tuft: pal4([0x9ccc6a, 0xa8d476], [0x86b468, 0x7aa85c], [0xb8a85a, 0xa89a50], null),
    dune: pal4([0xc9c98f, 0xb6bd7d], [0xc9c98f, 0xb6bd7d, 0xd6d3a0], [0xd2c48a, 0xc8b47a], [0xcfc7a0, 0xbdb58e]),
    fern: pal4([0x7fbf5a, 0x6aa857], [0x5f9a4e, 0x6aa857], [0xb08a3a, 0xa0782e], null),
    lily: pal4([0x6aa85d, 0x5c9a55], [0x5c9a55, 0x6aa85d, 0x4f8c4a], [0xa89a4a, 0x8f8a44], null),
    lotus: pal4(null, [0xf2b8c8, 0xfbe2ea, 0xf6cad6], null, null),
    lotusC: pal4(null, [0xf6e27a], null, null),
    reed: pal4([0x8fb062, 0x7f9e5a], [0x7f9e5a, 0x6f8e4e], [0xb9a066, 0xa89058], [0xc9b88a, 0xb8a87a]),
    cattail: pal4([0x7a5a3a], [0x6b4a33], [0x6b4a33, 0x8a6a4a], [0x8a7a6a]),
    sunPetal: pal4(null, [0xf2c230, 0xf5d04a, 0xe8b628], [0xc89a3a, 0xb8862e], null),
    sunCore: pal4(null, [0x6b4a2a, 0x5a3e24], [0x5a3e24], null),
    lavender: pal4([0x8fa070], [0x9b86d6, 0x8a74c9, 0xb3a3e3], [0x8a7aa8, 0x7a6a98], null),
    shroom: pal4([0xc8453a, 0xd0503f], [0xc8453a], [0xb83a30, 0xc8453a], null),
    shroomB: pal4([0x9a6a44], [0x8a5e3c], [0x9a6a44, 0x7a5434], null),
    shroomStem: pal4([0xf2ece0], [0xf2ece0], [0xe8e0d0], null),
    centre: pal4([0xf3c35c], [0xf3c35c], [0xb8945a], null),
  };
  const PETALS = [[0xb9a6e0, 0xd6caf0], [0xf6f2ea, 0xfdfbf6], [0xf2d98d, 0xf7e6ad], [0x9cc8e8, 0xc2def2], [0xeeb0bf, 0xf6ccd6], [0xf4a6a0, 0xf9c8c0]];
  PETALS.forEach((c, i) => { PALS['petal' + i] = pal4(c, c, [0xc8a87a, 0xb89a74], null); });
  const TULIPS = [0xe85a6a, 0xf2a03a, 0xf6f0e6, 0xe86fa0, 0xf2d35a];
  TULIPS.forEach((c, i) => { PALS['tulip' + i] = pal4([c], [c], null, null); });
  const PAL_IDS = Object.keys(PALS), PAL_LIST = PAL_IDS.map((k) => PALS[k]);
  const PAL_INDEX = Object.fromEntries(PAL_IDS.map((k, i) => [k, i]));
  GD.PALS = PALS; GD.PAL_INDEX = PAL_INDEX;
  GD.colorOf = (name, out) => { U.seasonColor(PALS[name], 0.5, S.season, out); return out; };

  const STONE = [0x9a9f9b, 0x8e938f, 0xa7aba6, 0x858a87];
  const stoneC = (rng) => hex(U.pick(rng, STONE));
  const woodC = (h) => (rng) => hex(h).offsetHSL(0, 0, (rng() - 0.5) * 0.05);
  const birchWood = (rng) => (rng() < 0.18 ? hex(0x3a3836) : hex(0xe8e4da).offsetHSL(0, 0, (rng() - 0.5) * 0.04));
  const WOOD = 0x8a6a4c, WOOD2 = 0x7a5c40, DARK = 0x5a4030;
  // Local +x faces out to sea; k quarter turns rotate local (x, z) into the world.
  const faceK = (x, z) => ((Math.round(Math.atan2(z, x) / (Math.PI / 2)) % 4) + 4) % 4;
  const rot = (x, z, k) => (k === 0 ? [x, z] : k === 1 ? [-z, x] : k === 2 ? [-x, -z] : [z, -x]);

  // ---------------------------------------------------------------- growers
  let woodG, leafG, glowG, glowMat;
  const swayU = { value: 0 }, swayAmpU = { value: 1 };
  function makeGrower(cap, mat, shadow) {
    const mesh = new THREE.InstancedMesh(W.boxGeo, mat, cap);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    for (let i = 0; i < cap; i++) mesh.setColorAt(i, tmpC.setRGB(1, 1, 1));
    mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    mesh.count = 0; mesh.castShadow = shadow; mesh.receiveShadow = shadow; mesh.frustumCulled = false;
    W.scene.add(mesh);
    const f = () => new Float32Array(cap);
    return {
      mesh, cap, n: 0, base: 0, pending: [], shrinking: [], cursor: 0, colorDirty: false, matDirty: false,
      px: f(), py: f(), pz: f(), sz: f(), sy: f(), birth: f(), dur: f(), grow: f(), rr: f(),
      vis: new Float32Array(cap).fill(1), pal: new Int16Array(cap).fill(-1), dead: new Uint8Array(cap), col: new Float32Array(cap * 3),
    };
  }
  function setVoxel(g, i) {
    const s = g.dead[i] ? 0 : g.sz[i] * g.grow[i] * g.vis[i];
    M4.makeScale(s, s * g.sy[i], s);
    M4.setPosition(g.px[i], g.py[i], g.pz[i]);
    g.mesh.setMatrixAt(i, M4);
  }
  function addVoxel(g, x, y, z, s, sy, c, birth, dur, r) {
    const i = g.n++;
    g.px[i] = x; g.py[i] = y; g.pz[i] = z; g.sz[i] = s; g.sy[i] = sy;
    g.birth[i] = birth; g.dur[i] = dur; g.rr[i] = r; g.dead[i] = 0; g.grow[i] = 0;
    if (typeof c === 'number') { g.pal[i] = c; g.vis[i] = U.seasonColor(PAL_LIST[c], r, S.season, tmpC); }
    else { g.pal[i] = -1; g.vis[i] = 1; tmpC.copy(c); }
    g.col[i * 3] = tmpC.r; g.col[i * 3 + 1] = tmpC.g; g.col[i * 3 + 2] = tmpC.b;
    g.mesh.setColorAt(i, tmpC);
    setVoxel(g, i);
    g.pending.push(i);
    g.mesh.count = g.n; g.colorDirty = g.matDirty = true;
  }
  function updateGrower(g, t) {
    const p = g.pending;
    let w = 0;
    for (let j = 0; j < p.length; j++) {
      const i = p[j];
      if (g.dead[i]) { setVoxel(g, i); g.matDirty = true; continue; }
      const k = (t - g.birth[i]) / g.dur[i];
      if (k <= 0) { p[w++] = i; continue; }
      g.grow[i] = k >= 1 ? 1 : 1 - Math.pow(1 - k, 3);
      setVoxel(g, i); g.matDirty = true;
      if (k < 1) p[w++] = i;
    }
    p.length = w;
    for (let j = g.shrinking.length - 1; j >= 0; j--) {
      const s = g.shrinking[j], k = clamp((t - s.t0) / 0.9, 0, 1);
      for (let i = s.a; i < s.b; i++) {
        if (g.dead[i]) continue;
        g.grow[i] = Math.min(g.grow[i], 1 - k);
        if (k >= 1) g.dead[i] = 1;
        setVoxel(g, i);
      }
      g.matDirty = true;
      if (k >= 1) g.shrinking.splice(j, 1);
    }
    if (g.matDirty) { g.mesh.instanceMatrix.needsUpdate = true; g.matDirty = false; }
    if (g.colorDirty) { g.mesh.instanceColor.needsUpdate = true; g.colorDirty = false; }
  }
  // Walk through the canopy a slice at a time, nudging colours and leaf cover toward the season.
  function sweep(g, Sv, budget) {
    if (!g.n) return;
    budget = Math.min(budget, g.n);
    for (let c = 0; c < budget; c++) {
      const i = g.cursor;
      g.cursor = (g.cursor + 1) % g.n;
      if (g.pal[i] < 0 || g.dead[i]) continue;
      const vis = U.seasonColor(PAL_LIST[g.pal[i]], g.rr[i], Sv, tmpC), o = i * 3;
      if (Math.abs(tmpC.r - g.col[o]) + Math.abs(tmpC.g - g.col[o + 1]) + Math.abs(tmpC.b - g.col[o + 2]) > 0.006) {
        g.col[o] = tmpC.r; g.col[o + 1] = tmpC.g; g.col[o + 2] = tmpC.b;
        g.mesh.setColorAt(i, tmpC); g.colorDirty = true;
      }
      if (Math.abs(vis - g.vis[i]) > 0.004) { g.vis[i] = vis; setVoxel(g, i); g.matDirty = true; }
    }
  }
  function clearGrower(g) { g.n = g.base; g.pending.length = 0; g.shrinking.length = 0; g.cursor = 0; g.mesh.count = g.n; }

  // ---------------------------------------------------------------- builders
  function perpendicular(v) {
    const a = Math.abs(v.y) < 0.9 ? new V(0, 1, 0) : new V(1, 0, 0);
    return new V().crossVectors(v, a).normalize();
  }
  // Recursive branching: each limb splits in two or three, about 0.7 the length of its parent.
  function branchTree(o, rng, c) {
    const TS = c.ts || 0.36, map = new Map(), tips = [];
    const put = (x, y, z, type, order) => {
      const ix = Math.round(x / TS), iy = Math.round(y / TS), iz = Math.round(z / TS);
      if (iy < 0) return;
      const key = ix + ',' + iy + ',' + iz, cur = map.get(key);
      if (cur) { if (cur.type === 'l' && type === 'w') { cur.type = 'w'; cur.order = Math.min(cur.order, order); } return; }
      map.set(key, { ix, iy, iz, type, order });
    };
    const leaves = (cx, cy, cz, order) => {
      tips.push([cx, cy, cz]);
      const r = c.leafR * (0.85 + rng() * 0.35), n = Math.ceil(r), sq = c.squash || 1.6;
      for (let x = -n; x <= n; x++) for (let y = -n; y <= n; y++) for (let z = -n; z <= n; z++) {
        const d = Math.sqrt(x * x + y * y * sq + z * z);
        if (d > r || rng() < 0.2 + 0.25 * (d / r)) continue;
        put(cx + x * TS, cy + y * TS, cz + z * TS, 'l', order + d * 0.9 + rng() * 1.5);
      }
    };
    const branch = (pos, dir, len, depth, order) => {
      const steps = Math.max(1, Math.ceil(len / (TS * 0.5))), p = new V();
      for (let i = 0; i <= steps; i++) { p.copy(pos).addScaledVector(dir, len * i / steps); put(p.x, p.y, p.z, 'w', order + i * 0.5); }
      const end = pos.clone().addScaledVector(dir, len), eo = order + steps * 0.5;
      if (depth === 0) { leaves(end.x, end.y, end.z, eo); return; }
      const n = rng() < c.split3 ? 3 : 2, phase = rng() * Math.PI * 2;
      for (let k = 0; k < n; k++) {
        const axis = perpendicular(dir).applyAxisAngle(dir, phase + k * 2 * Math.PI / n);
        const nd = dir.clone().applyAxisAngle(axis, c.spread + rng() * 0.25);
        nd.y += c.up == null ? 0.16 : c.up; nd.normalize();
        branch(end, nd, len * (c.ratio + rng() * 0.1), depth - 1, eo);
      }
      if (depth === 1 && rng() < 0.5) leaves(end.x, end.y, end.z, eo);
    };
    const lean = new V((rng() - 0.5) * 0.16, 1, (rng() - 0.5) * 0.16).normalize();
    branch(new V(0, TS * 0.5, 0), lean, c.trunk, c.depth, 0);
    if (c.extra) c.extra(put, tips, rng, TS);
    let top = 0;
    for (const v of map.values()) {
      const x = v.ix * TS, y = v.iy * TS + TS * 0.5, z = v.iz * TS;
      if (v.type === 'w') o.vox('w', x, y, z, TS, c.wood(rng), v.order);
      else { o.vox('l', x, y, z, TS * 0.97, c.pal, v.order); top = Math.max(top, y); }
    }
    tips.sort((a, b) => b[1] - a[1]);
    if (tips[0]) o.feature('perch', { x: tips[0][0], y: top + TS * 0.6, z: tips[0][2], tree: true });
    tips.slice(0, 10).forEach((tp) => o.feature('leafSrc', { x: tp[0], y: tp[1], z: tp[2], pal: c.pal }));
    o.feature('tree', { x: 0, y: top, z: 0 });
  }
  const TREES = {
    oak: { pal: 'oak', trunk: 2.2, depth: 3, spread: 0.48, ratio: 0.67, split3: 0.35, leafR: 2.7, wood: woodC(0x6e533d) },
    maple: { pal: 'maple', trunk: 2.0, depth: 3, spread: 0.55, ratio: 0.7, split3: 0.45, leafR: 2.5, squash: 1.2, wood: woodC(0x6a4a3a) },
    birch: { pal: 'birch', trunk: 2.9, depth: 3, spread: 0.36, ratio: 0.64, split3: 0.2, leafR: 2.0, ts: 0.32, wood: birchWood },
    cherry: { pal: 'cherry', trunk: 1.7, depth: 3, spread: 0.6, ratio: 0.7, split3: 0.5, leafR: 2.5, wood: woodC(0x5e4639) },
    willow: {
      pal: 'willow', trunk: 1.8, depth: 3, spread: 0.8, ratio: 0.72, split3: 0.4, leafR: 2.2, squash: 2.4, up: 0.05, wood: woodC(0x6b5a44),
      extra(put, tips, rng, TS) {
        for (const [cx, cy, cz] of tips) for (let s = 0; s < 7; s++) {
          const a = rng() * Math.PI * 2, rr = (1.2 + rng() * 1.6) * TS * 2;
          const sx = cx + Math.cos(a) * rr, sz = cz + Math.sin(a) * rr, len = 4 + ((rng() * 7) | 0);
          for (let j = 0; j < len; j++) { const y = cy - j * TS; if (y < TS * 2) break; put(sx, y, sz, 'l', 40 + j); }
        }
      },
    },
  };

  function pine(o, rng, rec, pal = 'pine') {
    const TS = 0.34, H = 15 + ((rng() * 6) | 0), wood = woodC(0x5a4434);
    for (let y = 0; y < H; y++) o.vox('w', 0, y * TS + TS / 2, 0, TS, wood(rng), y);
    for (let y = 3; y <= H + 1; y++) {
      const k = (y - 3) / (H - 2);
      let r = (1 - k) * 3.2 + 0.4;
      if ((y - 3) % 3 === 2) r *= 0.7;
      const n = Math.ceil(r);
      for (let x = -n; x <= n; x++) for (let z = -n; z <= n; z++) {
        const d = Math.hypot(x, z);
        if (d > r || rng() < 0.12 || (x === 0 && z === 0 && y < H)) continue;
        o.vox('l', x * TS, y * TS + TS / 2, z * TS, TS * 0.97, pal, y * 1.2 + d);
      }
    }
    o.feature('perch', { x: 0, y: (H + 2.2) * TS, z: 0, tree: true });
    o.feature('tree', { x: 0, y: (H + 2) * TS, z: 0 });
  }
  function palm(o, rng) {
    const TS = 0.3, segs = 16 + ((rng() * 5) | 0), dir = rng() * Math.PI * 2;
    let tx = 0, ty = 0, tz = 0;
    for (let i = 0; i < segs; i++) {
      const lean = Math.pow(i / segs, 2) * 1.6;
      tx = Math.round(Math.cos(dir) * lean / TS) * TS; tz = Math.round(Math.sin(dir) * lean / TS) * TS; ty = i * TS + TS / 2;
      o.vox('w', tx, ty, tz, TS, hex(i % 2 ? 0x9a7a52 : 0x8a6a46), i);
    }
    const fronds = 7;
    for (let f = 0; f < fronds; f++) {
      const a = f / fronds * Math.PI * 2 + rng() * 0.3, ca = Math.cos(a), sa = Math.sin(a);
      for (let j = 1; j <= 9; j++) {
        const d = j * TS * 0.95, dy = TS * (0.6 * j - 0.1 * j * j);
        const x = tx + ca * d, y = ty + TS + dy, z = tz + sa * d;
        o.vox('l', x, y, z, TS * 0.95, 'palm', segs + j);
        if (j > 2 && j < 9) {
          o.vox('l', x - sa * TS, y - TS * 0.3, z + ca * TS, TS * 0.8, 'palm', segs + j + 0.5);
          o.vox('l', x + sa * TS, y - TS * 0.3, z - ca * TS, TS * 0.8, 'palm', segs + j + 0.5);
        }
      }
    }
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1]]) o.vox('w', tx + dx * TS * 0.8, ty - TS * 0.6, tz + dz * TS * 0.8, TS * 0.8, hex(0x6a4a2a), segs + 2);
    o.feature('perch', { x: tx, y: ty + TS * 2, z: tz, tree: true });
    o.feature('tree', { x: tx, y: ty + TS, z: tz });
  }
  function bush(o, rng) {
    const s = 0.22, r = 2.4 + rng() * 0.8, n = Math.ceil(r);
    for (let x = -n; x <= n; x++) for (let y = 0; y <= n; y++) for (let z = -n; z <= n; z++) {
      const d = Math.sqrt(x * x + (y - 1) * (y - 1) * 1.3 + z * z);
      if (d > r || rng() > 0.85) continue;
      o.vox('l', x * s, (y + 0.5) * s, z * s, s * 0.97, rng() < 0.13 && d > r - 1.3 ? 'berry' : 'bush', d * 1.5);
    }
    o.feature('perch', { x: 0, y: (n + 1.2) * s, z: 0 });
  }
  function flowers(o, rng) {
    const s = 0.15, n = 6 + ((rng() * 5) | 0);
    const pa = 'petal' + ((rng() * PETALS.length) | 0), pb = 'petal' + ((rng() * PETALS.length) | 0);
    for (let i = 0; i < n; i++) {
      const a = rng() * Math.PI * 2, rad = Math.sqrt(rng()) * 0.9;
      const fx = Math.round(Math.cos(a) * rad / s) * s, fz = Math.round(Math.sin(a) * rad / s) * s;
      const hgt = 2 + ((rng() * 3) | 0), b0 = rng() * 3, p = rng() < 0.6 ? pa : pb;
      for (let j = 0; j < hgt; j++) o.vox('l', fx, s * (j + 0.5), fz, s * 0.9, 'stem', b0 + j);
      const hy = s * (hgt + 0.5);
      o.vox('l', fx, hy, fz, s, 'centre', b0 + hgt + 1);
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) o.vox('l', fx + dx * s, hy, fz + dz * s, s * 0.95, p, b0 + hgt + 2);
      if (i % 3 === 0) o.feature('nectar', { x: fx, y: hy + 0.12, z: fz });
    }
  }
  function tulips(o, rng) {
    const s = 0.1, n = 5 + ((rng() * 5) | 0), main = 'tulip' + ((rng() * TULIPS.length) | 0);
    for (let i = 0; i < n; i++) {
      const a = rng() * Math.PI * 2, rad = Math.sqrt(rng()) * 0.6;
      const fx = Math.round(Math.cos(a) * rad / s) * s, fz = Math.round(Math.sin(a) * rad / s) * s;
      const hgt = 3 + ((rng() * 2) | 0), p = rng() < 0.75 ? main : 'tulip' + ((rng() * TULIPS.length) | 0);
      for (let j = 0; j < hgt; j++) o.vox('l', fx, s * (j + 0.5), fz, s * 0.85, 'stem', j);
      o.vox('l', fx + s, s * 1.5, fz, s * 0.8, 'stem', 1);
      for (let dx = 0; dx < 2; dx++) for (let dy = 0; dy < 2; dy++) for (let dz = 0; dz < 2; dz++) {
        o.vox('l', fx + (dx - 0.5) * s * 0.9, s * (hgt + 0.5 + dy * 0.9), fz + (dz - 0.5) * s * 0.9, s * 0.9, p, hgt + 1 + dy);
      }
      if (i % 3 === 0) o.feature('nectar', { x: fx, y: s * (hgt + 2), z: fz });
    }
  }
  function lavender(o, rng) {
    const s = 0.085, n = 10 + ((rng() * 8) | 0);
    for (let i = 0; i < n; i++) {
      const a = rng() * Math.PI * 2, r = Math.sqrt(rng()) * 0.55;
      const fx = Math.round(Math.cos(a) * r / s) * s, fz = Math.round(Math.sin(a) * r / s) * s;
      const st = 2 + ((rng() * 2) | 0), fl = 3 + ((rng() * 2) | 0), b0 = rng() * 2;
      for (let j = 0; j < st; j++) o.vox('l', fx, s * (j + 0.5), fz, s * 0.9, 'stem', b0 + j);
      for (let j = 0; j < fl; j++) o.vox('l', fx, s * (st + j + 0.5), fz, s, 'lavender', b0 + st + j);
    }
    o.feature('nectar', { x: 0, y: 0.5, z: 0 });
  }
  function sunflower(o, rng) {
    const s = 0.13, n = 2 + ((rng() * 3) | 0), face = (rng() * 4) | 0;
    for (let i = 0; i < n; i++) {
      const fx = Math.round((rng() - 0.5) * 1.1 / s) * s, fz = Math.round((rng() - 0.5) * 1.1 / s) * s;
      const hgt = 7 + ((rng() * 4) | 0);
      for (let j = 0; j < hgt; j++) o.vox('l', fx, s * (j + 0.5), fz, s * 0.85, 'stem', j);
      for (const j of [2, 4]) { const [lx, lz] = rot(1, 0, (face + j) % 4); o.vox('l', fx + lx * s, s * (j + 0.5), fz + lz * s, s * 0.9, 'stem', j + 1); }
      const hy = s * (hgt + 1.5);
      for (let u = -2; u <= 2; u++) for (let v = -2; v <= 2; v++) {
        if (Math.abs(u) === 2 && Math.abs(v) === 2) continue;
        const core = Math.abs(u) <= 1 && Math.abs(v) <= 1, [ox, oz] = rot(0.6, u, face);
        o.vox('l', fx + ox * s, hy + v * s, fz + oz * s, s, core ? 'sunCore' : 'sunPetal', hgt + 3 + Math.abs(u) + Math.abs(v));
      }
      o.feature('nectar', { x: fx, y: hy + 0.25, z: fz });
    }
  }
  function fern(o, rng) {
    const s = 0.11, fr = 5 + ((rng() * 3) | 0);
    for (let f = 0; f < fr; f++) {
      const a = f / fr * Math.PI * 2 + rng() * 0.4, ca = Math.cos(a), sa = Math.sin(a);
      for (let j = 0; j < 7; j++) {
        const d = (j + 0.5) * s, y = s * (0.5 + j * 0.9 - j * j * 0.11);
        if (y < s * 0.5) break;
        o.vox('l', ca * d, y, sa * d, s, 'fern', j);
        if (j > 1 && j % 2 === 0) {
          o.vox('l', ca * d - sa * s, y, sa * d + ca * s, s * 0.8, 'fern', j + 0.5);
          o.vox('l', ca * d + sa * s, y, sa * d - ca * s, s * 0.8, 'fern', j + 0.5);
        }
      }
    }
  }
  function mushrooms(o, rng) {
    const s = 0.1, n = 2 + ((rng() * 4) | 0), p = rng() < 0.6 ? 'shroom' : 'shroomB';
    for (let i = 0; i < n; i++) {
      const a = rng() * Math.PI * 2, rad = Math.sqrt(rng()) * 0.5;
      const fx = Math.round(Math.cos(a) * rad / s) * s, fz = Math.round(Math.sin(a) * rad / s) * s;
      const st = 1 + ((rng() * 2) | 0), big = rng() < 0.5;
      for (let j = 0; j < st; j++) o.vox('l', fx, s * (j + 0.5), fz, s * 0.8, 'shroomStem', j);
      for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
        if (!big && Math.abs(dx) + Math.abs(dz) > 1) continue;
        o.vox('l', fx + dx * s, s * (st + 0.5), fz + dz * s, s, p, st + 1);
      }
      o.vox('l', fx, s * (st + 1.4), fz, s, p, st + 2);
      if (p === 'shroom') o.vox('l', fx + s * 0.6, s * (st + 1.05), fz - s * 0.5, s * 0.4, 'shroomStem', st + 3);
    }
  }
  function dune(o, rng) {
    const s = 0.11, n = 4 + ((rng() * 4) | 0);
    for (let i = 0; i < n; i++) {
      const fx = (rng() - 0.5) * 0.9, fz = (rng() - 0.5) * 0.9, hgt = 3 + ((rng() * 4) | 0), lean = (rng() - 0.5) * 0.05;
      for (let j = 0; j < hgt; j++) o.vox('l', fx + lean * j, s * (j + 0.5), fz, s, 'dune', j);
    }
  }
  function lily(o, rng) {
    const s = 0.15, n = 3 + ((rng() * 3) | 0);
    for (let i = 0; i < n; i++) {
      const a = rng() * Math.PI * 2, r = i === 0 ? 0 : 0.35 + rng() * 0.6;
      const px = Math.round(Math.cos(a) * r / s) * s, pz = Math.round(Math.sin(a) * r / s) * s;
      const R = 1.6 + rng() * 0.8, notch = rng() * Math.PI * 2, y = 0.07 + i * 0.004;
      for (let x = -2; x <= 2; x++) for (let z = -2; z <= 2; z++) {
        const d = Math.hypot(x, z);
        if (d > R || (d > 0.6 && Math.abs(U.angDiff(Math.atan2(z, x), notch)) < 0.35)) continue;
        o.vox('l', px + x * s, y, pz + z * s, s, 'lily', i * 2 + d, 0.28);
      }
      o.feature('pad', { x: px, y: y + 0.04, z: pz });
      if (rng() < 0.4) {
        o.vox('l', px, y + s * 0.6, pz, s * 0.8, 'lotusC', i * 2 + 6);
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) o.vox('l', px + dx * s * 0.8, y + s * 0.55, pz + dz * s * 0.8, s * 0.75, 'lotus', i * 2 + 5);
        for (const [dx, dz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) o.vox('l', px + dx * s * 0.45, y + s * 1.1, pz + dz * s * 0.45, s * 0.6, 'lotus', i * 2 + 7);
        o.feature('nectar', { x: px, y: y + 0.3, z: pz, water: true });
      }
    }
  }
  function reeds(o, rng, rec) {
    const s = 0.08, extra = Math.max(0, K.WL - rec.y), n = 6 + ((rng() * 7) | 0);
    for (let i = 0; i < n; i++) {
      const a = rng() * Math.PI * 2, r = Math.sqrt(rng()) * 0.5;
      const fx = Math.round(Math.cos(a) * r / s) * s, fz = Math.round(Math.sin(a) * r / s) * s;
      const hgt = Math.round((extra + 0.6 + rng() * 0.6) / s);
      for (let j = 0; j < hgt; j++) o.vox('l', fx, s * (j + 0.5), fz, s, 'reed', j * 0.3);
      if (rng() < 0.55) {
        const cy = s * (hgt - 2.5);
        o.vox('l', fx, cy, fz, s * 1.7, 'cattail', hgt * 0.3 + 1);
        o.vox('l', fx, cy + s * 1.5, fz, s * 1.7, 'cattail', hgt * 0.3 + 1.2);
      }
    }
    o.feature('reed', { x: 0, y: extra + 0.6, z: 0 });
  }

  // decorations
  function lantern(o, rng) {
    const s = 0.16;
    let ord = 0;
    const L = (y, r) => { for (let x = -r; x <= r; x++) for (let z = -r; z <= r; z++) o.vox('w', x * s, s * (y + 0.5), z * s, s, stoneC(rng), ord); ord++; };
    L(0, 1); L(1, 0); L(2, 0); L(3, 1);
    for (const y of [4, 5]) {
      for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) o.vox('w', x * s, s * (y + 0.5), z * s, s, stoneC(rng), ord);
      o.vox('g', 0, s * (y + 0.5), 0, s * 0.95, hex(0xffd59a), ord);
      ord++;
    }
    L(6, 2); L(7, 1); L(8, 0);
    o.feature('light', { x: 0, y: s * 5, z: 0, color: 0xffc98a, base: 0.8, distance: 8 });
    o.feature('perch', { x: 0, y: s * 9.2, z: 0 });
  }
  function chime(o, rng) {
    const s = 0.08, k = (rng() * 4) | 0, P = (x, z) => rot(x, z, k);
    for (let j = 0; j < 16; j++) o.vox('w', 0, s * (j + 0.5), 0, s, hex(WOOD2), j);
    for (let x = 1; x <= 5; x++) { const [a, b] = P(x * s, 0); o.vox('w', a, s * 15.5, b, s, hex(WOOD2), 16 + x); }
    const metal = [0xc9d3d8, 0xb8c4ca, 0xdfe6e9];
    for (let b = 0; b < 5; b++) {
      const len = 4 + (b % 3) * 2, [a, c] = P((1.5 + b * 0.8) * s, 0);
      for (let j = 0; j < len; j++) o.vox('l', a, s * (14.8 - j * 0.6), c, s * 0.55, hex(metal[b % 3]), 23 + j);
    }
    const [hx, hz] = P(3 * s, 0);
    o.feature('chime', { x: hx, y: s * 12, z: hz });
    o.feature('perch', { x: 0, y: s * 16.4, z: 0 });
  }
  function bench(o, rng, rec) {
    const s = 0.16, k = faceK(rec.x, rec.z);
    const put = (x, y, z, ord) => { const [wx, wz] = rot(x, z, k); o.vox('w', wx * s, s * (y + 0.5), wz * s, s, hex(rng() < 0.5 ? WOOD : WOOD2), ord); };
    for (const z of [-3, 3]) for (const x of [-1, 0]) for (let y = 0; y < 2; y++) put(x, y, z, y);
    for (let z = -3; z <= 3; z++) for (const x of [-1, 0]) put(x, 2, z, 3 + Math.abs(z) * 0.2);
    for (let z = -3; z <= 3; z++) { put(-1, 3, z, 5); put(-1, 4, z, 6); }
    const [px, pz] = rot(-1, 2, k);
    o.feature('perch', { x: px * s, y: s * 5.1, z: pz * s });
    const [sx, sz] = rot(-0.4, 0, k);
    o.feature('seat', { x: sx * s, y: s * 3, z: sz * s, angle: k * Math.PI / 2, kind: 'bench' });
  }
  function campfire(o, rng) {
    const s = 0.14;
    for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; o.vox('w', Math.cos(a) * 3 * s, s * 0.35, Math.sin(a) * 3 * s, s * 1.1, stoneC(rng), i, 0.65); }
    for (let j = -2; j <= 2; j++) {
      o.vox('w', j * s, s * 0.6, 0, s * 0.9, hex(j % 2 ? WOOD2 : DARK), 10 + Math.abs(j));
      o.vox('w', 0, s * 1.3, j * s, s * 0.9, hex(j % 2 ? DARK : WOOD2), 13 + Math.abs(j));
    }
    o.vox('g', 0, s * 0.4, 0, s * 1.4, hex(0xff8a3a), 9, 0.5);
    o.vox('g', s * 0.7, s * 0.35, s * 0.5, s, hex(0xffb050), 9, 0.5);
    o.feature('fire', { x: 0, y: s * 1.3, z: 0 });
    o.feature('light', { x: 0, y: 0.6, z: 0, color: 0xff9a50, base: 1.4, flicker: 1, distance: 13 });
  }
  function cairn(o, rng) {
    const s = 0.13, n = 4 + ((rng() * 3) | 0), th = 0.7;
    let y = 0, ox = 0, oz = 0;
    for (let i = 0; i < n; i++) {
      const w = Math.max(0, Math.round((n - i - 1) * 0.6)), c = stoneC(rng).offsetHSL(0, 0, (rng() - 0.5) * 0.06);
      if (i) { ox += (rng() - 0.5) * s * 0.6; oz += (rng() - 0.5) * s * 0.6; }
      for (let x = -w; x <= w; x++) for (let z = -w; z <= w; z++) {
        if (w > 0 && Math.abs(x) === w && Math.abs(z) === w) continue;
        o.vox('w', ox + x * s, y + s * th * 0.5, oz + z * s, s, c, i * 6, th);
      }
      y += s * th;
    }
    o.feature('perch', { x: ox, y: y + 0.06, z: oz });
  }
  function birdhouse(o, rng, rec) {
    const s = 0.1, k = faceK(rec.x, rec.z), paint = hex(U.pick(rng, [0x8fb7c9, 0xe3b3a0, 0xb8c99a, 0xe8d9a8]));
    const P = (x, y, z, c, ord, size) => { const [wx, wz] = rot(x, z, k); o.vox('w', wx * s, s * (y + 0.5), wz * s, size || s, c, ord); };
    for (let y = 0; y < 12; y++) P(0, y, 0, hex(WOOD2), y);
    for (let y = 12; y <= 14; y++) for (let x = -1; x <= 1; x++) for (let z = -1; z <= 1; z++) P(x, y, z, paint, 14);
    for (let x = -2; x <= 2; x++) for (let z = -2; z <= 2; z++) P(x, 15, z, hex(0x8a4a3a), 16);
    for (let x = -1; x <= 1; x++) for (let z = -1; z <= 1; z++) P(x, 16, z, hex(0x8a4a3a), 17);
    P(0, 17, 0, hex(0x7a4034), 18);
    P(1.35, 13, 0, hex(0x2a2420), 15, s * 0.7);
    o.feature('perch', { x: 0, y: s * 18.2, z: 0 });
    const [fx, fz] = rot(2.4, 0, k);
    o.feature('birdhouse', { x: fx * s, y: s * 13, z: fz * s });
  }
  function stones(o, rng, rec) {
    const s = 0.17, a = rng() * Math.PI, n = 3 + ((rng() * 2) | 0);
    for (let i = 0; i < n; i++) {
      const d = (i - (n - 1) / 2) * 0.62, cx = Math.round(Math.cos(a) * d / s) * s, cz = Math.round(Math.sin(a) * d / s) * s;
      const gh = W.heightAt(rec.x + cx, rec.z + cz);
      if (gh < 0) continue;
      const gy = gh - rec.y, wx = rng() < 0.5 ? 2 : 1, c = stoneC(rng);
      for (let x = -1; x < wx; x++) for (let z = -1; z < 1; z++) o.vox('w', cx + (x + 0.5) * s, gy + s * 0.2, cz + (z + 0.5) * s, s, c, i, 0.4);
    }
  }
  function cabin(o, rng, rec) {
    const s = 0.3, k = faceK(rec.x, rec.z), half = 3, roofC = hex(U.pick(rng, [0x8a4a3a, 0x5a6470, 0x7a5a3a]));
    const P = (x, y, z, layer, c, ord, size) => { const [wx, wz] = rot(x, z, k); o.vox(layer, wx * s, s * (y + 0.5), wz * s, size || s, c, ord); };
    for (let x = -half; x <= half; x++) for (let z = -half; z <= half; z++) {
      const [wx, wz] = rot(x, z, k), gh = W.heightAt(rec.x + wx * s, rec.z + wz * s);
      const below = Math.ceil((rec.y - gh) / s);
      for (let y = -below; y < 0; y++) P(x, y, z, 'w', stoneC(rng), 0);
      P(x, 0, z, 'w', stoneC(rng), 1);
    }
    for (let y = 1; y <= 6; y++) for (let x = -half; x <= half; x++) for (let z = -half; z <= half; z++) {
      if (Math.abs(x) !== half && Math.abs(z) !== half) continue;
      const door = x === half && z === 0 && y <= 3;
      const win = y >= 3 && y <= 4 && ((Math.abs(z) === half && Math.abs(x) <= 1) || (x === -half && Math.abs(z) <= 1));
      if (win) P(x, y, z, 'g', hex(0xffc77a), 2 + y);
      else P(x, y, z, 'w', hex(door ? DARK : (y + (Math.abs(x) === half && Math.abs(z) === half ? 1 : 0)) % 2 ? WOOD : WOOD2), 2 + y);
    }
    for (let y = 7; y <= 11; y++) {
      const r = half + 1 - (y - 7);
      for (let x = -r; x <= r; x++) for (let z = -r; z <= r; z++) {
        const ring = Math.max(Math.abs(x), Math.abs(z));
        if (y === 7 ? ring < half : (ring < r && y < 11)) continue;
        P(x, y, z, 'w', roofC.clone().offsetHSL(0, 0, (rng() - 0.5) * 0.04), 10 + y);
      }
    }
    for (let y = 7; y <= 12; y++) P(-2, y, -2, 'w', stoneC(rng), 12 + y);
    const [cx, cz] = rot(-2, -2, k);
    o.feature('smoke', { x: cx * s, y: s * 13.2, z: cz * s });
    o.feature('light', { x: 0, y: s * 3.5, z: 0, color: 0xffb060, base: 0.9, distance: 10 });
    o.feature('perch', { x: 0, y: s * 12.3, z: 0 });
    const [dx, dz] = rot(half + 1.2, 1.2, k);
    o.feature('porch', { x: dx * s, y: 0.05, z: dz * s, angle: Math.atan2(dz, dx) });
  }
  function grat(o) {
    const s = 0.13, stem = hex(0x6c9a55), cream = hex(0xfaf3e0), cream2 = hex(0xfdf8ec);
    for (let j = 0; j < 3; j++) o.vox('l', 0, s * (j + 0.5), 0, s * 0.85, stem, j);
    o.vox('l', s, s * 1.5, 0, s * 0.8, stem, 1.5);
    const hy = s * 3.5;
    o.vox('g', 0, hy, 0, s, hex(0xfff0c0), 4);
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) o.vox('l', dx * s, hy, dz * s, s * 0.95, cream, 5);
    for (const [dx, dz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) o.vox('l', dx * s * 0.7, hy + s * 0.6, dz * s * 0.7, s * 0.7, cream2, 6);
    o.feature('grat', { x: 0, y: hy, z: 0 });
    o.feature('nectar', { x: 0, y: hy + 0.15, z: 0 });
  }

  const CORAL = [0xf28aa0, 0xf2a05a, 0xa88ad8, 0xf2d35a, 0x5fc0b0, 0xe86a5a];
  function coral(o, rng, rec) {
    const s = 0.12, top = K.WL - 0.15 - rec.y, n = 3 + ((rng() * 4) | 0);
    for (let i = 0; i < n; i++) {
      const a = rng() * Math.PI * 2, r = Math.sqrt(rng()) * 0.8;
      const fx = Math.round(Math.cos(a) * r / s) * s, fz = Math.round(Math.sin(a) * r / s) * s;
      const col = hex(U.pick(rng, CORAL)), kind = rng();
      if (kind < 0.4) {
        const hgt = Math.min(Math.floor(top / s), 3 + ((rng() * 5) | 0));
        for (let j = 0; j < hgt; j++) {
          o.vox('l', fx, s * (j + 0.5), fz, s * 0.9, col, j);
          if (j > 1 && rng() < 0.5) {
            const [bx, bz] = U.pick(rng, [[1, 0], [-1, 0], [0, 1], [0, -1]]);
            o.vox('l', fx + bx * s, s * (j + 0.5), fz + bz * s, s * 0.8, col, j + 0.5);
            if (j + 1 < hgt && rng() < 0.5) o.vox('l', fx + bx * s, s * (j + 1.5), fz + bz * s, s * 0.8, col, j + 1);
          }
        }
      } else if (kind < 0.75) {
        for (let x = -1; x <= 1; x++) for (let y = 0; y <= 1; y++) for (let z = -1; z <= 1; z++) {
          if (y === 1 && Math.abs(x) + Math.abs(z) > 1) continue;
          o.vox('w', fx + x * s, s * (y + 0.5), fz + z * s, s, col.clone().offsetHSL(0, 0, (rng() - 0.5) * 0.08), y);
        }
      } else {
        for (let v = 0; v < 4; v++) for (let u = -2; u <= 2; u++) {
          if (Math.abs(u) > v * 0.8 + 0.5 || s * (v + 0.5) > top) continue;
          o.vox('l', fx + u * s * 0.8, s * (v + 0.5), fz, s * 0.7, col, v);
        }
      }
    }
    o.feature('reef', { x: 0, y: 0.3, z: 0 });
  }
  // Stone foundation down to the ground under a square footprint, so buildings sit on slopes.
  function foundation(o, rng, rec, s, half, k, P) {
    for (let x = -half; x <= half; x++) for (let z = -half; z <= half; z++) {
      const [wx, wz] = rot(x, z, k), gh = W.heightAt(rec.x + wx * s, rec.z + wz * s);
      for (let y = -Math.ceil((rec.y - gh) / s); y < 0; y++) P(x, y, z, 'w', stoneC(rng), 0);
    }
  }
  function pavilion(o, rng, rec) {
    const s = 0.25, half = 4, k = faceK(rec.x, rec.z), red = hex(0x8a3a30), roofC = hex(0x4a5560);
    const P = (x, y, z, layer, c, ord, size) => { const [wx, wz] = rot(x, z, k); o.vox(layer, wx * s, s * (y + 0.5), wz * s, size || s, c, ord); };
    foundation(o, rng, rec, s, half, k, P);
    for (let x = -half; x <= half; x++) for (let z = -half; z <= half; z++) P(x, 0, z, 'w', hex(0xd8d4c8).offsetHSL(0, 0, (rng() - 0.5) * 0.05), 1);
    for (const x of [-half + 1, half - 1]) for (const z of [-half + 1, half - 1]) for (let y = 1; y <= 7; y++) P(x, y, z, 'w', red, 1 + y);
    for (let x = -half + 1; x <= half - 1; x++) for (let z = -half + 1; z <= half - 1; z++) {
      if (Math.max(Math.abs(x), Math.abs(z)) === half - 1) P(x, 8, z, 'w', red, 9);
    }
    for (let y = 9; y <= 9 + half + 1; y++) {
      const r = half + 1 - (y - 9);
      for (let x = -r; x <= r; x++) for (let z = -r; z <= r; z++) {
        const ring = Math.max(Math.abs(x), Math.abs(z));
        if (ring < r - (y === 9 ? 1 : 0) && r > 0) continue;
        P(x, y, z, 'w', roofC.clone().offsetHSL(0, 0, (rng() - 0.5) * 0.04), 10 + y);
      }
    }
    for (const x of [-half - 1, half + 1]) for (const z of [-half - 1, half + 1]) P(x, 10, z, 'w', roofC, 20);
    P(0, 9 + half + 2, 0, 'w', hex(0xd8b04a), 21);
    P(0, 7, 0, 'w', red, 18, s * 0.4);
    P(0, 6, 0, 'g', hex(0xffd59a), 18, s * 0.9);
    o.feature('light', { x: 0, y: s * 6, z: 0, color: 0xffc98a, base: 0.9, distance: 10 });
    o.feature('perch', { x: 0, y: s * (9 + half + 3), z: 0 });
    const [fx, fz] = rot(1.5, 0, k);
    o.feature('seat', { x: fx * s, y: s, z: fz * s, angle: k * Math.PI / 2, kind: 'floor' });
  }
  function windmill(o, rng, rec) {
    const s = 0.3, k = faceK(rec.x, rec.z), wall = hex(0xece6d8), roofC = hex(0x6a4a3a);
    const P = (x, y, z, layer, c, ord, size) => { const [wx, wz] = rot(x, z, k); o.vox(layer, wx * s, s * (y + 0.5), wz * s, size || s, c, ord); };
    foundation(o, rng, rec, s, 2, k, P);
    for (let y = 0; y < 10; y++) {
      const r = y < 4 ? 2 : y < 8 ? 1 : 1;
      for (let x = -r; x <= r; x++) for (let z = -r; z <= r; z++) {
        if (r === 2 && Math.abs(x) === 2 && Math.abs(z) === 2) continue;
        const door = x === r && z === 0 && y >= 1 && y <= 2, win = x === r && z === 0 && y === 6;
        if (win) P(x, y, z, 'g', hex(0xffc77a), y);
        else P(x, y, z, 'w', y === 0 ? stoneC(rng) : door ? hex(DARK) : wall.clone().offsetHSL(0, 0, (rng() - 0.5) * 0.04), y);
      }
    }
    for (let x = -2; x <= 2; x++) for (let z = -2; z <= 2; z++) if (Math.abs(x) + Math.abs(z) < 4) P(x, 10, z, 'w', roofC, 11);
    for (let x = -1; x <= 1; x++) for (let z = -1; z <= 1; z++) P(x, 11, z, 'w', roofC, 12);
    P(0, 12, 0, 'w', roofC, 13);
    P(1.7, 9, 0, 'w', hex(DARK), 14, s * 0.6);
    const [hx, hz] = rot(2.1, 0, k);
    o.feature('windmill', { x: hx * s, y: s * 9.5, z: hz * s, angle: k * Math.PI / 2 });
    o.feature('perch', { x: 0, y: s * 13.2, z: 0 });
  }
  function wreck(o, rng) {
    const s = 0.3, L = 16, ca = Math.cos(0.6), sa = Math.sin(0.6);
    const woods = [0x7a6650, 0x6a5844, 0x8a7660].map(hex), rib = hex(0x5a4a3a);
    const put = (u, v, y, c, ord) => o.vox('w', ((u - L / 2) * ca - v * sa) * s, s * (y - 1.5), ((u - L / 2) * sa + v * ca) * s, s, c, ord);
    for (let u = 0; u <= L; u++) {
      const w = Math.max(0.6, 3 * Math.sin(Math.PI * Math.pow(u / L, 0.8))), hgt = 2 + Math.round(2 * (1 - u / L));
      put(u, 0, 0, rib, u);
      for (const side of [-1, 1]) for (let y = 0; y <= hgt; y++) {
        const v = Math.round(side * w * (0.55 + 0.45 * Math.min(1, y / 2)));
        const isRib = u % 3 === 0;
        if (!isRib && y >= 2 && rng() < 0.45) continue;
        put(u, v, y, isRib ? rib : U.pick(rng, woods), u + y);
      }
    }
    for (let y = 0; y < 5; y++) put(6, 0, y + 1, rib, 20 + y);
    for (let i = 0; i < 7; i++) put(7 + i, 3 + Math.round(i * 0.3), 1, rib, 26 + i);
    o.feature('perch', { x: ((6 - L / 2) * ca) * s, y: s * 4.6, z: ((6 - L / 2) * sa) * s });
  }

  // ---------------------------------------------------------------- catalog
  const tree = (pal, label, swatch, extra) => Object.assign({ cat: 'trees', label, swatch, on: 'grass', rad: 1.2, solid: true, tree: true, span: 32, build: (o, rng) => branchTree(o, rng, TREES[pal]) }, extra);
  const CAT = GD.CAT = {
    oak: tree('oak', 'Oak', '#7fae63'),
    maple: tree('maple', 'Maple', '#d2452f'),
    birch: tree('birch', 'Birch', '#e8e4da', { rad: 1.0 }),
    cherry: tree('cherry', 'Cherry', '#f4c1cf'),
    willow: tree('willow', 'Willow', '#a6d276', { rad: 1.5 }),
    pine: { cat: 'trees', label: 'Pine', swatch: '#3f6b4a', on: 'grass', rad: 1.1, solid: true, tree: true, span: 30, build: pine },
    palm: { cat: 'trees', label: 'Palm', swatch: '#6aa857', on: 'sand', rad: 1.0, solid: true, tree: true, span: 28, build: palm },
    flowers: { cat: 'plants', label: 'Wildflowers', swatch: '#f2d98d', on: 'grass', rad: 0.5, span: 6, build: flowers },
    tulips: { cat: 'plants', label: 'Tulips', swatch: '#e85a6a', on: 'grass', rad: 0.45, span: 6, build: tulips },
    lavender: { cat: 'plants', label: 'Lavender', swatch: '#9b86d6', on: 'grass', rad: 0.45, span: 6, build: lavender },
    sunflower: { cat: 'plants', label: 'Sunflowers', swatch: '#f2c230', on: 'grass', rad: 0.5, span: 9, build: sunflower },
    fern: { cat: 'plants', label: 'Ferns', swatch: '#5f9a4e', on: 'grass', rad: 0.5, span: 6, build: fern },
    mushroom: { cat: 'plants', label: 'Mushrooms', swatch: '#c8453a', on: 'grass', rad: 0.4, span: 5, build: mushrooms },
    bush: { cat: 'plants', label: 'Berry bush', swatch: '#5f9450', on: 'grass', rad: 0.7, solid: true, span: 12, build: bush },
    dune: { cat: 'plants', label: 'Dune grass', swatch: '#c9c98f', on: 'sand', rad: 0.4, span: 5, build: dune },
    lily: { cat: 'water', label: 'Lily pads', swatch: '#5c9a55', on: 'water', rad: 0.9, span: 8, build: lily },
    reeds: { cat: 'water', label: 'Reeds', swatch: '#7f9e5a', on: 'shore', rad: 0.5, span: 8, build: reeds },
    lantern: { cat: 'decor', label: 'Stone lantern', swatch: '#9a9f9b', on: 'land', rad: 0.45, solid: true, span: 4, build: lantern },
    chime: { cat: 'decor', label: 'Wind chime', swatch: '#c9d3d8', on: 'land', rad: 0.4, solid: true, span: 4, build: chime },
    bench: { cat: 'decor', label: 'Bench', swatch: '#8a6a4c', on: 'land', rad: 0.7, solid: true, span: 4, build: bench },
    campfire: { cat: 'decor', label: 'Campfire', swatch: '#ff9a50', on: 'land', rad: 0.6, solid: true, span: 4, build: campfire },
    cairn: { cat: 'decor', label: 'Stone stack', swatch: '#858a87', on: 'land', rad: 0.4, solid: true, span: 7, build: cairn },
    birdhouse: { cat: 'decor', label: 'Birdhouse', swatch: '#8fb7c9', on: 'land', rad: 0.4, solid: true, span: 4, build: birdhouse },
    stones: { cat: 'decor', label: 'Stepping stones', swatch: '#a7aba6', on: 'land', rad: 0.9, span: 3, build: stones },
    cabin: { cat: 'decor', label: 'Cabin', swatch: '#8a4a3a', on: 'land', rad: 1.6, solid: true, span: 10, footprint: 1.15, build: cabin },
    pavilion: { cat: 'decor', label: 'Pavilion', swatch: '#8a3a30', on: 'land', rad: 1.6, solid: true, span: 12, footprint: 1.1, build: pavilion },
    windmill: { cat: 'decor', label: 'Windmill', swatch: '#ece6d8', on: 'land', rad: 1.2, solid: true, span: 12, footprint: 0.65, build: windmill },
    coral: { cat: 'water', label: 'Coral', swatch: '#f28aa0', on: 'reef', rad: 0.7, span: 8, build: coral },
    wreck: { cat: 'scenery', label: 'Shipwreck', swatch: '#7a6650', on: 'land', rad: 2.6, solid: true, span: 1, build: wreck },
    snowpine: { cat: 'scenery', label: 'Snowy pine', swatch: '#e9eff2', on: 'land', rad: 1.1, solid: true, tree: true, span: 30, build: (o, rng, rec) => pine(o, rng, rec, 'pineSnow') },
    grat: { cat: 'rituals', label: 'Gratitude flower', swatch: '#faf3e0', on: 'grass', rad: 0.4, span: 6, build: grat },
  };

  // ------------------------------------------------------------------ planting
  let nextId = 1, featVersion = -1;
  function collect(rec) {
    const out = { w: [], l: [], g: [], f: [], maxO: 1 };
    const rng = mulberry32(rec.seed);
    const o = {
      vox(layer, x, y, z, s, c, order, sy = 1) {
        out[layer].push([x, y, z, s, sy, typeof c === 'string' ? PAL_INDEX[c] : c, order]);
        if (order > out.maxO) out.maxO = order;
      },
      feature(type, d) { out.f.push(Object.assign({ type }, d)); },
    };
    CAT[rec.k].build(o, rng, rec);
    return out;
  }
  function plant(rec, instant) {
    const def = CAT[rec.k];
    if (!def) return false;
    const out = collect(rec);
    if (woodG.n + out.w.length > woodG.cap || leafG.n + out.l.length > leafG.cap || glowG.n + out.g.length > glowG.cap) return false;
    const t0 = instant ? S.t - 1000 : S.t, kk = (def.span || 6) / out.maxO, r = mulberry32(rec.seed ^ 0x2f1);
    rec._r = {};
    for (const [layer, g, dur] of [['w', woodG, def.tree ? 1.8 : 0.7], ['l', leafG, def.tree ? 2.6 : 1.2], ['g', glowG, 1.0]]) {
      const a = g.n;
      for (const v of out[layer]) addVoxel(g, rec.x + v[0], rec.y + v[1], rec.z + v[2], v[3], v[4], v[5], t0 + v[6] * kk, dur, r());
      rec._r[layer] = [a, g.n];
    }
    const ready = t0 + (def.span || 6) + 2;
    rec._f = out.f.map((f) => Object.assign({}, f, { x: rec.x + f.x, y: rec.y + f.y, z: rec.z + f.z, rec, ready }));
    GD.version++;
    return true;
  }
  function rebuildFeatures() {
    const F = { perch: [], nectar: [], light: [], fire: [], smoke: [], pad: [], chime: [], leafSrc: [], tree: [], birdhouse: [], grat: [], reed: [], porch: [], seat: [], windmill: [], reef: [] };
    for (const rec of GD.items) for (const f of rec._f || []) (F[f.type] = F[f.type] || []).push(f);
    GD.feat = F;
    featVersion = GD.version;
  }

  GD.check = function (k, x, z) {
    const def = CAT[k];
    if (!def) return { ok: false };
    const c = W.colAt(x, z);
    let y;
    switch (def.on) {
      case 'grass':
        if (!c.grassy || c.h < 1) return { ok: false, msg: def.label + (c.h < 0 ? ' grows on land.' : ' needs grass.') + (k === 'oak' || def.tree ? ' The palm likes sand.' : '') };
        y = c.h; break;
      case 'sand':
        if (c.grassy || c.rock || c.h < 0 || c.h > 2) return { ok: false, msg: def.label + ' likes the sandy beach.' };
        y = c.h; break;
      case 'land':
        if (c.h < 0) return { ok: false, msg: def.label + ' goes on land.' };
        y = c.h; break;
      case 'water': {
        const d = K.WL - c.h;
        if (d < 0.5 || d > 3.2) return { ok: false, msg: 'Lily pads float in calm water near the shore or on the pond.' };
        y = K.WL; break;
      }
      case 'reef': {
        const d = K.WL - c.h;
        if (d < 0.9 || d > 3.2) return { ok: false, msg: 'Coral grows on the sea floor in clear, shallow water.' };
        y = c.h; break;
      }
      case 'shore':
        if (c.h > 1 || c.h < -1) return { ok: false, msg: 'Reeds grow right at the water’s edge.' };
        y = c.h; break;
    }
    if (def.footprint) {
      let lo = 99, hi = -99;
      for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) { const h = W.heightAt(x + dx * def.footprint, z + dz * def.footprint); lo = Math.min(lo, h); hi = Math.max(hi, h); }
      if (lo < 0 || hi - lo > 2) return { ok: false, msg: 'The cabin needs a flatter, drier spot.' };
      y = hi;
    }
    if (def.solid || def.footprint) for (const p of W.pools || []) {
      if (Math.hypot(p.x - x, p.z - z) < p.r + 0.8 + def.rad * 0.6) return { ok: false, msg: 'Too close to the pool.' };
    }
    for (const it of GD.items) {
      const od = CAT[it.k];
      if (!od) continue;
      const need = (def.solid || od.solid) ? (def.rad + od.rad) * 0.8 : 0.45;
      if (Math.hypot(it.x - x, it.z - z) < need) return { ok: false, msg: 'A little too close to the ' + od.label.toLowerCase() + '.' };
    }
    return { ok: true, y };
  };
  GD.tryPlace = function (k, x, z, opts = {}) {
    const chk = GD.check(k, x, z);
    if (!chk.ok) return chk;
    const rec = { id: nextId++, k, x: +x.toFixed(2), y: chk.y, z: +z.toFixed(2), seed: (Math.random() * 1e9) | 0, at: U.today() };
    if (opts.note) rec.note = opts.note;
    if (!plant(rec, false)) return { ok: false, msg: 'The island is as full as it can be. Tidy something away to make room.' };
    GD.items.push(rec);
    return { ok: true, rec };
  };
  GD.remove = function (rec) {
    for (const [layer, g] of [['w', woodG], ['l', leafG], ['g', glowG]]) {
      const r = rec._r && rec._r[layer];
      if (r && r[1] > r[0]) g.shrinking.push({ a: r[0], b: r[1], t0: S.t });
    }
    if (rec.wild) wildGone.add(rec.id);
    GD.items.splice(GD.items.indexOf(rec), 1);
    GD.version++;
  };
  GD.nearest = function (x, z, r = 1.4, filter) {
    let best = null, bd = r;
    for (const it of GD.items) {
      if (filter && !filter(it)) continue;
      const d = Math.hypot(it.x - x, it.z - z) - CAT[it.k].rad * 0.5;
      if (d < bd) { bd = d; best = it; }
    }
    return best;
  };
  GD.findFreeGrass = function (cx, cz, k = 'grat') {
    const spots = K.ISLANDS.flatMap((I) => I.cols.grass).map(([x, z]) => [x + (Math.random() - 0.5) * 0.7, z + (Math.random() - 0.5) * 0.7])
      .sort((a, b) => Math.hypot(a[0] - cx, a[1] - cz) + Math.random() * 3 - Math.hypot(b[0] - cx, b[1] - cz) - Math.random() * 3);
    for (const [x, z] of spots) if (GD.check(k, x, z).ok) return [x, z];
    return null;
  };
  GD.serialize = () => GD.items.filter((i) => !i.wild).map(({ id, k, x, y, z, seed, note, at }) => ({ id, k, x, y, z, seed, note, at }));
  GD.wildGone = () => [...wildGone];

  // Wild growth on the other islands. Laid out once, the same for everyone; anything you
  // tidy away is remembered by id.
  const WILD = {
    pine: [['pine', 11], ['birch', 2], ['fern', 5], ['mushroom', 4], ['bush', 2], ['cairn', 1]],
    blossom: [['pavilion', 1], ['cherry', 6], ['flowers', 5], ['tulips', 4], ['lavender', 3], ['lantern', 2], ['stones', 2]],
    meadow: [['windmill', 1], ['oak', 2], ['flowers', 8], ['sunflower', 4], ['bush', 3], ['birdhouse', 1], ['bench', 1]],
    atoll: [['palm', 8], ['dune', 6], ['coral', 10]],
    rocks: [['cairn', 1]],
    wreck: [['wreck', 1], ['dune', 3]],
    falls: [['pine', 6], ['birch', 3], ['willow', 1], ['fern', 6], ['mushroom', 3], ['flowers', 3], ['bench', 1]],
    springs: [['cabin', 1], ['lantern', 3], ['pine', 3], ['bush', 2], ['stones', 2], ['fern', 2]],
    glacier: [['snowpine', 8], ['cairn', 2]],
    marsh: [['willow', 3], ['lily', 9], ['reeds', 10], ['flowers', 3], ['fern', 3], ['mushroom', 2], ['birdhouse', 1]],
  };
  const CENTRAL = new Set(['pavilion', 'windmill', 'wreck']);
  let wildLayout = null;
  const wildGone = new Set();
  function layoutWild() {
    const keep = GD.items, acc = [];
    GD.items = acc;
    for (const I of K.ISLANDS) {
      const specs = WILD[I.id];
      if (!specs) continue;
      const rng = mulberry32(900 + I.idx * 31);
      let n = 0;
      for (const [k, count] of specs) {
        const on = CAT[k].on, C = I.cols;
        let pool = on === 'grass' ? C.grass : on === 'sand' ? C.sand : on === 'reef' || on === 'water' ? C.shallow.concat(C.ring) : on === 'shore' ? C.shallow.concat(C.sand, C.grass) : C.grass.concat(C.sand, C.rock);
        if (CENTRAL.has(k)) pool = pool.slice().sort((a, b) => Math.hypot(a[0] - I.x, a[1] - I.z) - Math.hypot(b[0] - I.x, b[1] - I.z));
        for (let placed = 0, tries = 0; placed < count && tries < 300 && pool.length; tries++) {
          const p = CENTRAL.has(k) ? pool[tries] : U.pick(rng, pool);
          if (!p) break;
          const x = p[0] + (rng() - 0.5) * 0.6, z = p[1] + (rng() - 0.5) * 0.6, chk = GD.check(k, x, z);
          if (!chk.ok) continue;
          acc.push({ id: 'w:' + I.id + ':' + n++, k, x: +x.toFixed(2), y: chk.y, z: +z.toFixed(2), seed: (rng() * 1e9) | 0, wild: true });
          placed++;
        }
      }
    }
    GD.items = keep;
    return acc;
  }
  GD.reset = function (list, gone) {
    clearGrower(woodG); clearGrower(leafG); clearGrower(glowG);
    GD.items = [];
    if (gone) { wildGone.clear(); gone.forEach((id) => wildGone.add(id)); }
    if (!wildLayout) wildLayout = layoutWild();
    for (const w of wildLayout) {
      if (wildGone.has(w.id)) continue;
      const rec = Object.assign({}, w);
      if (plant(rec, true)) GD.items.push(rec);
    }
    const MIGRATE = { blossom: 'cherry' };
    for (const raw of list || []) {
      const rec = Object.assign({}, raw);
      rec.k = MIGRATE[rec.k] || rec.k;
      if (!CAT[rec.k]) continue;
      if (!rec.id || typeof rec.id !== 'number') rec.id = nextId;
      nextId = Math.max(nextId, rec.id + 1);
      if (plant(rec, true)) GD.items.push(rec);
    }
    GD.version++;
  };
  GD.starter = function () {
    const rng = mulberry32(2026), out = [], P = K.POND;
    const spots = W.cols.grass.filter(([x, z, h]) => h >= 2 && Math.hypot(x - P.x, z - P.z) > P.r + 2.5);
    const add = (k, x, z) => out.push({ id: out.length + 1, k, x, y: CAT[k].on === 'water' ? K.WL : W.heightAt(x, z), z, seed: (rng() * 1e9) | 0, at: U.today() });
    const far = (x, z, d) => out.every((p) => Math.hypot(p.x - x, p.z - z) > d);
    const place = (k, d) => { for (let i = 0; i < 400; i++) { const [x, z] = U.pick(rng, spots); if (far(x, z, d)) { add(k, x, z); return; } } };
    for (const k of ['oak', 'cherry', 'pine', 'maple']) place(k, 5.5);
    for (const k of ['flowers', 'flowers', 'lavender', 'tulips', 'fern', 'mushroom']) place(k, 2.2);
    add('lily', P.x + 0.3, P.z - 0.2);
    add('reeds', P.x - P.r - 0.6, P.z + 0.4);
    const d = W.dock.start;
    for (let i = 0; i < 40; i++) {
      const x = d.x * 0.82 + (rng() - 0.5) * 3, z = d.z * 0.82 + (rng() - 0.5) * 3, c = W.colAt(x, z);
      if (c.h >= 0 && far(x, z, 1.5)) { add('lantern', x, z); break; }
    }
    return out;
  };

  // A scatter of grass tufts, beach pebbles and boulders that is part of the island, not the garden.
  function scatter() {
    const rng = mulberry32(77), t0 = -1000, P = K.POND;
    for (const [x, z, h] of W.cols.grass) {
      if (rng() > 0.1 || Math.hypot(x - P.x, z - P.z) < P.r + 0.3) continue;
      const fx = x + (rng() - 0.5) * 0.8, fz = z + (rng() - 0.5) * 0.8, n = 3 + ((rng() * 4) | 0), s = 0.09;
      for (let i = 0; i < n; i++) {
        const sx = fx + (rng() - 0.5) * 0.35, sz = fz + (rng() - 0.5) * 0.35, hgt = 2 + ((rng() * 3) | 0);
        for (let j = 0; j < hgt; j++) addVoxel(leafG, sx, h + s * (j + 0.5), sz, s, 1, PAL_INDEX.tuft, t0, 1, rng());
      }
    }
    for (const [x, z, h] of W.cols.sand) {
      if (rng() > 0.07) continue;
      const n = 1 + ((rng() * 3) | 0);
      for (let i = 0; i < n; i++) { const s = 0.1 + rng() * 0.08; addVoxel(woodG, x + (rng() - 0.5) * 0.8, h + s * 0.25, z + (rng() - 0.5) * 0.8, s, 0.5, stoneC(rng), t0, 1, 0); }
    }
    for (let b = 0; b < 7; b++) {
      const [x, z, h] = U.pick(rng, W.cols.grass), s = 0.3;
      if (Math.hypot(x - P.x, z - P.z) < P.r + 1) continue;
      for (let dx = 0; dx < 2; dx++) for (let dy = 0; dy < 2; dy++) for (let dz = 0; dz < 2; dz++) {
        if (dy && rng() < 0.3) continue;
        const c = dy && rng() < 0.4 ? hex(0x7f9a68) : stoneC(rng);
        addVoxel(woodG, x + (dx - 0.5) * s, h + s * (dy + 0.5), z + (dz - 0.5) * s, s, 1, c, t0, 1, 0);
      }
    }
    const rng2 = mulberry32(78);
    for (const I of K.ISLANDS) {
      if (I.id === 'home') continue;
      for (const [x, z, h] of I.cols.grass) {
        if (rng2() > (I.id === 'meadow' ? 0.22 : 0.12)) continue;
        const s = 0.09, n = 3 + ((rng2() * 4) | 0);
        for (let i = 0; i < n; i++) {
          const sx = x + (rng2() - 0.5) * 0.9, sz = z + (rng2() - 0.5) * 0.9, hgt = 2 + ((rng2() * 3) | 0);
          for (let j = 0; j < hgt; j++) addVoxel(leafG, sx, h + s * (j + 0.5), sz, s, 1, PAL_INDEX.tuft, t0, 1, rng2());
        }
      }
      for (const [x, z, h] of I.cols.sand.concat(I.cols.rock)) {
        if (rng2() > 0.06) continue;
        const s = 0.1 + rng2() * 0.1;
        addVoxel(woodG, x + (rng2() - 0.5) * 0.8, h + s * 0.25, z + (rng2() - 0.5) * 0.8, s, 0.5, stoneC(rng2), t0, 1, 0);
      }
    }
    woodG.base = woodG.n; leafG.base = leafG.n; glowG.base = glowG.n;
  }

  GD.init = function () {
    W = SW.world;
    const leafMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    leafMat.onBeforeCompile = (sh) => {
      sh.uniforms.uSway = swayU; sh.uniforms.uSwayAmp = swayAmpU;
      sh.vertexShader = 'uniform float uSway, uSwayAmp;\n' + sh.vertexShader.replace('#include <project_vertex>', `
        vec4 mvPosition = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          mvPosition = instanceMatrix * mvPosition;
        #endif
        float sw = sin(uSway * 0.9 + mvPosition.x * 0.45 + mvPosition.z * 0.3) + 0.5 * sin(uSway * 1.7 + mvPosition.z * 0.8);
        mvPosition.x += sw * 0.03 * uSwayAmp; mvPosition.z += sw * 0.018 * uSwayAmp;
        mvPosition = modelViewMatrix * mvPosition;
        gl_Position = projectionMatrix * mvPosition;`);
    };
    glowMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    woodG = makeGrower(40000, new THREE.MeshLambertMaterial({ color: 0xffffff }), true);
    leafG = makeGrower(100000, leafMat, true);
    glowG = makeGrower(4000, glowMat, false);
    scatter();
    rebuildFeatures();
  };

  let swayPhase = 0;
  GD.update = function (t, dt) {
    const wind = S.weather.wind;
    swayPhase += dt * (0.6 + wind * 0.8);
    swayU.value = S.reduceMotion ? 0 : swayPhase;
    swayAmpU.value = 0.6 + wind * 0.9;
    updateGrower(woodG, t); updateGrower(leafG, t); updateGrower(glowG, t);
    sweep(leafG, S.season, 2600);
    glowMat.color.setScalar(0.62 + 0.55 * S.glow);
    if (featVersion !== GD.version) rebuildFeatures();
    lightTimer -= dt;
    if (lightTimer <= 0) {
      lightTimer = 0.5;
      const F = W.focus;
      W.setDynamicLights(GD.feat.light.filter((l) => t > l.ready - 2).sort((a, b) => Math.hypot(a.x - F.x, a.z - F.z) - Math.hypot(b.x - F.x, b.z - F.z)));
    }
  };
  let lightTimer = 0;
  GD.capacity = () => ({ leaf: leafG.n / leafG.cap, wood: woodG.n / woodG.cap });
})(window.SW);
