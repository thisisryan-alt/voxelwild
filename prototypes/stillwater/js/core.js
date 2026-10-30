// Stillwater: shared constants, helpers and state. Loaded first; the other files add to window.SW.
window.SW = window.SW || {};
(function (SW) {
  'use strict';

  SW.K = {
    WL: -0.35,                 // water level; block tops sit on whole numbers
    G: 84, MINX: -42,          // terrain grid
    R: 15,                     // island radius
    DAY_LEN: 960,              // seconds per day at the normal pace; one season lasts one day
    POND: { x: 4.5, z: 5, r: 2.4 },
    ISLET: { x: 29, z: -23, r: 3.4 },
    STACKS: [[-24, 14, 1.1, 1], [21, 17, 0.8, 0], [-19, -21, 1.3, 1], [8, -25, 0.7, 0]],
  };

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
    started: false, quality: 'high', reduceMotion: false,
  };
})(window.SW);
