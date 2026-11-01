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
    apple: pal4([0xfaeef2, 0xf4d8e2, 0xfdf6f8, 0x9fcf6a, 0xeccad6], [0x6a9e52, 0x5f9449, 0x77aa5c, 0x84b465], [0xc9b04a, 0xb89a3a, 0x9aa548, 0xd8a03e], null),
    fruit: pal4(null, [0x9cc45a, 0xa8cc62], [0xd8402e, 0xc8302a, 0xe25a34, 0xb82a26], null),
    bambooLeaf: pal4([0x9cc860, 0x8abd55, 0xa8d06c], [0x7fb04e, 0x6fa244, 0x8aba58], [0x9fb04e, 0x8aa048, 0xb0b45a], [0x7c9e52, 0x6c8e48, 0xe8eef0]),
    cloudleaf: pal4(...Array(4).fill([0xfbf8ee, 0xf4eedc, 0xfff6d8, 0xf6e7b8, 0xeef2f4])),
    goldpetal: pal4(...Array(4).fill([0xf4cf5a, 0xf8dc7a, 0xe8bc48])),
    emberleaf: pal4(...Array(4).fill([0x5a1c14, 0x7a2416, 0x3a1410, 0x8a3a1a, 0x2a1210])),
    hibiscus: pal4([0x5f9a4e, 0x4f8c44], [0x4f8c44, 0x5f9a4e, 0x46803c], [0x6a8a44], [0x5a7a44]),
    bonsai: pal4(...Array(4).fill([0x3f6b4a, 0x47775a, 0x365e40, 0x4f8058])),
    ancient: pal4([0x9ccb62, 0x8cc058, 0xaad470, 0x7fb352], [0x5e8e4a, 0x6a9a52, 0x527f42, 0x76a45c], [0xd99a3a, 0xc97a2e, 0xb8642a, 0xe0b44a, 0xa0782c], null),
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
  function makeGrower(cap, mat, shadow) {
    const mesh = new THREE.InstancedMesh(W.boxGeo, mat, cap);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    for (let i = 0; i < cap; i++) mesh.setColorAt(i, tmpC.setRGB(1, 1, 1));
    mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    mesh.count = 0; mesh.castShadow = shadow; mesh.receiveShadow = shadow; mesh.frustumCulled = false;
    W.scene.add(mesh);
    const f = () => new Float32Array(cap);
    return {
      mesh, cap, n: 0, base: 0, pending: [], shrinking: [], cursor: 0, mLo: Infinity, mHi: -1, cLo: Infinity, cHi: -1,
      px: f(), py: f(), pz: f(), sz: f(), sy: f(), birth: f(), dur: f(), grow: f(), rr: f(),
      vis: new Float32Array(cap).fill(1), pal: new Int16Array(cap).fill(-1), dead: new Uint8Array(cap), col: new Float32Array(cap * 3),
      shade: new Float32Array(cap).fill(1),   // light inside a canopy: dim under leaves, bright at the sunlit top
    };
  }
  // Only the range of voxels that changed is sent to the GPU, not the whole buffer.
  function setVoxel(g, i) {
    const s = g.dead[i] ? 0 : g.sz[i] * g.grow[i] * g.vis[i];
    M4.makeScale(s, s * g.sy[i], s);
    M4.setPosition(g.px[i], g.py[i], g.pz[i]);
    g.mesh.setMatrixAt(i, M4);
    if (i < g.mLo) g.mLo = i;
    if (i > g.mHi) g.mHi = i;
  }
  const shadeC = new THREE.Color();
  function setColor(g, i, c) {
    g.mesh.setColorAt(i, g.shade[i] === 1 ? c : shadeC.copy(c).multiplyScalar(g.shade[i]));
    if (i < g.cLo) g.cLo = i;
    if (i > g.cHi) g.cHi = i;
  }
  function flush(g) {
    if (g.mHi >= g.mLo) { W.queueUpload(g.mesh.instanceMatrix, g.mLo, g.mHi); g.mLo = Infinity; g.mHi = -1; }
    if (g.cHi >= g.cLo) { W.queueUpload(g.mesh.instanceColor, g.cLo, g.cHi); g.cLo = Infinity; g.cHi = -1; }
  }
  function addVoxel(g, x, y, z, s, sy, c, birth, dur, r, shade) {
    const i = g.n++;
    g.shade[i] = shade == null ? 1 : shade;
    g.px[i] = x; g.py[i] = y; g.pz[i] = z; g.sz[i] = s; g.sy[i] = sy;
    g.birth[i] = birth; g.dur[i] = dur; g.rr[i] = r; g.dead[i] = 0; g.grow[i] = 0;
    if (typeof c === 'number') { g.pal[i] = c; g.vis[i] = U.seasonColor(PAL_LIST[c], r, S.season, tmpC); }
    else { g.pal[i] = -1; g.vis[i] = 1; tmpC.copy(c); }
    g.col[i * 3] = tmpC.r; g.col[i * 3 + 1] = tmpC.g; g.col[i * 3 + 2] = tmpC.b;
    setColor(g, i, tmpC);
    setVoxel(g, i);
    g.pending.push(i);
    g.mesh.count = g.n;
  }
  function updateGrower(g, t) {
    const p = g.pending;
    let w = 0;
    for (let j = 0; j < p.length; j++) {
      const i = p[j];
      if (g.dead[i]) { setVoxel(g, i); continue; }
      const k = (t - g.birth[i]) / g.dur[i];
      if (k <= 0) { p[w++] = i; continue; }
      g.grow[i] = k >= 1 ? 1 : 1 - Math.pow(1 - k, 3);
      setVoxel(g, i);
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
      if (k >= 1) g.shrinking.splice(j, 1);
    }
    flush(g);
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
        setColor(g, i, tmpC);
      }
      if (Math.abs(vis - g.vis[i]) > 0.004) { g.vis[i] = vis; setVoxel(g, i); }
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
      if (cur) { if (cur.type === 'l' && (type === 'w' || type === 'f' || type === 'e')) { cur.type = type; cur.order = Math.min(cur.order, order); } return; }
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
      // old trees carry a thick trunk and limbs, tapering toward the twigs
      const rad = c.thick ? Math.round(c.thick * Math.pow(depth / c.depth, 2)) : 0;
      for (let i = 0; i <= steps; i++) {
        p.copy(pos).addScaledVector(dir, len * i / steps); put(p.x, p.y, p.z, 'w', order + i * 0.5);
        if (rad) for (let a = -rad; a <= rad; a++) for (let b = -rad; b <= rad; b++) if (a * a + b * b <= rad * rad + 0.5) put(p.x + a * TS, p.y, p.z + b * TS, 'w', order + i * 0.5);
      }
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
      else if (v.type === 'f') o.vox('l', x, y, z, TS * 0.8, c.fruit, v.order);
      else if (v.type === 'e') o.vox('g', x, y, z, TS * 0.7, hex(U.pick(rng, c.embers)), v.order);
      else { o.vox('l', x, y, z, TS * 0.97, c.pal, v.order); top = Math.max(top, y); }
    }
    tips.sort((a, b) => b[1] - a[1]);
    if (tips[0]) o.feature('perch', { x: tips[0][0], y: top + TS * 0.6, z: tips[0][2], tree: true });
    tips.slice(0, c.leafSrc || 10).forEach((tp) => o.feature('leafSrc', { x: tp[0], y: tp[1], z: tp[2], pal: c.pal }));
    o.feature('tree', { x: 0, y: top, z: 0 });
    if (c.perches) tips.slice(1, c.perches).forEach((tp) => o.feature('perch', { x: tp[0], y: tp[1] + TS * 2, z: tp[2], tree: true }));
  }
  const mossWood = (rng) => (rng() < 0.16 ? hex(0x5f7a3e).offsetHSL(0, 0, (rng() - 0.5) * 0.06) : hex(0x5e4632).offsetHSL(0, 0, (rng() - 0.5) * 0.06));
  const TREES = {
    cloud: { pal: 'cloudleaf', trunk: 2.3, depth: 3, spread: 0.5, ratio: 0.7, split3: 0.4, leafR: 2.8, squash: 1.5, wood: (rng) => hex(U.pick(rng, [0xf2ead8, 0xe8dcc0, 0xd8c08a])), leafSrc: 6 },
    ash: {
      pal: 'emberleaf', trunk: 2.0, depth: 3, spread: 0.62, ratio: 0.66, split3: 0.4, leafR: 1.7, squash: 1.3, wood: (rng) => hex(U.pick(rng, [0x2a2422, 0x1e1a1a, 0x3a302c])),
      embers: [0xff7a2a, 0xff9a3a, 0xffb050, 0xe8501a],
      extra(put, tips, rng, TS) { for (const [cx, cy, cz] of tips) for (let f = 0; f < 5; f++) put(cx + (rng() - 0.5) * TS * 6, cy + (rng() - 0.5) * TS * 4, cz + (rng() - 0.5) * TS * 6, 'e', 20 + f); },
    },
    apple: {
      pal: 'apple', fruit: 'fruit', trunk: 1.5, depth: 3, spread: 0.66, ratio: 0.68, split3: 0.5, leafR: 2.2, squash: 1.35, wood: woodC(0x6a5040),
      extra(put, tips, rng, TS) {
        for (const [cx, cy, cz] of tips) for (let f = 0; f < 4; f++) {
          const a = rng() * Math.PI * 2, r = (1.2 + rng() * 0.8) * TS * 2;
          put(cx + Math.cos(a) * r, cy - TS * (1 + ((rng() * 2) | 0)), cz + Math.sin(a) * r, 'f', 30 + f);
        }
      },
    },
    // the one on Old Tree Isle: hundreds of years old, with a trunk you could not reach around
    ancient: {
      pal: 'ancient', trunk: 3.4, depth: 4, spread: 0.62, ratio: 0.74, split3: 0.55, leafR: 2.6, squash: 1.9, ts: 0.42, thick: 3, up: 0.03, wood: mossWood, leafSrc: 24, perches: 8,
      extra(put, tips, rng, TS) {
        for (let k = 0; k < 9; k++) {
          const a = k / 9 * Math.PI * 2 + rng() * 0.4;
          for (let j = 2; j < 9 + ((rng() * 4) | 0); j++) put(Math.cos(a) * j * TS, TS * (j < 5 ? 1 : 0.5), Math.sin(a) * j * TS, 'w', j);
        }
      },
    },
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

  function bamboo(o, rng) {
    const s = 0.15, n = 5 + ((rng() * 5) | 0), green = [0x7fa04a, 0x86a850, 0x749646], node = hex(0x5f7e38);
    for (let i = 0; i < n; i++) {
      const a = rng() * Math.PI * 2, r = Math.sqrt(rng()) * 0.55, fx = Math.round(Math.cos(a) * r / s) * s, fz = Math.round(Math.sin(a) * r / s) * s;
      const hgt = 16 + ((rng() * 12) | 0), shade = hex(U.pick(rng, green));
      for (let j = 0; j < hgt; j++) o.vox('w', fx, s * (j + 0.5), fz, s * 0.8, j % 5 === 4 ? node : shade, j * 0.6);
      // narrow leaves on the upper culm, held out sideways in little fans
      for (let j = Math.floor(hgt * 0.5); j < hgt + 2; j += 2) {
        const la = rng() * Math.PI * 2, len = 2 + ((rng() * 3) | 0);
        for (let k = 1; k <= len; k++) o.vox('l', fx + Math.cos(la) * k * s, s * (j + 0.5) - k * s * 0.25, fz + Math.sin(la) * k * s, s * 0.9, 'bambooLeaf', j * 0.6 + k, 0.35);
      }
    }
    o.feature('rustle', { x: 0, y: 2, z: 0 });
  }
  function hive(o, rng, rec) {
    const s = 0.14, k = faceK(rec.x, rec.z), paint = hex(U.pick(rng, [0xf2e6c8, 0xe8eef0, 0xd8e6d0, 0xf0dcc0]));
    const P = (x, y, z, c, ord) => { const [wx, wz] = rot(x, z, k); o.vox('w', wx * s, s * (y + 0.5), wz * s, s, c, ord); };
    for (const x of [-2, 2]) for (const z of [-2, 2]) P(x, 0, z, hex(DARK), 0);
    for (let x = -2; x <= 2; x++) for (let z = -2; z <= 2; z++) P(x, 1, z, hex(WOOD2), 1);
    const boxes = 2 + ((rng() * 2) | 0);
    for (let b = 0; b < boxes; b++) for (let y = 0; y < 3; y++) for (let x = -2; x <= 2; x++) for (let z = -2; z <= 2; z++) {
      if (Math.abs(x) < 2 && Math.abs(z) < 2 && y === 1) continue;
      P(x, 2 + b * 3 + y, z, y === 2 ? paint.clone().offsetHSL(0, 0, -0.06) : paint, 2 + b * 3 + y);
    }
    const top = 2 + boxes * 3;
    for (let x = -3; x <= 3; x++) for (let z = -3; z <= 3; z++) P(x, top, z, hex(0x8a8f94), top);
    P(2.6, 2.3, 0, hex(0x2a2420), 3);
    const [hx, hz] = rot(2.6 * s, 0, k);
    o.feature('hive', { x: hx, y: s * 2.8, z: hz });
    o.feature('perch', { x: 0, y: s * (top + 1.2), z: 0 });
  }
  function moongate(o, rng, rec, style) {
    const s = 0.3, k = faceK(rec.x, rec.z), R = 6, marble = style === 'halo';
    const P = (x, y, z, c, ord) => { const [wx, wz] = rot(x, z, k); o.vox('w', wx * s, s * (y + 0.5), wz * s, s, c, ord); };
    // a round opening in a short stone wall, with a tiled cap
    for (let z = -R - 4; z <= R + 4; z++) for (let y = 0; y <= R * 2 + 1; y++) {
      const dz = z, dy = y - R - 0.5, d = Math.hypot(dz, dy);
      const inWall = Math.abs(z) <= R + 1 ? d >= R - 0.3 && y <= R * 2 + 1 : y <= 5 - Math.max(0, Math.abs(z) - R - 2);
      if (!inWall || (Math.abs(z) > R + 1 && y > 5)) continue;
      if (d < R - 0.3 && Math.abs(z) <= R) continue;
      for (const x of [0, 1]) P(x, y, z, marble ? hex(U.pick(rng, [0xf4f0e6, 0xece6d8, 0xf8f6ee])) : stoneC(rng).offsetHSL(0, 0, 0.08), y + Math.abs(z) * 0.2);
    }
    for (let z = -R - 2; z <= R + 2; z++) {
      const y = R * 2 + 2 - Math.max(0, Math.abs(z) - R + 1);
      for (const x of [-1, 0, 1, 2]) P(x, y, z, hex(marble ? 0xe2c36a : 0x4a5560), 20 + Math.abs(z) * 0.2);
    }
    if (marble) {
      // a ring of light just inside the opening
      for (let i = 0; i < 40; i++) { const a = i / 40 * Math.PI * 2, [wx, wz] = rot(0.5, Math.cos(a) * (R - 0.6), k); o.vox('g', wx * s, s * (R + 0.5 + Math.sin(a) * (R - 0.6)), wz * s, s * 0.45, hex(0xffe6a0), 24); }
      o.feature('light', { x: 0, y: s * (R + 1), z: 0, color: 0xffe6b0, base: 0.7, distance: 9 });
    }
    o.feature('perch', { x: 0, y: s * (R * 2 + 3.2), z: 0 });
  }
  function driftwood(o, rng, rec) {
    const s = 0.16, a = rng() * Math.PI, ca = Math.cos(a), sa = Math.sin(a), L = 12 + ((rng() * 8) | 0), bleach = [0xd8d0c0, 0xcfc6b4, 0xe2dccd, 0xbfb6a4];
    for (let u = 0; u < L; u++) {
      const t = u - L / 2, w = u < 2 ? 1 : 0;
      for (let v = -w; v <= w; v++) for (let y = 0; y < (u < 2 ? 2 : 1) + (u % 7 === 3 ? 1 : 0); y++) o.vox('w', (t * ca - v * sa) * s, s * (y + 0.5), (t * sa + v * ca) * s, s, hex(U.pick(rng, bleach)), u);
      if (u % 5 === 2) for (let j = 1; j <= 3; j++) o.vox('w', (t * ca + j * sa) * s, s * (0.5 + j * 0.6), (t * sa - j * ca) * s, s * 0.8, hex(U.pick(rng, bleach)), u + j);
    }
    o.feature('seat', { x: 0, y: s * 1.2, z: 0, angle: a + Math.PI / 2, kind: 'bench' });
    o.feature('perch', { x: (L / 2 - 1) * ca * s, y: s * 2.2, z: (L / 2 - 1) * sa * s });
  }

  // A house on tall legs over the shallows: plank deck, lit window, pitched roof, a lantern by the door.
  function stilthouse(o, rng, rec) {
    const s = 0.22, k = faceK(rec.x, rec.z), base = Math.max(0, K.WL + 1.5 - rec.y), legs = Math.ceil(base / s) + 1;
    const wall = hex(U.pick(rng, [0xb08a62, 0xa47a54, 0xc49a6e])), roofC = hex(U.pick(rng, [0x5a3a2e, 0x4a4e58, 0x6a4030])), plank = hex(0x8a6a4c);
    const P = (x, y, z, layer, c, ord, size) => { const [wx, wz] = rot(x, z, k); o.vox(layer, wx * s, s * (y + 0.5), wz * s, size || s, c, ord); };
    for (const x of [-4, 4]) for (const z of [-4, 4]) for (let y = 0; y < legs; y++) P(x, y, z, 'w', hex(DARK), y * 0.3);
    const fy = legs;
    for (let x = -5; x <= 6; x++) for (let z = -5; z <= 5; z++) P(x, fy, z, 'w', plank.clone().offsetHSL(0, 0, (rng() - 0.5) * 0.06), 4);
    for (let y = fy + 1; y <= fy + 5; y++) for (let x = -4; x <= 3; x++) for (let z = -4; z <= 4; z++) {
      if (Math.abs(z) < 4 && x > -4 && x < 3) continue;
      const door = x === 3 && Math.abs(z) <= 1 && y <= fy + 3, win = (z === 4 || z === -4) && Math.abs(x) <= 1 && y === fy + 3;
      if (door) continue;
      if (win) P(x, y, z, 'g', hex(0xffc777), 6 + y - fy);
      else P(x, y, z, 'w', wall.clone().offsetHSL(0, 0, (rng() - 0.5) * 0.04), 6 + y - fy);
    }
    for (let i = 0; i <= 6; i++) for (let x = -5; x <= 4; x++) {
      const z = 6 - i;
      for (const sz of [-1, 1]) P(x, fy + 6 + i, sz * z, 'w', roofC.clone().offsetHSL(0, 0, (rng() - 0.5) * 0.04), 12 + i);
      if (z === 0) break;
    }
    P(5, fy + 3, 3, 'g', hex(0xffd59a), 16, s * 0.9); P(5, fy + 4, 3, 'w', hex(DARK), 16, s * 0.6);
    const [lx, lz] = rot(5 * s, 3 * s, k);
    o.feature('light', { x: lx, y: s * (fy + 3), z: lz, color: 0xffc98a, base: 0.8, distance: 9 });
    o.feature('perch', { x: 0, y: s * (fy + 13.2), z: 0 });
    const [ex, ez] = rot(5.6 * s, -2 * s, k);
    o.feature('seat', { x: ex, y: s * (fy + 1), z: ez, angle: k * Math.PI / 2, kind: 'edge' });
  }
  // A pagoda of four shrinking storeys, each with upturned eaves and a lamp.
  function pagoda(o, rng, rec) {
    const s = 0.24, k = faceK(rec.x, rec.z), red = hex(0x9a3a2e), roofC = hex(0x3e4652), gold = hex(0xd8b04a);
    const P = (x, y, z, layer, c, ord, size) => { const [wx, wz] = rot(x, z, k); o.vox(layer, wx * s, s * (y + 0.5), wz * s, size || s, c, ord); };
    foundation(o, rng, rec, s, 5, k, P);
    for (let x = -5; x <= 5; x++) for (let z = -5; z <= 5; z++) P(x, 0, z, 'w', stoneC(rng), 1);
    let y = 1;
    for (let f = 0; f < 4; f++) {
      const h = 4 - (f > 1 ? 1 : 0), w = 4 - f;
      for (let yy = 0; yy < h; yy++) for (let x = -w; x <= w; x++) for (let z = -w; z <= w; z++) {
        const edge = Math.max(Math.abs(x), Math.abs(z)) === w;
        if (!edge) continue;
        const corner = Math.abs(x) === w && Math.abs(z) === w, win = !corner && yy === 1 && (Math.abs(x) === 0 || Math.abs(z) === 0);
        P(x, y + yy, z, win ? 'g' : 'w', win ? hex(0xffcf8a) : corner ? red : hex(0xe8dcc4).offsetHSL(0, 0, (rng() - 0.5) * 0.04), y + yy);
      }
      y += h;
      const e = w + 2;
      for (let x = -e; x <= e; x++) for (let z = -e; z <= e; z++) {
        const ring = Math.max(Math.abs(x), Math.abs(z));
        if (ring > e || ring < w - 1) continue;
        const up = Math.abs(x) === e && Math.abs(z) === e ? 1 : 0;   // the corners turn up
        P(x, y + up, z, 'w', roofC.clone().offsetHSL(0, 0, (rng() - 0.5) * 0.05), y + 1);
      }
      for (const [x, z] of [[e, e], [-e, e], [e, -e], [-e, -e]]) P(x, y - 1, z, 'g', hex(0xffc274), y, s * 0.7);
      y += 1;
    }
    for (let i = 0; i < 4; i++) P(0, y + i, 0, 'w', gold, y + i, s * (0.8 - i * 0.12));
    o.feature('light', { x: 0, y: s * 3, z: 0, color: 0xffc98a, base: 1.0, distance: 12 });
    o.feature('perch', { x: 0, y: s * (y + 4.5), z: 0 });
  }

  // ------------------------------------------------- each world's own things
  // Lantern Bay: a post hung with paper lanterns, and a bonsai pine
  function lanternpost(o, rng, rec) {
    const s = 0.12, k = faceK(rec.x, rec.z), P = (x, y, z, layer, c, ord, size) => { const [wx, wz] = rot(x, z, k); o.vox(layer, wx * s, s * (y + 0.5), wz * s, size || s, c, ord); };
    for (let y = 0; y < 16; y++) P(0, y, 0, 'w', hex(DARK), y);
    for (let x = -4; x <= 4; x++) P(x, 16, 0, 'w', hex(WOOD2), 17);
    const reds = [0xff7a4a, 0xffb060, 0xff9a5a];
    for (const x of [-3, 0, 3]) {
      if (x === 0 && rng() < 0.5) continue;
      P(x, 15, 0, 'w', hex(0x3a3030), 18, s * 0.5);
      for (let y = 12; y <= 14; y++) P(x, y, 0, 'g', hex(U.pick(rng, reds)), 19, s * (y === 13 ? 1.6 : 1.3));
    }
    o.feature('light', { x: 0, y: s * 13, z: 0, color: 0xff9a5a, base: 0.8, distance: 8 });
    o.feature('perch', { x: 0, y: s * 17.2, z: 0 });
  }
  function bonsai(o, rng) {
    const s = 0.1;
    let x = 0, z = 0;
    const lean = rng() * Math.PI * 2;
    for (let y = 0; y < 10; y++) { if (y > 2 && y % 3 === 0) { x += Math.cos(lean) * s; z += Math.sin(lean) * s; } o.vox('w', x, s * (y + 0.5), z, s * 1.2, hex(0x5a4434), y); }
    for (const [dy, r, dx] of [[10, 3, 0], [7, 2.4, -2.5], [8, 2.2, 2.5]]) {
      for (let a = -Math.ceil(r); a <= r; a++) for (let b = -Math.ceil(r); b <= r; b++) {
        if (a * a + b * b > r * r || rng() < 0.15) continue;
        o.vox('l', x + (a + dx * Math.cos(lean + 1.6)) * s, s * (dy + 0.5), z + (b + dx * Math.sin(lean + 1.6)) * s, s, 'bonsai', 12 + Math.hypot(a, b), 0.7);
      }
    }
    for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) if (Math.abs(a) + Math.abs(b) < 4) o.vox('w', a * s, s * 0.25, b * s, s, stoneC(rng), 0, 0.5);
  }
  // Frost Fjord: a snowman, ice crystals, an igloo and a sled
  function snowman(o, rng) {
    const s = 0.1, white = [0xf6f8fa, 0xeef2f6, 0xffffff];
    let y = 0;
    for (const r of [3.2, 2.4, 1.7]) {
      const n = Math.ceil(r);
      for (let a = -n; a <= n; a++) for (let b = -n; b <= n; b++) for (let c = -n; c <= n; c++) if (a * a + b * b + c * c <= r * r) o.vox('w', a * s, s * (y + n + b + 0.5), c * s, s, hex(U.pick(rng, white)), y + n + b);
      y += n * 2 - 0.5;
    }
    const hy = y - 1.7;
    o.vox('w', -0.06, s * (hy + 0.4), 0.16, s * 0.6, hex(0x1a1a1a), 30); o.vox('w', 0.06, s * (hy + 0.4), 0.16, s * 0.6, hex(0x1a1a1a), 30);
    o.vox('w', 0, s * hy, 0.2, s * 0.6, hex(0xf08a2a), 31); o.vox('w', 0, s * hy, 0.26, s * 0.5, hex(0xf08a2a), 31);
    for (let a = -2; a <= 2; a++) for (let c = -2; c <= 2; c++) if (Math.abs(a) === 2 || Math.abs(c) === 2) o.vox('w', a * s, s * (hy - 1.4), c * s, s, hex(0xc8382e), 32);
    for (const sx of [-1, 1]) for (let i = 0; i < 4; i++) o.vox('w', sx * (0.26 + i * 0.08), s * (y - 3.6 + i * 0.5), 0, s * 0.6, hex(0x5a4030), 33 + i);
  }
  function icecrystal(o, rng) {
    const s = 0.12, cols = [0xd6f0fa, 0xc0e6f6, 0xe8f8fc, 0xa8dcf0];
    const n = 4 + ((rng() * 4) | 0);
    for (let i = 0; i < n; i++) {
      const a = rng() * Math.PI * 2, r = i ? 0.15 + rng() * 0.3 : 0, h = (i ? 5 : 10) + ((rng() * 7) | 0), lx = (rng() - 0.5) * 0.04, lz = (rng() - 0.5) * 0.04;
      for (let y = 0; y < h; y++) {
        const w = y > h - 3 ? 0.55 : 1;
        o.vox('w', Math.cos(a) * r + lx * y, s * (y + 0.5), Math.sin(a) * r + lz * y, s * w, hex(U.pick(rng, cols)), y);
      }
    }
    o.vox('g', 0, s * 2, 0, s * 0.8, hex(0xbfe8ff), 2);
    o.feature('light', { x: 0, y: 0.6, z: 0, color: 0xbfe0ff, base: 0.35, distance: 5 });
  }
  function igloo(o, rng, rec) {
    const s = 0.2, k = faceK(rec.x, rec.z), R = 6, white = [0xf4f8fa, 0xe8f0f4, 0xdce8ee];
    const P = (x, y, z, layer, c, ord) => { const [wx, wz] = rot(x, z, k); o.vox(layer, wx * s, s * (y + 0.5), wz * s, s, c, ord); };
    for (let x = -R; x <= R; x++) for (let y = 0; y <= R; y++) for (let z = -R; z <= R; z++) {
      const d = Math.hypot(x, y, z);
      if (d > R + 0.4 || d < R - 0.6) continue;
      if (x > 0 && Math.abs(z) <= 1 && y <= 2) continue;   // the doorway
      P(x, y, z, 'w', hex(U.pick(rng, white)).offsetHSL(0, 0, (y % 2) * -0.03), y);
    }
    for (let x = R; x <= R + 2; x++) for (let z = -2; z <= 2; z++) for (let y = 0; y <= 3; y++) {
      if (Math.abs(z) <= 1 && y <= 2) continue;
      P(x, y, z, 'w', hex(U.pick(rng, white)), 8);
    }
    P(R - 1, 1, 0, 'g', hex(0xffc777), 9); P(R - 2, 1, 0, 'g', hex(0xffb050), 9);
    const [lx, lz] = rot(R * s * 0.8, 0, k);
    o.feature('light', { x: lx, y: s * 1.5, z: lz, color: 0xffb36b, base: 0.9, flicker: 0.5, distance: 7 });
    o.feature('perch', { x: 0, y: s * (R + 1.3), z: 0 });
  }
  function sled(o, rng, rec) {
    const s = 0.1, k = faceK(rec.x, rec.z) + 1, P = (x, y, z, c, ord) => { const [wx, wz] = rot(x, z, k % 4); o.vox('w', wx * s, s * (y + 0.5), wz * s, s, c, ord); };
    for (let x = -6; x <= 6; x++) for (const z of [-3, 3]) P(x, 0, z, hex(0xb83a2e), x + 6);
    P(7, 1, -3, hex(0xb83a2e), 14); P(7, 1, 3, hex(0xb83a2e), 14); P(8, 2, -3, hex(0xb83a2e), 15); P(8, 2, 3, hex(0xb83a2e), 15);
    for (let x = -5; x <= 5; x += 2) for (const z of [-3, 3]) P(x, 1, z, hex(DARK), 16);
    for (let x = -6; x <= 6; x++) for (let z = -3; z <= 3; z++) P(x, 2, z, hex(x % 2 ? WOOD : WOOD2), 18);
    o.feature('seat', { x: 0, y: s * 3, z: 0, angle: (k % 4) * Math.PI / 2, kind: 'bench' });
  }
  // Coral Cays: hibiscus, a tiki torch, a hammock and a beach hut
  function hibiscus(o, rng) {
    const s = 0.12, n = Math.ceil(2.6);
    for (let x = -n; x <= n; x++) for (let y = 0; y <= n; y++) for (let z = -n; z <= n; z++) {
      const d = Math.sqrt(x * x + (y - 1) * (y - 1) * 1.4 + z * z);
      if (d > 2.6 || rng() < 0.2) continue;
      o.vox('l', x * s, s * (y + 0.5), z * s, s, 'hibiscus', d * 2);
    }
    const petal = hex(U.pick(rng, [0xe8303a, 0xf25a8a, 0xf6c040, 0xf07a3a]));
    for (let f = 0; f < 6; f++) {
      const a = rng() * Math.PI * 2, r = 2.2 + rng() * 0.6, fx = Math.cos(a) * r * s, fz = Math.sin(a) * r * s, fy = s * (1.5 + rng() * 2);
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) o.vox('l', fx + dx * s * 0.8, fy, fz + dz * s * 0.8, s * 0.9, petal, 10 + f);
      o.vox('l', fx, fy + s * 0.3, fz, s * 0.5, hex(0xf6e27a), 11 + f);
      o.feature('nectar', { x: fx, y: fy + 0.1, z: fz });
    }
  }
  function tikitorch(o, rng) {
    const s = 0.08;
    for (let y = 0; y < 22; y++) o.vox('w', 0, s * (y + 0.5), 0, s * (y % 5 === 4 ? 1.2 : 1), hex(y % 5 === 4 ? 0x6a5030 : 0xb89a5a), y);
    for (const [x, z] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) o.vox('w', x * s, s * 22.5, z * s, s, hex(0x5a4030), 23);
    o.vox('g', 0, s * 24, 0, s * 1.8, hex(0xff8a3a), 24, 1.4); o.vox('g', 0, s * 25.5, 0, s * 1.1, hex(0xffc050), 25, 1.4);
    o.feature('fire', { x: 0, y: s * 25, z: 0 });
    o.feature('light', { x: 0, y: s * 25, z: 0, color: 0xff9a50, base: 1.1, flicker: 1, distance: 9 });
  }
  function hammock(o, rng, rec) {
    const s = 0.1, k = faceK(rec.x, rec.z), P = (x, y, z, c, ord) => { const [wx, wz] = rot(x, z, k); o.vox('w', wx * s, s * (y + 0.5), wz * s, s, c, ord); };
    for (const z of [-11, 11]) for (let y = 0; y < 14; y++) P(0, y, z, hex(y % 3 ? 0x9a7a52 : 0x8a6a46), y);
    const stripes = [0xe86a5a, 0xf6e6c8, 0x5ab0c0];
    for (let z = -9; z <= 9; z++) {
      const sag = 9 - Math.round(4 * (1 - (z / 9) ** 2));
      for (let x = -2; x <= 2; x++) P(x, sag, z, hex(stripes[(z + 9) % 3]), 14 + Math.abs(z) * 0.2);
    }
    for (const z of [-10, 10]) P(0, 10, z, hex(0xd8c8a8), 13);
    o.feature('seat', { x: 0, y: s * 6, z: 0, angle: k * Math.PI / 2, kind: 'bench' });
  }
  function beachhut(o, rng, rec) {
    const s = 0.2, k = faceK(rec.x, rec.z), wall = hex(U.pick(rng, [0x5ab0c0, 0xe8a05a, 0xf2e6c8])), straw = [0xd8c07a, 0xc8ac64, 0xe2cc8a];
    const P = (x, y, z, layer, c, ord) => { const [wx, wz] = rot(x, z, k); o.vox(layer, wx * s, s * (y + 0.5), wz * s, s, c, ord); };
    for (const x of [-3, 3]) for (const z of [-3, 3]) for (let y = 0; y < 3; y++) P(x, y, z, 'w', hex(DARK), y);
    for (let x = -4; x <= 4; x++) for (let z = -3; z <= 3; z++) P(x, 3, z, 'w', hex(WOOD), 4);
    for (let y = 4; y <= 7; y++) for (let x = -3; x <= 3; x++) for (let z = -3; z <= 3; z++) {
      const edge = Math.abs(x) === 3 || Math.abs(z) === 3;
      if (!edge || (x === 3 && Math.abs(z) <= 1 && y <= 6)) continue;
      P(x, y, z, 'w', wall.clone().offsetHSL(0, 0, ((x + z) % 2) * 0.04), y);
    }
    for (let i = 0; i <= 5; i++) for (let x = -5 + i; x <= 5 - i; x++) for (let z = -5 + i; z <= 5 - i; z++) {
      if (i < 5 && Math.max(Math.abs(x), Math.abs(z)) < 5 - i - 1) continue;
      P(x, 8 + i, z, 'w', hex(U.pick(rng, straw)), 10 + i);
    }
    o.feature('perch', { x: 0, y: s * 14, z: 0 });
    const [ex, ez] = rot(4.4 * s, 0, k);
    o.feature('seat', { x: ex, y: s * 4, z: ez, angle: k * Math.PI / 2, kind: 'edge' });
  }
  // Heaven: golden flowers, marble pillars, a fountain and a harp
  function goldflower(o, rng) {
    const s = 0.09, n = 3 + ((rng() * 3) | 0);
    for (let i = 0; i < n; i++) {
      const fx = (rng() - 0.5) * 0.8, fz = (rng() - 0.5) * 0.8, h = 4 + ((rng() * 4) | 0);
      for (let j = 0; j < h; j++) o.vox('l', fx, s * (j + 0.5), fz, s * 0.7, 'stem', j);
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) o.vox('g', fx + dx * s, s * (h + 0.5), fz + dz * s, s, hex(U.pick(rng, [0xffd66a, 0xffe08a, 0xf8c850])), h + 1);
      o.vox('g', fx, s * (h + 0.9), fz, s * 0.8, hex(0xfff2c0), h + 2);
      o.feature('nectar', { x: fx, y: s * (h + 1), z: fz });
    }
  }
  function pillar(o, rng) {
    const s = 0.14, marble = [0xf6f2ea, 0xeee8dc, 0xfaf8f2], broken = rng() < 0.35, H = broken ? 12 + ((rng() * 6) | 0) : 22;
    for (let x = -2; x <= 2; x++) for (let z = -2; z <= 2; z++) { o.vox('w', x * s, s * 0.5, z * s, s, hex(U.pick(rng, marble)), 0); if (Math.abs(x) < 2 && Math.abs(z) < 2) o.vox('w', x * s, s * 1.5, z * s, s, hex(U.pick(rng, marble)), 1); }
    for (let y = 2; y < H; y++) for (let x = -1; x <= 1; x++) for (let z = -1; z <= 1; z++) {
      if (Math.abs(x) === 1 && Math.abs(z) === 1) continue;
      o.vox('w', x * s, s * (y + 0.5), z * s, s, hex(y % 6 === 0 ? 0xe2c36a : U.pick(rng, marble)), y);
    }
    if (!broken) for (let x = -2; x <= 2; x++) for (let z = -2; z <= 2; z++) o.vox('w', x * s, s * (H + 0.5), z * s, s, hex(U.pick(rng, marble)), H);
    o.feature('perch', { x: 0, y: s * (H + 1.2), z: 0 });
  }
  function fountain(o, rng, rec) {
    const s = 0.16, R = 6, marble = [0xf6f2ea, 0xeee8dc, 0xfaf8f2];
    for (let x = -R; x <= R; x++) for (let z = -R; z <= R; z++) {
      const d = Math.hypot(x, z);
      if (d > R + 0.4) continue;
      o.vox('w', x * s, s * 0.5, z * s, s, hex(U.pick(rng, marble)), 0);
      if (d > R - 0.8) o.vox('w', x * s, s * 1.5, z * s, s, hex(U.pick(rng, marble)), 1);
      else o.vox('g', x * s, s * 1.1, z * s, s, hex(U.pick(rng, [0xbfe6f4, 0xd4f0f8, 0xa8dcee])), 2, 0.4);
    }
    for (let y = 1; y < 8; y++) o.vox('w', 0, s * (y + 0.5), 0, s * (y > 6 ? 1.8 : 1), hex(y === 7 ? 0xe2c36a : U.pick(rng, marble)), y + 2);
    for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; o.vox('g', Math.cos(a) * s * 1.6, s * 7.6, Math.sin(a) * s * 1.6, s * 0.5, hex(0xe8f8ff), 12); }
    o.feature('light', { x: 0, y: s * 6, z: 0, color: 0xdff4ff, base: 0.5, distance: 7 });
    o.feature('perch', { x: 0, y: s * 9, z: 0 });
    o.feature('fountain', { x: 0, y: s * 7.6, z: 0 });
  }
  function harp(o, rng, rec) {
    const s = 0.09, k = faceK(rec.x, rec.z), gold = hex(0xe2c36a), P = (x, y, z, layer, c, ord, size) => { const [wx, wz] = rot(x, z, k); o.vox(layer, wx * s, s * (y + 0.5), wz * s, size || s, c, ord); };
    for (let y = 0; y < 18; y++) P(0, y, -5, 'w', gold, y);
    for (let z = -5; z <= 4; z++) P(0, 17 - Math.round((z + 5) * 0.6 + Math.sin((z + 5) * 0.5) * 1.2), z, 'w', gold, 18 + z);
    for (let z = -4; z <= 4; z++) P(0, Math.round(1 + (z + 5) * 0.5), z, 'w', gold, 20);
    for (let z = -4; z <= 3; z++) { const top = 16 - Math.round((z + 5) * 0.6 + Math.sin((z + 5) * 0.5) * 1.2), bot = Math.round(2 + (z + 5) * 0.5); for (let y = bot; y < top; y++) P(0, y, z, 'g', hex(0xfff2c8), 24, s * 0.25); }
    o.feature('chime', { x: 0, y: s * 9, z: 0 });
    o.feature('perch', { x: 0, y: s * 19, z: 0 });
  }
  // Hell: fire blooms, obsidian spires, braziers and ember lanterns
  function firebloom(o, rng) {
    const s = 0.09, n = 3 + ((rng() * 3) | 0);
    for (let i = 0; i < n; i++) {
      const fx = (rng() - 0.5) * 0.8, fz = (rng() - 0.5) * 0.8, h = 3 + ((rng() * 4) | 0);
      for (let j = 0; j < h; j++) o.vox('w', fx, s * (j + 0.5), fz, s * 0.6, hex(0x2a1a14), j);
      for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0, 1, 0]]) o.vox('g', fx + dx * s, s * (h + 0.5 + dy), fz + dz * s, s, hex(U.pick(rng, [0xff5a1a, 0xff7a2a, 0xffa040, 0xe8301a])), h + 1);
      o.feature('nectar', { x: fx, y: s * (h + 1), z: fz });
    }
  }
  function obsidian(o, rng) {
    const s = 0.14, cols = [0x1a1622, 0x241c30, 0x14121a, 0x2e2440];
    const n = 3 + ((rng() * 3) | 0);
    for (let i = 0; i < n; i++) {
      const a = rng() * Math.PI * 2, r = i ? 0.2 + rng() * 0.35 : 0, h = (i ? 5 : 11) + ((rng() * 6) | 0), lx = (rng() - 0.5) * 0.05, lz = (rng() - 0.5) * 0.05;
      for (let y = 0; y < h; y++) o.vox('w', Math.cos(a) * r + lx * y, s * (y + 0.5), Math.sin(a) * r + lz * y, s * (y > h - 3 ? 0.6 : 1), hex(U.pick(rng, cols)), y);
    }
    for (let i = 0; i < 6; i++) { const a = rng() * Math.PI * 2; o.vox('g', Math.cos(a) * 0.35, s * 0.3, Math.sin(a) * 0.35, s * 0.6, hex(0xff5a1a), 1, 0.4); }
  }
  function brazier(o, rng) {
    const s = 0.1, iron = hex(0x2a2626);
    for (const [x, z] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) for (let y = 0; y < 6; y++) o.vox('w', x * s * (1 - y * 0.05), s * (y + 0.5), z * s * (1 - y * 0.05), s * 0.7, iron, y);
    for (let x = -3; x <= 3; x++) for (let z = -3; z <= 3; z++) { const d = Math.hypot(x, z); if (d > 3.3) continue; o.vox('w', x * s, s * 6.5, z * s, s, iron, 7); if (d > 2.4) o.vox('w', x * s, s * 7.5, z * s, s, iron, 8); }
    for (let i = 0; i < 6; i++) o.vox('g', (rng() - 0.5) * s * 4, s * (7.6 + rng()), (rng() - 0.5) * s * 4, s * 1.4, hex(U.pick(rng, [0xff6a1a, 0xff9a3a, 0xffc050])), 9, 1.3);
    o.feature('fire', { x: 0, y: s * 8, z: 0 });
    o.feature('light', { x: 0, y: s * 9, z: 0, color: 0xff7a3a, base: 1.4, flicker: 1, distance: 12 });
  }
  function emberlantern(o, rng) {
    const s = 0.12, iron = hex(0x221e1e);
    for (let y = 0; y < 9; y++) o.vox('w', 0, s * (y + 0.5), 0, s * 0.7, iron, y);
    for (const y of [9, 12]) for (let x = -1; x <= 1; x++) for (let z = -1; z <= 1; z++) o.vox('w', x * s, s * (y + 0.5), z * s, s, iron, y);
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) for (const y of [10, 11]) o.vox('w', x * s, s * (y + 0.5), z * s, s * 0.6, iron, y);
    o.vox('g', 0, s * 10.5, 0, s * 1.6, hex(0xff5a2a), 10, 1.2);
    o.feature('light', { x: 0, y: s * 10.5, z: 0, color: 0xff6a3a, base: 1, flicker: 0.6, distance: 9 });
    o.feature('perch', { x: 0, y: s * 13.4, z: 0 });
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
    apple: tree('apple', 'Apple', '#d8402e'),
    palm: { cat: 'trees', label: 'Palm', swatch: '#6aa857', on: 'sand', rad: 1.0, solid: true, tree: true, span: 28, build: palm },
    flowers: { cat: 'plants', label: 'Wildflowers', swatch: '#f2d98d', on: 'grass', rad: 0.5, span: 6, build: flowers },
    tulips: { cat: 'plants', label: 'Tulips', swatch: '#e85a6a', on: 'grass', rad: 0.45, span: 6, build: tulips },
    lavender: { cat: 'plants', label: 'Lavender', swatch: '#9b86d6', on: 'grass', rad: 0.45, span: 6, build: lavender },
    sunflower: { cat: 'plants', label: 'Sunflowers', swatch: '#f2c230', on: 'grass', rad: 0.5, span: 9, build: sunflower },
    fern: { cat: 'plants', label: 'Ferns', swatch: '#5f9a4e', on: 'grass', rad: 0.5, span: 6, build: fern },
    mushroom: { cat: 'plants', label: 'Mushrooms', swatch: '#c8453a', on: 'grass', rad: 0.4, span: 5, build: mushrooms },
    bush: { cat: 'plants', label: 'Berry bush', swatch: '#5f9450', on: 'grass', rad: 0.7, solid: true, span: 12, build: bush },
    bamboo: { cat: 'plants', label: 'Bamboo', swatch: '#7fa04a', on: 'grass', rad: 0.75, solid: true, span: 14, build: bamboo },
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
    hive: { cat: 'decor', label: 'Beehive', swatch: '#f2e6c8', on: 'land', rad: 0.55, solid: true, span: 5, build: hive },
    windmill: { cat: 'decor', label: 'Windmill', swatch: '#ece6d8', on: 'land', rad: 1.2, solid: true, span: 12, footprint: 0.65, build: windmill },
    coral: { cat: 'water', label: 'Coral', swatch: '#f28aa0', on: 'reef', rad: 0.7, span: 8, build: coral },
    wreck: { cat: 'scenery', label: 'Shipwreck', swatch: '#7a6650', on: 'land', rad: 2.6, solid: true, span: 1, build: wreck },
    snowpine: { cat: 'scenery', label: 'Snowy pine', swatch: '#e9eff2', on: 'land', rad: 1.1, solid: true, tree: true, span: 30, build: (o, rng, rec) => pine(o, rng, rec, 'pineSnow') },
    stilthouse: { cat: 'scenery', label: 'Stilt house', swatch: '#b08a62', on: 'shore', rad: 1.5, solid: true, span: 12, build: stilthouse },
    pagoda: { cat: 'scenery', label: 'Pagoda', swatch: '#9a3a2e', on: 'land', rad: 1.6, solid: true, span: 16, footprint: 1.1, build: pagoda },
    // each world's own
    lanternpost: { cat: 'decor', label: 'Lantern post', swatch: '#ff9a5a', on: 'land', rad: 0.5, solid: true, span: 5, build: lanternpost },
    bonsai: { cat: 'plants', label: 'Bonsai', swatch: '#3f6b4a', on: 'land', rad: 0.5, solid: true, span: 8, bloom: 4, build: bonsai },
    snowman: { cat: 'decor', label: 'Snowman', swatch: '#f6f8fa', on: 'land', rad: 0.5, solid: true, span: 5, build: snowman },
    icecrystal: { cat: 'decor', label: 'Ice crystal', swatch: '#c0e6f6', on: 'land', rad: 0.5, solid: true, span: 6, build: icecrystal },
    igloo: { cat: 'decor', label: 'Igloo', swatch: '#e8f0f4', on: 'land', rad: 1.6, solid: true, span: 10, footprint: 1.1, build: igloo },
    sled: { cat: 'decor', label: 'Sled', swatch: '#b83a2e', on: 'land', rad: 0.8, solid: true, span: 4, build: sled },
    hibiscus: { cat: 'plants', label: 'Hibiscus', swatch: '#e8303a', on: 'land', rad: 0.6, solid: true, span: 8, build: hibiscus },
    tikitorch: { cat: 'decor', label: 'Tiki torch', swatch: '#ff8a3a', on: 'land', rad: 0.3, solid: true, span: 4, build: tikitorch },
    hammock: { cat: 'decor', label: 'Hammock', swatch: '#e86a5a', on: 'land', rad: 1.0, solid: true, span: 6, build: hammock },
    beachhut: { cat: 'decor', label: 'Beach hut', swatch: '#5ab0c0', on: 'land', rad: 1.4, solid: true, span: 10, footprint: 0.9, build: beachhut },
    cloudtree: tree('cloud', 'Cloud tree', '#fbf8ee'),
    goldflower: { cat: 'plants', label: 'Golden flowers', swatch: '#f4cf5a', on: 'grass', rad: 0.45, span: 6, build: goldflower },
    pillar: { cat: 'decor', label: 'Marble pillar', swatch: '#f6f2ea', on: 'land', rad: 0.5, solid: true, span: 8, build: pillar },
    fountain: { cat: 'decor', label: 'Fountain', swatch: '#bfe6f4', on: 'land', rad: 1.2, solid: true, span: 8, footprint: 0.9, build: fountain },
    harp: { cat: 'decor', label: 'Harp', swatch: '#e2c36a', on: 'land', rad: 0.6, solid: true, span: 6, build: harp },
    haloarch: { cat: 'scenery', label: 'Halo arch', swatch: '#ffe6a0', on: 'land', rad: 1.2, solid: true, span: 10, footprint: 0.9, build: (o, rng, rec) => moongate(o, rng, rec, 'halo') },
    ashtree: tree('ash', 'Ash tree', '#7a2416'),
    firebloom: { cat: 'plants', label: 'Fire blooms', swatch: '#ff5a1a', on: 'land', rad: 0.45, span: 6, build: firebloom },
    obsidian: { cat: 'decor', label: 'Obsidian spire', swatch: '#241c30', on: 'land', rad: 0.6, solid: true, span: 8, build: obsidian },
    brazier: { cat: 'decor', label: 'Brazier', swatch: '#ff7a3a', on: 'land', rad: 0.5, solid: true, span: 5, build: brazier },
    emberlantern: { cat: 'decor', label: 'Ember lantern', swatch: '#ff5a2a', on: 'land', rad: 0.4, solid: true, span: 4, build: emberlantern },
    oldtree: { cat: 'scenery', label: 'Old tree', swatch: '#5e8e4a', on: 'land', rad: 2.4, solid: true, tree: true, span: 70, build: (o, rng) => branchTree(o, rng, TREES.ancient) },
    moongate: { cat: 'scenery', label: 'Moon gate', swatch: '#c9cdc8', on: 'land', rad: 1.2, solid: true, span: 10, footprint: 0.9, build: moongate },
    driftwood: { cat: 'scenery', label: 'Driftwood', swatch: '#d8d0c0', on: 'sand', rad: 1.1, solid: true, span: 3, build: driftwood },
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
    const shades = canopyShade(out.l);
    for (const [layer, g, dur] of [['w', woodG, def.tree ? 1.8 : 0.7], ['l', leafG, def.tree ? 2.6 : 1.2], ['g', glowG, 1.0]]) {
      const a = g.n;
      out[layer].forEach((v, j) => addVoxel(g, rec.x + v[0], rec.y + v[1], rec.z + v[2], v[3], v[4], v[5], t0 + v[6] * kk, dur, r(), layer === 'l' && shades ? shades[j] : 1));
      rec._r[layer] = [a, g.n];
    }
    const ready = t0 + (def.span || 6) + 2;
    rec._f = out.f.map((f) => Object.assign({}, f, { x: rec.x + f.x, y: rec.y + f.y, z: rec.z + f.z, rec, ready }));
    GD.version++;
    return true;
  }
  // Light inside a canopy: each leaf is dimmer the more leaves lie above it (the sky it cannot see) and
  // brighter toward the outside of the crown, so trees read as rounded masses instead of flat-lit blocks.
  function canopyShade(list) {
    if (list.length < 24) return null;
    const s = list[0][3] || 0.36, key = (x, y, z) => Math.round(x / s) + ',' + Math.round(y / s) + ',' + Math.round(z / s);
    const set = new Set(list.map((v) => key(v[0], v[1], v[2])));
    let cx = 0, cz = 0, R = 0;
    for (const v of list) { cx += v[0]; cz += v[2]; }
    cx /= list.length; cz /= list.length;
    for (const v of list) R = Math.max(R, Math.hypot(v[0] - cx, v[2] - cz));
    return list.map((v) => {
      let cover = 0;
      for (let k = 1; k <= 4; k++) if (set.has(key(v[0], v[1] + k * s, v[2]))) cover++;
      const out = R > 0.4 ? Math.min(1, Math.hypot(v[0] - cx, v[2] - cz) / R) : 1;
      return 0.6 + 0.4 * Math.min(1, 0.62 * (1 - cover / 4) + 0.45 * out * out);
    });
  }
  function rebuildFeatures() {
    const F = { perch: [], nectar: [], light: [], fire: [], smoke: [], pad: [], chime: [], leafSrc: [], tree: [], birdhouse: [], grat: [], reed: [], porch: [], seat: [], windmill: [], reef: [], hive: [], rustle: [], fountain: [] };
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
        if (c.grassy || c.rock || c.h < 0 || c.h > 5) return { ok: false, msg: def.label + ' likes the sandy beach.' };
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
    if (def.on !== 'water' && k !== 'stones' && (W.pools || []).some((p) => Math.hypot(p.x - x, p.z - z) < p.r)) return { ok: false, msg: 'That spot is under water.' };
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
    bamboo: [['moongate', 1], ['bamboo', 14], ['lantern', 3], ['maple', 2], ['fern', 4], ['stones', 2], ['bench', 1], ['reeds', 3]],
    orchard: [['apple', 9], ['hive', 3], ['flowers', 6], ['lavender', 4], ['tulips', 2], ['bench', 1], ['birdhouse', 1]],
    basalt: [['cairn', 3], ['fern', 3], ['dune', 4]],
    oldtree: [['oldtree', 1], ['mushroom', 8], ['fern', 8], ['bush', 2], ['flowers', 3]],
    stones: [['flowers', 9], ['bush', 3], ['oak', 1], ['tulips', 2]],
    dunes: [['driftwood', 4], ['dune', 18], ['palm', 2]],
    // Lantern Bay
    stilts: [['stilthouse', 6], ['reeds', 12], ['lily', 8], ['willow', 2], ['lanternpost', 3], ['lantern', 2]],
    lotus: [['lily', 16], ['reeds', 6], ['dune', 6], ['cherry', 1]],
    pagoda: [['pagoda', 1], ['maple', 4], ['pine', 3], ['lanternpost', 3], ['lantern', 2], ['bonsai', 3], ['fern', 4], ['stones', 2], ['bench', 1]],
    willows: [['willow', 5], ['cherry', 4], ['bench', 2], ['flowers', 4], ['lily', 5], ['reeds', 4]],
    glade: [['mushroom', 8], ['fern', 8], ['flowers', 6], ['birch', 3], ['campfire', 1], ['bench', 1], ['oak', 1], ['bonsai', 2]],
    teagarden: [['pavilion', 1], ['cherry', 5], ['maple', 3], ['bonsai', 4], ['lanternpost', 3], ['tulips', 3], ['stones', 2]],
    maplehill: [['maple', 8], ['bench', 2], ['lanternpost', 2], ['flowers', 6], ['fern', 3], ['chime', 1]],
    lanternrock: [['lanternpost', 3], ['cairn', 1]],
    // Frost Fjord
    icecliffs: [['snowpine', 6], ['icecrystal', 5], ['cairn', 2]],
    snowsprings: [['cabin', 1], ['igloo', 1], ['lantern', 3], ['snowpine', 4], ['stones', 2], ['snowman', 1]],
    pineridge: [['snowpine', 14], ['birch', 3], ['cairn', 1]],
    sealskerry: [['cairn', 1]],
    northpoint: [['cairn', 3], ['campfire', 1], ['bench', 1], ['snowpine', 2], ['snowman', 2], ['sled', 1], ['icecrystal', 2]],
    birchwood: [['birch', 12], ['snowpine', 3], ['sled', 1], ['snowman', 1], ['bench', 1], ['cairn', 1]],
    snowdrifts: [['icecrystal', 4], ['cairn', 2], ['snowman', 1], ['driftwood', 2]],
    blackcliffs: [['cairn', 3], ['icecrystal', 2], ['snowpine', 2]],
    // Coral Cays
    bluelagoon: [['palm', 9], ['coral', 16], ['dune', 4], ['tikitorch', 3], ['hammock', 1]],
    flamingo: [['reeds', 14], ['lily', 4], ['flowers', 3], ['palm', 2], ['hibiscus', 4]],
    palmcay: [['palm', 4], ['dune', 4], ['driftwood', 1]],
    turtlebeach: [['palm', 4], ['dune', 14], ['driftwood', 2], ['coral', 6], ['beachhut', 1], ['hammock', 1], ['tikitorch', 2]],
    junglehill: [['bamboo', 9], ['fern', 9], ['bush', 4], ['sunflower', 3], ['birdhouse', 1], ['palm', 2], ['hibiscus', 5]],
    reefring: [['palm', 6], ['coral', 20], ['dune', 4], ['tikitorch', 2]],
    mangrove: [['reeds', 14], ['lily', 6], ['hibiscus', 5], ['palm', 2], ['bush', 3]],
    shipwreck: [['wreck', 1], ['dune', 3], ['palm', 2]],
    // Heaven
    temple: [['fountain', 1], ['goldflower', 8], ['cloudtree', 2], ['harp', 1], ['tulips', 3]],
    goldfields: [['goldflower', 16], ['cloudtree', 3], ['flowers', 4], ['bench', 1]],
    swanlagoon: [['pillar', 4], ['dune', 6], ['goldflower', 2]],
    highmeadow: [['cloudtree', 4], ['goldflower', 8], ['flowers', 6], ['pillar', 2]],
    harpisle: [['haloarch', 1], ['cloudtree', 5], ['pillar', 3], ['goldflower', 4], ['harp', 1]],
    lightgarden: [['fountain', 1], ['goldflower', 12], ['tulips', 4], ['cloudtree', 2], ['bench', 2], ['lantern', 2]],
    goldorchard: [['cloudtree', 9], ['harp', 2], ['goldflower', 6], ['bench', 1]],
    skystones: [['goldflower', 8], ['pillar', 3], ['flowers', 4]],
    // Hell
    cinder: [['obsidian', 6], ['brazier', 2], ['firebloom', 4]],
    obsidian: [['obsidian', 5], ['emberlantern', 2], ['firebloom', 3]],
    ashdunes: [['ashtree', 3], ['firebloom', 5], ['cairn', 2]],
    brimstone: [['obsidian', 2], ['cairn', 1]],
    firegarden: [['ashtree', 6], ['firebloom', 12], ['brazier', 4], ['emberlantern', 2], ['bench', 1]],
    ashwood: [['ashtree', 10], ['firebloom', 4], ['obsidian', 2]],
    blacksteps: [['obsidian', 4], ['emberlantern', 3], ['cairn', 2]],
    emberring: [['brazier', 1], ['firebloom', 8], ['obsidian', 2], ['emberlantern', 2]],
  };
  const CENTRAL = new Set(['pavilion', 'windmill', 'wreck', 'oldtree', 'moongate', 'pagoda', 'haloarch', 'fountain']);
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
        if (k === 'stilthouse') pool = C.shallow;   // houses on legs stand out over the shallows
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
    const rng = mulberry32(2026), out = [], P = K.POND, list = K.WORLD.starter;
    const away = (x, z) => !P || Math.hypot(x - P.x, z - P.z) > P.r + 2.5;
    const spots = { grass: W.cols.grass.filter(([x, z, h]) => h >= 2 && away(x, z)), sand: W.cols.sand.filter(([x, z, h]) => h >= 0 && h <= 2) };
    spots.land = spots.grass.concat(spots.sand);
    const add = (k, x, z) => out.push({ id: out.length + 1, k, x, y: CAT[k].on === 'water' ? K.WL : W.heightAt(x, z), z, seed: (rng() * 1e9) | 0, at: U.today() });
    const far = (x, z, d) => out.every((p) => Math.hypot(p.x - x, p.z - z) > d);
    const place = (k, d) => {
      const pool = spots[CAT[k].on] || spots.grass;
      for (let i = 0; i < 400 && pool.length; i++) { const [x, z] = U.pick(rng, pool); if (far(x, z, d) && GD.check(k, x, z).ok) { add(k, x, z); return; } }
    };
    for (const k of list) place(k, CAT[k].tree ? 5.5 : 2.2);
    // the pond and the dock lamp use this world's own things: no lilies in a pool of lava or a frozen fjord
    const has = (k) => !K.WORLD.items || K.WORLD.items.some((it) => it[0] === k);
    if (P && has('lily')) add('lily', P.x + 0.3, P.z - 0.2);
    if (P && has('reeds')) add('reeds', P.x - P.r - 0.6, P.z + 0.4);
    const d = W.dock.start, lamp = ['lantern', 'emberlantern', 'tikitorch'].find(has) || 'lantern';
    for (let i = 0; i < 40; i++) {
      const x = d.x * 0.82 + (rng() - 0.5) * 3, z = d.z * 0.82 + (rng() - 0.5) * 3, c = W.colAt(x, z);
      if (c.h >= 0 && far(x, z, 1.5)) { add(lamp, x, z); break; }
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

  // ------------------------------------------------------------- meadow grass
  // Thin blades over every grass block. They sway with the wind, turn gold in autumn, vanish under
  // snow, and part around paths and buildings.
  const GRASS_PAL = K.WORLD.look.grassPal ? pal4(...Array(4).fill(K.WORLD.look.grassPal)) : pal4([0x9ccc6a, 0xa8d476, 0x8fc460], [0x7fb062, 0x8ab86a, 0x74a65a, 0x6fa452], [0xbfae64, 0xb09a54, 0xc8b870, 0xa89a50], null);
  const CLEAR = { stones: 0.95, cabin: 1.45, pavilion: 1.3, windmill: 0.9, campfire: 0.55, bench: 0.6, lantern: 0.4, cairn: 0.35, wreck: 2.4, birdhouse: 0.2, chime: 0.2, hive: 0.45, moongate: 0.9, oldtree: 1.6, bamboo: 0.5,
    igloo: 1.4, beachhut: 1.0, fountain: 1.1, haloarch: 0.9, hammock: 0.6, sled: 0.6, brazier: 0.4, pagoda: 1.2, snowman: 0.35 };
  let grass = null, gData = null, grassS = -99, grassVer = -1, grassDensity = 4;
  const SPECKS = (K.WORLD.id === 'heaven' ? [0xffe08a, 0xfff6e0, 0xf8d060] : K.WORLD.id === 'hell' ? [0xff6a2a, 0xffa040, 0xe8401a] : [0xfaf6ee, 0xf6d860, 0xc8a8e8, 0xf4a6b8, 0xffffff]).map(hex);
  const grassWalker = { value: new THREE.Vector3(0, -99, 0) };
  function bladeGeometry() {
    const pos = [], hs = [], nrm = [];
    for (let b = 0; b < 3; b++) {
      const a = b * Math.PI / 3 + 0.4, wx = Math.cos(a), wz = Math.sin(a), bx = -wz, bz = wx, lean = (b - 1) * 0.15;
      const P = (u, v) => { const w = 0.05 * (1 - v * 0.85), bend = v * v * 0.25 + lean * v; return [wx * u * w + bx * bend, v, wz * u * w + bz * bend]; };
      const tri = [[-1, 0], [1, 0], [1, 0.55], [-1, 0], [1, 0.55], [-1, 0.55], [-1, 0.55], [1, 0.55], [0, 1]];
      // each triangle twice, once per side, all with an upward normal so blades light like the ground
      for (const order of [tri, tri.slice().reverse()]) for (const [u, v] of order) { pos.push(...P(u, v)); hs.push(v); nrm.push(0, 1, 0); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
    g.setAttribute('aH', new THREE.Float32BufferAttribute(hs, 1));
    return g;
  }
  function initGrass() {
    const cols = K.ISLANDS.flatMap((I) => I.cols.grass), rng = mulberry32(4242), MAX = 4, n = cols.length * MAX;
    const m = new THREE.MeshLambertMaterial({ color: 0xffffff });
    m.onBeforeCompile = (sh) => {
      const PU = W.uniforms;
      Object.assign(sh.uniforms, { uSway: PU.uSway, uSwayAmp: PU.uSwayAmp, uWalker: grassWalker, uGust: PU.uGust, uCloudTex: PU.uCloudTex, uCloudSh: PU.uCloudSh });
      sh.vertexShader = 'attribute float aH; varying float vH, vGu, vVD; varying vec3 vGW; uniform float uSway, uSwayAmp; uniform vec3 uWalker;\n' + W.GUST_GLSL + '\n' + sh.vertexShader.replace('#include <project_vertex>', `
        vec4 mvPosition = instanceMatrix * vec4(transformed, 1.0);
        float ph = uSway * 1.3 + mvPosition.x * 0.5 + mvPosition.z * 0.35;
        // a passing gust flattens the blades downwind and sets them tossing; the bent blades catch the light
        float gu = gustAt(mvPosition.xz);
        mvPosition.x += sin(ph) * aH * aH * 0.12 * uSwayAmp * (1.0 + 1.8 * gu) + aH * aH * 0.2 * gu * GUST_DIR.x;
        mvPosition.z += cos(ph * 0.8) * aH * aH * 0.07 * uSwayAmp * (1.0 + 1.8 * gu) + aH * aH * 0.2 * gu * GUST_DIR.y;
        vGu = gu; vGW = mvPosition.xyz;
        // blades lean away from the walker's feet
        vec2 away = mvPosition.xz - uWalker.xz; float near = 1.0 - smoothstep(0.15, 0.75, length(away));
        mvPosition.xz += normalize(away + 1e-4) * near * aH * 0.22 * step(abs(mvPosition.y - uWalker.y), 0.6);
        vH = aH;
        mvPosition = modelViewMatrix * mvPosition;
        vVD = -mvPosition.z;
        gl_Position = projectionMatrix * mvPosition;`);
      sh.fragmentShader = 'varying float vH, vGu, vVD; varying vec3 vGW;\n' + W.CLOUD_GLSL + '\n' + sh.fragmentShader
        .replace('#include <dithering_fragment>', '#include <dithering_fragment>\n gl_FragColor.a = vVD;')   // distance, for the post effects
        .replace('#include <color_fragment>', '#include <color_fragment>\n diffuseColor.rgb *= mix(0.72, 1.12, vH) * (1.0 + 0.16 * vGu * vH);')
        .replace('reflectedLight.directDiffuse *= BRDF_Diffuse_Lambert( diffuseColor.rgb ) * getShadowMask();', 'reflectedLight.directDiffuse *= BRDF_Diffuse_Lambert( diffuseColor.rgb ) * getShadowMask() * swCloudShade(vGW);');
    };
    m.__swDepth = true;
    grass = new THREE.InstancedMesh(bladeGeometry(), m, n);
    grass.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    grass.castShadow = false; grass.receiveShadow = true; grass.frustumCulled = false;
    gData = { x: new Float32Array(n), y: new Float32Array(n), z: new Float32Array(n), rot: new Float32Array(n), sc: new Float32Array(n), r: new Float32Array(n), hide: new Uint8Array(n) };
    // one blade tuft per block per pass, so lowering the density keeps every island covered
    for (let pass = 0, i = 0; pass < MAX; pass++) for (const [x, z, h] of cols) {
      gData.x[i] = x + (rng() - 0.5) * 0.95; gData.z[i] = z + (rng() - 0.5) * 0.95; gData.y[i] = h;
      gData.rot[i] = rng() * Math.PI * 2; gData.sc[i] = 0.22 + rng() * 0.22; gData.r[i] = rng();
      grass.setColorAt(i, tmpC.setRGB(1, 1, 1));
      i++;
    }
    grass.layers.set(2);   // drawn in the main view but left out of the sea's reflection
    W.scene.add(grass);
    GD.setGrassDensity(S.quality);
  }
  GD.setGrassDensity = function (q) {
    grassDensity = q === 'high' ? 4 : q === 'balanced' ? 2 : 0;
    if (!grass) return;
    grass.count = Math.floor(grass.instanceMatrix.count * grassDensity / 4);
    grass.visible = grassDensity > 0;
    grassS = -99; grassVer = -1; grassCursor = -1;
  };
  const gq = new THREE.Quaternion(), gUp = new THREE.Vector3(0, 1, 0), gPos = new THREE.Vector3(), gScale = new THREE.Vector3();
  // Re-tints and re-scales the blades a slice at a time, so a season change never stalls a frame.
  let grassCursor = -1, grassPassS = 0;
  function updateGrass() {
    if (!grass || !grass.visible) return;
    const verChanged = grassVer !== GD.version;
    if (verChanged) {
      grassVer = GD.version;
      const cells = new Map();
      for (const it of GD.items) {
        const r = CLEAR[it.k];
        if (!r) continue;
        for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) {
          const key = (Math.round(it.x) + dx) * 4096 + (Math.round(it.z) + dz);
          (cells.get(key) || cells.set(key, []).get(key)).push(it.x, it.z, r);
        }
      }
      const total = grass.instanceMatrix.count;
      for (let i = 0; i < total; i++) {
        const list = cells.get(Math.round(gData.x[i]) * 4096 + Math.round(gData.z[i]));
        let hide = 0;
        if (list) for (let j = 0; j < list.length && !hide; j += 3) if (Math.hypot(gData.x[i] - list[j], gData.z[i] - list[j + 1]) < list[j + 2]) hide = 1;
        gData.hide[i] = hide;
      }
    }
    if (grassCursor < 0) {
      if (!verChanged && Math.abs(S.season - grassS) <= 0.01) return;
      grassCursor = 0; grassPassS = S.season; grassS = S.season;
    } else if (verChanged) grassCursor = 0;
    const end = Math.min(grass.count, grassCursor + 2500), start = grassCursor;
    for (let i = start; i < end; i++) {
      const vis = gData.hide[i] ? 0 : U.seasonColor(GRASS_PAL, gData.r[i], grassPassS, tmpC);
      // here and there a wildflower among the blades, in spring and summer
      const fl = (gData.r[i] * 97.31) % 1, si = U.seasonIndex(grassPassS);
      if (fl < 0.07 && (si === 0 || si === 1 || K.WORLD.look.grassPal)) grass.setColorAt(i, tmpC.copy(SPECKS[((gData.r[i] * 7919) | 0) % SPECKS.length]));
      else grass.setColorAt(i, tmpC.multiplyScalar(0.88 + ((gData.r[i] * 13.7) % 1) * 0.24));
      const k = Math.max(gData.sc[i] * vis, 0.0001);
      gq.setFromAxisAngle(gUp, gData.rot[i]);
      M4.compose(gPos.set(gData.x[i], gData.y[i], gData.z[i]), gq, gScale.set(k * 2.2, k * (0.75 + gData.r[i] * 0.6) * 1.15, k * 2.2));
      grass.setMatrixAt(i, M4);
    }
    if (end > start) { W.queueUpload(grass.instanceMatrix, start, end - 1); W.queueUpload(grass.instanceColor, start, end - 1); }
    grassCursor = end >= grass.count ? -1 : end;
  }

  GD.init = function () {
    W = SW.world;
    const leafMat = W.voxelMat(0xffffff, { edges: 0.24, texel: 12, texAmt: 0.06, sway: true, trans: 0.55, wet: true, shininess: 18 });
    glowMat = W.patch(new THREE.MeshBasicMaterial({ color: 0xffffff }), { edges: 0.12, faceShade: 0 });
    woodG = makeGrower(60000, W.voxelMat(0xffffff, { edges: 0.2, texel: 12, texAmt: 0.07, wet: true }), true);
    leafG = makeGrower(150000, leafMat, true);
    glowG = makeGrower(8000, glowMat, false);
    scatter();
    initGrass();
    rebuildFeatures();
  };

  let swayPhase = 0;
  GD.update = function (t, dt) {
    const wind = S.weather.wind;
    swayPhase += dt * (0.6 + wind * 0.8);
    W.uniforms.uSway.value = S.reduceMotion ? 0 : swayPhase;
    W.uniforms.uSwayAmp.value = 0.6 + wind * 0.9;
    updateGrower(woodG, t); updateGrower(leafG, t); updateGrower(glowG, t);
    sweep(leafG, S.season, 2600);
    flush(leafG);
    glowMat.color.setScalar(0.75 + 1.5 * S.glow);
    if (featVersion !== GD.version) rebuildFeatures();
    updateGrass();
    if (SW.life && SW.life.walker) grassWalker.value.copy(SW.life.walker); else grassWalker.value.y = -99;
    lightTimer -= dt;
    if (lightTimer <= 0) {
      lightTimer = 0.5;
      const F = W.focus;
      const lights = GD.feat.light.filter((l) => t > l.ready - 2);
      // in Lantern Bay the nearest floating lanterns light the water around them after dusk
      if (W.waterLanterns && S.glow > 0.25) {
        const near = W.waterLanterns.filter((f) => f.x != null).sort((a, b) => Math.hypot(a.x - F.x, a.z - F.z) - Math.hypot(b.x - F.x, b.z - F.z)).slice(0, 3);
        for (const f of near) lights.push({ x: f.x, y: f.y + 0.45, z: f.z, color: 0xffb468, base: 0.9 * S.glow, distance: 7 });
      }
      W.setDynamicLights(lights.sort((a, b) => Math.hypot(a.x - F.x, a.z - F.z) - Math.hypot(b.x - F.x, b.z - F.z)));
    }
  };
  let lightTimer = 0;
  GD.capacity = () => ({ leaf: leafG.n / leafG.cap, wood: woodG.n / woodG.cap });

  // ------------------------------------------------------------------- bloom
  // How lovely your garden is. Everything you have planted or built counts: trees and big builds most.
  // Each more of the same kind counts a little less than the last, and every different kind adds a bonus,
  // so a varied garden blooms fastest. Nothing ever takes bloom away except tidying your own things.
  GD.bloomOf = (k) => {
    const d = CAT[k];
    if (!d) return 0;
    if (d.bloom != null) return d.bloom;
    if (k === 'grat') return 3;
    if (d.tree) return 6;
    if (d.cat === 'plants' || d.cat === 'water') return 2;
    return d.footprint || d.rad >= 1.4 ? 10 : 4;
  };
  GD.bloom = () => GD.bloomFor(GD.items);
  GD.bloomFor = function (items) {
    const counts = {};
    for (const it of items) if (it && !it.wild && CAT[it.k]) counts[it.k] = (counts[it.k] || 0) + 1;
    let total = 0;
    for (const k in counts) total += GD.bloomOf(k) * (1 - Math.pow(0.85, counts[k])) / 0.15 + 3;
    return Math.round(total);
  };
})(window.SW);
