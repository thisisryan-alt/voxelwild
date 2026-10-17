// Codex: unlocked lore entries, read via murals, pearls and dialogue.
import { LORE } from '../data/lore.js';

export class Codex {
  constructor(game) { this.g = game; game.systems.codex = this; }
  has(id) { return !!this.g.state.codex[id]; }
  unlock(id, silent) {
    if (!LORE[id] || this.g.state.codex[id]) return false;
    this.g.state.codex[id] = true;
    if (!silent) { this.g.toast('Codex: ' + LORE[id].title, '#c0f0ff'); this.g.audio.sfx('pickup'); }
    this.g.events.emit('codex', id); return true;
  }
  // shown when interacting with a mural or pearl
  read(id) {
    const e = LORE[id]; if (!e) return;
    const fresh = this.unlock(id, true);
    this.g.playScene.dialogue.open([{ speaker: e.title, text: e.text, color: '#c0f0ff' }], () => { if (fresh) { this.g.toast('Codex updated', '#c0f0ff'); this.g.state.stats.secrets++; } });
  }
  count() { return Object.keys(this.g.state.codex).length; }
  total() { return Object.keys(LORE).length; }
}
