# Plan de integración — nuevo diseño de Photodump

> Auditado contra el código real (`PhotodumpModule.tsx`, `PDStep1.tsx`,
> `PDStep2Receta.tsx`, `types.ts`, `slotCatalog.ts`) el 11-sep-2026, comparando
> con `photodump-flow-prototype/` (HTML/CSS/JS estático, mockup navegable sin
> lógica real).

## 0. Qué es realmente el prototipo, y qué no

El prototipo (`app.js`, 17 líneas de código comprimido) es una **maqueta
visual navegable**, no una implementación. Define:

- Una paleta y tipografía nuevas (verde `#1d9b68`/`#13734e` en vez del actual
  `brand-*`, `Playfair Display` para títulos + `DM Sans` cuerpo + `DM Mono`
  para labels técnicos — hoy el módulo usa `font-display`/`Syne`).
- Un flujo de 4 pasos con nombres distintos (`Receta · Configura · Crea ·
  Resultados`) — **pero esto ya existe**: `PhotodumpModule.tsx` ya tiene 4
  pasos (`Tipo · Brief · Generar · Resultado`, `WIZARD_STEPS_RECETA`). No es
  un flujo nuevo, es un re-etiquetado + rediseño visual del mismo esqueleto.
- Un catálogo de 6 recetas con `slots` genéricos (icono+label+badge
  "Necesario/Recomendado/Opcional") — el código real tiene **13 recetas**
  (`unboxing`, `outfit`, `outfit_check`, `outfit_haul`, `outfit_week`,
  `outfit_multi_look`, `outfit_reveal_basic`, `outfit_night_out`,
  `day_in_life`, `product_haul`, `bts`, `travel`, `free`) y un sistema de
  slots mucho más rico (`slotCatalog.ts`: 11 tipos con color, `modelHint`,
  `maxCount`, distinción identidad/no-identidad).
- Un paso de configuración simplificado: textarea de brief + grid de slots +
  2 grupos de "choices" (formato de publicación + una opción narrativa por
  receta) — **sin ninguna de las ramas específicas por receta** que hoy tiene
  `PDStep2Receta.tsx` (1293 líneas: el toggle ropa/producto + estilo de
  cámara + lugar de weeklyLooks, el selector de tipo de prenda del haul, el
  `MultiLookIntent` de varios looks, etc.).
- Una vista de "creación en vivo" con tarjetas grandes en vez del grid actual
  de miniaturas, y una galería de resultados con carrusel en vez del grid +
  lightbox actual.

**Decisiones ya tomadas con el usuario** (resueltas antes de escribir el plan
de trabajo detallado):

1. El rediseño se extiende a las 13 recetas existentes — el prototipo no
   define qué recetas quedan, es una muestra de estilo sobre 6. Las 6 del
   mock + `free` (modo libre) quedan confirmadas tal cual. `day_in_life`,
   `product_haul`, `bts`, `travel` quedan **pendientes de una decisión de
   negocio aparte** (si se retiran, se fusionan, o se migran igual) — el
   usuario ya había mencionado antes eliminar algunas recetas; corresponde
   retomar esa conversación por separado, no bloquea el trabajo de diseño
   sobre las 7 confirmadas.
2. Toda la lógica específica por receta que hoy existe **se conserva
   exactamente igual** — el rediseño es un cambio de envoltorio visual y de
   componentes de interacción, nunca una simplificación de reglas de
   negocio. Cada control puntual (el toggle de weeklyLooks, el selector de
   intent de multi-look, etc.) se re-viste con los componentes nuevos sin
   perder ningún caso que hoy funciona en producción.
3. **Paleta y tipografía: NO NEGOCIABLE, no cambian.** El verde/Playfair
   Display/DM Sans del prototipo se descarta por completo — Photodump tiene
   que verse igual que el resto de la app (`brand-*`, `font-display`/`Syne`
   actuales). El prototipo aporta layout, jerarquía de información,
   componentes e interacción — nunca color ni tipografía. Esto elimina toda
   la "Fase 0 — sistema de diseño" tal como estaba escrita más abajo: no
   hay tokens nuevos que definir, solo mapear cada elemento del mock a los
   tokens Tailwind (`brand-*`, `slate-*`) y fuentes que el resto de la app
   ya usa.
4. **`WizardStepper` no se toca** — se construye un `PhotodumpWizardStepper`
   propio, exclusivo de este módulo, en vez de modificar el componente
   compartido. Más trabajo (un componente nuevo en vez de reutilizar uno
   existente) pero cero riesgo de romper el stepper en los otros módulos que
   ya lo usan (auditar cuáles con `grep` antes de nombrar el archivo, para
   no chocar convenciones).
5. **Destino/formato de publicación se mueve al paso 2** — hoy vive en el
   paso 1 (`PDStep1.tsx`, junto a la receta); pasa a vivir junto al resto de
   la configuración de la receta en el paso 2, como propone el mock. El
   paso 1 queda enfocado solo en "qué querés crear" (receta), el paso 2 en
   "cómo" (brief, refs, formato, opciones).
6. **Carrusel confirmado para resultados, y con alcance mayor al que se
   había planteado**: no es solo la vista de resultados de Photodump — el
   usuario quiere que el carrusel del prototipo se construya como
   **componente compartido nuevo**, para reemplazar la galería actual
   (`ResultLibraryGrid` + `ImageLightbox`) en TODA la app, no solo acá. La
   galería actual es "solo funcional", el objetivo es una que además sea
   atractiva — mismo criterio que el resto de este rediseño. Este punto
   cambia el orden de prioridad del plan: construir bien este componente
   compartido pasa a ser trabajo de plataforma, no un detalle de la Fase 4
   de Photodump — ver sección 2bis.

## 1. Principio rector de todo el plan

**Ningún paso de este plan reescribe lógica de negocio.** Todo el trabajo es:
(a) un sistema de diseño nuevo (tokens, tipografía, componentes base) y
(b) reemplazar el envoltorio visual de los componentes existentes por esos
componentes nuevos, preservando cada prop, cada rama condicional, cada
validación que ya existe. Si en algún punto de la implementación hace falta
tocar lógica (no solo JSX/clases), se para y se pregunta — no se asume.

Esto es más lento que "reescribir todo copiando el mock", pero es la única
forma de no perder los ~15 bugs reales ya corregidos que viven en el
condicional de cada receta (ver por ejemplo las 5 rondas de fixes de
weeklyLooks de esta semana — cada una es una rama de código específica que
el mock no sabe que existe).

## 2. Fases de trabajo

### Fase 0 — Componentes base propios de Photodump (fundacional, se hace una sola vez)

Sin tokens nuevos (paleta/tipografía se heredan tal cual del resto de la
app) — el trabajo acá es **layout, jerarquía y componentes**, usando los
tokens Tailwind existentes (`brand-*`, `slate-*`, `font-display`/`Syne`).
Todo vive en `src/modules/photodump/components/` (namespace propio del
módulo, no en `components/shared/` — salvo el carrusel de galería, ver
sección 2bis, que sí es compartido a propósito):

- `RecipeCard` — **v2** (la v1 era una fila angosta icono+texto; el
  usuario pidió explícitamente que se vea como una card de resultado real
  — referencia: card de "Image Generation" con imagen protagonista + mini-
  stack de miniaturas "+N" simulando un carrusel + texto en overlay sobre
  gradiente). Ahora es: imagen/gradiente `aspect-[4/5]` protagonista, icono
  de la receta en badge circular arriba-izquierda, check de selección
  arriba-derecha, mini-stack de 2 miniaturas + contador debajo del check
  (simulando el carrusel de resultados), label+descripción en overlay con
  degradado inferior, y el "necesitás" en un pie separado debajo de la
  imagen. Coloreada con `brand-*`/`violet-*` (accent), NO con el verde del
  mock. **Imágenes reales: pendiente** — el usuario va a traer sets
  generados reales por receta más adelante; por ahora cada receta tiene su
  propio gradiente placeholder (`RECIPE_GRADIENTS` en `PDStep1.tsx`) para
  poder diferenciarse visualmente sin tener la imagen todavía. El
  componente ya soporta `previewImages?: string[]` — cuando lleguen las
  imágenes reales, se pasan ahí y reemplazan el gradiente automáticamente,
  sin tocar la estructura del componente.
  Layout de `PDStep1.tsx` también cambió: pasó de 2 columnas (recetas en
  lista angosta a la izquierda, destino a la derecha) a un grid de 2-3
  columnas de cards grandes a ancho completo, con el destino movido a una
  franja debajo (más chica, ya no protagonista — las cards de receta ahora
  son el foco visual principal de la pantalla).
  **IMPLEMENTADO** (`photodump/components/RecipeCard.tsx` + `PDStep1.tsx`).
  **Corrección mobile** (feedback real de producción tras el primer deploy):
  el grid de 2 columnas apretaba demasiado la card en pantallas chicas (el
  mini-stack de miniaturas quedaba feo, mucho scroll vertical para llegar a
  las 7 recetas). En mobile (`<md`) se reemplaza por
  `RecipeCardCarouselMobile` — carrusel horizontal de 1 card a pantalla con
  scroll-snap nativo + dots de navegación, sin librería. Este es el primer
  caso real de scroll-snap + dots en el módulo — vale la pena que el patrón
  quede prolijo acá porque el `ResultCarousel` compartido (sección 2bis) va
  a reusar la misma técnica.

  **Corrección de densidad — desktop Y mobile** (segundo round de feedback,
  mismo día): en desktop las cards de 3 columnas + `aspect-[4/5]` (alto)
  quedaban gigantes — "el scroll hasta el botón de continuar es
  considerable aun en pc". **Principio general que aplica a partir de acá a
  TODO el rediseño, no solo esta pantalla**: minimizar el scroll vertical
  siempre, en pc y en mobile, buscando que los componentes y opciones
  quepan en una sola vista cuando sea posible. Cambios concretos en esta
  pantalla: `RecipeCard` bajó de `aspect-[4/5]` a `aspect-[4/3]` (más
  apaisada), el mini-stack de miniaturas pasó de columna vertical a fila
  horizontal compacta (`-space-x`, sin ganar altura), se sacó la
  descripción larga del overlay (solo label — la descripción completa
  queda para un tooltip futuro, ver Fase 5/UI final con hover), y el grid
  de desktop subió de 2-3 a 4-5 columnas. También se eliminó el bloque
  "Qué vas a necesitar" que quedaba después del grid — era 100% redundante
  con el pie "necesitás" que ya muestra cada card, puro scroll extra sin
  información nueva. El bloque de destino se compactó (menos padding, sin
  subtítulo `hint`). Tener este principio presente en las Fases 2-4
  siguientes, no solo como parche puntual de esta pantalla.
- `SlotCard` — envoltorio visual del slot (icono en badge, badge
  requerido/recomendado/opcional, estado subido con check) — **NO
  reemplaza `ImageSlot`, lo envuelve**: tras auditar `ImageSlot.tsx` (340
  líneas) se confirmó que es el motor real de upload/drag&drop/compresión/
  consentimiento de UNA imagen — eso se conserva intacto, `SlotCard` solo
  cambia el contenedor visual alrededor. La lógica de multi-imagen/tags que
  se había atribuido acá en la primera versión de este plan en realidad
  vive un nivel arriba, directamente en `PDStep2Receta.tsx` (maneja
  `refs.outfitRefs[]`, tags `@outfit1`, etc.) — no es parte de `ImageSlot`
  ni de este componente, y no se toca en la Fase 0.
  **OJO — dos `SlotType` sin relación en el código**: uno en
  `ImageSlot.tsx` (icono contextual del upload), otro en
  `photodump/slotCatalog.ts` (catálogo semántico con color/maxCount/
  modelHint). `SlotCard` recibe props ya resueltas (`icon`, `label`,
  `requirement`) sin asumir de cuál catálogo vienen.
  **IMPLEMENTADO** (`photodump/components/SlotCard.tsx`).
- `ChoicePill` — el botón de opción tipo pill usado para formato y
  variantes narrativas (patrón que YA existe informalmente en varios
  `<button className="choice...">` repetidos por todo `PDStep2Receta.tsx`
  — vale la pena centralizarlo en este trabajo). Dos variantes: `compact`
  (fila de opciones cortas, ej. formato de publicación) y `card` (opción
  con descripción propia, ej. el toggle ropa/productos de weeklyLooks).
  **IMPLEMENTADO** (`photodump/components/ChoicePill.tsx`).
- `LiveGenerationCard` — la card grande del paso 3 con imagen + estado
  (evaluar si reemplaza o complementa el grid de miniaturas actual, ver
  Fase 3 — a diferencia del carrusel de resultados, acá NO hay pedido de
  reutilización en otros módulos, queda como componente propio). **Pendiente**
  — se construye en la Fase 3, junto con la decisión de layout de esa fase.
- **`PhotodumpWizardStepper`** (nuevo, propio del módulo) — mismo contrato
  de props que `WizardStepper` compartido (`steps`, `current`, `onJump`)
  para que el resto de `PhotodumpModule.tsx` no cambie cómo lo invoca, pero
  implementación y estilo 100% independientes. `components/shared/WizardStepper.tsx`
  queda intacto. **IMPLEMENTADO** (`photodump/components/PhotodumpWizardStepper.tsx`)
  — diferencia visual real respecto al compartido: acá TODOS los labels son
  visibles en desktop (no solo el del paso activo), con línea conectora
  continua entre círculos, tomado del prototipo.

**Verificación de esta fase**: cada componente nuevo se prueba aislado (con
datos de ejemplo) antes de conectarlo a `PhotodumpModule` — nunca se integra
un componente sin haberlo visto renderizado primero.

### Fase 1 — Paso 1 (elegir receta) — IMPLEMENTADO

Reemplaza el JSX de `PDStep1.tsx` (230 líneas) por `RecipeCard` +
`PhotodumpWizardStepper`. Mapeo directo, sin lógica nueva:

- `REGULAR_RECIPES` (las 7 confirmadas, hoy son 12 sin contar `free`) se
  renderizan como `RecipeCard`, con `need` derivado de `RECIPE_META[r].refs`
  vía un helper nuevo `requiredSlotsLabel()` (junta los slots
  `required` en una línea tipo "Tu foto · Look") — no inventa datos, resume
  los que ya existían.
- **El destino (`DESTINO_META`) TODAVÍA NO se movió al paso 2** — se
  mantuvo en el paso 1 por ahora, sin tocar su JSX, para no encadenar dos
  cambios estructurales (migrar recetas Y mover destino) sin verlos
  funcionar por separado primero. Se mueve en la Fase 2, cuando se trabaje
  `PDStep2Receta.tsx` de todas formas.
- El modo libre (`free`) conserva su tratamiento especial (separador "o",
  accent violeta vía el prop `accent="violet"` de `RecipeCard`) — la
  diferenciación de color se preserva como información real, no decorativa.

**Estado real**: `PhotodumpModule.tsx` usa `PhotodumpWizardStepper` en vez
del `WizardStepper` compartido (import + uso, mismo contrato de props,
`components/shared/WizardStepper.tsx` sin tocar). `PDStep1.tsx` usa
`RecipeCard` para las 7 recetas confirmadas + modo libre. `npx tsc --noEmit`
y `npm run build` verificados en verde tras el cambio.

### Fase 2 — Paso 2 (configuración) — la fase más grande

`PDStep2Receta.tsx` tiene 1293 líneas con ramas por receta. El prototipo
propone: textarea de brief + grid de slots + choices. La integración real:

1. **Brief**: cambia de `<textarea>` simple a estilizado con `SlotCard`
   pattern — sin cambio de lógica, es directo.
2. **Destino/formato de publicación** (`4:5 Feed / 9:16 Story / 1:1`):
   se incorpora acá (movido desde el paso 1, ver Fase 1) como un grupo de
   `ChoicePill`, tal como lo muestra el mock. Mapea directo a `DESTINO_META`
   existente — mismo dato, nueva ubicación y look.
3. **Slots**: hoy usa `SLOT_CATALOG` + `ImageSlot` con lógica de
   tags/chips/menú (mucho más rica que el mock, que solo tiene "click para
   subir"). El componente `SlotCard` nuevo debe soportar TODO lo que
   `ImageSlot` soporta hoy (multi-imagen, tags, reemplazo) — no es un
   reemplazo 1:1 trivial, es extender el componente nuevo hasta cubrir el
   catálogo real.
4. **Choices/opciones por receta**: acá está el trabajo fino. Auditar,
   receta por receta, qué controles existen HOY en `PDStep2Receta.tsx` y
   mapear cada uno a `ChoicePill`/`RecipeCard` en miniatura, sin perder
   ninguno:
   - `outfit_haul`: `HaulReferenceTypeSelector` (componente propio) — evaluar
     si se re-viste o se integra tal cual dentro de una sección con el
     estilo nuevo.
   - `outfit_week`: el toggle "¿Ropa o productos?" + (si es Ropa) "Estilo de
     cámara" + "Lugar" — construido esta semana como radio-buttons de texto
     simple, ya marcado en el código como fase de prueba a rediseñar
     ("esto se que rompe la ui actual... en manera de prueba hay que
     dejarlo mientras tanto sencillo" — comentario del propio código,
     `PDStep2Receta.tsx`). **Este es justo el rediseño que faltaba** — buen
     candidato para primer caso real de aplicar `RecipeCard`/`ChoicePill` en
     miniatura con imagen de ejemplo + tooltip (la versión final que el
     usuario pidió desde el principio, ver conversación de esta semana).
   - `outfit_multi_look`: selector de `MultiLookIntent` (4 opciones:
     weekly/then_vs_now/trip_recap/curated_ideas) + su UI de looks/accesorios
     con chips de enlace many-to-many — el más complejo de re-vestir, la
     lógica de chips de enlace no tiene equivalente en el mock.
   - `outfit_check`, `outfit_reveal_basic`: relativamente simples, mapean
     casi directo a slots + un choice narrativo.
   - `unboxing`: slots producto/packaging/persona/escena, sin choices
     complejos.
5. **Contador de fotos** (`count`, +/-): existe hoy, mapea directo al
   `count-control` del mock.
6. **Costo en créditos**: el mock lo muestra en el botón CTA final
   (`Crear set · N créditos`) — el código real ya calcula esto
   (`imageCreditCost` en `PhotodumpModule.tsx`), solo cambia dónde se
   muestra.

**Orden de trabajo sugerido dentro de esta fase**: empezar por las recetas
más simples (`unboxing`, `outfit_check`, `outfit_reveal_basic`) para validar
el patrón de componentes, seguir con `outfit_haul`/`outfit_week` (lógica
media), dejar `outfit_multi_look` para el final (la más compleja).

## 2bis. `ResultCarousel` — componente compartido de galería (trabajo de plataforma)

Esto es lo que más cambia el alcance del plan respecto a la primera versión:
no es "la vista de resultados de Photodump", es un componente nuevo en
`components/shared/` pensado desde el día 1 para reemplazar
`ResultLibraryGrid` + `ImageLightbox` en los **16 módulos** que los usan hoy
(confirmado por código real: `AvatarLibrary`, `CampaignModule`,
`ContentStudioProModule`, `ManualCreatorModule`, `ModelDNAModule`,
`OutfitExtractorModule`, `PhotodumpModule`, `PlannerDetail` (x2, incluye
`_archived_v2`), `ProductGeneratorModule`, `CampaignGenerator`,
`GeneratedImages`, `PhotodumpMode`, `SceneCloneModule`, `GenerationHistory`,
`Library`).

**Por qué se hace así y no como una vista aislada de Photodump**: el usuario
lo pidió explícitamente — "la actual es solo funcional pero la quiero
cambiar a una funcional y atractiva, así que si lo hacemos bien podemos
reutilizar este diseño de carrusel para las otras galerías de toda la app".
Construirlo bien una vez cuesta más al principio que integrarlo solo en
Photodump, pero evita reconstruirlo 16 veces o dejar una app con dos
estilos de galería conviviendo.

**Contrato a preservar** (`ImageLightbox` hoy, 222 líneas, ya genérico):
`images: string[]`, `initialIndex?`, `onClose`, `onDownload?`, `metadata?`
(label/date/credits), `details?` (ReactNode libre), `extraButton?`
(label/onClick/icon). `ResultCarousel` nuevo debe poder cubrir el mismo
contrato — o uno compatible con un adaptador fino — para que migrar cada uno
de los 16 usos sea mecánico, no una reescritura por módulo. Revisar también
`ResultLibraryGrid` (277 líneas, `ResultLibraryGridProps`) para lo que
aporta como vista de conjunto (no solo el visor de una imagen).

**Enfoque de implementación recomendado — migración incremental, no un
big-bang de 16 módulos a la vez**:

1. Construir `ResultCarousel` en `components/shared/`, con paleta/tipografía
   del sistema actual (no las del mock), pero el layout/interacción del
   prototipo (imagen grande, flechas laterales, dots de navegación, caption
   overlay, acciones de entrega debajo).
2. Primer consumidor real: **Photodump, paso 4** (Fase 4 de este plan) — es
   el caso de uso que motivó el pedido, y el equipo ya lo va a estar
   probando a fondo como parte de este trabajo.
3. Validar con el usuario en producción (mismo patrón que toda esta semana:
   generar, mirar el resultado real, ajustar) antes de tocar ningún otro
   módulo.
4. Una vez estable, migrar el resto de los 16 usos **uno por uno**, en
   sesiones de trabajo separadas — cada módulo tiene su propio contexto
   (qué metadata muestra, qué botones extra tiene) y merece su propia
   verificación, no un reemplazo masivo sin mirar cada caso.
5. `ResultLibraryGrid`/`ImageLightbox` se deprecan (comentario en el código,
   no se borran) recién cuando el último módulo haya migrado — nunca antes,
   para no dejar un módulo roto a mitad de la migración.

**Nota de alcance**: los pasos 4-5 (migrar los otros 15 módulos) son
trabajo real pero **quedan fuera del alcance inmediato de este plan** — este
documento es sobre Photodump. Se anota acá para que la decisión de
arquitectura (dónde vive el componente, qué contrato tiene) se tome
correctamente desde el principio y no haya que reescribirlo cuando llegue el
turno de los otros módulos.

### Fase 3 — Paso 3 (creación en vivo)

El mock muestra tarjetas grandes verticales (una imagen a la vez, con
placeholder tipo "Creando..."), el código real muestra un grid de
miniaturas con estados por celda (activo/hecho/fallido/reintentando).

- Decisión de diseño pendiente con el usuario: ¿se adopta el patrón de
  tarjetas grandes del mock (una visible a la vez, más "narrativo") o se
  mantiene el grid (más información de un vistazo, mejor para sets de 6-8
  fotos)? El mock está pensado para sets chicos (`n` típico 3-4); el código
  real soporta hasta 20 (`outfit_haul`/`product_haul`). Un patrón de
  tarjetas grandes con 20 elementos sería muy largo de scrollear — probable
  que la respuesta sea "grid para sets grandes, cards para sets chicos" o
  simplemente mantener el grid re-vestido con el estilo nuevo.
- El manejo de estados (ancla, fallidos, reintentando) es lógica real que se
  preserva completa — el mock no contempla fallos ni reintentos.

### Fase 4 — Paso 4 (resultados) — usa el carrusel compartido nuevo (ver 2bis)

Decisión ya tomada: carrusel, no grid, para la vista de resultados —
tal como propone el mock (una imagen grande a la vez, navegación con
flechas/dots, caption y acciones debajo). Esta fase consume el componente
`ResultCarousel` construido en la sección 2bis; acá el trabajo es
específico de Photodump:

- Conectar `ResultCarousel` con los datos reales del set (`currentSet`,
  `shotUrls`, metadata de cada shot).
- El caption sugerido y las acciones de descarga/copiar/guardar en
  biblioteca ya existen en el código real (`ResultCard` las tiene hoy) —
  se trasladan a las secciones "delivery" del carrusel nuevo, sin cambiar
  su lógica (qué genera el caption, a dónde pega "Guardar en Biblioteca").
- El grid actual (`ResultLibraryGrid`) puede conservarse como vista
  secundaria si el usuario quiere "ver todo de un vistazo" antes de entrar
  al carrusel (útil para sets grandes de `outfit_haul`/`product_haul`, 20
  fotos) — a definir si el patrón final es "grid de miniaturas → click abre
  carrusel" o "carrusel siempre, con dots/miniaturas de navegación como ya
  propone el mock". Recomendación: carrusel siempre como vista principal
  (así se valida el componente nuevo a fondo en su caso de uso más exigido),
  con opción de saltar a cualquier foto vía los dots/miniaturas — sin una
  vista de grid aparte, salvo que en la prueba real con sets de 20 fotos se
  note que hace falta.

### Fase 5 — Migración final y limpieza

- Actualizar `WIZARD_STEPS_RECETA`/`WIZARD_STEPS_LIBRE` con los labels
  nuevos si se decide adoptarlos (`Receta/Configura/Crea/Resultados` vs.
  `Tipo/Brief/Generar/Resultado`).
  - Verificar que ningún otro módulo dependa del wording actual (buscar
    referencias cruzadas antes de cambiar).
- Barrido de `npx tsc --noEmit` + `npm run build` tras cada fase, no solo al
  final — como se hizo durante todo el trabajo de weeklyLooks esta semana.
- Prueba manual receta por receta (las 7 confirmadas) antes de dar la fase
  por cerrada — mismo patrón de "generar, mirar el resultado real, ajustar"
  ya usado toda la semana, no solo revisar que compile.

## 3. Riesgos y puntos de fricción a vigilar

- **`SlotCard` nuevo tiene que igualar la funcionalidad de `ImageSlot`**,
  no solo el look — es fácil subestimar cuánta lógica de tags/chips/reemplazo
  vive ahí. Auditar `ImageSlot.tsx` a fondo antes de empezar Fase 2.
- **`ResultCarousel` compartido (sección 2bis) es el punto de mayor riesgo
  real del plan** — no por Photodump, sino porque mal diseñado puede
  obligar a re-hacerlo cuando llegue el turno de los otros 15 módulos.
  Cerrar bien el contrato de props ANTES de escribir el componente (mismo
  criterio que `ImageLightbox` ya resuelve hoy: `images`, `metadata`,
  `details` como slot libre, `extraButton` para acciones específicas del
  módulo) — no diseñar solo mirando lo que necesita Photodump.
- **Sets grandes (20 fotos, `outfit_haul`/`product_haul`) en el carrusel**
  — el mock está pensado para sets de 3-4. Confirmar en la prueba real que
  la navegación (dots/flechas/miniaturas) sigue siendo usable con 20
  elementos antes de dar la Fase 4 por cerrada.
- **Recetas pendientes de decisión de negocio** (`day_in_life`,
  `product_haul`, `bts`, `travel`) — no bloquean el trabajo de diseño sobre
  las 7 confirmadas, pero conviene resolver esa conversación de producto
  antes de llegar a la Fase 5 (migración final), para no rediseñar algo que
  se va a retirar.

## 4. Qué NO cambia en este trabajo

- Ningún endpoint, ninguna llamada a Gemini, ningún prompt builder.
- Ninguna regla de negocio por receta (qué refs son necesarias, cómo se
  calculan créditos, qué pasa si falla un shot).
- El flujo de generación (`buildPhotodumpSessionPlan` →
  `generatePhotodumpREF0` → `generatePhotodumpShot`) no se toca.

---

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
