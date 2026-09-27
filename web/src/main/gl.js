// Small WebGL2 helpers and the matrix maths the renderer needs (column-major Float32Array mat4).

export function compile(gl, vsSrc, fsSrc, name, defines = '') {
  const head = `#version 300 es\n${defines}\n`;
  const sh = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, head + src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(s);
      const lines = (head + src).split('\n').map((l, i) => `${i + 1}: ${l}`);
      const m = /ERROR: \d+:(\d+)/.exec(log || '');
      const ctx = m ? lines.slice(Math.max(0, +m[1] - 4), +m[1] + 2).join('\n') : '';
      throw new Error(`${name} ${type === gl.VERTEX_SHADER ? 'vertex' : 'fragment'} shader: ${log}\n${ctx}`);
    }
    return s;
  };
  const p = gl.createProgram();
  gl.attachShader(p, sh(gl.VERTEX_SHADER, vsSrc));
  gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fsSrc));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(`${name} link: ${gl.getProgramInfoLog(p)}`);
  const prog = { p, name, u: {}, stamp: -1, texUnits: {} };
  const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) {
    const info = gl.getActiveUniform(p, i);
    const nm = info.name.replace(/\[0\]$/, '');
    prog.u[nm] = { loc: gl.getUniformLocation(p, info.name), type: info.type, size: info.size };
  }
  return prog;
}

/** Sets uniforms by name from an object; unknown names are ignored so shared frame state can be pushed to any program. */
export function setUniforms(gl, prog, values) {
  for (const k in values) {
    const u = prog.u[k];
    if (!u) continue;
    const v = values[k];
    switch (u.type) {
      case gl.FLOAT: u.size > 1 ? gl.uniform1fv(u.loc, v) : gl.uniform1f(u.loc, v); break;
      case gl.FLOAT_VEC2: gl.uniform2fv(u.loc, v); break;
      case gl.FLOAT_VEC3: gl.uniform3fv(u.loc, v); break;
      case gl.FLOAT_VEC4: gl.uniform4fv(u.loc, v); break;
      case gl.FLOAT_MAT3: gl.uniformMatrix3fv(u.loc, false, v); break;
      case gl.FLOAT_MAT4: gl.uniformMatrix4fv(u.loc, false, v); break;
      case gl.INT: case gl.BOOL: gl.uniform1i(u.loc, v); break;
      default: gl.uniform1i(u.loc, v); break;   // samplers: texture unit
    }
  }
}

export function texture2D(gl, w, h, internal, format, type, { filter = gl.LINEAR, wrap = gl.CLAMP_TO_EDGE, data = null, mips = false } = {}) {
  const t = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, format, type, data);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mips ? gl.LINEAR_MIPMAP_LINEAR : filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
  if (mips) gl.generateMipmap(gl.TEXTURE_2D);
  t.w = w; t.h = h;
  return t;
}

export function framebuffer(gl, color, depth) {
  const f = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, f);
  if (color) gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, color, 0);
  if (depth) gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, depth, 0);
  if (!color) { gl.drawBuffers([gl.NONE]); gl.readBuffer(gl.NONE); }
  const st = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  if (st !== gl.FRAMEBUFFER_COMPLETE) throw new Error(`framebuffer incomplete 0x${st.toString(16)}`);
  f.w = (color || depth).w; f.h = (color || depth).h;
  return f;
}

// ------------------------------------------------------------------ mat4 (column-major)

export const mat4 = {
  create() { const m = new Float32Array(16); m[0] = m[5] = m[10] = m[15] = 1; return m; },
  perspective(out, fovy, aspect, near, far) {
    const f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
    out.fill(0);
    out[0] = f / aspect; out[5] = f; out[10] = (far + near) * nf; out[11] = -1; out[14] = 2 * far * near * nf;
    return out;
  },
  ortho(out, l, r, b, t, n, f) {
    out.fill(0);
    out[0] = 2 / (r - l); out[5] = 2 / (t - b); out[10] = -2 / (f - n);
    out[12] = -(r + l) / (r - l); out[13] = -(t + b) / (t - b); out[14] = -(f + n) / (f - n); out[15] = 1;
    return out;
  },
  /** View matrix from a position, yaw (around +Y, 0 = looking -Z) and pitch. */
  fpsView(out, pos, yaw, pitch) {
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    // camera basis: right, up, back
    const rx = cy, ry = 0, rz = -sy;
    const bx = sy * cp, by = -sp, bz = cy * cp;
    const ux = by * rz - bz * ry, uy = bz * rx - bx * rz, uz = bx * ry - by * rx;
    out[0] = rx; out[1] = ux; out[2] = bx; out[3] = 0;
    out[4] = ry; out[5] = uy; out[6] = by; out[7] = 0;
    out[8] = rz; out[9] = uz; out[10] = bz; out[11] = 0;
    out[12] = -(rx * pos[0] + ry * pos[1] + rz * pos[2]);
    out[13] = -(ux * pos[0] + uy * pos[1] + uz * pos[2]);
    out[14] = -(bx * pos[0] + by * pos[1] + bz * pos[2]);
    out[15] = 1;
    return out;
  },
  lookDir(out, eye, dir, upHint) {
    const f = norm(dir);
    let s = cross(f, upHint); s = norm(s);
    const u = cross(s, f);
    out[0] = s[0]; out[1] = u[0]; out[2] = -f[0]; out[3] = 0;
    out[4] = s[1]; out[5] = u[1]; out[6] = -f[1]; out[7] = 0;
    out[8] = s[2]; out[9] = u[2]; out[10] = -f[2]; out[11] = 0;
    out[12] = -(s[0] * eye[0] + s[1] * eye[1] + s[2] * eye[2]);
    out[13] = -(u[0] * eye[0] + u[1] * eye[1] + u[2] * eye[2]);
    out[14] = f[0] * eye[0] + f[1] * eye[1] + f[2] * eye[2];
    out[15] = 1;
    return out;
  },
  mul(out, a, b) {
    const r = new Float32Array(16);
    for (let c = 0; c < 4; c++) for (let rr = 0; rr < 4; rr++) {
      r[c * 4 + rr] = a[rr] * b[c * 4] + a[4 + rr] * b[c * 4 + 1] + a[8 + rr] * b[c * 4 + 2] + a[12 + rr] * b[c * 4 + 3];
    }
    out.set(r);
    return out;
  },
  invert(out, m) {
    const a00 = m[0], a01 = m[1], a02 = m[2], a03 = m[3], a10 = m[4], a11 = m[5], a12 = m[6], a13 = m[7];
    const a20 = m[8], a21 = m[9], a22 = m[10], a23 = m[11], a30 = m[12], a31 = m[13], a32 = m[14], a33 = m[15];
    const b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10, b02 = a00 * a13 - a03 * a10, b03 = a01 * a12 - a02 * a11;
    const b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12, b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30;
    const b08 = a20 * a33 - a23 * a30, b09 = a21 * a32 - a22 * a31, b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
    let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
    if (!det) return null;
    det = 1 / det;
    out[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det; out[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
    out[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det; out[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
    out[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det; out[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
    out[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det; out[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
    out[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det; out[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
    out[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det; out[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
    out[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det; out[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
    out[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det; out[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;
    return out;
  },
  translation(out, x, y, z) { out.fill(0); out[0] = out[5] = out[10] = out[15] = 1; out[12] = x; out[13] = y; out[14] = z; return out; },
};

export const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** Frustum planes (normalised, pointing inward) from a view-projection matrix. */
export function frustumPlanes(m, out = []) {
  const rows = [[m[0], m[4], m[8], m[12]], [m[1], m[5], m[9], m[13]], [m[2], m[6], m[10], m[14]], [m[3], m[7], m[11], m[15]]];
  const w = rows[3];
  const planes = [[0, 1], [0, -1], [1, 1], [1, -1], [2, 1], [2, -1]].map(([r, s]) => {
    const p = [w[0] + s * rows[r][0], w[1] + s * rows[r][1], w[2] + s * rows[r][2], w[3] + s * rows[r][3]];
    const l = Math.hypot(p[0], p[1], p[2]);
    return [p[0] / l, p[1] / l, p[2] / l, p[3] / l];
  });
  out.length = 0; out.push(...planes);
  return out;
}
export function boxInFrustum(planes, x0, y0, z0, x1, y1, z1) {
  for (const p of planes) {
    const x = p[0] > 0 ? x1 : x0, y = p[1] > 0 ? y1 : y0, z = p[2] > 0 ? z1 : z0;
    if (p[0] * x + p[1] * y + p[2] * z + p[3] < 0) return false;
  }
  return true;
}
