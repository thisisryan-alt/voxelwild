// Four endings (slay / trident / mercy / secret) told as story panels, then a credits summary.
import { CutsceneScene, CreditsScene } from '../ui/screens.js';

const ENDINGS = {
  slay: { title: 'THE TIDE BREAKS', music: 'ending_sad', panels: [
    { art: 'throne', text: 'Poseidon falls. The Trident sinks, and the sea, for the first time in four thousand years, exhales.' },
    { art: 'seal', text: 'The Seal has no one left to hold it. Below the Hollow, something very old and very patient stirs, and begins to remember what it was hungry for.' },
    { art: 'ocean', text: 'The sea you leave behind is free. It is also unlocked. The Court is gone. The Tithe is gone. The reef is quiet, and not because it is afraid.' },
    { art: 'crab', text: 'You are the largest thing in the ocean now. You will have to be big enough for it.' },
    { art: 'night', text: "Somewhere beneath you, a wound dreams of lanterns. 'Moltborn,' say the tides, 'there is so much left to outgrow.'" },
  ] },
  trident: { title: 'THE TIDE TURNS', music: 'ending_sad', panels: [
    { art: 'throne', text: 'You take the Trident. It is heavier than it looks. It weighs exactly as much as a promise.' },
    { art: 'seal', text: 'The Seal accepts a new Warden. The Hollow settles. The sea, for a while, is quiet again.' },
    { art: 'crab', text: 'You are not cruel. You tell yourself so. The Tithe ends, because you cannot bear it, and the Seal weakens, because it was fed by it.' },
    { art: 'throne', text: "In four thousand years a small crab in a crown will stand before another unfinished shell and think: 'There must be another way.'" },
  ] },
  mercy: { title: 'TWO WARDENS', music: 'ending_good', panels: [
    { art: 'hands', text: 'You offer your claw. The god of the sea, who has not been touched in four thousand years, takes it.' },
    { art: 'seal', text: 'Seven pearls. Hatchlings, awake. A queen who counts no more; a titan who stands in front of the door and not between. The Seal, rebuilt by many hands, does not need to be fed.' },
    { art: 'dawn', text: 'The Tithe is ended by the lock itself. The Court kneels not to a tyrant, but to two tired wardens who, finally, rest in turns.' },
    { art: 'eggs', text: 'On a reef, a nursery hatches. Ten hatchlings, ten soft shells. Nobody counts them. Nobody takes any.' },
    { art: 'crab', text: 'You grew. Everyone you left behind grows too.' },
  ] },
  secret: { title: 'THE FIRST TIDE', music: 'ending_secret', panels: [
    { art: 'night', text: 'The water in the Throne goes very still. In it you see your own reflection, and behind it another, and behind that another, all the way down.' },
    { art: 'stars', text: "Seven pearls remember. The Mother Tide wakes, not as a god but as a current, and says: 'Come home. Bring the ones who grew.'" },
    { art: 'throne', text: "Poseidon was never the first god. He was the first Moltborn to forget he was one. 'We were all unfinished,' he whispers. 'Every god is a crab that stopped molting.'" },
    { art: 'dawn', text: 'You do not take the Trident. You do not break the Seal. You molt. The Seal, the Hollow, the king and the crown molt with you, and what is left is not a lock, not a god, and not a wound. It is a sea.' },
    { art: 'ocean', text: 'No one rules it. No one needs to.' },
    { art: 'eggs', text: "And somewhere, a small soft-shelled crab looks up at a brighter sky and thinks: 'I wonder what I will grow into.'" },
  ] },
};
export const ENDING_ORDER = ['slay', 'trident', 'mercy', 'secret'];
export const ENDING_TITLES = Object.fromEntries(Object.entries(ENDINGS).map(([k, v]) => [k, v.title]));

export class Endings {
  constructor(game) { this.g = game; game.systems.endings = this; }
  play(kind) {
    const g = this.g, E = ENDINGS[kind] || ENDINGS.slay; const s = g.state.settings; s.endings = [...new Set([...(s.endings || []), kind])];
    import('../core/save.js').then(({ Save }) => Save.saveSettings(s));
    g.setFlag('game_complete'); g.saveGame(true);
    const panels = E.panels.map((p, i) => (i === 0 ? { ...p, title: E.title, music: E.music } : p));
    g.engine.push(new CutsceneScene(g, panels, () => g.engine.push(new CreditsScene(g, kind, E.title))));
  }
}
