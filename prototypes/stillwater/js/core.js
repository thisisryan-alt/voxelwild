// Stillwater: shared constants, helpers and state. Loaded first; the other files add to window.SW.
window.SW = window.SW || {};
(function (SW) {
  'use strict';

  // ------------------------------------------------------------------- worlds
  // Each world is its own sea with its own islands, look, weather and music. One world is loaded at a time;
  // sailing to another saves this one and reloads the page into the next (see sailTo in main.js).
  // Island ids are unique across worlds, except 'home', the island each world starts on. An island's
  // shape is its id unless it names another island's shape to borrow.
  const WORLDS = {
    stillwater: {
      id: 'stillwater', name: 'Stillwater', homeName: 'Home Island', short: 'A calm northern archipelago',
      line: 'Seventeen islands in a calm northern sea: gardens, waterfalls, hot springs, a glacier and an ancient tree.',
      grid: [440, -220], skerries: 26,
      pond: { x: 4.5, z: 5, r: 2.4 },
      islet: { x: 29, z: -23, r: 3.4 },
      stacks: [[-24, 14, 1.1, 1], [21, 17, 0.8, 0], [-19, -21, 1.3, 1], [8, -25, 0.7, 0]],
      arch: { x: -14, z: 66, span: 6, dir: 0.3 },
      islands: [
        { id: 'home', name: 'Home Island', x: 0, z: 0, r: 15, line: 'Your garden, the pond and the dock.' },
        { id: 'pine', name: 'Pine Isle', x: -54, z: -36, r: 11, h: 8.5, line: 'A steep, rocky island of pines. Deer live here.' },
        { id: 'blossom', name: 'Blossom Isle', x: -48, z: 46, r: 10, h: 4, line: 'Soft hills of cherry trees around a pavilion.' },
        { id: 'meadow', name: 'Meadow Isle', x: 62, z: -8, r: 12, h: 3, line: 'Open grass, wildflowers, sheep and a windmill.' },
        { id: 'atoll', name: 'Palm Atoll', x: 50, z: 48, r: 10, line: 'A ring of sand and palms around a coral lagoon.' },
        { id: 'rocks', name: 'Seal Rocks', x: 6, z: -62, r: 7, line: 'Bare rocks where seals bask and puffins nest.' },
        { id: 'wreck', name: 'Wreck Bar', x: 26, z: 30, r: 5, line: 'A sandbar with an old boat half buried in it.' },
        { id: 'falls', name: 'Waterfall Isle', x: -100, z: 2, r: 13, h: 9, line: 'A high mesa with a waterfall spilling into the sea.' },
        { id: 'springs', name: 'Hot Spring Isle', x: 96, z: -62, r: 11, h: 4, line: 'Warm, steaming pools among the rocks. Walk in to soak.' },
        { id: 'glacier', name: 'Glacier Isle', x: -30, z: -105, r: 13, h: 6, line: 'Ice and snowy pines all year round. Arctic foxes.' },
        { id: 'marsh', name: 'Marsh Isle', x: 10, z: 100, r: 14, line: 'Reeds, lily pools, willows, frogs and otters.' },
        // the outer ring, further out; new islands go at the end so the older ones keep their layouts
        { id: 'bamboo', name: 'Bamboo Isle', x: 124, z: 26, r: 11, h: 5, line: 'Whispering bamboo, a koi pond and a round moon gate. Cranes wade the shallows.' },
        { id: 'orchard', name: 'Orchard Isle', x: -82, z: 112, r: 12, h: 3, line: 'Apple trees that blossom in spring and fruit in autumn. Bees and their hives.' },
        { id: 'basalt', name: 'Basalt Isle', x: 40, z: -142, r: 12, h: 7, line: 'Dark stone columns over a black sand beach. Cormorants dry their wings.' },
        { id: 'oldtree', name: 'Old Tree Isle', x: -152, z: -58, r: 11, h: 4, view: 1.35, lift: 5, line: 'One vast, ancient tree on a mossy hill. Red squirrels and mushrooms.' },
        { id: 'stones', name: 'Standing Stones', x: 92, z: 136, r: 12, h: 4, line: 'A ring of tall stones on grassy downs. Hares race between them.' },
        { id: 'dunes', name: 'Dune Isle', x: -144, z: 64, r: 13, h: 4, line: 'Rolling dunes, driftwood and dune grass. Little plovers run the tideline.' },
      ],
      starter: ['oak', 'cherry', 'pine', 'maple', 'flowers', 'flowers', 'lavender', 'tulips', 'fern', 'mushroom'],
    },
    lantern: {
      id: 'lantern', name: 'Lantern Bay', homeName: 'Lantern Quay', short: 'An evening lagoon',
      line: 'A warm lagoon where the evenings are long. Paper lanterns float on the water, stilt houses stand over it, and fireflies rise from the glades.',
      grid: [320, -160], skerries: 8, homeSeed: 7,
      pond: { x: 4.5, z: 5, r: 2.4 },
      stacks: [[-23, 13, 1.0, 1], [20, -18, 0.9, 1]],
      islands: [
        { id: 'home', name: 'Lantern Quay', x: 0, z: 0, r: 15, line: 'Your garden by the quay, where the lanterns are set afloat.' },
        { id: 'stilts', shape: 'marsh', name: 'Stilt Village', x: 60, z: 20, r: 12, line: 'Houses on tall legs over the shallows, their windows lit at dusk. Herons fish below.' },
        { id: 'lotus', shape: 'atoll', name: 'Lotus Lagoon', x: -42, z: 54, r: 11, line: 'A ring of sand around still water crowded with lotus. Cranes wade there.' },
        { id: 'pagoda', shape: 'pine', name: 'Pagoda Hill', x: -62, z: -28, r: 10, h: 8, line: 'A steep green hill crowned with a pagoda whose lamps glow at dusk.' },
        { id: 'willows', name: 'Willow Isle', x: 28, z: -66, r: 11, h: 3, line: 'Weeping willows and cherry trees over a quiet shore.' },
        { id: 'glade', name: 'Firefly Glade', x: 80, z: -46, r: 10, h: 3.5, line: 'A mossy meadow where the fireflies rise thickest on warm nights.' },
      ],
      look: { season: 1.6, tod0: 0.64, daySpeed: 0.6, shallow: 0x55ad9f, deep: 0x1c4866, lanterns: 54, fireflies: 2.2, bats: true, music: 'lantern' },
      weather: { clear: 0.45, fair: 0.35, rain: 0.1, fog: 0.1 }, aurora: 0,
      starter: ['cherry', 'willow', 'maple', 'cherry', 'lavender', 'tulips', 'flowers', 'bamboo', 'fern', 'mushroom'],
    },
    frost: {
      id: 'frost', name: 'Frost Fjord', homeName: 'Fjord Haven', short: 'A fjord in deep winter',
      line: 'A cold, bright fjord in deep winter: ice cliffs, drifting icebergs, hot springs steaming in the snow, reindeer, and the aurora on most nights.',
      grid: [320, -160], skerries: 12, homeSeed: 13,
      pond: { x: 4.5, z: 5, r: 2.4 },
      stacks: [[-24, 14, 1.2, 2], [22, 16, 1.0, 1], [-18, -22, 1.4, 2]],
      islands: [
        { id: 'home', name: 'Fjord Haven', x: 0, z: 0, r: 15, line: 'Your garden under the snow, by a frozen pond.' },
        { id: 'icecliffs', shape: 'glacier', name: 'Ice Cliffs', x: -60, z: -18, r: 14, h: 8, line: 'Towering blue-white ice. Arctic foxes trot along the top.' },
        { id: 'snowsprings', shape: 'springs', name: 'Snow Springs', x: 56, z: -44, r: 11, h: 4, line: 'Hot pools steaming among the snow. Walk in to soak.' },
        { id: 'pineridge', shape: 'pine', name: 'Pine Ridge', x: 62, z: 38, r: 12, h: 8.5, line: 'Snow-laden pines on a steep ridge. Reindeer browse there.' },
        { id: 'sealskerry', shape: 'rocks', name: 'Seal Skerry', x: -8, z: 72, r: 7, line: 'Icy rocks where seals haul out and puffins nest.' },
        { id: 'northpoint', shape: 'stones', name: 'North Point', x: -62, z: 56, r: 11, h: 4, line: 'A bare headland with a ring of stones: the best place to watch the aurora. White hares live here.' },
      ],
      look: { season: 3.5, shallow: 0x6aa2b0, deep: 0x173a55, icebergs: 16, snowyOwl: true, reindeer: true, whiteHares: true, music: 'frost' },
      weather: { clear: 0.35, fair: 0.25, snow: 0.3, fog: 0.1 }, aurora: 0.85,
      starter: ['pine', 'birch', 'pine', 'pine', 'cairn', 'campfire', 'lantern', 'cairn'],
    },
    coral: {
      id: 'coral', name: 'Coral Cays', homeName: 'Coral Key', short: 'Turquoise shallows and white sand',
      line: 'Bright turquoise shallows, white sand and coral gardens. Flamingos feed on the flats, turtles come ashore, and dolphins pass by.',
      grid: [320, -160], skerries: 6, homeSeed: 21,
      pond: { x: 4.5, z: 5, r: 2.4 },
      stacks: [[21, 17, 0.8, 0], [-19, -21, 1.0, 1]],
      islands: [
        { id: 'home', name: 'Coral Key', x: 0, z: 0, r: 15, line: 'Your garden above a white beach.' },
        { id: 'bluelagoon', shape: 'atoll', name: 'Blue Lagoon', x: 56, z: 28, r: 12, line: 'A ring of palms around a lagoon full of coral and bright fish.' },
        { id: 'flamingo', shape: 'marsh', name: 'Flamingo Flats', x: -52, z: 40, r: 12, line: 'Warm shallows and reeds where flamingos feed.' },
        { id: 'palmcay', shape: 'wreck', name: 'Palm Cay', x: 30, z: -52, r: 6, line: 'A slip of sand with a few palms and nothing else.' },
        { id: 'turtlebeach', shape: 'dunes', name: 'Turtle Beach', x: -56, z: -36, r: 12, h: 3, line: 'Low dunes and a long beach where plovers run the tideline.' },
        { id: 'junglehill', shape: 'pine', name: 'Jungle Hill', x: 74, z: -28, r: 10, h: 7, line: 'A steep green hill thick with bamboo and ferns.' },
      ],
      look: { season: 1.45, shallow: 0x58d6cc, deep: 0x1b7aa6, whiteSand: true, dolphins: true, flamingos: true, deer: false, music: 'coral' },
      weather: { clear: 0.6, fair: 0.3, rain: 0.1 }, aurora: 0,
      starter: ['palm', 'palm', 'palm', 'sunflower', 'flowers', 'flowers', 'tulips', 'dune', 'dune'],
    },
  };
  const WORLD_ORDER = ['stillwater', 'lantern', 'frost', 'coral'];
  // The world to load: named in the page's #hash on the way through a voyage, otherwise the last one visited.
  function pickWorld() {
    let id = '';
    try { id = decodeURIComponent((location.hash || '').slice(1)); } catch (e) { /* no hash */ }
    if (!WORLDS[id]) { try { id = JSON.parse(localStorage.getItem('stillwater.worldSel')); } catch (e) { id = ''; } }
    return WORLDS[id] ? id : 'stillwater';
  }
  const WORLD = WORLDS[pickWorld()];
  WORLD.look = WORLD.look || {};

  SW.K = {
    WL: -0.35,                 // water level; block tops sit on whole numbers
    G: WORLD.grid[0], MINX: WORLD.grid[1],   // terrain grid
    R: 15,                     // home island radius
    DAY_LEN: 960,              // seconds per day at the normal pace; one season lasts one day
    WORLD, WORLDS, WORLD_ORDER,
    POND: WORLD.pond,
    ISLET: WORLD.islet || null,
    STACKS: WORLD.stacks || [],
    ISLANDS: WORLD.islands,
    SPRING_POOLS: [[-2.5, 1, 1.7], [3, -1.5, 1.4], [0.5, -4.5, 1.2]],   // [dx, dz, radius] from a hot spring island
    ARCH: WORLD.arch || null,                                         // a rock arch you can row under
    BAMBOO_POND: { dx: 3, dz: -2.5, r: 2.3 },                          // a koi pond on Bamboo Isle, relative to its centre
  };
  WORLD.islands.forEach((I) => { I.shape = I.shape || I.id; });
  SW.K.ISLAND = Object.fromEntries(SW.K.ISLANDS.map((i) => [i.id, i]));

  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const lerp = (a, b, k) => a + (b - a) * k;

  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function hash2(x, y, s) {
    let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(s | 0, 1442695041);
    h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296;
  }
  function vnoise(x, y, s) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = hash2(xi, yi, s), b = hash2(xi + 1, yi, s), c = hash2(xi, yi + 1, s), d = hash2(xi + 1, yi + 1, s);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  function fbm(x, y, s, oct = 4) {
    let sum = 0, amp = 0.5, f = 1, norm = 0;
    for (let i = 0; i < oct; i++) { sum += amp * vnoise(x * f, y * f, s + i * 17); norm += amp; amp *= 0.5; f *= 2; }
    return sum / norm;
  }
  const hex = (h) => new THREE.Color(h);

  // A seasonal palette is [spring, summer, autumn, winter]; each is a list of colours or null (bare).
  const pal4 = (...seasons) => seasons.map((s) => (s ? s.map(hex) : null));

  // Colour for one voxel at season S (0 spring … 4 next spring). Each voxel turns at a slightly
  // different moment (r), so a canopy changes gradually. Returns how much of the voxel is present.
  function seasonColor(P, r, S, out) {
    const Sv = S + (r - 0.5) * 0.35;
    let i = Math.floor(Sv);
    const f = Sv - i;
    i = ((i % 4) + 4) % 4;
    const a = P[i], b = P[(i + 1) % 4], k = smooth(0.72, 1, f), pick = (r * 7.31) % 1;
    const ca = a && a[(pick * a.length) | 0], cb = b && b[(pick * b.length) | 0];
    if (ca && cb) { out.copy(ca).lerp(cb, k); return 1; }
    if (ca) { out.copy(ca); return 1 - k; }
    if (cb) { out.copy(cb); return k; }
    return 0;
  }

  SW.U = {
    clamp, smooth, lerp, mulberry32, hash2, vnoise, fbm, hex, pal4, seasonColor,
    pick: (rng, a) => a[(rng() * a.length) | 0],
    angDiff: (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a)),
    seasonIndex: (S) => ((Math.floor(S) % 4) + 4) % 4,
    seasonName: (S) => ['Spring', 'Summer', 'Autumn', 'Winter'][((Math.floor(S) % 4) + 4) % 4],
    // tod 0 is dawn (6 am), 0.7 is dusk (7 pm)
    hourOf: (tod) => (tod < 0.7 ? 6 + tod / 0.7 * 13 : 19 + (tod - 0.7) / 0.3 * 11) % 24,
    todOf: (hour) => { const h = ((hour - 6) % 24 + 24) % 24; return h < 13 ? h / 13 * 0.7 : 0.7 + (h - 13) / 11 * 0.3; },
    clockLabel(tod) {
      const h = SW.U.hourOf(tod), hh = Math.floor(h), mm = Math.floor((h - hh) * 60 / 5) * 5;
      return ((hh + 11) % 12 + 1) + ':' + String(mm).padStart(2, '0') + (hh < 12 ? ' am' : ' pm');
    },
    today: () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); },
    niceDate(iso) {
      try { return new Date(iso + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }); } catch (e) { return iso; }
    },
  };

  SW.store = {
    // keys for things that belong to one world (its garden, tidied wild plants, time and island)
    w: (k) => (WORLD.id === 'stillwater' ? k : k + '@' + WORLD.id),
    get(k, d) { try { const v = localStorage.getItem('stillwater.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('stillwater.' + k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } },
  };

  const handlers = {};
  SW.on = (name, fn) => { (handlers[name] = handlers[name] || []).push(fn); };
  SW.emit = (name, data) => { (handlers[name] || []).forEach((fn) => fn(data)); };

  SW.S = {
    t: 0, dt: 0,
    tod: 0.44, day: 0, season: 0.3,
    night: 0, glow: 0, dayness: 1,
    weather: { cloud: 0.25, rain: 0, fog: 0, snow: 0, wind: 0.4, aurora: 0, rainbow: 0 },
    breath: { b: 0, label: 'breathe in', kind: 'in', left: 0, outT: 99 },
    started: false, quality: 'high', reduceMotion: false, island: 'home',
  };
})(window.SW);
