# Systems reference

The rules of the newer gameplay systems, with the numbers they run on. Where a number lives in code, the file is named so
it can be tuned in one place. All of it is covered by unit tests in `tests/unit/`.

## Difficulty and New Game+

`systems/difficulty.js`. Every foe-related rule reads four multipliers through `Difficulty.scale()`:

| tier | foe health | damage taken | experience | coins |
|---|---|---|---|---|
| Calm | x0.8 | x0.7 | x1.0 | x1.0 |
| Tide (default) | x1.0 | x1.0 | x1.0 | x1.0 |
| Rip | x1.3 | x1.25 | x1.2 | x1.15 |
| Maelstrom | x1.7 | x1.6 | x1.5 | x1.3 |

Each New Game+ voyage (up to five) adds +35% health, +25% damage, +30% experience and +20% coins on top of the tier. Rifts,
the Pearl Gauntlet and the tide clock fold their own multipliers into the same call, so nothing else needs to know
about them. New Game+ is offered once any ending has been seen; it keeps level, forms, skills, gear, the codex, records
and trophies, and drops story progress.

## Tidal Rifts

`systems/rifts.js`, `world/rift_gen.js`, `data/relics.js`.

A run is a chain of chambers (4, 6 or 8 depths for the Shallow, Deep and Abyssal rifts; Deep needs Mother Moray beaten,
Abyssal needs Krael). Each chamber is a procedurally built cave of one of the seven realms, chosen by the run's seed.

* **Scaling.** At depth `d` foes have `(1 + 0.1 (d - 1)) x tier` health and `(1 + 0.07 (d - 1))` damage; experience grows
  `+12%` per depth. The tier multiplier is 1, 1.25 and 1.6 for Shallow, Deep and Abyssal.
* **Rooms.** Depth 1 is always a plain fight and the last depth is always the Warden. In between, a seeded table picks
  from combat (48%), elite den (16%), ambush (14%), treasure vault (12%) and altar (10%), plus a trial (12) from depth 3;
  after a calm room the vault, altar and trial are not offered.
* **Trials.** The chamber starts empty. Forty seconds on the clock, a wave every eight (the first after three), none in the
  last six; each wave is `2 + depth/2` foes, with an elite chance that climbs as time runs down. The way opens when the
  clock is out and the last foe has fallen, with the better pool of four relics on offer. (`systems/rift_trial.js`)
* **Relics.** Clearing a chamber opens a choice of three relics (four, from a better pool, after an elite den). Rarity
  weights are common 60, rare 30, epic 10, and epics appear from depth 2. Relics last until the run ends. 27 relics, plus
  the Sacrificial Vow curse an altar can offer.
* **Tides.** Each chamber may carry modifiers (Thick Hide, Sharp Tide, Swift Tide, Rich Tide, Murk, Glass Tide, Gilded,
  Frenzy) that fold into the multipliers or give foes haste.
* **The Rift Warden.** The last chamber holds a single boss: shard fans, tears that open under the swimmer, a phase-step
  that reappears behind them, a gravity pull, summoned wisps, falling columns of light, and a closing nova in the last
  phase. It is fought again on every run.
* **Rewards.** A finished run pays coins, experience, pearls and ingredients by tier and depth reached; the first clear of
  the day's rift pays a bonus. Dying keeps what was earned, not what was carried.
* **The daily rift** uses the date as its seed, so everyone swims the same chambers on the same day.

## The Pearl Gauntlet

`systems/arena.js`. Endless waves in a sealed arena. Wave `n` has a budget of `6 + 2.4 n`; creatures unlock as waves rise,
every third wave offers a relic, every fifth pays pearls, every tenth is led by a champion. The best wave is kept.

## Elites and champions

`systems/affixes.js`, `data/affixes.js`. A creature may spawn as an elite with one or two affixes (armoured, swift,
vampiric, volatile, scorching, frostbitten, brooding, mending, thorned, shielded). The chance is 0 / 5% / 10% / 18% by
difficulty tier plus 4% per New Game+ voyage, capped at 50%. Elites pay 1.8x experience, 2x coins and may drop pearls.
Rift champions have two affixes and a larger body.

## Hunt bounties

`systems/bounties.js`, `data/bounties.js`, `ui/bounty_scene.js`.

* Four a day at the Tide Board, generated from the calendar date and the swimmer's level, so a given day and level always
  make the same board.
* A bounty watches a lifetime counter in the save's records. It records the counter's value when the board is made and is
  complete when the counter has grown by the asked amount. No events are involved, so progress survives reloads.
* Kinds: defeat N of a creature the swimmer has met (fewer of tougher creatures), or open chests, harvest forage, cook,
  defeat elites, clear rifts, fell foes in the Gauntlet, dash, rest, land criticals, recover health.
* Rewards scale with level: `coins = (22 + 5.5 x level) x weight`, experience `(12 + 4 x level) x weight`, and a pearl for
  the hardest kinds.
* Clearing all four extends a streak; a missed day or an unfinished board resets it. Streak days 2-3 pay 1 pearl, 4-5 pay
  2, 6+ pay 3. Any unclaimed bounty can be swapped for 50 coins.

## Fishing

`systems/fishing.js`, `data/fish.js`, `ui/fishing_scene.js`.

* Fishing posts stand on open floor with deep water above, one or two per realm zone. A post recovers 150 seconds of play
  after a catch (45 after a missed bite).
* After casting, a bite comes in 1.4-4.2 seconds and must be answered within 0.9 seconds.
* The reel is a bar game: hold the button to lift the green catch zone, release to let it fall, and keep the fish inside
  it until the meter fills. The zone shrinks and the fish darts faster with rarity; the meter drains faster the harder the
  fish fights.
* 18 species in four rarities (common 60, uncommon 26, rare 11, legendary 3 by weight). Species are limited by realm and
  sometimes by hour of the tide clock. Luck (level, catches, the Lucky Lure and Moonpearl charms, bait) shifts weight from
  common to rare fish. The Moonpool's spot makes the Moon Koi six times likelier, at night.
* Bait is cooked: Kelp Ball, Glow Bait and Pearl Lure give the Baited status (power 1, 2 and 3.5; +0.1 luck per power).
* Fish are ingredients, sold to the fishmonger, and cook into six dishes.

## Market

`systems/market.js`. Old Tunny pays a fish's full value, 40% of an ingredient's value and 50% of a dish's; Marlin pays 70%
for fish and 50% for ingredients. Prices follow the hour: the tide clock's coin multiplier makes dusk 10% better.

## The tide clock

`systems/clock.js`, `data/clock.js`. A day lasts ten minutes of play and needs nothing in the save (it derives from play
time; a debug jump stores a shift). Phases: Dawn (0-10%), High Sun (10-50%), Dusk (50-62%), Deep Night (62-100%).

| phase | effects |
|---|---|
| Dawn, High Sun | Sunlit: Tide regenerates 12% faster |
| Dusk | coins +10% |
| Deep Night | experience +15%, foes' aggro range +20%, Moonlit: +4% speed, moonbeams and plankton |

The picture is graded between colour anchors, scaled by how open to the sky the realm is (the reef fully, the abyss
hardly). Options: off / subtle / full. Moonpool Cove's passage only opens at night.

## Tidal surges

`systems/surge.js`. In open realms, 70-130 seconds after entering and then every 170-300 seconds, the water draws back (a
six-second warning), every current in the zone runs one way for 14 seconds, and afterwards 5-9 pieces of flotsam (coins,
ingredients from the realm's forage patches, a little bait) wash up near the swimmer. Never in rifts, the Gauntlet, boss
fights or cutscenes; can be disabled in Options.

## Kitchen orders

`systems/orders.js`. Three requests a day for dishes the swimmer can already cook, from fourteen townsfolk; deliveries pay
coins, every third a pearl, and each raises the requester's regard.

## Run history

`systems/history.js`. Every finished rift, daily rift and Gauntlet run is logged (the last 40) with its tier, depth, time,
kills and coins. The fastest clear of each tier is kept separately. The Hall of Tides shows the log, the fish log and
lifetime totals.

## Accessibility

`systems/access.js`, `systems/captions.js`, `core/keymap.js`. Colour-blind palettes are an SVG filter over the canvas plus
remapped telegraph colours; high-contrast outlines; reduced motion and flashes; a large HUD; sound captions with
direction arrows; full key rebinding with three slots per action; controller rumble strength.
