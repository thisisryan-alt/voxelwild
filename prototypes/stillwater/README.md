# Stillwater

A small voxel island built to be as calming as the research allows. It is a browser prototype, separate
from the Unity project: open `index.html` in a browser. The page loads three.js r128 from cdnjs and its
fonts from Google Fonts.

**Controls:** tap grass to plant (Oak, Blossom or Flowers; keys 1–3), tap water to drop a pebble, drag
to orbit, scroll or pinch to zoom. `B` toggles the breath guide and `M` toggles sound. The garden is
saved in the browser's local storage.

## Design choices and their sources

| Choice | In the game | Source |
|---|---|---|
| Paced breathing at ~6/min, exhale longer than inhale | Tide height, foam line, lantern and surf sound all follow a 10 s cycle (4 s in, 6 s out). Optional on-screen guide. | Lehrer & Gevirtz 2014, *Front. Psychol.*; Zaccaro et al. 2018, *Front. Hum. Neurosci.* |
| Water and nature scenes | Island in a calm sea, plants, slow day–night cycle (16 min), night is deep blue, not black | White et al. 2010, *J. Environ. Psychol.*; Ulrich et al. 1991, *J. Environ. Psychol.* |
| Soft fascination | Drifting clouds and cloud shadows, koi, fireflies, falling petals, leaf sway, slow camera drift when idle | Kaplan 1995, *J. Environ. Psychol.*; Berman, Jonides & Kaplan 2008, *Psychol. Sci.* |
| Mid-complexity fractals | Trees grow by recursive branching (2–3 limbs, ~0.72 length ratio); clouds from layered noise | Taylor et al. 2011, *Front. Hum. Neurosci.*; Hagerhall et al. 2008, *Perception* |
| Natural sound | Synthesised surf, wind, birds by day and crickets at night | Alvarsson, Wiens & Nilsson 2010, *IJERPH*; Gould van Praag et al. 2017, *Sci. Rep.* |
| Slow consonant music with rests | Pentatonic pads with 5 s attacks, about 21 s of sound then a rest; sparse chimes | Bernardi, Porta & Sleight 2006, *Heart* |
| No evaluative threat | No score, timer, failure state, notifications or audience | Dickerson & Kemeny 2004, *Psychol. Bull.* |
| Low-demand nurturing task | Gardening as the only verb | Van Den Berg & Custers 2011, *J. Health Psychol.*; Russoniello, O'Brien & Parks 2009, *J. CyberTherapy & Rehabil.* |
| Cool, low-saturation colours | Blue/green palette, warm light only at golden hour | Valdez & Mehrabian 1994, *J. Exp. Psychol. Gen.* |

These are findings about the ingredients, not a trial of this game. The fractal dimension of the trees
was not measured.

`prefers-reduced-motion` turns off the camera drift and leaf sway and lowers the wave height.
