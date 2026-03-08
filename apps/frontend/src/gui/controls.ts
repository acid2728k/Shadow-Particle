import GUI from 'lil-gui';

export interface AppParams {
  /* Particles */
  maxParticles: number;
  emitRate: number;
  baseSize: number;
  particleIntensity: number; // per-particle brightness 0..1
  decayRate: number;
  spread: number;
  fgSparkleType: string;  // 'dots' | 'stars' | 'dust' | 'bokeh'
  fgColorNear: string;    // hex — color for near particles
  fgColorFar: string;     // hex — color for far particles
  fgAnimSpeed: number;    // turbulence / velocity multiplier

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
  bgMode: string;         // 'static' | 'animated'
  bgSparkleType: string;  // 'dots' | 'stars' | 'dust' | 'bokeh'
  bgAnimSpeed: number;    // 0..3
  bgSparkleSize: number;  // 0.5..10
  bgColor1: string;       // hex
  bgColor2: string;       // hex

  /* Mask */
  maskThreshold: number;

  /* Debug */
  showDebug: boolean;
}

export const defaultParams: AppParams = {
  maxParticles: 80000,

  // ── Body particles ──
  // Dense fill + short life → body always bright; particles float up (teamLab look)
  emitRate: 900,
  baseSize: 2.4,
  particleIntensity: 0.07,   // lower → colors visible, not blown to white
  decayRate: 2.0,
  spread: 3.0,
  fgSparkleType: 'dust',     // soft gaussian glow
  fgColorNear: '#ffdd55',    // vivid warm gold — top of body / near camera
  fgColorFar: '#7711ff',     // vivid purple — bottom of body / far camera
  fgAnimSpeed: 1.6,          // controls scatter strength + upward drift speed

  // ── Depth mapping ── (matches bridge defaults: near=600mm, far=2500mm)
  nearClamp: 600,
  farClamp: 2500,
  depthSpread: 3.0,
  sizeByDepth: 0.55,
  alphaByDepth: 0.45,

  // ── Trails — high feedback = long glowing motion trails ──
  feedbackStrength: 0.94,

  // ── Background sparkles ──
  backgroundDensity: 5000,
  backgroundOpacity: 0.32,
  bgMode: 'animated',
  bgSparkleType: 'dots',
  bgAnimSpeed: 0.25,
  bgSparkleSize: 1.4,
  bgColor1: '#0d2a99',
  bgColor2: '#4a0f88',

  maskThreshold: 0,
  showDebug: false,
};

export function createGUI(params: AppParams): GUI {
  const gui = new GUI({ title: '✦ Shadow Particle' });
  gui.domElement.style.zIndex = '200';

  const pf = gui.addFolder('Particles');
  pf.add(params, 'fgSparkleType', { Dots: 'dots', Stars: 'stars', Dust: 'dust', Bokeh: 'bokeh' }).name('Sparkle type');
  pf.addColor(params, 'fgColorNear').name('Color near');
  pf.addColor(params, 'fgColorFar').name('Color far');
  pf.add(params, 'emitRate', 50, 2500, 25).name('Emit / frame');
  pf.add(params, 'baseSize', 0.5, 8, 0.1).name('Base size');
  pf.add(params, 'particleIntensity', 0.02, 0.5, 0.01).name('Intensity');
  pf.add(params, 'fgAnimSpeed', 0.1, 3, 0.05).name('Anim speed');
  pf.add(params, 'decayRate', 0.1, 2.0, 0.05).name('Decay rate');
  pf.add(params, 'spread', 1, 8, 0.1).name('Spread');

  const df = gui.addFolder('Depth');
  df.add(params, 'nearClamp', 100, 3000, 50).name('Near (mm)');
  df.add(params, 'farClamp', 500, 10000, 100).name('Far (mm)');
  df.add(params, 'depthSpread', 0.5, 6, 0.1).name('Z spread');
  df.add(params, 'sizeByDepth', 0, 1, 0.05).name('Size × depth');
  df.add(params, 'alphaByDepth', 0, 1, 0.05).name('Alpha × depth');

  const tf = gui.addFolder('Trails');
  tf.add(params, 'feedbackStrength', 0.80, 0.995, 0.005).name('Feedback');

  const bf = gui.addFolder('Background');
  bf.add(params, 'bgMode', { Static: 'static', Animated: 'animated' }).name('Mode');
  bf.add(params, 'bgSparkleType', { Dots: 'dots', Stars: 'stars', Dust: 'dust', Bokeh: 'bokeh' }).name('Sparkle type');
  bf.add(params, 'bgSparkleSize', 0.5, 10, 0.1).name('Sparkle size');
  bf.add(params, 'bgAnimSpeed', 0, 3, 0.05).name('Anim speed');
  bf.addColor(params, 'bgColor1').name('Color 1');
  bf.addColor(params, 'bgColor2').name('Color 2');
  bf.add(params, 'backgroundDensity', 500, 10000, 100).name('Density');
  bf.add(params, 'backgroundOpacity', 0, 1, 0.02).name('Opacity');

  const dbg = gui.addFolder('Debug');
  dbg.add(params, 'showDebug').name('Show mask / depth');

  // Collapse by default for cleaner look
  df.close();

  return gui;
}
