// Team kits keyed by the names of the `teams` table in PostgreSQL.
// P shirt body, Q sleeves/shorts, A trim, N shirt details, K socks.

const KITS = {
  'Angers': { P: '#f4f4f4', Q: '#111111', A: '#8a8a8a', N: '#111111', K: '#111111' },
  'Auxerre': { P: '#f4f4f4', Q: '#1b4fa0', A: '#6fb0e0', N: '#1b4fa0', K: '#f4f4f4' },
  'Brest': { P: '#e2001a', Q: '#f4f4f4', A: '#9e0012', N: '#f4f4f4', K: '#e2001a' },
  'Le Havre': { P: '#6bb7e8', Q: '#0b2a5b', A: '#f4f4f4', N: '#0b2a5b', K: '#6bb7e8' },
  'Lens': { P: '#ffd400', Q: '#e3051b', A: '#111111', N: '#e3051b', K: '#ffd400' },
  'Lille': { P: '#d0102a', Q: '#1a2a5a', A: '#f4f4f4', N: '#f4f4f4', K: '#d0102a' },
  'Lorient': { P: '#f37021', Q: '#111111', A: '#f4f4f4', N: '#111111', K: '#f37021' },
  'Lyon': { P: '#f4f4f4', Q: '#1c3f94', A: '#da0a1e', N: '#da0a1e', K: '#f4f4f4' },
  'Marseille': { P: '#f4f4f4', Q: '#2fa8e0', A: '#10255a', N: '#2fa8e0', K: '#f4f4f4' },
  'Metz': { P: '#8a0c2e', Q: '#5a0a1e', A: '#f4f4f4', N: '#f4f4f4', K: '#8a0c2e' },
  'Monaco': { P: '#d4131b', Q: '#f4f4f4', A: '#d4131b', N: '#f4f4f4', K: '#f4f4f4' },
  'Nantes': { P: '#ffe100', Q: '#00873e', A: '#f4f4f4', N: '#00873e', K: '#ffe100' },
  'Nice': { P: '#111111', Q: '#d6001c', A: '#f4f4f4', N: '#d6001c', K: '#111111' },
  'Paris FC': { P: '#13284b', Q: '#7ec8ee', A: '#f4f4f4', N: '#7ec8ee', K: '#13284b' },
  'Paris SG': { P: '#1b2a6b', Q: '#0e1640', A: '#da1f26', N: '#f4f4f4', K: '#1b2a6b' },
  'Rennes': { P: '#e2001a', Q: '#111111', A: '#f4f4f4', N: '#111111', K: '#111111' },
  'Strasbourg': { P: '#1d5fbf', Q: '#f4f4f4', A: '#0d2b6b', N: '#f4f4f4', K: '#1d5fbf' },
  'Toulouse': { P: '#5b2b82', Q: '#f4f4f4', A: '#9a6bc2', N: '#f4f4f4', K: '#5b2b82' },
  'Le Mans': { P: '#d6001c', Q: '#1d3a8a', A: '#ffd400', N: '#ffd400', K: '#d6001c' },
  'Troyes': { P: '#1d4c9a', Q: '#f4f4f4', A: '#0d2b6b', N: '#f4f4f4', K: '#1d4c9a' },
  'Montpellier': { P: '#13284b', Q: '#f37021', A: '#f4f4f4', N: '#f37021', K: '#13284b' },
  'Reims': { P: '#e2001a', Q: '#f4f4f4', A: '#111111', N: '#f4f4f4', K: '#f4f4f4' },
  'St Etienne': { P: '#00843d', Q: '#f4f4f4', A: '#005f2b', N: '#f4f4f4', K: '#00843d' },

  // Champions League clubs
  'AEK': { P: '#ffd400', Q: '#111111', A: '#111111', N: '#111111', K: '#ffd400' },
  'Arsenal': { P: '#db0007', Q: '#f4f4f4', A: '#db0007', N: '#f4f4f4', K: '#f4f4f4' },
  'Aston Villa': { P: '#670e36', Q: '#95bfe5', A: '#95bfe5', N: '#95bfe5', K: '#95bfe5' },
  'Ath Madrid': { P: '#cb3524', Q: '#262f61', A: '#f4f4f4', N: '#f4f4f4', K: '#cb3524' },
  'Barcelona': { P: '#a50044', Q: '#004d98', A: '#edbb00', N: '#004d98', K: '#004d98' },
  'Bayern Munich': { P: '#dc052d', Q: '#9e0020', A: '#f4f4f4', N: '#f4f4f4', K: '#dc052d' },
  'Betis': { P: '#00954c', Q: '#f4f4f4', A: '#f4f4f4', N: '#f4f4f4', K: '#00954c' },
  'Bodø/Glimt': { P: '#ffe500', Q: '#111111', A: '#111111', N: '#111111', K: '#ffe500' },
  'Club Brugge': { P: '#0057a8', Q: '#111111', A: '#111111', N: '#111111', K: '#111111' },
  'Como': { P: '#1c4f9c', Q: '#f4f4f4', A: '#6fb0e0', N: '#f4f4f4', K: '#1c4f9c' },
  'Dortmund': { P: '#fde100', Q: '#111111', A: '#111111', N: '#111111', K: '#fde100' },
  'Fenerbahce': { P: '#ffed00', Q: '#002d72', A: '#002d72', N: '#002d72', K: '#ffed00' },
  'Feyenoord': { P: '#e3001b', Q: '#111111', A: '#f4f4f4', N: '#f4f4f4', K: '#111111' },
  'Galatasaray': { P: '#a90432', Q: '#fdb912', A: '#fdb912', N: '#fdb912', K: '#a90432' },
  'Inter': { P: '#0b4ea2', Q: '#111111', A: '#111111', N: '#111111', K: '#111111' },
  'LASK': { P: '#111111', Q: '#f4f4f4', A: '#f4f4f4', N: '#f4f4f4', K: '#111111' },
  'Liverpool': { P: '#c8102e', Q: '#9e0b22', A: '#f4f4f4', N: '#f4f4f4', K: '#c8102e' },
  'Man City': { P: '#6cabdd', Q: '#f4f4f4', A: '#1c2c5b', N: '#f4f4f4', K: '#6cabdd' },
  'Man United': { P: '#da291c', Q: '#f4f4f4', A: '#111111', N: '#f4f4f4', K: '#111111' },
  'Napoli': { P: '#12a0d7', Q: '#f4f4f4', A: '#003c82', N: '#f4f4f4', K: '#12a0d7' },
  'Porto': { P: '#003893', Q: '#f4f4f4', A: '#f4f4f4', N: '#f4f4f4', K: '#003893' },
  'PSV Eindhoven': { P: '#ed1c24', Q: '#111111', A: '#f4f4f4', N: '#f4f4f4', K: '#ed1c24' },
  'RB Leipzig': { P: '#f4f4f4', Q: '#dd0741', A: '#001f47', N: '#dd0741', K: '#f4f4f4' },
  'Real Madrid': { P: '#f4f4f4', Q: '#d9d9d9', A: '#febe10', N: '#00529f', K: '#f4f4f4' },
  'Roma': { P: '#8e1f2f', Q: '#f4f4f4', A: '#f0bc42', N: '#f0bc42', K: '#8e1f2f' },
  'S. Bratislava': { P: '#5da9e9', Q: '#f4f4f4', A: '#0d2b6b', N: '#f4f4f4', K: '#5da9e9' },
  'Sabah': { P: '#f37021', Q: '#111111', A: '#f4f4f4', N: '#111111', K: '#f37021' },
  'Shakhtar Donetsk': { P: '#f37021', Q: '#111111', A: '#111111', N: '#111111', K: '#f37021' },
  'Slavia Praha': { P: '#e30613', Q: '#f4f4f4', A: '#f4f4f4', N: '#f4f4f4', K: '#e30613' },
  'Sp Lisbon': { P: '#008057', Q: '#111111', A: '#f4f4f4', N: '#f4f4f4', K: '#008057' },
  'Stuttgart': { P: '#f4f4f4', Q: '#e32219', A: '#e32219', N: '#e32219', K: '#f4f4f4' },
  'Viking': { P: '#0050a0', Q: '#f4f4f4', A: '#f4f4f4', N: '#f4f4f4', K: '#0050a0' },
  'Villarreal': { P: '#ffe667', Q: '#005187', A: '#005187', N: '#005187', K: '#ffe667' },

  // Premier League clubs (the big ones are above)
  'Bournemouth': { P: '#da291c', Q: '#111111', A: '#111111', N: '#111111', K: '#111111' },
  'Brentford': { P: '#e30613', Q: '#111111', A: '#f4f4f4', N: '#f4f4f4', K: '#e30613' },
  'Brighton': { P: '#0057b8', Q: '#f4f4f4', A: '#f4f4f4', N: '#f4f4f4', K: '#f4f4f4' },
  'Chelsea': { P: '#034694', Q: '#022c5e', A: '#f4f4f4', N: '#f4f4f4', K: '#f4f4f4' },
  'Coventry': { P: '#59b8e8', Q: '#1c3f94', A: '#f4f4f4', N: '#f4f4f4', K: '#59b8e8' },
  'Crystal Palace': { P: '#1b458f', Q: '#c4122e', A: '#c4122e', N: '#c4122e', K: '#1b458f' },
  'Everton': { P: '#003399', Q: '#f4f4f4', A: '#f4f4f4', N: '#f4f4f4', K: '#f4f4f4' },
  'Fulham': { P: '#f4f4f4', Q: '#111111', A: '#cc0000', N: '#111111', K: '#f4f4f4' },
  'Hull': { P: '#f5a12d', Q: '#111111', A: '#111111', N: '#111111', K: '#f5a12d' },
  'Ipswich': { P: '#0044aa', Q: '#f4f4f4', A: '#f4f4f4', N: '#f4f4f4', K: '#0044aa' },
  'Leeds': { P: '#f4f4f4', Q: '#1d428a', A: '#ffcd00', N: '#1d428a', K: '#f4f4f4' },
  'Newcastle': { P: '#f4f4f4', Q: '#111111', A: '#111111', N: '#111111', K: '#111111' },
  "Nott'm Forest": { P: '#dd0000', Q: '#f4f4f4', A: '#f4f4f4', N: '#f4f4f4', K: '#dd0000' },
  'Sunderland': { P: '#eb172b', Q: '#111111', A: '#f4f4f4', N: '#f4f4f4', K: '#111111' },
  'Tottenham': { P: '#f4f4f4', Q: '#132257', A: '#132257', N: '#132257', K: '#f4f4f4' },
};

// Screen names when the database name is cryptic or has letters the pixel font lacks
const DISPLAY_NAMES = {
  'Ath Madrid': 'ATLETICO', 'Sp Lisbon': 'SPORTING', 'Man United': 'MAN UTD', 'PSV Eindhoven': 'PSV',
  'Bayern Munich': 'BAYERN', 'S. Bratislava': 'SLOVAN', 'Shakhtar Donetsk': 'SHAKHTAR',
  'Bodø/Glimt': 'BODO/GLIMT', 'Slavia Praha': 'SLAVIA', 'RB Leipzig': 'LEIPZIG', 'Club Brugge': 'BRUGES',
  "Nott'm Forest": 'FOREST', 'Crystal Palace': 'PALACE',
};

function displayName(name) {
  return DISPLAY_NAMES[name] || name.toUpperCase();
}

// Kit for teams missing above (e.g. newly promoted).
const DEFAULT_KIT = { P: '#f4f4f4', Q: '#5f574f', A: '#c2c3c7', N: '#5f574f', K: '#f4f4f4' };

function teamFor(name) {
  return { name, kit: KITS[name] || DEFAULT_KIT };
}

async function fetchJson(url) {
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

// Played matches of the current season with the prediction made for them, and the accuracy summary
async function loadResults(competition) {
  return fetchJson(`/api/results?competition=${competition}`);
}

// Upcoming matches of a competition with model probabilities: [{ kickoff, round, home, away, probs, error }]
async function loadFixtures(competition) {
  const data = await fetchJson(`/api/fixtures?competition=${competition}`);
  // A server started before the multi-competition update ignores the parameter
  if (data.competition !== competition) throw new Error('Server out of date');
  return data.fixtures;
}
