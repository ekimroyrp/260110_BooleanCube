# 260110_BooleanCube

260110_BooleanCube is a Three.js ShadowBox-style sculpting tool that builds a solid volume from silhouettes painted on three cube faces, with boolean modes, smooth or stepped output, and export-ready meshes.

## Features
- Paintable bottom/back/side faces with resolution-aligned grids
- Silhouette projections with intersect/difference/union boolean modes
- Smooth or stepped output via ANGLE toggle with optional smoothing
- Projection ghost previews, mesh wireframe overlay, and cube visibility control
- Clickable face labels with orthographic snap views
- Faces/vertices readout plus undo/redo, screenshot, and OBJ export

## Getting Started
1. `npm install`
2. `npm run dev` to start Vite on `http://localhost:5173`
3. `npm run build` to emit a production build

## Controls
- Left drag on a face: paint
- Right drag on a face: erase
- Left drag on empty space: orbit camera
- Right drag on empty space: pan camera
- Shift + Left drag: orbit (always)
- Shift + Right drag: pan (always)
- Mouse wheel: zoom
- Face labels: snap camera to that view (orthographic)
- Boolean dropdown sets intersect/difference/union behavior for projection volumes
- Reframe resets the camera view
- Clear resets drawings and mesh
- Undo reverts the last stroke or clear
- Redo reapplies the last undone change
- Screenshot saves a PNG of the canvas view
- Export saves the boolean mesh as an OBJ
- Angle toggle switches between smooth and stepped output
- Wireframe toggle shows/hides the triangulated overlay
- Projection toggle shows per-face projection volumes
- Cube toggle shows/hides cube faces, grids, labels, and painting

## Deployment
- **Local production preview:** `npm install`, then `npm run build` followed by `npm run preview` to inspect the compiled bundle.
- **Publish to GitHub Pages:** From a clean `main`, run `npm run build -- --base=./`. Checkout (or create) the `gh-pages` branch in a separate worktree, copy everything inside `dist/` plus a `.nojekyll` marker to its root, commit with a descriptive message, `git push origin gh-pages`, then switch back to `main`.
- **Live demo:** https://ekimroyrp.github.io/260110_BooleanCube/
