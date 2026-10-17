// Quest log: start/advance/complete quests driven by game events; tracks the active main objective.
import { QUESTS } from '../data/quests.js';
import { ITEMS } from '../data/items.js';

const REWARDS = {
  mq1: { xp: 20 }, mq2: { xp: 60, coins: 40 }, mq3: { xp: 40, sp: 1 }, mq4: { xp: 140, coins: 80 }, mq5: { xp: 220, coins: 150 }, mq6: { xp: 320, coins: 200 }, mq7: { xp: 200, sp: 1 },
  mq8: { xp: 400, coins: 300 }, mq9: { xp: 400, sp: 2 }, mq10: { xp: 300, sp: 1 }, mq11: { xp: 600, coins: 400 }, mq12: { xp: 400, sp: 2 }, mq13: { xp: 2000 },
  sq_tessa: { xp: 50, coins: 40 }, sq_choir: { xp: 80, items: { mut_echo: 1 } }, sq_atlas: { xp: 100, coins: 120 }, sq_ledger: { xp: 150 }, sq_inkwell: { xp: 120 },
  sq_board: { xp: 400, coins: 300, items: { charm_riftshard: 1 } }, sq_hobb: { xp: 140, items: { captain_key: 1 } }, sq_lantern: { xp: 160, items: { charm_lantern: 1 } }, sq_siblings: { xp: 300, sp: 2 }, sq_pearls: { xp: 500, sp: 2 }, sq_tyrant: { xp: 200, black_pearl: 2, items: { dye_albino: 1 } },
};

export class Quests {
  constructor(game) {
    this.g = game; game.systems.quests = this; this.busy = false;
    for (const ev of ['flag', 'item', 'gotitem', 'kill', 'zone', 'boss', 'evolved', 'chest', 'pickup']) game.events.on(ev, () => this.check());
  }
  get log() { return this.g.state.quests; }
  start(id, silent) {
    if (!QUESTS[id] || this.log[id]) return false;
    this.log[id] = { state: 'active', step: 0 };
    if (!silent) { this.g.toast('New quest: ' + QUESTS[id].name, '#ffd84a'); this.g.audio.sfx('pickup'); }
    this.check(); return true;
  }
  isActive(id) { return this.log[id]?.state === 'active'; }
  isDone(id) { return this.log[id]?.state === 'done'; }
  autoStart() {
    // main-line quests chain automatically
    const order = ['mq1', 'mq2', 'mq3', 'mq4', 'mq5', 'mq6', 'mq7', 'mq8', 'mq9', 'mq10', 'mq11', 'mq12', 'mq13'];
    const cur = order.find((id) => !this.isDone(id));
    if (cur && !this.log[cur]) this.start(cur, true);
    if (this.g.hasItem('mp1') || this.g.hasItem('mp2') || this.g.hasItem('mp3') || this.g.hasItem('mp4') || this.g.hasItem('mp5') || this.g.hasItem('mp6') || this.g.hasItem('mp7')) this.start('sq_pearls');
  }
  check() {
    if (this.busy || !this.g.world) return; this.busy = true;
    try {
      this.autoStart();
      for (const [id, q] of Object.entries(this.log)) {
        if (q.state !== 'active') continue;
        const def = QUESTS[id];
        while (q.step < def.steps.length && def.steps[q.step].done(this.g)) {
          q.step++;
          if (q.step < def.steps.length) { this.g.toast('Quest updated: ' + def.name, '#9ad8ff'); }
        }
        if (q.step >= def.steps.length) this.complete(id);
      }
    } finally { this.busy = false; }
  }
  complete(id) {
    const q = this.log[id], def = QUESTS[id]; if (q.state === 'done') return; q.state = 'done';
    this.g.toast('Quest complete: ' + def.name, '#7aff9a'); this.g.audio.sfx('levelup');
    const r = REWARDS[id]; if (r && this.g.world) { const p = this.g.world.player; this.g.grantLoot({ ...r, coins: r.coins }, p.x, p.y - 10, true); }
    this.g.events.emit('questdone', id);
    this.g.setFlag('quest_done_' + id);
    setTimeout(() => this.check(), 0);
  }
  tracker() {
    const main = Object.keys(this.log).find((id) => QUESTS[id].type === 'main' && this.log[id].state === 'active');
    const id = main || Object.keys(this.log).find((i) => this.log[i].state === 'active' && !QUESTS[i].hidden);
    if (!id) return null; const q = QUESTS[id], st = this.log[id];
    return { title: q.name, text: q.steps[Math.min(st.step, q.steps.length - 1)].text };
  }
  list(type) { return Object.keys(this.log).filter((id) => QUESTS[id] && (!type || QUESTS[id].type === type)); }
  onZone() { this.check(); }
}
