# Anatomical model attribution

File: `human_muscles.glb` (glTF 2.0, supplied by the project owner).

The file's embedded `asset` metadata identifies:

- Generator: **ecorche build (BodyParts3D + Z-Anatomy)**.
- **BodyParts3D**, © The Database Center for Life Science (DBCLS), **CC BY 4.0**.
  Source: https://lifesciencedb.jp/bp3d/
  License: https://creativecommons.org/licenses/by/4.0/
- **Z-Anatomy**, by **Gauthier Kervyn**, **CC BY-SA 4.0**.
  Source: https://www.z-anatomy.com/
  License: https://creativecommons.org/licenses/by-sa/4.0/
- This combined derivative: **CC BY-SA 4.0**, as declared by its embedded metadata.

Changes made by GymRat (CC BY-SA 4.0 requires indicating them): the served GLB is an
optimized derivative of the supplied file, produced with
`scripts/model/optimize-model.mjs` (glTF-Transform + meshoptimizer). Vertex colors
(`COLOR_0`) were removed, meshes were simplified to about 61 % of the original
triangles (each mesh's bounding box moves by at most ~0.15 % of the model height)
and the data was re-encoded with Meshopt. Node and mesh names, hierarchy and
license metadata are unchanged; `asset.generator` keeps the original value plus a
note about the optimization. The original supplied file remains in the repository
history. The static posters `/anatomy/poster-front.webp` and `poster-back.webp`
are renders of this derivative and carry the same license.

Colors, camera framing and the mapping
to exercise groups are applied at runtime. The anatomical model is educational,
not a validated measurement of muscle activation, fatigue or medical condition.

Before public redistribution, the project owner must verify the model's original
download page and retain any additional creator credit or notices supplied there.
The embedded metadata does not identify a download URL or the derivative's author;
these credits reproduce available metadata, not an independent license audit.

Three.js and Meshoptimizer are separately MIT-licensed. Their license notices
are preserved in `/vendor/three/LICENSE` and `/vendor/meshoptimizer/LICENSE.md`.