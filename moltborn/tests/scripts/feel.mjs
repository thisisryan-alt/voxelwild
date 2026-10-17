// Feel systems: controls rebinding, audio feel events, haptics log, camera punch, footsteps/landing events.
export default async (page, H) => {
  await H.load('?manual=1'); await H.adv(30);
  const r = await H.eval(async () => {
    const g = window.__game, out = {}; const km = await import('/src/core/keymap.js'); const { KEYMAP } = await import('/src/core/input.js');
    // rebinding
    const before = [...KEMAPCOPY()];
    function KEMAPCOPY() { return KEYMAP.attack; }
    out.attackBefore = [...KEYMAP.attack];
    out.r1 = km.setBinding(g.input, 'attack', 0, 'KeyG');
    out.attackAfter = [...KEYMAP.attack]; out.revG = g.input.reverse.get('KeyG');
    out.r2 = km.setBinding(g.input, 'heavy', 0, 'KeyG'); out.attackSteal = [...KEYMAP.attack]; out.heavy = [...KEYMAP.heavy];
    out.reserved = km.setBinding(g.input, 'dash', 0, 'Escape');
    out.diff = Object.keys(km.diffKeymap());
    km.resetKeymap(g.input); out.reset = JSON.stringify(KEYMAP.attack) + JSON.stringify(KEYMAP.heavy); out.diffAfter = Object.keys(km.diffKeymap()).length;
    // controls scene
    const { ControlsScene } = await import('/src/ui/controls_scene.js'); g.engine.push(new ControlsScene(g)); g.advance(3);
    g.input.codeEdge.add('Enter'); g.advance(1); out.wait = g.engine.top.wait;
    g.input.codeEdge.add('KeyH'); g.input.lastCode = 'KeyH'; g.engine.step(1 / 60); out.bound = [...KEYMAP.left]; g.engine.pop();
    km.resetKeymap(g.input);
    // footsteps + landing events
    const ev = { step: 0, land: 0 }; g.events.on('footstep', () => ev.step++); g.events.on('land', () => ev.land++);
    const p = g.world.player; p.x += 0; g.input.inject('right', true); g.advance(180); g.input.inject('right', false); out.steps = ev.step;
    p.vy = 220; p.y -= 20; g.advance(60); out.landEv = ev.land;
    // haptics
    g.state.settings.haptics = 0.8; g.systems.haptics.last = 0; g.systems.haptics.rumble(0.6, 100); out.haptic = g.systems.haptics.log.length; g.state.settings.haptics = 0; g.systems.haptics.last = 0; g.systems.haptics.rumble(0.6, 100); out.hapticOff = g.systems.haptics.log.length; g.state.settings.haptics = 0.8;
    // camera punch
    g.systems.post.zoom = 0; g.systems.post.zoomV = 0; g.systems.post.punch(0.05); g.advance(4); out.zoomUp = g.systems.post.zoom > 0.003; g.advance(120); out.zoomSettled = Math.abs(g.systems.post.zoom) < 0.004;
    g.state.settings.reduceMotion = 1; g.systems.post.punch(0.05); g.advance(4); out.zoomCalm = g.systems.post.zoom < 0.003; g.state.settings.reduceMotion = 0;
    // muffling follows depth
    g.advance(120); out.muffle = +g.systems.audiofeel.muffle.toFixed(3);
    return out;
  });
  console.log('[t]', JSON.stringify(r));
};
