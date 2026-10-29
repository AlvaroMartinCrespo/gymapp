# Self-hosted 3D runtime

No package installation is required for this viewer. It uses an isolated,
same-origin HTML frame with an import map; the rest of the app does not import
Three.js into its React bundle. Files are pinned and served from this directory,
not fetched from a CDN at runtime.

- **Three.js 0.180.0** (MIT): `three.module.min.js`, `three.core.min.js`,
  `GLTFLoader.js`, `OrbitControls.js`, `BufferGeometryUtils.js`, `LICENSE`.
  Source: https://github.com/mrdoob/three.js/tree/r180
  Downloaded from https://cdn.jsdelivr.net/npm/three@0.180.0/
  Only local modification: GLTFLoader's BufferGeometryUtils import is changed
  from `../utils/BufferGeometryUtils.js` to `./BufferGeometryUtils.js`.
- **Meshoptimizer 0.24.0** (MIT): `meshopt_decoder.module.js`, `LICENSE.md`.
  Source: https://github.com/zeux/meshoptimizer/tree/v0.24
  Downloaded from https://cdn.jsdelivr.net/npm/meshoptimizer@0.24.0/
  Unmodified decoder, including its embedded WASM; no separate binary request.

`SHA256SUMS` records the local files, including the one relocated import.
To update, review upstream changes/licenses, fetch a fixed version, rerun the
model/runtime tests and perform a browser smoke test with the compressed GLB.