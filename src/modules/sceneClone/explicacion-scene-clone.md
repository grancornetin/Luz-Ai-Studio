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
2. Fotos de su **modelo principal**: rostro + cuerpo.
3. Opcionalmente, un **segundo sujeto** para escenas con dos personas.
4. Opcionalmente, referencias de **outfit** para cambiar la ropa de uno o ambos sujetos.
5. Opcionalmente, imágenes de **producto** para reemplazar objetos detectados en la escena.

El resultado esperado es una nueva imagen que mantiene la escena y composición de la referencia, pero usando las identidades, ropa y productos del usuario.

---

## Modo 2 personas inteligente

El módulo soporta 2 personas, pero ahora el modo dual se trata como una función avanzada.

Cuando el usuario activa **Habilitar 2º Persona**, la UI informa que el modo suma **+2 créditos** al generar la base. Además, el usuario debe confirmar si el **Sujeto 1** corresponde al lado **izquierdo** o **derecho** de la foto objetivo. El modo `Auto` queda como estado inicial, pero no permite avanzar hasta confirmar izquierda o derecha.

Para mejorar la asignación, `SceneCloneModule.tsx` genera internamente dos anclas visuales desde la foto objetivo:

- `subject1SlotImage`: recorte amplio de la zona donde debe ir S1.
- `subject2SlotImage`: recorte amplio de la zona donde debe ir S2.

Estos recortes se mandan al servicio solo como referencias de **posición, pose, escala, oclusión y contexto local**. No deben usarse como identidad. La identidad real debe venir desde las fotos de rostro/cuerpo de S1 y S2.

---

## Flujo para el usuario

1. **Foto objetivo** — Sube la foto que quiere replicar.
2. **Sujeto 1** — Sube rostro y cuerpo del modelo principal.
3. **Sujeto 2 opcional** — Activa modo 2 personas, confirma si S1 va a la izquierda o derecha y sube rostro/cuerpo del segundo modelo.
4. **Generar base** — Crea la imagen base con identidad integrada.
5. **Outfit opcional** — Cambia la ropa de uno o ambos modelos.
6. **Producto opcional** — Reemplaza objetos detectados en la escena.
7. **Personalización final** — Aplica outfit/productos sobre la base.
8. **Resultados** — Muestra imagen base/final y guarda la sesión en biblioteca.

---

## Sistema de generación en dos pasos

### Paso 1 — Composición base

Genera una primera versión que respeta la escena original con los nuevos sujetos integrados.

En modo 2 personas, este paso usa anclas visuales por slot para mejorar el mapeo S1/S2.

### Paso 2 — Personalización

Refina el resultado aplicando cambios de outfit o producto si fueron especificados.

Este paso debe comportarse como edición localizada: no debe cambiar rostro, pose, escena ni composición si solo se pidió cambiar ropa/productos.

---

## Archivos del módulo

### `SceneCloneModule.tsx`

Componente principal del módulo. Maneja:

- upload de foto objetivo;
- upload de rostro/cuerpo de S1;
- modo 2 personas;
- selector izquierda/derecha para S1;
- generación de anclas visuales por slot;
- upload de rostro/cuerpo de S2;
- configuración de cámara y aspecto;
- generación base;
- personalización de outfit/productos;
- cobro de créditos;
- historial y biblioteca de sesiones.

### `src/services/cloneImageService.ts`

Servicio principal del módulo. Contiene:

- `CloneImageParams` con soporte para `subject1SlotImage` y `subject2SlotImage`;
- construcción de referencias para escena, identidad, cuerpo, slots, outfits y productos;
- prompt de **base pass** para reemplazo de identidad;
- prompt de **edit pass** para cambios localizados de outfit/productos;
- reglas para que las anclas de slot no sean tratadas como identidad.

### `src/services/sceneAnalysisService.ts`

Analiza la foto objetivo para detectar objetos que pueden ser reemplazados, como productos, accesorios u objetos de escena. Usa Gemini para el análisis visual.

### `src/modules/cloneMaster/storage.ts`

Guarda sesiones en IndexedDB (`app_clone_master`). Almacena referencias, imagen base, imagen final y configuración.

---

## Modelo de costos

| Qué | Costo |
|-----|-------|
| Paso 1 base — 1 persona | 2 créditos |
| Extra modo 2 personas inteligente | +2 créditos |
| Paso 1 base — 2 personas | 4 créditos |
| Paso 2 personalización outfit/producto | 2 créditos |
| Total sesión 1 persona con personalización | 4 créditos |
| Total sesión 2 personas con personalización | 6 créditos |
| No usa pro-credits | — |

El extra de 2 personas se cobra al generar la base, no simplemente al activar el botón. Si falla por un error reembolsable, se intenta reembolsar el costo completo de esa generación base.

---

## Consideraciones de calidad

El modo 2 personas sigue dependiendo del modelo generativo. Las anclas visuales por slot reducen ambigüedad, pero no garantizan perfección absoluta. Por eso la UI obliga al usuario a confirmar si S1 va a la izquierda o a la derecha antes de generar.

Las pruebas deben hacerse primero sin outfit, validando que la base reemplace correctamente ambas identidades. Solo después conviene probar outfits.
