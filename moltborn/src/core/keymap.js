// Key rebinding. KEYMAP (core/input.js) holds the live bindings; the player's changes are stored in the settings file
// as { action: [codes] } and replayed over the defaults at start-up. Only gameplay actions can be rebound; menu
// navigation keeps its fixed keys so a bad binding can never lock the player out of the options screen.
import { KEYMAP } from './input.js';

export const DEFAULT_KEYMAP = JSON.parse(JSON.stringify(KEYMAP));
export const SLOTS = 3;

export const REBINDABLE = [
  { a: 'left', label: 'Swim left' }, { a: 'right', label: 'Swim right' }, { a: 'up', label: 'Swim up' }, { a: 'down', label: 'Swim down' },
  { a: 'jump', label: 'Stroke / jump' }, { a: 'attack', label: 'Claw' }, { a: 'heavy', label: 'Heavy claw' }, { a: 'dash', label: 'Dash' }, { a: 'block', label: 'Block / parry' },
  { a: 'ab1', label: 'Ability 1' }, { a: 'ab2', label: 'Ability 2' }, { a: 'ab3', label: 'Ability 3' }, { a: 'ult', label: 'Ultimate' },
  { a: 'interact', label: 'Interact' }, { a: 'heal', label: 'Use item' }, { a: 'menu', label: 'Menu' }, { a: 'map', label: 'Map' },
  { a: 'minimap', label: 'Minimap' }, { a: 'photo', label: 'Photo mode' }, { a: 'pause', label: 'Pause' }, { a: 'quicksave', label: 'Quick save' },
];
const REBIND_SET = new Set(REBINDABLE.map((r) => r.a));

// keys that must stay available for menus and cannot be taken by gameplay actions
export const RESERVED = new Set(['Enter', 'Escape', 'Backspace', 'Tab']);

export function keyLabel(code) {
  if (!code) return '-';
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit\d$/.test(code)) return code.slice(5);
  if (/^Mouse\d$/.test(code)) return ['LMB', 'MMB', 'RMB'][+code.slice(5)] || 'MOUSE' + (+code.slice(5) + 1);
  const map = { ArrowLeft: 'LEFT', ArrowRight: 'RIGHT', ArrowUp: 'UP', ArrowDown: 'DOWN', Space: 'SPACE', ShiftLeft: 'L-SHIFT', ShiftRight: 'R-SHIFT', ControlLeft: 'L-CTRL', ControlRight: 'R-CTRL', AltLeft: 'L-ALT', AltRight: 'R-ALT', Escape: 'ESC', Backquote: '`', BracketLeft: '[', BracketRight: ']', Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/', Minus: '-', Equal: '=', Enter: 'ENTER', Tab: 'TAB', Backspace: 'BKSP' };
  return map[code] || code.replace(/^Numpad/, 'NUM').toUpperCase();
}

// the bindings as they are now, only those that differ from the defaults (this is what gets saved)
export function diffKeymap() {
  const out = {};
  for (const a of REBIND_SET) { const cur = KEYMAP[a], def = DEFAULT_KEYMAP[a]; if (cur.length !== def.length || cur.some((k, i) => k !== def[i])) out[a] = [...cur]; }
  return out;
}

export function applyKeymap(input, saved) {
  if (saved) for (const [a, codes] of Object.entries(saved)) if (REBIND_SET.has(a) && Array.isArray(codes) && codes.length) KEYMAP[a] = codes.filter((c) => typeof c === 'string').slice(0, SLOTS);
  input.rebuild(); input.clearAll();
}

// bind `code` into `slot` of `action`. A key already used by another rebindable action is taken from it (and reported)
export function setBinding(input, action, slot, code) {
  if (!REBIND_SET.has(action) || RESERVED.has(code)) return { ok: false, why: 'reserved' };
  let stolen = null;
  for (const other of REBIND_SET) {
    if (other === action) continue;
    const i = KEYMAP[other].indexOf(code);
    if (i >= 0) { if (KEYMAP[other].length === 1) return { ok: false, why: 'last', other }; KEYMAP[other].splice(i, 1); stolen = other; }
  }
  const list = KEYMAP[action].slice();
  const dupe = list.indexOf(code); if (dupe >= 0 && dupe !== slot) list.splice(dupe, 1);
  list[Math.min(slot, list.length)] = code;
  KEYMAP[action] = list.filter(Boolean).slice(0, SLOTS);
  input.rebuild(); input.clearAll();
  return { ok: true, stolen };
}

export function clearBinding(input, action, slot) {
  if (!REBIND_SET.has(action) || KEYMAP[action].length <= 1) return false;
  KEYMAP[action].splice(slot, 1); input.rebuild(); input.clearAll(); return true;
}

export function resetKeymap(input) {
  for (const a of REBIND_SET) KEYMAP[a] = [...DEFAULT_KEYMAP[a]];
  input.rebuild(); input.clearAll();
}
