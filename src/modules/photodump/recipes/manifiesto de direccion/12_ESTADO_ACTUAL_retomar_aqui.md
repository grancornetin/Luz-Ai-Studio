# ESTADO ACTUAL — Leer esto primero para retomar el trabajo

> **Para qué sirve este documento**: si este chat creció demasiado, o el usuario
> abre un chat nuevo para ahorrar tokens, este archivo debe alcanzar para
> retomar el trabajo de Photodump / `outfit_multi_look` sin perder acuerdos ni
> hallazgos. Se actualiza cada vez que hay un cambio de estado relevante
> (nueva fase completada, bug encontrado, decisión tomada). No reemplaza el
> resto del manifiesto — es el índice de "dónde vamos" que apunta al resto.

Última actualización: 2026-07-22.

## ✅ Segunda receta Fashion integrada — `outfit_reveal_basic` (2026-07-22)

Tras aprobar `outfit_multi_look`, se integró `outfit_reveal_basic` a la app
real siguiendo el mismo patrón estructural. Commit `66e8ab6`, deploy
`dpl_5RU1WaSs6BnxBKzg1TjH3cMUp6HX`. **Pendiente: confirmación visual del
usuario** — todavía no se generó ningún set real en la app.

**Qué es**: receta mucho más simple que `outfit_multi_look` — sin looks
múltiples, sin intenciones, siempre los mismos 3 shots fijos (validados a
mano en `10_session_log_outfit_reveal_basic_validation.md`):
1. `mirror_check` — mirror selfie de cuerpo completo, celular visible.
   Cumple doble función de ancla y primer shot publicable (mismo patrón de
   fusión REF0+shot1 de `outfit_multi_look`).
2. `self_pov` — POV genuino, cámara = los propios ojos mirando hacia abajo,
   sin celular/brazo/rostro visible. Sin HPI (no existe familia real para
   esto).
3. `close_detail` — selfie de cerca, mano en el pelo, celular visible.

Reemplaza a la intención `rate_check` eliminada de `outfit_multi_look` —
"calificar mi look" ahora vive acá.

Código nuevo en `src/modules/photodump/recipes/outfitRevealBasic/` (8
archivos: types, contracts, referenceRouter, routingValidator,
intelligenceLayer, promptBuilder, debug, index) — **sin**
manifest/allocator/contractValidator/anchorChain (no aplican: no hay looks
que repartir ni fondo variable).

**Cambio de arquitectura transversal**: las constantes de render globales
(`IPHONE_CAMERA_ROLL_LINE`, `UGC_CASUAL_COMPOSITION_BLOCK`,
`NO_WALKING_LINE`, `AVOID_EDITORIAL_LINE`, `NO_STUDIO_BACKDROP_LINE`) se
movieron de `outfitMultiLook/renderProfile.ts` a `recipes/shared.ts` — son
reglas de toda la app, no de una receta puntual. `outfitMultiLook/renderProfile.ts`
quedó como re-export para no romper sus 3 consumidores internos
(`anchorFixed.ts`, `anchorChain.ts`, `promptBuilder.ts`). Verificado con
`npm run lint` + `npm run build` que `outfit_multi_look` no sufrió ninguna
regresión.

**HPI verificado contra el JSON real** antes de usarlo (mismo cuidado que
con `outfit_multi_look`): `mirror_check` usa `STANDING_ASYMMETRIC_FASHION_POSE`
+ `MIRROR_SELFIE_REFLECTION`, `close_detail` usa `UPPER_BODY_SELFIE_POSE` —
los 3 `familyId` confirmados existentes en
`src/data/HPI/03_reglas_director_hpi_mujer_151.json` antes de escribir código.

**Decisión de producto tomada durante la implementación**: a diferencia del
diseño original validado a mano (que asumía "1 outfit ya armado, 1 imagen"),
el usuario decidió permitir subir varias prendas sueltas como slots
separados (igual que `outfit_check`) — el prompt las trata como componentes
de un solo look combinado, reusando el mismo criterio textual que
`photodumpDirectorService.ts` ya usa para `outfit_check`/`outfit_haul`/`outfit_week`
(`outfitRefInstruction`), no como looks independientes.

**Nota operativa importante — ramas paralelas**: durante esta sesión
apareció una rama `feat/photodump-qa-agent` (otro agente/proceso trabajando
en paralelo sobre el mismo repo, con una carpeta `tools/photodump-qa-agent/`
propia). El usuario confirmó: *"hay otro agente trabajando en la rama, tu
trabaja en el main el otro agente trabajará en la rama luego pasará a
main."* — es decir, este hilo de trabajo (Photodump/recetas) sigue siempre
en `main`; no tocar ni fusionar la rama del otro agente, y no sorprenderse
si el working directory aparece en esa rama por un cambio externo — volver
a `main` con `git checkout main` es seguro (no pierde el otro trabajo, cada
rama mantiene su propia copia de los commits).

## Cambio reciente — selector manual de cantidad restaurado + fix de unidades

Tras el fix anterior (cantidad = looks siempre, sin botones), el usuario
reportó que **ninguna** intención de `outfit_multi_look` dejaba elegir
cantidad — quería poder pedir menos fotos que looks subidos. Se restauraron
los botones +/-, con tope en la cantidad máxima real (looks subidos, ×2 en
`curated_ideas`). Esto expuso un bug real: `allocateLookShots` recibía
`requestedCount` en unidades de FOTOS pero lo trataba como cantidad de
LOOKS — en `curated_ideas`, pedir "3 fotos" con 3 looks devolvía los 3
looks completos (6 fotos), ignorando el recorte. Se agregó
`requestedCountToLookCount()` en `allocator.ts` para convertir antes de
repartir, aplicado en los 3 puntos de entrada de `index.ts`. Commit
`d36816f`, deploy `dpl_5q176B4XHD2G7X7KJkQhwGwBi9DZ`.

## Cambio reciente — 3 bugs reales de curated_ideas, primera tanda de prueba real

El usuario generó el primer set real de `curated_ideas` (3 looks de boda:
vestido rojo, falda rosa, vestido rosa) y encontró 3 problemas, confirmados
leyendo el JSON de debug:

1. **Shot de variación del look 1 idéntico al frontal** (las 2 fotos del
   vestido rojo eran la misma imagen). Causa: el chequeo de "ya generado
   como ancla" en `index.ts` solo comparaba `lookId`, no `angle` — el shot
   de variación del primer look entraba en la misma rama que el frontal y
   devolvía la imagen cacheada sin generar nada nuevo. Fix: se agregó
   `angle === 'frontal'` a la condición.
2. **El close-up de tela cambiaba el color de la prenda** (vestido rosa se
   veía de otro tono en el macro). Causa: `fabric_detail_closeup` en
   `promptBuilder.ts` no pedía preservar el color exacto. Fix: instrucción
   explícita de fidelidad de color agregada.
3. **Poses planas/contradictorias pese al fix anterior de variantes**.
   Causa real, más profunda que el fix previo: `buildHpiBlock`
   (`hpiService.ts`) elige entre las 9 familias de `poseBanks` sin ningún
   filtro — varias son literalmente sentada/reclinada/gimnasio/piso
   (`SEATED_EDITORIAL_OR_LIFESTYLE_POSE`, `ACTIVE_FITNESS_FORM_DISPLAY`,
   `MIRROR_SELFIE_FLOOR_POSE`), y terminaban inyectando texto como "seated
   on floor doing a lat pulldown" en el mismo prompt que pedía "standing
   mirror selfie" — contradicción directa que el modelo resolvía a su
   manera, dando poses genéricas. Fix: se agregó `HpiConfig.allowedFamilies`
   (nuevo campo opcional, por banco: pose/gesture/camera) en `hpiService.ts`,
   y `outfitMultiLook/intelligenceLayer.ts` lo usa para restringir el HPI a
   las únicas 3 familias reales de pie/cuerpo completo verificadas contra el
   JSON del banco: `STANDING_ASYMMETRIC_FASHION_POSE` (pose),
   `MIRROR_SELFIE_REFLECTION` (camera), `CLOSED_OR_CONFIDENT_ARM_PLACEMENT`
   (gesture).

Commit `fa7334b`, deploy `dpl_59ubr93ArLtZx1XLz9bjf5tNqeVM`. **Pendiente**:
confirmación visual del usuario con una nueva tanda de `curated_ideas`.

**Nota para el futuro**: si aparece contenido de HPI que contradice el
resto del prompt en OTRA receta (no solo `outfit_multi_look`), el mismo
mecanismo de `allowedFamilies` se puede reusar — pero hay que volver a
inspeccionar `dominantTags`/`familyId` del banco JSON real
(`src/data/HPI/03_reglas_director_hpi_mujer_151.json` /
`...hpi_51 hombre.json`) para esa receta específica, los IDs no son
universales entre contextos (standing vs. sentada vs. tumbada).

## Cambio reciente — curated_ideas ahora genera 2 shots por look

`curated_ideas` (una de las 4 intenciones vigentes) dejó de ser "1 foto por
look" — ahora cada look produce **2 fotos**: la frontal (igual que antes) +
una de variación (trasera / lateral / close-up de tela, rotada por
`look.sourceIndex`, ver `contracts.ts`). También se agregó un pool opcional
de calzado/accesorios (`curatedIdeasAccessoryRefs`/`-Links` en
`PhotodumpRefs`) con enlace many-to-many a looks vía chips en la UI — si un
accesorio está enlazado se cita fielmente, si no, el modelo elige con
criterio de estilista sin inventar marca/objeto imposible.
`weekly`/`then_vs_now`/`trip_recap` NO cambiaron, siguen 1 foto por look.
Deploy `2ae3585` / `dpl_9Q6NYZ6i9ieXhEEgbyQEi4D4L5X2`, pendiente de
confirmación visual del usuario.

## Cambio reciente — trip_recap: el lugar ahora es una FOTO, no texto

Bug de UX real: el usuario probó `trip_recap` con 3 outfits + lugares
escritos en el brief general ("Santiago - Parque O'Higgins @outfit") y no
funcionó — el motor real leía el lugar de un input de texto separado,
puesto debajo de cada outfit en la UI, que **se veía como un slot de imagen
vacío** (confuso) y encima era redundante con el slot `@escena` que ya
existe en toda la app (`SLOT_CATALOG.escena`, "SCENE/LOCATION REFERENCE").

**Fix** (commit `1e1c6e3`, deploy `dpl_FwUqKVHmSqhgV798cgzp3zaCMNf5`): se
eliminó `multiLookPlaces` (texto) por completo. Ahora el lugar de cada look
se sube como **foto real** en el slot Escena, asociada por posición (Escena
1 ↔ Look 1, Escena 2 ↔ Look 2...) — mismo mecanismo que ya usa
`multiLookEras` para `then_vs_now`. `anchorChain.ts` cita esa imagen como
referencia visual directa en el prompt ("SCENE / LOCATION REFERENCE:
replicate the environment...") en vez de nombrar el lugar de memoria. La
regla de "nunca inventar el lugar" se mantiene — si un look no tiene foto
de escena asociada, `generateAnchorChain` bloquea con error claro.

`LookItem.placeLabel: string` pasó a `placeSceneUrl: string` (y
`MultiLookLookItem` en `types.ts` raíz igual). El límite de slots de escena
ahora iguala al de outfit cuando `intent === 'trip_recap'` (antes tope
genérico de 3, insuficiente para más de 3 looks).

**Nota importante para el futuro**: el modelo de generación de imágenes
(Gemini) **no navega internet ni busca fotos reales del lugar** — cuando el
usuario sube una foto de referencia, el modelo usa esa imagen como guía
visual directa (mejor fidelidad); si en cambio solo se nombra un lugar por
texto (como pasaba antes), el modelo dibuja de memoria/entrenamiento, sin
verificar cómo se ve ese lugar hoy. Por eso ahora se prioriza la foto real
sobre el texto — no es solo una mejora de UX, es mejor fidelidad visual.

**Pendiente**: confirmación visual del usuario con un caso real (3 looks +
3 fotos de escena: Parque O'Higgins, Dunas de Concón, Costanera Río
Calle-Calle).

## 1. Qué es esto

Luz IA Studio es una app de generación de contenido con IA para creadoras de
moda/belleza en Chile/LATAM (ver `COMERCIAL.md` en la raíz del repo para tono
de voz y buyer persona "Sofi" — **siempre** escribir copy de UI en ese
lenguaje, sin jerga técnica).

El usuario **no programa**. Explicaciones en español, sin jerga, con ejemplos
prácticos (ver memoria `feedback_communication_style`).

`Photodump` es un módulo del sistema que genera sets de fotos tipo "camera
roll real" (no editorial) a partir de recetas narrativas predefinidas
(day_in_life, outfit_week, outfit_haul, etc). Cada receta tiene su propio
motor de prompts en `src/modules/photodump/recipes/`.

## 2. En qué fase estamos

**Fase 8 — piloto de integración de `outfit_multi_look` a la app real —
completada, integrada Y APROBADA por el usuario (2026-07-22).** Fue la
primera receta del grupo "Fashion" en pasar de "prompts validados a mano en
Higgsfield" a código real corriendo en producción, y ya pasó por varias
rondas de prueba real con bugs encontrados y corregidos (ver sección 5 y
"Qué falta" abajo). Las otras 2 recetas Fashion validadas en el manifiesto
(`outfit_night_out`, `outfit_reveal_basic`) **todavía NO están integradas**
— siguen siendo documentación pura en esta carpeta, sin código en `src/`.
**Siguiente paso del proyecto: integrarlas, siguiendo el mismo patrón.**

### Qué es `outfit_multi_look`

Una sola receta con 4 intenciones (el usuario elige una en la UI):

| Intención | Qué cuenta | Fondo |
|---|---|---|
| `weekly` | Mi semana en looks | Fijo, una sola ancla |
| `then_vs_now` | Antes vs. ahora | Fijo, una sola ancla (jerarquía vive en `era` por look, no en 2 anclas) |
| `curated_ideas` | Ideas para [ocasión/tendencia] | Fijo, una sola ancla |
| `trip_recap` | Los looks de mi viaje | Variable — un lugar distinto por shot, declarado por el usuario |

**`rate_check` (calificá mi look) se eliminó el 2026-07-21** — ver sección
"Decisiones de diseño" más abajo.

Motor completo en `src/modules/photodump/recipes/outfitMultiLook/` (13
archivos: types, manifest, anchorFixed, anchorChain, allocator, contracts,
contractValidator, referenceRouter, routingValidator, renderProfile,
intelligenceLayer, promptBuilder, debug, index).

Diseño narrativo completo (por qué existe cada regla) en
`11_session_log_outfit_weekly_recap_validation.md`, secciones 6/6bis/6ter/6quater.

## 3. Reglas de negocio fijas (no re-descubrir, ya están decididas)

- **El motor de generación de imágenes siempre fue Gemini** — Higgsfield fue
  solo la interfaz usada para validar prompts a mano, nunca el motor real.
- **Nunca generar shots de "caminando"** — se ven falsos sin excepción
  (física de piernas en movimiento no resuelta por el modelo). Regla global,
  implementada como `NO_WALKING_LINE` en `renderProfile.ts`.
- **En `trip_recap`, el usuario declara los lugares** — el sistema nunca
  inventa qué es "icónico" de una ciudad, salvo mega-ciudades ultra-reconocidas
  (NY, París, Roma, Londres, Tokio) donde puede sugerir un punto de partida
  editable.
- **Composición debe ser casual/UGC, nunca editorial** — Finding 005:
  sujeto descentrado, mirada fuera de cámara, lugar de fondo "asomándose" no
  centrado, encuadre imperfecto. Implementado como `UGC_CASUAL_COMPOSITION_BLOCK`.
- **El fondo del ancla fija nunca debe ser un estudio fotográfico** — ver
  sección 5 (bug encontrado 2026-07-21). Implementado como
  `NO_STUDIO_BACKDROP_LINE`.
- **"Elements" de Higgsfield no existen como concepto en la app real** — el
  equivalente ya existente es el sistema de `@tags`/`slotCatalog.ts` que cita
  referencias por slot (rostro, cuerpo, etc). No se creó nada nuevo para esto.
- **Alcance del piloto**: solo 1 receta integrada a la vez. No se toca el
  agrupamiento de recetas por categoría (Fashion/Shoes/Beauty) en la UI
  todavía — es un cambio transversal, diferido a después de integrar las 3
  recetas Fashion.
- **Autonomía autorizada**: el usuario dio permiso explícito para implementar,
  commitear, pushear a `main` y correr `vercel deploy --prod` sin pedir
  confirmación en cada paso, específicamente para este trabajo de Photodump.
  (Ver memoria `feedback_commit_deploy` y `feedback_deploy_manual` — commit+push
  automático tras cada cambio, pero el deploy a producción se hace manual con
  `vercel deploy --prod` porque el auto-deploy de Vercel vía GitHub no es
  confiable.)

## 4. Estado técnico verificado

- `npm run lint` (tsc --noEmit) limpio, sin errores, en todo el repo.
- Build de producción (`vercel deploy --prod`) exitoso, último deploy
  2026-07-21, commit `6ef00ea`.
- `outfit_multi_look` aparece en `PDStep1.tsx`, con selector de intención en
  `PDStep2Receta.tsx`, persistencia de preset en `photodumpPresetAdapter.ts`.

## 5. Historial de bugs encontrados en producción (piloto)

### Bug 1 — Fondo de estudio fotográfico en vez de espacio doméstico (RESUELTO)

**Síntoma reportado por el usuario**: al generar `weekly`, las fotos salían
con fondo de estudio de fotografía (backdrop liso, piso de concreto) en vez
del espacio doméstico/orgánico validado manualmente (habitación, baño,
frente a un escaparate).

**Causa**: el ancla fija (`anchorFixed.ts`) y el prompt de cada shot
(`promptBuilder.ts`) nunca describían explícitamente qué TIPO de lugar debía
generarse — solo pedían "mirror selfie" y dejaban el fondo abierto. Sin ese
anclaje textual, el prior más fuerte del modelo para esa composición
("mirror selfie de moda") es literalmente un set de estudio. En el diseño
original validado a mano, el fondo siempre venía de un ejemplo real citado
(ej. el carrusel de Instagram con hall de entrada y espejo dorado) — al
pasar a código, esa descripción implícita se perdió.

**Fix aplicado** (commit `6ef00ea`, 2026-07-21): se agregó
`NO_STUDIO_BACKDROP_LINE` en `renderProfile.ts` — instrucción explícita de
que el fondo debe ser un espacio doméstico/cotidiano real (dormitorio, baño,
pasillo, clóset, o reflejo en vitrina de calle), nunca estudio ni backdrop
liso. Se conectó en `anchorFixed.ts` (el ancla) y en `promptBuilder.ts`
(cada shot con `mirrorSelfieBlock`). `trip_recap` no necesitó el fix porque
ya describe un lugar concreto por shot (`anchorChain.ts` ya dice "at
[placeLabel]"), sin ambigüedad.

**Pendiente de esta parte**: el usuario todavía no confirmó visualmente que
el fix funcionó — falta volver a generar un set de `weekly` en la app y
revisar el fondo.

### Bug 2 — Error de modelo Gemini no encontrado (RESUELTO, causa ajena al código)

**Síntoma**: al generar `rate_check` ("califica mi outfit"), la consola
mostraba: `Publisher model 'projects/luz-ai-studio/locations/global/publishers/google/models/gemini-3.1-flash-image-preview' was not found or your project does not have access to it.`

**Causa real (confirmada por el usuario)**: Google activó autenticación en 2
pasos en la cuenta de Google Cloud del proyecto y, al no estar configurada
todavía del lado del usuario, se perdió el acceso al modelo. **No era un bug
de código** — `gemini-3.1-flash-image-preview` es el modelo correcto y
oficial de todo el sistema (ver `api/gemini/image-worker.ts` línea 151,
documentado a propósito, con `gemini-2.5-flash-image` explícitamente
excluido por decisión de diseño).

**Estado**: el usuario configuró la 2FA, pero además Google deshabilitó del
todo la versión `-preview` de este modelo (no solo un tema de acceso de la
cuenta). **Fix adicional aplicado 2026-07-21** (commit posterior a este): se
cambió el nombre del modelo en todo el código de `gemini-3.1-flash-image-preview`
→ `gemini-3.1-flash-image` (versión oficial, mismo precio/rendimiento, sin
`-preview`). Archivos tocados: `api/gemini/image-worker.ts`,
`api/gemini/image.ts`, `api/gemini/ugc.ts`, `api/gemini/ugc-worker.ts`,
`api/avatar/clone-worker.ts`, `src/services/creditConfig.ts` (fuente única
de verdad, `MODELS.FLASH`), y `PRICING_BRIEF.md`. **Confirmado por el usuario
2026-07-21: ya genera exitosamente en producción.**

**Importante para el futuro**: si vuelve a aparecer un error de "model not
found / no access" en cualquier receta (no solo `outfit_multi_look`), primero
revisar si Google volvió a renombrar/deprecar el modelo de imagen (ya pasó
una vez, de `-preview` a la versión estable) antes de sospechar solo de
2FA/acceso de cuenta. El nombre vigente vive en `src/services/creditConfig.ts`
→ `MODELS.FLASH`, y se referencia también (hardcodeado, no importado desde
ahí) en los 5 archivos de `api/` listados arriba — si cambia de nuevo, hay
que tocar los 6 lugares.

### Bug 3 — REF0 generaba una foto extra sin outfit, en vez de ser el look 1 (RESUELTO)

**Síntoma reportado por el usuario**: al generar un set de `weekly`, notó
que se generaba un REF0 y le pareció recordar que el diseño original iba
directo al primer outfit, sin una foto de ancla separada.

**Causa confirmada**: el diseño validado a mano (manifiesto sección 3,
"Día 1 — ancla de escena... outfit puesto, aprobado en 1 iteración") siempre
generó el ancla **con el primer outfit ya puesto** — la foto del ancla y la
foto del look 1 son la misma imagen. El código implementado en el piloto
(`anchorFixed.ts` original) generaba en cambio una foto de ancla separada
con "ropa neutral, no el look real" y LUEGO generaba una foto aparte para el
look 1 — resultando en N+1 fotos (1 ancla vacía + N looks) en vez de las N
fotos que el diseño manual siempre produjo.

**Fix aplicado** (commit `cd870f1`, 2026-07-21): `generateFixedAnchor` en
`anchorFixed.ts` ahora recibe el primer look y lo cita directamente en el
prompt del ancla — la foto generada ya lleva el outfit puesto. En
`index.ts`, se agregó `firstLookImageCache` para que cuando
`generateOutfitMultiLookShot` reciba el shot correspondiente a ese primer
look, devuelva la imagen ya generada en vez de crear una segunda foto
redundante — mismo patrón que ya usaba `trip_recap` (cada eslabón de la
cadena ya es el resultado final, no se regenera).

**Estado**: código corregido y deployado. Falta que el usuario confirme
visualmente que ahora un set de `weekly` de N looks produce exactamente N
fotos (no N+1), y que la primera foto del set muestra el primer outfit
puesto (no ropa genérica).

**Confirmado por el usuario 2026-07-21**: generó un set de `weekly` real (4
fotos, sin contar REF0 aparte — Bug 3 resuelto: fondo consistente y
doméstico real en las 4, Bug 1 resuelto). Pero detectó 2 bugs nuevos en el
mismo set, documentados abajo como Bug 4.

### Bug 4 — Pose plana repetida y fondo desordenado (RESUELTO)

**Síntoma**: de las 4 fotos del set, la primera (el ancla/look 1) tenía una
pose orgánica con intención real (contrapposto, mirada con carácter). Las
otras 3 eran casi idénticas entre sí: de frente a cámara, brazos pegados al
cuerpo, sin variación — planas. Además, el fondo (pasillo con perchero,
espejo, mesa auxiliar) se veía desordenado/caótico, en contradicción con
looks elegantes y cuidados ("parece una contradicción que alguien se vista
tan bien y sea desordenada").

**Causa 1 (pose)**: `contracts.ts` → `poseIntensityFor` devuelve `'neutral'`
para las 4 intenciones sin jerarquía (weekly, rate_check, curated_ideas, y
el "before"/"after" de then_vs_now son las únicas con variantes reales). Y
`poseLineFor('neutral')` en `intelligenceLayer.ts` era **una sola frase fija
idéntica** para todos los shots del set — sin variación entre looks. El
ancla, además, ni siquiera pasaba por `intelligenceLayer.ts` (no tenía
`applyIntelligence` conectado en absoluto), por eso fue la única foto con
dirección de pose real (el modelo improvisó libremente sin instrucción).

**Causa 2 (fondo)**: `NO_STUDIO_BACKDROP_LINE` en `renderProfile.ts` pedía
literalmente `"clutter"` (desorden) como parte de "detalles reales" para
escapar del look de estudio — eso es lo que generó el pasillo caótico.

**Fix aplicado** (commit `b427f59`, 2026-07-21):
- `intelligenceLayer.ts`: se agregó `NEUTRAL_POSE_VARIANTS`, un banco de 4
  posturas neutrales distintas (peso del cuerpo, ángulo de cabeza, gesto de
  mano libre, mirada), rotadas determinísticamente por `look.sourceIndex` —
  cada shot del mismo set ahora pide una pose distinta, sin depender de
  aleatoriedad no reproducible.
- `anchorFixed.ts`: se conectó `applyIntelligence` (pose + HPI + negativos)
  al ancla, que antes no la tenía — ahora usa la misma capa de dirección de
  pose que el resto de los shots, en vez de generar "a ciegas".
- `renderProfile.ts`: `NO_STUDIO_BACKDROP_LINE` corregida — ya no pide
  "clutter", ahora pide explícitamente "tidy and well cared for... someone
  who dresses with intention and care. Not a blank staged set, but not a
  messy or cluttered space either."

**Confirmado por el usuario 2026-07-21**: "muchísimo mejor" — pose variada
y fondo prolijo en el set nuevo. Bug 4 resuelto.

Al probarlo, el usuario notó 2 problemas más, de la capa de UI/créditos (no
del motor de prompts) — documentados como Bug 5.

### Bug 5 — Ancla duplicada en pantalla y sobrecobro de créditos (RESUELTO)

**Síntoma**: tras el fix del Bug 3 (REF0 fusionado con el look 1), el
usuario notó que la UI seguía mostrando un recuadro "Ancla" separado — la
imagen del look 1 aparecía dos veces en pantalla (una en el recuadro
violeta "Ancla", otra en su slot normal del grid de shots), aunque fuera la
misma URL sin generación extra. También preguntó si se estaban cobrando
créditos por esa imagen "de más".

**Causa 1 (UI duplicada)**: `PhotodumpModule.tsx` tiene un recuadro fijo
para `partialImages[0]` (el ancla) que se muestra SIEMPRE, separado del
grid de `count` shots — diseñado para recetas donde el ancla es una imagen
extra real (`outfit_week`, `day_in_life`, etc). Nunca se actualizó para
`outfit_multi_look`, donde el ancla y el shot del look 1 son la misma
imagen.

**Causa 2 (sobrecobro confirmado, real)**: `imageCreditCost = (count + 1) *
CREDITS_PER_IMAGE` — el "+1" asume que el REF0 siempre implica una llamada
extra a Gemini (cierto para la mayoría de recetas). Para `outfit_multi_look`
eso es falso desde el fix del Bug 3: el ancla no genera una imagen aparte.
Se estaba cobrando 1 imagen de más (2 créditos) por cada sesión de esta
receta sin ninguna generación real detrás.

**Fix aplicado** (commit `a5a832c`, 2026-07-21):
- `imageCreditCost`: para `recipe === 'outfit_multi_look'` se cobra `count *
  CREDITS_PER_IMAGE` (sin el +1). El resto de recetas no cambia.
- El recuadro "Ancla" en la vista de generación (`step === 3`) se oculta
  cuando `recipe === 'outfit_multi_look'` — el look 1 ya se ve en su slot
  normal del grid.
- `finalizarSet`: ya no antepone `anchorImage` al array de imágenes del set
  guardado para esta receta (antes duplicaba la imagen del look 1 con
  `order: 0` Y `order: 1` en el set final/biblioteca).

**Estado**: código corregido y deployado. Falta que el usuario confirme
visualmente (ya no debería verse el recuadro "Ancla" aparte, ni la imagen
del look 1 duplicada en biblioteca) y que el costo de la sesión sea `count`
imágenes, no `count + 1`.

### Bug 6 — Cantidad de fotos desconectada del número real de looks (RESUELTO)

**Síntoma**: el usuario probó `then_vs_now` con 2 outfits subidos, pero el
selector de "cantidad de imágenes" (otro control del mismo paso 2) tenía 4
— preguntó qué debía esperar.

**Causa**: en `outfit_multi_look`, el número de fotos SIEMPRE es 1 por look
subido (`allocator.ts`) — el selector de "cantidad" (`count`), pensado para
recetas donde de verdad se elige cuántas fotos generar, no tiene ningún
efecto real acá salvo capar hacia abajo. Con 2 looks y `count=4`, el
resultado real son 2 fotos — correcto según el diseño, pero sin ningún
aviso de por qué el número no coincidía con lo seleccionado.

**Fix aplicado** (commit `d1289fb`, 2026-07-21), en `PDStep2Receta.tsx`:
- Se agregó sincronización automática: `count` se ajusta en tiempo real a
  la cantidad de looks subidos (`outfitRef` + `outfitRefs`) cada vez que
  cambian, vía `useEffect`.
- El selector +/- de cantidad se reemplaza, solo para esta receta, por un
  número informativo no editable, con el texto "Se genera 1 foto por look
  que subas abajo — no hace falta elegir cantidad."

**Estado**: código corregido y deployado. Falta que el usuario confirme
que al subir/quitar looks el número de "fotos" se actualiza solo y que ya
no puede quedar desalineado.

## Decisión de diseño — eliminación de `rate_check` (2026-07-21)

Al probar `then_vs_now`, el usuario preguntó por qué "calificá mi look"
(`rate_check`) generaba 1 sola foto sin variación de ángulo — esperaba
close-ups, laterales, vista trasera, como para poder evaluar el outfit de
verdad. Se revisó el manifiesto (`11_session_log...md` línea 67): el diseño
original SIEMPRE fue 1 sola foto de espejo, sin variación — imitando el
formato real de "rate my outfit" en redes (una sola foto de espejo pidiendo
nota 1-10), y **nunca se generó ni un solo shot de prueba de esta
intención**, ni a mano ni en la app.

Comparando con `outfit_reveal_basic` (receta ya validada en el manifiesto,
`10_session_log_outfit_reveal_basic_validation.md`, **todavía no integrada
a la app**): esa receta sí es exactamente "1 outfit, varios ángulos
deliberados" — mirror check de cuerpo completo, POV mirando hacia abajo,
close-up de rostro/torso. Es más rica visualmente y puede contar la misma
historia ("calificá este look") con mejor copy, sin necesidad de mantener
una versión más pobre de lo mismo como intención aparte.

**Decisión del usuario**: eliminar `rate_check` de `outfit_multi_look` —
"no es lo suficientemente bueno para ser una receta sola". La historia de
"calificá mi look" pasa a resolverse con `outfit_reveal_basic` cuando esa
reciba su propia integración a la app (ver pendiente 3 abajo) — no con
`outfit_multi_look`.

**Cambios de código** (commit pendiente de push al momento de escribir esto):
`MultiLookIntent` en `types.ts` pasó de 5 a 4 valores; se quitó el caso
`rate_check` de `promptBuilder.ts` (outfitLine) y de la UI
(`MULTI_LOOK_INTENT_OPTIONS` en `PDStep2Receta.tsx`); comentarios
actualizados en `anchorFixed.ts`, `contracts.ts`, `intelligenceLayer.ts`,
`index.ts`, `photodumpDirectorService.ts`. `npm run lint` limpio — ningún
switch/objeto exhaustivo dependía de ese caso.

**Nota para el futuro**: si alguien pide reintroducir "calificar mi look"
como historia dentro de `outfit_multi_look`, la respuesta correcta es
señalar `outfit_reveal_basic` en vez de recrear `rate_check` — ya existe
diseño validado y con más riqueza visual para esa historia exacta, solo
falta integrarlo a la app (mismo patrón que este piloto).

## ✅ `outfit_multi_look` — APROBADA por el usuario (2026-07-22)

Las 4 intenciones vigentes (`weekly`, `then_vs_now`, `trip_recap`,
`curated_ideas`) quedaron validadas en la app real tras encontrar y corregir
6 bugs de producción + 3 bugs adicionales de `curated_ideas` + el fix de
selector de cantidad (ver Bugs 1-6 arriba y la sección de `curated_ideas`
ronda 3). El usuario confirmó explícitamente: "esta receta y sub
intenciones quedan aprobadas". No se requieren más cambios en
`outfit_multi_look` salvo que aparezca un problema nuevo al usarla.

## 6. Qué falta (pendientes explícitos)

1. **Confirmar visualmente `outfit_reveal_basic`** — generar un set real en
   la app (avatar + 1 o más prendas) y revisar los 3 shots: mirror check
   completo, POV genuino sin rostro, close-up. Todavía sin ninguna
   confirmación visual del usuario.
2. **Integrar la última receta Fashion** (`outfit_night_out`) a la app real
   — mismo patrón estructural. Es la más compleja de las 3 (7-8 shots, arco
   narrativo con venue, continuidad de mundo entre escenas) — dejarla para
   el final fue la decisión correcta.
3. Agrupar recetas por categoría (Fashion/Shoes/Beauty) en `PDStep1.tsx` —
   explícitamente diferido hasta que las 3 recetas Fashion estén integradas
   y probadas. Con 2 de 3 listas, todavía falta `outfit_night_out`.
3. Formalizar el bloque de composición UGC casual (Finding 005) en
   `03_photodump_recipe_architecture.md` sección 19, como parte oficial del
   perfil `iphone_camera_roll` — mencionado en la bitácora pero nunca
   escrito ahí. Tarea de limpieza de documentación, no bloqueante.
4. Test B y C (sin avatar / con escenas cargadas) de `outfit_night_out` y
   `outfit_reveal_basic` — no iniciados, relevante recién cuando se integren.

## 7. Cómo seguir si este documento se está leyendo desde un chat nuevo

1. Preguntar al usuario si ya probó lo pendiente de la sección 6 (puntos 1 y
   2 especialmente — son los más recientes y urgentes).
2. Si reporta un problema nuevo en `outfit_multi_look`, diagnosticar contra
   `src/modules/photodump/recipes/outfitMultiLook/` y las 3 intercepciones en
   `photodumpDirectorService.ts` (buscar `outfit_multi_look` en ese archivo)
   — no releer el manifiesto narrativo completo desde cero.
3. Si el usuario pide continuar con las recetas 4/5 (integrar
   `outfit_night_out`/`outfit_reveal_basic`), usar este mismo patrón de
   carpeta (`recipes/outfitMultiLook/` como plantilla estructural) y seguir
   el mismo orden: types → manifest/anchor → contracts → prompt → index →
   intercepción en Director → UI → preset adapter → verificación end-to-end.
4. Actualizar este archivo (sección 5 con nuevos bugs, sección 6 marcando
   pendientes como resueltos) cada vez que se cierre un ciclo de prueba real.
