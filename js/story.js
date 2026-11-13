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
      ['', 'Above you the brick gives way to iron. The air starts to taste of smoke.']
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
      ['', 'Rows of message tubes, the kind that carry orders down the tower. Every one of them runs to a single desk in the Gardens. None of them runs up.'],
      ['', "The Crown's letters were never sent from the Crown."]
    ] },
    { name: 'Last Light', lines: [
      ['', 'The air is thin. Below you, {km} kilometres of lamps: the Gardens, the Works, the Roots, all still waiting for word.'],
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
    biv: 'A bivouac. Your climb is saved here too.',
    piton: 'Tap the piton button on a hold to set a checkpoint there.',
    camp: 'Camp reached. Your climb is saved here.'
  };

  // Hand-built set pieces, one per district.
  var sets = {
    dark: { name: 'The Blackout', hint: 'The lamps are out. Fungus marks the holds, and the dotted arc still shows your leap.' },
    slag: { name: 'The Furnace Shaft', hint: 'Once you leave this ledge the shaft floods with slag. Keep climbing.' },
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
      out.push(f.kind ? 'At the Works gate, a family that once shared your water starts up the stair.'
                      : "In the Roots, Sedge's drip-lines run. Nobody is quite sure whom to thank.");
      out.push('No one knows what the tower will be without a Crown. For the first time in ninety years, it gets to find out.');
    } else if (id === 'voice') {
      out.push("'This is the Crown,' you say, and every floor goes silent to listen.");
      out.push('You order the ration doubled for the Roots. You order the vents repaired. They obey. They always have.');
      out.push(f.seal ? 'The Curator hears a new voice use the old seal and understands at once. He says nothing. Neither do you.'
                      : 'The Curator knows the voice is not his. One day he will come up the stair. You keep the gloves close.');
      out.push(f.kind ? 'You send water to the family at the gate first. It is the only order you sign with your own name, and you burn the copy.'
                      : 'You tell yourself the orders are good ones. Most of them are.');
      out.push('The tower is better run than it has been in a lifetime. It is still run from an empty room. Now you are the one in it.');
    } else {
      out.push('You do not speak at all. You open every valve, unbar the stair, and wedge the great door with the logbook.');
      out.push('Water reaches the Roots by morning.');
      out.push("By evening the first climbers arrive: riggers from the Works, a gardener's apprentice with a seed-silk wing, a family from the gate.");
      out.push('They read the logbook themselves. Nobody needs to be told.');
      out.push('The Crown is a room again. People come and go.');
    }
    return out;
  }

  S.Story = { camps: camps, hints: hints, sets: sets, upgrades: upgrades, endings: endings, epilogue: epilogue };
  if (typeof module !== 'undefined' && module.exports) module.exports = S;
})(typeof window !== 'undefined' ? window : globalThis);
