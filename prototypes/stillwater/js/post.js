// Stillwater: the rendering pipeline.
//   1. planar reflection of the world in the sea (Sharp only)
//   2. opaque scene into an HDR target with a depth texture
//   3. ambient occlusion from that depth, blurred with depth-aware weights
//   4. the occluded scene and its depth into a second target, then everything transparent on top
//      (the sea reads the opaque pass to refract the sea floor)
//   5. bloom, sun shafts, haze toward the sun, colour grading, depth of field, FXAA
(function (SW) {
  'use strict';
  const { U } = SW;
  const { clamp, smooth } = U;
  const S = SW.S;
  const PP = SW.post = { enabled: false, reflections: false, dof: true };
  let W, renderer, scene, camera, hdrType = THREE.UnsignedByteType, ok = false;
  let rtA, rtB, rtAO1, rtAO2, rtRefl, rtRay1, rtRay2, rtC, rtD;
  const down = [], up = [];
  const LEVELS = 6;
  const quadScene = new THREE.Scene(), quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
  quad.frustumCulled = false; quadScene.add(quad);
  const size = new THREE.Vector2(), tmpV = new THREE.Vector3(), tmpV4 = new THREE.Vector4();

  const VS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
  // Every opaque surface writes its distance from the camera into the alpha channel of the HDR image
  // (the sky writes SKY_DIST). The effects read distance from there rather than from a depth texture.
  const COMMON = `
    const float SKY = 4000.0;
    uniform float uNear, uFar;
    float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
    float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), f.x), mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), f.x), f.y); }`;
  const mat = (fs, uniforms, extra) => new THREE.ShaderMaterial(Object.assign({
    uniforms: Object.assign({ uNear: { value: 0.3 }, uFar: { value: 2400 } }, uniforms), vertexShader: VS, fragmentShader: COMMON + fs,
    depthTest: false, depthWrite: false,
  }, extra || {}));
  const tex = { value: null };

  // ---------------------------------------------------------- ambient occlusion
  const aoMat = mat(`
    uniform sampler2D tDepth; uniform vec2 uRes, uProj; uniform float uProjY, uRadius, uIntensity;
    varying vec2 vUv;
    vec3 vpos(vec2 uv){ float z = texture2D(tDepth, uv).a; return vec3((uv * 2.0 - 1.0) * z / uProj, -z); }
    void main(){
      float d = texture2D(tDepth, vUv).a;
      if (d >= SKY) { gl_FragColor = vec4(1.0); return; }
      vec3 P = vpos(vUv);
      vec2 px = 1.0 / uRes;
      vec3 pr = vpos(vUv + vec2(px.x, 0.0)), pl = vpos(vUv - vec2(px.x, 0.0)), pu = vpos(vUv + vec2(0.0, px.y)), pd = vpos(vUv - vec2(0.0, px.y));
      vec3 dx = abs(pr.z - P.z) < abs(P.z - pl.z) ? pr - P : P - pl;
      vec3 dy = abs(pu.z - P.z) < abs(P.z - pd.z) ? pu - P : P - pd;
      vec3 N = normalize(cross(dx, dy));
      float rpx = min(uRadius * uProjY / -P.z * 0.5 * uRes.y, 48.0);
      if (rpx < 1.0) { gl_FragColor = vec4(1.0); return; }
      float rnd = hash12(gl_FragCoord.xy) * 6.2832, ao = 0.0, r2 = uRadius * uRadius;
      for (int i = 0; i < 12; i++) {
        float t = (float(i) + 0.5) / 12.0, a = t * 6.2832 * 2.6 + rnd;
        vec2 suv = vUv + vec2(cos(a), sin(a)) * t * rpx * px;
        vec3 v = vpos(suv) - P;
        float vv = dot(v, v), vn = dot(v, N);
        ao += max(0.0, vn - 0.004 * -P.z) * (1.0 - smoothstep(r2 * 0.5, r2, vv)) / (vv + 0.02);
      }
      ao = clamp(1.0 - uIntensity * ao / 12.0, 0.0, 1.0);
      gl_FragColor = vec4(ao, ao, ao, 1.0);
    }`, { tDepth: { value: null }, uRes: { value: new THREE.Vector2() }, uProj: { value: new THREE.Vector2(1, 1) }, uProjY: { value: 1 }, uRadius: { value: 1.4 }, uIntensity: { value: 1.8 } });
  const aoBlurMat = mat(`
    uniform sampler2D tAO, tDepth; uniform vec2 uDir; varying vec2 vUv;
    void main(){
      float z0 = texture2D(tDepth, vUv).a, sum = 0.0, wsum = 0.0;
      for (int i = -4; i <= 4; i++) {
        vec2 uv = vUv + uDir * float(i);
        float z = texture2D(tDepth, uv).a, w = exp(-abs(z - z0) / (0.02 * z0 + 0.05)) * (1.0 - abs(float(i)) / 5.0);
        sum += texture2D(tAO, uv).r * w; wsum += w;
      }
      float a = sum / max(wsum, 1e-4);
      gl_FragColor = vec4(a, a, a, 1.0);
    }`, { tAO: { value: null }, tDepth: { value: null }, uDir: { value: new THREE.Vector2() } });

  // Darkens the opaque image by the occlusion in place: colour is multiplied, the distance in alpha is kept.
  const aoApplyMat = mat(`
    uniform sampler2D tAO; uniform float uAOAmount; varying vec2 vUv;
    void main(){ float ao = mix(1.0, texture2D(tAO, vUv).r, uAOAmount); gl_FragColor = vec4(ao, ao, ao, 1.0); }`,
  { tAO: { value: null }, uAOAmount: { value: 1 } },
  { transparent: true, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.ZeroFactor, blendDst: THREE.SrcColorFactor,
    blendEquationAlpha: THREE.AddEquation, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor });
  // A copy of the occluded opaque image and its distances, for the sea to look through.
  const copyMat = mat(`
    uniform sampler2D tColor; varying vec2 vUv;
    void main(){ gl_FragColor = texture2D(tColor, vUv); }`, { tColor: { value: null } });

  // -------------------------------------------------------------------- bloom
  const preMat = mat(`
    uniform sampler2D tColor; uniform vec2 uTexel; uniform float uThreshold, uKnee; varying vec2 vUv;
    vec3 tx(vec2 o){ return texture2D(tColor, vUv + o * uTexel).rgb; }
    void main(){
      vec3 c = (tx(vec2(-1.0, -1.0)) + tx(vec2(1.0, -1.0)) + tx(vec2(-1.0, 1.0)) + tx(vec2(1.0, 1.0))) * 0.25;
      float br = max(c.r, max(c.g, c.b));
      float rq = clamp(br - uThreshold + uKnee, 0.0, 2.0 * uKnee);
      rq = rq * rq / (4.0 * uKnee + 1e-4);
      gl_FragColor = vec4(c * max(rq, br - uThreshold) / max(br, 1e-4), 1.0);
    }`, { tColor: { value: null }, uTexel: { value: new THREE.Vector2() }, uThreshold: { value: 1 }, uKnee: { value: 0.35 } });
  const downMat = mat(`
    uniform sampler2D tColor; uniform vec2 uTexel; varying vec2 vUv;
    vec3 tx(vec2 o){ return texture2D(tColor, vUv + o * uTexel).rgb; }
    void main(){
      vec3 c = tx(vec2(0.0)) * 0.125;
      c += (tx(vec2(-2.0, 2.0)) + tx(vec2(2.0, 2.0)) + tx(vec2(-2.0, -2.0)) + tx(vec2(2.0, -2.0))) * 0.03125;
      c += (tx(vec2(0.0, 2.0)) + tx(vec2(-2.0, 0.0)) + tx(vec2(2.0, 0.0)) + tx(vec2(0.0, -2.0))) * 0.0625;
      c += (tx(vec2(-1.0, 1.0)) + tx(vec2(1.0, 1.0)) + tx(vec2(-1.0, -1.0)) + tx(vec2(1.0, -1.0))) * 0.125;
      gl_FragColor = vec4(c, 1.0);
    }`, { tColor: { value: null }, uTexel: { value: new THREE.Vector2() } });
  const upMat = mat(`
    uniform sampler2D tLow, tHigh; uniform vec2 uTexel; uniform float uSpread; varying vec2 vUv;
    vec3 tx(vec2 o){ return texture2D(tLow, vUv + o * uTexel * uSpread).rgb; }
    void main(){
      vec3 c = tx(vec2(0.0)) * 4.0;
      c += (tx(vec2(-1.0, 0.0)) + tx(vec2(1.0, 0.0)) + tx(vec2(0.0, -1.0)) + tx(vec2(0.0, 1.0))) * 2.0;
      c += tx(vec2(-1.0, -1.0)) + tx(vec2(1.0, -1.0)) + tx(vec2(-1.0, 1.0)) + tx(vec2(1.0, 1.0));
      gl_FragColor = vec4(c / 16.0 + texture2D(tHigh, vUv).rgb, 1.0);
    }`, { tLow: { value: null }, tHigh: { value: null }, uTexel: { value: new THREE.Vector2() }, uSpread: { value: 1 } });

  // --------------------------------------------------------------- sun shafts
  const rayMaskMat = mat(`
    uniform sampler2D tDepth; uniform vec2 uSun; uniform float uAspect; varying vec2 vUv;
    void main(){
      float sky = step(SKY, texture2D(tDepth, vUv).a);
      vec2 dv = (vUv - uSun) * vec2(uAspect, 1.0);
      float m = sky * max(0.0, 1.0 - length(dv) * 1.4);
      gl_FragColor = vec4(m * m, 0.0, 0.0, 1.0);
    }`, { tDepth: { value: null }, uSun: { value: new THREE.Vector2() }, uAspect: { value: 1 } });
  const rayBlurMat = mat(`
    uniform sampler2D tMask; uniform vec2 uSun; varying vec2 vUv;
    void main(){
      vec2 delta = (vUv - uSun) / 56.0 * 0.92, uv = vUv;
      float illum = 1.0, sum = 0.0, jitter = hash12(gl_FragCoord.xy);
      uv -= delta * jitter;
      for (int i = 0; i < 56; i++) { uv -= delta; sum += texture2D(tMask, uv).r * illum; illum *= 0.965; }
      gl_FragColor = vec4(sum / 56.0 * 3.0, 0.0, 0.0, 1.0);
    }`, { tMask: { value: null }, uSun: { value: new THREE.Vector2() } });

  // --------------------------------------------------------------- composite
  const compMat = mat(`
    uniform sampler2D tColor, tBloom, tRays, tDepth;
    uniform vec2 uRes; uniform mat4 uInvProj, uCamWorld;
    uniform vec3 uSunDir, uSunCol, uHi, uLo, uLift, uCamPos, uCamFwd, uMistCol; uniform vec2 uSunUV; uniform float uMist, uWL;
    uniform float uBloom, uRays, uInscatter, uSat, uContrast, uExposure, uVignette, uTime, uGrain, uFlare;
    varying vec2 vUv;
    vec3 shoulder(vec3 c){ return mix(c, 0.8 + 0.2 * (1.0 - exp(-(c - 0.8) / 0.2)), step(0.8, c)); }   // untouched below 0.8, a soft roll-off above
    void main(){
      vec3 c = texture2D(tColor, vUv).rgb;
      c += texture2D(tBloom, vUv).rgb * uBloom;
      float d = texture2D(tDepth, vUv).a;
      vec4 vp = uInvProj * vec4(vUv * 2.0 - 1.0, 1.0, 1.0); vp /= vp.w;
      vec3 rd = normalize((uCamWorld * vec4(vp.xyz, 0.0)).xyz);
      float dist = d >= SKY ? 1500.0 : d;
      float mie = pow(max(dot(rd, uSunDir), 0.0), 7.0);
      c += uSunCol * mie * (1.0 - exp(-dist * 0.004)) * uInscatter;
      if (uMist > 0.01) {
        // low mist lying on the sea in the early morning, thickest just above the water
        float along = dist / max(dot(rd, uCamFwd), 0.05);
        vec3 wp = uCamPos + rd * min(along, 600.0);
        float banks = 0.45 + 0.9 * vnoise(wp.xz * 0.035 + vec2(uTime * 0.012, uTime * 0.005)) * vnoise(wp.xz * 0.011 - uTime * 0.004);
        float lowness = exp(-max(wp.y - uWL, 0.0) * 0.35) * banks, thick = 1.0 - exp(-min(along, 600.0) * 0.012);
        vec3 mc = uMistCol + uSunCol * mie * 0.6;
        c = mix(c, mc, clamp(uMist * lowness * thick, 0.0, 0.85));
      }
      c += uSunCol * texture2D(tRays, vUv).r * uRays;
      if (uFlare > 0.01) {
        // a few faint ghosts on the line through the sun and the centre of the frame, hidden when the sun is
        float vis = step(SKY, texture2D(tDepth, uSunUV).a) * step(0.0, uSunUV.x) * step(uSunUV.x, 1.0) * step(0.0, uSunUV.y) * step(uSunUV.y, 1.0);
        vec2 axis = vec2(0.5) - uSunUV, asp = vec2(uRes.x / uRes.y, 1.0);
        for (int i = 0; i < 4; i++) {
          float k = 0.55 + float(i) * 0.42, r = 0.025 + 0.03 * float(i);
          float g = smoothstep(r, r * 0.55, length((vUv - (uSunUV + axis * k)) * asp));
          c += mix(uSunCol, vec3(0.6, 0.85, 1.0), float(i) / 3.0) * g * 0.05 * vis * uFlare;
        }
      }
      c *= uExposure;
      c = shoulder(c);
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c = mix(vec3(l), c, uSat);
      c = (c - 0.45) * uContrast + 0.45;
      c *= mix(uLo, uHi, smoothstep(0.05, 0.85, l));
      c += uLift * (1.0 - smoothstep(0.0, 0.4, l));
      vec2 q = vUv - 0.5;
      c *= 1.0 - uVignette * dot(q, q) * 1.7;
      c += (hash12(vUv * uRes + fract(uTime) * 91.7) - 0.5) * uGrain;
      c = clamp(c, 0.0, 1.0);
      gl_FragColor = vec4(c, dot(c, vec3(0.299, 0.587, 0.114)));
    }`, {
    tColor: { value: null }, tBloom: { value: null }, tRays: { value: null }, tDepth: { value: null },
    uRes: { value: new THREE.Vector2() }, uInvProj: { value: new THREE.Matrix4() }, uCamWorld: { value: new THREE.Matrix4() },
    uSunDir: { value: new THREE.Vector3() }, uSunCol: { value: new THREE.Color() }, uHi: { value: new THREE.Color(1, 1, 1) }, uLo: { value: new THREE.Color(1, 1, 1) }, uLift: { value: new THREE.Color(0, 0, 0) },
    uBloom: { value: 0.6 }, uRays: { value: 0 }, uInscatter: { value: 0.3 }, uSat: { value: 1.08 }, uContrast: { value: 1.05 }, uExposure: { value: 1 },
    uVignette: { value: 0.35 }, uTime: { value: 0 }, uGrain: { value: 0.012 }, uSunUV: { value: new THREE.Vector2() }, uFlare: { value: 0 },
    uCamPos: { value: new THREE.Vector3() }, uCamFwd: { value: new THREE.Vector3() }, uMistCol: { value: new THREE.Color() }, uMist: { value: 0 }, uWL: { value: -0.35 },
  });

  // ------------------------------------------------------------ depth of field
  const dofMat = mat(`
    uniform sampler2D tColor, tDepth; uniform vec2 uRes; uniform float uFocus, uRange, uMaxR; varying vec2 vUv;
    float coc(float z){ return clamp((abs(z - uFocus) - uRange) / (uRange * 2.5 + z * 0.12), 0.0, 1.0); }
    void main(){
      vec4 base = texture2D(tColor, vUv);
      float c0 = coc(min(texture2D(tDepth, vUv).a, uFar));
      if (c0 < 0.03) { gl_FragColor = base; return; }
      vec3 sum = base.rgb; float wsum = 1.0, rot = hash12(gl_FragCoord.xy) * 6.2832;
      for (int i = 0; i < 20; i++) {
        float fi = float(i) + 0.5, r = sqrt(fi / 20.0) * uMaxR * c0, a = fi * 2.39996 + rot;
        vec2 uv = vUv + vec2(cos(a), sin(a)) * r / uRes;
        float cs = coc(min(texture2D(tDepth, uv).a, uFar));
        float w = smoothstep(r - 2.0, r, cs * uMaxR + 1.0);
        sum += texture2D(tColor, uv).rgb * w; wsum += w;
      }
      vec3 c = sum / wsum;
      gl_FragColor = vec4(c, dot(c, vec3(0.299, 0.587, 0.114)));
    }`, { tColor: { value: null }, tDepth: { value: null }, uRes: { value: new THREE.Vector2() }, uFocus: { value: 40 }, uRange: { value: 10 }, uMaxR: { value: 7 } });

  // --------------------------------------------------------------------- FXAA
  const fxaaMat = mat(`
    uniform sampler2D tColor; uniform vec2 uRes; varying vec2 vUv;
    void main(){
      vec2 inv = 1.0 / uRes;
      vec4 m = texture2D(tColor, vUv);
      float lNW = texture2D(tColor, vUv + vec2(-1.0, -1.0) * inv).a, lNE = texture2D(tColor, vUv + vec2(1.0, -1.0) * inv).a;
      float lSW = texture2D(tColor, vUv + vec2(-1.0, 1.0) * inv).a, lSE = texture2D(tColor, vUv + vec2(1.0, 1.0) * inv).a, lM = m.a;
      float lMin = min(lM, min(min(lNW, lNE), min(lSW, lSE))), lMax = max(lM, max(max(lNW, lNE), max(lSW, lSE)));
      vec2 dir = vec2(-((lNW + lNE) - (lSW + lSE)), (lNW + lSW) - (lNE + lSE));
      float reduce = max((lNW + lNE + lSW + lSE) * 0.03125, 1.0 / 128.0);
      dir = clamp(dir / (min(abs(dir.x), abs(dir.y)) + reduce), vec2(-8.0), vec2(8.0)) * inv;
      vec3 a = 0.5 * (texture2D(tColor, vUv + dir * (1.0 / 3.0 - 0.5)).rgb + texture2D(tColor, vUv + dir * (2.0 / 3.0 - 0.5)).rgb);
      vec3 b = a * 0.5 + 0.25 * (texture2D(tColor, vUv - dir * 0.5).rgb + texture2D(tColor, vUv + dir * 0.5).rgb);
      float lb = dot(b, vec3(0.299, 0.587, 0.114));
      gl_FragColor = vec4((lb < lMin || lb > lMax) ? a : b, 1.0);
    }`, { tColor: { value: null }, uRes: { value: new THREE.Vector2() } });

  // ------------------------------------------------------------------ targets
  const makeRT = (w, h, type, depth, stencil) => {
    const rt = new THREE.WebGLRenderTarget(Math.max(1, w), Math.max(1, h), { type, format: THREE.RGBAFormat, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: !!depth, stencilBuffer: !!stencil });
    rt.texture.generateMipmaps = false;
    return rt;
  };
  function build() {
    const w = size.x, h = size.y;
    [rtA, rtB, rtAO1, rtAO2, rtRefl, rtRay1, rtRay2, rtC, rtD, ...down, ...up].forEach((rt) => rt && rt.dispose());
    down.length = 0; up.length = 0;
    // an ordinary depth buffer (24-bit, with stencil) for depth testing; distances for the effects live in alpha
    rtA = makeRT(w, h, hdrType, true, true);
    rtB = makeRT(w, h, hdrType, false);
    const aoScale = S.quality === 'high' ? 2 : 3;
    rtAO1 = makeRT(w / aoScale | 0, h / aoScale | 0, THREE.UnsignedByteType, false);
    rtAO2 = makeRT(w / aoScale | 0, h / aoScale | 0, THREE.UnsignedByteType, false);
    rtRefl = makeRT(w / 2 | 0, h / 2 | 0, hdrType, true);
    rtRay1 = makeRT(w / 4 | 0, h / 4 | 0, THREE.UnsignedByteType, false);
    rtRay2 = makeRT(w / 4 | 0, h / 4 | 0, THREE.UnsignedByteType, false);
    rtC = makeRT(w, h, THREE.UnsignedByteType, false);
    rtD = makeRT(w, h, THREE.UnsignedByteType, false);
    let bw = w, bh = h;
    for (let i = 0; i < LEVELS; i++) { bw = Math.max(1, bw >> 1); bh = Math.max(1, bh >> 1); down.push(makeRT(bw, bh, hdrType, false)); if (i < LEVELS - 1) up.push(makeRT(bw, bh, hdrType, false)); }
    PP.targets = { rtA, rtB, rtAO1, rtRefl };
  }
  let builtFor = '';
  PP.resize = function () {
    if (!ok) return;
    renderer.getDrawingBufferSize(size);
    const key = size.x + 'x' + size.y + S.quality;   // the AO target's scale depends on quality
    if (key === builtFor) return;
    builtFor = key;
    build();
    PP.recheck();
  };

  // ---------------------------------------------------------------- reflection
  // A mirrored camera with an oblique near plane at the water line (as in three.js's Reflector).
  const virt = new THREE.PerspectiveCamera(), texMat = new THREE.Matrix4();
  const plane = new THREE.Plane(), clipPlane = new THREE.Vector4(), q = new THREE.Vector4();
  const camPos = new THREE.Vector3(), look = new THREE.Vector3(), rot = new THREE.Matrix4(), N = new THREE.Vector3(0, 1, 0), P0 = new THREE.Vector3();
  const view = new THREE.Vector3(), target = new THREE.Vector3();
  PP.texMat = texMat;
  function renderReflection() {
    P0.set(0, SW.K.WL, 0);
    camPos.setFromMatrixPosition(camera.matrixWorld);
    if (camPos.y < P0.y) return false;
    view.subVectors(P0, camPos).reflect(N).negate().add(P0);
    rot.extractRotation(camera.matrixWorld);
    look.set(0, 0, -1).applyMatrix4(rot).add(camPos);
    target.subVectors(P0, look).reflect(N).negate().add(P0);
    virt.position.copy(view);
    virt.up.set(0, 1, 0).applyMatrix4(rot).reflect(N);
    virt.lookAt(target);
    virt.far = camera.far; virt.near = camera.near;
    virt.updateMatrixWorld();
    virt.projectionMatrix.copy(camera.projectionMatrix);
    texMat.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
    texMat.multiply(virt.projectionMatrix).multiply(virt.matrixWorldInverse);
    plane.setFromNormalAndCoplanarPoint(N, P0).applyMatrix4(virt.matrixWorldInverse);
    clipPlane.set(plane.normal.x, plane.normal.y, plane.normal.z, plane.constant);
    const e = virt.projectionMatrix.elements;
    q.x = (Math.sign(clipPlane.x) + e[8]) / e[0];
    q.y = (Math.sign(clipPlane.y) + e[9]) / e[5];
    q.z = -1.0;
    q.w = (1.0 + e[10]) / e[14];
    clipPlane.multiplyScalar(2.0 / clipPlane.dot(q));
    e[2] = clipPlane.x; e[6] = clipPlane.y; e[10] = clipPlane.z + 1.0 - 0.003; e[14] = clipPlane.w;
    virt.projectionMatrixInverse.copy(virt.projectionMatrix).invert();
    virt.layers.set(0);
    renderer.setRenderTarget(rtRefl);
    renderer.render(scene, virt);
    return true;
  }

  // ----------------------------------------------------------------- self-check
  // Some GPUs and browsers have been seen to drop parts of the main pass: the sky and whole islands, with
  // the sea showing through. Every surface writes colour and a distance, so a pixel still holding the clear
  // colour (black, alpha 1) means nothing was drawn there. A few times after starting, and after any change
  // to the graphics, a grid of 64 points is checked; if empty pixels keep turning up, PP.onBroken is told.
  const checkRT = new THREE.WebGLRenderTarget(8, 8, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: false, stencilBuffer: false });
  checkRT.texture.generateMipmaps = false;
  const checkMat = mat(`
    uniform sampler2D tColor; uniform vec2 uSize; varying vec2 vUv;
    void main(){
      vec2 p = (floor(vUv * 8.0) + 0.5) / 8.0 * 0.92 + 0.04;
      vec4 c = texture2D(tColor, (floor(p * uSize) + 0.5) / uSize);
      float empty = (c.a == 1.0 && c.r == 0.0 && c.g == 0.0 && c.b == 0.0) ? 1.0 : 0.0;
      gl_FragColor = vec4(empty, 0.0, 0.0, 1.0);
    }`, { tColor: { value: null }, uSize: { value: new THREE.Vector2() } });
  const checkBuf = new Uint8Array(8 * 8 * 4);
  let frameNo = 0, checkAt = 40, badChecks = 0;
  PP.recheck = () => { checkAt = frameNo + 40; badChecks = 0; };
  PP.lastCheck = -1;
  function selfCheck() {
    checkMat.uniforms.tColor.value = rtB.texture; checkMat.uniforms.uSize.value.set(rtB.width, rtB.height);
    pass(checkMat, checkRT);
    renderer.readRenderTargetPixels(checkRT, 0, 0, 8, 8, checkBuf);
    let empty = 0;
    for (let i = 0; i < 64; i++) if (checkBuf[i * 4] > 127) empty++;
    PP.lastCheck = empty;
    badChecks = empty >= 3 ? badChecks + 1 : 0;
    if (badChecks >= 2 && PP.onBroken) { badChecks = 0; PP.onBroken(empty); return; }
    // early on check often, then rarely; each check costs one tiny read back from the GPU
    checkAt = frameNo + (frameNo < 600 ? 45 : 900);
  }

  // ------------------------------------------------------------------- render
  const sunScreen = new THREE.Vector3(), camFwd = new THREE.Vector3(), WHITE = new THREE.Color(1, 1, 1);
  const pass = (m, target) => { quad.material = m; renderer.setRenderTarget(target); renderer.render(quadScene, quadCam); };
  PP.render = function () {
    const near = camera.near, far = camera.far;
    for (const m of [aoMat, aoBlurMat, compMat, dofMat]) { m.uniforms.uNear.value = near; m.uniforms.uFar.value = far; }
    // Balanced redraws the shadow map every other frame; the sun and most shadows move slowly.
    frameNo++;
    if (S.quality !== 'balanced' || frameNo % 2) renderer.shadowMap.needsUpdate = true;
    const reflOn = PP.reflections && renderReflection();
    SW.world.setWaterInputs({ refl: reflOn ? rtRefl.texture : null, scene: rtB.texture, res: size, texMat, near, far });

    camera.layers.set(0); camera.layers.enable(2);
    renderer.setRenderTarget(rtA);
    renderer.render(scene, camera);

    // ambient occlusion
    const P = camera.projectionMatrix.elements;
    aoMat.uniforms.tDepth.value = rtA.texture;
    aoMat.uniforms.uRes.value.set(rtAO1.width, rtAO1.height);
    aoMat.uniforms.uProj.value.set(P[0], P[5]);
    aoMat.uniforms.uProjY.value = P[5];
    pass(aoMat, rtAO1);
    aoBlurMat.uniforms.tDepth.value = rtA.texture;
    aoBlurMat.uniforms.tAO.value = rtAO1.texture; aoBlurMat.uniforms.uDir.value.set(1.5 / rtAO1.width, 0); pass(aoBlurMat, rtAO2);
    aoBlurMat.uniforms.tAO.value = rtAO2.texture; aoBlurMat.uniforms.uDir.value.set(0, 1.5 / rtAO1.height); pass(aoBlurMat, rtAO1);

    // darken the opaque image by the occlusion, keep a copy for the sea to look through, then draw the
    // transparent layer straight on top, depth-tested against the opaque pass's own depth buffer
    renderer.autoClear = false;
    aoApplyMat.uniforms.tAO.value = rtAO1.texture;
    pass(aoApplyMat, rtA);
    renderer.autoClear = true;
    copyMat.uniforms.tColor.value = rtA.texture;
    pass(copyMat, rtB);
    if (frameNo >= checkAt) selfCheck();
    camera.layers.set(1);
    renderer.autoClear = false;
    renderer.setRenderTarget(rtA);
    renderer.render(scene, camera);
    renderer.autoClear = true;
    camera.layers.enableAll();

    // bloom
    preMat.uniforms.tColor.value = rtA.texture; preMat.uniforms.uTexel.value.set(1 / size.x, 1 / size.y);
    preMat.uniforms.uThreshold.value = hdrType === THREE.UnsignedByteType ? 0.82 : 1.0;
    pass(preMat, down[0]);
    for (let i = 1; i < LEVELS; i++) { downMat.uniforms.tColor.value = down[i - 1].texture; downMat.uniforms.uTexel.value.set(1 / down[i - 1].width, 1 / down[i - 1].height); pass(downMat, down[i]); }
    for (let i = LEVELS - 2; i >= 0; i--) {
      const low = i === LEVELS - 2 ? down[LEVELS - 1] : up[i + 1];
      upMat.uniforms.tLow.value = low.texture; upMat.uniforms.tHigh.value = down[i].texture;
      upMat.uniforms.uTexel.value.set(1 / low.width, 1 / low.height);
      pass(upMat, up[i]);
    }

    // sun shafts
    const L = SW.world.sunDirection();
    sunScreen.copy(L).multiplyScalar(500).add(camera.position).project(camera);
    camera.getWorldDirection(camFwd);
    const facing = smooth(0.15, 0.6, camFwd.dot(L)), wx = S.weather;
    const rayStrength = facing * clamp(1 - S.night * 1.6, 0, 1) * (1 - SW.world.env.over) * smooth(-0.02, 0.1, L.y) * (0.35 + 0.65 * (1 - smooth(0.25, 0.8, L.y)));
    if (rayStrength > 0.01) {
      rayMaskMat.uniforms.tDepth.value = rtB.texture;
      rayMaskMat.uniforms.uSun.value.set(sunScreen.x * 0.5 + 0.5, sunScreen.y * 0.5 + 0.5);
      rayMaskMat.uniforms.uAspect.value = size.x / size.y;
      pass(rayMaskMat, rtRay1);
      rayBlurMat.uniforms.tMask.value = rtRay1.texture; rayBlurMat.uniforms.uSun.value.copy(rayMaskMat.uniforms.uSun.value);
      pass(rayBlurMat, rtRay2);
    }

    // composite and grade
    const C = compMat.uniforms, E = SW.world.env, night = S.night, gold = SW.world.golden();
    C.tColor.value = rtA.texture; C.tBloom.value = up[0].texture; C.tRays.value = rtRay2.texture; C.tDepth.value = rtB.texture;
    C.uRes.value.copy(size);
    C.uInvProj.value.copy(camera.projectionMatrixInverse); C.uCamWorld.value.copy(camera.matrixWorld);
    C.uSunDir.value.copy(L); C.uSunCol.value.copy(E.sun);
    C.uBloom.value = 0.55 + 0.35 * night;
    C.uRays.value = rayStrength * 0.6;
    C.uSunUV.value.set(sunScreen.x * 0.5 + 0.5, sunScreen.y * 0.5 + 0.5);
    C.uFlare.value = sunScreen.z < 1 ? rayStrength : 0;
    C.uInscatter.value = (0.12 + 0.35 * gold) * (1 - E.over * 0.7) * S.dayness;
    C.uSat.value = 1.1 + 0.06 * gold - 0.18 * night - 0.2 * E.over;
    C.uContrast.value = 1.06 - 0.05 * E.over;
    C.uExposure.value = 1.0 + 0.08 * night;
    // seasons tint the grade a little: fresh spring, warm autumn, cool winter
    const si = U.seasonIndex(S.season), autumn = si === 2 ? 1 : 0, winter = si === 3 ? 1 : 0, spring = si === 0 ? 1 : 0;
    C.uHi.value.setRGB(1 + 0.06 * gold - 0.04 * night + 0.03 * autumn - 0.02 * winter, 1 - 0.01 * gold - 0.02 * night + 0.01 * spring, 1 - 0.09 * gold + 0.06 * night - 0.03 * autumn + 0.03 * winter);
    C.uLo.value.setRGB(1 - 0.05 * gold - 0.08 * night - 0.02 * winter, 1 + 0.01 * gold - 0.02 * night, 1 + 0.05 * gold + 0.1 * night + 0.04 * winter);
    C.uLift.value.setRGB(0.005, 0.012, 0.025).multiplyScalar(0.5 + night);
    C.uTime.value = S.t;
    C.uCamPos.value.copy(camera.position); C.uCamFwd.value.copy(camFwd);
    const tod = S.tod, morning = (1 - smooth(0.06, 0.2, tod)) * smooth(0.0, 0.02, tod) + smooth(0.97, 1.0, tod);
    C.uMist.value = (morning * 0.6 + S.weather.fog * 0.3) * (1 - S.weather.rain * 0.5);
    C.uMistCol.value.copy(E.hor).lerp(WHITE, 0.25);
    const dofOn = PP.dof && S.quality === 'high';
    pass(compMat, dofOn ? rtD : rtC);
    let src = dofOn ? rtD : rtC;
    if (dofOn) {
      const D = dofMat.uniforms, focus = Math.max(4, camera.position.distanceTo(SW.world.focus));
      D.tColor.value = rtD.texture; D.tDepth.value = rtB.texture; D.uRes.value.copy(size);
      // views that look out to the horizon keep a long range in focus; orbit and walk views focus on the subject
      const lookOut = SW.ui && SW.ui.camera.mode === 'look';
      D.uFocus.value = lookOut ? 40 : focus; D.uRange.value = lookOut ? 32 : focus * 0.22; D.uMaxR.value = (lookOut ? 4 : 7) * size.y / 1080;
      pass(dofMat, rtC);
      src = rtC;
    }
    fxaaMat.uniforms.tColor.value = src.texture; fxaaMat.uniforms.uRes.value.copy(size);
    pass(fxaaMat, null);
  };

  PP.init = function () {
    W = SW.world; renderer = W.renderer; scene = W.scene; camera = W.camera;
    const ext = renderer.extensions, isGL2 = renderer.capabilities.isWebGL2;
    const has = (n) => (ext.has ? ext.has(n) : !!ext.get(n));
    // the pipeline needs floating-point colour targets, since distances are stored in their alpha channel
    if (!(isGL2 ? has('EXT_color_buffer_float') : has('OES_texture_half_float') && has('EXT_color_buffer_half_float'))) return;
    hdrType = THREE.HalfFloatType;
    ok = true;
    renderer.getDrawingBufferSize(size);
    builtFor = size.x + 'x' + size.y + S.quality;
    build();
  };
  // Compile the passes that only run some of the time (sun shafts, depth of field) before they are needed.
  PP.warm = function () {
    if (!ok) return;
    for (const m of [aoMat, aoBlurMat, aoApplyMat, copyMat, preMat, downMat, upMat, rayMaskMat, rayBlurMat, compMat, dofMat, fxaaMat]) { quad.material = m; renderer.compile(quadScene, quadCam); }
  };
  PP.available = () => ok;
  PP.debugAO = (on) => { aoApplyMat.blending = on ? THREE.NoBlending : THREE.CustomBlending; };   // on: show the occlusion alone
  PP.setQuality = function (q) {
    PP.enabled = ok && q !== 'low';
    PP.reflections = PP.enabled && q === 'high';
    renderer.shadowMap.autoUpdate = !PP.enabled;
    if (ok) PP.resize();
  };
})(window.SW);
