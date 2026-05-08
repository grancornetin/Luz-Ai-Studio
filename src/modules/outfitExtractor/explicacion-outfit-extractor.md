# Outfit Extractor — Guía del Módulo

> **REGLAS DE MANTENIMIENTO PARA IA:**
> 1. Este archivo debe mantenerse actualizado con el estado real del módulo.
> 2. Cada vez que se agregue, modifique o elimine un feature relevante, actualizar la sección correspondiente.
> 3. Actualizar la fecha de "Última actualización" con cada cambio.
> 4. No borrar secciones — si algo fue eliminado, marcarlo como "Eliminado en [fecha]" y explicar por qué.
> 5. El objetivo es que otra IA pueda leer este archivo y entender completamente qué hace el módulo, cómo funciona, y en qué estado está, sin necesidad de leer el código.

**Última actualización:** Mayo 2026
**Propósito:** Extraer prendas individuales de una foto de outfit completo y generar renders de catálogo de cada prenda por separado. Ideal para vendedores de ropa que quieren fotos individuales de cada prenda sin hacer una sesión fotográfica por prenda.

---

## Qué hace este módulo

El usuario sube una foto donde aparece una persona con un outfit. El módulo detecta automáticamente cada prenda (remera, pantalón, zapatos, accesorios), genera un render individual de cada una como si fuera una foto de catálogo, y permite combinarlas en outfits nuevos.

**Casos de uso principales:**
- Vendedores de ropa que compraron prendas en feria o al por mayor y necesitan fotos de catálogo
- Emprendedoras que quieren separar piezas de un outfit para venderlas individualmente
- Crear lookbooks con diferentes combinaciones de prendas

---

## Flujo para el usuario

1. **Subir foto** — Foto de una persona usando el outfit completo
2. **Escaneo** — Gemini analiza la imagen y detecta cada prenda con coordenadas y descripción
3. **Vista de prendas** — Overlay visual sobre la foto con cada prenda identificada y numerada
4. **Seleccionar** — El usuario elige qué prendas renderizar
5. **Generación** — Se genera un render de catálogo de cada prenda seleccionada (fondo neutro, pieza centrada)
6. **Composición** — El usuario puede combinar prendas para crear outfits alternativos
7. **Biblioteca** — Guarda kits completos (todas las prendas de un outfit) e items individuales

---

## Archivos del módulo

### `OutfitExtractorModule.tsx`
Componente principal. Maneja el flujo completo: upload → scan overlay → selección → generación → composición → biblioteca. El "scan overlay" es la parte más visual: muestra la foto original con cada prenda marcada con una caja de color y número.

### `outfitService.ts`
Contiene la lógica de:
- Análisis de prendas con Gemini (`analyzeOutfit()`)
- Construcción de prompts para renderizar cada prenda individual
- Generación de renders con `imageApiService`
- Lógica de composición de outfits (combinar 2+ prendas en una sola imagen)

### `outfitStorage.ts`
IndexedDB (`app_outfit_extractor`) con tres stores:
- `kits` — Kits completos (foto original + todas las prendas detectadas + renders)
- `items` — Items individuales (un render de una prenda)
- `combinations` — Combinaciones creadas por el usuario

### `types.ts`
Tipos principales: `OutfitKit`, `SavedOutfitItem`, `OutfitCombination`, coordenadas de prenda.

---

## Modelo de costos

| Qué | Costo |
|-----|-------|
| Escanear outfit (Gemini análisis) | Gratis |
| Render de cada prenda | 2 créditos |
| Composición de outfit | 2 créditos |
| No usa pro-credits | — |
