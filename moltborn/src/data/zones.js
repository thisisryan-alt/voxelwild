// Zone registry: name, biome and map placement for every zone (building is lazy and always fresh).
import * as reef from './zones_reef.js';
import * as forest from './zones_forest.js';
import * as kingdom from './zones_kingdom.js';
import * as grave from './zones_graveyard.js';
import * as deep from './zones_deep.js';
import * as expansion from './zones_expansion.js';

import { scatter } from '../world/scatter.js';
import { EXTRA } from './roster.js';

const REG = { ...reef, ...forest, ...kingdom, ...grave, ...deep, ...expansion };
export { ZONE_INFO } from './zoneinfo.js';
export function buildZone(id) {
  const f = REG[id]; if (!f) throw new Error('unknown zone ' + id);
  const z = f(); const extra = EXTRA[id]; return extra ? scatter(z, extra) : z;
}
import { ZONE_INFO as _Z } from './zoneinfo.js';
export const ZONE_IDS = Object.keys(_Z);
