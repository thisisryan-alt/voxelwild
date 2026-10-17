// Save slots in localStorage (with an in-memory fallback when storage is unavailable).
const PREFIX = 'moltborn.save.';
const mem = {};
const store = (() => { try { const k = '__t'; localStorage.setItem(k, '1'); localStorage.removeItem(k); return localStorage; } catch (e) { return null; } })();

export const Save = {
  slots: 3,
  read(slot) {
    try { const raw = store ? store.getItem(PREFIX + slot) : mem[slot]; return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
  },
  write(slot, data) {
    const raw = JSON.stringify(data);
    try { if (store) store.setItem(PREFIX + slot, raw); else mem[slot] = raw; return true; } catch (e) { mem[slot] = raw; return false; }
  },
  delete(slot) { try { if (store) store.removeItem(PREFIX + slot); delete mem[slot]; } catch (e) {} },
  list() { return Array.from({ length: this.slots }, (_, i) => { const d = this.read(i); return d ? { slot: i, meta: d.meta } : { slot: i, meta: null }; }); },
  settings() { try { const r = store?.getItem('moltborn.settings'); return r ? JSON.parse(r) : null; } catch (e) { return null; } },
  saveSettings(s) { try { store?.setItem('moltborn.settings', JSON.stringify(s)); } catch (e) {} },
};
