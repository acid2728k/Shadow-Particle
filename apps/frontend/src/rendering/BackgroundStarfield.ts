import * as THREE from 'three';
import type { AppParams } from '../gui/controls.js';

/* ── Vertex shader ── */

const vertBg = /* glsl */ `
  attribute float aAlpha;
  attribute float aColorMix;
  attribute float aPhase;

  varying float vAlpha;
  varying float vColorMix;
  varying float vTwinkle;

  uniform float uTime;
  uniform float uSize;
  uniform float uAnimSpeed;
  uniform float uPixelRatio;

  void main() {
    vAlpha    = aAlpha;
    vColorMix = aColorMix;

    // Per-particle twinkle (different frequency per particle)
    float freq = 0.4 + aPhase * 1.8;
    vTwinkle = 0.55 + 0.45 * sin(uTime * freq * uAnimSpeed + aPhase * 6.2831);

    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = max(uSize * (20.0 / -mv.z) * uPixelRatio, 0.5);
    gl_Position  = projectionMatrix * mv;
  }
`;

/* ── Fragment shader — 4 sparkle shapes selected by uShape ── */

const fragBg = /* glsl */ `
  uniform float uShape;    // 0 dots, 1 stars, 2 dust, 3 bokeh
  uniform vec3  uColor1;
  uniform vec3  uColor2;
  uniform float uOpacity;

  varying float vAlpha;
  varying float vColorMix;
  varying float vTwinkle;

  void main() {
    vec2  c = gl_PointCoord - 0.5;
    float d = length(c);
    float shape = 0.0;

    // ── dots ──
    if (uShape < 0.5) {
      if (d > 0.5) discard;
      shape = smoothstep(0.5, 0.0, d);
    }

    // ── 4-point stars ──
    else if (uShape < 1.5) {
      float angle = atan(c.y, c.x);
      float ray   = pow(abs(cos(angle * 2.0)), 6.0);
      float edge  = mix(0.1, 0.5, ray);
      if (d > edge) discard;
      shape = smoothstep(edge, 0.0, d);
    }

    // ── dust (soft gaussian glow) ──
    else if (uShape < 2.5) {
      shape = exp(-d * d * 8.0);
      if (shape < 0.008) discard;
    }

    // ── bokeh (ring + faint fill) ──
    else {
      float ring = smoothstep(0.28, 0.36, d) * smoothstep(0.5, 0.42, d);
      float fill = smoothstep(0.5, 0.0, d) * 0.1;
      shape = ring + fill;
      if (shape < 0.008) discard;
    }

    vec3  col = mix(uColor1, uColor2, vColorMix);
    float a   = shape * vAlpha * vTwinkle * uOpacity;

    gl_FragColor = vec4(col, a);
  }
`;

/* ── Shape name → float id ── */
const SHAPE_ID: Record<string, number> = { dots: 0, stars: 1, dust: 2, bokeh: 3 };

/* ── Max pre-allocated particles (drawRange controls visible count) ── */
const MAX_BG = 10000;

export class BackgroundStarfield {
  private positions: Float32Array;
  private velocities: Float32Array;
  private activeCount: number;

  private geom: THREE.BufferGeometry;
  private mat: THREE.ShaderMaterial;
  private group: THREE.Group;
  private elapsed = 0;

  constructor(initialCount = 4000) {
    this.group = new THREE.Group();
    this.activeCount = Math.min(initialCount, MAX_BG);

    this.positions = new Float32Array(MAX_BG * 3);
    this.velocities = new Float32Array(MAX_BG * 3);
    const alphas = new Float32Array(MAX_BG);
    const colorMix = new Float32Array(MAX_BG);
    const phases = new Float32Array(MAX_BG);

    for (let i = 0; i < MAX_BG; i++) {
      this.randomize(i);
      alphas[i] = 0.15 + Math.random() * 0.45;
      colorMix[i] = Math.random();
      phases[i] = Math.random();
    }

    this.geom = new THREE.BufferGeometry();
    this.geom.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geom.setAttribute('aAlpha', new THREE.BufferAttribute(alphas, 1));
    this.geom.setAttribute('aColorMix', new THREE.BufferAttribute(colorMix, 1));
    this.geom.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
    this.geom.setDrawRange(0, this.activeCount);

    this.mat = new THREE.ShaderMaterial({
      vertexShader: vertBg,
      fragmentShader: fragBg,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
      transparent: true,
      uniforms: {
        uTime: { value: 0 },
        uSize: { value: 2.5 },
        uAnimSpeed: { value: 1.0 },
        uShape: { value: 0 },
        uColor1: { value: new THREE.Color('#4488cc') },
        uColor2: { value: new THREE.Color('#9944cc') },
        uOpacity: { value: 0.5 },
        uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
      },
    });

    const pts = new THREE.Points(this.geom, this.mat);
    pts.frustumCulled = false;
    this.group.add(pts);
  }

  get object3D(): THREE.Group {
    return this.group;
  }

  /* ── Place a particle at random background position ── */

  private randomize(i: number) {
    const i3 = i * 3;
    this.positions[i3] = (Math.random() - 0.5) * 14;
    this.positions[i3 + 1] = (Math.random() - 0.5) * 10;
    this.positions[i3 + 2] = -3 - Math.random() * 12;

    this.velocities[i3] = (Math.random() - 0.5) * 0.01;
    this.velocities[i3 + 1] = (Math.random() - 0.5) * 0.006;
    this.velocities[i3 + 2] = 0;
  }

  /* ── Per-frame update ── */

  update(dt: number, params: AppParams, parallax?: { x: number; y: number }) {
    this.elapsed += dt;

    // Sync uniforms from GUI
    const u = this.mat.uniforms;
    u.uTime.value = this.elapsed;
    u.uSize.value = params.bgSparkleSize;
    u.uAnimSpeed.value = params.bgAnimSpeed;
    u.uShape.value = SHAPE_ID[params.bgSparkleType] ?? 0;
    u.uOpacity.value = params.backgroundOpacity;
    (u.uColor1.value as THREE.Color).set(params.bgColor1);
    (u.uColor2.value as THREE.Color).set(params.bgColor2);

    // Density: adjust visible count
    const desired = Math.min(Math.round(params.backgroundDensity), MAX_BG);
    if (desired !== this.activeCount) {
      this.activeCount = desired;
      this.geom.setDrawRange(0, this.activeCount);
    }

    // Animated mode: drift particles
    if (params.bgMode === 'animated') {
      const pos = this.positions;
      const vel = this.velocities;
      const speed = params.bgAnimSpeed;

      for (let i = 0; i < this.activeCount; i++) {
        const i3 = i * 3;
        pos[i3] += vel[i3] * dt * speed;
        pos[i3 + 1] += vel[i3 + 1] * dt * speed;

        if (pos[i3] > 7) pos[i3] = -7;
        if (pos[i3] < -7) pos[i3] = 7;
        if (pos[i3 + 1] > 5) pos[i3 + 1] = -5;
        if (pos[i3 + 1] < -5) pos[i3 + 1] = 5;
      }

      (this.geom.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    }

    // Parallax
    if (parallax) {
      this.group.position.x = -parallax.x * 0.25;
      this.group.position.y = -parallax.y * 0.18;
    }
  }

  dispose() {
    this.geom.dispose();
    this.mat.dispose();
  }
}
