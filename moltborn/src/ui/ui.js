// Shared pixel-UI helpers: panels, bars, buttons — drawn with fillRect so they stay crisp at any scale.
import { drawText, textWidth, wrapText, FONT } from '../gfx/font.js';
export { drawText, textWidth, wrapText, FONT };

export const COL = {
  panel: '#0c1830', panel2: '#142848', border: '#4a7ab8', borderLit: '#9ad8ff', text: '#e8f4ff', dim: '#8aa4c8', gold: '#ffd84a', red: '#ff5a4a', green: '#7aff9a', blue: '#6ab0ff', pink: '#ff9ad8', shadow: '#050a14',
};

export function panel(ctx, x, y, w, h, o = {}) {
  const { fill = COL.panel, border = COL.border, alpha = 0.92, inner = null } = o;
  ctx.globalAlpha = alpha; ctx.fillStyle = fill; ctx.fillRect(x + 1, y, w - 2, h); ctx.fillRect(x, y + 1, w, h - 2); ctx.globalAlpha = 1;
  ctx.fillStyle = border; ctx.fillRect(x + 1, y, w - 2, 1); ctx.fillRect(x + 1, y + h - 1, w - 2, 1); ctx.fillRect(x, y + 1, 1, h - 2); ctx.fillRect(x + w - 1, y + 1, 1, h - 2);
  if (inner) { ctx.fillStyle = inner; ctx.fillRect(x + 2, y + 2, w - 4, 1); }
}
export function bar(ctx, x, y, w, h, pct, c1, c2, back = '#1a0f20') {
  pct = Math.max(0, Math.min(1, pct));
  ctx.fillStyle = '#05030a'; ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
  ctx.fillStyle = back; ctx.fillRect(x, y, w, h);
  const fw = Math.round(w * pct); if (fw > 0) { ctx.fillStyle = c1; ctx.fillRect(x, y, fw, h); ctx.fillStyle = c2; ctx.fillRect(x, y, fw, Math.max(1, Math.floor(h / 3))); }
}
export function text(ctx, s, x, y, color = COL.text, o = {}) { drawText(ctx, s, x, y, { color, shadow: COL.shadow, ...o }); }
export function button(ctx, label, x, y, w, h, sel) {
  panel(ctx, x, y, w, h, { fill: sel ? '#1e4a7a' : COL.panel, border: sel ? COL.borderLit : COL.border });
  drawText(ctx, label, x + w / 2, y + (h - 8) / 2 + 1, { color: sel ? '#ffffff' : COL.dim, align: 'center', shadow: COL.shadow });
}
export const pct = (a, b) => (b > 0 ? a / b : 0);
