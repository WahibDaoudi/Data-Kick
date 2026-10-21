// Competitions of the title selector. code = API code, theme = CSS / scenery / logo theme, track = music.
// rivals: clubs the title pitch opponent is drawn from. ticker: start of the bottom banner.

// Before any choice: arcade look, no fixtures
const NEUTRAL = {
  code: null,
  name: 'CHOISIS UNE COMPETITION',
  theme: 'neutral',
  track: 'neutral',
  rivals: [],
  ticker: '< > CHOISIS UNE COMPETITION POUR VOIR LES PRONOS DE LA SEMAINE',
};

const LEAGUES = [
  {
    code: 'F1',
    name: 'LIGUE 1',
    theme: 'l1',
    track: 'l1',
    ticker: 'LIGUE 1 - LES PRONOS DE LA SEMAINE',
    rivals: ['Paris SG', 'Marseille', 'Monaco', 'Lyon', 'Lille', 'Lens', 'Nice', 'Rennes', 'Strasbourg', 'Brest'],
  },
  {
    code: 'E0',
    name: 'PREMIER LEAGUE',
    theme: 'pl',
    track: 'pl',
    ticker: 'PREMIER LEAGUE - LES PRONOS DE LA SEMAINE',
    rivals: ['Arsenal', 'Liverpool', 'Man City', 'Man United', 'Aston Villa'],
  },
  {
    code: 'UCL',
    name: 'LIGUE DES CHAMPIONS',
    theme: 'ucl',
    track: 'ucl',
    ticker: 'LIGUE DES CHAMPIONS - LES PRONOS DE LA SEMAINE',
    rivals: ['Real Madrid', 'Man City', 'Liverpool', 'Arsenal', 'Barcelona', 'Bayern Munich', 'Inter', 'Napoli', 'Galatasaray', 'Paris SG'],
  },
];
