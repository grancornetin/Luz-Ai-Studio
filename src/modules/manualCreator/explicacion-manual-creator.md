# Manual Creator — Guía del Módulo

> **REGLAS DE MANTENIMIENTO PARA IA:**
> 1. Este archivo debe mantenerse actualizado con el estado real del módulo.
> 2. Cada vez que se agregue, modifique o elimine un feature relevante, actualizar la sección correspondiente.
> 3. Actualizar la fecha de "Última actualización" con cada cambio.
> 4. No borrar secciones — si algo fue eliminado, marcarlo como "Eliminado en [fecha]" y explicar por qué.
> 5. El objetivo es que otra IA pueda leer este archivo y entender completamente qué hace el módulo, cómo funciona, y en qué estado está, sin necesidad de leer el código.

**Última actualización:** Mayo 2026
**Propósito:** Crear un avatar digital completamente personalizado sin necesitar fotos de ninguna persona real. El usuario diseña la apariencia del avatar usando controles visuales y el resultado se guarda en la biblioteca de modelos.

---

## Qué hace este módulo

Manual Creator genera avatares "desde cero" usando parámetros visuales. Es la alternativa a Model DNA para quienes no tienen fotos de modelos o quieren crear un personaje que no existe.

El usuario puede controlar:
- **Género** — Hombre / Mujer
- **Edad aproximada**
- **Complexión / Build** — Delgado, atlético, normal, voluptuoso
- **Etnia / Tono de piel**
- **Color de ojos**
- **Color de cabello**
- **Tipo de cabello** — Liso, ondulado, rizado, afro
- **Largo de cabello**
- **Personalidad** — El "vibe" del personaje (elegante, casual, alternativo, etc.)
- **Expresión** — Neutral, sonrisa, seria, etc.
- **Outfit inicial** — La ropa con la que aparece en las imágenes técnicas

Genera el mismo set de 3 imágenes que Model DNA: Body Master + Vistas técnicas + Face Master.

---

## Flujo para el usuario

1. **Configurar apariencia** — Sliders y selects para cada parámetro visual
2. **Preview en tiempo real** — El prompt se construye mientras el usuario ajusta
3. **Generación** — Mismo flujo de 3 etapas (body → vistas → face)
4. **Guardar** — El avatar queda en la biblioteca con nombre personalizado
5. **Usar** — Disponible en cualquier módulo que trabaje con personas

---

## Archivos del módulo

### `ManualCreatorModule.tsx`
El componente principal (anteriormente `ManualCreatorModule.tsx` en la raíz de modules, movido a esta carpeta). Contiene toda la UI de controles visuales y el flujo de generación. Nota: tiene 2 errores de tipo TypeScript pre-existentes no críticos (asignaciones de string a tipos de unión).

### Servicio asociado: `src/services/avatarService.ts`
El servicio de generación de avatares manuales. Contiene:
- `generateBodyMaster()` — Genera la vista frontal del cuerpo
- `generateFaceMaster()` — Genera el close-up facial
- `generateSideFrontViews()` — Genera vistas trasera y lateral
- Cada función acepta el prompt de identidad construido desde los parámetros del usuario

---

## Modelo de costos

| Qué | Costo |
|-----|-------|
| Crear avatar manual | 4 créditos (CREDIT_COSTS.CREATE_MODEL_MANUAL) |
| No usa pro-credits | — |

---

## Relación con Model DNA

Manual Creator y Model DNA son hermanos. Ambos crean avatares y los guardan en la misma biblioteca. La diferencia:
- **Model DNA** — El avatar es idéntico a una persona real (necesita fotos)
- **Manual Creator** — El avatar se diseña desde cero con parámetros visuales (sin fotos)

Los avatares de ambos módulos son intercambiables — un avatar creado con Manual Creator puede usarse en UGC Studio exactamente igual que uno creado con Model DNA.
