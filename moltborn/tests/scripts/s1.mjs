export default async (page, H) => {
  await H.load('?manual=1');
  await H.adv(120);
  await H.canvas('/tmp/c1.png');
  const info = await H.eval(() => { const p = window.__game.world.player; return { x: p.x, y: p.y, z: window.__game.world.zone.id, enemies: window.__game.world.enemies.length }; });
  console.log('[t]', JSON.stringify(info));
};
