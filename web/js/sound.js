// Chiptune sound effects and background music synthesized with Web Audio (no audio files).

const Sound = (() => {
  let ctx = null;
  let sfxGain = null;
  let musicGain = null;
  let echoIn = null;
  let softWave = null;
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

      // Music bus through a compressor: dense and loud without clipping when every voice plays
      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = -18;
      compressor.knee.value = 12;
      compressor.ratio.value = 4;
      compressor.attack.value = 0.003;
      compressor.release.value = 0.25;
      musicGain.connect(compressor).connect(ctx.destination);

      // Stadium echo for the melodies that ask for it: delay with feedback, mixed into the music bus
      echoIn = ctx.createGain();
      const delay = ctx.createDelay();
      const feedback = ctx.createGain();
      const wet = ctx.createGain();
      delay.delayTime.value = 0.3;
      feedback.gain.value = 0.3;
      wet.gain.value = 0.25;
      echoIn.connect(delay).connect(feedback).connect(delay);
      delay.connect(wet).connect(musicGain);

      // Rounder than a square wave: a few odd and even harmonics
      softWave = ctx.createPeriodicWave(new Float32Array(6), new Float32Array([0, 1, 0.35, 0.18, 0.08, 0.05]));

      noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  // `at` is an absolute AudioContext time
  // type 'soft' = rounded wave; attack > 0 = smooth start; vibrato = depth relative to the pitch; lowpass = cutoff in Hz
  function tone(freq, at, dur, { type = 'square', vol = 0.06, to = null, out = sfxGain, attack = 0, vibrato = 0, echo = false, lowpass = 0 } = {}) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    if (type === 'soft') osc.setPeriodicWave(softWave);
    else osc.type = type;
    osc.frequency.setValueAtTime(freq, at);
    if (to) osc.frequency.exponentialRampToValueAtTime(to, at + dur);
    if (vibrato) {
      const lfo = ctx.createOscillator();
      const depth = ctx.createGain();
      lfo.frequency.value = 5.5;
      depth.gain.value = freq * vibrato;
      lfo.connect(depth).connect(osc.frequency);
      lfo.start(at);
      lfo.stop(at + dur);
    }
    if (attack) {
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(vol, at + attack);
    } else {
      gain.gain.setValueAtTime(vol, at);
    }
    gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    if (lowpass) {
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = lowpass;
      osc.connect(filter).connect(gain);
    } else {
      osc.connect(gain);
    }
    gain.connect(out);
    if (echo) gain.connect(echoIn);
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

  const midi = (m) => 440 * 2 ** ((m - 69) / 12);
  // Melody helper: [[note, length in 16ths], ...] -> one value per step, 0 = hold
  const seq = (notes) => notes.flatMap(([n, len]) => [n, ...Array(len - 1).fill(0)]);

  // Arcade theme (no competition chosen): 4-bar loop in C (C - Am - F - G), 16 steps per bar
  const ARCADE_CHORDS = [48, 45, 41, 43];
  const ARCADE_BASS = [0, 12, 0, 12, 0, 12, 7, 12]; // offsets per eighth note
  const ARCADE_LEAD = [
    72, 0, 76, 0, 79, 0, 76, 0, 84, 0, 79, 0, 76, 0, 74, 0,
    72, 0, 76, 0, 81, 0, 79, 0, 76, 0, 72, 0, 69, 0, 72, 0,
    77, 0, 76, 0, 74, 0, 72, 0, 74, 0, 76, 0, 77, 0, 81, 0,
    79, 0, 0, 0, 77, 0, 76, 0, 74, 0, 0, 0, 71, 0, 74, 0,
  ];

  function playArcade(s, t, out) {
    const bar = Math.floor(s / 16);
    const inBar = s % 16;
    const step = 60 / 140 / 4;

    if (inBar % 2 === 0) {
      tone(midi(ARCADE_CHORDS[bar] + ARCADE_BASS[inBar / 2]), t, step * 1.8, { type: 'triangle', vol: 0.12, out });
    }
    if (ARCADE_LEAD[s]) {
      let len = 1;
      while (len < 8 && ARCADE_LEAD[(s + len) % ARCADE_LEAD.length] === 0) len++;
      tone(midi(ARCADE_LEAD[s]), t, step * len * 0.9, { vol: 0.035, out });
    }
    // Drums: kick on 1 and 3, snare on 2 and 4, hats on eighths
    if (inBar % 8 === 0) tone(110, t, 0.12, { type: 'sine', to: 40, vol: 0.2, out });
    if (inBar % 8 === 4) noise(t, 0.1, { vol: 0.06, highpass: 1500, out });
    if (inBar % 2 === 0) noise(t, 0.03, { vol: 0.025, highpass: 7000, out });
  }

  // Ligue 1: original musette waltz in A minor (3/4, 12 steps per bar), accordion with two slightly detuned reeds
  const AM = [57, 60, 64], E7 = [56, 59, 62], A7C = [55, 61, 64], DM = [57, 62, 65];
  const MUSETTE_BARS = [
    [AM, 45], [AM, 45], [E7, 40], [E7, 40], [E7, 40], [E7, 40], [AM, 45], [AM, 45],
    [A7C, 45], [DM, 38], [DM, 38], [AM, 45], [E7, 40], [E7, 40], [AM, 45], [AM, 45],
  ];
  const MUSETTE_LEAD = [
    ...seq([[76, 6], [72, 2], [74, 2], [76, 2]]), ...seq([[81, 8], [79, 2], [77, 2]]),
    ...seq([[74, 6], [71, 2], [68, 2], [71, 2]]), ...seq([[76, 12]]),
    ...seq([[74, 6], [76, 2], [77, 2], [76, 2]]), ...seq([[74, 4], [71, 4], [68, 4]]),
    ...seq([[69, 4], [72, 4], [76, 4]]), ...seq([[81, 12]]),
    ...seq([[79, 6], [76, 2], [73, 2], [76, 2]]), ...seq([[77, 8], [76, 2], [74, 2]]),
    ...seq([[74, 4], [77, 4], [81, 4]]), ...seq([[76, 8], [72, 2], [69, 2]]),
    ...seq([[71, 4], [74, 4], [76, 4]]), ...seq([[80, 6], [76, 2], [74, 2], [71, 2]]),
    ...seq([[72, 4], [71, 4], [69, 4]]), ...seq([[69, 12]]),
  ];

  function playMusette(s, t, out) {
    const bar = Math.floor(s / 12);
    const inBar = s % 12;
    const step = 60 / 170 / 4;
    const [chord, root] = MUSETTE_BARS[bar];

    // Oom-pah-pah: bass on 1, chord on 2 and 3, brushes with the chords
    if (inBar === 0) tone(midi(root), t, step * 3.5, { type: 'triangle', vol: 0.14, out });
    if (inBar === 4 || inBar === 8) {
      chord.forEach((n) => tone(midi(n), t, step * 2, { type: 'square', vol: 0.012, attack: 0.005, out }));
      noise(t, 0.05, { vol: 0.012, highpass: 5000, out });
    }

    if (MUSETTE_LEAD[s]) {
      let len = 1;
      while (len < 12 && MUSETTE_LEAD[(s + len) % MUSETTE_LEAD.length] === 0) len++;
      // Musette tuning: two reeds a few cents apart beat against each other
      for (const detune of [0.997, 1.003]) {
        tone(midi(MUSETTE_LEAD[s]) * detune, t, step * len * 0.92, { type: 'sawtooth', vol: 0.018, attack: 0.01, out });
      }
    }
  }

  // Premier League: original English stadium anthem in E (E - B - C#m - A), 4 bars of intro, 8 of verse, 4 of chorus
  const E = [64, 68, 71], B = [63, 66, 71], CSM = [61, 64, 68], AMAJ = [61, 64, 69];
  const PL_BARS = [
    [E, 40], [B, 47], [CSM, 49], [AMAJ, 45],
    [E, 40], [B, 47], [CSM, 49], [AMAJ, 45], [E, 40], [B, 47], [CSM, 49], [AMAJ, 45],
    [AMAJ, 45], [B, 47], [E, 40], [E, 40],
  ];
  const PL_LEAD = [
    ...Array(4 * 16).fill(0),
    ...seq([[76, 4], [76, 2], [78, 2], [80, 4], [76, 4]]), ...seq([[78, 8], [75, 4], [71, 4]]),
    ...seq([[73, 4], [76, 4], [80, 4], [78, 4]]), ...seq([[76, 16]]),
    ...seq([[76, 4], [76, 2], [78, 2], [80, 4], [83, 4]]), ...seq([[83, 8], [80, 4], [78, 4]]),
    ...seq([[80, 4], [78, 4], [76, 4], [73, 4]]), ...seq([[76, 16]]),
    ...seq([[81, 6], [80, 2], [78, 8]]), ...seq([[83, 6], [81, 2], [80, 8]]),
    ...seq([[80, 4], [78, 4], [76, 4], [78, 4]]), ...seq([[76, 16]]),
  ];
  const PL_BPM = 128;

  function playPremier(s, t, out) {
    const bar = Math.floor(s / 16);
    const inBar = s % 16;
    const step = 60 / PL_BPM / 4;
    const [chord, root] = PL_BARS[bar];
    const intro = bar < 4;
    const chorus = bar >= 12;

    // Brass stabs on the beats, louder bar after bar in the intro, then on the offbeats
    if (intro ? inBar % 4 === 0 : inBar % 8 === 6) {
      chord.forEach((n) => tone(midi(n), t, step * 1.5, { type: 'sawtooth', lowpass: 2200, vol: intro ? 0.015 + bar * 0.006 : 0.016, attack: 0.01, out }));
    }
    if (intro) {
      if (bar >= 1 && inBar % 4 === 0) tone(110, t, 0.15, { type: 'sine', to: 45, vol: 0.1 + bar * 0.03, out });
      // Riser into the verse
      if (bar === 3 && inBar >= 8) noise(t, 0.08, { vol: 0.01 + (inBar - 8) * 0.006, highpass: 2000, out });
      return;
    }

    if (inBar === 0) {
      if (bar === 4 || bar === 12) noise(t, 1.2, { vol: 0.05, highpass: 3500, out });
      chord.forEach((n) => tone(midi(n), t, step * 15.5, { type: 'triangle', vol: chorus ? 0.026 : 0.02, attack: 0.05, out }));
    }

    // Bass: eighth notes, root and octave
    if (inBar % 2 === 0) tone(midi(root + (inBar % 4 ? 12 : 0)), t, step * 1.8, { type: 'triangle', vol: 0.13, out });

    // Melody, sung by the whole stand in the chorus (brass one octave down)
    if (PL_LEAD[s]) {
      let len = 1;
      while (len < 16 && PL_LEAD[(s + len) % PL_LEAD.length] === 0) len++;
      const dur = step * len * 0.92;
      tone(midi(PL_LEAD[s]), t, dur, { type: 'soft', vol: 0.045, attack: 0.015, vibrato: 0.004, echo: true, out });
      if (chorus) tone(midi(PL_LEAD[s] - 12), t, dur, { type: 'sawtooth', lowpass: 2400, vol: 0.03, attack: 0.03, out });
    }

    // Four on the floor, clap on 2 and 4, offbeat hats
    if (inBar % 4 === 0) tone(110, t, 0.15, { type: 'sine', to: 45, vol: 0.22, out });
    if (inBar === 4 || inBar === 12) noise(t, 0.1, { vol: 0.06, highpass: 1500, out });
    if (inBar % 4 === 2) noise(t, 0.04, { vol: 0.025, highpass: 7000, out });
  }

  // Champions League night: our epic arrangement of Handel's "Zadok the Priest" (1727, public domain), in D
  // 4 bars of rising arpeggios, 8 bars of theme, 4 bars of climax one octave up
  const D = [62, 66, 69], G = [62, 67, 71], A = [61, 64, 69], A7 = [61, 64, 67];
  const ZADOK_BARS = [
    [D, 38], [G, 38], [A, 38], [A7, 45],
    [D, 38], [D, 38], [G, 43], [D, 38], [A, 45], [D, 38], [A7, 45], [D, 38],
    [G, 43], [D, 38], [A7, 45], [D, 38],
  ];
  const ZADOK_ARP = [0, 1, 2, 3, 2, 1, 0, 1, 2, 3, 2, 1, 0, 1, 2, 3];
  const ZADOK_LEAD = [
    ...Array(4 * 16).fill(0),
    ...seq([[78, 8], [81, 4], [78, 4]]), ...seq([[74, 16]]),
    ...seq([[79, 8], [83, 4], [79, 4]]), ...seq([[78, 8], [74, 4], [78, 4]]),
    ...seq([[76, 8], [81, 8]]), ...seq([[78, 4], [76, 4], [74, 4], [78, 4]]),
    ...seq([[79, 8], [76, 4], [73, 4]]), ...seq([[74, 16]]),
    ...seq([[83, 8], [81, 4], [79, 4]]), ...seq([[78, 8], [81, 8]]),
    ...seq([[79, 4], [76, 4], [73, 4], [76, 4]]), ...seq([[74, 16]]),
  ];
  const ZADOK_BPM = 116;

  // Harmony voice: the closest chord tone at least a minor third below the melody
  function below(note, chord) {
    for (let n = note - 3; n > note - 10; n--) if (chord.some((c) => (n - c) % 12 === 0)) return n;
    return note - 12;
  }

  function playZadok(s, t, out) {
    const bar = Math.floor(s / 16);
    const inBar = s % 16;
    const step = 60 / ZADOK_BPM / 4;
    const [chord, root] = ZADOK_BARS[bar];
    const intro = bar < 4;
    const climax = bar >= 12;

    // Arpeggio: one octave up in the intro, getting louder, two octaves up as sparkle over the theme
    const arpNote = [...chord.slice(0, 3), chord[0] + 12][ZADOK_ARP[inBar]];
    tone(midi(arpNote + (intro ? 12 : 24)), t, step * 0.9, { type: 'soft', vol: intro ? 0.015 + bar * 0.006 : 0.012, attack: 0.005, out });

    if (intro) {
      if (inBar % 4 === 0) tone(midi(root), t, step * 3.5, { type: 'triangle', vol: 0.07 + bar * 0.015, out });
      // Timpani roll and snare roll into the theme
      if (bar === 3) {
        tone(95, t, step * 0.9, { type: 'sine', to: 60, vol: 0.05 + inBar * 0.012, out });
        if (inBar >= 8) noise(t, 0.06, { vol: 0.02 + (inBar - 8) * 0.006, highpass: 1000, out });
      }
      return;
    }

    // Crash cymbal when the theme and the climax start
    if (inBar === 0 && (bar === 4 || bar === 12)) noise(t, 1.4, { vol: 0.06, highpass: 3500, out });

    // Choir: 5 voices with octave doubling, held over the bar
    if (inBar === 0) {
      [...chord, chord[0] + 12, chord[1] + 12].forEach((n) => {
        tone(midi(n), t, step * 15.5, { type: 'triangle', vol: climax ? 0.028 : 0.022, attack: 0.06, out });
      });
    }

    // Driving bass: eighth notes, root and octave
    if (inBar % 2 === 0) tone(midi(root + (inBar % 4 ? 12 : 0)), t, step * 1.8, { type: 'triangle', vol: 0.13, out });

    // Melody: brass (filtered sawtooth) with a harmony below, doubled one octave up by a clear voice with echo
    if (ZADOK_LEAD[s]) {
      let len = 1;
      while (len < 16 && ZADOK_LEAD[(s + len) % ZADOK_LEAD.length] === 0) len++;
      const note = ZADOK_LEAD[s] + (climax ? 12 : 0);
      const dur = step * len * 0.95;
      const brass = { type: 'sawtooth', lowpass: 2600, attack: 0.03, out };
      tone(midi(note), t, dur, { ...brass, vol: 0.035 });
      tone(midi(below(note, chord)), t, dur, { ...brass, vol: 0.025 });
      tone(midi(note + 12), t, dur, { type: 'soft', vol: 0.04, attack: 0.02, vibrato: 0.006, echo: true, out });
    }

    // Timpani boom-ba-boom, strong snare on 2 and 4, 16th hats, snare roll at the end of each section
    if (inBar === 0 || inBar === 6 || inBar === 8) tone(110, t, 0.3, { type: 'sine', to: 45, vol: 0.24, out });
    if (inBar === 4 || inBar === 12) noise(t, 0.14, { vol: 0.07, highpass: 1000, out });
    noise(t, 0.025, { vol: 0.012, highpass: 7000, out });
    if ((bar === 11 || bar === 15) && inBar >= 12) noise(t, 0.06, { vol: 0.03 + (inBar - 12) * 0.01, highpass: 1000, out });
  }

  // Tracks: tempo, length in 16th steps, roots of the tension loop (VS screen)
  const TRACKS = {
    neutral: { bpm: 140, length: ARCADE_LEAD.length, tension: ARCADE_CHORDS, play: playArcade },
    l1: { bpm: 170, length: MUSETTE_LEAD.length, tension: [45, 45, 40, 40], play: playMusette },
    pl: { bpm: PL_BPM, length: PL_LEAD.length, tension: [52, 52, 47, 47], play: playPremier },
    ucl: { bpm: ZADOK_BPM, length: ZADOK_LEAD.length, tension: [50, 50, 45, 45], play: playZadok },
  };

  const MUSIC_LEVEL = 0.55;

  let track = TRACKS.neutral;
  let trackName = 'neutral';
  let step = 0;
  let nextTime = 0;
  let timer = null;
  let mode = 'main'; // 'main' or 'tension' (VS screen: drums and pulsing bass only)

  function playStep(s, t) {
    const out = musicGain;

    if (mode === 'tension') {
      // Four on the floor, 16th-note bass pedal on the track's roots, 16th hats
      const inBar = s % 16;
      const root = track.tension[Math.floor(s / 16) % track.tension.length];
      tone(midi(root - 12 + (inBar % 2) * 12), t, (60 / track.bpm / 4) * 0.8, { type: 'triangle', vol: 0.1, out });
      if (inBar % 4 === 0) tone(110, t, 0.12, { type: 'sine', to: 40, vol: 0.2, out });
      noise(t, 0.02, { vol: 0.02, highpass: 7000, out });
      return;
    }
    track.play(s, t, out);
  }

  // Lookahead scheduler: queue notes slightly ahead of the audio clock
  function schedule() {
    while (nextTime < ctx.currentTime + 0.15) {
      playStep(step, nextTime);
      nextTime += 60 / track.bpm / 4;
      step = (step + 1) % (mode === 'tension' ? 64 : track.length);
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
    // Change the background theme: fade out, switch, fade in from the top of the new track
    setTrack(name) {
      if (name === trackName) return;
      trackName = name;
      if (!ctx || !timer) {
        track = TRACKS[name];
        step = 0;
        return;
      }
      rampMusic(0, 0.25);
      setTimeout(() => {
        track = TRACKS[name];
        step = 0;
        mode = 'main';
        rampMusic(MUSIC_LEVEL, 1);
      }, 280);
    },
    get muted() { return muted; },
    get musicMuted() { return musicMuted; },
    // True once a user gesture has started audio
    get ready() { return ctx !== null && ctx.state === 'running'; },
  };
})();
