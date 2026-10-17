# Testing

There are three layers, from cheap to expensive. All of them can be run from the repository root with no build step.

| layer | command | needs | what it catches |
|---|---|---|---|
| unit tests | `npm test` | Node only | logic errors in pure code: rules, tables, formulas, state machines |
| validators | `npm run validate` | Node only | broken references, unreachable places, bad content |
| browser scripts | `node tools/run.mjs tests/scripts/<name>.mjs` | Playwright + Chromium | things that only exist in a running game |

`npm run check` runs the unit tests, the validators and the smoke test together. Run it before every commit.

## Unit tests

`tests/unit/` holds dependency-free tests run by `node tests/unit/run.mjs`. The harness (`harness.mjs`) is thirty lines:
`test(name, fn)` runs a function, `ok`, `eq`, `near`, `deep` and `throws` assert, and `summary()` prints the totals and
sets the exit code.

| file | covers |
|---|---|
| `status.test.mjs` | the status-effect engine: stacking, expiry, multipliers, damage over time |
| `settings.test.mjs` | the options schema, defaults, validation, key rebinding |
| `data.test.mjs` | cross-references between data tables: items, recipes, drops, forage, relics, affixes, sets, trophies, bestiary |
| `systems.test.mjs` | difficulty, the Gauntlet's wave builder, procedural rift chambers, save codes, stats |
| `more.test.mjs` | assorted smaller systems: orders, access, cosmetics, achievements |
| `ai.test.mjs` | the enemy behaviours, run headlessly against a stub world |
| `bounties.test.mjs` | daily boards, progress, claiming, streaks, swaps |
| `clock.test.mjs` | the tide clock: phases, colour blending, modifiers, status sync |
| `fishing.test.mjs` | catch tables, lengths, the reeling game frame by frame, spots, bait |
| `market.test.mjs` | selling: prices, buyers, records, the fishing quest |
| `surge.test.mjs` | the surge state machine, flotsam and the floor search |
| `ui_data.test.mjs` | run history, the help compendium and the totals page |
| `journal.test.mjs` | the dive log |
| `rifts.test.mjs`, `trial.test.mjs`, `oaths.test.mjs` | run logic, the Trial room's rules, oaths |
| `systems2.test.mjs` | cooking, elites, trophies, fast travel, accessibility palettes, progression |
| `stats.test.mjs` | how events become lifetime records, boss timing and flawless detection |
| `scenes.test.mjs` | menu scenes driven with a scripted input: oaths, selling, bounties, the board, help, the hall |
| `bosses.test.mjs` | every boss class is consistent (phases, attack generators, sprites, music, loot) and the Warden's geometry |

### Conventions

* A system that needs a game object gets a small stub built in the test (see `fakeGame()` in `surge.test.mjs`); nothing is
  mocked globally. Stubs implement only what the system touches, so a test fails loudly if the system starts depending on
  something new.
* Randomness is injected (`rng(seed)`) so a failure reproduces.
* Time is stepped by hand (`run(g, seconds)`), never waited for.
* Tests that sample random outcomes assert on ordering and ranges, never on exact values.

## Validators

| command | checks |
|---|---|
| `node tests/validate_zones.mjs` | for every zone and each body size, a flood fill from every entry reaches every exit, chest and spawn |
| `node tests/validate_links.mjs` | every exit names a zone and an entry that exist, and the map graph (`ZONE_LINKS`) matches the exits that are really built |
| `node tests/validate_content.mjs` | every spawn, NPC, lore entry, item and quest referenced by a zone, dialogue or quest exists |
| `node tests/interactable_keys.mjs` | the interactable kinds that persist (chests, shrines, murals, signs, locked doors, NPCs, bulbs, braziers) have unique keys |
| `node tests/music_compose.mjs` | every song composes, with sane range and note density |
| `node tests/validate_rifts.mjs [seeds]` | many seeds x depths x run lengths of procedural chambers: reachability, spawns in open water, room features, determinism, and that the last chamber holds exactly the Rift Warden |
| `node tests/economy.mjs` | experience and evolution-point pacing report |
| `node tests/ascii.mjs <zone>` | prints a zone as ASCII, for debugging reachability |

## Browser scripts

`tools/run.mjs` starts the static server, launches headless Chromium, loads the game and hands a script a page and a few
helpers:

```js
export default async (page, H) => {
  await H.load('?manual=1');       // ?manual=1 stops the real-time loop so the script controls time
  await H.adv(60);                 // advance 60 simulation steps
  await H.eval(() => window.__game.state.level);   // run code in the page
  await H.canvas('/tmp/shot.png'); // save the game canvas
};
```

Anything the script prints with a `[t]` prefix is echoed; console errors and page errors fail the run.

### Running many at once

`npm run suite` (`tools/suite.mjs`) runs a default set of 28 browser scripts one after another and prints a table. A script
passes when it exits with code 0 and prints no page error or script error; the scripts also print what they observed (lines
beginning `[t]`), which is worth reading when a change touches the system they cover. `node tools/suite.mjs bounties fishing`
runs just those; `node tools/suite.mjs --list` lists every script.

### The important ones

| script | what it does |
|---|---|
| `smoke.mjs` | builds all 30 zones, drives random input, round-trips a save |
| `fuzz.mjs` | long random-input runs of every zone watching for exceptions, NaN and runaway entities |
| `ending.mjs` | plays through the endings |
| `rifts.mjs`, `riftrooms.mjs`, `trial.mjs`, `oaths.mjs`, `warden.mjs` | a whole rift, each room kind, a Trial room against the clock, oaths from the board to the payout, and the Rift Warden fight through to victory and a second run |
| `riftfoes.mjs` | each rift creature's behaviour, the latch and the dash that breaks it |
| `arena.mjs` | the Gauntlet |
| `bounties.mjs`, `fishing.mjs`, `market.mjs`, `moonpool.mjs`, `surge.mjs`, `clock.mjs`, `helphall.mjs` | the newer systems end to end, with screenshots |
| `postshots.mjs`, `hudshots.mjs`, `menushots.mjs`, `eventshots.mjs` | screenshots of post-processing, the HUD, menus and ambient events |
| `sprites_rift.mjs`, `models.mjs`, `heroes.mjs` | contact sheets of sprites |
| `fair.mjs`, `bossdps.mjs`, `bosslog.mjs` | balance probes: an idealised bot against a boss, damage per second, attack logs |
| `music_render.mjs` | offline render of the songs: loudness and band balance |

Several scripts accept `OUT=/tmp/prefix` for the screenshot path and `ZONE=<id>` or `TRACKS=a,b` where relevant.

### Writing a new one

* Silence story cutscenes by setting the flag for the scene (`state.flags.cs_<id> = true`), or they will queue in front of
  your assertions. Procedural zones never trigger story scenes.
* Prefer `H.eval` to synthesised key presses unless the input itself is what you are testing; `input.inject('confirm',
  true)` followed by a few steps and `false` is the way to press a key.
* To reach a scene, push it directly (`import('/src/ui/board_scene.js')`) rather than walking to it, unless walking is
  the thing under test.
* Compare numbers by the behaviour they imply (it fell, it rose, it stayed inside) rather than by exact value.

## Linting

ESLint is run from a scratch copy so the repository needs no `node_modules`:

```
mkdir -p /tmp/lint && cp -r src /tmp/lint/src && cp eslint.config.mjs /tmp/lint/ && cd /tmp/lint && npx eslint -c eslint.config.mjs src
```

New code should add no errors and no new warnings.
