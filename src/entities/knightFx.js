// Hit feel for the knight's moves (docs/GAME_PLAN.md §5: "hit-stop, camera shake, impact flashes, sparks on a guard"):
// a dust ring + burst of ash where a weapon hits the ground, sparks where steel meets steel, a golden flash on a parry.
// Particles live in two pools (sparks glow, added on top; dust is plain, drawn over), each one draw call.
import * as THREE from 'three';

const vert = /* glsl */`
  attribute vec3 color;
  attribute float alpha;
  attribute float size;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vColor = color; vAlpha = alpha;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = size * 300.0 / -mv.z;
    gl_Position = projectionMatrix * mv;
  }`;
const frag = /* glsl */`
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec2 d = gl_PointCoord - 0.5;
    float r = dot(d, d) * 4.0;
    if (r > 1.0) discard;
    gl_FragColor = vec4(vColor, vAlpha * (1.0 - r));
  }`;

class Pool {
  constructor(scene, n, additive) {
    this.n = n; this.next = 0;
    this.pos = new Float32Array(n * 3); this.vel = new Float32Array(n * 3);
    this.col = new Float32Array(n * 3); this.alpha = new Float32Array(n); this.size = new Float32Array(n);
    this.life = new Float32Array(n); this.max = new Float32Array(n); this.drag = new Float32Array(n); this.grav = new Float32Array(n);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    g.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1));
    g.setAttribute('size', new THREE.BufferAttribute(this.size, 1));
    this.points = new THREE.Points(g, new THREE.ShaderMaterial({
      vertexShader: vert, fragmentShader: frag, transparent: true, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    }));
    this.points.frustumCulled = false;
    scene.add(this.points);
  }

  spawn(p, v, color, size, life, { drag = 2, grav = 0 } = {}) {
    const i = this.next; this.next = (i + 1) % this.n;
    this.pos.set([p.x, p.y, p.z], i * 3); this.vel.set([v.x, v.y, v.z], i * 3);
    this.col.set([color.r, color.g, color.b], i * 3);
    this.size[i] = size; this.life[i] = life; this.max[i] = life; this.drag[i] = drag; this.grav[i] = grav;
  }

  update(dt) {
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) { this.alpha[i] = 0; continue; }
      this.life[i] -= dt;
      const k = Math.exp(-this.drag[i] * dt);
      this.vel[i * 3] *= k; this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * k - this.grav[i] * dt; this.vel[i * 3 + 2] *= k;
      for (let a = 0; a < 3; a++) this.pos[i * 3 + a] += this.vel[i * 3 + a] * dt;
      if (this.pos[i * 3 + 1] < 0.01) { this.pos[i * 3 + 1] = 0.01; this.vel[i * 3 + 1] *= -0.3; }
      const f = Math.max(this.life[i] / this.max[i], 0);
      this.alpha[i] = f * f;
    }
    const a = this.points.geometry.attributes;
    a.position.needsUpdate = a.alpha.needsUpdate = a.color.needsUpdate = a.size.needsUpdate = true;
  }
}

const GOLD = new THREE.Color('#e8b54a'), EMBER = new THREE.Color('#c4492c'), WHITE = new THREE.Color('#fff4dc');
const DUST = new THREE.Color('#b8afa3'), DUST_DARK = new THREE.Color('#8a8580');

export class KnightFx {
  constructor(scene) {
    this.scene = scene;
    this.sparks = new Pool(scene, 600, true);
    this.dust = new Pool(scene, 900, false);
    this.rings = [];
    this.trauma = 0;   // camera shake, 0..1 (read by the gallery's camera)
  }

  // a weapon hits the ground: a flat ring of dust running out, ash thrown up and outward, a shake
  impact(p, big = false) {
    const v = new THREE.Vector3(), c = new THREE.Color();
    const n = big ? 160 : 70, speed = big ? 4.2 : 2.6;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = speed * (0.4 + Math.random() * 0.8);
      v.set(Math.cos(a) * s, Math.random() * (big ? 2.6 : 1.6), Math.sin(a) * s);
      c.copy(DUST).lerp(DUST_DARK, Math.random());
      this.dust.spawn({ x: p.x, y: 0.05, z: p.z }, v, c, 0.12 + Math.random() * (big ? 0.22 : 0.14), 0.8 + Math.random() * 0.9, { drag: 2.6, grav: 1.2 });
    }
    for (let i = 0; i < (big ? 40 : 14); i++) {
      v.set((Math.random() - 0.5) * 5, 1 + Math.random() * 3, (Math.random() - 0.5) * 5);
      this.sparks.spawn(p, v, Math.random() < 0.5 ? EMBER : GOLD, 0.03, 0.35 + Math.random() * 0.3, { drag: 1.5, grav: 7 });
    }
    this.ring(p, big ? 2.6 : 1.4, 0.5, '#d9cfc0', 0.85);
    this.trauma = Math.min(1, this.trauma + (big ? 0.9 : 0.55));
  }

  // steel on steel: a spray of sparks, a white-gold flash
  clang(p, small = false) {
    const v = new THREE.Vector3();
    for (let i = 0; i < (small ? 10 : 34); i++) {
      v.set((Math.random() - 0.5) * 6, Math.random() * 4, (Math.random() - 0.3) * 6);
      this.sparks.spawn(p, v, Math.random() < 0.7 ? GOLD : WHITE, small ? 0.03 : 0.04, 0.25 + Math.random() * 0.3, { drag: 2, grav: 8 });
    }
    this.sparks.spawn(p, new THREE.Vector3(), WHITE, small ? 0.3 : 0.6, 0.12);
    this.trauma = Math.min(1, this.trauma + (small ? 0.15 : 0.35));
  }

  // a parry: a ring of gold standing up in front of the shield and a slow shower of golden motes
  parry(p) {
    const v = new THREE.Vector3();
    for (let i = 0; i < 46; i++) {
      v.set((Math.random() - 0.5) * 3, Math.random() * 2.5, (Math.random() - 0.5) * 3);
      this.sparks.spawn(p, v, Math.random() < 0.8 ? GOLD : WHITE, 0.035, 0.5 + Math.random() * 0.5, { drag: 3, grav: 1.5 });
    }
    this.sparks.spawn(p, new THREE.Vector3(), GOLD, 1.0, 0.18);
    this.ring(p, 0.9, 0.35, '#ffd47a', 1, true);
    this.trauma = Math.min(1, this.trauma + 0.3);
  }

  ring(p, radius, life, color, opacity, upright = false) {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 64), new THREE.MeshBasicMaterial({
      color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide,
      blending: upright ? THREE.AdditiveBlending : THREE.NormalBlending,
    }));
    m.position.set(p.x, upright ? p.y : 0.03, p.z);
    if (!upright) m.rotation.x = -Math.PI / 2;
    m.scale.setScalar(0.05);
    this.scene.add(m);
    this.rings.push({ m, radius, life, max: life, opacity });
  }

  update(dt) {
    this.sparks.update(dt);
    this.dust.update(dt);
    this.rings = this.rings.filter((r) => {
      r.life -= dt;
      const f = 1 - Math.max(r.life / r.max, 0);
      r.m.scale.setScalar(0.05 + r.radius * (1 - (1 - f) ** 3));
      r.m.material.opacity = r.opacity * (1 - f);
      if (r.life > 0) return true;
      this.scene.remove(r.m); r.m.geometry.dispose(); r.m.material.dispose();
      return false;
    });
    this.trauma = Math.max(0, this.trauma - dt * 1.6);
  }
}
