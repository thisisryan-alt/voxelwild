// The help compendium: pages of short entries. Entries with `from` are filled from live game data (statuses, affixes, the
// tide clock, difficulty tiers), so the help can never drift from the rules. Plain entries are `{ t: title, x: [lines] }`.
export const PAGES = [
  { id: 'basics', name: 'Basics', entries: [
    { t: 'Swimming', x: ['Move with the arrow keys or WASD. Press SPACE for a stroke: crabs push off the seabed, swimmers kick through open water.', 'Your form decides how you move: shore crabs walk and hop, abyssal and later forms swim freely.'] },
    { t: 'Health and Tide', x: ['The red bar is health. The blue bar is Tide, spent on abilities and refilled over time (faster when no foes are near).', 'F uses the item in your quick slot. Resting at a shrine restores everything and saves the game.'] },
    { t: 'Experience and molting', x: ['Foes, bosses and quests give experience. Levels raise your stats and award skill points.', 'At the right level and with the right Core, a shrine lets you molt into a new form.'] },
    { t: 'Saving', x: ['Shrines save automatically. F5 quick-saves. Three slots, a backup of each, and save codes you can copy and paste (title > SAVE TOOLS).'] },
  ] },
  { id: 'combat', name: 'Combat', entries: [
    { t: 'Claw and heavy claw', x: ['J or Z is a quick claw; chain it for combos. K or X is a slow heavy claw that breaks guards and fills the stagger meter.'] },
    { t: 'Dash', x: ['L or C dashes in the direction you hold. You are untouchable for the first moments of the dash, and dashing through attacks is the safest way to avoid them.'] },
    { t: 'Block and parry', x: ['Hold SHIFT to block. Raising the guard just before a blow lands is a parry: the blow is turned aside, Tide is refunded and the attacker is staggered.'] },
    { t: 'Abilities and Fury', x: ['Keys 1, 2 and 3 fire your slotted abilities; Q or R releases your ultimate when the Fury meter is full. Fury builds as you hit and are hit.'] },
    { t: 'Poise and stagger', x: ['Bosses wear armour shown as a bar under their health. Heavy hits and parries break it; a staggered boss takes extra damage and cannot attack.'] },
    { t: 'Telegraphs', x: ['Dangerous attacks are marked on the water before they land: red shapes fill up, then strike. Colours and outlines can be changed in Options > Access.'] },
  ] },
  { id: 'status', name: 'Effects', from: 'status' },
  { id: 'elites', name: 'Elites', from: 'affixes' },
  { id: 'world', name: 'World', entries: [
    { t: 'Tide clock', from: 'clock' },
    { t: 'Your hatchling', from: 'companion' },
    { t: 'Shrines', x: ['Shrines are checkpoints and fast-travel points. Once you have rested at two, you can travel between them from any shrine.'] },
    { t: 'Chests, murals and lore', x: ['Chests hold coins, gear and keys. Murals and notes add to the Codex. The map screen shows how much of each zone you have found.'] },
    { t: 'Dangers', x: ['Spikes, hot vents, currents and the crushing pressure of the deep all hurt. Gear, food and later forms resist them.'] },
  ] },
  { id: 'crafting', name: 'Craft', entries: [
    { t: 'Ingredients', x: ['Creatures leave ingredients behind; forage patches (shaking grass and glowing crusts) give more; fishing spots give fish.'] },
    { t: 'Cooking', x: ['Recipes are learned the first time you hold everything they need. Dishes are eaten from the item menu and give lasting buffs.'] },
    { t: 'Forage', x: ['Press E at a forage patch and stop the marker inside the green zone three times. Perfect runs can turn up a pearl. Patches regrow with play time.'] },
    { t: 'Fishing', x: ['Press E at a fishing post to cast. When the float dips, press ENTER; then hold ENTER to keep the fish inside the green zone until the meter fills. Rarer fish fight harder, and some only bite at certain hours.'] },
    { t: 'Kitchen orders and bounties', x: ['The Tide Board in the reef hub posts three dish orders and four hunt bounties a day. Both pay coins, bounties also pay experience.'] },
  ] },
  { id: 'rifts', name: 'Rifts', entries: [
    { t: 'Tidal Rifts', x: ['Choose a rift at the Tide Board. Each chamber must be cleared to open the way; between chambers you pick one relic that lasts the run. The last chamber holds the Rift Warden.'] },
    { t: 'Rooms', x: ['Elite dens hold a champion and better relics. Ambush rooms spring a trap. Treasure vaults hold chests and a relic on a stand. Altars let you heal, gamble or sacrifice.'] },
    { t: 'Tides', x: ['Each chamber may carry a tide that twists the rules: hasty foes, darkness, richer coins. They are listed when you enter.'] },
    { t: 'Pearl Gauntlet', x: ['Endless waves in a sealed arena. How many can you survive? Your best wave is kept.'] },
    { t: 'Daily rift', x: ['Everyone gets the same seed on the same day. The first clear each day pays a bonus.'] },
  ] },
  { id: 'options', name: 'Options', from: 'difficulty' },
];

export const TIPS_FOOTER = 'Left / right: page    Up / down: scroll    ESC: close';
