// Zone registry: name, biome and map placement for every zone (building is lazy and always fresh).
import * as reef from './zones_reef.js';

const REG = { ...reef };
export { ZONE_INFO } from './zoneinfo.js';
export function buildZone(id) {
  const f = REG[id]; if (!f) throw new Error('unknown zone ' + id);
  return f();
}
import { ZONE_INFO as _Z } from './zoneinfo.js';
export const ZONE_IDS = Object.keys(_Z);
