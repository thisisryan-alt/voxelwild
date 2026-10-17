# Content guide

Almost everything in Moltborn is data plus a small amount of code. This guide shows, for each kind of thing, which file
to edit and what the minimum entry looks like. After any change run `npm run check` (unit tests, validators and the
browser smoke test); the validators will tell you if a reference points at something that does not exist.

## A creature

1. Add a record to `src/data/enemies.js` (or `enemies_rift.js` for rift creatures):

```js
shardling: {
  name: 'Shardling', hp: 18, dmg: 9, w: 12, h: 18, xp: 14, coins: [2, 5], poise: 6,
  ai: 'blinker', anchor: 'center', fps: 8, flying: true, mass: 0.7,
  shoot: { kind: 'shard', speed: 110, count: 1, aim: 'player', life: 2.2, sfx: 'spore' },
  sprite: { plan: 'shardling', w: 40, h: 36, ax: 20, ay: 18, frames: 4, o: { ramp: glass } },
  p: { speed: 40, aggro: 230, keep: 110, fade: 0.5, blinkMin: 70, blinkMax: 130, wind: 0.45, burst: 3, cd: 2.4 },
},
```

* `ai` names a behaviour in `entities/ai.js` or `entities/ai_rift.js`. `p` is that behaviour's parameter bag.
* `anchor: 'feet'` means the sprite and spawn position are the creature's feet (walkers); `'center'` is for swimmers.
* `sprite.plan` names a painter plan in `gfx/sprites_enemies.js` (or `sprites_rift_foes.js`). `ax`/`ay` are the anchor
  inside the frame.
* `splits: { type, n }` makes it burst into smaller creatures when it dies.

2. Add a field note in `src/data/bestiary.js`: `{ habitat, note, tip }`. A unit test fails if a creature has none.
3. Make it appear somewhere: in a zone (`b.spawnFloor('x', tileX, ...)`), in a rift realm's `pool` in
   `world/rift_gen.js`, or in a roster entry in `data/roster.js`. The Pearl Gauntlet picks up every hostile creature
   automatically.
4. Optionally list its ingredient drops in `DROPS` in `data/recipes.js`.

### A new behaviour

A behaviour is an object registered in the `AI` table. The shape, from `entities/ai_rift.js`:

```js
AI.caller = {
  init(e) { e.a = { cd: 2, gust: null }; e.setState('hover'); },
  update(e, dt, w) {
    const pl = w.player, p = e.p, a = e.a; a.cd -= dt;
    if (e.state === 'hover') { /* steer, and when ready: */ e.setState('windup'); e.alertFx(); }
    else if (e.state === 'windup' && e.st > p.wind) { /* act */ e.setState('call'); }
  },
};
```

`e.st` is seconds in the current state, `e.setState` resets it, `e.alertFx()` shows the "!" that every telegraph should
have, `e.strike(rel, dmg)` spawns a hitbox, `e.shoot()` fires the record's `shoot`, `e.vx`/`e.vy` move it. Timed effects
that must outlive the creature (gusts, pulls) should be areas with a `ttl`, which the world expires by itself.

## A boss

Copy `src/bosses/riftwarden.js`: a class extending `Boss` with `static def` (key, name, hp, phases, sprite), generator
attack methods, and `BOSS_CLASSES.<key> = Class` at the bottom. Import it from `src/bosses/index.js`. Phases list their
attacks with weights: `{ at: 0.62, name: 'Unmoored', attacks: [['shardFan', 2], ['gravityWell', 1.6]], rest: 0.95 }`.
Place it in a zone with a spawn record:

```js
b.spawns.push({ boss: 'hermit_king', floor: true, x: 95 * 16, y: 31 * 16,
  arena: { x: 77, y: 8, w: 32, h: 24 }, trigger: { x: 82, y: 10, w: 24, h: 21 }, barriers: [{ x: 76, y: 24, w: 1, h: 7 }] });
```

Add the key to `BOSS_KEYS` in `ui/menu_extra.js` and a bestiary entry. A boss that should be fightable repeatedly sets
`repeat: true` in its spawn record.

## A zone

1. Write `export function my_zone()` in one of the `src/data/zones_*.js` files using the builder (see
   `docs/ARCHITECTURE.md`).
2. Add `my_zone: { name, biome, map: { x, y } }` to `ZONE_INFO` in `src/data/zoneinfo.js`, and the connection to
   `ZONE_LINKS`.
3. Make an exit in a neighbouring zone that names it, and an `entry` there for the return trip.
4. Run `node tests/validate_zones.mjs`: it simulates each body size crossing the zone and reports unreachable exits,
   chests or spawns. `node tests/ascii.mjs my_zone` prints the map so you can see why.

## An NPC, their dialogue and a quest

* `src/data/npcs.js`: `{ name, color, sprite: { kind: 'fish', k: 'tunny', o: { ... } } }`.
* Place it in a zone: `b.npc('tunny', 28, { from: 10, facing: -1 })`.
* `src/data/dialogue.js`: a generator method named for the NPC id. `yield c.say(text)`, `yield c.ask(prompt, options)`
  returns the chosen index, `c.flag/c.set` read and write flags, `c.quest(id)` starts a quest, `yield c.shop(id)` and
  `yield c.sell(id)` open the buy and sell screens.
* `src/data/quests.js`: `{ name, type, giver, steps: [{ text, done(game) }], desc }`; the reward goes in the `REWARDS`
  table in `systems/quests.js`.
* Barks (the lines people mutter as you pass) go in `src/data/barks.js`, newest and most specific first.

## An item, a recipe, a fish

* Items are in `data/items.js` (`type: 'consumable' | 'equip' | 'key' | ...`). Equipment `fx` keys must exist in
  `computeStats` (`progression.js`); a unit test checks this. Ingredients and dishes live in `data/items_craft.js`, fish
  and fish dishes in `data/items_fish.js`.
* A recipe is `{ id, out, n, needs: { item: count }, note }` in `data/recipes.js`. A dish's `use` may heal, restore Tide,
  cleanse, and apply `buffs: [{ id, dur, power }]`.
* A fish is one record in `data/fish.js`: biomes, hours (`phases`), length range, value, and how it fights
  (`fight: { speed, erratic, drain }`). Its ingredient item is generated automatically.

## Rifts: relics, tides, affixes

* Relics (`data/relics.js`): `fx` keys are the same stat keys equipment uses; a `hook` names special behaviour in
  `systems/rifts.js`.
* Rift modifiers ("tides") are in `RIFT_MODS`. Elite affixes are in `data/affixes.js` and hook into `systems/affixes.js`.
* Room kinds are chosen by `riftKind` in `world/rift_gen.js`; add a kind there and build it in `buildRift`.

## Trophies, titles and wakes

A trophy is `{ id, name, desc, cat, tier, goal, get(ctx) }` in `data/achievements.js`, where `ctx.r` is the records and
`ctx.s` the save state. To track something new, add a counter to `newRecords()` in `systems/stats.js` and increment it
from an event. Titles and wakes in `data/cosmetics.js` unlock by trophy id.

## Settings

One line in `SCHEMA` (`systems/settings.js`): `{ group, key, label, type: 'toggle'|'slider'|'cycle', def, hint }`. Read it
with `setting(game, 'key')`. The options screen and validation pick it up automatically.

## Lore and story

Lore entries (`data/lore.js`) are `{ cat, title, text }`, unlocked by a mural prop (`b.mural(x, 'id')`), by
`codex.unlock('id')`, or by an event hook in `systems/codex.js`. Story cutscenes are in `STORIES` in `systems/story.js`:
panels of `{ art, title?, text }`, queued by an event. Art scenes are drawn in `gfx/cutscene_art.js`; `art:
'boss:<key>'` and `'form:<id>'` reuse sprite plans.

## Ambient events

Add a kind to `KINDS` in `gfx/events.js` (`layer`, `life`, `spawn`, `step`, `draw`), weight it in `WEIGHTS` for the realms
where it can occur, and start it from code with `world.sky.force('kind', options)`.
