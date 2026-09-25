# LUZ IA STUDIO — Roadmap de validación y plan de ejecución
**Creado: 25 sep 2026 · Estado del negocio: NO lanzado, cero usuarias externas**

Este documento es la fuente de verdad de qué se hace ahora y en qué orden. Lo usan dos tipos de lectores:
- **El dueño (Nico)**: hace las tareas marcadas `TÚ` (hablar con personas, decidir, sacar fotos).
- **Cualquier agente de Claude**: hace las tareas marcadas `AGENTE`, una por sesión, siguiendo las reglas de abajo.

---

## 0. POR QUÉ EXISTE ESTE PLAN (leer primero)

Una revisión crítica del negocio (25 sep 2026) concluyó:

1. **Riesgo que puede matar el negocio:** no está demostrado que Luz IA le gane *de forma visible* a lo que la clienta ya tiene gratis (ChatGPT, Gemini, Photoroom, las herramientas de IA dentro de Meta Ads). Si no gana, nadie paga.
2. Se construyeron 11 módulos durante meses sin que ninguna persona externa los probara.
3. Precios con dos monedas (créditos + "sesiones Pro") y datos que no coinciden entre documentos.
4. Promesas de marca que contradicen sus propias reglas ("$500" vs. "números reales siempre").

**Objetivo del plan:** averiguar lo antes y lo más barato posible si alguien quiere esto y pagaría por ello, *antes* de construir más o gastar en ads.

**Principio:** cada fase termina en una **COMPUERTA** (una decisión con números). No se pasa a la fase siguiente sin cumplirla. Si la compuerta falla, se sigue la instrucción de "si falla", no se construye más por encima.

---

## 1. REGLAS PARA CUALQUIER AGENTE (no negociables)

1. **Lee este archivo completo antes de hacer nada.** Después mira la tabla de estado (sección 2) y toma **solo** la tarea que el dueño te pidió, o la siguiente `AGENTE` pendiente cuya dependencia esté cumplida.
2. **Congelamiento de funciones nuevas.** Hasta pasar la Compuerta 3, está prohibido crear módulos, recetas, entrenadores, bancos de poses o mejoras visuales que no estén en este plan. Si el dueño pide algo así, recuérdale este congelamiento una vez, con una frase, y haz lo que él decida.
3. **Antes de tocar código de la app, muestra el cambio en palabras simples (o un mockup) y espera el OK del dueño.** Las tareas de análisis y documentos no necesitan OK previo.
4. **Habla sin jerga técnica.** El dueño no programa. Explica con ejemplos concretos.
5. **Commits:** incluye solo los archivos que tú modificaste; no toques archivos que cambiaron otras sesiones. Commit + push a `main`. Si cambiaste código de la app, corre `vercel deploy --prod` después del push.
6. **Al terminar una tarea:** actualiza su fila en la tabla de estado (sección 2), con la fecha y un link al resultado. Ese es el registro de avance.
7. **No inventes datos.** Si una tarea necesita un número que no existe (costos, respuestas de usuarias), escribe "PENDIENTE: falta X" en lugar de estimarlo como si fuera real.

---

## 2. TABLA DE ESTADO

| ID | Tarea | Quién | Depende de | Estado | Resultado |
|---|---|---|---|---|---|
| F0 | Congelar funciones nuevas | TÚ | — | ⬜ | |
| A1 | Calcular costo real por imagen y por sesión | AGENTE | — | ⬜ | |
| A2 | Armar el kit de la prueba a ciegas | AGENTE | — | ⬜ | |
| T1 | Elegir 5 productos y sacarles fotos con el celular | TÚ | — | ⬜ | |
| T2 | Crear las fotos con Luz IA y con ChatGPT/Gemini | TÚ (+AGENTE guía) | A2, T1 | ⬜ | |
| A3 | Armar los pares a ciegas A/B | AGENTE | T2 | ⬜ | |
| T3 | Mostrar los pares a 10 emprendedoras | TÚ | A3 | ⬜ | |
| A4 | Analizar resultados → **COMPUERTA 1** | AGENTE + TÚ | T3 | ⬜ | |
| A5 | "Puerta única" para usuarias nuevas (modo beta simple) | AGENTE | Compuerta 1 ✅ | ⬜ | |
| A6 | Medición: primera imagen, regreso, abandono | AGENTE | Compuerta 1 ✅ | ⬜ | |
| A7 | Pregunta de 1 clic después de cada resultado | AGENTE | Compuerta 1 ✅ | ⬜ | |
| A8 | Guion de entrevista + mensajes de invitación beta | AGENTE | Compuerta 1 ✅ | ⬜ | |
| T4 | Invitar a 10 beta testers y observar 2 semanas | TÚ | A5–A8 | ⬜ | |
| A9 | Reporte de la beta → **COMPUERTA 2** | AGENTE + TÚ | T4 | ⬜ | |
| A10 | Propuesta de precios simplificada | AGENTE | A1, Compuerta 2 ✅ | ⬜ | |
| A11 | Implementar precios aprobados + acceso fundadora | AGENTE | A10 aprobado | ⬜ | |
| T5 | Ofrecer acceso de fundadora pagado → **COMPUERTA 3** | TÚ | A11 | ⬜ | |
| A12 | Limpieza de documentos de marca | AGENTE | — (se puede hacer cuando sea) | ⬜ | |
| A13 | Preparar el lanzamiento suave | AGENTE + TÚ | Compuerta 3 ✅ | ⬜ | |

Leyenda: ⬜ pendiente · 🟨 en curso · ✅ hecho · ❌ falló (ver nota)

---

## 3. ROADMAP (vista general)

| Fase | Semanas | Pregunta que responde | Compuerta |
|---|---|---|---|
| **1. Prueba a ciegas** | 1–2 | ¿Nuestro resultado le gana a la IA gratis? | ≥7 de 10 eligen Luz IA |
| **2. Beta cerrada** | 3–5 | ¿Una persona real la usa sin ayuda y vuelve? | ≥5/10 crean sola su primera imagen y ≥3/10 vuelven otro día |
| **3. Pre-venta de fundadoras** | 5–6 | ¿Alguien paga? | ≥3 personas pagan acceso de fundadora |
| **4. Lanzamiento suave** | 7–10 | ¿Instagram trae usuarias a un costo razonable? | Se define en A13 con los datos de las fases 1–3 |

En paralelo y sin bloquear nada: A1 (costos) y A12 (limpieza de documentos).

---

## 4. FASE 1 — PRUEBA A CIEGAS (semanas 1–2)

### F0 · Congelar funciones nuevas — `TÚ`
Decisión personal: hasta la Compuerta 3 no se construye nada que no esté en este plan. Los entrenadores de Photodump y Campaign, la pose-library y el director quedan pausados donde están (no se borran).

---

### A1 · Calcular el costo real por imagen y por sesión — `AGENTE`
**Por qué:** hoy los precios se fijaron sin saber cuánto le cuesta a Luz IA cada sesión real. Sin ese dato no se puede decidir precio.

**Contexto:**
- Precios y créditos: `src/services/creditConfig.ts` (1 crédito = $0,10 USD; imagen Gemini = 2 créditos; los planes y la segunda moneda "pro-credits" están ahí).
- Modelos: imagen `gemini-3.1-flash-image` (global), texto `gemini-2.5-flash` (us-central1).
- Módulos y rutas: `src/App.tsx` líneas ~430–457.

**Pasos:**
1. Para cada módulo (Product Studio `/productos`, UGC `/studio-pro`, Campaign `/campaign`, Photodump `/photodump`, Outfit Extractor, Scene Clone `/clonar`, Model DNA `/crear/clonar`, Planner), recorre el código de la llamada a la IA y cuenta **todas** las llamadas por sesión típica: análisis de texto, planificación, imágenes, reintentos automáticos, verificaciones.
2. Busca el precio oficial vigente por imagen y por token de esos modelos en la página de precios de Vertex AI / Gemini API. **Cita la fuente y la fecha.** Si no puedes acceder, deja "PENDIENTE: precio oficial".
3. Calcula para cada módulo: costo para Luz IA por sesión, créditos que se cobran, ingreso por sesión con el precio por crédito de cada plan (Starter: $14,99 / 200 cr = $0,075 por crédito, etc.) y margen.
4. Calcula el "peor caso" de cada plan: la usuaria gasta todos sus créditos y sesiones Pro en el módulo más caro, con un 30 % de reintentos.

**Entregable:** `PLAN_VALIDACION/A1_costos_reales.md` con una tabla por módulo y por plan, más un resumen de 5 líneas en lenguaje simple: "qué planes pierden plata, cuáles ganan".

**Listo cuando:** cada número tiene fuente (una línea de código o una página de precios) o está marcado PENDIENTE.

---

### A2 · Kit de la prueba a ciegas — `AGENTE`
**Por qué:** es la prueba más importante del plan. Tiene que ser justa; si no, engaña.

**Entregable:** `PLAN_VALIDACION/A2_kit_prueba_ciegas.md` con:
1. **Criterios para elegir los 5 productos** (uno por categoría: ropa, skincare/cosmética, vela u hogar, accesorio o joya, uno libre). Deben ser productos reales de emprendedoras (idealmente de conocidas), no productos de marcas grandes.
2. **Cómo sacar la foto "antes"**: celular, luz de ventana, fondo de cartón o mesa. Igual que lo haría Sofi.
3. **Qué hacer en Luz IA:** módulo Product Studio con los ajustes por defecto, sin retoques del dueño ni elegir "la mejor de 10". Se toma la primera tanda completa.
4. **Qué hacer en la herramienta gratis (ChatGPT y/o Gemini, versión gratuita):** el mensaje exacto en español simple que escribiría una emprendedora sin experiencia, por ejemplo: *"Mejora esta foto de mi producto para vender en Instagram, que se vea profesional"*. **Un solo intento**, sin afinar el mensaje. (Justo: Sofi tampoco sabe afinar mensajes.)
5. **Las preguntas a las 10 emprendedoras**, en este orden, sin decir cuál es de quién:
   - "¿Cuál publicarías en tu tienda, la A o la B?"
   - "¿Por qué?" (anotar la respuesta textual)
   - "¿Alguna te parece que no es el mismo producto?" (fidelidad)
   - Solo al final, revelar y preguntar: "Si una app te diera la que elegiste, ¿cuánto pagarías al mes?" (anotar la cifra textual)
6. **Mensaje para reclutar** por WhatsApp o Instagram (tono de la guía de voz, 3–4 líneas, sin vender la app).
7. **Planilla de respuestas:** columnas persona, rubro, producto, par, eligió A/B, por qué, fidelidad, cuánto pagaría.

---

### T1 · 5 productos + fotos con celular — `TÚ`
Consigue 5 productos reales siguiendo A2 y sácales las fotos "antes". Guárdalas en `PLAN_VALIDACION/prueba_ciegas/01_antes/` con nombres como `vela_antes_1.jpg`.

### T2 · Crear las fotos con ambas herramientas — `TÚ` (un agente te puede guiar paso a paso)
Sigue A2 al pie de la letra. Guarda en `PLAN_VALIDACION/prueba_ciegas/02_luzia/` y `.../03_gratis/`.

### A3 · Armar los pares A/B — `AGENTE`
1. Para cada producto, crea un par con la mejor foto *comparable* de cada herramienta (mismo tipo de toma; si Luz IA dio catálogo y ChatGPT dio lifestyle, anotarlo).
2. **Sortea** qué lado es A y cuál B en cada par (que no sea siempre el mismo lado).
3. Genera imágenes lado a lado, listas para mandar por WhatsApp, en `PLAN_VALIDACION/prueba_ciegas/04_pares/` (`par_1.jpg`...).
4. Guarda la clave de qué es qué en `.../clave_SECRETA.md`. **No se muestra a las evaluadoras.**

### T3 · Mostrar los pares a 10 emprendedoras — `TÚ`
Idealmente no amigas cercanas (grupos de emprendedoras, ferias, Instagram). Cara a cara o por WhatsApp. Anota todo en la planilla de A2. **No expliques ni defiendas nada mientras eligen.**

### A4 · Analizar resultados → COMPUERTA 1 — `AGENTE` + decisión `TÚ`
El agente cuenta los votos por par y por persona, resume los "por qué" en temas y lista las cifras de "cuánto pagarías".

**Entregable:** `PLAN_VALIDACION/A4_resultado_prueba_ciegas.md`

> ### 🚦 COMPUERTA 1
> - **✅ Pasa:** ≥7 de 10 personas eligen Luz IA en la mayoría de sus pares **y** nadie dice que el producto cambió. → Fase 2.
> - **🟨 Zona gris (4–6 de 10):** mirar **en qué categoría o tipo de foto sí gana** (por ejemplo, solo en series coherentes o solo en ropa con modelo). La fase 2 se hace **solo con eso**, el resto queda escondido.
> - **❌ Falla (≤3 de 10), o el producto sale alterado:** no se construye más. El agente escribe un análisis de qué ganó la herramienta gratis y por qué, y 2–3 opciones de pivote (por ejemplo, servicio hecho a mano para marcas, especializarse en una sola categoría, o vender la consistencia de series). Decide el dueño.

---

## 5. FASE 2 — BETA CERRADA (semanas 3–5)

**Solo si la Compuerta 1 pasó.** Se prueba con lo que ganó en la Fase 1, no con los 11 módulos.

### A5 · "Puerta única" para usuarias nuevas — `AGENTE` (requiere OK previo del dueño)
**Por qué:** Sofi no puede entrar a un menú de 11 módulos. Tiene que ver una sola acción.

**Qué hacer:**
1. Proponer al dueño (en palabras o con un mockup) cómo se ve la entrada: al registrarse, una sola pantalla del tipo "Sube 1 a 4 fotos de tu producto → te devolvemos tus fotos". El módulo que ganó en la Fase 1 queda como puerta.
2. Con el OK, implementar un **modo beta simple** con un interruptor por usuaria (campo en su perfil de Firestore, por ejemplo `betaSimpleMode: true`). Con el interruptor encendido, el menú muestra solo el módulo ganador + historial + cuenta. Los demás módulos **no se borran**, solo se esconden para esas usuarias.
3. El admin (el dueño) debe poder seguir viendo todo.
4. Probar en el navegador en ancho de celular (es donde está Sofi) antes de dar por terminado.

**Listo cuando:** una cuenta nueva con el interruptor encendido llega a su primera imagen sin ver ningún otro módulo.

### A6 · Medición mínima — `AGENTE` (requiere OK previo)
Registrar, por usuaria beta: fecha de registro, fecha de la primera imagen creada (o "nunca"), cantidad de días distintos en que volvió, en qué pantalla abandonó (la última que vio sin crear nada). Usar lo que ya exista en Firestore (historial de generaciones) antes de agregar algo nuevo. **Cuidado con las lecturas de Firestore:** hubo un problema reciente por exceso de lecturas; nada de escuchas en tiempo real para esto. Entregable adicional: un script o una vista de admin que muestre la tabla.

### A7 · Pregunta de 1 clic después de cada resultado — `AGENTE` (requiere OK previo)
Debajo del resultado: "¿Publicarías esta foto en tu tienda?" → **Sí / Con cambios / No**. Se guarda junto a la generación. Nada más (sin formularios largos).

### A8 · Guion de entrevista + mensajes de invitación — `AGENTE`
**Entregable:** `PLAN_VALIDACION/A8_beta_guiones.md` con:
- Mensaje de invitación (priorizar a las que participaron en la Fase 1 y dijeron que pagarían).
- Qué decirles al darles acceso: "úsala como si fuera tuya, no te voy a explicar nada, eso es parte de la prueba".
- Guion de entrevista de 15 minutos a los 7 días, con preguntas sobre hechos pasados, no hipotéticas: "¿Publicaste alguna foto? ¿Cuál? ¿Qué pasó?", "¿Qué hiciste la última vez que necesitabas fotos?", "¿Qué te frustró?". Sin preguntas que empujen la respuesta.
- Cómo ofrecer los créditos extra de beta (el admin los carga a mano).

### T4 · 10 beta testers durante 2 semanas — `TÚ`
Invita, carga créditos, **no ayudes** salvo que se trabe del todo (y anota dónde se trabó). Entrevista a cada una a los 7 días.

### A9 · Reporte de la beta → COMPUERTA 2 — `AGENTE` + decisión `TÚ`
**Entregable:** `PLAN_VALIDACION/A9_reporte_beta.md`: tabla por usuaria (datos de A6 + votos de A7 + resumen de la entrevista), los 3 problemas más repetidos y las frases textuales más útiles para marketing (con permiso).

> ### 🚦 COMPUERTA 2
> - **✅ Pasa:** ≥5 de 10 crearon su primera imagen **sin ayuda**, ≥3 volvieron otro día, y ≥40 % de los votos de A7 son "Sí, la publicaría". → Fase 3.
> - **🟨 Zona gris:** si crean pero no vuelven → el problema es el valor o el hábito, entrevistar de nuevo. Si no llegan a crear → el problema es la entrada, arreglar solo eso (A5) y repetir con 5 personas nuevas.
> - **❌ Falla:** mismo camino que el "falla" de la Compuerta 1.

---

## 6. FASE 3 — PRE-VENTA DE FUNDADORAS (semanas 5–6)

### A10 · Propuesta de precios simplificada — `AGENTE` (solo propuesta, no se implementa sin OK)
**Datos de entrada:** A1 (costos), A4 (cuánto dijeron que pagarían), A9 (uso real).

**Reglas para la propuesta:**
- **Una sola moneda.** Eliminar los "pro-credits / sesiones Pro" como moneda separada (hoy: `PRO_CREDIT_COSTS`, `PLAN_PRO_CREDITS`, `PRO_CREDIT_TOPUPS` en `creditConfig.ts`). Si Campaign o Photodump cuestan más, que cobren más créditos, no otra moneda.
- **Máximo 3 opciones visibles** (por ejemplo: Gratis, un plan principal y un plan de volumen).
- El plan principal tiene que estar cerca de lo que dijeron que pagarían en A4.
- El peor caso de cada plan debe dejar ≥50 % de margen según A1.
- El pago por semana solo existe si sale más barato por semana que el mensual, o se reemplaza por un "pase de prueba" de un solo pago.
- Revisar si Dodo Payments (el procesador actual, ver `src/services/checkoutService.ts`) acepta cobrar en CLP y medios de pago locales de Chile. Si no, anotarlo como riesgo, sin cambiar de procesador en esta fase.

**Entregable:** `PLAN_VALIDACION/A10_propuesta_precios.md` con la tabla actual contra la propuesta y el margen de cada plan.

### A11 · Implementar precios aprobados + acceso de fundadora — `AGENTE` (con OK)
1. Aplicar la propuesta aprobada en `src/services/creditConfig.ts`, `src/views/Pricing.tsx`, `src/views/BuyCredits.tsx` y `src/views/Landing.tsx`.
2. Crear en Dodo Payments (lo hace el dueño; el agente le da los pasos) un producto "Acceso fundadora": un pago único bajo (sugerencia: $5 USD) que da el primer mes del plan principal + un precio congelado mientras siga suscrita. Número de cupos limitado y real.
3. Probar el flujo de compra de punta a punta en modo prueba antes de mostrarlo a nadie.

### T5 · Ofrecer el acceso de fundadora → COMPUERTA 3 — `TÚ`
Ofrécelo **solo** a las beta testers y a quienes participaron en la Fase 1. Uno por uno, por DM.

> ### 🚦 COMPUERTA 3
> - **✅ Pasa:** ≥3 personas **pagan** (no "sí, me interesa": pagan). → Se levanta el congelamiento de funciones y se pasa a la Fase 4.
> - **❌ Falla:** preguntar a cada una que dijo que no: "¿qué tendría que tener para que pagaras hoy?". Con eso, decidir entre ajustar el precio, ajustar el producto o pivotar.

---

## 7. FASE 4 — LANZAMIENTO SUAVE (semanas 7–10)

### A13 · Preparar el lanzamiento — `AGENTE` + `TÚ`
Usar `IDENTIDAD_DE_MARCA/BASE_OPERATIVA_CONTENIDO_LANZAMIENTO_LUZ_IA.md` como base, pero **reemplazando todo lo supuesto por lo real de las fases 1–3**:
- Los antes/después salen de la prueba a ciegas y de la beta (con permiso).
- Los testimonios son de las fundadoras.
- La promesa principal es **lo que ganó en la Fase 1**, con las palabras que usaron las usuarias.
- Los 9 posts iniciales se reescriben solo con el módulo o los módulos visibles.
- Ads: recién después de 4 semanas de contenido orgánico, con $5 USD/día, y solo si el plan elegido deja margen según A1. Definir en A13 el costo máximo aceptable por usuaria que paga (a partir de A1 y el precio de A10).
- Ritmo de contenido realista para una persona sola: **3 reels + 2 carruseles por semana** (no 1 reel diario), y hacer las stories por tandas.

---

## 8. TAREA PARALELA

### A12 · Limpieza de documentos de marca — `AGENTE`
Se puede hacer en cualquier momento. Editar los 4 archivos de `IDENTIDAD_DE_MARCA/`:
1. Eliminar "Lo que antes costaba $500. Ahora cuesta $15." (contradice "números reales siempre" y el dato de que una sesión cuesta $30.000–$80.000 CLP). Reemplazar por una comparación con cifras reales en CLP.
2. Plan Studio: dejar un solo número de créditos (el de `creditConfig.ts`: 1200); hoy el buyer persona dice 1500.
3. Quitar el verde lima `#E4F1AC` de la paleta (fue descartado). Paleta: fucsia `#F72C5B` + negro/gris + blanco. Revisar el highlight "PLANES" que lo usa.
4. Ganchos #15 y #16 ("tus fotos no venden") contradicen la regla "nunca atacamos lo que ella hace". Reescribirlos.
5. Gancho #3 ("mi fotógrafo no sabe que existo") contradice "no reemplazamos al fotógrafo". Reescribirlo.
6. Wordmark "LUZ AI Studio" vs. nombre "Luz IA": dejar anotada la inconsistencia para que decida el dueño (no cambiar el logo).
7. Respuesta a la objeción "¿se nota que es IA?": quitar "se ve como una sesión real" y reencuadrar hacia "tu producto real, bien mostrado". Agregar una nota de que las fotos con modelo de IA no deben mostrar un calce o un color que el producto real no tiene.
8. Dejar en cada documento una línea "Pendiente de actualizar con datos de validación (ver PLAN_VALIDACION/)" en la sección de precios y de planes.

No cambiar precios en los documentos hasta A10.

---

## 9. LO QUE NO SE HACE EN ESTE PLAN

- No se construyen módulos nuevos ni se mejoran los existentes (salvo A5–A7 y A11).
- No se gasta en ads antes de la Compuerta 3.
- No se abre Instagram público antes de la Compuerta 3. (Sí se puede reservar el nombre de usuario.)
- No se publica en App Store / Google Play en este plan.
- No se borra ningún módulo: solo se esconde.
