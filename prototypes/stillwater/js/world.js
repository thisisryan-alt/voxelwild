// Stillwater: renderer, sky, time of day, weather, terrain, water and distant scenery.
(function (SW) {
  'use strict';
  const { K, U } = SW;
  const { clamp, smooth, lerp, mulberry32, fbm, hex } = U;
  const W = SW.world = {};
  const S = SW.S;

  let renderer, scene, camera, hemi, sun;
  const prU = { value: 1 };
  W.focus = new THREE.Vector3(0, 1.4, 0);   // where the camera is looking; shadows and weather follow it
  const tmpC = new THREE.Color(), tmpV = new THREE.Vector3(), WHITE = new THREE.Color(1, 1, 1);

  W.init = function () {
    const canvas = document.getElementById('scene');
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0xd5eaee, 70, 240);
    camera = new THREE.PerspectiveCamera(40, 1, 0.1, 2400);
    Object.assign(W, { renderer, scene, camera, canvas, boxGeo: new THREE.BoxGeometry(1, 1, 1) });
    initLights(); initSky(); initTerrain(); initWater(); initMountains(); initLighthouse();
    initClouds(); initDock(); initLandings(); initWeatherFx(); initShootingStar();
    W.setQuality(S.quality);
    window.addEventListener('resize', resize);
  };

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w / h < 0.8 ? 52 : 40;   // keep the island framed on tall phone screens
    camera.updateProjectionMatrix();
    W.portrait = w / h < 0.8;
  }
  W.resize = resize;

  W.setQuality = function (q) {
    S.quality = q;
    const pr = Math.min(window.devicePixelRatio || 1, q === 'high' ? 2 : q === 'balanced' ? 1.5 : 1);
    renderer.setPixelRatio(pr); prU.value = pr; W.pixelRatio = pr;
    const shadows = q !== 'low', size = q === 'high' ? 2048 : 1024;
    if (sun.shadow.mapSize.x !== size) {
      sun.shadow.mapSize.set(size, size);
      if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
    }
    if (renderer.shadowMap.enabled !== shadows) {
      renderer.shadowMap.enabled = shadows;
      scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { m.needsUpdate = true; }); });
    }
    resize();
  };

  W.isOnScreen = function (p, maxDist = 80) {
    if (camera.position.distanceTo(p) > maxDist) return false;
    tmpV.copy(p).project(camera);
    return tmpV.z < 1 && Math.abs(tmpV.x) < 0.95 && Math.abs(tmpV.y) < 0.95;
  };
  W.panOf = function (p) {
    tmpV.copy(p).applyMatrix4(camera.matrixWorldInverse);
    return clamp(tmpV.x / Math.max(4, Math.abs(tmpV.z)), -0.9, 0.9);
  };

  // ------------------------------------------------------------------ lights
  const lightPool = [];
  function initLights() {
    hemi = new THREE.HemisphereLight(0xdcecf7, 0x71805c, 0.6);
    sun = new THREE.DirectionalLight(0xffffff, 0.9);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 260 });
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.03;
    scene.add(hemi, sun, sun.target);
    // A fixed pool keeps the light count, and so the shaders, constant.
    for (let i = 0; i < 7; i++) {
      const light = new THREE.PointLight(0xffb36b, 0, 12, 1.5);
      light.position.set(0, -60, 0);
      scene.add(light);
      lightPool.push({ light, used: false, base: 1, flicker: 0, breath: false, seed: i * 7.3 });
    }
  }
  W.claimLight = function (x, y, z, o = {}) {
    const e = lightPool.find((l) => !l.used);
    if (!e) return null;
    Object.assign(e, { used: true, fixed: true, base: o.base || 1, flicker: o.flicker || 0, breath: !!o.breath });
    e.light.position.set(x, y, z);
    e.light.color.set(o.color || 0xffb36b);
    e.light.distance = o.distance || 12;
    return e;
  };
  // Pooled lights not claimed for good go to the light features nearest the camera.
  W.setDynamicLights = function (feats) {
    let j = 0;
    for (const e of lightPool) {
      if (e.fixed) continue;
      const f = feats[j++];
      if (!f) { e.used = false; e.light.intensity = 0; e.light.position.y = -60; continue; }
      Object.assign(e, { used: true, base: f.base || 1, flicker: f.flicker || 0, breath: false });
      e.light.position.set(f.x, f.y, f.z); e.light.color.set(f.color || 0xffb36b); e.light.distance = f.distance || 12;
    }
  };
  W.releaseLight = function (e) { if (!e) return; e.used = false; e.light.intensity = 0; e.light.position.y = -60; };
  function updateLights(t) {
    const b = S.breath.b;
    for (const e of lightPool) {
      if (!e.used) continue;
      let k = e.base * (e.flicker ? 0.5 + 1.2 * S.glow : 0.15 + 1.5 * S.glow);
      if (e.breath) k *= 0.45 + 1.1 * b;
      if (e.flicker) k *= 0.82 + 0.18 * Math.sin(t * 13 + e.seed) * Math.sin(t * 7.1 + e.seed * 2);
      e.light.intensity = k;
    }
  }

  // --------------------------------------------------------------------- sky
  let sky;
  const skyU = {
    uTop: { value: new THREE.Color() }, uHor: { value: new THREE.Color() },
    uSunCol: { value: new THREE.Color() }, uSunDir: { value: new THREE.Vector3(0, 1, 0) },
    uMoonDir: { value: new THREE.Vector3(0, 1, 0) }, uMoonPhase: { value: 0.5 },
    uNight: { value: 0 }, uTime: { value: 0 }, uOvercast: { value: 0 },
    uAurora: { value: 0 }, uRainbow: { value: 0 }, uAurDir: { value: new THREE.Vector2(0, 1) },
  };
  function initSky() {
    sky = new THREE.Mesh(new THREE.SphereGeometry(950, 40, 20), new THREE.ShaderMaterial({
      uniforms: skyU, side: THREE.BackSide, depthWrite: false,
      vertexShader: `varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `
        uniform vec3 uTop, uHor, uSunCol, uSunDir, uMoonDir;
        uniform float uNight, uTime, uOvercast, uAurora, uRainbow, uMoonPhase;
        uniform vec2 uAurDir;
        varying vec3 vDir;
        float hash(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
        float h21(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
        float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
        void main(){
          vec3 d = normalize(vDir); float h = d.y;
          vec3 col = mix(uHor, uTop, pow(clamp(h, 0.0, 1.0), 0.55));
          vec3 sd = normalize(uSunDir);
          float s = max(dot(d, sd), 0.0), sunUp = smoothstep(-0.08, 0.02, sd.y);
          col += uSunCol * (pow(s, 900.0) * 1.1 * (1.0 - uOvercast) + pow(s, 28.0) * 0.2 * (1.0 - uOvercast * 0.7) + pow(s, 5.0) * 0.07) * sunUp;
          float starVis = uNight * (1.0 - uOvercast) * smoothstep(0.02, 0.3, h);
          if (starVis > 0.01) {
            float band = 1.0 - smoothstep(0.0, 0.32, abs(dot(d, normalize(vec3(0.5, 0.35, -0.8)))));
            vec3 c = floor(d * 170.0); float r = hash(c);
            if (r > 0.9962 - band * 0.004) { float tw = 0.55 + 0.45 * sin(uTime * (0.6 + r * 2.0) + r * 60.0); col += vec3(0.9, 0.94, 1.0) * starVis * tw; }
            float mw = n2(d.xz * 7.0 + d.y * 3.0) * n2(d.zy * 13.0 + 3.0);
            col += vec3(0.5, 0.56, 0.8) * band * mw * 0.2 * starVis;
          }
          if (uAurora > 0.01 && h > 0.0) {
            vec2 p = vec2(dot(d.xz, vec2(-uAurDir.y, uAurDir.x)), -dot(d.xz, uAurDir)) / (h + 0.2);
            float a = 0.0;
            for (int i = 0; i < 3; i++) {
              float fi = float(i);
              float w = n2(vec2(p.x * 0.45 + uTime * 0.03 + fi * 7.0, fi * 3.0 + uTime * 0.01));
              float y = p.y + 2.3 + fi * 0.45 + (w - 0.5) * 1.8;
              a += exp(-y * y * 5.0) * (0.55 + 0.45 * n2(vec2(p.x * 3.0 - uTime * 0.09, fi * 5.0)));
            }
            vec3 ac = mix(vec3(0.25, 0.95, 0.62), vec3(0.6, 0.38, 0.92), smoothstep(0.25, 0.65, h));
            col += ac * a * uAurora * 0.6 * smoothstep(0.03, 0.18, h) * (1.0 - uOvercast);
          }
          if (uRainbow > 0.01) {
            float ang = degrees(acos(clamp(dot(d, -sd), -1.0, 1.0)));
            float t = (ang - 40.4) / 2.4;
            if (t > 0.0 && t < 1.0) {
              float hue = 0.78 * (1.0 - t);
              vec3 rb = clamp(abs(fract(hue + vec3(0.0, 2.0 / 3.0, 1.0 / 3.0)) * 6.0 - 3.0) - 1.0, 0.0, 1.0);
              col += rb * 0.3 * uRainbow * sin(t * 3.14159) * smoothstep(-0.01, 0.12, h);
            }
          }
          vec3 md = normalize(uMoonDir);
          float mc = dot(d, md);
          if (mc > 0.99) {
            vec3 right = normalize(cross(md, vec3(0.0, 1.0, 0.0))), up = cross(right, md);
            vec2 q = vec2(dot(d, right), dot(d, up)) / 0.034;
            float rr = dot(q, q);
            float vis = smoothstep(-0.04, 0.04, md.y) * (1.0 - uOvercast * 0.85) * (0.3 + 0.7 * uNight);
            if (rr < 1.0) {
              vec3 n = vec3(q, sqrt(1.0 - rr));
              float ph = uMoonPhase * 6.28318;
              float lit = smoothstep(-0.05, 0.12, dot(n, vec3(sin(ph), 0.0, -cos(ph))));
              vec3 mcol = vec3(0.95, 0.93, 0.86) * (0.1 + 0.9 * lit) * (0.82 + 0.18 * n2(q * 4.0 + 7.0));
              col = mix(col, mcol, (1.0 - smoothstep(0.85, 1.0, rr)) * vis);
            }
          }
          float full = 1.0 - abs(uMoonPhase - 0.5) * 2.0;
          col += vec3(0.55, 0.65, 0.85) * pow(max(mc, 0.0), 300.0) * 0.35 * uNight * full * (1.0 - uOvercast) * smoothstep(-0.04, 0.04, md.y);
          gl_FragColor = vec4(col, 1.0);
        }`,
    }));
    sky.renderOrder = -10;
    scene.add(sky);
  }

  // Time-of-day palette. Night stays deep blue, never black.
  const KEYS = [
    [0.00, { top: 0x8aa3c8, hor: 0xf0c9aa, sun: 0xffcf9e, si: 0.6, hs: 0xd0d3e2, hg: 0x6a6a5a, hi: 0.5, night: 0.2 }],
    [0.10, { top: 0x79acd6, hor: 0xd7e7ec, sun: 0xfff0d8, si: 0.85, hs: 0xd8e9f5, hg: 0x6f7d5c, hi: 0.6, night: 0 }],
    [0.40, { top: 0x6aa5d4, hor: 0xd5eaee, sun: 0xfff6e6, si: 0.92, hs: 0xdcecf7, hg: 0x71805c, hi: 0.62, night: 0 }],
    [0.56, { top: 0x7894c2, hor: 0xf2c8a0, sun: 0xffc48a, si: 0.82, hs: 0xe8dccd, hg: 0x6f6f55, hi: 0.56, night: 0 }],
    [0.66, { top: 0x3f4f7e, hor: 0xd49c90, sun: 0xff9f7d, si: 0.42, hs: 0xa29fbc, hg: 0x4d4a48, hi: 0.48, night: 0.45 }],
    [0.76, { top: 0x15213f, hor: 0x2e4063, sun: 0xa4b8e8, si: 0.3, hs: 0x5d709c, hg: 0x2a2e38, hi: 0.4, night: 1 }],
    [0.92, { top: 0x17243f, hor: 0x35476b, sun: 0xa4b8e8, si: 0.3, hs: 0x5d709c, hg: 0x2a2e38, hi: 0.4, night: 1 }],
  ].map(([t, k]) => [t, { top: hex(k.top), hor: hex(k.hor), sun: hex(k.sun), si: k.si, hs: hex(k.hs), hg: hex(k.hg), hi: k.hi, night: k.night }]);
  KEYS.push([1.0, KEYS[0][1]]);
  const pal = { top: new THREE.Color(), hor: new THREE.Color(), sun: new THREE.Color(), si: 0, hs: new THREE.Color(), hg: new THREE.Color(), hi: 0, night: 0 };
  function samplePalette(tod) {
    let i = 0;
    while (i < KEYS.length - 2 && tod >= KEYS[i + 1][0]) i++;
    const [t0, a] = KEYS[i], [t1, b] = KEYS[i + 1];
    const k = smooth(0, 1, (tod - t0) / (t1 - t0));
    for (const c of ['top', 'hor', 'sun', 'hs', 'hg']) pal[c].copy(a[c]).lerp(b[c], k);
    pal.si = lerp(a.si, b.si, k); pal.hi = lerp(a.hi, b.hi, k); pal.night = lerp(a.night, b.night, k);
    return pal;
  }
  W.moonPhase = () => (((S.day + 3.2) / 8) % 1 + 1) % 1;   // eight-day cycle; 0.5 is full

  const sunDir = new THREE.Vector3(), skySun = new THREE.Vector3(), moonDir = new THREE.Vector3(), lightDir = new THREE.Vector3();
  function computeSunMoon(tod, night) {
    const st = clamp(tod / 0.7, 0, 1);
    const el = Math.sin(Math.PI * st) * 1.0 + 0.1, az = -1.3 + st * 2.6;
    sunDir.set(Math.cos(az) * Math.cos(el), Math.sin(el), Math.sin(az) * Math.cos(el));
    if (tod <= 0.7) skySun.copy(sunDir);
    else {
      const k = (tod - 0.7) / 0.3, el2 = 0.1 - Math.sin(Math.PI * k) * 0.9, az2 = 1.3 + k * (Math.PI * 2 - 2.6);
      skySun.set(Math.cos(az2) * Math.cos(el2), Math.sin(el2), Math.sin(az2) * Math.cos(el2));
    }
    const mt = clamp(((tod - 0.6 + 1) % 1) / 0.5, 0, 1);
    const mel = Math.sin(Math.PI * mt) * 0.95 - 0.08, maz = 2.4 - mt * 2.6;
    moonDir.set(Math.cos(maz) * Math.cos(mel), Math.sin(mel), Math.sin(maz) * Math.cos(mel));
    lightDir.copy(sunDir).lerp(moonDir, smooth(0.2, 0.9, night));
    lightDir.y = Math.max(lightDir.y, 0.2);
    return lightDir.normalize();
  }

  // ----------------------------------------------------------------- terrain
  const G = K.G, MINX = K.MINX;
  const heights = new Int8Array(G * G), grassy = new Uint8Array(G * G), rocky = new Uint8Array(G * G), owner = new Int8Array(G * G);
  // Stacks of rock that make up Seal Rocks, relative to its centre: [dx, dz, radius, height]
  const SEAL_STACKS = [[0, 0, 3.2, 3], [4, 2.5, 2, 2], [-3.5, 3, 2.2, 1.6], [2, -4, 2.4, 2.2], [-4, -3, 1.6, 1]];
  function islandHeight(I, x, z) {
    const dx = x - I.x, dz = z - I.z, r = Math.hypot(dx, dz);
    if (I.id !== 'home' && r > I.r * 2.2) return null;
    const ang = Math.atan2(dz, dx);
    if (I.id === 'home') {
      // unchanged from the single-island version, so saved gardens still fit
      const warp = 1 + (fbm(Math.cos(ang) * 1.8 + 5, Math.sin(ang) * 1.8 + 5, 3, 3) - 0.5) * 1.1;
      const d = r / (K.R * warp), base = 1 - d * d;
      return base > 0 ? base * 5.2 + (fbm(x * 0.11 + 20, z * 0.11 - 7, 11) - 0.5) * 3.4 * base + 0.4 : base * 4 + 0.4;
    }
    const seed = I.idx * 13 + 2;
    const warp = 1 + (fbm(Math.cos(ang) * 1.8 + seed, Math.sin(ang) * 1.8 + seed, 3, 3) - 0.5) * 0.9;
    const d = r / (I.r * warp), base = 1 - d * d, n = fbm(x * 0.11 + seed * 3, z * 0.11 - seed, 11) - 0.5;
    switch (I.id) {
      case 'pine': return base > 0 ? Math.pow(base, 0.8) * I.h + n * 3 * base + 0.4 : base * 4 + 0.4;
      case 'atoll': {
        // a ring of sand around a lagoon, cut by two channels
        const ring = 1 - Math.pow((d - 0.82) / 0.17, 2);
        const gap = Math.min(Math.abs(U.angDiff(ang, 2.6)), Math.abs(U.angDiff(ang, -0.9))) < 0.16;
        if (d < 0.82 && ring <= 0) return -1.6 + n * 1.2;
        if (ring > 0) return gap ? -1 : ring * 1.7 + n * 0.8 + 0.1;
        return base * 4 + 0.6;
      }
      case 'rocks': {
        let h = base * 2.5 - 2;
        for (const st of SEAL_STACKS) {
          const sd = Math.hypot(x - I.x - st[0], z - I.z - st[1]);
          if (sd < st[2]) h = Math.max(h, st[3] * (1 - (sd / st[2]) ** 2) + 0.5 + n * 0.6);
        }
        return h;
      }
      case 'wreck': {
        const c = Math.cos(0.6), sn = Math.sin(0.6), u = (dx * c + dz * sn) / (I.r * 1.5), v = (-dx * sn + dz * c) / (I.r * 0.6), e = 1 - u * u - v * v;
        return e > 0 ? e * 1.4 - 0.1 + n * 0.6 : e * 3 + 0.2;
      }
      default: return base > 0 ? base * I.h + n * 1.6 * base + 0.6 : base * 4 + 0.4;
    }
  }
  function rawHeight(x, z) {
    let best = -7, owner = -1;
    for (const I of K.ISLANDS) {
      const v = islandHeight(I, x, z);
      if (v != null && v > best) { best = v; owner = I.idx; }
    }
    let h = Math.round(best), rock = 0;
    const isl = K.ISLANDS[owner];
    if (isl && isl.id === 'home') {
      const P = K.POND, pd = Math.hypot(x - P.x, z - P.z);
      if (pd < P.r + 7) h = Math.min(h, 1 + Math.max(0, Math.floor((pd - P.r - 1.4) * 0.9)));
      if (pd < P.r) h = pd < P.r - 0.9 ? -2 : -1;
    }
    if (isl && (isl.id === 'rocks' || (isl.id === 'pine' && h >= 6))) rock = 1;
    const I = K.ISLET, id = Math.hypot(x - I.x, z - I.z) / I.r;
    if (id < 1.3) { const hi = Math.round((1 - id * id) * 3.4 + 0.2); if (hi > h) { h = hi; rock = 1; } }
    for (const s of K.STACKS) if (Math.hypot(x - s[0], z - s[1]) < s[2] && s[3] > h) { h = s[3]; rock = 1; }
    return [clamp(h, -7, 9), rock, owner];
  }
  const colH = (ix, iz) => (ix < 0 || iz < 0 || ix >= G || iz >= G) ? -7 : heights[ix * G + iz];
  W.heightAt = (x, z) => colH(Math.round(x - MINX), Math.round(z - MINX));
  W.colAt = (x, z) => {
    const ix = Math.round(x - MINX), iz = Math.round(z - MINX);
    if (ix < 0 || iz < 0 || ix >= G || iz >= G) return { ix, iz, h: -7, grassy: false, rock: false };
    const i = ix * G + iz;
    return { ix, iz, h: heights[i], grassy: !!grassy[i], rock: !!rocky[i] };
  };
  W.isGrass = (x, z) => { const ix = Math.round(x - MINX), iz = Math.round(z - MINX); return ix >= 0 && iz >= 0 && ix < G && iz < G && !!grassy[ix * G + iz]; };

  // Block kinds: 0 seabed, 1 sand, 2 grass, 3 dirt, 4 stone, 5 rock top
  const TPAL = {
    1: U.pal4([0xe6d6ab, 0xe0cfa2, 0xead9b0], [0xe6d6ab, 0xe0cfa2, 0xead9b0], [0xe2d1a6, 0xdccb9e], [0xe9e6da, 0xe2ddcf, 0xd9d2bf]),
    2: U.pal4([0xa3d073, 0x98c968, 0xadd67c, 0x92c463], [0x8fbc6e, 0x86b468, 0x97c275, 0x80ad64], [0xb3ad62, 0xa8a85c, 0xbfae64, 0x9fa35a], [0xeef3f5, 0xe4ebef, 0xf4f7f8, 0xdfe7ea]),
    5: U.pal4([0x8f948f, 0x9a9f9b, 0x86907f], [0x8f948f, 0x9a9f9b, 0x86907f], [0x8f948f, 0x9a9f9b, 0x8a8c80], [0xe8eef0, 0x9a9f9b, 0xdfe6ea]),
  };
  const TSTATIC = { 0: hex(0xbca87f), 3: hex(0x8d6f50), 4: hex(0x9a9f9b) };
  let terrain, tKind, tRand, tJit, lastTerrainS = -99;
  const terrainU = { uTime: { value: 0 }, uWL: { value: K.WL }, uCaus: { value: new THREE.Color() } };
  W.blocks = [];
  W.cols = { grass: [], sand: [], shallow: [], ring: [] };   // the home island's
  W.islands = K.ISLANDS;

  function initTerrain() {
    K.ISLANDS.forEach((I, idx) => { I.idx = idx; I.cols = { grass: [], sand: [], shallow: [], ring: [], rock: [] }; });
    for (let ix = 0; ix < G; ix++) for (let iz = 0; iz < G; iz++) {
      const x = ix + MINX, z = iz + MINX, [h, rock, own] = rawHeight(x, z), i = ix * G + iz;
      heights[i] = h; rocky[i] = rock; owner[i] = own;
      const kind = own >= 0 ? K.ISLANDS[own].id : '';
      const nearPond = Math.hypot(x - K.POND.x, z - K.POND.z) < K.POND.r + 3;
      const meadowy = kind === 'home' || kind === 'pine' ? h >= 2 || (h === 1 && (nearPond || fbm(x * 0.3, z * 0.3, 41, 2) > 0.42)) : kind === 'blossom' || kind === 'meadow' ? h >= 1 : false;
      grassy[i] = !rock && meadowy ? 1 : 0;
    }
    const blocks = W.blocks, rng = mulberry32(7);
    for (let ix = 0; ix < G; ix++) for (let iz = 0; iz < G; iz++) {
      const i = ix * G + iz, h = heights[i], x = ix + MINX, z = iz + MINX;
      if (h <= -5) continue;   // too deep to see through the water
      const minN = Math.min(colH(ix - 1, iz), colH(ix + 1, iz), colH(ix, iz - 1), colH(ix, iz + 1));
      for (let lv = Math.max(-7, Math.min(h, minN + 1)); lv <= h; lv++) {
        let kind;
        if (lv === h) kind = h <= -1 ? 0 : rocky[i] ? 5 : grassy[i] ? 2 : 1;
        else if (rocky[i]) kind = 4;
        else if (h <= 1) kind = h <= -1 ? 0 : 1;
        else kind = h - lv <= 1 ? 3 : 4;
        blocks.push([x, lv - 0.5, z, kind, ix, iz, lv]);
      }
      const r = Math.hypot(x, z), col = [x, z, h], isl = K.ISLANDS[owner[i]];
      if (r < 26) {
        if (grassy[i]) W.cols.grass.push(col);
        else if (!rocky[i] && h >= 0 && h <= 1) W.cols.sand.push(col);
        else if (h === -1) W.cols.shallow.push(col);
        else if (h <= -2 && h >= -3) W.cols.ring.push(col);
      }
      if (isl && isl.id !== 'home' && Math.hypot(x - isl.x, z - isl.z) < isl.r * 1.7) {
        const C = isl.cols;
        if (grassy[i]) C.grass.push(col);
        else if (rocky[i] && h >= 0) C.rock.push(col);
        else if (h >= 0 && h <= 2) C.sand.push(col);
        else if (h === -1) C.shallow.push(col);
        else if (h <= -2 && h >= -3) C.ring.push(col);
      }
    }
    Object.assign(K.ISLAND.home.cols, W.cols);
    W.local = W.island.cols;
    const mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, terrainU);
      sh.vertexShader = 'varying vec3 vWPos;\n' + sh.vertexShader.replace('#include <project_vertex>', `
        vec4 mvPosition = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          mvPosition = instanceMatrix * mvPosition;
        #endif
        vWPos = (modelMatrix * mvPosition).xyz;
        mvPosition = modelViewMatrix * mvPosition;
        gl_Position = projectionMatrix * mvPosition;`);
      sh.fragmentShader = 'varying vec3 vWPos;\nuniform float uTime, uWL;\nuniform vec3 uCaus;\n' + sh.fragmentShader.replace('#include <fog_fragment>', `
        if (vWPos.y < uWL - 0.02) {
          vec2 a = vWPos.xz * 0.9 + vec2(sin(uTime * 0.4 + vWPos.z * 0.6), cos(uTime * 0.33 + vWPos.x * 0.5)) * 0.6;
          float c = abs(sin(a.x * 2.1 + uTime * 0.7) + sin(a.y * 2.3 - uTime * 0.6) + sin((a.x + a.y) * 1.7 + uTime * 0.5));
          c = pow(clamp(1.0 - c * 0.45, 0.0, 1.0), 4.0);
          gl_FragColor.rgb += uCaus * c * (1.0 - clamp((uWL - vWPos.y) / 4.0, 0.0, 1.0));
        }
        #include <fog_fragment>`);
    };
    terrain = new THREE.InstancedMesh(W.boxGeo, mat, blocks.length);
    tKind = new Uint8Array(blocks.length); tRand = new Float32Array(blocks.length); tJit = new Float32Array(blocks.length);
    const m = new THREE.Matrix4();
    blocks.forEach((b, i) => {
      m.makeTranslation(b[0], b[1], b[2]); terrain.setMatrixAt(i, m);
      tKind[i] = b[3]; tRand[i] = rng(); tJit[i] = (rng() - 0.5) * 0.07;
      terrain.setColorAt(i, TSTATIC[b[3]] || TSTATIC[0]);
    });
    terrain.castShadow = true; terrain.receiveShadow = true;
    scene.add(terrain);
    W.terrain = terrain;
    recolorTerrain(S.season);

    // seabed height texture for the water shader
    const data = new Uint8Array(G * G * 4);
    for (let ix = 0; ix < G; ix++) for (let iz = 0; iz < G; iz++) {
      const v = clamp((heights[ix * G + iz] + 8) * 16, 0, 255), o = (iz * G + ix) * 4;
      data[o] = data[o + 1] = data[o + 2] = v; data[o + 3] = 255;
    }
    W.heightTex = new THREE.DataTexture(data, G, G, THREE.RGBAFormat);
    W.heightTex.magFilter = THREE.LinearFilter; W.heightTex.minFilter = THREE.LinearFilter;
    W.heightTex.needsUpdate = true;
  }
  function recolorTerrain(Sv) {
    lastTerrainS = Sv;
    for (let i = 0; i < tKind.length; i++) {
      const k = tKind[i];
      if (TPAL[k]) U.seasonColor(TPAL[k], tRand[i], Sv, tmpC);
      else tmpC.copy(TSTATIC[k]);
      tmpC.multiplyScalar(1 + tJit[i]);
      terrain.setColorAt(i, tmpC);
    }
    terrain.instanceColor.needsUpdate = true;
  }

  // ------------------------------------------------------------------- water
  const ripples = Array.from({ length: 10 }, () => new THREE.Vector4(0, 0, -100, 0));
  let ripIdx = 0;
  const waterU = {
    uTime: { value: 0 }, uBreath: { value: 0 }, uAmp: { value: 0.11 },
    uSunDir: { value: new THREE.Vector3() }, uSunCol: { value: new THREE.Color() },
    uTop: { value: new THREE.Color() }, uHor: { value: new THREE.Color() }, uFog: { value: new THREE.Color() },
    uCam: { value: new THREE.Vector3() }, uShallow: { value: new THREE.Color() }, uDeep: { value: new THREE.Color() },
    uBioCol: { value: new THREE.Color(0x3fd6ff) },
    uFogNear: { value: 70 }, uFogFar: { value: 240 }, uNight: { value: 0 }, uWL: { value: K.WL },
    uRain: { value: 0 }, uBio: { value: 0 },
    uHeight: { value: null }, uHX: { value: new THREE.Vector2(MINX, G) }, uRip: { value: ripples },
  };
  const WAVE = `
    uniform float uTime, uBreath, uAmp;
    float waveH(vec2 p){
      float h = sin(dot(p, vec2(0.21, 0.13)) + uTime * 0.55) * 0.5;
      h += sin(dot(p, vec2(-0.17, 0.27)) + uTime * 0.47) * 0.35;
      h += sin(dot(p, vec2(0.41, -0.33)) + uTime * 0.9) * 0.18;
      h += sin(dot(p, vec2(-0.6, -0.52)) + uTime * 1.3) * 0.08;
      return h * uAmp;
    }`;
  function initWater() {
    waterU.uHeight.value = W.heightTex;
    const geo = new THREE.PlaneGeometry(900, 900, 300, 300);
    geo.rotateX(-Math.PI / 2);
    const vtex = renderer.capabilities.vertexTextures ? '#define VTEX\n' : '';
    const water = new THREE.Mesh(geo, new THREE.ShaderMaterial({
      uniforms: waterU, transparent: true, depthWrite: false,
      vertexShader: vtex + WAVE + `
        uniform sampler2D uHeight; uniform vec2 uHX; uniform float uWL;
        varying vec3 vW;
        void main(){
          vec4 w = modelMatrix * vec4(position, 1.0);
          float damp = 1.0;
          #ifdef VTEX
            float bed = texture2D(uHeight, (w.xz - vec2(uHX.x) + 0.5) / uHX.y).r * 255.0 / 16.0 - 8.0;
            damp = mix(0.3, 1.0, smoothstep(0.0, 3.0, uWL - bed));
          #endif
          w.y += waveH(w.xz) * damp + (uBreath - 0.5) * 0.07;
          vW = w.xyz;
          gl_Position = projectionMatrix * viewMatrix * w;
        }`,
      fragmentShader: WAVE + `
        uniform vec3 uSunDir, uSunCol, uTop, uHor, uFog, uCam, uShallow, uDeep, uBioCol;
        uniform float uFogNear, uFogFar, uNight, uWL, uRain, uBio;
        uniform sampler2D uHeight; uniform vec2 uHX; uniform vec4 uRip[10];
        varying vec3 vW;
        float h12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
        float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(h12(i), h12(i + vec2(1, 0)), f.x), mix(h12(i + vec2(0, 1)), h12(i + vec2(1, 1)), f.x), f.y); }
        void main(){
          vec2 p = vW.xz;
          float e = 0.15, hc = waveH(p);
          vec3 n = vec3(hc - waveH(p + vec2(e, 0.0)), e, hc - waveH(p + vec2(0.0, e)));
          float d1 = vn(p * 1.3 + vec2(uTime * 0.25, uTime * 0.12)) - vn(p * 1.3 + vec2(-uTime * 0.18, uTime * 0.2));
          n.xz += vec2(d1, -d1) * 0.05;
          float ring = 0.0;
          for (int i = 0; i < 10; i++) {
            vec4 r = uRip[i];
            float age = uTime - r.z;
            if (age < 0.0 || age > 10.0 || r.w <= 0.0) continue;
            vec2 dv = p - r.xy; float dist = length(dv), rad = age * 1.35;
            float env = exp(-pow((dist - rad) * 1.4, 2.0)) * exp(-age * 0.42) * r.w;
            n.xz += (dv / max(dist, 0.001)) * sin((dist - rad) * 7.0) * env * 0.3;
            ring += env * (0.5 + 0.5 * sin((dist - rad) * 7.0));
          }
          float rr = 0.0;
          if (uRain > 0.01) {
            for (int l = 0; l < 2; l++) {
              float fl = float(l);
              vec2 q = p * (1.7 + fl * 0.9) + fl * 13.7;
              vec2 cell = floor(q), f = fract(q) - 0.5;
              float rnd = h12(cell + fl * 3.1);
              if (rnd > uRain) continue;
              vec2 dv = f - (vec2(h12(cell + 1.7), h12(cell + 9.2)) - 0.5) * 0.5;
              float ph = fract(uTime * (0.7 + rnd * 0.6) + rnd * 7.0), dist = length(dv);
              float rg = smoothstep(0.06, 0.0, abs(dist - ph * 0.45)) * (1.0 - ph);
              n.xz += dv / max(dist, 0.001) * rg * 0.4;
              rr += rg;
            }
          }
          n = normalize(n);
          vec3 V = normalize(uCam - vW);
          float bed = texture2D(uHeight, (p - vec2(uHX.x) + 0.5) / uHX.y).r * 255.0 / 16.0 - 8.0;
          float depth = uWL - bed;
          vec3 col = mix(uShallow, uDeep, smoothstep(0.0, 3.6, depth));
          float fres = pow(1.0 - max(dot(n, V), 0.0), 4.0);
          vec3 Rf = reflect(-V, n);
          col = mix(col, mix(uHor, uTop, clamp(Rf.y * 1.6, 0.0, 1.0)), 0.12 + 0.68 * fres);
          col += uSunCol * pow(max(dot(reflect(-normalize(uSunDir), n), V), 0.0), 140.0) * 1.2;
          col += uSunCol * ring * 0.08 + vec3(rr * 0.05);
          float line = 0.5 + 0.3 * uBreath + 0.07 * sin(uTime * 0.7 + p.x * 0.4 + p.y * 0.3);
          float foam = (1.0 - smoothstep(0.05, line, depth)) * smoothstep(0.3, 0.7, vn(p * 2.6 + uTime * 0.12));
          col = mix(col, vec3(0.95, 0.97, 0.96) * (1.0 - 0.45 * uNight), foam * 0.7);
          col += uBioCol * uBio * (ring * 1.1 + foam * 0.55 + rr * 0.4);
          float alpha = max(mix(0.48, 1.0, smoothstep(0.3, 4.5, depth)), foam * 0.85);
          float f = smoothstep(uFogNear, uFogFar, length(uCam - vW));
          gl_FragColor = vec4(mix(col, uFog, f), mix(alpha, 1.0, f));
        }`,
    }));
    water.renderOrder = 1;
    scene.add(water);
    W.water = water;
  }
  W.addRipple = function (x, z, strength = 1) {
    ripples[ripIdx].set(x, z, S.t, strength);
    ripIdx = (ripIdx + 1) % ripples.length;
    if (strength >= 0.6 && waterU.uBio.value > 0.35) SW.emit('see', 'bioluminescence');
  };
  // Mirrors the water vertex shader so floating things ride the same swell.
  W.waveY = function (x, z) {
    const t = S.t, d = K.WL - W.heightAt(x, z), damp = lerp(0.3, 1, smooth(0, 3, d));
    const h = Math.sin(0.21 * x + 0.13 * z + t * 0.55) * 0.5 + Math.sin(-0.17 * x + 0.27 * z + t * 0.47) * 0.35
      + Math.sin(0.41 * x - 0.33 * z + t * 0.9) * 0.18 + Math.sin(-0.6 * x - 0.52 * z + t * 1.3) * 0.08;
    return K.WL + h * waterU.uAmp.value * damp + (S.breath.b - 0.5) * 0.07;
  };

  // ------------------------------------------------------------- scenery
  let mountainNear, mountainFar;
  function initMountains() {
    const rng = mulberry32(404), near = [], far = [];
    for (let a = 0; a < Math.PI * 2; a += 0.026) {
      const n = fbm(Math.cos(a) * 2 + 9, Math.sin(a) * 2 + 9, 21, 4);
      const h = Math.max(0, (n - 0.44) * 150);
      if (h > 3) far.push([a, 500 + (rng() - 0.5) * 40, h * 1.4, 15 + rng() * 6]);
      const n2 = fbm(Math.cos(a) * 3 + 2, Math.sin(a) * 3 - 4, 33, 3);
      const h2 = Math.max(0, (n2 - 0.52) * 90);
      if (h2 > 2) near.push([a, 400 + (rng() - 0.5) * 30, h2 * 1.3, 13 + rng() * 5]);
    }
    const build = (list, color) => {
      const mat = new THREE.MeshBasicMaterial({ color, fog: false });
      const mesh = new THREE.InstancedMesh(W.boxGeo, mat, list.length * 2);
      const m = new THREE.Matrix4();
      list.forEach(([a, r, h, w], i) => {
        const x = Math.cos(a) * r, z = Math.sin(a) * r;
        m.makeScale(w, h, w); m.setPosition(x, h / 2 - 3, z); mesh.setMatrixAt(i * 2, m);
        m.makeScale(w * 0.6, h * 0.12, w * 0.6); m.setPosition(x, h - 3 + h * 0.06, z); mesh.setMatrixAt(i * 2 + 1, m);
      });
      scene.add(mesh);
      return mesh;
    };
    mountainFar = build(far, 0xaabccc);
    mountainNear = build(near, 0x8aa0b0);
  }

  function initLighthouse() {
    const I = K.ISLET, base = W.heightAt(I.x, I.z);
    const g = new THREE.Group();
    g.position.set(I.x, base, I.z);
    scene.add(g);
    const white = new THREE.MeshLambertMaterial({ color: 0xf2efe8 }), red = new THREE.MeshLambertMaterial({ color: 0xb8453a }), dark = new THREE.MeshLambertMaterial({ color: 0x3a3f46 });
    const add = (mat, sx, sy, sz, x, y, z) => { const m = new THREE.Mesh(W.boxGeo, mat); m.scale.set(sx, sy, sz); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };
    for (let i = 0; i < 9; i++) add(Math.floor(i / 2) % 2 ? red : white, 1.5 - i * 0.06, 0.8, 1.5 - i * 0.06, 0, 0.4 + i * 0.8, 0);
    const top = 7.2;
    add(dark, 1.7, 0.14, 1.7, 0, top + 0.07, 0);
    const lampMat = new THREE.MeshBasicMaterial({ color: 0xfff1c8 });
    add(lampMat, 0.8, 0.8, 0.8, 0, top + 0.55, 0).castShadow = false;
    add(red, 1.05, 0.3, 1.05, 0, top + 1.1, 0);
    add(red, 0.5, 0.3, 0.5, 0, top + 1.4, 0);
    add(white, 1.4, 1.0, 1.0, -1.6, 0.5, 0.6);     // keeper's shed
    add(red, 1.6, 0.25, 1.2, -1.6, 1.12, 0.6);
    const beamMat = new THREE.ShaderMaterial({
      uniforms: { uA: { value: 0 }, uCol: { value: new THREE.Color(0xfff1c8) } },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      vertexShader: `varying float vL; void main(){ vL = position.x / 46.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `uniform float uA; uniform vec3 uCol; varying float vL; void main(){ gl_FragColor = vec4(uCol, uA * pow(1.0 - clamp(vL, 0.0, 1.0), 1.6) * 0.3); }`,
    });
    const coneGeo = new THREE.ConeGeometry(4.5, 46, 20, 1, true);
    coneGeo.translate(0, -23, 0);
    coneGeo.rotateZ(Math.PI / 2);
    const beam = new THREE.Group();
    beam.position.set(0, top + 0.55, 0);
    const c1 = new THREE.Mesh(coneGeo, beamMat), c2 = new THREE.Mesh(coneGeo, beamMat);
    c2.rotation.y = Math.PI;
    beam.add(c1, c2);
    g.add(beam);
    W.lighthouse = { g, lampMat, beam, beamMat, top: new THREE.Vector3(I.x, base + top + 0.55, I.z) };
  }

  // ------------------------------------------------------------------- clouds
  const clouds = [];
  function initClouds() {
    const rng = mulberry32(99);
    for (let c = 0; c < 16; c++) {
      const vox = [], v = 1.7, sx = 4 + ((rng() * 3) | 0), sz = 2 + ((rng() * 2) | 0);
      for (let x = -sx; x <= sx; x++) for (let z = -sz; z <= sz; z++) for (let y = 0; y <= 2; y++) {
        const e = (x / (sx + 0.5)) ** 2 + (z / (sz + 0.5)) ** 2 + ((y - 0.4) / 1.7) ** 2;
        if (e < 0.55 + fbm(x * 0.5 + c * 9, z * 0.5 + y * 3, 77, 2) * 0.55) vox.push([x * v, y * v * 0.7, z * v]);
      }
      const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x6f7680 });
      const im = new THREE.InstancedMesh(W.boxGeo, mat, vox.length);
      const m = new THREE.Matrix4();
      vox.forEach((p, i) => { m.makeScale(v, v * 0.7, v); m.setPosition(p[0], p[1], p[2]); im.setMatrixAt(i, m); });
      const a = rng() * Math.PI * 2, r = 12 + rng() * 140;
      im.position.set(Math.cos(a) * r, 26 + rng() * 10, Math.sin(a) * r);
      clouds.push({ mesh: im, mat, speed: 0.5 + rng() * 0.4, th: (c / 16) * 0.92 });
      scene.add(im);
    }
  }
  function updateClouds(dt) {
    const wx = S.weather, E = W.env;
    tmpC.setRGB(1, 1, 1).lerp(E.hor, 0.35).lerp(E.top, S.night * 0.5).multiplyScalar(1 - 0.4 * Math.max(wx.rain, wx.snow * 0.5));
    const amount = clamp(wx.cloud + wx.rain * 0.2, 0, 1), speed = 0.4 + wx.wind * 1.2;
    for (const c of clouds) {
      const vis = smooth(c.th, c.th + 0.12, amount);
      // clouds gather and dissolve by growing and shrinking
      c.mesh.visible = vis > 0.02;
      c.mesh.scale.setScalar(Math.max(0.02, U.smooth(0, 1, vis)));
      c.mesh.castShadow = vis > 0.5;
      c.mat.color.copy(tmpC);
      c.mat.emissive.copy(E.hor).multiplyScalar(0.3 + 0.2 * (1 - S.night));
      const p = c.mesh.position;
      p.x += 0.6 * c.speed * speed * dt; p.z += 0.22 * c.speed * speed * dt;
      if (p.x > 170) { p.x -= 340; p.z = (Math.random() - 0.5) * 260; }
      if (p.z > 170) p.z -= 340;
    }
  }

  // --------------------------------------------------------------------- dock
  function initDock() {
    const dock = new THREE.Group();
    const angle = 0.65 + Math.PI / 2 + 0.35, dir = new THREE.Vector2(Math.cos(angle), Math.sin(angle));
    let r0 = 2;
    while (r0 < 26 && W.heightAt(dir.x * r0, dir.y * r0) > 0) r0 += 0.5;
    const wood = new THREE.MeshLambertMaterial({ color: 0x9a7a5a }), woodDark = new THREE.MeshLambertMaterial({ color: 0x7a5d44 });
    const add = (mat, sx, sy, sz, x, y, z) => { const m = new THREE.Mesh(W.boxGeo, mat); m.scale.set(sx, sy, sz); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; dock.add(m); return m; };
    const len = 7, start = r0 - 1.5;
    for (let i = 0; i < len / 0.45; i++) add(i % 3 === 1 ? woodDark : wood, 0.38, 0.14, 2.1, start + i * 0.45, 0.12, 0);
    for (let i = 0; i <= 3; i++) for (const s of [-1, 1]) add(woodDark, 0.2, 1.6, 0.2, start + 0.6 + i * 2.1, -0.55, s * 0.95);
    const end = start + len - 0.4;
    add(woodDark, 0.14, 1.5, 0.14, end, 0.9, 0.85);
    add(woodDark, 0.5, 0.1, 0.1, end - 0.2, 1.6, 0.85);
    const lanternMat = new THREE.MeshLambertMaterial({ color: 0xffe2b0, emissive: 0xffa95c, emissiveIntensity: 0.4 });
    add(lanternMat, 0.3, 0.36, 0.3, end - 0.4, 1.32, 0.85);
    add(woodDark, 0.38, 0.08, 0.38, end - 0.4, 1.53, 0.85);
    dock.rotation.y = -angle;
    scene.add(dock);
    const toWorld = (lx, ly, lz) => new THREE.Vector3(lx * dir.x - lz * dir.y, ly, lx * dir.y + lz * dir.x);
    skyU.uAurDir.value.set(dir.x, dir.y);   // the aurora hangs over the sea beyond the dock
    W.dock = {
      angle, lanternMat,
      end: toWorld(end - 0.3, 0.19, -0.2),
      start: toWorld(start, 0.19, 0),
      lantern: toWorld(end - 0.4, 1.32, 0.85),
      pole: toWorld(end, 1.7, 0.85),
    };
    const lw = W.dock.lantern;
    W.dock.light = W.claimLight(lw.x, lw.y - 0.05, lw.z, { color: 0xffb36b, base: 1.1, breath: true, distance: 16 });
  }

  // ------------------------------------------------------------- islands
  // Each island gets a landing for the rowboat, facing home, and most get a small jetty.
  function initLandings() {
    const wood = new THREE.MeshLambertMaterial({ color: 0x9a7a5a }), dark = new THREE.MeshLambertMaterial({ color: 0x7a5d44 });
    for (const I of K.ISLANDS) {
      let peak = 0;
      for (const c of [].concat(I.cols.grass, I.cols.sand, I.cols.rock)) peak = Math.max(peak, c[2]);
      I.center = new THREE.Vector3(I.x, clamp(peak * 0.35, 0.5, 3), I.z);
      if (I.id === 'home') {
        I.center.y = 1.4;
        const a = W.dock.angle;
        I.out = new THREE.Vector2(Math.cos(a), Math.sin(a));
        I.landing = new THREE.Vector3(W.dock.end.x + I.out.x * 1.8, K.WL, W.dock.end.z + I.out.y * 1.8);
        continue;
      }
      const a = Math.atan2(-I.z, -I.x), ox = Math.cos(a), oz = Math.sin(a);
      let r = I.r * 2.2;
      while (r > 0 && W.heightAt(I.x + ox * r, I.z + oz * r) < 0) r -= 0.25;
      const sx = I.x + ox * r, sz = I.z + oz * r, sh = Math.max(0, W.heightAt(sx, sz));
      I.out = new THREE.Vector2(ox, oz);
      I.landing = new THREE.Vector3(sx + ox * 3.6, K.WL, sz + oz * 3.6);
      I.shore = new THREE.Vector3(sx, sh, sz);
      if (I.id === 'rocks') continue;
      const g = new THREE.Group();
      g.position.set(sx, 0, sz);
      g.rotation.y = -a;
      const add = (mat, sx2, sy, sz2, x, y, z) => { const m = new THREE.Mesh(W.boxGeo, mat); m.scale.set(sx2, sy, sz2); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; g.add(m); };
      const deck = sh + 0.12;
      for (let i = 0; i < 7; i++) add(i % 3 === 1 ? dark : wood, 0.38, 0.12, 1.5, -0.4 + i * 0.45, deck, 0);
      for (const x of [0.9, 2.3]) for (const z of [-0.65, 0.65]) add(dark, 0.16, deck + 1.4, 0.16, x, (deck - 1.4) / 2, z);
      W.scene.add(g);
    }
  }
  W.islandAt = function (x, z) {
    let best = K.ISLAND.home, bd = Infinity;
    for (const I of K.ISLANDS) { const d = Math.hypot(x - I.x, z - I.z) / (I.r + 8); if (d < bd) { bd = d; best = I; } }
    return best;
  };
  W.island = K.ISLAND.home;
  W.local = null;   // set once the terrain has been built
  W.setIsland = function (id) {
    const I = K.ISLAND[id] || K.ISLAND.home;
    if (I === W.island) return;
    W.island = I; W.local = I.cols; S.island = I.id;
    SW.emit('island', I.id);
  };

  // ------------------------------------------------------------ points
  const PT_VS = `
    attribute vec3 aC; attribute float aA; attribute float aS;
    uniform float uSize; uniform float uPR;
    varying vec3 vC; varying float vA;
    void main(){ vC = aC; vA = aA; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = min(uSize * aS * uPR / -mv.z, 160.0); gl_Position = projectionMatrix * mv; }`;
  const PT_FS = {
    glow: `varying vec3 vC; varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d); gl_FragColor = vec4(vC * (0.6 + a), a * vA); }`,
    soft: `varying vec3 vC; varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.1, d); gl_FragColor = vec4(vC, a * vA); }`,
    square: `varying vec3 vC; varying float vA; void main(){ vec2 q = abs(gl_PointCoord - 0.5); float a = 1.0 - smoothstep(0.32, 0.5, max(q.x, q.y)); gl_FragColor = vec4(vC, a * vA); }`,
  };
  W.makePoints = function (max, shape, additive, size) {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(max * 3), col = new Float32Array(max * 3).fill(1), al = new Float32Array(max), sz = new Float32Array(max).fill(1);
    const attr = (a, n) => new THREE.BufferAttribute(a, n).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', attr(pos, 3)); geo.setAttribute('aC', attr(col, 3));
    geo.setAttribute('aA', attr(al, 1)); geo.setAttribute('aS', attr(sz, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: { uSize: { value: size }, uPR: prU }, vertexShader: PT_VS, fragmentShader: PT_FS[shape],
      transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false; pts.renderOrder = 3;
    scene.add(pts);
    return {
      pts, pos, col, al, sz, max,
      dirty() { for (const k of ['position', 'aC', 'aA', 'aS']) geo.attributes[k].needsUpdate = true; },
    };
  };
  // Short-lived particles: smoke, spray, sparks.
  W.makeEmitter = function (max, shape, additive, size) {
    const P = W.makePoints(max, shape, additive, size);
    const v = new Float32Array(max * 3), life = new Float32Array(max), age = new Float32Array(max);
    const s0 = new Float32Array(max), s1 = new Float32Array(max), a0 = new Float32Array(max), grav = new Float32Array(max), drag = new Float32Array(max), wf = new Float32Array(max);
    let cursor = 0, live = 0;
    return {
      emit(o) {
        const i = cursor; cursor = (cursor + 1) % max; live = max;
        P.pos[i * 3] = o.x; P.pos[i * 3 + 1] = o.y; P.pos[i * 3 + 2] = o.z;
        v[i * 3] = o.vx || 0; v[i * 3 + 1] = o.vy || 0; v[i * 3 + 2] = o.vz || 0;
        life[i] = o.life || 1; age[i] = 0; s0[i] = o.size || 1; s1[i] = o.size2 == null ? s0[i] : o.size2;
        a0[i] = o.alpha == null ? 1 : o.alpha; grav[i] = o.grav || 0; drag[i] = o.drag || 0; wf[i] = o.wind || 0;
        P.col[i * 3] = o.r == null ? 1 : o.r; P.col[i * 3 + 1] = o.g == null ? 1 : o.g; P.col[i * 3 + 2] = o.b == null ? 1 : o.b;
      },
      update(dt) {
        if (!live) return;
        const wind = S.weather.wind;
        let any = 0;
        for (let i = 0; i < max; i++) {
          if (life[i] <= 0) { P.al[i] = 0; continue; }
          age[i] += dt;
          const k = age[i] / life[i];
          if (k >= 1) { life[i] = 0; P.al[i] = 0; continue; }
          any++;
          const dk = Math.max(0, 1 - drag[i] * dt);
          v[i * 3] = v[i * 3] * dk + wf[i] * wind * dt; v[i * 3 + 1] = v[i * 3 + 1] * dk - grav[i] * dt; v[i * 3 + 2] *= dk;
          P.pos[i * 3] += v[i * 3] * dt; P.pos[i * 3 + 1] += v[i * 3 + 1] * dt; P.pos[i * 3 + 2] += v[i * 3 + 2] * dt;
          P.sz[i] = s0[i] + (s1[i] - s0[i]) * k;
          P.al[i] = a0[i] * Math.min(1, k / 0.1) * Math.min(1, (1 - k) / 0.4);
        }
        if (!any) live = 0;
        P.dirty();
      },
    };
  };

  // ------------------------------------------------------- rain, snow, stars
  const RAIN_N = 700, SNOW_N = 900;
  let rainGeo, rainMat, rainPos, rainDrops, snowPts, snowData;
  function initWeatherFx() {
    rainPos = new Float32Array(RAIN_N * 6).fill(-500);
    rainGeo = new THREE.BufferGeometry();
    rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3).setUsage(THREE.DynamicDrawUsage));
    rainMat = new THREE.LineBasicMaterial({ color: 0xd8e4ec, transparent: true, opacity: 0, depthWrite: false });
    const lines = new THREE.LineSegments(rainGeo, rainMat);
    lines.frustumCulled = false; lines.renderOrder = 4;
    scene.add(lines);
    rainDrops = Array.from({ length: RAIN_N }, () => ({ x: 0, y: -99, z: 0, v: 13 + Math.random() * 5 }));
    snowPts = W.makePoints(SNOW_N, 'soft', false, 75);
    snowData = Array.from({ length: SNOW_N }, () => ({ x: 0, y: -99, z: 0, s: Math.random() * 100, v: 0.55 + Math.random() * 0.6 }));
  }
  function updateWeatherFx(dt, t) {
    const wx = S.weather, cx = W.focus.x, cz = W.focus.z, wind = wx.wind;
    const nRain = Math.floor(RAIN_N * clamp(wx.rain, 0, 1));
    if (nRain || rainMat.opacity > 0) {
      for (let i = 0; i < RAIN_N; i++) {
        const d = rainDrops[i], o = i * 6;
        if (i >= nRain) { rainPos[o + 1] = rainPos[o + 4] = -500; d.y = -99; continue; }
        d.y -= d.v * dt; d.x += wind * 2.2 * dt;
        if (d.y < K.WL) { d.x = cx + (Math.random() - 0.5) * 64; d.z = cz + (Math.random() - 0.5) * 64; d.y = 4 + Math.random() * 26; }
        rainPos[o] = d.x; rainPos[o + 1] = d.y; rainPos[o + 2] = d.z;
        rainPos[o + 3] = d.x - wind * 0.15; rainPos[o + 4] = d.y + 0.55; rainPos[o + 5] = d.z;
      }
      rainGeo.attributes.position.needsUpdate = true;
    }
    rainMat.opacity = 0.32 * clamp(wx.rain * 1.3, 0, 1);
    rainMat.color.copy(W.env.hor).lerp(WHITE, 0.45);
    const nSnow = Math.floor(SNOW_N * clamp(wx.snow, 0, 1));
    if (nSnow || snowPts.al[0] > 0) {
      for (let i = 0; i < SNOW_N; i++) {
        const d = snowData[i];
        if (i >= nSnow) { snowPts.al[i] = 0; d.y = -99; continue; }
        d.y -= d.v * dt;
        d.x += (wind * 0.8 + Math.sin(t * 0.7 + d.s) * 0.35) * dt; d.z += Math.cos(t * 0.5 + d.s) * 0.25 * dt;
        if (d.y < Math.max(K.WL, W.heightAt(d.x, d.z))) { d.x = cx + (Math.random() - 0.5) * 70; d.z = cz + (Math.random() - 0.5) * 70; d.y = 6 + Math.random() * 26; }
        snowPts.pos[i * 3] = d.x; snowPts.pos[i * 3 + 1] = d.y; snowPts.pos[i * 3 + 2] = d.z;
        snowPts.al[i] = 0.9; snowPts.sz[i] = 0.7 + (d.s % 1) * 0.6;
      }
      snowPts.dirty();
    }
  }

  let star = null, starPts;
  function initShootingStar() { starPts = W.makePoints(18, 'glow', true, 2600); }
  const dirOf = (a, el) => new THREE.Vector3(Math.cos(a) * Math.cos(el), Math.sin(el), Math.sin(a) * Math.cos(el));
  function updateShootingStar(dt) {
    if (!star && S.night > 0.8 && W.env.over < 0.45 && Math.random() < dt / 32) {
      const a = Math.random() * Math.PI * 2, el = 0.45 + Math.random() * 0.5;
      star = { from: dirOf(a, el), to: dirOf(a + 0.3 + Math.random() * 0.2, el - 0.18 - Math.random() * 0.15), k: 0, dur: 1.6 + Math.random() * 0.8, head: new THREE.Vector3(), seen: false };
    }
    if (!star) return;
    star.k += dt / star.dur;
    for (let j = 0; j < 18; j++) {
      const kk = star.k - j * 0.016, on = kk >= 0 && kk <= 1;
      tmpV.copy(star.from).lerp(star.to, clamp(kk, 0, 1)).normalize().multiplyScalar(300).add(camera.position);
      starPts.pos[j * 3] = tmpV.x; starPts.pos[j * 3 + 1] = tmpV.y; starPts.pos[j * 3 + 2] = tmpV.z;
      starPts.al[j] = on ? (1 - j / 18) * Math.sin(Math.PI * clamp(star.k, 0, 1)) : 0;
      starPts.sz[j] = 1.3 - j / 18;
      starPts.col[j * 3] = 1; starPts.col[j * 3 + 1] = 0.95; starPts.col[j * 3 + 2] = 0.85;
      if (j === 0) star.head.copy(tmpV);
    }
    starPts.dirty();
    if (!star.seen && W.isOnScreen(star.head, 1000)) { star.seen = true; SW.emit('see', 'shooting'); }
    if (star.k >= 1.3) { star = null; starPts.al.fill(0); starPts.dirty(); }
  }
  W.tryWish = function (cx, cy) {
    if (!star || star.k > 1) return false;
    tmpV.copy(star.head).project(camera);
    const sx = (tmpV.x * 0.5 + 0.5) * window.innerWidth, sy = (-tmpV.y * 0.5 + 0.5) * window.innerHeight;
    if (Math.hypot(sx - cx, sy - cy) > 80) return false;
    const dir = star.head.clone().sub(camera.position).normalize();
    star.k = Math.max(star.k, 0.9);
    SW.emit('wish', dir);
    return true;
  };

  // ------------------------------------------------------------------ weather
  const WX_TYPES = {
    clear: { cloud: 0.12, rain: 0, fog: 0, snow: 0 },
    fair: { cloud: 0.5, rain: 0, fog: 0, snow: 0 },
    rain: { cloud: 0.95, rain: 1, fog: 0.15, snow: 0 },
    fog: { cloud: 0.45, rain: 0, fog: 1, snow: 0 },
    snow: { cloud: 0.85, rain: 0, fog: 0.2, snow: 1 },
  };
  const WX_WEIGHTS = [
    { clear: 0.35, fair: 0.3, rain: 0.25, fog: 0.1 },
    { clear: 0.5, fair: 0.3, rain: 0.15, fog: 0.05 },
    { clear: 0.25, fair: 0.3, rain: 0.25, fog: 0.2 },
    { clear: 0.3, fair: 0.25, snow: 0.35, fog: 0.1 },
  ];
  let wxKind = 'fair', wxTimer = 150, wxMode = 'auto', rainPeak = 0, rainbowT = 0, auroraNight = -1, auroraOn = false;
  W.setWeatherMode = function (m) { wxMode = m; if (m === 'auto') wxTimer = 40; };
  W.weatherKind = () => wxKind;
  function pickWeighted(w) {
    let r = Math.random() * Object.values(w).reduce((a, b) => a + b, 0);
    for (const k in w) { r -= w[k]; if (r <= 0) return k; }
    return 'fair';
  }
  function updateWeather(dt) {
    const wx = S.weather, si = U.seasonIndex(S.season);
    if (wxMode === 'auto') {
      wxTimer -= dt;
      if (wxTimer <= 0) { wxKind = pickWeighted(WX_WEIGHTS[si]); wxTimer = 150 + Math.random() * 180; }
      if (si === 3 && wxKind === 'rain') wxKind = 'snow';
      if (si !== 3 && wxKind === 'snow') wxKind = 'rain';
    } else wxKind = wxMode;
    const tg = WX_TYPES[wxKind], k = 1 - Math.exp(-dt / 25);
    for (const key of ['cloud', 'rain', 'fog', 'snow']) wx[key] += (tg[key] - wx[key]) * k;
    wx.wind = 0.35 + 0.25 * Math.sin(S.t * 0.021) + 0.15 * Math.sin(S.t * 0.057 + 1) + wx.rain * 0.3;
    // a rainbow after rain, if the sun comes out while it is low
    rainPeak = Math.max(rainPeak * Math.exp(-dt / 150), wx.rain);
    if (rainPeak > 0.6 && wx.rain < 0.3 && tg.rain === 0 && S.night < 0.3 && rainbowT <= 0) { rainbowT = 110; rainPeak = 0; }
    rainbowT -= dt;
    wx.rainbow = rainbowT > 0 ? smooth(110, 90, rainbowT) * smooth(0, 20, rainbowT) * (1 - S.night) * (1 - wx.fog) : 0;
    // aurora: some nights, more often in autumn and winter
    const nightId = Math.floor(S.day);
    if (nightId !== auroraNight) { auroraNight = nightId; auroraOn = Math.random() < [0.3, 0.25, 0.45, 0.65][si]; }
    wx.aurora += ((auroraOn ? smooth(0.6, 0.95, S.night) * (1 - wx.cloud * 0.8) : 0) - wx.aurora) * k;
  }

  // --------------------------------------------------------------- env
  const greyTop = hex(0x9aa6b2), greyHor = hex(0xc4ccd2), greyNightTop = hex(0x1a2230), greyNightHor = hex(0x2a3440);
  const fogDay = hex(0xdfe6ea), fogNight = hex(0x3a4656);
  const shallowDay = hex(0x62c2bf), deepDay = hex(0x2b6f8c), shallowNight = hex(0x2c5260), deepNight = hex(0x10243a);
  const shallowWinter = hex(0x86b6bc), deepWinter = hex(0x2f5d74);
  W.env = { top: new THREE.Color(), hor: new THREE.Color(), sun: new THREE.Color(), over: 0 };
  function updateEnv(t) {
    const wx = S.weather, P = samplePalette(S.tod), E = W.env;
    const over = clamp(wx.cloud * 0.5 + wx.rain * 0.55 + wx.snow * 0.45 + wx.fog * 0.3, 0, 1);
    S.night = P.night;
    S.glow = Math.max(smooth(0.15, 0.75, P.night), over * 0.45 + wx.fog * 0.2);
    S.dayness = 1 - smooth(0, 0.5, P.night);
    E.over = over;
    tmpC.copy(greyTop).lerp(greyNightTop, P.night); E.top.copy(P.top).lerp(tmpC, over * 0.7);
    tmpC.copy(greyHor).lerp(greyNightHor, P.night); E.hor.copy(P.hor).lerp(tmpC, over * 0.65);
    tmpC.copy(fogDay).lerp(fogNight, P.night); E.hor.lerp(tmpC, wx.fog * 0.6); E.top.lerp(tmpC, wx.fog * 0.4);
    E.sun.copy(P.sun);
    const L = computeSunMoon(S.tod, P.night), full = 1 - Math.abs(W.moonPhase() - 0.5) * 2;
    sun.position.copy(L).multiplyScalar(100).add(W.focus); sun.target.position.copy(W.focus);
    sun.color.copy(P.sun);
    sun.intensity = P.si * (1 - 0.62 * over) * (P.night > 0.5 ? 0.55 + 0.45 * full : 1);
    hemi.color.copy(P.hs).lerp(E.hor, over * 0.4); hemi.groundColor.copy(P.hg); hemi.intensity = P.hi * (1 + over * 0.15);
    scene.fog.color.copy(E.hor);
    const wet = clamp(wx.rain + wx.snow * 0.5, 0, 1);
    const extra = Math.max(0, camera.position.distanceTo(W.focus) - 50);   // see the whole archipelago from high up
    scene.fog.near = lerp(70, 14, wx.fog) * lerp(1, 0.6, wet) + extra * 0.9;
    scene.fog.far = lerp(240, 60, wx.fog) * lerp(1, 0.55, wet) + extra * 1.3;

    Object.assign(skyU.uNight, { value: P.night }); skyU.uTime.value = t;
    skyU.uTop.value.copy(E.top); skyU.uHor.value.copy(E.hor); skyU.uSunCol.value.copy(P.sun);
    skyU.uSunDir.value.copy(skySun); skyU.uMoonDir.value.copy(moonDir); skyU.uMoonPhase.value = W.moonPhase();
    skyU.uOvercast.value = clamp(over * 1.15, 0, 1); skyU.uAurora.value = wx.aurora; skyU.uRainbow.value = wx.rainbow;
    sky.position.copy(camera.position);

    const si = U.seasonIndex(S.season), winter = si === 3 ? smooth(3, 3.3, S.season % 4) : 0;
    waterU.uTime.value = t; waterU.uBreath.value = S.breath.b;
    waterU.uAmp.value = (S.reduceMotion ? 0.05 : 0.11) * (1 + wx.wind * 0.35 + wx.rain * 0.2);
    waterU.uSunDir.value.copy(L); waterU.uSunCol.value.copy(P.sun).multiplyScalar((0.4 + P.si * 0.7) * (1 - over * 0.7));
    waterU.uTop.value.copy(E.top); waterU.uHor.value.copy(E.hor); waterU.uFog.value.copy(E.hor);
    waterU.uShallow.value.copy(shallowDay).lerp(shallowWinter, winter).lerp(shallowNight, P.night).lerp(E.hor, over * 0.2);
    waterU.uDeep.value.copy(deepDay).lerp(deepWinter, winter).lerp(deepNight, P.night);
    waterU.uNight.value = P.night; waterU.uCam.value.copy(camera.position);
    waterU.uFogNear.value = scene.fog.near; waterU.uFogFar.value = scene.fog.far;
    waterU.uRain.value = wx.rain * 0.85;
    waterU.uBio.value = smooth(0.5, 0.9, P.night) * [0.6, 1, 0.7, 0.15][si] * (1 - wx.snow);
    terrainU.uTime.value = t;
    terrainU.uCaus.value.copy(P.sun).multiplyScalar(P.si * (1 - over) * S.dayness * 0.55);

    tmpC.copy(E.hor).lerp(E.top, 0.12).multiplyScalar(0.94); mountainFar.material.color.copy(tmpC);
    tmpC.copy(E.hor).lerp(E.top, 0.3).multiplyScalar(0.86); mountainNear.material.color.copy(tmpC);

    const LH = W.lighthouse, on = smooth(0.25, 0.7, S.glow);
    LH.beam.rotation.y = t * 0.45;
    LH.beamMat.uniforms.uA.value = on * (0.7 + 0.8 * wx.fog + 0.3 * wx.rain);
    LH.lampMat.color.setRGB(0.75 + 0.35 * on, 0.72 + 0.3 * on, 0.6 + 0.25 * on);
    W.dock.lanternMat.emissiveIntensity = 0.25 + 0.75 * S.breath.b * (0.4 + 0.6 * S.glow);
  }

  // ---------------------------------------------------------------- sightings
  let seeTimer = 0;
  function sightings(dt) {
    seeTimer -= dt;
    if (seeTimer > 0) return;
    seeTimer = 1;
    const wx = S.weather;
    if (wx.aurora > 0.4) SW.emit('see', 'aurora');
    if (wx.rainbow > 0.4) SW.emit('see', 'rainbow');
    if (wx.rain > 0.55) SW.emit('see', 'rain');
    if (wx.snow > 0.55) SW.emit('see', 'snow');
    if (wx.fog > 0.6) SW.emit('see', 'fog');
    if (S.night > 0.8 && Math.abs(W.moonPhase() - 0.5) < 0.07 && W.env.over < 0.5) SW.emit('see', 'fullmoon');
    if (S.glow > 0.5 && W.isOnScreen(W.lighthouse.top, 120)) SW.emit('see', 'lighthouse');
  }

  W.update = function (dt) {
    const t = S.t;
    updateWeather(dt);
    updateEnv(t);
    updateClouds(dt);
    updateWeatherFx(dt, t);
    updateShootingStar(dt);
    updateLights(t);
    if (Math.abs(S.season - lastTerrainS) > 0.004) recolorTerrain(S.season);
    sightings(dt);
  };
})(window.SW);
