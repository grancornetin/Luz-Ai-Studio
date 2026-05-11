# Publicar Studio — Guía del Módulo

> **REGLAS DE MANTENIMIENTO PARA IA:**
> 1. Este archivo debe mantenerse actualizado con el estado real del módulo.
> 2. Cada vez que se agregue, modifique o elimine un feature relevante, actualizar la sección correspondiente.
> 3. Actualizar la fecha de "Última actualización" con cada cambio.
> 4. No borrar secciones — si algo fue eliminado, marcarlo como "Eliminado en [fecha]" y explicar por qué.
> 5. El objetivo es que otra IA pueda leer este archivo y entender completamente qué hace el módulo, cómo funciona, y en qué estado está, sin necesidad de leer el código.

**Última actualización:** Mayo 2026 (creación inicial)  
**Propósito:** Planificador de contenido social para emprendedoras LATAM. Responde al problema: "Ya tengo las fotos — ¿qué hago con ellas? ¿cuándo publico? ¿qué escribo? ¿por qué nadie interactúa?"

---

## Qué hace este módulo

Publicar Studio **no genera imágenes**. Es el "orquestador de contenido" que se sienta encima de todos los módulos de generación existentes. Entrega:

- Un **copiloto elevado** con memoria del proyecto, análisis de producto por imagen, y generación de planes concretos
- Un **Remix Engine** que genera 15-25 ideas de posts distintos a partir de poco texto o pocas fotos de un mismo producto
- Un **calendario semanal visual** con navegación por semanas, estados por día (pendiente / listo / saltado) y racha de publicaciones
- **Captions listos para copiar** en Instagram, TikTok y tienda online, con hashtags
- Un **plan de tareas (checklist)** con acceso directo a cada módulo de generación

---

## Por qué existe como módulo separado (y no dentro de Proyectos)

El workspace `/projects/:id` ya tenía el `ProjectCopilot` embebido, pero era una herramienta secundaria dentro del espacio de trabajo. El dolor de las emprendedoras es la gestión de contenido, no la gestión de archivos. Publicar Studio da a ese copiloto su propio espacio central, con:

- Acceso desde el menú principal (no hay que entrar a "Proyectos" primero)
- Interfaz pensada para planificar, no para administrar archivos
- El Remix Engine como feature propio, sin depender de la conversación
- Una vista de calendario semanal como pantalla de primer nivel

---

## Flujo completo para el usuario

### Paso 1 — Elegir o crear un proyecto
Al entrar al módulo, la emprendedora ve sus proyectos existentes (los mismos de `/projects`) y puede seleccionar uno o crear uno nuevo. El proyecto conecta el copiloto con las imágenes que ya generó.

### Paso 2 — Hablar con el Copiloto (tab "Copiloto")
El copiloto hace las preguntas necesarias: ¿qué vendés? ¿cuántas veces por semana querés publicar? ¿cuál es tu plataforma principal? Una vez que tiene suficiente contexto, puede:

- Generar un **calendario semanal** de 5-14 días con tipo de contenido + módulo sugerido + horario óptimo
- Armar un **plan de tareas** (checklist) para ejecutar
- Generar **captions completos** por plataforma
- Dar **25 ideas de posts** distintos para el mismo producto (Remix Engine)
- Navegar directamente a cualquiera de los 6 módulos de generación

La usuaria también puede adjuntar una imagen de su producto y el copiloto la analiza para dar sugerencias específicas.

### Paso 3 — Ver el calendario (tab "Calendario")
Una vez que el copiloto generó un calendario, la emprendedora puede:
- Ver semana a semana con navegación ←/→
- Ver los puntos de color por día (verde = listo, rojo = pendiente)
- Para cada entrada: marcarla como lista, saltarla, o ir directo al módulo de generación
- Ver su racha de días consecutivos publicados
- Gestionar el checklist de tareas desde la misma pantalla

### Paso 4 — Explorar las ideas de Remix (tab "Remix")
Cuando el copiloto generó ideas de posts, aparece este tab con la grilla completa:
- Filtros por módulo (UGC, Photodump, Campaign, etc.)
- Ideas agrupadas por tipo de post (Behind the scenes, Lifestyle, Detalle, Testimonio...)
- Cada idea tiene: gancho de caption, descripción de qué decir, qué imagen necesita, y botón "Generar" que lleva al módulo correspondiente

---

## Archivos del módulo

### `ContentPlannerModule.tsx`
El componente raíz. Orquesta los tres tabs, el selector de proyecto, el sidebar de estadísticas y el estado global del módulo.

**Qué contiene:**
- El `ProjectSelector` (inline): crea proyectos nuevos o elige uno existente
- Las estadísticas rápidas del plan activo (días planificados, completados, pendientes, ideas de remix)
- Los tres tabs con badges que muestran cuántos elementos tiene cada uno
- Los callbacks que conectan el copiloto con el calendario y la grilla de remix
- La navegación a otros módulos de generación (vía `useNavigate`)

### `ContentPlannerCopilot.tsx`
El copiloto elevado. Extiende la lógica del `ProjectCopilot` original con capacidades nuevas.

**Diferencias con el ProjectCopilot original:**
- Responde a un nuevo bloque especial `[REMIX]` además de `[CAPTIONS]`, `[CHECKLIST]`, `[CALENDAR]`, `[ACCIONES]`
- Conoce 6 módulos de navegación (Campaign, Photodump, UGC, Product Studio, Scene Clone, Outfit Extractor) — el original solo tenía 3
- El `CalendarPreview` inline muestra el campo `notes` con el horario sugerido
- Las sugerencias iniciales están centradas en planificación semanal y remix de ideas
- El sistema prompt está re-escrito para el contexto de "Publicar Studio"

**Bloque [REMIX] — formato que espera el parser:**
```
[REMIX]
[
  {
    "id": "1",
    "postType": "Behind the scenes",
    "hook": "¿Cuánto tardé en hacer esto?",
    "captionIdea": "Descripción de qué decir en el caption",
    "imageDescription": "Qué imagen hay que generar o ya tiene",
    "moduleToUse": "photodump",
    "moduleLabel": "Photodump Mode",
    "alreadyHaveImage": false,
    "platform": "instagram"
  }
]
```

**Módulos que conoce (routes):**
| Módulo | Ruta |
|--------|------|
| campaign | `/prompt-studio?mode=campaign` |
| photodump | `/prompt-studio?mode=photodump` |
| ugc | `/studio-pro` |
| catalog | `/productos` |
| prompt | `/prompt-studio` |
| scene | `/clonar` |
| outfit | `/outfit-extractor` |

**Llamada a Gemini:**
- Endpoint: `POST /api/gemini/content`
- Action: `assistantChat`
- Modelo: `gemini-2.5-flash`
- Igual que el ProjectCopilot original — no requiere cambios en el backend

**Persistencia:**
- Conversación: guardada en `project.conversation` (Firestore, recortada a 40 mensajes)
- Calendario: guardado en `project.calendar` (Firestore)
- Checklist: guardado en `project.checklist` (Firestore)
- Brief: extraído heurísticamente de la conversación y guardado en `project.brief`
- Las ideas de Remix **no se guardan en Firestore** — son efímeras por sesión (se regeneran pidiendo al copiloto)

### `WeeklyCalendar.tsx`
La vista semanal del plan de contenido.

**Qué hace:**
- Muestra 7 días en una grilla horizontal con puntos de color por estado
- Navega semana a semana con ←/→ y un botón "Hoy" para volver a la semana actual
- Para cada entrada del calendario: muestra tipo de contenido, módulo, horario (campo `notes`), y tres acciones: Listo / Generar / Saltear
- Calcula y muestra la racha de días consecutivos completados hasta hoy
- Muestra el checklist de tareas al final con el mismo sistema de estado

**Colores por módulo:**
| Módulo | Color |
|--------|-------|
| campaign | Rosa `#F72C5B` |
| photodump | Violeta `#7C3AED` |
| ugc | Esmeralda `#10B981` |
| catalog | Celeste `#0EA5E9` |
| prompt | Gris slate |
| scene | Ámbar `#D97706` |
| outfit | Fucsia `#C026D3` |

**Estado vacío:** Si no hay calendario ni checklist, muestra un estado de "Sin plan todavía" con instrucción para ir al copiloto.

### `RemixIdeasGrid.tsx`
La grilla de ideas del Remix Engine.

**Qué hace:**
- Muestra las ideas agrupadas por tipo de post (Behind the scenes, Lifestyle, Detalle de producto, etc.)
- Filtros por módulo en la barra superior (Todas / UGC / Photodump / Campaign / Product / Prompt)
- Cada card tiene: gancho (hook), descripción del caption, y al expandirla: qué imagen necesita + si ya existe en la biblioteca
- Botón "Generar" en cada card que navega al módulo correspondiente
- Botón "Generar más ideas" que manda al copiloto para pedir un nuevo remix

**El tipo `RemixIdea` es exportado desde este archivo** — lo importa `ContentPlannerCopilot.tsx` para tipar las respuestas del bloque `[REMIX]`.

---

## Modelo de costos

| Qué | Costo |
|-----|-------|
| Usar el copiloto (texto) | 0 créditos — solo usa Gemini text |
| Generar calendario semanal | 0 créditos |
| Generar remix de ideas | 0 créditos |
| Generar captions | 0 créditos |
| Generar una imagen (al ir a otro módulo) | Costo del módulo destino |

**Este módulo no consume créditos por sí mismo.** Solo los consume cuando la emprendedora hace clic en "Generar" y es redirigida a un módulo de imagen.

---

## Relación con el ProjectCopilot original (`/projects/:id`)

Publicar Studio y el workspace de Proyectos **coexisten y comparten datos**. Un proyecto creado en Publicar Studio aparece en `/projects` y viceversa. El calendario y checklist generados en Publicar Studio se ven también en el `ProjectCalendar` del workspace de Proyectos.

**No hay duplicación de lógica:** Publicar Studio crea proyectos con `createProject()` del mismo `projectService.ts`. Los datos fluyen en ambas direcciones.

La única diferencia es la interfaz: Proyectos es un workspace de archivos con el copiloto embebido. Publicar Studio es un planificador de contenido con el copiloto como protagonista.

---

## Decisiones técnicas importantes

**¿Por qué las ideas de Remix no se guardan en Firestore?**  
Las ideas son contextuales — dependen del momento, del producto y de cuántas veces la emprendedora ya las vio. Guardarlas crearía una lista que envejece mal. Es mejor generarlas frescas cuando se necesitan. Si en el futuro se quiere persistirlas, el lugar correcto sería un nuevo campo `remixIdeas` en el documento de proyecto.

**¿Por qué el módulo se llama "Publicar Studio" y no "Feed Studio"?**  
"Publicar" es la acción que hace la emprendedora todos los días. "Feed" es un término de Instagram que no todas conocen. El nombre en español conecta mejor con el buyer persona de Luz IA (emprendedora LATAM, no diseñadora, no community manager).

**¿Por qué reutiliza los proyectos existentes en lugar de crear una entidad nueva?**  
Para no fragmentar los datos del usuario. La emprendedora ya tiene proyectos con imágenes de referencia y resultados. El calendario y el plan de contenido tienen que estar cerca de esas imágenes — es la misma campaña. Crear una entidad separada hubiera obligado a duplicar las imágenes o a crear referencias cruzadas complejas.

---

## Pendientes / Mejoras futuras

- Vista de grilla 3xN (Instagram grid preview) para previsualizar cómo queda el feed visualmente antes de publicar
- Integración con Meta Business Suite para programar posts directamente desde la app
- Persistencia de ideas de Remix en Firestore (campo `remixIdeas` en el proyecto)
- Análisis del feed de Instagram (si la usuaria conecta su cuenta vía API Basic Display) para sugerencias personalizadas
- Exportar el calendario como CSV para usar en Later, Hootsuite o Google Calendar
