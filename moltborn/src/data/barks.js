// Things townsfolk mutter when the swimmer passes. Lines are tried top to bottom; one with a `when` test (given the game)
// is used only while it holds, so later, more specific lines should come first. A plain string is always allowed.
const boss = (k) => (g) => !!g.state.bosses[k];
const done = (q) => (g) => !!g.state.quests[q] && g.state.quests[q].state === 'done';
const form = (n) => (g) => ({ shore: 1, warrior: 2, abyssal: 3, leviathan: 4, mythic: 5, primordial: 6 })[g.state.form] >= n;
const rifts = (n) => (g) => (g.state.records?.rifts || 0) >= n;
const low = (g) => g.world?.player && g.world.player.hp < g.world.player.stats.maxHp * 0.4;

export const BARKS = {
  old_brine: [
    { when: boss('poseidon'), text: 'I saw the tide go still, little one. I never thought I would live to.' },
    { when: form(3), text: 'You have grown past anything I could teach. Come visit anyway.' },
    { when: low, text: 'You look half drowned. Sit, breathe, then go back out there.' },
    'The shore is kind to the young. The sea is not. Remember both.', 'Shells are only borrowed. Remember that.', 'My knees say storm. My knees are never wrong.',
  ],
  pip: [
    { when: rifts(1), text: 'I heard you went down a rift and came back! Was it scary? Tell me it was scary!' },
    { when: form(2), text: 'You got BIGGER. Can I touch the shell? No? Okay.' },
    'Did you see the whale? I saw the whale. Nobody believes me.', 'I am going to be a hero one day. I have a stick.', 'Hello! Hello! Are you going to fight something?',
  ],
  cowrie: [
    { when: (g) => g.state.coins > 800, text: 'Ooh, a heavy purse. Do come closer, darling.' },
    { when: low, text: 'A kelp wrap, my dear? Thirty coins and a smile.' },
    'Everything has a price. Even the things that say they do not.', 'Pearls, shells, charms. Take your time. Spend slowly.', 'I buy, I sell, I do not ask where it came from.',
  ],
  tessa: [
    { when: done('sq_tessa'), text: 'The kelp has never grown so well. You have a green claw, friend.' },
    'The tide takes seedlings if you are careless. I am never careless.', 'Mind the sprouts, please.',
  ],
  brack: [
    { when: done('sq_census'), text: 'One hundred and one barnacles. Never thought I would see the day.' },
    'Forty-two. Forty-three. Do not distract me.', 'A census is a lonely thing. But somebody has to count.',
  ],
  morel: [
    { when: done('sq_spores'), text: 'The samples are doing marvellously. I may name one after you.' },
    'Fascinating. Truly fascinating. Do not touch that.', 'The caps glow brightest at the turn of the tide. Observe!',
  ],
  tallow: [
    { when: done('sq_vaults'), text: 'The last drawer. After all these years. I may weep, or I may file.' },
    'Everything written down is a kind of immortality.', 'Quiet, please. This is an archive. Mostly.',
  ],
  sear: [
    { when: done('sq_vents'), text: 'The hearth is lit. Not too hot, not too cold. Just like you asked.' },
    { when: boss('magmaw'), text: 'You went to the vents. You went to the vents! What did he say?' },
    'Hot work. Honest work.', 'Bring me cinders and I will make something worth carrying.',
  ],
  fenwick: [
    { when: done('sq_atlas'), text: 'The map is whole. I can almost smell the places on it.' },
    'The forest changes when you are not looking. I draw it anyway.', 'Every path on this chart was once somebody lost.',
  ],
  vael: [
    { when: boss('aurelia'), text: 'The Court is quiet now. Quieter than it ever was.' },
    'Order is the only thing that survives a flood.', 'The Seal holds. The Seal must hold.',
  ],
  ruby: [
    { when: boss('captain_rust'), text: 'You put Rust to rest. I owe you a drink and a long story.' },
    'The Gannet went down with all hands but one. I am the one.', 'Keep your blade dry. Ha.',
  ],
  ostrea: [
    { when: (g) => g.itemCount('black_pearl') > 0, text: 'Black pearls! I have not seen one in a decade. Bring it here.' },
    'A good claw is forged, not found.', 'More pearls, more power. It is arithmetic.',
  ],
  inkwell: [
    { when: done('sq_inkwell'), text: 'Beautiful. Every line of it. You are a patron of the arts.' },
    'The ink wants to be written. The words are shy.', 'I could describe this room in six hundred words. Do not tempt me.',
  ],
  hobb: [
    { when: done('sq_hobb'), text: 'The lads are at rest. Thank you, sailor.' },
    'Crew tokens, all of them. Count them twice.', 'Aye, Captain. Er, you are not the Captain.',
  ],
  glimmer: [
    { when: done('sq_lantern'), text: 'The lanterns are lit again. The deep looks brighter.' },
    'Lights out down there. Take a lantern.', 'You can follow a glow into a lot of trouble.',
  ],
  thessaly: [
    { when: boss('poseidon'), text: 'It is finished. And it is not. It never is.' },
    'The old gods are not gone. They only sleep with one eye open.', 'There is a door below the sea. Do not knock.',
  ],
};
export const BARK_RANGE = 90;       // how close the swimmer must be
export const BARK_COOLDOWN = 22;    // seconds before the same person speaks again
