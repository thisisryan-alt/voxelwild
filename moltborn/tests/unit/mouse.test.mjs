// Mouse attacks: buttons are pseudo key codes in the shared keymap, so they buffer, rebind and label like keys; aim only follows a
// pointer that is in use and only for actions that were pressed with the mouse.
import { test, ok, eq, deep } from './harness.mjs';
import { KEYMAP, Input } from '../../src/core/input.js';
import { DEFAULT_KEYMAP, keyLabel, setBinding, resetKeymap, diffKeymap, SLOTS } from '../../src/core/keymap.js';
import { BY_KEY, ensureSettings } from '../../src/systems/settings.js';
import { Player } from '../../src/entities/player.js';

const fresh = () => { const i = new Input(); resetKeymap(i); i.mouseOn = true; return i; };
const frames = (i, n) => { for (let k = 0; k < n; k++) { i.poll(); i.endFrame(); } };

test('left click claws, right click is the heavy claw, middle click dashes', () => {
  eq(KEYMAP.attack.includes('Mouse0'), true); eq(KEYMAP.heavy.includes('Mouse2'), true); eq(KEYMAP.dash.includes('Mouse1'), true);
  ok(KEYMAP.attack.length <= SLOTS && KEYMAP.heavy.length <= SLOTS && KEYMAP.dash.length <= SLOTS, 'fits the three binding slots');
});
test('menus take the same buttons: left confirms, right goes back', () => { ok(KEYMAP.confirm.includes('Mouse0')); ok(KEYMAP.cancel.includes('Mouse2')); });
test('the buttons have short labels for the controls screen', () => { eq(keyLabel('Mouse0'), 'LMB'); eq(keyLabel('Mouse1'), 'MMB'); eq(keyLabel('Mouse2'), 'RMB'); eq(keyLabel('Mouse4'), 'MOUSE5'); });

test('a press gives an edge, a held state and the mouse as its source; a release lets go', () => {
  const i = fresh(); i.pressMouse(0); i.poll();
  ok(i.pressed('attack') && i.isDown('attack') && i.pressed('confirm')); eq(i.via.attack, 'mouse'); i.endFrame();
  ok(!i.pressed('attack') && i.isDown('attack'), 'the edge lasts one frame, the hold continues');
  i.releaseMouse(0); i.poll(); ok(!i.isDown('attack') && !i.isDown('confirm'));
});
test('the press is buffered like a key press so a slightly early click still lands', () => {
  const i = fresh(); i.pressMouse(0); frames(i, 4); ok(i.buffered('attack', 7)); i.consume('attack'); ok(!i.buffered('attack', 7));
});
test('right click is the heavy claw and holds while charging', () => { const i = fresh(); i.pressMouse(2); frames(i, 20); ok(i.isDown('heavy')); i.releaseMouse(2); frames(i, 1); ok(!i.isDown('heavy')); });
test('pressing a button twice without a release is one press', () => { const i = fresh(); i.pressMouse(0); i.poll(); i.endFrame(); i.pressMouse(0); i.poll(); ok(!i.pressed('attack')); });
test('a release for a button that was never down is ignored', () => { const i = fresh(); i.releaseMouse(0); i.poll(); ok(!i.isDown('attack')); });

test('a keyboard press is reported as a key, and mouse then key then mouse follows the latest', () => {
  const i = fresh(); i.keys.add('KeyJ'); i.poll(); eq(i.via.attack, 'key'); i.keys.delete('KeyJ'); i.endFrame(); i.poll(); i.endFrame();
  frames(i, 3); i.pressMouse(0); i.poll(); eq(i.via.attack, 'mouse'); i.releaseMouse(0); frames(i, 5);
  i.keys.add('KeyZ'); i.poll(); eq(i.via.attack, 'key');
});

test('hold to keep attacking only starts after the press has outlasted a click', () => {
  const i = fresh(); i.pressMouse(0); frames(i, 6); ok(!i.mouseHeld('attack'), 'a normal click is not a hold'); frames(i, 10); ok(i.mouseHeld('attack'));
  i.releaseMouse(0); ok(!i.mouseHeld('attack'));
});
test('only mouse buttons count as a mouse hold, not the keyboard', () => { const i = fresh(); i.keys.add('KeyJ'); frames(i, 30); ok(!i.mouseHeld('attack')); });

test('with Mouse attacks off the buttons do nothing in the game', () => {
  const i = fresh(); i.mouseOn = false; i.pressMouse(0); i.poll(); ok(!i.pressed('attack') && !i.isDown('attack') && !i.pressed('confirm')); frames(i, 30); ok(!i.mouseHeld('attack'));
  i.mouseOn = true; i.poll(); ok(i.isDown('attack'), 'switching it back on picks the held button up');
});
test('the keyboard is untouched when the mouse is off', () => { const i = fresh(); i.mouseOn = false; i.keys.add('KeyJ'); i.poll(); ok(i.pressed('attack')); });

test('losing focus or clearing input lets go of the buttons', () => {
  const i = fresh(); i.pressMouse(0); i.pressMouse(2); frames(i, 3); i.clearAll(); i.poll(); ok(!i.isDown('attack') && !i.isDown('heavy')); deep(i.mouse.down, {});
});

test('the pointer is clamped to the canvas and counts as in use for a while', () => {
  const i = fresh(); ok(!i.mouseActive(), 'never moved'); i.moveMouse(-30, 999); eq(i.mouse.x, 0); eq(i.mouse.y, 270); i.moveMouse(700, -4); eq(i.mouse.x, 480); eq(i.mouse.y, 0);
  ok(i.mouseActive()); frames(i, 130); ok(!i.mouseActive(120)); ok(i.mouseActive(300)); i.moveMouse(10, 10); ok(i.mouseActive(1));
});
test('a click counts as using the pointer even if it never moved', () => { const i = fresh(); i.pressMouse(0); ok(i.mouseActive()); });

test('the controls screen can see a mouse press as a raw key', () => { const i = fresh(); i.pressMouse(2); ok(i.rawPressed('Mouse2')); eq(i.lastCode, 'Mouse2'); i.endFrame(); ok(!i.rawPressed('Mouse2')); });
test('a mouse button can be rebound onto another action and the old owner loses it', () => {
  const i = fresh(); const r = setBinding(i, 'ab1', 1, 'Mouse1'); ok(r.ok); eq(r.stolen, 'dash'); ok(!KEYMAP.dash.includes('Mouse1')); eq(KEYMAP.ab1[1], 'Mouse1');
  i.pressMouse(1); i.poll(); ok(i.pressed('ab1') && !i.pressed('dash'));
  ok('ab1' in diffKeymap() && 'dash' in diffKeymap()); resetKeymap(i); deep(KEYMAP.dash, DEFAULT_KEYMAP.dash); deep(diffKeymap(), {});
});
test('the defaults include the mouse so a fresh settings file needs no migration', () => { deep(diffKeymap(), {}); ok(DEFAULT_KEYMAP.attack.includes('Mouse0')); });

test('both mouse options exist, are on by default, and survive bad values', () => {
  for (const k of ['mouseAttack', 'mouseAim']) { eq(BY_KEY[k].type, 'toggle'); eq(BY_KEY[k].def, 1); eq(BY_KEY[k].group, 'Gameplay'); ok(BY_KEY[k].hint.length < 120); }
  const s = ensureSettings({ mouseAttack: 'no', mouseAim: 0 }); eq(s.mouseAttack, 1); eq(s.mouseAim, 0);
});

// ---- aiming: the pure part of Player, driven with a stub body ---------------------------------------------------------------------------
function body(opts = {}) {
  const input = fresh(); const settings = { mouseAttack: 1, mouseAim: 1, ...(opts.settings || {}) };
  const me = { game: { input, state: { settings } }, world: { cam: { x: opts.camX ?? 100, y: 50 } }, x: opts.x ?? 340, y: opts.y ?? 185, facing: 1, face(d) { if (d) this.facing = d; } };
  for (const k of ['aimVec', 'aimDir', 'faceAim']) me[k] = Player.prototype[k];
  return { me, input };
}
test('a click to the left of the crab aims left, and to the right aims right', () => {
  const { me, input } = body(); input.moveMouse(60, 135); input.pressMouse(0); eq(me.aimDir('attack'), -1);
  input.releaseMouse(0); input.moveMouse(420, 135); input.pressMouse(0); eq(me.aimDir('attack'), 1);
});
test('the crab is placed on screen by the camera, not by the world position', () => {
  const { me, input } = body({ x: 340, camX: 100 }); input.moveMouse(230, 135); input.pressMouse(0); eq(me.aimDir('attack'), -1, 'the crab is at screen x 240'); input.moveMouse(250, 135); eq(me.aimDir('attack'), 1);
});
test('a pointer over the body does not flip the crab', () => { const { me, input } = body(); input.moveMouse(241, 136); input.pressMouse(0); eq(me.aimDir('attack'), 0); });
test('a mostly vertical aim does not flip the crab either', () => { const { me, input } = body(); input.moveMouse(243, 30); input.pressMouse(0); eq(me.aimDir('attack'), 0); const v = me.aimVec('attack'); ok(v[1] < -0.9); });
test('the vector is a unit vector toward the pointer', () => { const { me, input } = body(); input.moveMouse(240 + 30, 135 + 40); input.pressMouse(0); const v = me.aimVec('attack'); ok(Math.abs(Math.hypot(v[0], v[1]) - 1) < 1e-9); ok(v[0] > 0 && v[1] > 0); });
test('a keyboard attack ignores a pointer that is somewhere else', () => {
  const { me, input } = body(); input.moveMouse(5, 5); input.keys.add('KeyJ'); input.poll(); eq(input.via.attack, 'key'); eq(me.aimDir('attack'), 0); me.faceAim('attack'); eq(me.facing, 1);
});
test('a pointer left alone for a few seconds is no longer used for aiming', () => {
  const { me, input } = body(); input.moveMouse(20, 135); input.pressMouse(0); eq(me.aimDir('attack'), -1); input.releaseMouse(0); frames(input, 400); input.pressMouse(0); input.mouse.act = input.frame - 400; eq(me.aimDir('attack'), 0);
});
test('Aim with mouse off, or Mouse attacks off, keeps the crab facing as it was', () => {
  for (const settings of [{ mouseAim: 0 }, { mouseAttack: 0 }]) { const { me, input } = body({ settings }); input.moveMouse(20, 135); input.pressMouse(0); eq(me.aimDir('attack'), 0); me.faceAim('attack'); eq(me.facing, 1); }
});
test('faceAim turns the crab toward the pointer', () => { const { me, input } = body(); input.moveMouse(20, 135); input.pressMouse(2); me.faceAim('heavy'); eq(me.facing, -1); });
test('each action aims only for its own source: a left click does not aim a keyboard dash', () => {
  const { me, input } = body(); input.moveMouse(20, 135); input.pressMouse(0); input.keys.add('KeyL'); input.poll(); eq(input.via.dash, 'key'); eq(me.aimDir('dash'), 0); eq(me.aimDir('attack'), -1);
});
