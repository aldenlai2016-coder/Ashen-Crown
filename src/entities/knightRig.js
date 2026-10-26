// The risen knight (docs/GAME_PLAN.md §7: "helmet hides the face, no voice. Starts in worn armour and a ragged
// cloak"), built as a PROCEDURAL POSE RIG: a tree of joints (three.js groups) holding the armour pieces, posed every
// frame from the data in knightPoses.js. New for Ashen Crown: Power Battlegrounds' blocky R6 body is not used.
// Later (§11) this becomes a skinned glTF model; the joint names here are the bone names it should keep.
//
// HIGH POLY (owner, phase 0.1: "it needs to be more high poly"): smooth-shaded pieces turned on a lathe from real
// armour profiles (helm, breastplate, vambraces, greaves), layered plates with rolled edges and rivets, fingered
// gauntlets, a bevelled blade and shield, and one finely divided cloak that bends as a single cloth.
//
// Units are metres; the knight stands ~1.85 m tall, faces +Z, and its feet are at y = 0.
import * as THREE from 'three';
import { toonRim } from '../world/toon.js';
import { JOINTS, samplePose, mixPoses } from './knightPoses.js';

// Ashen Gold (§3): the starting gear is worn and grey. Gold is earned later, so the only warm metal is a dull brass.
export const KNIGHT_COLORS = {
  steel: '#a7a19a', steelDark: '#79736d', mail: '#6c6763', leather: '#5b4537', cloth: '#4a3a40', clothDark: '#3a2e35',
  wood: '#6a5241', brass: '#a3864f', slit: '#1d1619', blade: '#c9c3b9',
};

const mats = new Map();
function mat(color, { rim = 0.2, rough = 0.75, metal = 0.15, side = THREE.FrontSide } = {}) {
  const key = `${color}|${rim}|${rough}|${metal}|${side}`;
  if (!mats.has(key)) {
    const m = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, side });
    mats.set(key, rim ? toonRim(m, rim) : m);
  }
  return mats.get(key);
}

function mesh(geometry, material, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1, s } = {}) {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  if (s) m.scale.setScalar(s); else m.scale.set(sx, sy, sz);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}
const joint = (name, parent, x = 0, y = 0, z = 0) => {
  const g = new THREE.Group();
  g.name = name;
  g.position.set(x, y, z);
  parent.add(g);
  return g;
};

// ---- geometry helpers (all smooth, finely divided) ----
const SEG = 40;   // round pieces go round in this many steps
/** Turn a profile [[radius, y], ...] (bottom to top) round the Y axis. */
const lathe = (profile, seg = SEG, phi = 0, len = Math.PI * 2) =>
  new THREE.LatheGeometry(smoothProfile(profile).map(([r, y]) => new THREE.Vector2(Math.max(r, 0.0001), y)), seg, phi, len);
// a few in-between points on a profile so lathed pieces are rounded, not stepped (Catmull-Rom through the points)
function smoothProfile(pts, n = 4) {
  if (pts.length < 3) return pts;
  const curve = new THREE.SplineCurve(pts.map(([r, y]) => new THREE.Vector2(r, y)));
  return curve.getPoints((pts.length - 1) * n).map((v) => [v.x, v.y]);
}
/** A limb segment hanging DOWN from its joint: a capsule of length len (top to bottom) and radius r. */
const capsule = (len, r) => new THREE.CapsuleGeometry(r, Math.max(len - 2 * r, 0.001), 10, 28).translate(0, -len / 2, 0);
const sphere = (r, ws = 32, hs = 20, theta = Math.PI) => new THREE.SphereGeometry(r, ws, hs, 0, Math.PI * 2, 0, theta);
const ring = (r, tube, arc = Math.PI * 2) => new THREE.TorusGeometry(r, tube, 10, 48, arc);
// rivets round an ellipse (rx × rz) at height y, every `step` radians between a0 and a1
function rivets(parent, material, { rx, rz, y = 0, a0 = 0, a1 = Math.PI * 2, n = 12, size = 0.008 }) {
  const g = rivetGeo(size);
  for (let i = 0; i < n; i++) {
    const a = a0 + ((a1 - a0) * (i + 0.5)) / n;
    parent.add(mesh(g, material, { x: Math.sin(a) * rx, y, z: Math.cos(a) * rz }));
  }
}
const rivetGeos = new Map();
const rivetGeo = (size) => rivetGeos.get(size) ?? rivetGeos.set(size, new THREE.SphereGeometry(size, 10, 8)).get(size);

// sizes (metres)
const HIPS_Y = 1.0;
const THIGH = 0.47, SHIN = 0.45;
const UPPER_ARM = 0.3, FOREARM = 0.28;
const PIVOT_Y = 0.62;   // the roll turns around this height (the middle of the tucked body)

export class KnightRig {
  constructor() {
    const C = KNIGHT_COLORS;
    const steel = mat(C.steel, { rough: 0.42, metal: 0.62, rim: 0.26 });
    const steelDark = mat(C.steelDark, { rough: 0.5, metal: 0.55, rim: 0.2 });
    const mail = mat(C.mail, { rough: 0.7, metal: 0.45, rim: 0.12 });
    const leather = mat(C.leather, { rough: 0.85, metal: 0 });
    const cloth = mat(C.cloth, { rough: 1, metal: 0, rim: 0.14, side: THREE.DoubleSide });
    const clothDark = mat(C.clothDark, { rough: 1, metal: 0, rim: 0.1 });
    const wood = mat(C.wood, { rough: 0.85, metal: 0 });
    const brass = mat(C.brass, { rough: 0.38, metal: 0.75, rim: 0.25 });
    const slit = mat(C.slit, { rough: 1, metal: 0, rim: 0 });
    const blade = mat(C.blade, { rough: 0.28, metal: 0.8, rim: 0.3 });
    // (open bands are seen from inside too)
    const steel2 = mat(C.steel, { rough: 0.42, metal: 0.62, rim: 0.26, side: THREE.DoubleSide });
    const steelDark2 = mat(C.steelDark, { rough: 0.5, metal: 0.55, rim: 0.2, side: THREE.DoubleSide });
    const M = { steel, steelDark, mail, leather, cloth, clothDark, wood, brass, slit, blade };

    this.root = new THREE.Group();         // placed in the world (position + heading)
    this.mover = joint('mover', this.root); // the clip's root motion: travel + drop
    this.pivot = joint('pivot', this.mover, 0, PIVOT_Y, 0); // the roll's turn
    const body = joint('body', this.pivot, 0, -PIVOT_Y, 0);
    const J = this.joints = {};

    // ---- hips: mail skirt, a belt, three rows of faulds, a torn tabard front and back ----
    J.hips = joint('hips', body, 0, HIPS_Y, 0);
    J.hips.add(mesh(lathe([[0.15, -0.12], [0.17, -0.04], [0.165, 0.06]]), mail, { sz: 0.74 }));
    J.hips.add(mesh(lathe([[0.172, 0.03], [0.176, 0.05], [0.172, 0.075]]), leather, { sz: 0.76 }));   // belt
    J.hips.add(mesh(new THREE.TorusGeometry(0.022, 0.006, 8, 24), brass, { y: 0.053, z: 0.133, sx: 1.3 }));  // its dull buckle
    for (let row = 0; row < 3; row++) {
      // each lame a slice of a cone, wider and lower than the one above it, open at the back
      const r = 0.18 + row * 0.014, y = 0.0 - row * 0.05;
      const lame = new THREE.CylinderGeometry(r, r + 0.018, 0.06, SEG, 2, true, -Math.PI * 0.62, Math.PI * 1.24);
      J.hips.add(mesh(lame, steel2, { y, sz: 0.8 }));
      J.hips.add(mesh(ring(r + 0.018, 0.004, Math.PI * 1.24), steelDark, { y: y - 0.03, rx: Math.PI / 2, rz: Math.PI / 2 - Math.PI * 0.62, sy: 0.8 }));
    }
    J.hips.add(mesh(clothPanel(0.22, 0.4, { teeth: 9, depth: 0.07, seed: 3, folds: 3, amp: 0.012 }), cloth, { y: -0.03, z: 0.165, rx: 0.06 }));
    J.hips.add(mesh(clothPanel(0.26, 0.36, { teeth: 10, depth: 0.07, seed: 9, folds: 4, amp: 0.012 }), cloth, { y: -0.03, z: -0.14, rx: -0.08, ry: Math.PI }));

    // ---- torso: a barrel breastplate (one lathe, front + back) with a centre ridge, a plackart, a rolled neck edge ----
    J.spine = joint('spine', J.hips, 0, 0.08, 0);
    J.spine.add(mesh(lathe([[0.155, -0.02], [0.165, 0.08], [0.17, 0.2]]), mail, { sz: 0.72 }));
    J.chest = joint('chest', J.spine, 0, 0.17, 0);
    J.chest.add(mesh(lathe([[0.168, -0.03], [0.19, 0.06], [0.225, 0.17], [0.235, 0.26], [0.2, 0.31], [0.13, 0.34]]), steel, { sz: 0.7 }));
    J.chest.add(mesh(lathe([[0.176, -0.06], [0.186, 0.02], [0.192, 0.09]], SEG, -Math.PI * 0.45, Math.PI * 0.9), steelDark, { sz: 0.74 }));  // plackart
    J.chest.add(mesh(ring(0.132, 0.011), steelDark, { y: 0.338, rx: Math.PI / 2, sy: 0.72 }));        // rolled neck edge
    J.chest.add(mesh(ring(0.192, 0.006, Math.PI * 0.9), steelDark, { y: 0.09, rx: Math.PI / 2, rz: Math.PI / 2 - Math.PI * 0.45, sy: 0.74 }));
    // the ridge down the middle: a thin tube along the plate's front curve
    const ridge = new THREE.CatmullRomCurve3([[0, -0.02, 0.122], [0, 0.08, 0.137], [0, 0.18, 0.158], [0, 0.27, 0.152], [0, 0.32, 0.12]].map((p) => new THREE.Vector3(...p)));
    J.chest.add(mesh(new THREE.TubeGeometry(ridge, 32, 0.007, 8), steel));
    rivets(J.chest, steelDark, { rx: 0.186, rz: 0.186 * 0.74, y: 0.075, a0: -Math.PI * 0.42, a1: Math.PI * 0.42, n: 9 });
    // a dent of wear on the plate (a shallow dark dimple)
    J.chest.add(mesh(sphere(0.025, 16, 10, Math.PI / 2), steelDark, { x: 0.09, y: 0.2, z: 0.146, rx: Math.PI / 2 + 0.3, ry: 0.5, sy: 0.25 }));
    // straps over the shoulders (they hold the cloak)
    for (const s of [-1, 1]) J.chest.add(mesh(new THREE.TorusGeometry(0.15, 0.012, 8, 32, Math.PI), leather, { x: s * 0.13, y: 0.24, ry: Math.PI / 2, sz: 1.5, sx: 0.6 }));

    J.neck = joint('neck', J.chest, 0, 0.33, 0);
    J.neck.add(mesh(lathe([[0.135, -0.01], [0.12, 0.03], [0.1, 0.07], [0.098, 0.09]]), steelDark));  // gorget
    J.neck.add(mesh(ring(0.122, 0.006), steel, { y: 0.03, rx: Math.PI / 2 }));
    J.head = joint('head', J.neck, 0, 0.07, 0.01);
    J.head.add(helmet(M));

    // ---- arms: layered pauldrons, mail, a couter with a fan, a lathed vambrace, a fingered gauntlet ----
    const arm = (side) => {
      const s = side === 'L' ? 1 : -1;
      const upper = J[`upperArm${side}`] = joint(`upperArm${side}`, J.chest, s * 0.255, 0.27, 0);
      // the pauldron sits on the shoulder (the chest), so a raised arm doesn't swing its lames out like a collar
      const pauldron = new THREE.Group();
      pauldron.position.set(s * 0.255, 0.27, 0);
      pauldron.rotation.z = -s * 0.32;
      J.chest.add(pauldron);
      // a domed cap, then three lames below it, each a band a little wider than the one above, with a rolled edge
      pauldron.add(mesh(sphere(0.122, 40, 16, Math.PI * 0.5), steel, { sy: 0.8 }));
      pauldron.add(mesh(ring(0.122, 0.0055), steelDark, { rx: Math.PI / 2 }));
      for (let i = 1; i <= 2; i++) {
        const top = 0.118 + i * 0.006, bot = top + 0.008, y = -0.022 - (i - 1) * 0.036;
        pauldron.add(mesh(new THREE.CylinderGeometry(top, bot, 0.042, 40, 1, true), i % 2 ? steelDark2 : steel2, { y, x: s * 0.004 * i }));
        pauldron.add(mesh(ring(bot, 0.0045), steelDark, { y: y - 0.021, x: s * 0.004 * i, rx: Math.PI / 2 }));
      }
      rivets(pauldron, brass, { rx: 0.105, rz: 0.105, y: 0.05, n: 6, a0: s > 0 ? 0.3 : Math.PI + 0.3, a1: s > 0 ? Math.PI - 0.3 : Math.PI * 2 - 0.3, size: 0.007 });
      upper.add(mesh(capsule(UPPER_ARM + 0.03, 0.06), mail));
      upper.add(mesh(lathe([[0.058, -0.26], [0.064, -0.17], [0.066, -0.1]]), steel));    // rerebrace
      const fore = J[`foreArm${side}`] = joint(`foreArm${side}`, upper, 0, -UPPER_ARM, 0);
      fore.add(
        mesh(sphere(0.066), steelDark),                                                          // couter
        mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.008, 32), steel, { x: s * 0.04, rz: Math.PI / 2 }), // its fan
        mesh(lathe([[0.046, -0.27], [0.05, -0.22], [0.06, -0.12], [0.058, -0.05]]), steel),   // vambrace
        mesh(ring(0.058, 0.005), steelDark, { y: -0.06, rx: Math.PI / 2 }),
        mesh(lathe([[0.059, -0.135], [0.061, -0.115]]), leather),                                // a strap
      );
      const hand = J[`hand${side}`] = joint(`hand${side}`, fore, 0, -FOREARM, 0);
      hand.add(gauntlet(M, s, side === 'R'));
      return hand;
    };
    const handL = arm('L'), handR = arm('R');

    // ---- legs: a cuisse over mail, a poleyn with a wing, a calf-shaped greave, a laminated sabaton ----
    const leg = (side) => {
      const s = side === 'L' ? 1 : -1;
      const thigh = J[`thigh${side}`] = joint(`thigh${side}`, J.hips, s * 0.1, -0.06, 0);
      thigh.add(mesh(capsule(THIGH + 0.02, 0.078), clothDark));
      thigh.add(mesh(lathe([[0.072, -0.42], [0.084, -0.3], [0.09, -0.15], [0.088, -0.06]], SEG, -Math.PI * 0.55, Math.PI * 1.1), steel)); // cuisse
      const shin = J[`shin${side}`] = joint(`shin${side}`, thigh, 0, -THIGH, 0);
      shin.add(
        mesh(sphere(0.074), steel, { z: 0.02, sz: 0.85 }),                                       // poleyn
        mesh(sphere(0.05, 24, 12, Math.PI / 2), steelDark, { x: s * 0.06, z: 0.01, rz: -s * Math.PI / 2, sy: 0.3 }), // its side wing
        mesh(lathe([[0.05, -0.43], [0.056, -0.36], [0.07, -0.2], [0.068, -0.08], [0.06, -0.03]]), steel), // greave (a calf)
        mesh(ring(0.052, 0.005), steelDark, { y: -0.41, rx: Math.PI / 2 }),
      );
      const foot = J[`foot${side}`] = joint(`foot${side}`, shin, 0, -SHIN, 0);
      foot.add(sabaton(M));
    };
    leg('L'); leg('R');

    // ---- the ragged cloak: one finely divided cloth from the shoulders, bent along three springs ----
    // a short mantle round the neck and over the shoulders (open at the front), the cloak hanging from its back
    J.chest.add(mesh(lathe([[0.3, 0.19], [0.26, 0.26], [0.19, 0.32], [0.13, 0.355]], 48, Math.PI * 0.32, Math.PI * 1.36), cloth, { sz: 0.78 }));
    const cloakAnchor = joint('cloak', J.chest, 0, 0.26, -0.2);
    this.cloakMesh = mesh(cloakGeometry(), cloth);
    this.cloakMesh.frustumCulled = false;
    cloakAnchor.add(this.cloakMesh);
    this.cloakRest = this.cloakMesh.geometry.attributes.position.array.slice();
    this.cloak = [0, 1, 2].map(() => ({ angle: 0.06, vel: 0 }));

    // ---- gear: a worn longsword in the right hand, a medium wooden heater shield on the left forearm ----
    this.sword = longsword(M);
    this.sword.position.set(0, -0.06, 0.01);
    handR.add(this.sword);
    this.shield = heaterShield(M);
    this.shield.position.set(0.125, -0.15, 0.0);
    // its face looks out of the forearm's outer side (+X), its top along the forearm's +Z (up, in the guard)
    this.shield.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(1, 0, 0)));
    J.foreArmL.add(this.shield);

    this.clip = null; this.time = 0;
    this.from = null; this.fade = 1;   // cross-fade from the last pose into a new clip
    this.current = null;
    this.prevZ = 0;
  }

  /** Start a clip (from knightPoses.CLIPS), cross-fading into it over `blend` seconds. */
  play(clip, blend = 0.2) {
    if (this.current) { this.from = this.current; this.fade = blend > 0 ? 0 : 1; this.blend = blend; }
    this.clip = clip; this.time = 0;
  }

  update(dt) {
    if (!this.clip) return;
    this.time += dt;
    let p = samplePose(this.clip, this.time);
    if (this.fade < 1) {
      this.fade = Math.min(1, this.fade + dt / this.blend);
      p = mixPoses(this.from, p, this.fade * this.fade * (3 - 2 * this.fade), true);
    }
    this.current = p;
    for (const name of JOINTS) {
      const [x, y, z] = p.joints[name];
      this.joints[name].rotation.set(x, y, z);
    }
    this.mover.position.set(0, 0, p.root.z);
    this.pivot.rotation.x = p.root.pitch;
    this._ground();
    if (p.root.lift) { this.mover.position.y += p.root.lift; this.root.updateMatrixWorld(true); }
    this._cloth(dt, p);
  }

  /** Show or hide the sword and the shield (what the knight is holding decides its moves: knightPoses MOVESETS). */
  setGear({ sword = this.sword.visible, shield = this.shield.visible } = {}) {
    this.sword.visible = sword;
    this.shield.visible = shield;
  }
  get gear() { return { sword: this.sword.visible, shield: this.shield.visible }; }

  /** Where a part is in the world now: 'tip' (of the sword), 'shield', 'fist' (right), 'foot' (right toe). */
  point(at, out = new THREE.Vector3()) {
    const [obj, local] = {
      tip: [this.sword, [0, -0.98, 0]], shield: [this.shield, [0, 0, 0.05]],
      fist: [this.joints.handR, [0, -0.09, 0]], foot: [this.joints.footR, [0, -0.06, 0.2]],
    }[at];
    return out.set(...local).applyMatrix4(obj.matrixWorld);
  }

  // keep the lowest point of the body on the ground (y = 0): planted feet in every pose, and the roll rolls ON the
  // ground instead of through it. Checks a handful of points on the armour's surface, each with a radius.
  _ground() {
    if (!this._probes) {
      const J = this.joints, v = (x, y, z) => new THREE.Vector3(x, y, z);
      this._probes = [
        [J.footL, v(0, -0.085, -0.04), 0], [J.footL, v(0, -0.085, 0.18), 0], [J.footR, v(0, -0.085, -0.04), 0], [J.footR, v(0, -0.085, 0.18), 0],
        [J.shinL, v(0, 0, 0.06), 0.02], [J.shinR, v(0, 0, 0.06), 0.02], [J.footL, v(0, 0.03, -0.07), 0.01], [J.footR, v(0, 0.03, -0.07), 0.01],
        [J.handL, v(0, -0.08, 0), 0.03], [J.handR, v(0, -0.08, 0), 0.03], [J.foreArmL, v(0, 0, 0), 0.066], [J.foreArmR, v(0, 0, 0), 0.066],
        [J.head, v(0, 0.32, 0), 0], [J.head, v(0, 0.16, -0.15), 0], [J.head, v(0, 0.16, 0.16), 0],
        [J.chest, v(0.33, 0.27, 0), 0], [J.chest, v(-0.33, 0.27, 0), 0], [J.chest, v(0, 0.2, -0.18), 0], [J.chest, v(0, 0.15, 0.17), 0],
        [J.hips, v(0, -0.05, -0.17), 0], [J.hips, v(0, -0.05, 0.17), 0],
        [this.shield, v(0, -0.36, 0), 0], [this.shield, v(0.25, 0.28, 0), 0], [this.shield, v(-0.25, 0.28, 0), 0],
      ];
      this._tmp = new THREE.Vector3();
    }
    this.root.updateMatrixWorld(true);
    let min = Infinity;
    for (const [obj, at, r] of this._probes) min = Math.min(min, this._tmp.copy(at).applyMatrix4(obj.matrixWorld).y - r);
    this.mover.position.y -= min - this.root.position.y;
    this.root.updateMatrixWorld(true);
  }

  // the cloak: three springs (top, middle, hem) each pull toward hanging straight down in the world, pushed back by
  // forward speed; the cloth is then bent along them, row by row
  _cloth(dt, p) {
    if (dt <= 0) return;
    const speed = (p.root.z - this.prevZ) / dt;
    this.prevZ = p.root.z;
    const chest = this.joints.chest;
    chest.updateWorldMatrix(true, false);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(chest.getWorldQuaternion(new THREE.Quaternion()));
    const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(this.root.getWorldQuaternion(new THREE.Quaternion()));
    // the chest's lean forward (+) / back (-), in the knight's own facing
    let lean = Math.atan2(up.dot(fwd), up.y);
    let sum = 0;
    const step = Math.min(dt, 1 / 30);
    this.cloak.forEach((c, i) => {
      const drag = Math.min(Math.abs(speed) * 0.22, 1.1) * Math.sign(speed);
      const target = THREE.MathUtils.clamp(-lean - sum + drag * (0.6 + i * 0.25) + 0.06 + i * 0.04, -0.2, 1.6 - i * 0.3);
      c.vel += ((target - c.angle) * 90 - c.vel * 11) * step;
      c.angle = THREE.MathUtils.clamp(c.angle + c.vel * step, -0.25, 1.9);
      sum += c.angle;
      lean = 0;
    });
    bendCloak(this.cloakMesh.geometry, this.cloakRest, this.cloak.map((c) => c.angle));
  }
}

// ---- pieces ----

// a great helm with no face: a lathed bucket with a domed crown, a raised ridge from brow to chin, one narrow eye
// slit under a brow plate, rows of breaths on the right cheek, a rivet band round the base
function helmet({ steel, steelDark, slit, brass }) {
  const g = new THREE.Group();
  g.add(mesh(lathe([[0.138, 0.0], [0.142, 0.06], [0.14, 0.15], [0.134, 0.22], [0.118, 0.27], [0.08, 0.305], [0.0, 0.318]], 48), steel, { sz: 1.08 }));
  g.add(mesh(ring(0.142, 0.008), steelDark, { y: 0.005, rx: Math.PI / 2, sy: 1.08 }));
  g.add(mesh(ring(0.137, 0.006), steelDark, { y: 0.215, rx: Math.PI / 2, sy: 1.08 }));
  // the ridge: a tube following the front curve
  const ridge = new THREE.CatmullRomCurve3([[0, 0.02, 0.152], [0, 0.12, 0.155], [0, 0.2, 0.147], [0, 0.26, 0.128], [0, 0.3, 0.09]].map((p) => new THREE.Vector3(...p)));
  g.add(mesh(new THREE.TubeGeometry(ridge, 40, 0.009, 10), steel));
  // the eye slit: a dark band set into the front, a brow plate over it
  g.add(mesh(lathe([[0.1405, 0.155], [0.1405, 0.178]], 48, -0.62, 1.24), slit, { sz: 1.08 }));
  g.add(mesh(lathe([[0.143, 0.176], [0.149, 0.188], [0.143, 0.2]], 48, -0.7, 1.4), steelDark, { sz: 1.08 }));
  // breaths: two columns of small slots on the right cheek
  const slot = new THREE.CapsuleGeometry(0.0032, 0.014, 4, 10);
  for (let c = 0; c < 2; c++) for (let r = 0; r < 5; r++) {
    const a = -0.5 - c * 0.17, y = 0.05 + r * 0.022;
    g.add(mesh(slot, slit, { x: Math.sin(a) * 0.1405, y, z: Math.cos(a) * 0.1405 * 1.08, rz: Math.PI / 2, ry: a }));
  }
  rivets(g, brass, { rx: 0.143, rz: 0.143 * 1.08, y: 0.03, n: 14, size: 0.0065 });
  return g;
}

// the gauntlet: a flared cuff, a plated back of the hand, four curled fingers and a thumb (closed round the grip on
// the sword hand, half-open on the shield hand)
function gauntlet({ steel, steelDark, leather }, s, grip) {
  const g = new THREE.Group();
  g.add(mesh(lathe([[0.05, -0.02], [0.056, 0.01], [0.07, 0.05]]), steel, { y: 0.0 }));       // cuff
  g.add(mesh(new THREE.CapsuleGeometry(0.035, 0.04, 8, 20), leather, { y: -0.045, sx: 1.1, sz: 0.8 }));  // palm
  g.add(mesh(sphere(0.042, 28, 14, Math.PI / 2), steel, { y: -0.04, z: 0.0, x: s * 0.012, rz: s * Math.PI / 2, sx: 0.55, sz: 0.95 }));  // back plate
  const curl = grip ? 1.5 : 0.7;
  for (let i = 0; i < 4; i++) {
    const f = new THREE.Group();
    f.position.set(-s * 0.005, -0.085, -0.03 + i * 0.02);
    f.rotation.x = 0;
    f.rotation.z = s * curl * 0.9;
    g.add(f);
    f.add(mesh(new THREE.CapsuleGeometry(0.0095, 0.022, 4, 12), steelDark, { y: -0.012 }));
    const tip = new THREE.Group();
    tip.position.y = -0.028; tip.rotation.z = s * curl * 0.8;
    f.add(tip);
    tip.add(mesh(new THREE.CapsuleGeometry(0.0088, 0.018, 4, 12), steelDark, { y: -0.01 }));
  }
  const thumb = new THREE.Group();
  thumb.position.set(-s * 0.02, -0.05, 0.04); thumb.rotation.set(grip ? -1.2 : -0.6, 0, s * 0.5);
  g.add(thumb);
  thumb.add(mesh(new THREE.CapsuleGeometry(0.01, 0.03, 4, 12), steelDark, { y: -0.02 }));
  return g;
}

// the sabaton: a rounded foot of overlapping lames ending in a toe cap
function sabaton({ steel, steelDark, leather }) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CapsuleGeometry(0.048, 0.14, 10, 24), leather, { y: -0.045, z: 0.04, rx: Math.PI / 2, sx: 1.05, sz: 0.7 }));
  for (let i = 0; i < 4; i++) {
    g.add(mesh(sphere(0.058 - i * 0.002, 32, 12, Math.PI / 2), i % 2 ? steelDark : steel, { y: -0.04, z: -0.02 + i * 0.045, sx: 0.95, sy: 0.75, sz: 0.7 }));
  }
  g.add(mesh(sphere(0.05, 32, 16), steel, { y: -0.05, z: 0.15, sx: 0.95, sy: 0.6, sz: 0.9 }));    // toe cap
  return g;
}

// the blade points along the hand's +Z (forward out of the fist when the arm hangs) until a pose turns the hand
function longsword({ steelDark, leather, brass, blade }) {
  const g = new THREE.Group();
  g.name = 'sword';
  const len = 0.9, w = 0.024;
  // blade: a tapering outline extruded with a deep bevel, so it has a ridge down the middle and two edges
  const outline = new THREE.Shape();
  outline.moveTo(-w, 0); outline.lineTo(w, 0);
  outline.bezierCurveTo(w, -len * 0.6, w * 0.8, -len * 0.85, 0, -len);
  outline.bezierCurveTo(-w * 0.8, -len * 0.85, -w, -len * 0.6, -w, 0);
  const bladeGeo = new THREE.ExtrudeGeometry(outline, { depth: 0.001, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.012, bevelSegments: 3, curveSegments: 24 });
  bladeGeo.translate(0, 0, -0.0005);
  bladeGeo.computeVertexNormals();
  g.add(mesh(bladeGeo, blade, { y: -0.1 }));
  // the fuller: a dark groove down the first two thirds
  g.add(mesh(new THREE.CapsuleGeometry(0.0045, len * 0.55, 4, 12), steelDark, { y: -0.12 - len * 0.3, z: 0.0, sz: 1.6 }));
  // crossguard: a slightly curved bar with rounded ends
  const guard = new THREE.CatmullRomCurve3([[-0.11, -0.075, 0], [-0.05, -0.09, 0], [0.05, -0.09, 0], [0.11, -0.075, 0]].map((p) => new THREE.Vector3(...p)));
  g.add(mesh(new THREE.TubeGeometry(guard, 32, 0.011, 12), steelDark));
  for (const x of [-0.11, 0.11]) g.add(mesh(sphere(0.016, 16, 12), steelDark, { x, y: -0.075 }));
  g.add(mesh(lathe([[0.022, -0.1], [0.026, -0.09], [0.02, -0.08]]), steelDark, { sz: 0.6 }));     // the guard's block
  // grip: wrapped leather (a ridged lathe), a wheel pommel
  const wrap = [];
  for (let i = 0; i <= 12; i++) wrap.push([0.016 + (i % 2) * 0.002, -0.07 + i * 0.013]);
  g.add(mesh(new THREE.LatheGeometry(wrap.map(([r, y]) => new THREE.Vector2(r, y)), 24), leather));
  g.add(mesh(new THREE.TorusGeometry(0.022, 0.011, 12, 32), brass, { y: 0.11, ry: Math.PI / 2 }));
  g.add(mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.03, 20), brass, { y: 0.11, rx: Math.PI / 2, rz: Math.PI / 2 }));
  g.rotation.x = Math.PI / 2;
  return g;
}

// a heater shield, gently curved: bevelled planks of wood, an iron rim, a strip of faded cloth (no crest), a boss
function heaterShield({ wood, steelDark, cloth, brass, slit }) {
  const w = 0.25, top = 0.28, bottom = -0.36;
  const outline = (k = 1, inset = 0) => {
    const s = new THREE.Shape();
    s.moveTo(-w * k, top * k - inset); s.lineTo(w * k, top * k - inset);
    s.bezierCurveTo(w * k, 0.0, w * k * 0.7, bottom * k * 0.7, 0, bottom * k + inset);
    s.bezierCurveTo(-w * k * 0.7, bottom * k * 0.7, -w * k, 0.0, -w * k, top * k - inset);
    return s;
  };
  const g = new THREE.Group();
  g.name = 'shield';
  const face = new THREE.ExtrudeGeometry(outline(), { depth: 0.022, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 3, curveSegments: 40, steps: 1 });
  face.translate(0, 0, -0.028);
  const rimShape = outline(1.0);
  rimShape.holes.push(outline(0.9, 0.0));
  const rim = new THREE.ExtrudeGeometry(rimShape, { depth: 0.006, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.003, bevelSegments: 3, curveSegments: 40 });
  const parts = [mesh(face, wood), mesh(rim, steelDark, { z: 0.001 })];
  // plank seams (thin dark grooves)
  for (const x of [-0.125, 0, 0.125]) parts.push(mesh(new THREE.BoxGeometry(0.004, 0.52, 0.004), slit, { x, y: -0.02, z: 0.0 }));
  parts.push(mesh(new THREE.BoxGeometry(0.1, 0.58, 0.006), cloth, { y: -0.03, z: 0.002 }));
  parts.push(mesh(lathe([[0.06, 0.0], [0.055, 0.012], [0.035, 0.03], [0.0, 0.036]], 40), steelDark, { z: 0.004, rx: Math.PI / 2 }));  // boss
  // rivets round the rim
  const pts = outline(0.95).getSpacedPoints(26);
  for (const p of pts.slice(0, -1)) parts.push(mesh(rivetGeo(0.0075), brass, { x: p.x, y: p.y, z: 0.009 }));
  g.add(...parts);
  // bend everything round a vertical axis so the shield curves toward the arm
  for (const m of parts) bendZ(m, 0.9);
  return g;
}
// curve a part's geometry (in the shield's frame) by moving it back with x²
function bendZ(m, k) {
  const geo = m.geometry.clone();
  geo.applyMatrix4(m.matrix.compose(m.position, m.quaternion, m.scale));
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) p.setZ(i, p.getZ(i) - p.getX(i) * p.getX(i) * k);
  geo.computeVertexNormals();
  m.geometry = geo;
  m.position.set(0, 0, 0); m.rotation.set(0, 0, 0); m.scale.set(1, 1, 1);
}

// a hanging cloth panel (width × len) from y = 0 with soft vertical folds and a torn hem
function clothPanel(width, len, { teeth = 8, depth = 0.06, seed = 1, folds = 3, amp = 0.01 } = {}) {
  const geo = new THREE.PlaneGeometry(width, len, 24, 16).translate(0, -len / 2, 0);
  const tear = tearProfile(25, teeth, depth, seed);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), u = (x / width + 0.5), d = -y / len;
    const col = Math.round(u * 24);
    p.setY(i, Math.max(y, -len + tear[col]));
    p.setZ(i, Math.sin(u * Math.PI * 2 * folds) * amp * d + (x / (width / 2)) ** 2 * 0.03);
  }
  geo.computeVertexNormals();
  return geo;
}
// how far up the hem is torn at each of n columns: `teeth` ragged points of up to `depth` (seeded)
function tearProfile(n, teeth, depth, seed) {
  let r = seed;
  const rnd = () => ((r = (r * 16807) % 2147483647) / 2147483647);
  const peaks = Array.from({ length: teeth + 1 }, () => depth * (0.2 + rnd() * 0.8));
  return Array.from({ length: n }, (_, i) => {
    const t = (i / (n - 1)) * teeth, k = Math.floor(t), f = t - k;
    // sharp teeth: deep at the gaps between points, shallow at the points
    const v = THREE.MathUtils.lerp(peaks[k], peaks[Math.min(k + 1, teeth)], f);
    return v * (1 - Math.sin(f * Math.PI) * 0.85);
  });
}

// the cloak at rest: 1.0 m of cloth, 0.44 m wide at the shoulders flaring to 0.64 at the hem, deep folds, torn hem
const CLOAK_LEN = 1.0, CLOAK_COLS = 28, CLOAK_ROWS = 40;
function cloakGeometry() {
  const geo = new THREE.PlaneGeometry(1, CLOAK_LEN, CLOAK_COLS, CLOAK_ROWS).translate(0, -CLOAK_LEN / 2, 0);
  const tear = tearProfile(CLOAK_COLS + 1, 13, 0.16, 17);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const u = p.getX(i) + 0.5, col = Math.round(u * CLOAK_COLS);
    // store u in x and the distance down in y; bendCloak lays it out
    p.setX(i, u);
    p.setY(i, Math.min(-p.getY(i), CLOAK_LEN - tear[col]));
    p.setZ(i, 0);
  }
  return geo;
}
// lay the cloak along the three spring angles (radians: + swings the cloth back): each row's centre walks down a curve
// whose angle eases from one spring to the next; the folds and the curl round the shoulders are added across it
function bendCloak(geo, rest, angles) {
  const p = geo.attributes.position, a = p.array, n = 64;
  // the centre curve, sampled every CLOAK_LEN / n
  const cy = new Float32Array(n + 1), cz = new Float32Array(n + 1), ca = new Float32Array(n + 1);
  // the angle is cumulative (each spring adds to the one above it): A0 at the shoulders, A1 halfway, A2 at the hem
  const A0 = angles[0], A1 = A0 + angles[1], A2 = A1 + angles[2];
  for (let k = 0; k <= n; k++) {
    const t = k / n;
    ca[k] = t < 0.5 ? A0 + (A1 - A0) * (t / 0.5) : A1 + (A2 - A1) * ((t - 0.5) / 0.5);
  }
  for (let k = 1; k <= n; k++) {
    const h = CLOAK_LEN / n, ang = (ca[k] + ca[k - 1]) / 2;
    cy[k] = cy[k - 1] - Math.cos(ang) * h;
    cz[k] = cz[k - 1] - Math.sin(ang) * h;
  }
  for (let i = 0; i < p.count; i++) {
    const u = rest[i * 3], d = rest[i * 3 + 1];
    const t = Math.min(d / CLOAK_LEN, 1) * n, k = Math.min(Math.floor(t), n - 1), f = t - k;
    const y = cy[k] + (cy[k + 1] - cy[k]) * f, z = cz[k] + (cz[k + 1] - cz[k]) * f, ang = ca[k];
    const dd = d / CLOAK_LEN;
    const width = 0.5 + 0.18 * dd, x = (u - 0.5) * width;
    // folds deepen toward the hem; the sides curl forward round the body near the top
    const fold = (Math.sin(u * Math.PI * 2 * 4.5 + 0.6) * 0.026 + Math.sin(u * Math.PI * 2 * 1.5) * 0.012) * Math.min(1, dd * 1.6);
    const curl = ((u - 0.5) * 2) ** 2 * (0.12 - 0.07 * dd);
    const off = fold + curl;   // along the cloth's normal (toward the body = +)
    a[i * 3] = x;
    a[i * 3 + 1] = y + Math.sin(ang) * off;
    a[i * 3 + 2] = z + Math.cos(ang) * off;
  }
  p.needsUpdate = true;
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
}
