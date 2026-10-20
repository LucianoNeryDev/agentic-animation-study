import * as THREE from 'three';

const FPS = 30, WIDTH = 640, HEIGHT = 360;
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(WIDTH, HEIGHT);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#202028');
const camera = new THREE.PerspectiveCamera(45, WIDTH / HEIGHT, 0.1, 100);
camera.position.set(0, 1.5, 5);
camera.lookAt(0, 0, 0);
scene.add(new THREE.HemisphereLight(0xffffff, 0x333344, 1.5));
const sun = new THREE.DirectionalLight(0xffffff, 2);
sun.position.set(3, 4, 5);
scene.add(sun);
const cube = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: '#e6a700' }));
scene.add(cube);

function updateScene(t: number) {
  cube.rotation.y = t * Math.PI;          // half a turn per second
  cube.position.x = Math.sin(t * Math.PI) * 1.5;
}

async function renderFrame(frame: number) {
  updateScene(frame / FPS);
  renderer.render(scene, camera);
}
(window as any).renderFrame = renderFrame;
(window as any).ready = Promise.resolve();

if (new URLSearchParams(location.search).has('live')) {
  const start = performance.now();
  renderer.setAnimationLoop(() => renderFrame(((performance.now() - start) / 1000) * FPS));
} else {
  renderFrame(0);
}
