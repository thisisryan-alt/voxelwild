// Stillwater: input, camera, breathing, time and seasons, journal, rituals, saving and the UI.
(function (SW) {
  'use strict';
  const { K, U } = SW;
  const S = SW.S;
  const $ = (id) => document.getElementById(id);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));
  let W, GD, L, A;

  // ------------------------------------------------------------ breathing
  // [kind, seconds, from, to, label]
  const PATTERNS = {
    resonant: { name: 'Six a minute', sub: '4 s in · 6 s out', segs: [['in', 4, 0, 1, 'breathe in'], ['out', 6, 1, 0, 'breathe out']] },
    even: { name: 'Even', sub: '5.5 s in · 5.5 s out', segs: [['in', 5.5, 0, 1, 'breathe in'], ['out', 5.5, 1, 0, 'breathe out']] },
    sigh: { name: 'Cyclic sigh', sub: '2 s in · 1 s more · 6 s out', segs: [['in', 2.2, 0, 0.8, 'breathe in'], ['in', 1, 0.8, 1, 'a little more'], ['out', 6.3, 1, 0, 'long breath out']] },
    box: { name: 'Box', sub: '4 in · 4 hold · 4 out · 4 hold', segs: [['in', 4, 0, 1, 'breathe in'], ['hold', 4, 1, 1, 'hold'], ['out', 4, 1, 0, 'breathe out'], ['hold', 4, 0, 0, 'hold']] },
    478: { name: '4-7-8', sub: '4 in · 7 hold · 8 out', segs: [['in', 4, 0, 1, 'breathe in'], ['hold', 7, 1, 1, 'hold'], ['out', 8, 1, 0, 'breathe out']] },
  };
  let patternT0 = 0;
  function updateBreath(t) {
    const P = PATTERNS[prefs.pattern] || PATTERNS.resonant, total = P.segs.reduce((a, s) => a + s[1], 0);
    let x = ((t - patternT0) % total + total) % total, i = 0;
    while (i < P.segs.length - 1 && x >= P.segs[i][1]) { x -= P.segs[i][1]; i++; }
    const [kind, d, from, to, label] = P.segs[i], B = S.breath;
    if (kind === 'out' && B.kind !== 'out') B.outT = 0;
    B.outT += S.dt;
    B.b = from + (to - from) * (0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, x / d)));
    B.kind = kind; B.label = label; B.left = d - x;
  }

  // -------------------------------------------------------------- prefs/save
  const isTouch = window.matchMedia && matchMedia('(pointer: coarse)').matches;
  const prefs = Object.assign({
    guide: true, pattern: 'resonant', master: 0.7, levels: {}, flow: 'flow', season: 'auto', weather: 'auto',
    quality: isTouch ? 'balanced' : 'high', drift: true, calm: false, tutorial: 0,
  }, SW.store.get('prefs2', {}));
  const journal = Object.assign({ seen: {}, sitMinutes: 0, lanterns: 0, wishes: 0 }, SW.store.get('journal', {}));
  let lastSave = 0;
  const saveSoon = () => { lastSave = Math.min(lastSave, performance.now() - 6500); };   // save within a couple of seconds
  function saveNow() {
    if (!W) return;
    SW.store.set('garden2', GD.serialize());
    SW.store.set('journal', journal);
    SW.store.set('prefs2', prefs);
    SW.store.set('world', { tod: S.tod, day: S.day, season: S.season, island: S.island });
    SW.store.set('wildGone', GD.wildGone());
  }
  window.addEventListener('pagehide', () => { if (S.started) saveNow(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && S.started) saveNow(); });

  // ----------------------------------------------------------------- journal
  const JOURNAL = [
    ['koi', 'Koi', 'They circle the island and come to see what you drop in the water.', 'Drop a pebble in the sea.'],
    ['goldfish', 'Pond goldfish', 'Two of them, slowly circling the pond.', 'Look into the pond.'],
    ['butterfly', 'Butterflies', 'They visit flowers on warm, dry days.', 'Plant flowers and wait for a fine spring or summer day.'],
    ['gull', 'Gulls', 'Wheeling high over the water on clear days.', 'Look up on a clear day.'],
    ['songbird', 'Songbirds', 'They hop between branches, roofs and flower beds, and sing.', 'Grow a few trees, or build a birdhouse.'],
    ['duck', 'Ducks', 'A pair paddles around the island. At night they tuck their heads in.', 'Look around the shallows.'],
    ['ducklings', 'Ducklings', 'In spring and summer they follow their parents in a line.', 'Ducklings hatch in spring.'],
    ['frog', 'Frogs', 'They sit on lily pads and sing at dusk.', 'Float lily pads on the water.'],
    ['rabbit', 'Rabbits', 'They hop about the grass by day and stop to nibble.', 'Rabbits come out by day.'],
    ['crab', 'Crabs', 'Scuttling sideways along the beach.', 'Look along the sand.'],
    ['heron', 'Heron', 'Stands very still in the shallows, fishing at dawn and dusk.', 'Herons fish the shallows at dawn and dusk.'],
    ['dragonfly', 'Dragonflies', 'They hover over reeds and lily pads in summer.', 'Plant reeds or lily pads and wait for summer.'],
    ['owl', 'Owl', 'Watches from the tallest tree after dark.', 'Stay up past dark.'],
    ['cat', 'The dock cat', 'Asleep by the lantern, breathing with the tide.', 'Look at the end of the dock.'],
    ['whale', 'Whale', 'Surfaces far out, breathes three times, and dives.', 'Watch the open sea. It is worth the wait.'],
    ['turtle', 'Sea turtle', 'Swims slowly around the island and comes up for air.', 'It visits in the warmer seasons.'],
    ['sailboat', 'Sailboat', 'Crosses the horizon now and then.', 'Look toward the horizon.'],
    ['leapfish', 'Leaping fish', 'A flash of silver, then rings on the water.', 'Watch the water by day.'],
    ['fireflies', 'Fireflies', 'They drift over the grass on warm nights.', 'Wait for a summer night.'],
    ['bioluminescence', 'Glowing water', 'At night the surf and ripples glow blue.', 'Drop a pebble at night.'],
    ['lighthouse', 'Lighthouse', 'Its beam turns at dusk and in fog.', 'Its lamp comes on at dusk.'],
    ['aurora', 'Aurora', 'Green and violet curtains over the northern sky.', 'Some clear nights, mostly in autumn and winter.'],
    ['shooting', 'Shooting star', 'Tap one to make a wish.', 'Watch a clear night sky.'],
    ['fullmoon', 'Full moon', 'The moon waxes and wanes over eight days.', 'Wait for a clear night when the moon is full.'],
    ['rainbow', 'Rainbow', 'Appears opposite a low sun after rain.', 'Look away from a low sun after rain.'],
    ['rain', 'Rain', 'Rings on the water and a soft hiss.', 'Rain comes and goes on its own.'],
    ['fog', 'Fog', 'The island turns quiet and close.', 'Some days are misty.'],
    ['snow', 'Snow', 'Slow flakes and a white island.', 'Wait for winter.'],
    ['sheep', 'Sheep', 'They graze Meadow Isle and call to each other now and then.', 'Row to Meadow Isle.'],
    ['fox', 'Arctic foxes', 'White foxes trotting over the ice. They keep their distance.', 'Row to Glacier Isle.'],
    ['otter', 'Otters', 'They float on their backs in the marsh pools.', 'Row to Marsh Isle.'],
    ['arch', 'Sea arch', 'A span of rock you can row beneath.', 'It stands north of Home Island.'],
    ['soak', 'A long soak', 'Warm water up to your shoulders, steam rising.', 'Walk into a hot spring.'],
    ['deer', 'Deer', 'Shy deer among the pines. Tap one and it bounds away.', 'Row to Pine Isle.'],
    ['seal', 'Seals', 'They bask on Seal Rocks and slip into the sea to swim.', 'Row to Seal Rocks.'],
    ['puffin', 'Puffins', 'Small seabirds with bright beaks, looping over the rocks.', 'Row to Seal Rocks by day.'],
    ['reeffish', 'Reef fish', 'Bright schools circling the lagoon.', 'Look into the lagoon at Palm Atoll.'],
    ['crane', 'Cranes', 'Tall and very still in the shallows. Now and then they call, open their wings and dance.', 'Row to Bamboo Isle. Tap one to see it dance.'],
    ['bee', 'Bees', 'They leave the hive on warm days and visit the flowers nearby.', 'Visit Orchard Isle in spring or summer, or build a beehive near flowers.'],
    ['cormorant', 'Cormorants', 'Dark seabirds that stand on the columns with their wings held out to dry, then fly down to fish.', 'Row to Basalt Isle.'],
    ['squirrel', 'Red squirrels', 'They scamper among the roots and run up the trunk of the old tree.', 'Row to Old Tree Isle by day.'],
    ['hare', 'Hares', 'Bigger and quicker than rabbits, with black-tipped ears. They race between the stones.', 'Row to the Standing Stones.'],
    ['plover', 'Plovers', 'Tiny shorebirds that run along the tideline, stop, and run again.', 'Row to Dune Isle and watch the water’s edge.'],
  ].map(([id, name, line, hint]) => ({ id, name, line, hint }));
  for (const I of K.ISLANDS) if (I.id !== 'home') JOURNAL.push({ id: 'isle-' + I.id, name: I.name, line: I.line, hint: 'Row there from the Islands menu.' });
  const JBY = Object.fromEntries(JOURNAL.map((j) => [j.id, j]));
  let pendingSeen = [], seenFlush = 0;
  SW.on('see', (id) => {
    if (!S.started || journal.seen[id] || !JBY[id]) return;
    journal.seen[id] = U.today();
    pendingSeen.push(JBY[id].name);
    saveSoon();
    if (!$('panelJournal').hidden) renderJournal();
  });
  SW.on('wish', () => { journal.wishes++; saveSoon(); toast('Make a wish.', 4); });
  function flushSeen(dt) {
    seenFlush -= dt;
    if (seenFlush > 0 || !pendingSeen.length || sit) return;
    const names = pendingSeen.splice(0), list = names.length > 1 ? names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1] : names[0];
    toast('New in your field notes: ' + list + '.', 5);
    seenFlush = 6;
  }

  // ------------------------------------------------------------------- toasts
  const toastQ = [];
  let toastUntil = 0;
  function toast(text, secs = 4, now) {
    if (now) { toastQ.length = 0; toastUntil = 0; }
    if (toastQ.some((q) => q.text === text)) return;
    toastQ.push({ text, secs });
  }
  function updateToast() {
    const el = $('toast');
    if (toastUntil && S.t > toastUntil) { el.classList.add('off'); toastUntil = 0; }
    if (!toastUntil && toastQ.length && el.classList.contains('off')) {
      const q = toastQ.shift();
      setTimeout(() => { el.textContent = q.text; el.classList.remove('off'); toastUntil = S.t + q.secs; }, 350);
      toastUntil = S.t + q.secs + 0.35;
    }
  }

  // ------------------------------------------------------------------ camera
  const cam = {
    mode: 'orbit', theta: 0.65, phi: 1.1, r: 46, tTheta: 0.65, tPhi: 1.1, tR: 46,
    target: new THREE.Vector3(0, 1.4, 0), tTarget: new THREE.Vector3(0, 1.4, 0),
    yaw: 0, pitch: 0, tYaw: 0, tPitch: 0, fYaw: 0, eye: new THREE.Vector3(), view: 'island', blend: 0, poi: 0, poiT: 0,
  };
  const curPos = new THREE.Vector3(), curLook = new THREE.Vector3(), wantPos = new THREE.Vector3(), wantLook = new THREE.Vector3();
  let lastInteract = -100, lastDrag = -100;
  const VIEWS = { island: 'Island', dock: 'Shore', beach: 'Beach', pond: 'Pond', sky: 'The whole archipelago', drift: 'Drift' };
  function setView(v, instant) {
    if (SW.walk.active) stopWalking();
    cam.view = v; cam.blend = instant ? 0 : 4;
    const d = W.dock;
    if ((v === 'beach' || v === 'pond') && W.island.id !== 'home') W.setIsland('home');
    const I = W.island;
    if (v === 'island' || v === 'sky' || v === 'drift') {
      cam.mode = v === 'drift' ? 'drift' : 'orbit';
      if (v === 'sky') cam.tTarget.set(0, 0, 0); else cam.tTarget.copy(I.center);
      cam.tR = v === 'sky' ? 400 : (I.id === 'home' ? 46 : Math.max(26, I.r * 3.1) * (I.view || 1)) * (W.portrait ? 1.6 : 1);
      cam.tPhi = v === 'sky' ? 0.5 : 1.1;
    } else {
      cam.mode = 'look';
      if (v === 'dock' && I.id !== 'home') {
        // the shore of whichever island you are on, facing out to sea
        cam.eye.set(I.shore.x - I.out.x * 0.6, I.shore.y + 1.4, I.shore.z - I.out.y * 0.6);
        cam.tYaw = Math.atan2(I.out.x, I.out.y); cam.tPitch = 0.03;
      } else if (v === 'dock') {
        const back = new THREE.Vector3(Math.cos(d.angle), 0, Math.sin(d.angle));
        cam.eye.copy(d.end).addScaledVector(back, -1.7); cam.eye.y = d.end.y + 1.3;
        cam.tYaw = Math.atan2(back.x, back.z); cam.tPitch = 0.02;
      } else if (v === 'beach') {
        // a western beach, facing the sunset, with the lighthouse off to one side
        const dir = 1.15;
        let best = W.cols.sand[0], bd = -9;
        for (const s of W.cols.sand) { const dd = Math.cos(Math.atan2(s[1], s[0]) - dir) - Math.abs(s[2]) * 0.1; if (dd > bd) { bd = dd; best = s; } }
        cam.eye.set(best[0], best[2] + 1.3, best[1]);
        cam.tYaw = Math.atan2(best[0], best[1]) - 0.35; cam.tPitch = 0.05;
      } else if (v === 'pond') {
        const P = K.POND, a = Math.atan2(P.z, P.x) + 0.4;
        const ex = P.x + Math.cos(a) * (P.r + 3.2), ez = P.z + Math.sin(a) * (P.r + 3.2);
        cam.eye.set(ex, W.heightAt(ex, ez) + 1.7, ez);
        cam.tYaw = Math.atan2(P.x - ex, P.z - ez); cam.tPitch = -0.32;
      }
      cam.yaw = cam.tYaw; cam.pitch = cam.tPitch;
    }
    if (instant) { cam.theta = cam.tTheta; cam.phi = cam.tPhi; cam.r = cam.tR; cam.target.copy(cam.tTarget); computeWant(); curPos.copy(wantPos); curLook.copy(wantLook); }
    $$('#popView [data-view]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === v)));
  }
  function computeWant() {
    if (cam.mode === 'look') {
      wantPos.copy(cam.eye);
      wantLook.set(Math.sin(cam.yaw) * Math.cos(cam.pitch), Math.sin(cam.pitch), Math.cos(cam.yaw) * Math.cos(cam.pitch)).add(cam.eye);
    } else {
      const sp = Math.sin(cam.phi);
      wantLook.copy(cam.target);
      wantPos.set(cam.target.x + cam.r * sp * Math.cos(cam.theta), cam.target.y + cam.r * Math.cos(cam.phi), cam.target.z + cam.r * sp * Math.sin(cam.theta));
    }
  }
  function updateCamera(dt, t) {
    const k = 1 - Math.exp(-dt * 4);
    if (cam.mode === 'drift') {
      cam.tTheta += dt * 0.028;
      cam.tR = 32 + 12 * Math.sin(t * 0.021);
      cam.tPhi = 1.08 + 0.16 * Math.sin(t * 0.017);
      cam.poiT -= dt;
      if (cam.poiT <= 0) {
        cam.poiT = 35;
        const I = W.island, trees = GD.feat.tree.filter((tr) => Math.hypot(tr.x - I.x, tr.z - I.z) < I.r + 6);
        const pois = I.id === 'home' ? [[0, 1.4, 0], [K.POND.x, 0.5, K.POND.z], [W.dock.end.x, 0.5, W.dock.end.z]] : [[I.center.x, I.center.y, I.center.z], [I.shore.x, 0.5, I.shore.z]];
        if (trees.length) { const tr = U.pick(Math.random, trees); pois.push([tr.x, tr.y * 0.6, tr.z]); }
        cam.tTarget.set(...pois[cam.poi++ % pois.length]);
      }
    } else if ((cam.mode === 'orbit' || (cam.mode === 'walk' && !SW.walk.moving)) && prefs.drift && !S.reduceMotion && t - lastInteract > 12) cam.tTheta += dt * 0.012 * U.smooth(12, 18, t - lastInteract);
    if (cam.mode === 'walk') {
      const p = SW.walk.pos;
      cam.tTarget.set(p.x, p.y + (SW.walk.pose === 'stand' ? 0.9 : 0.5), p.z);
      if (SW.walk.moving && t - lastDrag > 1.5) {
        const f = SW.walk.facing, behind = Math.atan2(-Math.cos(f), -Math.sin(f));
        cam.tTheta += U.angDiff(cam.tTheta, behind) * Math.min(1, dt * 1.2);
      }
    }
    const trip = L.trip();
    if (cam.mode === 'follow' && trip) {
      const b = L.boat().position, f = trip.fwd, c = Math.cos(cam.fYaw), sn = Math.sin(cam.fYaw);
      const dx = f.x * c - f.z * sn, dz = f.x * sn + f.z * c;
      wantPos.set(b.x - dx * 7.5, b.y + 3.3, b.z - dz * 7.5);
      wantLook.set(b.x + dx * 5, b.y + 0.7, b.z + dz * 5);
      const kf = 1 - Math.exp(-dt * 2.2);
      curPos.lerp(wantPos, kf); curLook.lerp(wantLook, kf);
      W.camera.position.copy(curPos); W.camera.lookAt(curLook);
      W.focus.copy(b);
      return;
    }
    if (cam.mode === 'look') {
      cam.yaw += U.angDiff(cam.yaw, cam.tYaw) * k; cam.pitch += (cam.tPitch - cam.pitch) * k;
    } else {
      cam.theta += (cam.tTheta - cam.theta) * k; cam.phi += (cam.tPhi - cam.phi) * k; cam.r += (cam.tR - cam.r) * k;
      cam.target.lerp(cam.tTarget, 1 - Math.exp(-dt * (cam.mode === 'drift' ? 0.3 : cam.mode === 'walk' ? 8 : 1.5)));
    }
    computeWant();
    // keep every orbiting view out of hillsides and cliffs, not only the walk camera
    wantPos.y = Math.max(wantPos.y, W.heightAt(wantPos.x, wantPos.z) + (cam.mode === 'walk' ? 0.8 : 1.2), K.WL + 0.6);
    cam.blend = Math.max(0, cam.blend - dt);
    const kb = cam.blend > 0 ? 1 - Math.exp(-dt * 1.6) : 1;
    curPos.lerp(wantPos, kb); curLook.lerp(wantLook, kb);
    W.camera.position.copy(curPos);
    W.camera.lookAt(curLook);
    if (cam.mode === 'look') W.focus.copy(curLook).sub(curPos).setY(0).normalize().multiplyScalar(8).add(curPos);
    else W.focus.copy(cam.view === 'sky' ? W.island.center : cam.target);
  }

  // ------------------------------------------------------------------- input
  const pointers = new Map();
  let dragMoved = false, downX = 0, downY = 0, pinchD = 0;
  function bindInput() {
    const canvas = W.canvas;
    canvas.addEventListener('pointerdown', (e) => {
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 1) { dragMoved = false; downX = e.clientX; downY = e.clientY; }
      else { dragMoved = true; const [a, b] = [...pointers.values()]; pinchD = Math.hypot(a.x - b.x, a.y - b.y); }
      lastInteract = S.t; closePops();
    });
    canvas.addEventListener('pointermove', (e) => {
      const prev = pointers.get(e.pointerId);
      if (!prev) return;
      if (pointers.size === 1) {
        if (!dragMoved && Math.hypot(e.clientX - downX, e.clientY - downY) > 7) dragMoved = true;
        if (dragMoved) {
          const dx = e.clientX - prev.x, dy = e.clientY - prev.y;
          if (cam.mode === 'follow') cam.fYaw = U.clamp(cam.fYaw - dx * 0.004, -2.6, 2.6);
          else if (cam.mode === 'look') { cam.tYaw -= dx * 0.004; cam.tPitch = U.clamp(cam.tPitch + dy * 0.003, -0.7, 0.6); }
          else {
            if (cam.mode === 'drift') { cam.mode = 'orbit'; cam.view = 'island'; setViewButtons(); }
            cam.tTheta += dx * 0.005; cam.tPhi = U.clamp(cam.tPhi - dy * 0.004, 0.45, 1.42); lastDrag = S.t;
          }
        }
      }
      prev.x = e.clientX; prev.y = e.clientY;
      if (pointers.size === 2 && cam.mode !== 'look') {
        const [a, b] = [...pointers.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinchD > 0) cam.tR = U.clamp(cam.tR * pinchD / d, cam.mode === 'walk' ? 3.5 : 16, cam.mode === 'walk' ? 30 : 100);
        pinchD = d;
      }
      lastInteract = S.t;
    });
    const end = (e) => {
      if (e.type === 'pointerup' && pointers.size === 1 && !dragMoved) handleTap(e.clientX, e.clientY);
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinchD = 0;
    };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (cam.mode !== 'look') cam.tR = U.clamp(cam.tR * (1 + e.deltaY * 0.001), cam.mode === 'walk' ? 3.5 : 16, cam.mode === 'walk' ? 30 : 100);
      lastInteract = S.t;
    }, { passive: false });
  }
  const setViewButtons = () => $$('#popView [data-view]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === cam.view)));

  const raycaster = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const waterPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -K.WL), wp = new THREE.Vector3();
  const growing = [];
  let planted = 0, pebbles = 0;
  function handleTap(cx, cy) {
    if (!S.started || sit) return;
    ndc.set((cx / window.innerWidth) * 2 - 1, -(cy / window.innerHeight) * 2 + 1);
    raycaster.setFromCamera(ndc, W.camera);
    if (W.tryWish(cx, cy)) return;
    if (SW.walk.active && !L.trip()) { walkTap(); return; }
    if (tool !== 'tidy' && L.tapAt(raycaster)) return;
    const hit = raycaster.intersectObject(W.terrain, false)[0];
    const wHit = raycaster.ray.intersectPlane(waterPlane, wp);
    const wDist = wHit ? raycaster.ray.origin.distanceTo(wp) : Infinity;
    if (hit && hit.point.y > K.WL && hit.distance <= wDist) onLand(hit);
    else if (wHit && Math.hypot(wp.x, wp.z) < 200) onWater(wp.x, wp.z);
  }
  // While walking, a tap is somewhere to go: a spot on land or in the shallows, a seat, the boat,
  // or open water to throw a pebble into.
  function walkTap() {
    const WK = SW.walk;
    if (L.tapBoat(raycaster)) { renderIslands(); togglePop('popIslands'); return; }
    if (L.tapAt(raycaster)) return;
    const hit = raycaster.intersectObject(W.terrain, false)[0];
    const wHit = raycaster.ray.intersectPlane(waterPlane, wp);
    const land = hit && hit.point.y > K.WL && (!wHit || hit.distance <= raycaster.ray.origin.distanceTo(wp));
    const pt = land ? hit.point : wHit ? wp : null;
    if (!pt) return;
    const st = WK.seatNear(pt.x, pt.z, 1.3);
    if (st) { if (!WK.goSit(st)) toast('You can’t quite get there from here.', 3, true); return; }
    if (land) { const g = GD.nearest(pt.x, pt.z, 0.7, (it) => it.k === 'grat'); if (g && Math.hypot(g.x - WK.pos.x, g.z - WK.pos.z) < 3) { showNote(g); return; } }
    if (land || W.heightAt(pt.x, pt.z) === -1 || W.deckAt(pt.x, pt.z) != null) {
      if (!WK.goTo(pt.x, pt.z)) toast('You can’t quite get there from here.', 3, true);
      return;
    }
    if (Math.hypot(pt.x - WK.pos.x, pt.z - WK.pos.z) < 16) {
      WK.facing = Math.atan2(pt.x - WK.pos.x, pt.z - WK.pos.z);
      L.throwPebble(WK.pos, pt.x, pt.z);
      pebbles++;
    } else toast('That is too far to throw a pebble.', 3, true);
  }
  function startWalking() {
    if (L.trip()) { toast('Wait until you land.', 3, true); return; }
    if (cam.view === 'sky' || cam.mode === 'look' || cam.mode === 'drift') setView('island', true);
    SW.walk.enter();
    cam.mode = 'walk'; cam.view = 'walk'; cam.tR = 9; cam.tPhi = 1.18; cam.blend = 3;
    cam.tTheta = Math.atan2(-Math.cos(SW.walk.facing), -Math.sin(SW.walk.facing));
    setViewButtons();
    $('btnWalk').setAttribute('aria-pressed', 'true');
    if (!prefs.walkTips) { prefs.walkTips = true; toast('Tap where to go, or use the arrow keys. Tap a bench, a jetty’s end or a hot spring to sit.', 8, true); }
  }
  function stopWalking() {
    SW.walk.exit();
    $('btnWalk').setAttribute('aria-pressed', 'false');
    cam.mode = 'orbit'; cam.view = 'island';
    cam.tTarget.copy(W.island.center); cam.tR = W.island.id === 'home' ? 46 : Math.max(26, W.island.r * 3.1) * (W.island.view || 1); cam.tPhi = 1.1; cam.blend = 3;
  }
  // In walk mode the tray acts right where you stand.
  function actHere(k) {
    const WK = SW.walk, f = WK.front(1.3);
    if (k === 'pebble' || k === 'skip') {
      const tgt = WK.front(k === 'pebble' ? 7 : 5);
      if (W.heightAt(tgt.x, tgt.z) >= -1) { toast('Face the open water first.', 3, true); return; }
      if (k === 'pebble') L.throwPebble(WK.pos, tgt.x, tgt.z); else L.skipStone(tgt.x, tgt.z);
      return;
    }
    if (k === 'tidy') { tidyAt(f.x, f.z); return; }
    const def = GD.CAT[k];
    let kind = k;
    if (def.cat === 'plants' && def.on === 'grass' && !W.isGrass(f.x, f.z) && W.heightAt(f.x, f.z) >= 0 && W.heightAt(f.x, f.z) <= 2) kind = 'dune';
    if (plantAt(kind, f.x, f.z)) WK.kneel();
  }

  function onLand(hit) {
    const b = W.blocks[hit.instanceId];
    if (!b || b[6] !== W.heightAt(b[0], b[2])) return;
    const x = U.clamp(hit.point.x, b[0] - 0.45, b[0] + 0.45), z = U.clamp(hit.point.z, b[2] - 0.45, b[2] + 0.45);
    if (tool === 'tidy') { tidyAt(x, z); return; }
    const g = GD.nearest(x, z, 0.7, (it) => it.k === 'grat');
    if (g) { showNote(g); return; }
    if (tool === 'pebble' || tool === 'skip') { toast(tool === 'skip' ? 'Tap the water to skip a stone.' : 'Tap the water to drop a pebble.', 3, true); return; }
    const def = GD.CAT[tool];
    if (!def) return;
    let k = tool;
    if (def.on === 'water' || def.on === 'reef') { toast(def.label + (def.on === 'reef' ? ' grows on the sea floor. Tap clear, shallow water.' : ' go on the water.'), 3, true); return; }
    if (def.cat === 'plants' && def.on === 'grass' && !W.isGrass(x, z) && W.heightAt(x, z) <= 2) k = 'dune';
    plantAt(k, x, z);
  }
  function onWater(x, z) {
    if (tool === 'tidy') { tidyAt(x, z); return; }
    if (tool === 'lily' || tool === 'reeds' || tool === 'coral') { plantAt(tool, x, z); return; }
    if (tool === 'skip') { L.skipStone(x, z); return; }
    W.addRipple(x, z, 1);
    A.plop();
    L.splash(x, z, 5);
    L.attractKoi(x, z);
    pebbles++;
    if (prefs.tutorial === 1) tutorialStep(2);
  }
  function plantAt(k, x, z) {
    const r = GD.tryPlace(k, x, z);
    if (!r.ok) { if (r.msg) toast(r.msg, 4, true); return false; }
    A.plantNote();
    planted++;
    saveSoon();
    const def = GD.CAT[k];
    if (def.tree || def.span >= 8) growing.push({ at: S.t + def.span + 1.5, x: r.rec.x, y: r.rec.y + (def.tree ? 4 : 0.6), z: r.rec.z });
    if (prefs.tutorial === 0) tutorialStep(1);
    return true;
  }
  function tidyAt(x, z) {
    const it = GD.nearest(x, z, 1.4);
    if (!it) { toast('Nothing to tidy there. Tap right on a plant or decoration.', 3, true); return; }
    GD.remove(it); A.remove(); saveSoon();
  }

  // -------------------------------------------------------------------- tools
  const TOOLS = {
    trees: ['oak', 'maple', 'birch', 'cherry', 'apple', 'willow', 'pine', 'palm'],
    plants: ['flowers', 'tulips', 'lavender', 'sunflower', 'fern', 'mushroom', 'bush', 'bamboo'],
    water: ['lily', 'reeds', 'coral', 'pebble', 'skip'],
    decor: ['lantern', 'chime', 'bench', 'campfire', 'cairn', 'birdhouse', 'hive', 'stones', 'cabin', 'pavilion', 'windmill'],
    rituals: ['letgo', 'grateful', 'tidy'],
  };
  const SPECIAL = {
    pebble: { label: 'Pebble', swatch: '#8e938f' }, skip: { label: 'Skip a stone', swatch: '#b8bcb8' },
    letgo: { label: 'Let something go', swatch: '#ffc070' }, grateful: { label: 'Something good', swatch: '#faf3e0' },
    tidy: { label: 'Tidy away', swatch: '#c9d3d8' },
  };
  let tool = 'oak', openCat = null;
  const toolInfo = (k) => SPECIAL[k] || GD.CAT[k];
  function renderDrawer() {
    const d = $('drawer');
    if (!openCat) { d.hidden = true; return; }
    d.hidden = false;
    d.innerHTML = TOOLS[openCat].map((k) => {
      const ti = toolInfo(k);
      return `<button class="chip item" data-kind="${k}" aria-pressed="${k === tool}"><span class="vox" style="--c:${ti.swatch}"></span>${ti.label}</button>`;
    }).join('');
    d.querySelectorAll('.item').forEach((b) => b.addEventListener('click', () => chooseTool(b.dataset.kind)));
  }
  function renderCats() {
    $$('.cat').forEach((b) => {
      const c = b.dataset.cat, has = TOOLS[c].includes(tool);
      b.setAttribute('aria-expanded', String(openCat === c));
      b.classList.toggle('holds', has);
      b.querySelector('.cur').textContent = has ? toolInfo(tool).label : '';
    });
  }
  function chooseTool(k) {
    if (k === 'letgo' || k === 'grateful') { openComposer(k); return; }
    if (SW.walk.active) { actHere(k); return; }
    tool = k;
    renderDrawer(); renderCats();
    const hints = {
      lily: 'Tap calm water near the shore or on the pond.', reeds: 'Tap the water’s edge.', pebble: 'Tap the water.',
      skip: 'Tap the water. The stone flies from the nearest beach.', tidy: 'Tap a plant or decoration to tidy it away.',
      palm: 'Palms grow on the sandy beach.', cabin: 'The cabin needs a flat, dry spot.',
    };
    if (hints[k]) toast(hints[k], 3, true);
  }

  // ----------------------------------------------------------------- composer
  let composerKind = null;
  function openComposer(kind) {
    composerKind = kind;
    closePops();
    const letgo = kind === 'letgo';
    $('compTitle').textContent = letgo ? 'Let something go' : 'Something good';
    $('compBody').textContent = letgo
      ? 'Write down a worry or a thought you are ready to set down. It is not saved anywhere. Then send it off on a lantern.'
      : 'Name one good thing from today, however small. It grows into a glowing flower and stays in your journal.';
    $('compText').placeholder = letgo ? 'One word is enough. So is nothing at all.' : 'The tea was good. A friend called.';
    $('compText').value = '';
    $('compGo').textContent = letgo ? 'Release the lantern' : 'Plant it';
    $('compGo').disabled = !letgo;
    $('composer').hidden = false;
    setTimeout(() => $('compText').focus(), 50);
  }
  function closeComposer() { $('composer').hidden = true; composerKind = null; }
  function submitComposer() {
    const text = $('compText').value.trim();
    if (composerKind === 'letgo') {
      $('compText').value = '';
      closeComposer();
      L.releaseLantern(); A.release();
      journal.lanterns++; saveSoon();
      if (cam.view !== 'dock') setView('dock');
      toast('There it goes.', 4, true);
      return;
    }
    if (!text) return;
    const spot = GD.findFreeGrass(cam.target.x, cam.target.z);
    if (!spot) { toast('There is no free grass left. Tidy something away to make room.', 5, true); return; }
    const r = GD.tryPlace('grat', spot[0], spot[1], { note: text.slice(0, 280) });
    if (!r.ok) { toast(r.msg || 'That did not work. Try again.', 4, true); return; }
    closeComposer();
    A.bloom();
    growing.push({ at: S.t + 7, x: r.rec.x, y: r.rec.y + 0.5, z: r.rec.z, quiet: true });
    cam.tTarget.set(r.rec.x, r.rec.y, r.rec.z);
    if (cam.mode === 'look') setView('island');
    cam.tTarget.set(r.rec.x, r.rec.y, r.rec.z);
    toast('Planted. It glows softly at night. Tap it to read it again.', 5, true);
    saveSoon();
  }
  function showNote(rec) {
    $('noteDate').textContent = rec.at ? U.niceDate(rec.at) : '';
    $('noteText').textContent = rec.note || '';
    $('noteCard').hidden = false;
  }

  // -------------------------------------------------------------------- islands
  function renderIslands() {
    // nearest first, with a rough idea of how long the row is
    const from = W.island, dist = (I) => Math.hypot(I.x - from.x, I.z - from.z);
    const rowLabel = (d) => (d < 75 ? 'A short row' : d < 150 ? 'A gentle row' : 'A long row');
    $('islandList').innerHTML = K.ISLANDS.slice().sort((a, b) => dist(a) - dist(b)).map((I) => {
      const here = I === W.island;
      return `<li class="isle${here ? ' here' : ''}"><span class="opt-name">${I.name}${here ? '' : ` <span class="isle-far">· ${rowLabel(dist(I))}</span>`}</span><span class="opt-sub">${I.line}</span>` +
        (here ? '<span class="isle-here">You are here</span>' : `<span class="isle-go"><button class="btn small" data-row="${I.id}">Row there</button><button class="btn small ghost" data-look="${I.id}">Look now</button></span>`) + '</li>';
    }).join('');
    $$('[data-row]').forEach((b) => b.addEventListener('click', () => rowTo(b.dataset.row)));
    $$('[data-look]').forEach((b) => b.addEventListener('click', () => { closePops(); W.setIsland(b.dataset.look); setView('island'); }));
  }
  function rowTo(id) {
    closePops();
    if (L.trip()) return;
    if (cam.mode === 'look' || cam.view === 'sky') { setView('island'); }
    const tr = L.travel(id);
    if (!tr) return;
    if (SW.walk.active) { SW.walk.hide(true); L.setRower(true); }
    cam.mode = 'follow'; cam.view = 'follow'; cam.fYaw = 0; setViewButtons();
    $('tripText').textContent = 'Rowing to ' + tr.to.name;
    $('tripBar').hidden = false;
    toast('A slow row across. Drag to look around.', 4, true);
  }
  SW.on('arrive', (id) => {
    const I = K.ISLAND[id];
    $('tripBar').hidden = true;
    cam.tTheta = cam.theta = Math.atan2(W.camera.position.z - I.z, W.camera.position.x - I.x);
    if (SW.walk.active) {
      SW.walk.spawn(); SW.walk.hide(false); L.setRower(false);
      cam.mode = 'walk'; cam.view = 'walk'; cam.tR = 9; cam.tPhi = 1.18; cam.blend = 3;
    } else setView('island');
    toast(I.name + '.', 4, true);
    saveSoon();
  });
  SW.on('island', (id) => { if (id !== 'home') SW.emit('see', 'isle-' + id); });

  // ------------------------------------------------------------------- handpan
  const PAN_NOTES = [50, 57, 59, 62, 64, 66, 69, 71, 74];
  const PAN_ANGLES = [90, 135, 45, 180, 0, 225, 315, 270];
  function buildHandpan() {
    $('pan').innerHTML = PAN_NOTES.map((n, i) => {
      const a = i ? PAN_ANGLES[i - 1] * Math.PI / 180 : 0, r = i ? 35 : 0;
      return `<button class="pad${i ? '' : ' ding'}" data-pad="${i}" style="left:${50 + Math.cos(a) * r}%;top:${50 + Math.sin(a) * r}%" aria-label="Note ${i + 1}"><span>${i + 1}</span></button>`;
    }).join('');
    $$('[data-pad]').forEach((b) => b.addEventListener('pointerdown', (e) => { e.preventDefault(); playPad(+b.dataset.pad); }));
  }
  function toggleHandpan(open) {
    const el = $('handpan'), show = open == null ? el.hidden : open;
    el.hidden = !show;
    $('btnPlay').setAttribute('aria-pressed', String(show));
    if (show && !A.on) { setSound(true); toast('Sound is on so you can hear it.', 3, true); }
  }
  function playPad(i) {
    const n = PAN_NOTES[i], a = i ? PAN_ANGLES[i - 1] * Math.PI / 180 : 0;
    A.handpan(n, i ? Math.cos(a) * 0.5 : 0);
    const b = document.querySelector(`[data-pad="${i}"]`);
    if (b) { b.classList.remove('hit'); void b.offsetWidth; b.classList.add('hit'); }
    const F = SW.walk.active ? SW.walk.pos : W.focus;
    W.addRipple(F.x + (Math.random() - 0.5) * 12, F.z + (Math.random() - 0.5) * 12, 0.45);
    L.bloomSparkle(F.x + (Math.random() - 0.5) * 2, F.y + 0.5, F.z + (Math.random() - 0.5) * 2);
    lastInteract = S.t;
  }

  // -------------------------------------------------------------------- sitting
  let sit = null;
  function startSit(min) {
    closePops(); closePanels();
    sit = { end: S.t + min * 60, start: S.t, min };
    document.body.classList.add('sitting');
    $('sitOverlay').hidden = false;
    if (SW.walk.active) { const st = SW.walk.seatNear(SW.walk.pos.x, SW.walk.pos.z, 4); if (st) SW.walk.goSit(st); }
    else if (!L.trip()) setView('dock');
    A.bowl(1);
  }
  function endSit(done) {
    if (!sit) return;
    const mins = Math.max(0, Math.round((S.t - sit.start) / 60));
    journal.sitMinutes += mins;
    const min = sit.min;
    sit = null;
    document.body.classList.remove('sitting');
    $('sitOverlay').hidden = true;
    if (done) A.bowl(2);
    toast(done ? 'Welcome back. You sat for ' + min + ' minute' + (min === 1 ? '' : 's') + '.' : 'Welcome back.', 5, true);
    saveSoon(); wakeHud();
  }

  // ----------------------------------------------------------------- panels
  function closePops() { $$('.pop').forEach((p) => { p.hidden = true; }); $$('[data-pop], [data-popid]').forEach((b) => b.setAttribute('aria-expanded', 'false')); }
  function togglePop(id) {
    const p = $(id), open = p.hidden;
    closePops();
    const btn = document.querySelector(`[data-pop="${id}"], [data-popid="${id}"]`);
    if (open) { p.hidden = false; if (btn) btn.setAttribute('aria-expanded', 'true'); }
  }
  function closePanels() { $$('.panel').forEach((p) => { p.hidden = true; }); }
  function openPanel(id) {
    closePops();
    const p = $(id), open = p.hidden;
    closePanels();
    if (open) {
      p.hidden = false;
      if (id === 'panelJournal') renderJournal();
      if (id === 'panelSettings') syncSettings();
      p.querySelector('.panel-close').focus();
    }
  }
  function renderJournal() {
    const seen = JOURNAL.filter((j) => journal.seen[j.id]).length;
    $('notesCount').textContent = seen + ' of ' + JOURNAL.length + ' seen';
    $('notesGrid').innerHTML = JOURNAL.map((j) => {
      const d = journal.seen[j.id];
      return d
        ? `<li class="note seen"><span class="note-name">${j.name}</span><span class="note-line">${j.line}</span><span class="note-date">First seen ${U.niceDate(d)}</span></li>`
        : `<li class="note"><span class="note-name">Not yet seen</span><span class="note-line">${j.hint}</span></li>`;
    }).join('');
    const notes = GD.items.filter((i) => i.k === 'grat').slice().reverse();
    $('goodList').innerHTML = notes.length
      ? notes.map((n) => `<li><span class="note-date">${n.at ? U.niceDate(n.at) : ''}</span><span class="good-text"></span></li>`).join('')
      : '<li class="empty">Nothing here yet. Choose Rituals, then Something good, to plant the first one.</li>';
    if (notes.length) $$('#goodList .good-text').forEach((el, i) => { el.textContent = notes[i].note; });
    const st = [];
    if (journal.sitMinutes) st.push(journal.sitMinutes + ' minute' + (journal.sitMinutes === 1 ? '' : 's') + ' sitting');
    if (journal.lanterns) st.push(journal.lanterns + ' lantern' + (journal.lanterns === 1 ? '' : 's') + ' let go');
    if (journal.wishes) st.push(journal.wishes + ' wish' + (journal.wishes === 1 ? '' : 'es'));
    $('statsLine').textContent = st.length ? st.join(' · ') : '';
  }
  function setTab(name) {
    $$('#panelJournal [role=tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === name)));
    $$('#panelJournal [role=tabpanel]').forEach((p) => { p.hidden = p.id !== 'tab-' + name; });
  }

  // --------------------------------------------------------------- settings
  const seg = (name, val) => $$(`[data-${name}]`).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset[name] === String(val))));
  function syncSettings() {
    seg('flow', prefs.flow); seg('season', prefs.season); seg('weather', prefs.weather); seg('quality', prefs.quality);
    $('optDrift').checked = prefs.drift; $('optCalm').checked = prefs.calm; $('optDof').checked = prefs.dof !== false;
    syncClock();
  }
  function syncClock() {
    $('todSlider').value = Math.round(U.hourOf(S.tod) * 4);
    $('todLabel').textContent = U.clockLabel(S.tod) + ' · ' + U.seasonName(S.season + 0.15) + ', day ' + (Math.floor(S.day) + 1);
  }
  function renderBreathPop() {
    $('patternList').innerHTML = Object.entries(PATTERNS).map(([k, p]) =>
      `<button class="opt" data-pattern="${k}" aria-pressed="${prefs.pattern === k}"><span class="opt-name">${p.name}</span><span class="opt-sub">${p.sub}</span></button>`).join('');
    $$('[data-pattern]').forEach((b) => b.addEventListener('click', () => {
      prefs.pattern = b.dataset.pattern; patternT0 = S.t; saveSoon(); renderBreathPop();
    }));
    $('optGuide').checked = prefs.guide;
  }
  function renderSoundPop() {
    const names = { waves: 'Waves', wind: 'Wind', rain: 'Rain', wildlife: 'Birds and animals', insects: 'Frogs and crickets', fire: 'Fire', chimes: 'Chimes', music: 'Music', falls: 'Waterfall and springs', steps: 'Footsteps' };
    $('mixer').innerHTML = A.CHANNELS.map((c) => `<label class="mix"><span>${names[c]}</span><input type="range" min="0" max="100" value="${Math.round((prefs.levels[c] ?? 0.8) * 100)}" data-ch="${c}" aria-label="${names[c]} volume"></label>`).join('');
    $$('[data-ch]').forEach((r) => r.addEventListener('input', () => { const v = r.value / 100; prefs.levels[r.dataset.ch] = v; A.setChannel(r.dataset.ch, v); saveSoon(); }));
    $('master').value = Math.round(prefs.master * 100);
    $('soundToggle').setAttribute('aria-pressed', String(A.on));
    $('soundToggle').textContent = A.on ? 'Sound is on' : 'Sound is off';
  }
  function setSound(on) {
    const ok = A.setOn(on);
    if (ok && on) { A.setMaster(prefs.master); A.CHANNELS.forEach((c) => A.setChannel(c, prefs.levels[c] ?? 0.8)); }
    $('btnSound').setAttribute('aria-pressed', String(A.on));
    if (!$('popSound').hidden) renderSoundPop();
  }

  // -------------------------------------------------------------------- tutorial
  function tutorialStep(n) {
    prefs.tutorial = n; saveSoon();
    if (n === 1) toast('Now tap the water to drop a pebble. The koi come to look.', 6, true);
    if (n === 2) { toast('Visitors you meet are kept in your Journal. When you feel like it, open Islands and row somewhere new.', 8, true); prefs.tutorial = 3; prefs.islandsHint = true; }
  }

  // ---------------------------------------------------------------------- HUD
  let hudTimer = 0;
  function wakeHud() {
    hudTimer = 7;
    $('hud').classList.remove('quiet');
    $('sitOverlay').classList.add('awake');
    $('zenShow').classList.add('awake');
    clearTimeout(wakeHud.t);
    wakeHud.t = setTimeout(() => { $('sitOverlay').classList.remove('awake'); $('zenShow').classList.remove('awake'); }, 3000);
  }
  let overlays = null;
  function anyOpen() {
    overlays = overlays || $$('.pop, .panel').concat($('composer'));
    return !!openCat || overlays.some((p) => !p.hidden);
  }

  function begin(withSound) {
    if (S.started) return;
    S.started = true;
    $('intro').classList.add('gone');
    setTimeout(() => { $('intro').hidden = true; }, 2300);
    $('hud').hidden = false;
    wakeHud();
    if (withSound) setSound(true);
    $('breath').classList.toggle('off', !prefs.guide);
    if (prefs.tutorial === 0) setTimeout(() => toast('Tap the grass to plant. Choose what to plant from the tray below.', 8, true), 1800);
    else setTimeout(() => toast('Welcome back. ' + U.seasonName(S.season + 0.15) + ', ' + U.clockLabel(S.tod) + '.', 4), 1500);
    if (prefs.tutorial > 0 && !prefs.islandsHint) { prefs.islandsHint = true; prefs.walkHint = true; setTimeout(() => toast('The sea has opened up. Ten more islands are out there; open Islands to row to one, and Walk to explore on foot.', 9), 6000); }
    else if (prefs.tutorial > 0 && !prefs.walkHint) { prefs.walkHint = true; setTimeout(() => toast('New: four more islands, and you can walk them. Try Walk.', 8), 6000); }
  }

  function bindUI() {
    $('beginSound').addEventListener('click', () => begin(true));
    $('beginQuiet').addEventListener('click', () => begin(false));
    $$('.cat').forEach((b) => b.addEventListener('click', () => {
      openCat = openCat === b.dataset.cat ? null : b.dataset.cat;
      closePops(); renderDrawer(); renderCats();
    }));
    $$('[data-pop]').forEach((b) => b.addEventListener('click', () => {
      if (b.dataset.pop === 'popSound') renderSoundPop();
      if (b.dataset.pop === 'popBreath') renderBreathPop();
      togglePop(b.dataset.pop);
    }));
    $('btnJournal').addEventListener('click', () => openPanel('panelJournal'));
    $('btnIslands').addEventListener('click', () => { renderIslands(); togglePop('popIslands'); });
    $('tripSkip').addEventListener('click', () => L.arriveNow());
    $('btnWalk').addEventListener('click', () => { closePops(); if (SW.walk.active) stopWalking(); else startWalking(); });
    $('btnPlay').addEventListener('click', () => { closePops(); toggleHandpan(); });
    $('panClose').addEventListener('click', () => toggleHandpan(false));
    buildHandpan();
    $('btnSettings').addEventListener('click', () => openPanel('panelSettings'));
    $$('.panel-close').forEach((b) => b.addEventListener('click', () => { closePanels(); }));
    $$('#panelJournal [role=tab]').forEach((b) => b.addEventListener('click', () => setTab(b.dataset.tab)));
    $('btnHide').addEventListener('click', () => { closePops(); closePanels(); openCat = null; renderDrawer(); renderCats(); document.body.classList.add('zen'); wakeHud(); });
    $('zenShow').addEventListener('click', () => { document.body.classList.remove('zen'); wakeHud(); });
    $('optGuide').addEventListener('change', (e) => { prefs.guide = e.target.checked; $('breath').classList.toggle('off', !prefs.guide); $('btnBreath').setAttribute('aria-pressed', String(prefs.guide)); saveSoon(); });
    $('soundToggle').addEventListener('click', () => { setSound(!A.on); renderSoundPop(); });
    $('btnSound').addEventListener('dblclick', () => setSound(!A.on));
    $('master').addEventListener('input', (e) => { prefs.master = e.target.value / 100; A.setMaster(prefs.master); if (prefs.master > 0 && !A.on) setSound(true); saveSoon(); });
    $$('#popView [data-view]').forEach((b) => b.addEventListener('click', () => { setView(b.dataset.view); closePops(); }));
    $$('#popSit [data-min]').forEach((b) => b.addEventListener('click', () => startSit(+b.dataset.min)));
    $('sitEnd').addEventListener('click', () => endSit(false));
    $('compGo').addEventListener('click', submitComposer);
    $('compCancel').addEventListener('click', closeComposer);
    $('compText').addEventListener('input', () => { if (composerKind === 'grateful') $('compGo').disabled = !$('compText').value.trim(); });
    $('compText').addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submitComposer(); });
    $('noteClose').addEventListener('click', () => { $('noteCard').hidden = true; });
    $$('[data-flow]').forEach((b) => b.addEventListener('click', () => { prefs.flow = b.dataset.flow; seg('flow', prefs.flow); saveSoon(); }));
    $$('[data-season]').forEach((b) => b.addEventListener('click', () => { prefs.season = b.dataset.season; seg('season', prefs.season); saveSoon(); }));
    $$('[data-weather]').forEach((b) => b.addEventListener('click', () => { prefs.weather = b.dataset.weather; W.setWeatherMode(prefs.weather); seg('weather', prefs.weather); saveSoon(); }));
    $$('[data-quality]').forEach((b) => b.addEventListener('click', () => { prefs.quality = b.dataset.quality; prefs.qualityChosen = true; W.setQuality(prefs.quality); seg('quality', prefs.quality); saveSoon(); }));
    $('todSlider').addEventListener('input', (e) => { S.tod = U.todOf(e.target.value / 4); syncClock(); });
    $('optDrift').addEventListener('change', (e) => { prefs.drift = e.target.checked; saveSoon(); });
    $('optDof').addEventListener('change', (e) => { prefs.dof = e.target.checked; SW.post.dof = prefs.dof; saveSoon(); });
    $('optCalm').addEventListener('change', (e) => { prefs.calm = e.target.checked; S.reduceMotion = prefs.calm || reduceMQ; saveSoon(); });
    const resetRow = $('resetRow');
    const resetIdle = () => {
      resetRow.innerHTML = '<button id="resetAsk" class="btn">Start a fresh island</button>';
      $('resetAsk').addEventListener('click', () => {
        resetRow.innerHTML = '<span>Clear every plant and decoration and start again from the first few trees? Your field notes stay.</span><button id="resetYes" class="btn">Clear the island</button><button id="resetNo" class="btn">Keep my garden</button>';
        $('resetYes').addEventListener('click', () => { GD.reset(GD.starter(), []); saveNow(); resetIdle(); toast('A fresh start.', 3, true); });
        $('resetNo').addEventListener('click', resetIdle);
        $('resetNo').focus();
      });
    };
    resetIdle();
    window.addEventListener('pointermove', wakeHud, { passive: true });
    window.addEventListener('keydown', (e) => {
      wakeHud();
      if (e.key === 'Escape') {
        if (!$('composer').hidden) closeComposer();
        else if (!$('noteCard').hidden) $('noteCard').hidden = true;
        else if (sit) endSit(false);
        else if (document.body.classList.contains('zen')) document.body.classList.remove('zen');
        else { closePops(); closePanels(); openCat = null; renderDrawer(); renderCats(); }
        return;
      }
      if (!S.started || /INPUT|TEXTAREA/.test(e.target.tagName) || e.metaKey || e.ctrlKey || e.altKey) return;
      const key = e.key.toLowerCase();
      if (key === 'b') { prefs.guide = !prefs.guide; $('optGuide').checked = prefs.guide; $('breath').classList.toggle('off', !prefs.guide); $('btnBreath').setAttribute('aria-pressed', String(prefs.guide)); }
      if (key === 'm') setSound(!A.on);
      if (key === 'h') { if (document.body.classList.toggle('zen')) { closePops(); closePanels(); } }
      if (key === 'j') openPanel('panelJournal');
      if (key === 'i') { renderIslands(); togglePop('popIslands'); }
      if (!$('handpan').hidden && /^[1-9]$/.test(key)) { playPad(+key - 1); return; }
      if (key === 'v') { const vs = Object.keys(VIEWS); setView(vs[(vs.indexOf(cam.view) + 1) % vs.length]); toast(VIEWS[cam.view], 2, true); }
    });
  }

  // -------------------------------------------------------------------- loop
  let last = performance.now(), clockSync = 0, seasonShown = -1, lastHudH = 0, lastW = 0, lastH = 0, lastRing = '';
  const el = {};   // elements touched every frame, looked up once
  function frame() {
    const now = performance.now(), dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    S.dt = dt; S.t += dt;
    const t = S.t;
    if (window.innerWidth !== lastW || window.innerHeight !== lastH) { lastW = window.innerWidth; lastH = window.innerHeight; W.resize(); }
    const rate = prefs.flow === 'slow' ? 0.4 : prefs.flow === 'still' ? 0 : 1, dd = dt * rate / K.DAY_LEN;
    S.tod = (S.tod + dd) % 1; S.day += dd;
    if (prefs.season === 'auto') S.season = (S.season + dd) % 4;
    else {
      let d = (+prefs.season + 0.45) - S.season;
      d = ((d % 4) + 6) % 4 - 2;
      S.season = ((S.season + d * (1 - Math.exp(-dt / 3))) % 4 + 4) % 4;
    }
    updateBreath(t);
    W.update(dt);
    GD.update(t, dt);
    L.update(dt, t);
    SW.walk.update(dt, t, cam.theta);   // before the camera, so the walk camera never trails a frame behind
    updateCamera(dt, t);
    let fire = 0;
    for (const f of GD.feat.fire) fire = Math.max(fire, U.clamp(1 - (W.camera.position.distanceTo(tmpFire.set(f.x, f.y, f.z)) - 8) / 45, 0, 1));
    const ear = SW.walk.active ? SW.walk.pos : W.camera.position;
    const falls = U.clamp(1 - (ear.distanceTo(W.waterfall) - 6) / 55, 0, 1), springs = U.clamp(1 - (ear.distanceTo(W.springs) - 5) / 28, 0, 1);
    A.update({ fire, chimes: GD.feat.chime.length, trees: GD.feat.tree.length, falls, springs });
    for (let i = growing.length - 1; i >= 0; i--) {
      const g = growing[i];
      if (t < g.at) continue;
      if (!g.quiet) A.bloom();
      L.bloomSparkle(g.x, g.y, g.z);
      growing.splice(i, 1);
    }
    // breath guide
    if (prefs.guide && S.started) {
      const B = S.breath;
      const sc = 'scale(' + (0.55 + 0.45 * B.b).toFixed(3) + ')';
      if (sc !== lastRing) { lastRing = sc; el.ring.style.transform = sc; }
      if (el.word.textContent !== B.label) el.word.textContent = B.label;
      const c = String(Math.max(1, Math.ceil(B.left)));
      if (el.count.textContent !== c) el.count.textContent = c;
    }
    if (S.started && hudTimer > 0 && !sit && !anyOpen()) { hudTimer -= dt; if (hudTimer <= 0) el.hud.classList.add('quiet'); }
    if (sit) {
      const left = Math.max(0, sit.end - t), m = Math.floor(left / 60), s = Math.floor(left % 60);
      const txt = m + ':' + String(s).padStart(2, '0') + ' left';
      if (el.sitLeft.textContent !== txt) el.sitLeft.textContent = txt;
      if (left <= 0) endSit(true);
    }
    updateToast();
    flushSeen(dt);
    watchFrameRate(now, dt);
    clockSync -= dt;
    if (clockSync <= 0) {
      clockSync = 0.5;
      const hh = $('hud').offsetHeight;
      if (hh && hh !== lastHudH) { lastHudH = hh; document.documentElement.style.setProperty('--hud-h', hh + 'px'); }
      if (!$('panelSettings').hidden && document.activeElement !== $('todSlider')) syncClock();
      const si = U.seasonIndex(S.season + 0.15);
      if (S.started && seasonShown !== -1 && si !== seasonShown && prefs.season === 'auto') toast(U.seasonName(S.season + 0.15) + ' is coming to the island.', 5);
      seasonShown = si;
    }
    if (S.started && now - lastSave > 8000) { lastSave = now; saveNow(); }
    W.render();
  }
  const tmpFire = new THREE.Vector3();
  // When frames run long, first lower the drawing resolution a step at a time; if that is not enough, step
  // the graphics down a level. Resolution comes back when there is room again. A quality the player picked
  // in Settings is left alone.
  let perfT = 0, perfFrames = 0, perfSlow = 0, perfFast = 0, perfSkip = 0, upBlockedUntil = 0, lastUpAt = -1e9;
  function watchFrameRate(now, dt) {
    if (!S.started || prefs.qualityChosen || prefs.quality === 'low' || document.hidden) { perfT = 0; perfFrames = 0; return; }
    perfT += dt; perfFrames++;
    if (perfT < 2) return;
    const ms = perfT / perfFrames * 1000;
    perfT = 0; perfFrames = 0;
    if (perfSkip > 0) { perfSkip--; return; }   // the window after a change includes its own hitch
    const minScale = U.clamp(0.95 / (W.basePixelRatio || 1), 0.6, 0.85);
    if (ms > 22) {
      perfFast = 0;
      if (now - lastUpAt < 15000) upBlockedUntil = now + 90000;   // it just went up and could not hold it
      if (W.renderScale > minScale + 0.01) { W.setRenderScale(Math.max(minScale, W.renderScale * 0.85)); perfSkip = 1; }
    } else if (ms < 17.5 && W.renderScale < 1 && now > upBlockedUntil) {
      if (++perfFast >= 4) { perfFast = 0; lastUpAt = now; W.setRenderScale(Math.min(1, W.renderScale * 1.12)); perfSkip = 1; }
    } else perfFast = 0;
    perfSlow = ms > 42 ? perfSlow + 1 : 0;
    if (perfSlow >= 3 && (W.renderScale <= minScale + 0.01 || perfSlow >= 5)) {
      perfSlow = 0; perfSkip = 1;
      prefs.quality = prefs.quality === 'high' ? 'balanced' : 'low';
      W.setQuality(prefs.quality);
      toast('Switched to ' + (prefs.quality === 'balanced' ? 'Balanced' : 'Light') + ' graphics to keep things smooth. You can change this in Settings.', 6);
      saveSoon();
    }
  }
  const reduceMQ = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  // -------------------------------------------------------------------- boot
  function noGL(msg) {
    $('introFine').textContent = msg;
    $('introFine').classList.add('nogl');
    $('beginSound').disabled = true; $('beginQuiet').disabled = true;
  }
  function boot(data) {
    if (!window.THREE) { noGL('The 3D library did not load. Check your connection and reload.'); return; }
    W = SW.world; GD = SW.garden; L = SW.life; A = SW.audio;
    S.quality = prefs.quality; S.reduceMotion = reduceMQ || prefs.calm;
    const ws = (data && data.world) || SW.store.get('world', null);
    if (ws) { S.tod = ws.tod; S.day = ws.day; S.season = ws.season; S.island = K.ISLAND[ws.island] ? ws.island : 'home'; }
    try { W.init(); } catch (e) { noGL('Stillwater needs WebGL, which this browser has turned off.'); return; }
    GD.init(); L.init(); SW.walk.init();
    SW.post.dof = prefs.dof !== false;
    A.master = prefs.master;
    A.CHANNELS.forEach((c) => { A.levels[c] = prefs.levels[c] ?? 0.8; });
    W.setWeatherMode(prefs.weather);
    let items = data && data.items;
    if (!items) items = SW.store.get('garden2', null);
    if (!items) { const v1 = SW.store.get('garden.v1', null); if (Array.isArray(v1) && v1.length) items = v1.map((r, i) => Object.assign({ id: i + 1 }, r)); }
    GD.reset(items && items.length ? items : GD.starter(), (data && data.wildGone) || SW.store.get('wildGone', []));
    W.setIsland(S.island);
    bindInput(); bindUI();
    renderCats();
    $('btnBreath').setAttribute('aria-pressed', String(prefs.guide));
    W.resize();
    setView('island', true);
    Object.assign(el, { ring: $('ring'), word: $('word'), count: $('count'), hud: $('hud'), sitLeft: $('sitLeft') });
    try { W.warmUp(); } catch (e) { console.warn(e); }
    W.ready = true;
    // If the full renderer leaves parts of the scene undrawn on this device (see the self-check in post.js),
    // fall back to the simple one and say so, rather than show a broken picture.
    SW.post.onBroken = (empty) => {
      if (S.quality === 'low') return;
      console.warn('Stillwater: ' + empty + ' of 64 sample points were left undrawn; switching to Light graphics.');
      prefs.quality = 'low';
      W.setQuality('low'); seg('quality', 'low'); saveSoon();
      toast('Parts of the scene were not drawing properly on this device, so the game has switched to Light graphics. You can try the others again in Settings.', 9);
    };
    W.renderer.setAnimationLoop(frame);
    if (data && data.started) begin(false);
  }
  SW.ui = { setView: (v, instant) => setView(v, instant), toast, camera: cam, rowTo: (id) => rowTo(id), tick: (dt) => updateCamera(dt, S.t), walk: () => startWalking(), handpan: (i) => playPad(i) };
  const hot = window.claude && window.claude.hot;
  if (hot && hot.snapshot) hot.snapshot(() => ({ items: GD ? GD.serialize() : null, wildGone: GD ? GD.wildGone() : null, world: { tod: S.tod, day: S.day, season: S.season, island: S.island }, started: S.started }));
  const start = (data) => { try { boot(data || {}); } catch (e) { console.error(e); noGL('Something went wrong while starting. Reload to try again.'); } };
  if (hot && hot.ready) hot.ready(start); else start((hot && hot.data) || {});
})(window.SW);
