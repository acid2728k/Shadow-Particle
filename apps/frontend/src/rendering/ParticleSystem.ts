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
  uniform vec3  uColorNear;
  uniform vec3  uColorFar;

  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    if (d > 0.5) discard;

    float soft = smoothstep(0.5, 0.08, d);

    vec3 col = mix(uColorNear, uColorFar, vDepthNorm);

    float a = soft;
    a *= smoothstep(0.0, 0.25, vLife);
    a *= mix(1.0, max(0.12, 1.0 - vDepthNorm * 0.75), uAlphaByDepth);

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
        uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
        uColorNear: { value: new THREE.Color(1.0, 0.88, 0.55) },
        uColorFar: { value: new THREE.Color(0.3, 0.5, 1.0) },
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
    this.mat.uniforms.uSizeByDepth.value = p.sizeByDepth;
    this.mat.uniforms.uAlphaByDepth.value = p.alphaByDepth;

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

      // Turbulence
      vel[i3] += (Math.random() - 0.5) * 0.08 * dt;
      vel[i3 + 1] += (Math.random() - 0.5) * 0.08 * dt + 0.012 * dt;
      vel[i3 + 2] += (Math.random() - 0.5) * 0.04 * dt;

      // Damping
      vel[i3] *= 0.997;
      vel[i3 + 1] *= 0.997;
      vel[i3 + 2] *= 0.997;
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

      const jitter = 0.018;
      this.positions[i3] = nx + (Math.random() - 0.5) * jitter;
      this.positions[i3 + 1] = ny + (Math.random() - 0.5) * jitter;
      this.positions[i3 + 2] = z + (Math.random() - 0.5) * jitter;

      const isAura = Math.random() < 0.12;
      const vScale = isAura ? 0.06 : 0.14;
      this.velocities[i3] = (Math.random() - 0.5) * vScale;
      this.velocities[i3 + 1] = (Math.random() - 0.5) * vScale + (isAura ? 0.015 : 0.03);
      this.velocities[i3 + 2] = (Math.random() - 0.5) * vScale * 0.25;

      this.lives[idx] = isAura ? 1.5 + Math.random() * 2.0 : 0.4 + Math.random() * 1.2;
      this.sizes[idx] = p.baseSize * (isAura ? 2.0 + Math.random() * 2.0 : 0.3 + Math.random() * 0.8);
      this.depthNorms[idx] = isAura ? Math.min(1, dn + 0.15) : dn;

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
