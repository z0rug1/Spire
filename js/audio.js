/* Spire — synthesized sound. No audio files: everything is generated with WebAudio. */
(function () {
  'use strict';
  var S = window.Spire;
  var ac = null, master = null, noiseBuf = null, muted = false;
  var amb = null, glideGain = null, lastSteam = 0;
  var ROOTS = [55, 49, 65.41, 43.65];   // drone root per district (Hz)

  function init() {
    if (ac) { if (ac.state === 'suspended') ac.resume().catch(function () {}); return; }
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      ac = new AC();
      master = ac.createGain(); master.gain.value = muted ? 0 : 0.9; master.connect(ac.destination);
      var len = ac.sampleRate * 2, i;
      noiseBuf = ac.createBuffer(1, len, ac.sampleRate);
      var d = noiseBuf.getChannelData(0);
      for (i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      startAmbience();
      startMusic();
    } catch (e) { ac = null; }
  }

  function noise(loop) { var n = ac.createBufferSource(); n.buffer = noiseBuf; n.loop = !!loop; return n; }
  function env(g, t, a, peak, dur) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  }
  function tone(type, f0, f1, dur, peak, delay) {
    var t = ac.currentTime + (delay || 0), o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    env(g, t, 0.006, peak, dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05);
  }
  function hiss(ftype, f0, f1, q, dur, peak, delay) {
    var t = ac.currentTime + (delay || 0), n = noise(), f = ac.createBiquadFilter(), g = ac.createGain();
    f.type = ftype; f.Q.value = q; f.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    env(g, t, 0.01, peak, dur);
    n.connect(f); f.connect(g); g.connect(master); n.start(t, Math.random()); n.stop(t + dur + 0.05);
  }

  function startAmbience() {
    var wind = noise(true), wf = ac.createBiquadFilter(), wg = ac.createGain();
    wf.type = 'bandpass'; wf.frequency.value = 380; wf.Q.value = 0.6; wg.gain.value = 0.0001;
    wind.connect(wf); wf.connect(wg); wg.connect(master); wind.start();
    var o1 = ac.createOscillator(), o2 = ac.createOscillator(), lp = ac.createBiquadFilter(), dg = ac.createGain();
    o1.type = 'sine'; o2.type = 'triangle'; o1.frequency.value = ROOTS[0]; o2.frequency.value = ROOTS[0] * 1.5;
    lp.type = 'lowpass'; lp.frequency.value = 260; dg.gain.value = 0.0001;
    o1.connect(lp); o2.connect(lp); lp.connect(dg); dg.connect(master); o1.start(); o2.start();
    var gl = noise(true), gf = ac.createBiquadFilter();
    glideGain = ac.createGain(); glideGain.gain.value = 0.0001;
    gf.type = 'bandpass'; gf.frequency.value = 900; gf.Q.value = 0.8;
    gl.connect(gf); gf.connect(glideGain); glideGain.connect(master); gl.start();
    amb = { wg: wg, wf: wf, dg: dg, o1: o1, o2: o2, d: -1 };
  }

  /* ---------- music ----------
     A small step sequencer. Each district has a tempo, four chords and patterns for bass, lead and
     percussion. level 0 is the title screen (pad and a sparse lead), 1 is climbing, 2 is a set piece
     or a chase (percussion comes in). Chords are MIDI notes: the first is the bass, the rest the chord. */
  var MUS = [
    { bpm: 66, pad: 'sine', lead: 'triangle', dec: 0.9, oct: 12, padG: 0.05,           // The Roots: slow, damp, A minor
      chords: [[45, 57, 60, 64], [41, 53, 57, 60], [48, 55, 60, 64], [40, 52, 55, 59]],
      arp: [0, -1, -1, -1, -1, -1, 2, -1, -1, -1, 1, -1, -1, -1, -1, 3], bass: [0, 10], hat: [4, 12], kick: [0] },
    { bpm: 88, pad: 'triangle', lead: 'square', dec: 0.16, oct: 12, padG: 0.035,       // The Works: a machine pulse, D dorian
      chords: [[38, 50, 57, 62], [36, 48, 55, 60], [43, 55, 59, 62], [45, 57, 60, 64]],
      arp: [0, -1, 2, -1, 1, -1, 2, 0, -1, 2, -1, 1, 3, -1, 2, -1], bass: [0, 3, 6, 8, 11, 14], hat: [2, 6, 10, 14], kick: [0, 8] },
    { bpm: 76, pad: 'triangle', lead: 'sine', dec: 0.5, oct: 12, padG: 0.04, bell: true,  // The Gardens: bright bells, F major
      chords: [[41, 53, 57, 60, 65], [45, 57, 60, 64, 69], [46, 58, 62, 65, 70], [48, 55, 60, 64, 67]],
      arp: [0, -1, 1, -1, 2, -1, 3, -1, 4, -1, 3, -1, 2, -1, 1, -1], bass: [0, 8], hat: [4, 12], kick: [0] },
    { bpm: 60, pad: 'sine', lead: 'sine', dec: 1.6, oct: 24, padG: 0.05,               // The Crown: thin air, E minor
      chords: [[40, 52, 59, 64, 67], [36, 48, 55, 64, 67], [38, 50, 57, 62, 66], [35, 47, 54, 62, 66]],
      arp: [2, -1, -1, -1, 3, -1, -1, -1, 1, -1, -1, -1, 4, -1, -1, -1], bass: [0], hat: [8], kick: [0] }
  ];
  var mus = { on: true, d: 0, cur: 0, level: 0, step: 0, next: 0, bus: null, lead: null };
  function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  function voice(type, m, t, dur, peak, dest, cutoff, attack) {
    var o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.value = mtof(m);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    if (cutoff) { var f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cutoff; o.connect(f); f.connect(g); }
    else o.connect(g);
    g.connect(dest); o.start(t); o.stop(t + dur + 0.05);
  }
  function drum(t, kick, peak) {
    if (kick) {
      var o = ac.createOscillator(), g = ac.createGain();
      o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.13);
      g.gain.setValueAtTime(peak, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
      o.connect(g); g.connect(mus.bus); o.start(t); o.stop(t + 0.2);
    } else {
      var n = noise(), f = ac.createBiquadFilter(), g2 = ac.createGain();
      f.type = 'highpass'; f.frequency.value = 6500;
      g2.gain.setValueAtTime(peak, t); g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
      n.connect(f); f.connect(g2); g2.connect(mus.bus); n.start(t, Math.random()); n.stop(t + 0.07);
    }
  }
  function playStep(step, t) {
    var D = MUS[mus.cur], ch = D.chords[(step >> 4) & 3], s = step & 15, sd = 60 / D.bpm / 4, lv = mus.level, i, a;
    if (s === 0) for (i = 1; i < ch.length; i++) voice(D.pad, ch[i], t, sd * 17, D.padG, mus.bus, 800, sd * 5);
    if (lv >= 1 && D.bass.indexOf(s) >= 0) voice(mus.cur === 1 ? 'sawtooth' : 'sine', ch[0], t, sd * (mus.cur === 1 ? 1.7 : 6), mus.cur === 1 ? 0.07 : 0.11, mus.bus, mus.cur === 1 ? 300 : 0, 0.012);
    a = D.arp[s];
    if (a >= 0 && (lv >= 1 || (s & 7) === 0)) {
      var m = ch[1 + a % (ch.length - 1)] + D.oct;
      voice(D.lead, m, t, D.dec, D.lead === 'square' ? 0.022 : 0.05, mus.lead, D.lead === 'square' ? 1800 : 0, 0.006);
      if (D.bell) voice('sine', m + 12, t, D.dec * 0.6, 0.016, mus.lead, 0, 0.004);
    }
    if (lv >= 2) {
      if (D.kick.indexOf(s) >= 0) drum(t, true, 0.16);
      if (D.hat.indexOf(s) >= 0 || (s & 1) === 0) drum(t, false, D.hat.indexOf(s) >= 0 ? 0.05 : 0.02);
    }
  }
  function musTick() {
    if (!ac || ac.state !== 'running' || !mus.on || muted) { mus.next = 0; return; }
    if (mus.next < ac.currentTime) mus.next = ac.currentTime + 0.06;
    while (mus.next < ac.currentTime + 0.2) {
      if ((mus.step & 15) === 0) mus.cur = mus.d;          // change district on the bar line
      playStep(mus.step, mus.next);
      mus.next += 60 / MUS[mus.cur].bpm / 4;
      mus.step = (mus.step + 1) & 63;
    }
  }
  function startMusic() {
    mus.bus = ac.createGain(); mus.bus.gain.value = mus.on ? 0.85 : 0.0001; mus.bus.connect(master);
    mus.lead = ac.createGain(); mus.lead.connect(mus.bus);
    var dl = ac.createDelay(1), fb = ac.createGain(), wet = ac.createGain();      // an echo on the lead
    dl.delayTime.value = 0.36; fb.gain.value = 0.34; wet.gain.value = 0.3;
    mus.lead.connect(dl); dl.connect(fb); fb.connect(dl); dl.connect(wet); wet.connect(mus.bus);
    setInterval(musTick, 40);
  }

  var A = {
    init: init,
    // d: district, level: 0 title, 1 climbing, 2 set piece or chase
    music: function (d, level) { mus.d = d; mus.level = level; },
    setMusic: function (on) { mus.on = on; if (mus.bus) mus.bus.gain.setTargetAtTime(on ? 0.85 : 0.0001, ac.currentTime, 0.2); },
    setMuted: function (m) { muted = m; if (master) master.gain.setTargetAtTime(m ? 0 : 0.9, ac.currentTime, 0.05); },
    suspend: function (on) { if (!ac) return; (on ? ac.suspend() : ac.resume()).catch(function () {}); },
    // d: district 0..3, alt: 0..1 of total height, active: is the game being played
    ambience: function (d, alt, active) {
      if (!ac || !amb) return;
      var t = ac.currentTime;
      amb.wg.gain.setTargetAtTime(active ? 0.018 + alt * 0.05 : 0.012, t, 0.6);
      amb.wf.frequency.setTargetAtTime(320 + alt * 500, t, 0.8);
      amb.dg.gain.setTargetAtTime(mus.on ? 0.012 : active ? 0.05 : 0.03, t, 0.8);     // the drone steps back under the music
      if (d !== amb.d) {
        amb.d = d;
        amb.o1.frequency.setTargetAtTime(ROOTS[d], t, 1.2);
        amb.o2.frequency.setTargetAtTime(ROOTS[d] * (d === 2 ? 2 : 1.5), t, 1.2);
      }
    },
    glide: function (on) { if (ac && glideGain) glideGain.gain.setTargetAtTime(on ? 0.05 : 0.0001, ac.currentTime, 0.08); },
    sfx: function (name, k) {
      if (!ac || muted || ac.state !== 'running') return;
      k = k == null ? 1 : k;
      switch (name) {
        case 'leap': hiss('bandpass', 500, 1700, 0.9, 0.16, 0.05 + 0.1 * k); break;
        case 'grab': tone('sine', 150, 70, 0.09, 0.22); hiss('highpass', 2500, 2500, 0.5, 0.04, 0.05); break;
        case 'ledge': tone('sine', 110, 55, 0.12, 0.26); break;
        case 'shard': tone('sine', 1320, 1320, 0.07, 0.09); tone('sine', 1760, 1760, 0.12, 0.09, 0.06); break;
        case 'fall': tone('sine', 480, 80, 0.7, 0.16); hiss('lowpass', 900, 200, 0.5, 0.7, 0.08); break;
        case 'crumble': hiss('lowpass', 500, 180, 0.7, 0.32, 0.22); break;
        case 'slip': hiss('bandpass', 1400, 500, 1.2, 0.2, 0.1); break;
        case 'steam':
          if (ac.currentTime - lastSteam > 0.6) { lastSteam = ac.currentTime; hiss('highpass', 3000, 2200, 0.5, 0.7, 0.05 * k); }
          break;
        case 'zip': tone('sawtooth', 260, 900, 0.18, 0.06); hiss('bandpass', 900, 2400, 1.5, 0.18, 0.06); break;
        case 'nograpple': tone('square', 180, 150, 0.07, 0.04); break;
        case 'shock': tone('square', 95, 80, 0.26, 0.09); hiss('highpass', 1800, 4000, 0.5, 0.26, 0.1); break;
        case 'knock': hiss('lowpass', 1200, 300, 0.6, 0.22, 0.2); tone('sine', 120, 50, 0.15, 0.2); break;
        case 'camp': tone('sine', 392, 392, 0.5, 0.08); tone('sine', 493.9, 493.9, 0.5, 0.08, 0.12); tone('sine', 587.3, 587.3, 0.8, 0.09, 0.24); break;
        case 'tool': tone('triangle', 440, 440, 0.3, 0.08); tone('triangle', 659.3, 659.3, 0.3, 0.08, 0.14); tone('triangle', 880, 880, 0.9, 0.09, 0.28); break;
        case 'ui': tone('sine', 900, 900, 0.04, 0.05); break;
        case 'buy': tone('sine', 660, 990, 0.16, 0.09); break;
        case 'piton': tone('square', 1500, 1200, 0.03, 0.05); tone('square', 1500, 1200, 0.03, 0.05, 0.11); break;
        case 'text': tone('sine', 520 + Math.random() * 60, 500, 0.025, 0.012); break;
        case 'spring': tone('sine', 180, 720, 0.22, 0.16); tone('triangle', 360, 1080, 0.18, 0.05, 0.02); break;
        case 'tube': hiss('bandpass', 300, 2600, 2.5, 0.3, 0.28); tone('sine', 90, 240, 0.28, 0.14); break;
        case 'phaseout': tone('sine', 880, 220, 0.18, 0.08); break;
        case 'over': tone('sine', 392, 392, 0.4, 0.09); tone('sine', 311.1, 311.1, 0.5, 0.09, 0.2); tone('sine', 261.6, 261.6, 1.0, 0.1, 0.45); break;
        case 'hop': hiss('bandpass', 700, 2200, 1.2, 0.14, 0.14); tone('sine', 420, 760, 0.12, 0.08); break;
        case 'peck': tone('square', 900, 500, 0.08, 0.06); hiss('lowpass', 1500, 400, 0.6, 0.18, 0.16); break;
        case 'sizzle': hiss('highpass', 2600, 1200, 0.6, 0.4, 0.2); tone('sine', 180, 70, 0.2, 0.14); break;
        case 'perk': tone('triangle', 523.3, 523.3, 0.2, 0.08); tone('triangle', 784, 784, 0.25, 0.08, 0.1); tone('triangle', 1046.5, 1046.5, 0.6, 0.09, 0.2); break;
        case 'thunder': hiss('lowpass', 500, 60, 0.4, 1.8, 0.42); tone('sine', 70, 34, 1.4, 0.3, 0.05); break;
        case 'rumble': hiss('lowpass', 160, 90, 0.5, 2.2, 0.5); tone('sawtooth', 52, 40, 2.0, 0.07); break;
        case 'burn': hiss('bandpass', 2400, 500, 0.8, 0.6, 0.3); tone('sine', 300, 60, 0.6, 0.14); break;
        case 'banner': tone('triangle', 220, 220, 0.9, 0.07); tone('triangle', 329.6, 329.6, 0.9, 0.06, 0.08); break;
        case 'finish': tone('sine', 523.3, 523.3, 0.3, 0.09); tone('sine', 659.3, 659.3, 0.3, 0.09, 0.12); tone('sine', 784, 784, 0.3, 0.09, 0.24); tone('sine', 1046.5, 1046.5, 1.0, 0.1, 0.36); break;
      }
    }
  };
  S.Audio = A;
})();
