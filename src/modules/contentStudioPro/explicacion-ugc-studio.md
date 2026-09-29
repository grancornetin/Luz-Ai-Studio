# UGC Studio (Content Studio Pro) — Guía del Módulo

> **REGLAS DE MANTENIMIENTO PARA IA:**
> 1. Este archivo debe mantenerse actualizado con el estado real del módulo.
> 2. Cada vez que se agregue, modifique o elimine un feature relevante, actualizar la sección correspondiente.
> 3. Actualizar la fecha de "Última actualización" con cada cambio.
> 4. No borrar secciones — si algo fue eliminado, marcarlo como "Eliminado en [fecha]" y explicar por qué.
> 5. El objetivo es que otra IA pueda leer este archivo y entender completamente qué hace el módulo, cómo funciona, y en qué estado está, sin necesidad de leer el código.

**Última actualización:** 29 de septiembre de 2026 (rediseño de la interfaz: wizard de 4 pasos, modelos guardados, varios ángulos y modo colección)
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

## Flujo para el usuario (desde 29-sep-2026)

Pestañas arriba: **Crear** / **Historial (N)**. En "Crear" hay un wizard de 4 pasos con stepper visible y barra fija abajo (Atrás + Continuar). Una pregunta por pantalla. Mobile-first; en desktop queda centrado con `max-w-2xl`.

1. **Qué mostrar** — Carrusel de 4 tarjetas grandes (en desktop, grilla 2x2): Una persona (AVATAR), Tu producto (PRODUCT), Un look (OUTFIT), Un lugar (SCENE). Arranca con PRODUCT elegido.
2. **Quién aparece** — Tabs "Mis modelos (N)" / "Subir una foto".
   - *Mis modelos*: riel de tarjetas altas con los modelos guardados (`avatars` llega por prop desde `App.tsx`). Portada = `baseImages[0]`. Subtítulo "Creado desde fotos" (type `clone`/`reference`) o "Creado desde cero" (`manual`). La última tarjeta "Crear un modelo" lleva a `/crear/clonar`.
   - Al elegir un modelo, la foto de identidad que se usa es su close-up facial: `baseImages[3] ?? baseImages[último] ?? baseImages[0]` (Model DNA y Manual Creator guardan en orden cuerpo, trasera, lateral, rostro). Se convierte a data URL (el servicio solo acepta base64) y se guarda en `faceRefs[0]`, igual que una foto subida a mano. El nombre del modelo se guarda en el set (`modelName`) y se usa en títulos ("Valentina con tu producto").
   - *Subir una foto*: un slot grande para el rostro. Si no hay modelos guardados, el paso abre directo acá. Subir a mano siempre sigue disponible.
3. **Tus fotos** — Depende del enfoque:
   - PRODUCT: tabs "Un producto" / "Una colección" (ver secciones abajo), tamaño Chico/Mediano/Grande (SMALL/MEDIUM/LARGE) y caja opcional "Sumar más detalles" (ropa y lugar).
   - OUTFIT: foto del look obligatoria + opcionales lugar y objeto.
   - SCENE: foto del lugar obligatoria + texto opcional "¿Qué se puede hacer ahí?" + opcionales ropa y objeto.
   - AVATAR: nada obligatorio; opcionales ropa, lugar y objeto.
   - El "objeto" en Look/Lugar/Persona se guarda aparte del producto (estado `objectRef`) y, si se sube, se usa. Para OUTFIT/SCENE se corre `analyzeProductRelevance` y se muestra un aviso suave si parece no tener relación.
4. **Revisar** — Resumen con miniaturas, "Cambiar algo" (vuelve al paso 1), cantidad de fotos (2 Rápida / 4 Media / 6 Completa, recomendada y por defecto), costo total (`costo por foto × (1 + cantidad)`, se cobra una sola vez), y CTA "Crear foto de prueba". En colección no hay selector: la cantidad = número de productos. El selector de motor (Nano Banana 2 / GPT Image 2) solo aparece para admin como fila discreta "Motor (solo admin)"; los usuarios siempre usan `gemini`.

Después del wizard, en el mismo contenedor:
- **Creando foto de prueba** — línea de tiempo de 3 pasos (mirando tus fotos → creando la primera foto → lista para aprobar).
- **¿Te gusta cómo se ve?** — la foto de prueba (REF0) grande, chequeos simples, "Probar otra" (gratis, hasta 3 intentos) o "Sí, crear las N fotos".
- **Creando tus fotos** — grilla compacta de 3 columnas con el estado de cada foto. Se generan de a una con pausa de 15 s y reintento automático por foto (no acelerar: evita 429 en Gemini).
- **Resultado** — la sesión recién creada: primera foto grande 4:5, el resto en 2 columnas 3:5, la foto de prueba al final. Etiquetas simples según el rol de la directiva (`sessionPlan.shots[i].role`): HERO "Foto principal", SELFIE "Selfie", EXPRESSION "Expresión", DETAIL "Detalle", INTERACTION "En la mano", LIFESTYLE "En uso", ALT_ANGLE "Otro ángulo", CONTEXT "El lugar"; sin rol, "Foto N"; en colección, "Producto N". Descarga individual, "Descargar todas" (ZIP), "Nueva sesión", y botón para crear otra versión de una foto (máx. 3).
- **Historial** — chips Todas/Persona/Producto/Look/Lugar, tarjetas 2 columnas 3:4 con portada, cantidad de fotos, título y fecha. Al tocar abre la sesión en la vista Resultado. Botón "Elegir" activa la selección múltiple (descargar/borrar varias con la barra flotante).

### Flujo anterior (Eliminado el 29-sep-2026)
Antes era una sola pantalla de configuración con enfoque, rostro, 3 casilleros de "referencias de contexto", checkbox "¿Es complemento del contexto?", tamaño, selector de motor y cantidad, todo junto. Se reemplazó por el wizard de 4 pasos porque pedía ~8 decisiones a la vez. Al terminar saltaba directo al historial; ahora muestra el Resultado.
- **Checkbox "¿Es complemento del contexto?" (`isProductComplement`) — Eliminado el 29-sep-2026.** Ahora subir el objeto ya es la decisión: `useProduct = focus === 'PRODUCT' ? true : !!productRef`.
- **`MasterLoader` y `CostSummary` — Sin uso desde el 29-sep-2026.** Los archivos siguen en `components/`, pero el módulo ya no los monta (la espera y el costo se muestran dentro del wizard).
- **Estado `batchMode` (modo múltiple admin) — Eliminado el 29-sep-2026.** Era estado sin UI ni lógica (no hacía nada), por eso se quitó.

---

## Producto con varios ángulos (desde 29-sep-2026)

En "Un producto" se sube la foto principal (obligatoria) y hasta 2 ángulos extra opcionales (costado, atrás, detalle). Se guardan en `set.productAngles`. Se pasan a `generateImage0(..., productAngles)` y a cada `generateDerivedShotAsync(..., productOptions: { productAngles })`, así el producto sale más fiel en fotos de detalle y de costado. También se usan al "Probar otra" foto de prueba y al regenerar/reintentar una foto. Solo aplica a PRODUCT.

## Modo colección (desde 29-sep-2026)

En "Una colección" se suben de 2 a 6 productos distintos (`set.collectionRefs`). La sesión tiene una foto por producto (`userShotCount = collectionRefs.length`), con la misma persona, lugar y luz.
- La foto de prueba (REF0) y `buildSessionPlan` usan `collectionRefs[0]`; `set.productRef` guarda ese primero.
- La foto derivada `i` (0-based dentro de `set.shots`) usa `collectionRefs[i]` y `productOptions = { isCollection: true }`.
- Esto se resuelve en un solo helper (`getShotProduct(set, índice)`) que usan la producción normal, `retryFailedShots` (usa el índice real de la foto dentro de `shots`, no el orden del reintento) y `regenerateShot`. Así cada foto usa SU producto también en los reintentos.
- Con un solo producto no se puede continuar; se sugiere usar "Un producto".
- Solo aplica a PRODUCT.

## Compatibilidad con sesiones viejas
Las sesiones guardadas antes de este cambio no tienen `productAngles`, `collectionRefs` ni `modelName`: todos son opcionales y el código cae a los valores por defecto (sin ángulos, sin colección, título "Tu sesión ..."). Las regeneraciones usan el `sessionPlan` guardado en cada set (antes usaban por error el plan de la última sesión creada).

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
Componente principal. Recibe `avatars?: AvatarProfile[]` (modelos guardados, default `[]`). Maneja el flujo completo: wizard de 4 pasos → foto de prueba → aprobación → creación de fotos → resultado, más el historial. Reusa `WizardStepper`, `WizardFooter`, `ImageSlot`, `ImageLightbox`, `ErrorDisplay` y `FloatingActionBar`. Íconos con `lucide-react` (sin emojis ni Font Awesome). Mantiene: cobro único con reembolso automático (`REFUNDABLE_ERRORS`), generación gratis de onboarding (`onboarding_free_generation`), retomar sesión desde notificación (`?session=...`, si todas las fotos ya terminaron abre directo el Resultado), modal de fotos incompletas con reintento solo de las fallidas.

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
Panel visual que muestra el costo antes de generar: créditos por shot, total, créditos restantes. **Sin uso desde el 29-sep-2026** (el costo ahora se muestra en el paso "Revisar" del wizard). Igual que `components/MasterLoader.tsx`.

---

## Modelo de costos

| Qué | Costo |
|-----|-------|
| Generar REF0 | 2 créditos (UGC_PER_SHOT) |
| Cada shot derivado | 2 créditos (UGC_PER_SHOT) |
| Sesión completa (REF0 + 6 shots) | 14 créditos |
| Con Seedream | 1 crédito/shot (mitad) |
| No usa pro-credits | — |

---

## Decisiones técnicas importantes

**¿Por qué REF0 primero?**
Sin una imagen ancla, cada shot se genera de forma independiente y pueden verse completamente distintos (diferente luz, diferente ambiente, diferente tono). REF0 "congela" la realidad visual de la sesión.

**¿Por qué la cara se duplica en las referencias?**
Gemini da más peso a las primeras referencias del array. Duplicar la cara asegura que la identidad facial tenga prioridad absoluta sobre el REF0 al interpretar quién es la persona.

**¿Por qué hay versión larga y corta del negative prompt?**
Los prompts demasiado largos pueden causar timeout en el endpoint. REF0 usa la versión completa. Los shots derivados usan una versión más corta pero reforzada con los locks principales.
