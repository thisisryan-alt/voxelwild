// Contextual tutorial tips: shown once per save when the player runs into the situation they teach.
const TIPS = {
  stroke: { msg: 'Blocked? Press SPACE again in mid-air to paddle higher.', test: (c) => c.stuck > 0.5 && c.p.onGround && !c.free },
  claw: { msg: 'Press J to pinch. Chain J J for a combo; hold K for a heavy strike.', test: (c) => c.nearEnemy < 70 },
  tuck: { msg: 'Hold SHIFT to tuck into your shell. Tap it just before a hit to parry.', test: (c) => c.p.state === 'hurt' },
  heal: { msg: 'Low on health? Press F to use a kelp wrap.', test: (c) => c.p.hp < c.p.stats.maxHp * 0.4 && (c.g.state.inv.kelp_wrap > 0 || c.g.state.inv.brine_tonic > 0) },
  dash: { msg: 'Press L to dash. You are untouchable for an instant.', test: (c) => c.g.state.level >= 2 },
  ability: { msg: 'You learned an ability. Press 1 to use it; it spends Tide.', test: (c) => c.g.state.slots?.[0] && c.g.state.stats.kills > 0 },
  map: { msg: 'Lost? Press M for the map, TAB for quests and gear.', test: (c) => Object.keys(c.g.state.visited || {}).length >= 3 },
  skill: { msg: 'You have skill points. Open the menu (TAB) to spend them.', test: (c) => c.g.state.sp > 0 },
};
export class Tips {
  constructor(game) { this.g = game; this.cur = null; this.stuck = 0; this.lastX = 0; this.quiet = 8; game.systems.tips = this; }
  update(dt) {
    const g = this.g, w = g.world, p = w?.player; if (!p || p.dead || !p.alive) return;
    if (w.boss?.engaged || g.playScene?.dialogue?.active) return;
    this.quiet -= dt;
    if (this.cur) { this.cur.t += dt; if (this.cur.t > 4.5) { this.cur = null; this.quiet = 25; } return; }
    if (this.quiet > 0) return;
    const held = g.input.held; const dir = (held.right ? 1 : 0) - (held.left ? 1 : 0);
    this.stuck = dir && Math.abs(p.x - this.lastX) < 0.05 ? this.stuck + dt : 0; this.lastX = p.x;
    let nearEnemy = 999; for (const e of w.enemies) if (!e.dead && !e.def?.friendly) nearEnemy = Math.min(nearEnemy, Math.hypot(e.x - p.x, e.y - p.y));
    const c = { g, p, stuck: this.stuck, nearEnemy, free: p.free };
    const seen = (g.state.tips ||= {});
    for (const [k, tip] of Object.entries(TIPS)) {
      if (seen[k] || !tip.test(c)) continue;
      if (k === 'dash' && g.state.level < 2) continue;
      seen[k] = true; this.cur = { msg: tip.msg, t: 0 }; break;
    }
  }
  draw(ctx, panel, text, textWidth) {
    const c = this.cur; if (!c) return;
    const a = Math.min(1, (4.5 - c.t) * 2, c.t * 4), tw = textWidth(c.msg) + 14, y = 222;
    ctx.globalAlpha = a; panel(ctx, 240 - tw / 2, y, tw, 15, { alpha: 0.9 }); text(ctx, c.msg, 240 - tw / 2 + 7, y + 4, '#bff0ff'); ctx.globalAlpha = 1;
  }
}
