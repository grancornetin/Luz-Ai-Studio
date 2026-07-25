# Motores de Inteligencia Visual y HPI

> Reglas de mantenimiento para IA:
> 1. Este archivo debe mantenerse actualizado cuando se agregue, modifique o elimine un banco de inteligencia.
> 2. Si cambia el contrato de un JSON, actualizar la seccion del esquema y los servicios consumidores.
> 3. No borrar secciones historicas; marcar lo eliminado y explicar el motivo.
> 4. El objetivo es que otra IA o una persona pueda entender como crear motores nuevos sin leer todo el codigo.

**Ultima actualizacion:** 2026-07-25  
**Alcance:** `src/data/trainer`, `src/data/trainer/inteligencia ugc`, `src/data/HPI` y los servicios que cargan esos bancos.

---

## Resumen corto

En este proyecto, un "motor" no es un servidor aparte. Es una combinacion de:

1. **Banco de datos JSON** con familias, reglas, riesgos y bloques de prompt.
2. **Servicio adaptador TypeScript** que carga esos JSON con `dynamic import`.
3. **Filtro de familias** segun el modulo o modo visual.
4. **Constructor de bloque de prompt** que convierte datos entrenados en instrucciones compactas para Gemini.
5. **Guardrails / negatives** para evitar errores visuales.

Los motores actuales funcionan como capas de direccion creativa:

| Motor | Carpeta | Servicio principal | Para que sirve |
| --- | --- | --- | --- |
| Editorial Campaign Intelligence | `src/data/trainer/` | `src/modules/campaign/campaignIntelligence.ts` | Familias visuales editoriales y UGC historicas para Campaign. |
| UGC Visual Intelligence | `src/data/trainer/inteligencia ugc/` | `src/modules/campaign/ugcIntelligence.ts` y `src/modules/photodump/photodumpIntelligence.ts` | Familias UGC clasificadas por uso: campana, historia, estetica de creador. |
| UGC Scene Intelligence | `src/data/trainer/inteligencia ugc/scene_bank_ugc.json` | `src/modules/campaign/sceneIntelligence.ts` | Escenas reales entrenadas (locacion + luz + capacidades fisicas) para rellenar el vacio cuando no hay foto real de escena. Activo en Campaign; pendiente en Photodump. |
| HPI | `src/data/HPI/` | `src/services/hpiService.ts` | Direccion humana: expresion, pose, gesto, relacion con camara y performance. |

---

## Patron comun de arquitectura

### 1. Los JSON grandes son memoria entrenada

Los archivos `raw_image_analysis`, `master_visual_database` y `metadata` son memoria de entrenamiento/exportacion. Sirven para auditar de donde salio el motor, pero normalmente la app no los consume en runtime.

Los archivos que mas importan para generar prompts son:

- `campaign_director_rules*.json`
- `visual_family_briefs*.json`
- `03_reglas_director_hpi*.json`

### 2. Los servicios hacen carga segura

Los servicios usan `dynamic import` y fallback silencioso. Si un JSON falla o falta, el modulo sigue vivo y devuelve arrays vacios o strings vacios.

Ejemplo de patron:

```ts
let _loaded = false;
let _bank: Record<string, unknown> = {};

async function ensureLoaded(): Promise<void> {
  if (_loaded) return;
  _loaded = true;
  try {
    const mod = await import('ruta/al/banco.json');
    _bank = (mod.default ?? mod) as Record<string, unknown>;
  } catch {
    _bank = {};
  }
}

export function initMotor(): void {
  ensureLoaded().catch(() => {});
}
```

Detalle importante: los getters actuales son sincronicos. Eso significa que conviene llamar `init...()` al importar el modulo o antes de generar, para darle tiempo al `dynamic import`.

### 3. El motor no genera imagenes por si mismo

Los motores solo producen instrucciones. La generacion final ocurre en servicios como:

- `src/modules/campaign/campaignService.ts`
- `src/modules/photodump/photodumpDirectorService.ts`
- `src/services/imageApiService.ts`
- `src/services/ugcApiService.ts`

---

## Motor Editorial Campaign Intelligence

**Datos:** `src/data/trainer/`  
**Servicio:** `src/modules/campaign/campaignIntelligence.ts`  
**Consumidor principal:** `src/modules/campaign/campaignService.ts`

### Archivos

| Archivo | Rol |
| --- | --- |
| `campaign_director_rules.json` | Reglas de director creativo: principios, arquetipos, visualBanks, reglas por rol/canal y riesgos. |
| `visual_family_briefs.json` | Resumen curado de familias visuales. Es el fallback principal si no hay `visualBanks`. |
| `raw_image_analysis.json` | Analisis crudo de imagenes fuente. Auditoria/entrenamiento. |
| `master_visual_database.json` | Base visual exportada con imagenes, status y analisis. Auditoria/entrenamiento. |
| `metadata.json` | Estadisticas de exportacion. |

### Estado actual

- 157 imagenes totales.
- 155 imagenes aprobadas.
- 7 familias exportadas.
- `visual_family_briefs.json` contiene 4 familias `editorial` y 3 familias `ugc`.

### API publica

En `campaignIntelligence.ts`:

- `initCampaignIntelligence()`: precarga los JSON.
- `getVisualFamilies()`: lee `visualBanks` o `families`.
- `getFamiliesByModoVisual(modo)`: filtra por `compatibleModoVisual`.
- `getEditorialFamilies()`: devuelve familias editoriales.
- `buildCampaignIntelligencePromptBlock(modoVisual)`: arma un bloque compacto para Gemini.
- `getTopFamilyFromPieces(pieces)`: detecta la familia mas repetida en un plan.
- `extractBlendText(family)`: obtiene la directiva creativa principal.
- `extractBasePromptBlock(family)`: obtiene bloque base transferible.
- `extractAnchorPromptBlock(family)`: obtiene bloque para imagen ancla.
- `extractGuardrails(family)`: extrae negativos/avoid compactos.

### Como se usa en Campaign

`campaignService.ts` inicializa el motor al importarse:

```ts
initCampaignIntelligence();
```

Luego inserta `buildCampaignIntelligencePromptBlock('editorial')` en prompts de planificacion y usa las funciones `extract...` cuando cada pieza ya tiene `visualFamilyId`.

La idea es:

1. Gemini recibe la lista de familias disponibles.
2. Gemini asigna `visualFamilyId` a cada pieza.
3. El servicio recupera esa familia.
4. El prompt final hereda `blendDirective`, `promptBlocks` y guardrails.

---

## Motor UGC Visual Intelligence

**Datos:** `src/data/trainer/inteligencia ugc/`  
**Servicios:** `src/modules/campaign/ugcIntelligence.ts` y `src/modules/photodump/photodumpIntelligence.ts`

### El banco es versionado y se fusiona en runtime

Este motor ya no lee un unico par de archivos. Cada tanda nueva de
entrenamiento se agrega como un archivo `_v2`, `_v3`, etc., **sin tocar
los archivos anteriores**. Los dos servicios adaptadores cargan TODAS
las fuentes listadas y fusionan las familias por `familyId`/`id` antes
de filtrar por `usageClass`. Si el mismo ID aparece en dos archivos,
gana el primero de la lista (el banco original).

Para agregar una tanda nueva:

1. Sumar los archivos `campaign_director_rules_ugc_vN.json` y
   `visual_family_briefs_ugc_vN.json` a la carpeta (nombre estable, sin
   espacios ni parentesis — Vite no resuelve bien esos nombres en
   `dynamic import`).
2. Agregar una linea a `DIRECTOR_RULES_SOURCES` / `FAMILY_BRIEFS_SOURCES`
   en `ugcIntelligence.ts`, y a `FAMILY_BRIEFS_SOURCES` en
   `photodumpIntelligence.ts`.
3. No hace falta tocar ningun otro archivo: el filtro por `usageClass`,
   el ranking y los bloques de prompt ya operan sobre el banco fusionado.

### Archivos

| Archivo | Rol |
| --- | --- |
| `campaign_director_rules_ugc.json` | Banco original. Reglas UGC v2.4: principios, arquetipos, `visualBanks`, reglas de ancla, reglas por pieza/canal y riesgos. |
| `visual_family_briefs_ugc.json` | Banco original. Resumen curado de 18 familias UGC. |
| `campaign_director_rules_ugc_v2.json` | Banco v2 (agregado 2026-07-24). Mismo esquema, familias nuevas y variadas, primera aparicion de `sceneKnowledgeContract`. |
| `visual_family_briefs_ugc_v2.json` | Banco v2 (agregado 2026-07-24). ~31 familias nuevas, IDs propios sin overlap con el banco original. |
| `raw_image_analysis_ugc (4).json` | Analisis crudo de 236 imagenes UGC del banco original con `usageClass`, performance/story value y directivas. |
| `master_visual_database.json` | Base exportada con 236 imagenes aprobadas y sus analisis (banco original). |
| `metadata.json` | Estadisticas del entrenamiento UGC (banco original). |

### Estado actual (banco fusionado: original + v2)

- 51 familias unicas combinadas (deduplicadas por `familyId`).
- Distribucion por `usageClass` tras la fusion:

| usageClass | Familias | Que modulo la ve |
| --- | ---: | --- |
| `ugc_core` | 25 | Campaign |
| `editorial` | 17 | Campaign (activado 2026-07-24, antes sin consumidor) |
| `story_support` | 7 | Photodump |
| `creator_aesthetic` | 2 | Photodump |

### Que significa `usageClass: 'editorial'` en este banco (importante)

`editorial` **NO** es fotografia de estudio/revista. Es UGC real donde
la creadora tiene mas cuidado de luz y pose — sabe que la camara la
esta viendo, pero sigue siendo una foto de creadora, no una produccion
de marca. Ejemplos: selfie en la calle con buena luz natural, pose de
espejo cuidada, foto de bar/vacaciones con composicion pensada. La
diferencia con `ugc_core` es el nivel de intencionalidad de la pose y
la luz, no el contexto ni el equipo de produccion.

Por eso `ugcIntelligence.ts` NO le da su propia seccion de prompt ni
lo trata como categoria comercial aparte: lo mezcla en la misma lista
que `ugc_core` y le agrega el tag `[polished UGC]` en
`buildUgcIntelligencePromptBlock()`, con una aclaracion explicita para
Gemini de que sigue siendo UGC autentico, solo mas pulido. Si se
tratara como "editorial de revista" se corre el riesgo de que Gemini
lo descarte por no encajar con el resto del banco UGC, cuando en
realidad son las familias con mejor luz/pose del mismo continuo.

`sceneKnowledgeContract` (solo en el banco v2, a nivel raiz de
`campaign_director_rules_ugc_v2.json`) es metadata que **describe** un
banco de 516 escenas candidatas (50 principales + 142 parciales + 276
modificadores ambientales), pero ese banco de escenas fisico no vino
incluido en esta entrega — es un contrato para una integracion futura,
no datos consumibles todavia. Si llega ese banco, debe tratarse como un
motor nuevo (ver "Como agregar un motor nuevo" mas abajo) y no forzarse
dentro de `visualBanks`/`families`.

### Esquema mental de una familia UGC

Una familia UGC normalmente incluye:

- `familyId`: id estable que otros modulos referencian.
- `familyName`: nombre humano.
- `macroStyle`: por ejemplo `ugc`.
- `compatibleModoVisual`: por ejemplo `ugc` o `editorial`.
- `usageClass`: clasificacion operativa.
- `commercialIntentDNA`: intencion, etapa de compra, roles visuales y mecanismos psicologicos.
- `definition` y `strategicSummary`: resumen para prompts.
- `intelligenceScores`: trust, luxury, tactile, training value.
- `subfamilies`: patrones mas especificos dentro de la familia.
- `blendDirective`: como mezclar esa familia en un prompt.
- `campaignRoles`: roles recomendados como hook, trust, proof, conversion.
- `channelFit`: canales recomendados.
- `storyFamilyValue` y `storyDirective`: especialmente utiles en Photodump.
- `promptBlocks`, `visualDirectives`, `avoid`, `negativePromptHints`: instrucciones y riesgos.

### Uso en Campaign

**Servicio:** `src/modules/campaign/ugcIntelligence.ts`

Este servicio fusiona todas las fuentes (`DIRECTOR_RULES_SOURCES` +
`FAMILY_BRIEFS_SOURCES`, banco original + v2 + las que se agreguen) y
expone familias `usageClass === 'ugc_core'` **o** `'editorial'`
(activado 2026-07-24 — antes `editorial` estaba en el banco pero
ningun motor lo leia).

Como el banco fusionado puede tener muchas mas familias que las 7 que
entran en el prompt, `getUgcVisualFamilies()` las ordena por
`familyQualityScore()`: usa `performanceFamilyValue.avgScore` (0-100)
y cae a `intelligenceScores.avgTrainingValueScore` si no existe. El
`slice(0, 7)` de `buildUgcIntelligencePromptBlock()` toma siempre las
de mejor puntaje de todo el banco combinado, no las primeras del
archivo.

Funciones principales:

- `initUgcIntelligence()`
- `getUgcVisualFamilies()` — fusiona + filtra (`ugc_core`/`editorial`) + ordena por calidad.
- `getUgcFamilyById(id)`
- `buildUgcIntelligencePromptBlock()`
- `getTopUgcFamilyFromPieces(pieces)`

El bloque UGC se inserta cuando Campaign planifica piezas en modo UGC. El prompt le pide a Gemini que asigne `visualFamilyId` usando solo IDs listados.

### Uso en Photodump

**Servicio:** `src/modules/photodump/photodumpIntelligence.ts`

Este servicio reutiliza el mismo banco UGC fusionado (todas las
`FAMILY_BRIEFS_SOURCES`), pero filtra otras clases:

- `story_support`: BTS, contexto, transicion, vida real.
- `creator_aesthetic`: flat lay, moodboard, detalle curado.

Funciones principales:

- `initPhotodumpIntelligence()`
- `getStorySupportFamilies()`
- `getStorySupportFamilyById(id)`
- `getFamiliesBySequencePosition(position)`
- `getFamiliesByNarrativeArc(arc)`

Photodump usa estas familias como soporte narrativo para secuencias, no como familias principales de campana.

### Regla clave

El mismo banco UGC fusionado sirve para dos usos distintos:

| Modulo | Familias permitidas | Motivo |
| --- | --- | --- |
| Campaign | `ugc_core`, `editorial` | Piezas de campana con creador/producto como centro comercial, mas piezas con estetica editorial/marca. |
| Photodump | `story_support`, `creator_aesthetic` | Frames de contexto, transicion, atmosfera y narrativa diaria. |

Si agregas una familia nueva, su `usageClass` decide que modulo la
vera — no importa en que archivo `_vN` llegue, ni el orden dentro del
JSON, porque el ranking por `familyQualityScore()` la ubica segun su
puntaje real.

---

## Motor UGC Scene Intelligence

**Datos:** `src/data/trainer/inteligencia ugc/scene_bank_ugc.json`  
**Servicio:** `src/modules/campaign/sceneIntelligence.ts`  
**Agregado:** 2026-07-25

### Que resuelve

Antes de este motor, cuando no habia ninguna imagen real que definiera
el entorno (ancla, inspiracion, foto de escena), Campaign y Photodump
le pedian a Gemini que inventara la locacion con una linea generica:
`"Real inhabited environment — home, café, street"` (Campaign) o
`"REF0 already defined the visual world — bedroom, hotel room, or
dressing area"` (Photodump). Gemini improvisaba el espacio entero sin
ninguna referencia entrenada.

`scene_bank_ugc.json` es el banco de escenas real (39 escenas
aprobadas al 2026-07-25) que veniamos esperando desde que
`sceneKnowledgeContract` aparecio en el banco de familias v2 (ver
seccion anterior) sin traer el banco fisico todavia.

### Contrato del JSON

Raiz: `schemaVersion`, `exportedAt`, `counts`, `policy`, `mainScenes`,
`partialScenes`, `ambientModifiers`. Hoy solo `mainScenes` trae datos
(39); `partialScenes` y `ambientModifiers` estan vacios en esta
entrega — son extensiones futuras del mismo banco, no motores nuevos.

Cada escena en `mainScenes` trae, entre otros campos:

- `sceneId`, `name`, `status` (`sceneIntelligence.ts` solo usa las
  `approved`).
- `sceneIdentity.settingCategory`: `bedroom`, `hallway`, `living_room`,
  `closet`, `urban_exterior`, `cafe`, `restaurant`, `terrace`,
  `bathroom`, `travel_landmark`, `other`.
- `scenePromptBlock`: descripcion lista para inyectar en el prompt —
  el campo mas importante del esquema.
- `capabilities`: `supportsFullBody`, `supportsSeatedPose`,
  `supportsExtendedArms`, `allowsMultipleOutfitChanges`,
  `privacyLevel`, `mirror.availability/usability`.
- `limitations` y `contaminationRisks`: avisos cortos para evitar que
  Gemini copie detalles no deseados (por ejemplo luces de decoracion
  que deberian omitirse).

**Campos rotos en esta entrega — no los uses:** `compatibleUses` viene
siempre como `["[object Object]"]` (bug de exportacion, se perdio la
serializacion real) y `lightingEnvironment` / `aesthetics.mood`
siempre vienen `"unknown"`. `sceneIntelligence.ts` los ignora a
proposito. Si una entrega futura los arregla, recien ahi vale la pena
consumirlos.

### API publica

En `sceneIntelligence.ts`:

- `initSceneIntelligence()`: precarga el JSON.
- `getScenes()`: todas las escenas `approved`.
- `getSceneById(id)`
- `getScenesByCategory(category)`: filtra por `settingCategory`.
- `getFullBodyScenes()`: filtra por `capabilities.supportsFullBody === 'yes'`.
- `pickScene(seed, category?)`: eleccion **deterministica** a partir
  de un seed (hash simple) — misma seed siempre devuelve la misma
  escena, para que una sesion de generacion no salte de escena entre
  llamadas sucesivas. Si `category` no tiene escenas, cae al banco
  completo.
- `buildScenePromptBlock(scene)`: arma el bloque de texto final con
  `scenePromptBlock` + capacidades relevantes + limitaciones + riesgos
  a evitar, cerrando con la instruccion de no inventar otro lugar.

### Regla de oro: nunca reemplaza una foto real

Este motor **solo** interviene cuando no existe ninguna imagen que ya
defina el entorno. Si la usuaria subio una foto de referencia, ancla,
inspiracion, o escena (`sceneRef`/`scenePruebaRef`/`sceneDestinoRef`
en Photodump), esa foto manda siempre — el banco de escenas ni se
consulta. La logica de deteccion vive en el llamador (por ejemplo
`!selected.inspirationRef` en Campaign), no en `sceneIntelligence.ts`.

### Uso en Campaign (activo)

**Consumidor:** `src/modules/campaign/campaignService.ts`

Se llama `initSceneIntelligence()` junto a los demas motores al
importar el modulo. Se usa `pickScene()` + `buildScenePromptBlock()`
en dos lugares, ambos SOLO para la variante UGC (`variant === 'A'`) y
SOLO cuando `!selected.inspirationRef`:

1. `generateAnchorImages()` (flujo con plan previo): despues de
   inyectar la familia UGC ancla, agrega el bloque de escena al
   `basePrompt` si corresponde.
2. `generateAnchorImagesFromBrief()` (flujo directo desde el brief):
   reemplaza el `bgNote` generico por una referencia al bloque de
   escena, e inyecta `buildScenePromptBlock()` junto al `lockSystem`.

El seed de `pickScene()` combina el concepto/idea de la campana con el
`sessionId`, para que la eleccion sea estable dentro de la misma
generacion pero varie entre campanas distintas.

La variante editorial (`variant === 'B'`) NO usa este motor — su
entorno lo define el `visualSpine` o la familia editorial elegida, que
ya son mas especificos que una escena generica de UGC.

### Uso en Photodump (pendiente)

Photodump todavia usa el texto generico (`extractShotLocationOverride`
en `photodumpDirectorService.ts`, linea ~322) cuando no hay
`scenePruebaRef`/`sceneRef`. No se integro todavia porque Photodump
tiene 6 recetas distintas (`outfit_check`, `dayInLife`,
`outfitMultiLook`, `outfitRevealBasic`, `outfitNightOut`,
`weeklyFavoritesV2`), cada una con su propia funcion `generateXREF0` y
un sistema de "fingerprint"/lock de escena que propaga continuidad
entre shots de una misma sesion. Integrar mal el motor de escenas ahi
podria romper esa continuidad. Cuando se aborde, revisar receta por
receta empezando por `generatePhotodumpREF0` (la generica, no las
especializadas) y reusar `pickScene()` / `buildScenePromptBlock()` de
este mismo servicio — no crear un adaptador nuevo.

---

## Motor HPI

**Datos:** `src/data/HPI/`  
**Servicio:** `src/services/hpiService.ts`  
**Consumidores:** `src/modules/campaign/campaignService.ts` y `src/modules/photodump/photodumpDirectorService.ts`

HPI significa **Human Performance Intelligence**. No define estilo de campana ni producto. Solo agrega direccion humana:

- expresion facial
- pose corporal
- gesto
- relacion con camara
- intencion/performance
- safeguards anatomicos

HPI no debe copiar identidad, cara exacta, cuerpo, ropa ni fondo. Solo transfiere conducta visual.

### Archivos

| Archivo | Rol |
| --- | --- |
| `01_analisis_crudo_hpi_151 mujer.json` | Analisis crudo femenino. Auditoria/entrenamiento. |
| `01_analisis_crudo_hpi_51 hombre.json` | Analisis crudo masculino. Auditoria/entrenamiento. |
| `02_familias_curadas_hpi_mujer_151.json` | Familias curadas femeninas antes de convertirlas en reglas de director. |
| `02_familias_curadas_local_51 hombre.json` | Familias curadas masculinas antes de convertirlas en reglas de director. |
| `03_reglas_director_hpi_mujer_151.json` | Banco runtime femenino usado por `hpiService`. |
| `03_reglas_director_hpi_51 hombre.json` | Banco runtime masculino usado por `hpiService`. |

### Estado actual de bancos runtime

| Banco | Expression | Pose | Gesture | Camera | Performance | Amplifiers | Risk rules |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Mujer | 6 | 9 | 8 | 6 | 7 | 160 | 25 |
| Hombre | 4 | 4 | 5 | 4 | 6 | 632 | 34 |

### Esquema runtime esperado

Los archivos `03_reglas_director_hpi_*.json` contienen:

- `globalPrinciples`
- `expressionBanks`
- `poseBanks`
- `gestureBanks`
- `cameraRelationshipBanks`
- `performanceBanks`
- `amplifierBanks`
- `riskRules`
- `compatibilityMatrix`
- `promptAssemblyRules`
- `avoidRules`

Cada familia de banco puede incluir:

- `familyId`
- `quality` o `familyQuality`
- `mechanics` o `mechanicsProfile`
- `promptBlocks`
- `riskProfile`
- `compatibleFamilies`
- `amplifierHints`

El servicio actual prioriza:

1. `promptBlocks.basePromptBlock`
2. `mechanics.baseDirectives`
3. `mechanics.summary`

Para negativos, usa:

- `riskRules[].negativePromptHints`
- `riskRules[].globalSafeguards`
- negativos fijos de manos, ojos, pose rigida y proporcion corporal.

### API publica

En `hpiService.ts`:

- `initHpiService()`: precarga bancos mujer/hombre.
- `buildHpiBlock(config)`: genera el bloque HPI textual.
- `getHpiNegatives(gender)`: devuelve negative prompts anatomicos.

Config:

```ts
export interface HpiConfig {
  enabled: boolean;
  gender: 'female' | 'male' | 'neutral';
  modoVisual: 'ugc' | 'editorial';
  includeGesture: boolean;
  includePerformance: boolean;
}
```

### Como arma un bloque HPI

`buildHpiBlock(config)`:

1. Sale vacio si `enabled` es `false`.
2. Elige banco segun `gender`.
3. Para `neutral`, usa banco femenino como base y poses masculinas.
4. Elige familias aleatorias de:
   - expression
   - pose
   - camera relationship
   - gesture, si `includeGesture`
   - performance, si `includePerformance`
5. Extrae maximo 3 frases por familia para no saturar el prompt.
6. Agrega hasta 2 amplifiers.
7. Agrega safeguards desde familias de gesto y expresion.
8. Devuelve un bloque que declara explicitamente que HPI no puede sobreescribir identidad, producto, outfit ni locks.

### Uso en Campaign

Campaign tiene un toggle de UI: **Expresion y poses naturales**.

`CampaignModule.tsx` crea `HpiConfig` con:

- `enabled`: estado del toggle.
- `gender`: `neutral` si hay slot de modelo, `female` si no.
- `modoVisual`: se ajusta por variante.
- `includeGesture` e `includePerformance`: random boolean.

`campaignService.ts` inyecta HPI solo cuando hay modelo:

```ts
const hpiBlock = (hpiConfig && hasModel) ? buildHpiBlock(hpiConfig) : '';
```

Esto evita que HPI invente personas en fotos de producto solo.

Tambien concatena `getHpiNegatives()` al negative prompt cuando HPI esta activo.

### Uso en Photodump

Photodump usa HPI con mas filtros porque muchas tomas son de objetos, detalles o outfits.

En `photodumpDirectorService.ts`:

- `outfit_haul`: usa `buildHaulSafeHpiBlock`.
- `outfit_check`: usa `buildOutfitCompatibleHpiBlock`.
- `outfit_week`: usa `buildWeeklySafeHpiBlock`.
- otras recetas: pueden usar `buildHpiBlock` estandar.

Tambien calcula:

- `hpiEligible`
- `hpiScope`
- `hpiSource`
- `hpiBlockOff`

`hpiBlockOff` es importante: cuando una toma no admite pose corporal, el prompt dice explicitamente que NO se debe inyectar pose, gesto atletico o stance de performance.

### Limitaciones actuales

- `buildHpiBlock` elige familias al azar; no usa todavia `compatibilityMatrix` para validar combinaciones.
- Los getters son sincronicos; si un modulo no llama `initHpiService()` con anticipacion, podria obtener bloque vacio.
- El banco masculino usa algunos nombres distintos (`familyQuality`, `mechanicsProfile`), pero el servicio tiene fallback suficiente porque usa principalmente `promptBlocks`.
- HPI debe mantenerse como capa humana. No debe incluir locacion, props, producto, outfit ni estilo visual global.

---

## Como agregar un motor nuevo

Hay dos caminos tipicos.

### Camino A: motor de familias visuales

Usalo si quieres crear un banco parecido a Editorial o UGC: estilos, familias, roles comerciales, canales, directivas visuales.

Estructura recomendada:

```txt
src/data/trainer/nombre-motor/
  campaign_director_rules_nombre.json
  visual_family_briefs_nombre.json
  raw_image_analysis_nombre.json
  master_visual_database.json
  metadata.json
```

Contrato minimo para `visual_family_briefs_nombre.json`:

```json
{
  "schemaVersion": "1.0",
  "trainingMode": "nombre",
  "totalFamilies": 1,
  "families": [
    {
      "familyId": "FAMILY_NOMBRE_EJEMPLO",
      "familyName": "Nombre humano",
      "compatibleModoVisual": "ugc",
      "usageClass": "ugc_core",
      "commercialIntentDNA": {
        "primaryIntent": "trust",
        "purchaseStages": ["awareness"],
        "visualRoles": ["hook"],
        "psychologicalMechanisms": ["trust"]
      },
      "definition": "Que representa esta familia.",
      "strategicSummary": "Como debe usarse.",
      "blendDirective": "Instruccion visual compacta para el prompt.",
      "campaignRoles": {
        "recommendedRoles": ["hook", "trust"]
      },
      "channelFit": {
        "recommendedChannels": ["instagram_feed"]
      },
      "promptBlocks": {
        "basePromptBlock": "Bloque base transferible.",
        "anchorPromptBlock": "Bloque para ancla visual."
      },
      "negativePromptHints": ["avoid malformed hands"]
    }
  ]
}
```

Servicio adaptador sugerido:

```ts
import type { VisualFamily } from '../campaign/types-or-local-contract';

let _rules: Record<string, unknown> = {};
let _briefs: Record<string, unknown> = {};
let _loaded = false;

async function ensureLoaded(): Promise<void> {
  if (_loaded) return;
  _loaded = true;
  try {
    const mod = await import('../../data/trainer/nombre-motor/campaign_director_rules_nombre.json');
    _rules = (mod.default ?? mod) as Record<string, unknown>;
  } catch {
    _rules = {};
  }
  try {
    const mod = await import('../../data/trainer/nombre-motor/visual_family_briefs_nombre.json');
    _briefs = (mod.default ?? mod) as Record<string, unknown>;
  } catch {
    _briefs = {};
  }
}

export function initNombreMotor(): void {
  ensureLoaded().catch(() => {});
}

export function getNombreFamilies(): VisualFamily[] {
  const banks = (_rules as any)?.visualBanks;
  if (Array.isArray(banks) && banks.length > 0) return banks as VisualFamily[];
  const families = (_briefs as any)?.families;
  if (Array.isArray(families) && families.length > 0) return families as VisualFamily[];
  return [];
}
```

Luego debes decidir:

- que modulo lo consume;
- que filtro aplica (`usageClass`, `compatibleModoVisual`, canal, rol, receta);
- como se inserta en el prompt;
- que pasa si no hay familias;
- si el modelo debe asignar `visualFamilyId` o si el servicio elige una familia automaticamente.

### Camino B: motor de capa transversal

Usalo si quieres algo parecido a HPI: una capa que se agrega encima de cualquier estilo.

Ejemplos:

- motor de direccion de manos/product holding;
- motor de food styling;
- motor de luz natural;
- motor de composicion de producto;
- motor de riesgo anatomico o compliance visual.

Estructura recomendada:

```txt
src/data/NOMBRE/
  01_analisis_crudo_nombre.json
  02_familias_curadas_nombre.json
  03_reglas_director_nombre.json
```

Contrato runtime recomendado:

```json
{
  "schemaVersion": "1.0",
  "exportType": "nombre_director_rules",
  "globalPrinciples": [],
  "banks": [],
  "riskRules": [],
  "compatibilityMatrix": [],
  "promptAssemblyRules": [],
  "avoidRules": []
}
```

Servicio esperado:

- `initNombreService()`
- `buildNombreBlock(config)`
- `getNombreNegatives(config)`

Regla de oro: si el motor es transversal, su bloque debe decir explicitamente que no sobreescribe locks de identidad, producto, outfit, marca o ancla visual.

---

## Checklist para sumar un motor sin romper el sistema

1. Definir si el motor es visual/familias o transversal/capa.
2. Crear carpeta propia en `src/data`.
3. Mantener IDs estables. Nunca cambiar `familyId` si ya se usa en planes guardados.
4. Separar archivos de auditoria y archivos runtime.
5. Crear un servicio adaptador con fallback silencioso.
6. Agregar `init...()` en el modulo consumidor.
7. Construir un bloque de prompt compacto; evitar pegar JSON completo.
8. Definir filtros claros: modo visual, usageClass, canal, rol, receta o scope.
9. Agregar guardrails y negative prompts si el motor puede causar errores visuales.
10. Validar que el motor no invente personas, productos, props o fondos cuando no corresponde.
11. Si el prompt pide IDs al modelo, incluir la instruccion "usar solo IDs listados".
12. Probar caso feliz y caso fallback con banco vacio.

---

## Reglas practicas por tipo de motor

### Para familias visuales

- Usar `visualFamilyId` cuando Gemini debe elegir una familia.
- Mantener `definition`, `strategicSummary` y `blendDirective` cortos.
- No meter demasiadas familias en el prompt; los servicios actuales limitan a 7.
- Incluir `negativePromptHints` o `avoid` para errores comunes.
- Usar `usageClass` para controlar visibilidad por modulo.

### Para HPI o capas humanas

- Aplicar solo si hay avatar/modelo o si la escena realmente contiene persona.
- No aplicar en macro producto, flat lay puro, packaging, accesorios aislados o objetos.
- Si se desactiva, insertar una restriccion explicita cuando haya riesgo de que el modelo invente pose.
- Mantener instrucciones humanas separadas de producto/outfit/locacion.
- Concatenar negativos especificos solo cuando la capa este activa.

### Para nuevos motores en Campaign

Puntos de integracion:

- `src/modules/campaign/campaignService.ts`
- `src/modules/campaign/types.ts`
- opcionalmente un archivo nuevo junto a `campaignIntelligence.ts`

Debes decidir si el motor participa en:

- planificacion de campana;
- generacion de anclas;
- generacion de piezas derivadas;
- negativos;
- metadata guardada.

### Para nuevos motores en Photodump

Puntos de integracion:

- `src/modules/photodump/photodumpDirectorService.ts`
- `src/modules/photodump/types.ts`
- opcionalmente un archivo nuevo junto a `photodumpIntelligence.ts`

Debes decidir si el motor depende de:

- receta (`outfit_check`, `outfit_haul`, `outfit_week`, etc.);
- tipo de shot;
- presencia de avatar;
- presencia de producto;
- arco narrativo;
- posicion en secuencia.

---

## Archivos clave para estudiar antes de crear motores nuevos

Lectura recomendada en este orden:

1. `src/modules/campaign/campaignIntelligence.ts`
2. `src/modules/campaign/ugcIntelligence.ts`
3. `src/modules/photodump/photodumpIntelligence.ts`
4. `src/services/hpiService.ts`
5. `src/modules/campaign/campaignService.ts`
6. `src/modules/photodump/photodumpDirectorService.ts`

Los cuatro primeros muestran el patron limpio. Los dos ultimos muestran donde se insertan los bloques en prompts reales.

---

## Mapa de decision rapido

Si tu nuevo motor responde a "que estilo visual/comercial deberia tener esta pieza", crealo como banco de familias visuales.

Si responde a "como debe comportarse una persona dentro de la imagen", crealo como capa transversal tipo HPI.

Si responde a "que errores debo evitar", puede ser parte del motor principal o un servicio de guardrails/negatives.

Si responde a "que pieza va en que momento de una secuencia", probablemente debe vivir cerca de Photodump o Planner, no como motor visual general.
