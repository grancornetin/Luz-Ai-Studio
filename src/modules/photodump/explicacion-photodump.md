# Photodump — Guía del Módulo

> **REGLAS DE MANTENIMIENTO PARA IA:**
> 1. Este archivo debe mantenerse actualizado con el estado real del módulo.
> 2. Cada vez que se agregue, modifique o elimine un feature relevante, actualizar la sección correspondiente.
> 3. Actualizar la fecha de "Última actualización" con cada cambio.
> 4. No borrar secciones — si algo fue eliminado, marcarlo como "Eliminado en [fecha]" y explicar por qué.
> 5. El objetivo es que otra IA pueda leer este archivo y entender completamente qué hace el módulo, cómo funciona, y en qué estado está, sin necesidad de leer el código.

**Última actualización:** Mayo 2026
**Propósito:** Generar series fotográficas con narrativa visual coherente. Un "photodump" es una colección de fotos que cuentan una historia o transmiten un mood, muy popular en Instagram y TikTok.

---

## Qué hace este módulo

Photodump genera entre 4 y 8 imágenes que cuentan una historia visual juntas. No son fotos sueltas — tienen un hilo conductor narrativo que las conecta: un día completo, un viaje, una sesión editorial, un momento de marca.

El módulo funciona con distintos tipos de protagonista:
- **Persona / Avatar** — Una persona o modelo digital protagoniza la historia
- **Producto** — El producto es el protagonista del relato visual
- **Marca** — El mood y la identidad de marca son el hilo conductor

---

## Flujo para el usuario

1. **Brief** — Describe la historia o el mood que quiere contar
2. **Protagonista** — Elige quién o qué protagoniza (puede subir foto de referencia)
3. **Narrativa** — Elige el tipo de historia (día completo, viaje, editorial, campaña, etc.)
4. **Cantidad** — 4, 6 u 8 imágenes
5. **Generación** — Las imágenes aparecen en pantalla a medida que se generan
6. **Resultados** — Serie completa con descarga ZIP y guardado en biblioteca

---

## Sistema de construcción narrativa

`photodumpService.buildPhotodumpScenes()` es la función clave. Manda el brief a Gemini con instrucciones de storytelling:
- Construye un arco narrativo (inicio, desarrollo, cierre)
- Asigna un rol visual a cada imagen (establishing shot, detail, action, portrait, wide, etc.)
- Escribe el prompt de imagen para cada escena con coherencia de luz y ambiente
- Mantiene consistencia de identidad si hay persona de referencia

---

## Archivos del módulo

### `PhotodumpModule.tsx`
Componente principal. Wizard de brief → configuración → generación → resultados. Incluye la biblioteca de photodumps guardados con thumbnails.

### `photodumpService.ts`
Lógica de construcción narrativa. Llama a Gemini para armar el guión de escenas, luego genera las imágenes en secuencia usando `generationService`.

### `photodumpStorage.ts`
IndexedDB (`app_photodump_module`). Guarda los sets completos con todas las imágenes y metadatos narrativos.

### `types.ts`
Tipos: `PhotodumpSet`, `PhotodumpNarrative`, `PhotodumpProtagonist`, `PhotodumpScene`.

---

## Modelo de costos

| Qué | Costo |
|-----|-------|
| 1 sesión Photodump | 1 pro-credit |
| Cada imagen generada | 2 créditos |
| Serie de 4 imágenes | 1 pro-credit + 8 créditos |
| Serie de 8 imágenes | 1 pro-credit + 16 créditos |
