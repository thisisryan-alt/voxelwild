// Developer console, available only with ?dev=1 in the URL: F9 opens it. Commands change the live game, so it is meant for
// testing and balancing, never for normal play. `help` lists everything.
import { text, panel } from '../ui/ui.js';
import { ITEMS } from '../data/items.js';
import { ENEMIES } from '../data/enemies.js';
import { FORMS } from '../data/forms.js';
import { ZONE_INFO } from '../data/zoneinfo.js';
import { STATUS } from '../systems/status.js';
import { ACHIEVEMENTS } from '../data/achievements.js';
import { RIFT_TIERS } from '../data/relics.js';
import { Enemy } from '../entities/enemy.js';

const num = (v, d = 1) => (v === undefined || isNaN(+v) ? d : +v);

export const COMMANDS = {
  help: { args: '', run: () => ['Commands: ' + Object.keys(COMMANDS).join(', '), 'Type a command name with no arguments to see its usage.'] },
  give: { args: '<item> [n]', run: (g, [id, n]) => { if (!ITEMS[id]) return [`No item '${id}'`]; g.grantItem(id, num(n), false); return [`Gave ${num(n)} ${ITEMS[id].name}`]; } },
  coins: { args: '<n>', run: (g, [n]) => { g.state.coins += num(n, 100); return [`Coins: ${g.state.coins}`]; } },
  xp: { args: '<n>', run: (g, [n]) => { g.giveXp(num(n, 100), g.world.player.x, g.world.player.y); return [`Level ${g.state.level}`]; } },
  level: { args: '<n>', run: (g, [n]) => { g.state.level = Math.max(1, Math.min(30, num(n, 10))); g.state.xp = 0; g.world.player.recalc(); return [`Level ${g.state.level}`]; } },
  form: { args: '<id>', run: (g, [id]) => { if (!FORMS[id]) return [`Forms: ${Object.keys(FORMS).join(', ')}`]; g.state.form = id; g.world.player.setForm(id); return [`Form ${id}`]; } },
  tp: { args: '<zone> [entry]', run: (g, [z, e]) => { if (!ZONE_INFO[z]) return ['Zones: ' + Object.keys(ZONE_INFO).join(', ')]; g.buildWorld(z, e, { silentBanner: true }); return [`In ${z}`]; } },
  heal: { args: '', run: (g) => { const p = g.world.player; p.hp = p.stats.maxHp; p.tide = p.stats.maxTide; p.fury = 100; return ['Restored']; } },
  god: { args: '', run: (g) => { g.god = !g.god; return [`God mode ${g.god ? 'on' : 'off'}`]; } },
  killall: { args: '', run: (g) => { let n = 0; const p = g.world.player; for (const e of g.world.enemies) if (e.alive && !e.def.friendly && !e.def.boss) { e.takeHit({ dmg: 1e6, dir: 1, guardBreak: true }, p); e.takeHit({ dmg: 1e6, dir: 1, guardBreak: true }, p); e.takeHit({ dmg: 1e6, dir: 1, guardBreak: true }, p); n++; } return [`Struck ${n} foes`]; } },
  spawn: { args: '<type> [n]', run: (g, [t, n]) => { if (!ENEMIES[t]) return ['No such creature']; const w = g.world, p = w.player; for (let i = 0; i < num(n); i++) w.enemies.push(new Enemy(w, t, p.x + 40 + i * 16, p.y - 4, {})); return [`Spawned ${num(n)} ${t}`]; } },
  flag: { args: '<name> [0|1]', run: (g, [f, v]) => { g.setFlag(f, v === '0' ? false : true); return [`${f} = ${g.flag(f)}`]; } },
  boss: { args: '<key>', run: (g, [k]) => { g.state.bosses[k] = true; return [`${k} marked defeated`]; } },
  status: { args: '<id> [seconds]', run: (g, [id, s]) => { if (!STATUS[id]) return ['Statuses: ' + Object.keys(STATUS).join(', ')]; g.world.player.status.apply(id, { dur: num(s, 20) }); return [`Applied ${id}`]; } },
  rift: { args: '[tier]', run: (g, [t]) => { const tier = RIFT_TIERS.find((x) => x.id === t) || RIFT_TIERS[0]; g.engine.pop(); g.systems.rifts.start({ tier: tier.id }); return []; } },
  arena: { args: '', run: (g) => { g.engine.pop(); g.systems.arena.start(); return []; } },
  trophy: { args: '<id|all>', run: (g, [id]) => { const A = g.systems.achievements; let n = 0; for (const a of ACHIEVEMENTS) if ((id === 'all' || a.id === id) && A.award(a, true)) n++; return [`Awarded ${n}`]; } },
  elite: { args: '<affix>', run: (g, [a]) => { const e = g.world.enemies.find((x) => x.alive && !x.def.friendly && !x.def.boss && !x.affixes); if (!e) return ['No candidate foe']; g.systems.elites.apply(e, [a]); return [`${e.name}`]; } },
  time: { args: '[dawn|day|dusk|night|0..1]', run: (g, [t]) => { const C = g.systems.clock; if (t !== undefined) { const n = parseFloat(t); C.jump(Number.isFinite(n) ? n : t); C.update(0); } return [`${C.phase.name} (${C.frac().toFixed(2)}), next phase in ${Math.round(C.untilNext())}s`]; } },
  items: { args: '[filter]', run: (g, [f]) => [Object.keys(ITEMS).filter((k) => !f || k.includes(f)).slice(0, 40).join(', ')] },
  stats: { args: '', run: (g) => { const p = g.world.player, S = p.stats; return [`hp ${Math.round(p.hp)}/${S.maxHp} atk ${S.atk.toFixed(1)} def ${S.def} speed ${S.speed.toFixed(2)} crit ${S.crit}`, `diff ${JSON.stringify(g.systems.difficulty.scale())}`]; } },
};

export class DevConsole {
  constructor(game) {
    this.g = game; this.opaque = false; this.line = ''; this.out = ['Moltborn console. Type help.']; this.hist = []; this.hi = -1; this.t = 0;
    this.onKey = (e) => this.key(e); window.addEventListener('keydown', this.onKey, true);
  }
  onEnter() { this.g.input.clearAll(); }
  onExit() { window.removeEventListener('keydown', this.onKey, true); }
  key(e) {
    if (this.g.engine.top !== this) return;
    e.preventDefault(); e.stopPropagation();
    if (e.code === 'Escape' || e.code === 'F9') { this.g.engine.pop(); return; }
    if (e.code === 'Enter') { this.exec(this.line); this.line = ''; return; }
    if (e.code === 'Backspace') { this.line = this.line.slice(0, -1); return; }
    if (e.code === 'ArrowUp') { this.hi = Math.min(this.hist.length - 1, this.hi + 1); this.line = this.hist[this.hist.length - 1 - this.hi] || ''; return; }
    if (e.code === 'ArrowDown') { this.hi = Math.max(-1, this.hi - 1); this.line = this.hi < 0 ? '' : this.hist[this.hist.length - 1 - this.hi]; return; }
    if (e.key.length === 1 && this.line.length < 70) this.line += e.key;
  }
  exec(src) {
    const parts = src.trim().split(/\s+/).filter(Boolean); if (!parts.length) return;
    this.hist.push(src); this.hi = -1; this.out.push('> ' + src);
    const cmd = COMMANDS[parts[0]];
    if (!cmd) this.out.push(`Unknown command '${parts[0]}'`);
    else { try { this.out.push(...(cmd.run(this.g, parts.slice(1)) || [])); } catch (err) { this.out.push('Error: ' + err.message); } }
    while (this.out.length > 14) this.out.shift();
  }
  update(dt) { this.t += dt; }
  draw(ctx) {
    panel(ctx, 4, 4, 472, 150, { alpha: 0.9, border: '#4a8a4a' });
    this.out.forEach((l, i) => text(ctx, l.slice(0, 110), 10, 10 + i * 9, l.startsWith('>') ? '#9aff9a' : '#c8e8c8'));
    text(ctx, '> ' + this.line + (Math.floor(this.t * 2) % 2 ? '_' : ' '), 10, 142, '#ffffff');
  }
}
