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

Scene Clone permite al usuario subir:
1. Una **foto objetivo** — la escena que quiere replicar: composición, luz, ambiente, pose y encuadre.
2. Fotos de su **modelo**: rostro + cuerpo.
3. Opcionalmente, una referencia de **outfit** para cambiar la ropa del sujeto.
4. Opcionalmente, imágenes de **producto** para reemplazar objetos detectados en la escena.

El resultado esperado es una nueva imagen que mantiene la escena y composición de la referencia, pero usando la identidad, ropa y productos del usuario.

---

## ~~Modo 2 personas inteligente~~ — Eliminado en Mayo 2026

El soporte para dos sujetos fue removido completamente del módulo. Se eliminaron los campos de `face2`, `body2`, `outfit2`, anclas visuales por slot (`subject1SlotImage`, `subject2SlotImage`), y toda la lógica de asignación izquierda/derecha. El módulo opera exclusivamente con un sujeto.

---

## Flujo para el usuario

1. **Foto objetivo** — Sube la foto que quiere replicar.
2. **Sujeto** — Sube rostro y cuerpo del modelo.
3. **Generar base** — Crea la imagen base con identidad integrada.
4. **Outfit opcional** — Cambia la ropa del modelo.
5. **Producto opcional** — Reemplaza objetos detectados en la escena.
6. **Personalización final** — Aplica outfit/productos sobre la base.
7. **Resultados** — Muestra imagen base/final y guarda la sesión en biblioteca.

---

## Sistema de generación en dos pasos

### Paso 1 — Composición base

Genera una primera versión que respeta la escena original con el nuevo sujeto integrado.

### Paso 2 — Personalización

Refina el resultado aplicando cambios de outfit o producto si fueron especificados.

Este paso debe comportarse como edición localizada: no debe cambiar rostro, pose, escena ni composición si solo se pidió cambiar ropa/productos.

---

## Archivos del módulo

### `SceneCloneModule.tsx`

Componente principal del módulo. Maneja:

- upload de foto objetivo;
- upload de rostro/cuerpo del sujeto;
- configuración de cámara y aspecto;
- generación base;
- personalización de outfit/productos;
- cobro de créditos;
- historial y biblioteca de sesiones.

### `src/services/cloneImageService.ts`

Servicio principal del módulo. Contiene:

- `CloneImageParams` para un único sujeto;
- construcción de referencias para escena, identidad, cuerpo, outfit y productos;
- prompt de **base pass** para reemplazo de identidad;
- prompt de **edit pass** para cambios localizados de outfit/productos.

### `src/services/sceneAnalysisService.ts`

Analiza la foto objetivo para detectar objetos que pueden ser reemplazados, como productos, accesorios u objetos de escena. Usa Gemini para el análisis visual.

### `src/modules/cloneMaster/storage.ts`

Guarda sesiones en IndexedDB (`app_clone_master`). Almacena referencias, imagen base, imagen final y configuración.

---

## Modelo de costos

| Qué | Costo |
|-----|-------|
| Paso 1 base — Gemini (CLONE_IMAGE) | 2 créditos |
| Paso 1 base — Seedream | 1 crédito |
| Paso 2 personalización outfit/producto | 2 créditos (Gemini) / 1 cr (Seedream) |
| Total sesión con personalización (Gemini) | 4 créditos |
| No usa pro-credits | — |

Si falla por un error reembolsable, se intenta reembolsar el costo completo de esa generación.
