/* Verifies the generated tower is climbable: an automated climber must get from the first camp
   to the summit at base stats (no upgrades), without a single fall.
   Run:  node tests/verify.js            (add -v for a per-leap log) */
'use strict';
const S = require('../js/core.js');
const C = S.C;
const verbose = process.argv.includes('-v');

const world = S.generate();
const mainHolds = [];
world.holds.forEach(h => { if (!h.side) mainHolds[h.main] = h; });

const sim = S.createSim(world, {});
let maxCamp = 0;

function score(s) {
  const p = s.p;
  if (p.state !== 'hold') return -1;
  const h = world.holds[p.hold];
  if (h.side) return h.main * 1000 - 1;
  return h.main * 1000 + (h.type === 'plate' ? p.y - h.y0 : 0);
}

// Plays one action on sim s until the climber is holding something again (or dies).
function run(s, a) {
  if (a.script === 'tap') { if (!S.grapple(s, a.tx, a.ty)) return false; }
  else { const v = a.pow * s.mods.vmax; if (!S.leap(s, Math.cos(a.ang) * v, Math.sin(a.ang) * v)) return false; }
  let tapped = a.script === 'tap';
  for (let i = 0; i < 480; i++) {
    const p = s.p;
    if (a.script === 'glide') {
      p.wantGlide = i >= a.g0;
      const dx = a.tx - p.x;
      p.steer = Math.abs(dx) < 4 ? 0 : Math.sign(dx) * Math.min(1, Math.abs(dx) / 40);
    }
    if (a.script === 'leaptap' && !tapped && p.state === 'air') {
      const dx = a.tx - p.x, dy = a.ty - p.y;
      if (dx * dx + dy * dy < (C.GRAPPLE_R - 6) ** 2) { S.grapple(s, a.tx, a.ty); tapped = true; }
    }
    S.step(s, C.DT);
    if (s.p.state === 'hold') { s.p.wantGlide = false; s.p.steer = 0; return true; }
    if (s.p.state === 'dead') return false;
  }
  return false;
}

const ANGLES = []; for (let d = 15; d <= 165; d += 5) ANGLES.push(d * Math.PI / 180);
const POWERS = [0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];
const WAITS = []; for (let w = 0; w <= 4.0001; w += 0.2) WAITS.push(w);

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
    if (next && next.viaDraft && s.tools.glider) {
      for (const g0 of [8, 20, 34, 50]) for (const ang of ANGLES) for (const pow of POWERS)
        tryA({ script: 'glide', ang, pow, g0, tx: next.x });
    }
    if (!anchorNext) for (const ang of ANGLES) for (const pow of POWERS) tryA({ script: 'leap', ang, pow });
    if (best) { best.solutions = solutions; return best; }
  }
  return null;
}

let leaps = 0, tight = [], minLand = 1e9, waysAll = [], waited = 0;
const summit = world.camps[world.camps.length - 1].hold;
const t0 = Date.now();

while (sim.p.hold !== summit) {
  const h = world.holds[sim.p.hold];
  if (h.type === 'camp' && h.camp > maxCamp) { maxCamp = h.camp; sim.tools = S.toolsFor(maxCamp); }
  if ((h.type === 'ledge' || h.type === 'camp') && sim.p.stamina < sim.mods.stMax - 0.5) { S.step(sim, C.DT); continue; }
  const d = decide(sim);
  if (!d) {
    const next = mainHolds[h.main + 1];
    console.error(`STUCK at hold #${h.id} (${h.type}, main ${h.main}, seg ${h.seg}, y ${h.y.toFixed(0)}), stamina ${sim.p.stamina.toFixed(0)}`);
    console.error('  next:', next && { type: next.type, x: Math.round(next.x), y: Math.round(next.y), viaDraft: next.viaDraft });
    process.exit(1);
  }
  for (let i = 0; i < Math.round(d.wait / C.DT); i++) S.step(sim, C.DT);
  if (!run(sim, d.a)) { console.error('Replay diverged at hold', h.id); process.exit(1); }
  leaps++; waysAll.push(d.solutions); if (d.wait > 0) waited++;
  const hh = world.holds[sim.p.hold];
  minLand = Math.min(minLand, sim.p.stamina);
  if (d.solutions < 4) tight.push(`#${h.id} ${h.type} -> #${hh.id} ${hh.type} (seg ${h.seg}, ${d.solutions} ways, wait ${d.wait.toFixed(1)}s)`);
  if (verbose) console.log(`${h.type.padEnd(8)} -> ${hh.type.padEnd(8)} seg ${String(h.seg).padStart(2)}  ${d.a.script.padEnd(7)} wait ${d.wait.toFixed(1)}  ways ${d.solutions}  stamina ${sim.p.stamina.toFixed(0)}`);
  if (leaps > 4000) { console.error('Too many leaps'); process.exit(1); }
}

const count = {};
world.holds.forEach(h => { count[h.type] = (count[h.type] || 0) + 1; });
const chalk = world.shards.reduce((a, s) => a + s.v, 0);
console.log('Summit reached.');
console.log(`  tower height : ${Math.round(world.top * C.M_PER_UNIT)} m (${Math.round(world.top)} units), ${world.camps.length} camps`);
console.log(`  bot          : ${leaps} leaps, ${(sim.t / 60).toFixed(1)} min of sim time, lowest grip on landing ${minLand.toFixed(0)}`);
console.log('  holds        :', JSON.stringify(count));
console.log(`  hazards      : ${world.vents.length} vents, ${world.winds.length} wind bands, ${world.drafts.length} updrafts`);
console.log(`  chalk        : ${chalk} across ${world.shards.length} shards`);
console.log(`  gates (m)    : ${world.gates.map(g => Math.round(g * C.M_PER_UNIT)).join(', ')}`);
waysAll.sort((a, b) => a - b);
console.log(`  leap leniency: median ${waysAll[waysAll.length >> 1]} launch options per leap, 10th percentile ${waysAll[Math.floor(waysAll.length * 0.1)]}; ${waited} leaps needed timing`);
if (tight.length) { console.log(`  tight spots (${tight.length}):`); tight.forEach(t => console.log('    ' + t)); }
console.log(`  checked in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
