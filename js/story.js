/* Spire — story, camp names, choices, upgrades, endings. Data only. */
(function (root) {
  'use strict';
  var S = root.Spire = root.Spire || {};

  // who: '' = narration
  var camps = [
    { name: "Sedge's Farm", npcs: [{ who: 'Sedge', x: 34, coat: '#7d8a52', skin: '#d9a67c', hat: 'brim', hatCol: '#4a4030', prop: 'staff', robe: true }], lines: [
      ['Sedge', 'The drip-lines ran dry again this morning. Third time this month.'],
      ['Sedge', 'Water falls from the Crown. Always has. So does the word of the Crown, only nobody down here has heard that word since before I was born.'],
      ['Sedge', "You're the best courier in the Roots. Take our petition up. All the way up. Put it in the Crown's own hands."],
      ['', '{km} kilometres of wall. Nobody from the Roots has ever climbed past the Works.']
    ] },
    { name: 'Drip Market', npcs: [{ who: 'Moss-seller', x: 32, coat: '#5f7f6a', hat: 'hood', hatCol: '#3c5a4a', prop: 'basket' }], lines: [
      ['Moss-seller', 'A courier, heading up? Then keep an eye out for chalk. Climbers before you left it on the hard routes.'],
      ['Moss-seller', 'Bring it to any camp. The riggers will trade you better lungs and better legs for it.']
    ] },
    { name: 'The Long Ladder', npcs: [{ who: 'Hask', x: 32, coat: '#8a6f55', skin: '#c99672', hat: 'cap', hatCol: '#5a4636', prop: 'rope' }], lines: [
      ['Hask', 'See these? Pitons. Hammer one into a hold and the wall remembers you. Fall, and you wake up there instead of all the way down at camp.'],
      ['Hask', 'I got as far as the Works gate once. They turned me back. Said the Crown had ordered the Roots to stay put.'],
      ['Hask', 'Funny thing. Nobody I asked had ever seen that order.']
    ] },
    { name: 'Lamp Row', npcs: [{ who: 'Nib', x: 30, coat: '#b9843f', hair: '#3a2a1c', prop: 'lamp', scale: 0.72 }], lines: [
      ['Nib', 'Are you going to see the Crown? Ask them why the lamps flicker.'],
      ['', 'Above you the brick turns to black, wet stone. Somewhere behind it, a lot of water is moving.']
    ] },
    { name: 'Cistern Gate', npcs: [{ who: 'Wren', x: 34, coat: '#3f6f86', skin: '#c99672', hat: 'hood', hatCol: '#2b4f60', prop: 'staff', robe: true }], lines: [
      ['', 'A round door in the stone, beaded with water. Behind it: tanks, each one as wide as a street.'],
      ['Wren', "A climber? From below? Nobody comes through the Cisterns. I'm Wren. I keep the sluices."],
      ['Wren', "The levers flip the sluices. Blue or amber. When the blue ones run, the blue holds take your weight. Pull a lever, and the other colour does."],
      ['Wren', "Watch which colour leads up before you pull. The walls in here like to trick you."]
    ] },
    { name: 'Pump Gallery', npcs: [{ who: 'Wren', x: 34, coat: '#3f6f86', skin: '#c99672', hat: 'hood', hatCol: '#2b4f60', prop: 'staff', robe: true }], lines: [
      ['', 'You look down into the first tank. It is full to the brim.'],
      ['Wren', "Full? Of course it's full. They're all full. The rains up top never stopped."],
      ['Wren', "The sluices to the Roots open on Crown order. The order hasn't come. Not in my time, not in my mother's."]
    ] },
    { name: 'The Overflow', npcs: [{ who: 'Drain-boy', x: 30, coat: '#5a7a8a', hair: '#2a2a2a', prop: 'basket', scale: 0.75 }], lines: [
      ['Drain-boy', "When the tanks spill over, it goes out the side of the tower. Into the clouds. Pretty, from out here."],
      ['', 'You think of the drip-lines on Sedge\'s farm. Then you try not to.']
    ] },
    { name: 'Dry Valve', npcs: [{ who: 'Wren', x: 34, coat: '#3f6f86', skin: '#c99672', hat: 'hood', hatCol: '#2b4f60', prop: 'staff', robe: true }], lines: [
      ['', 'One great valve, painted with the Crown sign, chained shut. The chain is newer than the valve.'],
      ['Wren', "I could cut it. I've thought about it every night for twenty years. Then the Works would come for me, and the Crown's order would still say no."],
      ['Wren', "Go up. If there's anyone up there, ask them why. If you get an answer, shout it down the pipes. I'll be listening."],
      ['', 'Above you the stone turns to iron. The air starts to taste of smoke.']
    ] },
    { name: 'Works Gate', npcs: [{ who: 'Warden Ost', x: 34, coat: '#6b4a3a', skin: '#c99672', hat: 'helmet', hatCol: '#c9a23a', prop: 'pike' }, { who: 'Tallow', x: 100, coat: '#c9772f', hat: 'cap', hatCol: '#3a3a3a', prop: 'rope' }], unlock: 'grapple', lines: [
      ['Warden Ost', 'Halt. Roots traffic ends here. Crown order.'],
      ['', 'A family is camped against the gate. Their water ran out two days ago. You have one full skin for the climb.']
    ], choice: { id: 'water', options: [
      { label: 'Share your water', flag: 'kind', after: [
        ['', 'The youngest drinks first. The warden watches, then looks at the wall instead of at you.'],
        ['Warden Ost', "...Go on, then. I didn't see you."] ] },
      { label: 'Keep it for the climb', flag: 'kept', after: [
        ['', 'You will need every drop. You wait for the shift change and slip past the gate. (+10 grip)'] ] }
    ] }, outro: [
      ['Tallow', "Courier! Up here. Name's Tallow, I rig the lines. You climb like you mean it."],
      ['Tallow', "Take my spare line. Tap one of the rings and it hauls you in, if you're close enough. If you aren't, jump first."]
    ] },
    { name: 'Slag Shelf', npcs: [{ who: 'Furnace-hand', x: 32, coat: '#7a3f2c', skin: '#d9a67c', hat: 'helmet', hatCol: '#8d9499', prop: 'staff' }], lines: [
      ['Furnace-hand', "Water comes down from the Gardens. We cool the furnaces with it, and what's left goes to the Roots. That's the ration. Crown order."],
      ['Furnace-hand', "No, I've never seen the order. The Quartermaster has."]
    ] },
    { name: "Tallow's Rig", npcs: [{ who: 'Tallow', x: 32, coat: '#c9772f', hat: 'cap', hatCol: '#3a3a3a', prop: 'rope' }], lines: [
      ['Tallow', 'Steam is getting worse. The vents fire whenever they like now. Nobody has sent a repair order in years.'],
      ['Tallow', "If you make it to the top, ask whoever's up there whether they still remember we exist."]
    ] },
    { name: 'The Ration Hall', npcs: [{ who: 'Quartermaster Marrow', x: 34, coat: '#4a4f6a', hat: 'bun', hair: '#c4c4c4', prop: 'ledger', robe: true }], lines: [
      ['Quartermaster Marrow', "So you're the one climbing my walls."],
      ['Quartermaster Marrow', 'The Crown sets the ration. I only keep the ledger. Here: a sealed copy. Carry it up to the Gardens for me and the guild will owe you.'],
      ['', "Behind her is the ration valve. One turn would send the Works' share down to the Roots."]
    ], choice: { id: 'ration', options: [
      { label: 'Carry the ledger', flag: 'ledger', after: [
        ['Quartermaster Marrow', 'Sensible. Take a spare piton from the stores. The guild pays its debts.'],
        ['', '(+1 piton)'] ] },
      { label: 'Turn the valve', flag: 'valve', after: [
        ['', 'The wheel shrieks. Far below, pipes that have been dry for a month begin to knock.'],
        ['', 'Then the alarm starts. You climb fast.'] ] }
    ] } },
    { name: 'Garden Stair', npcs: [{ who: 'Pim', x: 30, coat: '#6fae5a', hair: '#c9772f', prop: 'kite', scale: 0.85 }], unlock: 'glider', lines: [
      ['', 'The smoke ends as if cut with a knife. White stone. Clean air. Leaves.'],
      ['Pim', 'You came up the outside? Nobody comes up the outside.'],
      ['Pim', "The wind is strange here. In places it rises along the wall. I made this out of seed-silk. Hold on to it in the air and it'll carry you."],
      ['Pim', "Don't tell the Curator. We're not supposed to help anyone from below. Crown order."]
    ] },
    { name: 'Ivy Terrace', npcs: [{ who: 'Keeper', x: 32, coat: '#e9e3d2', skin: '#c99672', hat: 'brim', hatCol: '#c9b98a', prop: 'basket', robe: true }], lines: [
      ['Keeper', 'Water? We have plenty. It rains up here, inside the walls. The Crown provides.'],
      ['Keeper', "Below? I'm told they have what they need. The Curator reads us the Crown's letters every season."]
    ] },
    { name: 'The Glasshouse', npcs: [{ who: 'Pim', x: 30, coat: '#6fae5a', hair: '#c9772f', prop: 'kite', scale: 0.85 }], lines: [
      ['Pim', 'I found something in the old conservatory. Crown letters. Hundreds of them. Blank, and already sealed.'],
      ['Pim', "Why would anyone seal a letter before it's written?"]
    ] },
    { name: "Curator's Balcony", npcs: [{ who: 'Curator Vane', x: 34, coat: '#7a2f4a', hat: 'tall', hatCol: '#d9b85a', prop: 'ledger', robe: true }], lines: [
      ['Curator Vane', 'A courier from the Roots. How determined.'],
      ['Curator Vane', 'The Crown is not to be disturbed. But I am not unkind. Leave your petition with me, and take this seal. It opens doors. A comfortable post is yours when you come back down.']
    ], choice: { id: 'seal', options: [
      { label: 'Take the seal', flag: 'seal', after: [
        ['', 'It is heavy, and very clean. The Curator presses a purse of chalk into your other hand. (+25 chalk)'],
        ['', 'You keep the petition anyway. He pretends not to notice.'] ] },
      { label: 'Keep your petition', flag: 'refused', after: [
        ['Curator Vane', "Then climb. You won't like what you find."] ] }
    ] } },
    { name: 'Archive Door', npcs: [{ who: 'Quill', x: 34, coat: '#5a3f6a', hair: '#d8d8d8', prop: 'ledger', robe: true }], lines: [
      ['', 'Above the Gardens, the walls turn to shelves. Millions of papers, and the smell of ink.'],
      ['Quill', "Careful, careful. Mind the levers: they swing the stacks. Blue or amber, same as the sluices below. The Curator's engineers built both."],
      ['Quill', "I am Quill, chief copyist. Forty years in the Crown's own hand."]
    ] },
    { name: 'The Copying Room', npcs: [{ who: 'Quill', x: 34, coat: '#5a3f6a', hair: '#d8d8d8', prop: 'ledger', robe: true }], lines: [
      ['', 'Rows of desks. At each one, a scribe copies a letter onto Crown paper, then presses the Crown seal into the wax.'],
      ['Quill', "The drafts come down from above. We only make them fair. Lovely hand, the Crown has. Never changes."],
      ['', 'You ask him if he has ever seen a draft arrive.'],
      ['Quill', "...The Curator brings them. Every season. Why would I need to see them arrive?"]
    ] },
    { name: 'Seal Vault', npcs: [{ who: 'Vault-keeper', x: 32, coat: '#3a3a4a', skin: '#c99672', hat: 'cap', hatCol: '#202030', prop: 'pike' }], lines: [
      ['', 'A vault of seals behind glass. Every Crown seal ever cut. Several are new.'],
      ['Vault-keeper', "The old ones wore out. The Curator has them recut. Same design. You'd never know."]
    ] },
    { name: 'Reading Gallery', npcs: [{ who: 'Quill', x: 34, coat: '#5a3f6a', hair: '#d8d8d8', prop: 'ledger', robe: true }], lines: [
      ['Quill', "I copied a letter once that said the Roots had all the water they needed. The same week, a boy from the Roots died of thirst at the Works gate."],
      ['Quill', "I told myself the Crown knew something I didn't. Forty years. Go on up, courier. Find out what it knows."],
      ['', 'Above the last shelf, the walls turn to bare steel.']
    ] },
    { name: 'Crown Lock', unlock: 'gloves', lines: [
      ['', 'The door to the Crown is steel, six metres thick, and has no handle. Beside it hangs a maintenance locker, rusted open.'],
      ['', 'Inside: a pair of magnet gloves, the grips worn smooth. Nobody has used them in a very long time.'],
      ['', 'The walls above are bare plate. You will have to stick to them.']
    ] },
    { name: 'The Quiet Stair', lines: [
      ['', 'No guards. No servants. Dust on every step.'],
      ['', "A speaker crackles. 'Ration schedule unchanged. Carry on.' The voice is a recording."]
    ] },
    { name: 'Signal Deck', lines: [
      ['', 'Rows of message tubes, the kind that carry orders down the tower. Every one of them runs down to one desk in the Archive, the one where Quill sits. None of them runs up.'],
      ['', "The Crown's letters were never sent from the Crown."]
    ] },
    { name: 'Last Light', lines: [
      ['', 'The air is thin. Below you, {km} kilometres of lamps: the Archive, the Gardens, the Works, the Cisterns, the Roots, all still waiting for word.'],
      ['', 'One more wall.']
    ] },
    { name: 'The Crown Chamber', lines: [
      ['', 'The Crown chamber is empty. Chairs pushed back. A meal left on a table, long since gone to dust.'],
      ['', "A logbook lies open. The last entry reads: 'Supplies exhausted at this altitude. We descend to the Gardens tonight. The valves will run themselves.' It is dated ninety years ago."],
      ['', "The Crown's people came down, became the Curators, and kept ruling in the name of an empty room."],
      ['', "In the middle of the chamber stand the tower's horn, wired to every floor, and the master valves."]
    ] }
  ];

  var hints = {
    start_swipe: 'Drag in the direction you want to leap, then let go.',
    start_sling: 'Pull back like a billiards cue, then let go. The dotted arc shows your leap.',
    grip: 'Hanging drains your grip (the ring around you). Ledges restore it.',
    shard: 'Chalk. Spend it at camps.',
    crumble: "Cracked holds crumble. Don't linger.",
    moving: 'Piston holds slide. The dotted arc shows where you will be, not where the hold will be.',
    vent: 'Steam knocks you off the wall. Watch the rhythm, then go.',
    anchor: "Tap a ring to grapple to it. Out of reach? Leap, then tap mid-air.",
    slick: 'Wet holds drain your grip much faster.',
    wind: 'Wind bends your leap. The dotted arc already accounts for it.',
    draft: 'Hold a finger down mid-air to glide, and slide it left or right to steer. Updrafts lift you.',
    plate: 'Magnet gloves catch a steel plate at the top of your leap. Hop upward.',
    eplate: 'A flickering plate is about to go live. Be off it in time.',
    spring: 'Bounce caps throw you straight up. Land on one and ride it to the hold above.',
    tube: 'Drop into a green funnel and the tube fires you out of its far end.',
    lift: 'Hooks ride up and down their rail and wait a moment at each end. Catch one, then leap off at the top.',
    phase: 'These holds come and go. A flicker means one is about to vanish.',
    drip: 'Slag drips on a rhythm. Leap through the gap between drops.',
    bird: 'Wall-swifts fly a fixed beat and will knock you off. Let one pass, then go.',
    drone: 'Patrol drones ride a rail. Touching one costs you grip and your hold.',
    switch: 'A sluice lever. Grabbing it flips which colour of hold is solid, blue or amber.',
    gate: 'Faded holds only take your weight while their colour runs. Find the lever.',
    biv: 'A bivouac. Your climb is saved here too.',
    piton: 'Tap the piton button on a hold to set a checkpoint there.',
    camp: 'Camp reached. Your climb is saved here.'
  };

  // Hand-built set pieces, one per district.
  var sets = {
    dark: { name: 'The Blackout', hint: 'The lamps are out. Fungus marks the holds, and the dotted arc still shows your leap.' },
    slag: { name: 'The Furnace Shaft', hint: 'Once you leave this ledge the shaft floods with slag. Keep climbing.' },
    sluice: { name: 'The Sluice Gates', hint: 'Two ladders, blue and amber, and only one is solid at a time. Pull each lever when the other colour leads up.' },
    stacks: { name: 'The Stacks', hint: 'Ride a shelf up, pull the lever at the top, then take the colour that is now solid.' },
    storm: { name: 'The Thermal Ladder', hint: 'Ride each updraft to its top, then glide across to the next. There is nowhere to land in between.' },
    alt: { name: 'The Alternator', hint: 'Left and right plates take turns going live. Cross when the next one goes dark.' }
  };

  var upgrades = [
    { id: 'lungs', name: 'Deep Lungs', desc: '+20 grip', costs: [15, 30, 50, 80] },
    { id: 'legs', name: 'Spring Legs', desc: '+5% leap power', costs: [20, 40, 60, 90] },
    { id: 'hands', name: 'Steady Hands', desc: 'Grip drains 15% slower', costs: [15, 30, 50, 80] },
    { id: 'sling', name: 'Piton Sling', desc: '+1 piton per camp', costs: [25, 50, 80] }
  ];

  var endings = {
    horn: { name: 'The Horn', label: 'Sound the horn. Tell everyone the truth.' },
    voice: { name: 'The Voice', label: 'Speak as the Crown. Rule well.' },
    door: { name: 'The Open Door', label: 'Open the valves. Leave the room unlocked.' }
  };

  function epilogue(id, f) {
    var out = [];
    if (id === 'horn') {
      out.push("Your voice falls the whole height of the tower. 'The Crown is empty. It has been empty for ninety years.'");
      out.push(f.seal ? "The Curator's seal is still in your pocket. You drop it off the edge and do not hear it land."
                      : 'In the Gardens, the Curator closes his shutters. It does not help. The horn is wired to every floor.');
      out.push(f.valve ? 'In the Works they remember who turned the valve. Riggers are already on the wall, climbing to meet you.'
                       : 'In the Works, Marrow opens the ledgers that night and reads them aloud herself.');
      out.push('In the Archive, Quill puts down his pen for the first time in forty years.');
      out.push("In the Cisterns, Wren cuts the chain on the great valve. She doesn't wait for an order.");
      out.push(f.kind ? 'At the Works gate, a family that once shared your water starts up the stair.'
                      : "In the Roots, Sedge's drip-lines run. Nobody is quite sure whom to thank.");
      out.push('No one knows what the tower will be without a Crown. For the first time in ninety years, it gets to find out.');
    } else if (id === 'voice') {
      out.push("'This is the Crown,' you say, and every floor goes silent to listen.");
      out.push('You order the sluices opened and the ration doubled for the Roots. You order the vents repaired. They obey. They always have.');
      out.push('Down in the Archive, Quill copies your orders in the same lovely hand. He never asks why it has changed.');
      out.push(f.seal ? 'The Curator hears a new voice use the old seal and understands at once. He says nothing. Neither do you.'
                      : 'The Curator knows the voice is not his. One day he will come up the stair. You keep the gloves close.');
      out.push(f.kind ? 'You send water to the family at the gate first. It is the only order you sign with your own name, and you burn the copy.'
                      : 'You tell yourself the orders are good ones. Most of them are.');
      out.push('The tower is better run than it has been in a lifetime. It is still run from an empty room. Now you are the one in it.');
    } else {
      out.push('You do not speak at all. You open every valve, unbar the stair, and wedge the great door with the logbook.');
      out.push('In the Cisterns the sluices swing open all at once. Water reaches the Roots by morning.');
      out.push("By evening the first climbers arrive: riggers from the Works, a gardener's apprentice with a seed-silk wing, a family from the gate.");
      out.push('They read the logbook themselves. Nobody needs to be told.');
      out.push('The Crown is a room again. People come and go.');
    }
    return out;
  }

  // Perks offered at every second camp of the endless climb. max is how many times one can be taken.
  var perks = [
    { id: 'hop', name: 'Air hop', desc: 'Tap mid-air to kick upward, once per leap', max: 2 },
    { id: 'line', name: 'Long line', desc: 'The grapple reaches 35% further', max: 2 },
    { id: 'grip', name: 'Iron grip', desc: 'Grip drains 25% slower', max: 3 },
    { id: 'lungs', name: 'Deep lungs', desc: '+30 grip', max: 3 },
    { id: 'legs', name: 'Spring legs', desc: '+7% leap power', max: 3 },
    { id: 'rope', name: 'Spare rope', desc: 'One more rope, right now', max: 99 },
    { id: 'cool', name: 'Cool head', desc: 'Slag rises 30% slower', max: 2 },
    { id: 'feather', name: 'Featherfall', desc: 'You survive falls half as long again', max: 2 },
    { id: 'kite', name: 'Light silk', desc: 'Gliding costs half the grip', max: 2 },
    { id: 'rubber', name: 'Rubber soles', desc: 'Live plates and drones cannot shock you', max: 1 },
    { id: 'calm', name: 'Steady nerves', desc: 'Cracked holds last 60% longer', max: 1 }
  ];

  // Things the camp tailor sells for chalk. They change how you look, never how you climb.
  var looks = {
    scarf: [
      { id: 'red', name: 'Courier red', col: '#e5484d', cost: 0 }, { id: 'teal', name: 'Fungus teal', col: '#3fd0b0', cost: 10 },
      { id: 'gold', name: 'Guild gold', col: '#f2c94c', cost: 15 }, { id: 'violet', name: 'Curator violet', col: '#a779e0', cost: 15 },
      { id: 'rose', name: 'Bloom rose', col: '#f07aa5', cost: 20 }, { id: 'white', name: 'Chalk white', col: '#f3efe4', cost: 20 },
      { id: 'ink', name: 'Crown ink', col: '#4a5fa8', cost: 20 }
    ],
    wing: [
      { id: 'silk', name: 'Seed silk', col: '#f4ecd2', rib: 'rgba(120,100,60,.7)', cost: 0 },
      { id: 'leaf', name: 'Leaf', col: '#8fd07a', rib: 'rgba(40,80,40,.8)', cost: 30 },
      { id: 'dusk', name: 'Dusk', col: '#f0935a', rib: 'rgba(110,40,20,.8)', cost: 30 },
      { id: 'night', name: 'Night', col: '#2b3560', rib: 'rgba(201,165,74,.9)', cost: 40 }
    ],
    trail: [
      { id: 'none', name: 'None', col: 'transparent', cost: 0 }, { id: 'sparks', name: 'Sparks', col: '#ffe08a', cost: 40 },
      { id: 'petals', name: 'Petals', col: '#f3b6c6', cost: 40 }, { id: 'embers', name: 'Embers', col: '#ff8a3c', cost: 40 },
      { id: 'frost', name: 'Frost', col: '#bfeaff', cost: 50 }
    ]
  };

  // Modifiers for challenge climbs, which open once the story has an ending.
  var challenges = [
    { id: 'nopiton', name: 'No pitons', desc: 'Camps and bivouacs are your only checkpoints' },
    { id: 'dark', name: 'Lights out', desc: 'The whole tower is as dark as the Blackout' },
    { id: 'thin', name: 'Thin air', desc: 'Grip drains a third faster' }
  ];

  S.Story = { camps: camps, hints: hints, sets: sets, upgrades: upgrades, endings: endings, epilogue: epilogue,
              perks: perks, looks: looks, challenges: challenges };
  if (typeof module !== 'undefined' && module.exports) module.exports = S;
})(typeof window !== 'undefined' ? window : globalThis);
