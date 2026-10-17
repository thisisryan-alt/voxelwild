// NPC conversations. Voices: Brine (gruff, dry), Pip (breathless), Cowrie (silky), Tessa (whispers), Fenwick (digressing),
// Vael (euphemism), Ruby (blunt), Inkwell (theatrical liar), Hobb (formal, tired), Glimmer (cheerful, fearless), Thessaly (calm sorrow).
export const DIALOGUE = {
  *old_brine(c) {
    if (!c.flag('met_brine')) {
      yield c.say("Hm. Up already. Don't squint, barnacle — it's only the shrine-light. It's been brighter since the Tithe-boats left.");
      yield c.say("Your clutch is gone. Spawning-night, nine days back. Collectors in the Court's colours, counting heads. They counted ten, and took one in ten... and then they kept counting.");
      let asked = [false, false, false];
      while (true) {
        const opts = []; const ids = [];
        if (!asked[0]) { opts.push('Where did they take everyone?'); ids.push(0); }
        if (!asked[1]) { opts.push('Why did they leave me?'); ids.push(1); }
        opts.push('What do I do now?'); ids.push(2);
        const i = ids[yield c.ask('Well? You have the look of someone with questions.', opts)];
        if (i === 0) { asked[0] = true; yield c.say("Down. 'To the Deep,' the Court says. 'A privilege and a duty.' I have other words for it. I'll teach you them when you're older. If you get older."); }
        else if (i === 1) { asked[1] = true; yield c.say("Soft shell. Last to harden, never did. They like them hard — easier to count. And you're... unfinished, little one. Don't make that face. So is a sunrise."); yield c.say("Ask me again when you've grown into your claws."); }
        else break;
      }
      yield c.say("East. The Garden first, then the Kelp Hollow, where a rock-crab called Grumbold has made a hoard of everything the Court dropped. He's got something of mine on his shell. Something of yours, really.");
      yield c.say("And keep your head down near the Court's folk. Mostly.");
      c.set('met_brine'); c.lore('b_moltborn');
      return;
    }
    if (c.flag('evolved_warrior') && !c.flag('brine_warrior_talk')) {
      c.set('brine_warrior_talk');
      yield c.say("Look at you. Shell like a cathedral door. I didn't think I'd see it. Not in my lifetime.");
      yield c.say("Listen. 'Moltborn.' That's the word for what you are. Don't say it out loud east of the Forest. Don't say it in the Court. And whatever you do — don't say it to the sea-king.");
      return;
    }
    if (c.boss('grumbold') && !c.flag('evolved_warrior')) { yield c.say("You have the Core? Then why are you talking to me? The shrine is in the Hollow. Go. Molt. I'll still be here, being decrepit."); return; }
    const lines = [
      "The tide's out of sorts today. It's always out of sorts. It's the Seal. Never mind.",
      "I used to be a keeper, once. Of what? Oh, the usual. Eggs. Promises. The odd god's secret.",
      "Eat something. You've got that hollow look. The look of a crab who's been thinking.",
    ];
    yield c.say(lines[Math.floor(Math.random() * lines.length)]);
  },

  *pip(c) {
    if (!c.qActive('sq_tyrant') && !c.qDone('sq_tyrant')) {
      yield c.say("Wow wow wow, you're a crab! A real one! I'm Pip. I lost my pearl! My mama's pearl! It rolled under the garden and the big clam swallowed it. The BIG clam!");
      const i = yield c.ask("Will you get it back? Please please please?", ['I will.', 'A clam? Beneath the garden?', 'Not now, Pip.']);
      if (i === 2) { yield c.say("Okay... okay. I'll be here. I'm always here."); return; }
      if (i === 1) yield c.say("There's a crack in the wall at the end of the Garden! Only a Warrior-sized someone could smash it. A real crab, with a real claw!");
      yield c.say("You're the best! Pearl Tyrant, they call him. He's very grumpy. And very, very round.");
      c.quest('sq_tyrant'); return;
    }
    if (c.qDone('sq_tyrant')) { yield c.say("MAMA'S PEARL! You did it you did it! I'm going to tell everybody! I'm going to tell the CLAMS!"); return; }
    yield c.say("The Pearl Tyrant's behind the cracked wall at the east end of the Garden. You'll need a heavy hit — a big charged one, you know?");
  },

  *brack(c) {
    if (!c.flag('met_brack')) {
      c.set('met_brack');
      yield c.say("WHAT? ...A crab. Speak up! I said SPEAK — oh, you did. Brack. Counter of the Tidepools, third in the family, deaf in the left claw and, on most days, the right.");
      yield c.say("Three hundred and eleven barnacles, every spring, in a tidy ledger. Then a gentleman in an enormous shell moved in and declared himself King. He ate the census. Not the barnacles. The census. Eleven springs of paper.");
    }
    if (!c.qActive('sq_census') && !c.qDone('sq_census')) {
      const i = yield c.ask("Three barnacles for a fresh ledger, and then a word with His Majesty?", ['Count me in.', 'Why is he called king?', 'Not now.']);
      if (i === 2) { yield c.say("Eh? ...Not now. Very well. I'll be counting."); return; }
      if (i === 1) yield c.say("A crown of orange coral. Mostly glue. But he rolls the whole palace down the hall like a boulder, and one does not argue a title with a boulder.");
      yield c.say("Three fat barnacles — prise them off the ledges and the pool walls — then through the big doorway east. You will hear him. He announces himself.");
      c.quest('sq_census'); return;
    }
    if (c.qActive('sq_census')) {
      if (c.count('tide_barnacle') >= 3 && c.boss('hermit_king') && !c.flag('census_done')) {
        c.take('tide_barnacle', 3); c.set('census_done'); c.gain(120); c.give('mut_census');
        yield c.say("Three... and the hall is quiet. Hm. You have done a counting I never could. Take this: the eye I had when I was young. It sees what is hidden in the numbers.");
        yield c.say("Three hundred and eleven. Three hundred and twelve, now. You count too.");
        return;
      }
      if (c.boss('hermit_king')) { yield c.say("I hear the hall is quiet. Bring me the barnacles, and the ledger will be whole."); return; }
      yield c.say("Three barnacles. Then the King, east. When he curls into the shell, don't bother: wait until he rolls into the wall, and hit HIM.");
      return;
    }
    yield c.say("The pools are quiet. I like it. The barnacles are... countable again.");
  },

  *morel(c) {
    if (!c.flag('met_morel')) {
      c.set('met_morel');
      yield c.say("Ah! Don't — don't touch the walls. Don't breathe through your mouth. Good. Dr. Morel, mycologist, formerly of the Court's Faculty of Things That Grow. You are, I think, a crab. Fascinating posture.");
      yield c.say("This grotto is the finest fungal garden in the sea. Four hundred species. I have catalogued them all but three: the ones on the high shelves. They glow. They hum back. I am, regrettably, afraid of heights.");
    }
    if (!c.qActive('sq_spores') && !c.qDone('sq_spores')) {
      const i = yield c.ask("Three glowcap samples, if you would? I'll make it worth your while.", ['Gladly.', 'What hums?', 'Not now.']);
      if (i === 2) { yield c.say("Of course. Of course. I will be here, being cautious."); return; }
      if (i === 1) yield c.say("The mother of the garden, at the top. She keeps the little ones asleep. It is — I want to stress this — a very *kind* hum. But she is eleven times my size and does not like visitors.");
      yield c.say("Climb the cap-shelves. Mind the clouds: they are lovely and they are poison. The three samples are on the side ledges; the hall at the top is hers.");
      c.quest('sq_spores'); return;
    }
    if (c.qActive('sq_spores')) {
      if (c.count('glowcap_sample') >= 3 && c.boss('sporemother') && !c.flag('spores_done')) {
        c.take('glowcap_sample', 3); c.set('spores_done'); c.gain(140); c.give('charm_spore');
        yield c.say("Three! And you went up — and came back — and it has gone quiet. Oh. Oh, I do hope that was kind. I do hope it was kind.");
        yield c.say("Here. A sachet of the garden's own spores. They will not poison you now; they have decided you are family. It is the highest honour I can bestow. It is also a sachet.");
        return;
      }
      if (c.boss('sporemother')) { yield c.say("It has gone so quiet. Bring me the samples, and I will not need to be brave."); return; }
      yield c.say("Three samples. Then, if you are feeling heroic, the mother at the top. Stay out of the clouds, and do not step on the little ones.");
      return;
    }
    yield c.say("The garden is peaceful now. I have started naming the small ones. This one is Gerald.");
  },

  *tallow(c) {
    if (!c.flag('met_tallow')) {
      c.set('met_tallow');
      yield c.say("Mind the plaque. Mind the floor. Mind, if you can manage it, the thing at the end of the gallery. Tallow, Archivist of the Counting House, sixty-one years in post and forty of them unsupervised.");
      yield c.say("I catalogued every drawer in these vaults. Every drawer but the last. The Colossus will not let me past, and the key is in the upper room, and the stairs in the upper room are very steep, and I am a seahorse.");
    }
    if (!c.qActive('sq_vaults') && !c.qDone('sq_vaults')) {
      const i = yield c.ask("Would you open the last drawer for me? I would so like to see what it is I have been protecting.", ['I will.', 'What is in it?', 'Not now.']);
      if (i === 2) { yield c.say("Of course. Of course. The drawers are not going anywhere. Sixty-one years, you know. They are the most patient things I have ever met."); return; }
      if (i === 1) yield c.say("I do not know. That is the entire difficulty. The ledger says only: 'Last drawer: the balance.' It does not say whose.");
      yield c.say("The key is in the upper room, up the shaft in the gallery. Then the brass door at the east end. The Colossus will be on the other side, and he is — he is not rude, exactly. He is simply very, very thorough.");
      c.quest('sq_vaults'); return;
    }
    if (c.qActive('sq_vaults')) {
      if (c.boss('brass_colossus') && !c.flag('vaults_done')) {
        c.set('vaults_done'); c.gain(200); c.give('charm_archivist');
        yield c.say("It is — you say it is open? And he said it was — oh. Oh, my. The balance. The balance is... it is a list. Of the names. Every hatchling the Court ever took, and every pearl they were traded for, and at the bottom, in the Queen's own hand: 'Not worth it.'");
        yield c.say("I am going to sit down now. I am going to sit with it a while. Take the loupe. It has helped me read things I would rather not have read. May it do the same for you.");
        return;
      }
      yield c.say("The key is in the upper room, up the shaft. The door is at the east end. The thorough gentleman is on the other side.");
      return;
    }
    yield c.say("I have the last drawer's ledger now. I have been reading it very slowly, so that it lasts.");
  },

  *sear(c) {
    if (!c.flag('met_sear')) {
      c.set('met_sear');
      yield c.say("HOLD IT. Don't — okay, you're fine, you're not standing on a vent. Sear. Vent-smith. I cast with what the floor breathes out, and the floor is MOODY today.");
      yield c.say("Four plumes between here and the pit. They go in cycles. Count four, move on three. Dash if you have to; the vents do not care how brave you are.");
    }
    if (!c.qActive('sq_vents') && !c.qDone('sq_vents')) {
      const i = yield c.ask("I need three cinder cores for a proper smelt, and something big in the pit has been eating my supply. Interested?", ['Sure.', 'What is in the pit?', 'Not now.']);
      if (i === 2) { yield c.say("Sure. Fine. I will just keep smelting nothing."); return; }
      if (i === 1) yield c.say("Magmaw. Vent-eel. Grew too big for the throat so it moved into the pit. It is not evil. It is HOT, and it is lonely, and those are two different problems that look identical from the outside.");
      yield c.say("Cores lie in the passage past the plumes: one after the second vent, one in the river, one by the pit. Bring all three, and then say hello to Magmaw from me. Forcefully.");
      c.quest('sq_vents'); return;
    }
    if (c.qActive('sq_vents')) {
      if (c.count('cinder_core') >= 3 && c.boss('magmaw') && !c.flag('vents_done')) {
        c.take('cinder_core', 3); c.set('vents_done'); c.gain(220); c.give('shell_cinder');
        yield c.say("THREE CORES. And the pit has gone quiet. I did not think you would — okay. Okay. Hold still.");
        yield c.say("Cinderplate. The vents will barely notice you. I made it fast and I made it right. Do not thank me, I will cry, and my tears evaporate on contact and it ruins the effect.");
        return;
      }
      if (c.boss('magmaw')) { yield c.say("Pit is quiet. Bring me the three cores and I will forge something that makes the vents sulk."); return; }
      yield c.say("Three cores. Then the eel. Count four, move on three.");
      return;
    }
    yield c.say("The vents have been behaving. That terrifies me. I have started apologising to them in advance.");
  },

  *cowrie(c) {
    if (!c.flag('met_cowrie')) { c.set('met_cowrie'); yield c.say("Darling! A customer! Or a thief — but you've the face for honest trade. Madame Cowrie, purveyor of the finest and the nearly finest."); }
    while (true) {
      const opts = ['Browse your wares', 'Any news?'];
      if (c.has('spiral_shell') && c.qActive('sq_tessa') && !c.flag('tessa_helped')) opts.push('Sell the Spiral Shell (300)');
      opts.push('Leave');
      const i = yield c.ask('What can Cowrie do for you?', opts);
      const pick = opts[i];
      if (pick === 'Browse your wares') yield c.shop('cowrie');
      else if (pick === 'Any news?') {
        const news = ["They say the Garden wall is hollow in places. I say a gal must not repeat what she hears. Repeat it anyway: hit it hard.", "The Court's collectors have started coming up the Forest road. Bad for business — their wallets are so *official*.", "A little bird says the sea-king hasn't left his throne in a century. Bad for business, bad for everything."];
        yield c.say(news[Math.floor(Math.random() * news.length)]);
      } else if (pick.startsWith('Sell')) {
        yield c.say("Oh, it's perfect. Tessa's never going to fit into her mother's shell, darling, she'll be fine. Three hundred, and not a coin less. Done?");
        const j = yield c.ask('Sell it?', ['Sell', 'Keep it']);
        if (j === 0) { c.take('spiral_shell'); c.gain(300); c.set('tessa_sold'); yield c.say("Pleasure. Do mind the hermit-child. She cries so loudly for such a small thing."); }
      } else break;
    }
  },

  *tessa(c) {
    if (c.flag('tessa_helped') || c.flag('tessa_sold')) {
      yield c.say(c.flag('tessa_helped') ? "It fits. It fits! I can see the whole garden from in here. Thank you. Thank you thank you." : "...I'll just... live in the dark, I suppose. Thanks for... asking.");
      return;
    }
    if (c.qActive('sq_tessa') && c.has('spiral_shell')) {
      yield c.say("Is that...? It's a perfect spiral. Is it for me?");
      const i = yield c.ask("Her claws are trembling.", ['Give her the shell.', 'Not yet.']);
      if (i === 0) { c.take('spiral_shell'); c.set('tessa_helped'); c.give('charm_pearlstring'); yield c.say("I... I'd give you everything I have. I only have this. It's called a pearl string; my mother's. Please."); }
      return;
    }
    if (!c.qActive('sq_tessa')) {
      yield c.say("...hi. I'm Tessa. I... I've outgrown my shell. I can't leave the nursery like this. There's a perfect shell, a spiral, in a hole too small for anyone big. If you were small... maybe you could...");
      c.quest('sq_tessa'); return;
    }
    yield c.say("The hole is at the left end of the nursery. Behind the rock, in the dark. You have to be small. You're small! It's the one good thing.");
  },

  *fenwick(c) {
    if (!c.flag('met_fenwick')) {
      c.set('met_fenwick');
      yield c.say("Ah — what — yes! A visitor! Fenwick, cartographer, formerly of the Court's Survey, currently of... here. The Sunken Forest, you understand, is not one forest but three, stacked like — well. Like three forests.");
      yield c.say("The Rootmaze is east. The Heart beyond. At the Heart lives the Mother. Don't look at her eggs. They're... unwell. Someone made them unwell. On purpose. That is a very rude thing to do to an egg.");
    }
    while (true) {
      const opts = []; opts.push('What is this place?');
      if (!c.qActive('sq_choir') && !c.qDone('sq_choir')) opts.push('Is there anything odd here?');
      if (!c.qActive('sq_atlas') && !c.qDone('sq_atlas')) opts.push('Do you need help?');
      if (c.qActive('sq_atlas') && c.count('map_fragment') >= 3) opts.push('Hand over the map fragments');
      opts.push('Goodbye');
      const pick = opts[yield c.ask('Yes? Questions? I adore questions.', opts)];
      if (pick === 'What is this place?') { c.lore('forest_records'); yield c.say("A jungle, once! The wave that drowned it was — I wrote this down — 'the height of a decision.' Not a storm. A decision. I underlined it twice. The trees didn't die. They just kept growing, in the dark. Sideways. Downward. Out of spite."); }
      else if (pick === 'Is there anything odd here?') { yield c.say("There's a mural, east of here, with a tune on it. Three bulbs in the wood, pale as ghosts. Low, high, middle. If you struck them in that order — I don't know. Something polite might happen."); c.quest('sq_choir'); }
      else if (pick === 'Do you need help?') { yield c.say("Oh! Oh yes. Mossbacks took three pieces of my atlas. I'd go myself but the mossbacks are rude, and I'm, well, a seahorse."); c.quest('sq_atlas'); }
      else if (pick === 'Hand over the map fragments') { c.take('map_fragment', 3); c.set('atlas_done'); c.gain(120); yield c.say("The Rootmaze! The East Gallery! The Hollow Reach! It's all here! Take these — coins, I mean — I've nothing else but opinions."); }
      else break;
    }
  },

  *vael(c) {
    if (!c.flag('met_vael')) {
      c.set('met_vael');
      yield c.say("Welcome to the Coral Kingdom, small guest. I am Chancellor Vael. You will understand if the Queen does not receive: her time is spoken for. By duty. By gratitude. By the Sea-King's many kindnesses.");
    }
    if (c.has('brineguard_key')) { yield c.say("You have the key. Splendid. I am sure the Queen will be delighted. As I was, to be of service."); return; }
    const i = yield c.ask("Passage into the Spires requires a contribution. Nothing so crass as a fee. A… voluntary gift, of one hundred and fifty coins.", ['Pay (150 coins)', 'What is the contribution for?', 'No.']);
    if (i === 1) { yield c.say("The Tithe, of course. A privilege, and a duty, and a very small one. Everyone contributes: the reef gives its young, the Court gives its time, and you, I think, will give a hundred and fifty coins."); return; }
    if (i === 0) {
      if (c.coins() < 150) { yield c.say("Ah. A shortfall. Come back when you are more… generous."); return; }
      c.pay(150); c.give('brineguard_key'); c.set('vael_paid');
      yield c.say("Such grace. The inner gate is yours. Do mind the guards — they are loyal to the Queen, and you do look so very uncourtly.");
      return;
    }
    yield c.say("Pity. Then the gate remains closed. The Court is nothing if not consistent.");
  },

  *ruby(c) {
    if (c.flag('vael_paid') && !c.flag('ruby_hostile')) { c.set('ruby_hostile'); yield c.say("Ah. You paid him. Of course you did. Spend your coins where you like, crab. But don't expect me to talk about anything that matters."); return; }
    if (c.flag('ruby_hostile')) { yield c.say("I've said what I'll say."); return; }
    if (!c.flag('met_ruby')) {
      c.set('met_ruby');
      yield c.say("You. Crab. Stand still. ...No weapons, no collar, no Court badge. Good. I'm Captain Ruby of the Brineguard. The Queen's guard, not Vael's, whatever he tells you.");
      yield c.say("Vael sells passage to the Spires. I don't. I need somebody who isn't one of mine to do a job I can't be seen doing.");
    }
    if (c.has('stolen_regalia') && !c.flag('regalia_inkwell') && !c.flag('regalia_returned')) {
      yield c.say("That crate. The Court's own seal on the lid. Somebody was smuggling a relic out of the Kingdom through the graveyard, and it was not me.");
      const j = yield c.ask('Give the regalia to the Brineguard?', ['Hand it over.', 'Not yet.']);
      if (j === 0) { c.take('stolen_regalia'); c.set('regalia_returned'); c.gain(120); yield c.say("The Brineguard thanks you. Quietly. Out loud, we will deny you ever walked in here."); return; }
    }
    if (!c.has('brineguard_key') && !c.qActive('sq_ledger') && !c.qDone('sq_ledger')) {
      const i = yield c.ask("The Queen has been... wrong, lately. Vael keeps a ledger — the Tithe, in numbers. If she sees it, she'll act. I'll give you the inner key, free, if you'll fetch it from the Archive.", ['I will.', 'Why trust me?', 'Not interested.']);
      if (i === 1) yield c.say("I don't. But I trust that the ones who've come through here and aren't Court-bought are very few. It's a short list. You're on it, for now.");
      if (i === 2) { yield c.say("Then I can't help you."); return; }
      c.give('brineguard_key'); c.quest('sq_ledger');
      yield c.say("The Archive is in the Spires, behind a locked door only that key opens. Bring me the ledger, or bring it to the Queen's own hand. Either way, bring it.");
      return;
    }
    if (c.has('tithe_ledger') && !c.flag('ledger_used') && !c.flag('ledger_burned')) {
      yield c.say("That's it. That's the ledger. 'Seal at sixty-one percent.' Sixty-one percent of what? Who— never mind.");
      const i = yield c.ask("What do we do with it?", ['Keep it for the Queen.', 'Give it to Ruby.', 'Burn it.']);
      if (i === 1) { c.take('tithe_ledger'); c.set('ledger_used'); c.lore('tithe_ledger'); yield c.say("I'll see it reaches the right hands. When the time comes."); }
      else if (i === 2) { c.take('tithe_ledger'); c.set('ledger_burned'); yield c.say("...I understand. Some things shouldn't be read. But I wish you'd asked me first."); }
      else yield c.say("Keep it safe, then. When the Queen's in front of you, you'll know what to do with it.");
      return;
    }
    yield c.say("Careful in the Court. The Queen is not herself. Whatever she says, whatever she does — it's not entirely her.");
  },

  *ostrea(c) {
    yield c.say("Ostrea. Pearl-Smith. Yes, I'm an oyster. Yes, I know. Do you have something that needs making better, or are we both just standing here?");
    const i = yield c.ask('Hm?', ['Reforge my gear', 'Leave']);
    if (i === 0) yield c.forge();
  },

  *inkwell(c) {
    if (!c.flag('met_inkwell')) {
      c.set('met_inkwell');
      yield c.say("My dear colleague! Do come in out of the wet. Ha! Ha! A joke. Inkwell — Mr. — purveyor, notary, and general fixer of the Graveyard's delicate accounts. I deal in sums. Dead sums, mostly.");
    }
    while (true) {
      const opts = ['Browse', 'Tell me about yourself'];
      if (!c.qActive('sq_inkwell') && !c.qDone('sq_inkwell')) opts.push('Any work?');
      if (c.has('stolen_regalia')) opts.push('Hand over the regalia');
      if (c.flag('regalia_inkwell') && !c.has('captain_key') && !c.flag('captain_key_given')) opts.push('The Captain\'s Key?');
      opts.push('Leave');
      const pick = opts[yield c.ask('What may Mr. Inkwell do for you?', opts)];
      if (pick === 'Browse') yield c.shop('smuggler');
      else if (pick === 'Tell me about yourself') { c.lore('inkwell_deal'); yield c.say("I was a purser on the Gannet. I mismanaged some funds. The sea-king mismanaged the ship. We are both, in our ways, accountants."); }
      else if (pick === 'Any work?') { yield c.say("A small matter. A crate in the Galleon's hold. Rum, certainly rum, but with the most sentimental value. The ghosts guard it and I— well, I have a delicate constitution. Bring me the crate and I'll pay you handsomely, and give you, say, a certain key."); c.quest('sq_inkwell'); }
      else if (pick === 'Hand over the regalia') {
        yield c.say("Rum, as I said. Oh, you opened it. How resourceful. No harm. Yes, it's a crown of sorts. The Coral Court's, I think. Whose is it, finally, if not the one holding it?");
        const j = yield c.ask('Whose is it?', ['Give it to Inkwell.', 'Keep it. It should go back to the Court.']);
        if (j === 0) { c.take('stolen_regalia'); c.set('regalia_inkwell'); c.gain(250); c.give('charm_ghostcoin'); yield c.say("Charming. Two hundred and fifty, and a little token of my esteem. And the key — ah. Come ask me for the key, when you're ready."); }
      } else if (pick === "The Captain's Key?") { c.give('captain_key'); c.set('captain_key_given'); yield c.say("Ah, yes. The key. Taken off a drowned captain's neck by someone who'll deny it. Do give the old man my regards."); }
      else break;
    }
  },

  *hobb(c) {
    if (!c.flag('met_hobb')) {
      c.set('met_hobb'); c.lore('wreck_log');
      yield c.say("Ahoy. Quartermaster Hobb, of the Gannet. We are, ah, not what we were. Do forgive the glow.");
      yield c.say("Three hundred and eleven souls we were. It is a duty of the quartermaster to call the roll, you see. I have not been able to call it in four hundred years. Four of the crew have lost their tokens.");
    }
    if (!c.qActive('sq_hobb') && !c.qDone('sq_hobb')) { c.quest('sq_hobb'); yield c.say("If you find them — brass tags, green with age — I would be forever in your debt. I have little else to give. A key, perhaps. The captain's. He won't be needing it, I think, though he doesn't believe that."); return; }
    if (c.qActive('sq_hobb') && c.count('crew_token') >= 4) {
      c.take('crew_token', 4); c.set('rollcall_done');
      yield c.say("Ames. Bellweather. Cutter. Dunmore. ...Present. All present. Thank you.");
      yield c.say("The captain's key, as promised. He is on the bridge. Be kind. He has been standing there for four centuries and he does not know it is over.");
      return;
    }
    yield c.say(`The tokens are in the Graveyard. ${c.count('crew_token')} of 4 so far. One is in a skull's mouth, one in a barrel, one in the third mast's crow's nest, one with the... well, you'll see.`);
  },

  *glimmer(c) {
    if (!c.flag('met_glimmer')) {
      c.set('met_glimmer');
      yield c.say("Hi! Hello! You glow! Well, a bit. I'm Glimmer. Don't mind the teeth, they come with the job. Welcome to the Abyss! It's lovely if you like the dark. It's very dark.");
      yield c.say("You'll feel the squeeze. The water presses. Smaller shells don't last; yours looks... oh, it's like mine! A bit. Anyway. Carry a light. Eat when you can.");
    }
    if (!c.qActive('sq_lantern') && !c.qDone('sq_lantern')) {
      const i = yield c.ask("We Lantern Folk used to light the whole cavern. The braziers are cold. Three of them. The stones are scattered. Could you...?", ['Of course.', 'Not now.']);
      if (i === 0) { c.quest('sq_lantern'); c.give('lantern_stone'); yield c.say("Here's the first stone! Two more are in the cavern, one in each wing. When you've lit all three, the whole place sings!"); }
      return;
    }
    if (c.qDone('sq_lantern')) { yield c.say("It's beautiful! I've never seen it. You made a beautiful thing. I hope the sea-king hears about it. And mind the Lurelord. She's the big one. She has the biggest light, and she thinks it's hers."); return; }
    yield c.say("Three braziers, three stones. You've got " + c.count('lantern_stone') + ". Keep going!");
  },

  *thessaly(c) {
    if (!c.flag('met_thessaly')) {
      c.set('met_thessaly');
      yield c.say("You came. After all this time, someone small came. Come closer, child of the unfinished shell. I am Thessaly. Or I was, before I became a memory with good manners.");
      yield c.say("I will tell you what the king would not. You are Moltborn. We were the Mother Tide's unfinished work — made to outgrow whatever would cage us. A crab who never stops growing is a crab who cannot be ruled.");
      yield c.say("One of us became a god. His name, you know. He bound the Hollow with a spear and a promise: 'Only I can.' And then he decided: no more of us. The Tithe isn't tribute. It feeds the Seal. Every hatchling... is a hinge that holds the door shut another year.");
      c.lore('mural_trench1'); c.lore('mural_trench3'); c.lore('b_tide_seal');
      yield c.say("But the hatchlings are not dead. The Seal needs them alive, asleep, stored. Behind the old seals in this temple. Some of your brothers may still be there.");
      c.quest('sq_siblings');
    }
    if (!c.flag('krael_decided') && c.visited('trench_temple')) {
      yield c.say("Krael is down in the lowest hall. The first guardian. Chained by the same hand that gave him the work. He is as tired as the one who chained him. You may break him — and take his Heart. Or you may free him, and he will give it. The choice is yours; I will not tell you the right one.");
      return;
    }
    if (c.flag('hatchlings_freed')) { yield c.say("They wake. I can feel it. You have done something the sea has not seen in a long time: you grew, and you came back for the ones who did not. That is the only magic I know."); return; }
    yield c.say("Break the old seals, in the vault below. You will need to be very old, and very large, to do it. That is what the Ancient Molt is for.");
  },

  *krael_ally(c) { yield c.say("I am not what I was. Thank you.", 'Krael'); },
};
