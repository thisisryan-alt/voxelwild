// Input: keyboard + gamepad mapped to named actions, with edge detection and press buffering.
export const KEYMAP = {
  left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'], up: ['ArrowUp', 'KeyW'], down: ['ArrowDown', 'KeyS'],
  jump: ['Space', 'ArrowUp', 'KeyW'],
  attack: ['KeyJ', 'KeyZ'], heavy: ['KeyK', 'KeyX'], dash: ['KeyL', 'KeyC'],
  block: ['ShiftLeft', 'ShiftRight', 'KeyV'],
  ab1: ['Digit1', 'KeyU'], ab2: ['Digit2', 'KeyI'], ab3: ['Digit3', 'KeyO'], ult: ['KeyQ', 'KeyR'],
  interact: ['KeyE'],
  menu: ['Tab', 'KeyB'], map: ['KeyM'], pause: ['Escape', 'KeyP'],
  confirm: ['Enter', 'Space', 'KeyJ', 'KeyE'], cancel: ['Escape', 'KeyK', 'Backspace'],
  tabL: ['KeyQ', 'BracketLeft'], tabR: ['KeyE', 'BracketRight'],
  quicksave: ['F5'], debug: ['Backquote'],
};
const PREVENT = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab', 'F5']);

export class Input {
  constructor() {
    this.keys = new Set();
    this.held = {}; this.edge = {}; this.ago = {}; this.released = {};
    this.injected = {};
    this.pad = { held: {}, axisX: 0, axisY: 0 };
    this.frame = 0;
    this.lastDevice = 'keyboard';
    this.reverse = new Map();
    for (const [a, ks] of Object.entries(KEYMAP)) for (const k of ks) { if (!this.reverse.has(k)) this.reverse.set(k, []); this.reverse.get(k).push(a); }
    for (const a of Object.keys(KEYMAP)) { this.held[a] = false; this.edge[a] = false; this.ago[a] = 999; }
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', (e) => {
        if (PREVENT.has(e.code)) e.preventDefault();
        if (e.repeat) return;
        this.keys.add(e.code); this.lastDevice = 'keyboard';
        for (const a of this.reverse.get(e.code) || []) { this.edge[a] = true; this.ago[a] = 0; }
      });
      window.addEventListener('keyup', (e) => {
        this.keys.delete(e.code);
        for (const a of this.reverse.get(e.code) || []) this.released[a] = true;
      });
      window.addEventListener('blur', () => this.keys.clear());
    }
  }
  // call once at start of each fixed update
  poll() {
    this.frame++;
    this._gamepad();
    for (const a of Object.keys(KEYMAP)) {
      const now = KEYMAP[a].some((k) => this.keys.has(k)) || !!this.pad.held[a] || !!this.injected[a];
      if (now && !this.held[a]) { this.edge[a] = true; this.ago[a] = 0; }
      this.held[a] = now;
    }
  }
  // call once at end of each fixed update
  endFrame() {
    for (const a of Object.keys(this.held)) { this.edge[a] = false; this.released[a] = false; if (this.ago[a] < 999) this.ago[a]++; }
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
  clearAll() { this.keys.clear(); this.injected = {}; for (const a of Object.keys(this.held)) { this.held[a] = false; this.edge[a] = false; this.ago[a] = 999; } }
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
