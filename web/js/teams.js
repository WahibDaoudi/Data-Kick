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
};

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

// Upcoming matches with model probabilities: [{ kickoff, round, home, away, probs, error }]
async function loadFixtures() {
  const { fixtures } = await fetchJson('/api/fixtures');
  return fixtures;
}
