// Entry: the worker source ships inside the page (a text/plain script) and runs from a blob URL.
import { Game } from './main/game.js';
import { UI } from './main/ui.js';
import { BLOCKS, FAMS, FAM, C, I, RECIPES, ITEMS, LAYER_NAMES } from './shared/blocks.js';
import { raycast, targetable } from './main/player.js';
import { structuresIn } from './shared/structures.js';
import { terrainFor } from './shared/gen.js';
import { skyTemples } from './shared/skylands.js';

const src = document.getElementById('worker-src');
const workerUrl = window.VOXELWILD_WORKER_URL || URL.createObjectURL(new Blob([src.textContent], { type: 'text/javascript' }));
const game = new Game(document.getElementById('view'), workerUrl, window.VOXELWILD_ASSETS || 'assets/');
const ui = new UI(game);
window.voxelwild = { game, ui, blocks: BLOCKS, blocksMod: { FAMS, FAM, C }, items: I, itemsDefs: ITEMS, layerNames: LAYER_NAMES, recipes: RECIPES, playerMod: { raycast, targetable }, structures: { structuresIn, terrainFor }, skyTemples };
ui.boot().catch((e) => ui.fatal(e));
// when a new version of the page is published while it is open, save the world first
try { window.claude?.hot?.snapshot?.(() => { game.save(); return {}; }); } catch { /* not in the viewer */ }
