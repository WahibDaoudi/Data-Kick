// Screens, fixtures list and probability animation.

const BLOCKS = 20;
const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Colors of the original sprite, used on the title pitch.
const ORIGINAL = { name: 'Data-Kick', kit: { P: '#000000', Q: '#141e96', A: '#1fa2d4', N: '#ffffff', K: '#000000' } };

const MOOD_LABEL = { happy: 'CONFIANT', neutral: 'PRUDENT', sad: 'INQUIET' };
const DAYS = ['DIM', 'LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM'];

const state = {
  fixtures: [],
  index: 0,
  timers: [],
  match: 0, // incremented on each opened match, drops stale animations
};

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

function show(id) {
  $$('.screen').forEach((s) => s.classList.toggle('active', s.id === id));
  state.timers.forEach(clearTimeout);
  state.timers = [];
  if (id === 'title') { Pitch.start(); Logo.start(); }
  else { Pitch.stop(); Logo.stop(); }
}

const later = (fn, ms) => state.timers.push(setTimeout(fn, REDUCED ? 0 : ms));

// "CE SOIR 20:45", "DEMAIN 15:15", "SAM 24/10 17:00" in local time
function kickoffLabel(iso) {
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const today = new Date();
  const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  if (d.toDateString() === today.toDateString()) return `${d.getHours() >= 17 ? 'CE SOIR' : "AUJOURD'HUI"} ${time}`;
  if (d.toDateString() === tomorrow.toDateString()) return `DEMAIN ${time}`;
  return `${DAYS[d.getDay()]} ${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${time}`;
}

const pct = (p) => `${Math.round(p * 100)}%`;

// Team kit + the player drawn for this fixture
const playerOf = (f, side) => ({ ...teamFor(f[side]), ...f.players[side] });

// Fixtures list
function buildList() {
  const list = $('#fixtures');
  list.innerHTML = '';
  const rounds = [...new Set(state.fixtures.map((f) => f.round))];
  $('#round').textContent = rounds.length ? `JOURNEE ${rounds.join(' + ')}` : 'AUCUN MATCH A VENIR';

  state.fixtures.forEach((f, i) => {
    // A random player per side, kept for the VS screen
    f.players = { home: pickPlayer(f.home), away: pickPlayer(f.away) };
    const starTag = (p) => (p.star ? `<small>${p.star}</small>` : '');

    const li = document.createElement('li');
    li.className = 'fixture';
    li.setAttribute('role', 'option');
    li.innerHTML = `
      <canvas></canvas>
      <span class="team home">${f.home.toUpperCase()}${starTag(f.players.home)}</span>
      <div class="mid">
        <span class="when">${kickoffLabel(f.kickoff)}</span>
        ${f.probs
          ? `<div class="bar"><i class="h" style="width:${f.probs.H * 100}%"></i><i class="d" style="width:${f.probs.D * 100}%"></i><i class="a" style="width:${f.probs.A * 100}%"></i></div>
             <div class="pcts"><span>${pct(f.probs.H)}</span><span>${pct(f.probs.D)}</span><span>${pct(f.probs.A)}</span></div>`
          : '<span class="na">PRONO INDISPO</span>'}
      </div>
      <span class="team away">${f.away.toUpperCase()}${starTag(f.players.away)}</span>
      <canvas></canvas>`;

    // Each prediction gets its two players, already in their mood
    const [c1, c2] = $$('canvas', li);
    drawPlayer(c1, playerOf(f, 'home'), f.probs ? moodFor(f.probs.H) : 'neutral', false, false);
    drawPlayer(c2, playerOf(f, 'away'), f.probs ? moodFor(f.probs.A) : 'neutral', true, false);

    if (!f.probs) li.classList.add('off');
    li.addEventListener('click', () => {
      state.index = i;
      openMatch();
    });
    li.addEventListener('mouseenter', () => {
      if (state.index !== i) { state.index = i; renderCursor(false); }
    });
    list.appendChild(li);
  });
}

function renderCursor(scroll = true) {
  $$('#fixtures .fixture').forEach((li, i) => {
    const on = i === state.index;
    li.classList.toggle('active', on);
    li.setAttribute('aria-selected', on);
    if (on && scroll) li.scrollIntoView({ block: 'nearest' });
  });
}

function moveCursor(delta) {
  const n = state.fixtures.length;
  if (!n) return;
  state.index = (state.index + delta + n) % n;
  Sound.play('move');
  renderCursor();
}

function showList() {
  Sound.scene('menu');
  show('list');
  renderCursor();
}

// Versus
function openMatch() {
  const f = state.fixtures[state.index];
  if (!f || !f.probs) return;
  Sound.scene('versus');

  const home = playerOf(f, 'home');
  const away = playerOf(f, 'away');
  const match = ++state.match;
  show('versus');

  const left = $('#versus .left');
  const right = $('#versus .right');
  drawPlayer($('canvas', left), home, 'neutral');
  drawPlayer($('canvas', right), away, 'neutral', true);
  $('.fname', left).textContent = home.name.toUpperCase();
  $('.fname', right).textContent = away.name.toUpperCase();
  $('.star', left).textContent = home.star || '';
  $('.star', right).textContent = away.star || '';
  $$('#versus .mood').forEach((m) => { m.textContent = ''; });
  $('#kickoff').textContent = `J${f.round} - ${kickoffLabel(f.kickoff)}`;
  $('#verdict').textContent = '';

  // Restart CSS entrance animations
  const screen = $('#versus');
  screen.classList.remove('active');
  void screen.offsetWidth;
  screen.classList.add('active');

  resetGauges();
  later(() => Sound.play('vs'), 500);
  later(() => fillGauges(f.probs, match, () => reveal(home, away, f.probs)), 1000);
}

function resetGauges() {
  $$('.gauge').forEach((g) => {
    $('.blocks', g).innerHTML = '<i></i>'.repeat(BLOCKS);
    $('.pct', g).textContent = '0%';
  });
}

// Fill all three gauges block by block, counters in sync
function fillGauges(probs, match, done) {
  const gauges = $$('.gauge').map((g) => ({
    blocks: $$('.blocks i', g),
    pct: $('.pct', g),
    target: probs[g.dataset.key],
  }));
  const steps = REDUCED ? 1 : BLOCKS;
  let step = 0;

  const tick = () => {
    if (match !== state.match) return;
    step++;
    const t = step / steps;
    for (const g of gauges) {
      const lit = Math.round(g.target * BLOCKS * t);
      g.blocks.forEach((b, i) => b.classList.toggle('on', i < lit));
      g.pct.textContent = `${Math.round(g.target * 100 * t)}%`;
    }
    Sound.play('tick', step);
    if (step >= steps) done();
    else later(tick, 60);
  };
  tick();
}

function reveal(home, away, probs) {
  const left = $('#versus .left');
  const right = $('#versus .right');
  const moodHome = moodFor(probs.H);
  const moodAway = moodFor(probs.A);

  drawPlayer($('canvas', left), home, moodHome);
  drawPlayer($('canvas', right), away, moodAway, true);
  $('.mood', left).textContent = MOOD_LABEL[moodHome];
  $('.mood', right).textContent = MOOD_LABEL[moodAway];

  const best = Object.entries(probs).sort((a, b) => b[1] - a[1])[0][0];
  const text = { H: `VICTOIRE ${home.name}`, D: 'MATCH NUL', A: `VICTOIRE ${away.name}` }[best];
  $('#verdict').textContent = `PRONO : ${text.toUpperCase()}`;
  Sound.scene('reveal');
  Sound.play(best !== 'D' && Math.max(probs.H, probs.A) > 0.5 ? 'win' : 'draw');
}

function stepMatch(delta) {
  const n = state.fixtures.length;
  // Skip matches without a prediction
  for (let k = 1; k <= n; k++) {
    const i = (state.index + delta * k + n * k) % n;
    if (state.fixtures[i].probs) {
      state.index = i;
      return openMatch();
    }
  }
}

// Title
function start() {
  if ($('#start').disabled) return;
  Sound.scene('duck');
  Sound.play('start');
  showList();
}

function fillTicker() {
  const items = state.fixtures.map((f) => {
    if (!f.probs) return `${f.home} - ${f.away}`;
    const best = Object.entries(f.probs).sort((a, b) => b[1] - a[1])[0];
    const pick = { H: f.home, D: 'NUL', A: f.away }[best[0]];
    return `${f.home} - ${f.away} : ${pick} ${pct(best[1])}`;
  });
  $('#ticker').textContent = items.length ? `${items.join('  *  ')}  *` : '';
  $('#ticker').style.animationDuration = `${Math.max(items.join('').length * 0.18, 12)}s`;
}

// Integer pixel scales that fill the window: logo, big sprites (VS) and mini sprites (list)
function fit() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const big = Math.max(2, Math.min(Math.floor((h - 420) / 37), Math.floor((w - 240) / 48), 10));
  const mini = Math.max(1, Math.min(Math.floor(h / 400), Math.floor(w / 450), 3));
  const logo = Math.max(2, Math.min(Math.floor((w * 0.85) / Logo.width), Math.floor((h * 0.24) / Logo.height), 9));
  document.documentElement.style.setProperty('--logo', logo);
  document.documentElement.style.setProperty('--scale', big);
  document.documentElement.style.setProperty('--mini', mini);
}

// Wiring
document.addEventListener('keydown', (e) => {
  const screen = $('.screen.active').id;
  if (e.key === 'm' || e.key === 'M') return toggleMusic();
  if (e.key === 's' || e.key === 'S') return toggleMute();

  if (screen === 'title' && (e.key === 'Enter' || e.key === ' ')) {
    e.preventDefault();
    start();
  } else if (screen === 'list') {
    if (e.key === 'ArrowUp') moveCursor(-1);
    else if (e.key === 'ArrowDown') moveCursor(1);
    else if (e.key === 'Enter') openMatch();
    else if (e.key === 'Escape') { Sound.play('whoosh'); show('title'); }
    else return;
    e.preventDefault();
  } else if (screen === 'versus') {
    if (e.key === 'ArrowLeft') stepMatch(-1);
    else if (e.key === 'ArrowRight') stepMatch(1);
    else if (e.key === 'Escape' || e.key === 'Backspace') { Sound.play('whoosh'); showList(); }
    else return;
    e.preventDefault();
  }
});

function toggleMute() {
  const muted = Sound.toggle();
  $('#mute').textContent = muted ? 'SON OFF' : 'SON ON';
  if (!muted) Sound.play('select');
}

function toggleMusic() {
  $('#music').textContent = Sound.toggleMusic() ? 'MUSIQUE OFF' : 'MUSIQUE ON';
}

$('#mute').textContent = Sound.muted ? 'SON OFF' : 'SON ON';
$('#music').textContent = Sound.musicMuted ? 'MUSIQUE OFF' : 'MUSIQUE ON';
$('#mute').addEventListener('click', (e) => { e.currentTarget.blur(); toggleMute(); });
$('#music').addEventListener('click', (e) => { e.currentTarget.blur(); toggleMusic(); });

// Music needs a user gesture before it can start
const firstGesture = () => Sound.startMusic();
document.addEventListener('pointerdown', firstGesture, { once: true });
document.addEventListener('keydown', firstGesture, { once: true });

fit();
window.addEventListener('resize', fit);
$('#start').addEventListener('click', start);
$('#back').addEventListener('click', () => { Sound.play('whoosh'); showList(); });
$('#prev').addEventListener('click', () => stepMatch(-1));
$('#next').addEventListener('click', () => stepMatch(1));

Pitch.init($('#pitch'), $('#goal'), ORIGINAL);
Pitch.start();
Logo.init($('#logo'));
Logo.start();

// Fixtures and predictions come from the API
loadFixtures()
  .then((fixtures) => {
    state.fixtures = fixtures;
    state.index = Math.max(fixtures.findIndex((f) => f.probs), 0);
    buildList();
    fillTicker();
    $('#start').textContent = 'PRESS START';
    $('#start').classList.add('blink');
    $('#start').disabled = false;
  })
  .catch(() => {
    $('#start').textContent = 'SERVEUR HORS LIGNE';
  });
