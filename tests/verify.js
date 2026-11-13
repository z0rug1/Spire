/* Verifies that towers are climbable: an automated climber must get from the first camp to the
   summit at base stats (no upgrades) without a single fall.

   node tests/verify.js               main tower (add -v for a per-leap log)
   node tests/verify.js --daily 365   also check the daily towers for the next 365 dates
   node tests/verify.js --daily 365 --from 20270101                                       */
'use strict';
const S = require('../js/core.js');
const C = S.C;
const args = process.argv.slice(2);
const verbose = args.includes('-v');
const arg = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };

function climb(world, opt) {
  opt = opt || {};
  const mainHolds = [];
  world.holds.forEach(h => { if (!h.side) mainHolds[h.main] = h; });
  const sim = S.createSim(world, { tools: opt.allTools ? { grapple: true, glider: true, gloves: true } : undefined });
  let maxCamp = 0;

  function score(s) {
    const p = s.p;
    if (p.state !== 'hold') return -1;
    const h = world.holds[p.hold];
    if (h.side) return h.main * 1000 + 30;     // a detour hold: only worth taking when the direct line is blocked
    return h.main * 1000 + (h.type === 'plate' ? p.y - h.y0 : 0);
  }

  // Plays one action on sim s until the climber is holding something again (or dies).
  function run(s, a) {
    if (a.script === 'tap') { if (!S.grapple(s, a.tx, a.ty)) return false; }
    else { const v = a.pow * s.mods.vmax; if (!S.leap(s, Math.cos(a.ang) * v, Math.sin(a.ang) * v)) return false; }
    let tapped = a.script === 'tap', wp = 0;
    for (let i = 0; i < 1500; i++) {
      const p = s.p;
      if (a.script === 'glide' || a.script === 'ladder') {
        let tx = a.tx;
        if (a.script === 'ladder') { while (wp < a.wps.length - 1 && p.y >= a.wps[wp][1]) wp++; tx = a.wps[wp][0]; }
        p.wantGlide = i >= a.g0;
        const dx = tx - p.x;
        p.steer = Math.abs(dx) < 4 ? 0 : Math.sign(dx) * Math.min(1, Math.abs(dx) / 40);
      }
      if (a.script === 'leaptap' && !tapped && p.state === 'air') {
        const dx = a.tx - p.x, dy = a.ty - p.y;
        if (dx * dx + dy * dy < (C.GRAPPLE_R - 6) ** 2) { S.grapple(s, a.tx, a.ty); tapped = true; }
      }
      S.step(s, C.DT);
      if (s.p.state === 'hold') { s.p.wantGlide = false; s.p.steer = 0; return true; }
      if (s.p.state === 'dead') return false;
      if (a.script !== 'ladder' && i > 480) return false;
    }
    return false;
  }

  const ANGLES = []; for (let d = 15; d <= 165; d += 5) ANGLES.push(d * Math.PI / 180);
  const POWERS = [0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];
  const WAITS = []; for (let w = 0; w <= 4.6001; w += 0.2) WAITS.push(w);

  function decide(s) {
    const cur = score(s), h = world.holds[s.p.hold], next = mainHolds[h.main + 1];
    for (const wait of WAITS) {
      const base = S.cloneSim(s);
      let ok = true;
      for (let i = 0; i < Math.round(wait / C.DT); i++) {
        S.step(base, C.DT);
        if (base.p.state !== 'hold' || base.p.hold !== s.p.hold) { ok = false; break; }
      }
      if (!ok) break;
      let best = null, solutions = 0;
      const tryA = a => {
        const c = S.cloneSim(base);
        if (!run(c, a)) return;
        const sc = score(c);
        if (sc <= cur + 20) return;
        const hh = world.holds[c.p.hold];
        if (hh.main > h.main + 2) return;
        solutions++;
        const val = -Math.abs(hh.main - (h.main + 1)) * 10000 + (hh.type === 'plate' ? (c.p.y - hh.y0) * 10 : 0) + c.p.stamina;
        if (!best || val > best.val) best = { val, a, wait };
      };
      const anchorNext = next && next.type === 'anchor';
      if (anchorNext && s.tools.grapple) {
        tryA({ script: 'tap', tx: next.x, ty: next.y });
        if (!best) for (const ang of ANGLES) for (const pow of POWERS) tryA({ script: 'leaptap', ang, pow, tx: next.x, ty: next.y });
      }
      if (next && next.ladder && s.tools.glider) {
        for (const g0 of [12, 30]) for (const ang of ANGLES) for (const pow of [0.4, 0.6, 0.8, 1.0])
          tryA({ script: 'ladder', ang, pow, g0, wps: next.ladder });
      } else if (next && next.viaDraft && s.tools.glider) {
        for (const g0 of [8, 20, 34, 50]) for (const ang of ANGLES) for (const pow of POWERS)
          tryA({ script: 'glide', ang, pow, g0, tx: next.x });
      }
      if (!anchorNext && !(next && next.ladder)) for (const ang of ANGLES) for (const pow of POWERS) tryA({ script: 'leap', ang, pow });
      if (best) { best.solutions = solutions; return best; }
    }
    return null;
  }

  const res = { ok: false, leaps: 0, tight: [], minLand: 1e9, ways: [], waited: 0, sim };
  const summit = world.camps[world.camps.length - 1].hold;
  while (sim.p.hold !== summit) {
    const h = world.holds[sim.p.hold];
    if (!opt.allTools && h.type === 'camp' && h.camp > maxCamp) { maxCamp = h.camp; sim.tools = S.toolsFor(maxCamp); }
    if ((h.type === 'ledge' || h.type === 'camp') && sim.p.stamina < sim.mods.stMax - 0.5) {
      S.step(sim, C.DT);
      if (sim.p.state === 'dead') { res.stuck = `caught while resting on #${h.id} (seg ${h.seg})`; return res; }
      continue;
    }
    const d = decide(sim);
    if (!d) {
      const next = mainHolds[h.main + 1];
      res.stuck = `hold #${h.id} (${h.type}, seg ${h.seg}, y ${h.y.toFixed(0)}), grip ${sim.p.stamina.toFixed(0)}; next: ${next && next.type} at ${next && Math.round(next.x)},${next && Math.round(next.y)}`;
      return res;
    }
    for (let i = 0; i < Math.round(d.wait / C.DT); i++) S.step(sim, C.DT);
    if (!run(sim, d.a)) { res.stuck = `replay diverged at hold #${h.id}`; return res; }
    res.leaps++; res.ways.push(d.solutions); if (d.wait > 0) res.waited++;
    const hh = world.holds[sim.p.hold];
    res.minLand = Math.min(res.minLand, sim.p.stamina);
    if (d.solutions < 4) res.tight.push(`#${h.id} ${h.type} -> #${hh.id} ${hh.type} (seg ${h.seg}, ${d.solutions} ways, wait ${d.wait.toFixed(1)}s)`);
    if (verbose && !opt.quiet) console.log(`${h.type.padEnd(8)} -> ${hh.type.padEnd(8)} seg ${String(h.seg).padStart(2)}  ${d.a.script.padEnd(7)} wait ${d.wait.toFixed(1)}  ways ${String(d.solutions).padStart(3)}  grip ${sim.p.stamina.toFixed(0)}${sim.rise.on ? '  slag ' + Math.round(sim.p.y - sim.rise.level) + ' below' : ''}`);
    if (res.leaps > 4000) { res.stuck = 'too many leaps'; return res; }
  }
  res.ok = true;
  return res;
}

/* ---------- main tower ---------- */
const t0 = Date.now();
const world = S.generate();
const r = climb(world);
if (!r.ok) { console.error('MAIN TOWER: STUCK at ' + r.stuck); process.exit(1); }
const count = {};
world.holds.forEach(h => { count[h.type] = (count[h.type] || 0) + 1; });
const chalk = world.shards.reduce((a, s) => a + s.v, 0);
r.ways.sort((a, b) => a - b);
console.log('Main tower: summit reached.');
console.log(`  tower height : ${Math.round(world.top * C.M_PER_UNIT)} m (${Math.round(world.top)} units), ${world.camps.length} camps`);
console.log(`  bot          : ${r.leaps} leaps, ${(r.sim.t / 60).toFixed(1)} min of sim time, lowest grip on landing ${r.minLand.toFixed(0)}`);
console.log('  holds        :', JSON.stringify(count));
console.log(`  hazards      : ${world.vents.length} vents, ${world.winds.length} wind bands, ${world.drafts.length} updrafts`);
console.log(`  set pieces   : ${world.sets.map(s => s.type + ' ' + Math.round(s.y0 * C.M_PER_UNIT) + '-' + Math.round(s.y1 * C.M_PER_UNIT) + ' m').join(', ')}`);
console.log(`  chalk        : ${chalk} across ${world.shards.length} shards`);
console.log(`  gates (m)    : ${world.gates.map(g => Math.round(g * C.M_PER_UNIT)).join(', ')}`);
console.log(`  leap leniency: median ${r.ways[r.ways.length >> 1]} launch options per leap, 10th percentile ${r.ways[Math.floor(r.ways.length * 0.1)]}; ${r.waited} leaps needed timing`);
if (r.tight.length) { console.log(`  tight spots (${r.tight.length}):`); r.tight.forEach(t => console.log('    ' + t)); }
console.log(`  checked in ${((Date.now() - t0) / 1000).toFixed(1)} s`);

/* ---------- daily towers ---------- */
const nDaily = +arg('--daily') || 0;
if (nDaily) {
  const from = arg('--from');
  const d = from ? new Date(+from.slice(0, 4), +from.slice(4, 6) - 1, +from.slice(6, 8)) : new Date();
  const t1 = Date.now(), bad = [];
  let leaps = 0, height = 0;
  for (let i = 0; i < nDaily; i++, d.setDate(d.getDate() + 1)) {
    const key = S.dateKey(d);
    const w = S.generate(S.dailySeed(key), S.DAILY_PLAN, { noShards: true });
    const rr = climb(w, { allTools: true, quiet: true });
    if (!rr.ok) bad.push(key + ': ' + rr.stuck); else { leaps += rr.leaps; height += w.top; }
  }
  const good = nDaily - bad.length;
  console.log(`Daily towers: ${good} of ${nDaily} dates climbable` + (good ? `, average ${Math.round(leaps / good)} leaps and ${Math.round(height / good * C.M_PER_UNIT)} m` : '') + ` (${((Date.now() - t1) / 1000).toFixed(0)} s)`);
  if (bad.length) { bad.forEach(b => console.log('  FAILED ' + b)); process.exit(1); }
}
