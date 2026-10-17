// Evolution rules: requirements, applying a molt (form + branch + abilities), and what each form unlocks.
import { FORMS, BRANCHES, EVOLUTIONS, nextForms, FORM_ORDER } from '../data/forms.js';
import { ITEMS } from '../data/items.js';

const FORM_ABILITIES = { leviathan: ['tailLash'], mythic: ['tidalWave', 'slackTide', 'pearlStorm'], primordial: ['tidalWave', 'slackTide', 'pearlStorm'] };

export class Evolution {
  constructor(game) { this.g = game; game.systems.evolution = this; }
  // forms reachable from the current one (secret ones only once unlocked)
  options() {
    const s = this.g.state;
    return nextForms(s.form).filter((id) => !EVOLUTIONS[id].secret || this.secretUnlocked(id));
  }
  secretUnlocked(id) { return id === 'primordial' ? this.g.flag('primordial_unlocked') : false; }
  requirements(to, shrineEntry) {
    const s = this.g.state, e = EVOLUTIONS[to];
    const list = [
      { label: `Level ${e.level}`, ok: s.level >= e.level, have: s.level, need: e.level },
      { label: `${e.ep} Evolution Points`, ok: s.ep >= e.ep, have: s.ep, need: e.ep },
      { label: ITEMS[e.item].name, ok: this.g.hasItem(e.item), have: this.g.itemCount(e.item), need: 1 },
      { label: 'At a Molt Shrine', ok: !shrineEntry || shrineEntry === e.shrine, have: 0, need: 0, hint: shrineEntry && shrineEntry !== e.shrine ? 'This is not the right shrine for this molt.' : null },
    ];
    return { list, ok: list.every((r) => r.ok) };
  }
  // any evolution currently satisfiable (anywhere except the shrine check) → HUD hint
  readyFor() { for (const id of this.options()) { const r = this.requirements(id, null); if (r.ok) return id; } return null; }
  apply(to, branchId) {
    const g = this.g, s = g.state, e = EVOLUTIONS[to];
    s.ep -= e.ep; g.addItem(e.item, -1);
    const prev = s.form; s.form = to;
    if (branchId) { s.branches[BRANCHES[branchId].form] = branchId; const ab = BRANCHES[branchId].ability; if (ab && !s.abilities.includes(ab)) s.abilities.push(ab); }
    for (const ab of FORM_ABILITIES[to] || []) if (!s.abilities.includes(ab)) s.abilities.push(ab);
    // fill empty slots with something usable
    const F = FORMS[to];
    for (let i = 0; i < F.abilitySlots; i++) if (!s.slots[i] || !s.abilities.includes(s.slots[i])) { const next = s.abilities.find((a) => !s.slots.includes(a)); s.slots[i] = next || null; }
    // a new mutation slot may let an owned mutation equip
    for (const id of s.mutOwned) if (!s.mutations.includes(id) && s.mutations.length < F.mutationSlots) s.mutations.push(id);
    s.flags['evolved_' + to] = true; g.events.emit('evolved', to, prev);
    const p = g.world?.player; if (p) { p.setForm(to); p.fury = 0; }
    return F;
  }
}
