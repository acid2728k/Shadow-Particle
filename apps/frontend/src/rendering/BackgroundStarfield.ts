import * as THREE from 'three';

const vertStar = /* glsl */ `
  attribute float aAlpha;
  attribute float aBrightness;
  varying float vAlpha;
  varying float vBright;

  void main() {
    vAlpha  = aAlpha;
    vBright = aBrightness;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = max(1.5 * (150.0 / -mv.z), 0.5);
    gl_Position  = projectionMatrix * mv;
  }
`;

const fragStar = /* glsl */ `
  varying float vAlpha;
  varying float vBright;

  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    float soft = smoothstep(0.5, 0.0, d);
    vec3 col = mix(vec3(0.2, 0.3, 0.6), vec3(0.6, 0.7, 1.0), vBright);
    gl_FragColor = vec4(col, soft * vAlpha);
  }
`;

export class BackgroundStarfield {
  private count: number;
  private positions: Float32Array;
  private velocities: Float32Array;
  private geom: THREE.BufferGeometry;
  private group: THREE.Group;

  constructor(count = 4000) {
    this.count = count;
    this.group = new THREE.Group();

    this.positions = new Float32Array(count * 3);
    this.velocities = new Float32Array(count * 3);
    const alphas = new Float32Array(count);
    const brights = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      this.positions[i * 3] = (Math.random() - 0.5) * 12;
      this.positions[i * 3 + 1] = (Math.random() - 0.5) * 9;
      this.positions[i * 3 + 2] = -3 - Math.random() * 10;

      this.velocities[i * 3] = (Math.random() - 0.5) * 0.008;
      this.velocities[i * 3 + 1] = Math.random() * 0.004;
      this.velocities[i * 3 + 2] = 0;

      alphas[i] = 0.15 + Math.random() * 0.35;
      brights[i] = Math.random();
    }

    this.geom = new THREE.BufferGeometry();
    this.geom.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geom.setAttribute('aAlpha', new THREE.BufferAttribute(alphas, 1));
    this.geom.setAttribute('aBrightness', new THREE.BufferAttribute(brights, 1));

    const mat = new THREE.ShaderMaterial({
      vertexShader: vertStar,
      fragmentShader: fragStar,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
      transparent: true,
    });

    const pts = new THREE.Points(this.geom, mat);
    pts.frustumCulled = false;
    this.group.add(pts);
  }

  get object3D(): THREE.Group {
    return this.group;
  }

  update(dt: number, parallax?: { x: number; y: number }) {
    const pos = this.positions;
    const vel = this.velocities;

    for (let i = 0; i < this.count; i++) {
      const i3 = i * 3;
      pos[i3] += vel[i3] * dt;
      pos[i3 + 1] += vel[i3 + 1] * dt;

      // Wrap horizontally
      if (pos[i3] > 6) pos[i3] = -6;
      if (pos[i3] < -6) pos[i3] = 6;
      if (pos[i3 + 1] > 4.5) pos[i3 + 1] = -4.5;
    }

    (this.geom.attributes.position as THREE.BufferAttribute).needsUpdate = true;

    if (parallax) {
      this.group.position.x = -parallax.x * 0.25;
      this.group.position.y = -parallax.y * 0.18;
    }
  }

  setOpacity(v: number) {
    // scale all alphas? For simplicity just set a uniform later
    // For now opacity is baked in per-star
    void v;
  }

  dispose() {
    this.geom.dispose();
  }
}
