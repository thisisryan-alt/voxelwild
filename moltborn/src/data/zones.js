// Zone registry: name, biome and map placement for every zone (building is lazy and always fresh).
import * as reef from './zones_reef.js';

const REG = { ...reef };
export const ZONE_INFO = {
  reef_nursery: { name: 'Shoreline Nursery', biome: 'reef', map: { x: 0, y: 0 } },
  reef_garden: { name: 'Coral Garden', biome: 'reef', map: { x: 1, y: 0 } },
};
export function buildZone(id) {
  const f = REG[id]; if (!f) throw new Error('unknown zone ' + id);
  return f();
}
export const ZONE_IDS = Object.keys(ZONE_INFO);
