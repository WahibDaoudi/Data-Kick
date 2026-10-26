// Title screen: stadium band (sky, skyline, stands) above a pixel pitch, two players passing then shooting.

const Pitch = (() => {
  // The pitch and its stands live in a 200 x 125 "core". The canvas takes the window proportions:
  // wide windows get more stands and grass on the sides, tall ones (phones) more sky above and grass below.
  // The core is drawn OX px from the left and OY px from the top, so nothing is cropped or stretched.
  const CW = 200;
  const CH = 125;
  let W = CW;
  let H = CH;
  let OX = 0;
  let OY = 0;
  const TOP = Scenery.HEIGHT; // the pitch starts below the stands
  const CY = 76; // halfway line height

  // Day pitch (neutral, Ligue 1, Premier League), floodlit night pitch with a ring of stars (Champions League)
  const THEMES = {
    neutral: { line: '#fff1e8', net: '#c2c3c7', ball: { W: '#fff1e8', B: '#1d1d1d' }, night: false },
    l1: { line: '#fff1e8', net: '#c2c3c7', ball: { W: '#fff1e8', B: '#0055a4' }, night: false },
    pl: { line: '#ffffff', net: '#c2c3c7', ball: { W: '#ffffff', B: '#ff3d9a' }, night: false },
    es: { line: '#ffffff', net: '#c2c3c7', ball: { W: '#ffffff', B: '#c60b1e' }, night: false },
    it: { line: '#ffffff', net: '#c2c3c7', ball: { W: '#ffffff', B: '#009246' }, night: false },
    ucl: { line: '#d8e4ff', net: '#8f9bd0', ball: { W: '#e8ecff', B: '#1d2b9e' }, night: true },
  };
  let themeName = 'neutral';
  let theme = THEMES.neutral;
  let rivals = [];

  // Players in core coordinates: sprite top-left and the foot where the ball sits
  const players = [
    { team: null, x: 48, y: 58, flip: false, foot: [66, 91], goal: [197, CY] },
    { team: null, x: 128, y: 58, flip: true, foot: [134, 91], goal: [2, CY] },
  ];

  // Ball 4x4, two frames for the spin
  const BALL = [
    ['.WW.', 'WBWW', 'WWBW', '.WW.'],
    ['.WW.', 'WWBW', 'WBWW', '.WW.'],
  ];

  let canvas, ctx, bg, goalEl, raf = null;
  const sprites = {};
  let phase, holder, passes, moods;

  function buildBackground() {
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const g = c.getContext('2d');

    // Sky, stands and grass over the whole canvas, stripes lined up with the pitch
    Scenery.paint(g, themeName, W, H, OY, OX);

    // Everything else in core coordinates
    g.translate(OX, OY);

    // Floodlights: stepped pools of light from the four corners of the pitch
    if (theme.night) {
      const corners = [[0, TOP], [CW, TOP], [0, CH], [CW, CH]];
      for (let y = TOP; y < CH; y++) {
        for (let x = 0; x < CW; x++) {
          const d = Math.min(...corners.map(([cx, cy]) => Math.hypot(x - cx, (y - cy) * 1.4)));
          const level = d < 30 ? 3 : d < 48 ? 2 : d < 66 ? 1 : 0;
          if (level) {
            g.fillStyle = `rgba(255, 255, 230, ${level * 0.05})`;
            g.fillRect(x, y, 1, 1);
          }
        }
      }
    }

    g.fillStyle = theme.line;
    const rect = (x, y, w, h) => {
      g.fillRect(x, y, w, 1);
      g.fillRect(x, y + h - 1, w, 1);
      g.fillRect(x, y, 1, h);
      g.fillRect(x + w - 1, y, 1, h);
    };
    rect(4, TOP + 2, 192, 89);
    g.fillRect(100, TOP + 2, 1, 89);
    rect(4, CY - 25, 24, 50);
    rect(4, CY - 12, 9, 24);
    rect(172, CY - 25, 24, 50);
    rect(187, CY - 12, 9, 24);
    g.fillRect(100, CY, 1, 1);
    g.fillRect(20, CY, 1, 1);
    g.fillRect(180, CY, 1, 1);

    // Center circle, midpoint algorithm for crisp pixels
    let x = 14, y = 0, err = 1 - x;
    while (x >= y) {
      for (const [dx, dy] of [[x, y], [y, x], [-y, x], [-x, y], [-x, -y], [-y, -x], [y, -x], [x, -y]]) {
        g.fillRect(100 + dx, CY + dy, 1, 1);
      }
      y++;
      if (err < 0) err += 2 * y + 1;
      else { x--; err += 2 * (y - x) + 1; }
    }

    // Goals: checkered nets behind each goal line
    for (const gx of [0, 196]) {
      for (let yy = CY - 7; yy < CY + 8; yy++) {
        for (let xx = gx; xx < gx + 4; xx++) {
          if ((xx + yy) % 2 === 0) { g.fillStyle = theme.net; g.fillRect(xx, yy, 1, 1); }
        }
      }
    }
    return c;
  }

  function sprite(p, mood) {
    const key = `${p.team.name}|${JSON.stringify(p.team.look)}|${mood}|${p.flip}`;
    if (!sprites[key]) {
      sprites[key] = document.createElement('canvas');
      drawPlayer(sprites[key], p.team, mood, p.flip, false);
    }
    return sprites[key];
  }

  function drawBall(x, y, frame) {
    const art = BALL[frame];
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        const ch = art[r][c];
        if (ch === '.') continue;
        ctx.fillStyle = theme.ball[ch];
        ctx.fillRect(Math.round(x) - 2 + c, Math.round(y) - 3 + r, 1, 1);
      }
    }
  }

  // Ring of 8 stars around the center circle, twinkling one after the other
  function drawStars(now) {
    for (let k = 0; k < 8; k++) {
      const x = Math.round(100 + Math.cos((k * Math.PI) / 4) * 21);
      const y = Math.round(CY + Math.sin((k * Math.PI) / 4) * 21);
      ctx.fillStyle = (Math.floor(now / 250) + k) % 8 < 2 ? '#ffffff' : '#9fb3ff';
      for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) ctx.fillRect(x + dx, y + dy, 1, 1);
    }
  }

  function setMood(i, mood, until) {
    moods[i] = { mood, until };
  }

  // Opponent: a player of a club of the competition, in its kit, changed after every goal
  function rollRival() {
    const pool = rivals.filter((c) => CLUB_LOOKS[c]);
    const club = pick(pool.length ? pool : Object.keys(CLUB_LOOKS));
    players[1].team = { name: club, kit: KITS[club], look: pickPlayer(club).look };
  }

  function reset(now) {
    rollRival();
    holder = 0;
    passes = 0;
    moods = [{ mood: 'neutral', until: 0 }, { mood: 'neutral', until: 0 }];
    phase = { kind: 'hold', t0: now, dur: 600 };
  }

  // Phase machine: hold -> pass (x3) -> shot -> goal -> kickoff by the other side
  function step(now) {
    if (now - phase.t0 < phase.dur) return;
    const other = 1 - holder;

    if (phase.kind === 'hold') {
      if (passes < 3) {
        phase = { kind: 'pass', t0: now, dur: 800, from: players[holder].foot, to: players[other].foot, arc: 10 };
      } else {
        phase = { kind: 'shot', t0: now, dur: 650, from: players[holder].foot, to: players[holder].goal, arc: 30 };
      }
      if (Sound.ready) Sound.play('kick');
    } else if (phase.kind === 'pass') {
      holder = other;
      passes++;
      setMood(holder, 'happy', now + 400);
      phase = { kind: 'hold', t0: now, dur: 500 };
    } else if (phase.kind === 'shot') {
      setMood(holder, 'happy', now + 1800);
      setMood(other, 'sad', now + 1800);
      goalEl.classList.add('show');
      if (Sound.ready) { Sound.scene('duck'); Sound.play('goal'); }
      phase = { kind: 'goal', t0: now, dur: 1800, at: players[holder].goal };
    } else {
      goalEl.classList.remove('show');
      rollRival();
      holder = other;
      passes = 0;
      phase = { kind: 'hold', t0: now, dur: 600 };
    }
  }

  function ballPosition(now) {
    if (phase.kind === 'pass' || phase.kind === 'shot') {
      const t = Math.min((now - phase.t0) / phase.dur, 1);
      const gx = phase.from[0] + (phase.to[0] - phase.from[0]) * t;
      const gy = phase.from[1] + (phase.to[1] - phase.from[1]) * t;
      return { x: gx, y: gy - Math.sin(Math.PI * t) * phase.arc, ground: gy, air: true };
    }
    const [x, y] = phase.kind === 'goal' ? phase.at : players[holder].foot;
    return { x, y, ground: y, air: false };
  }

  function frame(now) {
    step(now);
    ctx.drawImage(bg, 0, 0);

    ctx.save();
    ctx.translate(0, OY);
    Scenery.animate(ctx, themeName, now, W);
    ctx.translate(OX, 0);
    if (theme.night) drawStars(now);

    players.forEach((p, i) => {
      const mood = now < moods[i].until ? moods[i].mood : 'neutral';
      // Running on the spot: 1px bob, players out of phase
      const bob = (Math.floor(now / 220) + i) % 2;
      ctx.drawImage(sprite(p, mood), p.x, p.y - bob);
    });

    const ball = ballPosition(now);
    if (ball.air) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.fillRect(Math.round(ball.x) - 2, Math.round(ball.ground) + 1, 4, 1);
    }
    drawBall(ball.x, ball.y, ball.air ? Math.floor(now / 90) % 2 : 0);
    ctx.restore();

    raf = requestAnimationFrame(frame);
  }

  return {
    init(el, goal, team) {
      canvas = el;
      goalEl = goal;
      canvas.width = W;
      canvas.height = H;
      ctx = canvas.getContext('2d');
      bg = buildBackground();
      players[0].team = team;
      reset(performance.now());
    },
    // Match the window proportions: wider -> more width, taller -> more height (45% sky above, the rest grass below)
    resize(aspect) {
      const w = Math.max(CW, Math.round(CH * aspect));
      const h = Math.max(CH, Math.round(CW / aspect));
      if ((w === W && h === H) || !ctx) return;
      W = w;
      H = h;
      OX = Math.floor((W - CW) / 2);
      OY = Math.round((H - CH) * 0.45);
      canvas.width = W;
      canvas.height = H;
      bg = buildBackground();
    },
    // Switch the scenery, day / night pitch and the pool of opponents
    setTheme(name, clubs) {
      themeName = name;
      theme = THEMES[name];
      rivals = clubs;
      bg = buildBackground();
      rollRival();
    },
    start() {
      if (raf) return;
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        // Static frame only
        frame(performance.now());
        cancelAnimationFrame(raf);
        raf = null;
        return;
      }
      raf = requestAnimationFrame(frame);
    },
    stop() {
      cancelAnimationFrame(raf);
      raf = null;
      goalEl.classList.remove('show');
    },
  };
})();
