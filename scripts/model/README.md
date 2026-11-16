# Herramientas del modelo 3D

Scripts de mantenimiento de `public/models/human_muscles.glb` y de los pósters del visor.
No forman parte de `npm test`, del build ni del runtime; sus dependencias no están en `package.json`.

| Script | Qué hace |
| --- | --- |
| `optimize-model.mjs` | GLB original → GLB ligero (sin `COLOR_0`, mallas simplificadas, meshopt). |
| `dump-geometry.mjs` | GLB → geometría en espacio mundo (ficheros `.p/.n/.i/.g`). |
| `render-poster.py` | Geometría → `public/anatomy/poster-front.webp` y `poster-back.webp`. |

```bash
npm i --no-save @gltf-transform/core @gltf-transform/extensions @gltf-transform/functions meshoptimizer
git show <commit-anterior>:public/models/human_muscles.glb > /tmp/original.glb
node scripts/model/optimize-model.mjs /tmp/original.glb public/models/human_muscles.glb
node scripts/model/dump-geometry.mjs public/models/human_muscles.glb /tmp/modelo
python3 scripts/model/render-poster.py /tmp/modelo public/anatomy
```

Tras cambiar el modelo hay que repetir la prueba en navegador (carga, pecho y espalda, mapa de calor)
y regenerar los pósters.
