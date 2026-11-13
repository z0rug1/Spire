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
    GLIDE_FALL: 80, GLIDE_EASE: 3.2, GLIDE_VX: 240, UPDRAFT_V: 330,
    CRUMBLE_T: 1.1, CRUMBLE_BACK: 3.5,
    SPRING_V: 880,     // launch speed off a bounce cap
    TUBE_V: 600,       // exit speed from a pneumatic tube
    SHARD_R: 24,
    M_PER_UNIT: 0.3,   // metres shown per world unit
    DT: 1 / 120,
    SEED: 20261112
  };

  var DISTRICTS = S.DISTRICTS = [
    { key: 'roots', name: 'The Roots', nodes: [9, 11], dy: [58, 100], margin: 0.70, restEvery: 3,
      kinds: { leap: 10, crumble: 2, spring: 3 } },
    { key: 'works', name: 'The Works', nodes: [10, 12], dy: [64, 125], margin: 0.76, restEvery: 3,
      kinds: { leap: 8, crumble: 2, moving: 3, vent: 4, grapple: 3, tube: 3, lift: 3, drip: 5 }, intro: 'grapple' },
    { key: 'gardens', name: 'The Gardens', nodes: [11, 13], dy: [66, 135], margin: 0.80, restEvery: 3,
      kinds: { leap: 6, slick: 3, wind: 3, updraft: 3, grapple: 2, moving: 2, crumble: 1, spring: 3, phase: 3, bird: 5 }, intro: 'updraft' },
    { key: 'crown', name: 'The Crown', nodes: [11, 13], dy: [70, 145], margin: 0.84, restEvery: 3,
      kinds: { leap: 5, plate: 4, eplate: 3, grapple: 2, updraft: 2, vent: 2, moving: 2, crumble: 2, phase: 3, lift: 3, tube: 3, drone: 5 }, intro: 'plate' }
  ];
  var SEGS = 4; // segments (camp to camp) per district in the main tower

  // A plan is the list of segments a tower is built from. `set` marks a hand-built set piece;
  // `parts: 2` splits the segment in two with a bivouac (an unnamed checkpoint) in the middle.
  var MAIN_PLAN = S.MAIN_PLAN = [];
  (function () {
    var sets = { 2: 'dark', 6: 'slag', 10: 'storm', 14: 'alt' };
    for (var i = 0; i < SEGS * 4; i++)
      MAIN_PLAN.push({ d: i >> 2, set: sets[i] || null, tutorial: i === 0, intro: i % SEGS === 0, parts: 2 });
  })();
  S.DAILY_PLAN = [{ d: 0, n: 7 }, { d: 1, n: 8, intro: true }, { d: 2, n: 8, intro: true }, { d: 3, n: 8, intro: true }];
  // Daily towers are seeded by the local date. DAILY_SALT lists the dates whose first seed
  // produced a gap the test climber could not cross (see tests/verify.js --daily).
  S.DAILY_SALT = {};
  S.dateKey = function (d) { d = d || new Date(); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); };
  S.dailySeed = function (key) { return (Math.imul(key, 2654435761) + (S.DAILY_SALT[key] || 0) * 7919) >>> 0; };

  // The endless climb: segment L of a tower with no top. It cycles through the four districts,
  // drops in a set piece every fifth segment, and gets harder for the first twenty segments.
  S.ENDLESS_SEED = 77261112;
  S.endlessSeg = function (L) {
    var hard = Math.min(1, L / 20), sp = { d: L % 4, hard: hard, n: 8 + Math.round(4 * hard) };
    if (L % 5 === 4) {
      sp.set = ['slag', 'storm', 'alt', 'dark'][Math.floor(L / 5) % 4];
      sp.d = { slag: 1, storm: 2, alt: 3, dark: 0 }[sp.set];
      sp.riseSpeed = 22 + 10 * hard;
    }
    return sp;
  };

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
  // 0 at the bottom, 1 at the top; the hook waits a moment at each end before it travels
  function liftS(h, t) { var v = 0.5 - 0.8 * Math.cos(h.w * t + h.ph); return v < 0 ? 0 : v > 1 ? 1 : v; }
  function holdX(h, t) {
    if (h.type === 'moving') return h.x0 + h.amp * Math.sin(h.w * t + h.ph);
    if (h.type === 'lift') return h.x0 + h.ax * liftS(h, t);
    return h.x;
  }
  function holdY(h, t) { return h.type === 'lift' ? h.y0 + h.ay * liftS(h, t) : h.y; }
  function cyc(o, t) { return (t + o.ph) % o.period; }
  function ventOn(v, t) { return cyc(v, t) < v.dur; }
  function ventWarn(v, t) { return cyc(v, t) > v.period - 0.6; }
  function plateOn(h, t) { return !!h.elec && cyc(h, t) < h.dur; }
  function plateWarn(h, t) { return !!h.elec && cyc(h, t) > h.period - 0.8; }
  function phaseOn(h, t) { return cyc(h, t) < h.on; }                      // a phase hold is solid while this is true
  function phaseWarn(h, t) { var c = cyc(h, t); return c < h.on && c > h.on - 0.6; }
  // Moving hazards: slag drips, birds and patrol drones. Each is a pure function of time, so the
  // aim preview and the test climber can see them coming.
  function mobPos(m, t, o) {
    var c;
    if (m.kind === 'drip') { c = (t + m.ph) % m.period; o.on = c * m.v < m.fall; o.x = m.x; o.y = m.y - c * m.v; o.dir = 0; }
    else if (m.kind === 'bird') { c = m.w * t + m.ph; o.on = true; o.x = 180 + 150 * Math.sin(c); o.y = m.y + 9 * Math.sin(c * 3.1); o.dir = Math.cos(c) >= 0 ? 1 : -1; }
    else { c = m.w * t + m.ph; o.on = true; o.x = m.x; o.y = m.y + m.amp * Math.sin(c); o.dir = Math.cos(c) >= 0 ? 1 : -1; }
    return o;
  }
  var MP = { x: 0, y: 0, on: false, dir: 0 };
  S.mobPos = mobPos;
  S.holdX = holdX; S.holdY = holdY; S.ventOn = ventOn; S.ventWarn = ventWarn;
  S.plateOn = plateOn; S.plateWarn = plateWarn; S.phaseOn = phaseOn; S.phaseWarn = phaseWarn;

  /* ---------- tower generation ---------- */
  function generate(seed, plan, opts) {
    plan = plan || MAIN_PLAN; opts = opts || {};
    var rnd = rng(seed == null ? C.SEED : seed);
    function R(a, b) { return a + (b - a) * rnd(); }
    function RI(a, b) { return Math.floor(R(a, b + 1)); }

    var W = { holds: [], vents: [], winds: [], drafts: [], shards: [], camps: [], anchors: [], springs: [], tubes: [], mobs: [],
              gates: [], bands: [], sets: [], rises: [], segs: 0 };
    var mainIdx = 0, seg = 0, dist = 0;

    function mk(type, x, y) {
      var h = { type: type, x: x, y: y, r: 12 };
      if (type === 'ledge') { h.hw = R(24, 36); h.x = clamp(x, h.hw + 12, C.W - h.hw - 12); }
      else if (type === 'moving') {
        h.amp = R(28, 50); h.x0 = clamp(x, h.amp + 30, C.W - h.amp - 30); h.x = h.x0;
        h.w = R(1.3, 2.0); h.ph = R(0, 6.28);
      } else if (type === 'anchor') h.r = 10;
      else if (type === 'phase') { h.period = 3.2; h.on = 2.0; h.ph = R(0, 3.2); }
      else if (type === 'lift') {            // a hook on a counterweight: rides between (x0,y0) and (x0+ax,y0+ay)
        h.ay = R(240, 320); h.ax = R(-40, 40);
        h.x0 = clamp(x, 34 + Math.max(0, -h.ax), 326 - Math.max(0, h.ax)); h.y0 = y;
        h.x = h.x0 + h.ax / 2; h.y = y + h.ay / 2;
        h.w = 6.283 / R(4.8, 5.6); h.ph = R(0, 6.28); h.r = 16;
      }
      return h;
    }
    function commit(h, side) {
      h.id = W.holds.length; h.seg = seg; h.d = dist; h.side = !!side;
      h.main = side ? mainIdx : (W.holds.length ? ++mainIdx : 0);
      W.holds.push(h);
      if (h.type === 'anchor') W.anchors.push(h.id);
      return h;
    }
    function cx(h) { return h.type === 'moving' ? h.x0 : h.type === 'lift' ? h.x0 + h.ax : h.x; }
    function srcPts(h) {
      if (h.type === 'moving') return [[h.x0 - h.amp, h.y], [h.x0 + h.amp, h.y]];
      if (h.type === 'lift') return [[h.x0 + h.ax, h.y0 + h.ay]];
      if (h.type === 'ledge') return [[h.x, h.y + 15]];
      if (h.type === 'camp') return [[h.x - (h.biv ? 36 : 60), h.y + 15], [h.x + (h.biv ? 36 : 60), h.y + 15]];
      if (h.type === 'plate') return [[h.x, h.y1 - 14]];
      return [[h.x, h.y]];
    }
    function dstPts(h) {
      if (h.type === 'moving') return [[h.x0 - h.amp, h.y], [h.x0 + h.amp, h.y]];
      if (h.type === 'lift') return [[h.x0, h.y0]];
      if (h.type === 'plate') return [[h.x, h.y0 + 34]];
      return [[h.x, h.y]];
    }
    function top(h) { return srcPts(h)[0][1]; }
    function hy(h) { return h.type === 'lift' ? h.y0 : h.y; }     // where you first catch it
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
    function place(cur, type, m, dyR, minDx) {
      var t0 = top(cur), mm = m, h, i, c = cx(cur);
      if (cur.type === 'camp') mm = Math.min(0.92, m + 0.14);
      if (cur.type === 'moving' || type === 'moving' || type === 'lift') mm = Math.min(0.92, mm + 0.08);
      for (i = 0; i < 120; i++) {
        var dy = R(dyR[0], cur.type === 'camp' ? Math.min(dyR[1], 92) : dyR[1]) * (i > 60 ? 0.75 : 1);
        var x = cur.type === 'camp' ? R(120, 240) : R(34, 326);
        if (cur.type !== 'camp' && Math.abs(x - c) < (i < 70 && minDx ? minDx : 36)) continue;
        h = mk(type, x, t0 + dy);
        if (i < 90 && mobNear(cx(h), hy(h))) continue;
        if (reach(cur, h, mm)) return h;
      }
      return mk(type === 'moving' || type === 'lift' ? 'grip' : type, clamp(c + (c < 180 ? 64 : -64), 40, 320), t0 + 56);
    }
    function shard(x, y, v) { if (!opts.noShards) W.shards.push({ id: W.shards.length, x: x, y: y, v: v || 1 }); }
    function between(a, b) {
      var s = srcPts(a)[0];
      shard((s[0] + cx(b)) / 2, (s[1] + hy(b)) / 2 + 24, 1);
    }
    function nearVent(y) {
      for (var i = Math.max(0, W.vents.length - 4); i < W.vents.length; i++)
        if (Math.abs(W.vents[i].y - y) < 34) return true;
      return false;
    }
    // Would a hold at (x,y) sit in the path of a recently placed moving hazard?
    function mobHits(m, x, y) {
      if (m.kind === 'bird') return Math.abs(m.y - y) < 36;
      if (Math.abs(m.x - x) > 34) return false;
      return m.kind === 'drip' ? (y < m.y + 14 && y > m.y - m.fall - 12) : Math.abs(m.y - y) < m.amp + 22;
    }
    function mobNear(x, y) {
      for (var i = Math.max(0, W.mobs.length - 3); i < W.mobs.length; i++) if (mobHits(W.mobs[i], x, y)) return true;
      return false;
    }
    // A moving hazard across the leap from a to b. Skipped when it would also threaten a hold.
    function mob(a, b, kind) {
      var s = srcPts(a)[0], bx = cx(b), by = hy(b), mx = (s[0] + bx) / 2, my = (s[1] + by) / 2, m, i;
      if (kind === 'bird') {
        if (my - s[1] < 36 || by - my < 36) return;
        m = { kind: kind, y: my, r: 11, w: R(0.9, 1.3), ph: R(0, 6.28) };
      } else {
        if (Math.abs(bx - s[0]) < 80) return;
        // only as tall as the gap it guards, so it cannot reach the holds below or above the pair
        if (kind === 'drip') m = { kind: kind, x: mx, y: Math.max(s[1], by) + 50, r: 10, v: 230, fall: Math.abs(by - s[1]) + 86, period: R(1.9, 2.5), ph: R(0, 3) };
        else m = { kind: kind, x: mx, y: my, amp: Math.abs(by - s[1]) / 2 + 20, r: 13, w: R(1.3, 1.9), ph: R(0, 6.28) };
      }
      for (i = Math.max(0, W.holds.length - 12); i < W.holds.length; i++) {
        var h = W.holds[i];
        if (h.type === 'plate' || h.type === 'camp') { if (h.type === 'camp' && Math.abs(h.y - my) < 110) return; continue; }
        if (mobHits(m, cx(h), hy(h))) return;
      }
      m.id = W.mobs.length; m.d = dist;
      W.mobs.push(m);
    }
    function sideHold(cur, nxt, m) {
      var c = cx(cur), dir = cx(nxt) >= c ? -1 : 1, t0 = top(cur);
      for (var i = 0; i < 12; i++) {
        var x = clamp(c + dir * R(70, 125), 34, 326), y = t0 + R(36, 88);
        if (Math.abs(x - c) < 50) continue;
        var h = mk('grip', x, y);
        if (!reach(cur, h, m) || !reach(h, nxt, Math.min(0.9, m + 0.08))) continue;
        if (nearVent(y) || mobNear(x, y)) continue;
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
    cur.camp = 0; cur.d = plan[0].d;
    W.camps.push({ hold: cur.id, y: cur.y, d: cur.d, idx: 0 });
    W.gates.push(cur.y); W.bands.push({ y: -1e9, d: cur.d });

    var sinceRest = 0, count = 0;
    function advance(h) {
      cur = commit(h); count++;
      sinceRest = h.type === 'ledge' ? 0 : sinceRest + 1;
      return h;
    }
    function ledgeAt(x, y, hw) { var h = mk('ledge', x, y); h.hw = hw; h.x = x; return advance(h); }
    function plateAt(x, y0, H, ph, side) {
      return advance({ type: 'plate', x: x, hw: 50, y0: y0, y1: y0 + H, y: y0 + H / 2, r: 0,
                       elec: true, period: 4.4, dur: 1.0, ph: ph, alt: side });
    }
    // A bivouac: a small unnamed platform that works as a checkpoint.
    function bivouac() {
      cur = commit({ type: 'camp', biv: true, x: 180, y: top(cur) + R(60, 72), hw: 78, r: 0 });
      sinceRest = 0; count = 0;
    }

    // One stretch of generated climbing: n holds chosen by the district's rules.
    function standard(sp, cfg, tutorial, intro) {
      var n = tutorial ? 7 : (sp.n || RI(cfg.nodes[0], cfg.nodes[1]));
      var m = tutorial ? 0.6 : Math.min(0.9, cfg.margin + 0.06 * (sp.hard || 0));
      var restEvery = tutorial ? 2 : cfg.restEvery;
      var dyR = tutorial ? [55, 78] : cfg.dy;
      var windLeft = 0, forced = (intro && cfg.intro) ? cfg.intro : null;
      var j, nxt, prev, t0, c1, sdir;
      sinceRest = 0; count = 0;

      while (count < n) {
        var kind = 'leap';
        if (count === 1 && forced) { kind = forced; forced = null; }
        else if (!tutorial && count > 0) kind = pick(cfg.kinds);
        var needRest = sinceRest >= restEvery;
        if (needRest && kind !== 'updraft' && kind !== 'spring' && kind !== 'tube' && kind !== 'vent' && kind !== 'drip' && kind !== 'bird' && kind !== 'drone') kind = 'leap';
        if (windLeft > 0 && (kind === 'spring' || kind === 'tube' || kind === 'lift')) kind = 'leap';
        // nothing that needs timing may follow a hold you cannot wait on
        if ((cur.type === 'phase' || cur.type === 'crumble') && kind !== 'spring' && kind !== 'tube') kind = 'leap';
        // a lift has to be waited for, so never hang it after a hold you cannot wait on
        if (kind === 'lift' && (cur.type === 'plate' || cur.type === 'crumble' || cur.type === 'phase' || cur.type === 'slick' || cur.type === 'lift')) kind = 'leap';
        var mm = m;
        if (windLeft > 0) { mm = m - 0.1; windLeft--; }

        if (kind === 'wind') {
          t0 = top(cur);
          W.winds.push({ id: W.winds.length, y0: t0 + 24, y1: t0 + 24 + R(300, 380), ax: (rnd() < 0.5 ? -1 : 1) * R(230, 310) });
          windLeft = 3; mm = m - 0.1; kind = 'leap';
        }

        var isMob = kind === 'drip' || kind === 'bird' || kind === 'drone';
        if (isMob && (cur.type === 'plate' || cur.type === 'slick' || cur.type === 'lift' || windLeft > 0)) { kind = 'leap'; isMob = false; }
        if (kind === 'leap' || kind === 'vent' || kind === 'slick' || isMob) {
          var type = needRest ? 'ledge' : (kind === 'slick' ? 'slick' : 'grip');
          var range = (kind === 'vent' || kind === 'bird') ? [Math.max(dyR[0], 76), dyR[1]] : dyR;
          nxt = place(cur, type, mm, range, kind === 'drip' || kind === 'drone' ? 86 : 0);
          prev = cur;
          if (kind === 'vent') vent(prev, nxt);
          else if (isMob) mob(prev, nxt, kind);
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
        } else if (kind === 'moving' || kind === 'phase') {
          advance(place(cur, kind, mm, dyR));
        } else if (kind === 'lift') {
          advance(place(cur, 'lift', mm, dyR)); sinceRest++;
        } else if (kind === 'grapple') {
          t0 = top(cur);
          advance(mk('anchor', clamp(cx(cur) + R(-90, 90), 50, 310), t0 + R(270, 330)));
        } else if (kind === 'spring') {
          // a bounce cap a short hop away, and a hold straight above it where the bounce carries you
          t0 = top(cur); c1 = cx(cur); sdir = rnd() < 0.5 ? -1 : 1;
          var sx = clamp(c1 + sdir * R(45, 100), 40, 320);
          if (Math.abs(sx - c1) < 34) sx = clamp(c1 - sdir * 72, 40, 320);
          var sy = t0 + R(8, 46);
          W.springs.push({ id: W.springs.length, x: sx, y: sy, d: dist });
          shard(sx, sy + 130, 1);
          advance(mk(needRest ? 'ledge' : 'grip', sx + R(-7, 7), sy + R(215, 248)));
        } else if (kind === 'tube') {
          // a pneumatic tube: drop into the mouth and get fired out of the far end
          t0 = top(cur); c1 = cx(cur); sdir = c1 < 180 ? 1 : -1;
          var ax = clamp(c1 + sdir * R(60, 110), 40, 320), ay = t0 + R(16, 56);
          var bx = R(70, 290), by = ay + R(380, 520);
          W.tubes.push({ id: W.tubes.length, ax: ax, ay: ay, bx: bx, by: by, d: dist });
          advance(mk(needRest ? 'ledge' : 'grip', bx + R(-7, 7), by + R(88, 112)));
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
    }

    // Builds one segment (camp to camp). nd is the district of the segment after it.
    function buildSeg(sp, nd, last) {
      dist = sp.d;
      var cfg = DISTRICTS[dist], j, k2, setY0 = cur.y, rise = null;
      var two = (sp.parts || 1) > 1;
      sinceRest = 0; count = 0;

      if (two) { standard(sp, cfg, !!sp.tutorial, !!sp.intro); bivouac(); setY0 = cur.y; }

      if (sp.set === 'slag') {
        // The Furnace Shaft: grapple up a flooding shaft. Slag rises from the moment you leave the first ledge.
        var trig = ledgeAt(180, top(cur) + 78, 34);
        for (j = 0; j < 4; j++) {
          var sd = j % 2 ? 1 : -1;
          advance(mk('grip', 180 + sd * R(60, 80), top(cur) + R(84, 92)));
          var an = mk('anchor', 180 - sd * R(30, 50), cur.y + R(290, 310));
          shard(an.x, an.y - 70, 1);
          advance(an);
          ledgeAt(180 + sd * R(50, 70), cur.y + R(80, 88), 30);
        }
        rise = { id: W.rises.length, yTrig: trig.y, yEnd: 0, speed: sp.riseSpeed || 22, lead: 260 };
        W.rises.push(rise);
      } else if (sp.set === 'storm') {
        // The Thermal Ladder: ride three updrafts in a row without landing, twice.
        for (k2 = 0; k2 < 2; k2++) {
          var mir = k2 ? -1 : 1;
          ledgeAt(180 + mir * 34, top(cur) + 78, 30);
          var xs = [180 - mir * 84, 180 + mir * 84, 180 - mir * 84], wps = [], cy0 = top(cur) - 40, col = null;
          for (j = 0; j < 3; j++) {
            col = { id: W.drafts.length, x0: xs[j] - 36, x1: xs[j] + 36, y0: cy0, y1: cy0 + (j ? 440 : 480) };
            W.drafts.push(col);
            shard(xs[j], col.y0 + 210, 1); shard(xs[j], col.y0 + 330, 1);
            wps.push([xs[j], j < 2 ? col.y1 - 70 : 1e9]);
            cy0 = col.y1 - 200;
          }
          var fin = mk('ledge', xs[2], col.y1 - 34); fin.hw = 26; fin.x = xs[2]; fin.viaDraft = true; fin.ladder = wps;
          advance(fin);
        }
      } else if (sp.set === 'alt') {
        // The Alternator: left and right plates take turns going live.
        ledgeAt(180, top(cur) + 78, 32);
        for (k2 = 0; k2 < 2; k2++) {
          var p1 = plateAt(108, top(cur) + 46, 240, 0, -1);
          var p2 = plateAt(252, p1.y1 - 70, 240, 2.2, 1);
          shard(108, p1.y0 + 150, 2); shard(252, p2.y0 + 150, 2);
          ledgeAt(150, p2.y1 + 52, 30);
        }
        plateAt(180, top(cur) + 46, 250, 0, -1);
      } else {
        standard(sp, cfg, !two && !!sp.tutorial, !two && !!sp.intro);
      }

      // camp that ends this segment
      var cy = top(cur) + R(60, 72), campIdx = W.camps.length;
      var camp = commit({ type: 'camp', x: 180, y: cy, hw: 120, r: 0 });
      camp.camp = campIdx; camp.d = nd; camp.gate = nd !== dist || !!last;
      W.camps.push({ hold: camp.id, y: cy, d: nd, idx: campIdx });
      if (nd !== dist) { W.gates.push(cy); W.bands.push({ y: cy, d: nd }); }
      if (sp.set) W.sets.push({ type: sp.set, y0: setY0 + 40, y1: cy - 30 });
      if (rise) rise.yEnd = cy - 70;
      cur = camp;
      W.top = cy; W.segs = ++seg;
    }

    // spatial buckets
    var B = W.B = 240;
    W.bucketOf = function (y) { var b = Math.floor((y + 480) / B); return b < 0 ? 0 : b; };
    function put(grid, y0, y1, id) {
      for (var b = W.bucketOf(y0); b <= W.bucketOf(y1); b++) (grid[b] || (grid[b] = [])).push(id);
    }
    function index() {
      var g = W.grid = { holds: [], vents: [], winds: [], drafts: [], shards: [], springs: [], tubes: [], mobs: [] };
      W.holds.forEach(function (h) {
        if (h.type === 'plate') put(g.holds, h.y0 - 30, h.y1 + 30, h.id);
        else if (h.type === 'lift') put(g.holds, h.y0 - 60, h.y0 + h.ay + 60, h.id);
        else put(g.holds, h.y - 60, h.y + 60, h.id);
      });
      W.vents.forEach(function (v) { put(g.vents, v.y - 40, v.y + 40, v.id); });
      W.winds.forEach(function (w) { put(g.winds, w.y0, w.y1, w.id); });
      W.drafts.forEach(function (d) { put(g.drafts, d.y0, d.y1, d.id); });
      W.shards.forEach(function (sh) { put(g.shards, sh.y - 40, sh.y + 40, sh.id); });
      W.springs.forEach(function (s) { put(g.springs, s.y - 40, s.y + 40, s.id); });
      W.tubes.forEach(function (tb) { put(g.tubes, tb.ay - 40, tb.ay + 40, tb.id); });
      W.mobs.forEach(function (m) {
        if (m.kind === 'drip') put(g.mobs, m.y - m.fall - 30, m.y + 30, m.id);
        else if (m.kind === 'bird') put(g.mobs, m.y - 40, m.y + 40, m.id);
        else put(g.mobs, m.y - m.amp - 40, m.y + m.amp + 40, m.id);
      });
    }

    for (var i = 0; i < plan.length; i++)
      buildSeg(plan[i], plan[i + 1] ? plan[i + 1].d : (plan[i].nd != null ? plan[i].nd : plan[i].d), i === plan.length - 1);
    index();
    // Endless towers grow: add one more segment on top.
    W.extend = function (sp, nd) { buildSeg(sp, nd, false); index(); };
    return W;
  }
  S.generate = generate;

  // The endless tower starts with n segments and grows with W.grow(k) as the climber nears the top.
  S.endlessWorld = function (n) {
    var s0 = S.endlessSeg(0);
    s0.nd = S.endlessSeg(1).d;
    var W = generate(S.ENDLESS_SEED, [s0], { noShards: true });
    W.endless = true; W.nextL = 1;
    W.grow = function (k) {
      while (k-- > 0) { W.extend(S.endlessSeg(W.nextL), S.endlessSeg(W.nextL + 1).d); W.nextL++; }
    };
    W.grow((n || 3) - 1);
    return W;
  };

  S.districtAt = function (W, y) {
    var d = W.bands[0].d;
    for (var i = 1; i < W.bands.length; i++) { if (y >= W.bands[i].y - 30) d = W.bands[i].d; else break; }
    return d;
  };
  S.setAt = function (W, y) {
    for (var i = W.sets.length - 1; i >= 0; i--) {
      if (y > W.sets[i].y1) break;
      if (y >= W.sets[i].y0) return W.sets[i];
    }
    return null;
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
      crumble: {}, taken: o.taken || {}, rise: { on: false, id: -1, level: -1e9 },
      checkpoint: o.checkpoint != null ? o.checkpoint : world.camps[0].hold,
      pitons: 0, pitonHold: -1,
      p: { x: 0, y: 0, vx: 0, vy: 0, state: 'hold', hold: -1, stamina: C.ST_MAX, lastHold: -1, lastHoldT: -9,
           apexY: 0, noGrabT: 0, wantGlide: false, gliding: false, steer: 0, zipTo: -1, secondWind: true,
           hitT: -9, deadT: 0, face: 1, springT: -9, tubeT: -9, hops: 0 }
    };
    sim.pitons = sim.mods.pitonMax;
    respawn(sim);
    return sim;
  }

  function attach(sim, h, px, py) {
    var p = sim.p;
    p.state = 'hold'; p.hold = h.id; p.vx = 0; p.vy = 0; p.gliding = false; p.zipTo = -1;
    p.hops = sim.mods.hops || 0;
    if (h.type === 'ledge' || h.type === 'camp') {
      p.x = clamp(px, h.x - h.hw + 8, h.x + h.hw - 8); p.y = h.y + 6 + C.PR;
      p.secondWind = true;
    } else if (h.type === 'plate') {
      p.x = clamp(px, h.x - h.hw + 6, h.x + h.hw - 6); p.y = clamp(py, h.y0 + 6, h.y1 - 6);
    } else { p.x = holdX(h, sim.t); p.y = holdY(h, sim.t); }
    p.apexY = p.y;
    if (h.type === 'crumble') sim.crumble[h.id] = { t0: sim.t, back: 0 };
    if (h.type === 'camp') {
      sim.checkpoint = h.id; sim.pitonHold = -1; sim.pitons = sim.mods.pitonMax;
      if (h.biv) ev(sim, 'biv', h.id); else ev(sim, 'camp', h.camp);
    }
  }
  function detach(sim) {
    var p = sim.p;
    p.lastHold = p.hold; p.lastHoldT = sim.t; p.hold = -1; p.state = 'air'; p.apexY = p.y;
  }

  function respawn(sim) {
    var p = sim.p, h = sim.world.holds[sim.checkpoint];
    sim.crumble = {}; sim.rise = { on: false, id: -1, level: -1e9 };
    p.lastHold = -1; p.lastHoldT = -9; p.noGrabT = 0; p.wantGlide = false; p.steer = 0; p.hitT = -9;
    p.springT = -9; p.tubeT = -9;
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

  // quiet: do not announce a miss (the caller has something else to try)
  function grapple(sim, tx, ty, quiet) {
    var p = sim.p, W = sim.world;
    if (!sim.tools.grapple || p.state === 'dead' || p.state === 'zip') return false;
    var GR = sim.mods.grapR || C.GRAPPLE_R, best = -1, bd = 1e18, R2 = GR * GR;
    for (var i = W.anchors.length - 1; i >= 0; i--) {
      var h = W.holds[W.anchors[i]];
      if (h.y < p.y - GR) break;                   // anchors are stored bottom to top
      if (h.id === p.hold) continue;
      var dx = h.x - p.x, dy = h.y - p.y;
      if (dx * dx + dy * dy > R2) continue;
      var ex = tx == null ? dx : h.x - tx, ey = ty == null ? dy : h.y - ty, d = ex * ex + ey * ey;
      if (d < bd) { bd = d; best = h.id; }
    }
    if (best < 0) { if (!quiet) ev(sim, 'nograpple'); return false; }
    if (p.state === 'hold') detach(sim);
    p.state = 'zip'; p.zipTo = best; p.gliding = false;
    p.stamina = Math.max(0, p.stamina - C.ST_GRAPPLE);
    ev(sim, 'zip', best);
    return true;
  }
  S.grapple = grapple;

  // A kick upward in mid-air. Only climbers with the air-hop perk have any (mods.hops).
  S.airHop = function (sim) {
    var p = sim.p;
    if (p.state !== 'air' || p.hops <= 0) return false;
    p.hops--; p.vy = 560; p.apexY = p.y; p.gliding = false;
    ev(sim, 'hop');
    return true;
  };

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
        return sim.tools.gloves && (sim.mods.insulated || !plateOn(h, t)) && p.vy <= 80 &&
               Math.abs(p.x - h.x) <= h.hw + 2 && p.y >= h.y0 && p.y <= h.y1;
      case 'phase':
        if (!phaseOn(h, t)) return false;
        break;
      case 'crumble':
        var c = sim.crumble[h.id];
        if (c && c.back > t) return false;
        break;
    }
    var dx = p.x - holdX(h, t), dy = p.y - holdY(h, t), rr = h.r + C.PR + C.GRAB_ASSIST;
    return dx * dx + dy * dy <= rr * rr;
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
  function drop(sim, why, a) {
    var p = sim.p;
    detach(sim); p.vx = 0; p.vy = -30; p.noGrabT = sim.t + 0.35;
    ev(sim, why, a);
  }
  function die(sim, x, y) {
    var p = sim.p;
    p.state = 'dead'; p.deadT = sim.t; p.gliding = false;
    ev(sim, 'fall', x, y);
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
    list = W.grid.mobs[b];
    if (list && t - p.hitT > 0.5) for (i = 0; i < list.length; i++) {
      var m = W.mobs[list[i]];
      mobPos(m, t, MP);
      if (!MP.on) continue;
      var mx = MP.x - p.x, my = MP.y - p.y, mr = m.r + C.PR;
      if (mx * mx + my * my > mr * mr) continue;
      if (m.kind === 'drone' && sim.mods.insulated) continue;
      if (m.kind === 'bird') knock(sim, MP.dir, 330);
      else if (m.kind === 'drip') { knock(sim, mx > 0 ? -1 : 1, 130); p.vy = -240; }
      else { knock(sim, mx > 0 ? -1 : 1, 230); p.stamina = Math.max(0, p.stamina - 10); }
      ev(sim, 'mob', m.kind);
      break;
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

  // Bounce caps and pneumatic tubes act on a climber in the air. Returns true if one moved the climber.
  function launchers(sim, b) {
    var p = sim.p, W = sim.world, t = sim.t, i, list, dx, dy;
    list = W.grid.springs[b];
    if (list && p.vy < 250 && t - p.springT > 0.25) for (i = 0; i < list.length; i++) {
      var s = W.springs[list[i]];
      dx = s.x - p.x; dy = s.y - p.y;
      if (dx * dx + dy * dy <= 22 * 22) {
        p.vy = C.SPRING_V; p.vx = clamp(p.vx * 0.3, -40, 40);
        p.springT = t; p.apexY = p.y; p.noGrabT = Math.max(p.noGrabT, t + 0.06);
        ev(sim, 'spring', s.id);
        return false;
      }
    }
    list = W.grid.tubes[b];
    if (list && t - p.tubeT > 0.5) for (i = 0; i < list.length; i++) {
      var tb = W.tubes[list[i]];
      dx = tb.ax - p.x; dy = tb.ay - p.y;
      if (dx * dx + dy * dy <= 22 * 22) {
        p.x = tb.bx; p.y = tb.by; p.vx = 0; p.vy = C.TUBE_V;
        p.tubeT = t; p.apexY = p.y; p.gliding = false; p.noGrabT = Math.max(p.noGrabT, t + 0.06);
        ev(sim, 'tube', tb.id);
        return true;
      }
    }
    return false;
  }

  function step(sim, dt) {
    var p = sim.p, W = sim.world, i, list, h;
    sim.t += dt;
    var t = sim.t;
    if (p.state === 'dead') return;

    if (W.rises.length) {             // rising slag: it starts when you climb past its trigger ledge
      var rs = sim.rise, rz = rs.on ? W.rises[rs.id] : null;
      if (!rz) {
        for (i = W.rises.length - 1; i >= 0; i--) {
          var z = W.rises[i];
          if (p.y >= z.yEnd) break;
          if (p.y > z.yTrig + 24) { rs.on = true; rs.id = i; rs.level = p.y - z.lead; ev(sim, 'rise'); break; }
        }
      } else {
        if (rs.level < rz.yEnd) rs.level = Math.min(rz.yEnd, rs.level + rz.speed * (sim.mods.riseK || 1) * dt);
        if (p.y < rs.level + 4) { die(sim, p.x, p.y); ev(sim, 'burn'); return; }
        if (p.y > rz.yEnd + 500) rs.on = false;       // well clear of it: the next shaft can start
      }
    }
    var b = W.bucketOf(p.y);

    if (p.state === 'hold') {
      h = W.holds[p.hold];
      if (h.type === 'moving') p.x = holdX(h, t);
      else if (h.type === 'lift') { p.x = holdX(h, t); p.y = holdY(h, t); }
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
        if (c && c.t0 != null && t - c.t0 >= C.CRUMBLE_T * (sim.mods.crumbleK || 1)) {
          c.t0 = null; c.back = t + C.CRUMBLE_BACK;
          drop(sim, 'crumble', h.id); return;
        }
      }
      if (h.type === 'phase' && !phaseOn(h, t)) { drop(sim, 'phaseout', h.id); return; }
      if (h.type === 'plate' && plateOn(h, t) && !sim.mods.insulated) {
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
      var zx = holdX(h, t) - p.x, zy = holdY(h, t) - p.y, zd = Math.sqrt(zx * zx + zy * zy), zs = C.ZIP_SPEED * dt;
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
      // steer sets the sideways speed you are easing toward; with no steer you keep most of your drift
      if (p.steer !== 0) p.vx += (p.steer * C.GLIDE_VX - p.vx) * Math.min(1, C.GLIDE_EASE * dt);
      else p.vx -= p.vx * Math.min(1, 0.8 * dt);
      p.stamina = Math.max(0, p.stamina - C.ST_GLIDE * (sim.mods.glideK || 1) * dt);
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
    if (launchers(sim, b)) b = W.bucketOf(p.y);
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
    if ((p.apexY - p.y > C.FALL_DEATH * (sim.mods.fallK || 1) && !p.gliding) || p.y < -60) die(sim, p.x, p.y);
  }
  S.step = step;

  function cloneSim(s) {
    var c = { world: s.world, t: s.t, ghost: true, events: [], tools: s.tools, mods: s.mods, crumble: {},
              taken: s.taken, checkpoint: s.checkpoint, pitons: s.pitons, pitonHold: s.pitonHold, p: {},
              rise: { on: s.rise.on, id: s.rise.id, level: s.rise.level } }, k;
    for (k in s.p) c.p[k] = s.p[k];
    for (k in s.crumble) c.crumble[k] = { t0: s.crumble[k].t0, back: s.crumble[k].back };
    return c;
  }
  S.cloneSim = cloneSim;

  // Trajectory preview for a leap from the current hold. Returns points and the hold it would catch.
  // A null pair in pts marks a jump in position (a tube).
  S.preview = function (sim, vx, vy, dur) {
    var c = cloneSim(sim), pts = [], hit = -1, n = Math.round(dur / C.DT), lastTube = c.p.tubeT;
    if (!leap(c, vx, vy)) return { pts: pts, hit: -1 };
    for (var i = 0; i < n; i++) {
      step(c, C.DT);
      if (c.p.state !== 'air') { if (c.p.state === 'hold') hit = c.p.hold; break; }
      if (c.p.tubeT !== lastTube) { lastTube = c.p.tubeT; pts.push(null, null); }
      if (i % 5 === 4) pts.push(c.p.x, c.p.y);
    }
    return { pts: pts, hit: hit };
  };

  S.createSim = createSim;
  if (typeof module !== 'undefined' && module.exports) module.exports = S;
})(typeof window !== 'undefined' ? window : globalThis);
