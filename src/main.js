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
camera.position.set(1.78, 2.1, 4.29);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, 0, 0);
controls.mouseButtons = {
  LEFT: THREE.MOUSE.ROTATE,
  MIDDLE: THREE.MOUSE.DOLLY,
  RIGHT: THREE.MOUSE.PAN
};
controls.touches = {
  ONE: THREE.TOUCH.ROTATE,
  TWO: THREE.TOUCH.DOLLY_PAN
};
controls.update();
controls.addEventListener("change", () => {
  refreshBrushFromPointer();
});
const defaultCameraPosition = camera.position.clone();
const defaultCameraTarget = controls.target.clone();
const cameraTween = {
  active: false,
  startTime: 0,
  duration: 600,
  startPos: new THREE.Vector3(),
  startTarget: new THREE.Vector3(),
  endPos: defaultCameraPosition.clone(),
  endTarget: defaultCameraTarget.clone()
};

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
const meshInset = 0.01;
const planeGeo = new THREE.PlaneGeometry(cubeSize, cubeSize);
const faceCanvasSize = 512;
const paintColor = "rgba(240, 40, 75, 0.45)";
const paintCanvas = document.createElement("canvas");
paintCanvas.width = faceCanvasSize;
paintCanvas.height = faceCanvasSize;
const paintCtx = paintCanvas.getContext("2d");

const brushOverlay = document.getElementById("brush-overlay");
const brushCircle = document.getElementById("brush-circle");
const brushDot = document.getElementById("brush-dot");

const densityInput = document.getElementById("density");
const smoothingInput = document.getElementById("smoothing");
const brushSizeInput = document.getElementById("brush-size");
const wireframeToggle = document.getElementById("wireframe");
const projectionsToggle = document.getElementById("projections");
const cubeToggle = document.getElementById("cube-toggle");
const rebuildButton = document.getElementById("rebuild");
const clearButton = document.getElementById("clear-all");
const undoButton = document.getElementById("undo-action");
const redoButton = document.getElementById("redo-action");
const historyLimit = 50;

const densityValue = document.getElementById("density-value");
const smoothValue = document.getElementById("smooth-value");
const brushValue = document.getElementById("brush-value");
const wfOn = document.getElementById("wf-on");
const wfOff = document.getElementById("wf-off");
const projOn = document.getElementById("proj-on");
const projOff = document.getElementById("proj-off");
const cubeOn = document.getElementById("cube-on");
const cubeOff = document.getElementById("cube-off");
const meshStats = document.getElementById("mesh-stats");
const panel = document.getElementById("panel");
const panelHandle = document.getElementById("panel-handle");
const panelHandleBottom = document.getElementById("panel-handle-bottom");

let isPanelDragging = false;
let panelDragStart = { x: 0, y: 0 };
let panelPointerStart = { x: 0, y: 0 };

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

function updateMeshStats(faces, vertices) {
  const faceCount = typeof faces === "number" ? faces : "--";
  const vertexCount = typeof vertices === "number" ? vertices : 0;
  meshStats.textContent = `Faces: ${faceCount} | Vertices: ${vertexCount}`;
}

function startPanelDrag(event) {
  if (event.button !== 0 && event.pointerType === "mouse") {
    return;
  }
  const rect = panel.getBoundingClientRect();
  isPanelDragging = true;
  panelDragStart = { x: rect.left, y: rect.top };
  panelPointerStart = { x: event.clientX, y: event.clientY };
  panel.style.left = `${panelDragStart.x}px`;
  panel.style.top = `${panelDragStart.y}px`;
  panel.style.right = "auto";
  panel.style.bottom = "auto";
  panel.setPointerCapture(event.pointerId);
  event.preventDefault();
}

function onPanelDrag(event) {
  if (!isPanelDragging) {
    return;
  }
  const dx = event.clientX - panelPointerStart.x;
  const dy = event.clientY - panelPointerStart.y;
  const width = panel.offsetWidth;
  const height = panel.offsetHeight;
  const maxX = Math.max(8, window.innerWidth - width - 8);
  const maxY = Math.max(8, window.innerHeight - height - 8);
  const nextX = Math.min(Math.max(8, panelDragStart.x + dx), maxX);
  const nextY = Math.min(Math.max(8, panelDragStart.y + dy), maxY);
  panel.style.left = `${nextX}px`;
  panel.style.top = `${nextY}px`;
}

function stopPanelDrag(event) {
  if (!isPanelDragging) {
    return;
  }
  isPanelDragging = false;
  panel.releasePointerCapture(event.pointerId);
}

function getDensityValue() {
  return Math.max(2, Math.round(Number(densityInput.value) || 16));
}

function drawFaceBase(ctx, label, density) {
  ctx.fillStyle = "#2a2e38";
  ctx.fillRect(0, 0, faceCanvasSize, faceCanvasSize);

  const divisions = Math.max(2, density);
  const step = faceCanvasSize / divisions;
  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.lineWidth = 1;
  for (let i = 0; i <= divisions; i++) {
    const pos = i * step;
    const linePos = Math.min(faceCanvasSize - 0.5, Math.round(pos) + 0.5);
    ctx.beginPath();
    ctx.moveTo(linePos, 0);
    ctx.lineTo(linePos, faceCanvasSize);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, linePos);
    ctx.lineTo(faceCanvasSize, linePos);
    ctx.stroke();
  }

  ctx.strokeStyle = "rgba(255,255,255,0.32)";
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, faceCanvasSize - 2, faceCanvasSize - 2);
}

function createLabelSprite(text) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  const labelText = String(text).toUpperCase();

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.font = "28px Roboto, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(255,255,255,0.65)";
  ctx.fillText(labelText, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;

  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(0.6, 0.15, 1);
  return sprite;
}

function createFace(
  label,
  name,
  labelNormalSign = 1,
  labelEdgeSign = 1,
  labelExtraOffset = 0,
  useTextHeightOffset = false,
  labelNormalMagnitude = 0.03
) {
  const baseCanvas = document.createElement("canvas");
  baseCanvas.width = faceCanvasSize;
  baseCanvas.height = faceCanvasSize;
  const baseCtx = baseCanvas.getContext("2d");
  drawFaceBase(baseCtx, label, getDensityValue());

  const maskCanvas = document.createElement("canvas");
  maskCanvas.width = faceCanvasSize;
  maskCanvas.height = faceCanvasSize;
  const maskCtx = maskCanvas.getContext("2d");
  maskCtx.clearRect(0, 0, faceCanvasSize, faceCanvasSize);

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
  const labelSprite = createLabelSprite(label);
  const labelOffset = 0.06;
  const labelNormalOffset = labelNormalMagnitude * labelNormalSign;
  const extraOffset =
    labelExtraOffset + (useTextHeightOffset ? labelSprite.scale.y : 0);
  labelSprite.position.set(
    0,
    (half + labelOffset + extraOffset) * labelEdgeSign,
    labelNormalOffset
  );
  mesh.add(labelSprite);

  const face = {
    name,
    label,
    mesh,
    labelSprite,
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
  bottom: createFace("Bottom", "bottom", -1, -1, 0, true, 0.06),
  back: createFace("Back", "back", -1, 1, 0, true, 0.06),
  side: createFace("Side", "side", -1, 1, 0, true, 0.06)
};

faces.bottom.mesh.rotation.x = -Math.PI / 2;
faces.bottom.mesh.position.y = -half;

faces.back.mesh.position.z = -half;

faces.side.mesh.rotation.y = Math.PI / 2;
faces.side.mesh.position.x = -half;

const faceMeshes = Object.values(faces).map((face) => face.mesh);

const bounds = new THREE.LineSegments(
  new THREE.EdgesGeometry(new THREE.BoxGeometry(cubeSize, cubeSize, cubeSize)),
  new THREE.LineBasicMaterial({
    color: 0x6c7280,
    transparent: true,
    opacity: 0.6
  })
);
const cubeGroup = new THREE.Group();
cubeGroup.add(bounds);
faceMeshes.forEach((mesh) => cubeGroup.add(mesh));
scene.add(cubeGroup);

const resultMaterial = new THREE.MeshStandardMaterial({
  color: 0xd6d9e0,
  roughness: 0.32,
  metalness: 0.12,
  side: THREE.DoubleSide
});
const wireframeMaterial = new THREE.MeshBasicMaterial({
  color: 0x555a63,
  wireframe: true,
  transparent: true,
  opacity: 0.7,
  depthWrite: false,
  polygonOffset: true,
  polygonOffsetFactor: -1,
  polygonOffsetUnits: -1
});
const projectionMaterial = new THREE.MeshStandardMaterial({
  color: 0xf04a5b,
  roughness: 0.4,
  metalness: 0.05,
  transparent: true,
  opacity: 0.2,
  depthWrite: false,
  side: THREE.DoubleSide
});

let resultMesh = null;
let wireframeMesh = null;
const projectionMeshes = {
  bottom: null,
  back: null,
  side: null
};
let rebuildTimer = null;

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const brushPointer = { x: 0, y: 0, valid: false };
let brushRadiusScreen = 12;
let isPointerInCanvas = false;

const axisX = new THREE.Vector3();
const axisY = new THREE.Vector3();
const worldCenter = new THREE.Vector3();
const worldU = new THREE.Vector3();
const worldV = new THREE.Vector3();
const screenCenter = new THREE.Vector3();
const screenU = new THREE.Vector3();
const screenV = new THREE.Vector3();
const basisMatrix = new THREE.Matrix3();

let isPainting = false;
let paintMode = "draw";
let paintFace = null;
let lastUv = null;
let activeFace = "bottom";
let strokeModified = false;
let wireframeEnabled = false;
let projectionsEnabled = false;
let cubeEnabled = true;
let shiftOrbitSwap = false;
let originalLeftButton = null;
let shiftPanSwap = false;
let originalRightButton = null;
const history = [];
const redoStack = [];

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
  Object.values(faces).forEach((item) => {
    const isActive = item.name === face;
    item.mesh.material.emissive.set(isActive ? 0x2a0b12 : 0x171a22);
    item.mesh.material.emissiveIntensity = isActive ? 0.7 : 0.45;
    item.mesh.material.opacity = 0.95;
  });
}

function resetCamera() {
  cameraTween.active = true;
  cameraTween.startTime = performance.now();
  cameraTween.startPos.copy(camera.position);
  cameraTween.startTarget.copy(controls.target);
  cameraTween.endPos.copy(defaultCameraPosition);
  cameraTween.endTarget.copy(defaultCameraTarget);
}

function syncWireframeToggle() {
  wireframeToggle.checked = !wireframeEnabled;
  wfOn.classList.toggle("active", wireframeEnabled);
  wfOff.classList.toggle("active", !wireframeEnabled);
  if (wireframeMesh) {
    wireframeMesh.visible = wireframeEnabled;
  }
}

function syncProjectionsToggle() {
  projectionsToggle.checked = !projectionsEnabled;
  projOn.classList.toggle("active", projectionsEnabled);
  projOff.classList.toggle("active", !projectionsEnabled);
  Object.values(projectionMeshes).forEach((mesh) => {
    if (mesh) {
      mesh.visible = projectionsEnabled;
    }
  });
}

function syncCubeToggle() {
  cubeToggle.checked = !cubeEnabled;
  cubeOn.classList.toggle("active", cubeEnabled);
  cubeOff.classList.toggle("active", !cubeEnabled);
  cubeGroup.visible = cubeEnabled;
}

function enableShiftOrbitSwap() {
  if (shiftOrbitSwap) {
    return;
  }
  shiftOrbitSwap = true;
  originalLeftButton = controls.mouseButtons.LEFT;
  controls.mouseButtons.LEFT = THREE.MOUSE.PAN;
}

function disableShiftOrbitSwap() {
  if (!shiftOrbitSwap) {
    return;
  }
  controls.mouseButtons.LEFT = originalLeftButton ?? THREE.MOUSE.ROTATE;
  originalLeftButton = null;
  shiftOrbitSwap = false;
}

function enableShiftPanSwap() {
  if (shiftPanSwap) {
    return;
  }
  shiftPanSwap = true;
  originalRightButton = controls.mouseButtons.RIGHT;
  controls.mouseButtons.RIGHT = THREE.MOUSE.ROTATE;
}

function disableShiftPanSwap() {
  if (!shiftPanSwap) {
    return;
  }
  controls.mouseButtons.RIGHT = originalRightButton ?? THREE.MOUSE.PAN;
  originalRightButton = null;
  shiftPanSwap = false;
}

function updateBrushRadii() {
  brushDot.setAttribute("r", 2.5);
  refreshBrushFromPointer();
}

function setBrushVisible(visible) {
  const opacity = visible ? "1" : "0";
  brushCircle.style.opacity = opacity;
  brushDot.style.opacity = opacity;
}

function getBrushRadius() {
  const size = Number(brushSizeInput.value);
  return 3 + (size / 100) * (faceCanvasSize * 0.13);
}

function getBrushWorldRadius() {
  return (getBrushRadius() / faceCanvasSize) * cubeSize;
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

function paintStroke(face, fromUv, toUv, mode) {
  if (!face) {
    return;
  }

  const from = uvToCanvas(fromUv);
  const to = uvToCanvas(toUv);
  const radius = getBrushRadius();

  const isErase = mode === "erase";
  const composite = isErase ? "destination-out" : "source-over";
  face.maskCtx.lineCap = "round";
  face.maskCtx.lineJoin = "round";
  face.maskCtx.strokeStyle = isErase ? "rgba(0,0,0,1)" : "#ffffff";
  face.maskCtx.lineWidth = radius * 2;
  face.maskCtx.globalCompositeOperation = composite;

  face.maskCtx.beginPath();
  face.maskCtx.moveTo(from.x, from.y);
  face.maskCtx.lineTo(to.x, to.y);
  face.maskCtx.stroke();

  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (dx * dx + dy * dy < 0.5) {
    face.maskCtx.globalCompositeOperation = composite;
    face.maskCtx.fillStyle = isErase ? "rgba(0,0,0,1)" : "#ffffff";
    face.maskCtx.beginPath();
    face.maskCtx.arc(to.x, to.y, radius, 0, Math.PI * 2);
    face.maskCtx.fill();
  }

  face.maskCtx.globalCompositeOperation = "source-over";
  if (mode !== "erase") {
    face.hasPaint = true;
  }
  refreshFaceDisplay(face);
  strokeModified = true;
}

function hasAnyPaint(face) {
  const data = face.maskCtx.getImageData(0, 0, faceCanvasSize, faceCanvasSize).data;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] > 10) {
      return true;
    }
  }
  return false;
}

function refreshFaceDisplay(face) {
  face.displayCtx.clearRect(0, 0, faceCanvasSize, faceCanvasSize);
  face.displayCtx.drawImage(face.baseCanvas, 0, 0);
  if (!face.hasPaint) {
    face.texture.needsUpdate = true;
    return;
  }

  paintCtx.clearRect(0, 0, faceCanvasSize, faceCanvasSize);
  paintCtx.fillStyle = paintColor;
  paintCtx.fillRect(0, 0, faceCanvasSize, faceCanvasSize);
  paintCtx.globalCompositeOperation = "destination-in";
  paintCtx.drawImage(face.maskCanvas, 0, 0);
  paintCtx.globalCompositeOperation = "source-over";

  face.displayCtx.drawImage(paintCanvas, 0, 0);
  face.texture.needsUpdate = true;
}

function resetFace(face) {
  face.maskCtx.clearRect(0, 0, faceCanvasSize, faceCanvasSize);
  face.hasPaint = false;
  refreshFaceDisplay(face);
}

function snapshotFace(face) {
  return {
    data: face.maskCtx.getImageData(0, 0, faceCanvasSize, faceCanvasSize),
    hasPaint: face.hasPaint
  };
}

function snapshotMasks() {
  return {
    bottom: snapshotFace(faces.bottom),
    back: snapshotFace(faces.back),
    side: snapshotFace(faces.side)
  };
}

function restoreFace(face, snapshot) {
  if (!snapshot) {
    return;
  }
  face.maskCtx.putImageData(snapshot.data, 0, 0);
  face.hasPaint = snapshot.hasPaint;
  refreshFaceDisplay(face);
}

function restoreSnapshot(snapshot) {
  if (!snapshot) {
    return;
  }
  restoreFace(faces.bottom, snapshot.bottom);
  restoreFace(faces.back, snapshot.back);
  restoreFace(faces.side, snapshot.side);
  scheduleRebuild(0);
}

function pushHistory() {
  if (history.length >= historyLimit) {
    history.shift();
  }
  history.push(snapshotMasks());
  redoStack.length = 0;
}

function updateFaceGrids(density) {
  Object.values(faces).forEach((face) => {
    drawFaceBase(face.baseCtx, face.label, density);
    refreshFaceDisplay(face);
  });
}

function getIntersectionAt(clientX, clientY, targets) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hitTargets = Array.isArray(targets) ? targets : [targets];
  const hits = raycaster.intersectObjects(hitTargets, false);
  return hits.length ? hits[0] : null;
}

function projectToScreen(vec, out) {
  const rect = renderer.domElement.getBoundingClientRect();
  out.copy(vec).project(camera);
  out.x = (out.x * 0.5 + 0.5) * rect.width + rect.left;
  out.y = (-out.y * 0.5 + 0.5) * rect.height + rect.top;
  return out;
}

function computeBrushScreenRadius(hit) {
  if (!hit || !hit.object) {
    return brushRadiusScreen;
  }

  const mesh = hit.object;
  mesh.updateMatrixWorld(true);
  basisMatrix.setFromMatrix4(mesh.matrixWorld);
  axisX.set(1, 0, 0).applyMatrix3(basisMatrix).normalize();
  axisY.set(0, 1, 0).applyMatrix3(basisMatrix).normalize();

  const worldRadius = getBrushWorldRadius();
  worldCenter.copy(hit.point);
  worldU.copy(hit.point).addScaledVector(axisX, worldRadius);
  worldV.copy(hit.point).addScaledVector(axisY, worldRadius);

  projectToScreen(worldCenter, screenCenter);
  projectToScreen(worldU, screenU);
  projectToScreen(worldV, screenV);

  const radiusU = Math.hypot(
    screenU.x - screenCenter.x,
    screenU.y - screenCenter.y
  );
  const radiusV = Math.hypot(
    screenV.x - screenCenter.x,
    screenV.y - screenCenter.y
  );

  return Math.max(2, (radiusU + radiusV) * 0.5);
}

function updateBrushOverlay(clientX, clientY, hit) {
  brushPointer.x = clientX;
  brushPointer.y = clientY;
  brushPointer.valid = true;

  if (!isPointerInCanvas) {
    return;
  }

  brushCircle.setAttribute("cx", clientX);
  brushCircle.setAttribute("cy", clientY);
  brushDot.setAttribute("cx", clientX);
  brushDot.setAttribute("cy", clientY);
  setBrushVisible(true);

  if (hit) {
    brushRadiusScreen = computeBrushScreenRadius(hit);
  }
  brushCircle.setAttribute("r", brushRadiusScreen);
}

function refreshBrushFromPointer() {
  if (!brushPointer.valid || !isPointerInCanvas) {
    return;
  }
  const hitTargets = isPainting && paintFace ? paintFace.mesh : faceMeshes;
  const hit = getIntersectionAt(brushPointer.x, brushPointer.y, hitTargets);
  updateBrushOverlay(brushPointer.x, brushPointer.y, hit);
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
  const size = res;
  const lookup = new Uint8Array(size * size);

  for (let y = 0; y < res; y++) {
    const v = (y + 0.5) / res;
    const py = Math.min(
      faceCanvasSize - 1,
      Math.floor((1 - v) * faceCanvasSize)
    );
    for (let x = 0; x < res; x++) {
      const u = (x + 0.5) / res;
      const px = Math.min(faceCanvasSize - 1, Math.floor(u * faceCanvasSize));
      const idx = (py * faceCanvasSize + px) * 4;
      if (data[idx + 3] > 10) {
        lookup[x + y * size] = 1;
      }
    }
  }

  return lookup;
}

function getMasks(res) {
  return {
    bottomMask: buildMaskLookup(faces.bottom, res),
    backMask: buildMaskLookup(faces.back, res),
    sideMask: buildMaskLookup(faces.side, res)
  };
}

function buildField(res, masks) {
  const paddedRes = res + 1;
  const size = paddedRes + 1;
  const slice = size * size;
  const field = new Float32Array(size * size * size);
  const maskSize = res;

  const {
    bottomMask,
    backMask,
    sideMask
  } = masks || getMasks(res);

  for (let z = 0; z <= paddedRes; z++) {
    const zOffset = z * slice;
    const zi = z - 1;
    const invZ = res - 1 - zi;
    const bottomOffset = invZ * maskSize;
    for (let y = 0; y <= paddedRes; y++) {
      const yOffset = y * size;
      const yi = y - 1;
      const backOffset = yi * maskSize;
      const sideOffset = yi * maskSize;
      for (let x = 0; x <= paddedRes; x++) {
        const xi = x - 1;
        let inside = true;
        if (
          xi < 0 ||
          xi >= res ||
          yi < 0 ||
          yi >= res ||
          zi < 0 ||
          zi >= res
        ) {
          inside = false;
        } else {
          if (bottomMask) {
            if (bottomMask[xi + bottomOffset] === 0) {
              inside = false;
            }
          }
          if (backMask && backMask[xi + backOffset] === 0) {
            inside = false;
          }
          if (sideMask) {
            if (sideMask[invZ + sideOffset] === 0) {
              inside = false;
            }
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
    coords[i] = -half - step * 0.5 + i * step;
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
    return { geometry: null, triangles: 0, vertices: 0 };
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3)
  );
  geometry.computeVertexNormals();
  return {
    geometry,
    triangles: positions.length / 9,
    vertices: positions.length / 3
  };
}

function clearProjectionMeshes() {
  Object.keys(projectionMeshes).forEach((key) => {
    const mesh = projectionMeshes[key];
    if (!mesh) {
      return;
    }
    scene.remove(mesh);
    mesh.geometry.dispose();
    projectionMeshes[key] = null;
  });
}

function updateProjectionMesh(faceName, mask, density, smoothIterations) {
  const existing = projectionMeshes[faceName];
  if (!mask) {
    if (existing) {
      scene.remove(existing);
      existing.geometry.dispose();
      projectionMeshes[faceName] = null;
    }
    return;
  }

  const masks = { bottomMask: null, backMask: null, sideMask: null };
  if (faceName === "bottom") {
    masks.bottomMask = mask;
  } else if (faceName === "back") {
    masks.backMask = mask;
  } else if (faceName === "side") {
    masks.sideMask = mask;
  }

  const { field, paddedRes } = buildField(density, masks);
  const smoothedField = smoothField(field, paddedRes, smoothIterations);
  const { geometry } = buildSurfaceGeometry(smoothedField, density, paddedRes);

  if (!geometry) {
    if (existing) {
      scene.remove(existing);
      existing.geometry.dispose();
      projectionMeshes[faceName] = null;
    }
    return;
  }

  const scale = (cubeSize - meshInset * 2) / cubeSize;
  if (!existing) {
    const projectionMesh = new THREE.Mesh(geometry, projectionMaterial);
    projectionMesh.visible = projectionsEnabled;
    projectionMesh.renderOrder = 1;
    projectionMesh.scale.setScalar(scale);
    projectionMeshes[faceName] = projectionMesh;
    scene.add(projectionMesh);
  } else {
    existing.geometry.dispose();
    existing.geometry = geometry;
    existing.visible = projectionsEnabled;
    existing.scale.setScalar(scale);
  }
}

function updateProjectionMeshes(density, smoothIterations, masks) {
  if (!projectionsEnabled) {
    clearProjectionMeshes();
    return;
  }
  updateProjectionMesh("bottom", masks.bottomMask, density, smoothIterations);
  updateProjectionMesh("back", masks.backMask, density, smoothIterations);
  updateProjectionMesh("side", masks.sideMask, density, smoothIterations);
}

function rebuildMesh() {
  const density = Number(densityInput.value);
  const smoothIterations = Number(smoothingInput.value);

  const anyPaint =
    faces.bottom.hasPaint || faces.back.hasPaint || faces.side.hasPaint;
  if (!anyPaint) {
    clearResult();
    updateMeshStats(0, 0);
    return;
  }

  meshStats.textContent = "Building...";
  const masks = getMasks(density);
  const { field: baseField, paddedRes } = buildField(density, masks);
  const field = smoothField(baseField, paddedRes, smoothIterations);
  const { geometry, triangles, vertices } = buildSurfaceGeometry(
    field,
    density,
    paddedRes
  );

  if (!geometry) {
    clearResult();
    updateMeshStats(0, 0);
    return;
  }

  const scale = (cubeSize - meshInset * 2) / cubeSize;
  const oldGeometry = resultMesh ? resultMesh.geometry : null;

  if (!resultMesh) {
    resultMesh = new THREE.Mesh(geometry, resultMaterial);
    scene.add(resultMesh);
  } else {
    resultMesh.geometry = geometry;
  }
  resultMesh.scale.setScalar(scale);

  if (!wireframeMesh) {
    wireframeMesh = new THREE.Mesh(geometry, wireframeMaterial);
    wireframeMesh.visible = wireframeEnabled;
    wireframeMesh.renderOrder = 2;
    scene.add(wireframeMesh);
  } else {
    wireframeMesh.geometry = geometry;
    wireframeMesh.visible = wireframeEnabled;
  }
  wireframeMesh.scale.setScalar(scale);

  if (oldGeometry) {
    oldGeometry.dispose();
  }

  updateMeshStats(Math.round(triangles), Math.round(vertices));
  updateProjectionMeshes(density, smoothIterations, masks);
}

function clearResult() {
  const sharedGeometry = resultMesh
    ? resultMesh.geometry
    : wireframeMesh
      ? wireframeMesh.geometry
      : null;
  if (resultMesh) {
    scene.remove(resultMesh);
    resultMesh = null;
  }
  if (wireframeMesh) {
    scene.remove(wireframeMesh);
    wireframeMesh = null;
  }
  if (sharedGeometry) {
    sharedGeometry.dispose();
  }
  clearProjectionMeshes();
}

renderer.domElement.addEventListener("pointermove", (event) => {
  isPointerInCanvas = true;
  const { clientX, clientY } = event;
  const hitTargets = isPainting && paintFace ? paintFace.mesh : faceMeshes;
  const hit = getIntersectionAt(clientX, clientY, hitTargets);
  updateBrushOverlay(clientX, clientY, hit);

  if (!isPainting) {
    return;
  }

  if (!hit || !hit.uv) {
    return;
  }

  paintStroke(paintFace, lastUv || hit.uv, hit.uv, paintMode);
  lastUv = hit.uv;
});

renderer.domElement.addEventListener(
  "pointerdown",
  (event) => {
    if (event.button === 0 && event.shiftKey) {
      disableShiftPanSwap();
      enableShiftOrbitSwap();
    }
  },
  { capture: true }
);

renderer.domElement.addEventListener(
  "pointerdown",
  (event) => {
    if (event.button === 2 && event.shiftKey) {
      disableShiftOrbitSwap();
      enableShiftPanSwap();
    }
  },
  { capture: true }
);

renderer.domElement.addEventListener("pointerleave", () => {
  isPointerInCanvas = false;
  disableShiftOrbitSwap();
  disableShiftPanSwap();
  setBrushVisible(false);
});

renderer.domElement.addEventListener("pointerdown", (event) => {
  if (event.button !== 0 && event.button !== 2) {
    return;
  }
  isPointerInCanvas = true;
  if (event.button === 0 && event.shiftKey) {
    return;
  }
  if (event.button === 2 && event.shiftKey) {
    return;
  }

  const hit = getIntersectionAt(event.clientX, event.clientY, faceMeshes);
  if (!hit || !hit.uv) {
    return;
  }

  updateBrushOverlay(event.clientX, event.clientY, hit);
  event.preventDefault();
  isPainting = true;
  strokeModified = false;
  paintMode = event.button === 2 ? "erase" : "draw";
  paintFace = hit.object.userData.face;
  lastUv = hit.uv;
  setActiveFace(paintFace.name);
  paintStroke(paintFace, hit.uv, hit.uv, paintMode);
  controls.enabled = false;
  renderer.domElement.setPointerCapture(event.pointerId);
});

renderer.domElement.addEventListener("pointerup", (event) => {
  if (!isPainting) {
    disableShiftOrbitSwap();
    disableShiftPanSwap();
    return;
  }

  const finishedFace = paintFace;
  const finishedMode = paintMode;
  isPainting = false;
  paintMode = "draw";
  paintFace = null;
  lastUv = null;
  controls.enabled = true;
  renderer.domElement.releasePointerCapture(event.pointerId);
  disableShiftOrbitSwap();
  disableShiftPanSwap();
  if (finishedMode === "erase" && finishedFace) {
    finishedFace.hasPaint = hasAnyPaint(finishedFace);
    refreshFaceDisplay(finishedFace);
  }
  if (strokeModified) {
    pushHistory();
    strokeModified = false;
  }
  scheduleRebuild(120);
});

renderer.domElement.addEventListener("pointercancel", () => {
  const finishedFace = paintFace;
  const finishedMode = paintMode;
  isPainting = false;
  paintMode = "draw";
  paintFace = null;
  lastUv = null;
  controls.enabled = true;
  disableShiftOrbitSwap();
  disableShiftPanSwap();
  if (finishedMode === "erase" && finishedFace) {
    finishedFace.hasPaint = hasAnyPaint(finishedFace);
    refreshFaceDisplay(finishedFace);
  }
  if (strokeModified) {
    pushHistory();
    strokeModified = false;
  }
  scheduleRebuild(120);
});

renderer.domElement.addEventListener("contextmenu", (event) => {
  event.preventDefault();
});

const updateRendererSize = () => {
  const width = host.clientWidth || window.innerWidth;
  const height = host.clientHeight || window.innerHeight;
  renderer.setSize(width, height);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  brushOverlay.setAttribute("width", width);
  brushOverlay.setAttribute("height", height);
  refreshBrushFromPointer();
};

[densityInput, smoothingInput, brushSizeInput].forEach((input) => {
  input.addEventListener("input", () => {
    if (input === densityInput) {
      updateRange(input, densityValue);
      updateMeshStats();
      updateFaceGrids(getDensityValue());
      scheduleRebuild(200);
    } else if (input === smoothingInput) {
      updateRange(input, smoothValue);
      scheduleRebuild(200);
    } else {
      updateRange(input, brushValue);
      updateBrushRadii();
    }
  });
});

wireframeToggle.addEventListener("change", (event) => {
  wireframeEnabled = !event.target.checked;
  syncWireframeToggle();
});

projectionsToggle.addEventListener("change", (event) => {
  projectionsEnabled = !event.target.checked;
  syncProjectionsToggle();
  scheduleRebuild(0);
});

cubeToggle.addEventListener("change", (event) => {
  cubeEnabled = !event.target.checked;
  syncCubeToggle();
});

[panelHandle, panelHandleBottom].forEach((handle) => {
  handle.addEventListener("pointerdown", startPanelDrag);
});
window.addEventListener("pointermove", onPanelDrag);
window.addEventListener("pointerup", stopPanelDrag);
window.addEventListener("pointercancel", stopPanelDrag);

rebuildButton.addEventListener("click", () => resetCamera());

clearButton.addEventListener("click", () => {
  const hadPaint =
    faces.bottom.hasPaint || faces.back.hasPaint || faces.side.hasPaint;
  Object.values(faces).forEach((face) => resetFace(face));
  clearResult();
  updateMeshStats(0, 0);
  if (hadPaint) {
    pushHistory();
  }
});

undoButton.addEventListener("click", () => {
  if (history.length <= 1) {
    return;
  }
  const current = history.pop();
  if (current) {
    redoStack.push(current);
  }
  const snapshot = history[history.length - 1];
  restoreSnapshot(snapshot);
});

redoButton.addEventListener("click", () => {
  if (!redoStack.length) {
    return;
  }
  const snapshot = redoStack.pop();
  if (!snapshot) {
    return;
  }
  if (history.length >= historyLimit) {
    history.shift();
  }
  history.push(snapshot);
  restoreSnapshot(snapshot);
});

updateRange(densityInput, densityValue);
updateRange(smoothingInput, smoothValue);
updateRange(brushSizeInput, brushValue);
updateBrushRadii();
updateFaceGrids(getDensityValue());
updateMeshStats(0);
setActiveFace("bottom");
syncWireframeToggle();
syncProjectionsToggle();
syncCubeToggle();
pushHistory();

updateRendererSize();
if ("ResizeObserver" in window) {
  const resizeObserver = new ResizeObserver(updateRendererSize);
  resizeObserver.observe(host);
} else {
  window.addEventListener("resize", updateRendererSize);
}

function animate() {
  if (cameraTween.active) {
    const elapsed = performance.now() - cameraTween.startTime;
    const t = Math.min(1, elapsed / cameraTween.duration);
    const eased = t * t * (3 - 2 * t);
    camera.position.lerpVectors(cameraTween.startPos, cameraTween.endPos, eased);
    controls.target.lerpVectors(
      cameraTween.startTarget,
      cameraTween.endTarget,
      eased
    );
    controls.update();
    refreshBrushFromPointer();
    if (t >= 1) {
      cameraTween.active = false;
    }
  }
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

animate();
