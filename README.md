# 260110_BooleanCube

260110_BooleanCube is a Three.js tool that prototypes a ShadowBox-style Boolean sculpting workflow by intersecting silhouettes drawn on three cube faces.

## Features
- Paintable bottom/back/side faces with brush overlay
- Silhouette intersection to generate a volume mesh (marching cubes)
- Face density and smoothing controls with rebuild/clear actions
- Orbit/pan camera controls with live UI feedback

## Getting Started
1. Clone the repository.
2. Install dependencies with `npm install`.
3. Start the dev server with `npm run dev`.

## Controls
- Left drag on a face: paint
- Left drag on empty space: pan camera
- Right drag: orbit camera
- Mouse wheel: zoom
- Rebuild/Clear update the generated mesh
