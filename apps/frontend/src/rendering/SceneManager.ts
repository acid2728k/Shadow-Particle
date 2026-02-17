import * as THREE from 'three';
import type { MaskData } from '@sp/protocol';
import type { MotionSource } from '../motion/MotionSource.js';
import { WebSocketStreamSource } from '../motion/WebSocketStreamSource.js';
import { WebcamSegmentationSource } from '../motion/WebcamSegmentationSource.js';
import { ParticleSystem } from './ParticleSystem.js';
import { BackgroundStarfield } from './BackgroundStarfield.js';
import { TrailRenderer } from './TrailRenderer.js';
import { DebugOverlay } from '../debug/DebugOverlay.js';
import type { AppParams } from '../gui/controls.js';

export class SceneManager {
  private renderer: THREE.WebGLRenderer;
  private camera: THREE.PerspectiveCamera;
  private scene: THREE.Scene;

  private particles: ParticleSystem;
  private stars: BackgroundStarfield;
  private trails: TrailRenderer;
  private debug: DebugOverlay;

  private source: MotionSource | null = null;
  private params: AppParams;
  private clock = new THREE.Clock();
  private statusEl: HTMLElement | null;

  constructor(canvas: HTMLCanvasElement, params: AppParams) {
    this.params = params;
    this.statusEl = document.getElementById('status');

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setClearColor(0x000000, 1);

    // Camera
    this.camera = new THREE.PerspectiveCamera(
      55,
      window.innerWidth / window.innerHeight,
      0.1,
      50,
    );
    this.camera.position.z = 3.5;

    // Scene
    this.scene = new THREE.Scene();

    // Subsystems
    this.particles = new ParticleSystem(params);
    this.scene.add(this.particles.object3D);

    this.stars = new BackgroundStarfield(params.backgroundDensity);
    this.scene.add(this.stars.object3D);

    this.trails = new TrailRenderer(window.innerWidth, window.innerHeight);
    this.debug = new DebugOverlay();

    window.addEventListener('resize', this.onResize);
  }

  /* ── Source negotiation ── */

  async initMotionSource(): Promise<void> {
    this.setStatus('connecting to bridge...');

    // Try WebSocket first
    try {
      const ws = new WebSocketStreamSource();
      await ws.init();
      this.source = ws;
      this.setStatus(`source: ${ws.name}`);
      return;
    } catch {
      console.log('[app] bridge unreachable — trying webcam fallback');
    }

    // Webcam fallback
    try {
      const cam = new WebcamSegmentationSource();
      await cam.init();
      this.source = cam;
      this.setStatus(`source: ${cam.name}`);
      return;
    } catch (e) {
      console.warn('[app] webcam fallback failed', e);
    }

    this.setStatus('no source — showing background only');
  }

  /* ── Frame loop ── */

  update() {
    const dt = Math.min(this.clock.getDelta(), 0.05); // cap dt

    const mask = this.source?.getMaskFrame() ?? null;
    const depth = this.source?.getDepthFrame() ?? null;
    const parallax = mask ? this.centroid(mask) : { x: 0, y: 0 };

    this.particles.update(dt, mask, depth, this.params);
    this.stars.update(dt, parallax);
    this.trails.setDecay(this.params.feedbackStrength);
    this.trails.render(this.renderer, this.scene, this.camera);

    this.debug.setVisible(this.params.showDebug);
    this.debug.update(mask, depth);
  }

  /* ── Helpers ── */

  private centroid(mask: MaskData): { x: number; y: number } {
    const { width: w, height: h, mask: d } = mask;
    let sx = 0,
      sy = 0,
      n = 0;
    const step = 4;
    for (let y = 0; y < h; y += step) {
      for (let x = 0; x < w; x += step) {
        if (d[y * w + x] > 0) {
          sx += x;
          sy += y;
          n++;
        }
      }
    }
    if (n === 0) return { x: 0, y: 0 };
    return { x: (sx / n / w - 0.5) * 2, y: -(sy / n / h - 0.5) * 2 };
  }

  private onResize = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.trails.resize(w, h);
  };

  private setStatus(msg: string) {
    if (this.statusEl) this.statusEl.textContent = msg;
    setTimeout(() => {
      if (this.statusEl) this.statusEl.style.opacity = '0';
    }, 4000);
  }

  dispose() {
    window.removeEventListener('resize', this.onResize);
    this.source?.dispose();
    this.particles.dispose();
    this.stars.dispose();
    this.trails.dispose();
    this.renderer.dispose();
  }
}
