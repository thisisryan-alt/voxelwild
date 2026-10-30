// Stillwater: everything that lives on and around the island, plus the small rituals
// (pebbles, skipping stones, sky lanterns, wishes) and particles.
(function (SW) {
  'use strict';
  const { K, U } = SW;
  const { clamp, smooth, mulberry32 } = U;
  const L = SW.life = {};
  const S = SW.S;
  const TAU = Math.PI * 2, rand = Math.random;
  let W, GD, scene;
  const tmpV = new THREE.Vector3(), tmpC = new THREE.Color();
  const creatures = [];
  const audio = (fn, ...args) => { const A = SW.audio; if (A && A[fn]) A[fn](...args); };

  // ------------------------------------------------------------------ models
  const mats = new Map();
  const mat = (c) => { if (!mats.has(c)) mats.set(c, new THREE.MeshLambertMaterial({ color: c })); return mats.get(c); };
  function part(parent, c, sx, sy, sz, x, y, z, shadow) {
    const m = new THREE.Mesh(W.boxGeo, typeof c === 'number' ? mat(c) : c);
    m.scale.set(sx, sy, sz); m.position.set(x, y, z); m.castShadow = !!shadow;
    parent.add(m);
    return m;
  }
  function pivot(parent, x, y, z) { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; }
  function root(c) { const g = new THREE.Group(); g.userData.creature = c; g.visible = false; scene.add(g); c.g = g; c.fade = 0; creatures.push(c); return g; }
  // Creatures appear and leave by growing and shrinking, never popping.
  function fadeTo(c, on, dt, rate = 1.2) {
    c.fade = clamp(c.fade + (on ? dt : -dt) * rate, 0, 1);
    const s = smooth(0, 1, c.fade);
    c.g.scale.setScalar(Math.max(0.0001, s));
    c.g.visible = c.fade > 0.001;
    return c.fade;
  }
  const yaw = (dx, dz) => Math.atan2(dx, dz);
  const turnTo = (cur, want, rate, dt) => cur + clamp(U.angDiff(cur, want), -rate * dt, rate * dt);
  const season = () => U.seasonIndex(S.season);
  // Most visitors gather around wherever you are looking.
  const nearFocus = (p, r = 24) => Math.hypot(p.x - W.focus.x, p.z - W.focus.z) < r;
  const pickNear = (list, x, z, r) => { const near = list.filter((p) => Math.hypot(p[0] - x, p[1] - z) < r); return near.length ? U.pick(rand, near) : null; };

  // --------------------------------------------------------------------- koi
  function shoreTarget(rng) {
    const a = rng() * TAU;
    let r = K.R * 0.8;
    while (r < 26 && W.heightAt(Math.cos(a) * r, Math.sin(a) * r) > -2) r += 0.5;
    r += rng() * 2.5;
    return [Math.cos(a) * r, Math.sin(a) * r];
  }
  function makeKoi(i) {
    const rng = mulberry32(31 + i), colors = [0xf08a4b, 0xf4efe6, 0xf3b04a, 0xe86f3c, 0xf6f1e4, 0xe8a060];
    const c = { see: 'koi', rng, a: rng() * TAU, hurry: 0, p: rng() * 10, retarget: 5 };
    const g = root(c), m = colors[i % colors.length];
    part(g, m, 0.3, 0.17, 0.62, 0, 0, 0); part(g, i % 2 ? 0xe0643a : m, 0.24, 0.15, 0.2, 0, 0, 0.38);
    if (i % 2 === 0) part(g, 0xe0643a, 0.31, 0.05, 0.22, 0, 0.07, 0.05);
    c.tail = pivot(g, 0, 0, -0.31); part(c.tail, m, 0.05, 0.2, 0.3, 0, 0, -0.15);
    const [x, z] = shoreTarget(rng); g.position.set(x, K.WL - 0.55, z); c.target = shoreTarget(rng);
    c.update = (dt, t) => {
      fadeTo(c, true, dt);
      const pos = g.position;
      c.retarget -= dt;
      const dx = c.target[0] - pos.x, dz = c.target[1] - pos.z;
      if (c.retarget <= 0 || dx * dx + dz * dz < 1) { c.target = shoreTarget(c.rng); c.retarget = 10 + c.rng() * 12; }
      let want = Math.atan2(dz, dx);
      if (W.heightAt(pos.x + Math.cos(c.a) * 1.6, pos.z + Math.sin(c.a) * 1.6) > -2) want = Math.atan2(pos.z, pos.x);
      else if (Math.hypot(pos.x, pos.z) > 25) want = Math.atan2(-pos.z, -pos.x);
      c.a = turnTo(c.a, want, 0.7 + c.hurry, dt);
      c.hurry = Math.max(0, c.hurry - dt * 0.12);
      const speed = 0.65 + c.hurry * 0.9;
      pos.x += Math.cos(c.a) * speed * dt; pos.z += Math.sin(c.a) * speed * dt;
      pos.y = K.WL - 0.55 + Math.sin(t * 0.5 + c.p) * 0.06;
      g.rotation.y = yaw(Math.cos(c.a), Math.sin(c.a));
      c.tail.rotation.y = Math.sin(t * (4 + speed * 3) + c.p) * 0.45;
      if (c.hurry > 0.3 && Math.hypot(dx, dz) < 1.2 && rand() < dt * 0.8) W.addRipple(pos.x + Math.cos(c.a) * 0.4, pos.z + Math.sin(c.a) * 0.4, 0.3);
    };
  }
  L.attractKoi = function (x, z) {
    if (W.heightAt(x, z) > -2) return;
    for (const c of creatures) {
      if (c.see !== 'koi' || Math.hypot(c.g.position.x - x, c.g.position.z - z) > 16) continue;
      c.target = [x, z]; c.retarget = 12; c.hurry = 0.8;
    }
  };
  function makeGoldfish(i) {
    const P = K.POND, c = { see: 'goldfish', a: i * Math.PI, p: i * 3.1, dir: i ? 1 : -1 };
    const g = root(c);
    part(g, 0xf3a03a, 0.16, 0.1, 0.32, 0, 0, 0); c.tail = pivot(g, 0, 0, -0.16); part(c.tail, 0xf6c06a, 0.03, 0.12, 0.16, 0, 0, -0.08);
    c.update = (dt, t) => {
      fadeTo(c, season() !== 3, dt);
      c.a += dt * 0.32 * c.dir;
      const r = 0.9 + Math.sin(t * 0.3 + c.p) * 0.3;
      g.position.set(P.x + Math.cos(c.a) * r, K.WL - 0.5, P.z + Math.sin(c.a) * r);
      g.rotation.y = yaw(-Math.sin(c.a) * c.dir, Math.cos(c.a) * c.dir);
      c.tail.rotation.y = Math.sin(t * 5 + c.p) * 0.5;
    };
  }

  // --------------------------------------------------------------- butterflies
  function makeButterfly(i) {
    const cols = [0xf6f2e6, 0xf2d35a, 0x8cc6ea, 0xf0a04a, 0xc9b2ec, 0xf4c1cf];
    const c = { see: 'butterfly', i, state: 'away', tgt: new THREE.Vector3(), timer: 0, p: rand() * 10 };
    const g = root(c), col = cols[i % cols.length];
    part(g, 0x3a3030, 0.03, 0.03, 0.13, 0, 0, 0);
    c.L = pivot(g, -0.015, 0, 0); c.R = pivot(g, 0.015, 0, 0);
    part(c.L, col, 0.13, 0.008, 0.1, -0.065, 0, 0.02); part(c.L, col, 0.09, 0.008, 0.07, -0.05, 0, -0.06);
    part(c.R, col, 0.13, 0.008, 0.1, 0.065, 0, 0.02); part(c.R, col, 0.09, 0.008, 0.07, 0.05, 0, -0.06);
    c.update = (dt, t) => {
      const nectar = GD.feat.nectar.filter((n) => t > n.ready && nearFocus(n));
      const want = Math.min(10, 2 + nectar.length);
      const si = season();
      const active = S.dayness > 0.6 && (si === 0 || si === 1 || (si === 2 && S.season % 1 < 0.4)) && S.weather.rain < 0.3 && S.weather.snow < 0.2 && c.i < want;
      const pos = g.position;
      if (c.state === 'away') {
        if (!active) { fadeTo(c, false, dt); return; }
        const a = rand() * TAU;
        pos.set(W.focus.x + Math.cos(a) * 22, 4, W.focus.z + Math.sin(a) * 22);
        c.state = 'fly'; c.pickTarget(nectar);
      }
      const away = Math.hypot(pos.x - W.focus.x, pos.z - W.focus.z);
      if (!active && c.state !== 'leave') { c.state = 'leave'; c.tgt.set(W.focus.x + (pos.x - W.focus.x) * 3, 8, W.focus.z + (pos.z - W.focus.z) * 3); }
      fadeTo(c, c.state !== 'leave' || away < 30, dt);
      if (c.state === 'rest') {
        c.timer -= dt;
        const open = 0.3 + 0.5 * Math.max(0, Math.sin(t * 1.6 + c.p));
        c.L.rotation.z = open; c.R.rotation.z = -open;
        if (c.timer <= 0) { c.state = 'fly'; c.pickTarget(nectar); }
        return;
      }
      tmpV.copy(c.tgt).sub(pos);
      const d = tmpV.length();
      if ((c.state === 'leave' && (d < 1 || away > 30)) || away > 60) { c.state = 'away'; c.fade = 0; g.visible = false; return; }
      if (c.state === 'fly' && d < 0.12) { c.state = 'rest'; c.timer = 3 + rand() * 6; g.rotation.x = 0; return; }
      tmpV.normalize().multiplyScalar(Math.min(d * 2 + 0.3, 1.2) * dt);
      pos.add(tmpV);
      pos.x += Math.sin(t * 2.3 + c.p) * 0.35 * dt; pos.y += Math.sin(t * 5 + c.p) * 0.4 * dt;
      g.rotation.y = yaw(c.tgt.x - pos.x, c.tgt.z - pos.z);
      const flap = Math.sin(t * 22 + c.p) * 0.9 + 0.2;
      c.L.rotation.z = flap; c.R.rotation.z = -flap;
    };
    c.pickTarget = (nectar) => {
      const n = nectar.length ? U.pick(rand, nectar) : null;
      if (n && rand() < 0.75) c.tgt.set(n.x + (rand() - 0.5) * 0.15, n.y + 0.05, n.z + (rand() - 0.5) * 0.15);
      else { const p = U.pick(rand, W.local.grass.length ? W.local.grass : W.cols.grass); c.tgt.set(p[0], p[2] + 0.8 + rand() * 1.2, p[1]); c.wander = true; }
      if (!n) c.tgt.y += 0.4;
    };
  }

  // -------------------------------------------------------------------- gulls
  function makeGull(i) {
    const c = { see: 'gull', a: rand() * TAU, w: (0.08 + rand() * 0.05) * (i % 2 ? 1 : -1), r0: 18 + rand() * 12, p: rand() * 10, off: 120 };
    const g = root(c);
    part(g, 0xf4f4f0, 0.16, 0.14, 0.5, 0, 0, 0); part(g, 0xf4f4f0, 0.13, 0.13, 0.14, 0, 0.05, 0.28);
    part(g, 0xf2c04a, 0.04, 0.04, 0.1, 0, 0.04, 0.39); part(g, 0x9aa2aa, 0.12, 0.04, 0.14, 0, 0.02, -0.28);
    c.L = pivot(g, -0.08, 0.04, 0); c.R = pivot(g, 0.08, 0.04, 0);
    part(c.L, 0xe8eaec, 0.4, 0.03, 0.2, -0.2, 0, 0); part(c.L, 0x7a828a, 0.3, 0.03, 0.15, -0.55, 0, -0.02);
    part(c.R, 0xe8eaec, 0.4, 0.03, 0.2, 0.2, 0, 0); part(c.R, 0x7a828a, 0.3, 0.03, 0.15, 0.55, 0, -0.02);
    c.update = (dt, t) => {
      const active = S.dayness > 0.4 && S.weather.rain < 0.6 && S.weather.snow < 0.6;
      c.off += ((active ? 0 : 140) - c.off) * (1 - Math.exp(-dt / 20));
      fadeTo(c, c.off < 110, dt, 0.5);
      if (!c.g.visible) return;
      c.a += c.w * dt;
      const r = c.r0 + 4 * Math.sin(t * 0.05 + c.p) + c.off, cx = gullC.x + 5 * Math.sin(t * 0.01), cz = gullC.z + 5 * Math.cos(t * 0.013);
      g.position.set(cx + Math.cos(c.a) * r, 14 + 3 * Math.sin(t * 0.07 + c.p) + c.off * 0.1, cz + Math.sin(c.a) * r);
      g.rotation.set(0, yaw(-Math.sin(c.a) * Math.sign(c.w), Math.cos(c.a) * Math.sign(c.w)), -Math.sign(c.w) * 0.25);
      const flapping = Math.sin(t * 0.3 + c.p) > 0.55, wing = flapping ? Math.sin(t * 7 + c.p) * 0.6 : 0.12;
      c.L.rotation.z = wing; c.R.rotation.z = -wing;
      if (active && i === 0 && rand() < dt * 0.025) audio('gull', W.panOf(g.position));
    };
  }

  // ---------------------------------------------------------------- songbirds
  function makeSongbird(i) {
    const kinds = [[0x7a5a40, 0xe0773a], [0x5a8ac0, 0xf2d35a], [0x8a6a4a, 0xc84a3a], [0x6a6a5a, 0xe8e0c8]];
    const [body, breast] = kinds[i % kinds.length];
    const c = { see: 'songbird', i, state: 'away', from: new THREE.Vector3(), to: new THREE.Vector3(), k: 0, dur: 1, timer: 0, p: rand() * 10 };
    const g = root(c);
    part(g, body, 0.12, 0.1, 0.16, 0, 0.07, 0, true); part(g, breast, 0.1, 0.07, 0.06, 0, 0.06, 0.06);
    c.head = pivot(g, 0, 0.14, 0.06); part(c.head, body, 0.09, 0.08, 0.09, 0, 0, 0); part(c.head, 0x3a3030, 0.03, 0.03, 0.05, 0, -0.01, 0.06);
    part(g, body, 0.06, 0.03, 0.1, 0, 0.09, -0.11);
    c.L = pivot(g, -0.06, 0.09, 0); c.R = pivot(g, 0.06, 0.09, 0);
    part(c.L, body, 0.16, 0.02, 0.1, -0.08, 0, 0); part(c.R, body, 0.16, 0.02, 0.1, 0.08, 0, 0);
    const perches = () => {
      const F = GD.feat, list = F.perch.filter((p) => S.t > p.ready && nearFocus(p)).map((p) => [p.x, p.y, p.z]);
      for (const b of F.birdhouse) if (nearFocus(b)) list.push([b.x, b.y, b.z], [b.x, b.y, b.z]);
      for (const n of F.nectar) if (!n.water && nearFocus(n)) list.push([n.x + 0.2, W.heightAt(n.x + 0.2, n.z), n.z]);
      return list;
    };
    c.update = (dt, t) => {
      const F = GD.feat, homes = F.tree.filter((p) => nearFocus(p)).length + F.birdhouse.filter((p) => nearFocus(p)).length * 2;
      const active = S.dayness > 0.5 && S.weather.rain < 0.5 && c.i < Math.min(6, homes);
      const pos = g.position;
      if (c.state === 'away') {
        if (!active) { fadeTo(c, false, dt); return; }
        const list = perches(); if (!list.length) return;
        const a = rand() * TAU;
        pos.set(W.focus.x + Math.cos(a) * 25, 9, W.focus.z + Math.sin(a) * 25);
        c.flyTo(U.pick(rand, list));
      }
      if (!active && c.state !== 'leave') { const a = Math.atan2(pos.z - W.focus.z, pos.x - W.focus.x); c.flyTo([W.focus.x + Math.cos(a) * 30, 10, W.focus.z + Math.sin(a) * 30]); c.state = 'leave'; }
      fadeTo(c, true, dt);
      if (c.state === 'fly' || c.state === 'leave') {
        c.k += dt / c.dur;
        const k = Math.min(1, c.k);
        pos.lerpVectors(c.from, c.to, k);
        pos.y += Math.sin(Math.PI * k) * (0.8 + c.from.distanceTo(c.to) * 0.15);
        const flap = Math.sin(t * 30) * 0.9;
        c.L.rotation.z = flap; c.R.rotation.z = -flap;
        if (k >= 1) {
          if (c.state === 'leave') { c.state = 'away'; c.fade = 0; g.visible = false; return; }
          c.state = 'perch'; c.timer = 4 + rand() * 10; c.L.rotation.z = c.R.rotation.z = 0;
        }
        return;
      }
      c.timer -= dt;
      c.head.rotation.y = Math.sin(t * 1.3 + c.p) * 0.7 * (Math.sin(t * 0.4 + c.p) > 0 ? 1 : 0);
      c.head.rotation.x = Math.max(0, Math.sin(t * 2.2 + c.p * 3)) * 0.4;
      if (rand() < dt * 0.12) audio('bird', W.panOf(pos));
      if (c.timer <= 0) { const list = perches(); if (list.length) c.flyTo(U.pick(rand, list)); else c.timer = 3; }
    };
    c.flyTo = (p) => {
      c.from.copy(g.position); c.to.set(p[0], p[1], p[2]); c.k = 0;
      c.dur = Math.max(0.6, c.from.distanceTo(c.to) / 4);
      c.state = 'fly'; g.rotation.y = yaw(c.to.x - c.from.x, c.to.z - c.from.z);
    };
    c.tap = () => { const list = perches(); if (list.length) { c.flyTo(U.pick(rand, list)); audio('bird', W.panOf(g.position)); } };
  }

  // -------------------------------------------------------------------- ducks
  let ringR = null;
  function ringAt(a) {
    if (!ringR) {
      ringR = [];
      for (let i = 0; i < 72; i++) {
        const an = i / 72 * TAU;
        let r = 8;
        while (r < 26 && W.heightAt(Math.cos(an) * r, Math.sin(an) * r) > -1) r += 0.4;
        ringR.push(r + 1.2);
      }
    }
    const f = (((a / TAU) % 1) + 1) % 1 * 72, i = Math.floor(f), k = f - i;
    return ringR[i % 72] * (1 - k) + ringR[(i + 1) % 72] * k;
  }
  function makeDuck(i) {
    const baby = i >= 2, drake = i === 0;
    const c = { see: baby ? 'ducklings' : 'duck', i, baby, p: rand() * 10, a: 0.2 - i * 0.05, dip: 0 };
    const g = root(c), s = baby ? 0.5 : 1;
    const body = drake ? 0xc9c4b8 : baby ? 0xf2d36a : 0x8a6e52;
    part(g, body, 0.32 * s, 0.2 * s, 0.5 * s, 0, 0.08 * s, 0, true);
    part(g, drake ? 0x5a4a3a : body, 0.2 * s, 0.1 * s, 0.14 * s, 0, 0.16 * s, -0.24 * s);
    c.head = pivot(g, 0, 0.2 * s, 0.2 * s);
    part(c.head, drake ? 0x2f6b4a : baby ? 0xf6dc78 : 0x7a5e44, 0.18 * s, 0.18 * s, 0.18 * s, 0, 0.1 * s, 0.02 * s);
    part(c.head, 0xe8a030, 0.08 * s, 0.04 * s, 0.12 * s, 0, 0.08 * s, 0.15 * s);
    c.update = (dt, t) => {
      const si = season();
      fadeTo(c, !c.baby || si <= 1, dt, 0.6);
      const sleep = S.night > 0.7;
      if (c.i === 0) c.a += dt * (sleep ? 0.002 : 0.011);
      else {
        const lead = creatures.find((o) => o.see && (o.see === 'duck' || o.see === 'ducklings') && o.i === c.i - 1);
        if (lead) { const gap = c.baby ? 0.035 : 0.06; c.a += clamp((lead.a - gap) - c.a, -0.03, 0.03) * dt * 2; }
      }
      const r = ringAt(c.a) + Math.sin(t * 0.07 + c.p) * 0.6 + (c.i % 2) * 0.4;
      const x = Math.cos(c.a) * r, z = Math.sin(c.a) * r;
      g.position.set(x, W.waveY(x, z) - 0.03, z);
      g.rotation.y = yaw(-Math.sin(c.a), Math.cos(c.a));
      g.rotation.z = Math.sin(t * 1.1 + c.p) * 0.05;
      c.dip = Math.max(0, c.dip - dt);
      if (!sleep && rand() < dt * 0.03) c.dip = 1.2;
      c.head.rotation.x = c.dip > 0 ? Math.sin(Math.PI * c.dip / 1.2) * 1.3 : 0;
      c.head.rotation.y = sleep ? 2.6 : Math.sin(t * 0.5 + c.p) * 0.3;
    };
    c.tap = () => { audio('quack', W.panOf(g.position), c.baby); c.dip = 1.2; W.addRipple(g.position.x, g.position.z, 0.4); };
  }

  // -------------------------------------------------------------------- frogs
  function makeFrog(i) {
    const c = { see: 'frog', i, pad: null, from: new THREE.Vector3(), k: 1, throat: 0, p: rand() * 10 };
    const g = root(c);
    part(g, 0x5f9a4e, 0.17, 0.08, 0.18, 0, 0.05, 0, true);
    part(g, 0x6aa857, 0.13, 0.07, 0.08, 0, 0.08, 0.07);
    part(g, 0x2a2a20, 0.035, 0.035, 0.035, -0.045, 0.12, 0.08); part(g, 0x2a2a20, 0.035, 0.035, 0.035, 0.045, 0.12, 0.08);
    part(g, 0x4f8a44, 0.05, 0.04, 0.12, -0.09, 0.03, -0.05); part(g, 0x4f8a44, 0.05, 0.04, 0.12, 0.09, 0.03, -0.05);
    c.th = part(g, 0xd8e0a0, 0.08, 0.04, 0.05, 0, 0.04, 0.12);
    c.hop = () => {
      const pads = GD.feat.pad.filter((p) => S.t > p.ready && nearFocus(p, 30));
      if (!pads.length) return;
      const next = U.pick(rand, pads);
      c.from.copy(g.position); c.pad = next; c.k = 0;
      g.rotation.y = yaw(next.x - g.position.x, next.z - g.position.z);
    };
    c.update = (dt, t) => {
      const pads = GD.feat.pad.filter((p) => t > p.ready && nearFocus(p, 30));
      const lilies = new Set(pads.map((p) => p.rec)).size;
      const active = season() !== 3 && c.i < Math.min(4, lilies);
      fadeTo(c, active && !!c.pad, dt);
      if (!active) { c.pad = null; return; }
      if (!c.pad || !pads.includes(c.pad)) { c.pad = U.pick(rand, pads); c.k = 1; g.position.set(c.pad.x, c.pad.y, c.pad.z); }
      if (c.k < 1) {
        c.k = Math.min(1, c.k + dt / 0.6);
        g.position.lerpVectors(c.from, tmpV.set(c.pad.x, c.pad.y, c.pad.z), c.k);
        g.position.y += Math.sin(Math.PI * c.k) * 0.5;
        if (c.k >= 1) W.addRipple(c.pad.x, c.pad.z, 0.45);
      } else if (rand() < dt / 25) c.hop();
      const croaky = S.night > 0.3 || season() === 0;
      if (croaky && rand() < dt * 0.05) { c.throat = 0.5; audio('croak', W.panOf(g.position)); }
      c.throat = Math.max(0, c.throat - dt);
      c.th.scale.set(0.08 * (1 + c.throat * 1.4), 0.04 * (1 + c.throat * 1.4), 0.05);
    };
    c.tap = () => { c.hop(); c.throat = 0.5; audio('croak', W.panOf(g.position)); };
  }

  // ------------------------------------------------------------------ rabbits
  function makeRabbit(i) {
    const fur = [0xa89a88, 0x8a7a6a, 0xe8e4dc][i % 3];
    const c = { see: 'rabbit', i, state: 'idle', timer: 1 + rand() * 3, k: 1, hops: 0, from: new THREE.Vector3(), to: new THREE.Vector3(), p: rand() * 10, binky: 0 };
    const g = root(c);
    c.body = pivot(g, 0, 0, 0);
    part(c.body, fur, 0.24, 0.2, 0.32, 0, 0.12, 0, true);
    c.head = pivot(c.body, 0, 0.24, 0.15);
    part(c.head, fur, 0.17, 0.15, 0.16, 0, 0, 0.02);
    part(c.head, 0x2a2420, 0.03, 0.03, 0.03, -0.07, 0.02, 0.06); part(c.head, 0x2a2420, 0.03, 0.03, 0.03, 0.07, 0.02, 0.06);
    c.earL = pivot(c.head, -0.04, 0.07, -0.02); part(c.earL, fur, 0.04, 0.17, 0.06, 0, 0.08, 0);
    c.earR = pivot(c.head, 0.04, 0.07, -0.02); part(c.earR, fur, 0.04, 0.17, 0.06, 0, 0.08, 0);
    part(c.body, 0xf6f4ee, 0.08, 0.08, 0.06, 0, 0.16, -0.18);
    const spot = W.cols.grass[(i * 97) % W.cols.grass.length];
    g.position.set(spot[0], spot[2], spot[1]);
    c.update = (dt, t) => {
      const active = S.night < 0.6 && S.weather.rain < 0.6 && c.i < 3;
      if (!fadeTo(c, active, dt, 0.5)) return;
      const pos = g.position;
      c.cool = (c.cool || 0) - dt;
      if (L.walker && c.state !== 'hop' && c.cool <= 0 && pos.distanceTo(L.walker) < 2.2) {
        const a = Math.atan2(pos.x - L.walker.x, pos.z - L.walker.z);
        c.goal = [pos.x + Math.sin(a) * 3, pos.z + Math.cos(a) * 3]; c.hops = 5; c.cool = 3; c.nextHop();
      }
      if (c.state === 'hop') {
        c.k += dt / 0.38;
        const k = Math.min(1, c.k);
        pos.lerpVectors(c.from, c.to, k);
        pos.y += Math.sin(Math.PI * k) * (0.22 + c.binky * 0.4);
        c.body.rotation.x = -Math.sin(Math.PI * k) * 0.25;
        g.rotation.y += c.binky * dt * 6;
        if (k >= 1) {
          c.binky = 0;
          if (--c.hops > 0) c.nextHop(); else { c.state = rand() < 0.6 ? 'graze' : 'sit'; c.timer = 2 + rand() * 6; }
        }
        return;
      }
      c.timer -= dt;
      c.body.rotation.x = 0;
      c.head.rotation.x = c.state === 'graze' ? 0.6 + Math.sin(t * 6) * 0.05 : -0.1;
      c.earL.rotation.z = Math.max(0, Math.sin(t * 0.9 + c.p)) * 0.3;
      c.earR.rotation.z = -Math.max(0, Math.sin(t * 1.1 + c.p * 2)) * 0.3;
      if (c.timer <= 0) {
        const goal = pickNear(W.cols.grass, pos.x, pos.z, 5);
        if (goal && Math.hypot(goal[0] - K.POND.x, goal[1] - K.POND.z) > K.POND.r + 0.5) { c.goal = goal; c.hops = 3 + ((rand() * 5) | 0); c.nextHop(); }
        else c.timer = 1;
      }
    };
    c.nextHop = () => {
      const pos = g.position, gx = c.goal[0] - pos.x, gz = c.goal[1] - pos.z, d = Math.hypot(gx, gz);
      if (d < 0.3) { c.hops = 0; c.state = 'sit'; c.timer = 2; return; }
      const step = Math.min(0.45, d), nx = pos.x + gx / d * step, nz = pos.z + gz / d * step;
      if (!W.isGrass(nx, nz)) { c.hops = 0; c.state = 'sit'; c.timer = 1; return; }
      c.from.copy(pos); c.to.set(nx, W.heightAt(nx, nz), nz); c.k = 0; c.state = 'hop';
      g.rotation.y = yaw(gx, gz);
    };
    c.tap = () => { if (c.state !== 'hop') { c.goal = [g.position.x + (rand() - 0.5) * 3, g.position.z + (rand() - 0.5) * 3]; c.hops = 2; c.binky = 1; c.nextHop(); if (c.state !== 'hop') { c.from.copy(g.position); c.to.copy(g.position); c.k = 0; c.state = 'hop'; } } };
  }

  // -------------------------------------------------------------------- crabs
  function makeCrab(i, sand) {
    const c = { see: 'crab', i, timer: rand() * 3, dir: 1, moving: 0, p: rand() * 10 };
    const g = root(c);
    part(g, 0xd0604a, 0.2, 0.08, 0.14, 0, 0.06, 0, true);
    part(g, 0xe07058, 0.06, 0.05, 0.06, -0.13, 0.06, 0.07); part(g, 0xe07058, 0.06, 0.05, 0.06, 0.13, 0.06, 0.07);
    part(g, 0x2a2420, 0.025, 0.04, 0.025, -0.04, 0.12, 0.05); part(g, 0x2a2420, 0.025, 0.04, 0.025, 0.04, 0.12, 0.05);
    c.legs = pivot(g, 0, 0.03, 0);
    for (const s of [-1, 1]) for (let j = 0; j < 3; j++) part(c.legs, 0xb85040, 0.08, 0.02, 0.02, s * 0.13, 0, -0.04 + j * 0.04);
    const spot = sand[(i * 53 + 11) % sand.length];
    g.position.set(spot[0], spot[2], spot[1]);
    g.rotation.y = rand() * TAU;
    c.update = (dt, t) => {
      if (!fadeTo(c, season() !== 3 && S.weather.rain < 0.7, dt)) return;
      c.timer -= dt;
      if (L.walker && !c.moving && g.position.distanceTo(L.walker) < 1.6) c.tap();
      if (c.timer <= 0) { c.moving = c.moving ? 0 : 0.5 + rand(); c.timer = c.moving || 1 + rand() * 4; c.dir = rand() < 0.5 ? -1 : 1; }
      if (c.moving) {
        const sp = 0.6 * c.dir * dt, rx = Math.cos(g.rotation.y) * sp, rz = -Math.sin(g.rotation.y) * sp;
        const nx = g.position.x + rx, nz = g.position.z + rz, h = W.heightAt(nx, nz);
        if (h >= 0 && h <= 1 && !W.isGrass(nx, nz)) { g.position.x = nx; g.position.z = nz; g.position.y = h; }
        else { c.dir *= -1; g.rotation.y += 0.6; }
        c.legs.rotation.x = Math.sin(t * 30) * 0.3;
      }
    };
    c.tap = () => { c.moving = 1; c.timer = 1.2; c.dir = rand() < 0.5 ? -1 : 1; };
  }

  // -------------------------------------------------------------------- heron
  function makeHeron() {
    const c = { see: 'heron', state: 'away', spot: null, from: new THREE.Vector3(), to: new THREE.Vector3(), k: 0, timer: 0, strike: 0, p: rand() * 10 };
    const g = root(c), grey = 0x8a96a6;
    part(g, 0x3a3a3a, 0.03, 0.55, 0.03, -0.05, 0.27, 0); part(g, 0x3a3a3a, 0.03, 0.55, 0.03, 0.05, 0.27, 0);
    part(g, grey, 0.22, 0.24, 0.5, 0, 0.66, -0.05, true);
    c.neck = pivot(g, 0, 0.74, 0.16);
    part(c.neck, 0xd8dde2, 0.07, 0.4, 0.07, 0, 0.2, 0.02);
    c.headP = pivot(c.neck, 0, 0.4, 0.04);
    part(c.headP, 0xe8ecf0, 0.1, 0.1, 0.14, 0, 0, 0.02); part(c.headP, 0x2a2a2a, 0.11, 0.03, 0.06, 0, 0.04, -0.03);
    part(c.headP, 0xe2b440, 0.03, 0.03, 0.3, 0, -0.01, 0.2);
    c.L = pivot(g, -0.11, 0.72, 0); c.R = pivot(g, 0.11, 0.72, 0);
    part(c.L, grey, 0.6, 0.03, 0.34, -0.3, 0, 0); part(c.R, grey, 0.6, 0.03, 0.34, 0.3, 0, 0);
    c.L.visible = c.R.visible = false;
    c.update = (dt, t) => {
      const tod = S.tod, hours = tod < 0.22 || (tod > 0.5 && tod < 0.72);
      const shallows = W.local.shallow.length ? W.local.shallow : W.cols.shallow;
      const active = hours && S.weather.rain < 0.5 && shallows.length > 0;
      const pos = g.position;
      if (c.state === 'away') {
        fadeTo(c, false, dt);
        if (!active) return;
        const s = U.pick(rand, shallows), a = rand() * TAU;
        c.spot = s; pos.set(s[0] + Math.cos(a) * 40, 14, s[1] + Math.sin(a) * 40);
        c.from.copy(pos); c.to.set(s[0], s[2], s[1]); c.k = 0; c.state = 'arrive';
      }
      fadeTo(c, true, dt, 0.6);
      if (c.state === 'arrive' || c.state === 'leave') {
        c.k += dt / 9;
        const k = smooth(0, 1, Math.min(1, c.k));
        pos.lerpVectors(c.from, c.to, k);
        pos.y += Math.sin(Math.PI * k) * 3;
        g.rotation.y = yaw(c.to.x - c.from.x, c.to.z - c.from.z);
        c.L.visible = c.R.visible = k < 0.95;
        const flap = Math.sin(t * 4) * 0.4;
        c.L.rotation.z = flap; c.R.rotation.z = -flap;
        if (c.k >= 1) {
          if (c.state === 'leave') { c.state = 'away'; c.fade = 0; g.visible = false; return; }
          c.state = 'stand'; c.timer = 8; c.L.visible = c.R.visible = false;
        }
        return;
      }
      if (!active || Math.hypot(pos.x - W.focus.x, pos.z - W.focus.z) > 45) { const a = rand() * TAU; c.from.copy(pos); c.to.set(pos.x + Math.cos(a) * 45, 16, pos.z + Math.sin(a) * 45); c.k = 0; c.state = 'leave'; return; }
      c.timer -= dt;
      c.strike = Math.max(0, c.strike - dt);
      const s = c.strike > 0 ? Math.sin(Math.PI * c.strike / 0.8) : 0;
      c.neck.rotation.x = 0.15 + s * 1.3;
      c.headP.rotation.x = -s * 0.6;
      c.neck.rotation.y = Math.sin(t * 0.2 + c.p) * 0.3;
      if (c.strike > 0 && c.strike < 0.45 && !c.splashed) { c.splashed = true; W.addRipple(pos.x + Math.sin(g.rotation.y) * 0.8, pos.z + Math.cos(g.rotation.y) * 0.8, 0.6); audio('splash', W.panOf(pos), 0.5); }
      if (c.timer <= 0) {
        if (rand() < 0.5) { c.strike = 0.8; c.splashed = false; }
        else {
          const n = pickNear(shallows, pos.x, pos.z, 2.5);
          if (n) { g.rotation.y = yaw(n[0] - pos.x, n[1] - pos.z); pos.x += (n[0] - pos.x) * 0.3; pos.z += (n[1] - pos.z) * 0.3; }
        }
        c.timer = 12 + rand() * 20;
      }
    };
    c.tap = () => { c.strike = 0.8; c.splashed = false; };
  }

  // ---------------------------------------------------------------- dragonflies
  function makeDragonfly(i) {
    const c = { see: 'dragonfly', i, pos: new THREE.Vector3(), tgt: new THREE.Vector3(), timer: 0, p: rand() * 10 };
    const g = root(c);
    part(g, [0x2a8a9a, 0x3a6ac0, 0xc04a3a][i % 3], 0.025, 0.025, 0.22, 0, 0, 0);
    const wing = new THREE.MeshLambertMaterial({ color: 0xf2f6f8, transparent: true, opacity: 0.55 });
    c.w = [];
    for (const z of [0.03, -0.02]) for (const s of [-1, 1]) c.w.push(part(g, wing, 0.13, 0.004, 0.035, s * 0.07, 0.01, z));
    c.update = (dt, t) => {
      const anchors = GD.feat.reed.concat(GD.feat.pad, GD.feat.reef).filter((p) => t > p.ready && nearFocus(p));
      const si = season();
      const active = S.dayness > 0.6 && (si === 1 || (si === 0 && S.season % 1 > 0.6)) && S.weather.rain < 0.3 && anchors.length > 0 && c.i < 3;
      if (!fadeTo(c, active, dt)) return;
      c.timer -= dt;
      if (c.timer <= 0 && anchors.length) {
        const a = U.pick(rand, anchors);
        c.tgt.set(a.x + (rand() - 0.5) * 2.5, Math.max(K.WL + 0.4, a.y) + 0.3 + rand() * 0.8, a.z + (rand() - 0.5) * 2.5);
        c.timer = 1 + rand() * 2.5;
        if (!c.placed) { g.position.copy(c.tgt); c.placed = true; }
      }
      const pos = g.position, d = tmpV.copy(c.tgt).sub(pos), len = d.length();
      if (len > 0.05) { pos.addScaledVector(d, Math.min(1, dt * 5)); g.rotation.y = yaw(d.x, d.z); }
      pos.y += Math.sin(t * 9 + c.p) * 0.002;
      c.w.forEach((w, j) => { w.rotation.z = Math.sin(t * 60 + j) * 0.4; });
    };
  }

  // ---------------------------------------------------------------------- owl
  function makeOwl() {
    const c = { see: 'owl', perch: null, blink: 0, p: rand() * 10, hoot: 10 };
    const g = root(c);
    part(g, 0x7a6248, 0.22, 0.3, 0.2, 0, 0.15, 0, true);
    c.head = pivot(g, 0, 0.32, 0);
    part(c.head, 0x7a6248, 0.22, 0.16, 0.19, 0, 0, 0);
    part(c.head, 0xb8a080, 0.18, 0.12, 0.02, 0, -0.01, 0.1);
    const eye = new THREE.MeshBasicMaterial({ color: 0xf2d060 });
    c.eyes = [part(c.head, eye, 0.05, 0.05, 0.02, -0.045, 0, 0.11), part(c.head, eye, 0.05, 0.05, 0.02, 0.045, 0, 0.11)];
    part(c.head, 0x5a4634, 0.04, 0.07, 0.04, -0.08, 0.1, 0); part(c.head, 0x5a4634, 0.04, 0.07, 0.04, 0.08, 0.1, 0);
    c.update = (dt, t) => {
      const perches = GD.feat.perch.filter((p) => p.tree && t > p.ready && nearFocus(p, 20));
      const active = S.night > 0.6 && S.weather.rain < 0.5;
      if (active && (!c.perch || !perches.includes(c.perch))) {
        c.perch = perches.sort((a, b) => b.y - a.y)[0] || { x: W.dock.pole.x, y: W.dock.pole.y + 0.08, z: W.dock.pole.z };
        g.position.set(c.perch.x, c.perch.y, c.perch.z);
        g.rotation.y = yaw(-c.perch.x, -c.perch.z);
      }
      if (!fadeTo(c, active && !!c.perch, dt, 0.5)) { if (!active) c.perch = null; return; }
      c.head.rotation.y = Math.sin(t * 0.25 + c.p) * 1.1;
      c.blink -= dt;
      if (c.blink < -3 - rand() * 4) c.blink = 0.18;
      c.eyes.forEach((e) => { e.scale.y = c.blink > 0 ? 0.01 : 0.05; });
      c.hoot -= dt;
      if (c.hoot <= 0) { audio('owl', W.panOf(g.position)); c.hoot = 18 + rand() * 30; }
    };
    c.tap = () => { c.hoot = 0; c.blink = 0.3; };
  }

  // ---------------------------------------------------------------------- cat
  function makeCat() {
    const c = { see: 'cat', purr: 0, p: rand() * 10 };
    const g = root(c), fur = 0xd98a4a, stripe = 0xb86a34;
    c.body = part(g, fur, 0.34, 0.16, 0.3, 0, 0.08, 0, true);
    part(g, stripe, 0.05, 0.165, 0.31, -0.08, 0.08, 0); part(g, stripe, 0.05, 0.165, 0.31, 0.06, 0.08, 0);
    c.head = pivot(g, 0.16, 0.08, 0.1);
    part(c.head, fur, 0.15, 0.13, 0.14, 0, 0.02, 0);
    part(c.head, fur, 0.04, 0.05, 0.04, -0.04, 0.1, -0.03); part(c.head, fur, 0.04, 0.05, 0.04, 0.04, 0.1, -0.03);
    c.eyes = [part(c.head, 0x3a4a2a, 0.03, 0.01, 0.01, -0.03, 0.03, 0.07), part(c.head, 0x3a4a2a, 0.03, 0.01, 0.01, 0.03, 0.03, 0.07)];
    part(g, fur, 0.3, 0.06, 0.06, -0.02, 0.04, 0.18); part(g, stripe, 0.08, 0.06, 0.06, 0.15, 0.04, 0.17);
    c.update = (dt, t) => {
      fadeTo(c, true, dt);
      const porch = GD.feat.porch && GD.feat.porch[0], rainy = S.weather.rain > 0.5 || S.weather.snow > 0.5;
      const spot = rainy && porch ? porch : W.dock.end;
      g.position.set(spot.x, spot.y, spot.z);
      g.rotation.y = porch && spot === porch ? porch.angle : -W.dock.angle + Math.PI / 2;
      // The cat breathes with the island.
      const b = S.breath.b;
      c.body.scale.y = 0.16 * (1 + 0.1 * b);
      c.purr = Math.max(0, c.purr - dt);
      c.cool = (c.cool || 0) - dt;
      if (L.walker && c.cool <= 0 && g.position.distanceTo(L.walker) < 1.4) { c.cool = 25; c.tap(); }
      c.head.rotation.x = c.purr > 0 ? -0.35 : 0.2;
      const open = c.purr > 0 ? (Math.sin(t * 0.8) > 0.6 ? 0.01 : 0.025) : 0.008;
      c.eyes.forEach((e) => { e.scale.y = open; });
    };
    c.tap = () => { c.purr = 5; audio('purr'); };
  }

  // -------------------------------------------------------------------- whale
  let spout;
  function makeWhale() {
    const c = { see: 'whale', state: 'wait', timer: 80, k: 0, a: 0, r: 50, p: 0 };
    const g = root(c), seg = [];
    for (let i = 0; i < 7; i++) {
      const w = i < 2 ? 1.0 : 1.15 - i * 0.12;
      seg.push(part(g, i === 0 ? 0x34404c : 0x3e4a58, w, 0.8 - i * 0.06, 1.0, 0, 0, -i * 0.95));
    }
    part(seg[3], 0x34404c, 0.1, 0.6, 0.5, 0, 0.6, 0);
    c.fluke = pivot(g, 0, 0, -6.6);
    part(c.fluke, 0x34404c, 2.6, 0.12, 0.7, 0, 0, -0.2);
    c.seg = seg;
    c.update = (dt, t) => {
      if (c.state === 'wait') {
        fadeTo(c, false, dt);
        c.timer -= dt;
        if (c.timer <= 0) {
          c.timer = 40;
          for (let tries = 0; tries < 40; tries++) {
            const a = rand() * TAU, r = 30 + rand() * 16, dir = rand() < 0.5 ? 1 : -1, cx = W.focus.x, cz = W.focus.z;
            let open = true;
            for (let k = -0.2; k <= 0.75 && open; k += 0.08) { const aa = a + dir * k; if (W.heightAt(cx + Math.cos(aa) * r, cz + Math.sin(aa) * r) > -5) open = false; }
            if (!open) continue;
            Object.assign(c, { state: 'swim', k: 0, a, r, dir, cx, cz, spouts: 0 });
            audio('whale', W.panOf(tmpV.set(cx + Math.cos(a) * r, 0, cz + Math.sin(a) * r)));
            break;
          }
        }
        return;
      }
      fadeTo(c, true, dt, 3);
      c.k += dt;
      c.a += c.dir * dt * 0.9 / c.r;
      const x = c.cx + Math.cos(c.a) * c.r, z = c.cz + Math.sin(c.a) * c.r;
      g.position.set(x, K.WL, z);
      g.rotation.y = yaw(-Math.sin(c.a) * c.dir, Math.cos(c.a) * c.dir);
      const cyc = c.k % 8, n = Math.floor(c.k / 8), last = n === 2;
      for (let i = 0; i < 7; i++) {
        const u = cyc / 6 - i * 0.07;
        const up = u > 0 && u < 1 ? Math.sin(Math.PI * u) : 0;
        c.seg[i].position.y = -1.6 + up * (2.0 + (last && i > 3 ? (i - 3) * 0.5 : 0));
      }
      const fu = cyc / 6 - 0.5;
      c.fluke.position.y = -1.6 + (fu > 0 && fu < 1 ? Math.sin(Math.PI * fu) : 0) * (last ? 3.6 : 1.4);
      c.fluke.rotation.x = last ? -Math.max(0, Math.sin(Math.PI * clamp(fu, 0, 1))) * 1.2 : 0;
      if (cyc > 0.5 && c.spouts <= n && n < 2) {
        c.spouts = n + 1;
        tmpV.set(Math.sin(g.rotation.y) * 0.3, 0, Math.cos(g.rotation.y) * 0.3).add(g.position);
        for (let j = 0; j < 45; j++) spout.emit({ x: tmpV.x, y: K.WL + 0.6, z: tmpV.z, vx: (rand() - 0.5) * 0.8, vy: 4 + rand() * 2.5, vz: (rand() - 0.5) * 0.8, grav: 3.2, life: 1.6 + rand() * 0.8, size: 2.5, size2: 6, alpha: 0.7, wind: 1.2 });
        W.addRipple(g.position.x, g.position.z, 1);
      }
      if (c.k > 24) { c.state = 'wait'; c.timer = 200 + rand() * 240; }
    };
  }

  // ----------------------------------------------------------------- sailboat
  function makeBoat() {
    const c = { see: 'sailboat', state: 'wait', timer: 20, k: 0, from: new THREE.Vector3(), to: new THREE.Vector3() };
    const g = root(c);
    part(g, 0xf2efe8, 1.2, 0.4, 3.4, 0, 0.1, 0, true); part(g, 0x8a6a4c, 1.25, 0.12, 3.5, 0, 0.32, 0);
    part(g, 0xf2efe8, 0.8, 0.3, 1.0, 0, 0.5, -0.6);
    part(g, 0x6a5040, 0.1, 5.2, 0.1, 0, 2.9, 0.4);
    for (let i = 0; i < 8; i++) { const w = (8 - i) * 0.32; part(g, 0xf4efe0, 0.06, 0.6, w, 0.06, 0.9 + i * 0.6, 0.35 - w / 2); }
    part(g, 0xb8453a, 0.04, 0.2, 0.4, 0, 5.5, 0.25);
    c.lamp = part(g, new THREE.MeshBasicMaterial({ color: 0xffd08a }), 0.18, 0.18, 0.18, 0, 4.4, 0.5);
    c.update = (dt, t) => {
      if (c.state === 'wait') {
        fadeTo(c, false, dt);
        c.timer -= dt;
        if (c.timer > 0) return;
        const a = rand() * TAU, b = a + Math.PI + (rand() - 0.5) * 1.2, r = 165 + rand() * 20;
        c.from.set(Math.cos(a) * r, 0, Math.sin(a) * r); c.to.set(Math.cos(b) * r, 0, Math.sin(b) * r);
        c.k = 0; c.state = 'sail'; c.dur = c.from.distanceTo(c.to) / 0.4;
      }
      c.k += dt / c.dur;
      fadeTo(c, c.k > 0.02 && c.k < 0.98, dt, 0.3);
      g.position.lerpVectors(c.from, c.to, c.k);
      g.position.y = W.waveY(g.position.x, g.position.z) - 0.1;
      g.rotation.set(Math.sin(t * 0.6) * 0.04, yaw(c.to.x - c.from.x, c.to.z - c.from.z), Math.sin(t * 0.45) * 0.06);
      c.lamp.visible = S.glow > 0.35;
      if (c.k >= 1) { c.state = 'wait'; c.timer = 60 + rand() * 160; }
    };
  }

  // ------------------------------------------------------------------- turtle
  function makeTurtle() {
    const c = { see: 'turtle', a: rand() * TAU, p: rand() * 10, surf: 0 };
    const g = root(c);
    part(g, 0x6a7a4a, 0.5, 0.16, 0.6, 0, 0, 0, true); part(g, 0x8a9a5a, 0.3, 0.05, 0.36, 0, 0.09, 0);
    part(g, 0x9aa070, 0.14, 0.1, 0.16, 0, 0, 0.36);
    c.fl = [[-0.28, 0.18], [0.28, 0.18], [-0.24, -0.22], [0.24, -0.22]].map(([x, z]) => { const pv = pivot(g, x, 0, z); part(pv, 0x8a9a5a, 0.2, 0.04, 0.12, Math.sign(x) * 0.08, 0, 0); return pv; });
    c.update = (dt, t) => {
      if (!fadeTo(c, season() !== 3, dt, 0.4)) return;
      c.a += dt * 0.018;
      const r = ringAt(c.a) + 3.5, x = Math.cos(c.a) * r, z = Math.sin(c.a) * r;
      const cyc = (t + c.p * 10) % 30, up = cyc > 24 ? Math.sin(Math.PI * (cyc - 24) / 6) : 0;
      g.position.set(x, K.WL - 0.85 + up * 0.62, z);
      g.rotation.y = yaw(-Math.sin(c.a), Math.cos(c.a));
      c.fl.forEach((f, j) => { f.rotation.y = Math.sin(t * 1.4 + j * 1.5) * 0.5; });
      if (up > 0.9 && c.surf < cyc - 1) { c.surf = cyc; W.addRipple(x, z, 0.5); }
      if (cyc < 1) c.surf = 0;
    };
  }

  // ---------------------------------------------------------------- leaping fish
  function makeLeaper() {
    const c = { see: 'leapfish', timer: 30, k: 1, from: new THREE.Vector3(), dir: 0 };
    const g = root(c);
    part(g, 0xc8d4dc, 0.07, 0.11, 0.28, 0, 0, 0); part(g, 0x9aa8b2, 0.02, 0.1, 0.1, 0, 0, -0.17);
    c.update = (dt) => {
      if (c.k >= 1) {
        fadeTo(c, false, dt, 4);
        c.timer -= dt;
        if (c.timer > 0 || S.night > 0.6 || !W.cols.ring.length) return;
        const p = U.pick(rand, W.cols.ring);
        c.from.set(p[0], K.WL, p[1]); c.dir = rand() * TAU; c.k = 0; c.timer = 25 + rand() * 40;
        W.addRipple(p[0], p[1], 0.5); audio('splash', W.panOf(c.from), 0.4);
      }
      g.visible = true; c.fade = 1; g.scale.setScalar(1);
      c.k = Math.min(1, c.k + dt / 0.9);
      const dx = Math.cos(c.dir), dz = Math.sin(c.dir);
      g.position.set(c.from.x + dx * 1.3 * c.k, K.WL + Math.sin(Math.PI * c.k) * 0.75, c.from.z + dz * 1.3 * c.k);
      g.rotation.set(-Math.cos(Math.PI * c.k) * 0.9, yaw(dx, dz), 0, 'YXZ');
      if (c.k >= 1) { W.addRipple(g.position.x, g.position.z, 0.6); audio('splash', W.panOf(g.position), 0.6); splash(g.position.x, g.position.z, 10); g.visible = false; }
    };
  }

  // ------------------------------------------------- grazers: sheep and deer
  function makeGrazer(i, kind) {
    const fox = kind === 'fox', sheep = kind === 'sheep', stag = kind === 'deer' && i === 0;
    const I = K.ISLAND[sheep ? 'meadow' : fox ? 'glacier' : 'pine'];
    const cols = fox ? I.cols.rock : I.cols.grass, canWalk = fox ? (x, z) => W.heightAt(x, z) >= 0 && !W.isGrass(x, z) : W.isGrass;
    const c = { see: kind, i, state: 'graze', timer: rand() * 4, speed: 0, goal: null, p: rand() * 10, look: 0, cool: 0 };
    const g = root(c), coat = sheep ? 0xf2efe6 : fox ? 0xf2f4f6 : 0x9a6a44, dark = sheep ? 0x2a2624 : fox ? 0xd2d9de : 0x7a5434;
    const legH = sheep ? 0.28 : fox ? 0.2 : 0.5, bodyY = legH + (sheep ? 0.2 : fox ? 0.1 : 0.16);
    part(g, coat, sheep ? 0.5 : fox ? 0.22 : 0.36, sheep ? 0.4 : fox ? 0.2 : 0.32, sheep ? 0.66 : fox ? 0.46 : 0.72, 0, bodyY, 0, true);
    c.legs = [[-1, 1], [1, 1], [-1, -1], [1, -1]].map(([sx, sz]) => { const pv = pivot(g, sx * (sheep ? 0.15 : fox ? 0.07 : 0.12), legH, sz * (fox ? 0.16 : 0.24)); part(pv, dark, 0.07, legH, 0.07, 0, -legH / 2, 0); return pv; });
    c.head = pivot(g, 0, bodyY + (sheep ? 0.08 : fox ? 0.08 : 0.22), fox ? 0.26 : 0.36);
    part(c.head, fox ? coat : dark, sheep ? 0.18 : 0.14, sheep ? 0.2 : 0.16, sheep ? 0.22 : 0.26, 0, 0, 0.08);
    if (sheep) part(c.head, coat, 0.2, 0.08, 0.14, 0, 0.11, 0.02);
    else if (fox) { part(c.head, 0x2a2a2a, 0.04, 0.04, 0.03, 0, -0.01, 0.22); for (const sx of [-1, 1]) part(c.head, coat, 0.05, 0.08, 0.04, sx * 0.05, 0.11, 0.02); part(g, coat, 0.13, 0.13, 0.32, 0, bodyY + 0.02, -0.36); }
    else { part(g, coat, 0.1, 0.32, 0.12, 0, bodyY + 0.14, 0.3); part(g, 0xf2ece0, 0.08, 0.1, 0.04, 0, bodyY + 0.06, -0.37); }
    if (stag) for (const sx of [-1, 1]) { part(c.head, 0xd8c8a8, 0.03, 0.22, 0.03, sx * 0.06, 0.18, 0); part(c.head, 0xd8c8a8, 0.1, 0.03, 0.03, sx * 0.1, 0.24, 0); part(c.head, 0xd8c8a8, 0.03, 0.12, 0.03, sx * 0.13, 0.3, 0); }
    const spot = cols[(i * 41 + 7) % cols.length];
    g.position.set(spot[0], spot[2], spot[1]);
    g.rotation.y = rand() * TAU;
    c.update = (dt, t) => {
      if (!fadeTo(c, cols.length > 0, dt, 0.5)) return;
      const pos = g.position;
      c.timer -= dt; c.cool -= dt;
      if (!sheep && L.walker && c.cool <= 0 && pos.distanceTo(L.walker) < (fox ? 3 : 4.5)) { c.cool = 4; c.tap(); }
      if (c.state === 'graze') {
        c.head.rotation.x = c.look > 0 ? -0.2 : 0.7 + Math.sin(t * 3 + c.p) * 0.05;
        c.legs.forEach((l) => { l.rotation.x = 0; });
        if (c.timer <= 0) {
          const goal = pickNear(cols, pos.x, pos.z, 4);
          if (goal) { c.goal = goal; c.state = 'walk'; c.speed = sheep ? 0.3 : fox ? 0.6 : 0.4; }
          c.timer = 4 + rand() * 8;
        }
        if (sheep && rand() < dt * 0.012 && nearFocus(pos, 30)) audio('bleat', W.panOf(pos));
      } else {
        const dx = c.goal[0] - pos.x, dz = c.goal[1] - pos.z, d = Math.hypot(dx, dz);
        if (d < 0.2) { c.state = 'graze'; c.timer = 5 + rand() * 10; return; }
        g.rotation.y = turnTo(g.rotation.y, yaw(dx, dz), 2.5, dt);
        const nx = pos.x + Math.sin(g.rotation.y) * c.speed * dt, nz = pos.z + Math.cos(g.rotation.y) * c.speed * dt;
        if (!canWalk(nx, nz)) { c.state = 'graze'; c.timer = 2; return; }
        const gh = W.heightAt(nx, nz);
        pos.x = nx; pos.z = nz; pos.y += (gh - pos.y) * Math.min(1, dt * 6);
        const sw = Math.sin(t * c.speed * 22) * 0.5;
        c.legs.forEach((l, j) => { l.rotation.x = (j === 0 || j === 3 ? sw : -sw); });
        c.head.rotation.x = 0.1;
        if (c.speed > 1) pos.y += Math.abs(Math.sin(t * 10)) * 0.15;
      }
      c.look = Math.max(0, c.look - dt);
    };
    c.tap = () => {
      c.look = 3;
      if (sheep) { audio('bleat', W.panOf(g.position)); return; }
      const a = g.rotation.y + Math.PI + (rand() - 0.5);
      const away = L.walker ? Math.atan2(g.position.x - L.walker.x, g.position.z - L.walker.z) : a;
      const goal = pickNear(cols, g.position.x + Math.sin(away) * 4, g.position.z + Math.cos(away) * 4, 3);
      if (goal) { c.goal = goal; c.state = 'walk'; c.speed = 2.4; c.timer = 3; }
    };
  }

  // ----------------------------------------------------------- seals, puffins
  function makeSeal(i) {
    const I = K.ISLAND.rocks, c = { see: 'seal', i, state: 'bask', timer: 10 + rand() * 30, a: rand() * TAU, p: rand() * 10, from: new THREE.Vector3(), k: 1 };
    const g = root(c), grey = [0x8a8f94, 0x6f747a, 0x9a9488][i % 3];
    c.body = part(g, grey, 0.36, 0.26, 0.9, 0, 0.13, 0, true);
    c.head = pivot(g, 0, 0.2, 0.42);
    part(c.head, grey, 0.24, 0.22, 0.26, 0, 0.04, 0.08); part(c.head, 0x2a2a2a, 0.05, 0.04, 0.03, 0, 0.02, 0.22);
    part(g, grey, 0.4, 0.04, 0.16, 0, 0.04, 0.15); part(g, grey, 0.3, 0.05, 0.14, 0, 0.06, -0.48);
    const rocks = () => I.cols.rock.filter((r) => r[2] >= 1 && r[2] <= 3);
    const home = rocks()[(i * 7 + 3) % Math.max(1, rocks().length)] || [I.x, I.z, 1];
    c.rock = home; g.position.set(home[0], home[2], home[1]); g.rotation.y = rand() * TAU;
    c.update = (dt, t) => {
      if (!fadeTo(c, true, dt, 0.5)) return;
      const pos = g.position;
      c.timer -= dt;
      if (c.state === 'bask') {
        c.head.rotation.x = Math.sin(t * 0.3 + c.p) > 0.7 ? -0.6 : 0.15;
        c.body.scale.y = 0.26 * (1 + 0.05 * S.breath.b);
        if (rand() < dt * 0.01 && nearFocus(pos, 35)) audio('bark', W.panOf(pos));
        if (c.timer <= 0) { c.state = 'slide'; c.k = 0; c.from.copy(pos); c.a = Math.atan2(pos.z - I.z, pos.x - I.x); }
      } else if (c.state === 'slide' || c.state === 'haul') {
        c.k = Math.min(1, c.k + dt / 2.5);
        const tgt = c.state === 'slide' ? tmpV.set(I.x + Math.cos(c.a) * (I.r + 2), K.WL - 0.2, I.z + Math.sin(c.a) * (I.r + 2)) : tmpV.set(c.rock[0], c.rock[2], c.rock[1]);
        pos.lerpVectors(c.from, tgt, smooth(0, 1, c.k));
        g.rotation.y = yaw(tgt.x - c.from.x, tgt.z - c.from.z);
        if (c.k >= 1) {
          if (c.state === 'slide') { c.state = 'swim'; c.timer = 20 + rand() * 30; W.addRipple(pos.x, pos.z, 0.7); audio('splash', W.panOf(pos), 0.6); }
          else { c.state = 'bask'; c.timer = 30 + rand() * 60; }
        }
      } else {
        c.a += dt * 0.12;
        const x = I.x + Math.cos(c.a) * (I.r + 2), z = I.z + Math.sin(c.a) * (I.r + 2);
        pos.set(x, W.waveY(x, z) - 0.2, z);
        g.rotation.y = yaw(-Math.sin(c.a), Math.cos(c.a));
        c.head.rotation.x = -0.3;
        if (c.timer <= 0) { const list = rocks(); c.rock = list.length ? U.pick(rand, list) : c.rock; c.state = 'haul'; c.k = 0; c.from.copy(pos); }
      }
    };
    c.tap = () => { c.head.rotation.x = -0.6; audio('bark', W.panOf(g.position)); };
  }
  function makePuffin(i) {
    const I = K.ISLAND.rocks, c = { see: 'puffin', i, state: 'stand', timer: 5 + rand() * 20, from: new THREE.Vector3(), to: new THREE.Vector3(), k: 0, p: rand() * 10 };
    const g = root(c);
    part(g, 0x222428, 0.13, 0.2, 0.13, 0, 0.12, 0); part(g, 0xf2f2ee, 0.1, 0.14, 0.04, 0, 0.11, 0.06);
    c.head = pivot(g, 0, 0.25, 0.01);
    part(c.head, 0x222428, 0.11, 0.1, 0.11, 0, 0, 0); part(c.head, 0xf2f2ee, 0.115, 0.06, 0.06, 0, -0.005, 0.03);
    part(c.head, 0xf08a3a, 0.04, 0.06, 0.07, 0, -0.01, 0.08);
    c.L = pivot(g, -0.07, 0.17, 0); c.R = pivot(g, 0.07, 0.17, 0);
    part(c.L, 0x222428, 0.16, 0.02, 0.09, -0.08, 0, 0); part(c.R, 0x222428, 0.16, 0.02, 0.09, 0.08, 0, 0);
    const rock = () => { const list = I.cols.rock.filter((r) => r[2] >= 1); return list.length ? U.pick(rand, list) : [I.x, I.z, 2]; };
    const r0 = rock();
    g.position.set(r0[0] + (rand() - 0.5) * 0.6, r0[2], r0[1] + (rand() - 0.5) * 0.6);
    c.update = (dt, t) => {
      if (!fadeTo(c, S.night < 0.7, dt, 0.5)) return;
      c.timer -= dt;
      if (c.state === 'stand' && L.walker && g.position.distanceTo(L.walker) < 2.5) c.timer = 0;
      if (c.state === 'stand') {
        c.head.rotation.y = Math.sin(t * 0.8 + c.p) * 0.8;
        c.L.rotation.z = c.R.rotation.z = 0;
        if (c.timer <= 0) { const r = rock(); c.from.copy(g.position); c.to.set(r[0] + (rand() - 0.5) * 0.6, r[2], r[1] + (rand() - 0.5) * 0.6); c.k = 0; c.state = 'fly'; c.loop = rand() * TAU; }
        return;
      }
      c.k = Math.min(1, c.k + dt / 6);
      const a = c.loop + c.k * TAU, rr = 5 * Math.sin(Math.PI * c.k);
      g.position.lerpVectors(c.from, c.to, c.k);
      g.position.x += Math.cos(a) * rr; g.position.z += Math.sin(a) * rr; g.position.y += Math.sin(Math.PI * c.k) * 4;
      g.rotation.y = yaw(-Math.sin(a), Math.cos(a));
      const flap = Math.sin(t * 34) * 0.9;
      c.L.rotation.z = flap; c.R.rotation.z = -flap;
      if (c.k >= 1) { c.state = 'stand'; c.timer = 10 + rand() * 30; }
    };
    c.tap = () => { c.timer = 0; };
  }

  // -------------------------------------------------------------- reef fish
  function makeSchool(i) {
    const I = K.ISLAND.atoll, c = { see: 'reeffish', i, a: rand() * TAU, p: rand() * 10, fish: [] };
    const g = root(c);
    const cols = [[0xf2d35a, 0x3a6ac0], [0x4aa8e8, 0xf2d35a], [0xf08a3a, 0xf6f2ea]][i % 3];
    for (let j = 0; j < 8; j++) {
      const f = pivot(g, 0, 0, 0);
      part(f, cols[0], 0.05, 0.1, 0.16, 0, 0, 0); part(f, cols[1], 0.055, 0.04, 0.04, 0, 0.01, 0.02); part(f, cols[0], 0.02, 0.07, 0.06, 0, 0, -0.1);
      c.fish.push({ f, ox: (rand() - 0.5) * 1.4, oz: (rand() - 0.5) * 1.4, oy: (rand() - 0.5) * 0.25, p: rand() * 10 });
    }
    c.update = (dt, t) => {
      if (!fadeTo(c, true, dt)) return;
      c.a += dt * 0.12 * (i % 2 ? 1 : -1);
      const r = I.r * 0.28 + Math.sin(t * 0.17 + c.p) * 0.8;
      g.position.set(I.x + Math.cos(c.a) * r, K.WL - 0.55, I.z + Math.sin(c.a) * r);
      const heading = yaw(-Math.sin(c.a) * (i % 2 ? 1 : -1), Math.cos(c.a) * (i % 2 ? 1 : -1));
      for (const o of c.fish) {
        o.f.position.set(o.ox + Math.sin(t * 0.9 + o.p) * 0.2, o.oy, o.oz + Math.cos(t * 0.7 + o.p) * 0.2);
        o.f.rotation.y = heading + Math.sin(t * 3 + o.p) * 0.25;
      }
    };
    c.tap = () => { for (const o of c.fish) { o.ox *= -1; o.oz *= -1; } };
  }

  // -------------------------------------------------------------- windmill sails
  const sails = new Map();
  let sailVersion = -1;
  function syncSails() {
    sailVersion = GD.version;
    const live = new Set(GD.feat.windmill || []);
    for (const [f, g] of sails) if (!live.has(f)) { scene.remove(g); sails.delete(f); }
    for (const f of live) {
      if (sails.has(f)) continue;
      const g = new THREE.Group();
      g.position.set(f.x, f.y, f.z);
      g.rotation.y = Math.atan2(Math.cos(f.angle), Math.sin(f.angle));
      const hub = new THREE.Group(); g.add(hub);
      part(hub, 0x5a4030, 0.2, 0.2, 0.3, 0, 0, 0);
      for (let b = 0; b < 4; b++) {
        const arm = pivot(hub, 0, 0, 0.12); arm.rotation.z = b * Math.PI / 2;
        part(arm, 0x6a4f3a, 0.08, 2.6, 0.06, 0, 1.35, 0, true);
        part(arm, 0xf2ece0, 0.5, 1.9, 0.03, 0.29, 1.6, 0, true);
      }
      g.userData.hub = hub;
      scene.add(g);
      sails.set(f, g);
    }
  }
  function updateSails(dt, t) {
    if (sailVersion !== GD.version) syncSails();
    const speed = 0.25 + S.weather.wind * 0.7;
    for (const [f, g] of sails) { g.visible = t > f.ready - 6; g.userData.hub.rotation.z += dt * speed; }
  }

  // ------------------------------------------------------------------ rowboat
  // A small rowboat waits at whichever island you are on, and rows you to the next.
  let boat, trip = null;
  function makeRowboat() {
    boat = new THREE.Group();
    const wood = 0x8a6a4c, dark = 0x6a4f3a;
    part(boat, dark, 0.8, 0.1, 2.0, 0, 0.05, 0, true);
    for (const sx of [-1, 1]) part(boat, wood, 0.08, 0.28, 2.0, sx * 0.42, 0.2, 0, true);
    part(boat, wood, 0.84, 0.28, 0.08, 0, 0.2, -1.0, true); part(boat, wood, 0.5, 0.28, 0.08, 0, 0.2, 1.02, true);
    part(boat, dark, 0.8, 0.06, 0.24, 0, 0.26, -0.1);
    const rower = pivot(boat, 0, 0.3, -0.1);
    part(rower, 0x5f7f9a, 0.32, 0.36, 0.22, 0, 0.18, 0, true);
    part(rower, 0xe8c8a8, 0.2, 0.2, 0.2, 0, 0.47, 0);
    part(rower, 0xd8b04a, 0.38, 0.04, 0.38, 0, 0.58, 0); part(rower, 0xd8b04a, 0.2, 0.1, 0.2, 0, 0.63, 0);
    boat.userData.rower = rower;
    boat.userData.oars = [-1, 1].map((sx) => {
      const pv = pivot(boat, sx * 0.46, 0.34, -0.1);
      part(pv, 0x9a7a5a, 1.5, 0.04, 0.04, sx * 0.62, 0, 0);
      part(pv, 0x9a7a5a, 0.3, 0.02, 0.12, sx * 1.3, 0, 0);
      return pv;
    });
    scene.add(boat);
    mooring();
  }
  function mooring() {
    const I = W.island, a = Math.atan2(I.out.y, I.out.x);
    boat.position.set(I.landing.x, K.WL, I.landing.z);
    boat.rotation.y = yaw(Math.cos(a + 1.2), Math.sin(a + 1.2));
  }
  function clearWater(ax, az, bx, bz) {
    const d = Math.hypot(bx - ax, bz - az), n = Math.ceil(d);
    for (let i = 0; i <= n; i++) { const k = i / n; if (W.heightAt(ax + (bx - ax) * k, az + (bz - az) * k) > -2) return false; }
    return true;
  }
  L.travel = function (toId) {
    const A = W.island, B = K.ISLAND[toId];
    if (!B || A === B || trip) return null;
    const p0 = A.landing, p1 = new THREE.Vector3(p0.x + A.out.x * 6, K.WL, p0.z + A.out.y * 6);
    const p3 = B.landing, p2 = new THREE.Vector3(p3.x + B.out.x * 6, K.WL, p3.z + B.out.y * 6);
    const pts = [p0.clone(), p1];
    if (!clearWater(p1.x, p1.z, p2.x, p2.z)) {
      const mx = (p1.x + p2.x) / 2, mz = (p1.z + p2.z) / 2, len = Math.hypot(p2.x - p1.x, p2.z - p1.z) || 1;
      const nx = -(p2.z - p1.z) / len, nz = (p2.x - p1.x) / len;
      for (const off of [18, -18, 30, -30, 45, -45, 60, -60]) {
        const qx = mx + nx * off, qz = mz + nz * off;
        if (clearWater(p1.x, p1.z, qx, qz) && clearWater(qx, qz, p2.x, p2.z)) { pts.push(new THREE.Vector3(qx, K.WL, qz)); break; }
      }
    }
    pts.push(p2, p3.clone());
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    trip = { curve, len: curve.getLength(), d: 0, from: A, to: B, last: 0, fwd: new THREE.Vector3(1, 0, 0) };
    return trip;
  };
  L.trip = () => trip;
  L.setRower = (v) => { boat.userData.rower.visible = v; };
  L.tapBoat = (raycaster) => !trip && raycaster.intersectObject(boat, true).length > 0;
  L.walker = null;   // the walking figure's position, when there is one
  L.throwPebble = function (from, tx, tz) {
    const m = new THREE.Mesh(W.boxGeo, stoneMat); m.scale.set(0.1, 0.07, 0.1); m.castShadow = true; scene.add(m);
    skips.push({ m, pts: [[from.x, from.y + 1.2, from.z], [tx, K.WL, tz]], seg: 0, k: 0 });
    setTimeout(() => L.attractKoi(tx, tz), 700);
    audio('whoosh');
  };

  // ------------------------------------------------------------------ otters
  function makeOtter(i) {
    const I = K.ISLAND.marsh, c = { see: 'otter', i, a: rand() * TAU, p: rand() * 10, dive: 0, center: null };
    const g = root(c);
    part(g, 0x6a4a34, 0.22, 0.12, 0.56, 0, 0, 0); part(g, 0xb89a7a, 0.16, 0.04, 0.34, 0, 0.07, 0.04);
    c.head = pivot(g, 0, 0.04, 0.32);
    part(c.head, 0x6a4a34, 0.16, 0.13, 0.14, 0, 0, 0.04); part(c.head, 0xd8c0a0, 0.1, 0.06, 0.04, 0, -0.01, 0.11);
    part(g, 0x5a3e2c, 0.05, 0.05, 0.22, 0, 0, -0.36);
    for (const sx of [-1, 1]) part(g, 0x5a3e2c, 0.05, 0.06, 0.05, sx * 0.06, 0.1, 0.16);
    const pools = () => I.cols.shallow.concat(I.cols.ring).filter((p) => Math.hypot(p[0] - I.x, p[1] - I.z) < I.r);
    c.update = (dt, t) => {
      if (!c.center) { const list = pools(); if (!list.length) return; const p = list[(i * 31 + 5) % list.length]; c.center = [p[0], p[1]]; }
      const was = c.dive;
      c.dive -= dt;
      if (was > 0 && c.dive <= 0) { const list = pools(); const p = U.pick(rand, list); c.center = [p[0], p[1]]; W.addRipple(p[0], p[1], 0.5); }
      if (!fadeTo(c, c.dive <= 0, dt, 1.5)) return;
      c.a += dt * 0.15;
      const x = c.center[0] + Math.cos(c.a) * 0.9, z = c.center[1] + Math.sin(c.a) * 0.9;
      g.position.set(x, W.waveY(x, z) - 0.02, z);
      g.rotation.set(0, yaw(-Math.sin(c.a), Math.cos(c.a)), Math.sin(t * 0.6 + c.p) * 0.08);
      c.head.rotation.y = Math.sin(t * 0.4 + c.p) * 0.5;
      if (L.walker && g.position.distanceTo(L.walker) < 2) c.tap();
    };
    c.tap = () => { if (c.dive > 0) return; c.dive = 3; W.addRipple(c.g.position.x, c.g.position.z, 0.6); audio('splash', W.panOf(c.g.position), 0.4); };
  }

  L.boat = () => boat;
  L.arriveNow = () => { if (trip) trip.d = trip.len; };
  function updateBoat(dt, t) {
    const oars = boat.userData.oars;
    if (!trip) {
      boat.position.y = W.waveY(boat.position.x, boat.position.z) - 0.05;
      boat.rotation.z = Math.sin(t * 0.7) * 0.04;
      oars.forEach((o, j) => { o.rotation.set(0, (j ? -1 : 1) * 0.9, (j ? 1 : -1) * -0.25); });
      return;
    }
    // one stroke every 2.5 seconds: the boat surges on the pull and glides on the recovery
    const ph = (t / 2.5) % 1, pull = ph < 0.45;
    const v = 2.6 * (1 + trip.len / 120) * (pull ? 1 + 0.5 * Math.sin(Math.PI * ph / 0.45) : 0.75);
    trip.d = Math.min(trip.len, trip.d + v * dt);
    const u = trip.d / trip.len, p = trip.curve.getPointAt(u), tan = trip.curve.getTangentAt(u);
    trip.fwd.set(tan.x, 0, tan.z).normalize();
    boat.position.set(p.x, W.waveY(p.x, p.z) - 0.05, p.z);
    boat.rotation.set(Math.sin(t * 0.9) * 0.03, yaw(tan.x, tan.z), Math.sin(t * 0.7) * 0.04);
    const sweep = pull ? -0.7 + 1.4 * (ph / 0.45) : 0.7 - 1.4 * ((ph - 0.45) / 0.55);
    oars.forEach((o, j) => { o.rotation.set(0, (j ? -1 : 1) * sweep, (j ? 1 : -1) * (pull ? 0.12 : -0.18)); });
    boat.userData.rower.rotation.x = pull ? -0.25 * Math.sin(Math.PI * ph / 0.45) : 0;
    if (ph < trip.last) {
      for (const sx of [-1, 1]) {
        const ox = boat.position.x + Math.cos(boat.rotation.y) * sx * 1.6, oz = boat.position.z - Math.sin(boat.rotation.y) * sx * 1.6;
        W.addRipple(ox, oz, 0.35);
      }
      audio('oar');
    }
    trip.last = ph;
    if (trip.d >= trip.len) {
      const to = trip.to;
      trip = null;
      W.setIsland(to.id);
      mooring();
      SW.emit('arrive', to.id);
    }
  }
  SW.on('island', () => { if (boat && !trip) mooring(); });

  // ---------------------------------------------------------------- particles
  let fireflies, ffData, fall, fallData, flames, puffs, sparkle;
  const FF = 150, FALL = 260;
  function initParticles() {
    fireflies = W.makePoints(FF, 'glow', true, 620);
    const rng = mulberry32(5);
    const meadows = K.ISLANDS.flatMap((I) => I.cols.grass);
    ffData = Array.from({ length: FF }, () => { const [x, z, h] = U.pick(rng, meadows); return { x, z, y: h + 0.6 + rng() * 2.2, p: rng() * 100, f: 0.4 + rng() * 0.7 }; });
    for (let i = 0; i < FF; i++) { fireflies.col[i * 3] = 1; fireflies.col[i * 3 + 1] = 0.93; fireflies.col[i * 3 + 2] = 0.62; }
    fall = W.makePoints(FALL, 'square', false, 95);
    fallData = Array.from({ length: FALL }, () => ({ on: false, x: 0, y: 0, z: 0, landed: 0, life: 0, s: rand() * 100 }));
    flames = W.makeEmitter(500, 'glow', true, 260);
    puffs = W.makeEmitter(500, 'soft', false, 300);
    sparkle = W.makeEmitter(300, 'glow', true, 240);
  }
  function splash(x, z, n) {
    for (let i = 0; i < n; i++) puffs.emit({ x, y: K.WL + 0.05, z, vx: (rand() - 0.5) * 1.2, vy: 1.2 + rand() * 1.5, vz: (rand() - 0.5) * 1.2, grav: 6, life: 0.6 + rand() * 0.3, size: 0.6, size2: 0.3, alpha: 0.8, r: 0.9, g: 0.95, b: 1 });
  }
  L.splash = splash;
  function updateParticles(dt, t) {
    const si = season(), glow = smooth(0.15, 0.75, S.night), density = [0.5, 1, 0.35, 0][si] * (1 - S.weather.rain);
    {
      const n = Math.floor(FF * density);
      for (let i = 0; i < FF; i++) {
        const f = ffData[i], s = t * 0.25 * f.f + f.p;
        fireflies.pos[i * 3] = f.x + Math.sin(s) * 1.3 + Math.sin(s * 2.3) * 0.4;
        fireflies.pos[i * 3 + 1] = f.y + Math.sin(s * 1.7) * 0.5;
        fireflies.pos[i * 3 + 2] = f.z + Math.cos(s * 0.9) * 1.3;
        fireflies.al[i] = i < n ? glow * (0.15 + 0.85 * Math.pow(0.5 + 0.5 * Math.sin(t * f.f * 1.6 + f.p * 7), 2)) : 0;
      }
      fireflies.dirty();
      if (glow > 0.5 && n > 10) SW.emit('seeIf', { id: 'fireflies', pos: tmpV.set(ffData[0].x, ffData[0].y, ffData[0].z) });
    }
    // Falling petals in spring and leaves in autumn
    {
      const sf = S.season % 1, rate = si === 0 && sf < 0.7 ? 0.25 : si === 2 ? 0.2 + sf * 0.6 : 0;
      if (rate > 0) {
        for (const src of GD.feat.leafSrc) {
          if (t < src.ready || rand() > dt * rate * 0.3) continue;
          if (si === 0 && src.pal !== 'cherry') continue;
          if (si === 2 && (src.pal === 'pine' || src.pal === 'palm')) continue;
          const slot = fallData.find((p) => !p.on);
          if (!slot) break;
          Object.assign(slot, { on: true, x: src.x + (rand() - 0.5) * 1.5, y: src.y - 0.2, z: src.z + (rand() - 0.5) * 1.5, landed: 0, life: 1 });
          SW.garden.colorOf(src.pal, tmpC);
          const i = fallData.indexOf(slot);
          fall.col[i * 3] = tmpC.r; fall.col[i * 3 + 1] = tmpC.g; fall.col[i * 3 + 2] = tmpC.b;
        }
      }
      const wind = S.weather.wind, b = S.breath.b;
      for (let i = 0; i < FALL; i++) {
        const p = fallData[i];
        if (!p.on) { fall.al[i] = 0; continue; }
        if (!p.landed) {
          p.x += (0.2 + wind * 0.5 + 0.22 * Math.sin(t * 0.6 + p.s)) * dt + Math.sin(t * 3 + p.s) * 0.006;
          p.z += 0.12 * Math.cos(t * 0.5 + p.s) * dt;
          p.y -= 0.3 * dt;
          const ground = Math.max(W.heightAt(p.x, p.z), K.WL);
          if (p.y <= ground + 0.04) { p.y = ground + 0.04; p.landed = ground <= K.WL ? 2 : 1; }
        } else {
          if (p.landed === 2) { p.x += 0.06 * dt; p.y = K.WL + 0.02 + (b - 0.5) * 0.035; }
          p.life -= dt / 8;
          if (p.life <= 0) p.on = false;
        }
        fall.pos[i * 3] = p.x; fall.pos[i * 3 + 1] = p.y; fall.pos[i * 3 + 2] = p.z;
        fall.al[i] = clamp(p.life, 0, 1) * 0.95;
      }
      fall.dirty();
    }
    // campfires and chimneys
    for (const f of GD.feat.fire) {
      if (t < f.ready - 2) continue;
      const n = rand() < dt * 30 ? 1 : 0;
      for (let j = 0; j < n + (rand() < dt * 30 ? 1 : 0); j++) {
        const hot = rand();
        flames.emit({ x: f.x + (rand() - 0.5) * 0.25, y: f.y - 0.1, z: f.z + (rand() - 0.5) * 0.25, vx: (rand() - 0.5) * 0.15, vy: 0.6 + rand() * 0.5, life: 0.5 + rand() * 0.5, size: 2.2, size2: 0.6, r: 1, g: 0.45 + hot * 0.4, b: 0.15 + hot * 0.15, alpha: 0.9, wind: 0.2 });
      }
      if (rand() < dt * 2) flames.emit({ x: f.x, y: f.y + 0.1, z: f.z, vx: (rand() - 0.5) * 0.5, vy: 1.2 + rand(), vz: (rand() - 0.5) * 0.5, life: 1.6, size: 0.5, size2: 0.2, r: 1, g: 0.7, b: 0.3, wind: 0.5 });
      if (rand() < dt * 3) puffs.emit({ x: f.x, y: f.y + 0.5, z: f.z, vy: 0.45, life: 5, size: 1.5, size2: 6, alpha: 0.18, r: 0.75, g: 0.75, b: 0.75, wind: 0.4 });
    }
    for (const f of GD.feat.smoke) {
      if (t < f.ready || rand() > dt * 2) continue;
      puffs.emit({ x: f.x, y: f.y, z: f.z, vx: 0.05, vy: 0.45 + rand() * 0.2, life: 6, size: 1.6, size2: 7, alpha: 0.28, r: 0.82, g: 0.82, b: 0.84, wind: 0.5 });
    }
    // gratitude flowers shed a slow glowing mote now and then at night
    if (glow > 0.4) for (const f of GD.feat.grat) {
      if (rand() > dt * 0.4) continue;
      sparkle.emit({ x: f.x + (rand() - 0.5) * 0.2, y: f.y + 0.15, z: f.z + (rand() - 0.5) * 0.2, vy: 0.25, vx: (rand() - 0.5) * 0.1, life: 4, size: 1.4, size2: 0.4, r: 1, g: 0.92, b: 0.7, alpha: 0.8 });
    }
    flames.update(dt); puffs.update(dt); sparkle.update(dt);
  }

  // ------------------------------------------------------------- sky lanterns
  let haloTex;
  const lanterns = [];
  function makeHaloTexture() {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 64;
    const ctx = cv.getContext('2d'), gr = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gr; ctx.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(cv);
  }
  L.releaseLantern = function () {
    const I = W.island, d = I.id === 'home' ? W.dock.end : I.shore;
    const g = new THREE.Group();
    const paper = new THREE.MeshBasicMaterial({ color: 0xffc070, transparent: true, opacity: 0.95 });
    const box = new THREE.Mesh(W.boxGeo, paper); box.scale.set(0.34, 0.44, 0.34); g.add(box);
    const rim = new THREE.Mesh(W.boxGeo, mat(0x6a4a30)); rim.scale.set(0.36, 0.04, 0.36); rim.position.y = -0.22; g.add(rim);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, color: 0xffa850, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    halo.scale.set(1.8, 1.8, 1); g.add(halo);
    g.position.set(d.x, d.y + 0.5, d.z);
    scene.add(g);
    lanterns.push({ g, paper, halo, vy: 0.15, p: rand() * 10, age: 0 });
    while (lanterns.length > 14) { const o = lanterns.shift(); scene.remove(o.g); }
  };
  function updateLanterns(dt, t) {
    const wind = S.weather.wind;
    for (let i = lanterns.length - 1; i >= 0; i--) {
      const o = lanterns[i], p = o.g.position;
      o.age += dt;
      o.vy = Math.min(0.85, o.vy + dt * 0.05);
      p.y += o.vy * dt;
      p.x += (0.25 + wind * 0.5) * dt * Math.min(1, o.age / 6) + Math.sin(t * 0.7 + o.p) * 0.08 * dt;
      p.z += 0.18 * dt * Math.min(1, o.age / 6) + Math.cos(t * 0.5 + o.p) * 0.08 * dt;
      o.g.rotation.y += dt * 0.2;
      const fl = 0.85 + 0.15 * Math.sin(t * 9 + o.p) * Math.sin(t * 5.3 + o.p);
      const far = 1 - smooth(45, 80, p.y);
      o.halo.material.opacity = (0.5 + 0.5 * S.glow) * fl * far;
      o.paper.opacity = 0.95 * far;
      if (far <= 0) { scene.remove(o.g); lanterns.splice(i, 1); }
    }
  }

  // ------------------------------------------------------------ stones and wishes
  const skips = [];
  let stoneMat;
  L.skipStone = function (tx, tz) {
    // throw from the nearest beach toward the tapped water
    const I = W.island;
    let sx = I.x + (tx - I.x) * 0.3, sz = I.z + (tz - I.z) * 0.3;
    const dir = Math.atan2(tz - I.z, tx - I.x);
    for (let r = Math.hypot(tx - I.x, tz - I.z); r > 1; r -= 0.5) { const x = I.x + Math.cos(dir) * r, z = I.z + Math.sin(dir) * r; if (W.heightAt(x, z) >= 0) { sx = x; sz = z; break; } }
    const dx = tx - sx, dz = tz - sz, d = Math.hypot(dx, dz) || 1, ux = dx / d, uz = dz / d;
    const pts = [[sx, W.heightAt(sx, sz) + 0.9, sz]];
    let x = tx, z = tz, hop = 1.6;
    pts.push([x, K.WL, z]);
    const n = 3 + ((rand() * 6) | 0);
    for (let i = 0; i < n; i++) { hop *= 0.78; x += ux * hop; z += uz * hop; if (W.heightAt(x, z) >= -0.5) break; pts.push([x, K.WL, z]); }
    const m = new THREE.Mesh(W.boxGeo, stoneMat); m.scale.set(0.16, 0.06, 0.12); m.castShadow = true; scene.add(m);
    skips.push({ m, pts, seg: 0, k: 0 });
    audio('whoosh');
  };
  function updateSkips(dt) {
    for (let i = skips.length - 1; i >= 0; i--) {
      const s = skips[i], a = s.pts[s.seg], b = s.pts[s.seg + 1];
      if (!b) { scene.remove(s.m); skips.splice(i, 1); continue; }
      const len = Math.hypot(b[0] - a[0], b[2] - a[2]), dur = s.seg === 0 ? 0.6 : 0.12 + len * 0.18;
      s.k += dt / dur;
      const k = Math.min(1, s.k);
      s.m.position.set(a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k + Math.sin(Math.PI * k) * (s.seg === 0 ? 0.6 : len * 0.12), a[2] + (b[2] - a[2]) * k);
      s.m.rotation.y += dt * 20;
      if (s.k >= 1) {
        s.seg++; s.k = 0;
        const last = s.seg === s.pts.length - 1;
        W.addRipple(b[0], b[2], last ? 0.9 : 0.5);
        audio(last ? 'plop' : 'tick', s.seg);
        splash(b[0], b[2], last ? 8 : 3);
        if (last) { scene.remove(s.m); skips.splice(i, 1); }
      }
    }
  }
  SW.on('wish', (dir) => {
    const c = W.camera.position;
    for (let i = 0; i < 40; i++) {
      const p = tmpV.copy(dir).multiplyScalar(26).add(c);
      sparkle.emit({ x: p.x, y: p.y, z: p.z, vx: (rand() - 0.5) * 3, vy: (rand() - 0.5) * 3, vz: (rand() - 0.5) * 3, drag: 1.5, life: 1.5 + rand(), size: 2, size2: 0.2, r: 1, g: 0.9 + rand() * 0.1, b: 0.6 + rand() * 0.4 });
    }
    audio('wish');
  });
  L.bloomSparkle = function (x, y, z) {
    for (let i = 0; i < 16; i++) sparkle.emit({ x, y: y + 0.3, z, vx: (rand() - 0.5) * 0.8, vy: 0.4 + rand() * 0.6, vz: (rand() - 0.5) * 0.8, drag: 1.2, life: 1.4 + rand(), size: 1.2, size2: 0.2, r: 1, g: 0.95, b: 0.75 });
  };

  // ------------------------------------------------------------------- public
  L.init = function () {
    W = SW.world; GD = SW.garden; scene = W.scene;
    stoneMat = mat(0x8e938f);
    haloTex = makeHaloTexture();
    initParticles();
    spout = W.makeEmitter(120, 'soft', false, 300);
    for (let i = 0; i < 6; i++) makeKoi(i);
    for (let i = 0; i < 2; i++) makeGoldfish(i);
    for (let i = 0; i < 10; i++) makeButterfly(i);
    for (let i = 0; i < 5; i++) makeGull(i);
    for (let i = 0; i < 6; i++) makeSongbird(i);
    for (let i = 0; i < 5; i++) makeDuck(i);
    for (let i = 0; i < 4; i++) makeFrog(i);
    for (let i = 0; i < 3; i++) makeRabbit(i);
    for (let i = 0; i < 3; i++) makeCrab(i, W.cols.sand);
    for (let i = 0; i < 3; i++) makeCrab(i + 3, K.ISLAND.atoll.cols.sand);
    for (let i = 0; i < 2; i++) makeCrab(i + 6, K.ISLAND.wreck.cols.sand);
    for (let i = 0; i < 3; i++) makeDragonfly(i);
    makeHeron(); makeOwl(); makeCat(); makeWhale(); makeBoat(); makeTurtle(); makeLeaper();
    for (let i = 0; i < 5; i++) makeGrazer(i, 'sheep');
    for (let i = 0; i < 3; i++) makeGrazer(i, 'deer');
    for (let i = 0; i < 3; i++) makeGrazer(i, 'fox');
    for (let i = 0; i < 3; i++) makeOtter(i);
    for (let i = 0; i < 4; i++) makeSeal(i);
    for (let i = 0; i < 6; i++) makePuffin(i);
    for (let i = 0; i < 3; i++) makeSchool(i);
    makeRowboat();
  };
  let seeTimer = 0;
  const gullC = new THREE.Vector3();
  L.update = function (dt, t) {
    gullC.lerp(W.focus, 1 - Math.exp(-dt / 25));
    for (const c of creatures) c.update(dt, t);
    updateSails(dt, t);
    updateBoat(dt, t);
    updateParticles(dt, t);
    spout.update(dt);
    updateLanterns(dt, t);
    updateSkips(dt);
    if (rand() < dt * 0.05) { const k = creatures.filter((c) => c.see === 'koi'); const p = U.pick(rand, k).g.position; W.addRipple(p.x, p.z, 0.35); }
    seeTimer -= dt;
    if (seeTimer <= 0) {
      seeTimer = 1;
      if (W.isOnScreen(W.arch, 140)) SW.emit('see', 'arch');
      for (const c of creatures) if (c.see && c.g.visible && c.fade > 0.6 && W.isOnScreen(c.g.position, c.see === 'whale' || c.see === 'sailboat' ? 160 : 70)) SW.emit('see', c.see);
    }
  };
  SW.on('seeIf', (o) => { if (W.isOnScreen(o.pos, 90)) SW.emit('see', o.id); });
  L.tapAt = function (raycaster) {
    const roots = creatures.filter((c) => c.tap && c.g.visible).map((c) => c.g);
    const hit = raycaster.intersectObjects(roots, true)[0];
    if (!hit) return null;
    let o = hit.object;
    while (o && !o.userData.creature) o = o.parent;
    if (!o) return null;
    o.userData.creature.tap();
    return o.userData.creature.see;
  };
  L.frogsAwake = () => creatures.some((c) => c.see === 'frog' && c.g.visible);
})(window.SW);
