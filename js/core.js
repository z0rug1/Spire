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
    ST_MAX: 100, ST_DRAIN: 9, ST_LEAP: 7, ST_REST: 36, ST_GLIDE: 12, ST_GRAPPLE: 8,
    THIN: [1, 1.2, 1.3, 1.5, 1.1, 1.4],   // grip drains faster in each district (by index): the air thins as you climb
    GRAPPLE_R: 250, ZIP_SPEED: 1500,
    GLIDE_FALL: 80, GLIDE_EASE: 3.2, GLIDE_VX: 240, UPDRAFT_V: 330,
    CRUMBLE_T: 0.9, CRUMBLE_BACK: 3.5,
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
      kinds: { leap: 8, crumble: 2, moving: 3, vent: 4, grapple: 3, tube: 3, lift: 3, drip: 5, wheel: 2 }, intro: 'grapple' },
    { key: 'gardens', name: 'The Gardens', nodes: [11, 13], dy: [66, 135], margin: 0.80, restEvery: 4,
      kinds: { leap: 6, slick: 3, wind: 3, updraft: 3, grapple: 2, moving: 2, crumble: 1, spring: 3, phase: 3, bird: 5, wheel: 3 }, intro: 'updraft' },
    { key: 'crown', name: 'The Crown', nodes: [11, 13], dy: [70, 145], margin: 0.84, restEvery: 4,
      kinds: { leap: 5, plate: 4, eplate: 3, grapple: 2, updraft: 2, vent: 2, moving: 2, crumble: 2, phase: 3, lift: 3, tube: 3, drone: 5, switch: 2, bell: 2 }, intro: 'plate' },
    // Added later, so their index is not their place in the tower: see ORDER.
    { key: 'cisterns', name: 'The Cisterns', nodes: [10, 12], dy: [60, 110], margin: 0.73, restEvery: 3,
      kinds: { leap: 8, slick: 3, switch: 4, crumble: 2, moving: 2, spring: 2, bell: 3 }, intro: 'switch' },
    { key: 'archive', name: 'The Archive', nodes: [11, 13], dy: [68, 140], margin: 0.82, restEvery: 4,
      kinds: { leap: 6, switch: 4, phase: 3, lift: 3, updraft: 2, grapple: 2, moving: 2, crumble: 2, wind: 2, bell: 3, wheel: 2 }, intro: 'switch' }
  ];
  // The districts from the bottom of the tower to the top, and each district's place in that order.
  var ORDER = S.ORDER = [0, 4, 1, 2, 5, 3];
  S.RANK = []; ORDER.forEach(function (d, i) { S.RANK[d] = i; });
  var SEGS = 8; // segments (camp to camp) per district in the main tower

  // A plan is the list of segments a tower is built from. `set` marks a hand-built set piece;
  // `parts: 2` splits the segment in two with a bivouac (an unnamed checkpoint) in the middle.
  var PARTS = 7;  // stretches between two camps (eight after every other camp), with a bivouac between each
  var MAIN_PLAN = S.MAIN_PLAN = [];
  (function () {
    var sets = { 0: 'dark', 4: 'sluice', 1: 'slag', 2: 'storm', 5: 'stacks', 3: 'alt' };
    for (var i = 0; i < SEGS * ORDER.length; i++) {
      var d = ORDER[Math.floor(i / SEGS)], k = i % SEGS;
      MAIN_PLAN.push({ d: d, set: k === 4 ? sets[d] : null, tutorial: i === 0, intro: k === 0, parts: PARTS + (k % 2) });
    }
    MAIN_PLAN[MAIN_PLAN.length - 1].set = 'finale';
  })();
  // New Game+: the same story on a remixed tower, a little harder each time round.
  // Only five remixes are generated (and checked by tests/verify.js --ng 5); later rounds cycle through them.
  // NG_SALT picks another remix for a round whose first one the test climber could not finish.
  S.NG_SALT = { 2: 1 };
  S.ngSeed = function (lv) { if (!lv) return C.SEED; var r = (lv - 1) % 5 + 1; return (C.SEED + 7919 * r + (S.NG_SALT[r] || 0) * 104729) >>> 0; };
  S.ngPlan = function (lv) {
    if (!lv) return MAIN_PLAN;
    return MAIN_PLAN.map(function (sp) { var o = {}, k; for (k in sp) o[k] = sp[k]; o.hard = Math.min(1, 0.4 + 0.2 * lv); o.tutorial = false; return o; });
  };
  S.ngDrain = function (lv) { return 1 + 0.1 * Math.min(lv || 0, 5); };
  // The last climb to the Crown Chamber: every tool, while the stair falls away underneath.
  var FINALE = ['leap', 'switch', 'leap', 'grapple', 'leap', 'wheel', 'leap', 'plate', 'leap', 'bell', 'leap',
                'updraft', 'leap', 'eplate', 'leap', 'lift', 'leap', 'grapple', 'leap', 'leap'];
  // A tool is handed over at the first camp of its district.
  function firstCamp(d) { for (var i = 0; i < MAIN_PLAN.length; i++) if (MAIN_PLAN[i].d === d) return i; return 1e9; }
  S.TOOL_AT = { grapple: firstCamp(1), glider: firstCamp(2), gloves: firstCamp(3) };
  S.DAILY_PLAN = [{ d: 0, n: 6 }, { d: 4, n: 7, intro: true }, { d: 1, n: 7, intro: true }, { d: 2, n: 7, intro: true }, { d: 5, n: 7, intro: true }, { d: 3, n: 7, intro: true }];
  // Daily towers are seeded by the local date. DAILY_SALT lists the dates whose first seed
  // produced a gap the test climber could not cross (see tests/verify.js --daily).
  S.DAILY_SALT = { 20270117: 1, 20270528: 1 };
  S.dateKey = function (d) { d = d || new Date(); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); };
  S.dailySeed = function (key) { return (Math.imul(key, 2654435761) + (S.DAILY_SALT[key] || 0) * 7919) >>> 0; };

  // The endless climb: segment L of a tower with no top. It cycles through the six districts,
  // drops in a set piece every fifth segment, and gets harder for the first twenty segments.
  S.ENDLESS_SEED = 77261112;
  S.endlessSeg = function (L) {
    var hard = Math.min(1, L / 20), sp = { d: ORDER[L % ORDER.length], hard: hard, n: 8 + Math.round(4 * hard) };
    if (L % 5 === 4) {
      sp.set = ['slag', 'sluice', 'storm', 'stacks', 'alt', 'dark'][Math.floor(L / 5) % 6];
      sp.d = { slag: 1, storm: 2, alt: 3, dark: 0, sluice: 4, stacks: 5 }[sp.set];
      sp.riseSpeed = 25 + 10 * hard;
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
  // wheel spokes ride a circle: at the bottom when the angle is 0, at the top at half a turn
  function wheelA(h, t) { return h.w * t + h.ph + h.k * 1.5708; }
  function holdX(h, t) {
    if (h.type === 'moving') return h.x0 + h.amp * Math.sin(h.w * t + h.ph);
    if (h.type === 'lift') return h.x0 + h.ax * liftS(h, t);
    if (h.type === 'wheel') return h.cx0 + h.rad * Math.sin(wheelA(h, t));
    return h.x;
  }
  function holdY(h, t) {
    if (h.type === 'lift') return h.y0 + h.ay * liftS(h, t);
    if (h.type === 'wheel') return h.cy0 - h.rad * Math.cos(wheelA(h, t));
    return h.y;
  }
  // seconds a bell-timed hold has left (0 or less: not solid)
  function timedLeft(sim, h) { var b = sim.bell[h.g]; return b == null ? -1 : h.dur - (sim.t - b); }
  S.timedLeft = timedLeft;
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

    var W = { holds: [], vents: [], winds: [], drafts: [], shards: [], camps: [], anchors: [], springs: [], tubes: [], mobs: [], bells: 0, letters: [], keys: [],
              gates: [], bands: [], sets: [], rises: [], segs: 0 };
    var mainIdx = 0, seg = 0, dist = 0;
    var gsw = 0;                   // where the sluice switches stand when the climber gets here along the route

    function mk(type, x, y) {
      var h = { type: type, x: x, y: y, r: 12 };
      if (type === 'ledge') { h.hw = R(24, 36); h.x = clamp(x, h.hw + 12, C.W - h.hw - 12); }
      else if (type === 'moving') {
        h.amp = R(28, 50); h.x0 = clamp(x, h.amp + 30, C.W - h.amp - 30); h.x = h.x0;
        h.w = R(1.3, 2.0); h.ph = R(0, 6.28);
      } else if (type === 'anchor') h.r = 10;
      else if (type === 'phase') { h.period = 3.2; h.on = 2.0; h.ph = R(0, 3.2); }
      else if (type === 'gate') h.col = gsw;           // solid only while the sluices stand at this colour
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
      h.esw = gsw;                  // the lever state a climber on the route has while on this hold
      if (h.type === 'camp') h.sw = gsw;
      W.holds.push(h);
      if (h.type === 'anchor') W.anchors.push(h.id);
      return h;
    }
    function cx(h) { return h.type === 'moving' ? h.x0 : h.type === 'lift' ? h.x0 + h.ax : h.type === 'wheel' ? h.cx0 : h.x; }
    function srcPts(h) {
      if (h.type === 'moving') return [[h.x0 - h.amp, h.y], [h.x0 + h.amp, h.y]];
      if (h.type === 'lift') return [[h.x0 + h.ax, h.y0 + h.ay]];
      if (h.type === 'wheel') return [[h.cx0, h.cy0 + h.rad]];
      if (h.type === 'ledge') return [[h.x, h.y + 15]];
      if (h.type === 'camp') return [[h.x - (h.biv ? 36 : 60), h.y + 15], [h.x + (h.biv ? 36 : 60), h.y + 15]];
      if (h.type === 'plate') return [[h.x, h.y1 - 14]];
      return [[h.x, h.y]];
    }
    function dstPts(h) {
      if (h.type === 'moving') return [[h.x0 - h.amp, h.y], [h.x0 + h.amp, h.y]];
      if (h.type === 'lift') return [[h.x0, h.y0]];
      if (h.type === 'wheel') return [[h.cx0, h.cy0 - h.rad]];
      if (h.type === 'plate') return [[h.x, h.y0 + 34]];
      return [[h.x, h.y]];
    }
    function top(h) { return srcPts(h)[0][1]; }
    function hy(h) { return h.type === 'lift' ? h.y0 : h.type === 'wheel' ? h.cy0 - h.rad : h.y; }     // where you first catch it
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
        if (i < 90 && mobNear(cx(h), hy(h), h.hw)) continue;
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
    // hw: half-width of a ledge, where the climber can stand anywhere along it
    function mobHits(m, x, y, hw) {
      if (m.kind === 'bird') return Math.abs(m.y - y) < (hw ? 52 : 36);
      if (Math.abs(m.x - x) > 34 + (hw || 0)) return false;
      return m.kind === 'drip' ? (y < m.y + 14 && y > m.y - m.fall - 12) : Math.abs(m.y - y) < m.amp + 22;
    }
    // Is the whole circle a wheel sweeps clear of recent vents and moving hazards?
    function wheelClear(wx, cy, rad) {
      var i, m;
      for (i = Math.max(0, W.vents.length - 4); i < W.vents.length; i++) if (Math.abs(W.vents[i].y - cy) < rad + 34) return false;
      for (i = Math.max(0, W.mobs.length - 4); i < W.mobs.length; i++) {
        m = W.mobs[i];
        if (m.kind === 'bird' && Math.abs(m.y - cy) < rad + 34) return false;
        if (m.kind === 'drip' && Math.abs(m.x - wx) < rad + 24 && m.y > cy - rad - 24 && m.y - m.fall < cy + rad + 24) return false;
        if (m.kind === 'drone' && Math.abs(m.x - wx) < rad + 24 && Math.abs(m.y - cy) < m.amp + rad + 24) return false;
      }
      return true;
    }
    function mobNear(x, y, hw) {
      for (var i = Math.max(0, W.mobs.length - 3); i < W.mobs.length; i++) if (mobHits(W.mobs[i], x, y, hw)) return true;
      return false;
    }
    // A moving hazard across the leap from a to b. Skipped when it would also threaten a hold.
    function mob(a, b, kind) {
      var s = srcPts(a)[0], bx = cx(b), by = hy(b), mx = (s[0] + bx) / 2, my = (s[1] + by) / 2, m, i;
      if (kind === 'bird') {
        if (my - s[1] < 36 || by - my < (b.hw ? 52 : 36)) return;
        m = { kind: kind, y: my, r: 11, w: R(0.9, 1.3), ph: R(0, 6.28) };
      } else {
        // keep clear of both ends of the leap, and of the whole width of a ledge
        var ca = 40 + (a.hw || 0), cb = 40 + (b.hw || 0), gap = Math.abs(bx - a.x);
        if (a.type === 'moving' || b.type === 'moving' || gap < ca + cb) return;
        mx = a.x + (bx > a.x ? 1 : -1) * (ca + (gap - ca - cb) / 2);
        // only as tall as the gap it guards, so it cannot reach the holds below or above the pair
        if (kind === 'drip') m = { kind: kind, x: mx, y: Math.max(s[1], by) + 50, r: 10, v: 230, fall: Math.abs(by - s[1]) + 86, period: R(1.9, 2.5), ph: R(0, 3) };
        else m = { kind: kind, x: mx, y: my, amp: Math.abs(by - s[1]) / 2 + 20, r: 13, w: R(1.3, 1.9), ph: R(0, 6.28) };
      }
      for (i = Math.max(0, W.holds.length - 12); i < W.holds.length; i++) {
        var h = W.holds[i];
        if (h.type === 'wheel') {
          if (m.kind === 'bird' ? Math.abs(m.y - h.cy0) < h.rad + 34 : Math.abs(m.x - h.cx0) < h.rad + 24 &&
              (m.kind === 'drip' ? m.y > h.cy0 - h.rad - 24 && m.y - m.fall < h.cy0 + h.rad + 24 : Math.abs(m.y - h.cy0) < m.amp + h.rad + 24)) return;
          continue;
        }
        if (h.type === 'plate' || h.type === 'camp') { if (h.type === 'camp' && Math.abs(h.y - my) < 110) return; continue; }
        if (h !== a && h !== b && mobHits(m, cx(h), hy(h), h.hw)) return;
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
        if (h.type === 'wheel' && Math.abs(h.cy0 - y) < h.rad + 34) return;
        if (h.type !== 'plate' && Math.abs(h.y - y) < 28 && h.x > x0 - 20 && h.x < x1 + 20) return;
      }
      W.vents.push({ id: W.vents.length, side: side, y: y, x0: x0, x1: x1, period: R(2.6, 3.2), dur: 0.9, ph: R(0, 3) });
    }
    // A switch puzzle: a lever that flips the sluices, then holds of the new colour leading on. A decoy
    // of the old colour, with chalk on it, is solid until you pull the lever.
    function switchRun(m, dyR) {
      var sw = place(cur, 'switch', m, dyR), j, k = 2 + (rnd() < 0.5 ? 1 : 0), prev = cur, t0;
      gsw ^= 1; sw.to = gsw;
      advance(sw);
      t0 = top(prev);
      var dc = mk('gate', clamp(cx(prev) + (cx(sw) > cx(prev) ? -1 : 1) * R(70, 110), 40, 320), t0 + R(50, 95));
      dc.col = gsw ^ 1;
      if (reach(prev, dc, m) && Math.abs(dc.x - cx(sw)) > 60 && !nearVent(dc.y) && !mobNear(dc.x, dc.y)) {
        commit(dc, true); dc.main = prev.main; shard(dc.x, dc.y + 18, 2);
      }
      for (j = 0; j < k; j++) { var g = place(cur, 'gate', m, dyR); if (rnd() < 0.5) between(cur, g); advance(g); }
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
    // A hold you cannot stay on while waiting for something to line up.
    function noWait(h) { return h.type === 'phase' || h.type === 'crumble' || h.type === 'timed' || h.type === 'plate' || h.type === 'slick' || h.type === 'lift' || h.type === 'wheel'; }
    function standard(sp, cfg, tutorial, intro, script) {
      var n = script ? 1e9 : tutorial ? 7 : (sp.n || RI(cfg.nodes[0], cfg.nodes[1])), si = 0;
      var m = tutorial ? 0.6 : Math.min(0.9, cfg.margin + 0.06 * (sp.hard || 0));
      var restEvery = tutorial ? 2 : cfg.restEvery;
      var dyR = tutorial ? [55, 78] : cfg.dy;
      var windLeft = 0, forced = (intro && cfg.intro) ? cfg.intro : null;
      var j, nxt, prev, t0, c1, sdir;
      sinceRest = 0; count = 0;

      while (script ? si < script.length : count < n) {
        var kind = 'leap';
        if (script) kind = script[si++];
        else if (count === 1 && forced) { kind = forced; forced = null; }
        else if (!tutorial && count > 0) kind = pick(cfg.kinds);
        var needRest = sinceRest >= restEvery;
        if (needRest && kind !== 'updraft' && kind !== 'spring' && kind !== 'tube' && kind !== 'vent' && kind !== 'drip' && kind !== 'bird' && kind !== 'drone') kind = 'leap';
        if (windLeft > 0 && (kind === 'spring' || kind === 'tube' || kind === 'lift')) kind = 'leap';
        // nothing that needs timing may follow a hold you cannot wait on
        if ((cur.type === 'phase' || cur.type === 'crumble' || cur.type === 'timed') && kind !== 'spring' && kind !== 'tube') kind = 'leap';
        if ((kind === 'wheel' || kind === 'bell') && (needRest || noWait(cur) || windLeft > 0)) kind = 'leap';
        // a lift has to be waited for, so never hang it after a hold you cannot wait on
        // anything that has to be timed never follows a hold you cannot wait on
        if ((kind === 'lift' || kind === 'vent' || kind === 'phase' || kind === 'moving') && noWait(cur)) kind = 'leap';
        var mm = m;
        if (windLeft > 0) { mm = m - 0.1; windLeft--; }

        if (kind === 'wind') {
          t0 = top(cur);
          W.winds.push({ id: W.winds.length, y0: t0 + 24, y1: t0 + 24 + R(300, 380), ax: (rnd() < 0.5 ? -1 : 1) * R(230, 310) });
          windLeft = 3; mm = m - 0.1; kind = 'leap';
        }

        var isMob = kind === 'drip' || kind === 'bird' || kind === 'drone';
        if (isMob && (noWait(cur) || windLeft > 0)) { kind = 'leap'; isMob = false; }
        if (kind === 'leap' || kind === 'vent' || kind === 'slick' || isMob) {
          var type = needRest ? 'ledge' : (kind === 'slick' ? 'slick' : 'grip');
          var range = (kind === 'vent' || kind === 'bird') ? [Math.max(dyR[0], 76), dyR[1]] : dyR;
          nxt = place(cur, type, mm, range, kind === 'drip' || kind === 'drone' ? 86 + (cur.hw || 0) + (needRest ? 30 : 0) : 0);
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
        } else if (kind === 'switch') {
          if (needRest || noWait(cur)) { advance(place(cur, needRest ? 'ledge' : 'grip', mm, dyR)); }
          else switchRun(mm, dyR);
        } else if (kind === 'wheel') {
          // a mill wheel with four handholds: catch one at the bottom, ride it up, leap off at the top
          t0 = top(cur); c1 = cx(cur);
          var rw = R(62, 78), wx = clamp(c1 + (c1 < 180 ? 1 : -1) * R(50, 100), rw + 26, C.W - rw - 26), wby = t0 + R(26, 56);
          var wh = { type: 'wheel', cx0: wx, cy0: wby + rw, rad: rw, w: 6.283 / R(8, 9.5), ph: R(0, 6.28), k: 0, r: 13, x: wx, y: wby + rw };
          if (!reach(cur, wh, Math.min(0.9, mm + 0.06)) || !wheelClear(wx, wby + rw, rw)) advance(place(cur, 'grip', mm, dyR));
          else {
            advance(wh);
            for (j = 1; j < 4; j++) { var sk = {}, kk; for (kk in wh) sk[kk] = wh[kk]; sk.k = j; commit(sk, true); sk.main = wh.main; }
            shard(wx, wby + rw, 1);
          }
        } else if (kind === 'bell') {
          // a bell: let go of it and the holds that answer it are solid for a few seconds
          var bl = place(cur, 'grip', mm, dyR), nb = 2 + (rnd() < 0.5 ? 1 : 0), tms = [];
          bl.type = 'bell'; bl.g = W.bells++; bl.r = 13;
          advance(bl);
          for (j = 0; j < nb; j++) { var tm = place(cur, 'timed', mm, [dyR[0], Math.min(dyR[1], 110)]); tm.g = bl.g; tms.push(tm); if (rnd() < 0.5) between(cur, tm); advance(tm); }
          for (j = 0; j < tms.length; j++) tms[j].dur = 1.5 * nb + 1.9;
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

      for (var pk = 1; pk < (sp.parts || 1); pk++) { standard(sp, cfg, pk === 1 && !!sp.tutorial, pk === 1 && !!sp.intro); bivouac(); setY0 = cur.y; }

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
        rise = { id: W.rises.length, yTrig: trig.y, yEnd: 0, speed: sp.riseSpeed || 25, lead: 260, style: 'slag' };
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
      } else if (sp.set === 'sluice') {
        // The Sluice Gates: two interleaved ladders, blue and amber, and levers between them.
        // Only one ladder is solid at a time; you have to pull the right lever at the right rung.
        ledgeAt(180, top(cur) + 78, 34);
        var side0 = rnd() < 0.5 ? -1 : 1;
        for (k2 = 0; k2 < 4; k2++) {
          var sx = 180 + side0 * (k2 % 2 ? -1 : 1) * R(18, 34), lever = mk('switch', sx, top(cur) + R(70, 84));
          gsw ^= 1; lever.to = gsw; advance(lever);
          for (j = 0; j < 2; j++) {
            var lx = 180 + (gsw ? 1 : -1) * R(78, 96), ly = cur.y + R(78, 92);
            var gt = mk('gate', lx, ly); advance(gt);
            var dco = mk('gate', 360 - lx, ly + R(-8, 8)); dco.col = gsw ^ 1; commit(dco, true); dco.main = gt.main;
            if (j === 1 && k2 % 2) shard(360 - lx, ly + 20, 1);
          }
          if (k2 === 1) ledgeAt(180, cur.y + R(76, 86), 30);
        }
        ledgeAt(180, cur.y + R(76, 86), 32);
      } else if (sp.set === 'stacks') {
        // The Stacks: shelves ride up and down between the reading ledges; each shelf ends at a lever
        // that decides which pages above are solid.
        ledgeAt(180, top(cur) + 78, 34);
        for (k2 = 0; k2 < 3; k2++) {
          var dir2 = k2 % 2 ? -1 : 1;
          var sh = mk('lift', 180 + dir2 * R(50, 70), top(cur) + R(70, 82)); sh.ax = dir2 * R(-10, 10); sh.ay = R(250, 290);
          sh.x0 = clamp(sh.x0, 40, 320); sh.x = sh.x0 + sh.ax / 2; sh.y = sh.y0 + sh.ay / 2;
          advance(sh);
          var lv = mk('switch', clamp(sh.x0 + sh.ax - dir2 * R(70, 90), 40, 320), sh.y0 + sh.ay + R(40, 60));
          gsw ^= 1; lv.to = gsw; advance(lv);
          for (j = 0; j < 2; j++) {
            var px2 = clamp(cx(cur) + (j ? -1 : 1) * dir2 * R(70, 100), 40, 320), g2 = mk('gate', px2, top(cur) + R(72, 90));
            advance(g2);
            var dk = mk('gate', clamp(360 - px2, 40, 320), g2.y + R(-6, 10)); dk.col = gsw ^ 1;
            if (Math.abs(dk.x - px2) > 60) { commit(dk, true); dk.main = g2.main; }
          }
          ledgeAt(clamp(cx(cur) + R(-40, 40), 60, 300), cur.y + R(74, 86), 30);
          shard(cur.x + 30, cur.y + 60, 1);
        }
      } else if (sp.set === 'finale') {
        // The Last Stair: the whole climb in one breath, while the stair collapses below you.
        var trig2 = ledgeAt(180, top(cur) + 78, 36);
        rise = { id: W.rises.length, yTrig: trig2.y, yEnd: 0, speed: 18, lead: 330, style: 'collapse' };
        W.rises.push(rise);
        standard(sp, cfg, false, false, FINALE);
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

    // Twenty lost letters on side routes, spread evenly up the tower. Every third one is locked in a
    // strongbox; its key lies on another side route somewhere below it.
    function placeLore() {
      var cand = W.holds.filter(function (h) {
        if (!h.side || (h.type !== 'grip' && h.type !== 'gate') || h.seg < 1) return false;
        for (var i = 0; i < W.sets.length; i++) if (h.y > W.sets[i].y0 - 60 && h.y < W.sets[i].y1 + 60) return false;
        return true;
      }).sort(function (a, b) { return a.y - b.y; });
      var N = 20, used = {}, spots = [], i, k;
      if (cand.length < N * 2) return;
      for (i = 0; i < N; i++) { k = Math.floor((i + 0.5) * cand.length / N); spots.push(k); used[k] = 1; }
      for (i = 0; i < N; i++) {
        var h = cand[spots[i]];
        if (i % 3 === 2) {
          h.box = i;
          W.letters.push({ id: i, x: h.x, y: h.y, box: h.id });
          var lo = spots[i - 1] + 1, km = Math.floor((lo + spots[i]) / 2);
          while (used[km] && km < spots[i] - 1) km++;
          if (used[km]) km = lo;
          used[km] = 1;
          W.keys.push({ id: W.keys.length, x: cand[km].x, y: cand[km].y + 4, box: i });
        } else W.letters.push({ id: i, x: h.x, y: h.y + 4, box: -1 });
      }
    }

    // spatial buckets
    var B = W.B = 240;
    W.bucketOf = function (y) { var b = Math.floor((y + 480) / B); return b < 0 ? 0 : b; };
    function put(grid, y0, y1, id) {
      for (var b = W.bucketOf(y0); b <= W.bucketOf(y1); b++) (grid[b] || (grid[b] = [])).push(id);
    }
    function index() {
      var g = W.grid = { holds: [], vents: [], winds: [], drafts: [], shards: [], springs: [], tubes: [], mobs: [], lore: [] };
      W.holds.forEach(function (h) {
        if (h.type === 'plate') put(g.holds, h.y0 - 30, h.y1 + 30, h.id);
        else if (h.type === 'lift') put(g.holds, h.y0 - 60, h.y0 + h.ay + 60, h.id);
        else if (h.type === 'wheel') put(g.holds, h.cy0 - h.rad - 60, h.cy0 + h.rad + 60, h.id);
        else put(g.holds, h.y - 60, h.y + 60, h.id);
      });
      W.vents.forEach(function (v) { put(g.vents, v.y - 40, v.y + 40, v.id); });
      W.winds.forEach(function (w) { put(g.winds, w.y0, w.y1, w.id); });
      W.drafts.forEach(function (d) { put(g.drafts, d.y0, d.y1, d.id); });
      W.shards.forEach(function (sh) { put(g.shards, sh.y - 40, sh.y + 40, sh.id); });
      W.springs.forEach(function (s) { put(g.springs, s.y - 40, s.y + 40, s.id); });
      W.tubes.forEach(function (tb) { put(g.tubes, tb.ay - 40, tb.ay + 40, tb.id); });
      W.letters.forEach(function (l, i) { if (l.box < 0) put(g.lore, l.y - 40, l.y + 40, i); });
      W.keys.forEach(function (k, i) { put(g.lore, k.y - 40, k.y + 40, -1 - i); });
      W.mobs.forEach(function (m) {
        if (m.kind === 'drip') put(g.mobs, m.y - m.fall - 30, m.y + 30, m.id);
        else if (m.kind === 'bird') put(g.mobs, m.y - 40, m.y + 40, m.id);
        else put(g.mobs, m.y - m.amp - 40, m.y + m.amp + 40, m.id);
      });
    }

    for (var i = 0; i < plan.length; i++)
      buildSeg(plan[i], plan[i + 1] ? plan[i + 1].d : (plan[i].nd != null ? plan[i].nd : plan[i].d), i === plan.length - 1);
    if (opts.lore) placeLore();
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
    return { grapple: maxCamp >= S.TOOL_AT.grapple, glider: maxCamp >= S.TOOL_AT.glider, gloves: maxCamp >= S.TOOL_AT.gloves };
  };

  /* ---------- simulation ---------- */
  function ev(sim, type, a, b) { if (!sim.ghost) sim.events.push({ type: type, a: a, b: b }); }

  function createSim(world, o) {
    o = o || {};
    var sim = {
      world: world, t: 0, ghost: false, events: [],
      tools: o.tools || { grapple: false, glider: false, gloves: false },
      mods: o.mods || { stMax: C.ST_MAX, vmax: C.VMAX, drain: 1, pitonMax: 2 },
      crumble: {}, taken: o.taken || {}, rise: { on: false, id: -1, level: -1e9 }, sw: 0, cpSw: 0, bell: {},
      lore: o.lore || { letters: {}, keys: {}, boxes: {}, held: 0 },
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
    // a lever sets the sluices to its own colour, so grabbing it again after a fall changes nothing
    if (h.type === 'switch' && !sim.respawning) { var to = h.to != null ? h.to : sim.sw ^ 1; if (to !== sim.sw) { sim.sw = to; ev(sim, 'switch', h.id); } }
    if (h.box != null && !sim.ghost && !sim.respawning && !sim.lore.boxes[h.box]) {
      if (sim.lore.held > 0) { sim.lore.held--; sim.lore.boxes[h.box] = 1; sim.lore.letters[h.box] = 1; ev(sim, 'box', h.box); }
      else ev(sim, 'locked', h.box);
    }
    if (h.type === 'camp') {
      sim.checkpoint = h.id; sim.pitonHold = -1; sim.pitons = sim.mods.pitonMax;
      sim.sw = h.sw || 0;
      if (h.biv) ev(sim, 'biv', h.id); else ev(sim, 'camp', h.camp);
    }
  }
  function detach(sim) {
    var p = sim.p, h = sim.world.holds[p.hold];
    if (h && h.type === 'bell') { sim.bell[h.g] = sim.t; ev(sim, 'bell', h.id); }
    p.lastHold = p.hold; p.lastHoldT = sim.t; p.hold = -1; p.state = 'air'; p.apexY = p.y;
  }

  function respawn(sim) {
    var p = sim.p, h = sim.world.holds[sim.checkpoint];
    sim.crumble = {}; sim.rise = { on: false, id: -1, level: -1e9 }; sim.bell = {};
    p.lastHold = -1; p.lastHoldT = -9; p.noGrabT = 0; p.wantGlide = false; p.steer = 0; p.hitT = -9;
    p.springT = -9; p.tubeT = -9;
    p.stamina = sim.mods.stMax;
    var keepEvents = sim.ghost;
    sim.ghost = true; sim.respawning = true;      // do not re-announce the camp or pull a lever on respawn
    sim.sw = h.type === 'camp' ? (h.sw || 0) : sim.cpSw;
    attach(sim, h, h.x, h.y);
    sim.ghost = keepEvents; sim.respawning = false;
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
    sim.pitonHold = h.id; sim.checkpoint = h.id; sim.pitons--; sim.cpSw = sim.sw;
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
      case 'gate':
        if (sim.sw !== h.col) return false;
        break;
      case 'timed':
        if (timedLeft(sim, h) <= 0) return false;
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
    list = W.grid.lore[b];
    if (list) for (i = 0; i < list.length; i++) {
      var li = list[i], it = li >= 0 ? W.letters[li] : W.keys[-1 - li], lx = it.x - p.x, ly = it.y - p.y;
      if (lx * lx + ly * ly > C.SHARD_R * C.SHARD_R) continue;
      if (li >= 0 && !sim.lore.letters[it.id]) { sim.lore.letters[it.id] = 1; ev(sim, 'letter', it.id); }
      else if (li < 0 && !sim.lore.keys[it.id]) { sim.lore.keys[it.id] = 1; sim.lore.held++; ev(sim, 'key', it.id); }
    }
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

  // How much faster grip drains on hold h. The story and daily towers go by district; the endless
  // wall cycles through districts, so there it grows with height instead.
  function thin(W, h) { return W.endless ? 1 + 0.45 * Math.min(1, h.seg / 20) : C.THIN[h.d]; }
  S.thin = thin;

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
          if (p.y > z.yTrig + 24) { rs.on = true; rs.id = i; rs.level = p.y - z.lead; ev(sim, 'rise', z.style); break; }
        }
      } else {
        if (rs.level < rz.yEnd) rs.level = Math.min(rz.yEnd, rs.level + rz.speed * (sim.mods.riseK || 1) * dt);
        if (p.y < rs.level + 4) { die(sim, p.x, p.y); ev(sim, 'burn', rz.style); return; }
        if (p.y > rz.yEnd + 500) rs.on = false;       // well clear of it: the next shaft can start
      }
    }
    var b = W.bucketOf(p.y);

    if (p.state === 'hold') {
      h = W.holds[p.hold];
      if (h.type === 'moving') p.x = holdX(h, t);
      else if (h.type === 'lift' || h.type === 'wheel') { p.x = holdX(h, t); p.y = holdY(h, t); }
      if (h.type === 'ledge' || h.type === 'camp') {
        p.stamina = Math.min(sim.mods.stMax, p.stamina + C.ST_REST * (h.type === 'camp' ? 2 : 1) * dt);
      } else {
        p.stamina -= C.ST_DRAIN * thin(W, h) * sim.mods.drain * (h.type === 'slick' ? 2.5 : h.type === 'lift' || h.type === 'wheel' ? 0.5 : 1) * dt;
        if (p.stamina <= 0) {
          detach(sim); p.vx = 0; p.vy = -30; p.noGrabT = t + 0.5;
          p.stamina = p.secondWind ? 15 : 5; p.secondWind = false;
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
      if (h.type === 'gate' && sim.sw !== h.col) { drop(sim, 'phaseout', h.id); return; }
      if (h.type === 'timed' && timedLeft(sim, h) <= 0) { drop(sim, 'phaseout', h.id); return; }
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
              rise: { on: s.rise.on, id: s.rise.id, level: s.rise.level }, sw: s.sw, cpSw: s.cpSw, bell: {}, lore: s.lore }, k;
    for (k in s.bell) c.bell[k] = s.bell[k];
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
