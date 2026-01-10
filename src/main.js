import "./style.css";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  edgeTable as EDGE_TABLE,
  triTable as TRI_TABLE
} from "three/examples/jsm/objects/MarchingCubes.js";

const host = document.querySelector("#canvas-host");
const scene = new THREE.Scene();

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
const initialWidth = host.clientWidth || window.innerWidth;
const initialHeight = host.clientHeight || window.innerHeight;
renderer.setSize(initialWidth, initialHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setClearColor(0x000000, 0);
host.appendChild(renderer.domElement);

const camera = new THREE.PerspectiveCamera(
  45,
  initialWidth / initialHeight,
  0.1,
  100
);
camera.position.set(2.8, 2.1, 2.8);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, 0, 0);
controls.mouseButtons = {
  LEFT: THREE.MOUSE.PAN,
  MIDDLE: THREE.MOUSE.DOLLY,
  RIGHT: THREE.MOUSE.ROTATE
};
controls.touches = {
  ONE: THREE.TOUCH.ROTATE,
  TWO: THREE.TOUCH.DOLLY_PAN
};
controls.update();

const ambient = new THREE.AmbientLight(0xffffff, 0.8);
scene.add(ambient);

const keyLight = new THREE.DirectionalLight(0xffffff, 1.3);
keyLight.position.set(3, 4, 2);
scene.add(keyLight);

const fillLight = new THREE.DirectionalLight(0xffffff, 0.45);
fillLight.position.set(-2, -1, -3);
scene.add(fillLight);

const cubeSize = 2;
const half = cubeSize / 2;
const planeGeo = new THREE.PlaneGeometry(cubeSize, cubeSize);
const faceCanvasSize = 512;

const brushOverlay = document.getElementById("brush-overlay");
const brushCircle = document.getElementById("brush-circle");
const falloffCircle = document.getElementById("falloff-circle");
const brushDot = document.getElementById("brush-dot");

const densityInput = document.getElementById("density");
const smoothingInput = document.getElementById("smoothing");
const brushSizeInput = document.getElementById("brush-size");
const rebuildButton = document.getElementById("rebuild");
const clearButton = document.getElementById("clear-all");

const densityValue = document.getElementById("density-value");
const smoothValue = document.getElementById("smooth-value");
const brushValue = document.getElementById("brush-value");
const meshStats = document.getElementById("mesh-stats");

const faceButtons = Array.from(document.querySelectorAll("[data-face]"));

function updateRange(input, output, formatter) {
  const value = Number(input.value);
  const percent =
    ((value - Number(input.min)) / (Number(input.max) - Number(input.min))) *
    100;
  input.style.setProperty("--val", `${percent}%`);
  if (output) {
    output.textContent = formatter ? formatter(value) : value;
  }
  return value;
}

function updateMeshStats(triangles) {
  const density = Number(densityInput.value);
  const faceCount = typeof triangles === "number" ? triangles : "--";
  meshStats.textContent = `Voxels: ${density}^3 | Faces: ${faceCount}`;
}

function drawFaceBase(ctx, label) {
  ctx.fillStyle = "#2a2e38";
  ctx.fillRect(0, 0, faceCanvasSize, faceCanvasSize);

  const step = faceCanvasSize / 16;
  ctx.strokeStyle = "rgba(255,255,255,0.18)";
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

  ctx.strokeStyle = "rgba(255,255,255,0.32)";
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, faceCanvasSize - 2, faceCanvasSize - 2);

  ctx.fillStyle = "rgba(255,255,255,0.3)";
  ctx.font = "20px Roboto, sans-serif";
  ctx.fillText(label, 14, 30);
}

function createFace(label, name) {
  const baseCanvas = document.createElement("canvas");
  baseCanvas.width = faceCanvasSize;
  baseCanvas.height = faceCanvasSize;
  const baseCtx = baseCanvas.getContext("2d");
  drawFaceBase(baseCtx, label);

  const maskCanvas = document.createElement("canvas");
  maskCanvas.width = faceCanvasSize;
  maskCanvas.height = faceCanvasSize;
  const maskCtx = maskCanvas.getContext("2d");
  maskCtx.fillStyle = "#000000";
  maskCtx.fillRect(0, 0, faceCanvasSize, faceCanvasSize);

  const displayCanvas = document.createElement("canvas");
  displayCanvas.width = faceCanvasSize;
  displayCanvas.height = faceCanvasSize;
  const displayCtx = displayCanvas.getContext("2d");
  displayCtx.drawImage(baseCanvas, 0, 0);

  const texture = new THREE.CanvasTexture(displayCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();

  const material = new THREE.MeshStandardMaterial({
    map: texture,
    color: 0xffffff,
    emissive: new THREE.Color(0x171a22),
    emissiveIntensity: 0.6,
    transparent: true,
    opacity: 0.98,
    roughness: 0.78,
    metalness: 0.08,
    side: THREE.DoubleSide
  });

  const mesh = new THREE.Mesh(planeGeo, material);

  const face = {
    name,
    label,
    mesh,
    baseCanvas,
    baseCtx,
    displayCanvas,
    displayCtx,
    maskCanvas,
    maskCtx,
    texture,
    hasPaint: false
  };

  mesh.userData.face = face;
  return face;
}

const faces = {
  bottom: createFace("Bottom", "bottom"),
  back: createFace("Back", "back"),
  side: createFace("Side", "side")
};

faces.bottom.mesh.rotation.x = -Math.PI / 2;
faces.bottom.mesh.position.y = -half;
scene.add(faces.bottom.mesh);

faces.back.mesh.position.z = -half;
scene.add(faces.back.mesh);

faces.side.mesh.rotation.y = Math.PI / 2;
faces.side.mesh.position.x = -half;
scene.add(faces.side.mesh);

const faceMeshes = Object.values(faces).map((face) => face.mesh);

const bounds = new THREE.LineSegments(
  new THREE.EdgesGeometry(new THREE.BoxGeometry(cubeSize, cubeSize, cubeSize)),
  new THREE.LineBasicMaterial({
    color: 0x6c7280,
    transparent: true,
    opacity: 0.6
  })
);
scene.add(bounds);

const resultMaterial = new THREE.MeshStandardMaterial({
  color: 0xd6d9e0,
  roughness: 0.32,
  metalness: 0.12,
  side: THREE.DoubleSide
});

let resultMesh = null;
let rebuildTimer = null;

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

let isPainting = false;
let paintFace = null;
let lastUv = null;
let activeFace = "bottom";

const EDGE_CONNECTIONS = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 0],
  [4, 5],
  [5, 6],
  [6, 7],
  [7, 4],
  [0, 4],
  [1, 5],
  [2, 6],
  [3, 7]
];

function setActiveFace(face) {
  activeFace = face;
  faceButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.face === face);
  });

  Object.values(faces).forEach((item) => {
    const isActive = item.name === face;
    item.mesh.material.emissive.set(isActive ? 0x2a0b12 : 0x171a22);
    item.mesh.material.emissiveIntensity = isActive ? 0.7 : 0.45;
    item.mesh.material.opacity = isActive ? 1 : 0.95;
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

function getBrushRadius() {
  const size = Number(brushSizeInput.value);
  return 3 + (size / 100) * (faceCanvasSize * 0.13);
}

function uvToCanvas(uv) {
  return {
    x: Math.max(0, Math.min(faceCanvasSize - 1, uv.x * faceCanvasSize)),
    y: Math.max(
      0,
      Math.min(faceCanvasSize - 1, (1 - uv.y) * faceCanvasSize)
    )
  };
}

function paintStroke(face, fromUv, toUv) {
  if (!face) {
    return;
  }

  const from = uvToCanvas(fromUv);
  const to = uvToCanvas(toUv);
  const radius = getBrushRadius();

  face.displayCtx.lineCap = "round";
  face.displayCtx.lineJoin = "round";
  face.displayCtx.strokeStyle = "rgba(240, 40, 75, 0.9)";
  face.displayCtx.lineWidth = radius * 2;

  face.maskCtx.lineCap = "round";
  face.maskCtx.lineJoin = "round";
  face.maskCtx.strokeStyle = "#ffffff";
  face.maskCtx.lineWidth = radius * 2;

  face.displayCtx.beginPath();
  face.displayCtx.moveTo(from.x, from.y);
  face.displayCtx.lineTo(to.x, to.y);
  face.displayCtx.stroke();

  face.maskCtx.beginPath();
  face.maskCtx.moveTo(from.x, from.y);
  face.maskCtx.lineTo(to.x, to.y);
  face.maskCtx.stroke();

  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (dx * dx + dy * dy < 0.5) {
    face.displayCtx.fillStyle = "rgba(240, 40, 75, 0.95)";
    face.displayCtx.beginPath();
    face.displayCtx.arc(to.x, to.y, radius, 0, Math.PI * 2);
    face.displayCtx.fill();

    face.maskCtx.fillStyle = "#ffffff";
    face.maskCtx.beginPath();
    face.maskCtx.arc(to.x, to.y, radius, 0, Math.PI * 2);
    face.maskCtx.fill();
  }

  face.texture.needsUpdate = true;
  face.hasPaint = true;
}

function resetFace(face) {
  face.maskCtx.clearRect(0, 0, faceCanvasSize, faceCanvasSize);
  face.maskCtx.fillStyle = "#000000";
  face.maskCtx.fillRect(0, 0, faceCanvasSize, faceCanvasSize);

  face.displayCtx.clearRect(0, 0, faceCanvasSize, faceCanvasSize);
  face.displayCtx.drawImage(face.baseCanvas, 0, 0);
  face.texture.needsUpdate = true;
  face.hasPaint = false;
}

function getIntersection(event, targets) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hitTargets = Array.isArray(targets) ? targets : [targets];
  const hits = raycaster.intersectObjects(hitTargets, false);
  return hits.length ? hits[0] : null;
}

function scheduleRebuild(delay = 100) {
  if (rebuildTimer) {
    window.clearTimeout(rebuildTimer);
  }
  rebuildTimer = window.setTimeout(() => {
    rebuildTimer = null;
    rebuildMesh();
  }, delay);
}

function buildMaskLookup(face, res) {
  if (!face.hasPaint) {
    return null;
  }

  const data = face.maskCtx.getImageData(0, 0, faceCanvasSize, faceCanvasSize).data;
  const size = res + 1;
  const lookup = new Uint8Array(size * size);

  for (let y = 0; y <= res; y++) {
    const v = y / res;
    const py = Math.min(
      faceCanvasSize - 1,
      Math.floor((1 - v) * faceCanvasSize)
    );
    for (let x = 0; x <= res; x++) {
      const u = x / res;
      const px = Math.min(faceCanvasSize - 1, Math.floor(u * faceCanvasSize));
      const idx = (py * faceCanvasSize + px) * 4;
      lookup[x + y * size] = data[idx] > 10 ? 1 : 0;
    }
  }

  return lookup;
}

function buildField(res) {
  const paddedRes = res + 2;
  const size = paddedRes + 1;
  const slice = size * size;
  const field = new Float32Array(size * size * size);
  const maskSize = res + 1;

  const bottomMask = buildMaskLookup(faces.bottom, res);
  const backMask = buildMaskLookup(faces.back, res);
  const sideMask = buildMaskLookup(faces.side, res);

  for (let z = 0; z <= paddedRes; z++) {
    const zOffset = z * slice;
    const zi = z - 1;
    const invZ = res - zi;
    const bottomOffset = invZ * maskSize;
    for (let y = 0; y <= paddedRes; y++) {
      const yOffset = y * size;
      const yi = y - 1;
      const backOffset = yi * maskSize;
      const sideOffset = yi * maskSize;
      for (let x = 0; x <= paddedRes; x++) {
        const xi = x - 1;
        let inside = true;
        if (xi < 0 || xi > res || yi < 0 || yi > res || zi < 0 || zi > res) {
          inside = false;
        } else {
          if (bottomMask && bottomMask[xi + bottomOffset] === 0) {
            inside = false;
          }
          if (backMask && backMask[xi + backOffset] === 0) {
            inside = false;
          }
          if (sideMask && sideMask[invZ + sideOffset] === 0) {
            inside = false;
          }
        }
        field[x + yOffset + zOffset] = inside ? 0 : 1;
      }
    }
  }

  return { field, paddedRes };
}

function smoothField(field, paddedRes, iterations) {
  if (iterations <= 0) {
    return field;
  }

  const size = paddedRes + 1;
  const slice = size * size;
  let current = field;
  let next = new Float32Array(field.length);

  for (let iter = 0; iter < iterations; iter++) {
    next.set(current);
    for (let z = 1; z < paddedRes; z++) {
      const zOffset = z * slice;
      for (let y = 1; y < paddedRes; y++) {
        const yOffset = y * size;
        const base = zOffset + yOffset;
        for (let x = 1; x < paddedRes; x++) {
          const idx = base + x;
          const sum =
            current[idx] +
            current[idx - 1] +
            current[idx + 1] +
            current[idx - size] +
            current[idx + size] +
            current[idx - slice] +
            current[idx + slice];
          next[idx] = sum / 7;
        }
      }
    }
    const swap = current;
    current = next;
    next = swap;
  }

  return current;
}

function buildSurfaceGeometry(field, res, paddedRes) {
  const size = paddedRes + 1;
  const slice = size * size;
  const positions = [];
  const iso = 0.5;

  const step = cubeSize / res;
  const coords = new Float32Array(size);
  for (let i = 0; i <= paddedRes; i++) {
    coords[i] = -half - step + i * step;
  }

  const vertexList = new Float32Array(36);
  const cornerValues = new Float32Array(8);
  const cornerX = new Float32Array(8);
  const cornerY = new Float32Array(8);
  const cornerZ = new Float32Array(8);

  for (let z = 0; z < paddedRes; z++) {
    const z0 = coords[z];
    const z1 = coords[z + 1];
    const zOffset = z * slice;
    for (let y = 0; y < paddedRes; y++) {
      const y0 = coords[y];
      const y1 = coords[y + 1];
      const yOffset = y * size;
      for (let x = 0; x < paddedRes; x++) {
        const x0 = coords[x];
        const x1 = coords[x + 1];
        const idx = x + yOffset + zOffset;

        cornerValues[0] = field[idx];
        cornerValues[1] = field[idx + 1];
        cornerValues[2] = field[idx + 1 + size];
        cornerValues[3] = field[idx + size];
        cornerValues[4] = field[idx + slice];
        cornerValues[5] = field[idx + slice + 1];
        cornerValues[6] = field[idx + slice + 1 + size];
        cornerValues[7] = field[idx + slice + size];

        let cubeIndex = 0;
        if (cornerValues[0] < iso) cubeIndex |= 1;
        if (cornerValues[1] < iso) cubeIndex |= 2;
        if (cornerValues[2] < iso) cubeIndex |= 4;
        if (cornerValues[3] < iso) cubeIndex |= 8;
        if (cornerValues[4] < iso) cubeIndex |= 16;
        if (cornerValues[5] < iso) cubeIndex |= 32;
        if (cornerValues[6] < iso) cubeIndex |= 64;
        if (cornerValues[7] < iso) cubeIndex |= 128;

        const edgeMask = EDGE_TABLE[cubeIndex];
        if (edgeMask === 0) {
          continue;
        }

        cornerX[0] = x0;
        cornerX[1] = x1;
        cornerX[2] = x1;
        cornerX[3] = x0;
        cornerX[4] = x0;
        cornerX[5] = x1;
        cornerX[6] = x1;
        cornerX[7] = x0;

        cornerY[0] = y0;
        cornerY[1] = y0;
        cornerY[2] = y1;
        cornerY[3] = y1;
        cornerY[4] = y0;
        cornerY[5] = y0;
        cornerY[6] = y1;
        cornerY[7] = y1;

        cornerZ[0] = z0;
        cornerZ[1] = z0;
        cornerZ[2] = z0;
        cornerZ[3] = z0;
        cornerZ[4] = z1;
        cornerZ[5] = z1;
        cornerZ[6] = z1;
        cornerZ[7] = z1;

        for (let edge = 0; edge < 12; edge++) {
          if (edgeMask & (1 << edge)) {
            const [a, b] = EDGE_CONNECTIONS[edge];
            const v1 = cornerValues[a];
            const v2 = cornerValues[b];
            const denom = v2 - v1;
            const t = denom === 0 ? 0.5 : (iso - v1) / denom;
            const offset = edge * 3;
            vertexList[offset] = cornerX[a] + t * (cornerX[b] - cornerX[a]);
            vertexList[offset + 1] =
              cornerY[a] + t * (cornerY[b] - cornerY[a]);
            vertexList[offset + 2] =
              cornerZ[a] + t * (cornerZ[b] - cornerZ[a]);
          }
        }

        const triOffset = cubeIndex * 16;
        for (let i = 0; i < 16; i += 3) {
          const e0 = TRI_TABLE[triOffset + i];
          if (e0 === -1) {
            break;
          }
          const e1 = TRI_TABLE[triOffset + i + 1];
          const e2 = TRI_TABLE[triOffset + i + 2];

          positions.push(
            vertexList[e0 * 3],
            vertexList[e0 * 3 + 1],
            vertexList[e0 * 3 + 2],
            vertexList[e1 * 3],
            vertexList[e1 * 3 + 1],
            vertexList[e1 * 3 + 2],
            vertexList[e2 * 3],
            vertexList[e2 * 3 + 1],
            vertexList[e2 * 3 + 2]
          );
        }
      }
    }
  }

  if (positions.length === 0) {
    return { geometry: null, triangles: 0 };
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3)
  );
  geometry.computeVertexNormals();
  return { geometry, triangles: positions.length / 9 };
}

function rebuildMesh() {
  const density = Number(densityInput.value);
  const smoothIterations = Number(smoothingInput.value);

  const anyPaint =
    faces.bottom.hasPaint || faces.back.hasPaint || faces.side.hasPaint;
  if (!anyPaint) {
    clearResult();
    updateMeshStats(0);
    return;
  }

  meshStats.textContent = "Building...";
  const { field: baseField, paddedRes } = buildField(density);
  const field = smoothField(baseField, paddedRes, smoothIterations);
  const { geometry, triangles } = buildSurfaceGeometry(field, density, paddedRes);

  if (!geometry) {
    clearResult();
    updateMeshStats(0);
    return;
  }

  if (!resultMesh) {
    resultMesh = new THREE.Mesh(geometry, resultMaterial);
    scene.add(resultMesh);
  } else {
    resultMesh.geometry.dispose();
    resultMesh.geometry = geometry;
  }

  updateMeshStats(Math.round(triangles));
}

function clearResult() {
  if (resultMesh) {
    scene.remove(resultMesh);
    resultMesh.geometry.dispose();
    resultMesh = null;
  }
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

  if (!isPainting) {
    return;
  }

  const hit = getIntersection(event, paintFace.mesh);
  if (!hit || !hit.uv) {
    return;
  }

  paintStroke(paintFace, lastUv || hit.uv, hit.uv);
  lastUv = hit.uv;
});

renderer.domElement.addEventListener("pointerleave", () => {
  setBrushVisible(false);
});

renderer.domElement.addEventListener("pointerdown", (event) => {
  if (event.button !== 0) {
    return;
  }

  const hit = getIntersection(event, faceMeshes);
  if (!hit || !hit.uv) {
    return;
  }

  event.preventDefault();
  isPainting = true;
  paintFace = hit.object.userData.face;
  lastUv = hit.uv;
  setActiveFace(paintFace.name);
  paintStroke(paintFace, hit.uv, hit.uv);
  controls.enabled = false;
  renderer.domElement.setPointerCapture(event.pointerId);
});

renderer.domElement.addEventListener("pointerup", (event) => {
  if (!isPainting) {
    return;
  }

  isPainting = false;
  paintFace = null;
  lastUv = null;
  controls.enabled = true;
  renderer.domElement.releasePointerCapture(event.pointerId);
  scheduleRebuild(120);
});

renderer.domElement.addEventListener("pointercancel", () => {
  isPainting = false;
  paintFace = null;
  lastUv = null;
  controls.enabled = true;
  scheduleRebuild(120);
});

const updateRendererSize = () => {
  const width = host.clientWidth || window.innerWidth;
  const height = host.clientHeight || window.innerHeight;
  renderer.setSize(width, height);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  brushOverlay.setAttribute("width", width);
  brushOverlay.setAttribute("height", height);
};

[densityInput, smoothingInput, brushSizeInput].forEach((input) => {
  input.addEventListener("input", () => {
    if (input === densityInput) {
      updateRange(input, densityValue);
      updateMeshStats();
      scheduleRebuild(200);
    } else if (input === smoothingInput) {
      updateRange(input, smoothValue, (value) => `${value}x`);
      scheduleRebuild(200);
    } else {
      updateRange(input, brushValue, (value) => `${value}%`);
      updateBrushRadii();
    }
  });
});

faceButtons.forEach((button) => {
  button.addEventListener("click", () => setActiveFace(button.dataset.face));
});

rebuildButton.addEventListener("click", () => rebuildMesh());

clearButton.addEventListener("click", () => {
  Object.values(faces).forEach((face) => resetFace(face));
  clearResult();
  updateMeshStats(0);
});

updateRange(densityInput, densityValue);
updateRange(smoothingInput, smoothValue, (value) => `${value}x`);
updateRange(brushSizeInput, brushValue, (value) => `${value}%`);
updateBrushRadii();
updateMeshStats(0);
setActiveFace("bottom");

updateRendererSize();
if ("ResizeObserver" in window) {
  const resizeObserver = new ResizeObserver(updateRendererSize);
  resizeObserver.observe(host);
} else {
  window.addEventListener("resize", updateRendererSize);
}

function animate() {
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

animate();
