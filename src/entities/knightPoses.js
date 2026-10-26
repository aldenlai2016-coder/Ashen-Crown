// The risen knight's poses, as data (docs/GAME_PLAN.md §11: "Start with the procedural pose rig (fast to iterate)").
// No three.js here, so node can test it (scripts/poses.test.mjs).
import ARMS from './knightArms.json' with { type: 'json' };
//
// A clip is a list of KEY POSES; between two keys every joint eases (smoothstep) from one to the next. A joint is
// [x, y, z] in degrees, applied to that joint's group in src/entities/knightRig.js. A joint left out of a key is 0
// (the rest pose: standing straight, arms hanging, facing +Z).
// Signs (the knight faces +Z, its right is -X):
//   x  a limb hanging down swings BACK for +, FORWARD for -  (so a forward step is thigh -x, a bent knee is shin +x,
//      a bent elbow is foreArm -x); a part pointing UP (spine, chest, neck, head) leans FORWARD for +, back for -
//   y  turns toward the knight's LEFT for +
//   z  moves a hanging limb toward +X (the knight's left): left arm out = +z, right arm out = -z
// root: { z: travel forward (m), pitch: a forward roll around the pivot (deg), lift: height off the ground (m, for a
//   jump) }. The rig keeps the body's lowest point on the ground every frame, so a pose only says how the body bends;
//   lift is added on top of that. (An old `y` is ignored.)
//
// A clip can also say:
//   needs   the gear it needs in hand: ['sword'], ['shield'] (the gallery greys a move out when the knight lacks it)
//   events  [{ t, type, at }]: moments the game reacts to: 'impact' (the weapon hits the ground: dust + shake),
//           'clang' (steel on steel: sparks), 'parry' (a golden flash), at 'tip' | 'shield' | 'fist' | 'foot'
//   key.aim where a key wants the weapon or shield to be, in metres from the knight's feet (z counts from where the
//           clip's travel has taken it): R: { hilt, tip } or R: { fist }, and/or L: { shield, facing }.
//           `node scripts/solveArms.mjs` turns aims into arm angles (src/entities/knightArms.json, applied below), so
//           a key's hand-written arm angles are only the solver's starting guess.

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

// guard: knees bent, shield high in front of the helm, sword over the shield's edge
const BLOCK = {
  hips: [0, 10, 0], spine: [10, 0, 0], chest: [6, -8, 0], head: [10, 0, 0],
  upperArmR: [-70, -10, -24], foreArmR: [-80, 0, 0], handR: [10, 0, -20],
  thighL: [-34, -10, 4], shinL: [44, 0, 0], footL: [-6, 0, 0], thighR: [10, -14, -6], shinR: [40, 0, 0], footR: [-44, 0, 0],
};
// in the guard the sword rests over the shield's top edge, point forward, ready to answer
const GUARD_SWORD = { hilt: [-0.22, 1.2, 0.34], tip: [-0.04, 1.48, 1.18] };
// no sword: the right fist up by the chin
const FISTS = { upperArmR: [-30, -20, -24], foreArmR: [-124, 0, 0], handR: [0, 0, 0] };

/** A copy of `base` with some joints replaced (and a root). */
const pose = (base, over = {}, root = {}) => ({ joints: { ...base, ...over }, root: { y: 0, z: 0, pitch: 0, lift: 0, ...root } });

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

  // ---- heavier sword moves ----

  // the heavy attack: a long, readable charge (sword hoisted behind the head, weight on the back foot), then a
  // vertical chop with a big step in that buries the tip near the ground, and a slow recovery you can be punished in
  heavy: {
    label: 'Heavy attack', duration: 2.3, loop: true, needs: ['sword'],
    events: [{ t: 1.02, type: 'impact', at: 'tip' }],
    keys: [
      { t: 0, ...pose(GUARD) },
      { t: 0.6, ...pose(GUARD, {
        hips: [0, -22, 0], spine: [-6, 0, 0], chest: [-8, -24, 0], head: [8, 22, 0],
        upperArmR: [-150, -20, -20], foreArmR: [-110, 0, 0], handR: [-40, 0, 0],
        upperArmL: [-20, -45, 24], foreArmL: [-84, 30, 0],
        thighL: [-28, -10, 6], shinL: [30, 0, 0], footL: [-2, 0, 0], thighR: [22, -14, -6], shinR: [34, 0, 0], footR: [-44, 0, 0],
      }), aim: { R: { hilt: [-0.14, 1.98, -0.16], tip: [-0.1, 2.58, -0.82] } } },
      { t: 0.9, ...pose(GUARD, {
        hips: [0, -24, 0], spine: [-8, 0, 0], chest: [-10, -26, 0], head: [8, 24, 0],
        upperArmR: [-152, -20, -20], foreArmR: [-112, 0, 0], handR: [-42, 0, 0],
        upperArmL: [-20, -45, 24], foreArmL: [-84, 30, 0],
        thighL: [-28, -10, 6], shinL: [32, 0, 0], footL: [-2, 0, 0], thighR: [24, -14, -6], shinR: [38, 0, 0], footR: [-46, 0, 0],
      }), aim: { R: { hilt: [-0.14, 2.0, -0.2], tip: [-0.1, 2.56, -0.88] } } },
      { t: 1.02, ...pose(GUARD, {
        hips: [0, 10, 0], spine: [24, 0, 0], chest: [16, 8, 0], head: [-8, -6, 0],
        upperArmR: [-60, 0, 0], foreArmR: [-20, 0, 0], handR: [20, 0, 0],
        upperArmL: [-8, -40, 30], foreArmL: [-70, 30, 0],
        thighL: [-58, -6, 6], shinL: [64, 0, 0], footL: [-4, 0, 0], thighR: [34, -12, -6], shinR: [18, 0, 0], footR: [-30, 0, 0],
      }, { z: 0.5 }), aim: { R: { hilt: [-0.06, 0.95, 0.62], tip: [0.0, 0.12, 1.3] } } },
      { t: 1.5, ...pose(GUARD, {
        hips: [0, 10, 0], spine: [26, 0, 0], chest: [17, 8, 0], head: [-8, -6, 0],
        upperArmR: [-58, 0, 0], foreArmR: [-20, 0, 0], handR: [22, 0, 0],
        upperArmL: [-8, -40, 30], foreArmL: [-70, 30, 0],
        thighL: [-58, -6, 6], shinL: [66, 0, 0], footL: [-4, 0, 0], thighR: [34, -12, -6], shinR: [18, 0, 0], footR: [-30, 0, 0],
      }, { z: 0.52 }), aim: { R: { hilt: [-0.06, 0.92, 0.6], tip: [0.0, 0.1, 1.28] } } },
      { t: 2.05, ...pose(GUARD, {}, { z: 0.52 }) },
      { t: 2.3, ...pose(GUARD, {}, { z: 0.52 }) },
    ],
  },
  // the smash: crouch, leap with the sword raised over the head, come down and drive it into the ground two-handed-
  // hard; a ring of ash bursts out from the blade. The biggest commitment the knight has.
  smash: {
    label: 'Smash', duration: 2.5, loop: true, needs: ['sword'],
    events: [{ t: 0.8, type: 'impact', at: 'tip', big: true }],
    keys: [
      { t: 0, ...pose(GUARD) },
      { t: 0.3, ...pose(GUARD, {
        hips: [0, 0, 0], spine: [22, 0, 0], chest: [10, -6, 0], head: [-10, 0, 0],
        upperArmR: [-60, 0, -20], foreArmR: [-90, 0, 0], handR: [0, 0, 0],
        upperArmL: [-30, -50, 20], foreArmL: [-88, 30, 0],
        thighL: [-66, -4, 6], shinL: [96, 0, 0], footL: [-30, 0, 0], thighR: [-30, -8, -6], shinR: [96, 0, 0], footR: [-60, 0, 0],
      }), aim: { R: { hilt: [-0.28, 1.0, 0.25], tip: [-0.3, 1.5, 0.95] } } },
      { t: 0.56, ...pose(GUARD, {
        hips: [0, 0, 0], spine: [-8, 0, 0], chest: [-10, 0, 0], head: [10, 0, 0],
        upperArmR: [-170, 0, -10], foreArmR: [-80, 0, 0], handR: [-30, 0, 0],
        upperArmL: [-60, -30, 40], foreArmL: [-60, 30, 0],
        thighL: [-74, 0, 4], shinL: [110, 0, 0], footL: [-10, 0, 0], thighR: [-30, 0, -4], shinR: [120, 0, 0], footR: [-20, 0, 0],
      }, { z: 0.55, lift: 0.62 }), aim: { R: { hilt: [-0.12, 2.22, -0.02], tip: [-0.08, 2.5, -0.85] } } },
      { t: 0.7, ...pose(GUARD, {
        hips: [0, 0, 0], spine: [12, 0, 0], chest: [6, 0, 0], head: [0, 0, 0],
        upperArmR: [-140, 0, -10], foreArmR: [-40, 0, 0], handR: [0, 0, 0],
        upperArmL: [-40, -40, 34], foreArmL: [-70, 30, 0],
        thighL: [-44, 0, 4], shinL: [44, 0, 0], footL: [10, 0, 0], thighR: [-6, 0, -4], shinR: [50, 0, 0], footR: [10, 0, 0],
      }, { z: 0.95, lift: 0.3 }), aim: { R: { hilt: [-0.06, 1.95, 0.5], tip: [0.0, 2.3, 1.3] } } },
      { t: 0.8, ...pose(GUARD, {
        hips: [0, 0, 0], spine: [40, 0, 0], chest: [22, 0, 0], head: [-14, 0, 0],
        upperArmR: [-70, 0, 0], foreArmR: [-10, 0, 0], handR: [40, 0, 0],
        upperArmL: [-10, -40, 40], foreArmL: [-60, 30, 0],
        thighL: [-84, -6, 6], shinL: [104, 0, 0], footL: [-20, 0, 0], thighR: [8, -10, -6], shinR: [100, 0, 0], footR: [-62, 0, 0],
      }, { z: 1.15 }), aim: { R: { hilt: [-0.05, 0.62, 0.7], tip: [0.0, 0.02, 1.38] } } },
      { t: 1.45, ...pose(GUARD, {
        hips: [0, 0, 0], spine: [40, 0, 0], chest: [22, 0, 0], head: [-14, 0, 0],
        upperArmR: [-70, 0, 0], foreArmR: [-10, 0, 0], handR: [40, 0, 0],
        upperArmL: [-10, -40, 40], foreArmL: [-60, 30, 0],
        thighL: [-82, -6, 6], shinL: [102, 0, 0], footL: [-20, 0, 0], thighR: [8, -10, -6], shinR: [98, 0, 0], footR: [-62, 0, 0],
      }, { z: 1.15 }), aim: { R: { hilt: [-0.05, 0.64, 0.7], tip: [0.0, 0.03, 1.38] } } },
      { t: 2.1, ...pose(GUARD, {}, { z: 1.15 }) },
      { t: 2.5, ...pose(GUARD, {}, { z: 1.15 }) },
    ],
  },
  // the thrust: draw the sword back to the hip, then lunge and drive the point straight ahead at chest height
  thrust: {
    label: 'Thrust', duration: 1.6, loop: true, needs: ['sword'],
    keys: [
      { t: 0, ...pose(GUARD) },
      { t: 0.38, ...pose(GUARD, {
        hips: [0, -26, 0], spine: [2, 0, 0], chest: [0, -18, 0], head: [6, 26, 0],
        upperArmR: [20, 0, -20], foreArmR: [-100, 0, 0], handR: [0, 0, 0],
        thighL: [-26, -10, 6], shinL: [30, 0, 0], thighR: [20, -14, -6], shinR: [30, 0, 0], footR: [-40, 0, 0],
      }), aim: { R: { hilt: [-0.3, 1.18, 0.0], tip: [-0.2, 1.26, 0.88] } } },
      { t: 0.5, ...pose(GUARD, {
        hips: [0, 8, 0], spine: [16, 0, 0], chest: [8, 10, 0], head: [-6, -8, 0],
        upperArmR: [-80, 0, 0], foreArmR: [-10, 0, 0], handR: [0, 0, 0],
        upperArmL: [-14, -40, 30], foreArmL: [-76, 30, 0],
        thighL: [-58, -6, 6], shinL: [58, 0, 0], footL: [-2, 0, 0], thighR: [38, -12, -6], shinR: [8, 0, 0], footR: [-26, 0, 0],
      }, { z: 0.45 }), aim: { R: { hilt: [-0.08, 1.22, 0.62], tip: [0.0, 1.3, 1.52] } } },
      { t: 0.86, ...pose(GUARD, {
        hips: [0, 8, 0], spine: [17, 0, 0], chest: [8, 10, 0], head: [-6, -8, 0],
        upperArmR: [-80, 0, 0], foreArmR: [-10, 0, 0], handR: [0, 0, 0],
        upperArmL: [-14, -40, 30], foreArmL: [-76, 30, 0],
        thighL: [-58, -6, 6], shinL: [60, 0, 0], footL: [-2, 0, 0], thighR: [38, -12, -6], shinR: [8, 0, 0], footR: [-26, 0, 0],
      }, { z: 0.47 }), aim: { R: { hilt: [-0.08, 1.2, 0.6], tip: [0.0, 1.28, 1.5] } } },
      { t: 1.35, ...pose(GUARD, {}, { z: 0.47 }) },
      { t: 1.6, ...pose(GUARD, {}, { z: 0.47 }) },
    ],
  },

  // ---- shield moves ----

  // the shield bash: turn the shoulder away, then drive the shield's face forward with a step in
  bash: {
    label: 'Shield bash', duration: 1.5, loop: true, needs: ['shield'],
    events: [{ t: 0.44, type: 'clang', at: 'shield' }],
    keys: [
      { t: 0, ...pose(GUARD) },
      { t: 0.3, ...pose(GUARD, {
        hips: [0, -14, 0], spine: [2, 0, 0], chest: [0, -26, 0], head: [6, 30, 0],
        thighL: [-20, -10, 4], shinL: [26, 0, 0], thighR: [16, -14, -6], shinR: [30, 0, 0], footR: [-36, 0, 0],
      }), aim: { L: { shield: [-0.02, 1.2, 0.24], facing: [0.3, 0.1, 1] } } },
      { t: 0.44, ...pose(GUARD, {
        hips: [0, 30, 0], spine: [14, 0, 0], chest: [8, 24, 0], head: [-4, -40, 0],
        thighL: [-52, -6, 6], shinL: [52, 0, 0], footL: [-2, 0, 0], thighR: [32, -12, -6], shinR: [12, 0, 0], footR: [-26, 0, 0],
      }, { z: 0.38 }), aim: { L: { shield: [0.28, 1.3, 0.62], facing: [0, 0.05, 1] } } },
      { t: 0.74, ...pose(GUARD, {
        hips: [0, 30, 0], spine: [15, 0, 0], chest: [8, 24, 0], head: [-4, -40, 0],
        thighL: [-52, -6, 6], shinL: [54, 0, 0], footL: [-2, 0, 0], thighR: [32, -12, -6], shinR: [12, 0, 0], footR: [-26, 0, 0],
      }, { z: 0.4 }), aim: { L: { shield: [0.28, 1.29, 0.6], facing: [0, 0.05, 1] } } },
      { t: 1.25, ...pose(GUARD, {}, { z: 0.4 }) },
      { t: 1.5, ...pose(GUARD, {}, { z: 0.4 }) },
    ],
  },
  // guard: crouched behind the raised shield, sword ready over it; a blow lands (sparks) and pushes the knight back
  block: {
    label: 'Guard', duration: 2.2, loop: true, needs: ['shield'],
    events: [{ t: 1.0, type: 'clang', at: 'shield' }],
    keys: [
      { t: 0, ...pose(GUARD, BLOCK), aim: { L: { shield: [0.1, 1.34, 0.38], facing: [-0.1, 0.2, 1] }, R: GUARD_SWORD } },
      { t: 0.95, ...pose(GUARD, BLOCK), aim: { L: { shield: [0.1, 1.34, 0.38], facing: [-0.1, 0.2, 1] }, R: GUARD_SWORD } },
      { t: 1.06, ...pose(GUARD, { ...BLOCK, spine: [-2, 0, 0], chest: [-4, -12, 0], thighL: [-14, -10, 4], shinL: [30, 0, 0] }, { z: -0.14 }), aim: { L: { shield: [0.08, 1.4, 0.27], facing: [-0.1, 0.3, 1] }, R: { hilt: [-0.22, 1.26, 0.24], tip: [-0.06, 1.58, 1.06] } } },
      { t: 1.4, ...pose(GUARD, BLOCK, { z: -0.16 }), aim: { L: { shield: [0.1, 1.34, 0.38], facing: [-0.1, 0.2, 1] }, R: GUARD_SWORD } },
      { t: 2.0, ...pose(GUARD, BLOCK, { z: -0.16 }), aim: { L: { shield: [0.1, 1.34, 0.38], facing: [-0.1, 0.2, 1] }, R: GUARD_SWORD } },
      { t: 2.2, ...pose(GUARD, BLOCK, { z: -0.16 }), aim: { L: { shield: [0.1, 1.34, 0.38], facing: [-0.1, 0.2, 1] }, R: GUARD_SWORD } },
    ],
  },
  // the parry: a short, sharp outward beat of the shield (the window), a golden flash when it lands, back to guard
  parry: {
    label: 'Parry', duration: 1.4, loop: true, needs: ['shield'],
    events: [{ t: 0.14, type: 'parry', at: 'shield' }],
    keys: [
      { t: 0, ...pose(GUARD) },
      { t: 0.08, ...pose(GUARD, { chest: [3, -18, 0] }), aim: { L: { shield: [0.05, 1.28, 0.33], facing: [-0.2, 0, 1] } } },
      { t: 0.16, ...pose(GUARD, { hips: [0, 24, 0], chest: [6, 20, 0], head: [6, -20, 0] }), aim: { L: { shield: [0.42, 1.3, 0.36], facing: [0.8, 0.1, 0.6] } } },
      { t: 0.32, ...pose(GUARD, { hips: [0, 24, 0], chest: [6, 22, 0], head: [6, -20, 0] }), aim: { L: { shield: [0.44, 1.28, 0.32], facing: [0.85, 0.1, 0.5] } } },
      { t: 0.8, ...pose(GUARD) },
      { t: 1.4, ...pose(GUARD) },
    ],
  },

  // ---- with no sword in hand: light is a punch, heavy is a kick ----

  punch: {
    label: 'Punch', duration: 1.1, loop: true,
    events: [{ t: 0.26, type: 'clang', at: 'fist', small: true }],
    keys: [
      { t: 0, ...pose(GUARD, FISTS) },
      { t: 0.16, ...pose(GUARD, { ...FISTS, hips: [0, -10, 0], chest: [3, -26, 0] }), aim: { R: { fist: [-0.24, 1.42, 0.08] } } },
      { t: 0.26, ...pose(GUARD, { ...FISTS, hips: [0, 26, 0], spine: [10, 0, 0], chest: [6, 30, 0], head: [6, -30, 0], thighL: [-30, -8, 4], shinL: [30, 0, 0], thighR: [20, -14, -6], shinR: [14, 0, 0] }, { z: 0.12 }), aim: { R: { fist: [-0.02, 1.48, 0.68] } } },
      { t: 0.42, ...pose(GUARD, { ...FISTS, hips: [0, 26, 0], spine: [10, 0, 0], chest: [6, 30, 0], head: [6, -30, 0], thighL: [-30, -8, 4], shinL: [30, 0, 0], thighR: [20, -14, -6], shinR: [14, 0, 0] }, { z: 0.12 }), aim: { R: { fist: [-0.02, 1.47, 0.66] } } },
      { t: 0.8, ...pose(GUARD, FISTS, { z: 0.12 }) },
      { t: 1.1, ...pose(GUARD, FISTS, { z: 0.12 }) },
    ],
  },
  kick: {
    label: 'Kick', duration: 1.5, loop: true,
    events: [{ t: 0.46, type: 'clang', at: 'foot', small: true }],
    keys: [
      { t: 0, ...pose(GUARD, FISTS) },
      { t: 0.3, ...pose(GUARD, { ...FISTS, spine: [-4, 0, 0], thighR: [-80, -10, -4], shinR: [110, 0, 0], footR: [-10, 0, 0], thighL: [-10, -10, 4], shinL: [24, 0, 0] }) },
      { t: 0.46, ...pose(GUARD, { ...FISTS, spine: [-14, 0, 0], chest: [-6, -12, 0], head: [16, 0, 0], thighR: [-88, -10, -4], shinR: [6, 0, 0], footR: [-40, 0, 0], thighL: [-4, -10, 4], shinL: [20, 0, 0] }, { z: 0.08 }) },
      { t: 0.62, ...pose(GUARD, { ...FISTS, spine: [-6, 0, 0], thighR: [-80, -10, -4], shinR: [110, 0, 0], footR: [-10, 0, 0], thighL: [-10, -10, 4], shinL: [24, 0, 0] }, { z: 0.1 }) },
      { t: 1.0, ...pose(GUARD, FISTS, { z: 0.14 }) },
      { t: 1.5, ...pose(GUARD, FISTS, { z: 0.14 }) },
    ],
  },
};

// Which clip each button plays, by what the knight is holding (the plan §5: moves differ per weapon).
export const MOVESETS = {
  sword: { light: 'attack', heavy: 'heavy' },
  unarmed: { light: 'punch', heavy: 'kick' },
};

// arm angles solved from the keys' aims (node scripts/solveArms.mjs)
for (const [id, joints] of Object.entries(ARMS)) {
  const [clip, i] = id.split('/');
  const key = CLIPS[clip]?.keys[Number(i)];
  if (key) Object.assign(key.joints, joints);
}

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
      lift: lerp(ra.lift ?? 0, rb.lift ?? 0, uRoot),
    },
  };
}
const ZERO = [0, 0, 0];
const ROOT = { y: 0, z: 0, pitch: 0, lift: 0 };
