// Difficulty multipliers and New Game+ carry-over.
export default async (page, H) => {
  await H.load('?manual=1'); await H.adv(30);
  const r = await H.eval(async () => {
    const g = window.__game, out = {}; const { Enemy } = await import('/src/entities/enemy.js');
    const hpAt = (tier, ng) => { g.state.settings.difficulty = tier; g.state.ng = ng; const e = new Enemy(g.world, 'pinchling', 100, 100, {}); return e.maxHp; };
    out.hp = { calm: hpAt('calm', 0), tide: hpAt('tide', 0), rip: hpAt('rip', 0), maelstrom: hpAt('maelstrom', 0), tideNg1: hpAt('tide', 1), ripNg2: hpAt('rip', 2) };
    g.state.settings.difficulty = 'tide'; g.state.ng = 0;
    // damage taken scales
    const dmgAt = (tier) => { g.state.settings.difficulty = tier; const p = g.world.player; p.invulnT = 0; p.hp = p.stats.maxHp; p.takeHit({ dmg: 20, x: p.x + 5, y: p.y, kb: 0 }); return p.stats.maxHp - p.hp; };
    out.dmg = { calm: dmgAt('calm'), tide: dmgAt('tide'), rip: dmgAt('rip'), maelstrom: dmgAt('maelstrom') };
    g.state.settings.difficulty = 'tide';
    // a finished character
    const s = g.state; s.form = 'mythic'; s.level = 28; s.xp = 50; s.skills = { tide1: 1 }; s.coins = 777; s.flags.quest_done_mq1 = true; s.bosses.grumbold = true; s.inv = { kelp_wrap: 3, jelly_gel: 4, capt: 1, vault_key: 1, claw_rusty: 1 }; s.equip.claw = 'claw_rusty'; s.settings.endings = ['slay']; s.visited.reef_nursery = true; s.records.kills.pinchling = 9;
    g.slot = 1; g.saveGame(true);
    g.newGamePlus(1); await new Promise((r) => setTimeout(r, 50)); g.advance(30);
    const n = g.state; out.ng = { ng: n.ng, form: n.form, level: n.level, coins: n.coins, bosses: Object.keys(n.bosses).length, flagsReset: !n.flags.quest_done_mq1, evolvedFlag: !!n.flags.evolved_warrior, vault: !!n.inv.vault_key, jelly: n.inv.jelly_gel, claw: n.equip.claw, killsKept: n.records.kills.pinchling, zone: g.world.zone.id, meta: n.meta?.ng };
    out.hpNg = new Enemy(g.world, 'pinchling', 100, 100, {}).maxHp;
    out.label = g.systems.difficulty.label();
    for (let i = 0; i < 600; i++) { if (i % 40 === 0) for (const k of ['left', 'right', 'attack', 'jump']) g.input.inject(k, Math.random() < 0.4); g.world.player.hp = g.world.player.stats.maxHp; g.advance(1); }
    for (const k of ['left', 'right', 'attack', 'jump']) g.input.inject(k, false);
    out.alive = g.world.player.alive;
    return out;
  });
  console.log('[t]', JSON.stringify(r));
};
