# Changelog

Newest first. Version numbers are not used; each entry is one push of the game.

## The big content and polish push

### New ways to play
* **The Rift Warden**, a repeatable boss at the bottom of every Tidal Rift (three phases, eight attacks, fought again on every
  run), with its own sprite, bestiary entry, trophies and a cutscene.
* **Oaths** before a rift: optional handicaps for a bigger payout, with trophies and titles.
* **Trial rooms** in the rifts: hold out for forty seconds against waves that grow, then choose from a better pool of relics.
* **Four rift creatures** with their own behaviours: Shardlings that blink and fire, Latchleeches that cling until you dash
  or strike them twice, Tidecallers that raise a gust, Glass Golems that slam and shatter into Shardlings.
* **Fishing.** Posts in every realm, a bite-and-reel minigame, 18 species in four rarities, some available only at certain
  hours, a lucky lure, cookable bait, six fish dishes.
* **A market.** Sell fish and goods to Old Tunny and Marlin; prices follow the hour of the day.
* **Hunt bounties.** Four a day on the Tide Board, read straight from the records, with streaks, swaps and trophies.
* **Tidal surges** that push you across a zone and wash up flotsam.
* **The tide clock.** Ten-minute days: dawn, high sun, dusk, deep night, with colour grading, a HUD sun and moon,
  night-only ambient events, small modifiers, and the hour changing what is worth doing.
* **Moonpool Cove**, a night-only secret zone with Selene the Moonkeeper, a moon fishing spot and a hidden Moonpearl.
* **Companion tricks:** the hatchling learns a patient line for fishing, a warning shell, treasure sense and a bond bonus.
* Three new side quests (The One That Got Away, The Moon's Errand, Washed Up), a fishmonger, a moonkeeper, new lore, five new
  story cutscenes with two new art scenes, new titles and wakes, barks that notice the hour.

### Interface and records
* A help compendium (title and pause menus) built from live data, so it cannot drift from the rules.
* The Hall of Tides: run history, the fish log, a dive log of milestones, and lifetime totals.
* A sell screen, a bounty board, a fishing scene, a minimap, an options page for the new settings.

### Look and feel
* Post-processing, per-tile detail, squash-and-stretch, status-effect visuals, new sounds for fishing, trade, the hour and
  surges, and three new music tracks (Moonpool Cove, rift chambers, trial rooms).

### Engineering
* Timed areas (`ttl`) expire by themselves; the Warden's pull and the Tidecaller's gust use them, which fixed a pull that
  would have outlived a boss killed mid-attack.
* `Clock.gate()` lets any exit open only at night.
* Zones can place their own fishing spots; auto-placement stands down if they do.
* **Tests:** unit tests grew from none to 309 across 16 files (status, settings, data, systems, AI, bounties, clock,
  fishing, market, surges, journal, rifts, crafting, elites, trophies, travel, accessibility, progression), the rift
  validator checks every chamber's last room holds exactly the Warden, and 25 browser scripts run as a suite
  (`npm run suite`).
* **Documentation:** `docs/` holds an architecture overview, a content guide, a systems reference with the numbers each
  system runs on, a testing guide and this changelog.

### Fixes found along the way
* Spawning inside rock after zone transitions (a spawn-slide, `World.clearSpawn`, now moves the swimmer to the nearest free
  spot).
* Story cutscenes interrupting rifts; rift enemy scaling using a stale depth; rift rooms with unreachable features.
* Ambient events invisible in dark realms (a glow layer drawn after the lighting pass).
