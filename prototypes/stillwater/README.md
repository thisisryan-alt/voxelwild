# Stillwater

A small voxel island built to be as calming as the research allows. It is a browser prototype, separate
from the Unity project: open `index.html` in a browser. The page loads three.js r128 from cdnjs and its
fonts from Google Fonts; everything else is in `js/`.

## What is on the island

- **Garden:** 7 trees (oak, maple, birch, cherry, willow, pine, palm), 8 plants (wildflowers, tulips,
  lavender, sunflowers, ferns, mushrooms, berry bush, dune grass) and 2 water plants (lily pads with lotus,
  reeds). Trees grow by recursive branching over about 30 seconds.
- **Build:** stone lantern, wind chime, bench, campfire, stone stack, birdhouse, stepping stones, cabin
  with a smoking chimney and lit windows.
- **Seasons:** one season per in-game day. Leaves turn and fall, cherry petals drift in spring, flowers rest
  in winter, snow settles on the ground and the pines.
- **Weather:** clear, cloudy, rain (with rings on the water), fog and snow, changing on its own or set by
  hand. Rainbows after rain when the sun is low. Aurora on some nights, a moon with an eight-day cycle,
  shooting stars you can tap to make a wish, and glowing water at night.
- **Visitors:** koi, pond goldfish, butterflies, gulls, songbirds, ducks with ducklings, frogs, rabbits,
  crabs, a heron, dragonflies, an owl, a cat asleep on the dock, a sea turtle, leaping fish, a whale and a
  passing sailboat. Many can be tapped. A lighthouse turns its beam at dusk.
- **Rituals:** drop a pebble, skip a stone, let a thought go on a sky lantern (the words are never saved),
  plant a glowing flower for something good (kept in the journal), or sit for 3–20 minutes with a singing
  bowl at each end.
- **Breathing:** five patterns (six a minute, even, cyclic sigh, box, 4-7-8). The tide, foam line, dock
  lantern, the cat and the surf all follow the chosen pattern.
- **Views:** island orbit, end of the dock, beach at sunset, pond, high above, and a slow drifting camera.
- **Sound:** all synthesised live, with a mixer for waves, wind, rain, wildlife, frogs and crickets, fire,
  chimes and music.
- **Journal:** field notes for 28 visitors and sights, the good things you have written, and the research
  behind each design choice.

The garden, journal, settings and time of day are saved in the browser's local storage.

**Keys:** B breath guide · M sound · H hide controls · J journal · V next view · Esc close.

## Files

| File | Contents |
|---|---|
| `js/core.js` | Constants, noise, seasonal palettes, storage, shared state |
| `js/world.js` | Renderer, sky (sun, moon, stars, aurora, rainbow), weather, terrain, water, lighthouse, clouds, dock |
| `js/garden.js` | Voxel growth system, seasonal recolouring, plant and building catalog, placement rules |
| `js/life.js` | Creatures, particles, sky lanterns, skipping stones |
| `js/audio.js` | Synthesised soundscape and mixer |
| `js/main.js` | Input, camera views, breathing patterns, journal, rituals, saving and UI |

## Design choices and their sources

| Choice | In the game | Source |
|---|---|---|
| Paced breathing near 6/min, long exhale | The world follows the breathing pattern; optional on-screen guide | Lehrer & Gevirtz 2014, *Front. Psychol.*; Zaccaro et al. 2018, *Front. Hum. Neurosci.* |
| Cyclic sighing | One of the breathing patterns | Balban et al. 2023, *Cell Rep. Med.* |
| Water and nature scenes | Island in a calm sea, plants, slow day–night cycle; night is deep blue | White et al. 2010, *J. Environ. Psychol.*; Ulrich et al. 1991, *J. Environ. Psychol.* |
| Soft fascination and extent | Clouds, koi, fireflies, falling leaves; seasons and weather give a world worth wandering | Kaplan 1995, *J. Environ. Psychol.*; Berman, Jonides & Kaplan 2008, *Psychol. Sci.* |
| Watching animals | Fish, turtle, ducks, whale | Cracknell et al. 2016, *Environ. Behav.* |
| Mid-complexity fractals | Recursive tree branching; layered-noise clouds | Taylor et al. 2011, *Front. Hum. Neurosci.*; Hagerhall et al. 2008, *Perception* |
| Natural sound | Surf, rain, wind, birds, frogs, crickets | Alvarsson, Wiens & Nilsson 2010, *IJERPH*; Gould van Praag et al. 2017, *Sci. Rep.* |
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
