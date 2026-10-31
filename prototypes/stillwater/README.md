# Stillwater

A small voxel archipelago built to be as calming as the research allows. It is a browser prototype, separate
from the Unity project: open `index.html` in a browser. The page loads three.js r128 from cdnjs and its
fonts from Google Fonts; everything else is in `js/`.

## What is out there

- **Seventeen islands:** Home Island (your garden, the pond and the dock), Pine Isle (steep, rocky, deer),
  Blossom Isle (cherry trees around a pavilion), Meadow Isle (sheep, wildflowers and a turning windmill),
  Palm Atoll (a sand ring around a coral lagoon with reef fish), Seal Rocks (seals and puffins), Wreck
  Bar (a sandbar with an old boat), Waterfall Isle (a mesa whose stream falls off a sheer cliff), Hot
  Spring Isle (steaming pools you can soak in), Glacier Isle (ice, snowy pines and arctic foxes) and Marsh
  Isle (lily pools, reeds, willows and otters). Further out lie Bamboo Isle (a bamboo grove, a koi pond
  and a round stone moon gate, with cranes), Orchard Isle (apple trees that blossom and fruit, beehives
  and bees), Basalt Isle (dark stone columns topped with turf over a black sand beach, with cormorants),
  Old Tree Isle (one vast, ancient tree with red squirrels), the Standing Stones (a ring of tall stones
  on grassy downs, with hares) and Dune Isle (dunes, driftwood to sit on, and plovers on the tideline).
  A rock sea arch stands north of home, and bare skerries are scattered over the open sea. Each island
  has its own wild plants, which you can tidy away like your own.
- **Walking:** press **Walk** to step off the boat as a small figure in a straw hat. Tap where to go
  (pathfinding climbs one block at a time) or use WASD or the arrow keys. Wade the shallows, sit on
  benches, pavilions and the ends of jetties, and walk into a hot spring to soak. Footsteps change with
  the ground, rabbits, deer, foxes, crabs, puffins and otters keep their distance, and the cat purrs
  when you pass. In walk mode the tray plants and builds right in front of you, and tapping open water
  throws a pebble. Tap the moored boat to choose where to row.
- **Handpan:** press **Play** for a nine-note handpan in D major pentatonic (keys 1–9). Every note
  ripples the water nearby.
- **Rowing:** a rowboat waits at whichever island you are on. Open **Islands** and choose *Row there*
  for a slow trip with a follow camera, or *Look now* to glide the camera over. Visitors, weather, shadows
  and lights follow you.
- **Garden:** 8 trees (oak, maple, birch, cherry, apple, willow, pine, palm), 9 plants (wildflowers,
  tulips, lavender, sunflowers, ferns, mushrooms, berry bush, bamboo, dune grass) and 2 water plants (lily
  pads with lotus, reeds). Trees grow by recursive branching over about 30 seconds; apple trees blossom
  in spring and carry green, then red, apples.
- **Build:** stone lantern, wind chime, bench, campfire, stone stack, birdhouse, beehive (bees come out
  to visit the flowers nearby), stepping stones, cabin with a smoking chimney and lit windows, pavilion
  and windmill. Coral can be planted on the sea floor.
- **Seasons:** one season per in-game day. Leaves turn and fall, cherry petals drift in spring, flowers rest
  in winter, snow settles on the ground and the pines.
- **Weather:** clear, cloudy, rain (with rings on the water), fog and snow, changing on its own or set by
  hand. Rainbows after rain when the sun is low. Aurora on some nights, a moon with an eight-day cycle,
  shooting stars you can tap to make a wish, and glowing water at night.
- **Visitors:** koi, pond goldfish, butterflies, gulls, songbirds, ducks with ducklings, frogs, rabbits,
  crabs, a heron, dragonflies, an owl, a cat asleep on the dock, a sea turtle, leaping fish, sheep, deer,
  seals, puffins, reef fish, cranes that dance, bees, cormorants drying their wings, red squirrels,
  hares, plovers, a whale and a passing sailboat. Many can be tapped. A lighthouse turns its beam at dusk.
- **Rituals:** drop a pebble, skip a stone, let a thought go on a sky lantern (the words are never saved),
  plant a glowing flower for something good (kept in the journal), or sit for 3–20 minutes with a singing
  bowl at each end.
- **Breathing:** five patterns (six a minute, even, cyclic sigh, box, 4-7-8). The tide, foam line, dock
  lantern, the cat and the surf all follow the chosen pattern.
- **Views:** island orbit, the shore of the current island, Home's sunset beach and pond, the whole
  archipelago from above, and a slow drifting camera.
- **Sound:** all synthesised live, with a mixer for waves, wind, rain, wildlife, frogs and crickets, fire,
  chimes, music, the waterfall and springs, and footsteps.
- **Journal:** field notes for 59 visitors, sights and places, the good things you have written, and the research
  behind each design choice.

The garden, tidied wild plants, current island, journal, settings and time of day are saved in the browser's local storage.

**Keys:** WASD or arrows walk · 1–9 handpan · B breath guide · M sound · I islands · H hide controls · J journal · V next view · Esc close.

## Files

| File | Contents |
|---|---|
| `js/core.js` | Constants and the island list, noise, seasonal palettes, storage, shared state |
| `js/world.js` | Renderer, sky (sun, moon, stars, aurora, rainbow), weather, archipelago terrain, water, lighthouse, clouds, dock and jetties |
| `js/garden.js` | Voxel growth system, seasonal recolouring, plant and building catalog, wild island growth, placement rules |
| `js/life.js` | Creatures, the rowboat, windmill sails, particles, sky lanterns, skipping stones |
| `js/audio.js` | Synthesised soundscape and mixer |
| `js/post.js` | The rendering pipeline: sea reflections, ambient occlusion, bloom, sun shafts, mist, grading, depth of field, FXAA |
| `js/walk.js` | The walking figure, footing, A* pathfinding, sitting and soaking |
| `js/main.js` | Input, camera views, breathing patterns, journal, rituals, saving and UI |

## Graphics

Everything is drawn with three.js r128 and hand-written shaders; there are no image textures.

- **Pipeline** (`js/post.js`): the opaque world renders into an HDR target with a depth texture.
  Ambient occlusion is computed from depth and blurred with depth-aware weights, then the transparent
  layer (sea, particles, glows) is drawn on top. Bloom uses a six-level mip chain; sun shafts are a
  radial blur of the visible sky; haze toward the sun, low dawn mist, a soft highlight roll-off,
  time-of-day and seasonal colour grading, vignette and fine grain follow; then depth of field and
  FXAA.
- **Sea:** planar reflections from a mirrored camera with an oblique clip plane, refraction of the
  sea floor tinted by how much water the light passes through, sun glints, whitecaps in wind, shore
  foam, rain rings, ripples and night glow.
- **Blocks:** per-pixel lighting, per-face shading, darkened block edges, a fine procedural grain,
  grass that wraps over the top of a block's sides, damp sand at the waterline, wet sheen in rain,
  and leaves that glow when the sun is behind them.
- **Sky:** a horizon haze band, a warm glow on the sun's side at golden hour, an HDR sun disk,
  drifting high cirrus, varied stars, a phased moon, aurora and rainbows. Voxel clouds have their own
  shader with sunlit tops, cool undersides and silver linings.
- **Meadow grass:** thousands of swaying blade tufts that change with the seasons and part around
  paths and buildings.
- **Wind and cloud:** gusts roll across the islands as travelling patches of stronger wind that flatten
  the grass (which catches the light as it bends) and toss the trees. Each cloud casts a soft shadow,
  projected along the sun's rays, that drifts over land, grass and sea; under it the water loses its
  glitter. The rowboat leaves a spreading foam wake.
- **Quality:** Sharp (everything), Balanced (no reflections or depth of field, half the grass) and
  Light (no post-processing or grass). Unless you chose a level in Settings, slow frames first lower
  the drawing resolution a little and then step down a level; resolution comes back when there is
  room. Shaders are compiled at start, and seasonal recolouring is spread over several frames, so
  weather and seasons change without stutter.

## Design choices and their sources

| Choice | In the game | Source |
|---|---|---|
| Paced breathing near 6/min, long exhale | The world follows the breathing pattern; optional on-screen guide | Lehrer & Gevirtz 2014, *Front. Psychol.*; Zaccaro et al. 2018, *Front. Hum. Neurosci.* |
| Cyclic sighing | One of the breathing patterns | Balban et al. 2023, *Cell Rep. Med.* |
| Water and nature scenes | Island in a calm sea, plants, slow day–night cycle; night is deep blue | White et al. 2010, *J. Environ. Psychol.*; Ulrich et al. 1991, *J. Environ. Psychol.* |
| Soft fascination, being away, extent | Clouds and their drifting shadows, koi, fireflies, falling leaves; seventeen islands, a slow row between them and paths to walk give a world worth wandering | Kaplan 1995, *J. Environ. Psychol.*; Berman, Jonides & Kaplan 2008, *Psychol. Sci.* |
| Watching animals | Koi, reef fish, seals, otters, cranes, squirrels, turtle, ducks, whale | Cracknell et al. 2016, *Environ. Behav.* |
| Mid-complexity fractals | Recursive tree branching; layered-noise clouds | Taylor et al. 2011, *Front. Hum. Neurosci.*; Hagerhall et al. 2008, *Perception* |
| Natural sound | Surf, rain, wind, birds, frogs, crickets | Alvarsson, Wiens & Nilsson 2010, *IJERPH*; Gould van Praag et al. 2017, *Sci. Rep.* |
| A short walk outdoors | Walk mode: wander, wade and sit | Barton & Pretty 2010, *Environ. Sci. Technol.* |
| Warm water | Hot springs you can soak in | Haghayegh et al. 2019, *Sleep Med. Rev.* |
| Making music | A handpan with no wrong notes | Fancourt et al. 2016, *PLOS ONE* |
| Firelight | Campfire with crackle | Lynn 2014, *Evol. Psychol.* |
| Slow consonant music with rests | Pentatonic pads with 5 s attacks and silences; sparse melodies | Bernardi, Porta & Sleight 2006, *Heart* |
| Awe | Aurora, whale, shooting stars | Sturm et al. 2022, *Emotion* |
| Gratitude | Something good → a glowing flower | Seligman et al. 2005, *Am. Psychol.*; Emmons & McCullough 2003, *J. Pers. Soc. Psychol.* |
| Discarding thoughts | Let something go → a sky lantern | Briñol, Gascó, Petty & Horcajo 2013, *Psychol. Sci.* |
| Short meditation | Sit for 3–20 minutes | Goyal et al. 2014, *JAMA Intern. Med.* |
| No evaluative threat | No score, timer, failure state or audience; the journal is not a checklist | Dickerson & Kemeny 2004, *Psychol. Bull.* |
| Low-demand nurturing task | Gardening as the main verb | Van Den Berg & Custers 2011, *J. Health Psychol.*; Russoniello, O'Brien & Parks 2009, *J. CyberTherapy & Rehabil.* |
| Cool, low-saturation colours | Blue/green palette; warm light at golden hour | Valdez & Mehrabian 1994, *J. Exp. Psychol. Gen.* |

These are findings about the ingredients, not a trial of this game. The fractal dimension of the trees
was not measured.

`prefers-reduced-motion`, or **Less motion** in Settings, turns off the camera drift and leaf sway and
lowers the wave height.
