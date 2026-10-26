// Stadium band drawn above the pitch (title) and at the bottom of the other screens:
// sky, skyline and stands, one look per theme (neutral, l1, pl, es, it, ucl).

const Scenery = (() => {
  const HEIGHT = 30;

  const SKY = {
    neutral: ['#29366f', '#33437f', '#3d5090', '#4a5fa3'],
    l1: ['#3a6fd8', '#4f82e0', '#6b9ae8', '#8fb4f0'],
    pl: ['#1e78d8', '#2f8fe0', '#45a4ee', '#5cb6f5'],
    es: ['#f28c28', '#f7a440', '#fbbd5c', '#ffd27f'],
    it: ['#3a8fd8', '#58a6e6', '#7cbdf0', '#a6d4f7'],
    ucl: ['#03071c', '#050a24', '#08113a', '#0c1850'],
  };
  const CROWD = {
    neutral: ['#5f574f', '#83769c', '#c2c3c7', '#ab5236', '#1d2b53'],
    l1: ['#0055a4', '#f4f4f4', '#ef4135', '#0b2257', '#c2c3c7'],
    pl: ['#1e88e5', '#ff3d9a', '#ffffff', '#0d47a1', '#7fd8ff'],
    es: ['#c60b1e', '#ffc400', '#f4f4f4', '#7a1010', '#e8a200'],
    it: ['#009246', '#f4f4f4', '#ce2b37', '#1b4d2b', '#8a1c24'],
    ucl: ['#0d1b4c', '#1b2f73', '#2a3c70', '#5a6aa8', '#0a1030'],
  };
  // Mowing stripes: day grass, floodlit night grass
  const GRASS = {
    neutral: ['#1f8a3b', '#26a047'],
    l1: ['#1f8a3b', '#26a047'],
    pl: ['#2a8f3e', '#33a148'],
    es: ['#2a8f3e', '#33a148'],
    it: ['#1f8a3b', '#26a047'],
    ucl: ['#0c4a24', '#10592c'],
  };
  // Advertising boards along the pitch
  const BOARD = {
    neutral: ['#000000', '#ffec27'],
    l1: ['#0055a4', '#f4f4f4', '#ef4135'],
    pl: ['#1565c0', '#ff3d9a'],
    es: ['#c60b1e', '#ffc400'],
    it: ['#009246', '#f4f4f4', '#ce2b37'],
    ucl: ['#050a24', '#b9c2e6'],
  };

  // Eiffel tower silhouette, 17 x 18
  const TOWER = [
    '........X........', '........X........', '.......XXX.......', '.......XXX.......',
    '.......XXX.......', '......XXXXX......', '.......XXX.......', '.......XXX.......',
    '......XXXXX......', '......XX.XX......', '....XXXXXXXXX....', '.....XX...XX.....',
    '.....XX...XX.....', '....XX.....XX....', '...XXXXXXXXXXX...', '..XX.........XX..',
    '.XX...........XX.', 'XX.............XX',
  ];

  // Gallic rooster, 14 x 14: R comb, W body, B tail, Y beak and legs, K eye
  const ROOSTER = [
    '.....RR.......', '....RRRR......', '.....WWW......', '....WWKWY.....',
    '....WWWWYY....', '.....WWW......', '.....WWWB...BB', '....WWWWWB.BBB',
    '...WWWWWWWBBB.', '...WWWWWWWWB..', '....WWWWWWW...', '.....WWWWW....',
    '......Y..Y....', '.....YY.YY....',
  ];
  const ROOSTER_COLORS = { R: '#ef4135', W: '#f4f4f4', B: '#0055a4', Y: '#ffc72c', K: '#000000' };

  // Big Ben (Elizabeth Tower), 11 x 20: X stone, C lit clock face, K clock hands
  const BIG_BEN = [
    '.....X.....', '.....X.....', '....XXX....', '....XXX....', '...XXXXX...',
    '...XXXXX...', '..XXXXXXX..', '..XCCCCCX..', '..XCCKCCX..', '..XCCCCCX..',
    '..XXXXXXX..', '..XX.X.XX..', '..XXXXXXX..', '..XX.X.XX..', '..XXXXXXX..',
    '..XX.X.XX..', '..XXXXXXX..', '..XX.X.XX..', '..XXXXXXX..', '..XXXXXXX..',
  ];
  const BIG_BEN_COLORS = { X: '#123a7a', C: '#fff2a8', K: '#123a7a' };

  // Union Jack, 5 x 3
  const UNION_JACK = ['BWRWB', 'RRRRR', 'BWRWB'];
  const UNION_JACK_COLORS = { B: '#012169', W: '#ffffff', R: '#c8102e' };

  // Sagrada Familia, 15 x 16: four spires over the nave
  const SAGRADA = [
    '...X.....X.....', '...X..X..X..X..', '..XXX.X.XXX.X..', '..XXX.X.XXX.X..',
    '..XXXXX.XXXXX..', '..XXXXXXXXXXX..', '..XX.XXXXX.XX..', '..XXXXXXXXXXX..',
    '.XXXX.XXX.XXXX.', '.XXXXXXXXXXXXX.', '.XXX.XXXXX.XXX.', '.XXXXXXXXXXXXX.',
    'XXXXXX...XXXXXX', 'XXXXXX...XXXXXX', 'XXXXXXXXXXXXXXX', 'XXXXXXXXXXXXXXX',
  ];

  // Colosseum, 22 x 9: the broken side on the right, three rows of arches
  const COLOSSEUM = [
    '..XXXXXXXXXXXXX.......', '.XXXXXXXXXXXXXXXXX....', '.XX.XX.XX.XX.XX.XX.XX.',
    '.XXXXXXXXXXXXXXXXXXXX.', '.XX.XX.XX.XX.XX.XX.XX.', '.XXXXXXXXXXXXXXXXXXXX.',
    '.XX.XX.XX.XX.XX.XX.XX.', 'XXXXXXXXXXXXXXXXXXXXXX', 'XXXXXXXXXXXXXXXXXXXXXX',
  ];

  // Leaning tower of Pisa, 16 rows: columns and floors, leaning one pixel every 5 rows
  const PISA = Array.from({ length: 16 }, (_, r) => '.'.repeat(3 - Math.floor(r / 5)) + (r % 3 === 0 ? 'XXXXX' : 'X.X.X'));

  // Flags waving above the crowd: colors of each stripe, vertical (Italy) or horizontal (Spain)
  const FLAGS = {
    es: { stripes: ['#c60b1e', '#ffc400', '#c60b1e'], vertical: false },
    it: { stripes: ['#009246', '#f4f4f4', '#ce2b37'], vertical: true },
  };

  // Same pseudo-random sequence on every draw: the crowd does not reshuffle
  function rng(seed) {
    return () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  }

  function bitmap(g, art, x, y, colors) {
    art.forEach((row, r) => {
      [...row].forEach((cell, c) => {
        if (cell === '.') return;
        g.fillStyle = typeof colors === 'string' ? colors : colors[cell];
        g.fillRect(x + c, y + r, 1, 1);
      });
    });
  }

  // Static part, drawn once per theme
  function draw(g, theme, w) {
    const rand = rng(7);

    // Sky in stepped bands
    SKY[theme].forEach((color, i) => {
      g.fillStyle = color;
      g.fillRect(0, i * 5, w, 5);
    });

    if (theme === 'ucl') {
      // Fixed stars (the twinkling ones are animated) and two floodlight pylons
      for (let i = 0; i < 40; i++) {
        g.fillStyle = rand() < 0.5 ? '#5a6aa8' : '#9fb3ff';
        g.fillRect(Math.floor(rand() * w), Math.floor(rand() * 16), 1, 1);
      }
      for (const px of [6, w - 12]) {
        g.fillStyle = '#5a6aa8';
        g.fillRect(px + 2, 5, 2, 13);
        g.fillStyle = '#fffbe0';
        g.fillRect(px, 2, 6, 3);
        g.fillStyle = 'rgba(255, 251, 224, 0.25)';
        g.fillRect(px - 2, 1, 10, 5);
      }
    }

    if (theme === 'l1') {
      // Paris rooftops with chimneys, the Eiffel tower on the left, the rooster on the right
      g.fillStyle = '#2c4a8c';
      for (let x = 0; x < w; ) {
        const width = 6 + Math.floor(rand() * 8);
        const top = 11 + Math.floor(rand() * 4);
        g.fillRect(x, top, width - 1, 18 - top);
        if (rand() < 0.6) g.fillRect(x + 2, top - 2, 1, 2);
        x += width;
      }
      bitmap(g, TOWER, 8, 0, '#1a2550');
      bitmap(g, ROOSTER, w - 24, 3, ROOSTER_COLORS);
    }

    if (theme === 'es') {
      // The sun, terracotta rooftops and the Sagrada Familia
      for (let y = -6; y <= 6; y++) {
        for (let x = -6; x <= 6; x++) {
          const d = Math.hypot(x, y);
          if (d <= 6) {
            g.fillStyle = d <= 4 ? '#fff3b0' : '#ffe27a';
            g.fillRect(w - 28 + x, 7 + y, 1, 1);
          }
        }
      }
      g.fillStyle = '#b5532c';
      for (let x = 0; x < w; ) {
        const width = 6 + Math.floor(rand() * 8);
        const top = 12 + Math.floor(rand() * 3);
        g.fillRect(x, top, width - 1, 18 - top);
        x += width;
      }
      bitmap(g, SAGRADA, 8, 2, '#7a3b1e');
    }

    if (theme === 'it') {
      // Colosseum on the left, the leaning tower of Pisa on the right
      g.fillStyle = '#c98f5a';
      for (let x = 0; x < w; ) {
        const width = 6 + Math.floor(rand() * 8);
        const top = 13 + Math.floor(rand() * 3);
        g.fillRect(x, top, width - 1, 18 - top);
        x += width;
      }
      bitmap(g, COLOSSEUM, 6, 9, '#c9a46a');
      bitmap(g, PISA, w - 22, 1, '#efe6d2');
    }

    if (theme === 'pl') {
      // London rooftops, Big Ben on the left, the big wheel on the right
      g.fillStyle = '#2a64c0';
      for (let x = 0; x < w; ) {
        const width = 5 + Math.floor(rand() * 9);
        const top = 12 + Math.floor(rand() * 3);
        g.fillRect(x, top, width - 1, 18 - top);
        if (rand() < 0.5) g.fillRect(x + 1, top - 2, 2, 2);
        x += width;
      }
      bitmap(g, BIG_BEN, 10, 0, BIG_BEN_COLORS);

      // Big wheel: rim (midpoint circle), 8 spokes, hub and two legs
      const cx = w - 20, cy = 9, r = 7;
      g.fillStyle = '#123a7a';
      let x = r, y = 0, err = 1 - x;
      while (x >= y) {
        for (const [dx, dy] of [[x, y], [y, x], [-y, x], [-x, y], [-x, -y], [-y, -x], [y, -x], [x, -y]]) g.fillRect(cx + dx, cy + dy, 1, 1);
        y++;
        if (err < 0) err += 2 * y + 1;
        else { x--; err += 2 * (y - x) + 1; }
      }
      for (let k = 0; k < 8; k++) {
        for (let d = 1; d < r; d++) {
          g.fillRect(Math.round(cx + Math.cos((k * Math.PI) / 4) * d), Math.round(cy + Math.sin((k * Math.PI) / 4) * d), 1, 1);
        }
      }
      for (let d = 0; d < 9; d++) {
        g.fillRect(cx - Math.round(d / 2), cy + d, 1, 1);
        g.fillRect(cx + Math.round(d / 2), cy + d, 1, 1);
      }
    }

    // Stands: roof line, then a crowd of colored pixels
    g.fillStyle = '#111122';
    g.fillRect(0, 17, w, 11);
    const crowd = CROWD[theme];
    for (let y = 19; y < 27; y++) {
      for (let x = 0; x < w; x++) {
        if (rand() < 0.7) {
          g.fillStyle = crowd[Math.floor(rand() * crowd.length)];
          g.fillRect(x, y, 1, 1);
        }
      }
    }

    // Boards: 8 px segments in the theme colors
    const board = BOARD[theme];
    for (let x = 0; x < w; x += 8) {
      g.fillStyle = board[(x / 8) % board.length];
      g.fillRect(x, 28, 8, 2);
    }
  }

  // Moving part, drawn every frame on top of the static one
  function animate(g, theme, now, w) {
    if (theme === 'ucl') {
      // Twinkling stars and camera flashes in the crowd
      const sky = rng(Math.floor(now / 400));
      for (let i = 0; i < 6; i++) {
        g.fillStyle = '#ffffff';
        g.fillRect(Math.floor(sky() * w), Math.floor(sky() * 15), 1, 1);
      }
      const flash = rng(Math.floor(now / 120) + 99);
      for (let i = 0; i < 4; i++) {
        g.fillStyle = '#ffffff';
        g.fillRect(Math.floor(flash() * w), 19 + Math.floor(flash() * 8), 1, 1);
      }
    } else if (theme === 'pl') {
      // Union Jacks waving above the crowd
      const wave = Math.floor(now / 250) % 2;
      for (const fx of [45, 85, 125, 165]) {
        g.fillStyle = '#c2c3c7';
        g.fillRect(fx, 13, 1, 7);
        UNION_JACK.forEach((row, r) => {
          [...row].forEach((cell, c) => {
            g.fillStyle = UNION_JACK_COLORS[cell];
            g.fillRect(fx + 1 + c, 13 + r + (c % 2 ? wave : 0), 1, 1);
          });
        });
      }
    } else if (FLAGS[theme]) {
      // Spanish or Italian flags waving above the crowd
      const { stripes, vertical } = FLAGS[theme];
      const wave = Math.floor(now / 250) % 2;
      for (const fx of [40, 75, 125, 160]) {
        g.fillStyle = '#c2c3c7';
        g.fillRect(fx, 14, 1, 6);
        for (let c = 0; c < 3; c++) {
          for (let r = 0; r < 3; r++) {
            g.fillStyle = stripes[vertical ? c : r];
            g.fillRect(fx + 1 + c, 14 + r + (c === 1 ? wave : 0), 1, 1);
          }
        }
      }
    } else if (theme === 'l1') {
      // Tricolor flags waving above the crowd
      const wave = Math.floor(now / 250) % 2;
      for (const fx of [40, 70, 130, 160]) {
        g.fillStyle = '#c2c3c7';
        g.fillRect(fx, 14, 1, 6);
        ['#0055a4', '#f4f4f4', '#ef4135'].forEach((color, i) => {
          g.fillStyle = color;
          g.fillRect(fx + 1 + i, 14 + (i === 1 ? wave : 0), 1, 3);
        });
      }
    } else {
      // Mexican wave running along the stands
      const at = Math.floor(now / 25) % (w + 20) - 10;
      g.fillStyle = '#fff1e8';
      for (let x = at - 3; x <= at + 3; x++) {
        for (let y = 19; y < 23; y += 2) g.fillRect(x, y - (Math.abs(x - at) < 2 ? 1 : 0), 1, 1);
      }
    }
  }

  // Extra sky above the band (tall screens): clouds by day, stars by night
  function drawSky(g, theme, w, h) {
    if (h <= 0) return;
    const rand = rng(11);
    g.fillStyle = SKY[theme][0];
    g.fillRect(0, 0, w, h);
    if (theme === 'ucl') {
      for (let i = 0; i < (w * h) / 60; i++) {
        g.fillStyle = rand() < 0.3 ? '#ffffff' : rand() < 0.5 ? '#9fb3ff' : '#5a6aa8';
        g.fillRect(Math.floor(rand() * w), Math.floor(rand() * h), 1, 1);
      }
    } else if (theme === 'l1' || theme === 'pl' || theme === 'it') {
      // Clouds: white over Paris and Rome, pale blue over London
      g.fillStyle = theme === 'pl' ? '#d8eeff' : '#eef4ff';
      for (let i = 0; i < (w * h) / 900; i++) {
        const x = Math.floor(rand() * w);
        const y = 2 + Math.floor(rand() * Math.max(h - 4, 1));
        g.fillRect(x, y, 10, 2);
        g.fillRect(x + 2, y - 1, 6, 1);
        g.fillRect(x + 1, y + 2, 8, 1);
      }
    }
  }

  // A whole stadium view at any size: sky down to bandY, the stands band, then grass to the bottom
  // stripeX: x where a stripe starts, so the stripes line up with a pitch drawn on top
  function paint(g, theme, w, h, bandY, stripeX = 0) {
    drawSky(g, theme, w, bandY);
    g.save();
    g.translate(0, bandY);
    draw(g, theme, w);
    g.restore();
    const grass = GRASS[theme];
    for (let x = stripeX - Math.ceil(stripeX / 10) * 10; x < w; x += 10) {
      g.fillStyle = grass[Math.abs(Math.round((x - stripeX) / 10)) % 2];
      g.fillRect(x, bandY + HEIGHT, 10, h - bandY - HEIGHT);
    }
  }

  return { HEIGHT, draw, animate, paint };
})();
