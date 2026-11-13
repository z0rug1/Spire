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

  var A = {
    init: init,
    setMuted: function (m) { muted = m; if (master) master.gain.setTargetAtTime(m ? 0 : 0.9, ac.currentTime, 0.05); },
    suspend: function (on) { if (!ac) return; (on ? ac.suspend() : ac.resume()).catch(function () {}); },
    // d: district 0..3, alt: 0..1 of total height, active: is the game being played
    ambience: function (d, alt, active) {
      if (!ac || !amb) return;
      var t = ac.currentTime;
      amb.wg.gain.setTargetAtTime(active ? 0.018 + alt * 0.05 : 0.012, t, 0.6);
      amb.wf.frequency.setTargetAtTime(320 + alt * 500, t, 0.8);
      amb.dg.gain.setTargetAtTime(active ? 0.05 : 0.03, t, 0.8);
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
