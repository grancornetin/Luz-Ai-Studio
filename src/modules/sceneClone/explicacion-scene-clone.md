# Scene Clone — Guía del Módulo

> **REGLAS DE MANTENIMIENTO PARA IA:**
> 1. Este archivo debe mantenerse actualizado con el estado real del módulo.
> 2. Cada vez que se agregue, modifique o elimine un feature relevante, actualizar la sección correspondiente.
> 3. Actualizar la fecha de "Última actualización" con cada cambio.
> 4. No borrar secciones — si algo fue eliminado, marcarlo como "Eliminado en [fecha]" y explicar por qué.
> 5. El objetivo es que otra IA pueda leer este archivo y entender completamente qué hace el módulo, cómo funciona, y en qué estado está, sin necesidad de leer el código.

**Última actualización:** Mayo 2026
**Propósito:** Tomar una foto de referencia (de Pinterest, Instagram, o cualquier fuente) y recrear ese mismo ambiente, composición y estilo con el contenido propio del usuario — reemplazando la persona, el producto o ambos.

---

## Qué hace este módulo

Scene Clone es el módulo más potente visualmente. El usuario sube:
1. Una **foto objetivo** — la escena que quiere replicar (composición, luz, ambiente)
2. Fotos de su **modelo** (cara + cuerpo) para reemplazar la persona de la foto
3. Opcionalmente: su **producto** para reemplazar el producto de la foto
4. Opcionalmente: un **outfit** diferente para poner sobre el modelo

El resultado es una nueva imagen que mantiene la composición y el estilo visual de la referencia, pero con la identidad y el contenido del usuario.

**Soporta hasta 2 sujetos** — Puede reemplazar 2 personas distintas en la misma escena.

---

## Flujo para el usuario

1. **Foto objetivo** — Sube la foto que quiere replicar
2. **Sujeto 1** — Sube cara y cuerpo del modelo principal
3. **Sujeto 2** (opcional) — Segundo modelo para escenas con 2 personas
4. **Outfit** (opcional) — Cambiar la ropa de uno o ambos modelos
5. **Producto** (opcional) — Reemplazar objetos detectados en la escena
6. **Configuración** — Ratio de aspecto (9:16, 4:5, 1:1, 16:9) y estilo de cámara (iPhone, wide, selfie)
7. **Generación** — Dos pasos: composición base + personalización
8. **Resultados** — La imagen clonada y sesiones guardadas en biblioteca

---

## Sistema de generación (dos pasos)

**Paso 1 — Composición base:**
Genera una primera versión que respeta la escena original con los nuevos sujetos integrados.

**Paso 2 — Personalización:**
Refina el resultado aplicando cambios de outfit o producto si fueron especificados.

---

## Archivos del módulo

### `SceneCloneModule.tsx`
El componente principal (anteriormente `CloneImageModule.tsx`, movido a esta carpeta). Maneja el flujo completo de la UI: upload de fotos, detección de objetos, configuración, generación y biblioteca de sesiones.

### Servicio asociado: `src/services/cloneImageService.ts`
El servicio principal del módulo. Contiene:
- `buildReferences()` — Construye el array estratificado de referencias (escena, cara1, cuerpo1, cara2, cuerpo2, outfit1, outfit2, productos)
- `buildGeminiPrompt()` — Construye el prompt con protocolo CLONE IMAGE — SCENE LOCK + DUAL IDENTITY LOCK
- `generateClone()` — Función principal que orquesta todo
- Tipos: `CloneImageParams`, `AspectRatio`, `CameraStyle`, `SubjectSelector`

### Servicio asociado: `src/services/sceneAnalysisService.ts`
Analiza la foto objetivo para detectar objetos que pueden ser reemplazados (productos, accesorios, objetos de escena). Usa Gemini para el análisis visual.

### Storage: `src/modules/cloneMaster/storage.ts`
Guarda las sesiones en IndexedDB (`app_clone_master`). Almacena las referencias de ambos sujetos, outfits, imagen resultado y configuración.

---

## Modelo de costos

| Qué | Costo |
|-----|-------|
| Paso 1 (composición base) | 2 créditos |
| Paso 2 (personalización) | 2 créditos |
| Total por sesión | 4 créditos |
| No usa pro-credits | — |
