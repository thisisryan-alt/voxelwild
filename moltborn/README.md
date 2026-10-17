# Moltborn: From Crab to Godslayer

A 2D pixel-art ocean action-adventure RPG. You start as a thumb-sized shore crab and molt your way
up through five more bodies until you can stand in front of Poseidon. Everything (sprites, tiles,
music, sound effects) is generated in code: there are no image or audio assets, and no build step.

## Run it

```
node tools/serve.mjs          # serves on http://localhost:8080 (pass a port to change it)
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

**Combat.** Three-hit combos, charged heavy, dash with i-frames, block and parry with riposte, an ultimate, poise and armour on
enemies, status effects, hit-stop, screen shake and camera kicks. Every strike leaves a crescent in the water and a starburst on the
target; kills shatter the enemy's own sprite pixels; a combo counter rewards unbroken streaks. Seventeen abilities (four more sit at
the end of the skill tree: Crescent Wave, Aegis Bubble, Tide Step, Storm Call) and a 36-node tree with capstone passives. About forty
enemy types with distinct AI (chargers, swarmers, ambushers, turrets, shield-bearers, kiters, mimics, and the newer three-strike
flurry shrimp, healing menders, brood spawners, splitting jellies, hooking pikes, wall-stunning rams and cloud-laying fungi).

**World.** Twenty-nine zones in seven biomes: the Reef, Sunken Forest, Coral Kingdom, Ship Graveyard, Abyss, Trench of the
Forgotten and Poseidon's Domain. Each has its own palette, music, enemies and hazards (timed vent plumes, currents, pressure). Doors and
tide gates are tied to body size and form; hidden passages and breakable walls hide secrets, including four optional zones: the Sunken
Tidepools, Glowcap Grotto, Pearl Vaults and Ember Vents. The world breathes: drifting caustics, parallax plankton, schools of fish,
jellies and wisps behind the terrain, and soft foreground silhouettes at the screen edges.

**Bosses.** Grumbold, the Moray Twins, Aurelia, Captain Rust, the Lurelord, Krael, Kyros, the
hidden Maw, the optional Pearl Tyrant, and Poseidon in four phases: Judgment, Wrath, Drowned God,
Last Tide. Telegraphed attacks, armour-break phases, arena barriers. Four optional mini-bosses guard the hidden zones: Brun the Hermit King, the
Sporemother, the Brass Colossus and Magmaw.

**Story.** Told through murals, memory pearls, NPCs and boss dialogue, plus twenty-eight illustrated story
cutscenes (`src/systems/story.js`): the intro, each realm's first entry, every boss's fall, each molt and the Throne. Several quests end in
moral choices (spare or slay Krael, redeem Aurelia, free the hatchlings), and these feed four
endings: Slay, Trident, Mercy, and a secret one.

**Audio.** Twenty-one composed tracks (a fixed 16-bar song per area, built from a motif by `src/audio/compose.js`)
played on synthesised instruments with a ping-pong delay. Layers fade in with combat danger and boss phase, boss
tracks open with a riser and end on a victory stinger. Layered ambience and about fifty synthesised effects.

## Layout

```
index.html            canvas shell
src/main.js           boot
src/game.js           Game: owns systems, zone changes, save/load
src/core/             engine + scene stack, input, save, utils
src/gfx/              procedural Painter, crab kit + hero forms, boss/enemy/NPC painters, cutscene scenes, tiles/bg/ambience/particles/font
src/world/            zone builder DSL, scatter placement, tile baking, physics, world update/draw/lighting
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
npm run validate     # zone reachability per form size, exit/entry links, content cross-checks, composer checks
npm run economy      # XP / evolution-point pacing report
```

Browser tests drive a headless Chromium through `window.__game` and need Playwright
(`npm i playwright` or a global install linked into `node_modules`):

```
node tools/run.mjs tests/scripts/smoke.mjs   # loads every zone, random input, save/load round trip
node tools/run.mjs tests/scripts/ending.mjs  # plays the endings
node tools/run.mjs tests/scripts/hatch.mjs   # hatchling vault script
TRACKS=reef,boss1 node tools/run.mjs tests/scripts/music_render.mjs   # offline render: level and band balance per track
node tools/run.mjs tests/scripts/cuts.mjs    # screenshots of every cutscene scene
node tools/run.mjs tests/scripts/fuzz.mjs    # random-input fuzz of all 25 zones (exceptions, NaN, runaway entities)
node tools/run.mjs tests/scripts/aiprobe.mjs # how each enemy type behaves against a standing player
node tools/run.mjs tests/scripts/models.mjs  # contact sheets of every model (also heroes.mjs, bossview.mjs, newenemies.mjs)
node tools/run.mjs tests/scripts/newai.mjs   # spot checks of the newer enemy behaviours (clouds, hooks, rams, healers, splits)
node tools/run.mjs tests/scripts/newzones.mjs # breaks the hidden walls with real heavy attacks and walks through
node tools/run.mjs tests/scripts/combatshots.mjs   # frames of a combo (also fxshots.mjs, abilityshots.mjs, bossdeath.mjs)
ZONE=forest_grotto node tools/run.mjs tests/scripts/bossdps.mjs   # idealised DPS against one boss (also bosslog.mjs, fair.mjs)
node tests/ascii.mjs reef_tidepools          # ASCII map of any zone
```
