// Boss registry (filled in by boss modules). createBoss(world, key, x, y, spawn) -> Boss or null.
export const BOSS_CLASSES = {};
export function createBoss(world, key, x, y, spawn) {
  const C = BOSS_CLASSES[key]; if (!C) { console.warn('unknown boss', key); return null; }
  return new C(world, x, y, spawn);
}
