/* Spire — core simulation and tower generation.
   No DOM in this file, so the same code runs in the browser and in Node (tests/verify.js). */
(function (root) {
  'use strict';
  var S = root.Spire = root.Spire || {};

  var C = S.C = {
    W: 360,            // tower face width in world units
    G: 1400,           // gravity
    VMAX: 760,         // base leap speed at full power
    PR: 9,             // player radius
    DRAG_FULL: 130,    // drag length (world units) for full power
    DRAG_MIN: 14,
    GRAB_ASSIST: 7,
    GRAB_SPEED: 1050,  // falling faster than this, you cannot catch a hold
    FALL_DEATH: 720,   // drop below your last apex that ends the attempt
    VTERM: 1500,
    ST_MAX: 100, ST_DRAIN: 6, ST_LEAP: 5, ST_REST: 45, ST_GLIDE: 9, ST_GRAPPLE: 6,
    GRAPPLE_R: 250, ZIP_SPEED: 1500,
    GLIDE_FALL: 80, GLIDE_STEER: 700, GLIDE_VX: 240, UPDRAFT_V: 330,
    CRUMBLE_T: 1.1, CRUMBLE_BACK: 3.5,
    SHARD_R: 24,
    M_PER_UNIT: 0.3,   // metres shown per world unit
    DT: 1 / 120,
    SEED: 20261112
  };

  var DISTRICTS = S.DISTRICTS = [
    { key: 'roots', name: 'The Roots', nodes: [9, 11], dy: [58, 100], margin: 0.70, restEvery: 3,
      kinds: { leap: 10, crumble: 2 } },
    { key: 'works', name: 'The Works', nodes: [10, 12], dy: [64, 125], margin: 0.76, restEvery: 3,
      kinds: { leap: 8, crumble: 2, moving: 3, vent: 4, grapple: 3 }, intro: 'grapple' },
    { key: 'gardens', name: 'The Gardens', nodes: [11, 13], dy: [66, 135], margin: 0.80, restEvery: 3,
      kinds: { leap: 6, slick: 3, wind: 3, updraft: 3, grapple: 2, moving: 2, crumble: 1 }, intro: 'updraft' },
    { key: 'crown', name: 'The Crown', nodes: [11, 13], dy: [70, 145], margin: 0.84, restEvery: 3,
      kinds: { leap: 5, plate: 4, eplate: 3, grapple: 2, updraft: 2, vent: 2, moving: 2, crumble: 2 }, intro: 'plate' }
  ];
  var SEGS = 4; // segments (camp to camp) per district

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  S.clamp = clamp;

  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  S.rng = rng;

  /* ---------- time-dependent pieces (pure functions of sim time) ---------- */
  function holdX(h, t) { return h.type === 'moving' ? h.x0 + h.amp * Math.sin(h.w * t + h.ph) : h.x; }
  function cyc(o, t) { return (t + o.ph) % o.period; }
  function ventOn(v, t) { return cyc(v, t) < v.dur; }
  function ventWarn(v, t) { return cyc(v, t) > v.period - 0.6; }
  function plateOn(h, t) { return !!h.elec && cyc(h, t) < h.dur; }
  function plateWarn(h, t) { return !!h.elec && cyc(h, t) > h.period - 0.8; }
  S.holdX = holdX; S.ventOn = ventOn; S.ventWarn = ventWarn; S.plateOn = plateOn; S.plateWarn = plateWarn;

  /* ---------- tower generation ---------- */
  function generate(seed) {
    var rnd = rng(seed == null ? C.SEED : seed);
    function R(a, b) { return a + (b - a) * rnd(); }
    function RI(a, b) { return Math.floor(R(a, b + 1)); }

    var W = { holds: [], vents: [], winds: [], drafts: [], shards: [], camps: [], anchors: [], gates: [] };
    var mainIdx = 0, seg = 0, dist = 0;

    function mk(type, x, y) {
      var h = { type: type, x: x, y: y, r: 12 };
      if (type === 'ledge') { h.hw = R(24, 36); h.x = clamp(x, h.hw + 12, C.W - h.hw - 12); }
      else if (type === 'moving') {
        h.amp = R(28, 50); h.x0 = clamp(x, h.amp + 30, C.W - h.amp - 30); h.x = h.x0;
        h.w = R(1.3, 2.0); h.ph = R(0, 6.28);
      } else if (type === 'anchor') h.r = 10;
      return h;
    }
    function commit(h, side) {
      h.id = W.holds.length; h.seg = seg; h.d = dist; h.side = !!side;
      h.main = side ? mainIdx : (W.holds.length ? ++mainIdx : 0);
      W.holds.push(h);
      if (h.type === 'anchor') W.anchors.push(h.id);
      return h;
    }
    function cx(h) { return h.type === 'moving' ? h.x0 : h.x; }
    function srcPts(h) {
      if (h.type === 'moving') return [[h.x0 - h.amp, h.y], [h.x0 + h.amp, h.y]];
      if (h.type === 'ledge') return [[h.x, h.y + 15]];
      if (h.type === 'camp') return [[h.x - 60, h.y + 15], [h.x + 60, h.y + 15]];
      if (h.type === 'plate') return [[h.x, h.y1 - 14]];
      return [[h.x, h.y]];
    }
    function dstPts(h) {
      if (h.type === 'moving') return [[h.x0 - h.amp, h.y], [h.x0 + h.amp, h.y]];
      if (h.type === 'plate') return [[h.x, h.y0 + 34]];
      return [[h.x, h.y]];
    }
    function top(h) { return srcPts(h)[0][1]; }
    // Can a leap at m * VMAX get from (sx,sy) to (tx,ty)?  Minimum-speed ballistic condition.
    function ok(sx, sy, tx, ty, m) {
      var dy = ty - sy, dx = tx - sx, v = m * C.VMAX;
      return C.G * (dy + Math.sqrt(dx * dx + dy * dy)) <= v * v;
    }
    function reach(a, b, m) {
      var s = srcPts(a), d = dstPts(b), i, j;
      for (i = 0; i < s.length; i++) for (j = 0; j < d.length; j++)
        if (!ok(s[i][0], s[i][1], d[j][0], d[j][1], m)) return false;
      return true;
    }
    function place(cur, type, m, dyR) {
      var t0 = top(cur), mm = m, h, i, c = cx(cur);
      if (cur.type === 'camp') mm = Math.min(0.92, m + 0.14);
      if (cur.type === 'moving' || type === 'moving') mm = Math.min(0.92, mm + 0.08);
      for (i = 0; i < 120; i++) {
        var dy = R(dyR[0], cur.type === 'camp' ? Math.min(dyR[1], 92) : dyR[1]) * (i > 60 ? 0.75 : 1);
        var x = cur.type === 'camp' ? R(120, 240) : R(34, 326);
        if (cur.type !== 'camp' && Math.abs(x - c) < 36) continue;
        h = mk(type, x, t0 + dy);
        if (reach(cur, h, mm)) return h;
      }
      return mk(type === 'moving' ? 'grip' : type, clamp(c + (c < 180 ? 64 : -64), 40, 320), t0 + 56);
    }
    function shard(x, y, v) { W.shards.push({ id: W.shards.length, x: x, y: y, v: v || 1 }); }
    function between(a, b) {
      var s = srcPts(a)[0];
      shard((s[0] + cx(b)) / 2, (s[1] + b.y) / 2 + 24, 1);
    }
    function nearVent(y) {
      for (var i = Math.max(0, W.vents.length - 4); i < W.vents.length; i++)
        if (Math.abs(W.vents[i].y - y) < 34) return true;
      return false;
    }
    function sideHold(cur, nxt, m) {
      var c = cx(cur), dir = cx(nxt) >= c ? -1 : 1, t0 = top(cur);
      for (var i = 0; i < 12; i++) {
        var x = clamp(c + dir * R(70, 125), 34, 326), y = t0 + R(36, 88);
        if (Math.abs(x - c) < 50) continue;
        var h = mk('grip', x, y);
        if (!reach(cur, h, m) || !reach(h, nxt, Math.min(0.9, m + 0.08))) continue;
        if (nearVent(y)) continue;
        if (Math.sqrt((x - cx(nxt)) * (x - cx(nxt)) + (y - nxt.y) * (y - nxt.y)) < 60) continue;
        commit(h, true); h.main = cur.main;
        shard(x, y + 16, 3);
        return;
      }
    }
    function vent(a, b) {
      var s = srcPts(a)[0], y = (s[1] + b.y) / 2, i;
      if (y - s[1] < 30 || b.y - y < 30) return;
      var mx = (s[0] + cx(b)) / 2, side = mx < 180 ? -1 : 1, len = 235;
      var x0 = side < 0 ? 0 : C.W - len, x1 = side < 0 ? len : C.W;
      for (i = Math.max(0, W.holds.length - 8); i < W.holds.length; i++) {
        var h = W.holds[i];
        if (h.type !== 'plate' && Math.abs(h.y - y) < 28 && h.x > x0 - 20 && h.x < x1 + 20) return;
      }
      W.vents.push({ id: W.vents.length, side: side, y: y, x0: x0, x1: x1, period: R(2.6, 3.2), dur: 0.9, ph: R(0, 3) });
    }
    function pick(kinds) {
      var tot = 0, k;
      for (k in kinds) tot += kinds[k];
      var r = rnd() * tot;
      for (k in kinds) { r -= kinds[k]; if (r <= 0) return k; }
      return 'leap';
    }

    var cur = commit({ type: 'camp', x: 180, y: 40, hw: 120, r: 0 });
    cur.camp = 0; W.camps.push({ hold: cur.id, y: cur.y, d: 0, idx: 0 }); W.gates.push(cur.y);

    for (dist = 0; dist < DISTRICTS.length; dist++) {
      var cfg = DISTRICTS[dist];
      for (var s = 0; s < SEGS; s++, seg++) {
        var tutorial = seg === 0;
        var n = tutorial ? 7 : RI(cfg.nodes[0], cfg.nodes[1]);
        var m = tutorial ? 0.6 : cfg.margin;
        var restEvery = tutorial ? 2 : cfg.restEvery;
        var dyR = tutorial ? [55, 78] : cfg.dy;
        var sinceRest = 0, count = 0, windLeft = 0;
        var forced = (s === 0 && cfg.intro) ? cfg.intro : null;

        var advance = function (h) {
          cur = commit(h); count++;
          sinceRest = h.type === 'ledge' ? 0 : sinceRest + 1;
        };

        while (count < n) {
          var kind = 'leap', nxt, prev, t0, j;
          if (count === 1 && forced) { kind = forced; forced = null; }
          else if (!tutorial && count > 0) kind = pick(cfg.kinds);
          var needRest = sinceRest >= restEvery;
          if (needRest && kind !== 'updraft') kind = 'leap';
          var mm = m;
          if (windLeft > 0) { mm = m - 0.1; windLeft--; }

          if (kind === 'wind') {
            t0 = top(cur);
            W.winds.push({ id: W.winds.length, y0: t0 + 24, y1: t0 + 24 + R(300, 380), ax: (rnd() < 0.5 ? -1 : 1) * R(230, 310) });
            windLeft = 3; mm = m - 0.1; kind = 'leap';
          }

          if (kind === 'leap' || kind === 'vent' || kind === 'slick') {
            var type = needRest ? 'ledge' : (kind === 'slick' ? 'slick' : 'grip');
            var range = kind === 'vent' ? [Math.max(dyR[0], 72), dyR[1]] : dyR;
            nxt = place(cur, type, mm, range);
            prev = cur;
            if (kind === 'vent') vent(prev, nxt);
            else if (tutorial ? count < 4 : rnd() < 0.7) between(prev, nxt);
            advance(nxt);
            if (type === 'slick') sinceRest++;
            if (!tutorial && kind === 'leap' && rnd() < 0.4) sideHold(prev, nxt, mm);
          } else if (kind === 'crumble') {
            var k = dist === 0 ? 1 : 2;
            for (j = 0; j < k; j++) {
              nxt = place(cur, 'crumble', mm, dyR);
              if (rnd() < 0.5) between(cur, nxt);
              advance(nxt);
            }
          } else if (kind === 'moving') {
            nxt = place(cur, 'moving', mm, dyR);
            advance(nxt);
          } else if (kind === 'grapple') {
            t0 = top(cur);
            nxt = mk('anchor', clamp(cx(cur) + R(-90, 90), 50, 310), t0 + R(270, 330));
            advance(nxt);
          } else if (kind === 'updraft') {
            t0 = top(cur);
            var c0 = cx(cur), dir = c0 < 180 ? 1 : -1;
            var dcx = clamp(c0 + dir * R(70, 125), 60, 300), H = R(330, 440);
            W.drafts.push({ id: W.drafts.length, x0: dcx - 36, x1: dcx + 36, y0: t0 - 70, y1: t0 + H });
            for (j = 1; j <= 3; j++) shard(dcx + (j - 2) * 12, t0 + H * j / 4.4, 1);
            nxt = mk('ledge', dcx, t0 + H - 34); nxt.hw = 26; nxt.x = dcx; nxt.viaDraft = true;
            advance(nxt);
          } else if (kind === 'plate' || kind === 'eplate') {
            t0 = top(cur);
            var hw = R(42, 58), px = clamp(cx(cur) + R(-70, 70), hw + 24, C.W - hw - 24);
            var y0 = t0 + R(40, 70), PH = R(230, 320);
            nxt = { type: 'plate', x: px, hw: hw, y0: y0, y1: y0 + PH, y: y0 + PH / 2, r: 0,
                    elec: kind === 'eplate', period: R(4.0, 4.8), dur: 1.0, ph: R(0, 4) };
            shard(px + (rnd() < 0.5 ? -1 : 1) * hw * 0.5, y0 + PH * 0.6, 2);
            advance(nxt); sinceRest++;
          }
        }

        // camp that ends this segment
        var cy = top(cur) + R(60, 72);
        var campIdx = W.camps.length;
        var camp = commit({ type: 'camp', x: 180, y: cy, hw: 120, r: 0 });
        camp.camp = campIdx; camp.d = Math.min(DISTRICTS.length - 1, Math.floor(campIdx / SEGS));
        W.camps.push({ hold: camp.id, y: cy, d: camp.d, idx: campIdx });
        if (campIdx % SEGS === 0 && campIdx / SEGS < DISTRICTS.length) W.gates.push(cy);
        cur = camp;
      }
    }
    W.top = cur.y;

    // spatial buckets
    var B = W.B = 240;
    W.bucketOf = function (y) { var b = Math.floor((y + 480) / B); return b < 0 ? 0 : b; };
    function put(grid, y0, y1, id) {
      for (var b = W.bucketOf(y0); b <= W.bucketOf(y1); b++) (grid[b] || (grid[b] = [])).push(id);
    }
    W.grid = { holds: [], vents: [], winds: [], drafts: [], shards: [] };
    W.holds.forEach(function (h) {
      if (h.type === 'plate') put(W.grid.holds, h.y0 - 30, h.y1 + 30, h.id);
      else put(W.grid.holds, h.y - 60, h.y + 60, h.id);
    });
    W.vents.forEach(function (v) { put(W.grid.vents, v.y - 40, v.y + 40, v.id); });
    W.winds.forEach(function (w) { put(W.grid.winds, w.y0, w.y1, w.id); });
    W.drafts.forEach(function (d) { put(W.grid.drafts, d.y0, d.y1, d.id); });
    W.shards.forEach(function (sh) { put(W.grid.shards, sh.y - 40, sh.y + 40, sh.id); });
    return W;
  }
  S.generate = generate;

  S.districtAt = function (W, y) {
    var d = 0;
    for (var i = 1; i < W.gates.length; i++) if (y >= W.gates[i] - 30) d = i;
    return d;
  };
  S.toolsFor = function (maxCamp) {
    return { grapple: maxCamp >= SEGS, glider: maxCamp >= SEGS * 2, gloves: maxCamp >= SEGS * 3 };
  };

  /* ---------- simulation ---------- */
  function ev(sim, type, a, b) { if (!sim.ghost) sim.events.push({ type: type, a: a, b: b }); }

  function createSim(world, o) {
    o = o || {};
    var sim = {
      world: world, t: 0, ghost: false, events: [],
      tools: o.tools || { grapple: false, glider: false, gloves: false },
      mods: o.mods || { stMax: C.ST_MAX, vmax: C.VMAX, drain: 1, pitonMax: 2 },
      crumble: {}, taken: o.taken || {},
      checkpoint: o.checkpoint != null ? o.checkpoint : world.camps[0].hold,
      pitons: 0, pitonHold: -1,
      p: { x: 0, y: 0, vx: 0, vy: 0, state: 'hold', hold: -1, stamina: C.ST_MAX, lastHold: -1, lastHoldT: -9,
           apexY: 0, noGrabT: 0, wantGlide: false, gliding: false, steer: 0, zipTo: -1, secondWind: true,
           hitT: -9, deadT: 0, face: 1 }
    };
    sim.pitons = sim.mods.pitonMax;
    respawn(sim);
    return sim;
  }

  function attach(sim, h, px, py) {
    var p = sim.p;
    p.state = 'hold'; p.hold = h.id; p.vx = 0; p.vy = 0; p.gliding = false; p.zipTo = -1;
    if (h.type === 'ledge' || h.type === 'camp') {
      p.x = clamp(px, h.x - h.hw + 8, h.x + h.hw - 8); p.y = h.y + 6 + C.PR;
      p.secondWind = true;
    } else if (h.type === 'plate') {
      p.x = clamp(px, h.x - h.hw + 6, h.x + h.hw - 6); p.y = clamp(py, h.y0 + 6, h.y1 - 6);
    } else { p.x = holdX(h, sim.t); p.y = h.y; }
    p.apexY = p.y;
    if (h.type === 'crumble') sim.crumble[h.id] = { t0: sim.t, back: 0 };
    if (h.type === 'camp') {
      sim.checkpoint = h.id; sim.pitonHold = -1; sim.pitons = sim.mods.pitonMax;
      ev(sim, 'camp', h.camp);
    }
  }
  function detach(sim) {
    var p = sim.p;
    p.lastHold = p.hold; p.lastHoldT = sim.t; p.hold = -1; p.state = 'air'; p.apexY = p.y;
  }

  function respawn(sim) {
    var p = sim.p, h = sim.world.holds[sim.checkpoint];
    sim.crumble = {};
    p.lastHold = -1; p.lastHoldT = -9; p.noGrabT = 0; p.wantGlide = false; p.steer = 0; p.hitT = -9;
    p.stamina = sim.mods.stMax;
    var keepEvents = sim.ghost;
    sim.ghost = true;                       // do not re-announce the camp on respawn
    attach(sim, h, h.x, h.y);
    sim.ghost = keepEvents;
  }
  S.respawn = respawn;

  function leap(sim, vx, vy) {
    var p = sim.p;
    if (p.state !== 'hold') return false;
    var sp = Math.sqrt(vx * vx + vy * vy), vm = sim.mods.vmax;
    if (sp < 1) return false;
    if (sp > vm) { vx *= vm / sp; vy *= vm / sp; sp = vm; }
    p.stamina = Math.max(0, p.stamina - C.ST_LEAP * sp / vm);
    detach(sim);
    p.vx = vx; p.vy = vy;
    if (Math.abs(vx) > 20) p.face = vx > 0 ? 1 : -1;
    ev(sim, 'leap', sp / vm);
    return true;
  }
  S.leap = leap;

  function grapple(sim, tx, ty) {
    var p = sim.p, W = sim.world;
    if (!sim.tools.grapple || p.state === 'dead' || p.state === 'zip') return false;
    var best = -1, bd = 1e18, R2 = C.GRAPPLE_R * C.GRAPPLE_R;
    for (var i = 0; i < W.anchors.length; i++) {
      var h = W.holds[W.anchors[i]];
      if (h.id === p.hold) continue;
      var dx = h.x - p.x, dy = h.y - p.y;
      if (dx * dx + dy * dy > R2) continue;
      var ex = tx == null ? dx : h.x - tx, ey = ty == null ? dy : h.y - ty, d = ex * ex + ey * ey;
      if (d < bd) { bd = d; best = h.id; }
    }
    if (best < 0) { ev(sim, 'nograpple'); return false; }
    if (p.state === 'hold') detach(sim);
    p.state = 'zip'; p.zipTo = best; p.gliding = false;
    p.stamina = Math.max(0, p.stamina - C.ST_GRAPPLE);
    ev(sim, 'zip', best);
    return true;
  }
  S.grapple = grapple;

  function placePiton(sim) {
    var p = sim.p;
    if (p.state !== 'hold' || sim.pitons <= 0) return false;
    var h = sim.world.holds[p.hold];
    if (h.type !== 'grip' && h.type !== 'ledge' && h.type !== 'anchor' && h.type !== 'slick') return false;
    if (h.id === sim.pitonHold) return false;
    sim.pitonHold = h.id; sim.checkpoint = h.id; sim.pitons--;
    ev(sim, 'piton', h.id);
    return true;
  }
  S.placePiton = placePiton;

  function canGrab(sim, h) {
    var p = sim.p, t = sim.t;
    if (h.id === p.lastHold && t - p.lastHoldT < (h.type === 'plate' ? 0.12 : 0.25)) return false;
    switch (h.type) {
      case 'ledge': case 'camp':
        return Math.abs(p.x - h.x) <= h.hw + 10 && Math.abs(p.y - (h.y + 2)) <= 6 + C.PR + C.GRAB_ASSIST;
      case 'plate':
        return sim.tools.gloves && !plateOn(h, t) && p.vy <= 80 &&
               Math.abs(p.x - h.x) <= h.hw + 2 && p.y >= h.y0 && p.y <= h.y1;
      case 'crumble':
        var c = sim.crumble[h.id];
        if (c && c.back > t) return false;
        /* falls through */
      default:
        var dx = p.x - holdX(h, t), dy = p.y - h.y, rr = h.r + C.PR + C.GRAB_ASSIST;
        return dx * dx + dy * dy <= rr * rr;
    }
  }

  function knock(sim, dir, power) {
    var p = sim.p;
    if (p.state === 'hold') detach(sim);
    p.state = 'air'; p.zipTo = -1;
    p.vx = dir * power; p.vy = Math.max(p.vy, 60);
    p.noGrabT = sim.t + 0.3; p.hitT = sim.t;
    p.stamina = Math.max(0, p.stamina - 12);
    ev(sim, 'knock');
  }

  function hazards(sim, b) {
    var p = sim.p, W = sim.world, t = sim.t, i, list;
    list = W.grid.vents[b];
    if (list && t - p.hitT > 0.5) for (i = 0; i < list.length; i++) {
      var v = W.vents[list[i]];
      if (ventOn(v, t) && Math.abs(p.y - v.y) <= 13 + C.PR && p.x >= v.x0 - C.PR && p.x <= v.x1 + C.PR) {
        knock(sim, -v.side, 430); break;
      }
    }
    if (sim.ghost) return;
    list = W.grid.shards[b];
    if (list) for (i = 0; i < list.length; i++) {
      var s = W.shards[list[i]];
      if (sim.taken[s.id]) continue;
      var dx = s.x - p.x, dy = s.y - p.y;
      if (dx * dx + dy * dy <= C.SHARD_R * C.SHARD_R) { sim.taken[s.id] = 1; ev(sim, 'shard', s.v, s.id); }
    }
  }

  function step(sim, dt) {
    var p = sim.p, W = sim.world, i, list, h;
    sim.t += dt;
    var t = sim.t;
    if (p.state === 'dead') return;
    var b = W.bucketOf(p.y);

    if (p.state === 'hold') {
      h = W.holds[p.hold];
      if (h.type === 'moving') p.x = holdX(h, t);
      if (h.type === 'ledge' || h.type === 'camp') {
        p.stamina = Math.min(sim.mods.stMax, p.stamina + C.ST_REST * dt);
      } else {
        p.stamina -= C.ST_DRAIN * sim.mods.drain * (h.type === 'slick' ? 2.5 : 1) * dt;
        if (p.stamina <= 0) {
          detach(sim); p.vx = 0; p.vy = -30; p.noGrabT = t + 0.5;
          p.stamina = p.secondWind ? 22 : 6; p.secondWind = false;
          ev(sim, 'slip'); return;
        }
      }
      if (h.type === 'crumble') {
        var c = sim.crumble[h.id];
        if (c && c.t0 != null && t - c.t0 >= C.CRUMBLE_T) {
          c.t0 = null; c.back = t + C.CRUMBLE_BACK;
          detach(sim); p.vx = 0; p.vy = -30; p.noGrabT = t + 0.35;
          ev(sim, 'crumble', h.id); return;
        }
      }
      if (h.type === 'plate' && plateOn(h, t)) {
        detach(sim);
        p.vx = (p.x < C.W / 2 ? 1 : -1) * 160; p.vy = -40; p.noGrabT = t + 0.5; p.hitT = t;
        p.stamina = Math.max(5, p.stamina - 22);
        ev(sim, 'shock'); return;
      }
      hazards(sim, b);
      return;
    }

    if (p.state === 'zip') {
      h = W.holds[p.zipTo];
      var zx = holdX(h, t) - p.x, zy = h.y - p.y, zd = Math.sqrt(zx * zx + zy * zy), zs = C.ZIP_SPEED * dt;
      if (zd <= zs + 2) { attach(sim, h, p.x, p.y); ev(sim, 'grab', h.id, 1); }
      else { p.x += zx / zd * zs; p.y += zy / zd * zs; if (Math.abs(zx) > 4) p.face = zx > 0 ? 1 : -1; }
      return;
    }

    // airborne
    p.gliding = p.wantGlide && sim.tools.glider && p.stamina > 0;
    list = W.grid.winds[b];
    if (list) for (i = 0; i < list.length; i++) {
      var w = W.winds[list[i]];
      if (p.y >= w.y0 && p.y <= w.y1) p.vx += w.ax * dt * (p.gliding ? 1.4 : 1);
    }
    if (p.gliding) {
      var inDraft = false;
      list = W.grid.drafts[b];
      if (list) for (i = 0; i < list.length; i++) {
        var d = W.drafts[list[i]];
        if (p.x >= d.x0 && p.x <= d.x1 && p.y >= d.y0 && p.y <= d.y1) { inDraft = true; break; }
      }
      var target = inDraft ? C.UPDRAFT_V : -C.GLIDE_FALL;
      if (p.vy > target) p.vy = Math.max(target, p.vy - C.G * dt);
      else p.vy = Math.min(target, p.vy + (inDraft ? 1500 : 2600) * dt);
      p.vx += p.steer * C.GLIDE_STEER * dt;
      if (p.vx > C.GLIDE_VX) p.vx -= (p.vx - C.GLIDE_VX) * Math.min(1, 4 * dt);
      else if (p.vx < -C.GLIDE_VX) p.vx -= (p.vx + C.GLIDE_VX) * Math.min(1, 4 * dt);
      p.stamina = Math.max(0, p.stamina - C.ST_GLIDE * dt);
      if (p.apexY > p.y + 300) p.apexY = p.y + 300;   // a glide breaks the fall
    } else {
      p.vy -= C.G * dt;
    }
    if (p.vy < -C.VTERM) p.vy = -C.VTERM;
    p.x += p.vx * dt; p.y += p.vy * dt;
    if (p.x < C.PR + 2) { p.x = C.PR + 2; p.vx = Math.abs(p.vx) * 0.3; }
    else if (p.x > C.W - C.PR - 2) { p.x = C.W - C.PR - 2; p.vx = -Math.abs(p.vx) * 0.3; }
    if (p.y > p.apexY) p.apexY = p.y;
    if (Math.abs(p.vx) > 30) p.face = p.vx > 0 ? 1 : -1;

    b = W.bucketOf(p.y);
    hazards(sim, b);
    if (p.state !== 'air') return;

    if (t >= p.noGrabT && p.vx * p.vx + p.vy * p.vy <= C.GRAB_SPEED * C.GRAB_SPEED) {
      list = W.grid.holds[b];
      if (list) for (i = 0; i < list.length; i++) {
        h = W.holds[list[i]];
        if (canGrab(sim, h)) {
          var sp = Math.sqrt(p.vx * p.vx + p.vy * p.vy) / C.VMAX;
          attach(sim, h, p.x, p.y);
          ev(sim, 'grab', h.id, sp);
          return;
        }
      }
    }
    if ((p.apexY - p.y > C.FALL_DEATH && !p.gliding) || p.y < -60) {
      p.state = 'dead'; p.deadT = t; p.gliding = false;
      ev(sim, 'fall', p.x, p.y);
    }
  }
  S.step = step;

  function cloneSim(s) {
    var c = { world: s.world, t: s.t, ghost: true, events: [], tools: s.tools, mods: s.mods, crumble: {},
              taken: s.taken, checkpoint: s.checkpoint, pitons: s.pitons, pitonHold: s.pitonHold, p: {} }, k;
    for (k in s.p) c.p[k] = s.p[k];
    for (k in s.crumble) c.crumble[k] = { t0: s.crumble[k].t0, back: s.crumble[k].back };
    return c;
  }
  S.cloneSim = cloneSim;

  // Trajectory preview for a leap from the current hold. Returns points and the hold it would catch.
  S.preview = function (sim, vx, vy, dur) {
    var c = cloneSim(sim), pts = [], hit = -1, n = Math.round(dur / C.DT);
    if (!leap(c, vx, vy)) return { pts: pts, hit: -1 };
    for (var i = 0; i < n; i++) {
      step(c, C.DT);
      if (c.p.state !== 'air') { if (c.p.state === 'hold') hit = c.p.hold; break; }
      if (i % 5 === 4) pts.push(c.p.x, c.p.y);
    }
    return { pts: pts, hit: hit };
  };

  S.createSim = createSim;
  if (typeof module !== 'undefined' && module.exports) module.exports = S;
})(typeof window !== 'undefined' ? window : globalThis);
