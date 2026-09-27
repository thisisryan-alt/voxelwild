// Saves in IndexedDB (Unity RegionFile + GameSession): one record per world (player, inventory, stats, time,
// weather) and one per edited 32^3 section, run-length encoded. Falls back to memory when storage is blocked.

const DB = 'voxelwild', VERSION = 1;

function rle(a) {
  const out = [];
  let prev = a[0], n = 1;
  for (let i = 1; i < a.length; i++) {
    if (a[i] === prev && n < 65535) n++;
    else { out.push(prev, n); prev = a[i]; n = 1; }
  }
  out.push(prev, n);
  return new Uint16Array(out);
}
function unrle(r, len) {
  const a = new Uint16Array(len);
  let o = 0;
  for (let i = 0; i < r.length; i += 2) { a.fill(r[i], o, o + r[i + 1]); o += r[i + 1]; }
  return a;
}

export class SaveStore {
  constructor() { this.db = null; this.memory = { worlds: new Map(), sections: new Map() }; this.persistent = false; }

  async open() {
    try {
      if (!('indexedDB' in window)) return;
      this.db = await new Promise((resolve, reject) => {
        const req = indexedDB.open(DB, VERSION);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains('worlds')) db.createObjectStore('worlds', { keyPath: 'id' });
          if (!db.objectStoreNames.contains('sections')) db.createObjectStore('sections');
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        req.onblocked = () => reject(new Error('blocked'));
        setTimeout(() => reject(new Error('timeout')), 4000);
      });
      this.persistent = true;
    } catch (e) {
      console.warn('IndexedDB unavailable, saves last for this session only:', e && e.message);
      this.db = null;
    }
  }

  tx(stores, mode, fn) {
    return new Promise((resolve, reject) => {
      const t = this.db.transaction(stores, mode);
      const res = fn(t);
      t.oncomplete = () => resolve(res && res.result !== undefined ? res.result : res);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
    });
  }

  async listWorlds() {
    try {
      if (!this.db) return [...this.memory.worlds.values()].sort((a, b) => b.lastPlayed - a.lastPlayed);
      const all = await this.tx(['worlds'], 'readonly', (t) => t.objectStore('worlds').getAll());
      return all.sort((a, b) => b.lastPlayed - a.lastPlayed);
    } catch (e) { console.warn(e); return []; }
  }

  async saveWorld(meta, sections) {
    meta.lastPlayed = Date.now();
    const recs = [];
    for (const [k, data] of sections) recs.push([`${meta.id}|${k}`, typeof data === 'number' ? null : rle(data)]);
    if (!this.db) {
      this.memory.worlds.set(meta.id, JSON.parse(JSON.stringify(meta)));
      for (const [k, r] of recs) if (r) this.memory.sections.set(k, r);
      return;
    }
    await this.tx(['worlds', 'sections'], 'readwrite', (t) => {
      t.objectStore('worlds').put(meta);
      const s = t.objectStore('sections');
      for (const [k, r] of recs) if (r) s.put(r, k);
    });
  }

  async loadSections(worldId) {
    const out = new Map(), prefix = `${worldId}|`;
    if (!this.db) {
      for (const [k, r] of this.memory.sections) if (k.startsWith(prefix)) out.set(k.slice(prefix.length), unrle(r, 32768));
      return out;
    }
    await this.tx(['sections'], 'readonly', (t) => {
      const range = IDBKeyRange.bound(prefix, `${prefix}￿`);
      const req = t.objectStore('sections').openCursor(range);
      req.onsuccess = () => {
        const c = req.result;
        if (!c) return;
        out.set(String(c.key).slice(prefix.length), unrle(c.value, 32768));
        c.continue();
      };
    });
    return out;
  }

  async deleteWorld(worldId) {
    const prefix = `${worldId}|`;
    if (!this.db) {
      this.memory.worlds.delete(worldId);
      for (const k of [...this.memory.sections.keys()]) if (k.startsWith(prefix)) this.memory.sections.delete(k);
      return;
    }
    await this.tx(['worlds', 'sections'], 'readwrite', (t) => {
      t.objectStore('worlds').delete(worldId);
      t.objectStore('sections').delete(IDBKeyRange.bound(prefix, `${prefix}￿`));
    });
  }
}

/** The player's resource pack (the few textures the game uses), kept only in this browser. */
export const PackStore = {
  async open() {
    if (this.db !== undefined) return this.db;
    try {
      this.db = await new Promise((resolve, reject) => {
        const req = indexedDB.open('voxelwild-packs', 1);
        req.onupgradeneeded = () => req.result.createObjectStore('packs');
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        setTimeout(() => reject(new Error('timeout')), 4000);
      });
    } catch { this.db = null; }
    return this.db;
  },
  async get() {
    const db = await this.open();
    if (!db) return null;
    return new Promise((resolve) => { const r = db.transaction('packs').objectStore('packs').get('current'); r.onsuccess = () => resolve(r.result || null); r.onerror = () => resolve(null); });
  },
  async put(pack) {
    const db = await this.open();
    if (!db) return false;
    return new Promise((resolve) => { const t = db.transaction('packs', 'readwrite'); t.objectStore('packs').put(pack, 'current'); t.oncomplete = () => resolve(true); t.onerror = () => resolve(false); });
  },
  async clear() {
    const db = await this.open();
    if (!db) return;
    await new Promise((resolve) => { const t = db.transaction('packs', 'readwrite'); t.objectStore('packs').delete('current'); t.oncomplete = resolve; t.onerror = resolve; });
  },
};

export function loadSettings(defaults) {
  try { const s = JSON.parse(localStorage.getItem('voxelwild.settings') || '{}'); return { ...defaults, ...s }; } catch { return { ...defaults }; }
}
export function storeSettings(s) { try { localStorage.setItem('voxelwild.settings', JSON.stringify(s)); } catch { /* storage blocked */ } }
