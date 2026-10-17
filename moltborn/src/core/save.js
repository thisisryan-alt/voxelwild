// Save slots in localStorage (with an in-memory fallback when storage is unavailable).
const PREFIX = 'moltborn.save.', BAK = 'moltborn.bak.', BAKT = 'moltborn.bakt.';
const BACKUP_EVERY = 5 * 60 * 1000;          // keep a rolling backup of the previous save, refreshed at most every five minutes
export const CODE_TAG = 'MB1';
const mem = {};
const store = (() => { try { const k = '__t'; localStorage.setItem(k, '1'); localStorage.removeItem(k); return localStorage; } catch (e) { return null; } })();

export const Save = {
  slots: 3,
  read(slot) {
    try { const raw = store ? store.getItem(PREFIX + slot) : mem[slot]; return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
  },
  write(slot, data) {
    const raw = JSON.stringify(data);
    try {
      if (store) {
        const prev = store.getItem(PREFIX + slot), last = +(store.getItem(BAKT + slot) || 0);
        if (prev && Date.now() - last > BACKUP_EVERY) { store.setItem(BAK + slot, prev); store.setItem(BAKT + slot, String(Date.now())); }
        store.setItem(PREFIX + slot, raw);
      } else mem[slot] = raw;
      return true;
    } catch (e) { mem[slot] = raw; return false; }
  },
  delete(slot) { try { if (store) store.removeItem(PREFIX + slot); delete mem[slot]; } catch (e) {} },
  // ---- backups and portable codes -------------------------------------------------------------------------------------------
  backup(slot) { try { const raw = store?.getItem(BAK + slot); return raw ? JSON.parse(raw) : null; } catch (e) { return null; } },
  restoreBackup(slot) { const b = this.backup(slot); if (!b) return false; return this.write(slot, b); },
  // a portable text code: tag + base64(json) + checksum, safe to paste into a note
  exportCode(slot) {
    const d = this.read(slot); if (!d) return null;
    const json = JSON.stringify(d), b64 = btoa(unescape(encodeURIComponent(json)));
    return `${CODE_TAG}.${checksum(json)}.${b64}`;
  },
  importCode(slot, code) {
    try {
      const [tag, sum, b64] = String(code).trim().split('.'); if (tag !== CODE_TAG || !b64) return { ok: false, why: 'Not a Moltborn save code' };
      const json = decodeURIComponent(escape(atob(b64))); if (checksum(json) !== sum) return { ok: false, why: 'The code is damaged (checksum mismatch)' };
      const d = JSON.parse(json); const v = validate(d); if (v) return { ok: false, why: v };
      this.write(slot, d); return { ok: true, meta: d.meta };
    } catch (e) { return { ok: false, why: 'Could not read that code' }; }
  },
  list() { return Array.from({ length: this.slots }, (_, i) => { const d = this.read(i); return d ? { slot: i, meta: d.meta } : { slot: i, meta: null }; }); },
  settings() { try { const r = store?.getItem('moltborn.settings'); return r ? JSON.parse(r) : null; } catch (e) { return null; } },
  saveSettings(s) { try { store?.setItem('moltborn.settings', JSON.stringify(s)); } catch (e) {} },
};

function checksum(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); }
// basic sanity check of an imported save so a malformed file cannot crash the game on load
export function validate(d) {
  if (!d || typeof d !== 'object' || !d.state || typeof d.state !== 'object') return 'The save has no game state';
  const s = d.state; if (typeof s.form !== 'string' || typeof s.level !== 'number' || !s.inv || typeof s.inv !== 'object' || !s.checkpoint) return 'The save is missing required fields';
  if (s.level < 1 || s.level > 99 || !isFinite(s.level)) return 'The save has an impossible level';
  return null;
}
