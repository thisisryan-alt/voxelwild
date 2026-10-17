// Game: owns persistent state, services (input, audio, saves) and the current World; routes zone changes,
// rewards, deaths and the story flags that systems (quests, dialogue, bosses) hang off.
import { Engine } from './core/engine.js';
import { Input } from './core/input.js';
import { Events } from './core/util.js';
import { Save } from './core/save.js';
import { AudioSys } from './audio/audio.js';
import { newState, grantXp } from './systems/progression.js';
import { World } from './world/world.js';
import { buildZone, ZONE_INFO } from './data/zones.js';
import { ITEMS } from './data/items.js';
import { FORMS, xpToNext } from './data/forms.js';
import { PlayScene } from './ui/playscene.js';
import { Pickup } from './entities/entity.js';
import './gfx/sprites_forms.js';
import './gfx/sprites_hero.js';
import './bosses/index.js';
import { Quests } from './systems/quests.js';
import { Dialogue } from './systems/dialogue.js';
import { Codex } from './systems/codex.js';
import { Evolution } from './systems/evolution.js';
import { Endings } from './systems/endings.js';
import { ZoneScripts } from './systems/zonescripts.js';
import { Tips } from './systems/tips.js';
import { Story } from './systems/story.js';
import { MenuScene } from './ui/menu.js';
import { PauseScene, OptionsScene, ShopScene, ForgeScene, MoltShrineScene, CutsceneScene, TitleScene } from './ui/screens.js';
import { rng } from './core/util.js';
import { ensureSettings } from './systems/settings.js';
import { Stats, ensureRecords } from './systems/stats.js';
import { Achievements } from './systems/achievements.js';
import { PostFX } from './gfx/post.js';
import { BodyReactions } from './entities/fx_body.js';
import { Minimap } from './ui/minimap.js';
import { Crafting } from './systems/crafting.js';
import { Difficulty } from './systems/difficulty.js';
import { AudioFeel } from './audio/feel.js';
import { Haptics } from './core/haptics.js';
import { applyKeymap } from './core/keymap.js';
import { Elites } from './systems/affixes.js';
import { Rifts } from './systems/rifts.js';
import { Arena } from './systems/arena.js';
import { Barks } from './systems/barks.js';
import { Travel } from './systems/travel.js';
import { isProcedural } from './world/rift_gen.js';

const rand = rng(8080);

export class Game {
  constructor(canvas) {
    this.engine = new Engine(canvas);
    this.input = new Input();
    this.events = new Events();
    this.state = newState();
    const saved = Save.settings(); if (saved) Object.assign(this.state.settings, saved);
    ensureSettings(this.state.settings);
    applyKeymap(this.input, this.state.settings.keymap);
    this.audio = new AudioSys(this.state.settings);
    this.world = null; this.slot = 0; this.freeze = 0; this.npcs = new Map(); this.popups = []; this.toasts = []; this.systems = {};
    this.engine.pre = () => this.input.poll(); this.engine.post = () => this.input.endFrame();
    new Quests(this); new Dialogue(this); new Codex(this); new Evolution(this); new Endings(this); new ZoneScripts(this); new Tips(this); new Story(this); new Stats(this); new Achievements(this); new PostFX(this); new BodyReactions(this); new Minimap(this); new Crafting(this); new Difficulty(this); new AudioFeel(this); new Haptics(this); new Elites(this); new Rifts(this); new Arena(this); new Barks(this); new Travel(this);
    window.addEventListener('pointerdown', () => this.audio.unlock()); window.addEventListener('keydown', () => this.audio.unlock());
  }
  start(scene) { this.engine.push(scene); this.engine.start(); }
  // deterministic stepping for tests: advance n fixed frames without rendering
  advance(n = 1) { for (let i = 0; i < n; i++) this.engine.step(1 / 60); this.engine.render(); }

  // ---- state helpers ----------------------------------------------------------------------------
  zoneState(id) {
    if (isProcedural(id)) { this.tempZones = this.tempZones || new Map(); if (!this.tempZones.has(id)) this.tempZones.set(id, { opened: {}, broken: {}, killed: {}, collected: {} }); return this.tempZones.get(id); }
    return (this.state.zones[id] ||= { opened: {}, broken: {}, killed: {}, collected: {} });
  }
  flag(f) { return !!this.state.flags[f]; }
  setFlag(f, v = true) { if (this.state.flags[f] === v) return; this.state.flags[f] = v; this.events.emit('flag', f, v); }
  hasItem(id) { return (this.state.inv[id] || 0) > 0; }
  itemCount(id) { return this.state.inv[id] || 0; }
  addItem(id, n = 1) { this.state.inv[id] = (this.state.inv[id] || 0) + n; if (this.state.inv[id] <= 0) delete this.state.inv[id]; this.events.emit('item', id, n); }
  hitstop(n) { this.freeze = Math.max(this.freeze, n); }
  toast(msg, color = '#ffffff') { this.toasts.push({ msg, color, t: 0 }); if (this.toasts.length > 4) this.toasts.shift(); }
  popup(icon, text, color = '#ffffff') { this.popups.push({ icon, text, color, t: 0 }); }
  banner(title, sub) { this.bannerState = { title, sub, t: 0 }; }
  say(speaker, text) { this.playScene?.dialogue.say(speaker, text); }

  // ---- lifecycle -----------------------------------------------------------------------------------
  newGame(slot = 0) {
    this.slot = slot; this.state = newState(); Object.assign(this.state.settings, Save.settings() || {}); ensureSettings(this.state.settings); this.audio.settings = this.state.settings;
    this.state.meta = { started: Date.now() }; ensureRecords(this.state); this.state.riftRelics = [];
    return this.enterWorld('reef_nursery', 'start', { newGame: true });
  }
  // a new voyage that keeps the character (level, form, skills, gear, codex, trophies) but resets the world
  newGamePlus(slot) {
    const d = Save.read(slot); if (!d) return false;
    this.slot = slot; this.state = newState(); this.state.settings = ensureSettings(Object.assign(this.state.settings, d.state.settings, Save.settings() || {}));
    this.systems.difficulty.carry(d.state, this.state); ensureRecords(this.state);
    this.audio.settings = this.state.settings; this.state.meta = { started: Date.now(), ng: this.state.ng };
    return this.enterWorld('reef_nursery', 'start', { newGame: true });
  }
  loadGame(slot) {
    const d = Save.read(slot); if (!d) return false;
    this.slot = slot; this.state = Object.assign(newState(), d.state); this.state.stats = Object.assign(newState().stats, d.state.stats); this.state.settings = ensureSettings(Object.assign(newState().settings, d.state.settings, Save.settings() || {}));
    this.audio.settings = this.state.settings; ensureRecords(this.state); this.state.records.sessions++; this.state.riftRelics = [];
    const c = this.state.checkpoint; this.enterWorld(c.zone, c.entry, { loaded: true }); return true;
  }
  saveGame(quiet) {
    const s = this.state, p = this.world?.player;
    if (p) { s.hp = p.hp; s.tide = p.tide; }
    s.meta = { ...(s.meta || {}), zone: ZONE_INFO[this.world?.zone.id]?.name || this.world?.zone.name || '', level: s.level, form: s.form, playtime: Math.round(s.playtime), savedAt: Date.now(), coins: s.coins, ng: s.ng || 0 };
    this.systems.minimap?.flush();
    Save.write(this.slot, { v: 1, meta: s.meta, state: s });
    if (!quiet) { this.toast('Game saved', '#9ad8ff'); this.audio.sfx('save'); }
  }
  enterWorld(zoneId, entry, o = {}) {
    const scene = new PlayScene(this);
    this.playScene = scene;
    this.engine.replace(scene);
    this.buildWorld(zoneId, entry, o);
    return scene;
  }
  buildWorld(zoneId, entry, o = {}) {
    const z = buildZone(zoneId);
    this.world = new World(this, z, entry);
    if (!isProcedural(zoneId)) this.state.visited[zoneId] = true;
    this.zoneMeta(zoneId);
    const p = this.world.player;
    if (this.state.hp != null && o.keepHp !== false && !o.respawn) { p.hp = Math.min(this.state.hp, p.stats.maxHp); p.tide = Math.min(this.state.tide ?? p.stats.maxTide, p.stats.maxTide); }
    if (o.respawn) { p.hp = p.stats.maxHp; p.tide = p.stats.maxTide; p.invulnT = 1.5; p.animT = 0; }
    this.audio.ambience(this.world.biome.amb); this.audio.music.play(z.music || this.world.biome.music);
    // spirit purse (coins lost on death)
    const pu = this.state.purse; if (pu && pu.zone === zoneId) this.world.pickups.push(new Pickup(this.world, { kind: 'coin', value: pu.amount, x: pu.x, y: pu.y, fixed: true, delay: 0, life: 1e9, id: 'purse' })), this.world.pickups[this.world.pickups.length - 1].purse = true;
    this.systems.rifts?.onWorld(this.world); this.systems.arena?.onWorld(this.world);
    this.events.emit('zone', zoneId);
    this.systems.quests?.onZone?.(zoneId);
    if (!o.silentBanner) this.banner(z.title || z.name, this.world.biome.name);
    return this.world;
  }
  zoneMeta(id) {}
  changeZone(to, entry, ex) {
    const ps = this.playScene; if (!ps) return;
    ps.fadeOut(0.3, () => {
      const hp = this.world.player.hp, tide = this.world.player.tide; this.state.hp = hp; this.state.tide = tide;
      if (isProcedural(to)) { this.systems.rifts?.enter(to); this.buildWorld(to, entry, { silentBanner: true }); ps.fadeIn(0.4); return; }
      this.state.checkpoint.last = { zone: to, entry };
      this.buildWorld(to, entry, { silentBanner: false });
      this.saveGame(true);
      ps.fadeIn(0.4);
    });
  }
  rest(shrine) {
    const w = this.world, p = w.player, s = this.state;
    s.checkpoint = { zone: w.zone.id, entry: shrine.o.entry || 'rest', shrine: shrine.key };
    this.systems.travel.remember(w.zone.id, shrine.o.entry);
    p.hp = p.stats.maxHp; p.tide = p.stats.maxTide; p.fury = Math.max(p.fury, 0); s.flags.secondWindUsed = false;
    this.audio.sfx('rest'); w.fx.ring(shrine.x, shrine.y - 6, 4, 70, 0.7, '#a0f0ff', 2); w.fx.burst(shrine.x, shrine.y - 10, ['#a0f0ff', '#ffffff', '#ffd8f0'], 80, 0.8, 2);
    this.toast('Rested. The tide remembers this place.', '#9ad8ff'); this.saveGame(true);
    // enemies respawn
    this.playScene.fadeOut(0.35, () => { this.buildWorld(w.zone.id, shrine.o.entry || 'rest', { silentBanner: true, keepHp: false }); const np = this.world.player; np.hp = np.stats.maxHp; np.tide = np.stats.maxTide; this.world.player.interactT = 0.5; this.playScene.fadeIn(0.4); this.events.emit('rest'); });
  }
  onPlayerDeath() {
    if (this.systems.rifts?.active) return this.systems.rifts.onDeath();
    if (this.systems.arena?.active) return this.systems.arena.onDeath();
    const s = this.state, w = this.world, p = w.player;
    const lose = Math.floor(s.coins * 0.25);
    s.purse = lose > 0 ? { zone: w.zone.id, x: p.x, y: p.y, amount: lose } : null; s.coins -= lose;
    const HINTS = ['Tuck (SHIFT) just before a hit lands to parry.', 'Dash (L) makes you untouchable for an instant.', 'Rest at a Pearl Shrine to set your return point.', 'Heavy strikes (K) break armour and shatter cracked walls.', 'Telegraphed attacks glow red before they land.'];
    this.deathCard = { lose, hint: HINTS[Math.floor(Math.random() * HINTS.length)] };
    if (this.systems.tips) this.systems.tips.cur = null;
    this.playScene.fadeOut(0.9, () => {
      const c = s.checkpoint; s.fury = 0;
      this.buildWorld(c.zone, c.entry, { respawn: true });
      if (lose > 0) this.toast(`Lost ${lose} coins — find your spirit purse where you fell`, '#ffb070');
      this.deathCard = null; this.playScene.fadeIn(0.8); this.world.player.setState('free');
    });
  }

  // ---- rewards ------------------------------------------------------------------------------------------
  collect(pk) {
    const w = this.world, p = w.player, s = this.state, a = this.audio;
    if (pk.kind === 'coin') {
      const v = Math.round(pk.value * (1 + p.stats.coinBonus)); s.coins += v; s.stats.coinsEarned += v; a.sfx('coin');
      w.fx.text(pk.x, pk.y - 6, '+' + v, '#ffd84a'); if (pk.purse) { s.purse = null; this.toast('Spirit purse recovered', '#ffd84a'); }
    } else if (pk.kind === 'pearl') { this.addItem(pk.id || 'pearl', pk.value || 1); a.sfx('pickup'); w.fx.text(pk.x, pk.y - 6, '+' + (pk.id === 'black_pearl' ? 'Black Pearl' : 'Pearl'), '#d0dcf8'); }
    else if (pk.kind === 'orb') {
      if (pk.id === 'tide') p.addTide(pk.value); else if (pk.id === 'fury') p.addFury(pk.value); else p.heal(pk.value); a.sfx('pickup'); w.fx.sparkle(pk.x, pk.y);
    } else if (pk.kind === 'item') { this.grantItem(pk.id, pk.value || 1, true); p.collectT = 0.25; }
    this.events.emit('pickup', pk);
  }
  grantItem(id, n = 1, announce = true) {
    const it = ITEMS[id]; if (!it) return;
    if (it.type === 'mutation') { if (!this.state.mutOwned.includes(id)) this.state.mutOwned.push(id); if (this.state.mutations.length < FORMS[this.state.form].mutationSlots) { this.state.mutations.push(id); this.world?.player.recalc(); } }
    else if (it.type === 'dye') { if (!this.state.dyes) this.state.dyes = {}; this.state.dyes[id] = true; this.addItem(id, 1); }
    else this.addItem(id, n);
    if (/^mp\d$/.test(id)) { this.systems.codex.read(id); this.setFlag('has_' + id); }
    if (announce) { this.popup(id, it.name + (n > 1 ? ' x' + n : ''), '#fff6a8'); this.audio.sfx('item'); }
    this.events.emit('gotitem', id);
  }
  grantLoot(loot, x, y, announce) {
    const w = this.world, s = this.state;
    if (loot.coins) { const n = Array.isArray(loot.coins) ? Math.round(loot.coins[0] + rand() * (loot.coins[1] - loot.coins[0])) : loot.coins; let rem = n, i = 0; while (rem > 0) { const v = rem >= 5 && rand() < 0.4 ? 5 : 1; rem -= v; w.pickups.push(new Pickup(w, { kind: 'coin', value: v, x, y, vx: (rand() - 0.5) * 90, vy: -50 - rand() * 50, delay: 0.3 + i * 0.02 })); if (++i > 30) { w.pickups.push(new Pickup(w, { kind: 'coin', value: rem, x, y, vx: 0, vy: -60, delay: 0.5 })); break; } } }
    if (loot.pearl) this.grantItem('pearl', loot.pearl, announce);
    if (loot.black_pearl) this.grantItem('black_pearl', loot.black_pearl, announce);
    if (loot.items) for (const [id, n] of Object.entries(loot.items)) this.grantItem(id, n, announce);
    if (loot.item) this.grantItem(loot.item, 1, announce);
    if (loot.ep) { s.ep += loot.ep; this.popup('gem', `+${loot.ep} Evolution Point${loot.ep > 1 ? 's' : ''}`, '#ff9ad8'); this.audio.sfx('item'); }
    if (loot.sp) { s.sp += loot.sp; this.popup('gem', `+${loot.sp} Skill Point${loot.sp > 1 ? 's' : ''}`, '#9ad8ff'); }
    if (loot.xp) this.giveXp(loot.xp, x, y);
    if (loot.flag) this.setFlag(loot.flag);
    if (loot.text) this.toast(loot.text);
  }
  giveXp(n, x, y) {
    const w = this.world, p = w.player, r = grantXp(this.state, n);
    if (r.levels) {
      p.recalc(); p.hp = Math.min(p.stats.maxHp, p.hp + p.stats.maxHp * 0.25); this.audio.sfx('levelup');
      w.fx.ring(p.x, p.y, 4, 50, 0.6, '#ffd84a', 2); w.fx.text(p.x, p.y - 20, 'LEVEL UP', '#ffd84a', true, { life: 1.2 });
      this.toast(`Level ${this.state.level}! +${r.levels} skill point${r.levels > 1 ? 's' : ''}`, '#ffd84a'); this.events.emit('levelup', this.state.level);
    }
    if (x !== undefined && n > 0) w.fx.text(x, y - 8, '+' + n + ' xp', '#9ad8ff');
  }
  onEnemyKilled(e, hit) {
    const w = this.world, p = w.player, d = e.def, s = this.state;
    s.stats.kills++;
    const D = this.systems.difficulty.scale(), R = e.affixes ? { coin: 2, pearl: 0.25 } : null;
    this.giveXp(Math.round((d.xp || 1) * (e.xpMult || 1) * D.xp), e.x, e.y);
    const coins = d.coins ? Math.round((d.coins[0] + rand() * (d.coins[1] - d.coins[0])) * D.coin * p.status.mult('coin') * (R ? R.coin : 1)) : 0;
    if (R && rand() < R.pearl) this.grantLoot({ pearl: 1 }, e.x, e.y, true);
    if (coins) this.grantLoot({ coins }, e.x, e.y, false);
    const r = rand();
    if (r < 0.12) w.pickups.push(new Pickup(w, { kind: 'orb', id: 'hp', value: Math.max(6, Math.round(p.stats.maxHp * 0.08)), x: e.x, y: e.y, delay: 0.3 }));
    else if (r < 0.2) w.pickups.push(new Pickup(w, { kind: 'orb', id: 'tide', value: 10, x: e.x, y: e.y, delay: 0.3 }));
    if (d.ep) { s.ep += d.ep; this.popup('gem', `+${d.ep} Evolution Point`, '#ff9ad8'); }
    if (d.drops) for (const [id, ch] of d.drops) if (rand() < ch) this.grantItem(id, 1, true);
    if (p.stats.lifeOnKill) p.heal(p.stats.lifeOnKill);
    if (p.stats.killRush) { if (!(p.rushT > 0)) w.fx.text(p.x, p.y - p.h / 2 - 12, 'RUSH', '#ff9a6a', true, { life: 0.7 }); p.rushT = 4; }
    if (p.stats.abKillTide && hit?.fromAbility) { p.addTide(14); w.fx.text(e.x, e.y - 10, '+14 TIDE', '#8ad0ff'); }
    p.addFury(4); p.addTide(3);
    if (e.unique || e.persistKey && d.elite) this.zoneState(w.zone.id).killed[e.persistKey] = true;
    this.events.emit('kill', e.type, e);
  }
  bossDefeated(key) { this.state.bosses[key] = true; this.events.emit('boss', key); this.saveGame(true); }
  readLore(id, src) { this.systems.codex?.read(id); }
  openPause() { this.engine.push(new PauseScene(this)); }
  openMenu(tab) { this.engine.push(new MenuScene(this, tab)); }
  openOptions() { this.engine.push(new OptionsScene(this)); }
  openShop(id, resume) { this.engine.push(new ShopScene(this, id, resume)); }
  openForge(resume) { this.engine.push(new ForgeScene(this, resume)); }
  openMoltShrine(shrine) { this.engine.push(new MoltShrineScene(this, shrine)); }
  startIntro() {
    const panels = [
      { art: 'ocean', title: 'MOLTBORN', text: 'Long ago, before the sea had a king, the Mother Tide dreamed the ocean alive. Her dream had a single rule: everything may grow.', music: 'title' },
      { art: 'throne', text: "Then one of her children outgrew all the others, and took a spear, and a crown, and a promise: 'Only I can hold the dark below. Only I.'" },
      { art: 'seal', text: 'The sea has been quiet since. Quiet like a held breath. Every spawning, the Court takes its Tithe: a tenth of every clutch, given to the Deep. A privilege, and a duty.' },
      { art: 'eggs', text: 'On the shore of the reef a clutch of crab-eggs hatched, one spawning-night. Ten hatchlings, ten small shells.' },
      { art: 'empty', text: 'By dawn, nine were gone. One had a shell too soft to be worth counting. That one is you.' },
    ];
    this.engine.push(new CutsceneScene(this, panels, () => { this.systems.quests.check(); this.audio.music.play(this.world.biome.music); }));
  }
  questMarker(npcId) {
    const map = { tessa: ['sq_tessa'], fenwick: ['sq_choir', 'sq_atlas'], glimmer: ['sq_lantern'], hobb: ['sq_hobb'], inkwell: ['sq_inkwell'], ruby: ['sq_ledger'], pip: ['sq_tyrant'], brack: ['sq_census'], morel: ['sq_spores'], tallow: ['sq_vaults'], sear: ['sq_vents'], thessaly: ['sq_siblings'], old_brine: ['mq1'] };
    const qs = map[npcId]; if (!qs) return null; const q = this.systems.quests;
    if (npcId === 'old_brine' && !this.flag('met_brine')) return '!';
    if (npcId === 'old_brine') return null;
    if (qs.some((id) => !q.log[id])) return '!'; return null;
  }
  update(dt) { this.state.playtime += dt; this.systems.stats?.update(dt); this.systems.achievements?.update(dt); this.systems.post?.update(dt); this.systems.minimap?.update(dt); this.systems.audiofeel?.update(dt); this.systems.rifts?.update(dt); this.systems.arena?.update(dt); this.systems.barks?.update(dt); }
}
