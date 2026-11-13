/* Spire — game flow: input, HUD, camps, story, daily tower, saving. */
(function () {
  'use strict';
  var S = window.Spire, C = S.C, R = S.Render, A = S.Audio, ST = S.Story;
  var $ = function (id) { return document.getElementById(id); };
  var KEY = 'spire.save.v1', KEY_D = 'spire.daily.v1', KEY_E = 'spire.endless.v1', WORLD_V = 5;
  var STEER_PX = 70;          // finger travel for full glide steering

  // baseWorld is the story tower everyone starts on (and challenges use); mainWorld is the tower of the
  // current playthrough, remixed for New Game+.
  var baseWorld = S.generate(C.SEED, S.MAIN_PLAN, { lore: true }), mainWorld = baseWorld, world = mainWorld;
  var sim, save, daily, endless, run = null, mode = 'title';      // run: a daily or endless run in progress
  var ptr = { down: false, dead: false, id: -1, sx: 0, sy: 0, x: 0, y: 0, t0: 0, moved: 0, kind: '', noTap: false };
  var aim = null, now = 0, last = 0, acc = 0, respawnAt = 0, dirty = false, saveT = 0, hintT = 0, toastT = 0;
  var curSet = null, setT = 0, nextFlash = 0;
  var dlg = { lines: null, i: 0, typing: false, full: '', shown: 0, done: null, choosing: false, tick: 0, who: '' };
  var hudCache = {};
  var totalChalk = 0;
  var KM = Math.round(mainWorld.top * C.M_PER_UNIT / 1000);
  var KM_WORD = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen',
                 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'][KM] || String(KM);
  function fill(text) {         // {km} in story text is the real height of the tower
    return text.replace('{km}', text.indexOf('{km}') === 0 ? KM_WORD.charAt(0).toUpperCase() + KM_WORD.slice(1) : KM_WORD);
  }

  /* ---------- save ---------- */
  function freshSave(set) {
    return { v: 1, wv: WORLD_V, camp: 0, cp: null, maxCamp: 0, visited: { 0: 1 }, seen: {}, chalk: 0, got: 0, upg: {}, flags: {}, taken: {},
             marks: [], falls: 0, time: 0, hints: {}, ending: null, started: false,
             cos: { own: { red: 1, silk: 1, none: 1 }, scarf: 'red', wing: 'silk', trail: 'none' }, ch: null, rec: {},
             lore: { letters: {}, keys: {}, boxes: {}, held: 0 }, ng: 0, fallSeg: {},
             set: set || { sling: true, aim2: 1, sound: true, music: true, fs: true } };
  }
  function load() {
    try {
      var s = JSON.parse(localStorage.getItem(KEY));
      if (s && s.v === 1 && s.set) {
        if (!s.set.aim2) { s.set.sling = true; s.set.aim2 = 1; }           // pull-back aiming became the default
        if (s.set.music == null) s.set.music = true;
        if (!s.cos) s.cos = { own: { red: 1, silk: 1, none: 1 }, scarf: 'red', wing: 'silk', trail: 'none' };
        if (!s.rec) s.rec = {};
        if (!s.lore) s.lore = { letters: {}, keys: {}, boxes: {}, held: 0 };
        if (!s.fallSeg) s.fallSeg = {};
        if (!s.ng) s.ng = 0;
        if (s.wv !== WORLD_V) s.ch = null;                                  // a challenge in progress pointed into the old layout
        if ((s.wv || 0) < 5) {        // the Cisterns and the Archive were added: old camps 4-11 moved up 4, 12-16 up 8
          var mv = function (i) { return i < 4 ? i : i < 12 ? i + 4 : i + 8; }, rk = function (o) { var n = {}; for (var k in o) n[mv(+k)] = o[k]; return n; };
          s.camp = mv(s.camp || 0); s.maxCamp = mv(s.maxCamp || 0); s.visited = rk(s.visited || {}); s.seen = rk(s.seen || {});
          for (var q = 0; q < s.maxCamp; q++) { s.visited[q] = 1; s.seen[q] = 1; }    // the new camps you passed in spirit
        }
        if (s.wv !== WORLD_V) { s.taken = {}; s.marks = []; s.cp = null; s.wv = WORLD_V; }   // the tower layout changed
        return s;
      }
    } catch (e) {}
    return null;
  }
  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(save)); } catch (e) {}
    dirty = false; saveT = now;
  }
  function loadDaily() {
    var k = S.dateKey();
    try { var d = JSON.parse(localStorage.getItem(KEY_D)); if (d && d.date === k) return d; } catch (e) {}
    return { date: k, best: 0, ghost: null, tries: 0 };
  }
  function persistDaily() { try { localStorage.setItem(KEY_D, JSON.stringify(daily)); } catch (e) {} }
  function loadEndless() {
    try { var d = JSON.parse(localStorage.getItem(KEY_E)); if (d && d.best >= 0) return d; } catch (e) {}
    return { best: 0, runs: 0 };
  }
  function persistEndless() { try { localStorage.setItem(KEY_E, JSON.stringify(endless)); } catch (e) {} }

  function mods() {
    if (run && run.kind === 'daily') return { stMax: C.ST_MAX, vmax: C.VMAX, drain: 1, pitonMax: 2 };    // base stats for everyone
    if (run && run.kind === 'endless') {
      var k = run.perks;
      return { stMax: C.ST_MAX + 30 * (k.lungs || 0), vmax: C.VMAX * (1 + 0.07 * (k.legs || 0)), drain: Math.pow(0.75, k.grip || 0), pitonMax: 2,
               hops: k.hop || 0, grapR: C.GRAPPLE_R * (1 + 0.35 * (k.line || 0)), riseK: Math.pow(0.7, k.cool || 0), fallK: 1 + 0.5 * (k.feather || 0),
               glideK: Math.pow(0.5, k.kite || 0), insulated: !!k.rubber, crumbleK: Math.pow(1.6, k.calm || 0) };
    }
    var u = save.upg, f = save.flags;
    return {
      stMax: C.ST_MAX + 20 * (u.lungs || 0) + (f.kept ? 10 : 0),
      vmax: C.VMAX * (1 + 0.05 * (u.legs || 0)),
      drain: (1 - 0.15 * (u.hands || 0)) * (run && run.m.thin ? 1.33 : 1) * (run ? 1 : S.ngDrain(save.ng)),
      pitonMax: run && run.m.nopiton ? 0 : 2 + (u.sling || 0) + (f.ledger ? 1 : 0)
    };
  }
  function tools() { return run || save.ng ? { grapple: true, glider: true, gloves: true } : S.toolsFor(save.maxCamp); }
  // Builds the story tower for the current New Game+ level.
  function buildMain() {
    mainWorld = save.ng ? S.generate(S.ngSeed(save.ng), S.ngPlan(save.ng), { lore: true }) : baseWorld;
    totalChalk = mainWorld.shards.reduce(function (a, s) { return a + s.v; }, 0);
    if (!run) world = mainWorld;
  }
  function applyMods() {
    var m = mods(), k;
    for (k in m) sim.mods[k] = m[k];
    sim.tools = tools();
  }
  function lookOf(kind, id) { return ST.looks[kind].filter(function (l) { return l.id === id; })[0] || ST.looks[kind][0]; }
  function applyLook() {
    var c = save.cos, w = lookOf('wing', c.wing);
    R.setLook({ scarf: lookOf('scarf', c.scarf).col, wing: w.col, rib: w.rib, trail: c.trail === 'none' ? null : c.trail });
  }
  function startSim() {
    var cp = world.camps[run ? 0 : save.camp].hold, saved = world.holds[run ? run.cp : save.cp];
    if (saved && saved.type === 'camp') cp = saved.id;          // a bivouac or camp reached since
    sim = S.createSim(world, { checkpoint: cp, taken: run && run.kind !== 'challenge' ? {} : save.taken, mods: mods(), tools: tools(), lore: save.lore });
    applyLook();
    R.snap(sim, mode === 'title' ? 'title' : 'play');
    aim = null; acc = 0; curSet = null; ptr.down = false; ptr.dead = false;
    fade(0);                    // in case the last climb ended mid-fall
  }

  /* ---------- small UI helpers ---------- */
  function show(el) { el.classList.remove('hidden'); }
  function hide(el) { el.classList.add('hidden'); }
  function fade(v) { $('fade').style.opacity = v; }
  function vibrate(ms) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {} }
  function toast(text, dur) {
    var el = $('toast'); el.textContent = text; el.classList.add('show'); toastT = now + (dur || 4.5);
  }
  function banner(title, over) {
    var el = $('banner');
    el.innerHTML = '';
    if (over) { var sm = document.createElement('small'); sm.textContent = over; el.appendChild(sm); }
    el.appendChild(document.createTextNode(title));
    el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
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
  function fmtClock(s) { s = Math.max(0, s); var m = Math.floor(s / 60), r = s - m * 60; return m + ':' + (r < 10 ? '0' : '') + r.toFixed(1); }
  function dateLabel(k) {
    var mo = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return (k % 100) + ' ' + mo[Math.floor(k / 100) % 100 - 1] + ' ' + Math.floor(k / 10000);
  }
  function goFullscreen() {
    if (!save.set.fs || document.fullscreenElement || document.webkitFullscreenElement) return;
    var el = document.documentElement, f = el.requestFullscreen || el.webkitRequestFullscreen;
    if (!f) return;
    try { var pr = f.call(el); if (pr && pr.catch) pr.catch(function () {}); } catch (e) {}
  }

  /* ---------- dialogue ---------- */
  function talk(lines, done) {
    mode = 'talk'; aim = null; ptr.down = false; ptr.dead = false;
    toastT = 0; $('toast').classList.remove('show');
    dlg.lines = lines; dlg.i = 0; dlg.done = done; dlg.choosing = false;
    $('dlg-choices').innerHTML = '';
    show($('dialogue'));
    nextLine();
  }
  function nextLine() {
    if (dlg.i >= dlg.lines.length) {
      var d = dlg.done; dlg.done = null; dlg.typing = false; dlg.who = '';
      hide($('dialogue'));
      if (d) d();
      return;
    }
    var l = dlg.lines[dlg.i++];
    dlg.who = l[0];
    $('dlg-who').textContent = l[0]; $('dlg-who').style.display = l[0] ? '' : 'none';
    $('dialogue').classList.toggle('narr', !l[0]);
    dlg.full = fill(l[1]); dlg.shown = 0; dlg.typing = true;
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
    mode = 'talk'; dlg.choosing = true; dlg.typing = false; dlg.who = '';
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
    save.camp = idx; save.cp = world.camps[idx].hold; save.visited[idx] = 1;
    if (idx > save.maxCamp) save.maxCamp = idx;
    applyMods();
    A.sfx('camp');
    if (first) { save.seen[idx] = 1; persist(); story(idx); }
    else { persist(); if (now > toastT) toast(ST.camps[idx].name + '. Climb saved.', 2.5); }
  }

  function story(idx) {
    var c = ST.camps[idx];
    var finish = function () {
      if (c.unlock && !save.ng) {
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
    if (run || sim.p.state !== 'hold' || world.holds[sim.p.hold].camp == null) return;
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
    html += '<h3>Tailor</h3>';
    [['scarf', 'Scarf'], ['wing', 'Glider'], ['trail', 'Trail']].forEach(function (kd) {
      html += '<div class="desc" style="margin:6px 0 5px">' + kd[1] + '</div><div class="swatches">';
      ST.looks[kd[0]].forEach(function (l) {
        var own = save.cos.own[l.id], on = save.cos[kd[0]] === l.id;
        html += '<button class="sw' + (on ? ' on' : '') + '" data-look="' + kd[0] + ':' + l.id + '"' + (!own && save.chalk < l.cost ? ' disabled' : '') + '>' +
          '<i style="background:' + l.col + '"></i>' + l.name + (own ? '' : ' <b>&#9670; ' + l.cost + '</b>') + '</button>';
      });
      html += '</div>';
    });
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
    mode = 'pause'; aim = null; ptr.down = false;
    if (!run) persist();
    renderPause();
  }
  function renderPause() {
    var settings = '<button class="btn" data-set="sling">' + aimLabel() + '</button>' +
      '<button class="btn" data-set="sound">' + soundLabel() + '</button>' +
      '<button class="btn" data-set="music">' + musicLabel() + '</button>' +
      '<button class="btn" data-set="fs">' + fsLabel() + '</button>';
    if (run) {
      var sub = run.kind === 'daily' ? 'Daily tower &middot; ' + dateLabel(daily.date)
              : run.kind === 'endless' ? 'Endless climb &middot; ' + metres(run.maxY) + ' m'
              : 'Challenge &middot; ' + chNames(run.m) + ' &middot; ' + fmtLong(run.time), perkList = '';
      if (run.kind === 'endless') {
        ST.perks.forEach(function (pk) { if (run.perks[pk.id] && pk.id !== 'rope') perkList += pk.name + (run.perks[pk.id] > 1 ? ' &times;' + run.perks[pk.id] : '') + ', '; });
        if (perkList) perkList = '<p class="note">Perks: ' + perkList.slice(0, -2) + '</p>';
      }
      panel('<h2>Paused</h2><div class="sub">' + sub + '</div>' + perkList +
        '<button class="btn primary" data-act="resume">Resume</button>' + settings +
        '<button class="btn" data-act="run-again">Restart the run</button>' +
        '<button class="btn" data-act="run-quit">Quit to title</button>');
      return;
    }
    panel('<h2>Paused</h2><div class="sub">' + metres(sim.p.y) + ' m &middot; ' + fmtTime(save.time) + ' &middot; ' + save.falls + ' falls</div>' +
      '<button class="btn primary" data-act="resume">Resume</button>' + settings +
      '<button class="btn" data-act="map">Tower map</button>' +
      '<button class="btn" data-act="letters">Letters &middot; ' + nLetters() + ' of ' + ST.letters.length + '</button>' +
      '<button class="btn" data-act="tocamp">Return to last camp</button>' +
      '<button class="btn" data-act="title">Save and quit to title</button>');
  }
  function aimLabel() { return 'Aim: ' + (save.set.sling ? 'pull back, like a cue' : 'drag forward'); }
  function soundLabel() { return 'Sound: ' + (save.set.sound ? 'on' : 'off'); }
  function musicLabel() { return 'Music: ' + (save.set.music ? 'on' : 'off'); }
  function fsLabel() { return 'Fullscreen: ' + (save.set.fs ? 'on' : 'off'); }
  function panel(html) { $('panel-card').innerHTML = html; $('panel-card').scrollTop = 0; show($('panel')); }
  function closePanel() { hide($('panel')); }

  /* ---------- tower map, letters ---------- */
  function nLetters() { var n = 0; for (var k in save.lore.letters) n++; return n; }
  function campName(i) { return ST.camps[i] ? ST.camps[i].name : 'Camp ' + i; }
  function esc(t) { return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }
  function openMap() {
    var W = mainWorld, C2 = W.camps, seen = save.visited, html, i, di, d, k;
    var maxF = 1; for (k in save.fallSeg) maxF = Math.max(maxF, save.fallSeg[k]);
    var found = 0; for (i = 0; i < C2.length; i++) if (seen[i]) found++;
    html = '<h2>Tower map</h2><div class="sub">' + found + ' of ' + C2.length + ' camps &middot; ' + metres(sim.p.y).toLocaleString('en-US') + ' m now</div><div class="map">';
    for (di = S.ORDER.length - 1; di >= 0; di--) {
      d = S.ORDER[di];
      var idx = [], known = false, chalkT = 0, chalkF = 0, letT = 0, letF = 0;
      for (i = 0; i < C2.length; i++) if (C2[i].d === d && !(i === C2.length - 1 && C2[i - 1].d !== d)) idx.push(i);
      idx.forEach(function (j) { if (seen[j]) known = true; });
      W.shards.forEach(function (sh) { if (S.districtAt(W, sh.y) === d) { chalkT += sh.v; if (save.taken[sh.id]) chalkF += sh.v; } });
      W.letters.forEach(function (l) { if (S.districtAt(W, l.y) === d) { letT++; if (save.lore.letters[l.id]) letF++; } });
      html += '<div class="mdist' + (known ? '' : ' unknown') + '"><div class="mhead"><b>' + (known ? S.DISTRICTS[d].name : '? ? ?') + '</b>' +
        (known ? '<span>&#9670; ' + chalkF + '/' + chalkT + ' &middot; &#9993; ' + letF + '/' + letT + '</span>' : '') + '</div>';
      for (k = idx.length - 1; k >= 0; k--) {
        i = idx[k];
        var here = i === save.camp, f = save.fallSeg[i] || 0, top = i === C2.length - 1;
        html += '<div class="mrow' + (here ? ' here' : '') + (seen[i] ? '' : ' unknown') + '"><i class="mdot"></i>' +
          '<span class="mname">' + (seen[i] ? esc(campName(i)) : top ? '? ? ?' : '?') + (here ? ' <em>you</em>' : '') + '</span>' +
          '<span class="mh">' + (seen[i] ? metres(C2[i].y).toLocaleString('en-US') + ' m' : '? m') + '</span>' +
          (f && !top ? '<span class="mfall" title="falls on the climb above"><s style="width:' + Math.round(8 + 40 * f / maxF) + 'px"></s>' + f + '</span>' : '<span class="mfall"></span>') + '</div>';
      }
      html += '</div>';
    }
    html += '</div>';
    var worst = Object.keys(save.fallSeg).map(Number).sort(function (a, b) { return save.fallSeg[b] - save.fallSeg[a]; }).slice(0, 3);
    if (worst.length) {
      html += '<h3>Where you fall most</h3>';
      worst.forEach(function (sg) {
        html += '<div class="row"><div class="grow"><div class="name">' + esc(campName(sg)) + ' to ' + (seen[sg + 1] ? esc(campName(sg + 1)) : '?') + '</div>' +
          '<div class="desc">' + S.DISTRICTS[C2[sg].d].name + ', from ' + metres(C2[sg].y).toLocaleString('en-US') + ' m</div></div><b>' + save.fallSeg[sg] + ' falls</b></div>';
      });
    }
    html += '<div style="height:12px"></div><button class="btn primary" data-act="pause">Back</button>';
    panel(html);
  }
  function openLetters() {
    var html = '<h2>Letters</h2><div class="sub">' + nLetters() + ' of ' + ST.letters.length + ' found</div>', i;
    for (i = ST.letters.length - 1; i >= 0; i--) {
      var got = save.lore.letters[i], boxed = i % 3 === 2;
      html += got ? '<button class="btn pick" data-act="read" data-id="' + i + '">' + (i + 1) + '. ' + esc(ST.letters[i].from) + '</button>'
                  : '<div class="row unknown"><div class="grow"><div class="name">' + (i + 1) + '. ? ? ?</div><div class="desc">' + (boxed ? 'Locked in a strongbox' : 'Somewhere on a side route') + '</div></div></div>';
    }
    html += '<p class="note">Letters are kept for good, across every climb. Keys carried: ' + save.lore.held + '.</p><button class="btn primary" data-act="pause">Back</button>';
    panel(html);
  }
  function readLetter(i, then) {
    var L = ST.letters[i];
    closePanel();
    talk([['Letter ' + (i + 1) + ' of ' + ST.letters.length + ': ' + L.from, L.text]], function () { if (then) { mode = 'pause'; then(); } else resume(); });
  }

  function toggleSetting(k) {
    save.set[k] = !save.set[k];
    if (k === 'sound') A.setMuted(!save.set.sound);
    if (k === 'music') A.setMusic(save.set.music);
    if (k === 'fs') {
      if (save.set.fs) goFullscreen();
      else if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(function () {});
    }
    persist(); A.sfx('ui');
  }

  $('panel').addEventListener('click', function (e) {
    var t = e.target.closest('button'); if (!t) return;
    var act = t.getAttribute('data-act'), buy = t.getAttribute('data-buy'), lift = t.getAttribute('data-lift'), set = t.getAttribute('data-set');
    var lk = t.getAttribute('data-look'), perk = t.getAttribute('data-perk'), chm = t.getAttribute('data-chm');
    if (lk) {                   // the tailor: buy if needed, then wear
      var kd = lk.split(':'), item = lookOf(kd[0], kd[1]);
      if (!save.cos.own[item.id]) { if (save.chalk < item.cost) return; save.chalk -= item.cost; save.cos.own[item.id] = 1; A.sfx('buy'); } else A.sfx('ui');
      save.cos[kd[0]] = item.id; applyLook(); persist();
      var sc0 = $('panel-card').scrollTop; openCamp(); $('panel-card').scrollTop = sc0;
      return;
    }
    if (perk) { takePerk(perk); return; }
    if (chm) { chSel[chm] = !chSel[chm]; A.sfx('ui'); openChallenges(); return; }
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
      var k = +lift; save.camp = k; save.cp = world.camps[k].hold; sim.checkpoint = world.camps[k].hold; S.respawn(sim); R.snap(sim, 'play'); curSet = null;
      persist(); closePanel(); A.sfx('zip'); toast(ST.camps[k].name, 2.5); resume(); return;
    }
    A.sfx('ui');
    if (act === 'resume' || act === 'explore') { closePanel(); resume(); }
    else if (act === 'tocamp') { save.cp = world.camps[save.camp].hold; sim.checkpoint = save.cp; S.respawn(sim); R.snap(sim, 'play'); curSet = null; closePanel(); resume(); }
    else if (act === 'title') { persist(); closePanel(); showTitle(); }
    else if (act === 'run-again') { closePanel(); if (run.kind === 'daily') startDaily(); else if (run.kind === 'endless') startEndless(); else startChallenge(run.m, false); }
    else if (act === 'ch-start') { closePanel(); startChallenge(chSel, false); }
    else if (act === 'ch-resume') { closePanel(); startChallenge(save.ch.m, true); }
    else if (act === 'ch-drop') { save.ch = null; persist(); openChallenges(); }
    else if (act === 'ch-back') { closePanel(); mode = 'title'; }
    else if (act === 'map') openMap();
    else if (act === 'letters') openLetters();
    else if (act === 'pause') renderPause();
    else if (act === 'read') { var li = +t.getAttribute('data-id'); readLetter(li, openLetters); }
    else if (act === 'run-quit') { closePanel(); leaveRun(); }
  });

  /* ---------- daily tower ---------- */
  function startDaily() {
    daily = loadDaily();
    world = S.generate(S.dailySeed(daily.date), S.DAILY_PLAN, { noShards: true });
    R.setWorld();
    run = { kind: 'daily', started: false, t0: 0, time: 0, rec: [], falls: 0, done: false, maxY: 0 };
    hide($('title')); show($('hud')); hide($('chalk')); show($('clock'));
    A.init(); A.setMuted(!save.set.sound); A.setMusic(save.set.music); goFullscreen();
    mode = 'play';
    startSim(); hudCache = {};
    banner('Daily tower', dateLabel(daily.date)); A.sfx('banner');
    toast('The clock starts on your first leap.' + (daily.ghost ? ' The ghost is your best run today.' : ''), 5);
    resume();
  }
  // The endless climb: no summit, three ropes. A fall costs one; every second camp gives one back.
  function startEndless() {
    endless = loadEndless();
    world = S.endlessWorld(4);
    R.setWorld();
    run = { kind: 'endless', started: false, t0: 0, time: 0, rec: [], falls: 0, done: false, lives: 3, maxY: 0, camps: 0, perks: {} };
    hide($('title')); show($('hud')); hide($('chalk')); show($('clock'));
    A.init(); A.setMuted(!save.set.sound); A.setMusic(save.set.music); goFullscreen();
    mode = 'play';
    startSim(); hudCache = {};
    banner('Endless climb', endless.best ? 'Best ' + endless.best.toLocaleString('en-US') + ' m' : 'No summit'); A.sfx('banner');
    toast('Three ropes. A fall costs one. Every second camp gives one back, and a perk.', 6);
    resume();
  }
  function finishEndless() {
    var h = metres(run.maxY), prev = endless.best, nb = h > prev;
    run.done = true; endless.runs++;
    if (nb) endless.best = h;
    persistEndless();
    A.sfx('over'); mode = 'end'; aim = null; fade(0);
    panel('<h2>Out of rope</h2><div class="sub">Endless climb</div>' +
      '<div class="stats">' +
      '<div><b>' + h.toLocaleString('en-US') + ' m</b><span>Height</span></div>' +
      '<div><b>' + endless.best.toLocaleString('en-US') + ' m</b><span>Best</span></div>' +
      '<div><b>' + run.camps + '</b><span>Camps reached</span></div>' +
      '<div><b>' + fmtTime(sim.t - run.t0) + '</b><span>Time</span></div></div>' +
      '<p>' + (nb ? (prev ? 'A new best, ' + (h - prev).toLocaleString('en-US') + ' m higher than before.' : 'Your first mark on the endless wall.')
                  : 'Your best is still ' + prev.toLocaleString('en-US') + ' m.') + '</p>' +
      '<p>The endless wall is the same for everyone, so heights can be compared.</p>' +
      '<button class="btn primary" data-act="run-again">Climb again</button>' +
      '<button class="btn" data-act="run-quit">Back to title</button>');
  }
  // Every second camp of the endless climb offers three perks.
  function offerPerk(camp) {
    var pool = ST.perks.filter(function (pk) { return (run.perks[pk.id] || 0) < pk.max && !(pk.id === 'rope' && run.lives >= 5); }), pick = [], html, i;
    while (pick.length < 3 && pool.length) pick.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    if (!pick.length) return;
    mode = 'perk'; aim = null; ptr.down = false;
    html = '<h2>Camp ' + camp + '</h2><div class="sub">Take one with you</div>';
    for (i = 0; i < pick.length; i++)
      html += '<button class="btn pick" data-perk="' + pick[i].id + '">' + pick[i].name + '<small>' + pick[i].desc + '</small></button>';
    panel(html);
  }
  function takePerk(id) {
    run.perks[id] = (run.perks[id] || 0) + 1;
    if (id === 'rope') run.lives = Math.min(5, run.lives + 1);
    applyMods(); sim.p.stamina = sim.mods.stMax; sim.p.hops = sim.mods.hops || 0;
    A.sfx('perk'); closePanel(); resume();
  }

  /* ---------- challenge climbs ----------
     The story tower again with modifiers, a clock and a split at every district gate. Open once the
     story has an ending. Progress is kept at each camp and bivouac in save.ch. */
  var chSel = {};
  function chKey(m) { var k = ST.challenges.filter(function (c) { return m[c.id]; }).map(function (c) { return c.id; }); return k.length ? k.join('+') : 'plain'; }
  function chNames(m) { var k = ST.challenges.filter(function (c) { return m[c.id]; }).map(function (c) { return c.name; }); return k.length ? k.join(', ') : 'No modifiers'; }
  function fmtLong(s) { s = Math.floor(s); var h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60; return (h ? h + ':' + ('0' + m).slice(-2) : m) + ':' + ('0' + (s % 60)).slice(-2); }
  function openChallenges() {
    mode = 'menu';
    var html = '<h2>Challenges</h2><div class="sub">The story tower again, against the clock</div>', rec = save.rec[chKey(chSel)];
    if (save.ch) {
      html += '<p class="note">In progress: ' + chNames(save.ch.m) + ' &middot; ' + metres(world.holds[save.ch.cp] ? world.holds[save.ch.cp].y : 0) + ' m &middot; ' + fmtLong(save.ch.time) + '</p>' +
        '<button class="btn primary" data-act="ch-resume">Resume it</button><button class="btn danger" data-act="ch-drop">Abandon it</button>';
    }
    html += '<h3>Modifiers</h3>';
    ST.challenges.forEach(function (c) {
      html += '<button class="btn pick tog' + (chSel[c.id] ? ' on' : '') + '" data-chm="' + c.id + '">' + (chSel[c.id] ? '&#9679; ' : '&#9675; ') + c.name + '<small>' + c.desc + '</small></button>';
    });
    html += '<p class="note" style="margin-top:12px">' + (rec ? 'Your best with these: ' + fmtLong(rec.time) + ', ' + rec.falls + ' falls.' : 'No finished climb with these yet.') +
      ' All tools from the start, your upgrades, and chalk still counts.</p>' +
      '<button class="btn' + (save.ch ? '' : ' primary') + '" data-act="ch-start">Start a new climb</button><button class="btn" data-act="ch-back">Back</button>';
    panel(html);
  }
  function startChallenge(m, resumeIt) {
    var ch = resumeIt ? save.ch : null, mm = {};
    ST.challenges.forEach(function (c) { if (m[c.id]) mm[c.id] = 1; });
    world = baseWorld; R.setWorld();
    run = { kind: 'challenge', m: mm, started: true, t0: 0, time: ch ? ch.time : 0, rec: [], falls: ch ? ch.falls : 0, done: false, maxY: 0,
            cp: ch ? ch.cp : null, splits: ch ? ch.splits.slice() : [], camp: ch ? ch.camp : 0 };
    if (!resumeIt) { save.ch = { m: mm, cp: world.camps[0].hold, time: 0, falls: 0, splits: [], camp: 0 }; persist(); }
    hide($('title')); show($('hud')); show($('chalk')); show($('clock'));
    A.init(); A.setMuted(!save.set.sound); A.setMusic(save.set.music); goFullscreen();
    mode = 'play';
    startSim(); hudCache = {};
    banner(chNames(mm), 'Challenge climb'); A.sfx('banner');
    resume();
  }
  function isGate(i) { return i > 0 && world.camps[i].d !== world.camps[i - 1].d; }
  function challengeCheckpoint(holdId, campIdx) {
    run.cp = holdId;
    if (campIdx != null && campIdx > run.camp) {
      run.camp = campIdx;
      if (isGate(campIdx)) {                   // a district gate: take a split for the district just finished
        var dd = world.camps[campIdx - 1].d, d = S.RANK[dd], best = save.rec[chKey(run.m)], diff = best && best.splits[d] != null ? run.time - best.splits[d] : null;
        run.splits[d] = run.time;
        toast(S.DISTRICTS[dd].name + ' in ' + fmtLong(run.time) + (diff == null ? '' : ' (' + (diff <= 0 ? '\u2212' : '+') + fmtLong(Math.abs(diff)) + ')'), 4);
      }
    }
    save.ch = { m: run.m, cp: holdId, time: run.time, falls: run.falls, splits: run.splits.slice(), camp: run.camp };
    persist();
  }
  function finishChallenge() {
    var key = chKey(run.m), prev = save.rec[key], nb = !prev || run.time < prev.time, html, i;
    run.done = true;
    if (nb) save.rec[key] = { time: run.time, falls: run.falls, splits: run.splits.slice() };
    save.ch = null; persist();
    A.sfx('finish'); mode = 'end'; aim = null;
    html = '<h2>Summit</h2><div class="sub">' + chNames(run.m) + '</div><div class="stats">' +
      '<div><b>' + fmtLong(run.time) + '</b><span>Time</span></div><div><b>' + run.falls + '</b><span>Falls</span></div></div>';
    for (i = 0; i < S.ORDER.length; i++) html += '<div class="row"><div class="grow"><div class="name">' + S.DISTRICTS[S.ORDER[i]].name + '</div></div><b>' + fmtLong(run.splits[i] || run.time) + '</b></div>';
    html += '<p style="margin-top:12px">' + (nb ? (prev ? 'A new best, ' + fmtLong(prev.time - run.time) + ' faster.' : 'Your first finish with these modifiers.') : 'Your best is still ' + fmtLong(prev.time) + '.') + '</p>' +
      '<button class="btn primary" data-act="run-quit">Back to title</button>';
    panel(html);
  }

  function leaveRun() {
    run = null; world = mainWorld; R.setWorld();
    show($('chalk')); hide($('clock'));
    mode = 'title'; startSim(); showTitle();
  }
  function finishDaily() {
    var time = sim.t - run.t0, prev = daily.best, nb = !prev || time < prev;
    run.done = true; run.time = time;
    daily.tries++;
    if (nb) { daily.best = time; daily.ghost = run.rec; }
    persistDaily();
    A.sfx('finish'); mode = 'end'; aim = null;
    var note = nb ? (prev ? 'New best: ' + (prev - time).toFixed(1) + ' s faster than before.' : 'First finish of the day. Your ghost will race you next time.')
                  : 'Your best today is still ' + fmtClock(prev) + '.';
    panel('<h2>Daily tower</h2><div class="sub">' + dateLabel(daily.date) + '</div>' +
      '<div class="stats">' +
      '<div><b>' + fmtClock(time) + '</b><span>Time</span></div>' +
      '<div><b>' + fmtClock(daily.best) + '</b><span>Best today</span></div>' +
      '<div><b>' + run.falls + '</b><span>Falls</span></div>' +
      '<div><b>' + metres(world.top) + ' m</b><span>Height</span></div></div>' +
      '<p>' + note + '</p><p>Everyone gets the same tower on the same date, at the same base stats, so times can be compared.</p>' +
      '<button class="btn primary" data-act="run-again">Run it again</button>' +
      '<button class="btn" data-act="run-quit">Back to title</button>');
  }
  function ghostAt() {
    if (!run || run.kind !== 'daily' || !run.started || run.done || !daily.ghost) return null;
    var g = daily.ghost, gi = (sim.t - run.t0) * 10, i0 = Math.floor(gi), f = gi - i0;
    if (i0 * 2 + 3 >= g.length) return null;
    return { x: g[i0 * 2] + (g[i0 * 2 + 2] - g[i0 * 2]) * f, y: g[i0 * 2 + 1] + (g[i0 * 2 + 3] - g[i0 * 2 + 1]) * f };
  }

  /* ---------- title ---------- */
  function showTitle() {
    mode = 'title'; hide($('hud')); aim = null;
    daily = loadDaily();
    $('btn-continue').classList.toggle('hidden', !save.started);
    $('btn-new').textContent = save.started ? 'New climb' : 'Begin the climb';
    $('btn-new').className = 'btn' + (save.started ? '' : ' primary');
    $('btn-new').removeAttribute('data-sure');
    endless = loadEndless();
    $('daily-sub').textContent = daily.best ? 'Best today ' + fmtClock(daily.best) : 'New every day';
    $('endless-sub').textContent = endless.best ? 'Best ' + endless.best.toLocaleString('en-US') + ' m' : 'No summit';
    $('tag').textContent = 'One tower. ' + fill('{km}') + ' kilometres. One thumb.';
    $('set-aim').textContent = aimLabel(); $('set-sound').textContent = soundLabel(); $('set-fs').textContent = fsLabel();
    $('set-music').textContent = musicLabel();
    $('btn-chal').classList.toggle('hidden', !save.ending);
    $('btn-ng').classList.toggle('hidden', !save.ending);
    $('btn-ng').removeAttribute('data-sure');
    $('btn-ng').innerHTML = 'New Game+ ' + (save.ng + 1) + '<small>A remixed, harder tower. Keep upgrades, looks and letters</small>';
    $('chal-sub').textContent = save.ch ? 'In progress: ' + fmtLong(save.ch.time) : 'Modifiers, a clock and splits';
    show($('title'));
  }
  function enterGame() {
    hide($('title')); show($('hud'));
    A.init(); A.setMuted(!save.set.sound); A.setMusic(save.set.music); goFullscreen();
    save.started = true;
    mode = 'play';
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
  $('btn-daily').addEventListener('click', startDaily);
  $('btn-endless').addEventListener('click', startEndless);
  $('btn-ng').addEventListener('click', function () {
    var b = $('btn-ng');
    if (!b.getAttribute('data-sure')) { b.setAttribute('data-sure', '1'); b.innerHTML = 'Start New Game+ ' + (save.ng + 1) + '?<small>This climb\'s camps and choices are cleared</small>'; return; }
    var keep = save;
    save = freshSave(keep.set);
    ['upg', 'chalk', 'cos', 'rec', 'lore', 'hints', 'fallSeg'].forEach(function (k) { save[k] = keep[k]; });
    save.ng = keep.ng + 1; save.lore.keys = {};
    buildMain();
    enterGame();
  });
  $('btn-chal').addEventListener('click', function () { A.init(); A.sfx('ui'); chSel = {}; openChallenges(); });
  $('set-music').addEventListener('click', function () { A.init(); toggleSetting('music'); $('set-music').textContent = musicLabel(); });
  $('set-aim').addEventListener('click', function () { toggleSetting('sling'); $('set-aim').textContent = aimLabel(); });
  $('set-sound').addEventListener('click', function () { A.init(); toggleSetting('sound'); $('set-sound').textContent = soundLabel(); });
  $('set-fs').addEventListener('click', function () { toggleSetting('fs'); $('set-fs').textContent = fsLabel(); });

  /* ---------- HUD ---------- */
  function setText(id, v) { if (hudCache[id] !== v) { hudCache[id] = v; $(id).textContent = v; } }
  function hud() {
    if (mode === 'title') return;
    var p = sim.p;
    setText('alt-m', metres(p.y).toLocaleString('en-US'));
    setText('alt-d', run && run.kind === 'daily' ? 'Daily tower' : run && run.kind === 'endless' ? 'Endless climb' : S.DISTRICTS[S.districtAt(world, p.y)].name);
    if (!run || run.kind === 'challenge') setText('chalk-n', save.chalk);
    if (!run) { /* no clock in the story */ }
    else if (run.kind === 'challenge') setText('clock-n', fmtLong(run.time));
    else if (run.kind === 'daily') setText('clock-n', fmtClock(run.done ? run.time : run.started ? sim.t - run.t0 : 0));
    else setText('clock-n', run.lives > 0 ? new Array(run.lives + 1).join('\u25C6 ').trim() : '\u2014');
    setText('piton-n', sim.pitons);
    var atCamp = !run && p.state === 'hold' && world.holds[p.hold].camp != null && mode === 'play';
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
        case 'leap':
          A.sfx('leap', e.a); R.emit('chalk', p.x, p.y, 4);
          if (run && !run.started) { run.started = true; run.t0 = sim.t; }
          break;
        case 'grab':
          h = world.holds[e.a];
          A.sfx(h.type === 'ledge' || h.type === 'camp' ? 'ledge' : 'grab');
          R.emit('dust', p.x, p.y - 4, 6);
          if (ptr.down) ptr.dead = true;      // a finger still down from the flight must lift before it can aim
          p.wantGlide = false; aim = null;
          if (h.type === 'grip' && (save.hints.start_swipe || save.hints.start_sling)) hint('grip');
          break;
        case 'camp':
          if (!run) arriveCamp(e.a);
          else if (run.kind === 'endless') {
            if (e.a > run.camps) {
              run.camps = e.a; A.sfx('camp');
              if (e.a % 2 === 0 && run.lives < 3) { run.lives++; toast('Camp ' + e.a + '. A rope back.', 2.5); }
              else toast('Camp ' + e.a + '.', 2);
              if (e.a >= world.camps.length - 3) world.grow(3);      // keep building the wall ahead of the climber
              if (e.a % 2 === 0) offerPerk(e.a);
            }
          }
          else if (run.kind === 'challenge') {
            if (p.lastHold !== world.camps[e.a].hold) { A.sfx('camp'); if (!isGate(e.a)) toast(ST.camps[e.a].name + '. ' + fmtLong(run.time), 2.5); }
            challengeCheckpoint(world.camps[e.a].hold, e.a);
            if (e.a === world.camps.length - 1) finishChallenge();
          }
          else if (e.a === world.camps.length - 1) finishDaily();
          else if (p.lastHold !== world.camps[e.a].hold) { A.sfx('camp'); toast('Checkpoint ' + e.a + ' of ' + (world.camps.length - 1) + '.', 2); }
          break;
        case 'biv':
          if (p.lastHold === e.a) break;
          if (run) { if (run.kind === 'challenge') { challengeCheckpoint(e.a, null); A.sfx('camp'); toast('Bivouac. ' + fmtLong(run.time), 2); } break; }
          save.cp = e.a; persist(); A.sfx('camp');
          if (!hint('biv', true) && now > toastT) toast('Bivouac. Climb saved.', 2);
          break;
        case 'spring': A.sfx('spring'); R.pop(e.a, now); R.emit('dust', p.x, p.y - 6, 5); break;
        case 'tube': A.sfx('tube'); R.emit('puff', p.x, p.y, 8, 0); R.shake(3); break;
        case 'phaseout': A.sfx('phaseout'); break;
        case 'shard':
          if (run && run.kind !== 'challenge') break;
          save.chalk += e.a; if (!run) save.got += e.a;
          dirty = true; A.sfx('shard');
          R.emit('pickup', world.shards[e.b].x, world.shards[e.b].y, 8); hint('shard');
          break;
        case 'fall':
          if (run) {
            run.falls++;
            if (run.kind === 'endless' && --run.lives <= 0) { A.sfx('fall'); vibrate(60); finishEndless(); break; }
            if (run.kind === 'endless') toast(run.lives === 1 ? 'One rope left.' : run.lives + ' ropes left.', 2.5);
          } else {
            save.falls++; dirty = true;
            if (p.lastHold >= 0) {
              h = world.holds[p.lastHold];
              save.fallSeg[h.seg] = (save.fallSeg[h.seg] || 0) + 1;
              save.marks.push([Math.round(h.x + (Math.random() - 0.5) * 16), Math.round(h.type === 'plate' ? h.y0 : h.y)]);
              if (save.marks.length > 40) save.marks.shift();
            }
          }
          A.sfx('fall'); vibrate(40); respawnAt = now + 0.85; fade(1); aim = null;
          break;
        case 'rise': A.sfx('rumble'); R.shake(6); toast(e.a === 'collapse' ? 'The stair is collapsing. Climb!' : 'The shaft is flooding. Climb!', 3); break;
        case 'burn': A.sfx(e.a === 'collapse' ? 'fall' : 'burn'); toast(e.a === 'collapse' ? 'The stair fell away under you.' : 'The slag caught you.', 2.5); break;
        case 'letter': A.sfx('page'); save.lore.letters[e.a] = 1; persist(); readLetter(e.a, null); break;
        case 'key': A.sfx('key'); persist(); toast('A key. A strongbox above will open for it.' + (save.lore.held > 1 ? ' (' + save.lore.held + ' carried)' : ''), 3.5); break;
        case 'box': A.sfx('unlock'); save.chalk += 15; persist(); toast('The strongbox opens: 15 chalk and a letter.', 3); readLetter(e.a, null); break;
        case 'locked': if (now > toastT) toast('A locked strongbox. Its key is somewhere below.', 3); break;
        case 'bell': A.sfx('bell'); break;
        case 'crumble': A.sfx('crumble'); R.emit('debris', world.holds[e.a].x, world.holds[e.a].y, 9); R.shake(3); break;
        case 'slip': A.sfx('slip'); R.shake(2); toast('Your grip gave out.', 2); break;
        case 'knock': A.sfx('knock'); R.shake(6); vibrate(20); break;
        case 'mob':
          if (e.a === 'drip') { A.sfx('sizzle'); R.emit('spark', p.x, p.y, 8); }
          else if (e.a === 'bird') { A.sfx('peck'); R.emit('dust', p.x, p.y, 8); }
          else { A.sfx('shock'); R.emit('spark', p.x, p.y, 12); }
          break;
        case 'switch': A.sfx('lever'); R.flipped(sim.sw, now); vibrate(15); break;
        case 'hop': A.sfx('hop'); R.emit('chalk', p.x, p.y - 8, 6); break;
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
    list = world.grid.mobs[b];
    if (list) for (i = 0; i < list.length; i++) { var mk = world.mobs[list[i]].kind; if (!save.hints[mk] && hint(mk)) return; }
    if (world.grid.springs[b] && !save.hints.spring && hint('spring')) return;
    if (world.grid.tubes[b] && !save.hints.tube && hint('tube')) return;
    if (world.grid.vents[b] && !save.hints.vent && hint('vent')) return;
    if (world.grid.winds[b] && !save.hints.wind && hint('wind')) return;
    if (world.grid.drafts[b] && !save.hints.draft && hint('draft')) return;
  }
  // Announces a set piece as you climb into it, and drives the storm's lightning.
  function checkSet() {
    if (now - setT > 0.3) {
      setT = now;
      var set = S.setAt(world, sim.p.y), key = set ? set.type : null;
      if (key !== curSet) {
        curSet = key;
        if (set) { banner(ST.sets[key].name, S.DISTRICTS[S.districtAt(world, set.y0)].name); A.sfx('banner'); toast(ST.sets[key].hint, 7); nextFlash = now + 2; }
      }
    }
    if (curSet === 'storm' && now > nextFlash) { R.flash(); A.sfx('thunder'); nextFlash = now + 3.5 + Math.random() * 5; }
  }

  /* ---------- input ---------- */
  var cv = $('cv');
  cv.addEventListener('pointerdown', function (e) {
    if (mode !== 'play' || ptr.down) return;
    e.preventDefault();
    A.init();
    ptr.down = true; ptr.dead = false; ptr.id = e.pointerId; ptr.sx = ptr.x = e.clientX; ptr.sy = ptr.y = e.clientY;
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
    var dead = ptr.dead;
    ptr.down = false; ptr.dead = false;
    if (mode !== 'play') { aim = null; return; }
    var p = sim.p, tap = !ptr.noTap && now - ptr.t0 < 0.28 && ptr.moved < 12;
    if (!dead && !cancelled) {
      if (p.state === 'hold' && aim && aim.ok) S.leap(sim, aim.vx, aim.vy);
      else if (tap) {
        var w = R.toWorld(e.clientX, e.clientY), hop = p.state === 'air' && p.hops > 0;
        if (!sim.tools.grapple || !S.grapple(sim, w.x, w.y, hop)) { if (hop) S.airHop(sim); }
      }
    }
    aim = null; p.wantGlide = false; p.steer = 0;
  }
  cv.addEventListener('pointerup', function (e) { release(e, false); });
  cv.addEventListener('pointercancel', function (e) { release(e, true); });
  cv.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  document.addEventListener('touchmove', function (e) { if (e.target === cv) e.preventDefault(); }, { passive: false });

  function updateInput() {
    var p = sim.p;
    if (!ptr.down || ptr.dead) { aim = null; p.wantGlide = false; p.steer = 0; return; }
    if (p.state === 'hold') {
      if (ptr.kind !== 'aim') { ptr.dead = true; aim = null; return; }
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
      if (ptr.kind === 'aim') { ptr.kind = 'air'; ptr.t0 = now - 1; ptr.noTap = true; ptr.sx = ptr.x; ptr.sy = ptr.y; }   // knocked off mid-aim
      p.wantGlide = sim.tools.glider && now - ptr.t0 > 0.13;
      // steer like a thumbstick: how far the finger has slid sideways from where it went down
      var sdx = ptr.x - ptr.sx;
      p.steer = p.wantGlide && Math.abs(sdx) > 10 ? S.clamp((sdx - (sdx > 0 ? 10 : -10)) / (STEER_PX - 10), -1, 1) : 0;
    } else { aim = null; p.wantGlide = false; p.steer = 0; }
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { if (mode === 'play') openPause(); else if (mode === 'pause') { closePanel(); resume(); } }
    else if ((e.key === ' ' || e.key === 'Enter') && mode === 'talk') { e.preventDefault(); tapDialogue(); }
    else if (e.key === 'p' && mode === 'play') $('btn-piton').click();
  });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { if (mode === 'play') openPause(); else if (save && !run) persist(); A.suspend(true); }
    else A.suspend(false);
  });
  window.addEventListener('resize', function () { R.resize(); if (sim) R.snap(sim); });

  /* ---------- main loop ---------- */
  function loop(ts) {
    requestAnimationFrame(loop);
    var t = ts / 1000, dt = last ? Math.min(0.1, t - last) : 0, p;
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
      p = sim.p;
      if (run && p.state === 'hold' && p.y > run.maxY) run.maxY = p.y;
      if (run) {
        if (run.kind === 'daily' && run.started && !run.done) {           // record the run at 10 samples a second for the ghost
          var need = Math.floor((sim.t - run.t0) * 10);
          while (run.rec.length / 2 <= need && run.rec.length < 12000) run.rec.push(Math.round(p.x), Math.round(p.y));
        }
      } else save.time += dt;
      if (run && run.kind === 'challenge' && !run.done) run.time += dt;
      if (p.state === 'dead' && now >= respawnAt) { S.respawn(sim); R.snap(sim); fade(0); curSet = null; }
      if (mode === 'play') { checkHints(); checkSet(); }
      if (dirty && now - saveT > 4) persist();
      A.glide(p.gliding);
    } else A.glide(false);
    if (dlg.typing) typeTick(dt);
    R.update(dt, sim, aim, mode);
    p = sim.p;
    var gliding = mode === 'play' && ptr.down && !ptr.dead && p.state === 'air' && p.gliding;
    R.frame({ world: world, sim: sim, now: t, dt: mode === 'play' ? dt : 0, aim: mode === 'play' ? aim : null,
              marks: run ? null : save.marks, playing: mode === 'play',
              darkAll: !!(run && run.kind === 'challenge' && run.m.dark),
              npcs: run && run.kind !== 'challenge' ? null : function (i) { return ST.camps[i] && ST.camps[i].npcs; },
              speaker: mode === 'talk' ? dlg.who : null,
              ghost: mode === 'play' ? ghostAt() : null,
              stick: gliding ? { sx: ptr.sx, sy: ptr.sy, x: ptr.x, max: STEER_PX } : null });
    hud();
    A.ambience(S.districtAt(world, p.y), S.clamp(p.y / world.top, 0, 1), mode !== 'title');
    A.music(S.districtAt(world, p.y), mode === 'title' ? 0 : (curSet || sim.rise.on) ? 2 : 1);
  }

  /* ---------- boot ---------- */
  save = load() || freshSave();
  buildMain();
  daily = loadDaily();
  R.init(cv);
  startSim();
  showTitle();
  requestAnimationFrame(loop);

  // Console helpers for development: Spire.dev.warp(8) jumps to camp 8 with its tools unlocked.
  S.dev = {
    state: function () { return { sim: sim, save: save, world: world, mode: mode, run: run, daily: daily, endless: endless }; },
    warp: function (i) {
      if (run) return;
      i = S.clamp(i | 0, 0, world.camps.length - 1);
      save.camp = i; save.maxCamp = Math.max(save.maxCamp, i);
      for (var k = 0; k <= i; k++) { save.visited[k] = 1; save.seen[k] = 1; }
      applyMods(); sim.checkpoint = world.camps[i].hold; S.respawn(sim); R.snap(sim, 'play'); curSet = null;
    }
  };
})();
