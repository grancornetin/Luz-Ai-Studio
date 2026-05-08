# Model DNA — Guía del Módulo

> **REGLAS DE MANTENIMIENTO PARA IA:**
> 1. Este archivo debe mantenerse actualizado con el estado real del módulo.
> 2. Cada vez que se agregue, modifique o elimine un feature relevante, actualizar la sección correspondiente.
> 3. Actualizar la fecha de "Última actualización" con cada cambio.
> 4. No borrar secciones — si algo fue eliminado, marcarlo como "Eliminado en [fecha]" y explicar por qué.
> 5. El objetivo es que otra IA pueda leer este archivo y entender completamente qué hace el módulo, cómo funciona, y en qué estado está, sin necesidad de leer el código.

**Última actualización:** Mayo 2026
**Propósito:** Crear un avatar digital idéntico a una persona real a partir de 1-3 fotos. El avatar resultante queda disponible en la biblioteca de modelos para usarlo en cualquier otro módulo (UGC Studio, Campaign, Scene Clone, etc.).

---

## Qué hace este módulo

Model DNA es el módulo que "captura la identidad" de una persona para usarla en el resto de la app. El usuario sube fotos de cualquier persona (puede ser él mismo, un modelo, o incluso una persona pública como referencia de estilo) y el módulo genera un set de 3 imágenes técnicas que capturan la identidad con alta fidelidad:

1. **Body Master** — Vista frontal del cuerpo completo, postura neutral, iluminación de estudio
2. **Vistas técnicas** — Vista trasera y lateral (3/4) para capturar la forma desde todos los ángulos
3. **Face Master** — Close-up del rostro, iluminación uniforme, para máxima fidelidad facial

Este set de 3 imágenes es lo que se llama el "DNA" del avatar. Una vez creado, se guarda en la biblioteca y puede usarse como referencia en UGC Studio, Campaign Generator, Scene Clone y cualquier módulo que trabaje con modelos.

---

## Flujo para el usuario

1. **Subir fotos** — 1 a 3 fotos de la persona (distintos ángulos, buena iluminación preferida)
2. **Generación Body Master** — Primera imagen: cuerpo completo frontal
3. **Generación de vistas** — Segunda imagen: trasera + lateral
4. **Generación Face Master** — Tercera imagen: close-up facial de alta fidelidad
5. **Guardar** — El avatar queda en la biblioteca con nombre asignado
6. **Usar** — Disponible para seleccionar en cualquier módulo que trabaje con personas

---

## Archivos del módulo

### `ModelDNAModule.tsx`
El componente principal (anteriormente `CloningModule.tsx`, movido a esta carpeta). Maneja el wizard de generación, la barra de progreso DNA_STEPS (body → views → face → done), y el guardado del avatar.

### Servicio asociado: `src/services/avatarCloneService.ts`
El servicio de clonación. Contiene:
- `startClone()` — Inicia el proceso de generación del avatar en el backend (retorna jobId)
- `waitForCloneComplete()` — Hace polling hasta que el avatar esté listo (con timeout de seguridad)
- Integración con el sistema de notificaciones de Nivel 3 (el proceso puede continuar aunque el usuario cierre la ventana)
- Tipos: `StartCloneParams` con modo (image = desde fotos, manual = desde descripción)

---

## Modelo de costos

| Qué | Costo |
|-----|-------|
| Crear avatar desde fotos | 4 créditos (CREDIT_COSTS.CREATE_MODEL_CLONE) |
| No usa pro-credits | — |

---

## Relación con Manual Creator

Model DNA y Manual Creator son hermanos. Ambos crean avatares y los guardan en la misma biblioteca. La diferencia:
- **Model DNA** — El avatar es idéntico a una persona real (necesita fotos)
- **Manual Creator** — El avatar se diseña desde cero con parámetros visuales (sin fotos)
