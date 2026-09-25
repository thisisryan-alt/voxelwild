// Screens and HUD (Unity UI.*): title, new world, loading, HUD, inventory + crafting, creative palette, pause,
// settings, death. Also owns input: keyboard, mouse with pointer lock (free-look fallback), wheel, touch.
import { ITEMS, Kind, itemName, RECIPES } from '../shared/blocks.js';
import { canCraft, craft, HOTBAR, INV_SIZE, MAX_AIR } from './gameplay.js';
import { loadSettings, storeSettings } from './save.js';

const $ = (id) => document.getElementById(id);
const DEFAULTS = { viewDistance: 7, renderScale: 1, fov: 75, sensitivity: 1, volume: 0.8, sfx: 1, ambience: 0.7, particles: 1,
  shadows: true, bloom: true, godRays: true, invertY: false };
const GAME_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight', 'KeyE', 'KeyQ', 'KeyF',
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'F3', 'Tab', 'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9']);
const CAUSES = { fall: 'You hit the ground too hard.', drowning: 'You ran out of air.', starvation: 'You starved.', void: 'You fell out of the world.' };

function svgHeart(fill) {
  const f = fill === 2 ? 'var(--heart)' : fill === 1 ? 'url(#half)' : 'rgba(0,0,0,0.45)';
  return `<svg viewBox="0 0 16 16"><defs><linearGradient id="half"><stop offset="50%" stop-color="#d8574a"/><stop offset="50%" stop-color="rgba(0,0,0,0.45)"/></linearGradient></defs><path d="M8 14.2 2.3 8.6A3.4 3.4 0 0 1 8 4.1a3.4 3.4 0 0 1 5.7 4.5Z" fill="${f}" stroke="#1a0906" stroke-width="1"/></svg>`;
}
function svgFood(fill) {
  const f = fill === 2 ? 'var(--food)' : fill === 1 ? 'rgba(201,138,75,0.55)' : 'rgba(0,0,0,0.45)';
  return `<svg viewBox="0 0 16 16"><path d="M9.6 2.2c2.6 0 4.2 1.7 4.2 4 0 2.6-2.4 4.4-4.9 4.4-.8 0-1.4-.2-1.9-.5L4.9 12.2a1.4 1.4 0 1 1-1.9-.1 1.4 1.4 0 1 1-.1-1.9L5 8.1c-.3-.5-.5-1.1-.5-1.8 0-2.3 2.2-4.1 5.1-4.1Z" fill="${f}" stroke="#1a0f06" stroke-width="1"/></svg>`;
}
function svgBubble(on) {
  return `<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="5.6" fill="${on ? 'rgba(127,182,214,0.55)' : 'rgba(0,0,0,0.25)'}" stroke="${on ? '#cfe8f5' : 'rgba(0,0,0,0.4)'}" stroke-width="1.2"/><circle cx="6" cy="6" r="1.4" fill="${on ? '#eaf6fc' : 'transparent'}"/></svg>`;
}

function parseSeed(text) {
  const t = text.trim();
  if (!t) return (Math.random() * 4294967296) >>> 0;
  if (/^-?\d+$/.test(t)) return Number(BigInt.asUintN(32, BigInt(t)));
  let h = 2166136261;
  for (const ch of t) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export class UI {
  constructor(game) {
    this.game = game;
    this.settings = loadSettings(DEFAULTS);
    this.locked = false;
    this.cursor = null;          // stack held by the mouse in the inventory
    this.screen = 'title';
    this.debug = false;
    this.lastFrame = performance.now();
    this.frames = 0; this.fpsTime = 0;
    this.touchMode = matchMedia('(pointer: coarse)').matches && !matchMedia('(pointer: fine)').matches;
  }

  async boot() {
    const g = this.game;
    this.show('title');
    $('bootMsg').textContent = 'Loading textures…';
    this.bindStatic();
    try {
      await g.init((msg) => { $('bootMsg').textContent = msg + '…'; });
    } catch (e) { this.fatal(e); return; }
    g.applySettings(this.settings);
    $('bootMsg').textContent = '';
    $('storageNote').textContent = g.store.persistent ? 'saves stay in this browser' : 'saves last until you close the page';
    g.on('state', (s, cause) => this.onState(s, cause));
    g.on('inventory', () => { this.renderHotbar(); if (this.screen === 'inventory') this.renderInventory(); });
    g.on('hud', () => this.renderStats());
    g.on('heldName', () => this.flashHeldName());
    g.on('toast', (t) => this.toast(t));
    g.on('pickup', (item, n) => this.pickup(item, n));
    g.on('loading', (p) => this.loadingProgress(p));
    g.on('saved', () => {});
    await this.refreshWorlds();
    requestAnimationFrame((t) => this.loop(t));
    window.addEventListener('pagehide', () => g.save());
    document.addEventListener('visibilitychange', () => { if (document.hidden) { g.save(); if (this.screen === 'playing') this.pause(); } });
  }

  fatal(e) {
    console.error(e);
    this.show('fatal');
    $('fatalMsg').textContent = `${e && e.message || e}\n\nVoxelwild needs a browser with WebGL2 and floating-point render targets (current Chrome, Edge, Firefox or Safari).`;
  }

  // ---------------------------------------------------------------- screens

  show(name) {
    for (const id of ['title', 'newWorld', 'loading', 'pause', 'settings', 'inventory', 'death', 'fatal']) $(id).hidden = id !== name;
    $('hud').hidden = !['playing', 'inventory', 'pause', 'settings', 'death'].includes(name) || !this.game.world;
    $('touch').hidden = !(this.touchMode && name === 'playing');
    this.screen = name;
    $('cursorStack').hidden = !(name === 'inventory' && this.cursor);
  }

  onState(s, cause) {
    const g = this.game;
    if (s === 'loading') { this.show('loading'); $('loadTitle').textContent = g.meta.name; }
    else if (s === 'playing') { this.show('playing'); this.renderHotbar(); this.renderStats(); this.lock(); }
    else if (s === 'dead') {
      this.unlock();
      $('deathCause').textContent = CAUSES[cause] || 'You died.';
      this.show('death');
    }
  }

  async refreshWorlds() {
    const worlds = await this.game.store.listWorlds();
    this.worlds = worlds;
    $('btnContinue').hidden = !worlds.length;
    if (worlds.length) $('btnContinue').textContent = `Continue “${worlds[0].name}”`;
    $('worldListWrap').hidden = !worlds.length;
    const list = $('worldList');
    list.innerHTML = '';
    for (const w of worlds) {
      const row = document.createElement('div');
      row.className = 'world';
      const when = new Date(w.lastPlayed);
      row.innerHTML = `<div><b></b><small></small></div><button>Play</button><button class="danger">Delete</button>`;
      row.querySelector('b').textContent = w.name;
      row.querySelector('small').textContent = `${w.mode} · seed ${w.seed} · ${when.toLocaleDateString()} ${when.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      const [play, del] = row.querySelectorAll('button');
      play.onclick = () => this.play(w, false);
      del.onclick = async () => {
        if (del.dataset.confirm) { await this.game.store.deleteWorld(w.id); this.refreshWorlds(); return; }
        del.dataset.confirm = '1'; del.textContent = 'Really delete?';
        setTimeout(() => { delete del.dataset.confirm; del.textContent = 'Delete'; }, 3000);
      };
      list.appendChild(row);
    }
  }

  async play(meta, isNew) {
    this.game.audio.start();
    this.game.audio.click();
    this.show('loading');
    $('loadTitle').textContent = meta.name;
    $('loadBar').style.width = '0%';
    try { await this.game.startWorld(meta, isNew); } catch (e) { this.fatal(e); }
  }

  loadingProgress(p) {
    $('loadBar').style.width = `${Math.round(p * 100)}%`;
    const w = this.game.world;
    $('loadDetail').textContent = `${w.stats.gens} columns generated · ${w.stats.meshes} sections built`;
  }

  pause() {
    if (!this.game.world || this.screen === 'pause') return;
    this.unlock();
    const g = this.game;
    g.state = 'paused';
    g.keys.clear();
    g.mouse.left = g.mouse.right = false;
    const p = g.player.body.pos;
    $('pauseInfo').textContent = `${g.meta.name} · x ${p[0].toFixed(0)} y ${p[1].toFixed(0)} z ${p[2].toFixed(0)}`;
    $('btnMode').textContent = g.creative ? 'Switch to survival' : 'Switch to creative';
    this.show('pause');
    g.save();
  }

  resume() {
    const g = this.game;
    g.state = 'playing';
    this.show('playing');
    this.lock();
  }

  openInventory() {
    const g = this.game;
    g.state = 'inventory';
    g.keys.clear(); g.mouse.left = g.mouse.right = false;
    this.unlock();
    this.show('inventory');
    this.renderInventory();
  }

  closeInventory() {
    const g = this.game;
    if (this.cursor) {   // put the held stack back (or drop what does not fit)
      const left = g.inventory.add(this.cursor.item, this.cursor.count, this.cursor);
      if (left > 0) { const e = g.player.eye(), f = g.player.forward(); g.spawnItem(this.cursor.item, left, [e[0] + f[0], e[1] - 0.4, e[2] + f[2]], [f[0] * 3, 2, f[2] * 3], this.cursor.wear); }
      this.cursor = null;
    }
    g.state = 'playing';
    this.show('playing');
    this.lock();
  }

  // ---------------------------------------------------------------- pointer lock

  lock() {
    const c = $('view');
    if (this.touchMode) return;
    if (document.pointerLockElement === c) return;
    try {
      const r = c.requestPointerLock({ unadjustedMovement: false });
      if (r && r.catch) r.catch(() => { this.lockFailed(); });
    } catch { this.lockFailed(); }
    c.focus();
  }
  lockFailed() { if (this.screen === 'playing') $('clickHint').hidden = false; }
  unlock() { this.expectUnlock = true; if (document.pointerLockElement) document.exitPointerLock(); }

  // ---------------------------------------------------------------- input

  bindStatic() {
    const g = this.game, c = $('view');
    $('btnNew').onclick = () => { g.audio.start(); g.audio.click(); this.show('newWorld'); $('nwName').focus(); };
    $('btnContinue').onclick = () => this.worlds && this.worlds[0] && this.play(this.worlds[0], false);
    $('btnSettingsT').onclick = () => { this.settingsBack = 'title'; this.openSettings(); };
    $('btnSettingsP').onclick = () => { this.settingsBack = 'pause'; this.openSettings(); };
    $('btnSettingsDone').onclick = () => { storeSettings(this.settings); this.show(this.settingsBack); };
    $('nwCancel').onclick = () => this.show('title');
    let mode = 'survival';
    const setMode = (m) => {
      mode = m;
      $('nwSurvival').setAttribute('aria-pressed', m === 'survival'); $('nwCreative').setAttribute('aria-pressed', m === 'creative');
      $('nwModeHint').textContent = m === 'survival' ? 'Health, hunger and breath. Blocks come from mining; tools come from crafting.'
        : 'Unlimited blocks, instant breaking, no damage. Double-tap Space or press F to fly.';
    };
    $('nwSurvival').onclick = () => setMode('survival');
    $('nwCreative').onclick = () => setMode('creative');
    $('newForm').onsubmit = (e) => {
      e.preventDefault();
      const seed = parseSeed($('nwSeed').value);
      const name = $('nwName').value.trim() || 'New World';
      this.play({ id: `w${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`, name, seed, mode, created: Date.now(), lastPlayed: Date.now() }, true);
    };
    $('btnResume').onclick = () => this.resume();
    $('btnMode').onclick = () => { g.setMode(!g.creative); $('btnMode').textContent = g.creative ? 'Switch to survival' : 'Switch to creative'; this.renderStats(); };
    $('btnQuit').onclick = async () => { await g.save(); g.stopWorld(); g.state = 'title'; this.show('title'); this.refreshWorlds(); };
    $('btnRespawn').onclick = () => g.respawn();
    $('btnDeathQuit').onclick = async () => { g.stats.reset(); g.player.teleport(g.spawn); await g.save(); g.stopWorld(); g.state = 'title'; this.show('title'); this.refreshWorlds(); };
    this.renderControls();

    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === c;
      if (this.locked) { $('clickHint').hidden = true; return; }
      if (this.expectUnlock) { this.expectUnlock = false; return; }
      if (this.screen === 'playing') this.pause();   // Esc released the mouse
    });
    document.addEventListener('pointerlockerror', () => this.lockFailed());

    c.addEventListener('mousedown', (e) => {
      if (this.screen !== 'playing') return;
      g.audio.start();
      if (!this.locked && !this.touchMode) { this.lock(); if (e.button !== 0) return; }
      if (e.button === 0) { g.mouse.left = true; g.mouse.leftClicked = true; }
      if (e.button === 2) { g.mouse.right = true; g.mouse.rightClicked = true; }
      if (e.button === 1) this.pickBlock();
      e.preventDefault();
    });
    window.addEventListener('mouseup', (e) => { if (e.button === 0) g.mouse.left = false; if (e.button === 2) g.mouse.right = false; });
    c.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('mousemove', (e) => {
      if (this.screen === 'inventory') { this.moveCursor(e.clientX, e.clientY); return; }
      if (this.screen !== 'playing' || !g.player) return;
      if (!this.locked && e.target !== c) return;
      const s = 0.0022 * this.settings.sensitivity;
      g.player.look(e.movementX || 0, (e.movementY || 0) * (this.settings.invertY ? -1 : 1), s);
    });
    c.addEventListener('wheel', (e) => { if (this.screen === 'playing') { g.scroll(e.deltaY); e.preventDefault(); } }, { passive: false });

    window.addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) return;
      const k = e.code;
      if (this.screen === 'playing' || this.screen === 'inventory') { if (GAME_KEYS.has(k)) e.preventDefault(); }
      if (e.repeat) { if (this.screen === 'playing') g.keys.add(k); return; }
      if (this.screen === 'playing') {
        g.keys.add(k); g.pressed.add(k);
        if (k === 'KeyE') this.openInventory();
        else if (k === 'Escape' || k === 'KeyP') this.pause();
        else if (k === 'F3') { this.debug = !this.debug; $('debug').hidden = !this.debug; }
      } else if (this.screen === 'inventory') {
        if (k === 'KeyE' || k === 'Escape') this.closeInventory();
        else if (/^Digit[1-9]$/.test(k) && this.hoverSlot != null) { g.inventory.move(this.hoverSlot, +k.slice(5) - 1); }
      } else if (this.screen === 'pause' && (k === 'Escape' || k === 'KeyP')) this.resume();
      else if (this.screen === 'settings' && k === 'Escape') { storeSettings(this.settings); this.show(this.settingsBack); }
    });
    window.addEventListener('keyup', (e) => g.keys.delete(e.code));
    window.addEventListener('blur', () => { g.keys.clear(); g.mouse.left = g.mouse.right = false; });

    if (this.touchMode) this.bindTouch();
  }

  pickBlock() {
    const g = this.game, t = g.target;
    if (!t) return;
    const inv = g.inventory;
    for (let i = 0; i < HOTBAR; i++) if (inv.slots[i] && inv.slots[i].item === t.block) { g.select(i); return; }
    if (g.creative && ITEMS[t.block]) { inv.slots[inv.selected] = { item: t.block, count: 64 }; inv.changed(); g.emit('heldName'); }
  }

  renderControls() {
    const rows = [['W A S D', 'Move'], ['Space', 'Jump · swim up · double-tap to fly (creative)'], ['Ctrl / double-tap W', 'Sprint'], ['Shift', 'Fly down · swim down'],
      ['Left mouse', 'Mine (hold)'], ['Right mouse', 'Place block · eat'], ['Middle mouse', 'Pick block'], ['1–9 / wheel', 'Choose hotbar slot'], ['E', 'Inventory and crafting'],
      ['Q', 'Drop item (Ctrl+Q: stack)'], ['F', 'Toggle flight (creative)'], ['F3', 'Debug info'], ['Esc', 'Pause']];
    $('controlsList').innerHTML = rows.map(([k, v]) => `<span>${k.split(' / ').map((x) => `<kbd>${x}</kbd>`).join(' ')}</span><span>${v}</span>`).join('');
  }

  // ---------------------------------------------------------------- settings

  openSettings() {
    const s = this.settings, g = this.game;
    const bind = (key, fmt) => {
      const el = $('s' + key[0].toUpperCase() + key.slice(1)), v = $('v' + key[0].toUpperCase() + key.slice(1));
      if (el.type === 'checkbox') { el.checked = !!s[key]; el.onchange = () => { s[key] = el.checked; g.applySettings(s); storeSettings(s); }; return; }
      el.value = s[key];
      const upd = () => { v.textContent = fmt(+el.value); };
      upd();
      el.oninput = () => { s[key] = +el.value; upd(); g.applySettings(s); };
      el.onchange = () => storeSettings(s);
    };
    bind('viewDistance', (x) => `${x} sections · ${x * 32} m`);
    bind('renderScale', (x) => `${Math.round(x * 100)}%`);
    bind('fov', (x) => `${x}°`);
    bind('sensitivity', (x) => x.toFixed(2));
    for (const k of ['volume', 'sfx', 'ambience', 'particles']) bind(k, (x) => `${Math.round(x * 100)}%`);
    for (const k of ['shadows', 'bloom', 'godRays', 'invertY']) bind(k);
    this.show('settings');
  }

  // ---------------------------------------------------------------- HUD

  slotHTML(stack, px) {
    if (!stack) return '';
    const def = ITEMS[stack.item];
    let h = `<div class="ico" style="${this.game.icons.css(stack.item, px)}"></div>`;
    if (stack.count > 1) h += `<span class="n">${stack.count}</span>`;
    if (def && def.kind === Kind.Tool && stack.wear) {
      const f = 1 - stack.wear / def.durability;
      h += `<div class="wear"><i style="width:${Math.round(f * 100)}%;background:hsl(${Math.round(f * 110)},70%,50%)"></i></div>`;
    }
    return h;
  }

  renderHotbar() {
    const g = this.game;
    if (!g.inventory) return;
    const bar = $('hotbar');
    const size = bar.clientWidth && window.innerWidth <= 720 ? 26 : 36;
    let h = '';
    for (let i = 0; i < HOTBAR; i++) h += `<div class="slot${i === g.inventory.selected ? ' sel' : ''}">${this.slotHTML(g.inventory.slots[i], size)}</div>`;
    bar.innerHTML = h;
  }

  flashHeldName() {
    const g = this.game, s = g.inventory.held, el = $('heldName');
    el.textContent = s ? itemName(s.item) : '';
    el.style.opacity = 1;
    g.handSwap = 1;
    clearTimeout(this.nameTimer);
    this.nameTimer = setTimeout(() => { el.style.opacity = 0; }, 1500);
  }

  renderStats() {
    const g = this.game;
    if (!g.stats) return;
    const surv = !g.creative;
    $('stats').style.visibility = surv ? 'visible' : 'hidden';
    $('modeTag').textContent = g.creative ? (g.player.flying ? 'Creative · flying' : 'Creative') : '';
    if (surv) {
      const st = g.stats;
      const icons = (v, fn) => { let h = ''; for (let i = 0; i < 10; i++) { const x = v - i * 2; h += fn(x >= 2 ? 2 : x >= 1 ? 1 : 0); } return h; };
      const hk = Math.ceil(st.health), fk = Math.ceil(st.hunger);
      if (hk !== this.lastH) { $('hearts').innerHTML = icons(hk, svgHeart); this.lastH = hk; }
      if (fk !== this.lastF) { $('food').innerHTML = icons(fk, svgFood).split('</svg>').reverse().join('</svg>'); this.lastF = fk; }
      const showAir = st.air < MAX_AIR - 0.01 || g.player.headInWater;
      const ak = showAir ? Math.ceil(st.air) : -1;
      if (ak !== this.lastA) { let h = ''; if (showAir) for (let i = 0; i < 10; i++) h += svgBubble(i < ak); $('air').innerHTML = h; this.lastA = ak; }
    }
    if (this.debug) {
      const d = g.debugInfo();
      $('debug').textContent = Object.entries(d).map(([k, v]) => `${k.padEnd(9)} ${v}`).join('\n');
    }
  }

  toast(text) {
    const el = $('toast');
    el.textContent = text; el.style.opacity = 1;
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => { el.style.opacity = 0; }, 2200);
  }

  pickup(item, n) {
    const el = document.createElement('div');
    el.textContent = `+${n} ${itemName(item)}`;
    $('pickups').appendChild(el);
    setTimeout(() => el.remove(), 2400);
  }

  // ---------------------------------------------------------------- inventory

  renderInventory() {
    const g = this.game, inv = g.inventory;
    const px = window.innerWidth <= 720 ? 26 : 34;
    const slot = (i) => `<div class="slot" data-slot="${i}">${this.slotHTML(inv.slots[i], px)}</div>`;
    let main = '', hot = '';
    for (let i = HOTBAR; i < INV_SIZE; i++) main += slot(i);
    for (let i = 0; i < HOTBAR; i++) hot += slot(i);
    $('invMain').innerHTML = main; $('invHot').innerHTML = hot;
    for (const el of document.querySelectorAll('#inventory .slot[data-slot]')) {
      el.onmousedown = (e) => { e.preventDefault(); this.slotClick(+el.dataset.slot, e.button, e.shiftKey); };
      el.oncontextmenu = (e) => e.preventDefault();
      el.onmouseenter = () => { this.hoverSlot = +el.dataset.slot; };
      el.onmouseleave = () => { this.hoverSlot = null; };
      el.title = inv.slots[+el.dataset.slot] ? itemName(inv.slots[+el.dataset.slot].item) : '';
    }
    // crafting (survival) or palette (creative)
    $('sideTitle').textContent = g.creative ? 'All blocks and items' : 'Crafting';
    $('recipes').hidden = g.creative; $('palette').hidden = !g.creative;
    $('sideTip').textContent = g.creative ? 'Click to take a full stack. Drop items back here to delete them.' : 'Shift-click a recipe to craft as many as you can.';
    if (g.creative) {
      if (!this.paletteBuilt) {
        this.paletteBuilt = true;
        const ids = Object.keys(ITEMS).map(Number);
        $('palette').innerHTML = ids.map((id) => `<div class="slot" data-item="${id}" title="${itemName(id)}"><div class="ico" style="${g.icons.css(id, px)}"></div></div>`).join('');
        for (const el of $('palette').children) el.onmousedown = (e) => {
          e.preventDefault();
          if (this.cursor) { this.cursor = null; this.updateCursor(); return; }
          const id = +el.dataset.item; this.cursor = { item: id, count: ITEMS[id].stack }; this.updateCursor(); g.audio.click();
        };
      }
    } else {
      const rec = $('recipes');
      rec.innerHTML = '';
      const sorted = RECIPES.map((r, i) => ({ r, i, ok: canCraft(inv, r) })).sort((a, b) => (b.ok - a.ok) || a.i - b.i);
      for (const { r, ok } of sorted) {
        const b = document.createElement('button');
        b.className = 'recipe';
        b.disabled = !ok;
        const ins = r.inputs.map(([item, n]) => `<span class="${inv.count(item) >= n ? 'have' : 'miss'}">${n}× ${itemName(item)}</span>`).join('');
        b.innerHTML = `<div class="ico" style="${g.icons.css(r.out, 32)}"></div><div>${r.count > 1 ? r.count + '× ' : ''}${r.name}<small>${ins}</small></div>`;
        b.onclick = (e) => {
          let n = 0;
          do { if (!craft(inv, r)) break; n++; } while (e.shiftKey && n < 64 && canCraft(inv, r));
          if (n) { g.audio.click(); this.game.emit('toast', `Crafted ${n * r.count}× ${r.name}`); }
        };
        rec.appendChild(b);
      }
    }
    this.updateCursor();
  }

  slotClick(i, button, shift) {
    const g = this.game, inv = g.inventory, s = inv.slots[i];
    g.audio.click();
    if (shift && !this.cursor && s) {
      // move between hotbar and bag
      const range = i < HOTBAR ? [HOTBAR, INV_SIZE] : [0, HOTBAR];
      const def = ITEMS[s.item];
      for (let j = range[0]; j < range[1] && s.count > 0; j++) {
        const t = inv.slots[j];
        if (t && t.item === s.item && def.stack > 1 && t.count < def.stack) { const n = Math.min(s.count, def.stack - t.count); t.count += n; s.count -= n; }
      }
      for (let j = range[0]; j < range[1] && s.count > 0; j++) if (!inv.slots[j]) { inv.slots[j] = { ...s }; s.count = 0; }
      if (s.count <= 0) inv.slots[i] = null;
      inv.changed();
      return;
    }
    const cur = this.cursor;
    if (button === 2) {
      if (!cur && s) { const half = Math.ceil(s.count / 2); this.cursor = { ...s, count: half }; s.count -= half; if (!s.count) inv.slots[i] = null; }
      else if (cur && (!s || (s.item === cur.item && s.count < ITEMS[s.item].stack))) {
        if (!s) inv.slots[i] = { ...cur, count: 1 }; else s.count++;
        cur.count--; if (!cur.count) this.cursor = null;
      }
    } else if (!cur) { if (s) { this.cursor = s; inv.slots[i] = null; } }
    else if (!s) { inv.slots[i] = cur; this.cursor = null; }
    else if (s.item === cur.item && ITEMS[s.item].stack > 1) {
      const n = Math.min(cur.count, ITEMS[s.item].stack - s.count); s.count += n; cur.count -= n; if (!cur.count) this.cursor = null;
    } else { inv.slots[i] = cur; this.cursor = s; }
    inv.changed();
    this.updateCursor();
  }

  updateCursor() {
    const el = $('cursorStack');
    el.hidden = !(this.screen === 'inventory' && this.cursor);
    if (!this.cursor) return;
    el.querySelector('.ico').setAttribute('style', this.game.icons.css(this.cursor.item, 40));
    el.querySelector('.n').textContent = this.cursor.count > 1 ? this.cursor.count : '';
  }
  moveCursor(x, y) { const el = $('cursorStack'); el.style.left = `${x - 20}px`; el.style.top = `${y - 20}px`; }

  // ---------------------------------------------------------------- touch

  bindTouch() {
    const g = this.game, t = $('touch');
    g.touch = { fwd: 0, strafe: 0, jump: false };
    t.innerHTML = `<div class="pad"><i></i></div>
      <button class="tb" data-a="jump" style="right:24px;bottom:110px">Jump</button>
      <button class="tb" data-a="mine" style="right:96px;bottom:160px">Mine</button>
      <button class="tb" data-a="place" style="right:24px;bottom:186px">Place</button>
      <button class="tb" data-a="inv" style="right:24px;top:60px">Bag</button>
      <button class="tb" data-a="pause" style="right:96px;top:60px">Menu</button>`;
    const pad = t.querySelector('.pad'), knob = pad.querySelector('i');
    let padId = null;
    pad.addEventListener('touchstart', (e) => { padId = e.changedTouches[0].identifier; e.preventDefault(); }, { passive: false });
    const padMove = (e) => {
      for (const tt of e.changedTouches) {
        if (tt.identifier !== padId) continue;
        const r = pad.getBoundingClientRect();
        let dx = (tt.clientX - r.left - 60) / 50, dy = (tt.clientY - r.top - 60) / 50;
        const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; }
        g.touch.strafe = dx; g.touch.fwd = -dy;
        knob.style.transform = `translate(${dx * 40}px, ${dy * 40}px)`;
      }
    };
    pad.addEventListener('touchmove', padMove, { passive: true });
    const padEnd = (e) => { for (const tt of e.changedTouches) if (tt.identifier === padId) { padId = null; g.touch.fwd = g.touch.strafe = 0; knob.style.transform = ''; } };
    pad.addEventListener('touchend', padEnd); pad.addEventListener('touchcancel', padEnd);
    for (const b of t.querySelectorAll('.tb')) {
      const a = b.dataset.a;
      b.addEventListener('touchstart', (e) => {
        e.preventDefault(); g.audio.start();
        if (a === 'jump') { g.touch.jump = true; g.pressed.add('Space'); }
        if (a === 'mine') { g.mouse.left = true; g.mouse.leftClicked = true; }
        if (a === 'place') { g.mouse.right = true; g.mouse.rightClicked = true; }
        if (a === 'inv') this.openInventory();
        if (a === 'pause') this.pause();
      }, { passive: false });
      b.addEventListener('touchend', () => { if (a === 'jump') g.touch.jump = false; if (a === 'mine') g.mouse.left = false; if (a === 'place') g.mouse.right = false; });
    }
    // look: drag anywhere else on the view
    const c = $('view'); let lookId = null, lx = 0, ly = 0;
    c.addEventListener('touchstart', (e) => { const tt = e.changedTouches[0]; lookId = tt.identifier; lx = tt.clientX; ly = tt.clientY; e.preventDefault(); }, { passive: false });
    c.addEventListener('touchmove', (e) => {
      for (const tt of e.changedTouches) if (tt.identifier === lookId) {
        g.player && g.player.look((tt.clientX - lx) * 1.6, (tt.clientY - ly) * 1.6, 0.0022 * this.settings.sensitivity);
        lx = tt.clientX; ly = tt.clientY;
      }
    }, { passive: true });
  }

  // ---------------------------------------------------------------- loop

  loop(now) {
    requestAnimationFrame((t) => this.loop(t));
    const g = this.game;
    const dt = Math.min(0.1, (now - this.lastFrame) / 1000);
    this.lastFrame = now;
    this.frames++; this.fpsTime += dt;
    if (this.fpsTime >= 0.5) { g.fps = this.frames / this.fpsTime; this.frames = 0; this.fpsTime = 0; }
    if (!g.world) return;
    const t0 = performance.now();
    try { g.frame(dt); } catch (e) {
      if (!this.frameError) { this.frameError = true; console.error(e); this.toast('Something went wrong: ' + e.message); }
    }
    g.frameMs = g.frameMs * 0.9 + (performance.now() - t0) * 0.1;
  }
}
