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

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
