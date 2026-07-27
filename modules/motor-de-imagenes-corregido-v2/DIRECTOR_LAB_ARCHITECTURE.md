# Director Lab v2 — Arquitectura

## Cambio de enfoque respecto a la v1

La v1 (documentada en `DIRECTOR_LAB_AUDIT.md`, sección de auditoría) construyó un `director-core.js` genérico donde Gemini elegía libremente entre candidatos de pose/gesture/expression/escena de un banco HPI **inventado a mano** (12 familias de prueba). Esa v1 quedó retirada: `core/director-core.js`, `core/gemini-selector.js`, `core/candidate-ranking.js` y sus tests fueron eliminados.

La v2 conecta datos **reales**:

- **HPI real**: 36 familias curadas de 158 análisis reales (`src/data/HPI/`), ya en producción vía `src/services/hpiService.ts`.
- **Contratos de receta reales**: `src/modules/photodump/recipes/outfitNightOut/` — shots fijos ya validados a mano, banco rotable de night moments con selección determinista.

En vez de que Gemini "invente" pose/gesture/escena desde cero, la v2 **respeta contratos ya afinados** y usa Gemini solo donde de verdad hace falta razonar (interpretar el brief libre, y en receta futuras, quizás elegir escena real cuando no hay foto de referencia).

## Mecanismo de vendoring (esbuild)

Los archivos TypeScript reales de la app de producción (`hpiService.ts`, `outfitNightOut/*.ts`) no pueden `require()`-arse directamente desde el backend Node de Director Lab (son ESM/TS, y algunos importan código de navegador). Se resuelve con un paso de compilación:

`scripts/build-vendor.js` usa `esbuild` (ya instalado como dependencia del proyecto) para compilar cada archivo fuente real a CommonJS dentro de `director-lab/vendor/`, preservando la estructura de carpetas para que los imports relativos (`../../../../services/hpiService`, `../data/HPI/*.json`) sigan resolviendo igual que en el original.

Dos ajustes necesarios documentados en el script:
1. **JSON dinámico**: `hpiService.ts` usa `await import('../data/HPI/...json')`, que exige `import(x, {with:{type:'json'}})` bajo reglas ESM — se post-procesa el compilado para reemplazarlo por `require()` (siempre válido en CommonJS).
2. **Código de navegador arrastrado**: `promptBuilder.ts` importa constantes de texto puro desde `recipes/shared.ts`, que también importa `compressImageForUpload` (usa `document.createElement('canvas')`, no corre en Node). Se compila con `bundle: true` + tree-shaking real de esbuild, que descarta el código no alcanzado (incluida esa importación de Canvas) sin tocar el archivo fuente original.

**Regenerar el vendor** cuando cambien los archivos fuente reales: `node scripts/build-vendor.js` desde `modules/motor-de-imagenes-corregido-v2/`.

## Flujo de una generación (`POST /api/director-lab/generate`)

1. `adapters/photodump-recipe-adapter.js` recibe `{level, seed, hasCompanion, energy, gender, ...}`.
2. Llama a `levelResolver.resolveShotsForLevel(...)` (real, compilado) — arma la lista de shots: fijos + night moments elegidos deterministamente por `seed`.
3. Por cada shot, llama a `intelligenceLayer.applyIntelligence(contract, gender)` (real) — que internamente llama a `hpiService.buildHpiBlock`/`getHpiNegatives` reales con los IDs de familia declarados en el contrato (`hpiPoseFamily`/`hpiCameraFamily`), nunca elegidos al azar por Gemini.
4. Llama a `promptBuilder.buildShotPrompt(...)` (real) — arma el texto final exacto que produce Photodump en producción.
5. Antes de devolver, busca la nota de feedback más reciente para `(recipeId, shotId)` en `persistence/shot-notes.js` y la agrega como línea extra si existe.
6. Devuelve la lista de shots con `positivePrompt`/`negativePrompt` listos para copiar.

## Persistencia

- `persistence/shot-notes.js`: un JSON por nota, agrupado por `(recipeId, shotId)`, mutable. `latestFor(recipeId, shotId)` devuelve la más reciente para reinyectar.
- El resto de `persistence/` (proyectos, recetas, casos, runs, referencias, resultados, evaluaciones) sigue existiendo de la v1 — no se usa desde la interfaz simplificada actual, pero las rutas CRUD siguen respondiendo si se necesitan a futuro para un panel más completo.

## Qué se retiró y qué se dejó

**Retirado (v1, borrado):** `core/director-core.js`, `core/gemini-selector.js`, `core/candidate-ranking.js`, snapshot inventado de HPI (`director-lab-data/hpi-snapshot.json`, archivo queda en disco sin uso), UI React (`src/modules/directorLab/`, marcada deprecada en el código, no borrada), ruta `/director-lab` de la SPA.

**Reusado tal cual (sigue vigente):** `core/validators.js` (4 validadores deterministas: no-locomoción, pose plana, flash/piel, contaminación de roles — siguen siendo relevantes para cualquier receta futura), `core/rule-engine.js` (reglas versionadas de Photodump), `adapters/scene-bank-adapter.js` + `director-rules-adapter.js` (Scene Bank real de 501 escenas, reglas UGC — quedan disponibles para futuras recetas que sí necesiten que Gemini elija escena).

## Reducción de la carpeta importada

De los 129 MB originales copiados desde `Downloads/motor-de-imagenes-corregido-v2/`, se conservaron solo `scene-bank.json` (1.2 MB) y `director-rules/` (508 KB), reubicados en `director-lab/data/`. Se eliminaron `campaign-trainer-data/images/` (94 MB), `/analyses/` (24 MB), `/thumbnails/` (5.6 MB), `/logs/`, `/queue/`, y las herramientas HTML no usadas por Director Lab (`campaign-trainer.html`, `campaign-trainer-v2.html`, `seadream-*.html`, `facial-expression-intelligence/`). Nada se perdió — la carpeta original completa sigue intacta fuera del proyecto, y el usuario sigue usando su `iniciar.bat` original desde ahí para el Campaign Trainer.
