// Biome look-and-feel: water colours, tile material ramps, atmosphere, music and ambience ids.
import { Ramp } from '../gfx/painter.js';
import { R } from '../gfx/palette.js';
import { T } from '../world/tiles.js';

const ramp = (a) => new Ramp(a);
const stone = (c) => ramp(c);

export const BIOMES = {
  reef: {
    id: 'reef', name: 'The Starting Reef', top: '#46c8e0', bottom: '#12609a', tint: '#7ad8ff', tintA: 0.10, dark: 0, fog: 0.18,
    mats: {
      [T.GROUND]: R.sand,
      [T.ROCK]: stone(['#40304c', '#644860', '#8c6a76', '#b48e8c', '#e0bcae']),
      [T.CORAL]: R.coralPink, [T.RUIN]: stone(['#3a4a6a', '#58709a', '#84a0c4', '#b4d0e4', '#e8f6ff']),
      [T.WOOD]: R.wood, [T.BONE]: R.bone, [T.DIVINE]: R.marble, [T.OBSID]: R.rockDark,
    },
    particles: 'motes', music: 'reef', amb: 'shallows', rays: true,
  },
  forest: {
    id: 'forest', name: 'The Sunken Forest', top: '#2aa890', bottom: '#0a3c4a', tint: '#58d090', tintA: 0.16, dark: 0.1, fog: 0.3,
    mats: {
      [T.GROUND]: ramp(['#3a3c1e', '#585a2c', '#7a7c3e', '#a2a45c', '#cccc88']),
      [T.ROCK]: ramp(['#14281e', '#244a38', '#3a6e50', '#5a9670', '#90c8a0']),
      [T.CORAL]: R.coralOrange, [T.RUIN]: ramp(['#243428', '#3e5a48', '#628468', '#90b494', '#c8e4c4']),
      [T.WOOD]: R.wood, [T.BONE]: R.bone, [T.DIVINE]: R.marble, [T.OBSID]: R.rockDark,
    },
    particles: 'spores', music: 'forest', amb: 'forest', rays: true,
  },
  kingdom: {
    id: 'kingdom', name: 'The Coral Kingdom', top: '#4a8cf0', bottom: '#1a2a78', tint: '#c07aff', tintA: 0.10, dark: 0, fog: 0.22,
    mats: {
      [T.GROUND]: ramp(['#7a4a6a', '#a8688a', '#d890a8', '#f8b8c0', '#ffe4de']),
      [T.ROCK]: ramp(['#2a2058', '#483a88', '#6a5cb4', '#948ae0', '#c8c4ff']),
      [T.CORAL]: R.coralPink, [T.RUIN]: ramp(['#5a4a78', '#8a78a8', '#b8a8cc', '#e4d8ec', '#fff8ff']),
      [T.WOOD]: R.wood, [T.BONE]: R.bone, [T.DIVINE]: R.marble, [T.OBSID]: R.rockDark,
    },
    particles: 'pearls', music: 'kingdom', amb: 'kingdom', rays: true,
  },
  graveyard: {
    id: 'graveyard', name: 'The Ship Graveyard', top: '#2c6a6a', bottom: '#0a1e28', tint: '#6aa8a0', tintA: 0.22, dark: 0.25, fog: 0.42,
    mats: {
      [T.GROUND]: ramp(['#2a2a26', '#444438', '#686654', '#8e8c74', '#b8b498']),
      [T.ROCK]: ramp(['#10181e', '#1e2c36', '#324656', '#4c6678', '#78929e']),
      [T.CORAL]: R.coralBlue, [T.RUIN]: R.rust, [T.WOOD]: R.wood, [T.BONE]: R.bone, [T.DIVINE]: R.marble, [T.OBSID]: R.rockDark,
    },
    particles: 'debris', music: 'graveyard', amb: 'wrecks', rays: false,
  },
  abyss: {
    id: 'abyss', name: 'The Abyss', top: '#0e2250', bottom: '#020510', tint: '#3a58c0', tintA: 0.2, dark: 0.54, fog: 0.55, rim: 3,
    mats: {
      [T.GROUND]: ramp(['#10102a', '#26265a', '#3e3e86', '#5e5ebc', '#8a8aec']),
      [T.ROCK]: ramp(['#0a0a1a', '#1c1c3c', '#34346a', '#50509a', '#7a7ac8']),
      [T.CORAL]: R.coralBlue, [T.RUIN]: ramp(['#0e1a2a', '#1e3a4e', '#34607a', '#5a90a8', '#98c8d8']),
      [T.WOOD]: R.wood, [T.BONE]: R.bone, [T.DIVINE]: R.marble, [T.OBSID]: R.rockDark,
    },
    particles: 'snow', music: 'abyss', amb: 'abyss', rays: false,
  },
  trench: {
    id: 'trench', name: 'Trench of the Forgotten', top: '#2a0a3a', bottom: '#050208', tint: '#a040c0', tintA: 0.2, dark: 0.46, fog: 0.5, rim: 3,
    mats: {
      [T.GROUND]: ramp(['#1c0e28', '#3e2250', '#643a80', '#8c5aa8', '#c090d4']),
      [T.ROCK]: ramp(['#12081c', '#2a1640', '#46266a', '#6a3c94', '#946cc0']),
      [T.CORAL]: R.coralRed, [T.RUIN]: ramp(['#241a30', '#44364e', '#6e5c76', '#a094a4', '#d8ccd4']),
      [T.WOOD]: R.wood, [T.BONE]: R.bone, [T.DIVINE]: R.marble, [T.OBSID]: R.void,
    },
    particles: 'ash', music: 'trench', amb: 'trench', rays: false,
  },
  domain: {
    id: 'domain', name: "Poseidon's Domain", top: '#1a7a9a', bottom: '#06223a', tint: '#40e0d0', tintA: 0.16, dark: 0.2, fog: 0.3,
    mats: {
      [T.GROUND]: ramp(['#1a4a5a', '#2e7a88', '#52a8b0', '#98d8d0', '#e0fff4']),
      [T.ROCK]: ramp(['#0a2a3e', '#164a62', '#2a7488', '#4ca0aa', '#8cd0cc']),
      [T.CORAL]: R.coralBlue, [T.RUIN]: R.marble, [T.WOOD]: R.wood, [T.BONE]: R.bone, [T.DIVINE]: R.divine, [T.OBSID]: R.rockDark,
    },
    particles: 'sparks', music: 'domain', amb: 'domain', rays: true,
  },
};
