# Planner — Guía del Módulo

> **REGLAS DE MANTENIMIENTO PARA IA:**
> 1. Este archivo debe mantenerse actualizado con el estado real del módulo.
> 2. Cada vez que se agregue, modifique o elimine un feature relevante, actualizar la sección correspondiente.
> 3. Actualizar la fecha de "Última actualización" con cada cambio.
> 4. No borrar secciones — si algo fue eliminado, marcarlo como "Eliminado en [fecha]" y explicar por qué.
> 5. El objetivo es que otra IA pueda leer este archivo y entender completamente qué hace el módulo, cómo funciona, y en qué estado está, sin necesidad de leer el código.

**Última actualización:** Mayo 2026 (rediseño completo — onboarding + vista semanal + burbuja flotante)  
**Propósito:** Asistente de contenido que diseña la semana de publicaciones de la emprendedora, le dice exactamente qué crear, con qué caption, en qué plataforma, y la acompaña mientras lo genera.

---

## Qué problema resuelve

| Problema de Sofi | Respuesta del Planner |
|---|---|
| "No sé qué publicar hoy" | Asigna una tarea concreta por día |
| "No sé cómo redactar el caption" | La IA lo genera completo, listo para copiar |
| "No sé en qué red publicar" | Ella elige sus plataformas y el plan se adapta |
| "Quiero ordenar la semana visualmente" | Vista de tarjetas por día, con progreso |
| "Tengo 3 productos, se me acaba el contenido" | El sistema rota 8+ formatos distintos para no repetir |

---

## Flujo completo para el usuario

### Paso 1 — Onboarding (una sola vez, ~2 min)
La emprendedora responde 4 preguntas:
1. **¿Qué vendés?** — texto libre
2. **¿Cuál es tu meta esta semana?** — 4 opciones: Vender más / Ganar seguidores / Lanzar algo nuevo / Mantener presencia
3. **¿Cuántas veces podés publicar?** — 3 / 5 / 7 días
4. **¿En qué redes?** — checkboxes: Instagram Feed / Stories / TikTok / WhatsApp

Al hacer clic en "Armar mi semana", Gemini genera el plan completo. Se crea el proyecto en Firestore y navega directo a la vista semanal.

### Paso 2 — Vista semanal (PlannerWeek)
Muestra las tareas del plan como tarjetas expandibles, ordenadas por día. Cada tarjeta incluye:
- Tipo de contenido + módulo + plataforma + hora sugerida
- Caption completo con emojis, listo para copiar
- Hashtags del nicho
- Prompt listo para usar en el módulo
- Instrucciones de qué subir al módulo y cómo configurarlo
- Consejo de engagement específico para ese tipo de post
- Botones: Ejecutar / Hecho / Saltar

### Paso 3 — Ejecutar una tarea
La emprendedora hace clic en "Ejecutar". El sistema:
1. Activa la **burbuja flotante** (PlannerTaskBubble) con todas las instrucciones
2. Navega al módulo correspondiente (Product Studio, UGC, Prompt Studio, etc.)
3. La burbuja la acompaña en el módulo — puede consultarla, copiar el prompt o el caption, y al terminar marca la tarea como completada desde ahí mismo.

### Paso 4 — Marcar progreso
La tarea se puede marcar como hecha desde la tarjeta del Planner o desde la burbuja flotante. La barra de progreso semanal se actualiza en tiempo real.

### Paso 5 — Nueva semana
Cuando todas las tareas están completadas (o manualmente con el botón "Nueva semana"), Gemini genera un plan nuevo rotando los tipos de contenido para no repetir los de la semana anterior.

---

## Archivos del módulo

### `PlannerList.tsx`
La pantalla de inicio (`/planner`). Muestra todos los planes del usuario como cards con miniatura, progreso y fecha. El botón "Nuevo plan" navega al onboarding.

### `PlannerOnboarding.tsx`
El wizard de 4 pasos (`/planner/nuevo`). Recoge las 4 respuestas, llama a Gemini para generar el plan, crea el proyecto en Firestore y redirige a PlannerWeek.

**Qué hace internamente:**
- `generateWeekPlan()` — llama a `/api/gemini/content` con un prompt de directora de contenido. Gemini devuelve un array JSON de `CalendarEntry[]` con todos los campos completos.
- Crea el proyecto con `createProject()`, guarda el brief con `savePlannerBrief()` y el calendario con `saveCalendar()`.

### `PlannerWeek.tsx`
La vista semanal principal (`/planner/:id`). Muestra las tareas como tarjetas expandibles.

**Qué hace internamente:**
- Carga el proyecto desde Firestore.
- Por cada tarea: muestra el contenido, permite expandir/colapsar, copia caption/prompt, navega al módulo.
- Al hacer clic en "Ejecutar": dispara el evento `planner:task:activate` con todos los datos de la tarea → activa la burbuja flotante. Luego navega al módulo (Prompt Studio recibe `?prompt=...` precargado).
- Al completar: llama a `updateCalendarEntryStatus()` y actualiza el estado local.
- Escucha el evento `planner:task:complete` (emitido por la burbuja) para marcar tareas desde cualquier módulo.
- `handleRegenerate()` — regenera el plan pasando los tipos de contenido anteriores para que Gemini no los repita.

### `PlannerTaskBubble.tsx` (`/src/components/`)
La burbuja flotante global. Vive en `App.tsx`, siempre montada, pero invisible hasta que hay una tarea activa.

**Posición:** `bottom-6 left-6` (opuesto al AppAssistant que está en `right-6`)  
**Z-index:** 900 (igual que AppAssistant)

**Qué hace:**
- Escucha el evento `planner:task:activate` y muestra el panel con todas las instrucciones de la tarea.
- Permite copiar el prompt, el caption y los hashtags con un clic.
- Muestra qué subir al módulo y cómo configurarlo.
- Botón "Marcar como completada" — llama a `updateCalendarEntryStatus()` y emite `planner:task:complete`.
- Se puede minimizar al botón burbuja y expandir nuevamente.
- Se cierra con la X o automáticamente después de marcar como completada.

---

## Modelo de datos

Los datos se guardan en Firestore bajo `/users/{uid}/projects/{projectId}`.

### Campos nuevos en `CalendarEntry` (extendidos en Mayo 2026)

```typescript
CalendarEntry {
  // Campos originales
  id, date, dayLabel, contentType, module, params, status

  // Campos nuevos
  platform: string          // "Instagram Feed" | "Stories" | "TikTok" | "WhatsApp"
  suggestedTime: string     // "19:00"
  prompt: string            // prompt listo para copiar en el módulo
  caption: string           // copy completo para la publicación
  hashtags: string          // hashtags del nicho
  whatToUpload: string[]    // instrucciones de qué subir al módulo
  howToConfigure: string[]  // configuración del módulo paso a paso
  engagementHook: string    // consejo específico para generar comentarios
}
```

### `PlannerBrief` (tipo nuevo)

```typescript
PlannerBrief {
  product: string     // "aretes artesanales de plata"
  goal: string        // "sell" | "grow" | "launch" | "maintain"
  frequency: number   // 3 | 5 | 7
  platforms: string[] // ["Instagram Feed", "TikTok"]
  updatedAt: number
}
```

Se guarda en el proyecto como `plannerBrief` y se usa para regenerar el plan con el mismo brief.

---

## Módulos a los que puede navegar

| Módulo | Clave | Ruta | Pre-fill |
|--------|-------|------|----------|
| Product Studio | `product` | `/productos` | — |
| UGC Studio | `ugc` | `/studio-pro` | — |
| Campaign | `campaign` | `/campaign` | — |
| Scene Clone | `scene` | `/clonar` | — |
| Outfit Extractor | `outfit` | `/outfit-extractor` | — |
| Prompt Studio | `prompt` | `/prompt-studio?prompt=...` | prompt pre-cargado |

---

## Comunicación entre componentes (eventos DOM)

El módulo usa eventos DOM para comunicarse entre PlannerWeek y PlannerTaskBubble, siguiendo el mismo patrón que AppAssistant.

| Evento | Quién lo dispara | Quién lo escucha | Qué contiene |
|--------|-----------------|-----------------|--------------|
| `planner:task:activate` | `PlannerWeek` al hacer clic en Ejecutar | `PlannerTaskBubble` | Todos los campos de `CalendarEntry` + `projectId` |
| `planner:task:complete` | `PlannerTaskBubble` al marcar hecho | `PlannerWeek` | `{ taskId, projectId }` |

---

## Decisiones técnicas

**¿Por qué se eliminó el chat libre como interfaz principal?**
El copiloto conversacional (ContentPlannerCopilot) requería que la emprendedora supiera qué pedirle. Sofi no sabe qué pedir — necesita que alguien le diga. El onboarding de 4 preguntas invierte eso: la herramienta toma la iniciativa y devuelve un plan ejecutable sin necesidad de conversación.

**¿Por qué la burbuja está en `left-6` y no en `right-6`?**
El AppAssistant ya ocupa `right-6`. Tener ambas burbujas en el mismo lado se pisaría visualmente. `left-6` las mantiene separadas y permite usar ambas en paralelo.

**¿Por qué Gemini recibe los tipos de contenido anteriores?**
Para garantizar variedad semana a semana. Sin ese contexto, Gemini puede devolver los mismos 5 formatos todas las semanas. Al pasarle qué tipos ya se usaron, rota a formatos distintos.

**¿Por qué el prompt de Prompt Studio se pasa por URL?**
Es el único módulo que hoy lee parámetros de URL (`?prompt=...`). Los demás módulos (Product, UGC, Scene) no leen params externos aún — por eso la burbuja flotante actúa como puente, mostrando las instrucciones que la emprendedora aplica manualmente.

---

## Lo que se eliminó en Mayo 2026

- **`PlannerDetail.tsx`** — reemplazado por `PlannerWeek.tsx`. El layout de 3 columnas (imágenes / chat / calendario) se descartó porque dispersaba la atención. La vista de tareas es más directa.
- **`ContentPlannerCopilot.tsx`** como interfaz principal del Planner — el archivo queda para uso futuro pero ya no se monta en el Planner. El copiloto pasó a ser invisible: trabaja al generar el plan, no en tiempo real.
- **`WeeklyCalendar.tsx`** — su lógica se absorbió en `PlannerWeek.tsx`. Se eliminó la vista de 7 columnas tipo agenda y se reemplazó por tarjetas expandibles ordenadas por día.

---

## Pendientes / Mejoras futuras

- Pre-llenar parámetros en Product Studio y UGC Studio via URL params (hoy solo Prompt Studio lo soporta)
- Perfil de Marca como fuente automática para el onboarding (hoy la emprendedora describe su negocio manualmente)
- Drag & drop entre días para reordenar tareas
- Vista mensual del calendario
- Notificaciones push recordando publicar según el plan
