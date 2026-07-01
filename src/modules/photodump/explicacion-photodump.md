# Photodump — Guía del Módulo

> **REGLAS DE MANTENIMIENTO PARA IA:**
> 1. Este archivo debe mantenerse actualizado con el estado real del módulo.
> 2. Cada vez que se agregue, modifique o elimine un feature relevante, actualizar la sección correspondiente.
> 3. Actualizar la fecha de "Última actualización" con cada cambio.
> 4. No borrar secciones — si algo fue eliminado, marcarlo como "Eliminado en [fecha]" y explicar por qué.
> 5. El objetivo es que otra IA pueda leer este archivo y entender completamente qué hace el módulo, cómo funciona, y en qué estado está, sin necesidad de leer el código.
> 6. **INSTRUCCIÓN DE CONTINUIDAD:** Al final del documento siempre debe existir la sección "Estado de trabajo actual" con el estado exacto de qué se está haciendo, en qué receta se está, y qué quedó pendiente. Cuando una receta se cierra, moverla a "Recetas cerradas". Esto permite retomar el trabajo en un nuevo chat sin perder contexto.

**Última actualización:** Julio 2026 (outfit_haul cerrada 9/10. outfit_week patch v2 implementado — pendiente prueba en app.)
**Propósito:** Generar series fotográficas con narrativa visual coherente. Un "photodump" es una colección de fotos que cuentan una historia o transmiten un mood, muy popular en Instagram y TikTok.

---

## Qué hace este módulo

Photodump genera entre 3 y 6 imágenes que cuentan una historia visual juntas. No son fotos sueltas — tienen un hilo conductor narrativo que las conecta: un día completo, un viaje, un unboxing, una sesión editorial.

El flujo completo es:
1. El usuario elige una **receta** (unboxing, outfit, day_in_life, launch, bts, travel, libre)
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
| `HaulReferenceTypeSelector.tsx` | Selector de tipo de referencia para haul. 14 opciones (auto / look_completo / varios_items / top / bottom / vestido / enterizo / chaqueta / calzado / pantys / bolso / joyeria / accesorio). El valor viaja al pipeline y condiciona el planner y los prompts |
| `photodumpDirectorService.ts` | Lógica de generación: plan narrativo, REF0, shots, captions. Contiene `buildHaulManifest`, `buildHaulShotPlan`, `computeFinalHaulCoverageFromShots` y todos los builders de shots por tipo (try-on, adjusting, footwear, bag, jewelry, accessory, overview, recap) |
| `photodumpIntelligence.ts` | Lee banco UGC de familias visuales (story_support, creator_aesthetic). **Independiente de recetas.** |
| `types.ts` | Todos los tipos: PhotodumpSet, RecipeRefConfig, PhotodumpRefs, HaulItem, HaulManifest, HaulRefKind, HaulResolvedKind, VisualRefsAnalysisResult, etc. |
| `photodumpStorage.ts` | IndexedDB (`app_photodump_module`). Guarda sets completos |

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
| `day_in_life` | Persona + producto | Orgánico rotacional | Requerido (x3, dominante) |
| `launch` | Producto | Orgánico rotacional | Opcional |
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

### 🔄 `outfit_week` — PATCH v2 IMPLEMENTADO, pendiente prueba (Julio 2026)

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

**Debug esperado en outfit_week:**
```
weeklyManifest, weeklyStructure, shotRoles[], redundancyScores[],
indexRoutingUsed: true, scenePropBudgetApplied: true,
externalBrandingForbiddenApplied: true,
avatarBaseClothingSuppressedInRef0: true,
avatarBaseClothingSuppressedInStoryShots: true,
avatarBaseClothingLeakRisk, avatarBaseClothingUsedAsWeeklyItem: false,
accessoryIntegrationUsed, uncoveredRequiredItems_weekly[],
coveredItemIds_weekly[], unsafeHpiSuppressed: true,
hpiProfileUsed: 'weekly_safe', propBudget, brandRiskDetected,
countRecoveryDebug
```

**Próxima acción:** Probar en app. Evaluar:
1. ¿Los roles narrativos se generan correctamente (ANCHOR → OVERVIEW → LOOK_HERO × N → ACCESSORY_INTEGRATED → CLOSER)?
2. ¿El outfit correcto llega al shot correcto (index routing)?
3. ¿Los accesorios se integran con outfits en vez de aparecer solo como closeup?
4. ¿El debug muestra `indexRoutingUsed: true` y los roles esperados?
5. ¿La REF0 no usa la ropa base del avatar?
6. ¿El último shot no es redundante?

---

## Estado de trabajo actual

**Receta activa: `outfit_week`**

Estado: patch v2 implementado, pendiente prueba en app.

**Qué cambió en patch v2 (Julio 2026):**
- Reemplazado `buildOutfitWeekShotPool` por planner narrativo completo con `WeeklyManifest` + `WeeklyShotPlan`
- 13 roles narrativos en vez de `WEEK_OUTFIT_1..N` genéricos
- Index routing activado: cada shot recibe solo sus refs específicas (outfit N → URL N)
- Detección de tipo dominante del set (`outfits | accessories | bags | makeup | mixed`)
- Compatibilidad accesorio↔outfit (score 0–100) — integra antes de hacer closeup aislado
- Anti-redundancia en el último shot
- Avatar base clothing suprimido en REF0 y story shots (bloque duro)
- Prop budget + no external branding activados
- HPI safe (`buildWeeklySafeHpiBlock`) — sin poses de fitness ni editorial extremo
- Debug: `weeklyManifest`, `shotRoles`, `indexRoutingUsed: true`, `unsafeHpiSuppressed: true`, etc.

**Próxima acción:** Probar en app con los 4 test cases del brief:
- Test A: 4 outfits + 2 aros, count 8
- Test B: 3 aros + 2 bolsos + 1 zapato, count 8 (dominante = accessories)
- Test C: 5 bolsos, count 8 (dominante = bags)
- Test D: maquillaje, count 8

---

## Recetas pendientes (en orden)

1. `outfit_week` — **prueba en app** (patch v2 listo)
2. `day_in_life`
3. `launch`
4. `bts` — **IMPORTANTE: el avatar puede aparecer, NO es obligatoriamente faceless. Evaluar caso a caso.**
5. `travel`

**Notas globales para no repetir errores:**
- BTS NO es siempre faceless. El usuario lo aclaró explícitamente.
- No establecer reglas rígidas antes de probar — descubrir a través del testing por receta.
- No hacer parches por shot específico — siempre atacar la raíz en la generación de prompts.
- Cuando una receta pasa prueba → moverla a "Recetas cerradas" con descripción de qué se implementó.
