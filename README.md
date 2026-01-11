# 260110_BooleanCube

260110_BooleanCube is a Three.js tool that prototypes a ShadowBox-style Boolean sculpting workflow by intersecting silhouettes drawn on three cube faces.

## Features
- Paintable bottom/back/side faces with brush overlay
- Silhouette intersection to generate a volume mesh (marching cubes)
- Boolean mode dropdown (Intersect, Difference, Union)
- Resolution, brush size, smoothing, wireframe, projection, and cube toggles in-panel
- Undo/redo history for brush strokes and clear actions
- Orbit/pan camera controls with live UI feedback

## Getting Started
1. Clone the repository.
2. Install dependencies with `npm install`.
3. Start the dev server with `npm run dev`.

## Controls
- Left drag on a face: paint
- Right drag on a face: erase
- Left drag on empty space: orbit camera
- Right drag on empty space: pan camera
- Mouse wheel: zoom
- Boolean dropdown sets intersect/difference/union behavior for the projection volumes
- Center resets the camera view
- Clear resets the drawings and mesh
- Undo reverts the last stroke or clear
- Redo reapplies the last undone change
- Screenshot saves a PNG of the canvas view
- Export saves the boolean mesh as an OBJ
- Wireframe toggle shows/hides the triangulated overlay
- Projections toggle shows per-face projection volumes
- Cube toggle shows/hides the cube faces, grids, and labels
