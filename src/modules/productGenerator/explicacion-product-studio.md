# Product Studio — Guía del Módulo

> **REGLAS DE MANTENIMIENTO PARA IA:**
> 1. Este archivo debe mantenerse actualizado con el estado real del módulo.
> 2. Cada vez que se agregue, modifique o elimine un feature relevante, actualizar la sección correspondiente.
> 3. Actualizar la fecha de "Última actualización" con cada cambio.
> 4. No borrar secciones — si algo fue eliminado, marcarlo como "Eliminado en [fecha]" y explicar por qué.
> 5. El objetivo es que otra IA pueda leer este archivo y entender completamente qué hace el módulo, cómo funciona, y en qué estado está, sin necesidad de leer el código.

**Última actualización:** Mayo 2026
**Propósito:** Generar fotografías de producto profesionales a partir de fotos simples del producto. Convierte fotos de celular en imágenes de catálogo, lifestyle, detalle y mockup listas para publicar.

---

## Qué hace este módulo

Product Studio toma las fotos que el usuario tiene de su producto (aunque sean simples, sobre cartón blanco o en cualquier fondo) y genera imágenes de nivel profesional. El sistema analiza el producto automáticamente y decide el mejor approach fotográfico.

Soporta varios modos de resultado:
- **Pack** — Genera un set completo de imágenes variadas (catálogo + lifestyle + detalle)
- **Grid** — Genera un grid automático optimizado para Instagram
- **Recrear** — Recrea el estilo de una imagen de referencia con el producto del usuario

---

## Flujo para el usuario (wizard de 6 pasos)

1. **Paso 1 — Producto** — Sube 2-4 fotos del producto desde distintos ángulos
2. **Paso 2 — Objetivo** — Elige para qué es el contenido: social media, e-commerce, catálogo
3. **Paso 3 — Estilo** — Elige un preset visual o sube una imagen de referencia de estilo
4. **Paso 4 — Tipo** — Elige Pack (variado), Grid (automático) o Recrear (clonar estilo)
5. **Paso 5 — Generación** — La IA genera las imágenes con progreso en tiempo real
6. **Paso 6 — Resultados** — Galería de imágenes con descarga individual y ZIP

---

## Sistema de análisis inteligente

Antes de generar, el módulo analiza el producto:

**Análisis heurístico** (siempre, muy rápido):
Detecta por palabras clave en la descripción del usuario: categoría (cosmética, moda, tech, joyería, hogar, etc.), material, colores aproximados.

**Análisis Gemini** (si el heurístico tiene baja confianza):
Envía las fotos a Gemini para un análisis visual detallado: silhueta exacta, materiales, texturas, partes funcionales, labels visibles. Resultado: descripción técnica + descripción comercial del producto.

Con ese análisis, el `productDirectorService` construye el prompt más adecuado para el tipo de producto.

---

## Archivos del módulo

### `ProductGeneratorModule.tsx`
Componente principal. Orquesta el wizard de 6 pasos. Maneja el estado global (fotos del producto, objetivo, estilo, tipo), coordina las llamadas a servicios, y muestra los resultados.

### `productDirectorService.ts`
El director de fotografía. Contiene:
- `geminiAnalyzeProduct()` — Análisis visual del producto con Gemini
- `buildProductPrompt()` — Construye el prompt de imagen según el análisis
- `detectProductCategory()` — Clasifica el producto por categoría
- `buildRefObjects()` — Arma el array de referencias (fotos del producto + referencia de inspiración)
- Lógica de preset de estilos (minimal, lifestyle, editorial, etc.)

### `wizardTypes.ts`
Tipos del wizard: `WizardState`, `ProductGoal`, `ProductStyle`, `ProductType`, `GeminiProductAnalysisRaw`.

### `Step1Product.tsx` a `Step6Results.tsx`
Cada paso del wizard como componente independiente. Facilita el mantenimiento y la lectura del código.

---

## Modelo de costos

| Qué | Costo |
|-----|-------|
| Cada imagen generada — Gemini (PRODUCT_GENERATION) | 2 créditos |
| Cada imagen generada — Seedream | 1 crédito |
| Pack de 4 imágenes (Gemini) | 8 créditos |
| Grid automático | variable según cantidad y modelo |
| Análisis del producto (PRODUCT_ANALYSIS) | 0 créditos — texto gratis |
| No usa pro-credits | — |

Hay reembolso automático si una imagen falla.

---

## Decisiones técnicas importantes

**¿Por qué análisis en dos etapas?**
El análisis heurístico es instantáneo y suficiente para productos simples. El análisis Gemini agrega latencia y costo. Se usa solo cuando el heurístico no puede determinar la categoría con suficiente confianza.

**¿Por qué se pasan múltiples fotos del producto como referencias?**
Distintos ángulos del mismo producto ayudan a Gemini a entender la forma 3D, los colores reales y los detalles de todos los lados. Con una sola foto puede "inventar" lados que no vio.
