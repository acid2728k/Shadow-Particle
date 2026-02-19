import * as THREE from 'three';
import type { MaskData, DepthData } from '@sp/protocol';
import type { AppParams } from '../gui/controls.js';

/* ── Shaders ── */

const vertexShader = /* glsl */ `
  attribute float aLife;
  attribute float aSize;
  attribute float aDepthNorm;

  varying float vLife;
  varying float vDepthNorm;

  uniform float uSizeByDepth;
  uniform float uPixelRatio;

  void main() {
    vLife = aLife;
    vDepthNorm = aDepthNorm;

    vec4 mv = modelViewMatrix * vec4(position, 1.0);

    // Near particles are larger
    float dScale = mix(1.0, max(0.2, 1.0 - aDepthNorm * 0.85), uSizeByDepth);
    float sz = aSize * dScale;
    sz *= (250.0 / -mv.z);
    sz *= uPixelRatio;
    sz *= smoothstep(0.0, 0.15, aLife);

    gl_PointSize = max(sz, 0.5);
    gl_Position  = projectionMatrix * mv;
  }
`;

const fragmentShader = /* glsl */ `
  varying float vLife;
  varying float vDepthNorm;

  uniform float uAlphaByDepth;
  uniform float uIntensity;
  uniform float uShape;     // 0 dots, 1 stars, 2 dust, 3 bokeh
  uniform vec3  uColorNear;
  uniform vec3  uColorFar;

  void main() {
    vec2  c = gl_PointCoord - 0.5;
    float d = length(c);
    float shape = 0.0;

    // ── dots ──
    if (uShape < 0.5) {
      if (d > 0.5) discard;
      shape = smoothstep(0.5, 0.05, d);
    }
    // ── 4-point stars ──
    else if (uShape < 1.5) {
      float angle = atan(c.y, c.x);
      float ray   = pow(abs(cos(angle * 2.0)), 6.0);
      float edge  = mix(0.1, 0.5, ray);
      if (d > edge) discard;
      shape = smoothstep(edge, 0.0, d);
    }
    // ── dust (soft gaussian) ──
    else if (uShape < 2.5) {
      shape = exp(-d * d * 8.0);
      if (shape < 0.008) discard;
    }
    // ── bokeh (ring + fill) ──
    else {
      float ring = smoothstep(0.28, 0.36, d) * smoothstep(0.5, 0.42, d);
      float fill = smoothstep(0.5, 0.0, d) * 0.1;
      shape = ring + fill;
      if (shape < 0.008) discard;
    }

    vec3 col = mix(uColorNear, uColorFar, vDepthNorm);

    float a = shape;
    a *= smoothstep(0.0, 0.25, vLife);
    a *= mix(1.0, max(0.12, 1.0 - vDepthNorm * 0.75), uAlphaByDepth);
    a *= uIntensity;

    gl_FragColor = vec4(col, a);
  }
`;

/* ── Particle pool ── */

export class ParticleSystem {
  private maxP: number;
  private positions: Float32Array;
  private velocities: Float32Array;
  private lives: Float32Array;
  private sizes: Float32Array;
  private depthNorms: Float32Array;
  private free: number[] = [];

  private geom: THREE.BufferGeometry;
  private mat: THREE.ShaderMaterial;
  private points: THREE.Points;

  constructor(params: AppParams) {
    this.maxP = params.maxParticles;
    const n = this.maxP;

    this.positions = new Float32Array(n * 3);
    this.velocities = new Float32Array(n * 3);
    this.lives = new Float32Array(n);
    this.sizes = new Float32Array(n);
    this.depthNorms = new Float32Array(n);

    // All particles start dead
    for (let i = n - 1; i >= 0; i--) {
      this.free.push(i);
      this.positions[i * 3 + 1] = -999;
    }

    this.geom = new THREE.BufferGeometry();
    this.geom.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geom.setAttribute('aLife', new THREE.BufferAttribute(this.lives, 1));
    this.geom.setAttribute('aSize', new THREE.BufferAttribute(this.sizes, 1));
    this.geom.setAttribute('aDepthNorm', new THREE.BufferAttribute(this.depthNorms, 1));

    this.mat = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
      transparent: true,
      uniforms: {
        uSizeByDepth: { value: params.sizeByDepth },
        uAlphaByDepth: { value: params.alphaByDepth },
        uIntensity: { value: params.particleIntensity },
        uShape: { value: 0 },
        uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
        uColorNear: { value: new THREE.Color(params.fgColorNear) },
        uColorFar: { value: new THREE.Color(params.fgColorFar) },
      },
    });

    this.points = new THREE.Points(this.geom, this.mat);
    this.points.frustumCulled = false;
  }

  get object3D(): THREE.Object3D {
    return this.points;
  }

  /* ── Main update ── */

  update(
    dt: number,
    mask: MaskData | null,
    depth: DepthData | null,
    p: AppParams,
  ) {
    // Sync uniforms
    const SHAPE_ID: Record<string, number> = { dots: 0, stars: 1, dust: 2, bokeh: 3 };
    this.mat.uniforms.uSizeByDepth.value = p.sizeByDepth;
    this.mat.uniforms.uAlphaByDepth.value = p.alphaByDepth;
    this.mat.uniforms.uIntensity.value = p.particleIntensity;
    this.mat.uniforms.uShape.value = SHAPE_ID[p.fgSparkleType] ?? 0;
    (this.mat.uniforms.uColorNear.value as THREE.Color).set(p.fgColorNear);
    (this.mat.uniforms.uColorFar.value as THREE.Color).set(p.fgColorFar);

    this.stepExisting(dt, p);
    if (mask) this.emit(mask, depth, p);
    this.uploadBuffers();
  }

  /* ── Step alive particles ── */

  private stepExisting(dt: number, p: AppParams) {
    const pos = this.positions;
    const vel = this.velocities;
    const life = this.lives;

    for (let i = 0; i < this.maxP; i++) {
      if (life[i] <= 0) continue;

      life[i] -= p.decayRate * dt;
      if (life[i] <= 0) {
        life[i] = 0;
        pos[i * 3 + 1] = -999;
        this.free.push(i);
        continue;
      }

      const i3 = i * 3;

      // Integrate
      pos[i3] += vel[i3] * dt;
      pos[i3 + 1] += vel[i3 + 1] * dt;
      pos[i3 + 2] += vel[i3 + 2] * dt;

      // Turbulence scaled by anim speed
      const spd = p.fgAnimSpeed;
      vel[i3] += (Math.random() - 0.5) * 0.25 * dt * spd;
      vel[i3 + 1] += (Math.random() - 0.5) * 0.2 * dt * spd + 0.025 * dt * spd;
      vel[i3 + 2] += (Math.random() - 0.5) * 0.12 * dt * spd;

      // Damping
      vel[i3] *= 0.994;
      vel[i3 + 1] *= 0.994;
      vel[i3 + 2] *= 0.994;
    }
  }

  /* ── Emit from mask ── */

  private emit(mask: MaskData, depth: DepthData | null, p: AppParams) {
    const { width: w, height: h, mask: mData } = mask;
    const dData = depth?.depth ?? null;
    const count = Math.min(p.emitRate, this.free.length);
    const aspect = w / h;
    let emitted = 0;
    let tries = 0;
    const maxTries = count * 8;

    while (emitted < count && tries < maxTries) {
      tries++;
      const px = (Math.random() * w) | 0;
      const py = (Math.random() * h) | 0;
      const mi = py * w + px;
      if (mData[mi] === 0) continue;

      const idx = this.free.pop()!;
      const i3 = idx * 3;

      const nx = (px / w - 0.5) * p.spread * aspect;
      const ny = -(py / h - 0.5) * p.spread;

      let dn = 0.5;
      if (dData) {
        const raw = dData[mi];
        if (raw > 0) {
          dn = (raw - p.nearClamp) / (p.farClamp - p.nearClamp);
          dn = Math.max(0, Math.min(1, dn));
        }
      }
      const z = -dn * p.depthSpread;

      const jitter = 0.07;
      this.positions[i3] = nx + (Math.random() - 0.5) * jitter;
      this.positions[i3 + 1] = ny + (Math.random() - 0.5) * jitter;
      this.positions[i3 + 2] = z + (Math.random() - 0.5) * jitter * 0.5;

      const isAura = Math.random() < 0.15;
      const vScale = (isAura ? 0.12 : 0.35) * p.fgAnimSpeed;
      this.velocities[i3] = (Math.random() - 0.5) * vScale;
      this.velocities[i3 + 1] = (Math.random() - 0.5) * vScale + (isAura ? 0.02 : 0.06);
      this.velocities[i3 + 2] = (Math.random() - 0.5) * vScale * 0.3;

      this.lives[idx] = isAura ? 1.8 + Math.random() * 2.5 : 0.5 + Math.random() * 1.5;
      this.sizes[idx] = p.baseSize * (isAura ? 1.8 + Math.random() * 2.5 : 0.4 + Math.random() * 1.0);
      this.depthNorms[idx] = isAura ? Math.min(1, dn + 0.2) : dn;

      emitted++;
    }
  }

  /* ── Upload to GPU ── */

  private uploadBuffers() {
    const a = this.geom.attributes;
    (a.position as THREE.BufferAttribute).needsUpdate = true;
    (a.aLife as THREE.BufferAttribute).needsUpdate = true;
    (a.aSize as THREE.BufferAttribute).needsUpdate = true;
    (a.aDepthNorm as THREE.BufferAttribute).needsUpdate = true;
  }

  dispose() {
    this.geom.dispose();
    this.mat.dispose();
  }
}
