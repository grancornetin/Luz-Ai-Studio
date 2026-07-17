# Bitácora de sesión — Validación manual de outfit_night_out
Julio 2026. Punto de entrada para retomar este trabajo en una nueva conversación.

## 1. Qué se hizo en esta sesión

Se ejecutó la Fase 1-4 del protocolo de revalidación manual (`07_manual_revalidation_protocol.md`) sobre la receta `fashion.outfit_night_out`, generando y evaluando en Higgsfield los 7 shots visibles del contrato normalizado (`05_outfit_night_out.normalized.ts`), más el REF0 técnico. Es el primer Test A completo (identidad + outfit + brief, sin escenas de referencia) que existe para cualquier receta de Photodump. En el camino se descubrieron 4 hallazgos de arquitectura que ya están incorporados al manifiesto, y se construyó y depuró un banco de conocimiento transversal (SeaDream) para uso futuro del Director Creativo.

**Nada de esto se hizo dentro de la app.** El proceso fue manual: el usuario sube referencias a Higgsfield como "Elements" (con ID persistente tipo `<<<uuid>>>` o citable como `@[nombre](id)`), yo compongo el prompt de texto en lenguaje natural (sin metadata de sistema, sin nombres de receta/shot), el usuario lo pega y genera, comparte la imagen resultante, y evaluamos juntos contra el protocolo antes de seguir al siguiente shot. Esto es intencional y reemplaza cualquier intento de automatización previo (ver nota en README) — la automatización viene después de validar, no antes.

## 2. Cómo replicar este proceso para la siguiente receta

1. Elegir la receta de la cola de prioridad (`07_revalidation_queue.md`).
2. Para el primer shot (o REF0 si aplica — ver hallazgo de REF0 condicional abajo), traducir el contrato TS a un prompt en lenguaje natural: sin IDs de receta, sin nombres de shot, sin jerga de sistema — el modelo de imagen no tiene memoria de la conversación ni sabe qué es "Photodump".
3. Citar cada referencia con su Element real (`@[nombre](id)`), nunca por posición ("imagen 1, imagen 2").
4. Antes de fijar la pose/acción, buscar la familia relevante en HPI (`src/data/HPI/03_reglas_director_hpi_mujer_151.json` o su equivalente hombre) y extraer su `riskMitigation` + `amplifierHints` + `negativePromptHints` reales — no describir la pose de memoria. Ver sección 4 para qué se aprendió sobre esto.
5. Pensar la escena completa ANTES de escribir — una sola postura físicamente inequívoca con punto de apoyo explícito, no una disyuntiva ("crouched o seated") que el modelo tenga que resolver solo.
6. Generar, y revisar el resultado contra el checklist de fallos críticos del protocolo (sección 5 de `07_manual_revalidation_protocol.md`) ANTES de comentar cualquier otra cosa — barrer manos, pies, geometría de espejo, puntos de contacto, no solo el elemento que se estaba discutiendo.
7. Si hay continuidad de mundo entre shots (mismo cuarto, mismo venue), citar SIEMPRE la misma imagen ancla original — nunca un shot narrativo intermedio (ver hallazgo below sobre por qué esto falla).
8. Iterar el prompt con causa raíz, no acumulando reglas reactivamente — ver sección 5.
9. **Citar todos los Elements de referencia (identidad, cuerpo, outfit) al inicio absoluto del prompt, antes de cualquier palabra de descripción — nunca a mitad de párrafo.** Ver hallazgo de posición de cita en sección 4bis.

## 3. Los 7 shots de outfit_night_out — resultado

Los 7 shots del contrato (`05_outfit_night_out.normalized.ts`) fueron generados y aprobados en Test A (identidad completa: avatar + outfit + brief, sin escenas de referencia previas):

1. **REF0 (prep anchor, técnico, no visible)** — identidad + cuerpo + geometría del cuarto. Aprobado en 2 iteraciones (la primera tenía pose rígida y sin celular; corregido con HPI familia `MIRROR_SELFIE_REFLECTION`).
2. **NIGHTOUT_PRESENTATION** — sosteniendo el outfit en hanger, celular en la otra mano, base look todavía puesto. Aprobado en 2 iteraciones (la primera mezcló sin querer estilos `person_holding` + `rack_haul` de la inteligencia legacy de `outfitCheck.ts`, produciendo un wear-state contaminado).
3. **NIGHTOUT_TRYON_DETAIL** — cerrando el cierre de una bota, sentada en el borde de la cama. Aprobado en 3 iteraciones (fallos: mano/celular flotante sin brazo conectado en el 2º intento; postura "sentada" sin punto de apoyo real en el colchón en el 3º intento — corregido pensando la escena completa de una sola vez en vez de acumular reglas).
4. **NIGHTOUT_HOME_MIRROR_CHECK** — mirror check con el outfit completo, mismo cuarto. Aprobado en 1 iteración.
5. **NIGHTOUT_VENUE_SETTLED** — sentada en la barra del bar, trago recién servido. Aprobado en 1 iteración (venue generado desde brief, sin referencia de imagen).
6. **NIGHTOUT_SOCIAL_CONNECTION** — con una acompañante, riendo, identidades claramente distintas. Aprobado en 1 iteración.
7. **NIGHTOUT_VENUE_PAUSE** — baño del venue, pausa relajada. Aprobado en 2 iteraciones (la primera produjo un baño de calidad de festival/camping y una expresión de agotamiento en vez de relajo — corregido subiendo el nivel del lugar y bajando la intensidad del cansancio pedido).
8. **NIGHTOUT_CLOSURE** — calle nocturna, esperando el auto, mirando a cámara. Aprobado en 1 iteración (el usuario corrigió mi propuesta inicial de "no mirar a cámara" — una foto de cierre de noche que nadie mira a cámara no es publicable).

**Estado formal:** Test A completo. Según `05_outfit_night_out.validation.md`, faltan Test B (solo producto, sin rostro/cuerpo) y Test C (con escenas de referencia cargadas) para alcanzar `VISUALLY_VALIDATED`. No se ha hecho ninguno de los dos todavía.

## 4. Hallazgos de arquitectura (ya incorporados al manifiesto — no releer esta sección como pendiente, es un resumen de lo que ya está escrito en otros documentos)

Durante la validación surgieron 5 hallazgos que cambiaron partes del diseño original. Ya están documentados en detalle en sus archivos correspondientes; acá solo el resumen para orientarse rápido:

1. **Núcleo narrativo dual, no línea de tiempo** (`02_the_psychology_behind_photodump_v2.md`, sección 4bis). El arco de `outfit_night_out` no es "preparación → salida → experiencia → cierre" — es "ella tuvo una noche memorable, y se veía increíble en el outfit". Dos ejes que un shot puede probar independientemente, no una secuencia de eventos obligatoria.

2. **REF0 es condicional, no obligatorio** (`03_photodump_recipe_architecture.md`, sección 9). Con avatar entregado, el REF0-como-cuarto-de-preparación es prescindible — se puede arrancar directo en el venue. Sin avatar (Generated Identity), sigue haciendo falta fijar identidad, pero puede fusionarse con el primer shot visible en vez de ser un paso técnico descartable.

3. **Los beats son un pool, no una secuencia fija** (`03_photodump_recipe_architecture.md`, sección 13bis). Se demostró con evidencia visual real (collages comparativos armados por el usuario) que distintas combinaciones de 3, 6 y 8 shots — algunas con variaciones que ni siquiera estaban en la lista original de 7 — funcionan igual de bien como dump completo. La tabla `compression: Record<number, string[]>` del contrato actual es más rígida de lo necesario.

4. **Producto protagónico y experiencia aspiracional no compiten, se potencian** (`01_visual_intelligence_database.md`, VDI-003b). Un shot de cuerpo completo con el outfit legible en un lugar aspiracional debe puntuar alto en AMBOS ejes a la vez (fashion alto Y experience alto), no uno a costa del otro — es el mecanismo central de "vender sin vender".

5. **Diseño de consulta a bancos de conocimiento transversal** (`08_knowledge_bank_query_design.md`). HPI (pose/gesto), librerías por categoría tipo `footwear_ugc_library` (arquetipos de escena con producto), y SeaDream (composición + intención + categoryFit multi-categoría) son capas complementarias que el futuro Recipe Planner debe cruzar, no elegir una. Diseño conceptual completo; implementación pendiente de las piezas listadas en la sección 6 de ese documento.

## 4bis. Hallazgo de mecánica Higgsfield — posición de la cita de Element dentro del prompt (julio 2026, validación de `outfit_reveal_basic`)

Este hallazgo es distinto a los 5 de la sección 4: no es sobre arquitectura de receta, es sobre cómo Higgsfield interpreta una cita `@[nombre](id)` según **dónde aparece dentro del prompt**.

**El caso que lo reveló:** un shot de POV en primera persona (cámara = los propios ojos del personaje mirando hacia abajo, sin celular visible, sin brazo, sin rostro) necesitaba citar `@PIA-BODY` para que las proporciones reales del avatar (busto, cintura, contextura) se reflejaran en el escorzo tan cerrado — sin esa cita, el resultado es publicable pero corre el riesgo de "aplanar" o promediar el cuerpo hacia una silueta genérica.

- **Intento 1 (sin citar `@PIA-BODY` en absoluto):** pose y encuadre correctos, aprobado como shot publicable, pero sin garantía de que las proporciones sean las reales del avatar.
- **Intento 2 (citando `@PIA-BODY` a mitad de párrafo, como una instrucción más — "For body proportions only... match @PIA-BODY's real measurements. Do not copy any pose... The standing pose described above overrides everything else"):** resultado roto. La pose cambió por completo — de "parada, mirando hacia abajo" pasó a una postura reclinada con las piernas dobladas, como si el modelo hubiera copiado la composición de la imagen de referencia de `@PIA-BODY` en vez de solo tomar proporciones. Ni las instrucciones explícitas de "no copies la pose" ni ponerlo al final del párrafo evitó esto.
- **Intento 3 (citando `@[pia-body](id)` como primera palabra absoluta del prompt, antes de cualquier texto descriptivo — igual que ya se citaba `@PIA` y `@outfit-...` en todos los prompts anteriores de night_out):** funcionó. Misma pose POV correcta del intento 1, esta vez con proporciones reales del avatar.

**Regla operativa:** citar **solo las referencias que ese shot específico necesita**, al inicio absoluto del prompt, en bloque, antes de la primera palabra de descripción de la escena. Cuando un Element se cita en medio del texto narrativo — aunque sea con instrucciones explícitas de "solo toma esto, no aquello" — Higgsfield parece tratarlo como una instrucción compositiva activa que compite con la descripción de pose, en vez de un ancla de identidad de fondo. Al inicio, se comporta como ancla silenciosa; en medio del párrafo, se comporta como orden de composición.

**Corrección importante (mismo shot, iteración siguiente):** la primera redacción de esta regla decía "citar TODAS las referencias de identidad/cuerpo/producto al inicio, siempre". Eso es incorrecto y ya se demostró con evidencia — en un shot de POV donde el rostro nunca aparece en el encuadre (el prompt dice explícitamente "no chin, no face, no head"), agregar `@PIA` (rostro) al inicio junto a `@PIA-BODY` fue contraproducente: introduce una referencia sin función en la escena que compite por espacio de atención con la única cita que sí importa. El prompt que funcionó cita ÚNICAMENTE `@PIA-BODY` y `@outfit-...` al inicio — sin `@PIA` — porque el rostro no participa de este shot. La regla no es "citar todo siempre", es "citar exactamente lo que el shot necesita, ni más ni menos, y ponerlo al inicio".

Esto no se había notado antes porque en los 7 shots de `outfit_night_out` cada shot solía necesitar rostro + cuerpo + outfit simultáneamente (todos con encuadres donde la cara es visible), así que "citar todo al inicio" y "citar lo necesario al inicio" coincidían sin que la diferencia fuera evidente. Este caso (POV sin rostro) fue el primero en exponerla.

## 5. Lecciones operativas del proceso manual (para no repetir errores)

Estas son lecciones de *proceso*, no de arquitectura — aplican a cómo se escribe y depura cada prompt, en cualquier receta futura:

- **No poner metadata de sistema en el prompt de imagen.** "Create shot NIGHTOUT_TRYON_DETAIL for the Photodump recipe..." es ruido puro para el modelo generador — no sabe qué es una receta ni un shot ID. Traducir siempre a lenguaje natural puro.
- **Usar HPI activamente, no de memoria.** Cuando se necesitó corregir rigidez de pose, ir a buscar la familia HPI real (`amplifierHints`, `riskMitigation`) fue lo que funcionó — describir la pose "a mano" sin consultar el banco fue lo que falló las primeras veces.
- **Pensar la escena completa antes de escribir, no acumular reglas después del error.** El fallo de "sentada en el aire, sin apoyo en el colchón" no se arregló agregando más reglas de "compresión del colchón" — se arregló re-imaginando la postura completa de una sola vez. Un prompt bien pensado desde el inicio vale más que mil candados reactivos.
- **Un shot narrativo previo NO sirve como referencia de continuidad de mundo.** Trae consigo pose, gesto y composición que compiten con las instrucciones nuevas. Para anclar geometría de un cuarto/venue, citar siempre la imagen REF0/ancla original, sin importar cuántos shots narrativos pasaron entre medio.
- **Revisar la imagen completa contra el checklist de fallos críticos antes de responder cualquier otra cosa.** Varias aberraciones (mano/celular flotante, postura sin apoyo) se pasaron por alto la primera vez porque el foco estaba en el tema que se discutía, no en un barrido completo del frame.
- **Cuando el usuario corrige un criterio de negocio, no un detalle técnico, revisar si aplica en un rango más amplio de lo evidente.** Ejemplo: la corrección de "experience no requiere compañía" llevó a descubrir que también aplicaba mal la lógica a "producto vs. lugar como disyuntiva" (VDI-003b) — vale la pena preguntarse qué más se apoyaba en el mismo supuesto equivocado.

## 6. Banco SeaDream — estado final

Ubicación: `src/data/Analisis de datos/seadream_normalized/seadream_normalized/` (9 archivos `seadream_normalized_batch_01.json` a `batch_09.json`, 428 entradas totales). Fuente original: `src/data/Analisis de datos/seadream-bank-2026-06-23 (1).md` (476 entradas, 15 intenciones; 48 excluidas por ser de otro formato — expresión facial pura, reservadas para fusión futura con HPI).

**Proceso de normalización (3 pasadas, documentado como caso de estudio de qué falla al pedirle scoring en batch a un LLM):**

- **v1** (primera pasada): falló en dos ejes. `productSlot` extraía "no tattoos" (residuo de negative prompt) en 43.7% de las entradas. `categoryFit` colapsó a valores por defecto — `tech` en 6-7 el 80.6% de las veces (el LLM confundió la frase de estilo "candid iphone photo" con un dispositivo real en escena), `fashion` siempre 8-9, `jewelry` siempre 7. Rechazada por completo.
- **v2** (segunda pasada, instrucciones reescritas con reglas de exclusión explícitas para productSlot, regla anti-default para categoryFit, y corrección del criterio de `experience` — ver sección 7 abajo): arregló productSlot (0% de residuos) y bajó tech a valores razonables, pero introdujo un problema nuevo: `jewelry` copiado mecánicamente de `fashion` en 83.2% de las 428 entradas (sin evaluar si la joya era real o el encuadre permitía verla), y `experience` colapsado a solo 3 valores fijos (2, 5, 8) en todo el banco.
- **v3** (tercera pasada, corrección dirigida ejecutada directamente por Claude — no por LLM externo — con 9 subagentes en paralelo, uno por archivo, seguido de una auditoría independiente y una cuarta ronda de ajuste fino): bajó jewelry==fashion de 83.2% a 3% (13/428, todos casos reales verificados), llevó experience a escala continua (7-9 valores distintos por archivo). Una auditoría posterior encontró inconsistencia residual entre archivos (tech con ~28% de falsos positivos en la muestra revisada; experience descalibrado ±1 punto entre archivos para settings genéricos) — corregida con una cuarta pasada acotada (6 falsos positivos de tech corregidos, 40 casos de experience recalibrados a una vara común).

**Estado actual: usable con confianza para diseñar consultas.** `productSlot`/`secondarySlots` confiables, `categoryFit` (fashion, footwear, jewelry, tech, beauty, experience) evaluado con criterio real por entrada, no por plantilla.

**Regla de negocio aprendida y ya incorporada a los criterios de scoring:** un producto (joya, dispositivo, calzado) no puntúa alto en su categoría solo por estar mencionado en el texto — necesita que el `cameraFraming` de esa entrada específica permita verlo con claridad (plano medio/cerrado con la parte del cuerpo relevante visible), no un plano de cuerpo completo lejano. Esta regla de "mención + encuadre válido" debería aplicarse también al diseñar `footwear_ugc_library`-equivalentes para otras categorías en el futuro.

## 7. Qué falta (próximos pasos posibles, sin orden obligatorio)

- **Test B y C de `outfit_night_out`** (solo producto sin avatar; con escenas de referencia cargadas) para alcanzar `VISUALLY_VALIDATED` formal según `05_outfit_night_out.validation.md`.
- **Implementar `buildShotCandidates()`** de `08_knowledge_bank_query_design.md` — hoy es diseño, no código. Faltan: un mapa real de compatibilidad pose↔familia HPI (hoy conceptual), y un `ProductCategory` compartido entre los tres bancos.
- **Aplicar el mismo proceso de validación manual a la siguiente receta de la cola** (`07_revalidation_queue.md`): R2, dividir `outfit_check` en sus 5 subrecetas (`outfit_reveal_basic`, `outfit_day_out`, `outfit_workday`, `outfit_event`, `outfit_travel`) según `06_repository_audit.md`. Aplicar desde el diseño los 5 hallazgos de la sección 4 de este documento, en vez de descubrirlos de nuevo.
- Los 48 excluidos del banco SeaDream (expresión facial pura) siguen pendientes de fusión con HPI — no se ha tocado ese trabajo todavía.
