import { Game } from './game.js';
const q = new URLSearchParams(location.search);
if (q.get('gallery') === 'world') { const g = await import('./dev/gallery.js'); g.galleryWorld(); }
else if (q.has('gallery')) { const { gallery } = await import('./dev/gallery.js'); gallery(q.get('gallery')); }
else {
  const canvas = document.getElementById('game');
  const game = new Game(canvas);
  window.__game = game;
  // direct boot while the title screen is built: ?zone=reef_nursery
  const z = q.get('zone') || 'reef_nursery';
  game.newGame(0);
  if (!q.has('manual')) game.engine.start();
}
