# Director Lab — Auditoría del proyecto (inventario real)

Fecha de auditoría: 2026-07-27. Esta auditoría documenta el estado real encontrado en `motor-de-imagenes-corregido-v2/` antes de construir Director Lab, tal como pide la sección 11 del brief.

## Hallazgo principal: no existe un "director-core" reusable

El brief asume que ya existe una lógica de Director ejecutable que Director Lab debería reutilizar. Tras inspeccionar `server.js` (1666 líneas), `campaign-trainer.html` / `campaign-trainer-v2.html` (462KB/473KB, JS de navegador), y `facial-expression-intelligence/`, se confirma que **no existe ningún módulo determinístico de selección/composición de prompts**. Lo que existe es:

- Un generador de reglas estático dentro de `campaign-trainer.html` (~líneas 6427–6720) que arma y exporta un JSON de reglas descargable (`campaign_director_rules_${mode}.json`) — es un exportador de datos, no un motor de decisión.
- Análisis por-imagen vía Gemini con un prompt de "senior global creative director" que produce texto libre (`directorTrainingModule.directorRule`, `.promptBlock`) — la "inteligencia" vive del lado del modelo, no en código propio.

Por lo tanto, `director-core` construido para Director Lab es la **primera implementación real** de lógica de dirección determinística en este proyecto, consumiendo los datos reales existentes.

## Inventario de bancos

### 1. Scene Bank

- **Ubicación**: `campaign-trainer-data/scene-bank.json`
- **Esquema**: `{ schemaVersion: "scene_bank_v1", updatedAt, scenes: [...] }`. Cada escena: `sceneId`, `status`, `sceneIdentity`, `confidence`, `strongReferenceCount`, `scenePromptBlock`, `capabilities`, `lightingEnvironment`, `contaminationRisks`, etc.
- **Estado de curación real observado**: **no coincide con el vocabulario del brief.** Los valores reales de `status` son `approved` (39), `needs_review` (101), `candidate` (361) — no existen literalmente `strong_reference`, `pending_review` ni `rejected`. `strongReferenceCount` es 0 en el 100% de los registros actuales.
- **Decisión de mapeo aplicada**: `approved` → elegible por defecto; `needs_review`/`candidate` → excluidos por defecto (equivalente funcional a "pendiente de curación"); `strongReferenceCount > 0` → elegible aunque no esté `approved` (para cuando el dato exista a futuro).
- **Forma de lectura**: disco, JSON completo cargado en memoria por request (501 escenas, tamaño manejable).
- **Identificador estable**: `sceneId` (ej. `SCENE_0NYF0LM`).
- **Dominio**: escena/espacio físico.

### 2. HPI — pose / gesture / expression

- **Ubicación real del código**: `facial-expression-intelligence/facial-expression-intelligence.html` (servidor propio en puerto 3133, solo 67 líneas, sirve el HTML estático sin rutas de bancos).
- **Hallazgo crítico**: **no existe ningún JSON físico persistido en disco para HPI.** La taxonomía de familias (`POSE__<id>`, `GESTURE__<id>`, dominios `pose`/`gesture`/`performance`/`expression` con política de cuarentena `domainLevelQuarantine: true`) vive únicamente en `localStorage` del navegador (`fei_importHistory`).
- **Adaptación para el MVP**: se creó `director-lab-data/hpi-snapshot.json`, un snapshot **curado a mano** (no exportado automáticamente) con 12 familias reales (6 pose, 3 gesture, 3 expression) suficientes para resolver el caso T5-B con evidencia real, incluyendo deliberadamente poses "frontal simétrica" para que existan candidatos que el Director descarte con motivo.
- **Limitación documentada**: esto es un placeholder de arranque, no una integración con el HTML real. Una tarea de seguimiento (fuera de alcance del MVP) sería construir un exportador real desde `localStorage` hacia este archivo.

### 3. Reglas del Director (UGC v3.5/3.6)

- **Ubicación original**: solo existía como export descargado por el usuario en `Downloads/campaign_director_rules_ugc (1).json` (516KB, versión más completa — comparada por hash MD5 contra la copia `(2)`, idénticas; la copia sin sufijo era una versión anterior más chica). **No vivía dentro del proyecto.**
- **Acción tomada**: copiada a `campaign-trainer-data/director-rules/campaign_director_rules_ugc.json` (solo lectura para Director Lab).
- **Esquema real**: `version` ("3.6" al leer el campo interno, pese al nombre de archivo "3.5.1"), `globalDirectorPrinciples` (18 principios de texto), `commercialArchetypes`, `creativeKnowledgeContract`, `sceneKnowledgeContract`, `visualBanks` (38 entradas), `anchorDecisionRules` (20), `pieceRoleRules`, `channelRules`, `riskLockRules` (11, con `riskType` + `negativePromptHints` — pero de contenido genérico/templado, no prosa rica por riesgo), `performanceMemoryArchitecture`.
- **Identificador estable**: no tiene IDs por entrada de principio; Director Lab les asigna IDs sintéticos (`PRINCIPLE_0`, `PRINCIPLE_1`, ...) al indexarlos.

### 4. Reglas creativas de Photodump (sección 5 del brief)

No existían como datos en ningún banco — estaban únicamente descritas en prosa dentro del brief. Se implementaron en `director-lab/core/rule-engine.js` como reglas versionadas (`photodump-rules-0.1.0`) con patrones de detección explícitos: `RULE_NO_LOCOMOTION`, `RULE_HPI_ACTIVE_USE`, `RULE_FLASH_IPHONE`, `RULE_CAPTURE_MECHANISM_VARIETY`, `RULE_REFERENCE_ROLE_ISOLATION`.

### 5. Conocimiento UGC/campaña de `campaign-trainer-data/analyses/`

- **Ubicación**: `campaign-trainer-data/analyses/<imageId>.json`, uno por imagen (1066 registros según `manifest.json`, `schemaVersion: "3.5-disk-store"`).
- **Esquema**: rico en módulos de análisis (`classificationModule`, `humanModule`, `productModule`, `compositionModule`, `commercialModule`, `trustSignalModule`, etc.) pero **no contiene pose/gesture/expression estructurado** — ese conocimiento vive solo en HPI (ver arriba).
- **Uso en el MVP**: no se consulta directamente desde `director-core` (fuera de alcance del MVP); el adaptador queda documentado como extensión futura.

## Bug preexistente encontrado y corregido

Al copiar `motor-de-imagenes-corregido-v2/` dentro de `luz-ia-studio (1)/modules/`, el proyecto heredó `"type": "module"` del `package.json` raíz de `luz-ia-studio`, lo que rompía `server.js` (usa `require()` de CommonJS) con `ReferenceError: require is not defined in ES module scope`. Se corrigió agregando un `package.json` propio con `"type": "commonjs"` en `motor-de-imagenes-corregido-v2/`. Este bug es anterior a cualquier cambio de Director Lab y afectaba a **todo** el servidor, no solo a las rutas nuevas.

## Estado de configuración de Vertex AI

La copia del proyecto en esta ubicación tiene `Luz IA secrets/vertex-service-account.json` presente, pero **no tiene un archivo `.env`** con `GOOGLE_CLOUD_PROJECT` configurado — `vertex.publicConfig()` devuelve `{ready: false, error: "Falta GOOGLE_CLOUD_PROJECT (o VERTEX_PROJECT_ID)."}`. Esto es una tarea de configuración pendiente del usuario (requiere su ID de proyecto de Google Cloud), no un defecto de Director Lab.
