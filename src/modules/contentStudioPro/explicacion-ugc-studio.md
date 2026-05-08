# UGC Studio (Content Studio Pro) — Guía del Módulo

> **REGLAS DE MANTENIMIENTO PARA IA:**
> 1. Este archivo debe mantenerse actualizado con el estado real del módulo.
> 2. Cada vez que se agregue, modifique o elimine un feature relevante, actualizar la sección correspondiente.
> 3. Actualizar la fecha de "Última actualización" con cada cambio.
> 4. No borrar secciones — si algo fue eliminado, marcarlo como "Eliminado en [fecha]" y explicar por qué.
> 5. El objetivo es que otra IA pueda leer este archivo y entender completamente qué hace el módulo, cómo funciona, y en qué estado está, sin necesidad de leer el código.

**Última actualización:** Mayo 2026
**Propósito:** Generar contenido visual tipo UGC (User Generated Content) de alta calidad para que emprendedores muestren sus productos de forma auténtica y humana, como si lo publicara un influencer real.

---

## Qué hace este módulo

UGC Studio genera series de 6 fotografías de estilo "iPhone real" con una identidad visual consistente. No son fotos de catálogo — son fotos que parecen tomadas por una persona real, del tipo que más funciona en Instagram, TikTok y publicidad pagada.

El módulo tiene 4 enfoques distintos:
- **AVATAR** — La persona es la protagonista. Las fotos muestran su personalidad, expresión y estilo.
- **OUTFIT** — La ropa es la protagonista. Shots de cuerpo completo, detalles de tela, selfie.
- **PRODUCT** — El producto es el protagonista. La persona lo muestra, lo usa, lo presenta.
- **SCENE** — El ambiente es el protagonista. La persona vive el lugar o el contexto.

Genera siempre **6 shots** con roles distintos: HERO, SELFIE, EXPRESSION, DETAIL, INTERACTION, LIFESTYLE, ALT_ANGLE o CONTEXT, según el enfoque elegido.

---

## Flujo para el usuario

1. **Configuración** — Elige el enfoque (Avatar/Outfit/Product/Scene) y sube las referencias
2. **Referencias** — Sube fotos de: cara del modelo (obligatorio), cuerpo, outfit, producto, escena
3. **Generación** — La IA genera la imagen REF0 (imagen ancla de la sesión) y luego los 5-6 shots derivados
4. **Resultados** — Biblioteca de sesiones con todas las imágenes, descarga individual o en ZIP
5. **Biblioteca** — Todas las sesiones guardadas con thumbnails

---

## Sistema de generación (lo más importante)

### El flujo de dos etapas

**Etapa 1 — REF0 (imagen ancla):**
Se genera una primera imagen que define la "realidad visual" de la sesión: iluminación, espacio, escala, color. Esta imagen es el ancla de todo lo demás.

Después de generarse, se analiza automáticamente para extraer:
- Dirección y temperatura de la luz
- Elementos del espacio (muebles, paredes, piso)
- Acciones disponibles para la persona (sentarse, apoyarse, estar parado)

**Etapa 2 — Shots derivados:**
Cada shot se genera con el REF0 como referencia adicional. El prompt incluye el análisis de luz y espacio del REF0 para que todos los shots parezcan tomados en la misma sesión.

### Sistema de locks (garantiza consistencia)
Cada prompt incluye instrucciones explícitas y no negociables:
- **Identity Lock** — La cara del modelo es la única cara permitida. No promediar con otras referencias.
- **Visual Continuity Lock** — Misma temperatura de color, misma luz, mismo contraste en todos los shots.
- **Product Lock** — El producto debe ser idéntico en todos los shots. Sin reinterpretaciones.
- **Outfit Lock** — La ropa debe ser idéntica. No inventar continuación de tela.
- **Scene Lock** — El ambiente debe ser idéntico al REF0.

### Referencias estratificadas
El orden de las referencias importa — las primeras tienen más peso en Gemini:
1. Cara del modelo (duplicada para máximo peso de identidad)
2. REF0 (imagen ancla ya generada)
3. Outfit reference
4. Product reference
5. Scene reference

---

## Archivos del módulo

### `ContentStudioProModule.tsx`
Componente principal. Maneja el flujo completo: configuración de referencias → generación → biblioteca. Contiene la UI de los slots de imagen, el panel de progreso de generación, y la galería de sesiones guardadas.

### `service.ts`
El cerebro del módulo. Contiene:
- `generateImage0()` — Genera la imagen REF0 con análisis posterior
- `generateDerivedShotAsync()` — Genera cada shot derivado con polling
- `translateDirectiveToPrompt()` — Convierte la directiva de shot en instrucciones para Gemini
- El Lock System completo (texto de los locks de identidad, visual, producto, outfit, escena)
- Los prompts específicos por enfoque (AVATAR/OUTFIT/PRODUCT/SCENE)
- El sistema de negative prompts (versión larga para REF0, versión corta para derivados)

### `ugcDirectorService.ts`
El "director creativo" del módulo. Contiene:
- `buildUGCSessionPlanFromAnchor()` — Construye el plan de 6 shots según el enfoque
- `buildAvatarShotDirectives()` — 6 directivas para enfoque AVATAR
- `buildOutfitShotDirectives()` — 6 directivas para enfoque OUTFIT
- `buildProductShotDirectives()` — 6 directivas para enfoque PRODUCT (adaptadas por categoría)
- `buildSceneShotDirectives()` — 6 directivas para enfoque SCENE
- `analyzeREF0()` — Extrae iluminación y espacio de la imagen ancla
- `analyzeOutfitReference()` — Detecta si hay zapatos, bolso, tipo de tela, colores
- `analyzeSceneReference()` — Detecta si hay muebles, naturaleza, superficie de apoyo
- `detectProductCategory()` — Clasifica el producto (JEWELRY, MAKEUP, TECH, SPORTS, FASHION, etc.)

### `types.ts`
Todos los tipos del módulo. Los más importantes:
- `ShotDirective` — La directiva completa de un shot (rol, framing, composición, required/forbidden elements)
- `REF0Analysis` — El análisis de luz y espacio del REF0
- `Focus` — AVATAR | OUTFIT | PRODUCT | SCENE
- `ShotRole` — HERO | DETAIL | INTERACTION | LIFESTYLE | ALT_ANGLE | EXPRESSION | SELFIE | CONTEXT
- `UGCSessionPlan` — El plan completo de 6 shots

### `storage.ts`
Guarda las sesiones completadas en IndexedDB (`app_content_studio_pro`).

### `components/CostSummary.tsx`
Panel visual que muestra el costo antes de generar: créditos por shot, total, créditos restantes.

---

## Modelo de costos

| Qué | Costo |
|-----|-------|
| Generar REF0 | 2 créditos |
| Cada shot derivado | 2 créditos |
| Sesión completa (6 shots) | 14 créditos |
| No usa pro-credits | — |

---

## Decisiones técnicas importantes

**¿Por qué REF0 primero?**
Sin una imagen ancla, cada shot se genera de forma independiente y pueden verse completamente distintos (diferente luz, diferente ambiente, diferente tono). REF0 "congela" la realidad visual de la sesión.

**¿Por qué la cara se duplica en las referencias?**
Gemini da más peso a las primeras referencias del array. Duplicar la cara asegura que la identidad facial tenga prioridad absoluta sobre el REF0 al interpretar quién es la persona.

**¿Por qué hay versión larga y corta del negative prompt?**
Los prompts demasiado largos pueden causar timeout en el endpoint. REF0 usa la versión completa. Los shots derivados usan una versión más corta pero reforzada con los locks principales.
