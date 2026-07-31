# Photodump Trainer — banco real + Director Creativo (Gemini) para probar recetas

> **Para qué sirve este documento**: es el punto de encuentro entre dos líneas de
> trabajo paralelas sobre Photodump. Este chat (photodump-trainer) construyó un
> banco de +1000 imágenes reales analizadas y un motor que las recombina con
> Gemini para armar historias multi-shot. El otro chat (validación manual en
> Higgsfield, manifiesto de esta carpeta) ya validó a mano el contrato narrativo
> real de varias recetas, shot por shot. Ninguno de los dos reemplaza al otro
> todavía — este documento existe para que ambos lo lean, entiendan qué existe
> del otro lado, y decidan juntos qué cruzar. **Actualizar cada vez que haya un
> hallazgo nuevo de cualquiera de los dos lados** — no es un documento cerrado.

Última actualización: 2026-07-31.

## 1. Por qué existe este proyecto paralelo

El usuario venía de un ciclo de trabajo (en el chat de validación manual) donde
cualquier imagen de referencia subida terminaba tratada como **referencia casi
absoluta** — el agente intentaba replicar esa foto puntual en vez de usarla como
inspiración, perdiendo creatividad y variedad real. Este proyecto (photodump-trainer)
nace como respuesta a ese problema: en vez de partir de una sola referencia por
shot, se construyó un **banco grande de fotos reales de creadoras/influencers**
(poses, gestos, escenas, props, ángulos — no un solo "outfit de referencia"), y
un director que **recombina piezas de ese banco con razonamiento**, no que copia
una imagen puntual.

**Lo que este banco reemplaza conceptualmente**: HPI (Human Photo Intelligence)
y UGC Intelligence, dos sistemas que el usuario había empezado a adaptar para
Photodump desde otro módulo y que generaron un enredo de mantenimiento. La
apuesta de este proyecto es que **un solo banco de fotos reales, bien analizado
y categorizado, puede cumplir ese rol sin mantener sistemas separados**.

**Importante — qué NO es este proyecto todavía**: no es el "cerebro central"
completo de un Director Creativo (ver diagrama que el usuario compartió: brief +
referencias + contrato de tarea → banco de conocimiento → plan global → memoria
de continuidad → shot plan → output). Es la pieza de **banco de recursos +
reglas de composición/continuidad** — el "contrato de tarea" (el esqueleto
narrativo real y validado de cada receta) todavía vive del lado de este
manifiesto, no está conectado al trainer.

## 2. Dónde vive todo (rutas reales)

- **Código del motor**: `modules/motor-de-imagenes-corregido-v2/photodump-trainer/`
  (aislado, NO toca `src/modules/photodump/recipes/` — nada de esto está en
  producción todavía).
  - `core/creative-director.js` — el director en dos pasos (decidir → redactar),
    con las reglas de composición documentadas inline (ver sección 4).
  - `core/recipe-templates.js` — hoy tiene UN esqueleto narrativo, inventado por
    este chat (7 roles fijos para `outfit_night_out`), **no** el contrato real
    ya validado en `05_outfit_night_out.normalized.ts` / `09_session_log_outfit_night_out_validation.md`.
    Ver sección 5 — este es el cruce pendiente más importante.
  - `core/shot-candidate-query.js` — arma pools de candidatos por shot desde el
    banco, con fallback cross-recipe para señales mecánicamente transferibles
    (ej. "sostener una bebida" sirve igual de día o de noche).
  - `core/category-normalizer.js` — normaliza el campo `category` (libre en el
    banco original, ~230 variantes) a ~14 categorías fijas.
- **Herramienta de análisis** (sube fotos, Gemini las analiza): `modules/motor-de-imagenes-corregido-v2/photodump-trainer.html`,
  arrancada con `iniciar-entrenador-photodump.bat` (puerto 3132).
- **Script de prueba de historias**: `modules/motor-de-imagenes-corregido-v2/photodump-trainer-test/test-night-out-story.js`
  — corre `node test-night-out-story.js "<brief>"` y devuelve los 7 shots con
  su prompt final + verificación de continuidad de venue.
- **El banco en sí (imágenes + análisis JSON)**: se movió FUERA de la carpeta
  del proyecto (crecía a miles de archivos) a
  `C:\Users\Nico Trabajo\Downloads\contenido de prueba\photodump` en la máquina
  del usuario. El código lo lee vía la variable de entorno
  `PHOTODUMP_TRAINER_DATA_DIR` (ver `store.js`) — si no está seteada, cae al
  viejo default dentro del repo (vacío hoy).

## 3. Qué es el banco, cómo se hizo, y qué garantiza

Cada imagen subida al entrenador se analiza con Gemini y produce un JSON con:
- `raw_visual_description`: descripción literal reconstruible (pose, gesto,
  mirada, outfit, objetos visibles, escenario, luz, encuadre).
- `interpreted_signals[]`: señales reutilizables — cada una con `category`,
  `reusable_primitive` (tag mecánico snake_case), `condition` ("mantener: X;
  cambiar: Y" — qué es transferible y qué no al reusar esa señal en otro
  contexto), y `uses[]` (qué receta(s) le sirve y con qué fit).
- `search_tags`: `shot_type`, `setting[]`, `time_of_day_guess`,
  `narrative_beat_fit[]` (enum: establish, anticipate, transform, validate,
  experience, connect, reflect, close), `capture_signature` (para excluir fotos
  con iluminación de estudio del banco de "realismo cámara-roll").
- `prohibited_commercial_signals`: si hay logo/marca visible, esa imagen entera
  se excluye del pool de candidatos (no se intenta limpiar el texto, es más
  seguro descartar la imagen completa).

**Estado actual del banco**: ~1030 imágenes aprobadas (de un total mayor
analizado), curadas manualmente por el usuario (aprobar/rechazar cada una tras
comparar contra la imagen real). Se sigue enriqueciendo activamente — el
usuario agrega tandas nuevas dirigidas a llenar huecos específicos detectados
en las pruebas (ver sección 4, hallazgo de `social_connect`).

**Lo que garantiza**: variedad real de pose/gesto/encuadre desde fotos
genuinas de creadoras, no generadas ni sintéticas — el director elige y
recombina piezas de esto, nunca copia una sola imagen entera.

## 4. Cómo razona el Director Creativo (`creative-director.js`)

Arquitectura en **dos llamadas a Gemini** (no una, ver por qué en el comentario
de cabecera del archivo — una sola llamada causaba que Gemini omitiera
sistemáticamente el shot más ambiguo del array):

1. **`decideStory`**: recibe los pools de candidatos de cada shot (resumidos,
   no el JSON completo) y devuelve solo las DECISIONES — qué señal de pose y
   qué señal de escenario usar por shot, más `sceneAnchorId` (ver abajo) y
   razonamiento corto. No redacta texto de prompt todavía.
2. **`writePrompts`**: con las decisiones ya fijas, redacta el `finalPrompt` en
   inglés de cada shot, aplicando las reglas de estilo/continuidad.

### Reglas ya validadas con evidencia real (generaciones reales en Higgsfield)

- **Nunca UI de cámara ni marcas/logos** en el prompt final.
- **Continuidad de venue (`sceneAnchorId`)**: todos los shots que comparten
  `sceneGroup` deben describir el MISMO lugar físico — mismo estilo/paleta de
  luz — aunque cambie ángulo/pose. Un `sceneGroup` distinto (ej. "transition")
  puede ser un lugar físicamente distinto, porque representa una transición
  legítima (saliendo del venue). **Validado**: 3 briefs distintos (bar,
  rooftop, restaurante de aniversario) mantuvieron 6/6 shots del venue
  principal en el mismo lugar, con verificación automática en el script de
  test.
- **Sub-zonas dentro del mismo venue** (ej. de la barra a una mesa): la
  redacción correcta es una **afirmación de estado corta y directa** ("seated
  at a dining table visible inside the same restaurant") — NUNCA con verbo de
  tránsito ("walking to", "has now moved away from") y NUNCA nombrando el
  lugar de origen para contrastarlo (mencionar "bar" aunque sea en negativo
  refuerza esa ubicación en la imagen generada). **Validado empíricamente**:
  variantes con verbo de tránsito o contraste explícito fallaron (0/2, se
  quedaban en el lugar original); la afirmación de estado corta llegó a 3/4
  de éxito.
- **Gesto contenido cuando hay sub-zona**: un gesto corporal muy expresivo
  (reírse con la cabeza hacia atrás, brazos en movimiento amplio) compite con
  la instrucción de reubicación — el generador tiende a ignorar la sub-zona y
  quedarse en el lugar de la imagen de referencia. Con gestos contenidos
  (sostener la copa, mirada al trago, sonrisa suave) la sub-zona se resuelve
  con más confiabilidad. Con gesto expresivo + sub-zona a la vez, conviene la
  afirmación de estado corta sin mencionar el origen (llegó a 3/4 vs. 0/2 y
  0/4 de variantes previas).
- **Variedad de shot social sin caer en "brindis de foto de bodas"**: un
  brindis con la otra persona centrada y nítida mirando a cámara se lee como
  foto profesional externa, no cámara-roll. Lo que sí funciona (validado con
  imágenes reales generadas): la otra persona como **presencia incidental**
  (mano/brazo entrando en cuadro sosteniendo su propia copa, sin mostrar cara
  ni cuerpo completo) + variedad real de mirada de la protagonista (no siempre
  directo a cámara — puede estar bebiendo con los ojos cerrados, mirando el
  trago, mirando fuera de cuadro).
- **"Instagrameable" ≠ candid a toda costa** — corrección importante del
  usuario: nadie sube contenido no favorecedor. El objetivo real es
  "consciente de cámara mostrando algo bonito, pero con textura de cámara-roll
  de celular", no eliminar la conciencia de cámara. El error real de las
  primeras pruebas no era "posar", era verse como foto de producción externa
  (profundidad de campo tipo food-photography, composición muy cuidada).
- **Referencias de imagen > descripción textual densa**: cuando el prompt usa
  chips/referencias reales (identidad, outfit, imagen-ancla del venue) en vez
  de describir todo en prosa, el resultado se ve más "cámara-roll auténtico".
  Describir el mobiliario/objeto específico del entorno (ej. "vanity mirror")
  tiende a anclar también una pose más cerrada/convencional; dejar solo
  paleta+materiales como ancla dura da más variedad de pose y encuadre
  (confirmado con 4 corridas repetidas de la misma variante, 3/4 con
  resultado de cuerpo completo y pose dinámica vs. resultado más cerrado con
  descripción de mueble específico).
- **`venue_scenic_moment` vs `venue_detail`**: son conceptualmente distintos
  (rincón "instagrameable" donde la persona posa deliberadamente vs. POV
  ambiental sin protagonismo de la persona) — pero si la nota de uno cita
  explícitamente el nombre del otro shot como comparación (ej. "a diferencia
  de venue_detail..."), Gemini omite sistemáticamente ese shot del array de
  salida. Toda nota de shot debe ser autocontenida, del mismo largo/forma que
  sus vecinas, sin referencias cruzadas a otros shotIds.
- **Fallback mecánico** (cuando Gemini omite un shotId pese a la instrucción):
  nunca debe repetir una señal ya usada en otro shot de la misma historia, y
  debe heredar el `sceneAnchorId` del grupo ya establecido en vez de elegir
  escena a ciegas.

## 5. El cruce pendiente — esqueleto narrativo real, no inventado

**Esto es lo más importante para el otro chat**: `recipe-templates.js` hoy
tiene un esqueleto de 7 shots con roles narrativos que este chat inventó
(`establish_look`, `social_connect_1`, `drink_detail`, `venue_detail`,
`social_connect_2`, `venue_scenic_moment`, `closing_reflect`) — funciona bien
como prueba de concepto de continuidad/composición, pero **no es el contrato
real ya validado a mano en Higgsfield**.

Lo que el manifiesto de esta carpeta ya validó y que el trainer todavía no usa:

1. **Núcleo narrativo dual, no secuencia fija** (`02_the_psychology_behind_photodump_v2.md`
   sección 4bis): el arco de `outfit_night_out` no es "prep→salida→experiencia→cierre",
   son dos ejes independientes ("tuvo una noche memorable" + "se veía increíble
   en el outfit") que cualquier shot puede probar, no una secuencia obligatoria.
2. **Los beats son un pool, no una secuencia fija** (`03_photodump_recipe_architecture.md`
   sección 13bis, `09_session_log...` sección 3): 3, 6, 8 shots — cualquier
   combinación de un pool de ~8 beats reales funciona igual de bien. La lista
   real validada en Test A: `NIGHTOUT_PRESENTATION`, `NIGHTOUT_TRYON_DETAIL`,
   `NIGHTOUT_HOME_MIRROR_CHECK`, `NIGHTOUT_VENUE_SETTLED`,
   `NIGHTOUT_SOCIAL_CONNECTION`, `NIGHTOUT_VENUE_PAUSE`, `NIGHTOUT_CLOSURE`
   (más REF0 técnico condicional).
3. **REF0 condicional**: con avatar entregado, se puede arrancar directo en el
   venue (sin shot de preparación) — coincide con la regla ya aplicada en el
   trainer de "nunca preparación", pero el manifiesto lo resuelve como shot
   opcional fusionable, no como eliminado de la plantilla.
4. **Posición de la cita de referencia dentro del prompt** (`09_session_log...`
   sección 4bis): citar `@PIA`, `@outfit-...` SIEMPRE al inicio absoluto del
   prompt, antes de cualquier descripción — citarlas a mitad de párrafo hace
   que Higgsfield las trate como instrucción de composición activa (compite
   con la pose) en vez de ancla de identidad silenciosa. El trainer no ha
   verificado esto sistemáticamente en sus propias pruebas con chips.
5. **El marco del espejo no es necesario para mirror-selfie** (`09_session_log...`
   sección 4ter): basta con describir el gesto (brazo levantado, celular en
   mano tapando parcialmente el rostro) — no hace falta pedir que el marco del
   espejo sea visible, libera al fondo de esa restricción.
6. **Acompañante con cara visible también es válido** — `NIGHTOUT_SOCIAL_CONNECTION`
   en producción se aprobó en 1 iteración con una acompañante mostrando cara
   completa, riendo, identidades claramente distintas. Esto **no contradice**
   el hallazgo del trainer (acompañante = mano/brazo incidental) — probablemente
   ambos son variantes válidas del mismo beat social, no una regla única. Vale
   la pena que el trainer pruebe ambas variantes y confirme si el banco tiene
   material para las dos.

**Recomendación para retomar este cruce** (no ejecutada todavía en este chat):
reescribir `recipe-templates.js` para reflejar el pool real de beats de arriba
(no los 7 roles inventados), con el núcleo dual como criterio de selección en
vez de un orden fijo, y aplicar los hallazgos 4 y 5 a `creative-director.js`
(posición de citas, espejo opcional).

## 6. Cómo correr una prueba hoy

```
cd modules/motor-de-imagenes-corregido-v2/photodump-trainer-test
GOOGLE_CLOUD_PROJECT=luz-ai-studio GOOGLE_CLOUD_LOCATION=us-central1 VERTEX_GEMINI_MODEL=gemini-2.5-flash node test-night-out-story.js "<brief en español>"
```

Devuelve los 7 shots con su `finalPrompt` en inglés listo para pegar en
Higgsfield/generador de imágenes, más una verificación automática de
continuidad de venue por `sceneGroup`. El usuario genera manualmente en
Higgsfield y reporta el resultado visual — ningún agente debe llamar
herramientas de generación de imágenes por su cuenta.

## 7. Bitácora de hallazgos (agregar entradas nuevas al FINAL, con fecha)

- **2026-07-31**: creación de este documento de handoff. Estado del banco:
  ~1030 imágenes aprobadas, banco movido fuera del repo a
  `C:\Users\Nico Trabajo\Downloads\contenido de prueba\photodump`
  (`PHOTODUMP_TRAINER_DATA_DIR`). Director validado en `outfit_night_out` con
  hallazgos de continuidad de venue, sub-zonas, gesto contenido, y variedad de
  shot social (ver sección 4). Cruce con el contrato narrativo real de
  producción (sección 5) identificado pero no ejecutado todavía.
