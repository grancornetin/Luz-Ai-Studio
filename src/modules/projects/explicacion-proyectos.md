# Proyectos y Copiloto — Guía del Módulo

> **REGLAS DE MANTENIMIENTO PARA IA:**
> 1. Este archivo debe mantenerse actualizado con el estado real del módulo.
> 2. Cada vez que se agregue, modifique o elimine un feature relevante, actualizar la sección correspondiente.
> 3. Actualizar la fecha de "Última actualización" con cada cambio.
> 4. No borrar secciones — si algo fue eliminado, marcarlo como "Eliminado en [fecha]" y explicar por qué.
> 5. El objetivo es que otra IA pueda leer este archivo y entender completamente qué hace el módulo, cómo funciona, y en qué estado está, sin necesidad de leer el código.

**Última actualización:** Mayo 2026
**Propósito:** Sistema de organización de contenido por proyecto de marca. Permite al usuario agrupar todas sus referencias e imágenes generadas bajo un proyecto específico, con un copiloto IA que recuerda el contexto y puede sugerir el siguiente paso.

---

## Qué hace este módulo

El módulo de Proyectos es el "workspace" de Luz IA Studio. En lugar de tener imágenes dispersas en la historia de generaciones, el usuario puede crear proyectos para cada marca o producto, y guardar ahí todo lo relevante.

Cada proyecto tiene:
- **Galería de referencias** — Imágenes de referencia subidas por el usuario
- **Galería de resultados** — Imágenes generadas por cualquier módulo y guardadas en este proyecto
- **Copiloto IA** — Un asistente conversacional que recuerda el contexto del proyecto y puede sugerir qué hacer a continuación
- **Calendario de contenido** — Vista semanal de las publicaciones planificadas
- **Checklist** — Lista de tareas del proyecto

---

## Flujo para el usuario

1. **Crear proyecto** — Le pone un nombre (ej: "Crema de noche enero")
2. **Agregar referencias** — Sube imágenes de inspiración o de su producto real
3. **Usar módulos** — Desde cualquier módulo (UGC Studio, Campaign, etc.) puede guardar las imágenes generadas en el proyecto con el botón "Guardar en proyecto"
4. **Copiloto** — Habla con el copiloto para pedir sugerencias de qué generar a continuación según el contexto del proyecto
5. **Calendario** — Ve y planifica qué publicar cada semana

---

## Archivos del módulo

### `ProjectsList.tsx`
Vista de todos los proyectos del usuario en formato grid. Permite crear nuevos proyectos. Muestra thumbnail de las últimas imágenes de cada proyecto.

### `ProjectDetail.tsx`
Vista detallada de un proyecto. Tiene 3 secciones: referencias subidas por el usuario, imágenes generadas guardadas, y el copiloto. También permite subir más referencias directamente.

### `ProjectCopilot.tsx`
El copiloto IA embebido. Es un chat conversacional que:
- Recuerda el contexto del proyecto (brief, referencias, imágenes generadas)
- Puede sugerir qué módulo usar para el siguiente paso
- Genera un brief inicial si el usuario le describe su proyecto
- Mantiene historial de conversación en Firestore

### `ProjectCalendar.tsx`
Vista de calendario semanal. Muestra las publicaciones planificadas del proyecto con su estado (pendiente, publicado, saltado).

---

## Servicio asociado: `src/services/projectService.ts`

Este servicio es el más importante del módulo y es usado por otros módulos para guardar imágenes en proyectos:

```
createProject(name) — Crear proyecto nuevo
addItemToProject(projectId, item) — Agregar imagen al proyecto
  item = { type: 'reference' | 'result', url, module, metadata }
saveConversation(projectId, messages) — Guardar historial del copiloto
saveBrief(projectId, brief) — Guardar el brief del proyecto
saveChecklist(projectId, items) — Guardar checklist
saveCalendar(projectId, entries) — Guardar calendario
```

### Componente compartido: `AddToProjectButton`
Botón reutilizable en `src/components/shared/AddToProjectButton.tsx`. Se usa en GeneratedImages y en el historial de generaciones para guardar imágenes en proyectos desde cualquier módulo.

---

## Storage

Los proyectos se guardan en **Firestore** (no en IndexedDB como los demás módulos):
```
users/{uid}/projects/{projectId}
  - name
  - createdAt / updatedAt
  - items: ProjectItem[]
  - brief?: ProjectBrief
  - conversation?: ProjectMessage[]
  - checklist?: ChecklistItem[]
  - calendar?: CalendarEntry[]
```

---

## Modelo de costos

El módulo de proyectos no tiene costo propio. Los créditos se cobran en los módulos que generan las imágenes.
