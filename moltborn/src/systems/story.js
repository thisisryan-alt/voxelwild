// Story cutscenes: illustrated panels that play once per save when the player enters a new realm, defeats a boss,
// molts into a new body or reaches the Throne. They are queued by game events and shown the next time play is calm.
import { CutsceneScene } from '../ui/screens.js';

const BIOME_STORY = { forest: 'enter_forest', kingdom: 'enter_kingdom', graveyard: 'enter_graveyard', abyss: 'enter_abyss', trench: 'enter_trench', domain: 'enter_domain' };
const BOSS_STORY = { grumbold: 'won_grumbold', mother_moray: 'won_moray', aurelia: 'won_aurelia', captain_rust: 'won_captain', lurelord: 'won_lurelord', krael: 'won_krael', kyros: 'won_kyros', hollow_maw: 'won_maw', hermit_king: 'won_brun', sporemother: 'won_sporemother', brass_colossus: 'won_colossus', magmaw: 'won_magmaw' };
const ZONE_STORY = { reef_tidepools: 'enter_tidepools', forest_grotto: 'enter_grotto', kingdom_vaults: 'enter_vaults', abyss_vents: 'enter_vents' };

// music: undefined = a calm theme, null = keep what is playing
export const STORIES = {
  enter_forest: { music: null, panels: [
    { art: 'forest', title: 'THE SUNKEN FOREST', text: 'Past the reef the kelp grows older, and taller, and quieter. The light comes down in coins here, one at a time.' },
    { art: 'forest', text: 'The mangrove roots hold a secret the Court never meant to teach. The water here tastes of the king, and the eggs in it are turning green.' },
  ] },
  enter_kingdom: { music: null, panels: [
    { art: 'kingdom', title: 'THE CORAL KINGDOM', text: 'It is the loveliest place you have ever seen. That is how you know it was built to be seen.' },
    { art: 'kingdom', text: 'Every spire is grown from the shells of somebody\'s clutch. The Court calls it heritage. The Court has always had a gentle word for everything.' },
  ] },
  enter_graveyard: { music: null, panels: [
    { art: 'graveyard', title: 'THE SHIP GRAVEYARD', text: 'The Tithe-boats do not always sail home. Their masts stand in the silt like a drowned orchard, and one of them still keeps a lantern lit.' },
  ] },
  enter_abyss: { music: null, panels: [
    { art: 'abyss', title: 'THE ABYSS', text: 'Down here the sea stops being a place and becomes a pressure. Your shell remembers what the surface never taught it: everything wants to be smaller, and flatter, and still.' },
    { art: 'abyss', text: 'Far off, something patient turns on a light, and waits to see what comes to look at it.' },
  ] },
  enter_trench: { music: null, panels: [
    { art: 'trench', title: 'THE TRENCH OF THE FORGOTTEN', text: 'Every lost thing the sea ever kept ends up here. It is patient. It is not unkind. It simply has no list, and your name is not on it.' },
    { art: 'trench', text: 'Someone carved a face into the wall of the cleft, long ago, and then buried it. The eyes still look up.' },
  ] },
  enter_domain: { music: null, panels: [
    { art: 'domain', title: 'POSEIDON\'S DOMAIN', text: 'It does not smell of salt. It smells of old stone and a held breath. The doors are open. They have always been open. That is the cruelty of them.' },
  ] },
  throne: { music: null, panels: [
    { art: 'throne', title: 'THE THRONE OF TIDES', text: 'He is not hiding. He has never hidden. He is waiting, the way a lock waits, for the thing it was made to stop.' },
  ] },

  won_grumbold: { delay: 3, panels: [
    { art: 'boss:grumbold', title: 'GRUMBOLD THE ROCKCLAW', text: 'The hoard rattles to the floor: glass, pearls, a hundred shiny rocks. Among them a pink stone hums, very low, like someone remembering a name.' },
    { art: 'ocean', text: 'It was never treasure. It was cargo from a Tithe-boat, and it was warm because it still remembered being alive.' },
  ] },
  won_moray: { delay: 3, panels: [
    { art: 'boss:mother_moray', title: 'MOTHER MORAY', text: 'She coils around her eggs and the green light in them dims. Not out. Only lower, the way a held breath goes lower when it is allowed to finish.' },
    { art: 'forest', text: 'Above the canopy the king\'s water is still falling into her sea. You cannot stop it. You can only be the reason she stopped fighting it.' },
  ] },
  won_aurelia: { delay: 3, panels: [
    { art: 'boss:aurelia', title: 'QUEEN AURELIA', text: 'Her ledger falls open: ten thousand clutches, counted, ruled off, and carried down to the Deep. Her crown is only a crown. The hand that held the pen was never hers alone.' },
  ] },
  won_captain: { delay: 3, panels: [
    { art: 'boss:captain_rust', title: 'CAPTAIN RUST', text: 'The last lantern goes out in the Gannet\'s cabin. The crew were the Tithe\'s first tithe. Nobody on the surface remembers the name of the boat that did not come home.' },
  ] },
  won_lurelord: { delay: 3, panels: [
    { art: 'boss:lurelord', title: 'THE LURELORD', text: 'The light goes out in the Throat. In the new dark, the small things it was calling begin, slowly, to leave.' },
  ] },
  won_krael: { delay: 3, panels: [
    { art: 'boss:krael', title: 'KRAEL, THE CHAINED TITAN', text: 'The chains ring once, and the whole Trench shifts its weight. Whatever you chose, the first wall of the sea has moved, and the sea knows it.' },
  ] },
  won_kyros: { delay: 3, panels: [
    { art: 'boss:kyros', title: 'KYROS THE UNSLEEPING', text: 'The Doorman lowers his trident for the first time in four thousand years. Behind him the halls go on and on, and every door is already open.' },
    { art: 'domain', text: 'Somewhere inside, a very old voice says your name. It is not angry. It sounds relieved.' },
  ] },
  won_maw: { delay: 3, panels: [
    { art: 'boss:hollow_maw', title: 'THE HOLLOW MAW', text: 'It folds into itself like an eye closing. It was never wicked. It was hungry, and for four thousand years the king had been feeding it the only thing it could keep down: other people\'s children.' },
  ] },

  enter_tidepools: { music: null, panels: [
    { art: 'ocean', title: 'THE SUNKEN TIDEPOOLS', text: 'Behind the hairline cracks the reef keeps its other secret: a stair of pools, counted every spring by someone who loved counting more than being counted.' },
    { art: 'ocean', text: 'Somewhere ahead a very small king is wearing a very large shell. You can hear it humming from here.' },
  ] },
  enter_grotto: { music: null, panels: [
    { art: 'forest', title: 'THE GLOWCAP GROTTO', text: 'Past the stone the air turns soft and sweet. Toadstools climb the walls in their hundreds, lit from inside like tiny lamps, and every one of them is asleep.' },
    { art: 'forest', text: 'Somewhere above, a lullaby is being sung to something that will not wake. Tread lightly. They are very small and everywhere.' },
  ] },
  enter_vaults: { music: null, panels: [
    { art: 'kingdom', title: 'THE PEARL VAULTS', text: 'A stair under the plaza. A brass plaque, an inventory of the Court\'s treasure, and a long gallery of statues that have forgotten what they are guarding.' },
    { art: 'kingdom', text: 'Every drawer here was counted. Every drawer but the last. The Court did not like to look at the last one.' },
  ] },
  enter_vents: { music: null, panels: [
    { art: 'abyss', title: 'THE EMBER VENTS', text: 'The cold breaks. Orange breath curls up out of the floor in slow, even pulses, and the water is so warm you can taste the minerals. Something below keeps the time.' },
    { art: 'abyss', text: 'Count four. Move on three. Whatever is down in the pit has been counting a great deal longer than you.' },
  ] },
  won_brun: { delay: 3, panels: [
    { art: 'boss:hermit_king', title: 'BRUN, THE HERMIT KING', text: 'The crown was only orange coral, glued on with kelp-sap. The shell under it still hums a lullaby in a voice that was never his. He holds it to where an ear would be, and listens, and for once says nothing at all.' },
  ] },
  won_sporemother: { delay: 3, panels: [
    { art: 'boss:sporemother', title: 'THE SPOREMOTHER', text: 'The lullaby stops. Across the grotto the little lights dim, one by one, not extinguished, only put to bed. Nobody in the dark was afraid of anything any more.' },
  ] },
  won_colossus: { delay: 3, panels: [
    { art: 'boss:brass_colossus', title: 'THE BRASS COLOSSUS', text: 'It lowers its trident and the whole gallery rings like a bell. Behind it, the last drawer slides out on its own. Inside is a single page: a list of every name, and at the bottom, in the Queen\'s own hand, two words. NOT WORTH IT.' },
  ] },
  won_magmaw: { delay: 3, panels: [
    { art: 'boss:magmaw', title: 'MAGMAW', text: 'The glow in the pit settles from orange to a banked, steady red. It was never trying to scald anyone. It was only trying to be the warmth that kept the dark from freezing, and nobody had ever told it that was enough.' },
  ] },

  molt_warrior: { music: 'ending_good', delay: 0.2, panels: [{ art: 'form:warrior', title: 'THE HARDSHELL MOLT', text: 'You split along an old seam and step out. You are not bigger, exactly. You are harder, and the world has started to look at you instead of past you.' }] },
  molt_abyssal: { music: 'ending_sad', delay: 0.2, panels: [{ art: 'form:abyssal', title: 'THE ABYSSAL MOLT', text: 'The deep has been waiting to meet you. It wears your shape now, and it glows in the places where you used to be afraid.' }] },
  molt_leviathan: { music: 'ending_good', delay: 0.2, panels: [{ art: 'form:leviathan', title: 'THE ANCIENT MOLT', text: 'Old Brine said the sea remembers every shell that ever outgrew its seam. You can hear it now, humming in your claws, glad to be asked.' }] },
  molt_mythic: { music: 'ending_secret', delay: 0.2, panels: [{ art: 'form:mythic', title: 'THALASSARCH', text: 'The word is older than the Court. It means ruler of nothing but the tide. It suits you, because you want nothing else.' }] },
  molt_primordial: { music: 'ending_secret', delay: 0.2, panels: [{ art: 'form:primordial', title: 'THE UNMOLTED', text: 'You do not molt. You remember. The Mother Tide\'s first shape comes back to you: small, and soft, and entirely unafraid.' }] },
};

export class Story {
  constructor(game) {
    this.g = game; this.queue = []; game.systems.story = this;
    game.events.on('zone', (id) => this.onZone(id));
    game.events.on('boss', (key) => { const id = BOSS_STORY[key]; if (id) this.add(id); });
    game.events.on('evolved', (to) => this.add('molt_' + to));
  }
  seen(id) { return !!this.g.state.flags['cs_' + id]; }
  add(id) { if (!STORIES[id] || this.seen(id) || this.queue.some((q) => q.id === id)) return; this.queue.push({ id, wait: STORIES[id].delay ?? 0.8 }); }
  onZone(zoneId) {
    const w = this.g.world; if (!w || String(zoneId).includes(':')) return;   // rifts and the gauntlet never trigger story scenes
    const b = BIOME_STORY[w.zone.biome]; if (b) this.add(b);
    if (zoneId === 'domain_throne') this.add('throne');
    if (ZONE_STORY[zoneId]) this.add(ZONE_STORY[zoneId]);
  }
  // called every play frame; shows the next queued story when nothing else is going on
  pump(dt) {
    const q = this.queue[0]; if (!q) return;
    const g = this.g, w = g.world, ps = g.playScene; if (!w || !ps) return;
    const boss = w.boss, pl = w.player;
    if (ps.busy || ps.lock || w.cinematic || !pl.alive || pl.locked || (boss && boss.alive && (boss.engaged || boss.engaging)) || (boss && boss.dying)) return;
    q.wait -= dt; if (q.wait > 0) return;
    this.queue.shift(); this.play(q.id);
  }
  play(id) {
    const S = STORIES[id]; if (!S) return;
    this.g.setFlag('cs_' + id);
    const zoneMusic = () => { const w = this.g.world; if (w) this.g.audio.music.play(w.zone.music || w.biome.music); };
    this.g.engine.push(new CutsceneScene(this.g, S.panels, () => { if (S.music !== null) zoneMusic(); }, { music: S.music === undefined ? 'title' : S.music }));
  }
}
