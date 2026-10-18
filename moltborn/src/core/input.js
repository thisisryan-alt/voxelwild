// Input: keyboard + mouse + gamepad mapped to named actions, with edge detection and press buffering.
// Mouse buttons are folded into the same table as pseudo key codes ('Mouse0' left, 'Mouse1' middle, 'Mouse2' right), so
// they rebind, buffer and show up in the controls screen like any key. Turn them off with `mouseOn` (the Mouse attacks setting).
export const KEYMAP = {
  left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'], up: ['ArrowUp', 'KeyW'], down: ['ArrowDown', 'KeyS'],
  jump: ['Space', 'ArrowUp', 'KeyW'],
  attack: ['KeyJ', 'KeyZ', 'Mouse0'], heavy: ['KeyK', 'KeyX', 'Mouse2'], dash: ['KeyL', 'KeyC', 'Mouse1'],
  block: ['ShiftLeft', 'ShiftRight', 'KeyV'],
  ab1: ['Digit1', 'KeyU'], ab2: ['Digit2', 'KeyI'], ab3: ['Digit3', 'KeyO'], ult: ['KeyQ', 'KeyR'],
  interact: ['KeyE'],
  menu: ['Tab', 'KeyB'], map: ['KeyM'], pause: ['Escape', 'KeyP'],
  confirm: ['Enter', 'Space', 'KeyJ', 'KeyE', 'Mouse0'], cancel: ['Escape', 'KeyK', 'Backspace', 'Mouse2'],
  tabL: ['KeyQ', 'BracketLeft'], tabR: ['KeyE', 'BracketRight'],
  quicksave: ['F5'], heal: ['KeyF', 'KeyH'], debug: ['Backquote'], minimap: ['KeyN'], photo: ['F2'],
};
const PREVENT = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab', 'F5', 'F2', 'F9']);

export class Input {
  constructor() {
    this.keys = new Set();
    this.held = {}; this.edge = {}; this.ago = {}; this.released = {};
    this.injected = {};
    this.pad = { held: {}, axisX: 0, axisY: 0 };
    this.frame = 0;
    this.lastDevice = 'keyboard';
    this.reverse = new Map(); this.codeEdge = new Set(); this.lastCode = null;
    // mouse: position in canvas pixels (480x270), the frame each button went down and the frame of the last activity
    this.mouse = { x: 240, y: 135, seen: false, act: -999, down: {} };
    this.mouseOn = true;
    this.via = {}; // which device last pressed each action: 'key' | 'mouse' | 'pad'
    this.rebuild();
    for (const a of Object.keys(KEYMAP)) { this.held[a] = false; this.edge[a] = false; this.ago[a] = 999; }
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', (e) => {
        if (PREVENT.has(e.code)) e.preventDefault();
        if (e.repeat) return;
        this.keys.add(e.code); this.lastDevice = 'keyboard'; this.codeEdge.add(e.code); this.lastCode = e.code;
        for (const a of this.reverse.get(e.code) || []) { this.edge[a] = true; this.ago[a] = 0; this.via[a] = 'key'; }
      });
      window.addEventListener('keyup', (e) => {
        this.keys.delete(e.code);
        for (const a of this.reverse.get(e.code) || []) this.released[a] = true;
      });
      window.addEventListener('blur', () => { this.keys.clear(); this.mouse.down = {}; });
    }
  }
  // wire the mouse to a canvas. `w`/`h` are the logical canvas size; the pointer is mapped through the element's on-screen box
  // so integer scaling, letterboxing and CSS zoom all land on the right game pixel.
  bindMouse(canvas, w = 480, h = 270) {
    const at = (e) => { const r = canvas.getBoundingClientRect(); if (r.width > 0 && r.height > 0) this.moveMouse((e.clientX - r.left) * w / r.width, (e.clientY - r.top) * h / r.height); };
    canvas.addEventListener('mousemove', at);
    canvas.addEventListener('mousedown', (e) => { at(e); if (e.button === 1 || e.button === 2) e.preventDefault(); this.pressMouse(e.button); });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('auxclick', (e) => e.preventDefault());
    if (typeof window !== 'undefined') window.addEventListener('mouseup', (e) => this.releaseMouse(e.button));
    if (canvas.style) canvas.style.cursor = 'crosshair';
  }
  moveMouse(x, y) { const m = this.mouse; m.x = Math.max(0, Math.min(480, x)); m.y = Math.max(0, Math.min(270, y)); m.seen = true; m.act = this.frame; }
  // a button went down / up (also the entry point for tests and scripts)
  pressMouse(button) {
    const code = 'Mouse' + button; if (this.keys.has(code)) return;
    this.keys.add(code); this.mouse.down[code] = this.frame; this.mouse.act = this.frame; this.mouse.seen = true;
    this.lastDevice = 'keyboard'; this.codeEdge.add(code); this.lastCode = code;
    if (!this.mouseOn) return;
    for (const a of this.reverse.get(code) || []) { this.edge[a] = true; this.ago[a] = 0; this.via[a] = 'mouse'; }
  }
  releaseMouse(button) {
    const code = 'Mouse' + button; if (!this.keys.delete(code)) return;
    delete this.mouse.down[code];
    for (const a of this.reverse.get(code) || []) this.released[a] = true;
  }
  // has the pointer been used lately? (aim only follows a pointer that is actually in use)
  mouseActive(frames = 120) { return this.mouse.seen && this.frame - this.mouse.act <= frames; }
  // is a mouse button bound to action `a` being held, and has it been held longer than a click? (hold to keep attacking)
  mouseHeld(a, frames = 14) {
    if (!this.mouseOn) return false;
    for (const k of KEYMAP[a] || []) { const f = this.mouse.down[k]; if (f !== undefined && this.frame - f >= frames) return true; }
    return false;
  }
  // rebuild the key -> actions lookup after KEYMAP has been edited (rebinding)
  rebuild() {
    this.reverse.clear();
    for (const [a, ks] of Object.entries(KEYMAP)) for (const k of ks) { if (!this.reverse.has(k)) this.reverse.set(k, []); this.reverse.get(k).push(a); }
  }
  // was this raw key code pressed since the last frame? (used by the controls screen)
  rawPressed(code) { return this.codeEdge.has(code); }
  // call once at start of each fixed update
  poll() {
    this.frame++;
    this._gamepad();
    for (const a of Object.keys(KEYMAP)) {
      const now = KEYMAP[a].some((k) => this.keys.has(k) && (this.mouseOn || !k.startsWith('Mouse'))) || !!this.pad.held[a] || !!this.injected[a];
      if (now && !this.held[a]) { this.edge[a] = true; if (this.ago[a] > 1) this.via[a] = this.pad.held[a] ? 'pad' : 'key'; this.ago[a] = 0; }
      this.held[a] = now;
    }
  }
  // call once at end of each fixed update
  endFrame() {
    for (const a of Object.keys(this.held)) { this.edge[a] = false; this.released[a] = false; if (this.ago[a] < 999) this.ago[a]++; }
    this.codeEdge.clear();
  }
  isDown(a) { return !!this.held[a]; }
  pressed(a) { return !!this.edge[a]; }
  // pressed within the last n frames and not yet consumed
  buffered(a, n = 6) { return this.ago[a] <= n; }
  consume(a) { this.ago[a] = 999; this.edge[a] = false; }
  axisX() { return (this.held.right ? 1 : 0) - (this.held.left ? 1 : 0); }
  axisY() { return (this.held.down ? 1 : 0) - (this.held.up ? 1 : 0); }
  // test / scripting hook
  inject(a, down) { this.injected[a] = down; }
  clearAll() { this.keys.clear(); this.mouse.down = {}; this.injected = {}; for (const a of Object.keys(this.held)) { this.held[a] = false; this.edge[a] = false; this.ago[a] = 999; } }
  _gamepad() {
    if (typeof navigator === 'undefined' || !navigator.getGamepads) return;
    const gp = [...navigator.getGamepads()].find((g) => g && g.connected);
    const h = {};
    if (gp) {
      const b = (i) => !!(gp.buttons[i] && gp.buttons[i].pressed);
      const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
      h.left = ax < -0.4 || b(14); h.right = ax > 0.4 || b(15); h.up = ay < -0.5 || b(12); h.down = ay > 0.5 || b(13);
      h.jump = b(0); h.attack = b(2); h.heavy = b(3); h.dash = b(1); h.block = b(5) || b(7);
      h.ab1 = b(4); h.ab2 = b(6); h.ab3 = false; h.ult = b(7) && b(5);
      h.interact = b(0); h.confirm = b(0); h.cancel = b(1); h.menu = b(9) || b(8); h.pause = b(9); h.map = b(8);
      h.tabL = b(4); h.tabR = b(5);
      if (Object.values(h).some(Boolean)) this.lastDevice = 'pad';
    }
    this.pad.held = h;
  }
}
