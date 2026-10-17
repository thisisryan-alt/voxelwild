// NPC definitions: name, speaker colour and sprite (kind + unique key + options).
import { R } from '../gfx/palette.js';
import { Ramp } from '../gfx/painter.js';

export const NPCS = {
  old_brine: { name: 'Old Brine', color: '#ffb070', sprite: { kind: 'hermit', k: 'brine', o: { shell: R.coralPink.tint(0.04, 0.8, 0.9), body: R.shoreFar, beard: true } } },
  pip: { name: 'Pip', color: '#ffe65a', sprite: { kind: 'fish', k: 'pip', o: { ramp: R.fishYellow, h: 7, belly: R.belly } } },
  cowrie: { name: 'Madame Cowrie', color: '#ff9ad8', sprite: { kind: 'fish', k: 'cowrie', o: { ramp: R.coralPink, h: 9, belly: R.pearl, scarf: R.crimson, bag: true } } },
  tessa: { name: 'Tessa', color: '#d8a0ff', sprite: { kind: 'hermit', k: 'tessa', o: { shell: R.coralBlue, body: R.shore } } },
  marlin: { name: 'Marlin the Board-Keeper', color: '#9ae8ff', sprite: { kind: 'octopus', k: 'marlin', o: { ramp: R.steel.tint(0.02, 0.9, 1.15), hat: true } } },
  brack: { name: 'Brack the Counter', color: '#ffb060', sprite: { kind: 'hermit', k: 'brack', o: { shell: R.coralOrange, body: R.shoreFar, beard: true } } },
  morel: { name: 'Dr. Morel', color: '#d8ff90', sprite: { kind: 'octopus', k: 'morel', o: { ramp: R.venom.tint(0.1, 0.9, 1.1), hat: true } } },
  tallow: { name: 'Tallow the Archivist', color: '#ffe08a', sprite: { kind: 'seahorse', k: 'tallow', o: { ramp: R.gold.tint(0, 0.7, 0.9), robe: R.rust, crest: R.pearl } } },
  sear: { name: 'Sear the Vent-Smith', color: '#ff9a5a', sprite: { kind: 'hermit', k: 'sear', o: { shell: R.coralRed, body: R.rust, beard: true } } },
  fenwick: { name: 'Fenwick', color: '#9af0c0', sprite: { kind: 'seahorse', k: 'fenwick', o: { ramp: R.fishGreen, crest: R.gold } } },
  vael: { name: 'Chancellor Vael', color: '#c8a0ff', sprite: { kind: 'seahorse', k: 'vael', o: { ramp: R.coralPink.tint(0.5, 0.8, 0.9), robe: R.abyssal, crest: R.gold } } },
  ruby: { name: 'Captain Ruby', color: '#ff7a8a', sprite: { kind: 'guard', k: 'ruby', o: { ramp: R.crimson } } },
  ostrea: { name: 'Ostrea the Pearl-Smith', color: '#e0e8ff', sprite: { kind: 'fish', k: 'ostrea', o: { ramp: R.pearl, h: 9, belly: R.sand, hat: R.rust } } },
  inkwell: { name: 'Mr. Inkwell', color: '#c8a0ff', sprite: { kind: 'octopus', k: 'inkwell', o: { ramp: R.abyssal.tint(0.1, 1, 1.1), hat: true } } },
  hobb: { name: 'Quartermaster Hobb', color: '#9ae8e8', sprite: { kind: 'ghost', k: 'hobb', o: {} } },
  glimmer: { name: 'Glimmer', color: '#9affff', sprite: { kind: 'angler', k: 'glimmer', o: {} } },
  thessaly: { name: 'Thessaly', color: '#c0f0ff', sprite: { kind: 'elder', k: 'thessaly', o: {} } },
  krael: { name: 'Krael', color: '#c8b8a8', sprite: { kind: 'titan', k: 'krael', o: {} } },
  poseidon: { name: 'Poseidon', color: '#ffe890', sprite: { kind: 'guard', k: 'poseidon', o: { ramp: R.divine } } },
};
