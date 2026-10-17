// Shared colour ramps (dark -> light). Hues follow the reference art: saturated, outlined, banded.
import { Ramp } from './painter.js';

export const OUTLINE = '#170d1c';
export const R = {
  // creatures / hero
  shore:    new Ramp(['#5c1424', '#a32428', '#d8452e', '#f2793a', '#ffc77a']),
  shoreFar: new Ramp(['#3d0f22', '#7a1c26', '#a8332b', '#c65a33', '#e8a066']),
  belly:    new Ramp(['#6b3a3a', '#a86a58', '#d89a78', '#f2c8a0', '#fff0d0']),
  eyeWhite: new Ramp(['#8aa0c8', '#c8d6ee', '#f2f6ff', '#ffffff', '#ffffff']),
  steel:    new Ramp(['#1e2a4a', '#34508a', '#4f7cc4', '#7fb0ea', '#c8e6ff']),
  crimson:  new Ramp(['#3a0a1e', '#7a1038', '#b81f4a', '#e8506a', '#ffa0a8']),
  abyssal:  new Ramp(['#150f2e', '#2a1f58', '#4a3a8c', '#7a62c8', '#b8a4ff']),
  venom:    new Ramp(['#0e2a1c', '#14543a', '#23915a', '#5ad084', '#b8ffb0']),
  lumen:    new Ramp(['#0a2038', '#124a7a', '#1e88b8', '#58d0e8', '#d0ffff']),
  bone:     new Ramp(['#3a3044', '#6a5a6a', '#a89a90', '#d8cdb8', '#f8f0dc']),
  leviathan:new Ramp(['#1a1424', '#3a2e48', '#665a70', '#9a8c94', '#d0c4b8']),
  pearl:    new Ramp(['#5a6a9a', '#9aa8d8', '#d0dcf8', '#f4f0ff', '#ffffff']),
  gold:     new Ramp(['#6a3a06', '#c4720a', '#ffb21a', '#ffd84a', '#fff6a8']),
  // flora / world (match reference)
  seaweed:  new Ramp(['#1f5a2a', '#2f8a2c', '#58b82a', '#8ed12b', '#d0f27a']),
  coralPink:new Ramp(['#5a1c58', '#8e3a7e', '#c85a96', '#e87e90', '#ffb0a8']),
  coralRed: new Ramp(['#6a1010', '#a81c1c', '#d93a2a', '#f26a48', '#ff9a78']),
  coralBlue:new Ramp(['#16285a', '#2a4a9a', '#4a7ad8', '#7ab0f2', '#c0e0ff']),
  coralOrange:new Ramp(['#7a2a08', '#c4541a', '#f28a2a', '#ffb44a', '#ffe08a']),
  rock:     new Ramp(['#3a4466', '#5a6690', '#8896bc', '#b0bcdc', '#dce4f8']),
  rockDark: new Ramp(['#161a2e', '#262e4a', '#3a4668', '#56668e', '#7e90b8']),
  sand:     new Ramp(['#c89c5e', '#dcb27a', '#eecb94', '#f8dfae', '#fff2d4']),
  wood:     new Ramp(['#2a1810', '#4a2c1c', '#6e4428', '#946034', '#c08a52']),
  rust:     new Ramp(['#2a1410', '#5a2a1c', '#8a4426', '#b8683a', '#e0944e']),
  jelly:    new Ramp(['#5a2a6a', '#9a4a9a', '#d070c0', '#f09ad8', '#ffd0f0']),
  ghost:    new Ramp(['#2a4a5a', '#4a7a8a', '#80b8c0', '#b8e8e8', '#f0ffff']),
  fishBlue: new Ramp(['#12305a', '#1e5a9a', '#2a8ad0', '#5ac0f0', '#b0f0ff']),
  fishYellow:new Ramp(['#6a4a06', '#c48a0a', '#f2c21a', '#ffe65a', '#fff8b0']),
  fishRed:  new Ramp(['#5a1020', '#a81c34', '#e03a4a', '#ff7a6a', '#ffc0a8']),
  fishGreen:new Ramp(['#0e3a2a', '#1e6a3a', '#38a44a', '#78d86a', '#d0ffa8']),
  fishGrey: new Ramp(['#20283a', '#3a4a62', '#627a94', '#92acc0', '#d0e4f0']),
  void:     new Ramp(['#07040f', '#150a2a', '#2a1450', '#4a2490', '#8a5ae0']),
  marble:   new Ramp(['#2a4a6a', '#5a8aaa', '#98c0d4', '#d0e8f0', '#ffffff']),
  divine:   new Ramp(['#12506a', '#1e8a9a', '#40c8c8', '#9af0e0', '#f0fff8']),
  trident:  new Ramp(['#6a4a06', '#c48a0a', '#f2c21a', '#ffe65a', '#ffffff']),
  chain:    new Ramp(['#1a1a22', '#3a3a48', '#6a6a7a', '#9a9aaa', '#d0d0e0']),
  glass:    new Ramp(['#1a4a5a', '#2a8a9a', '#50c8d0', '#a0f0f0', '#ffffff']),
};
