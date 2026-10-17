// Generator-based dialogue: a conversation is a function* that yields say()/ask() actions.
//   function* old_brine(c) { yield c.say('Hello.'); const i = yield c.ask('Well?', ['A', 'B']); ... }
import { NPCS } from '../data/npcs.js';
import { DIALOGUE } from '../data/dialogue.js';

export class Dialogue {
  constructor(game) { this.g = game; game.systems.dialogue = this; game.dialogue = this; game.npcs = { get: (id) => NPCS[id] }; this.running = false; }
  ctx(npcId, entity) {
    const g = this.g, def = NPCS[npcId] || { name: npcId, color: '#ffffff' };
    const c = {
      g, npc: def, entity, state: g.state,
      say: (text, who) => ({ t: 'say', text, who: who === undefined ? def.name : who, sprite: who === undefined ? def.sprite : null, color: who === undefined ? def.color : null }),
      narrate: (text) => ({ t: 'say', text, who: null }),
      ask: (prompt, opts, who) => ({ t: 'ask', prompt, opts, who: who === undefined ? def.name : who, sprite: who === undefined ? def.sprite : null, color: who === undefined ? def.color : null }),
      do: (fn) => ({ t: 'do', fn }),
      wait: (fn) => ({ t: 'async', fn }),
      flag: (k) => g.flag(k), set: (k, v) => g.setFlag(k, v),
      has: (id) => g.hasItem(id), count: (id) => g.itemCount(id),
      give: (id, n = 1) => g.grantItem(id, n, true), take: (id, n = 1) => g.addItem(id, -n),
      coins: () => g.state.coins, pay: (n) => { g.state.coins -= n; }, gain: (n) => { g.state.coins += n; },
      quest: (id) => g.systems.quests.start(id), qActive: (id) => g.systems.quests.isActive(id), qDone: (id) => g.systems.quests.isDone(id),
      form: () => g.state.form, boss: (k) => !!g.state.bosses[k], visited: (z) => !!g.state.visited[z],
      lore: (id) => g.systems.codex.unlock(id),
      shop: (id) => ({ t: 'async', fn: (resume) => g.openShop(id, resume) }),
      sell: (id) => ({ t: 'async', fn: (resume) => g.openSell(id, resume) }),
      forge: () => ({ t: 'async', fn: (resume) => g.openForge(resume) }),
    };
    return c;
  }
  start(npcId, entity) {
    const fn = DIALOGUE[npcId]; if (!fn) { this.g.say(NPCS[npcId]?.name || npcId, '...'); return; }
    this.run(fn, npcId, entity);
  }
  // run any generator function (also used for boss/story scenes). done() is called at the end.
  run(fn, npcId, entity, done) {
    const g = this.g, box = g.playScene.dialogue, c = this.ctx(npcId, entity); const gen = fn(c); this.running = true;
    const finish = () => { this.running = false; box.active = false; done?.(); g.systems.quests?.check(); };
    const step = (val) => {
      let r; try { r = gen.next(val); } catch (e) { console.error('dialogue error', e); finish(); return; }
      if (r.done) { finish(); return; }
      const a = r.value;
      if (a.t === 'say') box.open([{ speaker: a.who, text: a.text, sprite: a.sprite, color: a.color }], () => step());
      else if (a.t === 'ask') box.open([{ speaker: a.who, text: a.prompt, sprite: a.sprite, color: a.color, choices: a.opts.map((t) => ({ text: t })), onChoose: (ch, i) => step(i) }]);
      else if (a.t === 'do') { a.fn(); step(); }
      else if (a.t === 'async') { box.active = false; a.fn(() => step()); }
      else step();
    };
    step();
  }
}
