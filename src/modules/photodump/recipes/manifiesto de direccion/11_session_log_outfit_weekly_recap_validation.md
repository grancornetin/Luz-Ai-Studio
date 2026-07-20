# Bitácora de sesión — Validación manual de outfit_multi_look
Julio 2026. Tercera receta validada manualmente. Leer `09_session_log_outfit_night_out_validation.md` primero si es la primera vez que se retoma este trabajo.

**Nota de nombre:** esta receta se diseñó primero como `outfit_weekly_recap` (ver secciones 1-5, sin editar, es el registro real de cómo se descubrió). Después de validarla se encontró que el mismo motor técnico sirve, sin cambios, a otras 3 historias que iban a ser recetas separadas — ver sección 6. Se renombró a `outfit_multi_look` como receta base, con las 4 historias como intenciones/variantes de la misma receta, no recetas independientes. Este archivo mantiene el nombre de archivo `11_session_log_outfit_weekly_recap_validation.md` por continuidad de la sesión, pero el contenido ya refleja la receta fusionada.

## 0. Por qué existe esta receta (y por qué reemplazó a las subrecetas de lugar)

R2 (`06_repository_audit.md`) originalmente proponía dividir `outfit_check` en variantes de lugar: `outfit_day_out`, `outfit_workday`, `outfit_event`, `outfit_travel`. Se descartaron antes de validar ninguna: no son historias distintas, son la misma receta de "salida" con el nombre del destino cambiado, sin lógica narrativa propia.

Se reemplazaron por 4 formatos reales de contenido de moda en redes, identificados por el usuario a partir de patrones que reconocía de Instagram/TikTok e investigados en profundidad antes de tocar Higgsfield: weekly recap, rate my outfit, then vs now, choose-for-me. La investigación (WebSearch) confirmó que los 4 ya tienen versión de foto fija/carrusel establecida en redes — no hay que inventar el formato, hay que imitar uno que el público ya reconoce.

## 1. Qué se hizo en esta sesión

Se definió el núcleo narrativo de lo que en ese momento se llamaba `outfit_weekly_recap` y se validaron manualmente 5 shots en Higgsfield (Lunes a Viernes), cada uno con un outfit distinto sobre el mismo fondo fijo. Al terminar, se identificó que el mismo mecanismo sirve sin cambios a las otras 3 historias — ver sección 6.

## 2. Núcleo narrativo

No hay dos ejes independientes como en `night_out`, ni variaciones de ángulo/distancia como en `reveal_basic`. Acá el eje único es **repetición con variación controlada**: misma persona, mismo lugar, mismo tipo de encuadre — cambia solo el outfit y la pose. El motivo narrativo declarado (semana, oficina, elegir para un evento, pedir calificación) vive en el copy/caption, no en el mecanismo de generación de imagen — ver sección 6.

Referencia visual real que originó el diseño: un carrusel de Instagram de una creadora mostrando distintos outfits ("POV you turned 30 and aren't sure what to wear... Welcome to my page") — 8 fotos, mismo hall de entrada con espejo dorado, mismo mueble y cuadro de fondo en las 8, cambiando solo ropa y pose.

## 3. El patrón técnico (plantilla reutilizable — el motor de toda la receta)

Este es el hallazgo central de la sesión — la fórmula exacta que hace funcionar la receta, válida para las 4 intenciones de la sección 6:

**Referencias (Elements) por shot:**
1. `@pia` — rostro (identidad).
2. `@pia-body` — cuerpo (proporciones reales).
3. `@imagen1` — ancla de escena/mundo. **Siempre la imagen original del primer shot, nunca el shot inmediatamente anterior** (mismo principio que en `night_out`: un shot narrativo con pose propia compite y puede arrastrar su pose si se usa como ancla en cadena; se evita citando siempre la misma fuente).
4. `@outfit-N` — el outfit nuevo a probar en ese shot específico.

**Estructura del prompt (constante), aplicando ya el hallazgo de posición de citas de `09_session_log...md` sección 4bis — todas las referencias en bloque al inicio:**

- Encuadre fijo: "full-body mirror selfie", idéntico en todos los shots del set.
- Instrucción explícita de qué SÍ tomar de `@imagen1` (el fondo, los muebles, el marco del espejo — deben verse idénticos) y qué NO tomar (pose, outfit, posición del cuerpo — cambian por completo). Sin esta distinción explícita, el ancla puede arrastrar su propia pose al resultado nuevo.
- Una frase de pose nueva, distinta a las de los shots anteriores del mismo set — no requiere banco HPI porque son variaciones simples de postura de pie frente a espejo, no gestos complejos.
- Cierre técnico estándar: misma luz que la referencia, reflejo de espejo correcto, lista de errores a evitar (dedos, manos, proporciones, fondo inconsistente).

**Primer shot (ancla), distinto a los siguientes:** no cita `@imagen1` porque es el que la genera. Su prompt describe la escena con detalle explícito (mueble, cuadro, marco del espejo) porque esa descripción es la que se reutiliza textualmente en los shots siguientes.

## 4. Los 5 shots de prueba — resultado (caso weekly)

1. **Día 1 (Lunes)** — ancla de escena, hall de entrada con espejo, outfit `base-look-athleisure-pink-001`. Aprobado en 1 iteración.
2. **Día 2 (Martes)** — outfit `outfit-day-001`, citando `@imagen1`. Aprobado en 1 iteración. Confirmado explícitamente por el usuario: mismo fondo, pose distinta, ambos reales.
3. **Día 3 (Miércoles)** — outfit `outfit-work-001`. Generado con el mismo patrón.
4. **Día 4 (Jueves)** — outfit `outfit-night-001`. Generado con el mismo patrón.
5. **Día 5 (Viernes)** — outfit `outfit-noche-mariposas`. Generado con el mismo patrón, cierre de semana.

**Estado formal:** Test A completo (identidad + 5 outfits, sin escenas de referencia externas — la escena se generó como parte del Test A) para la intención weekly. Test B y C no se han hecho. Las otras 3 intenciones (sección 6) heredan el mismo motor validado, pero no se ha generado un set de prueba dedicado a cada una todavía.

## 5. Por qué esta receta no necesita `maxShots` rígido

A diferencia de `night_out` (7 shots con arco narrativo, `compression` por cantidad) y `reveal_basic` (3 shots cerrados por decisión de diseño), `outfit_multi_look` es estructuralmente abierta: el límite real no es narrativo, es la cantidad de referencias de outfit disponibles. Cada intención sugiere un rango (ver tabla en sección 6), pero el contrato técnico no necesita un techo — es la primera receta del catálogo con esta propiedad.

## 6. outfit_multi_look como receta base — 4 intenciones, un solo motor

**Hallazgo posterior a validar el caso weekly:** el usuario notó que el mismo flujo (`@pia + @pia-body + @imagen1 + @outfit-N`, mismo esqueleto de texto, pose nueva) no depende de por qué se muestran varios outfits — genera N fotos de la misma persona en el mismo lugar sin importar si la razón declarada es "mi semana", "outfits de oficina", "opciones para un evento" o "califica cuál te gusta". Eso llevó a fusionar 4 recetas que iban a ser independientes (`outfit_weekly_recap`, `outfit_rate_check`, `outfit_then_vs_now`, `outfit_choose_for_occasion`) en una sola receta base, `outfit_multi_look`, con esas 4 como intenciones/variantes — no contratos separados.

**Renombre de la 4ta intención (julio 2026, tras validar su set de prueba):** `choose_for_occasion` (concebida originalmente como "ayudame a elegir, vota A/B/C") resultó ser, con evidencia visual real, una historia distinta: "outfits que usé en mi viaje a [ciudad/país]" — un recap de viaje/ocasión, no un mecanismo de voto. Se renombra a **`trip_recap`**. Ver sección 6ter para el detalle completo, incluida la diferencia estructural clave: acá el fondo SÍ cambia en cada shot (a diferencia de `weekly`/`then_vs_now`, que mantienen un fondo fijo).

Lo único que varía por intención es cantidad de looks y, opcionalmente, overlay de texto o copy sugerido — no el prompt de generación de imagen en sí (salvo `trip_recap`, que además varía el fondo por shot — ver 6ter):

| Intención | # looks típico | Fondo | Overlay de texto en imagen | Copy/caption sugerido |
|---|---|---|---|---|
| `weekly` | 5-7 | Fijo (misma ancla) | Día de la semana (opcional) | "mi semana en outfits" |
| `then_vs_now` | Abierto, sin límite — ver sección 6bis | Fijo (misma ancla) | Fecha/año (opcional) | "antes vs ahora" |
| `rate_check` | 1 | N/A | Ninguno | "califica este look del 1 al 10" |
| `trip_recap` (ex `choose_for_occasion`) | 3-5+ | Variable — un lugar icónico distinto por shot | Nombre del lugar/viaje (opcional) | "outfits que usé en [ciudad]" |
| `curated_ideas` | 3-5 | Fijo o neutro (no es el foco) | Número/etiqueta de idea (opcional) | "3 ideas de vestido para invitada a boda", "outfits que serán tendencia 2026" |

**5ta intención — `curated_ideas` (agregada julio 2026, antes de generar set de prueba).** A diferencia de las 4 anteriores, que muestran "mi vida" (mi semana, mi viaje, mi antes/ahora, mi look de hoy), esta intención muestra una **recomendación/guía organizada por categoría** — el sujeto de la frase no es "yo", es el tema: "3 ideas de vestidos para invitada a una boda", "4 outfits de oficina", "jeans tendencia 2026". No hay jerarquía entre looks (a diferencia de `then_vs_now`) y el fondo probablemente debería ser neutro o consistente (mirror-selfie estándar, como `weekly`) porque el protagonista real es el outfit en sí, no una experiencia/lugar asociado (a diferencia de `trip_recap`, donde el lugar es coprotagonista). Motor técnico: el mismo de siempre (`@pia + @pia-body + @outfit-N`), variando solo qué outfits se citan (todos deben pertenecer a la misma categoría declarada) y el copy. Sin set de prueba generado todavía — pendiente, ver sección 7.

**No probado todavía:** ninguno de los 5 shots generados incluyó overlay de texto quemado en la imagen (día, número, fecha) — todos los prompts hasta ahora solo generan la foto limpia. Si se decide que el overlay va dentro de la imagen (en vez de agregarse después en edición) hay que validar esa instrucción de texto-en-imagen por separado; es un riesgo conocido de los modelos de generación (texto ilegible o mal ubicado) que no se ha probado en esta receta.

## 6bis. Intención `then_vs_now` — validada, con reglas propias además del motor base

A diferencia de `weekly` (donde ningún look es "mejor" que otro, son solo variaciones neutrales), `then_vs_now` tiene una **jerarquía deliberada**: el "ahora" tiene que ganar sobre el "antes". Reusa el motor de la sección 3 (`@pia + @pia-body + @imagen1 + @outfit-N`, ancla + no-copiar-pose) pero con reglas adicionales específicas de esta intención.

**No es un par fijo de 2 fotos.** Igual que `weekly` no tiene techo narrativo (sección 5), `then_vs_now` es una lista abierta de shots donde cada uno lleva un campo adicional `era: 'before' | 'after'` (además del `outfit` que ya tiene todo shot del motor base). El usuario puede pedir cualquier cantidad y en cualquier orden — 2 shots (1 antes + 1 ahora), o 6-10 intercalados ("jeans de antes vs jeans de ahora", "vestidos de antes vs vestidos de ahora", "outfits de antes vs outfits de ahora" todos mezclados). El campo `era` de cada shot determina únicamente qué "receta de pose" aplicar (baja presencia si es `before`, alto impacto si es `after` — ver las 3 palancas abajo) y qué overlay/caption le corresponde si se usa uno; no cambia el mecanismo de generación de imagen en sí, que sigue siendo el mismo para cualquier shot del set sin importar su era. No se generó un set de prueba con más de 1 par (2 shots) en esta sesión — el diseño de "lista abierta con era" queda formalizado pero sin validar visualmente con más de un par todavía.

**Las 3 palancas del contraste** (deben moverse todas en la misma dirección, no alcanza con cambiar solo el outfit):
1. **Outfit** — elegir deliberadamente un outfit "antes" menos favorecedor (holgado, colores apagados/oscuros, cubre más) contra un outfit "después" más favorecedor (ajustado, colores vibrantes) — no alcanza con dos outfits neutros cualquiera.
2. **Pose/presencia física** — el "antes" necesita postura de baja presencia descrita con acciones físicas concretas (hombros redondeados hacia adentro, brazo libre pegado y rígido al cuerpo, peso distribuido sin intención, mirada al celular en vez de al espejo) — no alcanza con adjetivos vagos como "neutral" o "energía relajada", eso no mueve la aguja. El "después" necesita lo opuesto con la misma especificidad física (contrapposto, mano en la cadera con codo hacia afuera creando hip pop, pecho abierto, mirada directa) — HPI/SeaDream `sd_0397`/`sd_0289` (alto impacto) fueron la base real usada, no poses inventadas de memoria.
3. **Asociación outfit-energía** — el gesto de la mano libre en el "después" debe interactuar físicamente con el outfit (tocar la cintura, el borde de la prenda) para que la confianza se lea como causada por la ropa, no como una capa de actitud superpuesta encima de cualquier prenda — esto es el mecanismo de "vender sin vender" (VDI-003b) aplicado a este formato específico.

**Hallazgo — el filtro NSFW de Higgsfield falla de forma intermitente sobre este tipo de prompt, y la causa NO quedó identificada con confianza (investigación no concluyente, documentada para no repetirla igual).** Con ropa deportiva ceñida (crop top + short corto) y poses de "alto impacto", se observó una tasa de fallo que osciló entre 25% y 75% a través de varias reescrituras del prompt, probando en secuencia: suavizar vocabulario de intensidad, cambiar dirección de la mirada, quitar el contrapposto/hip pop marcado, y despojar el texto de todo adjetivo de actitud. Cada cambio pareció correlacionar con una mejora o empeoramiento en muestras de 4 generaciones — pero al re-probar la primera versión ("cargada", con vocabulario intenso y hip pop, la que en su primera tanda de 4 dio 0% de fallo) con una muestra más grande de 8, dio 50% de fallo. Es decir: **la misma versión de prompt, sin cambios, dio 0% en una tanda de 4 y 50% en una tanda de 8** — lo que indica que el clasificador de seguridad no es determinístico para este tipo de contenido (border-line), y que ninguna de las correcciones de texto probadas demostró un efecto causal confiable con el tamaño de muestra usado en esta sesión.

**Investigación adicional — se probó cambiar el outfit manteniendo el mismo texto de pose de "alto impacto", para aislar si la prenda (cobertura, tipo de tela) era la variable causal:**

| Outfit probado | Cobertura relativa | Tasa de fallo |
|---|---|---|
| Gym (crop top + short, el original) | Más piel expuesta | 50% (8 generaciones) |
| Night out (vestido/conjunto de salida) | Cobertura media | 75% |
| Oficina | La más cubierta de los 3 | **100%** |

El resultado descarta la hipótesis de "más piel expuesta = más fallo": el outfit más cubierto (oficina) tuvo la peor tasa, no la mejor. Esto, sumado a que ningún ajuste de vocabulario/mirada/postura mostró un efecto confiable (ver arriba), lleva a la conclusión final de esta investigación.

**Conclusión operativa final (investigación cerrada, sin causa identificada):** el filtro de seguridad de Higgsfield es inconsistente para el patrón "mirror-selfie + pose de moda/confianza marcada", casi sin importar el outfit, el vocabulario o los detalles de postura probados. No se encontró una variable de texto controlable que baje la tasa de fallo de forma confiable — los resultados observados a lo largo de la sesión (0%, 25%, 50%, 75%, 100% en distintas combinaciones) son más consistentes con un clasificador probabilístico/no determinístico que con una causa textual identificable. **Regla operativa: cualquier receta o integración futura que use poses de "alto impacto"/confianza corporal marcada debe presupuestar reintentos automáticos ante fallo de moderación como comportamiento esperado, no como bug a resolver con mejor prompting.** No vale la pena seguir iterando el texto del prompt persiguiendo una tasa de fallo menor sin evidencia de que el texto sea la causa.

**Hallazgo — reconfirmación de que el marco del espejo no es necesario** (ver `09_session_log...md` sección 4ter): se probó explícitamente generar sin `@imagen1` como ancla y sin pedir el marco del espejo, dejando solo el gesto de brazo levantado + celular tapando parte del rostro como señal de mirror-selfie. Funciona.

**Hallazgo — luz cálida ("golden hour") repetida en cada "después" se vuelve una fórmula predecible.** Las primeras iteraciones pedían explícitamente luz dorada/cálida para el "después" como una de las palancas de contraste. Se corrigió a **"misma luz que el ancla, sin cambios"** — además de evitar la repetición visual entre sets distintos, es más honesto narrativamente: el contraste se lee como "cambié yo" en vez de "cambió la iluminación de la foto".

**Estado:** Test A completo en cuanto a que ya se obtuvieron imágenes "antes" y "después" aprobadas visualmente (contraste de pose/outfit funciona bien narrativamente). "Antes" es confiable — nunca mostró fallo de moderación en ninguna variante probada. "Después" (pose de alto impacto) SÍ genera resultados aprobables cuando pasa el filtro, pero requiere reintentos: tasa de fallo observada entre 25% y 100% según la tanda, sin causa textual identificada — ver investigación completa arriba. La plantilla de prompt a usar es la v3/v10 (equivalentes en fondo, ambas "cargadas" con pose de alto impacto tipo SeaDream) — no vale la pena seguir buscando una versión "seguidora" que evite el filtro, hay que presupuestar reintentos.

## 6ter. Intención `trip_recap` (ex `choose_for_occasion`) — validada, con motor distinto al resto

**Reconceptualización completa respecto al diseño original.** `choose_for_occasion` se había definido (sección 6, basada en la investigación de formatos de TikTok) como "mostrar 3-5 looks para que la audiencia vote cuál usar" — un mecanismo de decisión/interacción. El usuario, con evidencia visual real (un carrusel real de Instagram: "Outfits I wore in St Tropez", 6 fotos, cada una en un lugar distinto de la misma ciudad, mismo gesto de saludo a cámara), mostró que esto es en realidad **un recap de viaje/ocasión** — la pregunta no es "¿cuál me pongo?", es "estos son los looks que usé durante mi viaje a X". Se renombra a `trip_recap`.

**Diferencia estructural clave respecto a `weekly`/`then_vs_now`: acá el fondo cambia en cada shot, a propósito.** No hay una única `@imagen1` ancla que se repite — cada shot es un lugar icónico distinto (Central Park, Times Square, un rooftop, una calle de SoHo), todos parte del mismo viaje/ciudad. La continuidad del set no la da el fondo (que varía) sino únicamente la identidad (`@pia` + `@pia-body`, mismo look de pelo/piel) y, opcionalmente, un overlay de texto compartido (nombre del viaje/ciudad).

**El mecanismo narrativo es "vender por asociación" (VDI-003b), aplicado con más fuerza que en ninguna otra receta hasta ahora:** el lugar/experiencia aspiracional es el protagonista de cada shot, y el outfit queda asociado a esa sensación de vida — "si alguien que vive así se viste de esta forma, yo también quiero vestirme así para tener esa vida". Esto invierte la jerarquía habitual (donde el outfit es el centro y el lugar es contexto) — acá ambos deben leerse como igualmente protagónicos, ninguno le resta al otro.

**Fuente de composición: banco SeaDream, filtrado por `sourceIntent: lifestyle_aspiracional` y `categoryFit.experience` + `categoryFit.fashion` altos a la vez** (no HPI, que está construido sobre poses de persona-cerca-de-cámara, no de tercera persona con paisaje protagónico). Se usaron como base real: `sd_0363` (balcón/mirador con vista panorámica, golden hour), `sd_0269` (calle downtown, contrapposto, atardecer), `sd_0061` (balcón nocturno con skyline).

**Hallazgo — Finding 005: el lenguaje de "camera roll" arregla textura, no composición** (documentado en detalle en `10_experimental_findings_001.md`). El primer intento de estos 3 shots, con pose tomada del banco SeaDream + bloque de render `iphone_camera_roll`, seguía viéndose como campaña editorial de moda (Dior/marca de lujo) en vez de foto UGC — a pesar de que la textura ya estaba bien resuelta. Con 8 ejemplos reales aportados por el usuario, se identificó que faltaba una capa de **composición casual**: sujeto descentrado (no en el medio del cuadro), mirada dirigida lejos de la cámara (no posada), el elemento icónico "asomándose" parcialmente en el encuadre en vez de centrado simétricamente detrás de la cabeza, y imperfecciones de encuadre reales (horizonte inclinado, espacio asimétrico, pies cortados). Agregar este bloque de composición resolvió el problema.

**Hallazgo — regla global nueva: nunca describir al personaje caminando** (documentado en `09_session_log...md`, checklist paso 10). Un intento de pose "mid-stride/mid-step" para dar sensación de espontaneidad produjo una zancada que se leía falsa — el modelo no resuelve bien la física de piernas en movimiento en una imagen estática. Se corrigió describiendo una postura de pie explícitamente estática pero con mirada/torso que sugieren un momento candid (torso girado, mirada fuera de cámara) — la sensación de espontaneidad viene de la mirada y el encuadre, no del movimiento de piernas.

**Los 3 shots de prueba (ciudad: Nueva York) — resultado:**
1. **Rooftop/mirador con skyline de día** (base `sd_0363`, outfit `outfit-day-001`) — aprobado. De perfil, mirada al horizonte, mano en las gafas, composición asimétrica con espacio de cielo despejado — se lee genuinamente candid.
2. **Calle icónica (SoHo/downtown)** (base `sd_0269`, outfit `outfit-work-001`) — aprobado tras 1 corrección de pose (primera versión se leyó como caminando pese a decir "standing still"; corregido especificando explícitamente pies juntos y cercanos, no una pierna extendida lejos de la otra). Taxi amarillo asomándose en el borde del encuadre, mirada fuera de cámara.
3. **Rooftop bar de noche con skyline** (base `sd_0061`, outfit `outfit-night-001`) — prompt escrito con la capa de composición UGC ya incorporada, pendiente de generar/aprobar.

**Estado:** Test A funcionalmente completo — 2 de 3 shots del set de prueba aprobados con la fórmula final (SeaDream aspiracional + capa de composición UGC + regla de no-caminar + render iPhone camera-roll). El 3er shot (rooftop noche) no se generó — el usuario dio por entendido el patrón con la evidencia de los 2 shots aprobados, no hace falta completar el número.

**Pendiente identificado tras cerrar el set de NY — de dónde salen los lugares icónicos.** Nueva York es un caso fácil: es una mega-ciudad turística sobrerrepresentada en cualquier conocimiento general, así que nombrar "Times Square" o "Brooklyn Bridge" y describir la escena de memoria funciona razonablemente bien. Esto NO escala a ciudades menos icónicas o menos representadas — Viena, Ámsterdam, Bruselas, Bali, Medellín, Santiago de Chile. Para esas, si el sistema (o yo) "inventa" qué lugar es icónico sin una fuente real, el riesgo es alto: puede describir un lugar genérico que no representa nada reconocible de esa ciudad específica, rompiendo la promesa central de la receta (que el lugar sea aspiracional Y reconocible).

**Decisión de diseño (julio 2026): el usuario declara los lugares en el brief — el sistema no los adivina.** El Director/Prompt Composer no debe intentar generar automáticamente una lista de "lugares icónicos de [ciudad]" para ciudades que no domina con certeza. En su lugar, el brief de `trip_recap` pide explícitamente al usuario que liste los lugares del viaje (ej. "Cerro San Cristóbal, Barrio Lastarria, Costanera Center" para Santiago) — el usuario sabe mejor que nadie qué vivió en su viaje real o qué quiere mostrar. El trabajo del sistema es solo **redactar bien la escena una vez que tiene el nombre del lugar**, no elegir qué lugares nombrar. Esto se refleja en el template de brief actualizado en la sección 6quater (campo "Fondo").

**Excepción razonable:** para mega-ciudades turísticas globales (Nueva York, París, Roma, Londres, Tokio — destinos con presencia masiva y consistente en cualquier fuente), sigue siendo razonable que el sistema sugiera lugares icónicos conocidos como punto de partida, siempre y cuando el usuario pueda corregirlos o reemplazarlos libremente. No es una regla de "nunca sugerir", es una regla de "no asumir que se puede adivinar en cualquier ciudad".

## 6quater. Mapa de recetas de Fashion — qué usar para qué historia (guía de cierre del grupo)

Pedido explícito del usuario, con la preocupación (válida) de no terminar con recetas redundantes entre sí. Esta tabla es el punto de referencia único para elegir qué receta/intención corresponde a una historia que el usuario quiera contar. No confundir con `04_fashion_mother.md` sección 15 (lógica de selección conceptual, anterior a esta validación) — esta tabla ya refleja lo validado con imágenes reales.

| El usuario quiere contar... | Receta / intención | Referencias mínimas a cargar | Fondo |
|---|---|---|---|
| "Así quedó este look" (un solo outfit, distintos ángulos) | `outfit_reveal_basic` | `@pia`, `@pia-body`, 1 outfit | Fijo, un solo cuarto |
| "Tuve una noche memorable y me veía increíble" (salida con arco: prepararse → venue → cierre) | `outfit_night_out` | `@pia`, `@pia-body`, 1 outfit de noche | Múltiple (cuarto → venue → calle), con REF0/ancla por tramo |
| "Mi semana en outfits" / "outfits de oficina de la semana" | `outfit_multi_look` — intención `weekly` | `@pia`, `@pia-body`, 5-7 outfits | Fijo, una sola ancla generada en el primer shot |
| "Antes me vestía así, ahora así" (evolución de estilo personal) | `outfit_multi_look` — intención `then_vs_now` | `@pia`, `@pia-body`, 2+ outfits (uno marcadamente menos favorecedor que el resto, a propósito) | Fijo, una sola ancla |
| "Califica este look" (un solo outfit, pidiendo feedback) | `outfit_multi_look` — intención `rate_check` | `@pia`, `@pia-body`, 1 outfit | Fijo |
| "Outfits que usé en mi viaje a X" (varios looks, cada uno en un lugar icónico distinto de la misma ciudad/viaje) | `outfit_multi_look` — intención `trip_recap` | `@pia`, `@pia-body`, 3-5+ outfits, **lista de lugares específicos declarada por el usuario** (ver nota abajo) | Variable — un lugar icónico distinto por shot, sin ancla compartida |
| "3 ideas de vestido para invitada a boda" / "outfits tendencia 2026" (recomendación organizada por categoría, no sobre la vida del usuario) | `outfit_multi_look` — intención `curated_ideas` | `@pia`, `@pia-body`, 3-5 outfits de la misma categoría/tema | Fijo o neutro, sin protagonismo de lugar |

**Cómo decidir entre intenciones de `outfit_multi_look` cuando no es obvio:** la pregunta clave es "¿de quién es el sujeto de la frase?". Si es "yo/mi vida" (mi semana, mi antes/ahora, mi viaje) → weekly/then_vs_now/trip_recap según si hay jerarquía (then_vs_now) o el fondo es protagonista (trip_recap) o no (weekly). Si es "el tema/categoría" (ideas para X, tendencias de Y) → `curated_ideas`. Si es un solo look pidiendo opinión → `rate_check`.

**Nota sobre `trip_recap` — los lugares los declara el usuario, el sistema no los adivina.** Ver sección 6ter para el detalle completo, pero en resumen: para ciudades no ultra-turísticas (todo lo que no sea Nueva York/París/Roma/Londres/Tokio y similares), el sistema no debe inventar qué es "icónico" — el riesgo de generar un lugar genérico o irreconocible es alto. El usuario debe listar los lugares específicos de su viaje en el brief; el sistema solo redacta la escena a partir de ese nombre.

**Template de brief mínimo que el usuario debería poder completar para cualquier intención de `outfit_multi_look`:**

```
Receta: outfit_multi_look
Intención: [weekly | then_vs_now | rate_check | trip_recap | curated_ideas]
Identidad: [@pia + @pia-body, o "generar identidad" si no hay avatar propio]
Outfits: [lista de Elements, en el orden en que deben aparecer]
Fondo: [si aplica — "generar uno nuevo" | "usar @imagenX existente" | "un lugar icónico distinto por shot: listar cuáles"]
Copy/tema declarado: [ej. "mi semana", "St. Tropez", "ideas para invitada a boda"]
```

Este template todavía no está implementado como formulario real en la app — hoy es el checklist mental/manual que se usa para armar el primer prompt de cada set en Higgsfield. Formalizarlo como input de UI queda pendiente de la Fase 8 (integración), no de esta fase de validación visual.

## 7. Qué falta

- Test B y C de `outfit_multi_look` (intenciones weekly y then_vs_now, ya con sets de prueba).
- Generar el 3er shot de `trip_recap` (rooftop noche, NY) y confirmar aprobación para cerrar el set de prueba.
- Generar un set de prueba dedicado para `rate_check` (1 solo look) — la única intención de las 4 sin ningún shot de prueba generado todavía.
- Validar `then_vs_now` con más de un par (3+ antes/ahora intercalados, mezclando categorías de prenda — jeans, vestidos, outfits completos) para confirmar que el diseño de lista abierta con campo `era` funciona igual de bien a mayor escala, no solo con 1 par.
- Decidir y validar si el overlay de texto va quemado en la imagen o se agrega en post-edición fuera de la generación.
- Formalizar en `03_photodump_recipe_architecture.md` sección 19 el bloque de "composición casual" del Finding 005 como parte del perfil `iphone_camera_roll` (o sub-perfil propio) — hoy solo vive como prompt suelto en este documento.
- Formalizar el contrato TS de esta receta (`05_outfit_multi_look.normalized.ts` o similar) — hoy solo existe como prompts validados manualmente, no como código. El contrato debería tener un campo de `intent` (weekly | then_vs_now | rate_check | trip_recap) que afecta metadata/copy y, solo en el caso de `trip_recap`, si el fondo es fijo o variable por shot.
