/* Spire — game flow: input, HUD, camps, story, saving. */
(function () {
  'use strict';
  var S = window.Spire, C = S.C, R = S.Render, A = S.Audio, ST = S.Story;
  var $ = function (id) { return document.getElementById(id); };
  var KEY = 'spire.save.v1';

  var world = S.generate();
  var sim, save, mode = 'title';
  var ptr = { down: false, id: -1, sx: 0, sy: 0, x: 0, y: 0, t0: 0, moved: 0, kind: '', noTap: false };
  var aim = null, now = 0, last = 0, acc = 0, respawnAt = 0, dirty = false, saveT = 0, hintT = 0, toastT = 0;
  var dlg = { lines: null, i: 0, typing: false, full: '', shown: 0, done: null, choosing: false, tick: 0 };
  var hudCache = {};
  var totalChalk = world.shards.reduce(function (a, s) { return a + s.v; }, 0);

  /* ---------- save ---------- */
  function freshSave(set) {
    return { v: 1, camp: 0, maxCamp: 0, visited: { 0: 1 }, seen: {}, chalk: 0, got: 0, upg: {}, flags: {}, taken: {},
             marks: [], falls: 0, time: 0, hints: {}, ending: null, started: false,
             set: set || { sling: false, sound: true, fs: true } };
  }
  function load() {
    try { var s = JSON.parse(localStorage.getItem(KEY)); if (s && s.v === 1 && s.set) return s; } catch (e) {}
    return null;
  }
  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(save)); } catch (e) {}
    dirty = false; saveT = now;
  }
  function mods() {
    var u = save.upg, f = save.flags;
    return {
      stMax: C.ST_MAX + 20 * (u.lungs || 0) + (f.kept ? 10 : 0),
      vmax: C.VMAX * (1 + 0.05 * (u.legs || 0)),
      drain: 1 - 0.15 * (u.hands || 0),
      pitonMax: 2 + (u.sling || 0) + (f.ledger ? 1 : 0)
    };
  }
  function applyMods() {
    var m = mods(), k;
    for (k in m) sim.mods[k] = m[k];
    sim.tools = S.toolsFor(save.maxCamp);
  }
  function startSim() {
    sim = S.createSim(world, { checkpoint: world.camps[save.camp].hold, taken: save.taken, mods: mods(), tools: S.toolsFor(save.maxCamp) });
    R.snap(sim);
    aim = null; acc = 0;
  }

  /* ---------- small UI helpers ---------- */
  function show(el) { el.classList.remove('hidden'); }
  function hide(el) { el.classList.add('hidden'); }
  function fade(v) { $('fade').style.opacity = v; }
  function vibrate(ms) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {} }
  function toast(text, dur) {
    var el = $('toast'); el.textContent = text; el.classList.add('show'); toastT = now + (dur || 4.5);
  }
  function hint(key, force) {
    if (save.hints[key]) return false;
    if (!force && now < toastT) return false;
    save.hints[key] = 1; dirty = true;
    toast(ST.hints[key], 5.5);
    return true;
  }
  function metres(y) { return Math.max(0, Math.round(y * C.M_PER_UNIT)); }
  function fmtTime(s) { s = Math.round(s); var m = Math.floor(s / 60); return m + ':' + ('0' + (s % 60)).slice(-2); }
  function goFullscreen() {
    if (!save.set.fs || document.fullscreenElement || document.webkitFullscreenElement) return;
    var el = document.documentElement, f = el.requestFullscreen || el.webkitRequestFullscreen;
    if (!f) return;
    try { var pr = f.call(el); if (pr && pr.catch) pr.catch(function () {}); } catch (e) {}
  }

  /* ---------- dialogue ---------- */
  function talk(lines, done) {
    mode = 'talk'; aim = null; ptr.down = false;
    toastT = 0; $('toast').classList.remove('show');
    dlg.lines = lines; dlg.i = 0; dlg.done = done; dlg.choosing = false;
    $('dlg-choices').innerHTML = '';
    show($('dialogue'));
    nextLine();
  }
  function nextLine() {
    if (dlg.i >= dlg.lines.length) {
      var d = dlg.done; dlg.done = null; dlg.typing = false;
      hide($('dialogue'));
      if (d) d();
      return;
    }
    var l = dlg.lines[dlg.i++];
    $('dlg-who').textContent = l[0]; $('dlg-who').style.display = l[0] ? '' : 'none';
    $('dialogue').classList.toggle('narr', !l[0]);
    dlg.full = l[1]; dlg.shown = 0; dlg.typing = true;
    $('dlg-text').textContent = ''; $('dlg-next').style.visibility = 'hidden';
  }
  function typeTick(dt) {
    dlg.shown += dt * 70;
    var n = Math.floor(dlg.shown);
    if (n >= dlg.full.length) { dlg.typing = false; $('dlg-text').textContent = dlg.full; $('dlg-next').style.visibility = dlg.choosing ? 'hidden' : 'visible'; return; }
    $('dlg-text').textContent = dlg.full.slice(0, n);
    if (now - dlg.tick > 0.07) { dlg.tick = now; A.sfx('text'); }
  }
  function tapDialogue() {
    if (mode !== 'talk' || dlg.choosing) return;
    if (dlg.typing) { dlg.typing = false; $('dlg-text').textContent = dlg.full; $('dlg-next').style.visibility = 'visible'; }
    else { A.sfx('ui'); nextLine(); }
  }
  // Shows buttons under the current line; calls cb(option).
  function choose(prompt, options, cb) {
    mode = 'talk'; dlg.choosing = true; dlg.typing = false;
    show($('dialogue')); $('dialogue').classList.add('narr');
    $('dlg-who').style.display = 'none'; $('dlg-text').textContent = prompt; $('dlg-next').style.visibility = 'hidden';
    var box = $('dlg-choices'); box.innerHTML = '';
    options.forEach(function (o) {
      var b = document.createElement('button'); b.className = 'btn'; b.textContent = o.label;
      b.addEventListener('click', function (e) {
        e.stopPropagation(); A.sfx('buy');
        dlg.choosing = false; box.innerHTML = ''; hide($('dialogue'));
        cb(o);
      });
      box.appendChild(b);
    });
  }

  /* ---------- camps and story ---------- */
  function resume() { mode = 'play'; acc = 0; last = 0; }

  function arriveCamp(idx) {
    if (sim.p.lastHold === world.camps[idx].hold && save.seen[idx]) return;   // just a hop along the same camp
    var first = !save.seen[idx];
    save.camp = idx; save.visited[idx] = 1;
    if (idx > save.maxCamp) save.maxCamp = idx;
    applyMods();
    A.sfx('camp');
    if (first) { save.seen[idx] = 1; persist(); story(idx); }
    else { persist(); if (now > toastT) toast(ST.camps[idx].name + '. Climb saved.', 2.5); }
  }

  function story(idx) {
    var c = ST.camps[idx];
    var finish = function () {
      if (c.unlock) {
        A.sfx('tool');
        var k = c.unlock === 'grapple' ? 'anchor' : c.unlock === 'glider' ? 'draft' : 'plate';
        save.hints[k] = 1; toastT = 0; toast(ST.hints[k], 7);
      } else if (idx === 0) {
        hint(save.set.sling ? 'start_sling' : 'start_swipe', true);
      } else if (idx === 2) { hint('piton', true); }
      persist();
      if (idx === world.camps.length - 1) { ending(); return; }
      if (idx === 1) { openCamp(); return; }
      resume();
    };
    var afterChoice = function () { if (c.outro) talk(c.outro, finish); else finish(); };
    talk(c.lines, function () {
      if (!c.choice || idx === world.camps.length - 1) { afterChoice(); return; }
      choose(c.lines[c.lines.length - 1][1], c.choice.options, function (o) {
        save.flags[o.flag] = 1;
        if (o.flag === 'seal') { save.chalk += 25; }
        applyMods();
        if (o.flag === 'kept') sim.p.stamina = sim.mods.stMax;
        if (o.flag === 'ledger') sim.pitons = sim.mods.pitonMax;
        persist();
        talk(o.after, afterChoice);
      });
    });
  }

  function ending() {
    var E = ST.endings, opts = [{ label: E.horn.label, id: 'horn' }, { label: E.voice.label, id: 'voice' }];
    if (save.flags.kind && save.flags.valve) opts.push({ label: E.door.label, id: 'door' });
    choose('The petition is still in your pack. There is no one here to read it.', opts, function (o) {
      save.ending = o.id; persist();
      talk(ST.epilogue(o.id, save.flags).map(function (t) { return ['', t]; }), function () { endCard(o.id); });
    });
  }
  function endCard(id) {
    var E = ST.endings[id];
    mode = 'end';
    var html = '<h2>' + E.name + '</h2><div class="sub">The climb is over</div>' +
      '<div class="stats">' +
      '<div><b>' + fmtTime(save.time) + '</b><span>Time</span></div>' +
      '<div><b>' + save.falls + '</b><span>Falls</span></div>' +
      '<div><b>' + save.got + ' / ' + totalChalk + '</b><span>Chalk found</span></div>' +
      '<div><b>' + metres(world.top) + ' m</b><span>Climbed</span></div></div>' +
      '<p>' + (id === 'door' ? 'This is the rarest ending.' :
               'There are three endings. One of them only opens for a courier who shared water at the gate and turned the valve in the Works.') + '</p>' +
      '<button class="btn primary" data-act="explore">Keep exploring</button>' +
      '<button class="btn" data-act="title">Back to title</button>';
    panel(html);
  }

  function openCamp() {
    if (sim.p.state !== 'hold' || world.holds[sim.p.hold].type !== 'camp') return;
    mode = 'camp'; aim = null; ptr.down = false;
    var idx = world.holds[sim.p.hold].camp, c = ST.camps[idx], html, i;
    html = '<span class="purse">&#9670; ' + save.chalk + '</span><h2>' + c.name + '</h2>' +
      '<div class="sub">' + S.DISTRICTS[world.camps[idx].d].name + ' &middot; ' + metres(world.camps[idx].y) + ' m</div><h3>Riggers</h3>';
    ST.upgrades.forEach(function (u) {
      var lv = save.upg[u.id] || 0, max = u.costs.length, cost = u.costs[lv], pips = '';
      for (i = 0; i < max; i++) pips += i < lv ? '&#9679;' : '&#9675;';
      html += '<div class="row"><div class="grow"><div class="name">' + u.name + '</div><div class="desc">' + u.desc + '</div><div class="pips">' + pips + '</div></div>' +
        (lv >= max ? '<button class="buy" disabled>Max</button>'
                   : '<button class="buy" data-buy="' + u.id + '"' + (save.chalk < cost ? ' disabled' : '') + '>&#9670; ' + cost + '</button>') + '</div>';
    });
    html += '<div style="height:14px"></div><button class="btn primary" data-act="resume">Climb on</button>';
    var others = Object.keys(save.visited).map(Number).filter(function (k) { return k !== idx; }).sort(function (a, b) { return a - b; });
    if (others.length) {
      html += '<h3>Lift</h3><div class="lift">';
      others.forEach(function (k) { html += '<button class="chip" data-lift="' + k + '">' + ST.camps[k].name + ' &middot; ' + metres(world.camps[k].y) + ' m</button>'; });
      html += '</div>';
    }
    panel(html);
  }

  function openPause() {
    if (mode !== 'play') return;
    mode = 'pause'; aim = null; ptr.down = false; persist();
    renderPause();
  }
  function renderPause() {
    panel('<h2>Paused</h2><div class="sub">' + metres(sim.p.y) + ' m &middot; ' + fmtTime(save.time) + ' &middot; ' + save.falls + ' falls</div>' +
      '<button class="btn primary" data-act="resume">Resume</button>' +
      '<button class="btn" data-set="sling">' + aimLabel() + '</button>' +
      '<button class="btn" data-set="sound">' + soundLabel() + '</button>' +
      '<button class="btn" data-set="fs">' + fsLabel() + '</button>' +
      '<button class="btn" data-act="tocamp">Return to last camp</button>' +
      '<button class="btn" data-act="title">Save and quit to title</button>');
  }
  function aimLabel() { return 'Aim: ' + (save.set.sling ? 'slingshot (pull back)' : 'swipe (drag forward)'); }
  function soundLabel() { return 'Sound: ' + (save.set.sound ? 'on' : 'off'); }
  function fsLabel() { return 'Fullscreen: ' + (save.set.fs ? 'on' : 'off'); }
  function panel(html) { $('panel-card').innerHTML = html; $('panel-card').scrollTop = 0; show($('panel')); }
  function closePanel() { hide($('panel')); }

  function toggleSetting(k) {
    save.set[k] = !save.set[k];
    if (k === 'sound') A.setMuted(!save.set.sound);
    if (k === 'fs') {
      if (save.set.fs) goFullscreen();
      else if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(function () {});
    }
    persist(); A.sfx('ui');
  }

  $('panel').addEventListener('click', function (e) {
    var t = e.target.closest('button'); if (!t) return;
    var act = t.getAttribute('data-act'), buy = t.getAttribute('data-buy'), lift = t.getAttribute('data-lift'), set = t.getAttribute('data-set');
    if (set) { toggleSetting(set); renderPause(); return; }
    if (buy) {
      var u = ST.upgrades.filter(function (x) { return x.id === buy; })[0], lv = save.upg[buy] || 0, cost = u.costs[lv];
      if (save.chalk >= cost) {
        save.chalk -= cost; save.upg[buy] = lv + 1; applyMods();
        sim.p.stamina = sim.mods.stMax; sim.pitons = sim.mods.pitonMax;
        persist(); A.sfx('buy'); openCamp();
      }
      return;
    }
    if (lift != null) {
      var k = +lift; save.camp = k; sim.checkpoint = world.camps[k].hold; S.respawn(sim); R.snap(sim);
      persist(); closePanel(); A.sfx('zip'); toast(ST.camps[k].name, 2.5); resume(); return;
    }
    A.sfx('ui');
    if (act === 'resume' || act === 'explore') { closePanel(); resume(); }
    else if (act === 'tocamp') { sim.checkpoint = world.camps[save.camp].hold; S.respawn(sim); R.snap(sim); closePanel(); resume(); }
    else if (act === 'title') { persist(); closePanel(); showTitle(); }
  });

  /* ---------- title ---------- */
  function showTitle() {
    mode = 'title'; hide($('hud')); aim = null;
    $('btn-continue').classList.toggle('hidden', !save.started);
    $('btn-new').textContent = save.started ? 'New climb' : 'Begin the climb';
    $('btn-new').className = 'btn' + (save.started ? '' : ' primary');
    $('btn-new').removeAttribute('data-sure');
    $('set-aim').textContent = aimLabel(); $('set-sound').textContent = soundLabel(); $('set-fs').textContent = fsLabel();
    show($('title'));
  }
  function enterGame() {
    hide($('title')); show($('hud'));
    A.init(); A.setMuted(!save.set.sound); goFullscreen();
    save.started = true;
    startSim(); hudCache = {};
    if (!save.seen[save.camp]) { save.seen[save.camp] = 1; persist(); story(save.camp); }
    else { persist(); resume(); }
  }
  $('btn-continue').addEventListener('click', enterGame);
  $('btn-new').addEventListener('click', function () {
    var b = $('btn-new');
    if (save.started && !b.getAttribute('data-sure')) {
      b.setAttribute('data-sure', '1'); b.textContent = 'Erase progress and start over?'; b.className = 'btn danger';
      return;
    }
    save = freshSave(save.set);
    enterGame();
  });
  $('set-aim').addEventListener('click', function () { toggleSetting('sling'); $('set-aim').textContent = aimLabel(); });
  $('set-sound').addEventListener('click', function () { A.init(); toggleSetting('sound'); $('set-sound').textContent = soundLabel(); });
  $('set-fs').addEventListener('click', function () { toggleSetting('fs'); $('set-fs').textContent = fsLabel(); });

  /* ---------- HUD ---------- */
  function setText(id, v) { if (hudCache[id] !== v) { hudCache[id] = v; $(id).textContent = v; } }
  function hud() {
    if (mode === 'title') return;
    var p = sim.p;
    setText('alt-m', metres(p.y).toLocaleString('en-US'));
    setText('alt-d', S.DISTRICTS[S.districtAt(world, p.y)].name);
    setText('chalk-n', save.chalk);
    setText('piton-n', sim.pitons);
    var atCamp = p.state === 'hold' && world.holds[p.hold].type === 'camp' && mode === 'play';
    if (hudCache.camp !== atCamp) { hudCache.camp = atCamp; $('btn-camp').classList.toggle('hidden', !atCamp); }
    var can = sim.pitons > 0;
    if (hudCache.pit !== can) { hudCache.pit = can; $('btn-piton').disabled = !can; }
    if (toastT && now > toastT) { toastT = 0; $('toast').classList.remove('show'); }
  }
  $('btn-pause').addEventListener('click', function () { A.sfx('ui'); openPause(); });
  $('btn-camp').addEventListener('click', function () { if (mode === 'play') { A.sfx('ui'); openCamp(); } });
  $('btn-piton').addEventListener('click', function () {
    if (mode !== 'play') return;
    if (!S.placePiton(sim)) { A.sfx('nograpple'); toast('Hang from a plain hold or ledge to set a piton.', 2.5); }
  });
  $('dialogue').addEventListener('click', tapDialogue);

  /* ---------- sim events ---------- */
  function onEvents() {
    var evs = sim.events, i, e, h, p = sim.p;
    for (i = 0; i < evs.length; i++) {
      e = evs[i];
      switch (e.type) {
        case 'leap': A.sfx('leap', e.a); R.emit('chalk', p.x, p.y, 4); break;
        case 'grab':
          h = world.holds[e.a];
          A.sfx(h.type === 'ledge' || h.type === 'camp' ? 'ledge' : 'grab');
          R.emit('dust', p.x, p.y - 4, 6);
          if (ptr.down) { ptr.sx = ptr.x; ptr.sy = ptr.y; ptr.kind = 'aim'; ptr.noTap = true; }
          p.wantGlide = false;
          if (h.type === 'grip' && (save.hints.start_swipe || save.hints.start_sling)) hint('grip');
          break;
        case 'camp': arriveCamp(e.a); break;
        case 'shard':
          save.chalk += e.a; save.got += e.a; dirty = true; A.sfx('shard');
          R.emit('pickup', world.shards[e.b].x, world.shards[e.b].y, 8); hint('shard');
          break;
        case 'fall':
          save.falls++; dirty = true;
          if (p.lastHold >= 0) {
            h = world.holds[p.lastHold];
            save.marks.push([Math.round(h.x + (Math.random() - 0.5) * 16), Math.round(h.type === 'plate' ? h.y0 : h.y)]);
            if (save.marks.length > 40) save.marks.shift();
          }
          A.sfx('fall'); vibrate(40); respawnAt = now + 0.85; fade(1); aim = null;
          break;
        case 'crumble': A.sfx('crumble'); R.emit('debris', world.holds[e.a].x, world.holds[e.a].y, 9); R.shake(3); break;
        case 'slip': A.sfx('slip'); R.shake(2); toast('Your grip gave out.', 2); break;
        case 'knock': A.sfx('knock'); R.shake(6); vibrate(20); break;
        case 'shock': A.sfx('shock'); R.emit('spark', p.x, p.y, 14); R.shake(7); vibrate(30); break;
        case 'zip': A.sfx('zip'); break;
        case 'nograpple': A.sfx('nograpple'); break;
        case 'piton': A.sfx('piton'); toast('Piton set. You will return here if you fall.', 2.5); break;
      }
    }
    evs.length = 0;
  }

  // Explains a mechanic the first time it comes into view.
  function checkHints() {
    if (now - hintT < 0.5 || now < toastT) return;
    hintT = now;
    var p = sim.p, b = world.bucketOf(p.y + 120), list, i, h;
    list = world.grid.holds[b];
    if (list) for (i = 0; i < list.length; i++) {
      h = world.holds[list[i]];
      if (h.y < p.y - 40 || h.y > p.y + 320) continue;
      var k = h.type === 'plate' ? (h.elec ? 'eplate' : 'plate') : h.type;
      if (ST.hints[k] && !save.hints[k] && k !== 'grip' && k !== 'camp') { if (hint(k)) return; }
    }
    if (world.grid.vents[b] && !save.hints.vent && hint('vent')) return;
    if (world.grid.winds[b] && !save.hints.wind && hint('wind')) return;
    if (world.grid.drafts[b] && !save.hints.draft && hint('draft')) return;
  }

  /* ---------- input ---------- */
  var cv = $('cv');
  cv.addEventListener('pointerdown', function (e) {
    if (mode !== 'play' || ptr.down) return;
    e.preventDefault();
    A.init();
    ptr.down = true; ptr.id = e.pointerId; ptr.sx = ptr.x = e.clientX; ptr.sy = ptr.y = e.clientY;
    ptr.t0 = now; ptr.moved = 0; ptr.noTap = false;
    ptr.kind = sim.p.state === 'hold' ? 'aim' : 'air';
    try { cv.setPointerCapture(e.pointerId); } catch (_) {}
  });
  cv.addEventListener('pointermove', function (e) {
    if (!ptr.down || e.pointerId !== ptr.id) return;
    ptr.x = e.clientX; ptr.y = e.clientY;
    var dx = ptr.x - ptr.sx, dy = ptr.y - ptr.sy;
    ptr.moved = Math.max(ptr.moved, Math.sqrt(dx * dx + dy * dy));
  });
  function release(e, cancelled) {
    if (!ptr.down || e.pointerId !== ptr.id) return;
    ptr.down = false;
    if (mode !== 'play') { aim = null; return; }
    var p = sim.p, tap = !ptr.noTap && now - ptr.t0 < 0.28 && ptr.moved < 12;
    if (!cancelled && p.state === 'hold' && aim && aim.ok) S.leap(sim, aim.vx, aim.vy);
    else if (!cancelled && tap && sim.tools.grapple) { var w = R.toWorld(e.clientX, e.clientY); S.grapple(sim, w.x, w.y); }
    aim = null; p.wantGlide = false;
  }
  cv.addEventListener('pointerup', function (e) { release(e, false); });
  cv.addEventListener('pointercancel', function (e) { release(e, true); });
  cv.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  document.addEventListener('touchmove', function (e) { if (e.target === cv) e.preventDefault(); }, { passive: false });

  function updateInput() {
    var p = sim.p;
    if (!ptr.down) { aim = null; p.wantGlide = false; return; }
    if (p.state === 'hold') {
      if (ptr.kind !== 'aim') { ptr.kind = 'aim'; ptr.sx = ptr.x; ptr.sy = ptr.y; ptr.noTap = true; }
      var k = R.scale(), dx = (ptr.x - ptr.sx) / k, dy = -(ptr.y - ptr.sy) / k;
      if (save.set.sling) { dx = -dx; dy = -dy; }
      var len = Math.sqrt(dx * dx + dy * dy);
      p.wantGlide = false;
      if (len < C.DRAG_MIN) { aim = null; return; }
      var pow = Math.min(1, len / C.DRAG_FULL), v = pow * sim.mods.vmax, vx = dx / len * v, vy = dy / len * v;
      var pv = S.preview(sim, vx, vy, 0.85);
      aim = { ok: true, vx: vx, vy: vy, power: pow, pts: pv.pts, hit: pv.hit };
    } else if (p.state === 'air') {
      aim = null;
      if (ptr.kind === 'aim') { ptr.kind = 'air'; ptr.t0 = now - 1; ptr.noTap = true; }
      p.wantGlide = sim.tools.glider && now - ptr.t0 > 0.13;
      if (p.wantGlide) { var w = R.toWorld(ptr.x, ptr.y); p.steer = S.clamp((w.x - p.x) / 50, -1, 1); }
    } else { aim = null; p.wantGlide = false; }
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { if (mode === 'play') openPause(); else if (mode === 'pause') { closePanel(); resume(); } }
    else if ((e.key === ' ' || e.key === 'Enter') && mode === 'talk') { e.preventDefault(); tapDialogue(); }
    else if (e.key === 'p' && mode === 'play') $('btn-piton').click();
  });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { if (mode === 'play') openPause(); else if (save) persist(); A.suspend(true); }
    else A.suspend(false);
  });
  window.addEventListener('resize', function () { R.resize(); if (sim) R.snap(sim); });

  /* ---------- main loop ---------- */
  function loop(ts) {
    requestAnimationFrame(loop);
    var t = ts / 1000, dt = last ? Math.min(0.1, t - last) : 0;
    last = t; now = t;
    if (mode === 'play') {
      updateInput();
      acc += dt;
      var n = 0;
      while (acc >= C.DT && n < 14) {
        S.step(sim, C.DT); acc -= C.DT; n++;
        if (sim.events.length) onEvents();
        if (mode !== 'play') { acc = 0; break; }
      }
      if (n === 14) acc = 0;
      save.time += dt;
      if (sim.p.state === 'dead' && now >= respawnAt) { S.respawn(sim); R.snap(sim); fade(0); }
      if (mode === 'play') checkHints();
      if (dirty && now - saveT > 4) persist();
      A.glide(sim.p.gliding);
    } else A.glide(false);
    if (dlg.typing) typeTick(dt);
    R.update(dt, sim, aim);
    R.frame({ world: world, sim: sim, now: t, dt: mode === 'play' ? dt : 0, aim: mode === 'play' ? aim : null, marks: save.marks, playing: mode === 'play' });
    hud();
    A.ambience(S.districtAt(world, sim.p.y), S.clamp(sim.p.y / world.top, 0, 1), mode !== 'title');
  }

  /* ---------- boot ---------- */
  save = load() || freshSave();
  R.init(cv);
  startSim();
  showTitle();
  requestAnimationFrame(loop);

  // Console helpers for development: Spire.dev.warp(8) jumps to camp 8 with its tools unlocked.
  S.dev = {
    state: function () { return { sim: sim, save: save, world: world, mode: mode }; },
    warp: function (i) {
      i = S.clamp(i | 0, 0, world.camps.length - 1);
      save.camp = i; save.maxCamp = Math.max(save.maxCamp, i);
      for (var k = 0; k <= i; k++) { save.visited[k] = 1; save.seen[k] = 1; }
      applyMods(); sim.checkpoint = world.camps[i].hold; S.respawn(sim); R.snap(sim);
    }
  };
})();
