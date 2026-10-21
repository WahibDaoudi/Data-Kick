// Pixel logo: "DATA" + bouncing ball + "KICK", letters waving.

const Logo = (() => {
  const LW = 120;
  const LH = 30;
  const TOP = 8;

  // 5x7 glyphs, drawn at 2x
  const GLYPHS = {
    D: ['XXXX.', 'X...X', 'X...X', 'X...X', 'X...X', 'X...X', 'XXXX.'],
    A: ['.XXX.', 'X...X', 'X...X', 'XXXXX', 'X...X', 'X...X', 'X...X'],
    T: ['XXXXX', '..X..', '..X..', '..X..', '..X..', '..X..', '..X..'],
    K: ['X...X', 'X..X.', 'X.X..', 'XX...', 'X.X..', 'X..X.', 'X...X'],
    I: ['XXX', '.X.', '.X.', '.X.', '.X.', '.X.', 'XXX'],
    C: ['.XXXX', 'X....', 'X....', 'X....', 'X....', 'X....', '.XXXX'],
  };

  // Color bands from top to bottom of a letter (14 px tall)
  const WARM = ['#fff1e8', '#fff1e8', '#ffec27', '#ffec27', '#ffec27', '#ffec27', '#ffec27',
    '#ffa300', '#ffa300', '#ffa300', '#ffa300', '#ff6c24', '#ff6c24', '#ff6c24'];
  const COOL = ['#fff1e8', '#fff1e8', '#8fd3ff', '#8fd3ff', '#29adff', '#29adff', '#29adff',
    '#29adff', '#1d64d8', '#1d64d8', '#1d64d8', '#1d2b9e', '#1d2b9e', '#1d2b9e'];
  // Champions League night: silver DATA, electric blue KICK
  const SILVER = ['#ffffff', '#ffffff', '#eef1ff', '#eef1ff', '#d6dcf5', '#d6dcf5', '#d6dcf5',
    '#b4bde6', '#b4bde6', '#b4bde6', '#b4bde6', '#8f9bd0', '#8f9bd0', '#8f9bd0'];
  const NIGHT_BLUE = ['#ffffff', '#ffffff', '#9fd8ff', '#9fd8ff', '#4fa8ff', '#4fa8ff', '#4fa8ff',
    '#4fa8ff', '#2f6bff', '#2f6bff', '#2f6bff', '#1a3fb8', '#1a3fb8', '#1a3fb8'];
  // Ligue 1: the French flag, blue DATA, white ball, red KICK
  const FR_BLUE = ['#ffffff', '#ffffff', '#7fb2ff', '#7fb2ff', '#3d8bff', '#3d8bff', '#3d8bff',
    '#0055a4', '#0055a4', '#0055a4', '#0055a4', '#003a75', '#003a75', '#003a75'];
  const FR_RED = ['#ffffff', '#ffffff', '#ff9a92', '#ff9a92', '#ff5a4e', '#ff5a4e', '#ff5a4e',
    '#ef4135', '#ef4135', '#ef4135', '#ef4135', '#b3261c', '#b3261c', '#b3261c'];
  // Premier League: sky blue DATA, hot pink KICK
  const PL_BLUE = ['#ffffff', '#ffffff', '#b3e5fc', '#b3e5fc', '#4fc3f7', '#4fc3f7', '#4fc3f7',
    '#29b6f6', '#29b6f6', '#1e88e5', '#1e88e5', '#1565c0', '#1565c0', '#1565c0'];
  const PL_PINK = ['#ffffff', '#ffffff', '#ffc1e0', '#ffc1e0', '#ff79c6', '#ff79c6', '#ff79c6',
    '#ff3d9a', '#ff3d9a', '#ff3d9a', '#ff3d9a', '#c2185b', '#c2185b', '#c2185b'];
  const THEMES = {
    neutral: { first: WARM, second: COOL, shadow: '#7e2553', ballDark: '#43454c' },
    l1: { first: FR_BLUE, second: FR_RED, shadow: '#0b2257', ballDark: '#0055a4' },
    pl: { first: PL_BLUE, second: PL_PINK, shadow: '#0a2a6e', ballDark: '#ff3d9a' },
    ucl: { first: SILVER, second: NIGHT_BLUE, shadow: '#0a1a5c', ballDark: '#1d2b9e' },
  };
  let theme = THEMES.neutral;
  const OUTLINE = '#000000';

  const BALL = [
    '....KKKK....', '..KKWWWWKK..', '.KWWWDDWWWK.', '.KWWDDDDWWK.',
    'KWDWWDDWWDWK', 'KDDWWWWWWDDK', 'KDWWWWWWWWDK', 'KWWDWWWWDWWK',
    '.KWDDWWDDWK.', '.KWWDDDDWWK.', '..KKWWWWKK..', '....KKKK....',
  ];
  // Layout: [char, x, word]; the ball sits between the two words
  const letters = [];
  let x = 4;
  for (const ch of 'DATA') { letters.push([ch, x, 'first']); x += GLYPHS[ch][0].length * 2 + 2; }
  const ballX = x + 2;
  x = ballX + 12 + 4;
  for (const ch of 'KICK') { letters.push([ch, x, 'second']); x += GLYPHS[ch][0].length * 2 + 2; }

  let canvas, ctx, raf = null;

  // Pixels of a glyph at 2x, relative to its top-left corner
  function mask(ch) {
    const px = [];
    GLYPHS[ch].forEach((row, r) => {
      [...row].forEach((cell, c) => {
        if (cell === 'X') for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) px.push([c * 2 + dx, r * 2 + dy]);
      });
    });
    return px;
  }
  const masks = Object.fromEntries(Object.keys(GLYPHS).map((ch) => [ch, mask(ch)]));

  function draw(now) {
    ctx.clearRect(0, 0, LW, LH);
    const t = now / 1000;
    const placed = letters.map(([ch, lx, word], i) => [masks[ch], lx, TOP + Math.round(Math.sin(t * 4 - i * 0.7) * 2), theme[word]]);

    // Three passes so outlines never cover a neighbour letter: shadow, outline, fill
    for (const [m, lx, ly] of placed) {
      ctx.fillStyle = theme.shadow;
      for (const [px, py] of m) ctx.fillRect(lx + px + 1, ly + py + 1, 3, 3);
    }
    for (const [m, lx, ly] of placed) {
      ctx.fillStyle = OUTLINE;
      for (const [px, py] of m) ctx.fillRect(lx + px - 1, ly + py - 1, 3, 3);
    }
    for (const [m, lx, ly, pal] of placed) {
      for (const [px, py] of m) {
        ctx.fillStyle = pal[py];
        ctx.fillRect(lx + px, ly + py, 1, 1);
      }
    }

    // Ball: bounces and spins (mirrored every few frames)
    const by = TOP + 2 - Math.round(Math.abs(Math.sin(t * 3)) * 6);
    const spin = Math.floor(now / 160) % 2;
    BALL.forEach((row, r) => {
      [...row].forEach((cell, c) => {
        if (cell === '.') return;
        ctx.fillStyle = { K: OUTLINE, W: '#fff1e8', D: theme.ballDark }[cell];
        ctx.fillRect(ballX + (spin ? 11 - c : c), by + r, 1, 1);
      });
    });
  }

  function loop(now) {
    draw(now);
    raf = requestAnimationFrame(loop);
  }

  return {
    width: LW,
    height: LH,
    init(el) {
      canvas = el;
      canvas.width = LW;
      canvas.height = LH;
      ctx = canvas.getContext('2d');
      draw(0);
    },
    setTheme(name) {
      theme = THEMES[name];
      draw(performance.now());
    },
    start() {
      if (raf || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      raf = requestAnimationFrame(loop);
    },
    stop() {
      cancelAnimationFrame(raf);
      raf = null;
    },
  };
})();
