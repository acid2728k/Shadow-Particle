import { SceneManager } from './rendering/SceneManager.js';
import { defaultParams, createGUI } from './gui/controls.js';

async function main() {
  const canvas = document.getElementById('canvas') as HTMLCanvasElement;
  if (!canvas) throw new Error('#canvas not found');

  const params = { ...defaultParams };
  createGUI(params);

  const scene = new SceneManager(canvas, params);
  await scene.initMotionSource();

  function loop() {
    requestAnimationFrame(loop);
    scene.update();
  }
  loop();
}

main().catch((err) => {
  console.error(err);
  document.body.innerHTML = `<pre style="color:red;padding:2em">${err.message}\n${err.stack}</pre>`;
});
