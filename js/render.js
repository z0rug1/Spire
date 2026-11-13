/* Spire — canvas renderer. All art is drawn procedurally; there are no image files. */
(function () {
  'use strict';
  var S = window.Spire, C = S.C;
  var cv, ctx, dpr = 1, cw = 0, ch = 0, sc = 1, kk = 1, ox = 0, viewH = 640, viewW = 360, frameNo = 0;
  var cam = { y: 200, bottom: 0, x: 0, z: 1, f: 0.42, shake: 0, sx: 0, sy: 0 };   // z: zoom, x: left edge, f: where the climber sits on screen
  var parts = [], scarf = [], glows = {}, vig = null, vigRed = null, darkSpr = null, flashA = 0, frameSt = null, pops = {};
  var ROW = 48, TAU = Math.PI * 2;

  var PAL = [
    { // The Roots: wet brick, moss, fungus light
      wall: ['#1b2420', '#1f2a25', '#18201c', '#222e28'], mortar: '#0f1512',
      hold: '#9fb3a8', hi: '#d9e6de', lo: '#4c5b53', ledge: '#6f8177', ledgeTop: '#b9cabf',
      glow: '#58e6c0', sky: ['#050b09', '#0e1c18'], fog: '6,12,10', aim: '#ffffff', rim: 'rgba(255,255,255,.55)',
      zone: '170,230,215', tent: '#3c7f6c'
    },
    { // The Works: riveted iron, furnace glow
      wall: ['#2b2520', '#322a23', '#27211c', '#3a3027'], mortar: '#15100d',
      hold: '#e3b341', hi: '#ffe59a', lo: '#7d5f18', ledge: '#8c6f4a', ledgeTop: '#d6ab6e',
      glow: '#ff8a3c', sky: ['#160c08', '#3a1d10'], fog: '20,10,6', aim: '#ffffff', rim: 'rgba(255,255,255,.55)',
      zone: '255,220,180', tent: '#b5562a'
    },
    { // The Gardens: white stone, ivy, daylight
      wall: ['#d8d2c2', '#cfc8b6', '#e1dccd', '#c8c1ae'], mortar: '#b0a892',
      hold: '#5b4630', hi: '#947752', lo: '#2c2116', ledge: '#6b5a44', ledgeTop: '#a08a69',
      glow: '#ffd76a', sky: ['#7ec4ee', '#d4ecf7'], fog: '255,255,255', aim: '#1f3147', rim: null,
      zone: '40,80,130', tent: '#4f8a4a'
    },
    { // The Crown: dark steel, gold seams, thin air
      wall: ['#161a2a', '#1a1f33', '#131726', '#1e2440'], mortar: '#0a0c16',
      hold: '#e7c768', hi: '#fff3bf', lo: '#806a2a', ledge: '#4b5375', ledgeTop: '#96a0cc',
      glow: '#7fd4ff', sky: ['#03040c', '#141a3a'], fog: '4,6,16', aim: '#ffffff', rim: 'rgba(255,255,255,.55)',
      zone: '170,215,255', tent: '#5a64a8'
    }
  ];

  function hsh(a, b) { var n = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return n - Math.floor(n); }

  function init(canvas) { cv = canvas; ctx = cv.getContext('2d', { alpha: false }); resize(); }
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    cw = window.innerWidth; ch = window.innerHeight;
    cv.width = Math.round(cw * dpr); cv.height = Math.round(ch * dpr);
    sc = Math.min(cw / C.W, ch / 560);
    ox = (cw - C.W * sc) / 2;
    kk = sc * cam.z; viewH = ch / kk; viewW = C.W / cam.z;
    vig = vigRed = null;
  }
  function toWorld(px, py) { return { x: (px - ox) / kk + cam.x, y: cam.bottom + (ch - py) / kk }; }
  function toScreen(x, y) { return { x: ox + (x - cam.x) * kk, y: ch - (y - cam.bottom) * kk }; }
  function worldT() { ctx.setTransform(dpr * kk, 0, 0, -dpr * kk, dpr * (ox - cam.x * kk + cam.sx), dpr * (ch + cam.bottom * kk + cam.sy)); }
  function screenT() { ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }

  function glow(col) {
    if (glows[col]) return glows[col];
    var g = document.createElement('canvas'); g.width = g.height = 64;
    var c = g.getContext('2d'), gr = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = gr; c.fillRect(0, 0, 64, 64);
    return (glows[col] = g);
  }
  function light(col, x, y, r, a) {
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a;
    ctx.drawImage(glow(col), x - r, y - r, r * 2, r * 2);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }
  function circle(x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); }
  function oval(x, y, rx, ry) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU); ctx.fill(); }
  function rrect(x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r); ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
  }
  function line(x0, y0, x1, y1) { ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); }

  /* ---------- camera ---------- */
  function zoomFor(sim, aim, mode) {
    var p = sim.p;
    if (mode === 'title') return 1;
    if (mode === 'talk') return 1.5;                       // close on the camp while people speak
    if (aim && aim.ok) return 1;                           // pull back to show the whole route while aiming
    if (p.state === 'dead') return cam.z;
    if (p.state === 'air' && p.vy < -520) return 1.05;     // and when falling
    return 1.28;
  }
  function update(dt, sim, aim, mode) {
    var p = sim.p, zt = zoomFor(sim, aim, mode);
    cam.z += (zt - cam.z) * (1 - Math.exp(-dt * (zt < cam.z ? 7 : 2.4)));
    cam.f += ((mode === 'talk' ? 0.6 : 0.42) - cam.f) * (1 - Math.exp(-dt * 4));
    kk = sc * cam.z; viewH = ch / kk; viewW = C.W / cam.z;
    var target = p.y + 90 / cam.z + S.clamp(p.vy * 0.1, -170, 60);
    if (aim && aim.ok) target += (aim.vy > 0 ? 50 : -40) * aim.power;
    cam.y += (target - cam.y) * (1 - Math.exp(-dt * (Math.abs(target - cam.y) > 260 ? 12 : 5)));
    cam.bottom = Math.max(-240, cam.y - viewH * cam.f);
    var xt = S.clamp(p.x - viewW / 2, 0, C.W - viewW);
    cam.x = S.clamp(cam.x + (xt - cam.x) * (1 - Math.exp(-dt * 6)), 0, C.W - viewW);
    if (flashA > 0) flashA = Math.max(0, flashA - dt * 2.2);
    if (cam.shake > 0) {
      cam.shake = Math.max(0, cam.shake - dt * 14);
      cam.sx = (Math.random() - 0.5) * cam.shake * 2; cam.sy = (Math.random() - 0.5) * cam.shake * 2;
    } else { cam.sx = cam.sy = 0; }
    updateParts(dt, sim);
    updateScarf(dt, sim);
  }
  function snap(sim, mode) {
    if (mode) cam.z = zoomFor(sim, null, mode);
    kk = sc * cam.z; viewH = ch / kk; viewW = C.W / cam.z;
    cam.y = sim.p.y + 90 / cam.z; cam.bottom = Math.max(-240, cam.y - viewH * cam.f);
    cam.x = S.clamp(sim.p.x - viewW / 2, 0, C.W - viewW);
    scarf.length = 0;
  }

  /* ---------- particles ---------- */
  function add(x, y, vx, vy, g, life, r, col, glowing, grow) {
    if (parts.length > 280) return;
    parts.push({ x: x, y: y, vx: vx, vy: vy, g: g, life: life, max: life, r: r, col: col, add: !!glowing, grow: grow || 0 });
  }
  function emit(kind, x, y, n, dir) {
    var i, a, s;
    for (i = 0; i < n; i++) {
      a = Math.random() * TAU; s = Math.random();
      if (kind === 'dust') add(x, y, Math.cos(a) * 60 * s, Math.sin(a) * 40 * s + 20, -260, 0.35 + s * 0.2, 1.6, 'rgba(220,225,220,.8)');
      else if (kind === 'chalk') add(x, y, Math.cos(a) * 30 * s, Math.sin(a) * 30 * s, -60, 0.4, 2.2, 'rgba(255,255,255,.7)', false, 6);
      else if (kind === 'debris') add(x, y, Math.cos(a) * 120 * s, 60 + Math.sin(a) * 90, -900, 0.8, 2 + s * 2, '#7d8a83');
      else if (kind === 'spark') add(x, y, Math.cos(a) * 260 * s, Math.sin(a) * 260 * s, -300, 0.25 + s * 0.2, 1.6, '#bff1ff', true);
      else if (kind === 'pickup') add(x, y, Math.cos(a) * 110, Math.sin(a) * 110, 0, 0.35, 1.8, '#fff6d0', true);
      else if (kind === 'steam') add(x, y + (Math.random() - 0.5) * 16, dir * (240 + 260 * s), (Math.random() - 0.5) * 40, 60, 0.55, 5 + s * 4, 'rgba(255,255,255,.22)', false, 18);
      else if (kind === 'puff') add(x, y + (Math.random() - 0.5) * 6, dir * (20 + 40 * s), 10 + 20 * s, 30, 0.5, 2.5, 'rgba(255,255,255,.25)', false, 8);
    }
  }
  function updateParts(dt, sim) {
    var i, p;
    for (i = parts.length - 1; i >= 0; i--) {
      p = parts[i]; p.life -= dt;
      if (p.life <= 0) { parts[i] = parts[parts.length - 1]; parts.pop(); continue; }
      p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.r += p.grow * dt;
    }
    // ambient motes, by district
    if (Math.random() < dt * 22) {
      var x = Math.random() * C.W, y = cam.bottom + Math.random() * viewH, d = S.districtAt(sim.world, y);
      if (d === 0) add(x, y, (Math.random() - 0.5) * 12, 8 + Math.random() * 14, 0, 3, 1.1, '#58e6c0', true);
      else if (d === 1) add(x, y, (Math.random() - 0.5) * 30, 30 + Math.random() * 50, 0, 2.2, 1.2, '#ff9a4a', true);
      else if (d === 2) add(x, y, 20 + Math.random() * 30, -15 - Math.random() * 25, 0, 3, 1.7, Math.random() < 0.5 ? '#f3b6c6' : '#ffffff');
      else add(x, y, (Math.random() - 0.5) * 40, -25 - Math.random() * 40, 0, 3, 1.1, '#dfe9ff');
    }
  }
  function drawParts() {
    var i, p, a;
    for (i = 0; i < parts.length; i++) {
      p = parts[i]; a = Math.min(1, p.life / p.max * 1.6);
      ctx.globalAlpha = a; ctx.fillStyle = p.col;
      if (p.add) ctx.globalCompositeOperation = 'lighter';
      if (p.r > 3) circle(p.x, p.y, p.r); else ctx.fillRect(p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
      if (p.add) ctx.globalCompositeOperation = 'source-over';
    }
    ctx.globalAlpha = 1;
  }

  /* ---------- wall ---------- */
  function drawWall(Wd, now) {
    var r0 = Math.floor(cam.bottom / ROW) - 1, r1 = Math.floor((cam.bottom + viewH) / ROW) + 1, r, i, x, y, d, P, off;
    for (r = r0; r <= r1; r++) {
      y = r * ROW;
      if (y < 0) {           // the floor of the Roots
        ctx.fillStyle = y < -ROW ? '#080c0a' : '#0c1210'; ctx.fillRect(0, y, C.W, ROW + 1);
        if (y >= -ROW) { ctx.fillStyle = '#26332d'; ctx.fillRect(0, -4, C.W, 4); ctx.fillStyle = '#3d5148'; ctx.fillRect(0, -1.5, C.W, 1.5); }
        else if (hsh(r, 2) < 0.6) { ctx.fillStyle = '#0f1613'; oval(hsh(r, 3) * C.W, y + 24, 30 + hsh(r, 4) * 40, 7); }
        continue;
      }
      d = S.districtAt(Wd, y + ROW / 2); P = PAL[d];
      ctx.fillStyle = P.mortar; ctx.fillRect(0, y, C.W, ROW + 0.5);
      if (d === 0) {
        off = (r & 1) * 30;
        for (i = -1; i < 7; i++) { ctx.fillStyle = P.wall[(hsh(i, r) * 4) | 0]; ctx.fillRect(i * 60 + off + 1, y + 1, 58, ROW - 2); }
        if (hsh(r, 7) < 0.3) { ctx.fillStyle = 'rgba(74,128,84,.32)'; x = hsh(r, 8) * 320; oval(x, y + 20, 26, 9); oval(x + 22, y + 30, 16, 7); }
        var blk = Math.floor(r / 14);
        if (hsh(blk, 3) < 0.6) {
          x = 40 + ((hsh(blk, 4) * 5) | 0) * 62;
          ctx.fillStyle = '#26332d'; ctx.fillRect(x, y, 10, ROW + 0.5);
          ctx.fillStyle = '#3d5148'; ctx.fillRect(x + 2, y, 2, ROW + 0.5);
          if (r % 4 === 0) { ctx.fillStyle = '#34463e'; ctx.fillRect(x - 2, y + 20, 14, 6); }
        }
        if (hsh(r, 9) < 0.16) {
          x = 20 + hsh(r, 10) * 320;
          light(P.glow, x, y + 24, 30, 0.35 + 0.1 * Math.sin(now * 1.5 + r));
          ctx.fillStyle = '#8ff5d8'; circle(x, y + 24, 2.4); circle(x + 7, y + 19, 1.6); circle(x - 6, y + 28, 1.8);
        }
      } else if (d === 1) {
        off = (r & 1) * 45;
        for (i = -1; i < 5; i++) {
          x = i * 90 + off;
          ctx.fillStyle = P.wall[(hsh(i, r) * 4) | 0]; ctx.fillRect(x + 1, y + 1, 88, ROW - 2);
          ctx.fillStyle = '#16110d'; ctx.fillRect(x + 5, y + 5, 2.4, 2.4); ctx.fillRect(x + 82, y + 5, 2.4, 2.4);
          ctx.fillRect(x + 5, y + ROW - 8, 2.4, 2.4); ctx.fillRect(x + 82, y + ROW - 8, 2.4, 2.4);
        }
        if (r % 7 === 0) { ctx.fillStyle = '#1a1410'; ctx.fillRect(0, y + ROW - 13, C.W, 13); ctx.fillStyle = '#4a3a2c'; ctx.fillRect(0, y + ROW - 3, C.W, 2); }
        if (hsh(r, 5) < 0.1) {
          x = 30 + hsh(r, 6) * 260;
          ctx.fillStyle = '#ff9a3c'; ctx.fillRect(x, y + 12, 34, 22);
          ctx.fillStyle = '#ffd98a'; ctx.fillRect(x + 4, y + 16, 26, 14);
          ctx.fillStyle = '#1a1410'; ctx.fillRect(x + 16, y + 12, 2, 22);
          light(P.glow, x + 17, y + 23, 62, 0.4 + 0.12 * Math.sin(now * 5 + r * 3));
        }
      } else if (d === 2) {
        off = (r & 1) * 60;
        for (i = -1; i < 4; i++) { ctx.fillStyle = P.wall[(hsh(i, r) * 4) | 0]; ctx.fillRect(i * 120 + off + 1, y + 1, 118, ROW - 2); }
        if (hsh(r, 5) < 0.08) {
          x = 40 + hsh(r, 6) * 250;
          ctx.fillStyle = '#b08d4a'; ctx.fillRect(x - 3, y + 4, 32, 38); oval(x + 13, y + 42, 16, 12);
          ctx.fillStyle = '#7fb6d9'; ctx.fillRect(x, y + 6, 26, 36); oval(x + 13, y + 42, 13, 9.5);
          ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(x + 3, y + 8, 5, 30);
        }
        if (hsh(r, 7) < 0.4) {
          x = hsh(r, 8) * 340; var yy = y + hsh(r, 9) * ROW;
          for (i = 0; i < 6; i++) {
            ctx.fillStyle = i % 2 ? '#4f8a4a' : '#3b6f3f';
            circle(x + (hsh(r, 20 + i) - 0.5) * 46, yy + (hsh(r, 30 + i) - 0.5) * 30, 5 + hsh(r, 40 + i) * 6);
          }
        }
      } else {
        off = (r & 1) * 36;
        for (i = -1; i < 6; i++) { ctx.fillStyle = P.wall[(hsh(i, r) * 4) | 0]; ctx.fillRect(i * 72 + off + 1, y + 1, 70, ROW - 2); }
        ctx.fillStyle = 'rgba(201,165,74,.28)'; ctx.fillRect(0, y, C.W, 1);
        for (i = 0; i < 6; i++) ctx.fillRect(i * 72 + off, y, 1, ROW);
        if (hsh(r, 5) < 0.22) {
          x = 20 + hsh(r, 6) * 320;
          var fl = 0.5 + 0.5 * Math.sin(now * 3 + r * 1.7);
          ctx.fillStyle = 'rgba(127,212,255,' + (0.5 + 0.5 * fl) + ')'; ctx.fillRect(x, y + 22, 7, 2);
          light(P.glow, x + 3.5, y + 23, 16, 0.3 + 0.3 * fl);
        }
      }
    }
  }

  /* ---------- zones: updrafts and wind ---------- */
  function drawZones(Wd, simT, now) {
    var b0 = Wd.bucketOf(cam.bottom), b1 = Wd.bucketOf(cam.bottom + viewH), b, i, k, list, seen = {};
    for (b = b0; b <= b1; b++) {
      list = Wd.grid.drafts[b];
      if (list) for (i = 0; i < list.length; i++) {
        var d = Wd.drafts[list[i]]; if (seen['d' + d.id]) continue; seen['d' + d.id] = 1;
        var P = PAL[S.districtAt(Wd, d.y0 + 80)], H = d.y1 - d.y0, cx = (d.x0 + d.x1) / 2;
        ctx.fillStyle = 'rgba(' + P.zone + ',.10)'; ctx.fillRect(d.x0, d.y0, d.x1 - d.x0, H);
        ctx.strokeStyle = 'rgba(' + P.zone + ',.55)'; ctx.lineWidth = 2; ctx.lineCap = 'round';
        for (k = 0; k < 7; k++) {
          var yy = d.y0 + ((now * 110 + k * H / 7) % H), a = Math.min(1, (d.y1 - yy) / 60, (yy - d.y0) / 60);
          ctx.globalAlpha = Math.max(0, a);
          ctx.beginPath(); ctx.moveTo(cx - 14, yy - 8); ctx.lineTo(cx, yy); ctx.lineTo(cx + 14, yy - 8); ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }
      list = Wd.grid.winds[b];
      if (list) for (i = 0; i < list.length; i++) {
        var w = Wd.winds[list[i]]; if (seen['w' + w.id]) continue; seen['w' + w.id] = 1;
        var Pw = PAL[S.districtAt(Wd, w.y0 + 80)], dir = w.ax > 0 ? 1 : -1;
        ctx.fillStyle = 'rgba(' + Pw.zone + ',.06)'; ctx.fillRect(0, w.y0, C.W, w.y1 - w.y0);
        ctx.strokeStyle = 'rgba(' + Pw.zone + ',.45)'; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
        for (k = 0; k < 16; k++) {
          var wy = w.y0 + hsh(k, w.id + 1) * (w.y1 - w.y0);
          var wx = ((now * 240 * dir + hsh(k, w.id + 9) * 460) % 460 + 460) % 460 - 50;
          line(wx, wy, wx + 38 * dir, wy);
        }
      }
    }
  }

  /* ---------- holds ---------- */
  function knob(x, y, P, d) {
    if (d === 1) {            // yellow rung
      ctx.fillStyle = P.lo; rrect(x - 16, y - 7, 32, 12, 4); ctx.fill();
      ctx.fillStyle = P.hold; rrect(x - 16, y - 5, 32, 11, 4); ctx.fill();
      ctx.fillStyle = P.hi; ctx.fillRect(x - 11, y + 2.5, 22, 2);
    } else if (d === 3) {     // gold stud
      ctx.fillStyle = P.lo; ctx.beginPath(); ctx.moveTo(x, y + 13); ctx.lineTo(x + 13, y - 1); ctx.lineTo(x, y - 15); ctx.lineTo(x - 13, y - 1); ctx.fill();
      ctx.fillStyle = P.hold; ctx.beginPath(); ctx.moveTo(x, y + 13); ctx.lineTo(x + 12, y + 1); ctx.lineTo(x, y - 11); ctx.lineTo(x - 12, y + 1); ctx.fill();
      ctx.fillStyle = P.hi; ctx.beginPath(); ctx.moveTo(x, y + 11); ctx.lineTo(x + 6, y + 4); ctx.lineTo(x, y + 1); ctx.lineTo(x - 6, y + 4); ctx.fill();
    } else {                  // stone knob / bronze bracket
      ctx.fillStyle = P.lo; circle(x, y - 2, 13);
      ctx.fillStyle = P.hold; circle(x, y, 12);
      ctx.fillStyle = P.hi; oval(x - 3, y + 4.5, 6, 3.4);
    }
  }
  function drawHold(h, sim, P, now) {
    var t = sim.t, x = S.holdX(h, t), y = S.holdY(h, t), i, p = sim.p;
    switch (h.type) {
      case 'grip': knob(x, y, P, h.d); break;
      case 'phase':             // solid only part of the time: a bloom in the Gardens, a flicker stud elsewhere
        var solid = S.phaseOn(h, t), pw = S.phaseWarn(h, t), bloom = h.d === 2;
        var pc = bloom ? '255,150,190' : '127,212,255';
        if (!solid) {
          ctx.strokeStyle = 'rgba(' + pc + ',.5)'; ctx.lineWidth = 1.5; ctx.setLineDash([3, 4]);
          ctx.beginPath(); ctx.arc(x, y, 12, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
          ctx.fillStyle = 'rgba(' + pc + ',.35)'; circle(x, y, 3);
          break;
        }
        if (pw && Math.sin(now * 34) > 0) ctx.globalAlpha = 0.45;
        light('rgb(' + pc + ')', x, y, 26, 0.5);
        if (bloom) {
          ctx.fillStyle = '#d9628f';
          for (i = 0; i < 6; i++) oval(x + Math.cos(i * 1.047 + 0.5) * 9, y + Math.sin(i * 1.047 + 0.5) * 9, 6.5, 6.5);
          ctx.fillStyle = '#ffd76a'; circle(x, y, 6.5); ctx.fillStyle = '#b8862a'; circle(x, y, 2.6);
        } else {
          ctx.fillStyle = '#0d1424'; circle(x, y, 13.5);
          ctx.fillStyle = '#2c5f8a'; circle(x, y, 12);
          ctx.fillStyle = '#9fe2ff'; circle(x, y, 7); ctx.fillStyle = '#ffffff'; circle(x - 2, y + 3, 2.4);
        }
        ctx.globalAlpha = 1;
        break;
      case 'lift':              // a hook riding a counterweight rail
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#0d0a08'; ctx.lineWidth = 6; line(h.x0, h.y0 + 16, h.x0 + h.ax, h.y0 + h.ay + 16);
        ctx.strokeStyle = h.d === 3 ? '#8e98c4' : '#8a6f4c'; ctx.lineWidth = 2; line(h.x0, h.y0 + 16, h.x0 + h.ax, h.y0 + h.ay + 16);
        ctx.fillStyle = '#0d0a08'; circle(h.x0, h.y0 + 16, 6); circle(h.x0 + h.ax, h.y0 + h.ay + 16, 6);
        ctx.fillStyle = h.d === 3 ? '#c9a54a' : '#d08a3a'; circle(h.x0, h.y0 + 16, 3.4); circle(h.x0 + h.ax, h.y0 + h.ay + 16, 3.4);
        ctx.strokeStyle = '#0d0a08'; ctx.lineWidth = 3; line(x, y + 16, x, y + 9);
        ctx.strokeStyle = '#0d0a08'; ctx.lineWidth = 7.5; ctx.beginPath(); ctx.moveTo(x - 13, y - 2); ctx.lineTo(x, y + 10); ctx.lineTo(x + 13, y - 2); ctx.closePath(); ctx.stroke();
        ctx.strokeStyle = '#ffb347'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x - 13, y - 2); ctx.lineTo(x, y + 10); ctx.lineTo(x + 13, y - 2); ctx.closePath(); ctx.stroke();
        break;
      case 'slick':
        knob(x, y, P, h.d);
        ctx.fillStyle = 'rgba(110,190,235,.55)'; circle(x, y, 12.5);
        ctx.fillStyle = 'rgba(255,255,255,.8)'; oval(x - 4, y + 5, 4, 2);
        var dr = (now * 0.7 + h.id * 0.37) % 1;
        ctx.fillStyle = 'rgba(120,200,240,.8)'; circle(x + 3, y - 12 - dr * 22, 2.2 * (1 - dr));
        break;
      case 'crumble':
        var c = sim.crumble[h.id];
        if (c && c.back > t) {
          var back = 1 - (c.back - t) / C.CRUMBLE_BACK;
          ctx.strokeStyle = 'rgba(200,200,190,' + (0.2 + back * 0.5) + ')'; ctx.lineWidth = 1.5; ctx.setLineDash([3, 4]);
          ctx.beginPath(); ctx.arc(x, y, 12, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
          break;
        }
        var jx = 0;
        if (c && c.t0 != null) { var k = (t - c.t0) / C.CRUMBLE_T; jx = Math.sin(now * 70) * 2.2 * k; }
        ctx.fillStyle = '#4a4640'; circle(x + jx, y - 2, 13);
        ctx.fillStyle = '#a39a88'; circle(x + jx, y, 12);
        ctx.strokeStyle = '#3a352e'; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.moveTo(x + jx - 8, y + 6); ctx.lineTo(x + jx - 1, y + 1); ctx.lineTo(x + jx - 4, y - 5); ctx.lineTo(x + jx + 3, y - 10);
        ctx.moveTo(x + jx - 1, y + 1); ctx.lineTo(x + jx + 8, y + 3); ctx.stroke();
        break;
      case 'moving':
        ctx.strokeStyle = '#120d0a'; ctx.lineWidth = 6; ctx.lineCap = 'round'; line(h.x0 - h.amp - 10, y, h.x0 + h.amp + 10, y);
        ctx.strokeStyle = h.d === 2 ? '#9b8a6a' : '#5d4c3c'; ctx.lineWidth = 2; line(h.x0 - h.amp - 10, y, h.x0 + h.amp + 10, y);
        knob(x, y, P, h.d);
        ctx.fillStyle = '#1a1410'; circle(x, y, 3);
        break;
      case 'anchor':
        ctx.fillStyle = 'rgba(0,0,0,.45)'; rrect(x - 7, y + 6, 14, 12, 3); ctx.fill();
        if (sim.tools.grapple) {
          var dx = x - p.x, dy = y - p.y, inR = dx * dx + dy * dy <= C.GRAPPLE_R * C.GRAPPLE_R && p.hold !== h.id;
          if (inR) light('#ffe9a8', x, y, 26 + 4 * Math.sin(now * 6), 0.7);
        }
        ctx.strokeStyle = '#1a1408'; ctx.lineWidth = 5.5; ctx.beginPath(); ctx.arc(x, y, 10, 0, TAU); ctx.stroke();
        ctx.strokeStyle = '#f2c94c'; ctx.lineWidth = 3.2; ctx.beginPath(); ctx.arc(x, y, 10, 0, TAU); ctx.stroke();
        ctx.fillStyle = '#fff2c0'; circle(x, y, 2.4);
        break;
      case 'ledge':
        ctx.fillStyle = 'rgba(0,0,0,.35)';
        ctx.beginPath(); ctx.moveTo(x - h.hw + 6, y - 6); ctx.lineTo(x - h.hw + 16, y - 6); ctx.lineTo(x - h.hw + 6, y - 18); ctx.fill();
        ctx.beginPath(); ctx.moveTo(x + h.hw - 6, y - 6); ctx.lineTo(x + h.hw - 16, y - 6); ctx.lineTo(x + h.hw - 6, y - 18); ctx.fill();
        ctx.fillStyle = P.lo; rrect(x - h.hw, y - 8, h.hw * 2, 14, 3); ctx.fill();
        ctx.fillStyle = P.ledge; rrect(x - h.hw, y - 6, h.hw * 2, 12, 3); ctx.fill();
        ctx.fillStyle = P.ledgeTop; rrect(x - h.hw, y + 2, h.hw * 2, 4, 2); ctx.fill();
        break;
      case 'camp': drawCamp(h, P, now); break;
      case 'plate':
        var H = h.y1 - h.y0, on = S.plateOn(h, t), warn = S.plateWarn(h, t);
        if (h.alt) {            // wired to one of the Alternator's conduits
          var cxs = h.alt < 0 ? 22 : C.W - 22, ex = h.alt < 0 ? h.x - h.hw : h.x + h.hw;
          ctx.strokeStyle = '#0a0c16'; ctx.lineWidth = 6; line(cxs, h.y, ex, h.y);
          ctx.strokeStyle = on ? '#e8fbff' : warn ? '#ffe15a' : '#3b4a78'; ctx.lineWidth = 2.4; line(cxs, h.y, ex, h.y);
        }
        ctx.fillStyle = '#0a0c16'; ctx.fillRect(h.x - h.hw - 2, h.y0 - 2, h.hw * 2 + 4, H + 4);
        ctx.fillStyle = '#39436a'; ctx.fillRect(h.x - h.hw, h.y0, h.hw * 2, H);
        ctx.fillStyle = '#2f3859';
        for (i = h.y0 + 20; i < h.y1 - 6; i += 26) ctx.fillRect(h.x - h.hw + 5, i, h.hw * 2 - 10, 3);
        ctx.fillStyle = '#8e98c4'; ctx.fillRect(h.x - h.hw, h.y1 - 3, h.hw * 2, 3);
        ctx.fillStyle = '#c9a54a';
        ctx.fillRect(h.x - h.hw + 4, h.y0 + 4, 3, 3); ctx.fillRect(h.x + h.hw - 7, h.y0 + 4, 3, 3);
        ctx.fillRect(h.x - h.hw + 4, h.y1 - 9, 3, 3); ctx.fillRect(h.x + h.hw - 7, h.y1 - 9, 3, 3);
        if (h.elec) {
          ctx.strokeStyle = warn ? 'rgba(255,225,90,' + (0.4 + 0.6 * (Math.sin(now * 40) > 0 ? 1 : 0)) + ')' : 'rgba(127,212,255,.45)';
          ctx.lineWidth = 2; ctx.strokeRect(h.x - h.hw + 1, h.y0 + 1, h.hw * 2 - 2, H - 2);
          if (on) {
            ctx.fillStyle = 'rgba(150,225,255,.32)'; ctx.fillRect(h.x - h.hw, h.y0, h.hw * 2, H);
            ctx.strokeStyle = '#e8fbff'; ctx.lineWidth = 1.6; ctx.globalCompositeOperation = 'lighter';
            for (i = 0; i < 3; i++) {
              var ax = h.x + (Math.random() - 0.5) * h.hw * 1.6, ay = h.y0 + Math.random() * H, s;
              ctx.beginPath(); ctx.moveTo(ax, ay);
              for (s = 0; s < 5; s++) { ax += (Math.random() - 0.5) * 34; ay += (Math.random() - 0.5) * 50; ctx.lineTo(S.clamp(ax, h.x - h.hw, h.x + h.hw), S.clamp(ay, h.y0, h.y1)); }
              ctx.stroke();
            }
            ctx.globalCompositeOperation = 'source-over';
          }
        }
        break;
    }
  }
  function drawCamp(h, P, now) {
    var x = h.x, y = h.y, i, gate = h.gate;
    if (h.biv) {              // a bivouac: a small ledge with a bedroll and a lamp
      ctx.fillStyle = 'rgba(0,0,0,.4)';
      ctx.beginPath(); ctx.moveTo(x - h.hw + 8, y - 6); ctx.lineTo(x - h.hw + 22, y - 6); ctx.lineTo(x - h.hw + 8, y - 22); ctx.fill();
      ctx.beginPath(); ctx.moveTo(x + h.hw - 8, y - 6); ctx.lineTo(x + h.hw - 22, y - 6); ctx.lineTo(x + h.hw - 8, y - 22); ctx.fill();
      ctx.fillStyle = '#3d2b1b'; rrect(x - h.hw, y - 8, h.hw * 2, 14, 3); ctx.fill();
      ctx.fillStyle = '#7a5a3a'; rrect(x - h.hw, y - 6, h.hw * 2, 12, 3); ctx.fill();
      ctx.fillStyle = '#a57e52'; ctx.fillRect(x - h.hw + 2, y + 3, h.hw * 2 - 4, 3);
      ctx.fillStyle = '#16202f'; rrect(x - 58, y + 6, 34, 9, 4); ctx.fill();
      ctx.fillStyle = P.tent; rrect(x - 57, y + 6.5, 32, 7.5, 3.5); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(x - 36, y + 6.5, 2, 7.5);
      light('#ffcf7a', x + 46, y + 14, 36 + 3 * Math.sin(now * 3 + h.id), 0.7);
      ctx.fillStyle = '#2a2018'; ctx.fillRect(x + 42.5, y + 6, 7, 11);
      ctx.fillStyle = '#ffe9b0'; ctx.fillRect(x + 44, y + 8, 4, 7);
      return;
    }
    if (gate) {               // district gate: a heavy lintel across the whole face
      ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(0, y - 40, C.W, 30);
      ctx.fillStyle = P.lo; ctx.fillRect(0, y - 36, C.W, 22);
      ctx.fillStyle = P.hold; ctx.fillRect(0, y - 18, C.W, 3); ctx.fillRect(0, y - 36, C.W, 2);
      for (i = 20; i < C.W; i += 40) { ctx.fillStyle = P.hi; ctx.fillRect(i - 2, y - 28, 4, 4); }
    }
    ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.lineWidth = 4; ctx.lineCap = 'round';
    line(x - 96, y - 6, x - 70, y - 30); line(x + 96, y - 6, x + 70, y - 30); line(x - 70, y - 30, x + 70, y - 30);
    ctx.fillStyle = '#3d2b1b'; rrect(x - h.hw, y - 8, h.hw * 2, 14, 3); ctx.fill();
    ctx.fillStyle = '#7a5a3a'; rrect(x - h.hw, y - 6, h.hw * 2, 12, 3); ctx.fill();
    ctx.fillStyle = '#a57e52'; ctx.fillRect(x - h.hw + 2, y + 3, h.hw * 2 - 4, 3);
    ctx.fillStyle = 'rgba(0,0,0,.25)'; for (i = -h.hw + 24; i < h.hw; i += 24) ctx.fillRect(x + i, y - 6, 1.5, 12);
    // tent
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.moveTo(x - 92, y + 6); ctx.lineTo(x - 63, y + 44); ctx.lineTo(x - 34, y + 6); ctx.fill();
    ctx.fillStyle = P.tent; ctx.beginPath(); ctx.moveTo(x - 90, y + 6); ctx.lineTo(x - 63, y + 41); ctx.lineTo(x - 36, y + 6); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.beginPath(); ctx.moveTo(x - 70, y + 6); ctx.lineTo(x - 63, y + 26); ctx.lineTo(x - 56, y + 6); ctx.fill();
    // lantern
    ctx.strokeStyle = '#2a2018'; ctx.lineWidth = 2.5; line(x + 74, y + 6, x + 74, y + 46); line(x + 74, y + 46, x + 62, y + 46);
    light('#ffcf7a', x + 62, y + 36, 58 + 4 * Math.sin(now * 3 + h.id), 0.75);
    ctx.fillStyle = '#2a2018'; ctx.fillRect(x + 58, y + 29, 8, 14);
    ctx.fillStyle = '#ffe9b0'; ctx.fillRect(x + 59.5, y + 31, 5, 9);
    // the people who live here
    var npcs = frameSt && frameSt.npcs && h.camp != null ? frameSt.npcs(h.camp) : null;
    if (npcs) for (i = 0; i < npcs.length; i++)
      drawNPC(npcs[i], x + npcs[i].x, y + 6, now, frameSt.sim.p.x, frameSt.speaker === npcs[i].who, P);
  }
  function drawNPC(n, x, fy, now, px, speaking, P) {
    var s = n.scale || 1, f = px < x ? -1 : 1, bob = Math.sin(now * 1.7 + x) * 0.5, by = 16 + bob, hy = by + 11, hc = n.hatCol, i;
    ctx.save(); ctx.translate(x, fy); ctx.scale(s, s); ctx.lineCap = 'round';
    if (n.prop === 'staff') { ctx.strokeStyle = '#1a1410'; ctx.lineWidth = 3.4; line(f * 9, 0, f * 9, 33); ctx.strokeStyle = '#8a6a44'; ctx.lineWidth = 2; line(f * 9, 0, f * 9, 33); }
    if (n.prop === 'pike') {
      ctx.strokeStyle = '#1a1410'; ctx.lineWidth = 3.2; line(f * 9, 0, f * 9, 42); ctx.strokeStyle = '#9aa2a8'; ctx.lineWidth = 1.8; line(f * 9, 0, f * 9, 42);
      ctx.fillStyle = '#d7dde2'; ctx.beginPath(); ctx.moveTo(f * 9 - 3, 41); ctx.lineTo(f * 9, 50); ctx.lineTo(f * 9 + 3, 41); ctx.fill();
    }
    if (n.prop === 'kite') { ctx.fillStyle = '#f4ecd2'; ctx.strokeStyle = 'rgba(90,70,40,.8)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-f * 4, by + 9); ctx.lineTo(-f * 15, by + 1); ctx.lineTo(-f * 4, by - 7); ctx.closePath(); ctx.fill(); ctx.stroke(); }
    if (n.robe) {
      ctx.fillStyle = '#16202f'; ctx.beginPath(); ctx.moveTo(-5.8, by + 7.6); ctx.lineTo(5.8, by + 7.6); ctx.lineTo(8.4, 0); ctx.lineTo(-8.4, 0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = n.coat; ctx.beginPath(); ctx.moveTo(-4.8, by + 6.6); ctx.lineTo(4.8, by + 6.6); ctx.lineTo(7.2, 1); ctx.lineTo(-7.2, 1); ctx.closePath(); ctx.fill();
    } else {
      limb(-2.5, by - 6, -3.6, 0, P); limb(2.5, by - 6, 3.6, 0, P);
      ctx.fillStyle = '#16202f'; rrect(-5.5, by - 7.5, 11, 15, 3.4); ctx.fill();
      ctx.fillStyle = n.coat; rrect(-4.5, by - 6.5, 9, 13, 3); ctx.fill();
    }
    var raise = n.prop === 'staff' || n.prop === 'pike' || n.prop === 'lamp';
    limb(-f * 4.4, by + 5, -f * 6.6, by - 4, P);
    limb(f * 4.4, by + 5, f * (raise ? 8.6 : 6.6), by + (raise ? 2 : -4), P);
    ctx.fillStyle = '#16202f'; circle(0, hy, 5.6);
    ctx.fillStyle = n.skin || '#e8bf98'; circle(0, hy, 4.6);
    ctx.fillStyle = '#16202f'; ctx.fillRect(f * 1.6 - 0.6, hy - 0.4, 1.3, 1.5);
    switch (n.hat) {
      case 'brim': ctx.fillStyle = hc; oval(0, hy + 3.2, 8.8, 1.9); ctx.beginPath(); ctx.arc(0, hy + 3, 4.7, 0, Math.PI); ctx.fill(); break;
      case 'hood': ctx.fillStyle = hc; ctx.beginPath(); ctx.arc(0, hy + 0.6, 5.5, -0.12 * Math.PI, 1.12 * Math.PI); ctx.fill(); ctx.fillStyle = n.skin || '#e8bf98'; circle(f * 0.9, hy - 0.4, 3.4); ctx.fillStyle = '#16202f'; ctx.fillRect(f * 2 - 0.6, hy - 0.4, 1.3, 1.5); break;
      case 'cap': ctx.fillStyle = hc; ctx.beginPath(); ctx.arc(0, hy + 1.4, 4.9, 0, Math.PI); ctx.fill(); ctx.fillRect(f > 0 ? 0 : -7.5, hy + 1.2, 7.5, 1.7); break;
      case 'helmet': ctx.fillStyle = hc; ctx.beginPath(); ctx.arc(0, hy + 0.8, 5.5, 0, Math.PI); ctx.fill(); ctx.fillRect(-6.4, hy + 0.3, 12.8, 1.7); break;
      case 'bun': ctx.fillStyle = n.hair; ctx.beginPath(); ctx.arc(0, hy + 1, 4.9, 0, Math.PI); ctx.fill(); circle(0, hy + 6.2, 2.5); break;
      case 'tall': ctx.fillStyle = hc; ctx.fillRect(-3.8, hy + 3, 7.6, 8.5); oval(0, hy + 3.2, 5.8, 1.5); ctx.fillStyle = '#16202f'; ctx.fillRect(-3.8, hy + 5, 7.6, 1.4); break;
      default: ctx.fillStyle = n.hair || '#3a2a1c'; ctx.beginPath(); ctx.arc(0, hy + 1, 4.9, 0, Math.PI); ctx.fill();
    }
    if (n.prop === 'basket') { ctx.fillStyle = '#3d2b1b'; rrect(-f * 15 - 6, 0, 12, 8.5, 2); ctx.fill(); ctx.fillStyle = '#9a7442'; rrect(-f * 15 - 5, 1, 10, 6.5, 2); ctx.fill(); ctx.fillStyle = '#58e6c0'; circle(-f * 15 - 2, 8, 1.8); circle(-f * 15 + 2, 8.5, 1.6); }
    if (n.prop === 'rope') { ctx.strokeStyle = '#e0bd76'; ctx.lineWidth = 1.7; ctx.beginPath(); ctx.arc(-f * 3.5, by - 4.5, 3.3, 0, TAU); ctx.stroke(); }
    if (n.prop === 'ledger') { ctx.fillStyle = '#16202f'; ctx.fillRect(f * 4.6, by - 6.4, 6.4, 8); ctx.fillStyle = '#e4dcc6'; ctx.fillRect(f * 4.6 + 0.8, by - 5.6, 4.8, 6.4); }
    if (n.prop === 'lamp') { light('#ffcf7a', f * 9, by, 15, 0.8); ctx.fillStyle = '#ffe9b0'; ctx.fillRect(f * 9 - 1.5, by - 1.5, 3, 4); }
    if (speaking) {
      ctx.fillStyle = 'rgba(255,255,255,.94)'; rrect(-9, hy + 10, 18, 10, 4.5); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-2.5, hy + 10.5); ctx.lineTo(0, hy + 7.5); ctx.lineTo(2.5, hy + 10.5); ctx.fill();
      ctx.fillStyle = '#16202f';
      for (i = -1; i <= 1; i++) circle(i * 4.4, hy + 15 + Math.max(0, Math.sin(now * 9 - i * 1.1)) * 1.6, 1.25);
    }
    ctx.restore();
  }
  function drawHolds(Wd, sim, now) {
    var b0 = Wd.bucketOf(cam.bottom - 60), b1 = Wd.bucketOf(cam.bottom + viewH + 60), b, i, list, h, pass;
    frameNo++;
    for (pass = 0; pass < 2; pass++) for (b = b0; b <= b1; b++) {
      list = Wd.grid.holds[b]; if (!list) continue;
      for (i = 0; i < list.length; i++) {
        h = Wd.holds[list[i]];
        if ((h.type === 'plate') !== (pass === 0)) continue;
        if (h._f === frameNo * 2 + pass) continue; h._f = frameNo * 2 + pass;
        drawHold(h, sim, PAL[h.d], now);
      }
    }
    if (sim.pitonHold >= 0) {
      h = Wd.holds[sim.pitonHold];
      var x = S.holdX(h, sim.t) + 13, y = S.holdY(h, sim.t) + 8;
      ctx.strokeStyle = '#d7dde2'; ctx.lineWidth = 3; ctx.lineCap = 'round'; line(x, y, x + 7, y + 9);
      ctx.fillStyle = '#e5484d';
      ctx.beginPath(); ctx.moveTo(x + 7, y + 9); ctx.lineTo(x + 19 + Math.sin(now * 5) * 2, y + 6); ctx.lineTo(x + 15 + Math.sin(now * 5 + 1) * 2, y + 1); ctx.fill();
    }
  }
  function drawSprings(Wd, now) {           // bounce caps
    var b0 = Wd.bucketOf(cam.bottom), b1 = Wd.bucketOf(cam.bottom + viewH), b, i, list, seen = {};
    for (b = b0; b <= b1; b++) {
      list = Wd.grid.springs[b]; if (!list) continue;
      for (i = 0; i < list.length; i++) {
        var s = Wd.springs[list[i]]; if (seen[s.id]) continue; seen[s.id] = 1;
        var age = now - (pops[s.id] || -9), sq = age < 0.35 ? Math.sin(age / 0.35 * Math.PI) : 0;
        var w = 19 + sq * 5, hh = 9 - sq * 4, x = s.x, y = s.y - 4;
        if (s.d === 1 || s.d === 3) {       // a sprung plate
          ctx.strokeStyle = '#0d0a08'; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath();
          ctx.moveTo(x - 7, y - 14); ctx.lineTo(x + 7, y - 10); ctx.lineTo(x - 7, y - 6); ctx.lineTo(x + 7, y - 2 - sq * 2); ctx.stroke();
          ctx.strokeStyle = '#b9c2c9'; ctx.lineWidth = 2; ctx.stroke();
          ctx.fillStyle = '#0d0a08'; rrect(x - w - 1, y - 2 - sq * 3, w * 2 + 2, 9, 3); ctx.fill();
          ctx.fillStyle = s.d === 3 ? '#e7c768' : '#e3b341'; rrect(x - w, y - 1 - sq * 3, w * 2, 7, 2.5); ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.fillRect(x - w + 4, y + 3 - sq * 3, w * 2 - 8, 1.6);
        } else {                            // a mushroom cap (Roots) or a seed pod (Gardens)
          var cap = s.d === 2 ? '#e58aa8' : '#3fbf9d', spot = s.d === 2 ? '#fff2c4' : '#b8ffe9';
          light(s.d === 2 ? '#ffb0c8' : '#58e6c0', x, y + 2, 30, 0.45 + 0.15 * Math.sin(now * 2 + s.id));
          ctx.fillStyle = '#10201b'; ctx.fillRect(x - 4.5, y - 15, 9, 15);
          ctx.fillStyle = s.d === 2 ? '#7da06a' : '#cfe8dc'; ctx.fillRect(x - 3, y - 14, 6, 14);
          ctx.fillStyle = '#10201b'; ctx.beginPath(); ctx.ellipse(x, y - 1, w + 1.5, hh + 1.5, 0, 0, Math.PI); ctx.fill(); ctx.fillRect(x - w - 1.5, y - 3, w * 2 + 3, 3);
          ctx.fillStyle = cap; ctx.beginPath(); ctx.ellipse(x, y - 1, w, hh, 0, 0, Math.PI); ctx.fill(); ctx.fillRect(x - w, y - 2, w * 2, 2);
          ctx.fillStyle = spot; circle(x - 8, y + 3, 2.2); circle(x + 5, y + 5 - sq * 2, 1.8); circle(x + 11, y + 1.5, 1.4);
        }
      }
    }
  }
  function drawTubes(Wd, now, dt) {          // pneumatic tubes: in at the funnel, out at the nozzle
    var i, tb, lo = cam.bottom - 60, hi = cam.bottom + viewH + 60;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (i = 0; i < Wd.tubes.length; i++) {
      tb = Wd.tubes[i];
      if (tb.by + 40 < lo) continue;
      if (tb.ay - 60 > hi) break;
      var ex = tb.ax < C.W / 2 ? 9 : C.W - 9, metal = tb.d === 3 ? '#8e98c4' : '#b9803a', dark = '#120d0a';
      var path = function () {
        ctx.beginPath(); ctx.moveTo(tb.ax, tb.ay - 6); ctx.lineTo(tb.ax, tb.ay - 30); ctx.lineTo(ex, tb.ay - 30);
        ctx.lineTo(ex, tb.by - 34); ctx.lineTo(tb.bx, tb.by - 34); ctx.lineTo(tb.bx, tb.by - 10); ctx.stroke();
      };
      ctx.strokeStyle = dark; ctx.lineWidth = 13; path();
      ctx.strokeStyle = metal; ctx.lineWidth = 9; path();
      ctx.strokeStyle = 'rgba(255,255,255,.28)'; ctx.lineWidth = 2.2; path();
      // a pulse of air travelling up the pipe
      ctx.lineWidth = 1;
      // funnel (entry)
      var pull = 0.5 + 0.5 * Math.sin(now * 5 + tb.id);
      light('#8dffb2', tb.ax, tb.ay + 4, 26 + pull * 6, 0.5);
      ctx.fillStyle = dark; ctx.beginPath(); ctx.moveTo(tb.ax - 20, tb.ay + 9); ctx.lineTo(tb.ax + 20, tb.ay + 9); ctx.lineTo(tb.ax + 8, tb.ay - 9); ctx.lineTo(tb.ax - 8, tb.ay - 9); ctx.closePath(); ctx.fill();
      ctx.fillStyle = metal; ctx.beginPath(); ctx.moveTo(tb.ax - 18, tb.ay + 7.5); ctx.lineTo(tb.ax + 18, tb.ay + 7.5); ctx.lineTo(tb.ax + 6.5, tb.ay - 8); ctx.lineTo(tb.ax - 6.5, tb.ay - 8); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#06110b'; oval(tb.ax, tb.ay + 7, 15, 3.6);
      ctx.strokeStyle = 'rgba(141,255,178,' + (0.35 + 0.5 * pull) + ')'; ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.moveTo(tb.ax - 6, tb.ay + 20 - pull * 5); ctx.lineTo(tb.ax, tb.ay + 13 - pull * 5); ctx.lineTo(tb.ax + 6, tb.ay + 20 - pull * 5); ctx.stroke();
      // nozzle (exit)
      ctx.fillStyle = dark; rrect(tb.bx - 12, tb.by - 12, 24, 15, 3); ctx.fill();
      ctx.fillStyle = metal; rrect(tb.bx - 10.5, tb.by - 11, 21, 12.5, 2.5); ctx.fill();
      ctx.fillStyle = '#06110b'; oval(tb.bx, tb.by + 1.5, 8.5, 2.6);
      if (dt > 0 && Math.random() < 0.08) add(tb.bx + (Math.random() - 0.5) * 8, tb.by + 4, (Math.random() - 0.5) * 16, 40 + Math.random() * 40, 0, 0.5, 2.2, 'rgba(255,255,255,.3)', false, 7);
    }
  }
  function drawVents(Wd, sim, dt) {
    var b0 = Wd.bucketOf(cam.bottom), b1 = Wd.bucketOf(cam.bottom + viewH), b, i, list, seen = {}, t = sim.t;
    for (b = b0; b <= b1; b++) {
      list = Wd.grid.vents[b]; if (!list) continue;
      for (i = 0; i < list.length; i++) {
        var v = Wd.vents[list[i]]; if (seen[v.id]) continue; seen[v.id] = 1;
        var wx = v.side < 0 ? 0 : C.W, dir = -v.side, on = S.ventOn(v, t), warn = S.ventWarn(v, t);
        if (on) {
          var g = ctx.createLinearGradient(wx, 0, wx + dir * 235, 0);
          g.addColorStop(0, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.fillStyle = g; ctx.fillRect(v.x0, v.y - 13, v.x1 - v.x0, 26);
          if (dt > 0) emit('steam', wx + dir * 8, v.y, 2, dir);
        } else if (warn && dt > 0 && Math.random() < 0.5) emit('puff', wx + dir * 12, v.y, 1, dir);
        ctx.fillStyle = '#17110d'; ctx.fillRect(v.side < 0 ? 0 : C.W - 14, v.y - 13, 14, 26);
        ctx.fillStyle = warn ? '#ffb347' : '#6a5644'; ctx.fillRect(v.side < 0 ? 10 : C.W - 14, v.y - 10, 4, 20);
        ctx.fillStyle = '#0a0705'; ctx.fillRect(v.side < 0 ? 0 : C.W - 10, v.y - 6, 10, 12);
      }
    }
  }
  function drawShards(Wd, sim, now) {
    var b0 = Wd.bucketOf(cam.bottom), b1 = Wd.bucketOf(cam.bottom + viewH), b, i, list, seen = {};
    for (b = b0; b <= b1; b++) {
      list = Wd.grid.shards[b]; if (!list) continue;
      for (i = 0; i < list.length; i++) {
        var s = Wd.shards[list[i]];
        if (sim.taken[s.id] || seen[s.id]) continue; seen[s.id] = 1;
        var big = s.v > 1, w = (big ? 7 : 5) * Math.abs(Math.cos(now * 2.4 + s.id)), hh = big ? 11 : 8, y = s.y + Math.sin(now * 2 + s.id) * 2;
        light('#fff3c4', s.x, y, big ? 22 : 15, 0.55);
        ctx.fillStyle = big ? '#ffe9a8' : '#f6f2e4'; ctx.strokeStyle = 'rgba(30,30,30,.55)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(s.x, y + hh); ctx.lineTo(s.x + w + 0.8, y); ctx.lineTo(s.x, y - hh); ctx.lineTo(s.x - w - 0.8, y); ctx.closePath();
        ctx.fill(); ctx.stroke();
      }
    }
  }
  function drawMarks(marks) {
    if (!marks) return;
    ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 2; ctx.lineCap = 'round';
    for (var i = 0; i < marks.length; i++) {
      var x = marks[i][0], y = marks[i][1];
      if (y < cam.bottom - 20 || y > cam.bottom + viewH + 20) continue;
      line(x - 5, y - 26, x + 5, y - 16); line(x + 5, y - 26, x - 5, y - 16);
    }
  }

  /* ---------- the climber ---------- */
  function updateScarf(dt, sim) {
    var p = sim.p, n = 9, i, a, b, dx, dy, d;
    var pose = bodyOf(sim);
    if (!scarf.length) for (i = 0; i < n; i++) scarf.push({ x: pose.bx, y: pose.by + 6 - i * 3 });
    scarf[0].x = pose.bx - p.face * 2; scarf[0].y = pose.by + 6;
    for (i = 1; i < n; i++) {
      a = scarf[i - 1]; b = scarf[i];
      b.y -= 50 * dt; b.x += (-p.face * 14 + Math.sin(sim.t * 4 + i) * 10) * dt;
      dx = b.x - a.x; dy = b.y - a.y; d = Math.sqrt(dx * dx + dy * dy) || 1;
      if (d > 4.2) { b.x = a.x + dx / d * 4.2; b.y = a.y + dy / d * 4.2; }
    }
  }
  function bodyOf(sim) {
    var p = sim.p, h = p.state === 'hold' ? sim.world.holds[p.hold] : null;
    if (h && (h.type === 'ledge' || h.type === 'camp')) return { bx: p.x, by: p.y + 6, pose: 'stand' };
    if (h && h.type === 'plate') return { bx: p.x, by: p.y, pose: 'cling' };
    if (h) return { bx: p.x + Math.sin(sim.t * 2.2) * 1.2, by: p.y - 17, pose: 'hang' };
    return { bx: p.x, by: p.y, pose: p.state === 'zip' ? 'zip' : (p.gliding ? 'glide' : (p.vy > 0 ? 'rise' : 'fall')) };
  }
  function limb(x0, y0, x1, y1, P) {
    if (P.rim) { ctx.strokeStyle = P.rim; ctx.lineWidth = 4.4; line(x0, y0, x1, y1); }
    ctx.strokeStyle = '#263349'; ctx.lineWidth = 2.8; line(x0, y0, x1, y1);
  }
  function drawPlayer(sim, st, P) {
    var p = sim.p;
    if (p.state === 'dead') return;
    var b = bodyOf(sim), bx = b.bx, by = b.by, f = p.face, t = sim.t, i;
    var crouch = (st.aim && st.aim.ok) ? st.aim.power * 3 : 0;
    ctx.lineCap = 'round';

    if (p.state === 'zip') {
      var h = sim.world.holds[p.zipTo];
      ctx.strokeStyle = '#f7e3a1'; ctx.lineWidth = 1.6; line(bx, by + 8, S.holdX(h, t), h.y);
    }
    if (b.pose === 'glide') {
      ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.moveTo(bx - 25, by + 15); ctx.quadraticCurveTo(bx, by + 37, bx + 25, by + 15); ctx.quadraticCurveTo(bx, by + 23, bx - 25, by + 15); ctx.fill();
      ctx.fillStyle = '#f4ecd2'; ctx.beginPath(); ctx.moveTo(bx - 24, by + 17); ctx.quadraticCurveTo(bx, by + 38, bx + 24, by + 17); ctx.quadraticCurveTo(bx, by + 25, bx - 24, by + 17); ctx.fill();
      ctx.strokeStyle = 'rgba(120,100,60,.7)'; ctx.lineWidth = 1; line(bx - 24, by + 17, bx - 5, by + 8); line(bx + 24, by + 17, bx + 5, by + 8); line(bx, by + 27, bx, by + 21);
    }

    // scarf
    ctx.strokeStyle = '#e5484d';
    for (i = 1; i < scarf.length; i++) { ctx.lineWidth = 4 - i * 0.32; line(scarf[i - 1].x, scarf[i - 1].y, scarf[i].x, scarf[i].y); }

    var sh = by + 5, hip = by - 6 + crouch * 0.5;
    if (b.pose === 'hang') {
      var sw = Math.sin(t * 2.2) * 2;
      limb(bx - 3, sh, p.x - 3, p.y - 1, P); limb(bx + 3, sh, p.x + 3, p.y - 1, P);
      limb(bx - 2.5, hip, bx - 3 + sw, hip - 11, P); limb(bx + 2.5, hip, bx + 3 + sw * 1.3, hip - 10, P);
    } else if (b.pose === 'stand') {
      by -= crouch; sh = by + 5; hip = by - 6;
      limb(bx - 2.5, hip, bx - 4, p.y - C.PR, P); limb(bx + 2.5, hip, bx + 4, p.y - C.PR, P);
      limb(bx - 4, sh, bx - 7 - crouch, by - 4 + crouch, P); limb(bx + 4, sh, bx + 7 + crouch, by - 4 + crouch, P);
    } else if (b.pose === 'cling') {
      limb(bx - 4, sh, bx - 10, by + 14, P); limb(bx + 4, sh, bx + 10, by + 14, P);
      limb(bx - 2.5, hip, bx - 8, hip - 9, P); limb(bx + 2.5, hip, bx + 8, hip - 9, P);
    } else if (b.pose === 'rise' || b.pose === 'zip') {
      limb(bx - 4, sh, bx - 5 + f * 3, by + 16, P); limb(bx + 4, sh, bx + 5 + f * 3, by + 16, P);
      limb(bx - 2.5, hip, bx - 3 - f * 4, hip - 10, P); limb(bx + 2.5, hip, bx + 2 - f * 5, hip - 9, P);
    } else if (b.pose === 'glide') {
      limb(bx - 4, sh, bx - 5, by + 9, P); limb(bx + 4, sh, bx + 5, by + 9, P);
      limb(bx - 2.5, hip, bx - 3 - f * 3, hip - 11, P); limb(bx + 2.5, hip, bx + 3 - f * 3, hip - 11, P);
    } else {
      var fl = Math.sin(t * 18) * 3;
      limb(bx - 4, sh, bx - 11, by + 11 + fl, P); limb(bx + 4, sh, bx + 11, by + 11 - fl, P);
      limb(bx - 2.5, hip, bx - 7, hip - 8 - fl, P); limb(bx + 2.5, hip, bx + 7, hip - 8 + fl, P);
    }
    // torso + head
    ctx.fillStyle = '#16202f'; rrect(bx - 5.4, by - 7.4, 10.8, 14.8, 3.4); ctx.fill();
    ctx.fillStyle = '#3f9ac4'; rrect(bx - 4.5, by - 6.5, 9, 13, 3); ctx.fill();
    ctx.fillStyle = '#2f7da2'; ctx.fillRect(bx - 4.5, by - 6.5, 9, 4);
    ctx.fillStyle = '#16202f'; circle(bx, by + 10.5, 5.6);
    ctx.fillStyle = '#f1c9a0'; circle(bx, by + 10.5, 4.6);
    ctx.fillStyle = '#3f9ac4'; ctx.beginPath(); ctx.arc(bx, by + 11, 4.8, 0.15 * Math.PI, 0.85 * Math.PI); ctx.fill();
    ctx.fillStyle = '#e5484d'; ctx.fillRect(bx - 4.6, by + 5, 9.2, 2.6);

    // grip ring
    var fr = p.stamina / sim.mods.stMax;
    if (p.state === 'hold' || fr < 0.999) {
      var cy = by + 2, col = fr > 0.5 ? '#7be07f' : fr > 0.25 ? '#f2d14b' : '#f0554d';
      ctx.strokeStyle = 'rgba(0,0,0,.4)'; ctx.lineWidth = 4.2; ctx.beginPath(); ctx.arc(bx, cy, 22, 0, TAU); ctx.stroke();
      ctx.strokeStyle = col; ctx.lineWidth = 2.6; ctx.lineCap = 'butt';
      ctx.beginPath(); ctx.arc(bx, cy, 22, Math.PI / 2, Math.PI / 2 - TAU * Math.max(0.001, fr), true); ctx.stroke();
      ctx.lineCap = 'round';
    }
  }

  function drawAim(sim, aim, P, now) {
    var pts = aim.pts, i, n = pts.length / 2;
    for (i = 0; i < n; i++) {
      if (pts[i * 2] == null) continue;
      var a = 1 - i / (n + 2);
      ctx.fillStyle = 'rgba(0,0,0,.35)'; circle(pts[i * 2], pts[i * 2 + 1], 3.3 * a + 1);
      ctx.fillStyle = P.aim; ctx.globalAlpha = 0.35 + 0.65 * a; circle(pts[i * 2], pts[i * 2 + 1], 2.3 * a + 0.8); ctx.globalAlpha = 1;
    }
    if (aim.hit >= 0) {
      var h = sim.world.holds[aim.hit], x = S.holdX(h, sim.t), pulse = 2 * Math.sin(now * 8);
      ctx.strokeStyle = P.aim; ctx.lineWidth = 2;
      if (h.type === 'ledge' || h.type === 'camp') { rrect(x - h.hw - 4, h.y - 11, h.hw * 2 + 8, 22, 6); ctx.stroke(); }
      else if (h.type === 'plate') { ctx.strokeRect(h.x - h.hw - 3, h.y0 - 3, h.hw * 2 + 6, h.y1 - h.y0 + 6); }
      else { ctx.beginPath(); ctx.arc(x, S.holdY(h, sim.t), 18 + pulse, 0, TAU); ctx.stroke(); }
    }
  }

  /* ---------- screen-space layers ---------- */
  function drawClouds(Wd, now) {
    var i0 = Math.floor((cam.bottom - 160 / (1.25 * kk)) / 290), i1 = Math.floor((cam.bottom + (ch + 160) / (1.25 * kk)) / 290), i;
    ctx.fillStyle = 'rgba(255,255,255,.12)';
    for (i = i0; i <= i1; i++) {
      var cy = i * 290 + hsh(i, 1) * 180;
      if (cy < 0 || S.districtAt(Wd, cy) < 2) continue;
      var sy = ch - (cy - cam.bottom) * 1.25 * kk, z = (60 + hsh(i, 4) * 70) * kk;
      var sx = ox + (((hsh(i, 2) * 600 + now * (6 + hsh(i, 3) * 14)) % (C.W + 300)) - 150 - cam.x) * kk;
      oval(sx, sy, z, z * 0.32); oval(sx + z * 0.5, sy - z * 0.12, z * 0.7, z * 0.26); oval(sx - z * 0.55, sy + z * 0.08, z * 0.6, z * 0.22);
    }
  }
  /* ---------- set pieces ---------- */
  function setFade(set, y) { return S.clamp(Math.min(y - set.y0, set.y1 - y) / 140, 0, 1); }
  function drawConduits(Wd, sim) {          // The Alternator: two conduits that take turns going live
    var i, k, set, t = sim.t;
    for (i = 0; i < Wd.sets.length; i++) {
      set = Wd.sets[i];
      if (set.type !== 'alt' || set.y1 < cam.bottom || set.y0 > cam.bottom + viewH) continue;
      for (k = -1; k <= 1; k += 2) {
        var o = { elec: true, period: 4.4, dur: 1.0, ph: k < 0 ? 0 : 2.2 }, on = S.plateOn(o, t), warn = S.plateWarn(o, t), x = k < 0 ? 22 : C.W - 22;
        ctx.fillStyle = '#0a0c16'; ctx.fillRect(x - 5, set.y0 + 20, 10, set.y1 - set.y0 - 20);
        ctx.fillStyle = on ? '#e8fbff' : warn ? 'rgba(255,225,90,' + (Math.sin(t * 40) > 0 ? 1 : 0.4) + ')' : '#33416c';
        ctx.fillRect(x - 1.6, set.y0 + 20, 3.2, set.y1 - set.y0 - 20);
        if (on) { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(127,212,255,.22)'; ctx.fillRect(x - 12, set.y0 + 20, 24, set.y1 - set.y0 - 20); ctx.globalCompositeOperation = 'source-over'; }
      }
    }
  }
  function drawSlag(L, now, dt) {           // The Furnace Shaft
    var y0 = cam.bottom - 30, x, g;
    if (L < y0 - 200) return;
    ctx.globalCompositeOperation = 'lighter';
    g = ctx.createLinearGradient(0, L, 0, L + 190); g.addColorStop(0, 'rgba(255,120,30,.42)'); g.addColorStop(1, 'rgba(255,120,30,0)');
    ctx.fillStyle = g; ctx.fillRect(0, L, C.W, 190);
    ctx.globalCompositeOperation = 'source-over';
    if (L < y0) return;
    g = ctx.createLinearGradient(0, L + 6, 0, L - 320);
    g.addColorStop(0, '#fff0a0'); g.addColorStop(0.04, '#ffb43a'); g.addColorStop(0.18, '#f0601a'); g.addColorStop(0.6, '#a81f0a'); g.addColorStop(1, '#4a0a04');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, y0);
    for (x = 0; x <= C.W; x += 12) ctx.lineTo(x, L + Math.sin(x * 0.05 + now * 2) * 3 + Math.sin(x * 0.11 - now * 3.1) * 2);
    ctx.lineTo(C.W, y0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(60,10,4,.55)';
    for (x = 0; x < 5; x++) oval((hsh(x, 3) * 420 + now * (8 + x * 3)) % 420 - 30, L - 14 - hsh(x, 5) * 40, 16 + hsh(x, 7) * 14, 3.5);
    if (dt > 0 && Math.random() < 0.5) add(Math.random() * C.W, L + 2, (Math.random() - 0.5) * 40, 60 + Math.random() * 120, -160, 0.9, 1.6, '#ffb24a', true);
  }
  function drawDark(Wd, sim, a) {           // The Blackout: only a pool of light around you, and fungus on the holds
    if (!darkSpr) {
      darkSpr = document.createElement('canvas'); darkSpr.width = darkSpr.height = 512;
      var c = darkSpr.getContext('2d'), g = c.createRadialGradient(256, 256, 0, 256, 256, 256);
      g.addColorStop(0, 'rgba(2,6,5,0)'); g.addColorStop(0.13, 'rgba(2,6,5,0)'); g.addColorStop(0.34, 'rgba(2,6,5,.93)'); g.addColorStop(1, 'rgba(2,6,5,.93)');
      c.fillStyle = g; c.fillRect(0, 0, 512, 512);
    }
    var ps = toScreen(sim.p.x, sim.p.y + 6), D = 2.7 * Math.max(cw, ch), b, i, list, h;
    screenT(); ctx.globalAlpha = a; ctx.drawImage(darkSpr, ps.x - D / 2, ps.y - D / 2, D, D); ctx.globalAlpha = 1;
    worldT();
    for (b = Wd.bucketOf(cam.bottom); b <= Wd.bucketOf(cam.bottom + viewH); b++) {
      list = Wd.grid.holds[b]; if (!list) continue;
      for (i = 0; i < list.length; i++) {
        h = Wd.holds[list[i]];
        if (h.type === 'plate' || h._g === frameNo) continue; h._g = frameNo;
        var gx = S.holdX(h, sim.t), gy = S.holdY(h, sim.t);
        light('#58e6c0', gx, gy, h.type === 'camp' ? 0 : 17, 0.55 * a);
        if (h.type !== 'camp') { ctx.fillStyle = 'rgba(143,245,216,' + 0.75 * a + ')'; circle(gx + 9, gy - 9, 1.6); circle(gx - 10, gy - 6, 1.2); }
      }
    }
  }
  function drawStorm(a, now) {              // The Thermal Ladder
    var k, x, y;
    ctx.fillStyle = 'rgba(16,26,48,' + 0.34 * a + ')'; ctx.fillRect(0, 0, cw, ch);
    ctx.strokeStyle = 'rgba(205,225,255,' + 0.42 * a + ')'; ctx.lineWidth = 1.3; ctx.lineCap = 'round';
    for (k = 0; k < 70; k++) {
      y = (hsh(k, 2) * ch + now * (820 + hsh(k, 3) * 420)) % (ch + 40) - 20;
      x = ((hsh(k, 1) * (cw + 200) - now * 210) % (cw + 200) + cw + 200) % (cw + 200) - 100;
      line(x, y, x - 7, y + 24);
    }
    if (flashA > 0) { ctx.fillStyle = 'rgba(235,242,255,' + 0.6 * flashA * a + ')'; ctx.fillRect(0, 0, cw, ch); }
  }
  function drawGhost(g, now) {              // your best run today
    ctx.globalAlpha = 0.4; ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.6; ctx.lineCap = 'round';
    rrect(g.x - 4.5, g.y - 6.5, 9, 13, 3); ctx.fill(); circle(g.x, g.y + 10.5, 4.6);
    line(g.x, g.y + 6, g.x - 9, g.y + 3 + Math.sin(now * 6) * 2);
    ctx.globalAlpha = 1;
  }

  function overlay() {
    if (!vig) {
      vig = document.createElement('canvas'); vig.width = vig.height = 256;
      var c = vig.getContext('2d'), g = c.createRadialGradient(128, 128, 70, 128, 128, 182);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.5)');
      c.fillStyle = g; c.fillRect(0, 0, 256, 256);
      vigRed = document.createElement('canvas'); vigRed.width = vigRed.height = 256;
      c = vigRed.getContext('2d'); g = c.createRadialGradient(128, 128, 80, 128, 128, 182);
      g.addColorStop(0, 'rgba(240,60,50,0)'); g.addColorStop(1, 'rgba(240,60,50,.7)');
      c.fillStyle = g; c.fillRect(0, 0, 256, 256);
    }
  }

  function frame(st) {
    var Wd = st.world, sim = st.sim, d = S.districtAt(Wd, cam.y), P = PAL[d], wide = ox > 1, g;
    var set = S.setAt(Wd, sim.p.y), sa = set ? setFade(set, sim.p.y) : 0;
    frameSt = st;
    screenT();
    if (wide) {
      g = ctx.createLinearGradient(0, 0, 0, ch); g.addColorStop(0, P.sky[0]); g.addColorStop(1, P.sky[1]);
      ctx.fillStyle = g; ctx.fillRect(0, 0, cw, ch);
    }
    ctx.save();
    if (wide) { ctx.beginPath(); ctx.rect(ox, 0, C.W * sc, ch); ctx.clip(); }
    worldT();
    drawWall(Wd, st.now);
    drawZones(Wd, sim.t, st.now);
    drawMarks(st.marks);
    drawConduits(Wd, sim);
    drawTubes(Wd, st.now, st.dt);
    drawHolds(Wd, sim, st.now);
    drawSprings(Wd, st.now);
    drawVents(Wd, sim, st.dt);
    drawShards(Wd, sim, st.now);
    if (sim.rise.on) drawSlag(sim.rise.level, st.now, st.dt);
    if (st.ghost) drawGhost(st.ghost, st.now);
    drawPlayer(sim, st, PAL[S.districtAt(Wd, sim.p.y)]);
    drawParts();
    if (set && set.type === 'dark' && sa > 0.01) drawDark(Wd, sim, sa);
    if (st.aim && st.aim.ok) drawAim(sim, st.aim, PAL[S.districtAt(Wd, sim.p.y)], st.now);
    screenT();
    drawClouds(Wd, st.now);
    if (set && set.type === 'storm' && sa > 0.01) drawStorm(sa, st.now);
    if (sim.rise.on) {                      // heat on your heels
      var heat = S.clamp(1 - (sim.p.y - sim.rise.level) / 520, 0, 1);
      if (heat > 0) { ctx.fillStyle = 'rgba(255,90,20,' + 0.22 * heat + ')'; ctx.fillRect(0, 0, cw, ch); }
    }
    // depth haze: the drop below you
    g = ctx.createLinearGradient(0, ch, 0, ch * 0.62);
    g.addColorStop(0, 'rgba(' + P.fog + ',.62)'); g.addColorStop(1, 'rgba(' + P.fog + ',0)');
    ctx.fillStyle = g; ctx.fillRect(ox, ch * 0.62, C.W * sc, ch * 0.38);
    ctx.restore();
    screenT();
    if (wide) {
      ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(ox - 3, 0, 3, ch); ctx.fillRect(ox + C.W * sc, 0, 3, ch);
    }
    overlay();
    ctx.drawImage(vig, 0, 0, cw, ch);
    var fr = sim.p.stamina / sim.mods.stMax;
    if (fr < 0.3 && sim.p.state === 'hold' && st.playing) {
      ctx.globalAlpha = (1 - fr / 0.3) * (0.45 + 0.35 * Math.sin(st.now * 9));
      ctx.drawImage(vigRed, 0, 0, cw, ch); ctx.globalAlpha = 1;
    }
    if (st.stick) {             // glide steering: a rail under your finger, the knob shows how hard you are steering
      var kx = S.clamp(st.stick.x - st.stick.sx, -st.stick.max, st.stick.max);
      ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 7; line(st.stick.sx - st.stick.max, st.stick.sy, st.stick.sx + st.stick.max, st.stick.sy);
      ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 3; line(st.stick.sx - st.stick.max, st.stick.sy, st.stick.sx + st.stick.max, st.stick.sy);
      ctx.fillStyle = 'rgba(255,255,255,.3)'; circle(st.stick.sx, st.stick.sy, 5);
      ctx.fillStyle = 'rgba(0,0,0,.35)'; circle(st.stick.sx + kx, st.stick.sy, 15);
      ctx.fillStyle = 'rgba(255,255,255,.9)'; circle(st.stick.sx + kx, st.stick.sy, 12);
    }
  }

  S.Render = {
    init: init, resize: resize, frame: frame, update: update, snap: snap, toWorld: toWorld, toScreen: toScreen, emit: emit,
    shake: function (a) { cam.shake = Math.max(cam.shake, a); },
    flash: function () { flashA = 1; },
    setWorld: function () { parts.length = 0; pops = {}; },
    pop: function (id, now) { pops[id] = now; },
    scale: function () { return sc; },      // base scale (zoom 1): drag distances are measured in this
    cam: cam
  };
})();
