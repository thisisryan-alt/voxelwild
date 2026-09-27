// Drawing mobs: each type's Bedrock model (assets/lbpr/mobs.json) becomes one static mesh per layer (body, sheep wool)
// with a bone index per vertex; every frame each mob's pose (walk cycle, head turn, attack, flapping, blaze rods,
// ghast tentacles, falling over when it dies) becomes up to 16 bone matrices.
import { mat4 } from './gl.js';

const FACES = {
  east: { n: [1, 0, 0], c: (a, b) => [[b[0], b[1], b[2]], [b[0], b[1], a[2]], [b[0], a[1], a[2]], [b[0], a[1], b[2]]] },
  west: { n: [-1, 0, 0], c: (a, b) => [[a[0], b[1], a[2]], [a[0], b[1], b[2]], [a[0], a[1], b[2]], [a[0], a[1], a[2]]] },
  up: { n: [0, 1, 0], c: (a, b) => [[b[0], b[1], a[2]], [a[0], b[1], a[2]], [a[0], b[1], b[2]], [b[0], b[1], b[2]]] },
  down: { n: [0, -1, 0], c: (a, b) => [[b[0], a[1], b[2]], [a[0], a[1], b[2]], [a[0], a[1], a[2]], [b[0], a[1], a[2]]] },
  south: { n: [0, 0, 1], c: (a, b) => [[a[0], b[1], b[2]], [b[0], b[1], b[2]], [b[0], a[1], b[2]], [a[0], a[1], b[2]]] },
  north: { n: [0, 0, -1], c: (a, b) => [[b[0], b[1], a[2]], [a[0], b[1], a[2]], [a[0], a[1], a[2]], [b[0], a[1], a[2]]] },
};
const DEG = Math.PI / 180;

export class MobModels {
  constructor(gl) { this.gl = gl; this.types = {}; }

  /** defs: mobs.json; load(file) -> ImageBitmap. */
  async load(defs, load) {
    const gl = this.gl;
    for (const [name, def] of Object.entries(defs)) {
      const layers = [];
      for (const layer of def.layers) {
        const bones = layer.bones, index = new Map(bones.map((b, i) => [b.name.toLowerCase(), i]));
        const v = [];
        bones.forEach((bone, bi) => {
          if (bone.hide) return;
          for (const c of bone.cubes) {
            const inf = c.inf || 0;
            const a = [c.o[0] - inf, c.o[1] - inf, c.o[2] - inf], b = [c.o[0] + c.s[0] + inf, c.o[1] + c.s[1] + inf, c.o[2] + c.s[2] + inf];
            // cube-level rotation (a few models): rotate its corners about its pivot
            const rot = c.r && (c.r[0] || c.r[1] || c.r[2]) ? rotMat(c.r) : null, pv = c.p || [0, 0, 0];
            for (const [fname, f] of Object.entries(FACES)) {
              const uv = c.f[fname];
              if (!uv) continue;
              let corners = f.c(a, b), n = f.n;
              if (rot) { corners = corners.map((p) => add(mul(rot, sub(p, pv)), pv)); n = mul(rot, n); }
              const t = [[uv[0], uv[1]], [uv[2], uv[1]], [uv[2], uv[3]], [uv[0], uv[3]]];
              for (const k of [0, 1, 2, 0, 2, 3]) v.push(...corners[k], ...n, ...t[k], bi);
            }
          }
        });
        const data = new Float32Array(v);
        const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
        const vbo = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vbo); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
        gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 36, 0);
        gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 36, 12);
        gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 36, 24);
        gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 1, gl.FLOAT, false, 36, 32);
        gl.bindVertexArray(null);
        const img = await load(layer.texture);
        const tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, img);
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        layers.push({ vao, count: data.length / 9, tex, bones, index });
      }
      this.types[name] = { layers, scale: def.scale || 1 };
    }
  }

  /** Bone matrices (Float32Array 16 x 16) of a mob's pose for one layer. */
  pose(m, layer, time) {
    const bones = layer.bones, out = this.buf || (this.buf = new Float32Array(16 * 16));
    const world = new Array(bones.length);
    const ws = m.walkSpeed, w = m.walk, swing = Math.sin(w) * 0.8 * ws;
    const named = (b) => b.name.toLowerCase();
    const calc = (i) => {
      if (world[i]) return world[i];
      const b = bones[i];
      // Bedrock angles turn the other way on x and y
      const r = [-b.rot[0] * DEG, -b.rot[1] * DEG, b.rot[2] * DEG];
      const n = named(b);
      // procedural animation
      if (n === 'head') { r[1] += m.headYaw; r[0] += m.headPitch; }
      else if (/^leg[0-7]$/.test(n)) {
        const k = +n[3];
        if ((m.def.base || m.type) === 'spider') { const ph = (k & 1 ? 1 : -1) * Math.sin(w * 1.3 + (k >> 1)) * 0.4 * ws; r[1] += ph; r[2] += Math.abs(Math.cos(w * 1.3 + (k >> 1))) * 0.2 * ws * (k & 1 ? 1 : -1); }
        else r[0] += (k === 0 || k === 3 ? 1 : -1) * swing;
      } else if (n === 'rightleg' || n === 'leftleg') r[0] += (n === 'rightleg' ? 1 : -1) * swing;
      else if (n === 'rightarm' || n === 'leftarm') {
        const zombie = m.type === 'husk' || m.type === 'zombified_piglin' || m.def.armsForward || ((m.def.base || m.type) === 'skeleton' && m.angry && m.def);
        r[0] += zombie ? Math.PI / 2 + Math.sin(time * 1.5 + (n === 'leftarm' ? 1 : 0)) * 0.08 + (m.swing || 0) * 0.6 : (n === 'rightarm' ? -1 : 1) * swing;
        r[2] += (n === 'rightarm' ? 1 : -1) * (0.05 + Math.sin(time * 1.1) * 0.03);
      } else if (n === 'wing0' || n === 'wing1') r[2] += (n === 'wing0' ? 1 : -1) * (m.body.grounded ? ws * 0.3 * Math.abs(Math.sin(w * 2)) : Math.abs(Math.sin(time * 20)) * 1.1);
      else if (n === 'tail') { r[1] += Math.sin(time * 6) * 0.35; r[0] += 0.4; }
      else if (n.startsWith('tentacles_')) r[0] += Math.sin(time * 1.3 + +n.split('_')[1]) * 0.25 + 0.2;
      let M = mat4.create();
      const p = b.pivot;
      if (n.startsWith('upperbodyparts')) {
        // blaze rods circle the body in three rings at different speeds
        // Minecraft's blaze: three rings of four rods (radius 9, 7, 5 px) turning at their own speeds and bobbing
        const k = +n.slice(14), ring = k >> 2, j = k & 3, age = time * 20;
        const base = [age * Math.PI * -0.1, Math.PI / 4 + age * Math.PI * 0.03, 0.47123894 + age * Math.PI * -0.05][ring] + j * Math.PI / 2;
        const rad = [9, 7, 5][ring];
        const top = ring === 0 ? 26 - Math.cos((2 * j + age) * 0.25) : ring === 1 ? 22 - Math.cos((2 * j + age) * 0.25) : 13 - Math.cos(1.5 * j + age * 0.5);
        M = mm(M, mat4.translation(mat4.create(), Math.cos(base) * rad - 1, top - 24, Math.sin(base) * rad - 1));
      }
      M = mm(M, mat4.translation(mat4.create(), p[0], p[1], p[2]));
      M = mm(M, rotZ(r[2])); M = mm(M, rotY(r[1])); M = mm(M, rotX(r[0]));
      M = mm(M, mat4.translation(mat4.create(), -p[0], -p[1], -p[2]));
      const parent = b.parent ? layer.index.get(b.parent.toLowerCase()) : undefined;
      if (parent != null && parent !== i) M = mm(calc(parent), M);
      world[i] = M;
      return M;
    };
    for (let i = 0; i < bones.length && i < 16; i++) {
      const b = bones[i];
      if (b.bind) {
        // a bind-pose rotation turns the bone's own cubes only, not its children
        const p = b.pivot;
        let B = mat4.translation(mat4.create(), p[0], p[1], p[2]);
        B = mm(B, rotZ(b.bind[2] * DEG)); B = mm(B, rotY(-b.bind[1] * DEG)); B = mm(B, rotX(-b.bind[0] * DEG));
        B = mm(B, mat4.translation(mat4.create(), -p[0], -p[1], -p[2]));
        out.set(mm(calc(i), B), i * 16);
      } else out.set(calc(i), i * 16);
    }
    return out;
  }

  /** The mob's placement: feet at its position, turned to its yaw, 1/16 block per model pixel; tipped over when dead. */
  model(m, scale) {
    const b = m.body.pos;
    let M = mat4.translation(mat4.create(), b[0], b[1], b[2]);
    M = mm(M, rotY(m.yaw));
    if (m.dead) M = mm(M, rotZ(Math.min(1, m.dead / 0.45) * Math.PI / 2));
    const s = scale / 16 * (1 + (m.fuse || 0) * 0.08);
    M = mm(M, scaling(s));
    return M;
  }
}

const mm = (a, b) => mat4.mul(new Float32Array(16), a, b);
const scaling = (s) => new Float32Array([s, 0, 0, 0, 0, s, 0, 0, 0, 0, s, 0, 0, 0, 0, 1]);
function rotX(a) { const c = Math.cos(a), s = Math.sin(a); return new Float32Array([1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1]); }
function rotY(a) { const c = Math.cos(a), s = Math.sin(a); return new Float32Array([c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]); }
function rotZ(a) { const c = Math.cos(a), s = Math.sin(a); return new Float32Array([c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]); }
function rotMat(r) {
  const x = -r[0] * DEG, y = -r[1] * DEG, z = r[2] * DEG;   // Bedrock's x and y turn the other way
  const cx = Math.cos(x), sx = Math.sin(x), cy = Math.cos(y), sy = Math.sin(y), cz = Math.cos(z), sz = Math.sin(z);
  // Rz * Ry * Rx as a 3x3 (rows)
  return [
    [cz * cy, cz * sy * sx - sz * cx, cz * sy * cx + sz * sx],
    [sz * cy, sz * sy * sx + cz * cx, sz * sy * cx - cz * sx],
    [-sy, cy * sx, cy * cx],
  ];
}
const mul = (m, v) => [m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2], m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2], m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
