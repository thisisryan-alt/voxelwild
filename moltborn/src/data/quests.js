// Quests. Steps complete when their done(g) predicate becomes true (re-evaluated on every game event).
const v = (z) => (g) => !!g.state.visited[z];
const f = (k) => (g) => g.flag(k);
const boss = (k) => (g) => !!g.state.bosses[k];
const has = (id) => (g) => g.hasItem(id);

export const QUESTS = {
  // ---------------- main story ----------------
  mq1: { name: 'A Late Bloomer', type: 'main', steps: [
    { text: 'Speak with Old Brine in the nursery.', done: f('met_brine') },
    { text: 'Leave the nursery and head east to the Coral Garden.', done: v('reef_garden') },
  ], desc: 'Everyone else in your clutch is gone. Old Brine says you should stay small and hidden. You have never been good at that.' },
  mq2: { name: "The Rockclaw's Toll", type: 'main', steps: [
    { text: 'Find the one who has been taking the reef: Grumbold, in the Kelp Hollow.', done: v('reef_arena') },
    { text: 'Defeat Grumbold the Rockclaw.', done: boss('grumbold') },
  ], desc: 'A giant rock-crab has made the reef his hoard. He wears a Brine Core on his shell — the only thing that can crack open your own.' },
  mq3: { name: 'Hardshell', type: 'main', steps: [{ text: 'Take the Brine Core to the Molt Shrine and evolve.', done: f('evolved_warrior') }], desc: 'The shrine in the Rockclaw’s hollow has been waiting a very long time for a crab to molt there.' },
  mq4: { name: 'The Green Road', type: 'main', steps: [
    { text: 'Go east: cross into the Sunken Forest.', done: v('forest_edge') },
    { text: 'Find a way through the Rootmaze to the forest’s heart.', done: v('forest_heart') },
    { text: 'Defeat Mother Moray.', done: boss('mother_moray') },
  ], desc: 'The only road to the Coral Kingdom runs through a drowned jungle, and something in it is grieving loudly.' },
  mq5: { name: 'The Court of Coral', type: 'main', steps: [
    { text: 'Enter the Coral Kingdom.', done: v('kingdom_gate') },
    { text: 'Win an audience with Queen Aurelia (obtain the Brineguard Key).', done: has('brineguard_key') },
    { text: 'Confront Queen Aurelia in the Court of Pearls.', done: boss('aurelia') },
  ], desc: 'A queen who kneels, a chancellor who counts, a captain who watches. The Court holds the key to the next road — and to a darker ledger.' },
  mq6: { name: 'Wrecks and Ledgers', type: 'main', steps: [
    { text: 'Descend to the Ship Graveyard.', done: v('grave_shallows') },
    { text: "Find the Captain's Key.", done: has('captain_key') },
    { text: 'Defeat Captain Rust on the bridge of the Gannet.', done: boss('captain_rust') },
  ], desc: 'The drowned still keep watch. Somewhere in the wrecks is a key; somewhere on the bridge is a captain who will not leave his post.' },
  mq7: { name: 'The Deep Molt', type: 'main', steps: [{ text: 'Use the Abyssal Core at the Deep Molt Shrine to evolve.', done: f('evolved_abyssal') }], desc: 'The Abyss will crush anything its shell is not ready for. Molt, or turn back.' },
  mq8: { name: 'Into the Dark', type: 'main', steps: [
    { text: 'Descend into the Abyss.', done: v('abyss_descent') },
    { text: 'Defeat the Lurelord of the Abyssal Throat.', done: boss('lurelord') },
  ], desc: 'Light is a currency here, and you are rich: you can carry your own.' },
  mq9: { name: 'The Forgotten', type: 'main', steps: [
    { text: 'Reach the Trench of the Forgotten.', done: v('trench_bones') },
    { text: 'Speak with the Oracle of the old temple.', done: f('met_thessaly') },
    { text: 'Decide the fate of Krael, the Chained Titan.', done: f('krael_decided') },
  ], desc: 'The oldest murals in the sea are down here. So is the oldest guardian, and he is in chains.' },
  mq10: { name: 'The Ancient Molt', type: 'main', steps: [{ text: "Use the Titan's Heart at the Trench Molt Shrine to evolve.", done: f('evolved_leviathan') }], desc: 'Reach back through the fossil record. Be the thing that was here before the gods.' },
  mq11: { name: "Poseidon's Gate", type: 'main', steps: [
    { text: "Open the road into Poseidon's Domain.", done: v('domain_gate') },
    { text: 'Defeat Kyros the Unsleeping.', done: boss('kyros') },
  ], desc: 'The Sea-King’s house has a front door, and a doorman.' },
  mq12: { name: 'Apotheosis', type: 'main', steps: [{ text: 'Use the Tide Sigil at the Apotheosis Shrine.', done: (g) => g.flag('evolved_mythic') || g.flag('evolved_primordial') }], desc: 'One molt remains. The last limit is the one you were told was a law.' },
  mq13: { name: 'The Last Tide', type: 'main', steps: [{ text: 'Face Poseidon in the Throne of Tides.', done: boss('poseidon') }], desc: 'Whatever you decide there will be the sea you leave behind.' },
  // ---------------- side quests ----------------
  sq_tessa: { name: 'A Shell for Tessa', type: 'side', giver: 'tessa', steps: [
    { text: 'Find a bigger shell for Tessa the hermit child.', done: has('spiral_shell') },
    { text: 'Decide what to do with the Spiral Shell.', done: (g) => g.flag('tessa_helped') || g.flag('tessa_sold') },
  ], desc: 'Tessa has outgrown her shell and is too shy to leave the nursery. A perfect spiral shell is rumoured to sit in a hole only a small crab could reach.' },
  sq_choir: { name: 'The Choir of Kelp', type: 'side', giver: 'fenwick', steps: [{ text: 'Play the old tune on the three singing bulbs: low, high, middle.', done: f('choir_done') }], desc: 'Fenwick swears the forest once sang. The Singing Wood mural carries the tune.' },
  sq_atlas: { name: "Fenwick's Atlas", type: 'side', giver: 'fenwick', steps: [{ text: 'Recover 3 map fragments from the forest zones.', done: (g) => (g.itemCount('map_fragment') >= 3) || g.flag('atlas_done') }], desc: 'Fenwick lost his map fragments to the mossbacks. He would be very grateful, and also very talkative.' },
  sq_ledger: { name: 'The Seeker of Sins', type: 'side', giver: 'ruby', steps: [
    { text: "Recover Vael's Tithe Ledger from the sealed Archive in the Throne Spires.", done: has('tithe_ledger') },
    { text: "Carry the truth to the Queen — or burn it.", done: (g) => g.flag('ledger_used') || g.flag('ledger_burned') },
  ], desc: 'Captain Ruby thinks the Queen would act if she saw the Chancellor’s numbers.' },
  sq_inkwell: { name: 'Cargo of the Drowned', type: 'side', giver: 'inkwell', steps: [
    { text: "Retrieve Mr. Inkwell's cargo from the Galleon's hold.", done: has('stolen_regalia') },
    { text: 'Decide who receives the regalia.', done: (g) => g.flag('regalia_inkwell') || g.flag('regalia_returned') },
  ], desc: 'Inkwell wants a crate recovered. He is very sure it contains only rum.' },
  sq_hobb: { name: 'Roll Call of the Drowned', type: 'side', giver: 'hobb', steps: [{ text: 'Find 4 crew tokens scattered through the Graveyard.', done: (g) => g.itemCount('crew_token') >= 4 || g.flag('rollcall_done') }], desc: 'Hobb can not rest until the roll is called. Four of the crew are still missing.' },
  sq_lantern: { name: 'The Lantern Pact', type: 'side', giver: 'glimmer', steps: [{ text: 'Light the three braziers of the Lantern Cavern with Lantern Stones.', done: f('lanterns_lit') }], desc: 'The Lantern Folk once lit the whole cavern. Their braziers are cold and the stones are scattered.' },
  sq_siblings: { name: 'Brothers of the Clutch', type: 'side', giver: 'thessaly', steps: [{ text: 'Break the Seals in the Temple and wake the sleeping hatchlings.', done: f('hatchlings_freed') }], desc: 'The Tithe was not lost. It was stored. Somewhere behind the old seals, very small things are sleeping.' },
  sq_pearls: { name: 'Seven Memories', type: 'side', hidden: true, steps: [{ text: 'Gather the seven Memory Pearls hidden across the sea.', done: (g) => [1, 2, 3, 4, 5, 6, 7].every((n) => g.hasItem('mp' + n)) }, { text: 'Find the door that opens to seven pearls.', done: f('sanctum_opened') }], desc: 'Seven pearls remember the first sea. When together, they remember something else.' },
  sq_census: { name: 'The Tidepool Census', type: 'side', giver: 'brack', steps: [
    { text: 'Collect 3 Tide Barnacles from the Sunken Tidepools.', done: (g) => g.itemCount('tide_barnacle') >= 3 || g.flag('census_done') },
    { text: 'Deal with the self-crowned Hermit King at the end of the pools.', done: boss('hermit_king') },
    { text: 'Report back to Brack.', done: f('census_done') },
  ], desc: 'Brack has counted the pools every spring. A king moved in and ate the census. Not the barnacles. The census.' },
  sq_spores: { name: 'Glowcap Samples', type: 'side', giver: 'morel', steps: [
    { text: 'Collect 3 Glowcap Samples from the shelves of the Glowcap Grotto.', done: (g) => g.itemCount('glowcap_sample') >= 3 || g.flag('spores_done') },
    { text: 'Quiet the thing that hums at the top of the grotto.', done: boss('sporemother') },
    { text: 'Show Dr. Morel what you found.', done: f('spores_done') },
  ], desc: 'Dr. Morel has catalogued every toadstool in the grotto but the three on the high shelves. The ones that glow. The ones that hum back.' },
  sq_vaults: { name: 'The Last Drawer', type: 'side', giver: 'tallow', steps: [
    { text: 'Find the vault key in the upper room of the Pearl Vaults.', done: (g) => g.hasItem('vault_key') || g.flag('vaults_done') || g.boss('brass_colossus') },
    { text: 'Open the strongroom and stop its guardian.', done: boss('brass_colossus') },
    { text: 'Tell Tallow the last drawer is open.', done: f('vaults_done') },
  ], desc: 'Tallow catalogued the Court\'s strongroom for sixty years. He has not been allowed to see the last drawer. He would like to, before he is too old to read it.' },
  sq_vents: { name: 'Quench the Hearth', type: 'side', giver: 'sear', steps: [
    { text: 'Gather 3 Cinder Cores from the vent passage of the Ember Vents.', done: (g) => g.itemCount('cinder_core') >= 3 || g.flag('vents_done') },
    { text: 'Calm Magmaw, the eel that grew in the vent-throat.', done: boss('magmaw') },
    { text: 'Bring the cores to Sear.', done: f('vents_done') },
  ], desc: 'Sear forges with vent-glass and has run out. She will make you something nice for three good cores, provided you do not mind her yelling at the eel.' },
  sq_tyrant: { name: 'The Pearl Tyrant', type: 'side', giver: 'pip', steps: [{ text: 'Defeat the Pearl Tyrant, the giant clam beneath the garden.', done: boss('pearl_tyrant') }], desc: 'Pip’s pearl was swallowed by something enormous.' },
  sq_board: { name: 'Notices on the Tide', type: 'side', giver: 'marlin', steps: [
    { text: 'Read the Tide Board.', done: f('board_read') },
    { text: 'Clear a Tidal Rift (any depth, all the way down).', done: (g) => (g.state.records?.rifts || 0) >= 1 },
    { text: 'Cook three dishes in the CRAFT tab.', done: (g) => (g.state.records?.crafted || 0) >= 3 },
    { text: 'Deliver a kitchen order from the Board.', done: (g) => (g.state.records?.ordersDone || 0) >= 1 },
  ], desc: 'Marlin pins dares to a board and nobody takes them. He would like that to change, and he is willing to pay.' },
};
