// Dev-only: the KNIGHT gallery (/knight.html): the risen knight on a patch of ash under a low sun, looping one clip
// (idle, walk, light attack, roll) or all four side by side. Slow motion on S (or Y on a gamepad), clips on 1–5
// (or the bumpers / D-pad). For tuning the poses in src/entities/knightPoses.js.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { installToonShading, ToonPost } from '../world/toon.js';
import { KnightRig } from '../entities/knightRig.js';
import { CLIPS } from '../entities/knightPoses.js';

// Ashen Gold (docs/GAME_PLAN.md §3)
const PALETTE = { ash: '#8a8580', gold: '#e8b54a', haze: '#e9dcc4', shadow: '#3a2e35', ember: '#c4492c', teal: '#5f8a86' };

installToonShading();
const renderer = new THREE.WebGLRenderer({ antialias: false, depth: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById('view').append(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(PALETTE.haze);
scene.fog = new THREE.Fog(PALETTE.haze, 9, 42);
// something for the steel to reflect (a soft studio room, dimmed): without it high-poly metal reads as flat grey
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.22;
const camera = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.1, 200);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI * 0.49;
controls.minDistance = 1.5; controls.maxDistance = 16;
let post = ToonPost.create(renderer, { maxSamples: 4, bloomPasses: 2 });

// the low, always-late-afternoon sun: warm, long shadows; shade is brown-violet, never black
scene.add(new THREE.HemisphereLight('#efe8dc', PALETTE.shadow, 1.1));
const sun = new THREE.DirectionalLight('#ffe2b8', 2.3);
sun.position.set(-6, 4.2, 5);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7, near: 0.5, far: 30 });
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
scene.add(sun, sun.target);

// the ground: ash with darker and lighter patches (vertex colours), and a few stones
const ground = new THREE.CircleGeometry(160, 96, 0, Math.PI * 2).rotateX(-Math.PI / 2);
{
  const pos = ground.attributes.position, col = new Float32Array(pos.count * 3), c = new THREE.Color(), base = new THREE.Color(PALETTE.ash);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const n = Math.sin(x * 0.9 + Math.cos(z * 0.7) * 2) * 0.5 + Math.sin(z * 1.7 - x * 0.4) * 0.3;
    c.copy(base).offsetHSL(0, 0, n * 0.04);
    col.set([c.r, c.g, c.b], i * 3);
  }
  ground.setAttribute('color', new THREE.BufferAttribute(col, 3));
}
const floor = new THREE.Mesh(ground, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }));
floor.receiveShadow = true;
scene.add(floor);
const stoneMat = new THREE.MeshStandardMaterial({ color: '#7b766f', roughness: 1 });
// a smooth, lumpy stone: a finely divided sphere pushed in and out by a few sine waves
function stone(s, seed) {
  const g = new THREE.IcosahedronGeometry(s, 4), p = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = v.clone().normalize();
    const k = 1 + 0.18 * Math.sin(n.x * 3.1 + seed) * Math.cos(n.z * 2.7 + seed * 2) + 0.08 * Math.sin(n.y * 7 + seed * 3);
    v.multiplyScalar(k); v.y *= 0.7;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}
for (let i = 0; i < 26; i++) {
  const a = i * 2.4, r = 3.5 + ((i * 37) % 17);
  const s = 0.15 + ((i * 13) % 7) * 0.08;
  const m = new THREE.Mesh(stone(s, i), stoneMat);
  m.position.set(Math.cos(a) * r, s * 0.35, Math.sin(a) * r - 2);
  m.rotation.set(i, i * 2, 0);
  m.castShadow = m.receiveShadow = true;
  scene.add(m);
}

// ash always drifting
const ASH = 700;
const ashGeo = new THREE.BufferGeometry();
const ashPos = new Float32Array(ASH * 3);
for (let i = 0; i < ASH; i++) ashPos.set([(Math.random() - 0.5) * 24, Math.random() * 7, (Math.random() - 0.5) * 24], i * 3);
ashGeo.setAttribute('position', new THREE.BufferAttribute(ashPos, 3));
const ash = new THREE.Points(ashGeo, new THREE.PointsMaterial({ color: '#d9d2c6', size: 0.035, transparent: true, opacity: 0.8, depthWrite: false }));
scene.add(ash);

// ---- the knights ----
const ORDER = ['idle', 'walk', 'attack', 'roll'];
const knights = ORDER.map(() => { const k = new KnightRig(); scene.add(k.root); return k; });
let mode = 'idle', slow = false;

function layout() {
  const lineup = mode === 'all';
  knights.forEach((k, i) => {
    k.root.visible = lineup || i === 0;
    k.root.position.set(lineup ? (i - 1.5) * 1.9 : 0, 0, lineup && ORDER[i] === 'roll' ? -1.6 : (!lineup && mode === 'roll') ? -1.2 : 0);
    k.play(CLIPS[lineup ? ORDER[i] : mode], k.current ? 0.25 : 0);
  });
  if (lineup) { camera.position.set(2.6, 2.1, 8.8); controls.target.set(0, 0.95, 0); }
  else if (!camera.userData.placed) { camera.position.set(2.4, 1.7, 4.2); controls.target.set(0, 1.0, 0); }
  camera.userData.placed = !lineup;
  for (const b of buttons.children) b.classList.toggle('on', b.dataset.mode === mode);
}

// ---- UI ----
const buttons = document.getElementById('clips');
const MODES = [...ORDER.map((m) => [m, CLIPS[m].label]), ['all', 'All four']];
MODES.forEach(([m, label], i) => {
  const b = document.createElement('button');
  b.dataset.mode = m;
  b.innerHTML = `<span class="key">${i + 1}</span>${label}`;
  b.onclick = () => { mode = m; layout(); };
  buttons.append(b);
});
const slowBtn = document.getElementById('slow');
const setSlow = (v) => { slow = v; slowBtn.classList.toggle('on', slow); };
slowBtn.onclick = () => setSlow(!slow);
addEventListener('keydown', (e) => {
  const n = Number(e.key);
  if (n >= 1 && n <= MODES.length) { mode = MODES[n - 1][0]; layout(); }
  if (e.key === 's' || e.key === 'S') setSlow(!slow);
});

// gamepad: first-class from M0 (§15 rule 3). Bumpers / D-pad left-right step through the clips, Y = slow motion.
const padWas = {};
function pollPad() {
  for (const pad of navigator.getGamepads?.() ?? []) {
    if (!pad) continue;
    const pressed = (i) => {
      const down = !!pad.buttons[i]?.pressed, key = `${pad.index}:${i}`, edge = down && !padWas[key];
      padWas[key] = down;
      return edge;
    };
    const step = (d) => { const i = MODES.findIndex(([m]) => m === mode); mode = MODES[(i + d + MODES.length) % MODES.length][0]; layout(); };
    if (pressed(5) || pressed(15)) step(1);
    if (pressed(4) || pressed(14)) step(-1);
    if (pressed(3)) setSlow(!slow);
  }
}

addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  post?.resize();
});

const params = new URLSearchParams(location.search);
if (params.has('clip')) mode = params.get('clip');
layout();
// ?cam=x,y,z,tx,ty,tz places the camera (for screenshots)
if (params.has('cam')) { const c = params.get('cam').split(',').map(Number); camera.position.set(c[0], c[1], c[2]); controls.target.set(c[3], c[4], c[5]); }

// ?t=0.5 freezes every clip at that time (for screenshots of one pose)
const freeze = params.has('t') ? Number(params.get('t')) : null;
const clock = new THREE.Clock();
function frame() {
  const dt = Math.min(clock.getDelta(), 0.05) * (slow ? 0.2 : 1);
  pollPad();
  for (const k of knights) {
    if (!k.root.visible) continue;
    if (freeze != null) { k.fade = 1; k.time = freeze; k.update(0); for (let i = 0; i < 40; i++) k._cloth(1 / 60, k.current); }
    else k.update(dt);
  }
  const p = ash.geometry.attributes.position;
  for (let i = 0; i < ASH; i++) {
    let y = p.getY(i) - dt * (0.12 + (i % 5) * 0.03);
    if (y < 0) y += 7;
    p.setY(i, y);
    p.setX(i, p.getX(i) + Math.sin(y * 1.3 + i) * dt * 0.08 + dt * 0.1);
    if (p.getX(i) > 12) p.setX(i, -12);
  }
  p.needsUpdate = true;
  controls.update();
  if (post) post.render(scene, camera); else renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
frame();
window.__gallery = { knights, CLIPS, setMode: (m) => { mode = m; layout(); } };
