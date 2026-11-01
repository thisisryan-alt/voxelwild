# Stillwater

A small voxel archipelago built to be as calming as the research allows. It is a browser prototype, separate
from the Unity project: open `index.html` in a browser. The page loads three.js r128 from cdnjs and its
fonts from Google Fonts; everything else is in `js/`.

## What is out there

- **Six worlds**, each its own sea with its own islands, weather, music, garden and things to plant and
  build. Sail between them from the Islands menu; your journal comes with you. Every island in a world
  is joined to the others by **bridges**, so the whole archipelago can be walked.
  - **Stillwater**, the original archipelago of seventeen islands (below).
  - **Lantern Bay**, an evening lagoon where the days pass slowly: paper lanterns drift on the water
    and the nearest light it after dusk, houses stand on stilts over the shallows of Stilt Village, a lit pagoda crowns Pagoda Hill, cranes
    wade Lotus Lagoon, fireflies fill Firefly Glade, and bats come out at dusk. Further out: the Tea
    Garden, Maple Hill and Lantern Rock, where the drifting lanterns gather.
  - **Frost Fjord**, always deep winter: snow on everything, ice cliffs with arctic foxes, drifting
    icebergs, hot springs steaming in the snow, reindeer on Pine Ridge, seals and puffins, white hares
    among the stones of North Point, a snowy owl, and the aurora on most nights. Further out: Birch Wood,
    the Snowdrifts and the Black Cliffs.
  - **Coral Cays**, always summer: white sand and turquoise shallows, a coral lagoon of reef fish,
    flamingos on Flamingo Flats, plovers on Turtle Beach, a bamboo-covered Jungle Hill, and a pod of
    dolphins that surfaces offshore now and then. Further out: Reef Ring, Mangrove Isle and Shipwreck
    Shoal.
  - **Heaven**, islands of white and gold floating above a sea of cloud in an endless bright morning:
    little islets drift overhead, gold motes float on the air, light comes down in shafts and a halo
    rings the sun. Doves, swans and cygnets on Swan Lagoon, winged horses on High Meadow, a ring of
    pillars at the Temple, Golden Fields and a harp on top of Harp Hill. Cloud trees, gold flowers,
    marble pillars, fountains, harps and halo arches to build with. Further out: the Garden of Light,
    the Golden Orchard and the Sky Stones.
  - **Hell**, black rock and ash above a slow sea of lava under an ember sky and a blood moon. The lava
    crusts over and splits into glowing veins, ember light seams the rock, the air shimmers with heat
    and sparks rise. Fire birds wheel overhead, salamanders bask on the warm stone, lava fish leap in
    showers of sparks, and bats come out. Ash trees with glowing embers, fire blooms, braziers,
    obsidian spires and ember lanterns to build with. Further out: Ash Wood, the Black Steps and the
    Ember Ring. Strangely peaceful.
- **Bloom and unlocking:** everything you plant or build adds to your world's **bloom** (the ✿ chip at
  the top). Trees and big builds count most, each more of the same kind a little less than the last,
  and every different kind adds a bonus, so a varied garden blooms fastest. Each world's best bloom is
  saved to your profile and never goes down. A world's bloom opens its islands and its other plants and
  builds one by one; the bloom of all your worlds together opens new worlds: Lantern Bay at 150, Frost
  Fjord at 250, Coral Cays at 350, Heaven at 480 and Hell at 620. Locked things show what they need, and
  the bloom panel lists what opens next.
- **Seventeen islands in Stillwater:** Home Island (your garden, the pond and the dock), Pine Isle (steep, rocky, deer),
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
- **Walking:** press **Walk** to step off the boat as a small figure in a straw hat, and go anywhere.
  - **Bridges** join every island to the rest: arched, railed and lit at night, in each world's own
    style (oak, red lacquer, weathered pale wood, bamboo, marble and gold, black glass with ember
    lamps). The network is the shortest set of links joining every island, plus a few short extra ones
    so there is more than one way round. Bridges to islands that have not opened yet are roped off.
  - **Tap where to go**, even on another island: the route finds its way over the bridges (A* on
    each island, the shortest chain of bridges between them), and long routes are taken at a jog.
    Choose *Walk there* in Islands, or tap an island on the **map** in the corner.
  - **Keys:** WASD or the arrows walk, **Shift** runs, **Space** jumps (up a ledge two blocks high, or
    over a bridge's rail into the sea), **E** sits or stands, and **C** cycles the camera: following,
    close, further back and **first person** (drag to look around). On touch screens a **stick** and
    *Jump*, *Run* and *Camera* buttons appear.
  - **Water:** wade the shallows, and in the seas of water swim out into the deep with a breaststroke
    and ripples. In Heaven the cloud holds you up, puffing under your feet; Hell's lava does not, so
    keep to the bridges there.
  - The figure leans into a run, bends its knees and elbows, lands with a bump and a puff of dust,
    looks about when standing still, and leaves footprints in sand, snow and cloud that slowly fill in.
  - **Plant as you go:** press **G** (or *Plant*) and the figure kneels, digs with both hands, sets
    your seed in and rises with its arms lifted as a ring of light spreads over the ground and sparks
    spiral up in the world's colour (gold in Heaven, embers in Hell), with leaves fluttering out. Press
    **Q** (or *Sow*) to scatter seed as you walk: the figure tosses it from the hand mid-stride and
    little plants spring up along your path. The seed is whatever you last chose from the tray (shown
    under the map); choosing from the tray while walking plants it straight away.
  - Sit on benches, pavilions and the ends of jetties, and walk into a hot spring to soak. Footsteps
    change with the ground, rabbits, deer, foxes, crabs, puffins and otters keep their distance, and the
    cat purrs when you pass. In walk mode the tray plants and builds right in front of you, and tapping
    nearby open water throws a pebble. Tap the moored boat to choose where to row.
- **Handpan:** press **Play** for a nine-note handpan in D major pentatonic (keys 1–9). Every note
  ripples the water nearby.
- **Rowing:** a rowboat waits at whichever island you are on. Open **Islands** and choose *Row there*
  for a slow trip with a follow camera, or *Look now* to glide the camera over. Or choose *Take the boat
  out* (or press R) and row wherever you like: the arrow keys or WASD row and steer, and a tap on the
  water or a shore sets a course, which finds its way round any land in between. The boat glides to a
  stop before it would run aground; *Step ashore* (or R) lands you wherever there is beach alongside.
  You can fish from the boat. Visitors, weather, shadows and lights follow you.
- **Garden:** each world has its own catalog. Stillwater has 8 trees (oak, maple, birch, cherry, apple,
  willow, pine, palm), 9 plants (wildflowers, tulips, lavender, sunflowers, ferns, mushrooms, berry bush,
  bamboo, dune grass) and 2 water plants (lily pads with lotus, reeds). Lantern Bay adds lantern posts,
  bonsai and moon gates; Frost Fjord snowy pines, snowmen, ice crystals, igloos and sleds; Coral Cays
  hibiscus, tiki torches, hammocks and beach huts; Heaven and Hell their own (above). Trees grow by
  recursive branching over about 30 seconds; apple trees blossom in spring and carry green, then red,
  apples.
- **Build:** stone lantern, wind chime, bench, campfire, stone stack, birdhouse, beehive (bees come out
  to visit the flowers nearby), stepping stones, cabin with a smoking chimney and lit windows, pavilion
  and windmill, plus each world's own. Coral can be planted on the sea floor.
- **Seasons:** one season per in-game day. Leaves turn and fall, cherry petals drift in spring, flowers rest
  in winter, snow settles on the ground and the pines.
- **Weather:** clear, cloudy, rain (with rings on the water), fog and snow, changing on its own or set by
  hand. Rainbows after rain when the sun is low. Aurora on some nights, a moon with an eight-day cycle,
  shooting stars you can tap to make a wish, and glowing water at night.
- **Visitors:** koi, pond goldfish, butterflies, gulls, songbirds, ducks with ducklings, frogs, rabbits,
  crabs, a heron, dragonflies, an owl, a cat asleep on the dock, a sea turtle, leaping fish, sheep, deer,
  seals, puffins, reef fish, cranes that dance, bees, cormorants drying their wings, red squirrels,
  hares, plovers, a whale and a passing sailboat, and in the other worlds bats, flamingos, dolphins,
  reindeer, a snowy owl, arctic hares, doves, swans, winged horses, fire birds, salamanders and lava
  fish. Many can be tapped. A lighthouse turns its beam at dusk.
- **Fishing:** choose Go fishing under Water and tap open water to cast (or press it while walking).
  After a wait and a nibble or two the float dips: tap again to catch the fish, which leaps out and goes
  straight back. Each world has its own fish, a few of them rare; the journal counts what you have let go.
- **Rituals:** drop a pebble, skip a stone, let a thought go on a sky lantern (the words are never saved),
  plant a glowing flower for something good (kept in the journal), or sit for 3–20 minutes with a singing
  bowl at each end.
- **Breathing:** five patterns (six a minute, even, cyclic sigh, box, 4-7-8). The tide, foam line, dock
  lantern, the cat and the surf all follow the chosen pattern.
- **Views:** island orbit, the shore of the current island, Home's sunset beach and pond, the whole
  archipelago from above, and a slow drifting camera.
- **Sound:** all synthesised live, with a mixer for waves, wind, rain, wildlife, frogs and crickets, fire,
  chimes, music, the waterfall and springs, and footsteps. Each world sounds like itself: a temple bell
  across Lantern Bay and insects from early evening, a colder wind and creaking ice in Frost Fjord,
  tropical birdsong and cicadas in Coral Cays, harp runs and bright chords in Heaven, and the low rumble
  and bubbling of the lava under darker chords in Hell.
- **Journal:** field notes for 118 visitors, sights, worlds and places, the good things you have written, and the research
  behind each design choice.

Each world's garden, tidied wild plants, current island and time of day, plus your profile (each
world's best bloom), the journal, settings and the last world visited, are saved in the browser's local
storage.

**Keys:** WASD or arrows walk, or row when out in the boat · Shift run · Space jump · E sit or stand · C walking camera, up to first person · G plant · Q sow as you walk · R take the boat out or step ashore · F go fishing, and strike when the float dips · 1–9 handpan · B breath guide · M sound · I islands · H hide controls · J journal · V next view · Esc close.

## Files

| File | Contents |
|---|---|
| `js/core.js` | The worlds, their islands, looks, catalogs and unlocks; constants, noise, seasonal palettes, storage, shared state |
| `js/world.js` | Renderer, sky (sun, moon, stars, aurora, rainbow), weather, archipelago terrain, water, lighthouse, clouds, dock and jetties |
| `js/garden.js` | Voxel growth system, seasonal recolouring, plant and building catalog, wild island growth, placement rules, bloom |
| `js/life.js` | Creatures, the rowboat, windmill sails, particles, sky lanterns, skipping stones |
| `js/audio.js` | Synthesised soundscape and mixer |
| `js/post.js` | The rendering pipeline: sea reflections, ambient occlusion, bloom, sun shafts, mist, grading, depth of field, FXAA |
| `js/bridges.js` | The bridges between the islands: planning the network, building it, lamps and closed ropes |
| `js/walk.js` | The walking figure: running, jumping, swimming, footing, footprints, A* pathfinding and routes over the bridges, sitting and soaking |
| `js/main.js` | Input, camera views, breathing patterns, journal, rituals, bloom and unlocks, saving and UI |

## Graphics

Everything is drawn with three.js r128 and hand-written shaders; there are no image textures.

- **Pipeline** (`js/post.js`): the opaque world renders into an HDR target, and every surface writes
  its distance from the camera into the alpha channel, so the effects never need a depth texture
  (which some GPUs and browsers handle badly). Ambient occlusion is computed from those distances and
  blurred with distance-aware weights, then the transparent layer (sea, particles, glows) is drawn on
  top, depth-tested against the opaque pass's own depth buffer. Bloom uses a six-level mip chain; sun shafts are a
  radial blur of the visible sky; haze toward the sun, low dawn mist, a soft highlight roll-off,
  time-of-day and seasonal colour grading, vignette and fine grain follow; then depth of field and
  FXAA.
- **Sea:** planar reflections from a mirrored camera with an oblique clip plane, refraction of the
  sea floor tinted by how much water the light passes through, sun glints, whitecaps in wind, shore
  foam, lines of surf that roll in to the beaches, light through the backs of the waves, rain rings,
  ripples and night glow. Up close, a third layer of tiny capillary ripples (faded with distance so it
  never shimmers) and foam drawn as churning lace of bubble walls. Without planar reflections (Balanced)
  the sea reflects the physically based sky from the same table the sky is drawn from. At night a glade
  of moonlight glitters on the water toward the moon, brightest at full moon.
- **Cloud sea** (Heaven): billowing ridged noise with lit tops and soft blue creases, shaded from
  its own normals, brightening everything above it from below.
- **Lava sea** (Hell): a dark crust that drifts and cracks into glowing HDR veins, lighting the rock
  from below; heat shimmer in the grade, ember light in seams through the rock, and sparks thrown up
  by anything that touches it.
- **Blocks:** per-pixel lighting, per-face shading, darkened block edges, a fine procedural grain,
  grass that wraps over the top of a block's sides, meadows that drift between lush and sun-faded
  patches, damp sand at the waterline, wet sheen in rain, and leaves that glow when the sun is
  behind them.
- **Smooth voxel lighting:** every terrain block carries how many solid blocks share each of its
  eight corners, and the shader blends that across each face, so the foot of every step and cliff
  and every hollow sits in soft shade (on top of the screen-space ambient occlusion).
- **Canopies:** each leaf is dimmer the more leaves lie above it and brighter toward the outside of
  the crown, so trees read as rounded masses; the shading survives the seasons' recolouring. On top of
  the whole canopy's sway, every leaf flutters with its own phase, livelier in a gust, and catches and
  loses the light as it moves.
- **Glitter:** tiny facets in snow, ice and pale sand flash as the sun and your view line up with
  them, strongest in Frost Fjord and on the white sand of Coral Cays.
- **Lamplight:** after dark each bridge lamp and the dock lantern lay a soft, faintly flickering pool
  of warm light on the planks and the water below; so does every window, lantern, torch and brazier in
  the gardens, each in its own colour, fading in once a build has finished growing.
- **Cabins** have dark corner posts, windows in cream frames with painted shutters and a box of flowers
  beneath each, a step and a lantern at the door, a darker trim along the eaves and ridge, and a
  chimney cap. Stilt houses have framed windows with painted shutters, a darker ridge and a ladder down
  to the water; pagodas have gold tips on their upturned eaves and a red railing round the base. Beach
  huts have lit windows, a striped awning, a surfboard against the wall and a lantern by the door;
  igloos are laid in brick-like blocks of snow, with an ice window that glows. The windmill has a wooden
  gallery with a rail round its waist, shutters, a framed door with a step, flour sacks waiting outside,
  darker eaves and a gold finial; stone lanterns gather moss on the cap and round the foot; benches
  have armrests and dark legs; campfires sit in a ring of ash with embers glowing among the logs; and
  wind chimes hang under a little roof, with sea-glass beads at the ends of the rods.
- **Contact shadow** under the walker's feet, and footprints that fill in slowly. The walker and every
  creature carry a soft rim of sky light round their silhouettes (ember-orange in Hell), so they stand
  out from busy ground.
- **Heaven** has mist pouring from the undersides of its drifting islets; **Hell** has smoke rising
  from Mount Cinder, sparks from its vent, and fountains of sparks thrown up by the lava now and then.
- **Physically based sky:** the colour of every part of the sky comes from single scattering in a
  spherical atmosphere (Rayleigh and Mie scattering, with ozone), marched per pixel, so the zenith is
  deep blue, the horizon pales, the air glows round the sun and sunsets run through orange to pink and
  violet. The same model, evaluated on the CPU, gives the sunlight its colour and tints the sky light,
  fog and sea, so the scene is lit by the sky you see. Each world's palette keeps the brightness and
  the night; Heaven and Hell paint their own skies.
- **Volumetric clouds:** a layer of cumulus is ray-marched across the whole sky, each sample lit by
  how much cloud lies toward the sun, with dark bases, bright tops, silver linings when backlit and
  far clouds fading into the haze; they drift with the wind, thicken with the weather and show in
  the sea's reflection. (Sharp: 10 steps, Balanced: 6, Light: the older painted band.) The sky is drawn
  after everything solid, so this work is done only where sky shows.
- **Sky:** a horizon haze band, a band of soft cumulus along the horizon, a warm glow on the sun's
  side at golden hour, an HDR sun disk, drifting high cirrus, varied stars, a phased moon, aurora and
  rainbows; a halo round Heaven's sun, and smoke lit from below with a blood moon in Hell. Voxel clouds
  have their own shader with sunlit tops, cool undersides and silver linings.
- **Each world its own light:** sky and light colours, fog distance and colour grade are set per world
  (a cool grade for Frost Fjord, a saturated one for Coral Cays, strong sun shafts and soft bloom in
  Heaven, heavy bloom and heat in Hell), with drifting motes in the air: gold in Heaven, embers and ash
  in Hell, dust and diamond dust elsewhere.
- **Meadow grass:** thousands of swaying blade tufts that change with the seasons, are flecked with
  wildflowers in spring and summer, and part around paths and buildings.
- **Wind and cloud:** gusts roll across the islands as travelling patches of stronger wind that flatten
  the grass (which catches the light as it bends) and toss the trees. Each cloud casts a soft shadow,
  projected along the sun's rays, that drifts over land, grass and sea; under it the water loses its
  glitter. The rowboat leaves a spreading foam wake.
- **Quality:** Sharp (everything), Balanced (no reflections or depth of field, half the grass) and
  Light (no post-processing or grass). Unless you chose a level in Settings, slow frames first lower
  the drawing resolution a little and then step down a level; resolution comes back when there is
  room. Shaders are compiled at start, and seasonal recolouring is spread over several frames, so
  weather and seasons change without stutter. A few times after starting, the game checks a grid of
  points for pixels nothing was drawn into; if a device keeps leaving parts of the scene undrawn, it
  switches to Light and says so.

## Design choices and their sources

| Choice | In the game | Source |
|---|---|---|
| Paced breathing near 6/min, long exhale | The world follows the breathing pattern; optional on-screen guide | Lehrer & Gevirtz 2014, *Front. Psychol.*; Zaccaro et al. 2018, *Front. Hum. Neurosci.* |
| Cyclic sighing | One of the breathing patterns | Balban et al. 2023, *Cell Rep. Med.* |
| Water and nature scenes | Island in a calm sea, plants, slow day–night cycle; night is deep blue | White et al. 2010, *J. Environ. Psychol.*; Ulrich et al. 1991, *J. Environ. Psychol.* |
| Soft fascination, being away, extent | Clouds and their drifting shadows, koi, fireflies, falling leaves; six worlds, seventeen islands in the first, bridges and paths to walk and a slow row between them give a world worth wandering | Kaplan 1995, *J. Environ. Psychol.*; Berman, Jonides & Kaplan 2008, *Psychol. Sci.* |
| Watching animals | Koi, reef fish, seals, otters, cranes, squirrels, turtle, ducks, whale | Cracknell et al. 2016, *Environ. Behav.* |
| Mid-complexity fractals | Recursive tree branching; layered-noise clouds | Taylor et al. 2011, *Front. Hum. Neurosci.*; Hagerhall et al. 2008, *Perception* |
| Natural sound | Surf, rain, wind, birds, frogs, crickets | Alvarsson, Wiens & Nilsson 2010, *IJERPH*; Gould van Praag et al. 2017, *Sci. Rep.* |
| A short walk outdoors | Walk mode: wander the bridges and beaches, wade, swim and sit | Barton & Pretty 2010, *Environ. Sci. Technol.* |
| Warm water | Hot springs you can soak in | Haghayegh et al. 2019, *Sleep Med. Rev.* |
| Making music | A handpan with no wrong notes | Fancourt et al. 2016, *PLOS ONE* |
| Firelight | Campfire with crackle | Lynn 2014, *Evol. Psychol.* |
| Slow consonant music with rests | Pentatonic pads with 5 s attacks and silences; sparse melodies | Bernardi, Porta & Sleight 2006, *Heart* |
| Awe | Aurora, whale, shooting stars | Sturm et al. 2022, *Emotion* |
| Gratitude | Something good → a glowing flower | Seligman et al. 2005, *Am. Psychol.*; Emmons & McCullough 2003, *J. Pers. Soc. Psychol.* |
| Discarding thoughts | Let something go → a sky lantern | Briñol, Gascó, Petty & Horcajo 2013, *Psychol. Sci.* |
| Short meditation | Sit for 3–20 minutes | Goyal et al. 2014, *JAMA Intern. Med.* |
| No evaluative threat | No timer, failure state or audience; the journal is not a checklist. Bloom is the one number: it only opens things, and what it opens stays open | Dickerson & Kemeny 2004, *Psychol. Bull.* |
| Low-demand nurturing task | Gardening as the main verb | Van Den Berg & Custers 2011, *J. Health Psychol.*; Russoniello, O'Brien & Parks 2009, *J. CyberTherapy & Rehabil.* |
| Cool, low-saturation colours | Blue/green palette; warm light at golden hour | Valdez & Mehrabian 1994, *J. Exp. Psychol. Gen.* |

These are findings about the ingredients, not a trial of this game. The fractal dimension of the trees
was not measured.

`prefers-reduced-motion`, or **Less motion** in Settings, turns off the camera drift and leaf sway and
lowers the wave height.
