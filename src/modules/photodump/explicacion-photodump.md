# Photodump — Guía del Módulo

> **REGLAS DE MANTENIMIENTO PARA IA:**
> 1. Este archivo debe mantenerse actualizado con el estado real del módulo.
> 2. Cada vez que se agregue, modifique o elimine un feature relevante, actualizar la sección correspondiente.
> 3. Actualizar la fecha de "Última actualización" con cada cambio.
> 4. No borrar secciones — si algo fue eliminado, marcarlo como "Eliminado en [fecha]" y explicar por qué.
> 5. El objetivo es que otra IA pueda leer este archivo y entender completamente qué hace el módulo, cómo funciona, y en qué estado está, sin necesidad de leer el código.
> 6. **INSTRUCCIÓN DE CONTINUIDAD:** Al final del documento siempre debe existir la sección "Estado de trabajo actual" con el estado exacto de qué se está haciendo, en qué receta se está, y qué quedó pendiente. Cuando una receta se cierra, moverla a "Recetas cerradas". Esto permite retomar el trabajo en un nuevo chat sin perder contexto.

**Última actualización:** 2026-07-10 (nueva receta `day_in_life` implementada — primera receta MULTI-MUNDO del módulo, con REF0 encadenado por bloque. Pendiente prueba en app. También se corrigió esta guía: `outfit_week` dejó de usar `recipes/outfitWeek.ts`/`generateOutfitWeekShot` hace tiempo — el motor activo es `recipes/weeklyFavoritesV2/`, no documentado hasta ahora. Ver "Recetas cerradas — Day In Life" y "Estado de trabajo actual".)
**Propósito:** Generar series fotográficas con narrativa visual coherente. Un "photodump" es una colección de fotos que cuentan una historia o transmiten un mood, muy popular en Instagram y TikTok.

---

## Qué hace este módulo

Photodump genera entre 3 y 6 imágenes que cuentan una historia visual juntas. No son fotos sueltas — tienen un hilo conductor narrativo que las conecta: un día completo, un viaje, un unboxing, una sesión editorial.

El flujo completo es:
1. El usuario elige una **receta** (unboxing, outfit, day_in_life, product_haul, bts, travel, libre)
2. Sube **referencias visuales** según lo que pide la receta (avatar, producto, empaque, outfit, escena)
3. Escribe un **brief** describiendo lo que quiere contar
4. Se genera un **REF0** — imagen ancla que establece la identidad visual del set completo (paleta, luz, mundo)
5. Usando REF0 como fuente de verdad, se generan los **N shots** del set, cada uno con sus propias referencias y directiva narrativa
6. Al terminar, se generan **captions y hashtags** para cada imagen

---

## Arquitectura técnica

### Archivos principales

| Archivo | Rol |
|---------|-----|
| `PhotodumpModule.tsx` | Componente principal. Wizard 4 pasos + galería de sets guardados. Maneja generación, debug para admins, retry automático con safe-retry para haul |
| `PDStep2Receta.tsx` | Paso 2: selección de receta + carga de referencias por slot. Para haul: slots outfit hasta 10 ítems, accesorios hasta 5, sublabels dinámicos por tipo |
| `HaulReferenceTypeSelector.tsx` | Selector de tipo de referencia compartido por `outfit_haul` y `outfit_week`. 16 opciones (auto / look_completo / varios_items / top / bottom / vestido / enterizo / chaqueta / calzado / pantys / bolso / joyeria / accesorio / maquillaje / skincare). El valor viaja al pipeline y condiciona el planner y los prompts. **Puente temporal:** `outfit_week` reutiliza `refs.haulOutfitKinds`/`refs.haulAccKinds` (nombrados "haul" por origen histórico) para los slots `outfit`/`accesorios` — no hay campos `weeklyOutfitKinds` separados. El slot `producto` (usado por skincare/beauty subido aparte) no tiene selector de tipo propio todavía; solo se distingue maquillaje/skincare si el usuario los sube por el slot outfit o accesorio. |
| `photodumpDirectorService.ts` | Orquestador. Tipos genéricos, `generatePhotodumpShot`/`generatePhotodumpREF0`/`buildPhotodumpSessionPlan`/`generatePhotodumpCaptions` (compartidos entre recetas), dispatch temprano hacia los archivos dedicados de cada receta ya implementada, y el pool orgánico genérico para `bts`/`travel` (aún sin archivo propio) |
| `recipes/shared.ts` | Núcleo compartido: tipos de shot, bloques de prompt globales (`LOCK_SYSTEM`, `GLOBAL_*`), wear state, camera mode, scene fingerprint, brief parsing legado |
| `recipes/outfitHaul.ts` | Receta `outfit_haul` completa: manifest, styling graph, scoring de compatibilidad, world map, shot planner, coverage y los 13 shot builders |
| `recipes/outfitWeek.ts` | **Legado/desconectado.** Contenía la implementación original de `outfit_week` (`WEEKLY_SLOT_COVERAGE_MODE`, `generateOutfitWeekShot`, etc). El Director ya no despacha aquí — sigue importado solo para no romper símbolos re-exportados (`buildWeeklyManifest`) que otro código pueda usar. Ver `recipes/weeklyFavoritesV2/` para la implementación activa. |
| `recipes/weeklyFavoritesV2/` | **Motor activo de `outfit_week`** (10 archivos: `manifest.ts`, `anchor.ts`, `styleDetector.ts`, `allocator.ts`, `contracts.ts`, `contractValidator.ts`, `referenceRouter.ts`, `routingValidator.ts`, `promptBuilder.ts`, `debug.ts`, `index.ts`). Reescritura completa, no reutiliza lógica de `outfitWeek.ts`. Expone 3 funciones (`buildWeeklyFavoritesV2Directives`, `generateWeeklyFavoritesV2REF0`, `generateWeeklyFavoritesV2Shot`) con la misma forma que el resto de recetas para que el Director despache sin cambiar su contrato hacia `PhotodumpModule.tsx`. Usa un `anchorCache` en memoria (Map keyed por refs) para no recalcular la detección de estilo en cada shot. **Este documento no tenía esta arquitectura registrada — corregido 2026-07-10.** |
| `recipes/outfitCheck.ts` | Receta `outfit_check` completa: router semántico de brief, directivas de prep space, HPI específico, detección de contradicciones, pool de shots |
| `recipes/unboxing.ts` | Receta `unboxing` completa: pool lineal fijo de shots y su compresión por cantidad |
| `recipes/productHaul.ts` | Receta `product_haul` completa: manifest sin scoring/styling graph, interaction block por tipo de producto, shot planner de 3 fases (coverage → budget narrativo → interleaving de empaque), shot builders y HPI seguro |
| `recipes/dayInLife.ts` | Receta `day_in_life` completa: única receta **multi-mundo** del módulo. `parseDayBlocks` (heurística de texto local, sin LLM) segmenta el brief en 1-3 bloques/momentos, `generateDayInLifeRef0Chain` genera un REF0 por bloque encadenado al anterior, `buildDayInLifeShotPlan` reparte roles narrativos (`BLOCK_ESTABLISH`/`BLOCK_DETAIL`/`BLOCK_AMBIENCE`/`BLOCK_COMPANION`) por bloque |
| `photodumpIntelligence.ts` | Lee banco UGC de familias visuales (story_support, creator_aesthetic). **Independiente de recetas.** |
| `types.ts` | Todos los tipos: PhotodumpSet, RecipeRefConfig, PhotodumpRefs, HaulItem, HaulManifest, HaulRefKind, HaulResolvedKind, DayBlock, DayInLifeManifest, VisualRefsAnalysisResult, etc. |
| `photodumpStorage.ts` | IndexedDB (`app_photodump_module`). Guarda sets completos |

**División por receta (Julio 2026):** `photodumpDirectorService.ts` tenía 10047 líneas mezclando el motor de todas las recetas. Se dividió en fases (núcleo compartido → outfit_haul → outfit_week → outfit_check + unboxing → product_haul → day_in_life), cada una verificada con `tsc --noEmit` y build real antes de mergear. Para editar una receta ya implementada, abrir directamente su archivo (o carpeta, en el caso de weeklyFavoritesV2) en `recipes/` en vez de buscar en el orquestador. La función `generatePhotodumpShot` (ensamblador final de prompt) sigue en el archivo principal para las ramas de outfit_check/outfit_haul/product_haul/genérica porque mezcla condicionales entrelazadas — pero `outfit_week` y `day_in_life` despachan temprano hacia sus propios archivos, sin pasar por ese ensamblador compartido en absoluto (mismo patrón que weeklyFavoritesV2: 3 funciones autónomas que llaman directo a `imageApiService`).

### Infraestructura de generación

- **Imágenes** → `imageApiService` → QStash + Redis → `api/gemini/image-worker.ts` → Gemini 3.1 Flash Image @ global
- **Texto** → `api/gemini/content` → Gemini 2.5 Flash @ us-central1 (síncrono)
- **MAX_REFS = 10**: límite de imágenes de referencia por llamada de imagen. Seguro hasta ~1.2MB comprimido a 768px/0.72 (Vercel tolera hasta 4.5MB)
- Las imágenes se comprimen antes de enviarse: `compressImageForUpload(img, 768, 0.72)`

### REF0 — El ancla visual

REF0 es la primera imagen que se genera. Su rol es establecer la identidad visual absoluta del set: paleta de color, temperatura de luz, mundo narrativo y (si hay avatar) la identidad facial. Todos los shots siguientes reciben REF0 como primera referencia.

---

## Sistema de recetas

Cada receta define:
- Qué slots de referencias muestra (`RecipeRefConfig`: avatar, outfit, producto, empaque, escena — cada uno `required | optional | none`)
- El pool de shots disponibles (genérico orgánico o lineal específico)
- El peso de cada referencia en REF0 y en cada shot

### Recetas disponibles

| Receta | Protagonista | Arco | Avatar |
|--------|-------------|------|--------|
| `unboxing` | Producto + packaging | **Lineal** (packaging cerrado → apertura → reveal → detalle → en uso → atmósfera) | Opcional (x2, secundario) |
| `outfit` | Persona + prendas | Orgánico rotacional | Requerido (x3, dominante) |
| `outfit_week` | Persona + N ítems (outfits/accesorios/bolsos/beauty) | Motor `weeklyFavoritesV2`: ancla + reparto + contratos por shot | Requerido |
| `day_in_life` | Persona + hasta 3 momentos del día | **Multi-mundo**: 1 REF0 por bloque, roles ESTABLISH/DETAIL/AMBIENCE/COMPANION | Requerido (x2, dominante) |
| `product_haul` | Persona + N productos | **3 fases** (coverage → budget narrativo → interleaving de empaque) | Requerido (x2, dominante) |
| `bts` | Producto/workspace | Orgánico rotacional | Opcional |
| `travel` | Persona + escena | Orgánico rotacional | Requerido (x3, dominante) |
| `free` | Libre | Manual por escena | Opcional |

### Slot de empaque (solo unboxing)

La receta unboxing tiene un slot dedicado `empaque` (color ámbar en UI) separado del slot `producto`. Esto permite que el modelo entienda qué imágenes son el contenedor y cuáles son el contenido. Capacidad: hasta 3 imágenes de empaque.

Si el usuario no sube empaque, la IA inventa uno consistente y se le informa con un hint en la UI.

---

## Lógica de referencias por receta

### Unboxing con avatar
- **REF0:** avatarRef x2 + packagingRef + packagingRefs[] + productRef + productRefs[] + sceneRef
- **Cada shot:** ref0(1) + avatarRef x2 + packagingRef(1) + packagingRefs[](variable) + productRef(1) + productRefs[](1-2 según shot) + sceneRef(1)
- Shots de detalle/uso priorizan más refs de producto y menos de empaque

### Unboxing sin avatar
- **REF0:** packagingRef + packagingRefs[] + productRef + productRefs[] + sceneRef
- **Cada shot:** ref0(1) + packagingRef + productRef + extras de producto/empaque según beat
- Nunca aparece una persona en el set. Es product hero puro.

### Otras recetas
- **REF0:** avatarRef x3 + bodyRef + outfitRef + productRef + sceneRef (los que apliquen)
- **Cada shot:** ref0 + avatarRef x2 + producto + outfit + escena según corresponda

---

## Pool de shots y arco narrativo

### Unboxing — Arco lineal

La receta unboxing NO usa el pool orgánico/rotacional. Tiene su propio pool fijo con orden narrativo:

1. `UNBOXING_PACKAGING_CLOSED` — La caja cerrada, contexto (beat: context)
2. `UNBOXING_OPENING_MOMENT` — El momento de abrir (beat: action)
3. `UNBOXING_PRODUCT_REVEAL` — El producto aparece (beat: reveal)
4. `UNBOXING_PRODUCT_DETAIL` — Detalles y accesorios (beat: detail)
5. `UNBOXING_PRODUCT_IN_USE` — El producto en uso (beat: action)
6. `UNBOXING_ATMOSPHERE` — Cierre atmosférico (beat: atmosphere)

Compresión del arco según count:
- 6 shots: arco completo
- 5 shots: sin `atmosphere`
- 4 shots: sin `atmosphere` ni `product_detail`
- 3 shots: `packaging_closed` + `opening` + (`in_use` si hay avatar, `reveal` si no)

### Otras recetas — Pool orgánico

Rotan entre tipos de momento: context, detail, emotion, texture, action, atmosphere, reveal, candid.

---

## Modelo de costos

| Qué | Costo |
|-----|-------|
| 1 sesión Photodump (PHOTODUMP_SESSION) | 1 pro-credit |
| Cada imagen generada (PHOTODUMP_PER_IMAGE) | 2 créditos c/u |
| Con Seedream | 1 crédito/imagen (mitad) |
| Serie de 4 imágenes (Gemini) | 1 pro-credit + 10 créditos (REF0 + 4 shots) |
| Serie de 6 imágenes haul (Gemini) | 1 pro-credit + 14 créditos (REF0 + 6 shots) |

---

## Metodología de trabajo

- Se trabaja receta a receta en orden
- Primero: diseño y razonamiento del flujo sin tocar código
- Segundo: implementación acordada
- Tercero: prueba en la app real
- Cuarto: ajustes según lo detectado en la prueba
- Solo cuando una receta está validada en la app se avanza a la siguiente

---

## Recetas cerradas ✅

### ✅ Unboxing — VALIDADA Y CERRADA

**Qué se implementó:**
- `MAX_REFS` subido de 6 a 10
- Nuevo campo `empaque` en `RecipeRefConfig` (solo unboxing tiene `optional`, el resto `none`)
- Nuevos campos `packagingRef` y `packagingRefs[]` en `PhotodumpRefs`
- Slot ámbar de empaque en `PDStep2Receta.tsx` con sublabels y hints específicos
- Pool lineal de shots: `buildUnboxingShotPool()` + `distributeUnboxingShots()` en el director
- REF0 adaptada: con avatar muestra cara, sin avatar es product hero puro
- Budget de refs adaptativo por tipo de shot (detail/in_use priorizan producto sobre empaque)
- `PhotodumpModule.tsx` pasa `recipe` a todas las funciones de generación

**Fixes post-prueba aplicados:**
- Referencias como identidad, no checklist: `shotIdentityBlock` en el director tiene un bloque global que le enseña al modelo que las referencias son constraints de identidad/consistencia, no elementos obligatorios en frame. Resolvió figura de fondo genérica (shot 3) y packaging flotante (shot 5).
- Caption único por set: `generatePhotodumpCaptions` devuelve `{ caption, hashtags }` en lugar de array por imagen. Se muestra una vez encima de la grilla. Modo libre no genera captions.
- Fix retry de shots fallidos: `handleRetryFailed` en `PhotodumpModule.tsx` ahora reutiliza `savedRef0Url` y `savedRef0Analysis` del primer intento, en vez de generar un REF0 nuevo. Antes el retry generaba un ancla distinta y el shot quedaba fuera del set visualmente.

---

## Recetas cerradas — Outfit (tres modos) ✅

### ✅ `outfit_check` — VALIDADA Y CERRADA (Junio 2026)

**Historia:** "Elegí este outfit para X ocasión"

**Slots:**
- `avatar` (requerido): cara/identidad
- `outfit` (requerido): hasta 4 prendas del mismo look — fotos de prendas SOLAS (no avatar vistiéndolas)
- `accesorios` (opcional): hasta 3, con checkbox ⭐ de close-up por accesorio → genera shot extra
- `escena_prueba` (opcional): habitación, espejo, probador — si no se sube, se inventa según brief
- `escena_destino` (opcional): lugar final (restaurante, evento, calle) — si no se sube, el último shot usa escena_prueba

**Arco lineal (por cantidad):**
- 3 visibles (2 story): ARRIVING → DESTINATION/READY
- 4 visibles (3 story): ARRIVING → MIRROR_CHECK → DESTINATION/READY
- 5 visibles (4 story): ARRIVING → MIRROR_CHECK → READY → DESTINATION
- 6 visibles (5 story): ARRIVING → DETAIL → MIRROR_CHECK → READY → DESTINATION
- 7 visibles (6 story): ARRIVING → DETAIL → MIRROR_CHECK → DETAIL_WORN → READY → DESTINATION
- 8 visibles (7 story): ARRIVING → DETAIL → MIRROR_CHECK → DETAIL_WORN → READY → SECOND_ANGLE → DESTINATION

**Máximo: 8 imágenes.** UI bloqueada en 8 para outfit_check.

**Shots del pool:**
1. `OUTFIT_ARRIVING` — Prendas como objetos: rack, flat lay, manos sosteniendo. Sin cuerpo completo.
2. `OUTFIT_DETAIL` — Close-up de prenda/accesorio sin avatar vestido.
3. `OUTFIT_MIRROR_CHECK` — Full body frente al espejo, look completo.
4. `OUTFIT_DETAIL_WORN` — Detalle de prenda YA puesta: cuello, bolsillo, textura, zapato.
5. `OUTFIT_READY` — Selfie o medium shot, cara dominante, mood "lista para salir".
6. `OUTFIT_SECOND_ANGLE` — Mismo prep room, ángulo distinto al mirror check.
7. `OUTFIT_DESTINATION` — Full body en escena destino.
8. `ACCESSORY_CLOSEUP` ×N — Shot extra por accesorio marcado con ⭐.

**REF0:** Full body del avatar con outfit completo en escena de prueba (real o inventada).

**Decisiones de arquitectura implementadas:**
- `visibleCount = min(requestedCount, 8)` / `storyShotCount = visibleCount - 1`
- `buildPrepContextOnlyBlock()`: shots de prep reciben ocasión abstracta ("opera date") con lista FORBIDDEN de términos visuales del destino (opera house, marble, chandeliers, foyer, lobby, etc.)
- `buildREF0HardLockBlock()`: regla dura "mismo cuarto físico que REF0" para todos los shots con sceneLockPolicy prep_*. Romper = destino aparece antes de OUTFIT_DESTINATION.
- UGC family blocks completamente desactivados para outfit_check (incluso abstract_style_hint metía lighting hints incompatibles)
- HPI mantenido como anti-rigidez corporal/facial únicamente — sin locaciones, props ni escenas
- `PREP_SHOT_KEYS`: set que determina qué shots reciben hard lock (excluye OUTFIT_DESTINATION)
- `detectContradictions` valida en debug: destination terms en prep, count mismatch, family block activo

---

### ✅ `outfit_haul` — CERRADA (v1.8+patches, Julio 2026) — 9/10

**Historia:** "Me probé todo esto / estas son las prendas que me quedé"

**Arquitectura (rediseñada en v1.4–v1.8 + patches finales):**
El sistema haul tiene tres fases que garantizan cobertura de TODOS los ítems subidos:

**FASE 1 — Coverage obligatoria (garantizada):**
Cada ítem sube tiene exactamente 1 hero slot asignado antes de narrativa:
- `HAUL_TRY_ON_N` — prendas wearables (top, bottom, vestido, enterizo, outerwear, full_outfit)
- `HAUL_FOOTWEAR_N` — calzado (en slots outfit o acc)
- `HAUL_BAG_N` — bolsos y carteras
- `HAUL_JEWELRY_N` — joyería
- `HAUL_ACCESSORY_CLOSEUP_N` — accesorios genéricos

**FASE 2 — Budget narrativo:**
Con el presupuesto restante se distribuyen:
- `HAUL_OVERVIEW` — apertura contextual (siempre 1°)
- `HAUL_ADJUSTING_N` / `HAUL_STYLED_N` — variedad para ítems ya cubiertos
- `HAUL_RECAP` — cierre si hay ≥2 outfits y hay budget

**FASE 3 — Interleaving:**
Los ítems no-wearables (calzado, bolsos, joyería) se distribuyen uniformemente entre los try-ons, no al final.

**Scoring de compatibilidad (`scoreAccessoryOutfitCompatibility`):**
Función heurística exportada (0–100) que determina si un accesorio se integra en un outfit o recibe shot aislado. `COMPATIBILITY_THRESHOLD = 65`. Considera: color family (gold/silver/black/white/warm/cool/neutral/denim), vibe (elegant/casual/leather/sport), kind (jewelry/footwear/bag/belt/glasses/hat). Anti-matches duros: heels+sport=5, sneakers+formal=15.

**HaulStylingGraph:** Grafo semántico de combinaciones entre ítems. `buildHaulStylingGraph(manifest)` crea pares top+bottom, dress+footwear, jewelry+outfit, etc. sin hardcoding de colores específicos.

**HaulShotItemPlan:** Cada shot declara explícitamente `primaryItems`, `wornItems`, `heldItems`, `surfaceItems`, `backgroundItems`, `forbiddenItems`. Inyectado en el prompt antes del role lock.

**Retry doble:**
- Content-policy: safe-retry con prompt conservador (lenguaje de moda neutro, `forbiddenElements` ampliados)
- Network/timeout: backoff 5s con el mismo shot

**Slots:**
- `avatar` (requerido): cara/identidad
- `outfit` (requerido): hasta 10 prendas — con selector de tipo `HaulReferenceTypeSelector` por cada slot (14 opciones)
- `accesorios` (opcional): hasta 5, con checkbox ⭐

**Debug completo para admins:**
- `haulManifest`, `haulStylingGraph`, `haulShotItemPlans`
- `coverageByItem`: por ítem — `requiredCoverage`, `promptedHeroShots`, `routedHeroRefs`, `visualRole` (closeup/worn/held/flatlay/integrated_with_outfit/background_only), `covered`, `coverageReason`
- `accessoryCoverageMap`: por accesorio — matches evaluados con score + razón + selected, shots clasificados
- `countRecoveryDebug`: `requested/planned/generated/failed/recovered/final`
- `redundantAccessoryCloseups`, `uncoveredAccessories`
- `haulWorldMap`, `resolvedRefsPerShot`, `worldViolationsPredicted`

---

### 🔄 `outfit_week` — PATCH v3 IMPLEMENTADO, pendiente prueba (Julio 2026)

**Historia:** "mis favoritos de la semana / outfits de la semana / accesorios de la semana / bolsos de la semana / maquillaje de la semana"

Esta receta es **versátil** — se adapta al tipo dominante de ítems subidos. No es solo "outfits de cuerpo completo".

**Slots:**
- `avatar` (requerido): cara/identidad
- `outfit` (requerido): hasta 7 ítems — outfits completos, prendas, bolsos, accesorios, maquillaje, etc.
- `accesorios` (opcional): hasta 3, con checkbox ⭐ de close-up
- `escena` (opcional): ambiente general

---

**Arquitectura del patch v2:**

**WeeklyManifest:**
Construido por `buildWeeklyManifest(refs, count)`. Clasifica todos los ítems subidos (outfitSets, standaloneGarments, shoes, bags, jewelry, accessories, makeup, products). Detecta el tipo dominante del set (`outfits | accessories | bags | makeup | mixed`) para adaptar los roles narrativos.

**Planner por roles (`buildWeeklyShotPlan`):**
Genera una secuencia de `WeeklyShotPlan[]` con roles narrativos en vez de `WEEK_OUTFIT_1..N`:
- `WEEK_ANCHOR` — primer shot / base visual
- `WEEK_OVERVIEW` — selección semanal sobre cama/rack/superficie (si hay ≥2 ítems)
- `WEEK_LOOK_HERO` — look completo full body (uno por outfit)
- `WEEK_MIRROR_LOOK` — variante espejo para romper repetición (cada 3er look hero)
- `WEEK_ACCESSORY_INTEGRATED` — accesorio integrado con outfit compatible (scoring 0–100)
- `WEEK_ACCESSORY_WORN` — joyería puesta en el cuerpo
- `WEEK_ACCESSORY_HELD` — bolso/accesorio sostenido
- `WEEK_ACCESSORY_DETAIL` — macro de pieza (solo si ⭐ y hay budget)
- `WEEK_STYLING_PROCESS` — ajustando/vistiéndose
- `WEEK_CLOSER` — cierre del carrusel (anti-redundancia: reemplaza full-body genérico final)
- `WEEK_FAVORITE` — favorito de la semana
- `WEEK_DETAIL` — detalle de prenda/textura

**Cobertura garantizada:**
- Cada ítem subido es `priority: 'required'`
- El plan asigna al menos 1 shot a cada ítem antes de añadir shots narrativos extra
- Los accesorios se integran primero con outfit compatible (si score ≥65), y solo reciben closeup aislado si hay budget adicional o si el usuario lo pidió con ⭐

**Index routing activado (`indexRoutingUsed: true`):**
Cada shot recibe exactamente las refs que le corresponden según el plan:
- `outfit_N` → `allOutfitUrls[N]`
- `acc_N` → `allAccUrls[N]`
- Primaries + secondaries resueltos desde `WeeklyShotPlan.primaryItemIds` y `secondaryItemIds`
- NO se pasan todas las refs a todos los shots

**HPI safe (`buildWeeklySafeHpiBlock`):**
Poses naturales de lifestyle. Bloqueadas: poses de fitness, torso twists extremos, lat pulldown, reclined couch editorial. Ramas por rol: mirror_look, styling_process, accessory_worn, on_the_go, closer.

**Avatar base clothing suprimido:**
Bloque duro en REF0 y en todos los story shots. El avatar es solo identidad facial y proporciones. La ropa del avatar nunca cuenta como outfit de la semana.

**Prop budget activo (`scenePropBudgetApplied: true`):**
Máx 1–3 props neutros sin branding por shot. OVERVIEW puede tener más ítems. Sin cajas de retail con logos. Sin clutter.

**Branding prohibido (`externalBrandingForbiddenApplied: true`):**
No logos de Zara, H&M, Shein, Nike, Adidas en ninguna bag, caja o prop.

**Anti-redundancia del último shot:**
Si el shot final es otro full-body genérico y ya hay ≥2 look heroes, se reemplaza por `WEEK_DETAIL` o `WEEK_CLOSER`. `redundancyScore` y `replacedBecauseRedundant` se reportan en debug.

---

**Debug esperado en outfit_week (patch v3):**
```
weeklyManifest, weeklyStructure,
shotRoles[] → WEEK_OVERVIEW, WEEK_LOOK_HERO × N, WEEK_ACCESSORY_INTEGRATED, WEEK_CLOSER
redundancyScores[] → array de WeeklyRedundancyDebugEntry con replacedBecauseRedundant
weeklyCoverageMap → { [itemId]: WeeklyItemCoverage con visualWeight }
weeklyDominanceCheck → { dominantItemRisk: false o corrected: true }
weeklyAccessoryIntegrationPlan → distribución de accesorios entre outfits distintos
compositionVarietyMap → tooManyGenericFullBodyShots: false
tooManyGenericFullBodyShots: false
redundantShotNotReplaced: false
uncoveredRequiredItems_weekly[] → vacío (cobertura REAL, no superficial)
indexRoutingUsed: true
scenePropBudgetApplied: true
externalBrandingForbiddenApplied: true
avatarBaseClothingSuppressedInRef0: true
avatarBaseClothingSuppressedInStoryShots: true
unsafeHpiSuppressed: true
hpiProfileUsed: 'weekly_safe'
```

**Próxima acción:** Probar en app con Test A. Evaluar:
1. ¿El arco es OVERVIEW → 4 LOOK_HERO × outfit → ACCESSORY_INTEGRATED × 2 → CLOSER?
2. ¿Cada hero shot tiene solo el outfit asignado (no mezcla outfits)?
3. ¿Los 2 aros aparecen en 2 shots distintos, integrados con outfits distintos?
4. ¿`weeklyDominanceCheck.dominantItemRisk` es false?
5. ¿`tooManyGenericFullBodyShots` es false?
6. ¿`redundancyScores[last].replacedBecauseRedundant` es true si el cierre era redundante?
7. ¿`weeklyCoverageMap` muestra `realCoverage: true` para todos los ítems?

---

## Recetas cerradas — Product Haul

### 🔄 `product_haul` — IMPLEMENTADA, pendiente prueba (Julio 2026)

**Historia:** "miren lo que me llegó" / "acompáñenme a probar mi set nuevo" / "mis esenciales para X"

Reemplaza por completo a la receta `launch` ("Lanzamiento de producto"), que nunca tuvo lógica propia — caía al pool orgánico genérico compartido con `day_in_life`/`bts`/`travel`. Es la versión producto de `outfit_haul`: mismo esqueleto de 3 fases, pero **sin scoring de compatibilidad ni styling graph** — cada producto es independiente, no se combina con otro como una prenda con un outfit.

**Slots:**
- `avatar` (requerido): cara/identidad
- `producto` (requerido): hasta 10 productos — con selector de tipo (mismo componente `HaulReferenceTypeSelector`, categoría `producto`, opciones ampliadas: maquillaje, skincare, gadget/tech, comida/bebida, bienestar/suplemento, producto genérico)
- `empaque` (opcional): caja o packaging en la que llegaron los productos — mismo slot ámbar que `unboxing`. Si se sube, genera shots de unboxing intercalados

**Tipos de producto y modo de interacción del avatar** (`ProductHaulResolvedKind` → `ProductInteractionMode`):
- `skincare` / `makeup` → `applied_to_face_or_body` (se aplica sobre rostro/piel)
- `gadget` → `held_and_used` (se sostiene y se usa activamente)
- `food_drink` → `held_or_consumed` (se sostiene o se consume)
- `wellness` / `generic_product` → `held_or_displayed` (se sostiene o se exhibe)

`buildProductInteractionBlock()` (en `recipes/productHaul.ts`) genera el bloque de prompt que fuerza esta correspondencia — evita cruces como "aplicar" un gadget o "operar" un sérum.

**Arquitectura de 3 fases (`buildProductHaulShotPlan`):**
1. **Coverage obligatoria:** cada producto subido → 1 `PRODUCT_FEATURE_N` (hero shot garantizado)
2. **Budget narrativo:** `PRODUCT_OVERVIEW` (apertura, flat-lay de todo el set, siempre primero si hay budget), `PRODUCT_UNBOXING_N` por cada ítem de empaque (si el usuario subió), `PRODUCT_RECAP` (cierre — solo si ≥2 productos y hay budget)
3. **Interleaving:** los shots de unboxing se reparten uniformemente entre los `PRODUCT_FEATURE_N`, no se agrupan al principio ni al final

**Sin styling graph, sin scoring de compatibilidad** — a diferencia de `outfit_haul`, no existe `buildProductHaulStylingGraph` ni `scoreProductCompatibility`. Cada producto tiene su propio hero shot sin intentar combinarlo con otros.

**Debug disponible:** `productHaulManifest`, `productHaulCoverageLedger`, `uncoveredRequiredItems_productHaul`, y por shot `productHaulRoutingDebug` (primaryItemId, resolvedKind, interactionMode, isPackagingShot) + `productHaulItemPlan`.

**Decisión de arquitectura:** se descubrió que `outfit_week` ya tiene roles `WEEK_PRODUCT_*` y tipos de ítem producto (skincare/makeup/tech/beauty_product), pero viven entrelazados dentro de `buildWeeklyShotPlan()` (~1000 líneas, mezclado con lógica exclusiva de outfits ya validada en producción). Se decidió **no tocar `outfitWeek.ts`** — `product_haul` es 100% independiente, sin dependencias cruzadas con week. Se puede unificar vocabulario más adelante si hace falta, una vez validada en la app.

**Próxima acción:** Probar en app. Evaluar:
1. ¿Cada producto subido tiene al menos 1 `PRODUCT_FEATURE` shot?
2. ¿El tipo de interacción coincide con la categoría (skincare se aplica, gadget se sostiene y usa)?
3. ¿El empaque (si se subió) aparece intercalado, no agrupado al final?
4. ¿El overview aparece primero, el recap al final?
5. ¿Hay contaminación de vocabulario de "outfit" (wearing/look/outfit) en los prompts? — no debería haber ninguna

---

## Recetas cerradas — Day In Life

### 🔄 `day_in_life` — IMPLEMENTADA, pendiente prueba (Julio 2026)

**Historia:** "un día en mi vida" — puede ser UN evento/salida (cena, tienda, festival) o un día con varios momentos distintos (gym en la mañana, oficina, cena con amigas).

**Única receta multi-mundo del módulo.** Todas las demás recetas (`outfit_check`, `outfit_haul`, `outfit_week`, `product_haul`, `unboxing`) asumen un único REF0 que ancla un único mundo físico para todo el set. `day_in_life` rompe esa asunción: el brief puede describir hasta 3 momentos/lugares distintos, cada uno con su propia escena.

**Diseño validado con el usuario antes de implementar** (a partir de 6 series de referencia analizadas: tienda de accesorios, cena elegante, viaje, cumpleaños, noche de amigas, festival — el patrón común identificado fue: retrato protagonista + detalle que ancla el lugar + toma de ambiente + momento social):
- Multi-mundo desde v1 (no era la opción por defecto — se evaluó primero limitar a un solo evento, pero el usuario pidió soporte multi-mundo real)
- Input de bloques: solo texto libre en el brief, sin slot de referencia visual por bloque — la IA inventa cada escena
- Refs de outfit/producto sin bloque asignado se aplican a todos los bloques (mismo outfit todo el día, salvo que el brief diga lo contrario)
- Continuidad de identidad: cada REF0 de bloque 2+ se genera con el avatar original + el REF0 del bloque anterior como referencia (encadenado tipo posta) — misma persona, escena distinta
- Acompañante: rol narrativo opcional, activado solo si se sube una referencia — nunca se inventa un segundo personaje

**Slots:**
- `avatar` (requerido): cara/identidad
- `outfit` (opcional): hasta 4 prendas — se aplican a todos los bloques
- `producto` (opcional): hasta 3 — con selector de tipo `HaulReferenceTypeSelector` (categoría `producto`). Nueva opción `acompanante`: si el usuario marca una imagen como acompañante en vez de producto, esa referencia activa shots `BLOCK_COMPANION`. No se agregó un slot dedicado nuevo en `RecipeRefConfig` — se reusó el slot `producto` con selector de tipo para no tocar el tipo compartido por todas las recetas.
- `escena` (opcional): ambiente general — usado solo si el brief no describe bloques separables (colapsa a 1 bloque)

**Detección de bloques (`parseDayBlocks`, sin LLM):**
Heurística de texto local, mismo enfoque que `recipes/briefTags.ts` (que resuelve tags `@item` sin backend): segmenta el brief por separadores de lista (comas, " y ", saltos de línea) y solo trata un segmento como bloque si menciona una palabra reconocible de momento/lugar (`gym`, `oficina`, `cena`, `café`, etc. — lista en `MOMENT_HINT_WORDS`). Si hay menos de 2 segmentos reconocibles, colapsa a 1 solo bloque usando el brief completo — el pipeline no necesita rama especial para el caso single-world, es simplemente N=1. Máximo 3 bloques.

**REF0 encadenado (`generateDayInLifeRef0Chain`):**
Genera un REF0 por bloque, no uno solo para todo el set:
- Bloque 0: REF0 estándar — avatar + outfit/producto compartidos + `sceneHint` del bloque.
- Bloque N≥1: nueva generación que recibe avatar original + REF0 del bloque N-1 como referencias. El prompt instruye explícitamente "misma persona, ambiente distinto — no reutilices el lugar anterior".
- Cada REF0 se analiza individualmente con `ugcApiService.analyzeREF0()` → `SceneFingerprint` propio por bloque (reusa `buildSceneFingerprint` de `recipes/shared.ts` sin modificarlo, llamado N veces).
- La cadena completa se cachea en memoria (`ref0ChainCache`, mismo patrón que `anchorCache` de weeklyFavoritesV2) para que `generatePhotodumpShot` pueda recuperar el fingerprint del bloque correcto por shot sin volver a generar imágenes.

**Scene-lock por bloque activo (`buildDayBlockLockBlock`):**
Análogo a `buildREF0HardLockBlock`/`buildSceneContinuityBlock` de `outfitCheck.ts`, pero parametrizado por el fingerprint del bloque al que pertenece el shot actual — no un fingerprint global de sesión. Cada shot se ancla al mundo de SU bloque; el prompt prohíbe explícitamente mezclar muebles/luz/props entre bloques distintos.

**Shot planner (`buildDayInLifeShotPlan`) — coverage + roles narrativos:**
- **Fase 1 — coverage obligatoria:** cada bloque detectado recibe 1 `BLOCK_ESTABLISH` garantizado (retrato/selfie protagonista del momento).
- **Fase 2 — budget narrativo:** con el resto del budget, reparte `BLOCK_DETAIL` (objeto/comida que ancla el lugar) → `BLOCK_COMPANION` (si hay acompañante) → `BLOCK_AMBIENCE` (toma sin persona), alternando bloques en vez de agotar uno antes de pasar al siguiente.
- **Interleaving:** el arco final alterna `ESTABLISH` de cada bloque con sus extras correspondientes, en vez de agrupar todos los shots de un bloque de forma consecutiva.

**Wiring — 3 funciones autónomas (mismo patrón que weeklyFavoritesV2):**
`buildPhotodumpSessionPlan`, `generatePhotodumpREF0` y `generatePhotodumpShot` en el Director tienen un dispatch temprano `if (recipe === 'day_in_life')` que delega a `recipes/dayInLife.ts` sin pasar por `buildStoryDirectives` (asume mundo único) ni por el ensamblador de prompt compartido. `generatePhotodumpShot` resuelve a qué bloque pertenece cada shot leyendo el `blockId` embebido en `shot.key` (ej. `ESTABLISH_BLOCK_1`), recupera el REF0 y fingerprint de ESE bloque desde la caché, y arma el prompt con `buildDayBlockLockBlock` + los bloques globales estándar (`LOCK_SYSTEM`, `PARADIGM_RULE`, `STORY_MODE_DOMINANCE`).

**Debug disponible:** `dayInLifeManifest`, `blocksDetected[]`, `coverageByBlock`, `uncoveredRequiredItems_dayInLife`, `ref0ChainUsed`, `ref0ChainLength`, y por shot `dayInLifeRoutingDebug` (blockId, blockLabel, role, usedCompanionRef).

**Decisiones tomadas sin el usuario durante la implementación (revisar):**
1. **Slot de acompañante vía selector de tipo, no slot dedicado:** se agregó la opción `acompanante` a `HaulRefKind`/`HaulReferenceTypeSelector` (categoría producto) en vez de agregar un campo `acompanante: 'optional'` a `RecipeRefConfig`. Motivo: evitar tocar un tipo compartido por las 8 recetas y evitar UI nueva — el patrón de selector de tipo ya existía y estaba disponible para el slot producto. Si en la prueba se ve confuso mezclar "producto del día" con "acompañante" en el mismo slot, se puede separar en un slot propio después.
2. **Family blocks (UGC style hints) dejados activos** para day_in_life (no desactivados como en outfit_check/outfit_haul/product_haul). Motivo: es la receta con más variedad de mundos y podría beneficiarse de esa variedad de mood — pero no se probó, podría meter ruido/inconsistencia igual que le pasó a outfit_check antes de desactivarlos ahí.
3. **`parseDayBlocks` es heurística de texto local (regex + keywords), no una llamada a LLM.** Motivo: el patrón existente para resolver tags `@item` (`recipes/briefTags.ts`) tampoco usa LLM, y agregar una acción nueva al backend (`ugcApiService`) hubiera requerido tocar infraestructura fuera del alcance de este cambio. Riesgo: la detección de bloques puede fallar con briefs fraseados de forma no estándar (la lista `MOMENT_HINT_WORDS` es finita). A ajustar según lo que se vea en la prueba real.
4. **Máximo 3 bloques, budget mínimo 1 shot por bloque** — implementado tal como se acordó, pero no se probó qué pasa si el usuario pide `count: 3` con 3 bloques detectados (quedaría exactamente 1 `BLOCK_ESTABLISH` por bloque, sin ningún `BLOCK_DETAIL`/`BLOCK_AMBIENCE`). Puede sentirse muy plano — evaluar en la prueba si conviene un piso más alto de `count` cuando hay 3 bloques.

**Próxima acción:** Probar en app. Evaluar:
1. ¿`parseDayBlocks` detecta correctamente los bloques en un brief tipo "gym en la mañana, oficina, cena con amigas"? ¿Colapsa bien a 1 bloque con un brief de un solo evento?
2. ¿Los REF0 de bloques 2 y 3 mantienen la misma identidad facial que el bloque 1?
3. ¿Las escenas de cada bloque NO se mezclan entre sí (ropa/props de un bloque apareciendo en otro)?
4. ¿El acompañante (si se sube) aparece solo en shots `BLOCK_COMPANION`, sin inventarse en otros shots?
5. ¿El arco se siente natural o muy mecánico con el interleaving actual?
6. ¿Vale la pena separar el slot de acompañante del slot de producto? (ver decisión #1 arriba)

---

## Estado de trabajo actual

**Receta activa: `day_in_life`**

Estado: implementación completa (tipos, recipe `recipes/dayInLife.ts`, wiring en director service — 3 dispatch points — y en `PDStep2Receta.tsx`/`HaulReferenceTypeSelector.tsx` para el slot de acompañante), `tsc --noEmit` y build limpios. Pendiente prueba en app real. Ver "Recetas cerradas — Day In Life" arriba para las decisiones tomadas sin el usuario que necesitan su revisión.

**Receta anterior: `product_haul`**

Estado: implementación completa, pendiente prueba en app (sin cambios desde la última sesión).

**Receta anterior a esa: `outfit_week`**

Estado: el patch v3 documentado abajo describe la arquitectura de `recipes/outfitWeek.ts`, que **ya no está conectada** — fue reemplazada por el motor `recipes/weeklyFavoritesV2/` (ver tabla de archivos arriba). Esta sección se conserva como referencia histórica de diseño pero no describe el comportamiento actual del código. Pendiente: documentar `weeklyFavoritesV2` en detalle cuando se retome esa receta.

**Qué cambió en patch v3 (Julio 2026) sobre v2:**
- **Orden narrativo fijo:** OVERVIEW siempre primero, luego LOOK_HERO × N, luego ACCESSORY_INTEGRATED, luego CLOSER. Ya no hay anchor hero antes que el overview.
- **Role templates por dominantType:** cada tipo de set (outfits/accessories/bags/makeup/mixed) tiene su propia secuencia de roles óptima.
- **Coverage con peso visual (`WeeklyItemCoverage`):** cada ítem tiene `visualWeight`, `heroAppearances`, `detailAppearances`, `isOnlyInOverview`, `realCoverage`. `uncoveredRequiredItems_weekly` solo se vacía si el ítem tiene cobertura REAL.
- **Anti-dominancia (`WeeklyDominanceCheck`):** detecta si un ítem monopoliza >40% del peso visual total.
- **Distribución de accesorios anti-acumulación:** cada accesorio se integra con el outfit compatible de MENOR uso hasta ese momento. Nunca dos accesorios al mismo outfit si hay alternativas.
- **Reemplazo real de shots redundantes:** si `redundancyScore >= 8`, `replacedBecauseRedundant` es siempre `true`. Se registra `redundantShotNotReplaced: true` como warning si no fue reemplazado.
- **`compositionVarietyMap`:** cuenta fullBodyStanding, mirror, flatlay, detail, inHand. `tooManyGenericFullBodyShots` bloqueado.
- **Prompts específicos por rol:** cada shot tiene el label del ítem asignado, el `visualWeightIntent`, el `compositionMode`, y la lista de `forbiddenItemIds` inyectada en el prompt.
- **Shot identity block refactorizado:** inyecta `FORBIDDEN ITEMS IN FRAME`, `HERO SHOT RULES`, `OVERVIEW RULES`, `ACCESSORY RULES` según el rol del shot.

**Próxima acción:** Probar en app con los 4 test cases del brief:
- Test A: 4 outfits + 2 aros, count 8
- Test B: 3 aros + 2 bolsos + 1 zapato, count 8 (dominante = accessories)
- Test C: 5 bolsos, count 8 (dominante = bags)
- Test D: maquillaje, count 8

---

## Recetas pendientes (en orden)

1. `day_in_life` — **prueba en app** (implementación completa, ver "Recetas cerradas — Day In Life")
2. `product_haul` — **prueba en app** (implementación completa, ver "Recetas cerradas — Product Haul")
3. `outfit_week` — **prueba en app**, pero primero documentar el motor real `weeklyFavoritesV2` (el patch v3 abajo describe la versión legado desconectada)
4. `bts` — **IMPORTANTE: el avatar puede aparecer, NO es obligatoriamente faceless. Evaluar caso a caso.**
5. `travel`

**Notas globales para no repetir errores:**
- BTS NO es siempre faceless. El usuario lo aclaró explícitamente.
- No establecer reglas rígidas antes de probar — descubrir a través del testing por receta.
- No hacer parches por shot específico — siempre atacar la raíz en la generación de prompts.
- Cuando una receta pasa prueba → moverla a "Recetas cerradas" con descripción de qué se implementó.
