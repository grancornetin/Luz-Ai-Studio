# ESTADO ACTUAL — Leer esto primero para retomar el trabajo

> **Para qué sirve este documento**: si este chat creció demasiado, o el usuario
> abre un chat nuevo para ahorrar tokens, este archivo debe alcanzar para
> retomar el trabajo de Photodump sin perder acuerdos ni hallazgos. Se
> actualiza cada vez que hay un cambio de estado relevante (nueva fase
> completada, bug encontrado, decisión tomada). No reemplaza el resto del
> manifiesto — es el índice de "dónde vamos" que apunta al resto.

Última actualización: 2026-09-04.

## Cambio de fondo (jul→sep 2026) — el Director Creativo pasó de prototipo aislado a motor en producción

Entre el 22-jul (última actualización de este documento hasta hoy) y ahora, el
proyecto paralelo descrito en `13_photodump_trainer_banco_y_director.md`
(banco de +1000 fotos reales + Director Creativo con Gemini, que en su
momento era "aislado, no toca producción todavía") **se integró a la app
real y se convirtió en el motor principal de las recetas más complejas**.
Quien retome desde acá debe saber esto ANTES de leer el resto de esta
sección, porque buena parte de lo que sigue (bugs 1-6, `outfit_multi_look`
aprobada) sigue siendo válido tal cual, pero ya no es "todo lo que hay" —
hay una segunda mitad del proyecto que este documento no cubría.

**Qué es el Director Creativo hoy** (código en `src/modules/photodump/director/`):
un motor de razonamiento en 2 llamadas a Gemini (Decidir → Redactar, ver
`13_...md` sección 4 para el porqué de 2 llamadas) que arma el set completo
de shots consultando un banco real de fotos de creadoras analizadas
(pose/gesto/escenario real, no generado), en vez de que cada receta tenga su
propio prompt-builder artesanal shot por shot. Corre server-side
(`api/gemini/content.ts`, acciones `photodumpDirectorStart`/`photodumpDirectorStatus`,
fusionadas ahí por el límite de 12 funciones serverless de Vercel Hobby) con
patrón start→polling vía QStash (`director/client.ts`) porque una sola
respuesta HTTP síncrona con las 2 llamadas a Gemini superaba el tiempo
sostenible de una función serverless (504 real en logs, resuelto 7-ago).

**3 variantes del director coexisten hoy, cada una con su propósito**:
1. **`categorized`** (el original) — shots de un enum fijo por receta
   (`recipeContracts.ts`: hoy solo `outfit_night_out`, con sus 10
   `nightMomentTypes` + `mirror_check` fijo). El director elige y redacta
   dentro de ese catálogo cerrado.
2. **`open_bank`** (`director/openBank/`, feat 12-ago) — bypass experimental
   sin categorías fijas: el director compone libremente qué shots tiene
   sentido generar, sin un catálogo predefinido. Nació como modo aislado y
   reversible dentro de `outfit_night_out` (`refs.directorMode === 'open_bank'`
   vs `'categorized'`, ver `outfitNightOut/index.ts` función `tryDirector`).
3. **`generic`** (`director/generic/`, feat 3-sep) — sucesor de `open_bank`,
   pero sin ningún conocimiento hardcodeado de receta (`open_bank` todavía
   hablaba de "venue", "isMainVenue", núcleo narrativo de noche). Cada
   receta declara su propio `RecipeDirectorContract` (núcleo narrativo,
   impulsos psicológicos, si usa anclaje de lugar compartido) y el director
   genérico solo lee ese contrato — nunca tiene un `if (recipe === 'x')`
   adentro. **`outfit_check` es la primera y única receta que usa este modo
   hoy** (`photodumpDirectorService.ts` línea ~1074).

`outfit_night_out` sigue con motor propio en `recipes/outfitNightOut/`
(`categorized`/`open_bank`) — **no** migró al director `generic` todavía, pese
a que un comentario de diseño en `genericTypes.ts` habla de que
"`outfit_night_out` se retira" (es la intención de que el director genérico no
dependa de su vocabulario, no que la receta se haya eliminado — sigue activa).

**Reglas duras compartidas** (`director/hardRules.ts`, portado desde
`scripts/photodump-director/hardRules.js`, generalizado de vocabulario en
sep-2026 de "venue" a "lugar" para servir a cualquier receta): identidad
real de la protagonista, fidelidad exacta de outfit/prenda subida, "qué es
reutilizable de un candidato del banco" (pose/gesto/encuadre sí, escenario/outfit/comida
específicos no), continuidad de lugar/mobiliario entre shots del mismo set.
Hallazgo reciente importante (`c178608`, 4-sep, "prueba 4 de outfit_check"):
**la ropa que lleva puesta la foto de referencia de identidad/avatar NUNCA
es el outfit** — si no se instruye explícitamente qué ropa llevar en cada
shot, el generador copia la ropa visible en la foto de identidad en vez del
outfit real subido por el usuario. Regla 2bis agregada a `hardRules.ts` por
este motivo.

**~40 commits de refinamiento** entre el 7-ago y hoy (ver `git log` sobre
`src/modules/photodump/director/` para el detalle shot por shot) resolvieron,
entre otros: timeouts/504 y reintentos por cuota compartida de Gemini,
continuidad de venue/mobiliario entre shots (el ancla se fija solo con el
primer shot del venue principal, no se sobreescribe), geometría de brazo en
selfies, prohibición de lenguaje inferencial/narrativo en el prompt final,
prohibición de pose "mugshot" y de sesgo de "llegada" como marco narrativo
por defecto, coherencia social en shots grupales, contrapicado no deseado en
shots de cuerpo completo con rostro visible, CSP bloqueando fetch de data URL
(rompía continuidad de venue), y — más recientemente (3/9) — la
generalización a `outfit_check` con composición libre de 1-4 fotos.

**Qué significa esto para retomar**: si el usuario reporta un problema en
`outfit_check` o en el modo `open_bank`/`generic` de `outfit_night_out`, el
código a mirar primero es `src/modules/photodump/director/` (client, hardRules,
recipeContracts, generic/, openBank/) y `photodumpDirectorService.ts` — no
el manifiesto narrativo de recetas de abajo, que describe el diseño manual
original pre-director. Este documento no repite el detalle de cada uno de
esos ~40 commits — para eso está `git log` sobre esa carpeta.

## Cambio reciente — outfit_reveal_basic: ronda de fixes de septiembre (banco real conectado)

Tras la primera integración (ver sección más abajo, 22-jul) y una primera
tanda de bugs corregidos ese mismo día, `outfit_reveal_basic` recibió una
segunda ronda de fixes en septiembre, ya con el banco real de poses
conectado (no solo el banco de 6 variantes original):

- **`41c4ed6`**: mismo avatar/outfit siempre daba la misma combinación de
  variantes entre sesiones — la selección determinística por seed necesitaba
  más entropía real de sesión, no solo del avatar/outfit.
- **`d13fc49`**: 2 variantes nuevas del banco real + poses citadas del
  openbank (en vez de solo el banco fijo de 6 de `renderVariants.ts`).
- **`5c80697`**: el espejo NO tiene que estar en una habitación — el prompt
  asumía implícitamente un dormitorio/baño; se corrigió para permitir
  cualquier superficie reflectante coherente con el registro real del
  outfit (vitrina, espejo de pasillo, etc), no solo espacios domésticos
  cerrados.
- **`a390ebb`**: el lugar debe ser coherente con el registro real del outfit
  (ej. no generar un espejo de gimnasio para un outfit de salida de noche).
- **`b3080eb`** (hoy, 4-sep): desconecta HPI de las variantes — el sistema de
  HPI (Human Photo Intelligence) no sabía que el shot en cuestión era una
  selfie y aportaba instrucciones de pose contradictorias; mismo tipo de
  bug de fondo que motivó `allowedFamilies` en `outfit_multi_look` (ver
  sección Bug de `curated_ideas` más abajo) — HPI eligiendo entre familias
  sin filtro de contexto sigue siendo la causa raíz recurrente cuando
  aparece contradicción de pose en cualquier receta.

**Pendiente**: `outfit_reveal_basic` sigue sin la confirmación visual final
explícita del usuario mencionada en la sección "Qué falta" de más abajo —
las rondas de fixes de septiembre sugieren que el usuario SÍ la está usando
y reportando problemas reales encontrados en uso, pero no hay una entrada
tipo "aprobada" como la que sí tiene `outfit_multi_look`.

## Cambio reciente — outfit_reveal_basic: shots de variación, no textos fijos

Primera tanda de prueba real de `outfit_reveal_basic` (3 fotos: top blanco +
short rosa) reveló 3 bugs, corregidos y deployados (commit `4456a7d`, deploy
`dpl_3LvAEsPSp86BSkjWLNkq9M7vPfzF`):

1. **UI**: el recuadro "Ancla" seguía mostrándose aparte (duplicaba la
   imagen del `mirror_check`) — mismo bug ya resuelto para
   `outfit_multi_look`, nunca propagado a esta receta. Corregido en
   `PhotodumpModule.tsx` (vista de generación, costo en créditos —
   `imageCreditCost` cobraba `count+1` de más —, y `finalizarSet`).
2. **Poca variedad / drift de outfit**: los shots 2 y 3 (antes conceptos
   fijos `self_pov`/`close_detail`, un solo texto cada uno) salían
   repetitivos entre generaciones, y el POV en particular recortaba el
   calzado del encuadre sin avisarlo en el prompt — el modelo "olvidaba" las
   zapatillas en ese shot.

**Fix**: se eliminó el concepto fijo de `self_pov`/`close_detail`. Ahora:
- Shot 1 (`mirror_check`) sigue siendo fijo — full-body, ancla del mundo.
- Shots 2 y 3 toman **2 variantes distintas** de un banco de 6
  (`recipes/outfitRevealBasic/renderVariants.ts`): lateral, 3/4, vista
  trasera, over-the-shoulder, POV genuino, close-up de pelo — cada una con
  su propia familia HPI real, verificada contra el banco JSON que el
  usuario enriqueció (9→28 `poseBanks`). La elección es determinística por
  seed de sesión (nunca se repite dentro del mismo set de 3, pero varía
  entre sesiones distintas) y se fija **una sola vez** en el plan
  (`OutfitRevealBasicShotPlan.variantIndex`) — nunca se recalcula al
  generar, para que plan y generación real siempre coincidan.
- Fidelidad de outfit reforzada: cada variante declara `footwearVisible` —
  si el encuadre no llega a los pies (POV, close-up), el prompt ahora dice
  explícitamente que el calzado puede quedar fuera de cuadro pero el resto
  del outfit debe ser exactamente el de la referencia, en vez de dejarlo
  implícito.

**Pendiente**: confirmación visual del usuario con una nueva tanda —
revisar que los shots 2/3 ya no sean siempre los mismos 2 conceptos, y que
el calzado no desaparezca cuando sí debería verse (mirror_check y variantes
con `footwearVisible: true`).

**Nota — otro agente trabajando en paralelo**: durante esta sesión se
confirmó que hay un agente de QA visual (`tools/photodump-qa-agent/`)
desarrollándose en la rama `feat/photodump-qa-agent`, ya fusionado a `main`
(commit `ae36337`, "agente privado de QA visual para Photodump (Etapa 1)").
Este hilo de trabajo (integración de recetas) sigue siempre en `main`; no
tocar esa carpeta ni asumir que sus archivos son parte de este trabajo.

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

## 6. Qué falta (pendientes explícitos, actualizado 2026-09-04)

**Nota**: esta sección quedó desactualizada entre jul-sep porque el trabajo
real se movió al Director Creativo (ver sección de arriba) en vez de seguir
el plan original "integrar receta por receta con motor propio". Los puntos
1-4 originales (abajo, tachados en espíritu) ya no reflejan el plan vigente
— se conservan por trazabilidad, con nota de qué pasó realmente en cada uno.

1. ~~Confirmar visualmente `outfit_reveal_basic`~~ → en uso real: recibió una
   segunda ronda completa de fixes en septiembre (ver sección de arriba),
   evidencia indirecta de que el usuario la está probando activamente. No
   hay una entrada explícita de "aprobada" como sí tiene `outfit_multi_look`
   — si se retoma este hilo, preguntar directamente si ya la considera
   estable o si sigue apareciendo algo nuevo.
2. ~~Integrar `outfit_night_out` con motor propio~~ → en cambio, se conectó
   al Director Creativo (`7ce6b45`, 7-ago) con modos `categorized` y
   `open_bank`, y siguió recibiendo refinamiento activo (~40 commits,
   última entrada relevante `28c0df8`, 2-sep). Está en producción, no es
   un pendiente — puede seguir apareciendo un bug puntual nuevo, pero la
   integración en sí ya ocurrió.
3. **`outfit_check`** (no existía como pendiente en la versión anterior de
   este documento) recibió su propia integración al Director Creativo, esta
   vez en su versión **genérica** (`director/generic/`, `9a8fa42`, 3-sep) —
   primera receta en usar ese modo. Sigue activo: `c178608` (4-sep) encontró
   2 huecos reales en `hardRules.ts` con la "prueba 4" de esta receta. Si se
   retoma este hilo, preguntar si el usuario ya corrió una "prueba 5" o
   similar y qué encontró.
4. Agrupar recetas por categoría (Fashion/Shoes/Beauty) en `PDStep1.tsx` —
   sigue sin hacerse, y sigue siendo de baja prioridad frente al trabajo real
   (refinar el Director Creativo receta por receta).
5. Formalizar el bloque de composición UGC casual (Finding 005) en
   `03_photodump_recipe_architecture.md` sección 19 — tarea de limpieza de
   documentación, no bloqueante, sigue sin hacerse.
6. Test B y C (sin avatar / con escenas cargadas) de `outfit_night_out` y
   `outfit_reveal_basic` — no iniciados. Con ambas recetas ya en producción
   y recibiendo prueba real de usuario, probablemente de menor prioridad que
   seguir el ciclo real de "usuario prueba → bug → fix" que se viene dando.
7. **Este mismo documento (`12_ESTADO_ACTUAL`) y `13_photodump_trainer...`
   necesitan una fusión real**, no solo esta sección de parche — `13` sigue
   describiendo el Director como "proyecto paralelo que no toca producción
   todavía", lo cual ya no es cierto. La sección 5 de `13` ("El cruce
   pendiente") también puede estar resuelta o parcialmente resuelta —
   revisar contra el código real de `recipeContracts.ts` antes de asumir que
   sigue pendiente tal cual está escrita ahí.

## Cambio reciente — placeholders de las cards del Paso 1 (2026-09-14)

**Nota**: este cambio es de otro hilo de trabajo (UI de selección de receta,
`PhotodumpModule.tsx` + `PDStep1.tsx`), en paralelo al trabajo del Director
Creativo descrito arriba. No toca prompts ni motor de generación — se
documenta acá porque este archivo es el índice general de "dónde vamos".

**Qué se hizo**: las cards de selección de receta (Paso 1) mostraban solo un
gradiente de color como placeholder. Se armó una cascada de 3 niveles para la
imagen de preview de cada card:

1. **Sets propios del usuario** (`previewsByRecipe`, ya existía) — si el
   usuario tiene generaciones guardadas de esa receta en su biblioteca, esas
   se muestran siempre primero.
2. **Semillas globales curadas** (`seedPreviews.ts`, nuevo) — imágenes de
   ejemplo iguales para todos los usuarios, para recetas donde el usuario
   todavía no generó nada propio. Viven en
   `src/modules/photodump/assets/recipe-previews/<recipe>/` — el usuario
   pega archivos ahí directamente (cualquier nombre, png/jpg/webp) y
   `import.meta.glob` los levanta solo, sin tocar código. Máximo 3 por
   receta. Carpeta vacía = sigue en gradiente.
3. **Gradiente** (default de siempre en `RecipeCard.tsx`) — si no hay ni lo
   uno ni lo otro.

Merge de las dos fuentes en `PhotodumpModule.tsx` (`displayPreviewsByRecipe`,
`useMemo`): semillas globales como base, sets del usuario encima — lo propio
siempre gana. Imágenes fuente convertidas a webp calidad 82 (de forma manual,
puntual, con `sharp` instalado fuera del repo en un temp — no se agregó
`sharp` como dependencia del proyecto).

**Alcance confirmado con el usuario (recetas activas, 6 + free)**: `unboxing`,
`outfit_check`, `outfit_haul`, `outfit_week`, `outfit_multi_look`,
`outfit_reveal_basic`, más `free`. **`outfit_night_out` quedó explícitamente
fuera** — el usuario aclaró que ya no la considera confirmada por ahora, así
que no tiene carpeta de semillas (importante: no asumir que sigue en el grupo
de recetas activas de este mini-proyecto de UI, aunque en el resto del
manifiesto — Director Creativo — sí sigue activa en producción; son dos
alcances distintos, no contradictorios).

**Estado de las carpetas de semillas al día de hoy** (deploy `e28952f`,
producción https://luz-ia-studio-1.vercel.app):
- Con imágenes reales: `unboxing` (5), `outfit_check` (3), `outfit_week` (3),
  `outfit_reveal_basic` (3).
- Vacías, todavía en gradiente: `outfit_haul`, `outfit_multi_look`, `free`.

**Para completarlas**: no requiere código — el usuario pega imágenes en la
carpeta de la receta que falte y se pide optimizar (webp)/build/deploy de
nuevo. Sin acción pendiente de mi parte hasta que eso pase.

**Pausado a pedido explícito del usuario — proporción de las cards (3:4)**:
el usuario propuso acercar el aspect ratio de las cards a 3:4 para que estas
imágenes nuevas se vean mejor, pero decidió esperar: *"esperemos entonces
antes de cambiar la proporcion, esperemos el rediseño de la app."* No tocar
el aspect ratio de `RecipeCard`/`PDStep1` hasta que el rediseño de shell/PWA
(ver `project_pwa_mobile_shell` en memoria, y el prompt de handoff para el
otro agente) esté resuelto — es una decisión de secuencia, no técnica.

## 7. Cómo seguir si este documento se está leyendo desde un chat nuevo

1. Preguntar al usuario qué receta está probando o qué problema encontró
   recién — el patrón de trabajo actual es iterativo (usuario prueba en la
   app real → reporta bug puntual → se corrige), no "integrar receta X
   pendiente" como asumía la versión anterior de este documento.
2. Si el problema es de **`outfit_multi_look`**: diagnosticar contra
   `src/modules/photodump/recipes/outfitMultiLook/` y las intercepciones en
   `photodumpDirectorService.ts` (buscar `outfit_multi_look` ahí). Receta
   aprobada y estable — motor propio, no usa el Director Creativo.
3. Si el problema es de **`outfit_night_out`, `outfit_check`, o el modo
   `open_bank`/`generic`**: el código a mirar primero es
   `src/modules/photodump/director/` (client.ts, hardRules.ts,
   recipeContracts.ts, generic/, openBank/) — esta es la parte más activa
   del proyecto hoy, revisar primero `git log` reciente sobre esa carpeta
   antes de asumir causa.
4. Si el problema es de **`outfit_reveal_basic`**: motor propio en
   `recipes/outfitRevealBasic/`, pero ya cita poses reales del banco
   (`openbank`) en sus variantes — no es 100% independiente del banco real,
   revisar ambos lados si el síntoma es de pose/gesto contradictorio.
5. Actualizar este archivo (nueva sección arriba con fecha, sección 6
   marcando pendientes como resueltos) cada vez que se cierre un ciclo real
   de prueba — y considerar en algún momento fusionarlo de verdad con `13`
   en vez de seguir agregando parches (ver pendiente 7 arriba).
