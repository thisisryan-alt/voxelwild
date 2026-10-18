// Mouse attacks in the real page, driven with real Playwright mouse events over the scaled canvas: left click claws toward the pointer, hold keeps
// chaining, right click is a charged heavy, middle click dashes toward the pointer, the context menu stays shut, the keyboard still works and the
// Mouse attacks option turns it all off. OUT prefix for shots. Run: node tools/run.mjs tests/scripts/mouse.mjs
export default async (page, H) => {
  const out = process.env.OUT || '/tmp/ms';
  await H.load('?manual=1'); await H.adv(30);
  await H.eval(() => {
    const g = window.__game, s = g.state; s.form = 'warrior'; s.branches = { warrior: 'bulwark' }; s.level = 12;
    g.buildWorld('reef_garden', undefined, { silentBanner: true }); g.systems.story.queue.length = 0; g.world.enemies.length = 0; g.systems.achievements.timer = -999;
    const p = g.world.player; p.invulnT = 9999; p.vx = p.vy = 0; g.world.snapCamera();
  });
  await H.adv(40);
  const log = [];
  // where the canvas sits on the page, and where a game pixel lands on it
  const rect = await H.eval(() => { const r = document.getElementById('game').getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
  const at = (gx, gy) => [rect.x + gx * rect.w / 480, rect.y + gy * rect.h / 270];
  const me = () => H.eval(() => { const w = window.__game.world, p = w.player; return { facing: p.facing, state: p.state, x: Math.round(p.x), sx: Math.round(p.x - w.cam.x), sy: Math.round(p.y - w.cam.y), atk: p.atk && { heavy: p.atk.heavy, i: p.atk.i }, hitboxes: w.hitboxes.filter((h) => h.team === 'player').length, dashing: p.state === 'dash' }; });
  const settle = async () => { await H.adv(90); await H.eval(() => { const p = window.__game.world.player; p.vx = p.vy = 0; }); };
  const m0 = await me(); log.push(['start', m0]);
  // the crab starts near the left edge of the zone, so pointers 'to the left' stay inside the canvas
  const L = (sx) => Math.max(6, sx - 60), R = (sx) => Math.min(474, sx + 90);

  // the pointer is mapped through the scaled canvas: the crab's own screen position reads back as itself
  await page.mouse.move(...at(m0.sx, m0.sy)); await H.adv(1);
  log.push(['pointer over the crab', await H.eval(() => ({ x: Math.round(window.__game.input.mouse.x), y: Math.round(window.__game.input.mouse.y), active: window.__game.input.mouseActive() }))]);

  // a left click to the LEFT turns the crab and swings that way
  await H.eval(() => { window.__game.world.player.facing = 1; });
  await page.mouse.move(...at(L(m0.sx), m0.sy)); await page.mouse.down(); await H.adv(4);
  const l = await me(); await H.canvas(`${out}_left.png`); await page.mouse.up(); await H.adv(30); log.push(['left click, pointer on the left', l]); await settle();
  // ... and to the RIGHT swings right
  await H.eval(() => { window.__game.world.player.facing = -1; });
  await page.mouse.move(...at(R(m0.sx), m0.sy)); await page.mouse.down(); await H.adv(4);
  const r = await me(); await page.mouse.up(); await H.adv(30); log.push(['left click, pointer on the right', r]); await settle();

  // the claw lands on a foe on the pointer's side
  const dmg = await H.eval(async () => {
    const g = window.__game, w = g.world, p = w.player; const { Enemy } = await import('/src/entities/enemy.js');
    p.facing = 1; const e = new Enemy(w, 'pinchling', p.x - 24, p.y, {}); e.hp = e.maxHp = 500; e.state = 'idle'; e.a.cd = 999; w.enemies.push(e); window.__foe = e; return e.hp;
  });
  const sx = (await me()).sx, sy = (await me()).sy;
  await page.mouse.move(...at(L(sx), sy)); await page.mouse.down(); await H.adv(20); await page.mouse.up(); await H.adv(20);
  log.push(['hit a foe to the left', await H.eval((d) => ({ hurt: d - window.__foe.hp > 0, facing: window.__game.world.player.facing }), dmg)]);
  await H.eval(() => { const w = window.__game.world; w.enemies.length = 0; w.player.vx = 0; }); await settle();

  // holding left chains the combo without more clicks
  const comboBefore = await H.eval(() => window.__game.state.records.hits ?? 0);
  await page.mouse.move(...at(R(sx), sy)); await page.mouse.down();
  const steps = new Set(); for (let k = 0; k < 24; k++) { await H.adv(6); const a = await H.eval(() => { const p = window.__game.world.player; return p.atk ? p.atk.i : -1; }); if (a >= 0) steps.add(a); }
  await page.mouse.up(); await H.adv(40);
  log.push(['held left, combo steps seen', [...steps].sort()]); await settle();

  // right click: a charged heavy; it keeps aiming while it charges
  await H.eval(() => { window.__game.world.player.facing = 1; });
  await page.mouse.move(...at(L(sx), sy)); await page.mouse.down({ button: 'right' }); await H.adv(10);
  const charging = await me(); await page.mouse.move(...at(R(sx), sy)); await H.adv(6); const turned = await me(); await page.mouse.up({ button: 'right' }); await H.adv(14);
  log.push(['right click charges', { state: charging.state, facingWhileLeft: charging.facing, facingAfterMove: turned.facing, struck: (await me()).atk?.heavy ?? 'done' }]); await settle();

  // middle click dashes toward the pointer when no direction is held
  await H.eval(() => { const p = window.__game.world.player; p.facing = 1; p.dashCd = 0; });
  const x0 = (await me()).x; await page.mouse.move(...at(L(sx), sy)); await page.mouse.down({ button: 'middle' }); await H.adv(5); const mid = await me(); await page.mouse.up({ button: 'middle' }); await H.adv(8);
  const d = await me(); log.push(['middle click dash', { dashingMidPress: mid.dashing, moved: d.x - x0, facing: d.facing }]); await settle();

  // the context menu never opens on the canvas, and a middle click does not scroll the page
  const prevented = await H.eval(() => { const c = document.getElementById('game'); const ev = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2 }); return !c.dispatchEvent(ev); });
  log.push(['contextmenu prevented', prevented, 'cursor', await H.eval(() => document.getElementById('game').style.cursor)]);

  // the keyboard is untouched
  await H.eval(() => { window.__game.world.player.facing = 1; }); await page.keyboard.down('KeyJ'); await H.adv(6); await page.keyboard.up('KeyJ');
  log.push(['keyboard J still claws', await H.eval(() => ({ state: window.__game.world.player.state, facing: window.__game.world.player.facing }))]); await settle();

  // a parked pointer on the left does not turn a keyboard attack
  await page.mouse.move(...at(5, 135)); await H.adv(400); await H.eval(() => { window.__game.world.player.facing = 1; });
  await page.keyboard.down('KeyJ'); await H.adv(4); await page.keyboard.up('KeyJ');
  log.push(['keyboard attack with a stale pointer', await H.eval(() => window.__game.world.player.facing)]); await settle();

  // the option: Mouse attacks off ignores the buttons
  await H.eval(() => { window.__game.state.settings.mouseAttack = 0; window.__game.world.player.facing = 1; }); await H.adv(1); // the option is read once per frame
  await page.mouse.move(...at(L(sx), sy)); await page.mouse.down(); await H.adv(10); const off = await me(); await page.mouse.up();
  log.push(['mouse attacks off', { state: off.state, facing: off.facing }]); await settle();
  await H.eval(() => { window.__game.state.settings.mouseAttack = 1; });

  // the controls screen shows the mouse buttons and can bind one
  await H.eval(() => { const g = window.__game; return import('/src/ui/controls_scene.js').then((m) => g.engine.push(new m.ControlsScene(g))); });
  await H.adv(10); await H.canvas(`${out}_controls.png`);
  log.push(['controls labels', await H.eval(async () => { const { keyLabel } = await import('/src/core/keymap.js'); const { KEYMAP } = await import('/src/core/input.js'); return { attack: KEYMAP.attack.map(keyLabel), heavy: KEYMAP.heavy.map(keyLabel), dash: KEYMAP.dash.map(keyLabel) }; })]);
  for (const l2 of log) console.log('[t]', JSON.stringify(l2));
  // the script fails (exit code 1) when any of these does not hold
  const by = (name) => log.find((e) => e[0] === name)[1];
  const checks = [
    ['pointer maps through the scaled canvas', Math.abs(by('pointer over the crab').x - m0.sx) <= 1 && Math.abs(by('pointer over the crab').y - m0.sy) <= 1 && by('pointer over the crab').active],
    ['left click with the pointer on the left swings left', by('left click, pointer on the left').facing === -1 && by('left click, pointer on the left').state === 'attack'],
    ['left click with the pointer on the right swings right', by('left click, pointer on the right').facing === 1 && by('left click, pointer on the right').state === 'attack'],
    ['the claw hurts a foe on the pointer side', by('hit a foe to the left').hurt && by('hit a foe to the left').facing === -1],
    ['holding left chains the combo', by('held left, combo steps seen').length >= 3],
    ['right click charges, keeps aiming while it charges, then strikes', by('right click charges').state === 'charge' && by('right click charges').facingWhileLeft === -1 && by('right click charges').facingAfterMove === 1 && by('right click charges').struck === true],
    ['middle click dashes toward the pointer', by('middle click dash').dashingMidPress && by('middle click dash').moved < -10 && by('middle click dash').facing === -1],
    ['the context menu is blocked on the canvas', log.find((e) => e[0] === 'contextmenu prevented')[1] === true],
    ['the keyboard still claws', by('keyboard J still claws').state === 'attack'],
    ['a stale pointer does not turn a keyboard attack', by('keyboard attack with a stale pointer') === 1],
    ['Mouse attacks off ignores the buttons', by('mouse attacks off').state === 'free'],
    ['the controls screen labels the mouse buttons', by('controls labels').attack.includes('LMB') && by('controls labels').heavy.includes('RMB') && by('controls labels').dash.includes('MMB')],
  ];
  for (const [name, pass] of checks) { console.log('[t]', pass ? 'PASS' : 'FAIL', name); if (!pass) process.exitCode = 1; }
};
