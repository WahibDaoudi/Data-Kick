// Star players drawn for each club. Edit freely: rosters change every transfer window.
// skin: index in SKINS (0 darkest -> 6 lightest), hair: key of HAIR, hairColor: key of HAIR_COLORS.

const STARS = {
  'Paris SG': [
    { name: 'DEMBELE', skin: 1, hair: 'short', hairColor: 'black' },
    { name: 'DOUE', skin: 1, hair: 'short', hairColor: 'black' },
    { name: 'HAKIMI', skin: 3, hair: 'buzz', hairColor: 'black', beard: true },
    { name: 'VITINHA', skin: 4, hair: 'short', hairColor: 'darkbrown', beard: true },
    { name: 'KVARA', skin: 5, hair: 'long', hairColor: 'darkbrown' },
  ],
  'Marseille': [
    { name: 'GREENWOOD', skin: 2, hair: 'short', hairColor: 'black', beard: true },
    { name: 'HOJBJERG', skin: 6, hair: 'buzz', hairColor: 'brown', beard: true },
  ],
  'Monaco': [
    { name: 'GOLOVIN', skin: 6, hair: 'short', hairColor: 'brown' },
    { name: 'MINAMINO', skin: 5, hair: 'short', hairColor: 'black' },
  ],
  'Lyon': [
    { name: 'TOLISSO', skin: 2, hair: 'buzz', hairColor: 'black', beard: true },
    { name: 'MIKAUTADZE', skin: 5, hair: 'short', hairColor: 'black' },
  ],
  'Lille': [
    { name: 'GIROUD', skin: 6, hair: 'short', hairColor: 'brown', beard: true },
    { name: 'HARALDSSON', skin: 6, hair: 'short', hairColor: 'blond' },
  ],
  'Lens': [{ name: 'THAUVIN', skin: 5, hair: 'short', hairColor: 'darkbrown', beard: true }],
  'Nice': [{ name: 'MOFFI', skin: 0, hair: 'short', hairColor: 'black' }],
  'Rennes': [
    { name: 'KALIMUENDO', skin: 1, hair: 'short', hairColor: 'black' },
    { name: 'LEPAUL', skin: 5, hair: 'buzz', hairColor: 'brown' },
  ],
  'Strasbourg': [{ name: 'PANICHELLI', skin: 5, hair: 'long', hairColor: 'darkbrown' }],
  'Brest': [{ name: 'AJORQUE', skin: 6, hair: 'short', hairColor: 'brown', beard: true }],
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

// A random star of the club, or a random look when the club has none
function pickPlayer(teamName) {
  const stars = STARS[teamName];
  if (!stars) return { star: null, look: randomLook() };
  const { name, ...look } = pick(stars);
  return { star: name, look };
}
