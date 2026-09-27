// Far terrain on the page: four nested grids (cells of 4, 8, 16 and 32 blocks, 128 x 128 each) that follow the camera,
// rebuilt in their own worker when the camera moves far enough; drawn by the renderer behind the loaded chunks.
export const FAR_N = 128;
const CELLS = [4, 8, 16, 32];

export class FarTerrain {
  constructor(gl, workerUrl) {
    this.gl = gl;
    this.worker = new Worker(workerUrl);
    this.worker.onmessage = (e) => this.onResult(e.data);
    this.levels = CELLS.map((cell) => ({ cell, x0: 0, z0: 0, cx: NaN, cz: NaN, want: null, pending: false, vbo: null, vao: null, ready: false }));
    this.seed = null;
    this.jobId = 0;
    // one index buffer for every level: (N x N) quads
    const V = FAR_N + 1, idx = new Uint16Array(FAR_N * FAR_N * 6);
    let o = 0;
    for (let j = 0; j < FAR_N; j++) for (let i = 0; i < FAR_N; i++) {
      const a = i + j * V, b = a + 1, c = a + V, d = c + 1;
      idx[o++] = a; idx[o++] = c; idx[o++] = b; idx[o++] = b; idx[o++] = c; idx[o++] = d;
    }
    this.ibo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
    this.count = idx.length;
  }

  /** Follow the camera: each level recentres on a grid of 16 of its cells. */
  update(cam, seed, distance) {
    if (seed !== this.seed) { this.seed = seed; for (const l of this.levels) { l.ready = false; l.cx = NaN; l.pending = false; } }
    this.distance = distance;
    let prevHalf = 0;
    for (const l of this.levels) {
      const half = FAR_N * l.cell / 2;
      l.active = distance > 0 && prevHalf < distance;
      prevHalf = half;
      if (!l.active || l.pending) continue;
      const snap = l.cell * 16;
      const cx = Math.round(cam[0] / snap) * snap, cz = Math.round(cam[2] / snap) * snap;
      if (cx === l.cx && cz === l.cz) continue;
      l.pending = true; l.want = [cx, cz];
      this.worker.postMessage({ type: 'far', id: ++this.jobId, level: this.levels.indexOf(l), seed, x0: cx - half, z0: cz - half, cell: l.cell, n: FAR_N });
    }
  }

  onResult(m) {
    if (m.type !== 'far') return;
    const l = this.levels[m.level];
    l.pending = false;
    if (m.seed !== this.seed) return;
    const gl = this.gl;
    if (!l.vao) {
      l.vao = gl.createVertexArray(); l.vbo = gl.createBuffer();
      gl.bindVertexArray(l.vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, l.vbo);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 24, 0);
      gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 24, 16);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo);
      gl.bindVertexArray(null);
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, l.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, m.data, gl.STATIC_DRAW);
    l.x0 = m.x0; l.z0 = m.z0;
    l.cx = m.x0 + FAR_N * l.cell / 2; l.cz = m.z0 + FAR_N * l.cell / 2;
    l.ready = true;
  }

  dispose() { this.worker.terminate(); }
}
