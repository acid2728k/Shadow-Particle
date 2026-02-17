import GUI from 'lil-gui';

export interface AppParams {
  /* Particles */
  maxParticles: number;
  emitRate: number;
  baseSize: number;
  particleIntensity: number; // per-particle brightness 0..1
  decayRate: number;
  spread: number;

  /* Depth mapping */
  nearClamp: number;   // mm
  farClamp: number;    // mm
  depthSpread: number; // world-space Z range

  /* Depth-based visuals */
  sizeByDepth: number;  // 0..1
  alphaByDepth: number; // 0..1

  /* Trails */
  feedbackStrength: number; // 0.80 .. 0.99

  /* Background */
  backgroundDensity: number;
  backgroundOpacity: number;

  /* Mask */
  maskThreshold: number;

  /* Debug */
  showDebug: boolean;
}

export const defaultParams: AppParams = {
  maxParticles: 80000,
  emitRate: 350,
  baseSize: 2.2,
  particleIntensity: 0.12,
  decayRate: 0.65,
  spread: 4.0,
  nearClamp: 800,
  farClamp: 4000,
  depthSpread: 3.0,
  sizeByDepth: 0.7,
  alphaByDepth: 0.6,
  feedbackStrength: 0.88,
  backgroundDensity: 4000,
  backgroundOpacity: 0.4,
  maskThreshold: 0,
  showDebug: false,
};

export function createGUI(params: AppParams): GUI {
  const gui = new GUI({ title: '✦ Shadow Particle' });
  gui.domElement.style.zIndex = '200';

  const pf = gui.addFolder('Particles');
  pf.add(params, 'emitRate', 50, 2500, 25).name('Emit / frame');
  pf.add(params, 'baseSize', 0.5, 8, 0.1).name('Base size');
  pf.add(params, 'particleIntensity', 0.02, 0.5, 0.01).name('Intensity');
  pf.add(params, 'decayRate', 0.1, 2.0, 0.05).name('Decay rate');
  pf.add(params, 'spread', 1, 8, 0.1).name('Spread');

  const df = gui.addFolder('Depth');
  df.add(params, 'nearClamp', 400, 2500, 50).name('Near (mm)');
  df.add(params, 'farClamp', 1500, 6000, 50).name('Far (mm)');
  df.add(params, 'depthSpread', 0.5, 6, 0.1).name('Z spread');
  df.add(params, 'sizeByDepth', 0, 1, 0.05).name('Size × depth');
  df.add(params, 'alphaByDepth', 0, 1, 0.05).name('Alpha × depth');

  const tf = gui.addFolder('Trails');
  tf.add(params, 'feedbackStrength', 0.80, 0.995, 0.005).name('Feedback');

  const bf = gui.addFolder('Background');
  bf.add(params, 'backgroundOpacity', 0, 1, 0.05).name('Opacity');

  const dbg = gui.addFolder('Debug');
  dbg.add(params, 'showDebug').name('Show mask / depth');

  // Collapse by default for cleaner look
  df.close();
  bf.close();

  return gui;
}
