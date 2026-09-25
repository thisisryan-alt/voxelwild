// WebGL2 renderer: HDR scene (sky, terrain, foliage, entities, water with refraction), two shadow cascades, sky LUT,
// cloud shadows, bloom, god rays and ACES tonemapping - the browser counterpart of the URP pipeline.
import { compile, setUniforms, texture2D, framebuffer, mat4, norm, frustumPlanes, boxInFrustum } from './gl.js';
import * as S from './shaders.js';
import { cloudNoise } from './sky.js';
import { LAYER_TUNING, LAYER_NAMES, BLOCKS, Shape, NONE, layerFor } from '../shared/blocks.js';
import { CS } from '../shared/const.js';

const SHADOW_SIZE = 2048;

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, depth: false, stencil: false, powerPreference: 'high-performance',
      preserveDrawingBuffer: false });
    if (!gl) throw new Error('WebGL2 is not available in this browser.');
    this.gl = gl;
    if (!gl.getExtension('EXT_color_buffer_float') && !gl.getExtension('EXT_color_buffer_half_float'))
      throw new Error('This GPU/browser cannot render to floating-point targets (EXT_color_buffer_float).');
    this.aniso = gl.getExtension('EXT_texture_filter_anisotropic');
    this.settings = { renderScale: 1, shadows: true, bloom: true, godRays: true, fov: 75 };
    this.sections = new Set();
    this.view = mat4.create(); this.proj = mat4.create(); this.viewProj = mat4.create(); this.invViewProj = mat4.create();
    this.shadowVP = [mat4.create(), mat4.create()];
    this.shadowVPFlat = new Float32Array(32);
    this.planes = [];
    this.tmp = mat4.create();
    this.frame = 0;
    this.stats = { drawn: 0, tris: 0, shadowDrawn: 0 };
    this.buildPrograms();
    this.buildStatic();
    this.width = 0; this.height = 0;
    this.gpuBytes = 0;
  }

  buildPrograms() {
    const gl = this.gl;
    const C = S.COMMON, L = S.LIGHTING;
    this.progs = {
      opaque: compile(gl, C + S.TERRAIN_VS, C + L + S.TERRAIN_FS, 'terrain'),
      cutout: compile(gl, C + S.TERRAIN_VS, C + L + S.TERRAIN_FS, 'foliage', '#define CUTOUT 1'),
      shadow: compile(gl, C + S.SHADOW_VS, C + S.SHADOW_FS, 'shadow'),
      shadowCut: compile(gl, C + S.SHADOW_VS, C + S.SHADOW_FS, 'shadow-cutout', '#define CUTOUT 1'),
      water: compile(gl, C + S.WATER_VS, C + L + S.WATER_FS, 'water'),
      skyLut: compile(gl, S.FULLSCREEN_VS, C + S.SKYMODEL + S.SKYLUT_FS, 'skylut'),
      sky: compile(gl, S.FULLSCREEN_VS, C + S.SKYMODEL + S.SKY_FS, 'sky'),
      bright: compile(gl, S.FULLSCREEN_VS, C + S.BRIGHT_FS, 'bright'),
      blur: compile(gl, S.FULLSCREEN_VS, C + S.BLUR_FS, 'blur'),
      rays: compile(gl, S.FULLSCREEN_VS, C + S.GODRAY_FS, 'godrays'),
      composite: compile(gl, S.FULLSCREEN_VS, C + S.COMPOSITE_FS, 'composite'),
      line: compile(gl, C + S.LINE_VS, C + S.LINE_FS, 'line'),
      crack: compile(gl, C + S.CRACK_VS, C + S.CRACK_FS, 'crack'),
      particle: compile(gl, C + S.PARTICLE_VS, C + S.PARTICLE_FS, 'particle'),
      sprite: compile(gl, C + S.SPRITE_VS, C + L + S.SPRITE_FS, 'sprite'),
    };
    // per-layer material tables
    const n = LAYER_NAMES.length;
    this.uLP = new Float32Array(n * 4); this.uLT = new Float32Array(n * 4); this.uLP2 = new Float32Array(n * 4);
    LAYER_TUNING.forEach((t, i) => {
      this.uLP.set([1 / t.tile, t.normal, t.rough, t.macro], i * 4);
      this.uLT.set([t.tint[0], t.tint[1], t.tint[2], t.spec], i * 4);
      this.uLP2.set([t.emission, t.trans, t.biome, t.cutout], i * 4);
    });
  }

  buildStatic() {
    const gl = this.gl;
    this.emptyVao = gl.createVertexArray();
    // unit box edges (selection outline)
    const e = [];
    const c = [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1], [0, 1, 0], [1, 1, 0], [1, 1, 1], [0, 1, 1]];
    for (const [a, b] of [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]]) e.push(...c[a], ...c[b]);
    this.lineVao = this.vaoFloat(new Float32Array(e), 3);
    // unit cube triangles (crack overlay)
    const t = [];
    const quads = [[0, 3, 7, 4], [1, 5, 6, 2], [4, 7, 6, 5], [0, 1, 2, 3], [3, 2, 6, 7], [0, 4, 5, 1]];
    for (const q of quads) for (const k of [0, 1, 2, 0, 2, 3]) t.push(...c[q[k]]);
    this.cubeVao = this.vaoFloat(new Float32Array(t), 3);
    // quad corners for particles / sprites
    const corners = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
    this.quadBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuf); gl.bufferData(gl.ARRAY_BUFFER, corners, gl.STATIC_DRAW);
    this.spriteVao = gl.createVertexArray();
    gl.bindVertexArray(this.spriteVao);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    this.partVao = gl.createVertexArray();
    gl.bindVertexArray(this.partVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuf);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    this.partBuf = gl.createBuffer();
    this.partCap = 0;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.partBuf);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 32, 0); gl.vertexAttribDivisor(1, 1);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 32, 16); gl.vertexAttribDivisor(2, 1);
    gl.bindVertexArray(null);

    // shadow maps
    this.shadowTex = [0, 1].map(() => {
      const tx = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tx);
      gl.texStorage2D(gl.TEXTURE_2D, 1, gl.DEPTH_COMPONENT24, SHADOW_SIZE, SHADOW_SIZE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
      tx.w = tx.h = SHADOW_SIZE;
      return tx;
    });
    this.shadowFbo = this.shadowTex.map((tx) => framebuffer(gl, null, tx));

    // sky LUT (equirectangular, mipmapped for rough reflections)
    this.skyLut = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.skyLut);
    gl.texStorage2D(gl.TEXTURE_2D, 6, gl.RGBA16F, 128, 64);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.skyLut.w = 128; this.skyLut.h = 64;
    this.skyLutFbo = framebuffer(gl, this.skyLut, null);

    // clouds
    this.cloudTex = texture2D(gl, 256, 256, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, { data: cloudNoise(256, 1337), wrap: gl.REPEAT, mips: true });

    // placeholder material arrays until the textures arrive
    const one = (rgba) => {
      const tx = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D_ARRAY, tx);
      const d = new Uint8Array(4 * LAYER_NAMES.length);
      for (let i = 0; i < LAYER_NAMES.length; i++) d.set(rgba, i * 4);
      gl.texImage3D(gl.TEXTURE_2D_ARRAY, 0, gl.RGBA8, 1, 1, LAYER_NAMES.length, 0, gl.RGBA, gl.UNSIGNED_BYTE, d);
      gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      return tx;
    };
    this.albedo = one([160, 160, 160, 255]); this.normal = one([128, 128, 255, 255]); this.mask = one([255, 200, 0, 0]);
    this.atlas = texture2D(gl, 1, 1, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, { data: new Uint8Array([255, 0, 255, 0]) });
  }

  vaoFloat(data, comps) {
    const gl = this.gl;
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const b = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, comps, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    vao.count = data.length / comps;
    return vao;
  }

  /** Uploads one material strip (layers stacked vertically) as a mipmapped texture array. */
  uploadLayers(which, bitmap) {
    const gl = this.gl;
    const size = bitmap.width, layers = Math.round(bitmap.height / size);
    const tx = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, tx);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
    const mips = Math.floor(Math.log2(size)) + 1;
    gl.texStorage3D(gl.TEXTURE_2D_ARRAY, mips, gl.RGBA8, size, size, layers);
    gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, 0, size, size, layers, gl.RGBA, gl.UNSIGNED_BYTE, bitmap);
    gl.generateMipmap(gl.TEXTURE_2D_ARRAY);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.REPEAT);
    if (this.aniso) gl.texParameterf(gl.TEXTURE_2D_ARRAY, this.aniso.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, gl.getParameter(this.aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
    gl.deleteTexture(this[which]);
    this[which] = tx;
    this.gpuBytes += size * size * 4 * layers * 1.33;
  }

  uploadAtlas(canvas) {
    const gl = this.gl;
    gl.deleteTexture(this.atlas);
    const tx = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tx);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.atlas = tx;
  }

  // ---------------------------------------------------------------- section meshes

  /** Vertex layout shared by sections and entity cubes (24 bytes). */
  bindVertexLayout() {
    const gl = this.gl;
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.UNSIGNED_BYTE, true, 24, 12);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.UNSIGNED_BYTE, true, 24, 16);
    gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 4, gl.UNSIGNED_BYTE, true, 24, 20);
  }

  uploadSection(s, m) {
    this.freeSection(s);
    if (!m || m.vertexCount === 0) return;
    const gl = this.gl;
    const n0 = m.opaque.length, n1 = m.cutout.length, n2 = m.water.length;
    const small = m.vertexCount < 65536;
    const idx = small ? new Uint16Array(n0 + n1 + n2) : new Uint32Array(n0 + n1 + n2);
    idx.set(m.opaque); idx.set(m.cutout, n0); idx.set(m.water, n0 + n1);
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo); gl.bufferData(gl.ARRAY_BUFFER, m.vertices, gl.STATIC_DRAW);
    this.bindVertexLayout();
    const ibo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    const bytes = m.vertices.byteLength + idx.byteLength;
    this.gpuBytes += bytes;
    s.gl = { vao, vbo, ibo, n0, n1, n2, type: small ? gl.UNSIGNED_SHORT : gl.UNSIGNED_INT, isz: small ? 2 : 4, bytes,
      model: mat4.translation(new Float32Array(16), s.cx * CS, s.sy * CS, s.cz * CS), origin: [s.cx * CS, s.sy * CS, s.cz * CS] };
    this.sections.add(s);
  }

  freeSection(s) {
    if (!s.gl) return;
    const gl = this.gl;
    gl.deleteVertexArray(s.gl.vao); gl.deleteBuffer(s.gl.vbo); gl.deleteBuffer(s.gl.ibo);
    this.gpuBytes -= s.gl.bytes;
    s.gl = null;
    this.sections.delete(s);
  }

  /** A 1x1x1 block model in the terrain vertex format (dropped items, the held block). */
  blockModel(id) {
    this.blockModels = this.blockModels || new Map();
    let m = this.blockModels.get(id);
    if (m) return m;
    const gl = this.gl, d = BLOCKS[id];
    const FN = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
    const FT = [[0, 0, 1], [0, 0, -1], [1, 0, 0], [-1, 0, 0], [-1, 0, 0], [1, 0, 0]];
    const FB = [[0, 1, 0], [0, 1, 0], [0, 0, 1], [0, 0, 1], [0, 1, 0], [0, 1, 0]];
    const buf = new ArrayBuffer(24 * 24), f32 = new Float32Array(buf), u8 = new Uint8Array(buf);
    const idx = new Uint16Array(36);
    let v = 0;
    for (let f = 0; f < 6; f++) {
      const n = FN[f], t = FT[f], b = FB[f];
      const cut = d.shape === Shape.Cutout;
      for (const [su, sv] of [[-1, -1], [-1, 1], [1, 1], [1, -1]]) {
        const o = v * 24;
        f32[o / 4] = 0.5 + n[0] * 0.5 + (t[0] * su + b[0] * sv) * 0.5;
        f32[o / 4 + 1] = 0.5 + n[1] * 0.5 + (t[1] * su + b[1] * sv) * 0.5;
        f32[o / 4 + 2] = 0.5 + n[2] * 0.5 + (t[2] * su + b[2] * sv) * 0.5;
        u8[o + 12] = f | ((cut ? 0 : 15) << 3); u8[o + 13] = layerFor(d, f); u8[o + 14] = 255;
        u8[o + 15] = f === 2 || f === 3 ? (f === 2 && d.overlay !== NONE ? NONE : NONE) : d.overlay;
        u8[o + 16] = 255; u8[o + 17] = 0; u8[o + 18] = 150; u8[o + 19] = 120;
        u8[o + 20] = d.tint; u8[o + 21] = 0; u8[o + 22] = 128; u8[o + 23] = 128;
        v++;
      }
      idx.set([0, 1, 2, 0, 2, 3].map((k) => f * 4 + k), f * 6);
    }
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const vbo = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vbo); gl.bufferData(gl.ARRAY_BUFFER, buf, gl.STATIC_DRAW);
    this.bindVertexLayout();
    const ibo = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    m = { vao, count: 36 };
    this.blockModels.set(id, m);
    return m;
  }

  // ---------------------------------------------------------------- targets

  resize() {
    const gl = this.gl;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(64, Math.floor(this.canvas.clientWidth * dpr * this.settings.renderScale));
    const h = Math.max(64, Math.floor(this.canvas.clientHeight * dpr * this.settings.renderScale));
    if (w === this.width && h === this.height) return;
    this.width = w; this.height = h;
    this.canvas.width = w; this.canvas.height = h;
    const del = (t) => t && gl.deleteTexture(t);
    for (const t of [this.hdr, this.depth, this.copyColor, this.copyDepth, this.half, this.quarter, this.eighth, this.eighth2, this.raysTex]) del(t);
    const hdr = (ww, hh) => texture2D(gl, ww, hh, gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT);
    const depthTex = () => {
      const t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texStorage2D(gl.TEXTURE_2D, 1, gl.DEPTH_COMPONENT24, w, h);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      t.w = w; t.h = h;
      return t;
    };
    this.hdr = hdr(w, h); this.depth = depthTex();
    this.copyColor = hdr(w, h); this.copyDepth = depthTex();
    this.hdrFbo = framebuffer(gl, this.hdr, this.depth);
    this.copyFbo = framebuffer(gl, this.copyColor, this.copyDepth);
    const hw = Math.max(1, w >> 1), hh = Math.max(1, h >> 1);
    this.half = hdr(hw, hh); this.quarter = hdr(Math.max(1, w >> 2), Math.max(1, h >> 2));
    this.eighth = hdr(Math.max(1, w >> 3), Math.max(1, h >> 3)); this.eighth2 = hdr(Math.max(1, w >> 3), Math.max(1, h >> 3));
    this.raysTex = hdr(hw, hh);
    this.halfFbo = framebuffer(gl, this.half); this.quarterFbo = framebuffer(gl, this.quarter);
    this.eighthFbo = framebuffer(gl, this.eighth); this.eighth2Fbo = framebuffer(gl, this.eighth2);
    this.raysFbo = framebuffer(gl, this.raysTex);
  }

  bindTex(unit, target, tex) { const gl = this.gl; gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(target, tex); }

  use(prog, extra) {
    const gl = this.gl;
    gl.useProgram(prog.p);
    if (prog.stamp !== this.frame) { prog.stamp = this.frame; setUniforms(gl, prog, this.U); }
    if (extra) setUniforms(gl, prog, extra);
  }

  fullscreen() { const gl = this.gl; gl.bindVertexArray(this.emptyVao); gl.drawArrays(gl.TRIANGLES, 0, 3); }

  // ---------------------------------------------------------------- frame

  /**
   * f: { camPos, yaw, pitch, time, sky (TimeOfDay state), weather, viewDistance, camSky, underwater, selection, crack, entities,
   *      sprites, particles, hand, damage, flash }
   */
  render(f) {
    const gl = this.gl;
    this.resize();
    this.frame++;
    const W = this.width, H = this.height;
    const far = Math.max(160, f.viewDistance * CS + 48), near = 0.06;
    mat4.perspective(this.proj, this.settings.fov * Math.PI / 180, W / H, near, far);
    mat4.fpsView(this.view, f.camPos, f.yaw, f.pitch);
    mat4.mul(this.viewProj, this.proj, this.view);
    mat4.invert(this.invViewProj, this.viewProj);
    frustumPlanes(this.viewProj, this.planes);
    const sky = f.sky, wth = f.weather;

    // ---- frame uniforms
    const fogDensity = f.underwater ? 0.09 : 0.0016 + wth.fog * 0.012;
    const fogColor = f.underwater ? sky.ambUp.map((c, i) => c * [0.05, 0.28, 0.35][i] * 1.2) : sky.fogColor;
    this.cloudOff = this.cloudOff || [0, 0];
    this.cloudOff[0] += wth.windX * f.dt * 6; this.cloudOff[1] += wth.windZ * f.dt * 6;
    const shadowsOn = this.settings.shadows && sky.lightColor[0] + sky.lightColor[1] > 0.02;
    this.U = {
      uTime: f.time, uWind: [wth.windX, wth.windStrength, wth.windZ, wth.gust],
      uViewProj: this.viewProj, uCamPos: f.camPos,
      uLightDir: sky.lightDir, uLightColor: sky.lightColor,
      uAmbUp: sky.ambUp, uAmbHorizon: sky.ambHorizon, uAmbDown: sky.ambDown,
      uFogColor: fogColor, uFogSun: f.underwater ? [0, 0, 0] : sky.fogSun,
      uFog: [fogDensity, f.underwater ? 0 : 0.018, 64, 0], uFogEdge: f.underwater ? [1e5, 1e5 + 1] : [f.viewDistance * CS * 0.6, f.viewDistance * CS * 0.96],
      uBlockColor: [1.0 * 2.4, 0.62 * 2.4, 0.3 * 2.4], uCamSky: f.camSky,
      uShadowVP: this.shadowVPFlat, uShadowDist: [22, 88], uShadowOn: shadowsOn ? 1 : 0,
      uShadow0: 4, uShadow1: 5, uCloudTex: 6, uSkyLut: 3, uAlbedo: 0, uNormal: 1, uMask: 2, uSceneColor: 7, uSceneDepth: 8, uAtlas: 9,
      uCloud: [wth.cloudCover, 1 / 5200, 420, 0.55 * wth.cloudCover + 0.1], uCloudOff: [this.cloudOff[0], this.cloudOff[1], 2.2, 1 - wth.storm * 0.55],
      uWet: wth.wetness, uSnow: wth.snowCover,
      uLP: this.uLP, uLT: this.uLT, uLP2: this.uLP2,
      uBevelWidth: 0.07, uBevelStrength: 0.55, uEdgeWear: 0.3, uAOStrength: 1, uAODirect: 0.55, uOverhang: 0.2, uCutoff: 0.45,
      uFlash: f.flash || 0, uEntityLight: [-1, 0], uModelRot: [1, 0, 0, 0, 1, 0, 0, 0, 1],
      uNearFar: [near, far], uViewport: [W, H], uDebug: this.debugView | 0,
    };

    // ---- textures on fixed units
    this.bindTex(0, gl.TEXTURE_2D_ARRAY, this.albedo);
    this.bindTex(1, gl.TEXTURE_2D_ARRAY, this.normal);
    this.bindTex(2, gl.TEXTURE_2D_ARRAY, this.mask);
    this.bindTex(4, gl.TEXTURE_2D, this.shadowTex[0]);
    this.bindTex(5, gl.TEXTURE_2D, this.shadowTex[1]);
    this.bindTex(6, gl.TEXTURE_2D, this.cloudTex);
    this.bindTex(9, gl.TEXTURE_2D, this.atlas);

    // ---- sky LUT
    this.bindTex(3, gl.TEXTURE_2D, null);
    if (sky.skyDirty || !this.lutReady) {
      sky.skyDirty = false; this.lutReady = true;
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.skyLutFbo);
      gl.viewport(0, 0, 128, 64);
      gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND); gl.disable(gl.CULL_FACE);
      const nightK = 1;
      this.use(this.progs.skyLut, { uSunDir: sky.sun, uCloudGrey: wth.cloudCover * 0.55,
        uNight: [0.0022 * nightK + sky.illum * 0.004 * Math.max(0, sky.moon[1]), 0.0032 + sky.illum * 0.005 * Math.max(0, sky.moon[1]), 0.0068 + sky.illum * 0.008 * Math.max(0, sky.moon[1])] });
      this.fullscreen();
      gl.bindTexture(gl.TEXTURE_2D, this.skyLut);
      gl.generateMipmap(gl.TEXTURE_2D);
    }
    this.bindTex(3, gl.TEXTURE_2D, this.skyLut);

    // ---- visible sections (frustum + cave culling), near to far
    const visible = [];
    const cp = f.camPos, maxD2 = (far + 48) ** 2;
    for (const s of this.sections) {
      if (!s.visible) continue;
      const o = s.gl.origin;
      const dx = o[0] + 16 - cp[0], dy = o[1] + 16 - cp[1], dz = o[2] + 16 - cp[2];
      const d2 = dx * dx + dz * dz;
      if (d2 > maxD2) continue;
      s.dist = d2 + dy * dy;
      if (!boxInFrustum(this.planes, o[0], o[1], o[2], o[0] + CS, o[1] + CS, o[2] + CS)) continue;
      visible.push(s);
    }
    visible.sort((a, b) => a.dist - b.dist);

    // ---- shadows
    if (shadowsOn) this.renderShadows(f);

    // ---- main HDR pass
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.hdrFbo);
    gl.viewport(0, 0, W, H);
    gl.depthMask(true);
    gl.clearDepth(1);
    gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND);
    this.use(this.progs.sky, { uInvViewProj: this.invViewProj, uSunDir: sky.sun, uMoonDir: sky.moon,
      uSunParams: [sky.sunVisible * (1 - wth.cloudCover * 0.85), sky.illum, (1 - wth.cloudCover) * 1.2, sky.starRot],
      uSunColorC: sky.sunColorClouds, uZenith: sky.zenith });
    this.fullscreen();

    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LESS);
    gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK); gl.frontFace(gl.CCW);   // mesher quads are counter-clockwise seen from outside
    let drawn = 0, tris = 0;
    this.use(this.progs.opaque);
    const uModel = this.progs.opaque.u.uModel.loc, uOrigin = this.progs.opaque.u.uTexOrigin.loc;
    for (const s of visible) {
      const g = s.gl;
      if (!g.n0) continue;
      gl.uniformMatrix4fv(uModel, false, g.model); gl.uniform3fv(uOrigin, g.origin);
      gl.bindVertexArray(g.vao);
      gl.drawElements(gl.TRIANGLES, g.n0, g.type, 0);
      drawn++; tris += g.n0 / 3;
    }
    gl.disable(gl.CULL_FACE);
    this.use(this.progs.cutout);
    const cModel = this.progs.cutout.u.uModel.loc, cOrigin = this.progs.cutout.u.uTexOrigin.loc;
    for (const s of visible) {
      const g = s.gl;
      if (!g.n1) continue;
      gl.uniformMatrix4fv(cModel, false, g.model); gl.uniform3fv(cOrigin, g.origin);
      gl.bindVertexArray(g.vao);
      gl.drawElements(gl.TRIANGLES, g.n1, g.type, g.n0 * g.isz);
      tris += g.n1 / 3;
    }
    // entities (dropped blocks) with the foliage program (handles rotation + cutout)
    if (f.entities && f.entities.length) this.drawEntities(f.entities);
    if (f.sprites && f.sprites.length) this.drawSprites(f.sprites, f);
    this.stats.drawn = drawn; this.stats.tris = tris;

    // ---- water: refraction reads a copy of the scene so far
    const anyWater = visible.some((s) => s.gl.n2 > 0);
    if (anyWater) {
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this.hdrFbo);
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, this.copyFbo);
      gl.blitFramebuffer(0, 0, W, H, 0, 0, W, H, gl.COLOR_BUFFER_BIT, gl.NEAREST);
      gl.blitFramebuffer(0, 0, W, H, 0, 0, W, H, gl.DEPTH_BUFFER_BIT, gl.NEAREST);
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.hdrFbo);
      this.bindTex(7, gl.TEXTURE_2D, this.copyColor);
      this.bindTex(8, gl.TEXTURE_2D, this.copyDepth);
      this.use(this.progs.water);
      const wModel = this.progs.water.u.uModel.loc, wOrigin = this.progs.water.u.uTexOrigin && this.progs.water.u.uTexOrigin.loc;
      for (let i = visible.length - 1; i >= 0; i--) {
        const g = visible[i].gl;
        if (!g.n2) continue;
        gl.uniformMatrix4fv(wModel, false, g.model); if (wOrigin) gl.uniform3fv(wOrigin, g.origin);
        gl.bindVertexArray(g.vao);
        gl.drawElements(gl.TRIANGLES, g.n2, g.type, (g.n0 + g.n1) * g.isz);
      }
      this.bindTex(7, gl.TEXTURE_2D, null);
      this.bindTex(8, gl.TEXTURE_2D, null);
    }

    // ---- overlays: crack, outline, particles
    if (f.crack) {
      gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.depthMask(false); gl.depthFunc(gl.LEQUAL);
      gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(-1, -2);
      this.use(this.progs.crack, { uOffset: f.crack.pos, uProgress: f.crack.progress });
      gl.bindVertexArray(this.cubeVao); gl.drawArrays(gl.TRIANGLES, 0, this.cubeVao.count);
      gl.disable(gl.POLYGON_OFFSET_FILL);
    }
    if (f.selection) {
      gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.depthMask(false); gl.depthFunc(gl.LEQUAL);
      const k = f.camSky * 0.9 + 0.1;
      this.use(this.progs.line, { uOffset: f.selection.map((v) => v - 0.002), uScale: 1.004, uColor: [0.02 * k, 0.02 * k, 0.02 * k, 0.75] });
      gl.bindVertexArray(this.lineVao); gl.drawArrays(gl.LINES, 0, this.lineVao.count);
    }
    if (f.particles) this.drawParticles(f.particles, f);
    gl.depthMask(true); gl.depthFunc(gl.LESS); gl.disable(gl.BLEND);

    // ---- first-person hand item (own depth range)
    this.raysDepth = this.depth;
    if (f.hand) {
      // keep the scene depth for the god-ray sky mask, then give the hand its own depth range
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this.hdrFbo);
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, this.copyFbo);
      gl.blitFramebuffer(0, 0, W, H, 0, 0, W, H, gl.DEPTH_BUFFER_BIT, gl.NEAREST);
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.hdrFbo);
      this.raysDepth = this.copyDepth;
      gl.clear(gl.DEPTH_BUFFER_BIT);
      this.drawHand(f);
    }

    this.post(f);
    gl.bindVertexArray(null);
  }

  renderShadows(f) {
    const gl = this.gl, sky = f.sky;
    const L = sky.lightDir;
    const up = Math.abs(L[1]) > 0.99 ? [1, 0, 0] : [0, 1, 0];
    const lightView = mat4.lookDir(mat4.create(), [0, 0, 0], [-L[0], -L[1], -L[2]], up);
    const radii = [22, 88];
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LESS); gl.depthMask(true);
    gl.disable(gl.CULL_FACE); gl.disable(gl.BLEND);
    gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(1.5, 3);
    let drawnTotal = 0;
    for (let c = 0; c < 2; c++) {
      // the far cascade refreshes every other frame
      if (c === 1 && (this.frame & 1) && this.shadowFresh) continue;
      const r = radii[c];
      const cp = f.camPos;
      // centre ahead of the camera, snapped to shadow texels in light space
      const fwd = [-Math.sin(f.yaw) * Math.cos(f.pitch), Math.sin(f.pitch), -Math.cos(f.yaw) * Math.cos(f.pitch)];
      const center = [cp[0] + fwd[0] * r * 0.35, cp[1] + fwd[1] * r * 0.35, cp[2] + fwd[2] * r * 0.35];
      const lv = lightView;
      let lx = lv[0] * center[0] + lv[4] * center[1] + lv[8] * center[2];
      let ly = lv[1] * center[0] + lv[5] * center[1] + lv[9] * center[2];
      const lz = lv[2] * center[0] + lv[6] * center[1] + lv[10] * center[2];
      const texel = (2 * r) / SHADOW_SIZE;
      lx = Math.round(lx / texel) * texel; ly = Math.round(ly / texel) * texel;
      const depth = 260;
      const proj = mat4.ortho(mat4.create(), lx - r, lx + r, ly - r, ly + r, -lz - depth, -lz + depth);
      const vp = mat4.mul(this.shadowVP[c], proj, lightView);
      this.shadowVPFlat.set(vp, c * 16);
      const planes = frustumPlanes(vp, []);
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowFbo[c]);
      gl.viewport(0, 0, SHADOW_SIZE, SHADOW_SIZE);
      gl.clear(gl.DEPTH_BUFFER_BIT);
      for (const pass of [0, 1]) {
        const prog = pass === 0 ? this.progs.shadow : this.progs.shadowCut;
        this.use(prog, { uViewProj: vp });
        const um = prog.u.uModel.loc, uo = prog.u.uTexOrigin ? prog.u.uTexOrigin.loc : null;
        for (const s of this.sections) {
          const g = s.gl, n = pass === 0 ? g.n0 : g.n1;
          if (!n) continue;
          const o = g.origin;
          if (!boxInFrustum(planes, o[0], o[1], o[2], o[0] + CS, o[1] + CS, o[2] + CS)) continue;
          gl.uniformMatrix4fv(um, false, g.model); if (uo) gl.uniform3fv(uo, o);
          gl.bindVertexArray(g.vao);
          gl.drawElements(gl.TRIANGLES, n, g.type, pass === 0 ? 0 : g.n0 * g.isz);
          drawnTotal++;
        }
      }
    }
    this.shadowFresh = true;
    gl.disable(gl.POLYGON_OFFSET_FILL);
    this.stats.shadowDrawn = drawnTotal;
  }

  drawEntities(list) {
    const gl = this.gl, prog = this.progs.cutout;
    this.use(prog);
    const m = new Float32Array(16);
    for (const e of list) {
      const model = this.blockModel(e.block);
      const c = Math.cos(e.rot), s = Math.sin(e.rot), k = e.scale;
      // translate(pos) * rotY * scale * translate(-0.5)
      m.set([c * k, 0, -s * k, 0, 0, k, 0, 0, s * k, 0, c * k, 0, 0, 0, 0, 1]);
      m[12] = e.pos[0] - (c * 0.5 + s * 0.5) * k; m[13] = e.pos[1] - 0.5 * k; m[14] = e.pos[2] - (-s * 0.5 + c * 0.5) * k;
      setUniforms(gl, prog, { uModel: m, uTexOrigin: [0, 0, 0], uModelRot: [c, 0, -s, 0, 1, 0, s, 0, c], uEntityLight: [e.sky, e.blockLight] });
      gl.bindVertexArray(model.vao);
      gl.drawElements(gl.TRIANGLES, model.count, gl.UNSIGNED_SHORT, 0);
    }
    setUniforms(gl, prog, { uEntityLight: [-1, 0], uModelRot: [1, 0, 0, 0, 1, 0, 0, 0, 1] });
  }

  spriteTint(f, sky, blk) {
    const s = f.sky, k = sky * sky;
    const sun = Math.max(0, s.lightDir[1]) * 0.6 + 0.25;
    return [0, 1, 2].map((i) => (s.ambUp[i] * 0.8 + s.lightColor[i] * sun * (sky > 0.8 ? 1 : 0)) * k + [2.4, 1.5, 0.7][i] * blk * blk + 0.01);
  }

  drawSprites(list, f) {
    const gl = this.gl, prog = this.progs.sprite;
    gl.disable(gl.CULL_FACE);
    this.use(prog);
    const right = [Math.cos(f.yaw), 0, -Math.sin(f.yaw)];
    gl.bindVertexArray(this.spriteVao);
    for (const s of list) {
      const r = s.right || right.map((v) => v * s.size), u = s.up || [0, s.size, 0];
      setUniforms(gl, prog, { uCenter: s.pos, uRight: r, uUp: u, uRect: s.rect, uTint: this.spriteTint(f, s.sky, s.block) });
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
  }

  drawParticles(groups, f) {
    const gl = this.gl, prog = this.progs.particle;
    const cy = Math.cos(f.yaw), sy = Math.sin(f.yaw), cp = Math.cos(f.pitch), sp = Math.sin(f.pitch);
    const right = [cy, 0, -sy], up = [sy * sp, cp, cy * sp];
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false); gl.depthFunc(gl.LESS);
    gl.disable(gl.CULL_FACE);
    for (const g of groups) {
      if (!g.count) continue;
      const bytes = g.count * 32;
      gl.bindBuffer(gl.ARRAY_BUFFER, this.partBuf);
      if (bytes > this.partCap) { this.partCap = Math.max(bytes, this.partCap * 2); gl.bufferData(gl.ARRAY_BUFFER, this.partCap, gl.DYNAMIC_DRAW); }
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, g.data, 0, g.count * 8);
      const r = g.stretch ? [cy, 0, -sy] : right, u = g.stretch ? [0, 0, 0] : up;
      this.use(prog, { uCamRight: r, uCamUp: u, uStretch: g.stretch || [0, 0, 0], uRound: g.round ? 1 : 0 });
      gl.bindVertexArray(this.partVao);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, g.count);
    }
  }

  drawHand(f) {
    const gl = this.gl, h = f.hand;
    // hand space -> world: camera basis
    const cy = Math.cos(f.yaw), sy = Math.sin(f.yaw), cp = Math.cos(f.pitch), sp = Math.sin(f.pitch);
    const right = [cy, 0, -sy], up = [sy * sp, cp, cy * sp], fwd = [-sy * cp, sp, -cy * cp];
    const swing = Math.sin(Math.min(1, h.swing) * Math.PI);
    const bob = h.bob;
    const off = [0.34 + swing * -0.08 + bob[0], -0.3 - swing * 0.06 + bob[1] - h.lower * 0.3, 0.56 + swing * 0.1];
    const pos = [0, 1, 2].map((i) => f.camPos[i] + right[i] * off[0] + up[i] * off[1] + fwd[i] * off[2]);
    if (h.block != null) {
      // rotate the block in camera space: yaw 45deg-ish and swing tilt
      const k = 0.165, a = -0.72 + swing * 0.9, t = 0.25 + swing * 0.6;
      const ca = Math.cos(a), sa = Math.sin(a), ct = Math.cos(t), st = Math.sin(t);
      // local basis in camera space
      const lx = [ca, 0, -sa], lyr = [sa * st, ct, ca * st], lz = [sa * ct, -st, ca * ct];
      const toWorld = (v) => [0, 1, 2].map((i) => right[i] * v[0] + up[i] * v[1] - fwd[i] * v[2]);
      const X = toWorld(lx), Y = toWorld(lyr), Z = toWorld(lz);
      const m = new Float32Array(16);
      m.set([X[0] * k, X[1] * k, X[2] * k, 0, Y[0] * k, Y[1] * k, Y[2] * k, 0, Z[0] * k, Z[1] * k, Z[2] * k, 0, 0, 0, 0, 1]);
      for (let i = 0; i < 3; i++) m[12 + i] = pos[i] - (X[i] + Y[i] + Z[i]) * 0.5 * k;
      const prog = this.progs.cutout;
      this.use(prog, { uModel: m, uTexOrigin: [0, 0, 0], uModelRot: [...X, ...Y, ...Z], uEntityLight: [h.sky, h.blockLight] });
      gl.disable(gl.CULL_FACE);
      const model = this.blockModel(h.block);
      gl.bindVertexArray(model.vao);
      gl.drawElements(gl.TRIANGLES, model.count, gl.UNSIGNED_SHORT, 0);
      setUniforms(gl, prog, { uEntityLight: [-1, 0], uModelRot: [1, 0, 0, 0, 1, 0, 0, 0, 1] });
    } else if (h.rect) {
      const tilt = 0.5 + swing * 0.9, s = 0.085;
      const ct = Math.cos(tilt), st = Math.sin(tilt);
      const r2 = [0, 1, 2].map((i) => (right[i] * ct + fwd[i] * st * 0.3) * s);
      const u2 = [0, 1, 2].map((i) => (up[i] * ct - right[i] * st * 0.6 + fwd[i] * 0.2) * s);
      this.drawSprites([{ pos, right: r2, up: u2, rect: h.rect, sky: h.sky, block: h.blockLight }], f);
    }
  }

  post(f) {
    const gl = this.gl, P = this.progs, W = this.width, H = this.height;
    gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND); gl.disable(gl.CULL_FACE); gl.depthMask(false);
    const pass = (fbo, prog, u, tex) => {
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.viewport(0, 0, fbo ? fbo.w : W, fbo ? fbo.h : H);
      tex.forEach((t, i) => this.bindTex(10 + i, gl.TEXTURE_2D, t));
      this.use(prog, u);
      this.fullscreen();
    };
    const bloom = this.settings.bloom;
    if (bloom) {
      pass(this.halfFbo, P.bright, { uTex: 10, uThreshold: 1.1 }, [this.hdr]);
      pass(this.quarterFbo, P.blur, { uTex: 10, uTexel: [1 / this.half.w, 1 / this.half.h] }, [this.half]);
      pass(this.eighthFbo, P.blur, { uTex: 10, uTexel: [1 / this.quarter.w, 1 / this.quarter.h] }, [this.quarter]);
      pass(this.eighth2Fbo, P.blur, { uTex: 10, uTexel: [1 / this.eighth.w, 1 / this.eighth.h] }, [this.eighth]);
    }
    // god rays toward the sun when it is on screen
    const sky = f.sky;
    let rays = 0, sunUV = [0.5, 0.5];
    if (this.settings.godRays && !f.underwater && sky.sunVisible > 0) {
      const p = [f.camPos[0] + sky.sun[0] * 1000, f.camPos[1] + sky.sun[1] * 1000, f.camPos[2] + sky.sun[2] * 1000, 1];
      const m = this.viewProj;
      const cx = m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], cyy = m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13];
      const cw = m[3] * p[0] + m[7] * p[1] + m[11] * p[2] + m[15];
      if (cw > 0) {
        sunUV = [cx / cw * 0.5 + 0.5, cyy / cw * 0.5 + 0.5];
        const edge = Math.max(Math.abs(sunUV[0] - 0.5), Math.abs(sunUV[1] - 0.5));
        rays = 0.35 * sky.sunVisible * Math.max(0, 1 - Math.max(0, edge - 0.5) / 0.6) * (1 - f.weather.cloudCover * 0.8) * f.camSky;
      }
    }
    if (rays > 0.002) pass(this.raysFbo, P.rays, { uColor: 10, uDepth: 11, uSunUV: sunUV, uStrength: rays }, [this.hdr, this.raysDepth]);
    else { gl.bindFramebuffer(gl.FRAMEBUFFER, this.raysFbo); gl.viewport(0, 0, this.raysFbo.w, this.raysFbo.h); gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT); }
    const underground = 1 - f.camSky;
    const exposure = sky.exposure * (1 + underground * 1.6) * (f.underwater ? 1.3 : 1);
    pass(null, P.composite, { uColor: 10, uBloom: 11, uBloom2: 12, uRays: 13, uExposure: exposure, uBloomAmt: bloom ? 0.07 : 0,
      uUnderwater: f.underwater ? 1 : 0, uUnderwaterColor: [0.01, 0.06, 0.08], uSaturation: 1.08, uVignette: 0.55, uDamage: f.damage || 0 },
      [this.hdr, bloom ? this.quarter : this.half, bloom ? this.eighth2 : this.half, this.raysTex]);
    for (let i = 10; i < 14; i++) this.bindTex(i, gl.TEXTURE_2D, null);
    gl.depthMask(true);
  }
}
