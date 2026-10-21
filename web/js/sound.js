// Chiptune sound effects and background music synthesized with Web Audio (no audio files).

const Sound = (() => {
  let ctx = null;
  let sfxGain = null;
  let musicGain = null;
  let noiseBuffer = null;

  const stored = (key) => { try { return localStorage.getItem(key) === '1'; } catch (e) { return false; } };
  const store = (key, on) => { try { localStorage.setItem(key, on ? '1' : '0'); } catch (e) { /* storage blocked */ } };

  let muted = stored('dk-muted');
  let musicMuted = stored('dk-music-muted');

  // Browsers only allow audio after a user gesture: created lazily on first play
  function audio() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      sfxGain = ctx.createGain();
      musicGain = ctx.createGain();
      musicGain.gain.value = 0.55;
      sfxGain.connect(ctx.destination);
      musicGain.connect(ctx.destination);

      noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  // `at` is an absolute AudioContext time
  function tone(freq, at, dur, { type = 'square', vol = 0.06, to = null, out = sfxGain } = {}) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, at);
    if (to) osc.frequency.exponentialRampToValueAtTime(to, at + dur);
    gain.gain.setValueAtTime(vol, at);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    osc.connect(gain).connect(out);
    osc.start(at);
    osc.stop(at + dur);
  }

  function noise(at, dur, { vol = 0.08, highpass = 0, out = sfxGain } = {}) {
    const src = ctx.createBufferSource();
    const gain = ctx.createGain();
    src.buffer = noiseBuffer;
    gain.gain.setValueAtTime(vol, at);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    let node = src;
    if (highpass) {
      const filter = ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = highpass;
      node = src.connect(filter);
    }
    node.connect(gain).connect(out);
    src.start(at, Math.random() * 0.5, dur);
  }

  // Referee whistle: high sine with a fast trill
  function whistle(at, dur) {
    const osc = ctx.createOscillator();
    const lfo = ctx.createOscillator();
    const depth = ctx.createGain();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 2800;
    lfo.frequency.value = 28;
    depth.gain.value = 180;
    lfo.connect(depth).connect(osc.frequency);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(0.05, at + 0.02);
    gain.gain.setValueAtTime(0.05, at + dur - 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    osc.connect(gain).connect(sfxGain);
    osc.start(at);
    lfo.start(at);
    osc.stop(at + dur);
    lfo.stop(at + dur);
  }

  // Screen transition: band-passed noise sweeping up
  function whoosh(at, dur) {
    const src = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    src.buffer = noiseBuffer;
    filter.type = 'bandpass';
    filter.Q.value = 2;
    filter.frequency.setValueAtTime(300, at);
    filter.frequency.exponentialRampToValueAtTime(5000, at + dur);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(0.25, at + dur * 0.7);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    src.connect(filter).connect(gain).connect(sfxGain);
    src.start(at, 0, dur);
  }

  function notes(list, step, opts) {
    const t = ctx.currentTime;
    list.forEach((f, i) => tone(f, t + i * step, step * 1.4, opts));
  }

  const effects = {
    move: (t) => tone(880, t, 0.04, { vol: 0.04 }),
    select: () => notes([523, 784], 0.07),
    start: (t) => { notes([988, 1319], 0.08); whistle(t + 0.3, 0.25); whistle(t + 0.62, 0.5); },
    vs: (t) => { noise(t, 0.25, { vol: 0.12 }); tone(220, t, 0.4, { type: 'sawtooth', to: 55, vol: 0.08 }); },
    tick: (t, i) => tone(320 + i * 30, t, 0.03, { vol: 0.03 }),
    win: () => notes([523, 659, 784, 1047, 784, 1047], 0.09),
    draw: () => notes([523, 523, 659, 523], 0.1, { type: 'triangle', vol: 0.1 }),
    kick: (t) => { noise(t, 0.04, { vol: 0.04 }); tone(150, t, 0.06, { to: 60, vol: 0.04 }); },
    goal: (t) => { noise(t, 1.2, { vol: 0.03, highpass: 800 }); notes([523, 659, 784, 1047, 1047], 0.08); },
    whoosh: (t) => whoosh(t, 0.35),
  };

  // Background music: 4-bar loop in C (C - Am - F - G), 16 steps per bar
  const BPM = 140;
  const STEP = 60 / BPM / 4;
  const CHORDS = [48, 45, 41, 43];
  const BASS = [0, 12, 0, 12, 0, 12, 7, 12]; // offsets per eighth note
  // Lead melody, MIDI notes, 0 = hold the previous note
  const LEAD = [
    72, 0, 76, 0, 79, 0, 76, 0, 84, 0, 79, 0, 76, 0, 74, 0,
    72, 0, 76, 0, 81, 0, 79, 0, 76, 0, 72, 0, 69, 0, 72, 0,
    77, 0, 76, 0, 74, 0, 72, 0, 74, 0, 76, 0, 77, 0, 81, 0,
    79, 0, 0, 0, 77, 0, 76, 0, 74, 0, 0, 0, 71, 0, 74, 0,
  ];
  const midi = (m) => 440 * 2 ** ((m - 69) / 12);

  const MUSIC_LEVEL = 0.55;

  let step = 0;
  let nextTime = 0;
  let timer = null;
  let mode = 'main'; // 'main' or 'tension' (VS screen: drums and pulsing bass only)

  function playStep(s, t) {
    const bar = Math.floor(s / 16);
    const inBar = s % 16;
    const out = musicGain;

    if (mode === 'tension') {
      // Four on the floor, 16th-note bass pedal, 16th hats
      tone(midi(CHORDS[bar] - 12 + (inBar % 2) * 12), t, STEP * 0.8, { type: 'triangle', vol: 0.1, out });
      if (inBar % 4 === 0) tone(110, t, 0.12, { type: 'sine', to: 40, vol: 0.2, out });
      noise(t, 0.02, { vol: 0.02, highpass: 7000, out });
      return;
    }

    if (inBar % 2 === 0) {
      tone(midi(CHORDS[bar] + BASS[inBar / 2]), t, STEP * 1.8, { type: 'triangle', vol: 0.12, out });
    }
    if (LEAD[s]) {
      let len = 1;
      while (len < 8 && LEAD[(s + len) % LEAD.length] === 0) len++;
      tone(midi(LEAD[s]), t, STEP * len * 0.9, { vol: 0.035, out });
    }
    // Drums: kick on 1 and 3, snare on 2 and 4, hats on eighths
    if (inBar % 8 === 0) tone(110, t, 0.12, { type: 'sine', to: 40, vol: 0.2, out });
    if (inBar % 8 === 4) noise(t, 0.1, { vol: 0.06, highpass: 1500, out });
    if (inBar % 2 === 0) noise(t, 0.03, { vol: 0.025, highpass: 7000, out });
  }

  // Lookahead scheduler: queue notes slightly ahead of the audio clock
  function schedule() {
    while (nextTime < ctx.currentTime + 0.15) {
      playStep(step, nextTime);
      nextTime += STEP;
      step = (step + 1) % LEAD.length;
    }
  }

  function startMusic() {
    if (musicMuted || timer) return;
    try {
      audio();
      nextTime = ctx.currentTime + 0.05;
      timer = setInterval(schedule, 25);
    } catch (e) { /* audio unavailable */ }
  }

  function stopMusic() {
    clearInterval(timer);
    timer = null;
  }

  // Music volume automation: ramp to `level` after `delay` seconds, over `dur` seconds
  function rampMusic(level, dur, delay = 0) {
    if (!ctx) return;
    const g = musicGain.gain;
    const t = ctx.currentTime;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.setValueAtTime(g.value, t + delay);
    g.linearRampToValueAtTime(level, t + delay + dur);
  }

  // Music reacts to what happens on screen
  const scenes = {
    // Menus: main theme back, from the top of the loop if coming from the VS
    menu: () => {
      if (mode !== 'main') { mode = 'main'; step = 0; }
      rampMusic(MUSIC_LEVEL, 0.6);
    },
    // Match opened: whoosh, then the tension loop under the gauges
    versus: () => {
      if (!muted) effects.whoosh(ctx.currentTime);
      mode = 'tension';
      step = 0;
      rampMusic(0.05, 0.1);
      rampMusic(MUSIC_LEVEL * 0.8, 0.6, 0.35);
    },
    // Result: music cut for the jingle, then the main theme fades back in
    reveal: () => {
      mode = 'main';
      step = 0;
      rampMusic(0, 0.08);
      rampMusic(MUSIC_LEVEL, 1.5, 1.2);
    },
    // Short jingle (goal, kickoff whistle): music ducks under it
    duck: () => {
      rampMusic(0.12, 0.1);
      rampMusic(MUSIC_LEVEL, 0.8, 1.4);
    },
  };

  // Silence everything while the tab is hidden
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) ctx.suspend();
    else ctx.resume();
  });

  return {
    play(name, ...args) {
      if (muted) return;
      try {
        audio();
        effects[name](ctx.currentTime, ...args);
      } catch (e) { /* audio unavailable */ }
    },
    // Transition between screens; the whoosh is a sound effect, the rest drives the music
    scene(name) {
      try {
        audio();
        scenes[name]();
      } catch (e) { /* audio unavailable */ }
    },
    toggle() {
      muted = !muted;
      store('dk-muted', muted);
      return muted;
    },
    toggleMusic() {
      musicMuted = !musicMuted;
      store('dk-music-muted', musicMuted);
      if (musicMuted) stopMusic();
      else startMusic();
      return musicMuted;
    },
    startMusic,
    get muted() { return muted; },
    get musicMuted() { return musicMuted; },
    // True once a user gesture has started audio
    get ready() { return ctx !== null && ctx.state === 'running'; },
  };
})();
