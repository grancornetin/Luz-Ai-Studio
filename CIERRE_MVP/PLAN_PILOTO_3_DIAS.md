# LUZ IA — PILOTO AUTOMÁTICO PARA JOYERÍA (plan de 3 días)

Fecha de creación: 14 oct 2026. Reemplaza a `PLAN_CIERRE_FINAL.md` (ese plan oculta Planner y Mis Marcas, que ahora son el centro del producto; sus tareas T2, T3, T6, T7 y T8 ya no aplican porque la app es privada).

Este documento es la fuente de verdad para el agente orquestador. Todo agente que trabaje en esto lo lee entero antes de tocar nada.

---

## 0. Qué estamos construyendo (una frase)

Una herramienta **privada** para una sola usuaria (la esposa del dueño), que vende joyería y accesorios, no tiene redes ni identidad de marca, y no sabe qué publicar. La app debe:

1. **Crear su identidad de marca** a partir de pocas respuestas por toque y fotos de sus productos.
2. **Entender el mercado** (estudio de competencia ya hecho por agentes, guardado dentro de la app como conocimiento).
3. **Decirle qué publicar cada día** con un calendario de arranque (no de "mantener presencia": ella parte de cero seguidores).
4. **Producir el contenido por ella**: imágenes (y video si el presupuesto lo permite) listas, con caption, hashtags y horario, sin que configure módulos.
5. **Costar cero para ella** hasta que se agoten los ~USD 300 de créditos de Google Cloud (3 meses), sin que un bug o un abuso queme el saldo.

Éxito = ella abre la app una vez al día, en menos de 5 minutos tiene el post de hoy listo para publicar, y el post representa fielmente su producto real.

## 1. Estado real del código (verificado el 14 oct 2026)

Ya existe y se reutiliza (no reescribir):

| Pieza | Dónde | Estado |
|---|---|---|
| Perfil de marca (CRUD, wizard 9 pasos, paleta, assets, resumen IA) | `src/modules/brandProfiles/`, `src/services/brandProfileService.ts`, `brandProfileAiService.ts` | Funciona, pero el wizard asume que la usuaria ya conoce su marca. No sirve para ella tal cual. |
| Planner v3: plan semanal con Gemini, tarjetas, cierre con captura de métricas, informe, historial | `src/modules/planner/v3/` | Funciona. Solo genera 1 semana, el playbook de moda es genérico, y "Crear ahora" manda a otro módulo para que ella configure. |
| Playbooks por rubro (texto editable) | `src/modules/planner/v3/playbooks.ts` (existe `moda`, sin joyería específica) | Se extiende. |
| Generación de imágenes (cola QStash + Redis + worker, Gemini 3.1 flash image vía Vertex) | `api/gemini/image.ts`, `image-worker.ts`, `src/services/imageApiService.ts` | Funciona. Es el motor a reutilizar de forma "headless". |
| Fotos de producto, Scene Clone, Studio Pro (UGC) | `src/modules/productGenerator/`, `sceneClone/`, `contentStudioPro/` | Funcionan con UI propia. Se usan como referencia de prompts y recetas, no como pantallas para ella. |
| Marco de pantallas móviles | `src/components/shared/flow` (FlowShell) | Regla del dueño: todo módulo nuevo se construye sobre esto. |
| Créditos y planes | `src/services/creditConfig.ts`, `userPlanStore.ts` | Existe plan `admin` con créditos ilimitados. |
| Backend Vertex con `@google/genai` | `api/gemini/*.ts` (usa `vertexai: true`) | Base para Veo. |

**No existe:** video (cero código de Veo en la app; solo menciones de texto), creación de identidad desde cero, catálogo con análisis automático, generación automática por tarea, control de gasto en dólares, conocimiento específico de joyería.

Archivos con cambios locales de OTRAS sesiones (NO tocar, NO incluir en commits): `*.bat`, `modules/motor-de-imagenes-corregido-v2/**`, `package.json`, `package-lock.json`, `PRODUCT.md` (sin trackear), `scripts/higgsfield-seedance-example.mjs`. Si hace falta una dependencia nueva, solo el orquestador toca `package.json`, en un único punto.

## 2. Decisiones ya tomadas (no reabrir)

1. **Privado.** Sin onboarding genérico, sin landing nueva, sin pricing, sin limpieza global de emojis. Solo lo que su flujo necesita. (Dentro de lo nuevo: sin emojis, íconos lucide-react.)
2. **Competencia:** el benchmark directo es Silene (silene.cl, @silenejoyas, ~102K seguidores). Pandora es solo referencia de *estándar visual*, no de estrategia (es una multinacional; no es comparable con una marca que parte de cero). Ojo: Silene tiene años de historia; ella parte de 0 seguidores. Por eso el estudio **debe incluir también 5-8 marcas chicas chilenas/LATAM (1K-30K seguidores)** que sean alcanzables.
3. **Calendario de arranque:** estamos a mediados de octubre. Navidad y los eventos de ofertas de fin de año están cerca (los agentes verifican fechas exactas de Cyber/Black Friday en Chile). El primer plan es un **calendario de lanzamiento de 6 semanas orientado a pre-Navidad**, no una semana suelta.
4. **Prioridades si el tiempo aprieta:** P0 identidad + catálogo + plan + imágenes automáticas + pantalla "Hoy" + control de gasto. P1 pre-generación de los próximos 3 días + control de fidelidad. P2 video. P3 Campaign/Meta Ads, publicar directo a Instagram, PWA/push (**fuera de alcance de estos 3 días**).
5. **Mockup/confirmación de flujo:** el dueño exige confirmar flujos antes de construir. Para no frenar 3 días: hay **una sola pausa humana** (Checkpoint de flujo, sección 6). Si no hay respuesta en 2 horas, se sigue con el flujo por defecto.
6. **Sin inventar nada:** no inventar métricas, testimonios, reseñas ni clientas. Las imágenes generadas deben ser fieles al producto real (tamaño, color, material). Una joya que "se ve mejor que en la realidad" produce reclamos y daña la marca.

## 3. Riesgos que pueden matar el proyecto (y cómo se atacan)

| # | Riesgo | Por qué importa | Ataque |
|---|---|---|---|
| R1 | **Fidelidad de joyas pequeñas**: la IA deforma, inventa o "mejora" cadenas, piedras, cierres | Si las imágenes no se parecen al producto, no se puede vender con ellas | **Spike de fidelidad el día 1, primeras 3 horas**, con fotos reales. Criterio de paso en sección 8. Si falla: receta "foto original intacta + solo fondo/escena" y tomas de mano/cuello/oreja recortadas, sin cara |
| R2 | **Instagram bloquea el scraping**: de @silenejoyas solo se ve el perfil (bio, seguidores, mezcla de formatos), no cada post | Sin datos por post, el estudio es teoría | Agentes agotan: sitio web, buscadores, Meta Ad Library (pública), TikTok público, bases de datos de analítica pública. Lo que no se pueda: **capturas o grabación de pantalla** subidas a `CIERRE_MVP/insumos/competencia/` y analizadas con Gemini visión/video. Es el único trabajo manual (10-15 min del dueño, no de ella) |
| R3 | **Presupuesto**: ~USD 300 / 90 días ≈ USD 3,3 por día. Un video de Veo puede costar varios dólares | Un bucle o una usuaria curiosa quema todo en horas | Libro de gasto en dólares (sección 5, W8) con tope diario y total, corte automático, alerta de presupuesto en Google Cloud |
| R4 | **Veo/“Omni” sin confirmar**: modelo exacto, regiones, cuotas, tiempo de generación y límites de funciones de Vercel | Video puede no entrar en 3 días | Spike de video el día 1. Si no se confirma, P2 queda **apagado por feature flag** y se entrega sin video. No es un fracaso del proyecto |
| R5 | **Constancia de ella** | Es el riesgo n.º 1 real y software no lo elimina | La pantalla "Hoy" debe resolverse en < 5 min, con el post ya generado. Sin decisiones, sin configuración |
| R6 | **Cuatro frentes en paralelo chocan en el repo** | Merges rotos, builds rotos | Worktrees por agente, contratos de tipos fijados el primer día, un solo merge ordenado por el orquestador (sección 7) |
| R7 | **Sin validación externa** | El dueño ya lo notó. No hay forma de saber si "vende" antes del lanzamiento | Se acepta. Se mitiga con el cierre semanal que ya existe (captura de métricas → informe) y con un documento de la semana 1 post-entrega (sección 10) |
| R8 | **Cumplimiento**: claims de producto ("plata 925"), derechos de imágenes de la competencia, etiquetado de contenido IA de Meta | Reclamos, bloqueo de cuenta | Reglas en sección 9 |

## 4. Producto: las 3 pantallas de ella

Ruta nueva `/mi-negocio` (modo privado). En este modo el menú muestra solo esto; el resto de módulos queda oculto, no borrado. Flag: `PRIVATE_PILOT_MODE` activado por uid o allowlist (no por variable global, para no romper otras cuentas).

**Pantalla 1 — Mi marca** (una sola vez, ~5 minutos)
- ≤ 6 preguntas, todas por toque, con opción preseleccionada: qué vende (aros, collares, anillos, pulseras, accesorios), material (plata 925, bañado, acero, otro), rango de precios, a quién se lo imagina (3 opciones + "no sé"), 3 imágenes de referencia que le gusten (cuadrícula de estilos), cómo quiere que suene (cálida / elegante / juvenil).
- Sube 5-10 fotos originales de productos (esto alimenta también el catálogo).
- La IA propone **3 identidades completas** (nombre de marca si no tiene, posicionamiento, voz, paleta, 3 pilares de contenido, bio de Instagram, 3 frases ancla). Ella elige una y puede editar nada o casi nada.
- Se guarda como `BrandProfile` en el servicio existente para que el Planner siga funcionando sin cambios de contrato.

**Pantalla 2 — Mi catálogo** (se va llenando)
- Sube fotos originales; la IA detecta tipo, material, color, sugiere nombre y precio (editable en un toque) y marca calidad de la foto ("más luz", "fondo desordenado").
- Los originales nunca se sobrescriben; los generados se guardan aparte.

**Pantalla 3 — Hoy** (la que usa todos los días)
- Muestra **el post de hoy**: 2-3 opciones de imagen (tarjetas verticales grandes, 3:5 o 4:5), caption listo, hashtags, hora sugerida, botón "Descargar y copiar texto", botón "Ya lo publiqué".
- Debajo: "Mañana" y "Pasado mañana" ya generados. Semana completa en un segundo plano visual.
- Cada post muestra en una línea por qué se eligió ("las fotos de detalle responden la duda de calidad").
- Cierre semanal: reutiliza el cierre de Planner v3 (captura de estadísticas → informe → siguiente semana aprende).

## 5. Frentes de trabajo (workstreams)

Cada frente lo lleva un agente (o un par). **Las salidas son archivos concretos.** "Listo cuando" es verificable.

### W0 — Cimientos y contratos (orquestador, primeras 2-3 h, bloquea al resto)
- Crear rama base y confirmar línea base: `npx tsc --noEmit` y `npm run build` anotando los errores que ya existían (para no culpar a nadie después).
- Crear `src/modules/piloto/types.ts` con los contratos compartidos (propuesta inicial, se ajusta en este paso y luego **queda congelado**; cambios solo vía orquestador):
  - `PilotSeed` (respuestas de la pantalla 1), `CatalogItem` (id, nombre, categoría, material, color, precioCLP?, fotos originales, etiquetas IA, calidad de foto), `RecipeId`, `GeneratedAsset` (id, taskId, recipeId, kind image|video, url, costoUSD, fidelityScore?, estado), `BudgetLedger` (periodo, gastadoUSD, topeDiarioUSD, topeTotalUSD, porTipo).
  - Extensión de `PlanTask`: `recipeId?`, `catalogItemIds?`, `assets?: GeneratedAsset[]`, `generationStatus`.
- Flag de modo privado + ruta `/mi-negocio` + enlace de menú condicional (no tocar el menú de las demás cuentas).
- Reglas de Firestore/Storage para las colecciones nuevas (`users/{uid}/catalog`, `users/{uid}/pilotAssets`, `users/{uid}/budgetLedger`).
- Crear `CIERRE_MVP/ESTADO.md` (tablero vivo) y `CIERRE_MVP/DECISIONES.md` (registro de decisiones y recortes).
- **Listo cuando:** rama compila, contratos publicados, ruta vacía accesible solo en modo privado, línea base documentada.

### W1 — Inteligencia de mercado (3-5 agentes de investigación en paralelo; arranca en minuto 0, no depende de W0)
Entregables en `CIERRE_MVP/investigacion/` (Markdown legible) **y** versión estructurada en `src/data/jewelry-market/` (JSON) que la app lee en tiempo de ejecución.

Sub-frentes (un agente cada uno):
1. **Silene — sitio**: estructura del catálogo, colecciones, rangos de precio en CLP, estilo fotográfico, tipos de toma por producto, textos de producto, política de envío, mensajes de confianza, packaging, cómo cierran la venta.
2. **Silene — Instagram/TikTok/Facebook**: lo que se pueda sin sesión (perfil, bio, formatos, frecuencia visible, tipo de contenido de clientas, ganchos de los reels) + Meta Ad Library (anuncios activos y formatos) + TikTok público. Todo lo que quede sin cubrir se lista en `huecos.md` para pedir capturas.
3. **Marcas chicas alcanzables**: encontrar y perfilar 5-8 marcas de joyería/accesorios chilenas o latinas con 1K-30K seguidores que crecieron con contenido orgánico. Qué publican, con qué frecuencia, qué formatos repiten.
4. **Cómo se vende joyería online (patrones transversales)**: dudas de compra (talla, material, alergias, tamaño real), formatos con más guardados, ángulos de foto, uso de manos/cuello/oreja, regalos por ocasión, estacionalidad en Chile (Navidad, Cyber, San Valentín, Día de la Madre, Día del Padre/hermanas/amigas, graduaciones). Verificar fechas exactas.
5. **Análisis de capturas/video** (se activa cuando existan insumos o si Higgsfield `video_analysis_create` / Gemini video funcionan con URLs públicas): extraer estructura de reels (gancho 0-2 s, planos, duración, texto en pantalla, CTA).

Reglas de evidencia: cada afirmación lleva etiqueta `OBSERVADO` (visto en una fuente, con URL y fecha), `INFERIDO` (deducido de lo observado) o `HIPÓTESIS` (conocimiento general sin comprobar). **Prohibido** inventar métricas o presentar hipótesis como hechos. Las cifras de seguidores/likes solo si están a la vista.

Salidas que alimentan la app:
- Nuevo playbook `joyeria` en `src/modules/planner/v3/playbooks.ts` (texto editable, mismo formato que los demás, con keywords de joyería priorizadas sobre `moda`).
- `src/data/jewelry-market/recipes.json`: catálogo de recetas de contenido (ver W5) con evidencia.
- `src/data/jewelry-market/calendar-chile.json`: eventos y fechas verificadas.
- `src/data/jewelry-market/copy-bank.json`: ganchos, estructuras de caption y CTA en español de Chile, sin copiar textos de la competencia.
- `src/data/jewelry-market/hashtags.json`: hashtags por categoría y tamaño.
- `CIERRE_MVP/investigacion/RESUMEN_EJECUTIVO.md` de una página: "los 7 patrones que mueven ventas en joyería online y cuáles aplican a quien parte de cero".
- **Listo cuando:** playbook cargado y probado en el generador de plan (el plan para joyería cita patrones del estudio), dossier de Silene + ≥5 marcas chicas, lista de huecos clara.

### W2 — Constructor de identidad "Mi marca" (1 agente de producto + front)
- Servicio `src/modules/piloto/identityService.ts`: toma `PilotSeed` + fotos y devuelve 3 propuestas completas (Gemini texto + visión vía `/api/gemini/content`), usando el conocimiento de W1 cuando exista (empezar con el playbook genérico y enchufar W1 al llegar).
- Mapea la propuesta elegida a `BrandProfile` con `brandProfileService` (reutilizar campos: `brandName`, `mainCategory`, `targetCustomer`, `positioning`, `voice`, `commercialRules`, `aiSummary`, paleta).
- Pantalla 1 sobre FlowShell, una pregunta por pantalla, toques, valores por defecto. Sin jerga.
- Validación: si el JSON de Gemini viene roto o incompleto, reintento y respaldo determinista (nunca pantalla en blanco).
- **Listo cuando:** de cero a marca guardada en ≤ 6 min con 6 toques + fotos; el `BrandProfile` guardado alimenta el Planner sin tocarlo.

### W3 — Catálogo (1 agente)
- Antes de crear nada: revisar el `saveProduct`/`products` que ya usa `ProductGeneratorModule`. Reutilizar si sirve; si no, `users/{uid}/catalog`.
- Análisis automático por foto (tipo, material probable, color, nombre sugerido, calidad de foto y consejo de mejora) con Gemini visión.
- Subida a Storage con originales inmutables. Compresión en cliente para móvil.
- Pantalla 2 sobre FlowShell.
- **Listo cuando:** 10 fotos reales subidas, etiquetadas, editables en un toque, visibles en el selector que usará W4/W5.

### W4 — Motor de estrategia (1 agente, sobre Planner v3)
- Extender `generateWeeklyPlan` para **calendario de lanzamiento de 6 semanas** (semana 1 detallada, 2-6 en esquema que se detalla al cerrar cada semana con datos reales). Meta nueva `PlanGoal`: `'start'` ("Arrancar de cero: primeras seguidoras y primeras ventas"); ajustar proporciones del embudo para ese caso.
- Inyectar: playbook `joyeria`, `recipes.json`, `calendar-chile.json`, `copy-bank.json`, catálogo real. Cada tarea elige `recipeId` y `catalogItemIds` reales (rotación, sin repetir producto/receta cercano, productos "ancla" y "nuevos").
- Eliminar la dependencia de "Crear ahora → otro módulo": el plan produce **un brief de generación** por tarea (receta + producto + escena + texto), no instrucciones para que ella configure.
- Validador de salida (esquema, fechas, receta existe, producto existe, caption sin palabras prohibidas, sin promesas de resultados) con reintento y relleno determinista.
- **Listo cuando:** plan de 6 semanas generado para la marca de prueba, todas las tareas de semana 1 tienen receta + producto real, y el validador pasa; 3 generaciones seguidas sin errores de formato.

### W5 — Fábrica de contenido headless (el frente más difícil; 1-2 agentes)
- `src/modules/piloto/contentFactory.ts`: dado una tarea (receta + producto + marca), arma los prompts y las referencias, encola en el flujo existente de imágenes (`imageApiService` → `api/gemini/image.ts`), consulta estado, guarda `GeneratedAsset` en la tarea.
- **Recetas iniciales para joyería** (hipótesis de partida; W1 las confirma o corrige con evidencia):
  1. Catálogo limpio (fondo neutro / piedra / seda).
  2. Detalle macro (brillo, textura, cierre).
  3. En el cuerpo recortado: mano, oreja, cuello, muñeca, **sin cara** (menor riesgo de rostro raro y no necesita avatar).
  4. Escala (mano o moneda al lado: responde "¿qué tan grande es?").
  5. Flatlay de regalo / packaging.
  6. Escena de estilo de vida (tocador, café, espejo).
  7. Carrusel educativo (cuidado de plata 925, cómo medir talla de anillo, cómo combinar).
  8. Story de venta con CTA.
- **Control de fidelidad** (obligatorio): tras cada imagen, comparación con la foto original usando Gemini visión (¿misma forma, nº de piedras/eslabones, color, proporciones?) con puntaje 0-100. Bajo umbral → 1 reintento con prompt reforzado → si falla, la tarea muestra la foto original mejorada (fondo/luz) en vez de una generación infiel. Nunca se entrega a ella una imagen que no pasó.
- **Pre-generación**: al abrir la semana o al marcar "publicado", generar en segundo plano hoy + 2 días siguientes. Idempotente (no regenerar lo ya generado), con reintentos y con tope de simultáneas.
- **Reembolso/consumo**: modo privado no descuenta créditos de la app; sí registra el gasto en dólares en el libro de W8.
- **Listo cuando:** con 5 productos reales, cada receta de la lista produce 2-3 opciones que pasan el umbral de fidelidad definido en la sección 8; la pre-generación deja listos 3 días sin intervención.

### W6 — Video (P2; 1 agente; apagado por flag hasta pasar el spike)
- **Spike primero (≤ 2 h)**: script local que llama a Veo en Vertex con las credenciales del proyecto y mide: modelo/ID vigente según la documentación oficial al día de hoy, región, tiempo de generación, costo por segundo, límites de duración, soporte de imagen→video e imágenes de referencia, soporte de audio. Anotar en `DECISIONES.md`. **Verificar qué es "Google Omni"**: no se asume nada; si no existe como API utilizable, se descarta y se registra.
- Si pasa: endpoint asíncrono con el mismo patrón de las imágenes (encolar en QStash, worker, estado en Redis, resultado en Storage) porque una función de Vercel no aguanta esperar el video completo. Revisar `maxDuration` de `vercel.json` para el worker nuevo.
- Recetas de video (hipótesis): loop de brillo/giro del producto (imagen→video), "me lo puse" en mano/cuello estilo creadora, y **réplica de estructura** de un anuncio de referencia: analizar el video con Gemini (plano a plano, ritmo, gancho) y regenerar **con nuestro producto y escenas propias**. No se copia el video, el texto, la música ni la persona de la marca analizada; se replica la estructura.
- Tope de gasto específico para video (por clip, por día y por semana) dentro del libro de W8; sin tope configurado no se habilita.
- **Listo cuando:** un clip de 6-8 s desde una foto real de producto, con costo registrado, visible en la tarea, o decisión documentada de no entregar video con el motivo.

### W7 — Experiencia móvil "Hoy" y navegación (1 agente de UI)
- Construir las 3 pantallas sobre `components/shared/flow` (FlowShell). Modo inmersivo, un título, barra de acción, listas estilo iOS, tarjetas verticales grandes.
- Estado vacío, cargando ("preparando tu semana", con el progreso real de pre-generación), error (mensaje humano + botón reintentar), sin conexión.
- Acciones: descargar imagen (móvil: guardar en galería), copiar texto, compartir. Marcar publicado. Saltar con otra sugerencia.
- Textos en español de Chile, tuteo, sin "IA/prompt/modelo". Sin emojis.
- Revisar en 375 px (iPhone SE), 390 px y tableta.
- **Listo cuando:** flujo completo de 0 a "Hoy" probado en emulación móvil, sin overflow horizontal, todos los botones ≥ 44 px.

### W8 — Acceso, costos y operación (1 agente, crítico para no quemar el saldo)
- **Acceso privado**: la cuenta de ella con plan sin límite de créditos de app (plan `admin` o un plan `private` nuevo con los mismos bypass; revisar todos los caminos que descuentan créditos y concurrencia para que el bypass no rompa `concurrencyRelease`). Registro cerrado o allowlist para que nadie más consuma el saldo.
- **Libro de gasto en USD** (`BudgetLedger`): cada llamada de imagen/video/texto suma su costo estimado con precios vigentes verificados en la documentación de Google Cloud (no de memoria). Topes: diario, semanal por tipo y total. Al llegar al 80 % avisa en pantalla de admin; al 100 % corta y la app muestra un mensaje amable.
- Reparto de referencia del saldo: ~70 % imágenes y texto, ~30 % video (ajustar con los costos reales del spike). Calcular cuántos posts/semana alcanza y dejarlo en `DECISIONES.md`.
- **Alerta de presupuesto en Google Cloud** (el dueño la activa; el agente deja la guía exacta de 5 pasos). Vigilar también cuotas de Vertex.
- Confirmar variables de entorno necesarias en producción (Vertex, Redis, QStash, Storage) y que ninguna llave quede en el cliente.
- Reglas de Firestore/Storage revisadas para las colecciones nuevas, con prueba de que otra cuenta no puede leer las de ella.
- Despliegue: `vercel deploy --prod` manual al final de cada día con cambios mergeados (el auto-deploy de GitHub no es confiable).

### W9 — QA adversarial y entrega (arranca el día 2, termina el día 3)
- Recorrido completo con una cuenta nueva y productos reales (los 5-10 del dueño): marca → catálogo → plan → hoy → publicado → cierre.
- Pruebas de fallo: Gemini devuelve JSON roto, la cola se cae, cuota agotada, tope de gasto alcanzado, foto borrosa, subida lenta en móvil, cierre de pestaña a mitad de generación (debe reanudarse).
- Revisión "abogado del diablo" de la salida final: ¿una persona que no programa puede usarla sola? ¿Hay algún camino que la deje sin saber qué hacer? ¿Algún texto con jerga?
- Auditoría de seguridad básica: llaves, reglas, endpoints sin autenticación.
- Documento de entrega de 1 página para ella (en lenguaje simple) y otro técnico para el dueño: qué hace cada pantalla, qué hacer si algo falla, cómo ver el gasto, cómo apagar el video.
- **Listo cuando:** lista de hallazgos con severidad, todos los P0 cerrados, los P1 cerrados o registrados como deuda con dueño.

## 6. Orden de ejecución y puertas (gates)

**Minuto 0 (en paralelo, un solo mensaje del orquestador):** lanzar W1 (todos los sub-agentes), W0, spike de fidelidad (parte de W5), spike de video (parte de W6).

**Puerta A — hora ~3 (decisión de rumbo, sin humano):**
- Fidelidad: pasa / pasa con recetas restringidas / no pasa. Se documenta y se ajusta el catálogo de recetas.
- Video: confirmado / apagado.
- Contratos congelados.

**Checkpoint de flujo (única pausa humana, hora ~4):** el orquestador entrega al dueño una página con el flujo de las 3 pantallas y la lista de bloqueos de la sección 11. Si no hay respuesta en 2 horas, se sigue con el flujo por defecto de la sección 4.

**Día 1 (tarde):** W2, W3, W5 esqueleto con el primer producto real, W7 estructura de pantallas, W8 acceso + libro de gasto. W1 entrega dossier v1 y playbook v1.
**Día 2:** W4 (con playbook y recetas reales), W5 completo + pre-generación + control de fidelidad, W6 si pasó el spike, W7 conectado a datos reales, W9 empieza pruebas.
**Día 3 (mañana):** integración completa y congelamiento de funciones (feature freeze a mediodía). **Tarde:** W9 cierra, corrección de P0, despliegue, entrega.

**Regla de recorte:** si a mediodía del día 2 algo P1/P2 no está encaminado, se recorta sin discutir y se anota en `DECISIONES.md`. Orden de recorte: video → pre-generación de 3 días (queda solo "hoy") → carrusel educativo → plan de 6 semanas (queda 1 semana detallada + calendario de eventos).

## 7. Cómo debe operar el orquestador

1. Leer este plan y `CIERRE_MVP/ESTADO.md`. Mantener `ESTADO.md` actualizado cada vez que un frente cambia de estado (tablero: frente, agente, estado, bloqueo, última verificación).
2. **Lanzar agentes en paralelo** (varias llamadas en un mismo mensaje) cuando los frentes son independientes. Cada agente arranca sin contexto: su brief incluye objetivo, por qué importa, contexto relevante de este documento, archivos exactos que puede tocar y que NO puede tocar, entregables y el "listo cuando".
3. **Un worktree y una rama por agente de código** (`piloto/w2-identidad`, `piloto/w5-fabrica`, etc.). Los agentes de investigación escriben solo en `CIERRE_MVP/investigacion/` y `src/data/jewelry-market/`.
4. Los agentes **no tocan** archivos fuera de su alcance ni los de la lista "otras sesiones" de la sección 1. Commits con solo sus archivos (nunca `git add .`).
5. El orquestador **verifica, no confía**: lee los diffs, corre `tsc` y `build`, prueba el flujo, y rechaza entregas que no cumplan el "listo cuando". El resumen de un agente describe lo que intentó, no necesariamente lo que hizo.
6. Merge a `main` en orden: W0 → W8 (acceso/gasto) → W3 → W2 → W4 → W5 → W7 → W6. Tras cada merge: `tsc` + `build`. Si falla, se revierte ese merge, no se deja roto.
7. Push a `main` tras cada merge verde. `vercel deploy --prod` manual al cierre de cada día.
8. Los costos de pruebas también salen del saldo de Google Cloud: los agentes usan el mínimo de generaciones necesarias, y el libro de W8 se activa **antes** de que W5/W6 hagan pruebas masivas.
9. Escalar al dueño **solo** por los bloqueos de la sección 11 o por una decisión irreversible (borrar datos, tocar producción con cuentas ajenas, gasto fuera de tope). Todo lo demás se decide con el default y se registra.
10. Al final de cada día, un reporte de 10 líneas al dueño: qué quedó hecho, qué quedó recortado, qué riesgo subió o bajó, qué necesita de él.

## 8. Criterios de aceptación globales

**Fidelidad (spike y final).** Con ≥ 5 productos reales y por cada receta: ≥ 2 de 3 opciones deben conservar forma, color, número de piedras/eslabones y proporción vs. la foto original, según el control automático **y** revisión visual del orquestador. Umbral de partida del control: 80/100, ajustable con evidencia. Ninguna imagen con elementos inventados (piedras extra, cierres distintos, inscripciones).

**Costo.** Costo medio real por post (imágenes + texto) calculado con precios verificados; proyección de cuántos posts/semana alcanza el saldo en 90 días, publicada en `DECISIONES.md`. Topes funcionando (se prueba forzando el tope).

**Tiempo de uso.** De abrir `/mi-negocio` a tener copiado el post de hoy: ≤ 5 minutos en un día normal, ≤ 1 minuto de espera de generación visible con progreso.

**Camino completo (prueba de aceptación).** Cuenta nueva → pantalla 1 (≤ 6 toques + fotos) → 3 identidades → elige una → catálogo con ≥ 5 productos → plan de arranque → "Hoy" con post listo (2-3 imágenes, caption, hashtags, hora) → "Ya lo publiqué" → mañana y pasado ya generados → cierre semanal con captura de estadísticas funciona.

**Robustez.** Con Gemini devolviendo JSON roto, la app se recupera sin pantalla en blanco. Con el tope de gasto alcanzado, muestra mensaje claro. Con la pestaña cerrada durante la generación, al volver el trabajo sigue o se reanuda.

**Móvil.** 375 px y 390 px sin scroll horizontal; botones ≥ 44 px; tarjetas verticales.

**Seguridad.** Otra cuenta no puede leer datos de ella; ninguna llave en el bundle del cliente; endpoints nuevos exigen autenticación.

## 9. Reglas transversales para todos los agentes

- Español de Chile, tuteo, sin jerga técnica en la interfaz. Nunca "IA", "prompt", "modelo" en textos para ella. Decir "avatar digital", no "modelo digital", en textos nuevos.
- Color de marca `#F72C5B`, negro/gris y blanco. Sin verde lima. Sin emojis en la UI (íconos lucide-react).
- Fotos y resultados en móvil en tarjetas verticales grandes (3:5 o 4:5), no cuadrículas densas.
- Nada de testimonios, reseñas, "clientas" ni métricas inventadas; ninguna imagen generada que se presente como foto de una clienta real.
- No copiar imágenes, textos, música ni personas de otras marcas. Se estudia la estructura, se crea contenido propio.
- Claims de producto (material, ley de la plata, hipoalergénico, garantía) solo los que ella confirme en `PilotSeed`/catálogo. Si no los dio, el texto no los afirma.
- Contenido generado con IA: el plan incluye recordatorio de usar la etiqueta de contenido con IA de Meta cuando corresponda; revisar la política vigente.
- Reglas generales, no parches: si un prompt falla con un caso, buscar el principio reutilizable (regla dura o criterio contextual), no fijar el caso exacto.
- Simplicidad: por defecto el camino más corto de brief a resultado. No agregar proyectos, recetas, evaluaciones o paneles que el flujo de ella no necesite.
- Una cosa que no se sabe se verifica (documentación oficial, prueba real), no se asume. Registrar qué se verificó y cuándo.

## 10. Después de la entrega (no es trabajo de estos 3 días, pero se deja listo)

- Documento de seguimiento de la semana 1: qué mirar (publicó X de Y posts, alcance, guardados, mensajes, primeras ventas), cuándo revisar (día 7 y día 14) y qué decisiones tomar según resultado.
- `scripts/competitor-study/`: comando re-ejecutable que toma capturas o videos de una carpeta y actualiza el dossier con Gemini, para refrescar el estudio sin reescribir nada.
- Lista de P3 pendiente: publicar directo a Instagram, anuncios (Campaign / Meta Ads) cuando haya cuentas y volumen, avisos diarios (PWA/WhatsApp), multiusuaria.

## 11. Lo que SÍ necesita del dueño (lista completa de bloqueos)

| # | Qué | Para qué | Si no llega |
|---|---|---|---|
| U1 | 5-10 fotos originales de productos reales de ella, nombre de marca (si ya tiene), rango de precios, material de cada pieza | Prueba de fidelidad e identidad con datos reales | Se avanza con fotos de prueba, pero el criterio de fidelidad queda sin validar: se declara como riesgo abierto |
| U2 | 15-30 capturas o una grabación de pantalla del feed de @silenejoyas (y 2-3 marcas más) en `CIERRE_MVP/insumos/competencia/`. Solo si los agentes marcan huecos en `huecos.md` | Análisis por post: formatos, ganchos, ritmo | El estudio queda a nivel de perfil y sitio web; se declara |
| U3 | Activar alerta de presupuesto en Google Cloud y confirmar acceso/cuota a Veo en el proyecto | Seguridad del saldo y video | Video apagado |
| U4 | `uid` de la cuenta de ella una vez registrada | Activar modo privado y plan sin límite | Se prueba con la cuenta del dueño |
| U5 | Respuesta al checkpoint de flujo (opcional, 2 h) | Confirmar flujo | Se sigue con el flujo por defecto |

## 12. Definición de "cerrado"

El proyecto está cerrado cuando: se cumple el camino completo de la sección 8 en producción, el libro de gasto corta en el tope, la documentación de entrega está escrita, `DECISIONES.md` lista lo recortado con su motivo, y el dueño recibió un reporte final de una página con: qué funciona, qué no, qué riesgos quedan y qué mirar la primera semana. Nada más.
