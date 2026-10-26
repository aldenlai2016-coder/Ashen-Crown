// The risen knight's poses, as data (docs/GAME_PLAN.md §11: "Start with the procedural pose rig (fast to iterate)").
// No three.js here, so node can test it (scripts/poses.test.mjs).
//
// A clip is a list of KEY POSES; between two keys every joint eases (smoothstep) from one to the next. A joint is
// [x, y, z] in degrees, applied to that joint's group in src/entities/knightRig.js. A joint left out of a key is 0
// (the rest pose: standing straight, arms hanging, facing +Z).
// Signs (the knight faces +Z, its right is -X):
//   x  a limb hanging down swings BACK for +, FORWARD for -  (so a forward step is thigh -x, a bent knee is shin +x,
//      a bent elbow is foreArm -x); a part pointing UP (spine, chest, neck, head) leans FORWARD for +, back for -
//   y  turns toward the knight's LEFT for +
//   z  moves a hanging limb toward +X (the knight's left): left arm out = +z, right arm out = -z
// root: { z: travel forward (m), pitch: a forward roll around the pivot (deg), y: unused now (the rig keeps the
//   body's lowest point on the ground every frame, so a pose only needs to say how the body bends) }

export const JOINTS = [
  'hips', 'spine', 'chest', 'neck', 'head',
  'upperArmL', 'foreArmL', 'handL', 'upperArmR', 'foreArmR', 'handR',
  'thighL', 'shinL', 'footL', 'thighR', 'shinR', 'footR',
];

// The guard stance every clip starts and ends in: shield up in front, sword low and ready, left foot forward.
const GUARD = {
  hips: [0, 14, 0], spine: [4, 0, 0], chest: [3, -12, 0], neck: [0, -2, 0], head: [6, 0, 0],
  upperArmL: [-30, -55, 10], foreArmL: [-90, 35, 0], handL: [0, 0, 0],
  upperArmR: [-18, -6, -14], foreArmR: [-48, 0, 0], handR: [36, 0, -10],
  thighL: [-22, -10, 4], shinL: [22, 0, 0], footL: [0, 0, 0],
  thighR: [12, -14, -6], shinR: [20, 0, 0], footR: [-28, 0, 0],
};

// the ball the roll turns in: chin down, back rounded, knees to the chest, shield and sword held in
const TUCK = {
  spine: [56, 0, 0], chest: [44, 0, 0], neck: [24, 0, 0], head: [20, 0, 0],
  upperArmL: [-50, -50, 16], foreArmL: [-110, 30, 0], upperArmR: [-60, 0, -14], foreArmR: [-110, 0, 0], handR: [50, 0, 0],
  thighL: [-130, 0, 8], shinL: [150, 0, 0], footL: [-30, 0, 0], thighR: [-126, 0, -8], shinR: [150, 0, 0], footR: [-30, 0, 0],
};

/** A copy of `base` with some joints replaced (and a root). */
const pose = (base, over = {}, root = {}) => ({ joints: { ...base, ...over }, root: { y: 0, z: 0, pitch: 0, ...root } });

// the same pose with left and right swapped (for the walk's second half)
function mirror(p) {
  const out = {};
  for (const [k, v] of Object.entries(p.joints)) {
    const side = k.endsWith('L') ? 'R' : k.endsWith('R') ? 'L' : '';
    const name = side ? k.slice(0, -1) + side : k;
    out[name] = [v[0], -v[1], -v[2]];
  }
  return { joints: out, root: { ...p.root } };
}

// walk: contact (right heel down, left toe pushing off) → passing (left leg swinging through) → mirrored.
// The shield arm stays up; the sword arm swings a little against the legs.
const WALK_ARMS = { upperArmL: [-26, -55, 12], foreArmL: [-86, 35, 0], handR: [36, 0, -10] };
const walkContact = pose({}, {
  ...WALK_ARMS, hips: [0, -6, 0], spine: [6, 0, 0], chest: [2, 8, 0], head: [6, -2, 0],
  upperArmR: [16, 0, -10], foreArmR: [-30, 0, 0],
  thighR: [-30, 0, -2], shinR: [6, 0, 0], footR: [-12, 0, 0],
  thighL: [18, 0, 2], shinL: [16, 0, 0], footL: [22, 0, 0],
}, { y: -0.035 });
const walkPassing = pose({}, {
  ...WALK_ARMS, hips: [0, 0, 0], spine: [6, 0, 0], chest: [2, 0, 0], head: [6, 0, 0],
  upperArmR: [-6, 0, -10], foreArmR: [-36, 0, 0],
  thighR: [2, 0, -2], shinR: [6, 0, 0], footR: [0, 0, 0],
  thighL: [-22, 0, 2], shinL: [58, 0, 0], footL: [10, 0, 0],
}, { y: 0.01 });
// the mirror flips the shield arm too: put both arms back on their own sides
const keepArms = (p, from) => {
  for (const j of ['upperArmL', 'foreArmL', 'handL', 'upperArmR', 'foreArmR', 'handR']) delete p.joints[j];
  p.joints.upperArmL = from.joints.upperArmL; p.joints.foreArmL = from.joints.foreArmL;
  p.joints.upperArmR = [-from.joints.upperArmR[0] - 10, 0, -10]; p.joints.foreArmR = from.joints.foreArmR;
  p.joints.handR = from.joints.handR;
  return p;
};

export const CLIPS = {
  idle: {
    label: 'Idle', duration: 2.6, loop: true,
    keys: [
      { t: 0, ...pose(GUARD) },
      { t: 1.3, ...pose(GUARD, { spine: [6, 0, 0], chest: [5, -12, 0], head: [8, 0, 0], upperArmL: [-28, -55, 12], foreArmR: [-50, 0, 0] }, { y: -0.012 }) },
    ],
  },
  walk: {
    label: 'Walk', duration: 1.1, loop: true,
    keys: [
      { t: 0, ...walkContact },
      { t: 0.275, ...walkPassing },
      { t: 0.55, ...keepArms(mirror(walkContact), walkContact) },
      { t: 0.825, ...keepArms(mirror(walkPassing), walkPassing) },
    ],
  },
  // a light attack: a slow, readable wind-up (the TELL: sword drawn back over the right shoulder), a fast diagonal cut
  // from right to left with a step in, a held follow-through, then back to guard. Commitment: nothing cancels it.
  attack: {
    label: 'Light attack', duration: 1.6, loop: true,
    keys: [
      { t: 0, ...pose(GUARD) },
      { t: 0.42, ...pose(GUARD, {
        hips: [0, -10, 0], spine: [-4, 0, 0], chest: [-4, -34, -4], head: [4, 30, 0],
        upperArmR: [-88, -14, 34], foreArmR: [-132, 0, 0], handR: [-74, 0, -56],
        upperArmL: [-36, -50, 16], foreArmL: [-84, 30, 0],
        thighL: [-18, -8, 4], shinL: [16, 0, 0], thighR: [16, -10, -6], shinR: [26, 0, 0], footR: [-26, 0, 0],
      }, { y: -0.03 }) },
      { t: 0.54, ...pose(GUARD, {
        hips: [0, -12, 0], spine: [-6, 0, 0], chest: [-6, -38, -6], head: [4, 34, 0],
        upperArmR: [-94, -14, 38], foreArmR: [-138, 0, 0], handR: [-80, 0, -60],
        upperArmL: [-36, -50, 16], foreArmL: [-84, 30, 0],
        thighL: [-18, -8, 4], shinL: [16, 0, 0], thighR: [16, -10, -6], shinR: [28, 0, 0], footR: [-26, 0, 0],
      }, { y: -0.035 }) },
      // the cut, out in front at its fastest (the hit lands here)
      { t: 0.63, ...pose(GUARD, {
        hips: [0, 14, 0], spine: [10, 0, 0], chest: [6, 12, 2], head: [8, -10, 0],
        upperArmR: [-31, 7, -14], foreArmR: [-93, 0, 0], handR: [-52, 0, 9],
        upperArmL: [-26, -50, 16], foreArmL: [-84, 30, 0],
        thighL: [-36, -6, 4], shinL: [36, 0, 0], footL: [4, 0, 0], thighR: [22, -12, -6], shinR: [16, 0, 0], footR: [-18, 0, 0],
      }, { y: -0.07, z: 0.2 }) },
      // follow-through: blade low on the left, the body turned after it (and open to a punish)
      { t: 0.74, ...pose(GUARD, {
        hips: [0, 26, 0], spine: [14, 0, 0], chest: [10, 26, 6], head: [10, -22, 0],
        upperArmR: [4, -50, 60], foreArmR: [-69, 0, 0], handR: [-12, 0, -16],
        upperArmL: [-20, -45, 24], foreArmL: [-80, 30, 0],
        thighL: [-44, -6, 4], shinL: [44, 0, 0], footL: [6, 0, 0], thighR: [26, -12, -6], shinR: [12, 0, 0], footR: [-14, 0, 0],
      }, { y: -0.1, z: 0.3 }) },
      { t: 0.98, ...pose(GUARD, {
        hips: [0, 28, 0], spine: [15, 0, 0], chest: [11, 27, 6], head: [10, -23, 0],
        upperArmR: [6, -50, 62], foreArmR: [-66, 0, 0], handR: [-10, 0, -16],
        upperArmL: [-18, -45, 26], foreArmL: [-78, 30, 0],
        thighL: [-44, -6, 4], shinL: [46, 0, 0], footL: [6, 0, 0], thighR: [26, -12, -6], shinR: [12, 0, 0], footR: [-14, 0, 0],
      }, { y: -0.11, z: 0.32 }) },
      { t: 1.4, ...pose(GUARD, {}, { z: 0.32 }) },
      { t: 1.6, ...pose(GUARD, {}, { z: 0.32 }) },
    ],
  },
  // the dodge roll: dip, tuck into a ball, one full turn while travelling ~2.6 m, land crouched, rise.
  // rootLinear: the turn and the travel keep going at one speed through the tucked keys (easing at every key would
  // make the ball stop and start)
  roll: {
    label: 'Roll', duration: 1.5, loop: true, rootLinear: true,
    keys: [
      { t: 0, ...pose(GUARD) },
      { t: 0.14, ...pose(GUARD, {
        hips: [0, 0, 0], spine: [30, 0, 0], chest: [24, 0, 0], head: [10, 0, 0],
        upperArmL: [-40, -50, 16], foreArmL: [-96, 30, 0], upperArmR: [-50, 0, -16], foreArmR: [-70, 0, 0],
        thighL: [-70, 0, 4], shinL: [96, 0, 0], footL: [-18, 0, 0], thighR: [-20, 0, -4], shinR: [80, 0, 0], footR: [-30, 0, 0],
      }, { z: 0.3, pitch: 20 }) },
      { t: 0.3, ...pose({}, TUCK, { z: 0.9, pitch: 110 }) },
      { t: 0.44, ...pose({}, TUCK, { z: 1.5, pitch: 210 }) },
      { t: 0.58, ...pose({}, TUCK, { z: 2.05, pitch: 300 }) },
      { t: 0.74, ...pose(GUARD, {
        hips: [0, 0, 0], spine: [34, 0, 0], chest: [24, 0, 0], head: [6, 0, 0],
        upperArmL: [-40, -50, 16], foreArmL: [-96, 30, 0], upperArmR: [-40, 0, -20], foreArmR: [-60, 0, 0],
        thighL: [-96, 0, 6], shinL: [130, 0, 0], footL: [-30, 0, 0], thighR: [-40, 0, -6], shinR: [116, 0, 0], footR: [-50, 0, 0],
      }, { z: 2.45, pitch: 352 }) },
      { t: 1.05, ...pose(GUARD, { spine: [12, 0, 0], thighL: [-40, -10, 4], shinL: [56, 0, 0], thighR: [-4, -14, -6], shinR: [52, 0, 0] }, { z: 2.6, pitch: 360 }) },
      { t: 1.5, ...pose(GUARD, {}, { z: 2.6, pitch: 360 }) },
    ],
  },
};

const DEG = Math.PI / 180;
const smooth = (u) => u * u * (3 - 2 * u);
const lerp = (a, b, u) => a + (b - a) * u;

/** Every joint in radians + the root, for a clip at time t (seconds; looping clips wrap). */
export function samplePose(clip, t) {
  const { keys, duration, loop } = clip;
  t = loop ? ((t % duration) + duration) % duration : Math.min(Math.max(t, 0), duration);
  let i = keys.length - 1;
  while (i > 0 && keys[i].t > t) i--;
  const a = keys[i];
  const b = keys[i + 1] ?? (loop ? { ...keys[0], t: duration } : a);
  // a looping clip that wraps (the walk) eases from its last key back to the first; one that ends where it began
  // (idle) is the same thing
  const span = b.t - a.t;
  const f = span > 0 ? (t - a.t) / span : 0;
  return mixPoses(a, b, smooth(f), false, clip.rootLinear ? f : smooth(f));
}

/** a → b by u (0..1), in radians (a key's joints are in degrees; mixPoses of two samples is fine too: rad = true). */
export function mixPoses(a, b, u, rad = false, uRoot = u) {
  const k = rad ? 1 : DEG, joints = {};
  for (const j of JOINTS) {
    const p = a.joints[j] ?? ZERO, q = b.joints[j] ?? ZERO;
    joints[j] = [lerp(p[0], q[0], u) * k, lerp(p[1], q[1], u) * k, lerp(p[2], q[2], u) * k];
  }
  const ra = a.root ?? ROOT, rb = b.root ?? ROOT;
  return {
    joints,
    root: {
      y: lerp(ra.y ?? 0, rb.y ?? 0, uRoot),
      z: lerp(ra.z ?? 0, rb.z ?? 0, uRoot),
      pitch: lerp(ra.pitch ?? 0, rb.pitch ?? 0, uRoot) * k,
    },
  };
}
const ZERO = [0, 0, 0];
const ROOT = { y: 0, z: 0, pitch: 0 };
