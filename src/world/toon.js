// COPIED from Power Battlegrounds (src/world/toon.js), never imported. Ashen Crown changes (docs/GAME_PLAN.md §11:
// "muted Ashen Gold palette, softer outlines, fog + god rays"): ink is a dark brown-violet (#3a2e35, "never pure
// black") instead of near-black, lines are thinner and lighter, saturation is pulled DOWN (the world is desaturated:
// "gold means something matters"), and the outlines fade with the fog. God rays: later (M3).
//
// The cartoon look:
//  1. Cel shading for every lit (Standard/Physical) material: sunlight falls off in flat bands
//     instead of a smooth gradient (one ShaderChunk patch, so every material gets it for free).
//  2. Ink outlines: the scene renders into a multisampled target with a depth texture, then one
//     full-screen pass darkens pixels on silhouettes and convex edges (where the depth "bulges"
//     toward the camera), boosts saturation a little, tone maps and writes to the screen.
//  3. Bloom: whatever is brighter than lit white (lamps, glowing windows, halos, the sun, sparkles on
//     gold) is cut out at 1/4 size, blurred twice and added back as a soft glow; plus a faint vignette.
// Low quality skips the pass (outlines off) and renders straight to the screen — unless the screen was made without a
// depth buffer (main.js: it booted on medium/high), then the pass runs 'lite': no MSAA, outlines, bloom or vignette.
// GPU memory: the scene's colour is R11F_G11F_B10F (4 bytes a pixel, HDR, no alpha — nothing reads it), half of
// RGBA16F's 8: at 2560×1440 with 2× MSAA that's ~42 MB less over the multisampled buffer + its resolve.
import * as THREE from 'three';

let installed = false;

/** Patch the physical lighting model once, before any material compiles. */
export function installToonShading() {
  if (installed) return;
  installed = true;
  // (whitespace-tolerant: three's built bundle strips the blank line the source file has between
  // these two lines — matching the exact text silently left cel shading off)
  const from = /float dotNL = saturate\( dot\( geometryNormal, directLight\.direction \) \);\s*vec3 irradiance = dotNL \* directLight\.color;/;
  const src = THREE.ShaderChunk.lights_physical_pars_fragment;
  if (!from.test(src)) { console.warn('[toon] lighting chunk changed — cel shading off'); return; }
  THREE.ShaderChunk.lights_physical_pars_fragment = src.replace(from, `float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	// cel shading: lit / half-lit / shade with short soft steps between them
	float toonNL = smoothstep( 0.0, 0.07, dotNL ) * 0.62 + smoothstep( 0.36, 0.44, dotNL ) * 0.38;
	vec3 irradiance = toonNL * directLight.color;
	#ifdef TOON_RIM
		// a warm rim where the low sun grazes the silhouette (characters: toonRim(material))
		float rimNV = 1.0 - saturate( dot( geometryNormal, geometryViewDir ) );
		float rim = smoothstep( 0.58, 0.7, rimNV ) * smoothstep( 0.0, 0.2, dotNL );
		reflectedLight.directDiffuse += rim * directLight.color * ( material.diffuseColor * 0.6 + 0.4 ) * ( TOON_RIM );
	#endif`);
}

/** Give a lit material the toon rim light (strength ~0.1–0.4). Call before it first renders. */
export function toonRim(material, strength = 0.22) {
  material.defines = { ...(material.defines || {}), TOON_RIM: strength.toFixed(3) };
  material.needsUpdate = true;
  return material;
}

const vert = /* glsl */`
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const frag = /* glsl */`
  #include <packing>
  uniform sampler2D tColor;
  uniform sampler2D tDepth;
  uniform vec2 uTexel;        // one pixel in uv
  uniform float uWidth;       // line width in pixels
  uniform float uNear, uFar;
  uniform float uSat;
  uniform sampler2D tBloom;
  uniform float uBloom;       // glow strength (0 = off)
  uniform float uVignette;
  uniform float uInk;         // 0 = no outlines (lite: the depth isn't even read)
  varying vec2 vUv;

  // 1 / view distance: linear across the screen on flat surfaces, so its Laplacian is 0 there
  float invZ(vec2 uv) {
    float d = texture2D(tDepth, uv).x;
    return 1.0 / max(-perspectiveDepthToViewZ(d, uNear, uFar), 1e-4);
  }

  void main() {
    vec4 col = texture2D(tColor, vUv);
    float line = 0.0;
    if (uInk > 0.0) {
      vec2 o = uTexel * uWidth;
      float c = invZ(vUv);
      float l = invZ(vUv - vec2(o.x, 0.0)), r = invZ(vUv + vec2(o.x, 0.0));
      float u = invZ(vUv + vec2(0.0, o.y)), b = invZ(vUv - vec2(0.0, o.y));
      // the center sticks out toward the camera compared to its neighbours: a silhouette or a ridge
      float bulge = (4.0 * c - (l + r + u + b)) / c;
      line = smoothstep(0.06, 0.22, bulge);
      // fade lines out in the distance, as the fog takes over
      float dist = 1.0 / c;
      line *= 1.0 - smoothstep(40.0, 120.0, dist);
    }
    vec3 rgb = col.rgb;
    float luma = dot(rgb, vec3(0.2126, 0.7152, 0.0722));
    rgb = max(mix(vec3(luma), rgb, uSat), 0.0);
    // ink = a darker shade of the same color pulled toward the Ashen Gold shadow (#3a2e35), softer than a black wire
    rgb = mix(rgb, rgb * 0.3 + vec3(0.040, 0.028, 0.036), line * 0.78);
    // the glow goes over the ink (a lamp's halo spills past its outline), then a soft vignette
    if (uBloom > 0.0) rgb += texture2D(tBloom, vUv).rgb * uBloom;
    vec2 dv = vUv - 0.5;
    rgb *= 1.0 - dot(dv, dv) * uVignette;
    gl_FragColor = vec4(rgb, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

// bloom: bright pass + 4x4 box downsample (4 bilinear taps one full-res texel off the center)
const brightFrag = /* glsl */`
  uniform sampler2D tColor;
  uniform vec2 uTexel;
  uniform float uThreshold, uKnee;
  varying vec2 vUv;
  void main() {
    vec3 c = texture2D(tColor, vUv + uTexel * vec2(-1.0, -1.0)).rgb + texture2D(tColor, vUv + uTexel * vec2(1.0, -1.0)).rgb
           + texture2D(tColor, vUv + uTexel * vec2(-1.0, 1.0)).rgb + texture2D(tColor, vUv + uTexel * vec2(1.0, 1.0)).rgb;
    c *= 0.25;
    float k = smoothstep(uThreshold, uThreshold + uKnee, max(c.r, max(c.g, c.b)));
    gl_FragColor = vec4(min(c * k, vec3(16.0)), 1.0);
  }`;
// 9-tap gaussian in 5 bilinear fetches along uDir (one texel × spread)
const blurFrag = /* glsl */`
  uniform sampler2D tInput;
  uniform vec2 uDir;
  varying vec2 vUv;
  void main() {
    vec3 c = texture2D(tInput, vUv).rgb * 0.2270270270;
    c += (texture2D(tInput, vUv + uDir * 1.3846153846).rgb + texture2D(tInput, vUv - uDir * 1.3846153846).rgb) * 0.3162162162;
    c += (texture2D(tInput, vUv + uDir * 3.2307692308).rgb + texture2D(tInput, vUv - uDir * 3.2307692308).rgb) * 0.0702702703;
    gl_FragColor = vec4(c, 1.0);
  }`;

/**
 * The scene's colour format: HDR (bloom picks out what's brighter than lit white; the tone mapping squashes the rest).
 * R11F_G11F_B10F where it can be rendered + multisampled, else RGBA16F (twice the memory), else plain 8-bit.
 */
function colorFormat(renderer) {
  const gl = renderer.getContext(), ext = renderer.extensions;
  const max = gl.getParameter(gl.MAX_SAMPLES) || 0;
  if (ext.has('EXT_color_buffer_float')) {
    let n = 0;
    try { const s = gl.getInternalformatParameter(gl.RENDERBUFFER, gl.R11F_G11F_B10F, gl.SAMPLES); n = s && s.length ? s[0] : 0; } catch (e) { /* not renderable */ }
    if (n >= Math.min(2, max)) return { type: THREE.UnsignedInt101111Type, format: THREE.RGBFormat, samples: Math.min(4, max, n) };
  }
  const half = ext.has('EXT_color_buffer_half_float') || ext.has('EXT_color_buffer_float');
  return { type: half ? THREE.HalfFloatType : THREE.UnsignedByteType, format: THREE.RGBAFormat, samples: Math.min(4, max) };
}

export class ToonPost {
  /**
   * Returns null when the GPU can't do it (then render straight to the screen).
   * opts: { maxSamples, bloomPasses } (Medium skips MSAA and uses one blur pair), { lite } (see configure).
   */
  static create(renderer, opts = {}) {
    if (!renderer.capabilities.isWebGL2) return null;
    try { return new ToonPost(renderer, colorFormat(renderer), opts); } catch (e) {
      console.warn('[toon] outline pass unavailable', e);
      return null;
    }
  }

  constructor(renderer, { type, format, samples }, opts) {
    this.renderer = renderer;
    this.hwSamples = samples;
    this.maxSamples = Math.min(samples, opts.maxSamples ?? 4);
    this.bloomPasses = opts.bloomPasses ?? 2;
    this.lite = !!opts.lite;
    samples = this._samples();
    this.size = renderer.getDrawingBufferSize(new THREE.Vector2());
    const depth = new THREE.DepthTexture(this.size.x, this.size.y);
    depth.type = THREE.UnsignedIntType;
    this.target = new THREE.WebGLRenderTarget(this.size.x, this.size.y, {
      type, format, samples, depthTexture: depth, depthBuffer: true,
      minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
    });
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        tColor: { value: this.target.texture },
        tDepth: { value: depth },
        uTexel: { value: new THREE.Vector2(1 / this.size.x, 1 / this.size.y) },
        uWidth: { value: 1 },
        uNear: { value: 0.3 }, uFar: { value: 1600 },
        uSat: { value: 0.9 },
        uInk: { value: 1 },
      },
      vertexShader: vert, fragmentShader: frag,
      depthTest: false, depthWrite: false,
    });
    // bloom: two quarter-size targets it ping-pongs between
    const bt = () => new THREE.WebGLRenderTarget(1, 1, { type, format, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
    this.bloomA = bt();
    this.bloomB = bt();
    const pass = (fragmentShader, uniforms) => new THREE.ShaderMaterial({ uniforms, vertexShader: vert, fragmentShader, depthTest: false, depthWrite: false });
    this.bright = pass(brightFrag, { tColor: { value: this.target.texture }, uTexel: { value: new THREE.Vector2() }, uThreshold: { value: 2.0 }, uKnee: { value: 1.6 } });
    this.blur = pass(blurFrag, { tInput: { value: null }, uDir: { value: new THREE.Vector2() } });
    Object.assign(this.material.uniforms, { tBloom: { value: this.bloomA.texture }, uBloom: { value: 0.5 }, uVignette: { value: 0.38 } });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
    this.quad.frustumCulled = false;
    this.scene = new THREE.Scene();
    this.scene.add(this.quad);
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this._fit();
    this._looks();
  }

  /**
   * Medium/high vs low on a screen without its own depth buffer: lite = no MSAA, outlines, bloom, saturation or
   * vignette (low's plain look; its bloom targets are freed, re-made if it goes back). maxSamples = the MSAA cap.
   */
  configure({ lite = this.lite, maxSamples = this.maxSamples, bloomPasses = this.bloomPasses } = {}) {
    this.lite = !!lite;
    this.maxSamples = Math.min(this.hwSamples, maxSamples);
    this.bloomPasses = bloomPasses;
    if (this.lite) { this.bloomA.dispose(); this.bloomB.dispose(); }
    this._looks();
    this.resize();
  }

  _looks() {
    const u = this.material.uniforms, on = this.lite ? 0 : 1;
    u.uInk.value = on;
    u.uBloom.value = this.bloomPasses > 0 ? 0.5 * on : 0;
    u.uSat.value = this.lite ? 1 : 0.9;
    u.uVignette.value = 0.38 * on;
  }

  /** Call after renderer.setSize / setPixelRatio. */
  resize() {
    const s = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    const n = this._samples();
    const resized = s.x !== this.size.x || s.y !== this.size.y;
    if (!resized && n === this.target.samples) return;
    this.size.copy(s);
    this.target.samples = n;
    if (resized) this.target.setSize(s.x, s.y);     // (re-made on the next frame)
    else this.target.dispose();
    this._fit();
    this._fitBloom();
  }

  /** MSAA samples: a high-density (Retina, even capped at ~1.4×) buffer is already fine-grained, 2 samples look the same as 4. */
  _samples() {
    if (this.lite) return 0;
    return this.renderer.getPixelRatio() >= 1.3 ? Math.min(2, this.maxSamples) : this.maxSamples;
  }

  _fitBloom() {
    const w = Math.max(1, Math.round(this.size.x / 4)), h = Math.max(1, Math.round(this.size.y / 4));
    this.bloomA.setSize(w, h);
    this.bloomB.setSize(w, h);
    this.bright.uniforms.uTexel.value.set(1 / this.size.x, 1 / this.size.y);
    this._bt = [1 / w, 1 / h];
  }

  _fit() {
    if (!this._bt) this._fitBloom();
    this.material.uniforms.uTexel.value.set(1 / this.size.x, 1 / this.size.y);
    // ~1.4 CSS px lines on any screen (softer than Power Battlegrounds' 1.8)
    this.material.uniforms.uWidth.value = Math.max(1, Math.round(this.renderer.getPixelRatio() * 1.4 * 2) / 2);
  }

  render(scene, camera) {
    const r = this.renderer;
    const u = this.material.uniforms;
    u.uNear.value = camera.near;
    u.uFar.value = camera.far;
    r.setRenderTarget(this.target);
    r.render(scene, camera);
    if (u.uBloom.value > 0) {
      // bright parts → A; blur A ↔ B twice (the second time wider)
      const q = this.quad, b = this.blur.uniforms, [tx, ty] = this._bt;
      q.material = this.bright;
      r.setRenderTarget(this.bloomA); r.render(this.scene, this.camera);
      q.material = this.blur;
      for (let i = 0; i < this.bloomPasses; i++) {
        const k = i === 0 ? 1 : 2.2;
        b.tInput.value = this.bloomA.texture; b.uDir.value.set(tx * k, 0);
        r.setRenderTarget(this.bloomB); r.render(this.scene, this.camera);
        b.tInput.value = this.bloomB.texture; b.uDir.value.set(0, ty * k);
        r.setRenderTarget(this.bloomA); r.render(this.scene, this.camera);
      }
      q.material = this.material;
    }
    r.setRenderTarget(null);
    r.render(this.scene, this.camera);
  }

  /**
   * Compile the post pass's own shaders before the first frame (they used to link synchronously in it): the bloom
   * passes for their render target (linear, untoned), the last one for the screen. Returns compileAsync's promise.
   */
  compileAsync() {
    const r = this.renderer, q = this.quad, prev = r.getRenderTarget(), jobs = [];
    r.setRenderTarget(this.bloomA);
    for (const m of [this.bright, this.blur]) { q.material = m; jobs.push(r.compileAsync(this.scene, this.camera)); }
    q.material = this.material;
    r.setRenderTarget(null);
    jobs.push(r.compileAsync(this.scene, this.camera));
    r.setRenderTarget(prev);
    return Promise.all(jobs);
  }

  dispose() {
    this.target.depthTexture.dispose();
    this.target.dispose();
    this.bloomA.dispose();
    this.bloomB.dispose();
    this.bright.dispose();
    this.blur.dispose();
    this.material.dispose();
    this.quad.geometry.dispose();
  }
}
