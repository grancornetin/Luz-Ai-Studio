# Photodump — Guía del Módulo

> **REGLAS DE MANTENIMIENTO PARA IA:**
> 1. Este archivo debe mantenerse actualizado con el estado real del módulo.
> 2. Cada vez que se agregue, modifique o elimine un feature relevante, actualizar la sección correspondiente.
> 3. Actualizar la fecha de "Última actualización" con cada cambio.
> 4. No borrar secciones — si algo fue eliminado, marcarlo como "Eliminado en [fecha]" y explicar por qué.
> 5. El objetivo es que otra IA pueda leer este archivo y entender completamente qué hace el módulo, cómo funciona, y en qué estado está, sin necesidad de leer el código.
> 6. **INSTRUCCIÓN DE CONTINUIDAD:** Al final del documento siempre debe existir la sección "Estado de trabajo actual" con el estado exacto de qué se está haciendo, en qué receta se está, y qué quedó pendiente. Cuando una receta se cierra, moverla a "Recetas cerradas". Esto permite retomar el trabajo en un nuevo chat sin perder contexto.

**Última actualización:** Junio 2026 (selector cantidad → paso 2; HPI en shots con avatar; captions con género)
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

### ✅ `outfit_check` — IMPLEMENTADA, pendiente prueba en app

**Historia:** "Elegí este outfit para X ocasión"

**Slots:**
- `avatar` (requerido): cara/identidad
- `outfit` (requerido): hasta 4 prendas del mismo look — fotos de prendas SOLAS (no avatar vistiéndolas)
- `accesorios` (opcional): hasta 3, con checkbox ⭐ de close-up por accesorio → genera shot extra
- `escena_prueba` (opcional): habitación, espejo, probador — si no se sube, se inventa según brief
- `escena_destino` (opcional): lugar final (restaurante, evento, calle) — si no se sube, el último shot usa escena_prueba

**Arco lineal:**
1. `OUTFIT_ARRIVING` — Prendas presentadas como objetos: rack, flat lay, manos sosteniendo. Sin avatar de cuerpo completo caminando.
2. `OUTFIT_MIRROR_CHECK` — Full body frente al espejo, look completo visible.
3. `OUTFIT_DETAIL` — Close-up de prenda o accesorio clave.
4. `OUTFIT_READY` — Selfie o medium shot, cara dominante, mood "lista para salir".
5. `OUTFIT_DESTINATION` — Full body en escena destino (o segundo ángulo si no hay destino).
6. `ACCESSORY_CLOSEUP` ×N — Un shot extra por cada accesorio marcado con ⭐.

**REF0:** Full body del avatar con outfit completo en escena de prueba (real o inventada).

---

### ✅ `outfit_haul` — IMPLEMENTADA, pendiente prueba en app

**Historia:** "Me probé todo esto / esta es mi cápsula"

**Slots:**
- `avatar` (requerido)
- `outfit` (requerido): hasta 6 prendas — una por slot, una por shot de try-on
- `accesorios` (opcional): hasta 3, con checkbox ⭐
- `escena` (opcional): habitación o probador donde ocurre el haul

**Arco semi-lineal:**
1. `HAUL_INTRO` — Flat lay o rack con todas las prendas. Sin avatar de cuerpo completo.
2. `HAUL_TRY_ON_N` — Avatar vistiendo cada prenda. El prompt indica cuántas prendas descartadas hay en el fondo (progresión de desorden natural).
3. `HAUL_WINNER` — Avatar con la prenda ganadora, fondo con el caos acumulado visible.
4. `ACCESSORY_CLOSEUP` ×N — Shots extra por accesorios marcados.

**Progresión de desorden:** El director indica en el prompt de cada shot cuántas prendas ya están apiladas ("En el fondo hay N prendas descartadas sobre la cama/silla"). El modelo maneja el caos narrativamente sin que el usuario tenga que hacer nada.

**REF0:** Avatar en el espacio del haul rodeada/sosteniendo varias prendas. Ambiente de "esto empieza".

---

### ✅ `outfit_week` — IMPLEMENTADA, pendiente prueba en app

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

**Próxima acción:** Re-probar las recetas outfit con los tres fixes aplicados.

**Fixes aplicados post-prueba (Junio 2026):**
1. **Selector de cantidad movido al paso 2** — eliminado de PDStep1, ahora es `- N +` en PDStep2Receta con mínimo 3 y máximo 9. Aparece junto al selector de género.
2. **HPI inyectado en shots con avatar** — `buildHpiBlock()` se llama en `generatePhotodumpShot` para todos los shots donde aparece una persona (excluye HAUL_INTRO, OUTFIT_ARRIVING, ACCESSORY_CLOSEUP, shots de objeto de unboxing). El género se toma de `refs.gender`.
3. **Captions con género** — `generatePhotodumpCaptions` recibe `gender` y lo inyecta como instrucción explícita en el prompt: masculino → gramática masculina en español, femenino → femenina, neutro → lenguaje neutro.
4. **Campo `gender` en `PhotodumpRefs`** — selector de 3 opciones (Femenino/Masculino/Neutro) en el paso 2. Default: femenino. Afecta HPI (poses, expresiones) y captions (gramática).

**Notas de implementación relevantes para debug:**
- Las prendas se pasan como fotos SOLAS — el modelo debe "vestir" al avatar. Si el resultado es raro, verificar que el usuario subió prendas sin personas.
- Los shots de `ACCESSORY_CLOSEUP` se agregan DESPUÉS del arco base y se suman al conteo total.
- `escena_destino` solo cambia la escena en el shot `OUTFIT_DESTINATION` — todos los demás usan `scenePruebaRef`.
- En `outfit_haul`, el shot HAUL_INTRO no tiene outfit específico asignado (shotOutfitIndex = -1).
- HPI NO se inyecta en shots faceless ni en shots donde no hay avatar (objeto puro, close-ups de accesorio, etc.).

---

## Recetas pendientes (en orden)

2. `day_in_life`
3. `launch`
4. `bts` — **IMPORTANTE: el avatar puede aparecer, NO es obligatoriamente faceless. Evaluar caso a caso.**
5. `travel`

**Notas globales para no repetir errores:**
- BTS NO es siempre faceless. El usuario lo aclaró explícitamente.
- No establecer reglas rígidas antes de probar — descubrir a través del testing por receta.
- No hacer parches por shot específico — siempre atacar la raíz en la generación de prompts.
