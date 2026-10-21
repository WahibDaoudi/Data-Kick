// Screens, fixtures list and probability animation.

const BLOCKS = 20;
const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Colors of the original sprite, used on the title pitch.
const ORIGINAL = { name: 'Data-Kick', kit: { P: '#000000', Q: '#141e96', A: '#1fa2d4', N: '#ffffff', K: '#000000' } };

const MOOD_LABEL = { happy: 'CONFIANT', neutral: 'PRUDENT', sad: 'INQUIET' };
const DAYS = ['DIM', 'LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM'];

const state = {
  league: -1, // index in LEAGUES, -1 = no competition chosen yet
  loaded: {}, // fixtures already fetched, by competition code
  fixtures: [],
  index: 0,
  timers: [],
  match: 0, // incremented on each opened match, drops stale animations
};

// Chosen competition, or the neutral state
const current = () => LEAGUES[state.league] || NEUTRAL;

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

function show(id) {
  $$('.screen').forEach((s) => s.classList.toggle('active', s.id === id));
  state.timers.forEach(clearTimeout);
  state.timers = [];
  if (id === 'title') { Pitch.start(); Logo.start(); }
  else { Pitch.stop(); Logo.stop(); }
  if (id === 'list') Stadium.start();
  else Stadium.stop();
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

// Status of a fixture: final score once played, "EN COURS" after kick-off, the kick-off time before
function statusLabel(f) {
  if (f.score) return `TERMINE ${f.score[0]} - ${f.score[1]}`;
  if (new Date(f.kickoff) <= new Date()) return 'EN COURS';
  return kickoffLabel(f.kickoff);
}

// Green / red verdict of a played match (empty while unknown)
function badge(f) {
  if (f.correct === true) return '<span class="badge ok">PREDICTION CORRECTE</span>';
  if (f.correct === false) return '<span class="badge ko">ECHEC</span>';
  return '';
}

// Team kit + the player drawn for this fixture
const playerOf = (f, side) => ({ ...teamFor(f[side]), ...f.players[side] });

// Fixtures list
function buildList() {
  const list = $('#fixtures');
  list.innerHTML = '';
  const rounds = [...new Set(state.fixtures.map((f) => f.round))];
  const league = current().name;
  $('#round').textContent = rounds.length ? `${league} - JOURNEE ${rounds.join(' + ')}` : `${league} - AUCUN MATCH A VENIR`;

  state.fixtures.forEach((f, i) => {
    // A random player per side, kept for the VS screen
    f.players = { home: pickPlayer(f.home), away: pickPlayer(f.away) };

    const li = document.createElement('li');
    li.className = 'fixture';
    li.setAttribute('role', 'option');
    li.innerHTML = `
      <canvas></canvas>
      <span class="team home">${displayName(f.home)}</span>
      <div class="mid">
        <span class="when">${statusLabel(f)}</span>
        ${f.probs
          ? `<div class="bar"><i class="h" style="width:${f.probs.H * 100}%"></i><i class="d" style="width:${f.probs.D * 100}%"></i><i class="a" style="width:${f.probs.A * 100}%"></i></div>
             <div class="pcts"><span>${pct(f.probs.H)}</span><span>${pct(f.probs.D)}</span><span>${pct(f.probs.A)}</span></div>
             ${badge(f)}`
          : '<span class="na">PRONO INDISPO</span>'}
      </div>
      <span class="team away">${displayName(f.away)}</span>
      <canvas></canvas>`;

    // Each prediction gets its two players, already in their mood
    const [c1, c2] = $$('canvas', li);
    drawPlayer(c1, playerOf(f, 'home'), f.probs ? moodFor(f.probs.H) : 'neutral', false, false);
    drawPlayer(c2, playerOf(f, 'away'), f.probs ? moodFor(f.probs.A) : 'neutral', true, false);

    if (!f.probs) li.classList.add('off');
    if (f.score) li.classList.add('played');
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
  $('.fname', left).textContent = displayName(home.name);
  $('.fname', right).textContent = displayName(away.name);
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
  later(() => fillGauges(f.probs, match, () => reveal(home, away, f)), 1000);
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

function reveal(home, away, f) {
  const { probs } = f;
  const left = $('#versus .left');
  const right = $('#versus .right');
  const moodHome = moodFor(probs.H);
  const moodAway = moodFor(probs.A);

  drawPlayer($('canvas', left), home, moodHome);
  drawPlayer($('canvas', right), away, moodAway, true);
  $('.mood', left).textContent = MOOD_LABEL[moodHome];
  $('.mood', right).textContent = MOOD_LABEL[moodAway];

  const best = Object.entries(probs).sort((a, b) => b[1] - a[1])[0][0];
  const text = { H: `VICTOIRE ${displayName(home.name)}`, D: 'MATCH NUL', A: `VICTOIRE ${displayName(away.name)}` }[best];
  // Played: real score and verdict next to the prediction made before kick-off
  $('#verdict').innerHTML = `PRONO : ${text}${f.score ? ` &nbsp; SCORE ${f.score[0]} - ${f.score[1]} &nbsp; ${badge(f)}` : ''}`;
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

// Model accuracy on the matches already played this season
const PICK_LABEL = { H: 'DOM', D: 'NUL', A: 'EXT' };

function shortDate(iso) {
  const d = new Date(`${iso}T12:00:00`);
  const pad = (n) => String(n).padStart(2, '0');
  return `${DAYS[d.getDay()]} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
}

function showResults() {
  const code = current().code;
  if (!code) return;
  Sound.play('select');
  const match = ++state.match;
  show('results');
  $('#results-league').textContent = `${current().name} - SAISON EN COURS`;
  $('#acc-pct').textContent = '0%';
  $('#acc-detail').textContent = 'CHARGEMENT...';
  $('#acc-blocks').innerHTML = '<i></i>'.repeat(BLOCKS);
  $('#past').innerHTML = '';

  // Fetched every time: results and checks change after each round
  loadResults(code)
    .then((data) => { if (match === state.match) renderResults(data, match); })
    .catch(() => { if (match === state.match) $('#acc-detail').textContent = 'RELANCE LE SERVEUR'; });
}

function renderResults({ summary, matches }, match) {
  const waiting = `${summary.pending} PRONO${summary.pending > 1 ? 'S' : ''} EN ATTENTE DE RESULTAT`;
  // The gauge fills from the matches to come: empty until the first one is played
  if (!summary.played) {
    $('#acc-detail').textContent = `AUCUN MATCH JOUE POUR L'INSTANT - ${waiting}`;
    return;
  }
  $('#acc-detail').textContent = `${summary.correct} / ${summary.played} MATCHS - TOUJOURS DOMICILE : ${pct(summary.home_baseline)} - ${waiting}`;

  // One row per played match: score, what the model picked, and the verdict
  $('#past').innerHTML = matches.map((m) => `
    <li>
      <span class="date">${shortDate(m.date)}</span>
      <span class="home">${displayName(m.home)}</span>
      <span class="score">${m.score[0]} - ${m.score[1]}</span>
      <span class="away">${displayName(m.away)}</span>
      <span class="pick">PRONO ${PICK_LABEL[m.predicted]} ${pct(m.probs[m.predicted])}</span>
      <span class="badge ${m.correct ? 'ok' : 'ko'}">${m.correct ? 'PREDICTION CORRECTE' : 'ECHEC'}</span>
    </li>`).join('');

  // Gauge filling block by block up to the accuracy, counter in sync
  const blocks = $$('#acc-blocks i');
  const steps = REDUCED ? 1 : BLOCKS;
  let step = 0;
  const tick = () => {
    if (match !== state.match) return;
    step++;
    const t = step / steps;
    const lit = Math.round(summary.accuracy * BLOCKS * t);
    blocks.forEach((b, i) => b.classList.toggle('on', i < lit));
    $('#acc-pct').textContent = pct(summary.accuracy * t);
    Sound.play('tick', step);
    if (step < steps) later(tick, 60);
    // Fanfare when the model beats "always home"
    else Sound.play(summary.accuracy > summary.home_baseline ? 'win' : 'draw');
  };
  later(tick, 300);
}

// Title
function start() {
  // No competition yet: Enter picks the first one
  if (!current().code) return cycleLeague(1);
  if ($('#start').disabled) return;
  Sound.scene('duck');
  Sound.play('start');
  showList();
}

function fillTicker() {
  const items = !current().code ? [] : state.fixtures.map((f) => {
    const match = `${displayName(f.home)} - ${displayName(f.away)}`;
    if (f.score) return `${match} ${f.score[0]}-${f.score[1]}${f.correct === null ? '' : f.correct ? ' : PRONO OK' : ' : PRONO RATE'}`;
    if (!f.probs) return match;
    const best = Object.entries(f.probs).sort((a, b) => b[1] - a[1])[0];
    const pick = { H: displayName(f.home), D: 'NUL', A: displayName(f.away) }[best[0]];
    return `${match} : ${pick} ${pct(best[1])}`;
  });
  const text = [current().ticker, ...items].join('  *  ');
  $('#ticker').textContent = `${text}  *`;
  $('#ticker').style.animationDuration = `${Math.max(text.length * 0.18, 12)}s`;
}

// Competition (or neutral state): theme, scenery, music, banner and fixtures all follow the selector
function setLeague(i) {
  state.league = i;
  const league = current();
  document.documentElement.dataset.league = league.theme;
  $('#league-name').textContent = league.name;
  $('#league-name').classList.toggle('blink', !league.code);
  Pitch.setTheme(league.theme, league.rivals);
  Stadium.setTheme(league.theme);
  Logo.setTheme(league.theme);
  Sound.setTrack(league.track);
  drawBackdrop(league.theme);
  if ($('#title').classList.contains('active')) Pitch.start();

  if (league.code) return loadLeague(league.code);
  const startBtn = $('#start');
  startBtn.textContent = 'PRESS START';
  startBtn.classList.remove('blink');
  startBtn.disabled = true;
  fillTicker();
}

// The selector loops over the neutral state and every competition: -1, 0, 1, ... , -1
function cycleLeague(delta) {
  Sound.play('move');
  const n = LEAGUES.length + 1;
  setLeague(((state.league + 1 + delta + n) % n) - 1);
}

// Back to the title screen, no competition chosen
function goToSelection() {
  Sound.play('whoosh');
  Sound.scene('menu');
  show('title');
  setLeague(-1);
}

// Stadium band at the bottom of the list and VS screens (the title has its own above the pitch)
function drawBackdrop(theme) {
  const canvas = $('#backdrop');
  canvas.width = 320;
  canvas.height = Scenery.HEIGHT;
  Scenery.draw(canvas.getContext('2d'), theme, canvas.width);
}

// Fixtures of a competition, fetched once per page; PRESS START waits for them
function loadLeague(code) {
  const startBtn = $('#start');
  const ready = (fixtures) => {
    // The selector may have moved on while loading
    if (current().code !== code) return;
    state.fixtures = fixtures;
    // Cursor on the next match to come, not on the ones already played
    const next = fixtures.findIndex((f) => f.probs && new Date(f.kickoff) > new Date());
    state.index = next >= 0 ? next : Math.max(fixtures.findIndex((f) => f.probs), 0);
    buildList();
    fillTicker();
    startBtn.textContent = 'PRESS START';
    startBtn.classList.add('blink');
    startBtn.disabled = false;
  };
  if (state.loaded[code]) return ready(state.loaded[code]);

  startBtn.textContent = 'CHARGEMENT...';
  startBtn.classList.remove('blink');
  startBtn.disabled = true;
  loadFixtures(code)
    .then((fixtures) => {
      state.loaded[code] = fixtures;
      ready(fixtures);
    })
    .catch(() => {
      if (current().code === code) startBtn.textContent = 'RELANCE LE SERVEUR';
    });
}

// Star field of the Champions League screens: random pixels as box-shadows, one list per layer
function makeStars() {
  const colors = ['#ffffff', '#cfd8ff', '#9fb3ff'];
  $$('.stars i').forEach((layer) => {
    const stars = Array.from({ length: 70 }, () =>
      `${(Math.random() * 100).toFixed(1)}vw ${(Math.random() * 100).toFixed(1)}vh 0 ${pick(colors)}`);
    layer.style.boxShadow = stars.join(', ');
  });
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
  Pitch.resize(w / h);
  Stadium.resize(w / h);
}

// Wiring
document.addEventListener('keydown', (e) => {
  const screen = $('.screen.active').id;
  if (e.key === 'm' || e.key === 'M') return toggleMusic();
  if (e.key === 's' || e.key === 'S') return toggleMute();

  if (screen === 'title') {
    if (e.key === 'Enter' || e.key === ' ') start();
    else if (e.key === 'ArrowLeft') cycleLeague(-1);
    else if (e.key === 'ArrowRight') cycleLeague(1);
    else if ((e.key === 'Escape' || e.key === 'Backspace') && state.league >= 0) { Sound.play('whoosh'); setLeague(-1); }
    else return;
    e.preventDefault();
  } else if (screen === 'list') {
    if (e.key === 'ArrowUp') moveCursor(-1);
    else if (e.key === 'ArrowDown') moveCursor(1);
    else if (e.key === 'Enter') openMatch();
    else if (e.key === 'Escape') { Sound.play('whoosh'); show('title'); }
    else return;
    e.preventDefault();
  } else if (screen === 'results') {
    if (e.key === 'ArrowUp') $('#past').scrollBy(0, -80);
    else if (e.key === 'ArrowDown') $('#past').scrollBy(0, 80);
    else if (e.key === 'Escape' || e.key === 'Backspace') { Sound.play('whoosh'); showList(); }
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

// Music needs a user gesture before it can start. Capture phase on window: it starts before the gesture
// is handled, so the theme of the current screen plays first (the neutral one, not the next competition's)
const firstGesture = () => Sound.startMusic();
window.addEventListener('pointerdown', firstGesture, { once: true, capture: true });
window.addEventListener('keydown', firstGesture, { once: true, capture: true });

fit();
window.addEventListener('resize', fit);
$('#start').addEventListener('click', start);
$('#league-prev').addEventListener('click', (e) => { e.currentTarget.blur(); cycleLeague(-1); });
$('#league-next').addEventListener('click', (e) => { e.currentTarget.blur(); cycleLeague(1); });
$('#back').addEventListener('click', () => { Sound.play('whoosh'); showList(); });
$('#change').addEventListener('click', goToSelection);
$('#show-results').addEventListener('click', showResults);
$('#results-back').addEventListener('click', () => { Sound.play('whoosh'); showList(); });
$('#prev').addEventListener('click', () => stepMatch(-1));
$('#next').addEventListener('click', () => stepMatch(1));

Pitch.init($('#pitch'), $('#goal'), ORIGINAL);
Stadium.init($('#stadium'));
fit();
Pitch.start();
Logo.init($('#logo'));
Logo.start();

makeStars();

// Neutral until a competition is chosen
setLeague(-1);
