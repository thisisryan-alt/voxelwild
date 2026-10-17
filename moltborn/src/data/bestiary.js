// Field notes on every creature and boss in the sea. What the player may read depends on how many they have defeated:
// 1 kill reveals the name and the lore note, 5 kills the numbers, 12 kills the combat tip. Bosses are revealed by
// being defeated at least once; their tip needs a second try, so it is gated on a recorded attempt.
export const BEASTS = {
  // ---- reef ----------------------------------------------------------------------------------------------------------------------------
  pinchling: { habitat: 'Reef shallows', note: 'Hatchlings that never grew out of the temper of a crab twice their size. They charge anything that moves.', tip: 'They lunge in a straight line and then stand dazed. Sidestep, then strike.' },
  minnow: { habitat: 'Reef shallows', note: 'Silver bait with ambitions. They only hurt in a crowd, which is how they like to travel.', tip: 'A sweeping claw clears a whole school at once.' },
  urchin: { habitat: 'Reef floors', note: 'A ball of spines that has made peace with sitting still. Touching it is a decision you make once.', tip: 'Do not touch the spines. Use ranged abilities, or strike from above.' },
  hermit: { habitat: 'Reef, kingdom', note: 'Moves into whatever shell is left lying around and defends it like a fortress. The shell does not always fit.', tip: 'Its shell blocks blows from the front. Strike while it turns, or break its guard with a heavy attack.' },
  hatchling: { habitat: 'Shoreline Nursery', note: 'A newborn, soft and harmless. It looks at you as if you might know where its parents are.', tip: 'Leave it alone.' },
  // ---- forest --------------------------------------------------------------------------------------------------------------------------
  moray: { habitat: 'Kelp forest', note: 'Waits inside a crack in the rock, eyes shining, until something swims close enough to bite.', tip: 'It strikes when you pass. Hit the hole from range or dash past once it has lunged.' },
  venomjelly: { habitat: 'Kelp forest', note: 'A drifting bell on the current. Its touch is a slow, sick ache.', tip: 'Its sting lingers. Take it down quickly and from a distance.' },
  sporepod: { habitat: 'Kelp forest', note: 'Half plant, half something else. It coughs spores at anything that looks like an enemy.', tip: 'It only fires when you are in line. Approach from above or below.' },
  piranha: { habitat: 'Kelp forest', note: 'Eager and in great numbers. Nothing about them is clever; they just never stop.', tip: 'Fight with your back to a wall so they cannot surround you.' },
  mossback: { habitat: 'Kelp forest', note: 'An old turtle whose shell has grown a garden. It will not hurry; it will not stop either.', tip: 'When it tucks into its shell, step back. Strike the head when it comes out.' },
  // ---- kingdom -------------------------------------------------------------------------------------------------------------------------
  brineguard: { habitat: 'Gate Plaza, court', note: 'A soldier of the Pearl Court who stayed at his post long after the Court was gone.', tip: 'Shield forward. Parry the thrust and he opens up.' },
  archerfish: { habitat: 'Kingdom halls', note: 'Spits a stream of water hard enough to crack coral. Prefers to do it from a safe place.', tip: 'It backs away when you close in. Corner it against a wall.' },
  puffer: { habitat: 'Kingdom halls', note: 'Placid until it is frightened, then very much not.', tip: 'It swells before it bursts. Back off the moment it puffs up.' },
  anemone_c: { habitat: 'Kingdom halls', note: 'A garden anemone gone wrong in the dark. It remembers being tended and resents being forgotten.', tip: 'Its tendrils reach out in a fan. Stay out of the fan or fight from a ledge.' },
  // ---- graveyard -----------------------------------------------------------------------------------------------------------------------
  ghostsailor: { habitat: 'Wreck shallows', note: 'A drowned deckhand, still on watch. It passes through hulls and wrecks and does not understand why you are in the way.', tip: 'It fades out between attacks. Strike when it solidifies to lunge.' },
  cannon: { habitat: 'The Gannet', note: 'An iron cannon, rusted into a turret, still loaded with something nobody remembers loading.', tip: 'Watch the flash on its muzzle: a shot follows in a heartbeat. Dash through.' },
  ironturtle: { habitat: 'Wreck shallows', note: 'Wears a hull plate it picked up from the wreck. It has been wearing it for forty years.', tip: 'Only the head is soft. Wait for it to come out of its shell.' },
  barracuda: { habitat: 'Wreck shallows', note: 'Fast, silver, and bored. It circles at the edge of the light and then it does not.', tip: 'Dash the moment it commits. Its dive is straight and loud.' },
  mimic: { habitat: 'Wreck holds', note: 'A chest that looks exactly like the one you hoped for, with a mouth where the lock should be.', tip: 'Strike the lid first. It must open to attack.' },
  // ---- abyss ---------------------------------------------------------------------------------------------------------------------------
  lanternfish: { habitat: 'Lantern Caverns', note: 'Its lure glows like a lamp in a window. People have followed it home.', tip: 'Do not follow the light. It stays behind its lure; strike from the side.' },
  gulper: { habitat: 'Abyss, trench', note: 'All mouth and appetite. It does not know what it is hungry for.', tip: 'It swallows whole. Keep your distance until it has lunged and missed.' },
  inksquid: { habitat: 'Lantern Caverns', note: 'Releases a cloud of dark and leaves you swimming blind into the wall.', tip: 'Fight near a light. It cannot hide in a lit space.' },
  voidwisp: { habitat: 'Abyss, trench', note: 'A cold spark of nothing in particular. It stops drifting the moment you stop looking.', tip: 'It phases out and back. Attack right after it reappears.' },
  deepjelly: { habitat: 'Lantern Caverns', note: 'A larger, slower cousin of the shallow jellies. Its glow is for your benefit.', tip: 'Its sting is strong but slow. Dash through the tentacles.' },
  // ---- trench --------------------------------------------------------------------------------------------------------------------------
  bonecrawler: { habitat: 'Bone Fields', note: 'Not an animal. Not entirely a skeleton. A thing the trench keeps assembling from what is left.', tip: 'It charges when it sees you. Parry the charge for a stagger.' },
  hollowshade: { habitat: 'Bone Fields', note: 'The shape something leaves behind. It does not have eyes but it looks at you.', tip: 'It phases through walls. Hit it only when it is solid.' },
  wardenbone: { habitat: 'Old temple', note: 'Chained to the temple floor, guarding doors nobody remembers how to open.', tip: 'Its guard breaks under heavy blows. Do not stand in its sweep.' },
  guardian: { habitat: 'Temple, halls', note: 'A sentinel of the old gods, corrupted by being left alone with its orders too long.', tip: 'It only strikes forward. Slip behind and strike.' },
  // ---- domain --------------------------------------------------------------------------------------------------------------------------
  stormhorse: { habitat: 'Hall of Guardians', note: 'A seahorse the size of a war horse. Its mane crackles when it is angry.', tip: 'It charges lightning in its mane. Stay out of its line after it rears.' },
  tidewisp: { habitat: 'Hall of Guardians', note: 'A little of the tide that learned to stand up and be angry.', tip: 'It pulls in a current when it gathers. Break the gather with a heavy attack.' },
  tridentstatue: { habitat: 'Kingdom, domain', note: 'Carved to protect, animated to punish. Its trident remembers how.', tip: 'Three beams in a row. Dash between the second and the third.' },
  // ---- anywhere ------------------------------------------------------------------------------------------------------------------------
  mantis: { habitat: 'Everywhere below the reef', note: 'Strikes with a speed that is difficult to describe and very easy to feel.', tip: 'It flurries three times. Block the first and the rest are yours.' },
  mender: { habitat: 'Packs of the deep', note: 'Heals whatever is nearest. It has never once asked whether it should.', tip: 'Kill it first. Its healing arc has a visible wind-up.' },
  spawncoral: { habitat: 'Kingdom, graveyard, trench', note: 'A coral that was never meant to birth anything but did.', tip: 'It summons in pulses. Break the coral while the spawn are young.' },
  spawnling: { habitat: 'Beside brood coral', note: 'A fierce small thing that will be dead in a moment either way.', tip: 'A swipe clears them.' },
  splitjelly: { habitat: 'Forest, kingdom, abyss', note: 'When it dies it becomes a great many smaller ones.', tip: 'Strike it where there is space to fight the pieces.' },
  jellet: { habitat: 'Beside mother jellies', note: 'Small, bright and slightly offended.', tip: 'One hit is enough.' },
  hookjaw: { habitat: 'Graveyard, abyss, trench', note: 'A fish with a chain in its throat that is no longer attached to anything.', tip: 'Its hook pulls you in. Dash out of the pull line the moment it fires.' },
  tuskram: { habitat: 'Graveyard, deep, domain', note: 'A one-tusked battering ram of a fish. It has been charging at the same wall since before the wall was built.', tip: 'It charges in a straight line and gets stuck. Make it hit a wall, then strike.' },
  fumecap: { habitat: 'Reef, forest, abyss', note: 'A mushroom that grew up near a vent. It breathes out clouds of something warm and wrong.', tip: 'Its cloud lingers. Strike from outside it or burn it away.' },

  // ---- bosses (key = boss key) -----------------------------------------------------------------------------------------------------------
  grumbold: { habitat: "Grumbold's Den", note: 'The Reef Warden. He guards the way out of the nursery and has not been outside it in forty years.', tip: 'Watch his shoulders: the lean tells you which way he charges.' },
  pearl_tyrant: { habitat: 'Pearl Hollow', note: 'A clam the size of a house that took the sea\'s riches for itself.', tip: 'Its shell opens to fire. Hit the pearl, not the shell.' },
  hermit_king: { habitat: 'Sunken Tidepools', note: 'He gathered every shell he could find and made a crown out of the ones that would not fit.', tip: 'He swaps shells mid-fight. Learn which opens which attack.' },
  mother_moray: { habitat: 'Mangrove Heart', note: 'The mother of every moray in the forest. She moves like a river and bites like a wall.', tip: 'Her coils sweep the arena. Find the gap and dash through.' },
  sporemother: { habitat: 'Glowcap Grotto', note: 'The garden that grew an opinion. She tends the caves with spores and patience.', tip: 'The pods heal her. Clear them before burning her down.' },
  brass_colossus: { habitat: 'Pearl Vaults', note: 'A guardian of brass and gears, still counting what it guards.', tip: 'Its fist leaves a long recovery. Hit it then.' },
  aurelia: { habitat: 'Court of Pearls', note: 'Queen of the Pearl Court, who held her people together until the end and some while after.', tip: 'Her phases escalate. Save a heal for the third.' },
  captain_rust: { habitat: "Captain's Bridge", note: 'The captain of the Gannet. His ship went down but he did not.', tip: 'He summons crew. Strike the captain between waves.' },
  magmaw: { habitat: 'Ember Vents', note: 'A vent-eel in love with warmth. He just wants the dark not to be cold.', tip: 'The floor vents erupt on a rhythm. Learn the rhythm.' },
  lurelord: { habitat: 'Abyssal Throat', note: 'The light at the end of the tunnel. It is not a friendly light.', tip: 'Do not chase the lure. Wait for the eel to open its mouth.' },
  krael: { habitat: "Krael's Chain", note: 'A titan chained to the trench floor for reasons older than the chain.', tip: 'His arms hit hard but his body is slow. Stay inside his reach.' },
  rift_warden: { habitat: 'Tidal Rifts', note: 'Whoever sealed the first tear stayed to keep it shut, and over the ages became the lock. It does not hate you. You are simply the draught it was made to stop.', tip: 'Tears open where you stand: keep moving. When it vanishes, it returns behind you with a sweep. Dash toward it, not away.' },
  hollow_maw: { habitat: 'Undertow Sanctum', note: 'An undertow with a stomach. It has taken a great many things out of the sea and never given back.', tip: 'It pulls you in. Dash against the current when it opens.' },
  kyros: { habitat: 'Hall of Guardians', note: 'The last guardian of the old gods, loyal past the point of sense.', tip: 'He telegraphs with tridents. Parry the third thrust.' },
  poseidon: { habitat: 'Throne of Tides', note: 'The god of the sea. He has been waiting a very long time for someone to ask him to stop.', tip: 'Each phase changes the rules. Stay patient in the first.' },
};

export const REVEAL = { lore: 1, stats: 5, tip: 12 };
