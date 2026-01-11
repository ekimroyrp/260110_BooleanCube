# 260110_BooleanCube

260110_BooleanCube is a Three.js ShadowBox-style sculpting tool that builds a volume from silhouettes painted on three cube faces and converts the result into a mesh.

## Features
- Paintable bottom/back/side faces with resolution-aligned grids
- Silhouette projections with intersect/difference/union boolean modes
- Marching-cubes mesh with smoothing, wireframe, and projection previews
- Cube toggle to hide/show faces, grids, labels, and painting
- Clickable face labels to snap the camera with smooth transitions
- Faces/vertices readout plus undo/redo, screenshot, and OBJ export

## Getting Started
1. Clone the repository.
2. Install dependencies with `npm install`.
3. Start the dev server with `npm run dev`.

## Controls
- Left drag on a face: paint
- Right drag on a face: erase
- Left drag on empty space: orbit camera
- Right drag on empty space: pan camera
- Shift + Left drag: orbit (always)
- Shift + Right drag: pan (always)
- Mouse wheel: zoom
- Face labels: snap camera to that view
- Boolean dropdown sets intersect/difference/union behavior for projection volumes
- Center resets the camera view
- Clear resets drawings and mesh
- Undo reverts the last stroke or clear
- Redo reapplies the last undone change
- Screenshot saves a PNG of the canvas view
- Export saves the boolean mesh as an OBJ
- Wireframe toggle shows/hides the triangulated overlay
- Projection toggle shows per-face projection volumes
- Cube toggle shows/hides cube faces, grids, labels, and painting
