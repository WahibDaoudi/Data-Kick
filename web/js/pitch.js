// Title screen: pixel football pitch, two players passing then shooting.

const Pitch = (() => {
  const PW = 200;
  const PH = 125;
  const GRASS = ['#1f8a3b', '#26a047'];
  const LINE = '#fff1e8';
  const NET = '#c2c3c7';

  // Players: sprite top-left and the foot where the ball sits
  const players = [
    { team: null, x: 48, y: 46, flip: false, foot: [66, 79], goal: [197, 63] },
    { team: null, x: 128, y: 46, flip: true, foot: [134, 79], goal: [2, 63] },
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
    c.width = PW;
    c.height = PH;
    const g = c.getContext('2d');

    // Mowing stripes
    for (let x = 0; x < PW; x += 10) {
      g.fillStyle = GRASS[(x / 10) % 2];
      g.fillRect(x, 0, 10, PH);
    }

    g.fillStyle = LINE;
    const rect = (x, y, w, h) => {
      g.fillRect(x, y, w, 1);
      g.fillRect(x, y + h - 1, w, 1);
      g.fillRect(x, y, 1, h);
      g.fillRect(x + w - 1, y, 1, h);
    };
    rect(4, 4, 192, 117);
    g.fillRect(100, 4, 1, 117);
    rect(4, 32, 27, 61);
    rect(4, 48, 10, 29);
    rect(169, 32, 27, 61);
    rect(186, 48, 10, 29);
    g.fillRect(100, 62, 1, 1);
    g.fillRect(22, 62, 1, 1);
    g.fillRect(178, 62, 1, 1);

    // Center circle, midpoint algorithm for crisp pixels
    let x = 16, y = 0, err = 1 - x;
    while (x >= y) {
      for (const [dx, dy] of [[x, y], [y, x], [-y, x], [-x, y], [-x, -y], [-y, -x], [y, -x], [x, -y]]) {
        g.fillRect(100 + dx, 62 + dy, 1, 1);
      }
      y++;
      if (err < 0) err += 2 * y + 1;
      else { x--; err += 2 * (y - x) + 1; }
    }

    // Goals: checkered nets behind each goal line
    for (const gx of [0, 196]) {
      for (let yy = 55; yy < 71; yy++) {
        for (let xx = gx; xx < gx + 4; xx++) {
          if ((xx + yy) % 2 === 0) { g.fillStyle = NET; g.fillRect(xx, yy, 1, 1); }
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
        ctx.fillStyle = ch === 'W' ? '#fff1e8' : '#1d1d1d';
        ctx.fillRect(Math.round(x) - 2 + c, Math.round(y) - 3 + r, 1, 1);
      }
    }
  }

  function setMood(i, mood, until) {
    moods[i] = { mood, until };
  }

  // Opponent: a random star in his club's kit, changed after every goal
  function rollRival() {
    const club = pick(Object.keys(STARS));
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
        phase = { kind: 'shot', t0: now, dur: 650, from: players[holder].foot, to: players[holder].goal, arc: 34 };
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

    raf = requestAnimationFrame(frame);
  }

  return {
    init(el, goal, team) {
      canvas = el;
      goalEl = goal;
      canvas.width = PW;
      canvas.height = PH;
      ctx = canvas.getContext('2d');
      bg = buildBackground();
      players[0].team = team;
      reset(performance.now());
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
