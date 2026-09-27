// Screens and HUD (Unity UI.*): title, new world, loading, HUD, inventory + crafting, creative palette, pause,
// settings, death. Also owns input: keyboard, mouse with pointer lock (free-look fallback), wheel, touch.
import { ITEMS, Kind, itemName, RECIPES, SMELT, fuelTime, FAM } from '../shared/blocks.js';
import { BIOME_NAMES } from '../shared/terrain.js';
const FAM_WAYSTONE = () => (FAM.waystone ? FAM.waystone.first : 1);
const BIOME_LABEL = (BIOME_NAMES || []).map((n) => n.replace(/([a-z])([A-Z])/g, '$1 $2'));
import { canCraft, craft, HOTBAR, INV_SIZE, MAX_AIR } from './gameplay.js';
import { MiniMap } from './minimap.js';

// tips on the loading and pause screens (the Tips mod: not in Minecraft)
const TIPS = [
  'Chop the bottom log of a tree with an axe and the whole tree comes down. Hold Shift to take just one log.',
  'Mine one ore with a pickaxe and the whole vein follows. Hold Shift to mine a single block.',
  'Die with items and they wait in a gravestone. Right-click it to get everything back where it was.',
  'Every village has a waystone by its well. Right-click one to join it to your network, then travel between them.',
  'Press M for the map. The minimap shows monsters in red, villagers in green and waystones in purple.',
  'Double-tap A or D to dodge sideways.',
  'Sit by a fire under a roof for a few seconds to get Rested: faster healing, less hunger and quicker mining.',
  'A backpack (6 leather, 2 string) carries 27 more stacks. Right-click it to open.',
  'A grappling hook (3 iron, 4 string) pulls you to any block within 32. Jump to let go.',
  'Doors next to each other open together.',
  'Press R to auto-walk; press it again (or S) to stop.',
  'Hold a torch, glowstone or a lava bucket to light your way through caves.',
  'A sleeping bag (3 wool, 2 leather) lets you sleep through the night anywhere without moving your respawn point.',
  'Craft a Slime Crown (20 slimeballs, 5 gold ingots) and use it to summon King Slime. Bring armour.',
  'Pour water into a glowstone frame to open a portal to the Skylands. Fall off an island and you drop back to the overworld.',
  'Three more bosses: a Blazing Core summons the Inferno Spirit, a Bone Crown the Hollow King, a Storm Tear the Storm Ghast (it also guards the sky temples).',
  'The Frost Colossus (summoned with a Frozen Heart) slams the ground and breathes frost that slows you. Keep your distance, but not too far.',
  'Bastions are guarded by the Hollow King and igloos by the Frost Colossus, once each. King Slime sometimes roams swamps at night.',
  'Boss Arena on the title screen: fight the bosses one after another, one at a time, or endlessly.',
  'Open the pause menu and choose Bosses for the list of bosses and how to find them.',
  'A Cloud in a Bottle, dropped by the Storm Ghast, gives you a second jump in the air.',
  'Seasons turn every three days: leaves go orange and gold in autumn, and crops barely grow in winter.',
  'Sort your inventory or a chest with the Sort button.',
  'Chests in villages, dungeons, pyramids and bastions hold loot the first time you open them.',
  'Villagers trade: right-click one. Farmers buy wheat, fletchers buy sticks, toolsmiths sell iron tools.',
  'Levers and buttons are easy to click now: aim anywhere near them.',
  'A hopper under a chest feeds a furnace below it: ores from above, fuel from the side.',
];
const tip = () => TIPS[Math.floor(Math.random() * TIPS.length)];
/** A fuller tooltip than Minecraft's: food values, durability, armour points, damage. */
function describe(s) {
  const d = ITEMS[s.item];
  if (!d) return itemName(s.item);
  const lines = [d.name];
  if (d.kind === Kind.Food) lines.push(`Restores ${d.food} hunger · ${d.sat} saturation`);
  if (d.kind === Kind.Armor) lines.push(`Armour +${d.points}`);
  if (d.damage) lines.push(`Melee damage ${d.damage}`);
  if (d.durability && !(d.name === 'Backpack')) lines.push(`Durability ${d.durability - (s.wear || 0)} / ${d.durability}`);
  if (d.name === 'Backpack') lines.push('Right-click to open (27 slots)');
  return lines.join(String.fromCharCode(10));
}
import { loadSettings, storeSettings } from './save.js';
import { PACK_NAMES, listBuiltinPacks } from './respack.js';

const $ = (id) => document.getElementById(id);
const DEFAULTS = { viewDistance: 7, renderScale: 1, fov: 75, sensitivity: 1, volume: 0.8, sfx: 1, ambience: 0.7, particles: 1,
  shadows: true, bloom: true, godRays: true, invertY: false, pom: 1, textures: 'lbpr',
  farDistance: 2000, resolution: '2160', dynamicRes: false, showFps: false, shadowQuality: 2048, shadowDistance: 88, leaves: 'fluffy', bloomStrength: 1,
  rayStrength: 1, clouds: true, ao: 1, dayCycle: 'normal', fixedHour: 12, dayLength: 20, weatherMode: 'dynamic', brightness: 1,
  nightBrightness: 1, saturation: 1, fog: 1, viewBob: true, difficulty: 'normal', mobs: true, minimap: true, lookInfo: true, timber: true, veinMine: true, graves: true, dash: true, handLight: true, seasons: true, seasonDays: 3, cloudQuality: 1, ssao: true, aa: true, sharpen: 0.6 };
const pct = (x) => `${Math.round(x * 100)}%`;
// every option: tab, key, label and either a range (min/max/step/fmt) or a choice list (values + labels) or a toggle
const OPTIONS = [
  { tab: 'Video', key: 'viewDistance', label: 'Render Distance', min: 3, max: 16, step: 1, fmt: (x) => `${x} chunks (${x * 32} m)` },
  { tab: 'Video', key: 'farDistance', label: 'Far Terrain', min: 0, max: 2000, step: 250, fmt: (x) => (x ? `${x} m` : 'OFF') },
  { tab: 'Video', key: 'resolution', label: 'Resolution', values: ['2160', '1440', '1080', '720', 'native'], labels: ['4K (2160p)', '1440p', '1080p', '720p', 'Native'] },
  { tab: 'Video', key: 'renderScale', label: 'Render Scale', min: 0.4, max: 1.5, step: 0.05, fmt: pct },
  { tab: 'Video', key: 'dynamicRes', label: 'Dynamic Resolution' },
  { tab: 'Video', key: 'fov', label: 'FOV', min: 55, max: 110, step: 1, fmt: (x) => `${x}°` },
  { tab: 'Video', key: 'viewBob', label: 'View Bobbing' },
  { tab: 'Video', key: 'showFps', label: 'Show FPS' },
  { tab: 'Video', key: 'brightness', label: 'Brightness', min: 0.5, max: 2, step: 0.05, fmt: pct },
  { tab: 'Quality', key: 'shadows', label: 'Shadows' },
  { tab: 'Quality', key: 'shadowQuality', label: 'Shadow Quality', values: [1024, 2048, 4096], labels: ['Low', 'High', 'Ultra'] },
  { tab: 'Quality', key: 'shadowDistance', label: 'Shadow Distance', min: 40, max: 200, step: 8, fmt: (x) => `${x} m` },
  { tab: 'Quality', key: 'leaves', label: 'Leaves', values: ['fast', 'fancy', 'fluffy'], labels: ['Fast', 'Fancy', 'Fluffy'] },
  { tab: 'Quality', key: 'pom', label: 'Surface Relief', min: 0, max: 2, step: 0.1, fmt: (x) => (x ? pct(x) : 'OFF') },
  { tab: 'Quality', key: 'ao', label: 'Ambient Occlusion', min: 0, max: 1.5, step: 0.05, fmt: pct },
  { tab: 'Quality', key: 'bloom', label: 'Bloom' },
  { tab: 'Quality', key: 'bloomStrength', label: 'Bloom Strength', min: 0, max: 2.5, step: 0.1, fmt: pct },
  { tab: 'Quality', key: 'godRays', label: 'Light Shafts' },
  { tab: 'Quality', key: 'rayStrength', label: 'Light Shaft Strength', min: 0, max: 2.5, step: 0.1, fmt: pct },
  { tab: 'Quality', key: 'clouds', label: 'Clouds' },
  { tab: 'Quality', key: 'cloudQuality', label: 'Cloud Style', values: [0, 1], labels: ['Flat', 'Volumetric'] },
  { tab: 'Quality', key: 'ssao', label: 'Contact Shadows (SSAO)' },
  { tab: 'Quality', key: 'aa', label: 'Anti-aliasing' },
  { tab: 'Quality', key: 'sharpen', label: 'Sharpening', min: 0, max: 1.5, step: 0.1, fmt: pct },
  { tab: 'Quality', key: 'particles', label: 'Rain, Snow, Spores', min: 0, max: 1, step: 0.1, fmt: pct },
  { tab: 'Sky & Time', key: 'dayCycle', label: 'Time', values: ['normal', 'day', 'night', 'fixed'], labels: ['Day and night', 'Always day', 'Always night', 'Fixed hour'] },
  { tab: 'Sky & Time', key: 'fixedHour', label: 'Fixed Hour', min: 0, max: 23.75, step: 0.25, fmt: (x) => `${String(Math.floor(x)).padStart(2, '0')}:${String(Math.round((x % 1) * 60)).padStart(2, '0')}` },
  { tab: 'Sky & Time', key: 'dayLength', label: 'Day Length', min: 5, max: 60, step: 5, fmt: (x) => `${x} min` },
  { tab: 'Sky & Time', key: 'weatherMode', label: 'Weather', values: ['dynamic', 'clear', 'cloudy', 'rain', 'storm', 'fog'], labels: ['Changing', 'Always clear', 'Cloudy', 'Rain', 'Storm', 'Fog'] },
  { tab: 'Sky & Time', key: 'difficulty', label: 'Difficulty', values: ['peaceful', 'normal'], labels: ['Peaceful', 'Normal'] },
  { tab: 'Sky & Time', key: 'mobs', label: 'Animals and Monsters' },
  { tab: 'Sky & Time', key: 'nightBrightness', label: 'Night Brightness', min: 0.4, max: 3, step: 0.1, fmt: pct },
  { tab: 'Sky & Time', key: 'saturation', label: 'Colour', min: 0, max: 1.6, step: 0.05, fmt: pct },
  { tab: 'Sky & Time', key: 'fog', label: 'Haze', min: 0, max: 2.5, step: 0.1, fmt: pct },
  { tab: 'Audio', key: 'volume', label: 'Master Volume', min: 0, max: 1, step: 0.05, fmt: pct },
  { tab: 'Audio', key: 'sfx', label: 'Blocks and Items', min: 0, max: 1, step: 0.05, fmt: pct },
  { tab: 'Audio', key: 'ambience', label: 'Ambient', min: 0, max: 1, step: 0.05, fmt: pct },
  { tab: 'Controls', key: 'sensitivity', label: 'Sensitivity', min: 0.2, max: 3, step: 0.05, fmt: (x) => x.toFixed(2) },
  { tab: 'Controls', key: 'invertY', label: 'Invert Mouse' },
  { tab: 'Controls', key: 'minimap', label: 'Minimap' },
  { tab: 'Controls', key: 'lookInfo', label: 'Block Info Panel' },
  { tab: 'Controls', key: 'timber', label: 'Fell Whole Trees' },
  { tab: 'Controls', key: 'veinMine', label: 'Mine Whole Ore Veins' },
  { tab: 'Controls', key: 'graves', label: 'Gravestones Keep Items' },
  { tab: 'Controls', key: 'dash', label: 'Dodge Dash (double-tap A/D)' },
  { tab: 'Quality', key: 'handLight', label: 'Held Torches Light Up' },
  { tab: 'Sky & Time', key: 'seasons', label: 'Seasons' },
  { tab: 'Sky & Time', key: 'seasonDays', label: 'Days per Season', min: 1, max: 10, step: 1, fmt: (x) => `${x}` },
];
const TABS = ['Video', 'Quality', 'Sky & Time', 'Audio', 'Controls', 'Textures'];
const GAME_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight', 'KeyE', 'KeyQ', 'KeyF',
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'F3', 'Tab', 'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9']);
const CAUSES = { fall: 'You hit the ground too hard.', drowning: 'You ran out of air.', starvation: 'You starved.', void: 'You fell out of the world.',
  lava: 'You tried to swim in lava.', magma: 'You discovered the floor was lava.', explosion: 'You blew up.',
  husk: 'You were slain by a Husk.', skeleton: 'You were shot by a Skeleton.', creeper: 'You were blown up by a Creeper.', spider: 'You were slain by a Spider.',
  wolf: 'You were slain by a Wolf.', zombified_piglin: 'You were slain by a Zombified Piglin.', blaze: 'You were burned by a Blaze.', ghast: 'You were fireballed by a Ghast.', stray: 'You were shot by a Stray.', wither_skeleton: 'You were slain by a Wither Skeleton.', cave_spider: 'You were slain by a Cave Spider.', king_slime: 'You were squashed by King Slime.', inferno_spirit: 'You were burned to ash by the Inferno Spirit.', hollow_king: 'You were slain by the Hollow King.', storm_ghast: 'You were struck down by the Storm Ghast.', frost_colossus: 'You were frozen by the Frost Colossus.', vindicator: 'You were slain by a Vindicator.', pillager: 'You were shot by a Pillager.', piglin_brute: 'You were slain by a Piglin Brute.', polar_bear: 'You were mauled by a Polar Bear.', slime_big: 'You were slain by a Slime.', slime_medium: 'You were slain by a Slime.' };

function svgHeart(fill) {
  const f = fill === 2 ? 'var(--heart)' : fill === 1 ? 'url(#half)' : 'rgba(0,0,0,0.45)';
  return `<svg viewBox="0 0 16 16"><defs><linearGradient id="half"><stop offset="50%" stop-color="#d8574a"/><stop offset="50%" stop-color="rgba(0,0,0,0.45)"/></linearGradient></defs><path d="M8 14.2 2.3 8.6A3.4 3.4 0 0 1 8 4.1a3.4 3.4 0 0 1 5.7 4.5Z" fill="${f}" stroke="#1a0906" stroke-width="1"/></svg>`;
}
function svgFood(fill) {
  const f = fill === 2 ? 'var(--food)' : fill === 1 ? 'rgba(201,138,75,0.55)' : 'rgba(0,0,0,0.45)';
  return `<svg viewBox="0 0 16 16"><path d="M9.6 2.2c2.6 0 4.2 1.7 4.2 4 0 2.6-2.4 4.4-4.9 4.4-.8 0-1.4-.2-1.9-.5L4.9 12.2a1.4 1.4 0 1 1-1.9-.1 1.4 1.4 0 1 1-.1-1.9L5 8.1c-.3-.5-.5-1.1-.5-1.8 0-2.3 2.2-4.1 5.1-4.1Z" fill="${f}" stroke="#1a0f06" stroke-width="1"/></svg>`;
}
function svgArmor(fill) {
  const f = fill === 2 ? '#dcdcdc' : fill === 1 ? 'url(#halfA)' : 'rgba(0,0,0,0.45)';
  return `<svg viewBox="0 0 16 16"><defs><linearGradient id="halfA"><stop offset="50%" stop-color="#dcdcdc"/><stop offset="50%" stop-color="rgba(0,0,0,0.45)"/></linearGradient></defs><path d="M3 2.5h3.2L8 4l1.8-1.5H13l.6 3.6-1.4.8V13.5H3.8V6.9L2.4 6.1Z" fill="${f}" stroke="#1a1a1a" stroke-width="1"/></svg>`;
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
      await g.init((msg) => { $('bootMsg').textContent = msg + '…'; }, this.settings.textures);
    } catch (e) { this.fatal(e); return; }
    g.applySettings(this.settings);
    $('bootMsg').textContent = '';
    $('storageNote').textContent = g.store.persistent ? 'saves stay in this browser' : 'saves last until you close the page';
    g.on('state', (s, cause) => this.onState(s, cause));
    g.on('inventory', () => { this.renderHotbar(); if (this.screen === 'inventory') this.renderInventory(); });
    g.on('openStation', () => { if (this.screen === 'playing') this.openInventory(); });
    g.on('station', () => { if (this.screen === 'inventory') this.renderStation(); });
    g.on('closeStation', () => { if (this.screen === 'inventory' && g.station) this.closeInventory(); });
    g.on('hud', () => this.renderStats());
    g.on('heldName', () => this.flashHeldName());
    g.on('toast', (t) => this.toast(t));
    g.on('pickup', (item, n) => this.pickup(item, n));
    g.on('loading', (p) => this.loadingProgress(p));
    g.on('travel', (d) => { this.travelTitle = ['Returning to the overworld', 'Entering the Nether', 'Entering the End', 'Entering the Skylands'][d]; });
    g.on('saved', (manual) => { if (manual) this.toast('Saved'); });
    await this.refreshWorlds();
    requestAnimationFrame((t) => this.loop(t));
    // the title backdrop, unless a world was already started while the saved-world list loaded
    if (!g.world) g.startMenuWorld().catch((e) => console.warn('menu world', e));
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
    for (const id of ['title', 'newWorld', 'loading', 'pause', 'settings', 'inventory', 'death', 'fatal', 'bigmap', 'arenaMenu', 'arenaWon']) $(id).hidden = id !== name;
    if (name === 'loading') $('loadTip').textContent = tip();
    if (name === 'pause') $('pauseTip').textContent = tip();
    $('hud').hidden = !['playing', 'inventory', 'pause', 'death'].includes(name) || !this.game.world || !!(this.game.meta && this.game.meta.menu);
    $('touch').hidden = !(this.touchMode && name === 'playing');
    this.screen = name;
    $('cursorStack').hidden = !(name === 'inventory' && this.cursor);
  }

  onState(s, cause) {
    const g = this.game;
    if (g.meta && g.meta.menu) return;
    if (s === 'loading') { this.show('loading'); $('loadTitle').textContent = this.travelTitle || g.meta.name; this.travelTitle = null; }
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
    $('travelRow').hidden = !this.game.creative;
    if (!this.game.world || this.screen === 'pause') return;
    this.unlock();
    const g = this.game;
    g.state = 'paused';
    g.keys.clear();
    g.mouse.left = g.mouse.right = false;
    const p = g.player.body.pos;
    $('pauseInfo').textContent = `${g.meta.name} · x ${p[0].toFixed(0)} y ${p[1].toFixed(0)} z ${p[2].toFixed(0)}${g.meta.unsaved ? ' · not saved' : ''}`;
    $('btnQuit').textContent = g.meta.unsaved ? 'Quit to title' : 'Save and quit to title';
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
    g.station = null;
    g.state = 'playing';
    this.show('playing');
    this.lock();
  }

  // ---------------------------------------------------------------- pointer lock

  /** fromClick: called inside a click, where the browser is allowed to capture the mouse. */
  lock(fromClick = false) {
    const c = $('view');
    if (this.touchMode || this.lockUnavailable) return;
    if (document.pointerLockElement === c) return;
    this.lockFromClick = fromClick;
    try {
      const r = c.requestPointerLock();
      if (r && r.catch) r.catch(() => this.lockFailed());
    } catch { this.lockFailed(); }
    c.focus();
  }
  lockFailed() {
    if (this.lockFromClick) {
      // capture refused even from a click: play with the free cursor (mouse movement looks, arrows turn)
      this.lockUnavailable = true;
      $('clickHint').textContent = 'Mouse capture is blocked here. Move the mouse to look; arrow keys turn.';
      $('clickHint').hidden = false;
      setTimeout(() => { $('clickHint').hidden = true; }, 5000);
      return;
    }
    if (this.screen === 'playing') { $('clickHint').textContent = 'Click to look around'; $('clickHint').hidden = false; }
  }
  unlock() { this.expectUnlock = true; if (document.pointerLockElement) document.exitPointerLock(); }

  // ---------------------------------------------------------------- input

  bindStatic() {
    const g = this.game, c = $('view');
    $('btnNew').onclick = () => { g.audio.start(); g.audio.click(); this.show('newWorld'); $('nwName').focus(); };
    $('btnContinue').onclick = () => this.worlds && this.worlds[0] && this.play(this.worlds[0], false);
    const sandbox = (extra, name) => this.play({ id: `sandbox${Date.now().toString(36)}`, name, seed: (Math.random() * 4294967296) >>> 0,
      mode: 'creative', unsaved: true, created: Date.now(), lastPlayed: Date.now(), ...extra }, true);
    $('btnSandbox').onclick = () => sandbox({}, 'Creative sandbox');
    $('btnSandboxNether').onclick = () => sandbox({ startDim: 1 }, 'Nether sandbox');
    $('btnSandboxEnd').onclick = () => sandbox({ startDim: 2 }, 'End sandbox');
    $('btnSandboxFlat').onclick = () => sandbox({ flat: true }, 'Superflat sandbox');
    // creative: jump straight to another dimension from the pause menu
    const go = (d) => { if (!g.creative || !g.world) return; this.resume(); g.goToDimension(d); };
    $('btnGoOver').onclick = () => go(0); $('btnGoNether').onclick = () => go(1); $('btnGoEnd').onclick = () => go(2); $('btnGoSky').onclick = () => go(3);
    $('btnSandboxSky').onclick = () => sandbox({ startDim: 3 }, 'Skylands sandbox');
    // the Boss Arena: a flat, unsaved world of nothing but boss fights
    const arena = (mode) => this.play({ id: `arena${Date.now().toString(36)}`, name: 'Boss Arena', seed: 1234, mode: 'survival', unsaved: true, flat: true, arena: mode, created: Date.now(), lastPlayed: Date.now() }, true);
    $('btnArena').onclick = () => this.show('arenaMenu');
    $('btnArenaBack').onclick = () => this.show('title');
    for (const b of document.querySelectorAll('#arenaMenu [data-arena]')) b.onclick = () => arena(b.dataset.arena);
    g.on('arenaWon', (a) => {
      const t = a.total, best = g.meta.arenaBest;
      $('arenaWonText').textContent = `${a.order.length === 1 ? 'Boss defeated' : 'All bosses defeated'} in ${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}${a.deaths ? ` with ${a.deaths} retr${a.deaths > 1 ? 'ies' : 'y'}` : ' without dying'}.`;
      g.state = 'paused'; this.unlock(); this.show('arenaWon');
    });
    $('btnArenaAgain').onclick = () => arena(g.arena ? g.arena.mode : 'rush');
    $('btnArenaTitle').onclick = () => this.toTitle();
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
    let startDim = 0, flat = false;
    const setDim = (d) => { startDim = d; for (let k = 0; k < 4; k++) $(`nwDim${k}`).setAttribute('aria-pressed', k === d); };
    const setFlat = (f) => { flat = f; $('nwTypeDefault').setAttribute('aria-pressed', !f); $('nwTypeFlat').setAttribute('aria-pressed', f); };
    for (let k = 0; k < 4; k++) $(`nwDim${k}`).onclick = () => setDim(k);
    $('nwTypeDefault').onclick = () => setFlat(false); $('nwTypeFlat').onclick = () => setFlat(true);
    $('nwSurvival').onclick = () => setMode('survival');
    $('nwCreative').onclick = () => setMode('creative');
    $('newForm').onsubmit = (e) => {
      e.preventDefault();
      const seed = parseSeed($('nwSeed').value);
      const name = $('nwName').value.trim() || 'New World';
      this.play({ id: `w${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`, name, seed, mode, created: Date.now(), lastPlayed: Date.now(),
        ...(startDim ? { startDim } : {}), ...(flat ? { flat: true } : {}) }, true);
    };
    $('btnResume').onclick = () => this.resume();
    $('btnBosses').onclick = () => {
      const el = $('bossList'), beaten = (g.meta && g.meta.bossesDefeated) || {};
      const list = [['king_slime', 'King Slime', 'Craft a Slime Crown (20 slimeballs, 5 gold ingots) and use it.'],
        ['inferno_spirit', 'Inferno Spirit', 'Craft a Blazing Core (4 blaze rods, 4 gold ingots). Drops the Flame Blade.'],
        ['hollow_king', 'Hollow King', 'Craft a Bone Crown (12 bones, 4 coal, a gold ingot). Drops the Bone Greatsword.'],
        ['frost_colossus', 'Frost Colossus', 'Craft a Frozen Heart (4 packed ice, a diamond). Drops the Frostbrand.'],
        ['storm_ghast', 'Storm Ghast', 'Guards the floating temples of the Skylands, or craft a Storm Tear. Drops a Cloud in a Bottle.']];
      el.innerHTML = list.map(([k, n, how]) => `<div><b>${n}</b> <span class="${beaten[k] ? 'done' : ''}">${beaten[k] ? `defeated ×${beaten[k]}` : 'not yet defeated'}</span><small>${how}</small></div>`).join('');
      el.hidden = !el.hidden;
    };
    $('btnMode').onclick = () => { g.setMode(!g.creative); $('btnMode').textContent = g.creative ? 'Switch to survival' : 'Switch to creative'; this.renderStats(); };
    $('btnQuit').onclick = async () => { await g.save(true); this.toTitle(); };
    $('btnRespawn').onclick = () => g.respawn();
    $('btnDeathQuit').onclick = async () => { g.stats.reset(); g.player.teleport(g.spawn); await g.save(); this.toTitle(); };
    this.renderControls();
    this.bindPack();
    this.bindTextures();

    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === c;
      if (this.locked) { $('clickHint').hidden = true; return; }
      if (this.expectUnlock) { this.expectUnlock = false; return; }
      if (this.screen === 'playing') this.pause();   // Esc released the mouse
    });
    document.addEventListener('pointerlockerror', () => this.lockFailed());
    c.addEventListener('click', () => { if (this.screen === 'playing' && !this.locked && !this.touchMode && !this.lockUnavailable) this.lock(true); });

    c.addEventListener('mousedown', (e) => {
      if (this.screen !== 'playing') return;
      g.audio.start();
      if (!this.locked && !this.touchMode && !this.lockUnavailable) { this.lock(true); e.preventDefault(); return; }   // this click only captures the mouse
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
      if (!this.locked && !(this.lockUnavailable && e.target === c)) return;
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
        if (k === 'KeyE' || k === 'Tab') this.openInventory();
        else if (k === 'Escape' || k === 'KeyP') this.pause();
        else if (k === 'F3') { this.debug = !this.debug; $('debug').hidden = !this.debug; }
        else if (k === 'KeyM') this.openMap();
      } else if (this.screen === 'inventory') {
        if (k === 'KeyE' || k === 'Tab' || k === 'Escape') this.closeInventory();
        else if (/^Digit[1-9]$/.test(k) && this.hoverSlot != null) { g.inventory.move(this.hoverSlot, +k.slice(5) - 1); }
      } else if (this.screen === 'bigmap' && (k === 'KeyM' || k === 'Escape')) this.resume();
      else if (this.screen === 'pause' && (k === 'Escape' || k === 'KeyP')) this.resume();
      else if (this.screen === 'settings' && k === 'Escape') { storeSettings(this.settings); this.show(this.settingsBack); }
    });
    window.addEventListener('keyup', (e) => g.keys.delete(e.code));
    window.addEventListener('blur', () => { g.keys.clear(); g.mouse.left = g.mouse.right = false; });

    if (this.touchMode) this.bindTouch();
  }

  toTitle() {
    const g = this.game;
    g.stopWorld(); g.state = 'title';
    this.show('title');
    this.refreshWorlds();
    g.startMenuWorld().catch((e) => console.warn('menu world', e));
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
      ['Left mouse', 'Mine (hold)'], ['Right mouse', 'Place block · eat · put on armour'], ['Right mouse on a block', 'Use it: crafting table, furnace, chest, bed, door, lever, button, repeater'], ['M', 'Map'], ['R', 'Auto-walk'], ['Double-tap A / D', 'Dodge'], ['Shift + right mouse', 'Place against a usable block'], ['Middle mouse', 'Pick block'], ['1–9 / wheel', 'Choose hotbar slot'], ['E', 'Inventory and crafting'],
      ['Q', 'Drop item (Ctrl+Q: stack)'], ['F', 'Toggle flight (creative)'], ['F3', 'Debug info'], ['Esc', 'Pause']];
    $('controlsList').innerHTML = rows.map(([k, v]) => `<span>${k.split(' / ').map((x) => `<kbd>${x}</kbd>`).join(' ')}</span><span>${v}</span>`).join('');
  }

  // ---------------------------------------------------------------- settings

  openSettings() {
    this.renderPack();
    this.renderTextures();
    this.showTab(this.settingsTab || 'Video');
    this.show('settings');
  }

  /** Builds one tab of options (sliders, cycling buttons, toggles) from OPTIONS. */
  showTab(tab) {
    const s = this.settings, g = this.game;
    this.settingsTab = tab;
    const bar = $('settingsTabs');
    bar.innerHTML = '';
    for (const t of TABS) {
      const b = document.createElement('button'); b.textContent = t; b.setAttribute('role', 'tab');
      b.classList.toggle('on', t === tab); b.onclick = () => { g.audio.click(); this.showTab(t); };
      bar.appendChild(b);
    }
    $('settingsTextures').hidden = tab !== 'Textures';
    const body = $('settingsBody');
    body.hidden = tab === 'Textures';
    body.innerHTML = '';
    const apply = () => { g.applySettings(s); storeSettings(s); };
    for (const o of OPTIONS.filter((x) => x.tab === tab)) {
      if (o.values) {
        const b = document.createElement('button'); b.className = 'cycle'; b.id = 'opt-' + o.key;
        const label = () => { b.textContent = `${o.label}: ${o.labels[Math.max(0, o.values.indexOf(s[o.key]))]}`; };
        label();
        b.onclick = (e) => { const i = o.values.indexOf(s[o.key]); s[o.key] = o.values[(i + (e.shiftKey ? o.values.length - 1 : 1)) % o.values.length]; label(); g.audio.click(); apply(); };
        body.appendChild(b);
      } else if (o.min != null) {
        const l = document.createElement('label'); l.className = 'slider';
        const v = document.createElement('span'); v.className = 'val';
        const i = document.createElement('input'); i.type = 'range'; i.min = o.min; i.max = o.max; i.step = o.step; i.value = s[o.key]; i.id = 'opt-' + o.key;
        const upd = () => { v.textContent = o.fmt(+i.value); };
        l.append(o.label, v, i); upd();
        i.oninput = () => { s[o.key] = +i.value; upd(); g.applySettings(s); };
        i.onchange = () => storeSettings(s);
        body.appendChild(l);
      } else {
        const l = document.createElement('label'); l.className = 'toggle';
        const i = document.createElement('input'); i.type = 'checkbox'; i.checked = !!s[o.key]; i.id = 'opt-' + o.key;
        i.onchange = () => { s[o.key] = i.checked; apply(); };
        l.append(i, o.label);
        body.appendChild(l);
      }
    }
    $('settingsHint').textContent = { Video: 'Far Terrain shows the landscape beyond the loaded world, up to 2 km. Lower the render distance or render scale if the game stutters.',
      Quality: 'Shift-click a choice to step back. Fluffy leaves add loose clusters around tree canopies.',
      'Sky & Time': '"Always day" and "Always night" stop the clock; "Fixed hour" holds the time you pick.',
      Audio: '', Controls: 'WASD move, Space jump, Ctrl sprint, E inventory, Q drop, F fly (creative), F3 debug.', Textures: '' }[tab] || '';
  }

  // ---------------------------------------------------------------- resource pack

  bindTextures() {
    const g = this.game;
    const pick = async (name) => {
      if (this.texBusy) return;
      this.texBusy = true;
      $('texCredit').textContent = 'Loading textures…';
      try {
        await g.setTextureSet(name);
        this.settings.textures = name; storeSettings(this.settings);
        this.paletteBuilt = false; this.renderHotbar();
      } catch (e) { $('texCredit').textContent = `Could not load those textures: ${e.message}`; this.texBusy = false; return; }
      this.texBusy = false;
      this.renderTextures();
    };
    $('btnTexLbpr').onclick = () => pick('lbpr');
    $('btnTexOriginal').onclick = () => pick('original');
    g.on('textures', () => this.renderTextures());
  }

  renderTextures() {
    const set = this.game.builtin;
    if (!set) return;
    $('btnTexLbpr').classList.toggle('on', set.name === 'lbpr');
    $('btnTexOriginal').classList.toggle('on', set.name === 'original');
    const el = $('texCredit');
    el.textContent = '';
    if (set.credit) {
      // the pack's licence asks for credit with a link to its CurseForge page
      const c = set.credit;
      el.append(`Blocks, items, cracks, moon and sounds: ${c.name} v${c.version} by ${c.author} (`);
      const a = document.createElement('a'); a.href = c.url; a.target = '_blank'; a.rel = 'noopener'; a.textContent = 'CurseForge';
      el.append(a, `), based on ${c.based_on}. Normal, height and roughness maps are generated from its colours.`);
    } else el.textContent = 'The game\'s own photographic materials.';
  }

  bindPack() {
    const g = this.game;
    const opts = () => ({ normalYDown: $('sPackDX').checked, oldPbr: $('sPackOld').checked });
    $('sPackDX').checked = true;
    $('btnPackLoad').onclick = () => $('packFile').click();
    $('packFile').onchange = () => { const f = $('packFile').files[0]; $('packFile').value = ''; if (f) this.loadPack(f); };
    $('btnPackRemove').onclick = async () => { await g.removePack(); this.paletteBuilt = false; this.renderPack(); this.renderHotbar(); $('packStatus').textContent = 'Back to the built-in textures.'; };
    for (const id of ['sPackDX', 'sPackOld']) $(id).onchange = async () => {
      if (!g.pack) return;
      $('packStatus').textContent = 'Converting…';
      try { await g.repackWith(opts()); $('packStatus').textContent = 'Updated.'; } catch (e) { $('packStatus').textContent = e.message; }
      this.renderPack();
    };
    // drag a pack onto the page
    let depth = 0;
    const isZip = (e) => [...(e.dataTransfer && e.dataTransfer.items || [])].some((i) => i.kind === 'file');
    window.addEventListener('dragenter', (e) => { if (!isZip(e)) return; depth++; $('dropHint').hidden = false; e.preventDefault(); });
    window.addEventListener('dragover', (e) => { if (isZip(e)) e.preventDefault(); });
    window.addEventListener('dragleave', () => { if (--depth <= 0) { depth = 0; $('dropHint').hidden = true; } });
    window.addEventListener('drop', (e) => {
      depth = 0; $('dropHint').hidden = true;
      const f = e.dataTransfer && e.dataTransfer.files[0];
      if (!f) return;
      e.preventDefault();
      if (this.screen === 'playing') this.pause();
      if (this.screen !== 'settings') { this.settingsBack = this.game.world && !(this.game.meta && this.game.meta.menu) ? 'pause' : 'title'; this.openSettings(); }
      this.loadPack(f);
    });
    this.packOpts = opts;
    // the packs that ship with the game: one button each, plus Default (the game's own textures)
    listBuiltinPacks(g.assetBase).then((list) => {
      const row = $('builtinPacks');
      for (const p of list) {
        const b = document.createElement('button');
        b.dataset.pack = p.id; b.textContent = p.name; b.title = `${p.description}\n${p.credit}`;
        row.appendChild(b);
      }
      for (const b of row.querySelectorAll('button')) b.onclick = () => this.useBuiltin(b.dataset.pack);
      this.renderPack();
    });
  }

  async loadPack(file) {
    const g = this.game;
    $('packStatus').textContent = `Reading ${file.name} (${(file.size / 1048576).toFixed(1)} MB)…`;
    $('btnPackLoad').disabled = true;
    try {
      const info = await g.loadPackFile(file, this.packOpts());
      this.paletteBuilt = false;
      this.renderHotbar();
      const st = info.stats || {};
      $('packStatus').textContent = `Using ${info.found.length} block textures at ${info.source}×${info.source}` +
        `${st.variantSets ? `, ${st.variantSets} random/connected sets` : ''}${st.animations ? `, ${st.animations} animations` : ''}` +
        `${info.items ? `, ${info.items} items` : ''}${info.sounds ? `, ${info.sounds} sounds` : ''}` +
        `${st.generated ? `; ${st.generated} textures got generated relief` : ''}` +
        (info.source > info.size ? ` (shown at ${info.size}×${info.size} to fit GPU memory)` : '') + (info.stored ? '. Kept in this browser.' : '. Storage is blocked here, so load it again next time.');
    } catch (e) {
      console.warn(e);
      $('packStatus').textContent = `Could not use that pack: ${e.message}`;
    }
    $('btnPackLoad').disabled = false;
    this.renderPack();
  }

  async useBuiltin(id) {
    const g = this.game;
    const buttons = $('builtinPacks').querySelectorAll('button');
    buttons.forEach((b) => { b.disabled = true; });
    $('packStatus').textContent = id ? 'Loading the pack…' : '';
    try {
      if (id) {
        const info = await g.useBuiltinPack(id);
        $('packStatus').textContent = `Using ${info.found.length} block textures at ${info.source}×${info.source}. ${info.credit}`;
      } else if (g.pack) { await g.removePack(); $('packStatus').textContent = 'Back to the default textures.'; }
    } catch (e) { $('packStatus').textContent = `Could not load the pack: ${e.message}`; }
    buttons.forEach((b) => { b.disabled = false; });
    this.paletteBuilt = false; this.renderPack(); this.renderHotbar();
  }

  renderPack() {
    const p = this.game.pack;
    const current = p ? (p.builtin || '#file') : '';
    for (const b of $('builtinPacks').querySelectorAll('button')) b.classList.toggle('on', b.dataset.pack === current);
    $('sPackDX').disabled = $('sPackOld').disabled = !!(p && p.builtin);
    $('packName').textContent = p ? p.name : 'Built-in textures';
    $('btnPackRemove').hidden = !p;
    if (p) {
      $('packInfo').textContent = `${p.description ? p.description + ' · ' : ''}${p.found.length} block textures from the pack; the rest stay built-in.`;
      $('sPackDX').checked = p.opts.normalYDown !== false; $('sPackOld').checked = !!p.opts.oldPbr;
    }
    const icon = p && this.game.packIcon;
    $('packIcon').style.backgroundImage = icon ? `url(${icon})` : '';
  }

  // ---------------------------------------------------------------- HUD

  slotHTML(stack, px) {
    if (!stack) return '';
    const def = ITEMS[stack.item];
    let h = `<div class="ico" style="${this.game.icons.css(stack.item, px)}"></div>`;
    if (stack.count > 1) h += `<span class="n">${stack.count}</span>`;
    if (def && def.durability && stack.wear) {
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
    const d = s && ITEMS[s.item];
    // AppleSkin-style: what the held food restores
    el.textContent = s ? itemName(s.item) + (d && d.kind === Kind.Food ? `  (+${d.food} hunger, +${d.sat} saturation)` : '') : '';
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
      const ak2 = g.inventory.defense;
      if (ak2 !== this.lastArmor) { $('armorBar').innerHTML = ak2 > 0 ? icons(ak2, svgArmor) : ''; this.lastArmor = ak2; }
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
    $('btnSort').onclick = () => { this.sortSlots(inv.slots, HOTBAR, INV_SIZE); g.audio.click(); inv.changed(); };
    const names = ['Helmet', 'Chestplate', 'Leggings', 'Boots'];
    $('invArmor').innerHTML = inv.armor.map((s, i) => `<div class="slot" data-armor="${i}" title="${s ? itemName(s.item) : names[i]}">${this.slotHTML(s, px)}</div>`).join('');
    for (const el of document.querySelectorAll('#invArmor .slot')) {
      el.oncontextmenu = (e) => e.preventDefault();
      el.onmousedown = (e) => {
        e.preventDefault();
        const i = +el.dataset.armor;
        if (e.shiftKey && inv.armor[i] && !this.cursor) { if (!inv.add(inv.armor[i].item, 1, inv.armor[i])) inv.armor[i] = null; inv.changed(); return; }
        this.arrClick(inv.armor, i, 0, (item) => ITEMS[item] && ITEMS[item].kind === Kind.Armor && ITEMS[item].slot === i);
        inv.changed(); g.emit('hud');
      };
    }
    for (const el of document.querySelectorAll('#inventory .slot[data-slot]')) {
      el.onmousedown = (e) => { e.preventDefault(); this.slotClick(+el.dataset.slot, e.button, e.shiftKey); };
      el.oncontextmenu = (e) => e.preventDefault();
      el.onmouseenter = () => { this.hoverSlot = +el.dataset.slot; };
      el.onmouseleave = () => { this.hoverSlot = null; };
      el.title = inv.slots[+el.dataset.slot] ? describe(inv.slots[+el.dataset.slot]) : '';
    }
    // a chest or furnace, crafting (survival, or at a table), or the palette (creative)
    const st = g.station, trade = st && (st.kind === 'trade' || st.kind === 'waystones'), box = st && (st.kind === 'chest' || st.kind === 'furnace'), crafting = !box && !trade && (!g.creative || (st && st.kind === 'table'));
    $('sideTitle').textContent = trade ? `${st.name} · Trades` : box ? st.name : crafting ? (st && st.kind === 'table' ? 'Crafting Table' : 'Crafting') : 'All blocks and items';
    $('station').hidden = !box;
    $('recipes').hidden = !crafting && !trade; $('recipeSearch').hidden = !crafting;
    $('palette').hidden = !(g.creative && !st); $('paletteSearch').hidden = !(g.creative && !st);
    if (st && st.kind === 'waystones') {
      $('sideTitle').textContent = `${st.name} · Waystones`;
      $('sideTip').textContent = g.creative ? 'Click a waystone to travel there.' : 'Travelling costs three hunger points.';
      const rec = $('recipes');
      rec.innerHTML = '';
      const list = (g.meta.waystones || []).filter((w) => w !== st.from && !(w.x === st.from.x && w.y === st.from.y && w.z === st.from.z && w.dim === st.from.dim));
      if (!list.length) rec.innerHTML = '<p class="hint">No other waystones yet. Every village has one by its well, and you can craft them (6 stone bricks, 2 gold ingots).</p>';
      const here = g.player.body.pos;
      for (const w of list) {
        const b = document.createElement('button');
        b.className = 'recipe';
        const dist = (w.dim || 0) === (g.dim || 0) ? `${Math.round(Math.hypot(w.x - here[0], w.z - here[2]))} m away` : ['Overworld', 'Nether', 'The End', 'Skylands'][w.dim || 0];
        b.innerHTML = `<div class="ico-slot"><div class="ico" style="${g.icons.css(FAM_WAYSTONE(), 32)}"></div></div><div>${w.name}<small><span class="have">${w.x} ${w.y} ${w.z} · ${dist}</span></small></div>`;
        b.onclick = () => { this.closeInventory(); g.travelWaystone(w); };
        rec.appendChild(b);
      }
      this.updateCursor();
      return;
    }
    if (trade) {
      $('sideTip').textContent = 'Click an offer to trade. Emeralds come from trading and from chests.';
      const rec = $('recipes');
      rec.innerHTML = '';
      for (const r of st.trades) {
        const ok = canCraft(inv, r), b = document.createElement('button');
        b.className = 'recipe'; b.disabled = !ok;
        const ins = r.inputs.map(([item, n]) => `<span class="${inv.count(item) >= n ? 'have' : 'miss'}">${n}× ${itemName(item)}</span>`).join('');
        b.innerHTML = `<div class="ico-slot"><div class="ico" style="${g.icons.css(r.out, 32)}"></div></div><div>${r.count > 1 ? r.count + '× ' : ''}${r.name}<small>${ins}</small></div>`;
        b.onclick = () => { if (craft(inv, r)) { g.audio.click(); this.game.emit('toast', `Traded for ${r.count}× ${r.name}`); } };
        rec.appendChild(b);
      }
      this.updateCursor();
      return;
    }
    $('sideTip').textContent = box ? 'Shift-click moves stacks between your inventory and the ' + (st.kind === 'furnace' ? 'furnace (ores and food go in, fuel below).' : st.name.toLowerCase() + '.')
      : crafting ? (st ? 'Shift-click a recipe to craft as many as you can.' : 'Small recipes only. Use a crafting table for the rest. Shift-click crafts as many as you can.')
        : 'Click to take a full stack. Drop items back here to delete them.';
    if (box) this.renderStation();
    else if (!crafting) {
      if (!this.paletteBuilt) {
        this.paletteBuilt = true;
        const ids = Object.keys(ITEMS).map(Number);
        $('palette').innerHTML = ids.map((id) => `<div class="slot" data-item="${id}" title="${itemName(id)}"><div class="ico" style="${g.icons.css(id, px)}"></div></div>`).join('');
        const search = $('paletteSearch');
        search.oninput = () => {
          const q = search.value.trim().toLowerCase();
          for (const el of $('palette').children) el.hidden = !!q && !el.title.toLowerCase().includes(q);
        };
        search.onkeydown = (e) => e.stopPropagation();
        search.oninput();
        for (const el of $('palette').children) el.onmousedown = (e) => {
          e.preventDefault();
          if (this.cursor) { this.cursor = null; this.updateCursor(); return; }
          const id = +el.dataset.item; this.cursor = { item: id, count: ITEMS[id].stack }; this.updateCursor(); g.audio.click();
        };
      }
    } else {
      const rec = $('recipes'), table = !!(st && st.kind === 'table');
      rec.innerHTML = '';
      const search = $('recipeSearch');
      if (!search.bound) { search.bound = true; search.onkeydown = (e) => e.stopPropagation(); search.oninput = () => this.renderInventory(); }
      const q = search.value.trim().toLowerCase();
      const sorted = RECIPES.map((r, i) => ({ r, i, ok: canCraft(inv, r) && (table || !r.table) }))
        .filter(({ r }) => (!q || r.name.toLowerCase().includes(q)) && (table || !r.table || q))
        .sort((a, b) => (b.ok - a.ok) || a.i - b.i).slice(0, q ? 400 : 160);
      for (const { r, ok } of sorted) {
        const b = document.createElement('button');
        b.className = 'recipe';
        b.disabled = !ok;
        const ins = r.inputs.map(([item, n]) => `<span class="${inv.count(item) >= n ? 'have' : 'miss'}">${n}× ${itemName(item)}</span>`).join('');
        const needs = r.table && !table ? '<span class="miss">needs a crafting table</span>' : '';
        b.innerHTML = `<div class="ico-slot"><div class="ico" style="${g.icons.css(r.out, 32)}"></div></div><div>${r.count > 1 ? r.count + '× ' : ''}${r.name}<small>${ins}${needs}</small></div>`;
        b.onclick = (e) => {
          if (r.table && !table) return;
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
    if (shift && !this.cursor && s && g.station && g.station.data && !(g.station.bag && ITEMS[s.item] && ITEMS[s.item].name === 'Backpack')) {
      const d = g.station.data;
      if (g.station.kind === 'furnace') {
        const k = SMELT.has(s.item) ? 0 : fuelTime(s.item) > 0 ? 1 : -1;
        if (k >= 0) { const t = d.slots[k]; if (!t) { d.slots[k] = { ...s }; inv.slots[i] = null; } else if (t.item === s.item) { const n = Math.min(s.count, ITEMS[s.item].stack - t.count); t.count += n; s.count -= n; if (!s.count) inv.slots[i] = null; } }
      } else {
        const def = ITEMS[s.item];
        for (const t of d.slots) if (t && t.item === s.item && def.stack > 1 && t.count < def.stack && s.count > 0) { const n = Math.min(s.count, def.stack - t.count); t.count += n; s.count -= n; }
        for (let j = 0; j < d.slots.length && s.count > 0; j++) if (!d.slots[j]) { d.slots[j] = { ...s }; s.count = 0; }
        if (s.count <= 0) inv.slots[i] = null;
      }
      inv.changed(); this.renderStation();
      return;
    }
    if (shift && !this.cursor && s && ITEMS[s.item] && ITEMS[s.item].kind === Kind.Armor && !inv.armor[ITEMS[s.item].slot]) {
      inv.armor[ITEMS[s.item].slot] = s; inv.slots[i] = null; inv.changed(); g.emit('hud');
      return;
    }
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

  /** Stacks merged and ordered by kind: tools, weapons, armour, food, blocks, materials. */
  sortSlots(arr, from, to) {
    const items = arr.slice(from, to).filter(Boolean), merged = [];
    for (const s of items) {
      const def = ITEMS[s.item];
      const m = def && def.stack > 1 && merged.find((t) => t.item === s.item && t.count < def.stack);
      if (m) { const n = Math.min(s.count, def.stack - m.count); m.count += n; s.count -= n; if (s.count > 0) merged.push({ ...s }); }
      else merged.push({ ...s });
    }
    const order = (s) => { const d = ITEMS[s.item] || {}; return d.kind === Kind.Tool ? 0 : d.kind === Kind.Armor ? 1 : d.kind === Kind.Use ? 2 : d.kind === Kind.Food ? 3 : d.kind === Kind.Block ? 4 : 5; };
    merged.sort((a, b) => order(a) - order(b) || a.item - b.item || b.count - a.count);
    for (let i = from; i < to; i++) arr[i] = merged[i - from] || null;
  }

  /** The open chest's slots or the furnace (input, fuel, output with progress). */
  renderStation() {
    const g = this.game, st = g.station;
    if (!st || !st.data) return;
    const d = st.data, px = window.innerWidth <= 720 ? 26 : 34, el = $('station');
    const slot = (i) => `<div class="slot" data-st="${i}">${this.slotHTML(d.slots[i], px)}</div>`;
    if (st.kind === 'furnace') {
      const burn = d.burnMax ? Math.max(0, d.burn / d.burnMax) : 0, cook = Math.min(1, d.cook / 10);
      el.innerHTML = `<div class="furnace">${slot(0)}<div></div><div></div>
        <div class="flame"><i style="width:${Math.round(burn * 100)}%"></i></div><div class="arrow"><i style="width:${Math.round(cook * 100)}%"></i></div>${slot(2)}
        ${slot(1)}<div></div><div></div></div>`;
    } else el.innerHTML = `<div class="grid9">${d.slots.map((_, i) => slot(i)).join('')}</div><button type="button" class="mini" id="btnSortBox">Sort</button>`;
    const sb = el.querySelector('#btnSortBox');
    if (sb) sb.onclick = () => { this.sortSlots(d.slots, 0, d.slots.length); g.audio.click(); this.renderStation(); };
    for (const s of el.querySelectorAll('.slot[data-st]')) {
      const i = +s.dataset.st;
      s.title = d.slots[i] ? itemName(d.slots[i].item) : '';
      s.oncontextmenu = (e) => e.preventDefault();
      s.onmousedown = (e) => {
        e.preventDefault();
        const inv = g.inventory, it = d.slots[i];
        if (e.shiftKey && it && !this.cursor) {            // back into the inventory
          const left = inv.add(it.item, it.count, it);
          if (left) it.count = left; else d.slots[i] = null;
          g.audio.click(); this.renderStation(); return;
        }
        const accept = st.kind !== 'furnace' ? (st.bag ? (item) => !(ITEMS[item] && ITEMS[item].name === 'Backpack') : null) : i === 2 ? () => false : i === 1 ? (item) => fuelTime(item) > 0 : null;
        this.arrClick(d.slots, i, e.button, accept);
        inv.changed(); this.renderStation();
      };
    }
  }

  /** Click on a slot of any slot array (accept: which items may be put down there). */
  arrClick(arr, i, button, accept) {
    const g = this.game, s = arr[i], cur = this.cursor;
    g.audio.click();
    if (cur && accept && !accept(cur.item)) {
      // cannot put down here: pick up / merge into the cursor instead
      if (s && s.item === cur.item && cur.count + s.count <= ITEMS[s.item].stack) { cur.count += s.count; arr[i] = null; }
      this.updateCursor();
      return;
    }
    if (button === 2) {
      if (!cur && s) { const half = Math.ceil(s.count / 2); this.cursor = { ...s, count: half }; s.count -= half; if (!s.count) arr[i] = null; }
      else if (cur && (!s || (s.item === cur.item && s.count < ITEMS[s.item].stack))) {
        if (!s) arr[i] = { ...cur, count: 1 }; else s.count++;
        cur.count--; if (!cur.count) this.cursor = null;
      }
    } else if (!cur) { if (s) { this.cursor = s; arr[i] = null; } }
    else if (!s) { arr[i] = cur; this.cursor = null; }
    else if (s.item === cur.item && ITEMS[s.item].stack > 1) {
      const n = Math.min(cur.count, ITEMS[s.item].stack - s.count); s.count += n; cur.count -= n; if (!cur.count) this.cursor = null;
    } else { arr[i] = cur; this.cursor = s; }
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
    const dt = Math.min(0.25, (now - this.lastFrame) / 1000);   // slow frames still run in real time (the player sub-steps)
    this.lastFrame = now;
    this.frames++; this.fpsTime += dt;
    if (this.fpsTime >= 0.5) { g.fps = this.frames / this.fpsTime; this.frames = 0; this.fpsTime = 0; }
    if (!g.world) return;
    const t0 = performance.now();
    try { g.frame(dt); } catch (e) {
      if (!this.frameError) { this.frameError = true; console.error(e); this.toast('Something went wrong: ' + e.message); }
    }
    g.frameMs = g.frameMs * 0.9 + (performance.now() - t0) * 0.1;
    this.governResolution(dt);
    this.updateHudExtras(dt);
    // mining progress under the crosshair (survival: blocks take time)
    const m = g.mining, show = this.screen === 'playing' && m && !g.creative && m.time > 0.15 && m.progress > 0;
    if (show !== !$('mineBar').hidden) $('mineBar').hidden = !show;
    if (show) $('mineBar').firstChild.style.width = `${Math.min(100, m.progress * 100).toFixed(0)}%`;
  }

  /** The map screen (M): 2 blocks a pixel; the wheel zooms. */
  openMap() {
    const g = this.game;
    if (!this.map) this.map = new MiniMap(g, $('minimap'), $('bigmapCanvas'));
    g.state = 'inventory'; g.keys.clear(); g.mouse.left = g.mouse.right = false;
    this.unlock();
    this.show('bigmap');
    const p = g.player.body.pos;
    $('bigmapTitle').textContent = `Map · ${['Overworld', 'Nether', 'The End', 'Skylands'][g.dim || 0]} · ${Math.floor(p[0])} ${Math.floor(p[1])} ${Math.floor(p[2])}`;
    this.map.drawBig();
    const cv = $('bigmapCanvas');
    if (!cv.bound) {
      cv.bound = true;
      cv.addEventListener('wheel', (e) => { e.preventDefault(); this.map.bigScale = Math.max(1, Math.min(8, (this.map.bigScale || 2) * (e.deltaY > 0 ? 1.5 : 1 / 1.5))); this.map.drawBig(); }, { passive: false });
    }
  }

  /** Minimap, coordinates, the block info panel and the Rested tag. */
  updateHudExtras(dt) {
    const g = this.game, s = this.settings, playing = this.screen === 'playing' || this.screen === 'inventory';
    if (!playing || !g.player || (g.meta && g.meta.menu)) return;
    if (!this.map) this.map = new MiniMap(g, $('minimap'), $('bigmapCanvas'));
    $('mapWrap').hidden = s.minimap === false;
    if (s.minimap !== false) this.map.update(dt);
    this.hudT = (this.hudT || 0) - dt;
    if (this.hudT > 0) return;
    this.hudT = 0.12;
    const p = g.player.body.pos, clim = g.world.climateAt ? g.world.climateAt(Math.floor(p[0]), Math.floor(p[2])) : null;
    const season = g.dim === 0 && s.seasons !== false ? ` · ${g.seasonNow()[3]}` : '';
    $('coords').textContent = `${Math.floor(p[0])} ${Math.floor(p[1])} ${Math.floor(p[2])}${clim && g.dim === 0 && !g.meta.flat && BIOME_LABEL[clim.biome] ? ' · ' + BIOME_LABEL[clim.biome] : ''}${season}`;
    const info = s.lookInfo !== false && this.screen === 'playing' ? g.lookInfo() : null, el = $('lookInfo');
    el.hidden = !info;
    if (info) {
      el.className = info.kind || '';
      el.querySelector('b').textContent = info.name;
      el.querySelector('small').textContent = info.sub;
      const ico = el.querySelector('.ico');
      ico.style.display = info.item ? '' : 'none';
      if (info.item && ico.dataset.item !== String(info.item)) { ico.dataset.item = info.item; ico.setAttribute('style', g.icons.css(info.item, 32)); }
    }
    const boss = g.mobs.list.find((m) => m.def.boss && !m.dead && Math.hypot(m.body.pos[0] - p[0], m.body.pos[2] - p[2]) < 90);
    $('bossBar').hidden = !boss;
    if (boss) { $('bossBar').querySelector('span').textContent = boss.def.name; $('bossBar').querySelector('i').style.width = `${Math.max(0, boss.health / (boss.maxHealth || boss.def.health) * 100).toFixed(1)}%`; }
    const as = g.arena && g.meta && g.meta.arena ? g.arenaStatus() : null;
    $('arenaTag').hidden = !as;
    if (as) $('arenaTag').textContent = as;
    $('restedTag').hidden = !(g.rested > 0);
    if (g.rested > 0) $('restedTag').textContent = `Rested · ${Math.ceil(g.rested / 60)} min`;
  }

  /** Dynamic resolution: trade pixels for frame rate when the GPU falls behind, recover when it has headroom. */
  governResolution(dt) {
    const r = this.game.renderer;
    if (!r || this.screen !== 'playing' || document.hidden) return;
    const fpsTag = $('fpsTag');
    fpsTag.hidden = !this.settings.showFps;
    if (this.settings.showFps) { this.fpsT = (this.fpsT || 0) - dt; if (this.fpsT <= 0) { this.fpsT = 0.5; fpsTag.textContent = `${Math.round(1 / (this.avgDt || dt))} fps · ${(r.width)}x${r.height}`; } }
    if (this.settings.dynamicRes === false) { r.dynScale = 1; this.avgDt = this.avgDt ? this.avgDt * 0.95 + dt * 0.05 : dt; return; }
    this.avgDt = this.avgDt ? this.avgDt * 0.95 + dt * 0.05 : dt;
    this.govTimer = (this.govTimer || 0) + dt;
    if (this.govTimer < 1.5) return;
    this.govTimer = 0;
    const fps = 1 / this.avgDt, cur = r.dynScale || 1;
    let next = cur;
    // only steps in when the game really struggles, and never below 70% of the chosen resolution
    if (fps < 30) next = Math.max(0.7, cur - 0.1);
    else if (fps > 45 && cur < 1) next = Math.min(1, cur + 0.05);
    if (next !== cur) r.dynScale = Math.round(next * 100) / 100;
  }
}
