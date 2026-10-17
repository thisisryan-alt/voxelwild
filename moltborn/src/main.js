import { Game } from './game.js';
import { TitleScene } from './ui/screens.js';
const q = new URLSearchParams(location.search);
if (q.get('gallery') === 'world') { const g = await import('./dev/gallery.js'); g.galleryWorld(); }
else if (q.has('gallery')) { const { gallery } = await import('./dev/gallery.js'); gallery(q.get('gallery')); }
else {
  const canvas = document.getElementById('game');
  const game = new Game(canvas);
  window.__game = game; game.devMode = q.has('dev');
  // direct boot while the title screen is built: ?zone=reef_nursery
  const z = q.get('zone') || 'reef_nursery';
  if (q.has('quick')) game.newGame(0); else game.engine.push(new TitleScene(game));
  if (!q.has('manual')) game.engine.start();
}
