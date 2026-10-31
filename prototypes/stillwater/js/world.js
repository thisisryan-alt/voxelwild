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
    camera = new THREE.PerspectiveCamera(40, 1, 0.3, 2400);
    Object.assign(W, { renderer, scene, camera, canvas, boxGeo: new THREE.BoxGeometry(1, 1, 1) });
    initLights(); initSky(); initTerrain(); initWater(); initMountains(); initLighthouse();
    initClouds(); initDock(); initWeatherFx(); initShootingStar(); initLandings(); initFeatures();
    scene.traverse((o) => { if (o.isLight) o.layers.enableAll(); });
    SW.post.init();
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
    if (SW.post) SW.post.resize();
  }
  W.resize = resize;

  // renderScale (0.6–1) lowers the drawing resolution a little when frames run long; see watchFrameRate in main.js.
  W.renderScale = 1;
  function applyPixelRatio() {
    const q = S.quality, base = Math.min(window.devicePixelRatio || 1, q === 'high' ? 1.75 : q === 'balanced' ? 1.25 : 1);
    const pr = base * W.renderScale;
    renderer.setPixelRatio(pr); prU.value = pr; W.pixelRatio = pr; W.basePixelRatio = base;
  }
  W.setRenderScale = function (s) {
    if (Math.abs(s - W.renderScale) < 0.01) return;
    W.renderScale = s;
    applyPixelRatio();
    resize();
  };
  // Compile every material up front, including things not yet on screen (rain, snow, lanterns, other islands),
  // so they do not stall a frame the first time they appear.
  W.warmUp = function () {
    scene.traverse((o) => { if ((o.isMesh || o.isInstancedMesh) && !o.layers.test(LATE)) [].concat(o.material).forEach(W.depthAlpha); });
    const target = SW.post.enabled && SW.post.targets ? SW.post.targets.rtA : null;
    renderer.setRenderTarget(target);
    renderer.compile(scene, camera);
    renderer.setRenderTarget(null);
    SW.post.warm();
  };

  W.setQuality = function (q) {
    S.quality = q;
    W.renderScale = 1;
    applyPixelRatio();
    const shadows = q !== 'low', size = q === 'high' ? 4096 : 2048;
    sun.shadow.radius = q === 'high' ? 2 : 1;
    if (sun.shadow.mapSize.x !== size) {
      sun.shadow.mapSize.set(size, size);
      if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
    }
    if (renderer.shadowMap.enabled !== shadows) {
      renderer.shadowMap.enabled = shadows;
      scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { m.needsUpdate = true; }); });
    }
    SW.post.setQuality(q);
    if (SW.garden && SW.garden.setGrassDensity) SW.garden.setGrassDensity(q);
    resize();
    if (W.ready) W.warmUp();
  };

  // Ask for items lo..hi of an instanced buffer to go to the GPU with the next frame. A slice still waiting
  // from earlier in the frame is merged in, never replaced, so one update can't drop another.
  W.queueUpload = function (attr, lo, hi) {
    const n = attr.itemSize, r = attr.updateRange;
    if (r.count > 0) { lo = Math.min(lo, r.offset / n); hi = Math.max(hi, (r.offset + r.count) / n - 1); }
    r.offset = lo * n; r.count = (hi - lo + 1) * n;
    attr.needsUpdate = true;
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

  // --------------------------------------------------------------- materials
  // One patch for every voxel material: per-face shading, darkened block edges, a fine "texel"
  // grain so surfaces read as crafted blocks, grass that wraps over the top of a block's sides,
  // leaves that glow when the sun is behind them, and surfaces that darken and shine in rain.
  const PU = W.uniforms = {
    uTime: { value: 0 }, uWL: { value: K.WL }, uCaus: { value: new THREE.Color() }, uWet: { value: 0 },
    uSway: { value: 0 }, uSwayAmp: { value: 1 }, uDirt: { value: hex(0x8d6f50) },
    uCloudTex: { value: null }, uCloudSh: { value: new THREE.Vector3() },   // cloud shadows (see below)
    uGust: { value: new THREE.Vector3(0, 0, 0) },                           // wind gusts: travelled offset xy, strength z
  };
  // Shade from the clouds overhead: 1 in sunlight, lower beneath a cloud. uCloudSh.xy turns height into the
  // sideways shift along the sun's rays; z is how dark the shadows are.
  const CS_SPAN = 512, CS_RES = 256;   // the shadow texture covers 512 x 512 world units
  const CLOUD_GLSL = `uniform sampler2D uCloudTex; uniform vec3 uCloudSh;
    float swCloudShade(vec3 p){ vec2 uv = (p.xz - uCloudSh.xy * p.y) / ${CS_SPAN.toFixed(1)} + 0.5; return 1.0 - uCloudSh.z * texture2D(uCloudTex, uv).r; }`;
  W.CLOUD_GLSL = CLOUD_GLSL;
  // the sun's direct light, dimmed under the clouds (three.js's own light loop, with one line added)
  const LIGHTS_CLOUDED = THREE.ShaderChunk.lights_fragment_begin.replace('getDirectionalDirectLightIrradiance( directionalLight, geometry, directLight );',
    'getDirectionalDirectLightIrradiance( directionalLight, geometry, directLight );\n\t\tdirectLight.color *= swCloudShade(vWPos);');
  // Wind gusts: patches of stronger wind that travel downwind over the islands. uGust.xy is how far the
  // pattern has travelled, uGust.z how strong the gusts are.
  const GUST_GLSL = `uniform vec3 uGust;
    const vec2 GUST_DIR = vec2(0.94, 0.34);
    float gh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float gustAt(vec2 p){
      vec2 q = p * 0.045 - uGust.xy, i = floor(q), f = fract(q); f = f * f * (3.0 - 2.0 * f);
      float n = mix(mix(gh(i), gh(i + vec2(1.0, 0.0)), f.x), mix(gh(i + vec2(0.0, 1.0)), gh(i + vec2(1.0, 1.0)), f.x), f.y);
      return smoothstep(0.5, 0.88, n) * uGust.z;
    }`;
  W.GUST_GLSL = GUST_GLSL;
  const wetMats = [];
  W.patch = function (material, o = {}) {
    const defs = (o.sway ? '#define SWAY\n' : '') + (o.grassSide ? '#define GRASS_SIDE\n' : '') + (o.caustics ? '#define CAUSTICS\n' : '') + (o.trans ? '#define TRANS\n' : '') + (o.wet ? '#define WET\n' : '');
    if (o.wet && material.isMeshPhongMaterial) wetMats.push(material);
    // three.js keys cached programs on the patch's source text, so name each variant explicitly
    material.customProgramCacheKey = () => 'sw-voxel|' + defs.replace(/\n/g, ',');
    material.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, PU, {
        uEdge: { value: o.edges == null ? 0.16 : o.edges }, uTexel: { value: o.texel || 0 }, uTexAmt: { value: o.texAmt == null ? 0.07 : o.texAmt },
        uTrans: { value: o.trans || 0 }, uFaceShade: { value: o.faceShade == null ? 1 : o.faceShade },
      });
      sh.vertexShader = defs + `uniform float uSway, uSwayAmp;
        varying vec3 vWPos; varying vec3 vLocal; varying vec3 vObjN; varying float vVD;
        #ifdef SWAY
          ` + GUST_GLSL + `
        #endif
        #ifdef GRASS_SIDE
          attribute float aKind; varying float vKind;
        #endif
        ` + sh.vertexShader.replace('#include <project_vertex>', `
        vec4 mvPosition = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          mvPosition = instanceMatrix * mvPosition;
        #endif
        #ifdef SWAY
          float sw = sin(uSway * 0.9 + mvPosition.x * 0.45 + mvPosition.z * 0.3) + 0.5 * sin(uSway * 1.7 + mvPosition.z * 0.8);
          // gusts roll across the islands: canopies lean downwind and toss harder as one passes
          float gu = gustAt((modelMatrix * mvPosition).xz);
          mvPosition.x += sw * 0.03 * uSwayAmp * (1.0 + 1.6 * gu) + gu * 0.05 * GUST_DIR.x;
          mvPosition.z += sw * 0.018 * uSwayAmp * (1.0 + 1.6 * gu) + gu * 0.05 * GUST_DIR.y;
        #endif
        vWPos = (modelMatrix * mvPosition).xyz;
        vLocal = position; vObjN = normal;
        #ifdef GRASS_SIDE
          vKind = aKind;
        #endif
        mvPosition = modelViewMatrix * mvPosition;
        vVD = -mvPosition.z;
        gl_Position = projectionMatrix * mvPosition;`);
      sh.fragmentShader = defs + CLOUD_GLSL + `
        uniform float uTime, uWL, uWet, uEdge, uTexel, uTexAmt, uTrans, uFaceShade; uniform vec3 uCaus, uDirt;
        varying vec3 vWPos; varying vec3 vLocal; varying vec3 vObjN; varying float vVD;
        #ifdef GRASS_SIDE
          varying float vKind;
        #endif
        float vxh(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
        float vn2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(vxh(vec3(i, 0.0)), vxh(vec3(i + vec2(1.0, 0.0), 0.0)), f.x), mix(vxh(vec3(i + vec2(0.0, 1.0), 0.0)), vxh(vec3(i + vec2(1.0, 1.0), 0.0)), f.x), f.y); }
        ` + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
        {
          vec3 an = abs(vObjN), a = abs(vLocal) * 2.0;
          vec2 f = an.x > 0.5 ? a.yz : an.y > 0.5 ? a.xz : a.xy;
          vec3 cellP = floor((vWPos - vObjN * 0.002) * max(uTexel, 1.0));
          #ifdef GRASS_SIDE
            if (vKind > 1.5 && vKind < 2.5 && vObjN.y < 0.5) {
              float run = floor((an.x > 0.5 ? vWPos.z : vWPos.x) * 8.0);
              float band = 0.72 + 0.14 * vxh(vec3(run, floor(vWPos.y), 3.0));
              if (vLocal.y + 0.5 < band) diffuseColor.rgb = uDirt * (0.92 + 0.16 * vxh(cellP + 7.0));
            }
          #endif
          #ifdef GRASS_SIDE
            // meadows drift between lusher and sun-faded patches over tens of blocks
            if (vKind > 1.5 && vKind < 2.5) {
              float m = vn2(vWPos.xz * 0.11) * 0.65 + vn2(vWPos.xz * 0.37 + 7.0) * 0.35;
              diffuseColor.rgb *= mix(vec3(0.88, 0.94, 0.86), vec3(1.07, 1.04, 0.92), m);
            }
            // sand at the waterline stays damp and darker
            if (vKind > 0.5 && vKind < 1.5 && vWPos.y < 0.05) diffuseColor.rgb *= 0.82 + 0.06 * vxh(cellP + 3.0);
          #endif
          float edge = smoothstep(0.8, 1.0, max(f.x, f.y));
          diffuseColor.rgb *= 1.0 - uEdge * edge;
          float shade = vObjN.y > 0.5 ? 1.0 : vObjN.y < -0.5 ? 0.72 : (an.x > 0.5 ? 0.92 : 0.87);
          diffuseColor.rgb *= mix(1.0, shade, uFaceShade);
          if (uTexel > 0.0) diffuseColor.rgb *= 1.0 + (vxh(cellP) - 0.5) * uTexAmt * 2.0;
          #ifdef WET
            diffuseColor.rgb *= 1.0 - 0.2 * uWet;
          #endif
        }`).replace('#include <envmap_fragment>', `
        #if defined(TRANS) && NUM_DIR_LIGHTS > 0
          {
            float tr = pow(clamp(dot(normalize(-vViewPosition), directionalLights[0].direction), 0.0, 1.0), 5.0);
            outgoingLight += diffuseColor.rgb * directionalLights[0].color * tr * uTrans;
          }
        #endif
        #include <envmap_fragment>`).replace('#include <lights_fragment_begin>', LIGHTS_CLOUDED).replace('#include <fog_fragment>', `
        #ifdef CAUSTICS
          if (vWPos.y < uWL - 0.02) {
            vec2 ca = vWPos.xz * 0.9 + vec2(sin(uTime * 0.4 + vWPos.z * 0.6), cos(uTime * 0.33 + vWPos.x * 0.5)) * 0.6;
            float c = abs(sin(ca.x * 2.1 + uTime * 0.7) + sin(ca.y * 2.3 - uTime * 0.6) + sin((ca.x + ca.y) * 1.7 + uTime * 0.5));
            c = pow(clamp(1.0 - c * 0.45, 0.0, 1.0), 4.0);
            gl_FragColor.rgb += uCaus * c * (1.0 - clamp((uWL - vWPos.y) / 4.0, 0.0, 1.0));
          }
        #endif
        #include <fog_fragment>`).replace('#include <dithering_fragment>', '#include <dithering_fragment>\n gl_FragColor.a = vVD;');
    };
    material.__swDepth = true;
    return material;
  };
  // The same distance-in-alpha for the few built-in materials that are not patched (lamps, the far hills).
  W.depthAlpha = function (m) {
    if (!m || m.__swDepth || m.transparent || m.isShaderMaterial || !(m.isMeshBasicMaterial || m.isMeshLambertMaterial || m.isMeshPhongMaterial)) return;
    m.__swDepth = true;
    const prev = m.onBeforeCompile, prevKey = prev && prev.toString();
    m.onBeforeCompile = function (sh, r) {
      if (prev) prev.call(this, sh, r);
      sh.vertexShader = 'varying float vVD;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n vVD = -mvPosition.z;');
      sh.fragmentShader = 'varying float vVD;\n' + sh.fragmentShader.replace('#include <dithering_fragment>', '#include <dithering_fragment>\n gl_FragColor.a = vVD;');
    };
    m.customProgramCacheKey = () => (prevKey || '') + '|sw-depth';
    m.needsUpdate = true;
  };
  // Phong for per-pixel light (lantern pools, sun glints in the rain), patched as above.
  W.voxelMat = (color, o = {}) => W.patch(new THREE.MeshPhongMaterial({ color, shininess: o.shininess || 14, specular: o.specular || 0x0b0b0b }), o);
  // Things drawn after the ambient occlusion: water, particles, glows.
  W.late = (obj) => { obj.traverse((o) => o.layers.set(1)); return obj; };
  const LATE = new THREE.Layers(); LATE.set(1);

  const dummyTex = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1, THREE.RGBAFormat);
  dummyTex.needsUpdate = true;
  W.render = function () {
    const PP = SW.post;
    renderCloudShadows();
    if (PP && PP.enabled) { PP.render(); return; }
    waterU.uPost.value = 0; waterU.uReflOn.value = 0;
    camera.layers.enableAll();
    renderer.setRenderTarget(null);
    renderer.render(scene, camera);
  };
  W.setWaterInputs = function (o) {
    waterU.uPost.value = 1;
    waterU.uReflOn.value = o.refl ? 1 : 0;
    waterU.tRefl.value = o.refl || dummyTex; waterU.tScene.value = o.scene;
    waterU.uRes.value.copy(o.res); waterU.uTexMat.value.copy(o.texMat); waterU.uNear.value = o.near; waterU.uFar.value = o.far;
  };
  W.sunDirection = () => skySun;
  // How strongly it is golden hour (dusk or dawn), 0..1
  W.golden = () => {
    const t = S.tod;
    return Math.max(smooth(0.46, 0.58, t) * (1 - smooth(0.66, 0.73, t)), 1 - smooth(0.0, 0.12, t), smooth(0.95, 1.0, t)) * (1 - W.env.over);
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
    uGold: { value: 0 }, uCirrus: { value: 0.3 },
  };
  function initSky() {
    sky = new THREE.Mesh(new THREE.SphereGeometry(950, 40, 20), new THREE.ShaderMaterial({
      uniforms: skyU, side: THREE.BackSide, depthWrite: false,
      vertexShader: `varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `
        uniform vec3 uTop, uHor, uSunCol, uSunDir, uMoonDir;
        uniform float uNight, uTime, uOvercast, uAurora, uRainbow, uMoonPhase, uGold, uCirrus;
        uniform vec2 uAurDir;
        varying vec3 vDir;
        float hash(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
        float h21(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
        float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
        float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * n2(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; } return s; }
        void main(){
          vec3 d = normalize(vDir); float h = d.y;
          // sky gradient, with a thin bright band of haze right at the horizon
          vec3 col = mix(uHor, uTop, pow(clamp(h, 0.0, 1.0), 0.48));
          col = mix(col, uHor * 1.05 + 0.015, exp(-max(h, 0.0) * 22.0) * 0.55);
          vec3 sd = normalize(uSunDir);
          float mu = dot(d, sd), s = max(mu, 0.0), sunUp = smoothstep(-0.1, 0.02, sd.y);
          // at golden hour the horizon glows warm on the sun's side of the sky
          vec2 dh = normalize(d.xz + 1e-5), sh = normalize(sd.xz + 1e-5);
          float side = pow(max(dot(dh, sh), 0.0), 3.0);
          col += uSunCol * uGold * side * exp(-abs(h) * 5.0) * 0.5;
          col = mix(col, col * vec3(0.92, 0.9, 1.05), uGold * (1.0 - side) * smoothstep(0.0, 0.4, h) * 0.6);
          // sun: an HDR disk for bloom, a tight corona and a wide forward-scattering halo
          float disk = smoothstep(0.99955, 0.99975, mu);
          col += uSunCol * (disk * 5.0 * (1.0 - uOvercast) + pow(s, 260.0) * 0.7 * (1.0 - uOvercast * 0.8) + pow(s, 14.0) * 0.2 + pow(s, 3.0) * 0.07) * sunUp;
          // high, thin cirrus drifting slowly
          if (uCirrus > 0.01 && h > 0.0) {
            vec2 cp = d.xz / (h + 0.12) * 0.32 + vec2(uTime * 0.0035, uTime * 0.0012);
            float c = fbm(cp * vec2(1.2, 3.2)) * (0.6 + 0.6 * fbm(cp * 0.35 + 4.0));
            c = smoothstep(0.42, 0.78, c) * smoothstep(0.02, 0.22, h) * uCirrus;
            vec3 cc = mix(vec3(1.0), uSunCol * 1.15, 0.25 + uGold * 0.6) * (1.0 - uNight * 0.8) + uHor * 0.12;
            cc += uSunCol * pow(s, 6.0) * 0.6 * sunUp;
            col = mix(col, cc, c * 0.65);
          }
          float starVis = smoothstep(0.45, 0.95, uNight) * (1.0 - uOvercast) * smoothstep(0.02, 0.3, h);
          if (starVis > 0.01) {
            float band = 1.0 - smoothstep(0.0, 0.32, abs(dot(d, normalize(vec3(0.5, 0.35, -0.8)))));
            vec3 c = floor(d * 220.0); float r = hash(c);
            if (r > 0.9965 - band * 0.004) {
              float tw = 0.55 + 0.45 * sin(uTime * (0.6 + r * 2.0) + r * 60.0), big = step(0.9993, r);
              vec3 sc = mix(vec3(0.8, 0.88, 1.0), vec3(1.0, 0.9, 0.75), fract(r * 731.0));
              col += sc * starVis * tw * (1.0 + big * 1.5);
            }
            float mw = n2(d.xz * 7.0 + d.y * 3.0) * n2(d.zy * 13.0 + 3.0) * (0.6 + 0.8 * fbm(d.xz * 4.0));
            col += vec3(0.5, 0.56, 0.8) * band * mw * 0.24 * starVis;
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
              vec3 mcol = vec3(1.05, 1.03, 0.95) * (0.1 + 1.15 * lit) * (0.8 + 0.2 * n2(q * 4.0 + 7.0));
              col = mix(col, mcol, (1.0 - smoothstep(0.85, 1.0, rr)) * vis);
            }
          }
          float full = 1.0 - abs(uMoonPhase - 0.5) * 2.0;
          col += vec3(0.55, 0.65, 0.85) * pow(max(mc, 0.0), 300.0) * 0.35 * uNight * full * (1.0 - uOvercast) * smoothstep(-0.04, 0.04, md.y);
          gl_FragColor = vec4(col, 5000.0);   // alpha: distance, beyond everything (see post.js)
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
  const tint = new Uint8Array(G * G);   // 1 sand all the way down (dunes), 2 black sand (Basalt Isle)
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
      case 'falls': {
        // a mesa with a sheer cliff on the side facing home, where the waterfall drops
        const h = base > 0 ? Math.min(I.h, base * 14) + n * 1.2 * Math.min(1, base * 3) : base * 4 + 0.4;
        if (d > 0.62 && Math.abs(U.angDiff(ang, Math.atan2(-I.z, -I.x))) < 0.5) return Math.min(h, (1 - d) * 3 - 0.6 + n);
        return h;
      }
      case 'glacier': return base > 0 ? Math.pow(base, 0.7) * I.h + n * 2 * base + 0.5 : base * 4 + 0.4;
      case 'marsh': return base > 0 ? base * 1.8 + n * 2.4 + 0.1 : base * 4 + 0.2;
      case 'bamboo': return base > 0 ? Math.pow(base, 0.8) * I.h + n * 1.8 * base + 0.5 : base * 4 + 0.4;
      case 'basalt': {
        if (base <= 0) return base * 5 + 0.6;
        if (base < 0.14) return 0.9 + n * 0.6;   // a black sand beach
        // staggered columns two blocks across, each standing at its own height
        const cx = Math.floor((x + 0.5) / 2), cz = Math.floor((z + 0.5) / 2 + (cx & 1) * 0.5);
        return Math.min(I.h + 1.5, Math.pow(base, 0.6) * I.h * 1.15 + (U.hash2(cx, cz, 61) - 0.5) * 3.2) + 0.9;
      }
      case 'oldtree': return base > 0 ? Math.min(I.h, base * I.h * 1.5) + n * 1.1 * base + 0.6 : base * 4 + 0.4;
      case 'stones': return base > 0 ? Math.pow(base, 1.25) * I.h + n * 1.3 * base + 0.8 : base * 4 + 0.4;
      case 'dunes': {
        if (base <= 0) return base * 4 + 0.5;
        // long ridges lying across the wind
        const ridge = Math.sin((dx * 0.8 + dz * 0.6) * 0.55 + n * 3);
        return base * I.h * 0.55 + (ridge * 1.7 + 0.6) * Math.min(1, base * 2.2) + 0.55;
      }
      default: return base > 0 ? base * I.h + n * 1.6 * base + 0.6 : base * 4 + 0.4;
    }
  }
  // Pools that sit above sea level: the hot springs, and the pool and stream that feed the waterfall.
  const POOLS = [];   // { x, z, r, level, warm }
  let FALLS = null;   // { ax, az, bx, bz, level, edge: { x, z, top }, out }
  function planPools() {
    const S = K.ISLAND.springs;
    for (const [dx, dz, r] of K.SPRING_POOLS) POOLS.push({ x: S.x + dx, z: S.z + dz, r, level: Math.round(islandHeight(S, S.x + dx, S.z + dz)), warm: true });
    const F = K.ISLAND.falls, a = Math.atan2(-F.z, -F.x), ox = Math.cos(a), oz = Math.sin(a);
    const px = F.x + ox * F.r * 0.35, pz = F.z + oz * F.r * 0.35, level = Math.round(islandHeight(F, px, pz));
    let d = F.r * 0.35;
    while (d < F.r * 1.3 && Math.round(islandHeight(F, F.x + ox * d, F.z + oz * d)) >= level - 1) d += 0.25;
    const ex = F.x + ox * d, ez = F.z + oz * d;
    POOLS.push({ x: px, z: pz, r: 1.6, level, warm: false });
    const B = K.ISLAND.bamboo, BP = K.BAMBOO_POND;
    POOLS.push({ x: B.x + BP.dx, z: B.z + BP.dz, r: BP.r, level: Math.max(2, Math.round(islandHeight(B, B.x + BP.dx, B.z + BP.dz)) - 1), warm: false, koi: true });
    FALLS = { ax: px, az: pz, bx: ex - ox * 0.6, bz: ez - oz * 0.6, level, edge: { x: ex - ox * 0.45, z: ez - oz * 0.45 }, out: { x: ox, z: oz } };
  }
  const segDist = (x, z, ax, az, bx, bz) => {
    const vx = bx - ax, vz = bz - az, k = clamp(((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz || 1), 0, 1);
    return Math.hypot(x - ax - vx * k, z - az - vz * k);
  };
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
    if (isl && (isl.id === 'rocks' || (isl.id === 'pine' && h >= 6) || (isl.id === 'springs' && h >= 3))) rock = 1;
    if (isl && isl.id === 'glacier' && h >= 0) rock = 2;   // ice
    let tn = 0;
    if (isl && isl.id === 'dunes' && h >= 0) tn = 1;
    if (isl && isl.id === 'basalt' && h >= 0) {
      // moss and turf on some of the highest columns, black sand below the cliffs
      if (h >= 2) rock = h >= 5 && fbm(x * 0.3, z * 0.3, 63, 2) > 0.52 ? 0 : 3;
      else tn = 2;
    }
    if (isl && isl.id === 'stones') {
      for (const st of STONE_RING) if (Math.round(x) === st.x && Math.round(z) === st.z) { h += st.h; rock = 1; }
    }
    for (const sk of SKERRIES) {
      const d = Math.hypot(x - sk.x, z - sk.z);
      if (d < sk.r) { const hs = Math.round(sk.h * (1 - (d / sk.r) ** 2) + fbm(x * 0.5, z * 0.5, 71, 2) * 0.8); if (hs > h) { h = hs; rock = 1; } }
    }
    let bed = false;   // the floor of a pool or stream: no grass grows there
    for (const p of POOLS) {
      const pd = Math.hypot(x - p.x, z - p.z);
      if (pd < p.r) { h = p.level - 1; if (p.warm) rock = 1; else bed = true; }
      else if (p.warm && pd < p.r + 1.1 && h >= p.level - 1) { h = p.level; rock = 1; }
    }
    if (FALLS && isl && isl.id === 'falls' && segDist(x, z, FALLS.ax, FALLS.az, FALLS.bx, FALLS.bz) < 0.75 && h >= FALLS.level - 1) { h = FALLS.level - 1; bed = true; }
    const AR = K.ARCH;
    for (const sgn of [-1, 1]) {
      const ax = AR.x + Math.cos(AR.dir) * AR.span * sgn, az = AR.z + Math.sin(AR.dir) * AR.span * sgn;
      if (Math.hypot(x - ax, z - az) < 1.6) { h = Math.max(h, 7); rock = 1; }
      else if (Math.hypot(x - ax, z - az) < 2.6) { h = Math.max(h, -1 + Math.round(fbm(x, z, 5, 2) * 2)); rock = 1; }
    }
    const I = K.ISLET, id = Math.hypot(x - I.x, z - I.z) / I.r;
    if (id < 1.3) { const hi = Math.round((1 - id * id) * 3.4 + 0.2); if (hi > h) { h = hi; rock = 1; } }
    for (const s of K.STACKS) if (Math.hypot(x - s[0], z - s[1]) < s[2] && s[3] > h) { h = s[3]; rock = 1; }
    return [clamp(h, -7, 9), rock, owner, bed && !rock ? 3 : tn];
  }
  // Standing Stones: ten pillars in a ring, one of them fallen. Relative heights above the turf.
  const STONE_RING = [];
  // Skerries: bare rocks scattered over the open sea, kept clear of the islands and the routes between them.
  const SKERRIES = [];
  function planScenery() {
    const ST = K.ISLAND.stones;
    for (let k = 0; k < 10; k++) {
      const a = k / 10 * Math.PI * 2 + 0.2;
      STONE_RING.push({ x: Math.round(ST.x + Math.cos(a) * 5.6), z: Math.round(ST.z + Math.sin(a) * 5.6), h: k === 6 ? 1 : k % 3 === 0 ? 2 : 3 });
    }
    STONE_RING.push({ x: ST.x, z: ST.z, h: 1 });   // a low stone at the centre
    const rng = mulberry32(515), isl = K.ISLANDS;
    for (let tries = 0; tries < 400 && SKERRIES.length < 26; tries++) {
      const a = rng() * Math.PI * 2, r = 34 + rng() * 170, x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (Math.abs(x) > 205 || Math.abs(z) > 205) continue;
      if (isl.some((I) => Math.hypot(x - I.x, z - I.z) < I.r * 2.2 + 9)) continue;
      if (Math.hypot(x - K.ARCH.x, z - K.ARCH.z) < 16 || Math.hypot(x - K.ISLET.x, z - K.ISLET.z) < 10) continue;
      let onRoute = false;
      for (let i = 0; i < isl.length && !onRoute; i++) for (let j = i + 1; j < isl.length; j++) if (segDist(x, z, isl[i].x, isl[i].z, isl[j].x, isl[j].z) < 9) { onRoute = true; break; }
      if (onRoute || SKERRIES.some((k) => Math.hypot(x - k.x, z - k.z) < 14)) continue;
      SKERRIES.push({ x, z, r: 1.4 + rng() * 1.6, h: 1 + rng() * 2.6 });
    }
    K.SKERRIES = SKERRIES;
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
  TPAL[6] = U.pal4(...Array(4).fill([0xd6edf7, 0xc6e3f0, 0xe2f3fa, 0xcfe8f3]));   // glacier ice, the same in every season
  // 8 basalt column tops, 9 black sand, 10 basalt sides
  TPAL[8] = U.pal4([0x4f545b, 0x575c62, 0x484d54], [0x4f545b, 0x575c62, 0x484d54], [0x4f545b, 0x575c62, 0x4b4f53], [0xe6ecef, 0x575c62, 0xdde5e9]);
  TPAL[9] = U.pal4([0x484a4c, 0x404244, 0x515355], [0x484a4c, 0x404244, 0x515355], [0x46484a, 0x3f4143], [0x8e9296, 0x6c7074, 0x55585b]);
  const TSTATIC = { 0: hex(0xbca87f), 3: hex(0x8d6f50), 4: hex(0x9a9f9b), 7: hex(0xb8dbe6), 10: hex(0x44484f) };
  let terrain, tKind, tRand, tJit, lastTerrainS = -99;
  W.blocks = [];
  W.cols = { grass: [], sand: [], shallow: [], ring: [] };   // the home island's
  W.islands = K.ISLANDS;

  function initTerrain() {
    K.ISLANDS.forEach((I, idx) => { I.idx = idx; I.cols = { grass: [], sand: [], shallow: [], ring: [], rock: [] }; });
    planPools(); planScenery();
    for (let ix = 0; ix < G; ix++) for (let iz = 0; iz < G; iz++) {
      const x = ix + MINX, z = iz + MINX, [h, rock, own, tn] = rawHeight(x, z), i = ix * G + iz;
      heights[i] = h; rocky[i] = rock; owner[i] = own; tint[i] = tn;
      const kind = own >= 0 ? K.ISLANDS[own].id : '';
      const nearPond = Math.hypot(x - K.POND.x, z - K.POND.z) < K.POND.r + 3;
      const meadowy = kind === 'home' || kind === 'pine' ? h >= 2 || (h === 1 && (nearPond || fbm(x * 0.3, z * 0.3, 41, 2) > 0.42))
        : kind === 'blossom' || kind === 'meadow' || kind === 'springs' || kind === 'falls' || kind === 'bamboo' || kind === 'orchard' || kind === 'oldtree' || kind === 'stones' ? h >= 1
        : kind === 'basalt' ? h >= 5
        : kind === 'marsh' ? h >= 1 || (h === 0 && fbm(x * 0.4, z * 0.4, 52, 2) > 0.45) : false;
      grassy[i] = !rock && meadowy && tn !== 3 ? 1 : 0;
    }
    const blocks = W.blocks, rng = mulberry32(7);
    for (let ix = 0; ix < G; ix++) for (let iz = 0; iz < G; iz++) {
      const i = ix * G + iz, h = heights[i], x = ix + MINX, z = iz + MINX;
      if (h <= -5) continue;   // too deep to see through the water
      const minN = Math.min(colH(ix - 1, iz), colH(ix + 1, iz), colH(ix, iz - 1), colH(ix, iz + 1));
      for (let lv = Math.max(-7, Math.min(h, minN + 1)); lv <= h; lv++) {
        let kind;
        const tn = tint[i], basalt = owner[i] === K.ISLAND.basalt.idx;
        if (lv === h) kind = h <= -1 || tn === 3 ? 0 : rocky[i] === 2 ? 6 : rocky[i] === 3 ? 8 : rocky[i] ? 5 : grassy[i] ? 2 : tn === 2 ? 9 : 1;
        else if (rocky[i] === 2) kind = 7;
        else if (rocky[i] === 3 || (basalt && h >= 2)) kind = 10;
        else if (rocky[i]) kind = 4;
        else if (tn === 1) kind = h - lv <= 3 ? 1 : 3;
        else if (h <= 1) kind = h <= -1 ? 0 : tn === 2 ? 9 : 1;
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
        else if (h >= 0 && h <= 5 && tint[i] !== 3) C.sand.push(col);
        else if (h === -1) C.shallow.push(col);
        else if (h <= -2 && h >= -3) C.ring.push(col);
      }
    }
    Object.assign(K.ISLAND.home.cols, W.cols);
    W.local = W.island.cols;
    const mat = W.voxelMat(0xffffff, { edges: 0.15, texel: 8, texAmt: 0.075, grassSide: true, caustics: true, wet: true, shininess: 10 });
    const tgeo = new THREE.BoxGeometry(1, 1, 1);
    tgeo.setAttribute('aKind', new THREE.InstancedBufferAttribute(new Float32Array(blocks.map((b) => b[3])), 1));
    terrain = new THREE.InstancedMesh(tgeo, mat, blocks.length);
    tKind = new Uint8Array(blocks.length); tRand = new Float32Array(blocks.length); tJit = new Float32Array(blocks.length);
    const m = new THREE.Matrix4();
    blocks.forEach((b, i) => {
      m.makeTranslation(b[0], b[1], b[2]); terrain.setMatrixAt(i, m);
      tKind[i] = b[3]; tRand[i] = rng(); tJit[i] = (rng() - 0.5) * 0.07;
      if (TPAL[b[3]]) U.seasonColor(TPAL[b[3]], tRand[i], S.season, tmpC);
      else tmpC.copy(TSTATIC[b[3]] || TSTATIC[0]);
      terrain.setColorAt(i, tmpC.multiplyScalar(1 + tJit[i]));
    });
    terrain.castShadow = true; terrain.receiveShadow = true;
    scene.add(terrain);
    W.terrain = terrain;
    lastTerrainS = S.season;

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
  // Seasonal recolouring is spread over several frames, and each frame uploads only the slice it touched,
  // so the turn of the seasons never stalls a frame. Rock, soil and ice keep the colours set at build time.
  let tCursor = -1, tPassS = 0;
  function recolorTerrain(Sv, count) {
    if (tCursor < 0) { tCursor = 0; tPassS = Sv; }
    const n = tKind.length, from = tCursor, end = Math.min(n, from + count), attr = terrain.instanceColor;
    for (let i = from; i < end; i++) {
      const k = tKind[i];
      if (k === 6 || !TPAL[k]) continue;
      U.seasonColor(TPAL[k], tRand[i], tPassS, tmpC);
      terrain.setColorAt(i, tmpC.multiplyScalar(1 + tJit[i]));
    }
    if (end > from) W.queueUpload(attr, from, end - 1);
    tCursor = end >= n ? -1 : end;
    if (tCursor < 0) lastTerrainS = tPassS;
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
    // inputs from the post-processing pipeline
    uClear: { value: 1 }, uWind: { value: 0.4 }, uPost: { value: 0 }, uReflOn: { value: 0 }, tRefl: { value: null }, tScene: { value: null },
    uRes: { value: new THREE.Vector2(1, 1) }, uTexMat: { value: new THREE.Matrix4() }, uNear: { value: 0.3 }, uFar: { value: 2400 },
    uCloudTex: PU.uCloudTex, uCloudSh: PU.uCloudSh,
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
    for (const k of ['tRefl', 'tScene']) waterU[k].value = dummyTex;
    const geo = new THREE.PlaneGeometry(900, 900, 300, 300);
    geo.rotateX(-Math.PI / 2);
    const vtex = renderer.capabilities.vertexTextures ? '#define VTEX\n' : '';
    const water = new THREE.Mesh(geo, new THREE.ShaderMaterial({
      uniforms: waterU, transparent: true, depthWrite: true,
      vertexShader: vtex + WAVE + `
        uniform sampler2D uHeight; uniform vec2 uHX; uniform float uWL; uniform mat4 uTexMat;
        varying vec3 vW; varying vec4 vRefl; varying float vVZ;
        void main(){
          vec4 w = modelMatrix * vec4(position, 1.0);
          float damp = 1.0;
          #ifdef VTEX
            float bed = texture2D(uHeight, (w.xz - vec2(uHX.x) + 0.5) / uHX.y).r * 255.0 / 16.0 - 8.0;
            damp = mix(0.3, 1.0, smoothstep(0.0, 3.0, uWL - bed));
          #endif
          w.y += waveH(w.xz) * damp + (uBreath - 0.5) * 0.07;
          vW = w.xyz;
          vRefl = uTexMat * vec4(w.xyz, 1.0);
          vec4 mv = viewMatrix * w; vVZ = -mv.z;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: WAVE + CLOUD_GLSL + `
        uniform vec3 uSunDir, uSunCol, uTop, uHor, uFog, uCam, uShallow, uDeep, uBioCol;
        uniform float uFogNear, uFogFar, uNight, uWL, uRain, uBio, uPost, uReflOn, uNear, uFar, uClear, uWind;
        uniform sampler2D uHeight, tRefl, tScene; uniform vec2 uHX, uRes; uniform vec4 uRip[10];
        varying vec3 vW; varying vec4 vRefl; varying float vVZ;
        float h12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
        float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(h12(i), h12(i + vec2(1, 0)), f.x), mix(h12(i + vec2(0, 1)), h12(i + vec2(1, 1)), f.x), f.y); }
        void main(){
          vec2 p = vW.xz;
          float e = 0.15, hc = waveH(p);
          vec3 n = vec3(hc - waveH(p + vec2(e, 0.0)), e, hc - waveH(p + vec2(0.0, e)));
          // two drifting layers of fine ripples on top of the swell
          float d1 = vn(p * 1.3 + vec2(uTime * 0.25, uTime * 0.12)) - vn(p * 1.3 + vec2(-uTime * 0.18, uTime * 0.2));
          float d2 = vn(p * 4.1 + vec2(-uTime * 0.6, uTime * 0.35)) - vn(p * 3.7 + vec2(uTime * 0.45, -uTime * 0.5));
          n.xz += vec2(d1, -d1) * 0.05 + vec2(d2, d2 * 0.7) * 0.025;
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
          vec3 V = normalize(uCam - vW), L = normalize(uSunDir);
          float bed = texture2D(uHeight, (p - vec2(uHX.x) + 0.5) / uHX.y).r * 255.0 / 16.0 - 8.0;
          float depth = uWL - bed;
          float ndv = max(dot(n, V), 0.0);
          vec3 Rf = reflect(-V, n);
          vec3 skyc = mix(uHor, uTop, clamp(Rf.y * 1.6, 0.0, 1.0));
          // under a cloud's shadow the sea loses its glitter and turns a deeper, duller blue
          float cs = swCloudShade(vW);
          float spec = pow(max(dot(reflect(-L, n), V), 0.0), 220.0) * cs * cs;
          float glint = pow(h12(floor(p * 16.0) + floor(uTime * 5.0)), 30.0) * pow(max(dot(reflect(-L, n), V), 0.0), 10.0) * cs * cs;
          vec3 col; float alpha = 1.0;
          if (uPost > 0.5) {
            // refraction of the opaque scene, coloured by how much water the light passes through
            // the scene behind the water (already darkened by occlusion) holds each surface's distance in alpha
            vec2 suv = gl_FragCoord.xy / uRes;
            float surfZ = vVZ, thick = max(texture2D(tScene, suv).a - surfZ, 0.0);
            vec2 ruv = clamp(suv + n.xz * 0.05 * clamp(thick * 0.5, 0.0, 1.0), vec2(0.001), vec2(0.999));
            if (texture2D(tScene, ruv).a < surfZ) ruv = suv;
            vec3 refr = texture2D(tScene, ruv).rgb;
            vec3 tint = mix(vec3(1.0), uShallow * 1.35, 0.6);
            vec3 body = mix(refr * tint, uDeep, 1.0 - exp(-thick * 0.3));
            vec3 refl = skyc;
            if (uReflOn > 0.5) refl = texture2D(tRefl, clamp(vRefl.xy / vRefl.w + n.xz * 0.04, vec2(0.001), vec2(0.999))).rgb;
            float fres = 0.02 + 0.98 * pow(1.0 - ndv, 5.0);
            col = mix(body * mix(1.0, cs, 0.6), refl, clamp(fres * 1.1 + 0.06, 0.0, 1.0));
            col += uSunCol * (spec * 3.5 + glint * 2.5 * uClear) * (1.0 - uNight * 0.6) * (0.3 + 0.7 * uClear);
          } else {
            col = mix(uShallow, uDeep, smoothstep(0.0, 3.6, depth)) * mix(1.0, cs, 0.6);
            col = mix(col, skyc, 0.12 + 0.68 * pow(1.0 - ndv, 4.0));
            col += uSunCol * spec * 1.2;
          }
          col += uSunCol * ring * 0.08 + vec3(rr * 0.05);
          float line = 0.5 + 0.3 * uBreath + 0.07 * sin(uTime * 0.7 + p.x * 0.4 + p.y * 0.3);
          float foam = (1.0 - smoothstep(0.05, line, depth)) * smoothstep(0.3, 0.7, vn(p * 2.6 + uTime * 0.12));
          foam = max(foam, (1.0 - smoothstep(0.0, 0.25, depth)) * 0.6 * vn(p * 6.0 - uTime * 0.3));
          // whitecaps on the crests when the wind is up
          float crest = smoothstep(0.55, 0.95, hc / max(uAmp, 0.001)) * smoothstep(0.55, 1.0, uWind) * smoothstep(1.0, 4.0, depth);
          foam = max(foam, crest * smoothstep(0.55, 0.8, vn(p * 3.0 + uTime * 0.5)) * 0.8);
          col = mix(col, vec3(0.95, 0.97, 0.96) * (1.0 - 0.72 * uNight), foam * 0.75);
          col += uBioCol * uBio * (ring * 1.2 + foam * 0.42 + rr * 0.4);
          if (uPost < 0.5) alpha = max(mix(0.48, 1.0, smoothstep(0.3, 4.5, depth)), foam * 0.85);
          float f = smoothstep(uFogNear, uFogFar, length(uCam - vW));
          gl_FragColor = vec4(mix(col, uFog, f), mix(alpha, 1.0, f));
        }`,
    }));
    water.renderOrder = 1;
    water.position.y = K.WL;   // the swell is added in the shader; the surface rests at the water level
    W.late(water);
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
  const hillSnow = { value: 0 };
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
      mat.onBeforeCompile = (sh) => {
        sh.uniforms.uSnow = hillSnow;
        sh.vertexShader = 'varying float vY;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vY = position.y + 0.5;');
        sh.fragmentShader = 'varying float vY; uniform float uSnow;\n' + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
          diffuseColor.rgb *= mix(1.06, 0.9, vY);
          diffuseColor.rgb = mix(diffuseColor.rgb, min(diffuseColor.rgb * 1.3 + 0.05, vec3(1.0)), smoothstep(0.82, 0.9, vY) * uSnow);`);
      };
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
    const white = W.voxelMat(0xf2efe8, { edges: 0.1, texel: 10, texAmt: 0.04 }), red = W.voxelMat(0xb8453a, { edges: 0.1, texel: 10, texAmt: 0.05 }), dark = W.voxelMat(0x3a3f46, { edges: 0.1 });
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
    W.late(beam);
    g.add(beam);
    W.lighthouse = { g, lampMat, beam, beamMat, top: new THREE.Vector3(I.x, base + top + 0.55, I.z) };
  }

  // ------------------------------------------------------------------- clouds
  const clouds = [], NCLOUD = 24;
  // Clouds: puffy voxel heaps with their own shading. Sunlit tops, cool undersides, and a bright
  // silver lining around the edges when the sun is behind them.
  const cloudU = {
    uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uSunCol: { value: new THREE.Color() }, uLit: { value: new THREE.Color() }, uShade: { value: new THREE.Color() },
    uCam: { value: new THREE.Vector3() }, uFog: { value: new THREE.Color() }, uFogNear: { value: 70 }, uFogFar: { value: 240 }, uNight: { value: 0 },
  };
  function initClouds() {
    const rng = mulberry32(99);
    const mat = new THREE.ShaderMaterial({
      uniforms: cloudU,
      vertexShader: `varying vec3 vN, vW, vL; varying float vVD;
        void main(){
          vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);
          vN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal); vW = w.xyz; vL = position;
          vec4 mv = viewMatrix * w; vVD = -mv.z;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `uniform vec3 uSunDir, uSunCol, uLit, uShade, uCam, uFog; uniform float uFogNear, uFogFar, uNight;
        varying vec3 vN, vW, vL; varying float vVD;
        void main(){
          vec3 n = normalize(vN), L = normalize(uSunDir), V = normalize(uCam - vW);
          float up = n.y * 0.5 + 0.5, lit = max(dot(n, L), 0.0);
          vec3 col = mix(uShade, uLit, clamp(0.2 + 0.45 * up + 0.45 * lit, 0.0, 1.0));
          // light through the thin edges when the sun is behind: strongest on faces seen edge-on
          float back = pow(max(dot(-V, L), 0.0), 5.0), rim = 1.0 - abs(dot(n, V));
          col += uSunCol * back * (0.3 + 0.7 * rim * rim) * 0.9 * (1.0 - uNight);
          gl_FragColor = vec4(mix(col, uFog, smoothstep(uFogNear, uFogFar, length(uCam - vW))), vVD);
        }`,
    });
    for (let c = 0; c < NCLOUD; c++) {
      const vox = [], v = 1.4, sx = 5 + ((rng() * 3) | 0), sz = 3 + ((rng() * 2) | 0);
      for (let x = -sx; x <= sx; x++) for (let z = -sz; z <= sz; z++) for (let y = 0; y <= 3; y++) {
        const e = (x / (sx + 0.5)) ** 2 + (z / (sz + 0.5)) ** 2 + ((y - 0.3) / 2.2) ** 2;
        const bump = fbm(x * 0.45 + c * 9, z * 0.45 + y * 3, 77, 3);
        if (e < 0.45 + bump * 0.6 - y * 0.06) vox.push([x * v, y * v * 0.75, z * v]);
      }
      const im = new THREE.InstancedMesh(W.boxGeo, mat, vox.length);
      const m = new THREE.Matrix4();
      vox.forEach((p, i) => { m.makeScale(v, v * 0.75, v); m.setPosition(p[0], p[1], p[2]); im.setMatrixAt(i, m); });
      const a = rng() * Math.PI * 2, r = 12 + rng() * 210;
      im.position.set(Math.cos(a) * r, 26 + rng() * 10, Math.sin(a) * r);
      clouds.push({ mesh: im, speed: 0.5 + rng() * 0.4, th: (c / NCLOUD) * 0.92, rx: (sx + 0.5) * v, rz: (sz + 0.5) * v });
      scene.add(im);
    }
  }
  function updateClouds(dt) {
    const wx = S.weather, E = W.env, gloom = Math.max(wx.rain, wx.snow * 0.5);
    cloudU.uSunDir.value.copy(lightDir); cloudU.uSunCol.value.copy(E.sun).multiplyScalar(1 - E.over * 0.7);
    cloudU.uLit.value.setRGB(1, 1, 1).lerp(E.sun, 0.25 + W.golden() * 0.45).lerp(E.top, S.night * 0.55).multiplyScalar((1 - 0.38 * gloom) * (1 - S.night * 0.55));
    cloudU.uShade.value.copy(E.hor).lerp(E.top, 0.55).multiplyScalar(0.8 * (1 - 0.35 * gloom));
    cloudU.uCam.value.copy(camera.position); cloudU.uFog.value.copy(scene.fog.color);
    cloudU.uFogNear.value = scene.fog.near; cloudU.uFogFar.value = scene.fog.far; cloudU.uNight.value = S.night;
    const amount = clamp(wx.cloud + wx.rain * 0.2, 0, 1), speed = 0.4 + wx.wind * 1.2;
    for (const c of clouds) {
      const vis = smooth(c.th, c.th + 0.12, amount);
      // clouds gather and dissolve by growing and shrinking
      c.mesh.visible = vis > 0.02;
      c.mesh.scale.setScalar(Math.max(0.02, U.smooth(0, 1, vis)));
      const p = c.mesh.position;
      p.x += 0.6 * c.speed * speed * dt; p.z += 0.22 * c.speed * speed * dt;
      if (p.x > 250) { p.x -= 500; p.z = (Math.random() - 0.5) * 440; }
      if (p.z > 250) p.z -= 500;
    }
  }

  // ---------------------------------------------------------- cloud shadows
  // Each frame the clouds' shadows are drawn into a small texture covering the whole archipelago:
  // every cloud becomes a soft, lumpy patch, shifted along the sun's rays from its height. Land, grass
  // and sea then darken where it falls, so patches of shade drift over the islands beneath the clouds.
  const csRT = new THREE.WebGLRenderTarget(CS_RES, CS_RES, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false, stencilBuffer: false });
  csRT.texture.generateMipmaps = false;
  PU.uCloudTex.value = csRT.texture;
  W.cloudShadowTarget = csRT;
  const csC = Array.from({ length: NCLOUD }, () => new THREE.Vector4()), csR = Array.from({ length: NCLOUD }, () => new THREE.Vector2(1, 1));
  const csU = { uC: { value: csC }, uR: { value: csR }, uOff: { value: new THREE.Vector2() } };
  const csScene = new THREE.Scene(), csCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const csQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    uniforms: csU, depthTest: false, depthWrite: false,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: `#define NC ${NCLOUD}
      uniform vec4 uC[NC]; uniform vec2 uR[NC]; uniform vec2 uOff;
      varying vec2 vUv;
      float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(h(i), h(i + vec2(1.0, 0.0)), f.x), mix(h(i + vec2(0.0, 1.0)), h(i + vec2(1.0, 1.0)), f.x), f.y); }
      void main(){
        vec2 p = (vUv - 0.5) * ${CS_SPAN.toFixed(1)};
        float s = 0.0;
        for (int i = 0; i < NC; i++) {
          vec4 c = uC[i];
          if (c.w <= 0.0) continue;
          vec2 rel = p + uOff * c.y - c.xz;
          float d = length(rel / uR[i]) + (n2(rel * 0.3 + float(i) * 13.1) - 0.5) * 0.5;
          s = max(s, c.w * (1.0 - smoothstep(0.3, 1.1, d)));
        }
        gl_FragColor = vec4(vec3(s), 1.0);
      }`,
  }));
  csQuad.frustumCulled = false;
  csScene.add(csQuad);
  let csOn = false;
  function updateCloudShadows() {
    const L = lightDir, up = Math.max(L.y, 0.2);
    const amt = S.quality === 'low' ? 0 : 0.64 * (1 - W.env.over * 0.55) * S.dayness * smooth(0.02, 0.15, skySun.y);
    csU.uOff.value.set(L.x / up, L.z / up);
    PU.uCloudSh.value.set(L.x / up, L.z / up, amt);
    csOn = amt > 0.01;
    clouds.forEach((c, i) => {
      const p = c.mesh.position, k = c.mesh.visible ? c.mesh.scale.x : 0;
      csC[i].set(p.x, p.y + 1.2, p.z, k > 0.05 ? smooth(0.05, 0.6, k) : 0);
      csR[i].set(c.rx * 1.25 * Math.max(k, 0.05), c.rz * 1.3 * Math.max(k, 0.05));
    });
  }
  function renderCloudShadows() {
    if (!csOn) return;
    renderer.setRenderTarget(csRT);
    renderer.render(csScene, csCam);
    renderer.setRenderTarget(null);
  }

  // --------------------------------------------------------------------- dock
  function initDock() {
    const dock = new THREE.Group();
    const angle = 0.65 + Math.PI / 2 + 0.35, dir = new THREE.Vector2(Math.cos(angle), Math.sin(angle));
    let r0 = 2;
    while (r0 < 26 && W.heightAt(dir.x * r0, dir.y * r0) > 0) r0 += 0.5;
    const wood = W.voxelMat(0x9a7a5a, { edges: 0.2, texel: 10, texAmt: 0.08, wet: true }), woodDark = W.voxelMat(0x7a5d44, { edges: 0.2, texel: 10, texAmt: 0.08, wet: true });
    const add = (mat, sx, sy, sz, x, y, z) => { const m = new THREE.Mesh(W.boxGeo, mat); m.scale.set(sx, sy, sz); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; dock.add(m); return m; };
    const len = 7, start = r0 - 1.5;
    for (let i = 0; i < len / 0.45; i++) add(i % 3 === 1 ? woodDark : wood, 0.38, 0.14, 2.1, start + i * 0.45, 0.12, 0);
    for (let i = 0; i <= 3; i++) for (const s of [-1, 1]) add(woodDark, 0.2, 1.6, 0.2, start + 0.6 + i * 2.1, -0.55, s * 0.95);
    const end = start + len - 0.4;
    add(woodDark, 0.14, 1.5, 0.14, end, 0.9, 0.85);
    add(woodDark, 0.5, 0.1, 0.1, end - 0.2, 1.6, 0.85);
    const lanternMat = W.patch(new THREE.MeshPhongMaterial({ color: 0xffe2b0, emissive: 0xffa95c, emissiveIntensity: 0.4, shininess: 30 }), { edges: 0.25 });
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
    const wood = W.voxelMat(0x9a7a5a, { edges: 0.2, texel: 10, texAmt: 0.08, wet: true }), dark = W.voxelMat(0x7a5d44, { edges: 0.2, texel: 10, texAmt: 0.08, wet: true });
    for (const I of K.ISLANDS) {
      let peak = 0;
      for (const c of [].concat(I.cols.grass, I.cols.sand, I.cols.rock)) peak = Math.max(peak, c[2]);
      I.center = new THREE.Vector3(I.x, clamp(peak * 0.35, 0.5, 3) + (I.lift || 0), I.z);
      if (I.id === 'home') {
        I.center.y = 1.4;
        const a = W.dock.angle;
        I.out = new THREE.Vector2(Math.cos(a), Math.sin(a));
        I.landing = new THREE.Vector3(W.dock.end.x + I.out.x * 1.8, K.WL, W.dock.end.z + I.out.y * 1.8);
        W.decks.push({ ax: W.dock.start.x - I.out.x * 1.2, az: W.dock.start.z - I.out.y * 1.2, bx: W.dock.end.x + I.out.x * 0.4, bz: W.dock.end.z + I.out.y * 0.4, hw: 0.95, y: 0.19 });
        W.seats.push({ x: W.dock.end.x + I.out.x * 0.25, y: 0.19, z: W.dock.end.z + I.out.y * 0.25, angle: a, kind: 'edge' });
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
      W.decks.push({ ax: sx - ox * 0.6, az: sz - oz * 0.6, bx: sx + ox * 2.5, bz: sz + oz * 2.5, hw: 0.7, y: deck + 0.06 });
      W.seats.push({ x: sx + ox * 2.3, y: deck + 0.06, z: sz + oz * 2.3, angle: a, kind: 'edge' });
      for (let i = 0; i < 7; i++) add(i % 3 === 1 ? dark : wood, 0.38, 0.12, 1.5, -0.4 + i * 0.45, deck, 0);
      for (const x of [0.9, 2.3]) for (const z of [-0.65, 0.65]) add(dark, 0.16, deck + 1.4, 0.16, x, (deck - 1.4) / 2, z);
      W.scene.add(g);
    }
  }
  W.decks = [];   // walkable planks: { ax, az, bx, bz, hw (half width), y }
  W.seats = [];   // places to sit or soak: { x, y, z, angle, kind }
  W.deckAt = function (x, z) {
    for (const d of W.decks) if (segDist(x, z, d.ax, d.az, d.bx, d.bz) < d.hw) return d.y;
    return null;
  };

  // ------------------------------------------- springs, waterfall and sea arch
  const poolU = { uTime: { value: 0 } };
  const POOL_FS = `uniform float uTime; uniform vec3 uCol; varying vec3 vW;
    void main(){
      float r = sin(vW.x * 3.1 + uTime * 1.3) * sin(vW.z * 2.7 - uTime * 1.1) + 0.5 * sin((vW.x + vW.z) * 5.0 + uTime * 2.0);
      gl_FragColor = vec4(uCol * (0.92 + 0.12 * r), 0.82);
    }`;
  const W_VS = `varying vec3 vW; varying vec2 vUv; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
  let fallsMat, mistTimer = 0;
  function initFeatures() {
    for (const p of POOLS) {
      const mat = new THREE.ShaderMaterial({ uniforms: { uTime: poolU.uTime, uCol: { value: new THREE.Color(p.warm ? 0x8fd8d0 : 0x6cc0d8) } }, vertexShader: W_VS, fragmentShader: POOL_FS, transparent: true, depthWrite: false });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(p.r * 2 + 0.4, p.r * 2 + 0.4), mat);
      m.rotation.x = -Math.PI / 2; m.position.set(p.x, p.level - 0.25, p.z); m.renderOrder = 2;
      W.late(m);
      scene.add(m);
      if (p.warm) W.seats.push({ x: p.x, y: p.level - 1, z: p.z, angle: Math.atan2(p.z - K.ISLAND.springs.z, p.x - K.ISLAND.springs.x), kind: 'soak' });
    }
    // the stream across the mesa, and the falls themselves
    const F = FALLS, len = Math.hypot(F.bx - F.ax, F.bz - F.az), ang = Math.atan2(F.bz - F.az, F.bx - F.ax);
    const stream = new THREE.Mesh(new THREE.PlaneGeometry(len + 0.6, 1.3), new THREE.ShaderMaterial({ uniforms: { uTime: poolU.uTime, uCol: { value: new THREE.Color(0x6cc0d8) } }, vertexShader: W_VS, fragmentShader: POOL_FS, transparent: true, depthWrite: false }));
    stream.rotation.set(-Math.PI / 2, 0, -ang); stream.position.set((F.ax + F.bx) / 2, F.level - 0.25, (F.az + F.bz) / 2); stream.renderOrder = 2;
    W.late(stream);
    scene.add(stream);
    const top = F.level - 0.25, hgt = top - K.WL + 0.2;
    fallsMat = new THREE.ShaderMaterial({
      uniforms: { uTime: poolU.uTime }, transparent: true, depthWrite: false, side: THREE.DoubleSide,
      vertexShader: W_VS,
      fragmentShader: `uniform float uTime; varying vec2 vUv; varying vec3 vW;
        float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
        void main(){
          float col = floor(vUv.x * 14.0);
          float streak = fract(vUv.y * 3.0 + uTime * (1.2 + h(vec2(col, 1.0)) * 0.8) + h(vec2(col, 7.0)));
          float edge = smoothstep(0.0, 0.12, vUv.x) * smoothstep(1.0, 0.88, vUv.x);
          vec3 c = mix(vec3(0.62, 0.82, 0.9), vec3(0.96, 0.99, 1.0), smoothstep(0.5, 1.0, streak));
          gl_FragColor = vec4(c, (0.55 + 0.4 * streak) * edge);
        }`,
    });
    const falls = new THREE.Mesh(new THREE.PlaneGeometry(1.5, hgt), fallsMat);
    falls.position.set(F.edge.x + F.out.x * 0.35, top - hgt / 2, F.edge.z + F.out.z * 0.35);
    falls.rotation.y = Math.atan2(F.out.x, F.out.z);
    falls.renderOrder = 2;
    W.late(falls);
    scene.add(falls);
    W.waterfall = new THREE.Vector3(F.edge.x + F.out.x * 0.6, K.WL, F.edge.z + F.out.z * 0.6);
    W.waterfallTop = top;
    W.springs = new THREE.Vector3(K.ISLAND.springs.x, 2, K.ISLAND.springs.z);
    W.pools = POOLS;
    W.mist = W.makeEmitter(260, 'soft', false, 320);
    // the sea arch: a span of rock between two pillars
    const AR = K.ARCH, ca = Math.cos(AR.dir), sa = Math.sin(AR.dir), blocks = [], rng = mulberry32(61);
    for (let u = -AR.span; u <= AR.span; u += 1) {
      const under = 1.2 + 4.8 * Math.cos(Math.PI * u / (2 * AR.span + 2)), topY = 8 + Math.round(rng() * 0.8);
      for (let v = -1; v <= 1; v++) for (let y = Math.max(0, Math.round(under)); y < topY; y++) {
        if (Math.abs(v) === 1 && y === topY - 1 && rng() < 0.5) continue;
        blocks.push([AR.x + ca * u - sa * v, y + 0.5, AR.z + sa * u + ca * v]);
      }
    }
    const arch = new THREE.InstancedMesh(W.boxGeo, W.voxelMat(0xffffff, { edges: 0.16, texel: 8, texAmt: 0.08, caustics: true, wet: true }), blocks.length), m4 = new THREE.Matrix4();
    blocks.forEach((b, i) => { m4.makeTranslation(b[0], b[1], b[2]); arch.setMatrixAt(i, m4); arch.setColorAt(i, hex(U.pick(rng, [0x8f948f, 0x9a9f9b, 0x86907f, 0xa7aba6]))); });
    arch.castShadow = arch.receiveShadow = true;
    scene.add(arch);
    W.arch = new THREE.Vector3(AR.x, 4, AR.z);
  }
  function updateFeatures(dt, t) {
    poolU.uTime.value = t;
    const F = W.focus;
    mistTimer -= dt;
    if (mistTimer <= 0) {
      mistTimer = 0.08;
      if (W.waterfall.distanceTo(F) < 70) {
        const p = W.waterfall;
        W.mist.emit({ x: p.x + (Math.random() - 0.5) * 1.6, y: K.WL + 0.2, z: p.z + (Math.random() - 0.5) * 1.6, vx: (Math.random() - 0.5) * 0.6, vy: 0.5 + Math.random() * 0.6, vz: (Math.random() - 0.5) * 0.6, life: 2.5, size: 2, size2: 7, alpha: 0.35, r: 0.95, g: 0.97, b: 1, wind: 0.5 });
        if (Math.random() < 0.15) W.addRipple(p.x + W.waterfallOut().x * 1.2, p.z + W.waterfallOut().z * 1.2, 0.5);
      }
      if (W.springs.distanceTo(F) < 60) for (const p of POOLS) {
        if (!p.warm || Math.random() > 0.55) continue;
        const a = Math.random() * Math.PI * 2, r = Math.random() * p.r;
        W.mist.emit({ x: p.x + Math.cos(a) * r, y: p.level - 0.2, z: p.z + Math.sin(a) * r, vy: 0.35 + Math.random() * 0.25, life: 4, size: 1.5, size2: 6, alpha: 0.22 + 0.12 * S.night, r: 0.97, g: 0.97, b: 0.97, wind: 0.6 });
      }
    }
    W.mist.update(dt);
  }
  W.waterfallOut = () => FALLS.out;
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
    W.late(pts);
    scene.add(pts);
    return {
      pts, pos, col, al, sz, max,
      // positions and alpha always; colours and sizes only when they may have changed
      dirty(all = true) {
        const A = geo.attributes;
        A.position.needsUpdate = true; A.aA.needsUpdate = true;
        if (all) { A.aC.needsUpdate = true; A.aS.needsUpdate = true; }
      },
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
    W.late(lines);
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
    // drops splashing on the ground near you
    if (wx.rain > 0.25 && W.mist) for (let k = 0; k < 2; k++) {
      if (Math.random() > dt * 40 * wx.rain) continue;
      const x = cx + (Math.random() - 0.5) * 30, z = cz + (Math.random() - 0.5) * 30, h = W.heightAt(x, z);
      if (h < 0) continue;
      for (let j = 0; j < 3; j++) W.mist.emit({ x, y: h + 0.03, z, vx: (Math.random() - 0.5) * 0.8, vy: 0.8 + Math.random() * 0.6, vz: (Math.random() - 0.5) * 0.8, grav: 7, life: 0.35, size: 0.35, size2: 0.15, alpha: 0.7, r: 0.9, g: 0.94, b: 1 });
    }
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
  W.setWeatherMode = function (m) { wxMode = WX_TYPES[m] ? m : 'auto'; if (wxMode === 'auto') wxTimer = 40; };   // an unknown saved value falls back to changing weather
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
    sun.position.copy(L).multiplyScalar(160).add(W.focus); sun.target.position.copy(W.focus);
    // the shadowed area grows when the camera pulls back, so distant islands keep their shadows
    const span = clamp(camera.position.distanceTo(W.focus) * 0.75, 30, 210), sc = sun.shadow.camera;
    if (Math.abs(sc.right - span) > span * 0.1) { sc.left = sc.bottom = -span; sc.right = sc.top = span; sc.far = 340; sc.updateProjectionMatrix(); }
    sun.color.copy(P.sun);
    sun.intensity = P.si * (1 - 0.62 * over) * (P.night > 0.5 ? 0.55 + 0.45 * full : 1);
    hemi.color.copy(P.hs).lerp(E.hor, over * 0.4); hemi.groundColor.copy(P.hg); hemi.intensity = P.hi * (1 + over * 0.15);
    scene.fog.color.copy(E.hor);
    const wet = clamp(wx.rain + wx.snow * 0.5, 0, 1);
    const extra = Math.max(0, camera.position.distanceTo(W.focus) - 50);   // see the whole archipelago from high up
    scene.fog.near = lerp(80, 14, wx.fog) * lerp(1, 0.6, wet) + extra * 0.9;
    scene.fog.far = lerp(270, 60, wx.fog) * lerp(1, 0.55, wet) + extra * 1.3;

    Object.assign(skyU.uNight, { value: P.night }); skyU.uTime.value = t;
    skyU.uTop.value.copy(E.top); skyU.uHor.value.copy(E.hor); skyU.uSunCol.value.copy(P.sun);
    skyU.uSunDir.value.copy(skySun); skyU.uMoonDir.value.copy(moonDir); skyU.uMoonPhase.value = W.moonPhase();
    skyU.uOvercast.value = clamp(over * 1.15, 0, 1); skyU.uAurora.value = wx.aurora; skyU.uRainbow.value = wx.rainbow;
    skyU.uGold.value = W.golden();
    skyU.uCirrus.value = clamp(0.2 + 0.5 * fbm(S.day * 3.1, 2.2, 88, 2) + wx.cloud * 0.35 - wx.rain * 0.6 - wx.fog * 0.5, 0, 1);
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
    waterU.uClear.value = 1 - over;
    waterU.uWind.value = wx.wind;
    waterU.uBio.value = smooth(0.5, 0.9, P.night) * [0.6, 1, 0.7, 0.15][si] * (1 - wx.snow);
    PU.uTime.value = t;
    PU.uCaus.value.copy(P.sun).multiplyScalar(P.si * (1 - over) * S.dayness * 0.55);
    // surfaces darken and shine while it rains, and dry slowly afterwards
    PU.uWet.value += ((wx.rain > 0.2 ? 1 : 0) - PU.uWet.value) * (1 - Math.exp(-S.dt / (wx.rain > 0.2 ? 20 : 60)));
    for (const m of wetMats) { m.specular.setScalar(0.045 + 0.22 * PU.uWet.value); m.shininess = 14 + 40 * PU.uWet.value; }

    tmpC.copy(E.hor).lerp(E.top, 0.12).multiplyScalar(0.94); mountainFar.material.color.copy(tmpC);
    tmpC.copy(E.hor).lerp(E.top, 0.3).multiplyScalar(0.86); mountainNear.material.color.copy(tmpC);
    hillSnow.value = 0.45 + 0.55 * winter;

    const LH = W.lighthouse, on = smooth(0.25, 0.7, S.glow);
    LH.beam.rotation.y = t * 0.45;
    LH.beamMat.uniforms.uA.value = on * (0.7 + 0.8 * wx.fog + 0.3 * wx.rain);
    LH.lampMat.color.setRGB(0.75 + 1.6 * on, 0.72 + 1.4 * on, 0.6 + 1.0 * on);
    W.dock.lanternMat.emissiveIntensity = 0.3 + 1.6 * S.breath.b * (0.3 + 0.7 * S.glow);
  }

  // Gusts travel downwind at about the speed the clouds drift, a little faster when it is blowing hard.
  function updateWind(dt) {
    const w = S.weather.wind, G = PU.uGust.value, v = (1.6 + w * 4) * dt * 0.045;
    G.x += 0.94 * v; G.y += 0.34 * v;
    if (G.x > 1000) { G.x -= 1000; G.y -= 362; }
    G.z = S.reduceMotion ? 0 : clamp(0.25 + w * 1.1 + S.weather.rain * 0.3, 0, 1.2);
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
    updateCloudShadows();
    updateWind(dt);
    updateWeatherFx(dt, t);
    updateShootingStar(dt);
    updateLights(t);
    updateFeatures(dt, t);
    if (tCursor >= 0 || Math.abs(S.season - lastTerrainS) > 0.004) recolorTerrain(S.season, 4000);
    sightings(dt);
  };
})(window.SW);
