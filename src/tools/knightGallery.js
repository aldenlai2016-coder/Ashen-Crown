// Dev-only: the KNIGHT gallery (/knight.html): the risen knight on a patch of ash under a low sun, looping one move or
// every move side by side, with the hit effects. What it holds decides its moves: no sword turns the light / heavy
// attack into a punch / kick and greys out the sword moves; no shield greys out bash, guard and parry.
// Keys: 1–9, 0 and - for the moves, Q sword, E shield, S slow motion. Gamepad: bumpers / D-pad step through the moves,
// X sword, B shield, Y slow motion. For tuning the poses in src/entities/knightPoses.js.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { installToonShading, ToonPost } from '../world/toon.js';
import { KnightRig } from '../entities/knightRig.js';
import { CLIPS, MOVESETS } from '../entities/knightPoses.js';
import { KnightFx } from '../entities/knightFx.js';

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

// ---- moves + gear ----
// a move is a clip, or 'light' / 'heavy' (whichever clip the weapon in hand gives: MOVESETS)
const MOVES = [
  ['idle', 'Idle'], ['walk', 'Walk'], ['roll', 'Roll'], ['light', 'Light attack'], ['heavy', 'Heavy attack'],
  ['smash', 'Smash'], ['thrust', 'Thrust'], ['bash', 'Shield bash'], ['block', 'Guard'], ['parry', 'Parry'], ['all', 'All moves'],
];
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-'];
const gear = { sword: true, shield: true };
const clipOf = (move) => (move === 'light' || move === 'heavy') ? MOVESETS[gear.sword ? 'sword' : 'unarmed'][move] : move;
const canDo = (move) => move === 'all' || (CLIPS[clipOf(move)].needs ?? []).every((g) => gear[g]);
let mode = 'idle', slow = false;

const fx = new KnightFx(scene);
const knights = [];
const knight = (i) => {
  while (knights.length <= i) { const k = new KnightRig(); scene.add(k.root); k.lastT = 0; knights.push(k); }
  return knights[i];
};

function layout() {
  if (!canDo(mode)) mode = 'idle';
  const lineup = mode === 'all';
  const list = lineup ? MOVES.filter(([m]) => m !== 'all' && canDo(m)).map(([m]) => m) : [mode];
  const cols = Math.min(list.length, 5), rows = Math.ceil(list.length / cols);
  list.forEach((m, i) => {
    const k = knight(i), clip = CLIPS[clipOf(m)];
    const c = i % cols, r = Math.floor(i / cols);
    // travelling moves start further back so they end in view
    const back = (clip.keys.at(-1).root.z ?? 0) * 0.5;
    k.root.visible = true;
    k.root.position.set(lineup ? (c - (cols - 1) / 2) * 2.1 : 0, 0, (lineup ? (r - (rows - 1) / 2) * -3.2 : 0) - back);
    k.setGear(gear);
    if (k.clip !== clip) { k.play(clip, k.current ? 0.25 : 0); k.lastT = 0; }
  });
  for (let i = list.length; i < knights.length; i++) knights[i].root.visible = false;
  if (lineup) { camera.position.set(3.2, 4.2, 12.5); controls.target.set(0, 0.9, -1.2); }
  else if (!camera.userData.placed) { camera.position.set(2.6, 1.8, 4.6); controls.target.set(0, 1.0, 0); }
  camera.userData.placed = !lineup;
  for (const b of buttons.children) {
    b.classList.toggle('on', b.dataset.mode === mode);
    b.disabled = !canDo(b.dataset.mode);
    const m = b.dataset.mode;
    if (m === 'light' || m === 'heavy') b.lastChild.textContent = CLIPS[clipOf(m)].label;
  }
  swordBtn.classList.toggle('on', gear.sword);
  shieldBtn.classList.toggle('on', gear.shield);
}

// ---- UI ----
const buttons = document.getElementById('clips');
MOVES.forEach(([m, label], i) => {
  const b = document.createElement('button');
  b.dataset.mode = m;
  b.innerHTML = `<span class="key">${KEYS[i]}</span><span>${label}</span>`;
  b.onclick = () => { mode = m; layout(); };
  buttons.append(b);
});
const swordBtn = document.getElementById('sword'), shieldBtn = document.getElementById('shield');
const toggle = (g) => { gear[g] = !gear[g]; for (const k of knights) k.clip = null; layout(); };
swordBtn.onclick = () => toggle('sword');
shieldBtn.onclick = () => toggle('shield');
const slowBtn = document.getElementById('slow');
const setSlow = (v) => { slow = v; slowBtn.classList.toggle('on', slow); };
slowBtn.onclick = () => setSlow(!slow);
const pick = (m) => { if (canDo(m)) { mode = m; layout(); } };
addEventListener('keydown', (e) => {
  const i = KEYS.indexOf(e.key);
  if (i >= 0) pick(MOVES[i][0]);
  const k = e.key.toLowerCase();
  if (k === 's') setSlow(!slow);
  if (k === 'q') toggle('sword');
  if (k === 'e') toggle('shield');
});

// gamepad: first-class from M0 (§15 rule 3). Bumpers / D-pad left-right step through the moves, X sword, B shield,
// Y slow motion.
const padWas = {};
function pollPad() {
  for (const pad of navigator.getGamepads?.() ?? []) {
    if (!pad) continue;
    const pressed = (i) => {
      const down = !!pad.buttons[i]?.pressed, key = `${pad.index}:${i}`, edge = down && !padWas[key];
      padWas[key] = down;
      return edge;
    };
    const step = (d) => {
      let i = MOVES.findIndex(([m]) => m === mode);
      do i = (i + d + MOVES.length) % MOVES.length; while (!canDo(MOVES[i][0]));
      pick(MOVES[i][0]);
    };
    if (pressed(5) || pressed(15)) step(1);
    if (pressed(4) || pressed(14)) step(-1);
    if (pressed(2)) toggle('sword');
    if (pressed(1)) toggle('shield');
    if (pressed(3)) setSlow(!slow);
  }
}

// a clip's events fire as its time passes them (each loop)
const at = new THREE.Vector3();
function fireEvents(k) {
  const clip = k.clip, d = clip.duration;
  const from = k.lastT % d, to = k.time % d;
  k.lastT = k.time;
  for (const ev of clip.events ?? []) {
    const crossed = from <= to ? (ev.t > from && ev.t <= to) : (ev.t > from || ev.t <= to);
    if (!crossed) continue;
    k.point(ev.at, at);
    if (ev.type === 'impact') fx.impact(at, ev.big);
    else if (ev.type === 'clang') fx.clang(at, ev.small);
    else if (ev.type === 'parry') fx.parry(at);
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
if (params.has('gear')) { const g = params.get('gear'); gear.sword = g.includes('sword'); gear.shield = g.includes('shield'); }
if (params.has('nohud')) for (const el of document.querySelectorAll('.panel')) el.style.display = 'none';
layout();
// ?cam=x,y,z,tx,ty,tz places the camera (for screenshots)
if (params.has('cam')) { const c = params.get('cam').split(',').map(Number); camera.position.set(c[0], c[1], c[2]); controls.target.set(c[3], c[4], c[5]); }

// ?t=0.5 freezes every clip at that time (for screenshots of one pose)
const freeze = params.has('t') ? Number(params.get('t')) : null;
const clock = new THREE.Clock();
const shake = new THREE.Vector3();
function frame() {
  const dt = Math.min(clock.getDelta(), 0.05) * (slow ? 0.2 : 1);
  pollPad();
  for (const k of knights) {
    if (!k.root.visible) continue;
    if (freeze != null) { k.fade = 1; k.time = freeze; k.update(0); for (let i = 0; i < 40; i++) k._cloth(1 / 60, k.current); }
    else { k.update(dt); fireEvents(k); }
  }
  fx.update(dt);
  const p = ash.geometry.attributes.position;
  for (let i = 0; i < ASH; i++) {
    let y = p.getY(i) - dt * (0.12 + (i % 5) * 0.03);
    if (y < 0) y += 7;
    p.setY(i, y);
    p.setX(i, p.getX(i) + Math.sin(y * 1.3 + i) * dt * 0.08 + dt * 0.1);
    if (p.getX(i) > 12) p.setX(i, -12);
  }
  p.needsUpdate = true;
  // camera shake from the hit effects: added after the orbit controls place the camera, taken off before they next do
  camera.position.sub(shake);
  controls.update();
  const tr = fx.trauma * fx.trauma * 0.06, time = clock.elapsedTime;
  shake.set(Math.sin(time * 61) * tr, Math.sin(time * 47 + 1) * tr, Math.sin(time * 53 + 2) * tr);
  camera.position.add(shake);
  if (post) post.render(scene, camera); else renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
frame();
window.__gallery = { knights, CLIPS, fx, gear, setMode: (m) => { mode = m; layout(); } };
