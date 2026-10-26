// Dev tool: turn the `aim`s in src/entities/knightPoses.js into arm angles, written to src/entities/knightArms.json.
//
//   node scripts/solveArms.mjs            (all clips)
//   node scripts/solveArms.mjs heavy      (one clip)
//
// For each key with an aim, the knight is posed exactly as the game poses it (the same rig, kept on the ground, lifted),
// then the arm's angles are searched (a seeded random search, then a narrowing local one) until the sword's hilt + tip,
// the fist, or the shield's centre + facing sit where the aim says. A small pull toward the key's own angles keeps the
// solution near the hand-written pose, so neighbouring keys don't flip between two ways of reaching the same point.
import { readFileSync, writeFileSync } from 'node:fs';
import * as THREE from 'three';
import { KnightRig } from '../src/entities/knightRig.js';
import { CLIPS, JOINTS, samplePose } from '../src/entities/knightPoses.js';

const OUT = new URL('../src/entities/knightArms.json', import.meta.url);
const D = Math.PI / 180;
const only = process.argv[2];
const solved = JSON.parse(readFileSync(OUT, 'utf8'));
const rig = new KnightRig();

// the arm's free angles (degrees) for each kind of aim: [joint, axis, min, max]
const VARS = {
  sword: [['upperArmR', 0, -180, 60], ['upperArmR', 1, -90, 90], ['upperArmR', 2, -90, 70], ['foreArmR', 0, -145, 0], ['handR', 0, -85, 85], ['handR', 2, -65, 65]],
  fist: [['upperArmR', 0, -180, 60], ['upperArmR', 1, -90, 90], ['upperArmR', 2, -90, 70], ['foreArmR', 0, -145, 0]],
  shield: [['upperArmL', 0, -180, 60], ['upperArmL', 1, -90, 60], ['upperArmL', 2, -20, 90], ['foreArmL', 0, -145, 0], ['foreArmL', 1, -20, 70]],
};

let seed = 12345;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const v3 = (a) => new THREE.Vector3(...a);

function poseAt(clip, key) {
  const p = samplePose(clip, key.t);
  for (const j of JOINTS) rig.joints[j].rotation.set(...p.joints[j]);
  rig.mover.position.set(0, 0, p.root.z);
  rig.pivot.rotation.x = p.root.pitch;
  return p;
}

function place(p, kind, vars, a) {
  vars.forEach(([j, axis], i) => { rig.joints[j].rotation[['x', 'y', 'z'][axis]] = a[i] * D; });
  rig._ground();
  if (p.root.lift) { rig.mover.position.y += p.root.lift; rig.root.updateMatrixWorld(true); }
}

function solve(clipName, clip, index, side, prev) {
  const key = clip.keys[index];
  const aim = key.aim[side];
  const kind = side === 'L' ? 'shield' : aim.fist ? 'fist' : 'sword';
  const vars = VARS[kind];
  const p = poseAt(clip, key);
  const z = p.root.z;
  const at = (xyz) => v3(xyz).add(new THREE.Vector3(0, 0, z));
  const start = vars.map(([j, axis]) => key.joints[j]?.[axis] ?? 0);
  const err = (a) => {
    place(p, kind, vars, a);
    let e = 0;
    if (kind === 'sword') {
      e += v3([0, -0.1, 0]).applyMatrix4(rig.sword.matrixWorld).distanceTo(at(aim.hilt)) * 2;
      e += v3([0, -0.98, 0]).applyMatrix4(rig.sword.matrixWorld).distanceTo(at(aim.tip));
    } else if (kind === 'fist') {
      e += v3([0, -0.09, 0]).applyMatrix4(rig.joints.handR.matrixWorld).distanceTo(at(aim.fist)) * 2;
    } else {
      e += v3([0, 0, 0]).applyMatrix4(rig.shield.matrixWorld).distanceTo(at(aim.shield)) * 2;
      const n = v3([0, 0, 1]).transformDirection(rig.shield.matrixWorld);
      e += (1 - n.dot(v3(aim.facing).normalize())) * 0.6;
    }
    return e;
  };
  const cost = (a) => err(a) + a.reduce((s, v, i) => s + (v - start[i]) ** 2, 0) * 0.00002;
  // candidates: the key's own angles, the previous key's solution (smooth arcs), and random restarts; each is then
  // refined by a narrowing local search, and the best wins
  const refine = (a0) => {
    let best = a0.slice(), bc = cost(best);
    for (let step = 25; step > 0.3; step *= 0.75) for (let it = 0; it < 200; it++) {
      const a = best.map((v, i) => Math.min(vars[i][3], Math.max(vars[i][2], v + (rnd() - 0.5) * 2 * step)));
      const c = cost(a);
      if (c < bc) { bc = c; best = a; }
    }
    return [best, bc];
  };
  const seeds = [start];
  if (prev) seeds.push(vars.map(([j, axis]) => prev[j]?.[axis] ?? 0));
  for (let r = 0; r < 4; r++) {
    let pick = null, pc = Infinity;
    for (let n = 0; n < 800; n++) {
      const a = vars.map(([, , lo, hi]) => lo + rnd() * (hi - lo));
      const c = cost(a);
      if (c < pc) { pc = c; pick = a; }
    }
    seeds.push(pick);
  }
  let best = null, bc = Infinity;
  for (const sd of seeds) { const [a, c] = refine(sd); if (c < bc) { bc = c; best = a; } }
  const out = {};
  vars.forEach(([j, axis], i) => {
    out[j] ??= (key.joints[j] ?? [0, 0, 0]).slice();
    out[j][axis] = Math.round(best[i] * 10) / 10;
  });
  const miss = err(best);
  console.log(`${clipName}/${index} (${kind})  miss ${miss.toFixed(3)}  ${JSON.stringify(out)}`);
  if (miss > 0.15 || process.env.VERBOSE) {
    const f = (v) => v.toArray().map((n) => n.toFixed(2)).join(', ');
    const sh = v3([0, 0, 0]).applyMatrix4(rig.joints[side === 'L' ? 'upperArmL' : 'upperArmR'].matrixWorld);
    const got = kind === 'sword' ? `hilt ${f(v3([0, -0.1, 0]).applyMatrix4(rig.sword.matrixWorld))}  tip ${f(v3([0, -0.98, 0]).applyMatrix4(rig.sword.matrixWorld))}`
      : kind === 'fist' ? `fist ${f(v3([0, -0.09, 0]).applyMatrix4(rig.joints.handR.matrixWorld))}`
      : `shield ${f(v3([0, 0, 0]).applyMatrix4(rig.shield.matrixWorld))}  facing ${f(v3([0, 0, 1]).transformDirection(rig.shield.matrixWorld))}`;
    console.log(`    shoulder ${f(sh)} (travel z ${z.toFixed(2)})  got ${got}  wanted ${JSON.stringify(aim)}`);
  }
  return out;
}

for (const [name, clip] of Object.entries(CLIPS)) {
  if (only && name !== only) continue;
  const last = {};
  clip.keys.forEach((key, i) => {
    if (!key.aim) return;
    // each arm in turn (the shield arm first: it can move the body's ground contact, which moves the sword's aim)
    const id = `${name}/${i}`;
    solved[id] = {};
    for (const side of ['L', 'R'].filter((s) => key.aim[s])) {
      Object.assign(solved[id], solve(name, clip, i, side, last[side]));
      last[side] = solved[id];
      Object.assign(key.joints, solved[id]);   // the next key (and the other arm) start from this pose
    }
  });
}
writeFileSync(OUT, JSON.stringify(solved, null, 1) + '\n');
console.log(`✓ ${OUT.pathname.split('/').slice(-3).join('/')}`);
