# Photodump — Guía del Módulo

> **REGLAS DE MANTENIMIENTO PARA IA:**
> 1. Este archivo debe mantenerse actualizado con el estado real del módulo.
> 2. Cada vez que se agregue, modifique o elimine un feature relevante, actualizar la sección correspondiente.
> 3. Actualizar la fecha de "Última actualización" con cada cambio.
> 4. No borrar secciones — si algo fue eliminado, marcarlo como "Eliminado en [fecha]" y explicar por qué.
> 5. El objetivo es que otra IA pueda leer este archivo y entender completamente qué hace el módulo, cómo funciona, y en qué estado está, sin necesidad de leer el código.
> 6. **INSTRUCCIÓN DE CONTINUIDAD:** Al final del documento siempre debe existir la sección "Estado de trabajo actual" con el estado exacto de qué se está haciendo, en qué receta se está, y qué quedó pendiente. Cuando una receta se cierra, moverla a "Recetas cerradas". Esto permite retomar el trabajo en un nuevo chat sin perder contexto.

**Última actualización:** Junio 2026 (outfit_check cerrada; outfit_haul implementada, pendiente prueba de aceptación)
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
| `PhotodumpModule.tsx` | Componente principal. Wizard 4 pasos + galería de sets guardados |
| `PDStep2Receta.tsx` | Paso 2: selección de receta + carga de referencias por slot |
| `photodumpDirectorService.ts` | Lógica de generación: plan narrativo, REF0, shots, captions |
| `photodumpIntelligence.ts` | Lee banco UGC de familias visuales (story_support, creator_aesthetic). **Independiente de recetas.** |
| `types.ts` | Todos los tipos: PhotodumpSet, RecipeRefConfig, PhotodumpRefs, etc. |
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
| 1 sesión Photodump (plan + captions) | 1 pro-credit |
| Cada imagen generada (REF0 + shots) | 2 créditos c/u |
| Serie de 4 imágenes | 1 pro-credit + 10 créditos (REF0 + 4 shots + 1 plan) |

---

## Estado de trabajo actual

**Metodología de trabajo:**
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

### ✅ `outfit_haul` — IMPLEMENTADA (pendiente prueba final en app)

**Historia:** "Me probé todo esto / estas son las prendas que me quedé"

**Slots:**
- `avatar` (requerido): cara/identidad
- `outfit` (requerido): hasta 10 prendas — una por slot, una por shot de try-on
- `accesorios` (opcional): hasta 5, con checkbox ⭐ (close-up obligatorio por cada marcado)
- `escena` (opcional): no usada en haul MVP (el espacio se establece en REF0)

**Count policy:** `storyShotCount = min(requestedCount, 20)`. REF0 siempre es extra (+1). Total visible = storyShotCount + 1.

**HaulManifest:** Se construye antes de planificar — clasifica prendas vs. accesorios, identifica close-ups obligatorios, determina cuántos try-ons y details caben en el budget.

**Arco (buildHaulShotPlan):**
1. `HAUL_OVERVIEW` — Contexto inicial: colección a vista, sin catálogo
2. `HAUL_TRY_ON_N` — Avatar vistiendo cada prenda (2:1 try-on vs. adjusting ratio)
3. `HAUL_ADJUSTING_N` — Micro-gesto: ajuste de cuello, manga, cintura
4. `HAUL_DETAIL_GARMENT_N` — Macro de tejido/textura/detalle de la prenda
5. `HAUL_ACCESSORY_CLOSEUP_N` — Close-up obligatorio para cada accesorio marcado ⭐
6. `HAUL_WINNER` — Último try-on: la prenda ganadora (si hay budget)
7. `HAUL_RECAP` — Cierre: todo el haul vista general

**Progresión de desorden (HaulPileState):** `clean → light_pile → medium_pile → messy_but_believable`. Derivada del ratio tryOnIndex/totalOutfits, inyectada como texto en el prompt de cada shot.

**REF0:** Establece el espacio del haul (dormitorio, probador) con iPhone UGC realismo. No es un look final. La ropa del avatar NO es un ítem del haul.

**HPI:** Safe para haul — solo body/expression. Desactivado en overview, closeup y detail. Micro-acción en adjusting. Evaluación de postura en try-on/winner. Sin props/locations de intelligence.

**Family blocks:** Desactivados (igual que outfit_check MVP).

**Regla clave:** "AVATAR CLOTHING IS NOT A HAUL ITEM" — inyectada en shotIdentityBlock, shotOutfitInstruction y REF0.

---

### ⏳ `outfit_week` — IMPLEMENTADA, pendiente prueba en app

**Historia:** "Estos fueron mis outfits de la semana / del mes / de la ocasión"

**Slots:**
- `avatar` (requerido)
- `outfit` (requerido): hasta 7 outfits completos — uno por slot, uno por shot
- `accesorios` (opcional): hasta 3, con checkbox ⭐
- `escena` (opcional): ambiente general que contextualiza la semana

**Arco orgánico:**
- Cada shot = un outfit distinto, full body.
- Framings rotan (full body frontal → espejo → three-quarters → ligeramente bajo → candid → etc.) para dar sensación de días distintos.
- No hay arco lineal — el orden de outfits sigue el orden en que se subieron.

**REF0:** Avatar con primer outfit, full body, ambiente establecido para el set.

---

## Estado de trabajo actual

**Receta activa: `outfit_haul` — implementación completa, pendiente prueba de aceptación en app**

**Qué se hizo:** Rediseño completo del sistema haul. Se reemplazó `buildHaulShotPool` + `distributeHaulShots` por una arquitectura nueva con `buildHaulManifest` + `buildHaulShotPlan`. Se separó el reference routing de haul del bloque outfit_check/week. Se agregó HPI seguro para haul, family blocks desactivados, anti-editorial iPhone UGC por shot, y regla "avatar clothing is not a haul item".

**Archivos modificados:**
- `photodumpDirectorService.ts` — HaulManifest, shot planner, builders por tipo, HPI seguro, routing, REF0
- `PhotodumpModule.tsx` — count policy, visibleImageCount, haulManifestDebug, validadores de contradicciones haul
- `PDStep2Receta.tsx` — slots outfit hasta 10, accesorios hasta 5, sublabels dinámicos
- `types.ts` — HaulItem, HaulManifest, HaulProgressState, campos debug haul

**Prueba de aceptación pendiente:**
- Prompt: "Haul de mis 6 outfits nuevos"
- 6 outfits subidos, 3 accesorios, 2 con close-up marcado
- 12 imágenes solicitadas
- Verificar: 12 story shots + 1 REF0 = 13 imágenes totales
- Verificar: close-ups aparecen en el arco
- Verificar: sin mezcla de outfits entre shots
- Verificar: progresión de desorden visible en prompts del debug

**Próxima acción:** Probar en app y ajustar según resultado.

---

## Recetas pendientes (en orden)

1. `outfit_haul` — **prueba de aceptación en app** (implementación lista)
2. `outfit_week` — implementada, falta validar en app
3. `day_in_life`
4. `launch`
5. `bts` — **IMPORTANTE: el avatar puede aparecer, NO es obligatoriamente faceless. Evaluar caso a caso.**
6. `travel`

**Notas globales para no repetir errores:**
- BTS NO es siempre faceless. El usuario lo aclaró explícitamente.
- No establecer reglas rígidas antes de probar — descubrir a través del testing por receta.
- No hacer parches por shot específico — siempre atacar la raíz en la generación de prompts.
