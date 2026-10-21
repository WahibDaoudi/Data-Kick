// Player looks drawn for each club (no names). Edit freely.
// skin: index in SKINS (0 darkest -> 6 lightest), hair: key of HAIR, hairColor: key of HAIR_COLORS.

const CLUB_LOOKS = {
  'Paris SG': [
    { skin: 1, hair: 'short', hairColor: 'black' },
    { skin: 1, hair: 'short', hairColor: 'black' },
    { skin: 3, hair: 'buzz', hairColor: 'black', beard: true },
    { skin: 4, hair: 'short', hairColor: 'darkbrown', beard: true },
    { skin: 5, hair: 'long', hairColor: 'darkbrown' },
  ],
  'Marseille': [
    { skin: 2, hair: 'short', hairColor: 'black', beard: true },
    { skin: 6, hair: 'buzz', hairColor: 'brown', beard: true },
  ],
  'Monaco': [
    { skin: 6, hair: 'short', hairColor: 'brown' },
    { skin: 5, hair: 'short', hairColor: 'black' },
  ],
  'Lyon': [
    { skin: 2, hair: 'buzz', hairColor: 'black', beard: true },
    { skin: 5, hair: 'short', hairColor: 'black' },
  ],
  'Lille': [
    { skin: 6, hair: 'short', hairColor: 'brown', beard: true },
    { skin: 6, hair: 'short', hairColor: 'blond' },
  ],
  'Lens': [{ skin: 5, hair: 'short', hairColor: 'darkbrown', beard: true }],
  'Nice': [{ skin: 0, hair: 'short', hairColor: 'black' }],
  'Rennes': [
    { skin: 1, hair: 'short', hairColor: 'black' },
    { skin: 5, hair: 'buzz', hairColor: 'brown' },
  ],
  'Strasbourg': [{ skin: 5, hair: 'long', hairColor: 'darkbrown' }],
  'Brest': [{ skin: 6, hair: 'short', hairColor: 'brown', beard: true }],

  // Champions League clubs
  'Real Madrid': [
    { skin: 1, hair: 'short', hairColor: 'black' },
    { skin: 2, hair: 'short', hairColor: 'black' },
    { skin: 3, hair: 'buzz', hairColor: 'black' },
  ],
  'Man City': [
    { skin: 6, hair: 'long', hairColor: 'blond' },
    { skin: 6, hair: 'short', hairColor: 'brown' },
  ],
  'Liverpool': [
    { skin: 6, hair: 'short', hairColor: 'brown' },
  ],
  'Arsenal': [
    { skin: 1, hair: 'short', hairColor: 'black' },
    { skin: 6, hair: 'short', hairColor: 'brown' },
    { skin: 6, hair: 'short', hairColor: 'brown' },
  ],
  'Barcelona': [
    { skin: 3, hair: 'short', hairColor: 'black' },
    { skin: 3, hair: 'short', hairColor: 'black', beard: true },
    { skin: 5, hair: 'short', hairColor: 'black' },
  ],
  'Bayern Munich': [
    { skin: 6, hair: 'short', hairColor: 'brown' },
    { skin: 2, hair: 'short', hairColor: 'black' },
  ],
  'Inter': [{ skin: 5, hair: 'short', hairColor: 'darkbrown', beard: true }],
  'Ath Madrid': [{ skin: 5, hair: 'short', hairColor: 'darkbrown' }],
  'Dortmund': [{ skin: 1, hair: 'buzz', hairColor: 'black', beard: true }],
  'Napoli': [
    { skin: 6, hair: 'short', hairColor: 'ginger' },
    { skin: 0, hair: 'buzz', hairColor: 'black', beard: true },
  ],
  'Galatasaray': [{ skin: 0, hair: 'short', hairColor: 'platinum' }],
  'Sp Lisbon': [{ skin: 4, hair: 'short', hairColor: 'black' }],
  'Aston Villa': [{ skin: 2, hair: 'buzz', hairColor: 'black', beard: true }],
  'Man United': [{ skin: 5, hair: 'short', hairColor: 'darkbrown' }],
  'Roma': [{ skin: 5, hair: 'short', hairColor: 'darkbrown', beard: true }],
};

const pick = (list) => list[Math.floor(Math.random() * list.length)];

function randomLook() {
  return {
    skin: Math.floor(Math.random() * SKINS.length),
    hair: pick(Object.keys(HAIR)),
    hairColor: pick(['black', 'black', 'darkbrown', 'brown', 'blond', 'platinum', 'ginger']),
    beard: Math.random() < 0.3,
  };
}

// A random look of the club, or a fully random one when the club has none
function pickPlayer(teamName) {
  const looks = CLUB_LOOKS[teamName];
  return { look: looks ? { ...pick(looks) } : randomLook() };
}
