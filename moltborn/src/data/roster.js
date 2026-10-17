// Extra enemies scattered over the zones after they are built (see world/scatter.js). floor: stands on the seabed, otherwise swims.
// scale multiplies health (and a little damage and XP) so the same species stays a fair fight deeper down.
export const EXTRA = {
  reef_garden:    [{ type: 'mender', n: 1, floor: true }],
  reef_hollow:    [{ type: 'mender', n: 1, floor: true }, { type: 'fumecap', n: 1, floor: true }],
  forest_edge:    [{ type: 'mantis', n: 1, floor: true }, { type: 'fumecap', n: 2, floor: true }, { type: 'splitjelly', n: 1 }],
  forest_roots:   [{ type: 'mantis', n: 2, floor: true }, { type: 'mender', n: 1, floor: true }, { type: 'fumecap', n: 2, floor: true }, { type: 'splitjelly', n: 2 }],
  kingdom_gate:   [{ type: 'mantis', n: 2, floor: true, scale: 1.2 }, { type: 'spawncoral', n: 1, floor: true }, { type: 'mender', n: 1, floor: true }],
  kingdom_spires: [{ type: 'mantis', n: 2, floor: true, scale: 1.3 }, { type: 'spawncoral', n: 1, floor: true }, { type: 'mender', n: 1, floor: true }, { type: 'splitjelly', n: 1, scale: 1.3 }],
  grave_shallows: [{ type: 'hookjaw', n: 2 }, { type: 'tuskram', n: 1 }, { type: 'fumecap', n: 1, floor: true, scale: 1.3 }],
  grave_galleon:  [{ type: 'hookjaw', n: 2 }, { type: 'tuskram', n: 1 }, { type: 'spawncoral', n: 1, floor: true, scale: 1.3 }, { type: 'mantis', n: 1, floor: true, scale: 1.4 }],
  abyss_descent:  [{ type: 'hookjaw', n: 1, scale: 1.2 }, { type: 'splitjelly', n: 2, scale: 1.4 }, { type: 'tuskram', n: 1, scale: 1.2 }],
  abyss_lanterns: [{ type: 'tuskram', n: 2, scale: 1.2 }, { type: 'hookjaw', n: 2, scale: 1.2 }, { type: 'splitjelly', n: 1, scale: 1.4 }, { type: 'mender', n: 1, floor: true, scale: 1.3 }],
  trench_bones:   [{ type: 'tuskram', n: 2, scale: 1.4 }, { type: 'mantis', n: 2, floor: true, scale: 1.7 }, { type: 'mender', n: 2, floor: true, scale: 1.4 }, { type: 'spawncoral', n: 1, floor: true, scale: 1.5 }],
  trench_temple:  [{ type: 'mantis', n: 2, floor: true, scale: 1.8 }, { type: 'hookjaw', n: 2, scale: 1.5 }, { type: 'tuskram', n: 1, scale: 1.5 }, { type: 'spawncoral', n: 1, floor: true, scale: 1.6 }],
  domain_gate:    [{ type: 'tuskram', n: 2, scale: 1.7 }, { type: 'mender', n: 1, floor: true, scale: 1.5 }],
};
