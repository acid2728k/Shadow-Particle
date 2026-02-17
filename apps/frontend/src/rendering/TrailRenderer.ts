import * as THREE from 'three';

/**
 * Feedback-buffer trail renderer.
 *
 * Each frame:
 *   1. rtA ← (rtB × decay)          // fade previous frame
 *   2. rtA ← rtA + particles         // additive composite
 *   3. screen ← rtA                  // display
 *   4. swap rtA, rtB
 */
export class TrailRenderer {
  private rtA: THREE.WebGLRenderTarget;
  private rtB: THREE.WebGLRenderTarget;

  private feedbackMat: THREE.ShaderMaterial;
  private displayMat: THREE.ShaderMaterial;

  private feedbackScene: THREE.Scene;
  private displayScene: THREE.Scene;
  private ortho: THREE.OrthographicCamera;

  constructor(w: number, h: number) {
    const opts: THREE.WebGLRenderTargetOptions = {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.HalfFloatType,
    };
    this.rtA = new THREE.WebGLRenderTarget(w, h, opts);
    this.rtB = new THREE.WebGLRenderTarget(w, h, opts);

    this.ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    const quadGeo = new THREE.PlaneGeometry(2, 2);

    /* ── feedback (prev frame × decay) ── */
    this.feedbackMat = new THREE.ShaderMaterial({
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D tPrev;
        uniform float uDecay;
        varying vec2 vUv;
        void main() {
          gl_FragColor = texture2D(tPrev, vUv) * uDecay;
        }
      `,
      uniforms: {
        tPrev: { value: null },
        uDecay: { value: 0.93 },
      },
      depthTest: false,
      depthWrite: false,
    });
    this.feedbackScene = new THREE.Scene();
    this.feedbackScene.add(new THREE.Mesh(quadGeo, this.feedbackMat));

    /* ── display (final blit to screen) ── */
    this.displayMat = new THREE.ShaderMaterial({
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D tFrame;
        varying vec2 vUv;
        void main() {
          vec4 c = texture2D(tFrame, vUv);
          // Subtle tone-map / bloom lift
          c.rgb = 1.0 - exp(-c.rgb * 1.4);
          gl_FragColor = c;
        }
      `,
      uniforms: {
        tFrame: { value: null },
      },
      depthTest: false,
      depthWrite: false,
    });
    this.displayScene = new THREE.Scene();
    this.displayScene.add(new THREE.Mesh(quadGeo.clone(), this.displayMat));
  }

  render(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
    const prev = renderer.autoClear;

    // 1. Feedback pass → rtA
    renderer.setRenderTarget(this.rtA);
    renderer.clear();
    this.feedbackMat.uniforms.tPrev.value = this.rtB.texture;
    renderer.render(this.feedbackScene, this.ortho);

    // 2. Render scene (particles + background) additively on top
    renderer.autoClear = false;
    renderer.render(scene, camera);
    renderer.autoClear = prev;

    // 3. Display rtA to screen
    renderer.setRenderTarget(null);
    renderer.clear();
    this.displayMat.uniforms.tFrame.value = this.rtA.texture;
    renderer.render(this.displayScene, this.ortho);

    // 4. Swap
    [this.rtA, this.rtB] = [this.rtB, this.rtA];
  }

  setDecay(v: number) {
    this.feedbackMat.uniforms.uDecay.value = v;
  }

  resize(w: number, h: number) {
    this.rtA.setSize(w, h);
    this.rtB.setSize(w, h);
  }

  dispose() {
    this.rtA.dispose();
    this.rtB.dispose();
    this.feedbackMat.dispose();
    this.displayMat.dispose();
  }
}
