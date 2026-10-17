// Accessibility: colour-blind correction (an SVG colour matrix applied to the canvas element), a safer palette for danger
// telegraphs, bolder outlines for high-contrast mode, and the helpers the renderers call. Colour matrices act on the
// displayed picture only, so photographs and screenshots stay true to the game's own colours.
import { setting } from './settings.js';

// shifts the information a given kind of colour blindness loses into channels that stay distinguishable
const MATRICES = {
  'red-green':   '1 0 0 0 0   0 1 0 0 0   0.7 -0.7 1 0 0   0 0 0 1 0',
  'blue-yellow': '1 0 0 0 0   0.6 1 -0.6 0 0   0 0 1 0 0   0 0 0 1 0',
};
// colours used for danger telegraphs when the usual red/orange would blend into the water
const SAFE = { 'red-green': { '#ff4a3a': '#ff3aa8', '#ff9a3a': '#ffffff', '#ff5a3a': '#ff3aa8', '#ffcf3a': '#ffffff' }, 'blue-yellow': { '#7a62c8': '#ff3a3a', '#9af0ff': '#ffe05a' } };

export class Access {
  constructor(game) {
    this.g = game; game.systems.access = this; this.svg = null; this.canvas = typeof document !== 'undefined' ? document.getElementById('game') : null;
    this.install(); this.apply();
    game.events.on('setting', (k) => { if (k === 'colorblind' || k === 'highContrast') this.apply(); });
  }
  install() {
    if (typeof document === 'undefined' || document.getElementById('mb-access')) return;
    const ns = 'http://www.w3.org/2000/svg', svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('id', 'mb-access'); svg.setAttribute('width', '0'); svg.setAttribute('height', '0'); svg.style.position = 'absolute';
    for (const [name, values] of Object.entries(MATRICES)) {
      const f = document.createElementNS(ns, 'filter'), m = document.createElementNS(ns, 'feColorMatrix');
      f.setAttribute('id', 'mb-' + name); f.setAttribute('color-interpolation-filters', 'sRGB'); m.setAttribute('type', 'matrix'); m.setAttribute('values', values);
      f.appendChild(m); svg.appendChild(f);
    }
    document.body.appendChild(svg); this.svg = svg;
  }
  apply() {
    const mode = setting(this.g, 'colorblind');
    if (this.canvas) this.canvas.style.filter = MATRICES[mode] ? `url(#mb-${mode})` : '';
  }
  get mode() { return setting(this.g, 'colorblind'); }
  get contrast() { return !!setting(this.g, 'highContrast'); }
  // telegraph colour, swapped for a distinguishable one when needed
  tele(color) { const m = SAFE[this.mode]; return (m && m[color.toLowerCase()]) || color; }
  // extra outline pass for a telegraph shape: a black halo under a bright edge
  outline(ctx, t, cam) {
    if (!this.contrast) return;
    ctx.save(); ctx.globalAlpha = 1; ctx.lineWidth = 3; ctx.strokeStyle = '#000000';
    const draw = () => {
      if (t.kind === 'rect') ctx.strokeRect(Math.round(t.x - cam.x) + 0.5, Math.round(t.y - cam.y) + 0.5, t.w - 1, t.h - 1);
      else if (t.kind === 'circle') { ctx.beginPath(); ctx.arc(Math.round(t.x - cam.x) + 0.5, Math.round(t.y - cam.y) + 0.5, t.r, 0, 6.3); ctx.stroke(); }
      else if (t.kind === 'line') { ctx.beginPath(); ctx.moveTo(Math.round(t.x - cam.x), Math.round(t.y - cam.y)); ctx.lineTo(Math.round(t.x2 - cam.x), Math.round(t.y2 - cam.y)); ctx.stroke(); }
    };
    draw(); ctx.lineWidth = 1; ctx.strokeStyle = '#ffffff'; draw(); ctx.restore();
  }
}
