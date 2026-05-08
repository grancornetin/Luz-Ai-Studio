# Prompt Studio y Galería — Guía del Módulo

> **REGLAS DE MANTENIMIENTO PARA IA:**
> 1. Este archivo debe mantenerse actualizado con el estado real del módulo.
> 2. Cada vez que se agregue, modifique o elimine un feature relevante, actualizar la sección correspondiente.
> 3. Actualizar la fecha de "Última actualización" con cada cambio.
> 4. No borrar secciones — si algo fue eliminado, marcarlo como "Eliminado en [fecha]" y explicar por qué.
> 5. El objetivo es que otra IA pueda leer este archivo y entender completamente qué hace el módulo, cómo funciona, y en qué estado está, sin necesidad de leer el código.

**Última actualización:** Mayo 2026
**Propósito:** Dos herramientas en una: la Galería de Prompts (biblioteca de prompts curados para e-commerce) y el Prompt Studio (generador libre con referencias visuales para usuarios avanzados).

---

## Qué hace este módulo

### Galería de Prompts
Una biblioteca de cientos de prompts curados y probados, organizados por categoría (productos, personas, ambientes, estilos). El usuario puede:
- Explorar y filtrar por categoría, estilo, tipo
- Ver previews de resultado esperado
- Usar un prompt directamente o como punto de partida
- Guardar prompts favoritos
- Los prompts tienen sistema DNA que explica sus componentes

### Prompt Studio
El generador más avanzado y libre de la app. Para usuarios que quieren control total sobre lo que generan:
- Editor de texto libre para escribir prompts
- Slots de referencias visuales (hasta 4 imágenes de referencia)
- Sistema de influencia de referencias (cuánto peso tiene cada referencia)
- Generación de variaciones automáticas
- Historial de generaciones
- Modo Photodump integrado (series narrativas)
- Modo Campaign integrado (campañas desde el studio)

---

## Archivos del módulo

### `PromptLibraryModule.tsx`
Componente raíz que decide si mostrar la galería o el studio según la tab activa.

### `services/generationService.ts`
El servicio de generación más usado de toda la app. Exporta:
- `generateImage()` — Una imagen con referencias
- `generateImagePro()` — Con máxima fidelidad facial
- `generateImageFlash()` — Con consistencia entre shots
- `generateImageFast()` — Sin referencias, máximo volumen
- `generateBatch()` / `generateBatchFlash()` / `generateBatchFast()` — Generación en lote con progreso

Este servicio es importado por casi todos los módulos de la app. Es el punto central de generación.

### `services/promptLibraryService.ts`
CRUD de prompts en Firestore. Carga la galería, guarda favoritos, publica prompts.

### `services/promptBuilder.ts`
Construye el prompt final combinando el texto del usuario, los tokens especiales, las referencias y el sistema de influencia.

### `services/variationsService.ts`
Genera variaciones automáticas de un prompt usando Gemini (cambia el estilo, la composición, el mood).

### `hooks/usePromptLibrary.ts`
Estado global del módulo: prompt actual, referencias, configuración de generación, resultados.

### `components/ReferenceSlots.tsx`
El componente de slots de imagen más usado de la app. Permite subir hasta 4 imágenes de referencia con prioridad (LOW/MEDIUM/HIGH) y lock toggle.

### `components/GeneratedImages.tsx`
Grilla de resultados con botones para guardar en proyectos, descargar, y compartir.

---

## Modelo de costos

| Qué | Costo |
|-----|-------|
| Generar 1 imagen | 2 créditos |
| Ver galería | Gratis |
| Guardar favoritos | Gratis |
| No usa pro-credits | — |
