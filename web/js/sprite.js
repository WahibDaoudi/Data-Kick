// Player sprite: 24 x 36 grid transcribed from assets/mbappe.png (+1 empty row for the outline).
// Each char is a color role, resolved against a team palette at draw time.
//   H hair  S skin  E eyes  M mouth  T tear
//   P shirt body  Q sleeves/shorts  A trim  N shirt details  C collar
//   K socks  R boots  B/W ball  . transparent

const W = 24;
const H = 36;

// Body without arms (cols 5-7 and 16-18, rows 1-20 are filled by the mood).
const BASE = [
  '........................', // 1
  '........................', // 2
  '.........HHHH...........', // 3
  '........HHHHHH..........', // 4
  '.......HHSSSSHH.........', // 5
  '.......HSSSSSSH.........', // 6
  '.......SSESSESS.........', // 7
  '.......SSSSSSSS.........', // 8
  '........SSSSSS..........', // 9
  '.........SSSS...........', // 10
  '.......QQCSSCQQ.........', // 11
  '.......QQPCCPQQ.........', // 12
  '.......QPPPPPPQ.........', // 13
  '.......QNNPPPNQ.........', // 14
  '.......PNNPPPNP.........', // 15
  '.......PPPPPPPP.........', // 16
  '.......PPPPPPPP.........', // 17
  '.......PPPPPPPP.........', // 18
  '.......PPPPPPPP.........', // 19
  '.......PPPPQQQA.........', // 20
  '.......AQQQQQQQA........', // 21
  '.......AQQQQQQQQA.......', // 22
  '.......AQQ....QQA.......', // 23
  '.......AQQ.....SS.......', // 24
  '.......AQQ.....KK.......', // 25
  '........SS.....KK.......', // 26
  '........KK.....KK.......', // 27
  '........KK.....RRR......', // 28
  '........KK.....RRRR.....', // 29
  '.......RRR......BB......', // 30
  '......RRRR.....BBBB.....', // 31
  '..............BWBWWB....', // 32
  '..............BBBBWB....', // 33
  '...............BWBB.....', // 34
  '................BB......', // 35
  '........................', // 36
];

// Left arm, cols 5-7, keyed by row. The right arm is its mirror (cols 16-18).
const ARMS = {
  neutral: {
    11: '..A', 12: '.AQ', 13: 'AQQ', 14: 'AQ.', 15: 'AQ.', 16: 'AQ.',
    17: 'SS.', 18: 'SS.', 19: 'S..',
  },
  happy: {
    3: 'S..', 4: 'SS.', 5: 'SS.', 6: 'AQ.', 7: 'AQ.', 8: 'AQ.', 9: 'AQ.',
    10: '.AQ', 11: '.AQ', 12: '..Q',
  },
  sad: {
    12: '..A', 13: '.AQ', 14: '.AQ', 15: '.AQ', 16: '.AQ', 17: '.AQ',
    18: '.AQ', 19: '.SS', 20: '.S.',
  },
};

// Face overrides as [row, col, role].
const FACES = {
  neutral: [[9, 11, 'M'], [9, 12, 'M']],
  happy: [[9, 10, 'M'], [9, 13, 'M'], [10, 11, 'M'], [10, 12, 'M']],
  sad: [[9, 11, 'M'], [9, 12, 'M'], [10, 10, 'M'], [10, 13, 'M'], [8, 10, 'T']],
};

// Head block, cols 6-17 for rows 1-9, one per hair style. Replaces the head of BASE.
const HAIR = {
  short: [
    '............', '............', '....HHHH....', '...HHHHHH...', '..HHSSSSHH..',
    '..HSSSSSSH..', '..SSESSESS..', '..SSSSSSSS..', '...SSSSSS...',
  ],
  buzz: [
    '............', '............', '............', '...HHHHHH...', '..HSSSSSSH..',
    '..SSSSSSSS..', '..SSESSESS..', '..SSSSSSSS..', '...SSSSSS...',
  ],
  bald: [
    '............', '............', '....SSSS....', '...SSSSSS...', '..SSSSSSSS..',
    '..SSSSSSSS..', '..SSESSESS..', '..SSSSSSSS..', '...SSSSSS...',
  ],
  afro: [
    '............', '...HHHHHH...', '..HHHHHHHH..', '.HHHHHHHHHH.', '.HHHSSSSHHH.',
    '.HHSSSSSSHH.', '.HSSESSESSH.', '..SSSSSSSS..', '...SSSSSS...',
  ],
  long: [
    '............', '............', '....HHHH....', '...HHHHHH...', '..HHHHHHHH..',
    '.HHSSSSSSHH.', '.HSSESSESSH.', '.HSSSSSSSSH.', '.H.SSSSSS.H.',
  ],
  locks: [
    '............', '............', '...HHHHHH...', '..HHHHHHHH..', '..HHSSSSHH..',
    '.HHSSSSSSHH.', '.HSSESSESSH.', '.HSSSSSSSSH.', '.H.SSSSSS.H.',
  ],
  mohawk: [
    '............', '.....HH.....', '....HHHH....', '...SHHHHS...', '..SSSSSSSS..',
    '..SSSSSSSS..', '..SSESSESS..', '..SSSSSSSS..', '...SSSSSS...',
  ],
};

const BEARD = [[9, 9], [9, 14], [10, 10], [10, 11], [10, 12], [10, 13]];

const SKINS = ['#3d2208', '#613a0a', '#7a4a1f', '#a0673a', '#c68a5a', '#e0ac7f', '#f3cfa6'];
const HAIR_COLORS = {
  black: '#111111', darkbrown: '#3b2314', brown: '#6b4226',
  blond: '#d9b45a', platinum: '#efe3b0', ginger: '#b5531c',
};

// The original sprite
const DEFAULT_LOOK = { skin: 1, hair: 'short', hairColor: 'black', beard: false };

// Colors shared by every player.
const FIXED = {
  E: '#000000', T: '#29adff', C: '#43454c', R: '#ff2a3a', B: '#43454c', W: '#ffffff',
};

// Mouth: skin darkened, so it stays visible on every skin tone
function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.round(v * f));
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

const OUTLINE = '#000000';

function moodFor(winProb) {
  if (winProb > 0.5) return 'happy';
  if (winProb >= 0.3) return 'neutral';
  return 'sad';
}

function buildGrid(mood, look) {
  const grid = BASE.map((row) => row.split(''));
  HAIR[look.hair].forEach((row, r) => {
    for (let i = 0; i < 12; i++) grid[r][5 + i] = row[i];
  });
  if (look.beard) for (const [r, c] of BEARD) grid[r - 1][c - 1] = 'H';
  for (const [r, cells] of Object.entries(ARMS[mood])) {
    const mirror = cells.split('').reverse();
    for (let i = 0; i < 3; i++) {
      grid[r - 1][4 + i] = cells[i];
      grid[r - 1][15 + i] = mirror[i];
    }
  }
  for (const [r, c, role] of FACES[mood]) grid[r - 1][c - 1] = role;
  return grid;
}

// Draw a player on a 24x36 canvas; CSS scales it up with pixelated rendering.
// team: { kit, look? } where look = { skin, hair, hairColor, beard }
function drawPlayer(canvas, team, mood = 'neutral', flip = false, withBall = true) {
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, W, H);

  const look = { ...DEFAULT_LOOK, ...team.look };
  const skin = SKINS[look.skin];
  const grid = buildGrid(mood, look);
  const colors = {
    ...FIXED, ...team.kit,
    S: skin, M: shade(skin, 0.45), H: HAIR_COLORS[look.hairColor],
  };
  const empty = withBall ? '.' : '.BW';
  const filled = (x, y) => grid[y] && grid[y][x] && !empty.includes(grid[y][x]);
  const px = (x, y, color) => {
    ctx.fillStyle = color;
    ctx.fillRect(flip ? W - 1 - x : x, y, 1, 1);
  };

  // 1px outline keeps dark and white kits readable on any background
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (filled(x, y)) continue;
      if (filled(x - 1, y) || filled(x + 1, y) || filled(x, y - 1) || filled(x, y + 1)) {
        px(x, y, OUTLINE);
      }
    }
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (filled(x, y)) px(x, y, colors[grid[y][x]]);
    }
  }
}
