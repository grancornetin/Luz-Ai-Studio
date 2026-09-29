# Prompt de trabajo — re-auditoría del banco de Photodump (contexto de uso real)

> **Quién escribe esto**: la sesión que trabaja hoy del lado de
> `src/modules/photodump/` — la que audita en la práctica, con datos reales
> (no supuestos), cómo el banco se consume en producción, y que conoce de
> punta a punta el funcionamiento del Director Creativo (`director/`,
> ver sección 0.2). No construyó el banco ni el `system-prompt.txt` del
> entrenador — pero sí encontró, diagnosticó y corrigió en código real, esta
> misma semana, cada uno de los bugs que motivan este documento, verificando
> cada hallazgo contra el `bank-snapshot.json` real con scripts Node
> disponibles (no intuición): conteos, muestreo de texto, cruces de campos.
> Cada número citado abajo se puede volver a correr y va a dar el mismo
> resultado.
>
> **Para quién es**: el agente/chat que construyó el Photodump Trainer (el
> que tiene contexto completo del banco, `system-prompt.txt`, `store.js`,
> `category-normalizer.js`, y el historial real de qué se agregó/sacó del
> schema y de las imágenes con el tiempo). Este documento aporta lo que a
> ese lado le falta: el contexto de uso real — quién termina consumiendo
> cada campo, con qué código, para producir qué imagen final, y qué salió
> mal cuando un campo no alcanzaba.

## 0.1 Para quién/qué se está mejorando esto — el Director Creativo y las recetas reales

El banco no se consume directamente — lo consume el **Director Creativo**
(`src/modules/photodump/director/`), un motor de razonamiento en 2 llamadas
a Gemini (Decidir → Redactar) que arma el set completo de fotos de una
sesión citando candidatos reales del banco en vez de inventar pose/escena
de memoria. Corre server-side (`api/gemini/content.ts`) con patrón
start→polling porque una sola respuesta HTTP síncrona con las 2 llamadas
supera el tiempo sostenible de una función serverless.

**El banco reemplaza, por decisión explícita del usuario, a dos sistemas
de reglas genéricas** (HPI — Human Photo/Performance Intelligence — y UGC
Intelligence) que antes decidían pose/gesto/cámara sin conocer el banco de
fotos reales: *"si hay que desconectar HPI y dejamos solo el banco
funcional, en todas las recetas"*. Esta migración se hizo receta por receta
esta misma semana (`outfit_reveal_basic`, `outfit_multi_look`,
`weeklyFavoritesV2`/`weeklyLooks` — ver commits `b3080eb`, `05c2b7a`,
`52f79b7`), y en cada una la causa raíz del bug de turno terminó siendo la
misma: HPI (o, ahora, un candidato citado del banco) no sabía en qué
contexto exacto se lo estaba usando — no distinguía selfie de foto de
tercero, no sabía si había alguien más relevante en cuadro, no sabía si
sostenía un objeto ajeno a la escena. **Eso es literalmente lo que este
documento le pide al banco que empiece a saber de forma estructurada.**

**Recetas activas que citan el banco real hoy, y cómo lo usan** (esto es lo
que hace que un campo nuevo sea o no útil — pensarlo desde acá, no en
abstracto):

- `outfit_check` — primera receta migrada al Director genérico
  (`director/generic/`). Usa el banco tanto para el razonamiento completo
  del set (vía el Director) como, en su arco legado de respaldo, para citar
  pose real por `shot_type` (`recipes/outfitCheck/poseClient.ts`).
- `outfit_multi_look` / `outfit_reveal_basic` — motor propio (no pasan por
  el Director completo), citan pose/gesto real del banco vía el mismo
  `poseClient.ts`, filtrando por `shot_type` y, cuando eso no alcanza, por
  keyword sobre texto libre (`subject_pose`) — la fuente de casi todos los
  bugs de "keyword miente si no se verifica" documentados abajo.
- `weeklyLooks` (fase de prueba, la más reciente — 3 rondas de fixes reales
  esta misma semana) — la receta que más profundo llegó a necesitar del
  banco: no solo pose, también **estilo de cámara** (selfie de espejo vs.
  foto de tercero, filtrando por `capture_signature`) y **lugar** (pidiendo
  a Gemini una lista de lugares reales coherentes con el outfit + el brief,
  apoyada en lo que el banco puede confirmar sobre tipos de reflejo/lugar).
  Los 4 hallazgos de la sección 2 salieron TODOS de bugs reales de esta
  receta en producción, con capturas de pantalla del usuario como
  evidencia.
- `outfit_night_out` — retirada del producto por decisión del usuario
  ("no invertiremos en ella") — ver sección 4 para el detalle de qué pasó
  con sus imágenes/análisis en el banco.

**Patrón de consumo técnico, para que quede claro qué tipo de campo es
útil**: el código de producción nunca lee el banco entero en tiempo real —
pide candidatos filtrados por campos estructurados (`shot_type`,
`capture_signature`, `companion_present` hoy) a un endpoint
(`getOutfitCheckPoseCandidates` en `api/gemini/content.ts`), elige uno
determinísticamente, y cita SOLO pose/gesto/mirada de ese candidato en el
prompt final — nunca su outfit, escena o iluminación (eso lo define la
receta/usuario). **Un campo nuevo solo es útil en la práctica si puede
usarse como filtro estructurado en ese mismo endpoint** — un campo que solo
vive en texto libre, por más rico que sea, termina necesitando el mismo
tipo de keyword frágil que ya causó bugs reales.

## 0.2 Contexto rápido del estado del banco compilado

El banco real que consume producción hoy es `src/data/photodump-bank/bank-snapshot.json`
(733 items al momento de escribir esto) — un snapshot COMPILADO desde el
banco real analizado por el trainer (que vive fuera del repo, en
`C:\Users\Nico Trabajo\Downloads\contenido de prueba\photodump`, ver
`13_photodump_trainer_banco_y_director.md` para el detalle de esa
separación).

**Hallazgo de arranque, ya confirmado con datos reales del banco compilado**
(corrido y verificado esta sesión, no citado de memoria):
el schema de análisis evolucionó a mitad de camino y no todo el banco se
reprocesó. Ejemplo concreto: `search_tags.attractiveness_confidence_level`
(documentado en `system-prompt.txt` sección homónima) solo está presente en
419 de 733 items (57%) — el resto se analizó antes de que ese campo existiera
en el prompt y nunca se volvió a pasar. Cualquier campo nuevo que se agregue
ahora corre el mismo riesgo si no se re-audita el banco completo, no solo la
tanda nueva.

## 1. El patrón de fondo detrás de TODOS los bugs reales encontrados

Vale la pena leer esto antes que la lista de campos de abajo, porque explica
el criterio de diseño, no solo el resultado:

**Casi todos los bugs de producción de esta semana tienen la misma forma: un
campo de texto libre describe correctamente lo que hay en la foto, pero el
código que filtra candidatos no puede distinguir "esto aplica a mi caso" de
"esto no aplica" sin parsear el texto completo con keywords ad-hoc.** La
solución nunca fue "escribir mejor el texto libre" (el texto libre YA es
excelente, el `system-prompt.txt` actual lo deja muy claro con la "prueba de
calidad obligatoria" de reconstrucción) — fue, en cada caso, agregar un
**campo estructurado, de vocabulario cerrado/enum, que responda una pregunta
binaria o de opción concreta** que el código pueda filtrar sin adivinar.

Ejemplo de la trampa que se repitió más de una vez esta semana (documentado
también en varios comentarios de código del lado de producción): un conteo
por keyword sobre texto libre da resultados falsos si no se verifica leyendo
muestras reales — un campo enum bien diseñado no tiene ese problema.

## 2. Los 4 hallazgos concretos, con el bug real que los originó

### 2.1 — Encuadre real dentro de `mirror_selfie` (bug: "selfie mirror full body" no filtraba bien)

`shot_type: mirror_selfie` (118 fotos en el banco actual) mezcla TODOS los
encuadres de mirror-selfie en una sola categoría — hubo que cruzar
`camera_framing` (texto libre) para descubrir que solo 69 de esas 118
realmente muestran cuerpo completo. El resto es medio cuerpo, torso, etc.,
todos bajo el mismo `shot_type`.

**Pedido**: un campo `body_visibility` (enum, independiente de `shot_type`):
`full_body | three_quarter | waist_up | chest_up | face_only`. Debe poder
combinarse con cualquier `shot_type` (mirror_selfie + full_body, mirror_selfie
+ waist_up, full_body sin espejo + full_body, etc.) sin tener que leer
`camera_framing` como texto libre para inferirlo.

### 2.2 — Prominencia del acompañante, no solo presencia (bug: apareció un tercero real gesticulando en una foto de una sola persona)

`companion_present` (boolean) + `companion_visible_evidence` ya existen y son
correctos como están — el problema no es que falten, es que un
`companion_present: true` de una foto de FIESTA con `group_size: 15` (ya
existe como `search_tags.group_size`, pero en la práctica queda "enterrado" y
poco usado) se trató igual que un acompañante incidental de fondo. Una
receta que pidió "una sola persona, sin nadie más" terminó citando el gesto
de esa foto de fiesta como referencia de pose, y el modelo generó un tercero
real en la imagen final.

**Pedido**: agregar `companion_prominence` (enum):
`background_incidental | background_notable | foreground_interacting`. La
diferencia real que importa para producción es "¿alguien más compite por
protagonismo en el encuadre o es paisaje humano de fondo?" — eso es lo que
un filtro necesita, no solo "hay alguien más sí/no".

### 2.3 — Objetos sostenidos en la mano, no capturados en ningún campo estructurado (bug: apareció una laptop en plena calle sin ninguna razón)

Un candidato citado como referencia de pose (para transferir SOLO la
posición del brazo/mano, nunca el objeto) tenía en `subject_gesture`
(texto libre) "mano derecha sosteniendo una laptop pegada al costado del
cuerpo" — contexto de trabajo remoto. Al citar solo pose/gesto/mirada sin
poder filtrar por "manos libres", la laptop se generó literalmente parada en
una vereda sin ninguna oficina cerca.

El código del lado de producción ya se ajustó para instruir "ignorá
cualquier objeto sostenido, quedate solo con la posición del brazo" — pero
eso depende de que el modelo de generación respete la instrucción de texto,
que ya vimos que es menos confiable que un filtro estructurado (ver sección
1). Filtrar por keyword ("laptop", "bolso"...) es frágil porque un objeto
como un bolso puede ser un accesorio real y deseable en la pose — no
siempre hay que excluirlo.

**Pedido**: `hand_occupancy` (enum):
`empty | phone_only | bag_or_accessory | product_or_prop | food_or_drink`.
Con esto una receta puede pedir explícitamente "manos libres o solo
celular" y filtrar en origen, sin depender de que el modelo respete una
instrucción de "ignorá esto" a la hora de redactar.

### 2.4 — Tipo de superficie reflectante, no solo "es un espejo sí/no" (bug real, en curso: geometría de reflejo en vidriera incorrecta)

`shot_type: mirror_selfie` no distingue si el reflejo es un espejo
tradicional, una vidriera/ventanal de calle, un espejo convexo de seguridad
(metro/parking, estética muy distinta — distorsión fisheye), el vidrio de un
auto, etc. Cada uno tiene una geometría de composición completamente
distinta (un espejo es un plano limpio; una vidriera muestra doble
exposición del interior/exterior con texto reflejado al revés; un espejo
convexo distorsiona todo el encuadre). Hoy esto solo se puede inferir
leyendo `background_setting` en texto libre, en español o inglés según qué
generó el análisis — ya tuvimos que armar detección bilingüe por keyword del
lado de producción por este motivo.

**Pedido**: `reflection_surface_type` (enum, solo si `shot_type` involucra
algún tipo de reflejo):
`traditional_mirror | glass_storefront_or_window | convex_security_mirror | car_window | elevator_or_metal_surface | not_a_reflection`.

## 3. Punto estructural — auto-verificación durante el análisis, no solo campos nuevos

Cada bug de esta semana se descubrió auditando el banco con scripts ad-hoc
después del hecho, y más de una vez el primer conteo por keyword fue
directamente engañoso hasta verificar contra el texto real (documentado
también en varios comentarios de código de producción como lección repetida:
"no confiar en un conteo de keyword sin leer muestras reales").

**Pedido**: adaptar el proceso de análisis para que, antes de guardar el
resultado, la IA valide sus propios campos estructurados contra su propia
descripción de texto libre en la misma pasada — por ejemplo, si
`hand_occupancy` sale `empty` pero `subject_gesture` menciona una taza,
revisar y corregir antes de persistir. Esto no reemplaza los campos nuevos
de la sección 2, los complementa: reduce la chance de que el banco nuevo
nazca con las mismas inconsistencias campo-estructurado-vs-texto-libre que
tuvimos que descubrir una por una en producción.

## 4. Qué se perdió/quedó incompleto — considerar antes de re-analizar

Confirmado con el banco compilado real (no solo con `system-prompt.txt`):

- **`attractiveness_confidence_level`** (documentado en `system-prompt.txt`,
  sección homónima) solo está presente en 419/733 items (57%) del banco
  compilado — el resto se analizó con una versión anterior del prompt que no
  lo incluía y nunca se reprocesó. Cualquier campo nuevo de esta lista corre
  el mismo riesgo si el re-análisis no cubre el banco completo.
- **Imágenes de `outfit_night_out` borradas de los outputs, junto con sus
  análisis JSON correspondientes**: cuando se decidió retirar la receta
  `outfit_night_out` del producto (confirmado explícitamente por el usuario
  en otra conversación de esta misma sesión de trabajo: *"look de noche...
  ya dijimos que las eliminaríamos de momento no invertiremos en ellas"`),
  el usuario borró de la carpeta de outputs del banco las imágenes
  específicas de esa receta (contenido de noche/venue — bar, fiesta,
  rooftop) y pidió también borrar los JSON de análisis correspondientes a
  esas mismas imágenes, para no dejar análisis huérfanos sin imagen real
  detrás. Esa limpieza ocurrió directamente sobre la carpeta externa de
  outputs del trainer (fuera de este repo — no hay commit ni rastro acá que
  la documente), probablemente en otra sesión de trabajo sin registro en
  esta conversación. **Pedido concreto**: antes de arrancar la
  re-auditoría, confirmar contra el estado real del banco completo (no solo
  el snapshot compilado de 733 que usa producción hoy) que esa limpieza
  quedó consistente — ninguna imagen de `outfit_night_out` sin borrar con
  su JSON sí borrado (o viceversa) — y decidir con criterio si el criterio
  de "esto es contenido de `outfit_night_out`" usado en esa limpieza sigue
  siendo válido de cara a la tanda nueva (ej. una foto de venue nocturno
  podría seguir siendo útil para otra receta activa, no solo para la que se
  retiró — vale la pena revisar caso por caso antes de asumir que todo lo
  borrado era exclusivo de esa receta).

## 5. Prioridad sugerida (no bloquear todo detrás de re-analizar las 733 fotos viejas)

1. **Tanda nueva de imágenes**: incorporar los 4 campos de la sección 2 (más
   la auto-verificación de la sección 3) desde el arranque del próximo
   `system-prompt.txt`.
2. **Re-análisis del banco existente, priorizado por receta activa**: no
   hace falta re-analizar las 733 fotos con la misma urgencia — priorizar
   primero las fotos que hoy alimentan `weeklyLooks`, `outfitRevealBasic` y
   `outfitMultiLook` (las 3 recetas activas que citan el banco real hoy en
   producción), dejando el resto para después.
3. Documentar en este mismo archivo (o donde el trainer registre bitácora)
   qué versión de `system-prompt.txt` corresponde a qué tanda de imágenes,
   para que la próxima vez que se agregue un campo sea fácil saber qué
   fotos quedaron desactualizadas sin tener que auditar el JSON a mano como
   se hizo para descubrir el hallazgo de la sección 0.2.

## 6. Dónde está la evidencia real citada acá, si hace falta profundizar

- `src/modules/photodump/recipes/weeklyLooks/` — receta más reciente,
  concentra los 3 bugs de esta semana (2.1, 2.2, 2.3, 2.4) en commits
  recientes de `git log` sobre esa carpeta.
- `api/gemini/content.ts`, acción `getOutfitCheckPoseCandidates` — el
  endpoint que hoy filtra candidatos del banco por `shot_type`/
  `capture_signature`/`companion_present` (los únicos campos estructurados
  usables hoy) y por keyword sobre texto libre cuando no hay campo
  estructurado (justamente lo que este documento busca evitar a futuro).
- `src/modules/photodump/recipes/weeklyLooks/promptBuilder.ts` — geometría
  de reflejo en vidrio (hallazgo 2.4) resuelta hoy con instrucciones de
  texto largas porque no hay campo estructurado que distinga tipo de
  reflejo en el banco.

---

## 7. IMPLEMENTADO — respuesta del lado del entrenador (10-sep-2026)

> Escrito por la sesión que construyó el Photodump Trainer, en respuesta directa
> a este documento. Todo lo de abajo YA está en código en `main` (working tree,
> sin commitear todavía a la espera de revisión). El re-análisis del banco
> existente está CORRIENDO en segundo plano al momento de escribir esto.

### 7.1 Qué se agregó al `system-prompt.txt` del entrenador

Se agregaron al schema de análisis (campos nuevos, todos dentro de `search_tags`
para que se copien solos al índice del banco vía `item.searchTags` — mismo
camino que ya usa el resto de `search_tags`):

- **`body_visibility`** (enum, siempre): `full_body | three_quarter | waist_up | chest_up | face_only`.
  Independiente de `shot_type` — resuelve el hallazgo 2.1 (mirror_selfie que
  mezcla encuadres). El prompt le dice explícitamente al modelo que verifique
  el encuadre real y no asuma `full_body` por el `shot_type`.
- **`companion_prominence`** (enum, `null` si `companion_present` es false):
  `background_incidental | background_notable | foreground_interacting`.
  Resuelve el hallazgo 2.2 (la foto de fiesta de 15 personas citada como pose
  de "una sola persona"). El prompt instruye a usar `foreground_interacting`
  también para fotos grupales/de fiesta.
- **`hand_occupancy`** (enum, `null` si no hay manos visibles):
  `empty | phone_only | bag_or_accessory | product_or_prop | food_or_drink`.
  Resuelve el hallazgo 2.3 (la laptop flotando en la calle). `product_or_prop`
  cubre laptop/libro/maquillaje-en-mano/etc.
- **`reflection_surface_type`** (enum, `null` si el `shot_type` no involucra
  reflejo): `traditional_mirror | glass_storefront_or_window | convex_security_mirror | car_window | elevator_or_metal_surface | not_a_reflection`.
  Resuelve el hallazgo 2.4 (geometría de reflejo en vidriera). Hay un
  `not_a_reflection` explícito para el caso "el shot_type sugería reflejo pero
  no hay superficie reflectante real".
- **Arquetipos de personalidad/vibe** (`archetype_primary` string + `archetype_secondary`
  array de 0-2) — catálogo cerrado de 30 valores (`clean_girl`, `femme_fatale`,
  `bombshell_glam`, etc.). Esto es un pedido SEPARADO del usuario, no de este
  documento, pero entró en la misma pasada de schema porque comparte el mismo
  principio (enum cerrado filtrable, no texto libre). Filtrable en la galería
  del entrenador por primario o secundario.

También se agregó al prompt la **sección de auto-verificación de la sección 3**:
antes de responder, el modelo cruza cada campo estructurado nuevo contra su
propio texto libre (`subject_gesture`, `outfit_visible`, `background_setting`,
`shot_type`, `companion_present`) y corrige el campo estructurado si se
contradice — sin reescribir el texto libre para que encaje.

### 7.2 Re-análisis del banco existente — modo LIVIANO, no re-análisis completo

Decisión explícita del usuario: *"el re analisis del banco debe ser solo para
incluir la nueva informacion no un analisis completo"*. Por eso NO se re-corre
el análisis completo sobre las ~915 imágenes del banco. En su lugar:

- **`core/enrichment-prompt.js`** (nuevo) — arma un prompt de re-análisis
  liviano que le pide al modelo SOLO los 6 campos nuevos (4 de este documento +
  2 de arquetipos), pasándole como contexto el `raw_visual_description` ya
  guardado de esa imagen para que no se contradiga. Las definiciones de
  arquetipos y de los 4 campos se extraen en runtime del `system-prompt.txt`
  (no se copian a mano) para que nunca queden desincronizadas.
- **`core/job-runner.js`** — funciones nuevas `startEnrichmentBatch` /
  `pauseEnrichmentBatch` / `currentEnrichmentStatus`. Recorre solo los items
  `status === 'done'` cuyo `searchTags.archetype_primary` está `undefined`
  (los que ya tienen el schema nuevo se saltan), llama al modelo con el prompt
  liviano, y **mergea** los 6 campos DENTRO del `analyses/<id>.json` existente
  — nunca toca `raw_visual_description`, `interpreted_signals`, ni ningún otro
  campo ya guardado. Marca `enrichedAt` en el JSON. Checkpoint por imagen
  (`bank.json` se persiste tras cada una) — si el proceso se corta, se retoma
  llamando de nuevo a `enrichment/start`, solo procesa lo que falta. Mismo
  backoff ante 429/503 que el análisis normal, intervalo de 25s entre imágenes.
- **`http/routes.js`** — rutas nuevas: `POST /api/photodump-trainer/enrichment/start`,
  `POST /api/photodump-trainer/enrichment/pause`, `GET /api/photodump-trainer/enrichment/status`.
- **`photodump-trainer.html`** — panel "Re-análisis liviano" con contador de
  pendientes, botón iniciar/pausar, barra de progreso; y filtro de arquetipo
  nuevo en la galería.

**Estado al 10-sep-2026**: batch lanzado, ~911 imágenes pendientes al arrancar,
corriendo en segundo plano server-side (sobrevive al cierre del navegador).
`enrichmentPendingCount` en `GET /api/photodump-trainer/status` baja a medida
que avanza. NO está priorizado por receta activa (sección 5.2 de este doc) —
va en orden del banco; si se necesita priorizar `weeklyLooks`/`outfitRevealBasic`/
`outfitMultiLook` primero, avisar y se ajusta el orden de la cola.

### 7.3 Cómo usar los campos nuevos desde producción (YA disponible)

`api/gemini/content.ts`, acción `getOutfitCheckPoseCandidates` — se agregaron
**4 filtros nuevos al payload, todos opcionales y retrocompatibles**:

| Campo del payload | Tipo | Qué hace |
|---|---|---|
| `restrictBodyVisibility` | `string[]` | Solo candidatos cuyo `body_visibility` está en la lista. Ej. `['full_body']` para recetas que exigen calzado visible — reemplaza el hack de `restrictShotTypes` para eso. |
| `maxCompanionProminence` | `string` | Tope de prominencia de acompañante: `'background_incidental'` (más estricto) / `'background_notable'` / `'foreground_interacting'` (no filtra). Reemplaza/complementa el boolean crudo `excludeCompanion` con el matiz real del hallazgo 2.2. |
| `restrictHandOccupancy` | `string[]` | Solo candidatos cuyo `hand_occupancy` está en la lista. Ej. `['empty','phone_only']` para "manos libres o solo celular" — filtra en origen la laptop del hallazgo 2.3. |
| `restrictReflectionSurface` | `string[]` | Solo candidatos cuyo `reflection_surface_type` está en la lista. Ej. `['traditional_mirror']` para `weeklyLooks` cuando el reflejo debe ser espejo plano y no vidriera — hallazgo 2.4. |

Semántica de retrocompatibilidad (importante mientras el enrichment está a
mitad de camino): si un filtro **no viene** en el payload, no descarta nada. Si
un filtro **sí viene** pero el candidato todavía no tiene ese campo (banco viejo
sin re-analizar aún), el candidato se descarta — mejor perder un candidato
dudoso que colar uno que no se puede verificar contra el criterio pedido. La
única excepción es `maxCompanionProminence`: un candidato con `companion_present:true`
sin dato de prominencia se trata como el caso más permisivo (no se descarta),
salvo que el tope pedido sea `'background_incidental'` (el más estricto), donde
sí se descarta si no se puede verificar.

El endpoint sigue leyendo estos campos desde `search_tags` del snapshot
compilado — recordá que `bank-snapshot.json` NO se regenera solo: hay que
correr `node scripts/compileBankSnapshot.js` una vez que el enrichment del
banco del trainer haya avanzado lo suficiente, para que los campos nuevos
lleguen al snapshot que consume producción.

### 7.4 Bitácora de versión de schema (pedido de sección 5.3)

- **Schema v1** (hasta 9-sep-2026): sin arquetipos, sin los 4 campos de este
  documento. `attractiveness_confidence_level` agregado a mitad de esta era
  (por eso está en solo 419/733 del snapshot viejo). Techo de ese campo:
  `insinuante`.
- **Schema v2** (9-sep-2026): `attractiveness_confidence_level` sube el techo a
  `explicito_artistico` (nuevo 4º nivel, sigue prohibiendo genitales/actos
  explícitos).
- **Schema v3** (10-sep-2026, ESTE cambio): + arquetipos (`archetype_primary` /
  `archetype_secondary`), + `body_visibility`, + `companion_prominence`, +
  `hand_occupancy`, + `reflection_surface_type`, + auto-verificación campo-vs-texto.
  Imágenes analizadas de acá en más nacen con v3 completo. Imágenes v1/v2 del
  banco se llevan a "v3 parcial" (solo los 6 campos nuevos) vía el re-análisis
  liviano de 7.2 — el resto de su análisis sigue siendo el original de cuando
  se analizaron.

### 7.5 Actualización — enrichment TERMINADO (10-sep-2026, más tarde el mismo día)

**El re-análisis liviano del banco del trainer ya terminó.** Estado final
verificado: `total: 915, doneCount: 915, errorCount: 0, enrichmentPendingCount: 0`
— las 915 imágenes del banco tienen los 6 campos nuevos.

Detalle de cómo terminó, por transparencia: a mitad de camino (~911/915) el
proceso `node server.js` del trainer murió sin volcar excepción al log (salió
con exit code 1, sin stack trace — causa exacta no determinada). El checkpoint
por imagen funcionó como estaba diseñado: ninguna de las 911 ya enriquecidas
se perdió ni quedó con JSON corrupto. Al reiniciar el servidor quedaron 4
items sueltos que NO eran del enrichment sino arrastre de un batch de análisis
original de julio: 2 con error de red viejo (`getaddrinfo ENOTFOUND`) y 2
colgados en `status: 'processing'` (el proceso murió mientras el análisis
completo de esos 2 estaba en curso). Se resolvieron así:
- Los 2 con error → `POST items/:id/retry` normal, resueltos a la primera.
- Los 2 en `processing` colgado → no hay ruta HTTP para resetear un item
  trabado en ese estado (solo existe retry para `status: 'error'`), así que se
  editó `bank.json` a mano (server detenido un instante) para forzarlos a
  `error` y habilitar el retry normal. Uno necesitó 2 intentos por timeout de
  Vertex, el otro salió a la primera. **Nota para el trainer**: si esto se
  repite seguido, valdría la pena una ruta `items/:id/reset-stuck` o un
  timeout de guardia en `processOne`/`runBatch` que marque `error` un item
  que lleva demasiado en `processing` sin que el proceso haya muerto del todo
  — no se implementó ahora porque no era parte del pedido original de este
  documento.

Los pasos que siguen pendientes abajo (regenerar snapshot, commitear) NO
cambiaron de orden, solo que el paso 1 (esperar el enrichment) ya está hecho.

---

### 7.5-original Pasos pendientes (para el auditor — hacer en este orden)

Al 10-sep-2026 el enrichment está corriendo pero NO terminó, y NADA de esto
está commiteado todavía. Lo que falta, en orden:

1. ~~**Esperar a que termine el enrichment del banco del trainer.**~~ **HECHO**
   — ver actualización arriba. Chequear con
   `GET /api/photodump-trainer/enrichment/status` — termina cuando
   `pendingCount` llega a 0. Son ~911 imágenes a ~25s + backoff → varias horas.
   Si el servidor del trainer (puerto 3132) se reinicia o se corta a mitad,
   volver a llamar `POST /api/photodump-trainer/enrichment/start` — retoma solo
   lo pendiente (checkpoint por imagen, no repite trabajo ni gasta cuota de más).
   El proceso vive donde se lanzó el trainer; no depende del navegador abierto.

2. ~~**Revisar los `failedThisRun`.**~~ **HECHO** — terminó en `errorCount: 0`
   sobre las 915. Los 4 casos sueltos que aparecieron a mitad de camino no eran
   fallos de enrichment sino arrastre de un batch de análisis original viejo
   (ver actualización arriba) y ya están resueltos. Si en el futuro corre de
   nuevo (banco nuevo, imágenes agregadas), seguir revisando `failedThisRun`
   con `GET /api/photodump-trainer/logs` igual que acá abajo se documentaba.

3. **Regenerar el snapshot compilado que consume producción.** El enrichment
   escribe sobre el banco del trainer (fuera del repo,
   `C:\Users\Nico Trabajo\Downloads\contenido de prueba\photodump`), NO sobre
   `src/data/photodump-bank/bank-snapshot.json`. Hasta correr esto, los 4
   filtros nuevos de 7.3 no ven ningún campo nuevo en producción (y por la
   semántica de retrocompatibilidad, descartan TODO candidato si se los usa):

   ```
   node scripts/compileBankSnapshot.js
   ```

   (Ver `src/data/photodump-bank/COMO_ACTUALIZAR_EL_BANCO.md` — es manual, nunca
   automático.) Después de esto, `git diff --stat src/data/photodump-bank/bank-snapshot.json`
   debería mostrar el archivo crecido con los campos nuevos; confirmar que
   `search_tags.archetype_primary` / `body_visibility` / etc. aparecen en los
   items del snapshot antes de dar por buena la regeneración.

4. **Commitear.** El working tree tiene sin commitear (ver `git status`):
   - `modules/motor-de-imagenes-corregido-v2/photodump-trainer/core/system-prompt.txt` (schema v3)
   - `modules/motor-de-imagenes-corregido-v2/photodump-trainer/core/enrichment-prompt.js` (NUEVO, sin trackear)
   - `modules/motor-de-imagenes-corregido-v2/photodump-trainer/core/job-runner.js`
   - `modules/motor-de-imagenes-corregido-v2/photodump-trainer/http/routes.js`
   - `modules/motor-de-imagenes-corregido-v2/photodump-trainer.html`
   - `api/gemini/content.ts` (los 4 filtros de 7.3)
   - `src/data/photodump-bank/bank-snapshot.json` (tras el paso 3)
   - este documento
   Nota de scope: hay cambios en `pose-library/*` y en un par de `.md` del
   manifiesto que son de OTRAS sesiones en paralelo — NO commitearlos junto con
   esto, tocar solo los archivos de la lista de arriba.

5. **Opcional / cuando haya resultados reales**: afinar los criterios de
   desambiguación entre arquetipos vecinos que quedaron flojos en el prompt
   (`romantic_girl` vs `coquette`, `tease_provocateur` vs `coquette`,
   `wellness_girl` vs `gym_girl`, `dark_academia` vs `edgy_alt`). Están
   documentados como pendientes en la memoria del proyecto
   (`project_photodump_arquetipos.md`, sección "Pendiente").

6. **Priorización por receta activa (sección 5.2 de este doc) NO se hizo** — el
   enrichment va en orden del banco, no priorizando `weeklyLooks` /
   `outfitRevealBasic` / `outfitMultiLook` primero. Si esas recetas necesitan
   los campos nuevos antes de que termine todo el banco, avisar y se reordena
   la cola (hoy `runEnrichmentBatch` toma `pending[0]` — habría que filtrar/
   ordenar esa lista por las imágenes que esas recetas citan).

---

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
