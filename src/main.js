import "./style.css";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

const host = document.querySelector("#canvas-host");
const scene = new THREE.Scene();

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(host.clientWidth, host.clientHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
host.appendChild(renderer.domElement);

const camera = new THREE.PerspectiveCamera(
  45,
  host.clientWidth / host.clientHeight,
  0.1,
  100
);
camera.position.set(2.8, 2.1, 2.8);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, 0, 0);
controls.update();

const ambient = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambient);

const keyLight = new THREE.DirectionalLight(0xffffff, 1.1);
keyLight.position.set(3, 4, 2);
scene.add(keyLight);

const fillLight = new THREE.DirectionalLight(0xffffff, 0.35);
fillLight.position.set(-2, -1, -3);
scene.add(fillLight);

const cubeSize = 2;
const half = cubeSize / 2;
const planeGeo = new THREE.PlaneGeometry(cubeSize, cubeSize);
const faceCanvasSize = 512;

function createFaceCanvas(label) {
  const canvas = document.createElement("canvas");
  canvas.width = faceCanvasSize;
  canvas.height = faceCanvasSize;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#22252d";
  ctx.fillRect(0, 0, faceCanvasSize, faceCanvasSize);

  const step = faceCanvasSize / 16;
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 1;
  for (let i = 0; i <= faceCanvasSize; i += step) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, faceCanvasSize);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(faceCanvasSize, i);
    ctx.stroke();
  }

  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, faceCanvasSize - 2, faceCanvasSize - 2);

  ctx.fillStyle = "rgba(255,255,255,0.3)";
  ctx.font = "20px Roboto, sans-serif";
  ctx.fillText(label, 14, 30);

  return { canvas, ctx };
}

function createFaceMaterial(canvas) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();

  const material = new THREE.MeshStandardMaterial({
    map: texture,
    transparent: true,
    opacity: 0.95,
    roughness: 0.78,
    metalness: 0.1,
    side: THREE.DoubleSide
  });

  return { material, texture };
}

function createFace(label) {
  const { canvas, ctx } = createFaceCanvas(label);
  const { material, texture } = createFaceMaterial(canvas);
  const mesh = new THREE.Mesh(planeGeo, material);
  mesh.userData = { canvas, ctx, texture, label };
  return mesh;
}

const bottomFace = createFace("Bottom");
bottomFace.rotation.x = -Math.PI / 2;
bottomFace.position.y = -half;
scene.add(bottomFace);

const backFace = createFace("Back");
backFace.position.z = -half;
scene.add(backFace);

const sideFace = createFace("Side");
sideFace.rotation.y = Math.PI / 2;
sideFace.position.x = -half;
scene.add(sideFace);

const bounds = new THREE.LineSegments(
  new THREE.EdgesGeometry(new THREE.BoxGeometry(cubeSize, cubeSize, cubeSize)),
  new THREE.LineBasicMaterial({
    color: 0x3a3d46,
    transparent: true,
    opacity: 0.45
  })
);
scene.add(bounds);

const brushOverlay = document.getElementById("brush-overlay");
const brushCircle = document.getElementById("brush-circle");
const falloffCircle = document.getElementById("falloff-circle");
const brushDot = document.getElementById("brush-dot");

const densityInput = document.getElementById("density");
const smoothingInput = document.getElementById("smoothing");
const brushSizeInput = document.getElementById("brush-size");

const densityValue = document.getElementById("density-value");
const smoothValue = document.getElementById("smooth-value");
const brushValue = document.getElementById("brush-value");
const meshStats = document.getElementById("mesh-stats");

const faceButtons = Array.from(document.querySelectorAll("[data-face]"));
let activeFace = "bottom";

function updateRange(input, output, formatter) {
  const value = Number(input.value);
  const percent = ((value - Number(input.min)) / (Number(input.max) - Number(input.min))) * 100;
  input.style.setProperty("--val", `${percent}%`);
  if (output) {
    output.textContent = formatter ? formatter(value) : value;
  }
  return value;
}

function updateMeshStats() {
  const density = Number(densityInput.value);
  meshStats.textContent = `Voxels: ${density}^3 | Faces: --`;
}

function setActiveFace(face) {
  activeFace = face;
  faceButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.face === face);
  });
}

function updateBrushRadii() {
  const size = Number(brushSizeInput.value);
  const radius = 6 + (size / 100) * 40;
  brushCircle.setAttribute("r", radius);
  falloffCircle.setAttribute("r", radius * 1.6);
  brushDot.setAttribute("r", 2.5);
}

function setBrushVisible(visible) {
  const opacity = visible ? "1" : "0";
  brushCircle.style.opacity = opacity;
  falloffCircle.style.opacity = opacity;
  brushDot.style.opacity = opacity;
}

renderer.domElement.addEventListener("pointermove", (event) => {
  const { clientX, clientY } = event;
  brushCircle.setAttribute("cx", clientX);
  brushCircle.setAttribute("cy", clientY);
  falloffCircle.setAttribute("cx", clientX);
  falloffCircle.setAttribute("cy", clientY);
  brushDot.setAttribute("cx", clientX);
  brushDot.setAttribute("cy", clientY);
  setBrushVisible(true);
});

renderer.domElement.addEventListener("pointerleave", () => {
  setBrushVisible(false);
});

brushOverlay.setAttribute("width", window.innerWidth);
brushOverlay.setAttribute("height", window.innerHeight);

[densityInput, smoothingInput, brushSizeInput].forEach((input) => {
  input.addEventListener("input", () => {
    if (input === densityInput) {
      updateRange(input, densityValue);
      updateMeshStats();
    } else if (input === smoothingInput) {
      updateRange(input, smoothValue, (value) => `${value}x`);
    } else {
      updateRange(input, brushValue, (value) => `${value}%`);
      updateBrushRadii();
    }
  });
});

faceButtons.forEach((button) => {
  button.addEventListener("click", () => setActiveFace(button.dataset.face));
});

updateRange(densityInput, densityValue);
updateRange(smoothingInput, smoothValue, (value) => `${value}x`);
updateRange(brushSizeInput, brushValue, (value) => `${value}%`);
updateBrushRadii();
updateMeshStats();

const resizeObserver = new ResizeObserver(() => {
  const { clientWidth, clientHeight } = host;
  renderer.setSize(clientWidth, clientHeight);
  camera.aspect = clientWidth / clientHeight;
  camera.updateProjectionMatrix();
  brushOverlay.setAttribute("width", clientWidth);
  brushOverlay.setAttribute("height", clientHeight);
});
resizeObserver.observe(host);

function animate() {
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

setActiveFace(activeFace);
animate();
