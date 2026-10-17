// Canvas, integer-scaled presentation, fixed-timestep loop and a scene stack.
export const W = 480, H = 270;
export class Engine {
  constructor(canvas) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.ctx.imageSmoothingEnabled = false;
    canvas.width = W; canvas.height = H;
    this.scenes = []; this.last = 0; this.acc = 0; this.running = false; this.time = 0; this.paused = false;
    this.onStep = null; this.fps = 60; this.frames = 0; this.fpsT = 0;
    window.addEventListener('resize', () => this.resize()); this.resize();
  }
  resize() {
    const k = Math.min(window.innerWidth / W, window.innerHeight / H);
    const s = k >= 1 ? Math.floor(k) : k; // integer scale when possible (crisp pixels)
    this.scale = s; this.canvas.style.width = Math.floor(W * s) + 'px'; this.canvas.style.height = Math.floor(H * s) + 'px';
  }
  push(scene) { this.scenes.push(scene); scene.onEnter?.(); return scene; }
  pop() { const s = this.scenes.pop(); s?.onExit?.(); return s; }
  replace(scene) { while (this.scenes.length) this.pop(); return this.push(scene); }
  get top() { return this.scenes[this.scenes.length - 1]; }
  step(dt) {
    this.time += dt;
    this.pre?.(dt);
    const s = this.top; if (s) s.update(dt);
    this.post?.(dt);
  }
  render() {
    const ctx = this.ctx; ctx.imageSmoothingEnabled = false;
    let start = this.scenes.length - 1; while (start > 0 && !this.scenes[start].opaque) start--;
    for (let i = Math.max(0, start); i < this.scenes.length; i++) this.scenes[i].draw(ctx);
  }
  start() {
    this.running = true; this.last = performance.now();
    const loop = (now) => {
      if (!this.running) return;
      let dt = (now - this.last) / 1000; this.last = now; if (dt > 0.25) dt = 0.25;
      if (!this.paused) { this.acc += dt; let n = 0; while (this.acc >= 1 / 60 && n < 5) { this.step(1 / 60); this.acc -= 1 / 60; n++; } if (n === 5) this.acc = 0; }
      this.render();
      this.frames++; this.fpsT += dt; if (this.fpsT >= 1) { this.fps = this.frames; this.frames = 0; this.fpsT = 0; }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
}
