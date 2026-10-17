# Moltborn: From Crab to Godslayer

A 2D pixel-art ocean action-adventure RPG. You start as a thumb-sized shore crab and molt your way
up through five more bodies until you can stand in front of Poseidon. Everything (sprites, tiles,
music, sound effects) is generated in code: there are no image or audio assets, and no build step.

## Run it

```
node tools/serve.mjs          # serves on http://localhost:8123 (pass a port to change it)
```

Open the URL in a modern browser. Nothing to install. Click the canvas once so audio can start.

URL flags: `?quick=1` skips the title screen, `?manual=1` stops the real-time loop (used by tests),
`?gallery=<name>` shows a sprite sheet.

## Controls

| Action | Keys |
|---|---|
| Move / swim | Arrows or WASD |
| Jump / stroke | Space |
| Attack (combo) / heavy | J or Z / K or X (hold to charge) |
| Dash | L or C |
| Block, parry on a tight press | Shift or V |
| Abilities 1-3 / Ultimate | 1 2 3 (or U I O) / Q or R |
| Interact | E |
| Quick-heal | F or H (kelp wrap, then brine tonic) |
| Menu (inventory, quests, map, evolution, skills, codex) | Tab or B |
| Map | M |
| Pause / options | Esc or P |
| Quick save | F5 |

Gamepads work as well.

## The game

**Forms.** Shore Crab, Warrior Crab, Abyssal Crab, Leviathan Crab, Mythic Crab, and the secret
Primordial. Each has its own body, scale, animation set, combat style and abilities. Warrior,
Abyssal and Leviathan each branch in two directions, and dyes and mutations change how you look.
Molting happens at shrines once you have the level and Evolution Points, and plays a full cinematic.

**Progression.** XP and levels for raw stats, Evolution Points for molting, Skill Points for a
28-node tree of passives and mutations. Loot, shells, claws, charms, upgrades at the forge, and
cosmetic dyes.

**Combat.** Three-hit combos, charged heavy, dash with i-frames, block and parry with riposte,
three abilities per form, an ultimate, poise and armour on enemies, status effects, hit-stop and
screen shake. About thirty enemy types with distinct AI (chargers, swarmers, ambushers, turrets,
shield-bearers, kiters, mimics...).

**World.** Twenty-five zones in seven biomes: the Reef, Sunken Forest, Coral Kingdom, Ship
Graveyard, Abyss, Trench of the Forgotten and Poseidon's Domain. Each has its own palette, music,
enemies and hazards. Doors and tide gates are tied to body size and form; hidden passages and
breakable walls hide secrets.

**Bosses.** Grumbold, the Moray Twins, Aurelia, Captain Rust, the Lurelord, Krael, Kyros, the
hidden Maw, the optional Pearl Tyrant, and Poseidon in four phases: Judgment, Wrath, Drowned God,
Last Tide. Telegraphed attacks, armour-break phases, arena barriers.

**Story.** Told through murals, memory pearls, NPCs and boss dialogue. Several quests end in
moral choices (spare or slay Krael, redeem Aurelia, free the hatchlings), and these feed four
endings: Slay, Trident, Mercy, and a secret one.

**Audio.** Twenty-one generative music tracks per biome and boss whose layers fade in with combat
danger and boss phase; layered ambience; about fifty synthesised effects with positional audio.

## Layout

```
index.html            canvas shell
src/main.js           boot
src/game.js           Game: owns systems, zone changes, save/load
src/core/             engine + scene stack, input, save, utils
src/gfx/              procedural Painter, sprite painters per category, tiles/bg/particles/font
src/world/            zone builder DSL, tile baking, physics, world update/draw/lighting
src/entities/         player, enemies, AI library, boss base, interactables
src/bosses/           one file per boss + registry
src/combat/           abilities and ultimates
src/systems/          progression, evolution, quests, dialogue, codex, endings, zone scripts
src/data/             forms, skills, items, enemies, quests, lore, dialogue, zones (pure data)
src/ui/               HUD, play scene, menus, shops, evolution scene, title/credits
src/audio/            WebAudio SFX, ambience, adaptive music
tools/                static server, Playwright runner and screenshot helpers
tests/                validators and Playwright scenarios
```

## Tests

Validators are plain Node and need nothing installed:

```
npm run validate     # zone reachability per form size, exit/entry links, content cross-checks
npm run economy      # XP / evolution-point pacing report
```

Browser tests drive a headless Chromium through `window.__game` and need Playwright
(`npm i playwright` or a global install linked into `node_modules`):

```
node tools/run.mjs tests/scripts/smoke.mjs   # loads every zone, random input, save/load round trip
node tools/run.mjs tests/scripts/ending.mjs  # plays the endings
node tools/run.mjs tests/scripts/hatch.mjs   # hatchling vault script
```
