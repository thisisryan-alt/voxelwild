// Entry: the worker source ships inside the page (a text/plain script) and runs from a blob URL.
import { Game } from './main/game.js';
import { UI } from './main/ui.js';
import { BLOCKS, FAMS, FAM } from './shared/blocks.js';
import { raycast, targetable } from './main/player.js';

const src = document.getElementById('worker-src');
const workerUrl = window.VOXELWILD_WORKER_URL || URL.createObjectURL(new Blob([src.textContent], { type: 'text/javascript' }));
const game = new Game(document.getElementById('view'), workerUrl, window.VOXELWILD_ASSETS || 'assets/');
const ui = new UI(game);
window.voxelwild = { game, ui, blocks: BLOCKS, blocksMod: { FAMS, FAM }, playerMod: { raycast, targetable } };
ui.boot().catch((e) => ui.fatal(e));
// when a new version of the page is published while it is open, save the world first
try { window.claude?.hot?.snapshot?.(() => { game.save(); return {}; }); } catch { /* not in the viewer */ }
