// Controller rumble (and a short phone buzz on touch devices) for the moments worth feeling: taking a hit, a heavy
// blow landing, a boss slam, dying. Strength follows the "Controller rumble" option; with it at zero nothing is sent.
import { setting } from '../systems/settings.js';
import { clamp } from './util.js';

export class Haptics {
  constructor(game) {
    this.g = game; game.systems.haptics = this; this.last = 0; this.log = [];
    const ev = game.events;
    ev.on('hurt', (n, src, blocked) => { const m = game.world?.player?.stats?.maxHp || 100; this.rumble(blocked ? 0.25 : clamp(0.35 + n / m, 0.35, 1), blocked ? 90 : 160); });
    ev.on('hitdealt', (e, dmg, crit, hb) => { if (crit || hb?.heavy) this.rumble(crit ? 0.4 : 0.3, 80, 0.2); });
    ev.on('bigshake', (x, y, a) => this.rumble(clamp(a / 10, 0.3, 0.9), 220));
    ev.on('playerdied', () => this.rumble(1, 600));
    ev.on('boss', () => this.rumble(0.8, 500));
    ev.on('trophy', () => this.rumble(0.3, 120));
  }

  // strong = low-frequency motor, weak = high-frequency motor (defaults to a fraction of strong)
  rumble(strong, ms = 120, weak = strong * 0.6) {
    const k = setting(this.g, 'haptics'); if (!k) return;
    const now = performance.now(); if (now - this.last < 60) return; this.last = now;
    const s = clamp(strong * k, 0, 1), w = clamp(weak * k, 0, 1);
    this.log.push({ s, w, ms }); if (this.log.length > 20) this.log.shift();
    try {
      const pads = navigator.getGamepads ? [...navigator.getGamepads()].filter((p) => p && p.connected) : [];
      for (const p of pads) {
        const act = p.vibrationActuator;
        if (act?.playEffect) act.playEffect('dual-rumble', { startDelay: 0, duration: ms, strongMagnitude: s, weakMagnitude: w }).catch(() => {});
        else if (p.hapticActuators?.[0]?.pulse) p.hapticActuators[0].pulse(s, ms).catch?.(() => {});
      }
      if (!pads.length && this.g.input.lastDevice === 'touch' && navigator.vibrate) navigator.vibrate(Math.round(ms * s));
    } catch (e) { /* rumble is a luxury */ }
  }
}
