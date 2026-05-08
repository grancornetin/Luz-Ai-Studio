# Campaign Generator — Guía del Módulo

> **REGLAS DE MANTENIMIENTO PARA IA:**
> 1. Este archivo debe mantenerse actualizado con el estado real del módulo.
> 2. Cada vez que se agregue, modifique o elimine un feature relevante, actualizar la sección correspondiente.
> 3. Actualizar la fecha de "Última actualización" con cada cambio.
> 4. No borrar secciones — si algo fue eliminado, marcarlo como "Eliminado en [fecha]" y explicar por qué.
> 5. El objetivo es que otra IA pueda leer este archivo y entender completamente qué hace el módulo, cómo funciona, y en qué estado está, sin necesidad de leer el código.

**Última actualización:** Mayo 2026  
**Propósito:** Crear kits de campaña publicitaria completos para emprendedores latinoamericanos que venden en Instagram, TikTok, WhatsApp y Facebook.

---

## Qué hace este módulo

Campaign Generator es la herramienta más completa de Luz IA Studio. No es un generador de imágenes — es una agencia creativa completa que entrega:

- Un **plan estratégico** de 7 días con concepto creativo, promesa de campaña y tagline
- **Imágenes generadas por IA** con consistencia visual entre sí (mismo estilo, misma luz, misma estética)
- **Copy completo** por cada imagen: titular, caption, CTA, hashtags
- **Instrucciones de publicación** específicas por día y canal
- **Banco de hashtags** en 3 niveles estratégicos (comunidad, nicho, cola larga)
- **Kit descargable** en ZIP (imágenes), PDF (documento de agencia) y HTML interactivo (con checkboxes para marcar el progreso)

---

## Flujo completo para el usuario

### Paso 1 — Brief
La emprendedora escribe con sus propias palabras qué quiere hacer. Sin formularios técnicos.  
También puede subir hasta 12 imágenes en 4 categorías:
- 📦 **Producto** — fotos de lo que vende (hasta 4 ángulos)
- 🖼️ **Inspiración** — estética que le gustó de Pinterest o Instagram (hasta 4)
- 🎨 **Marca** — logo, packaging, colores de su marca (hasta 4)
- 👤 **Modelo** — foto de ella o su modelo (hasta 4)

### Paso 2 — Canales
Elige dónde va a publicar: Instagram Feed, Instagram Stories, TikTok, WhatsApp/Catálogo, Anuncios Facebook.

### Paso 3 — Cantidad y costo
Elige cuántas imágenes quiere (1 a 8). Ve el desglose completo antes de confirmar:
- 2 propuestas de estilo → 4 créditos
- N imágenes de campaña → N×2 créditos
- 1 pro-credit por sesión

### Paso 4 — Generando estilo
La IA analiza el brief y las imágenes, construye el plan estratégico, y genera 2 propuestas de estilo visual (Opción A y Opción B). Las imágenes aparecen en pantalla a medida que se generan.

### Paso 5 — Aprobar estilo
La emprendedora elige la imagen que más le gusta. Esa imagen se convierte en el "ancla visual" de toda la campaña — define la luz, el color y la composición de todas las demás imágenes. Si ninguna convence, puede pedir 2 nuevas por 4 créditos adicionales.

### Paso 6 — Generando campaña
Con el estilo aprobado, genera las N imágenes. Cada una aparece en pantalla apenas está lista. Las referencias van estratificadas: modelo primero (identidad), producto después, ancla, inspiración, marca.

### Paso 7 — Resultados
Kit completo con 3 tabs: Piezas / Calendario / Hashtags.  
Botones de descarga: ZIP · Versión interactiva · PDF

---

## Archivos del módulo

### `CampaignModule.tsx`
El componente principal de la interfaz. Contiene todos los pasos del wizard, los formularios, la lógica de navegación entre pasos, los botones de descarga y la biblioteca de campañas guardadas. Es el archivo más grande del módulo.

**Qué contiene:**
- El wizard de 7 pasos completo
- El componente `ImageUploadSlot` para subir imágenes por categoría
- La lógica de cobro de créditos antes de cada generación
- Los handlers: `handleGenerateAnchor`, `handleRegenerateAnchor`, `handleGenerateCampaign`
- La vista de resultados con tabs (Piezas / Calendario / Hashtags)
- La biblioteca de campañas guardadas

### `campaignService.ts`
El "director creativo" del módulo. Toda la inteligencia está acá.

**Qué hace:**
- `buildCampaignPlan()` — manda el brief + imágenes a Gemini 2.5 con un prompt de director creativo senior. Gemini devuelve el plan estratégico completo: concepto, tagline, promesa, 7 días de calendario, copy por pieza, hashtags de nicho.
- `generateAnchorImages()` — genera las 2 propuestas de estilo (Opción A y B) con prompts distintos. Devuelve cada URL apenas termina para mostrarlas en tiempo real.
- `generateCampaignImages()` — genera las N imágenes de la campaña usando la ancla aprobada como referencia base. Cada imagen tiene su propio prompt construido por `buildDerivedImagePrompt()`.
- `buildStratifiedRefsCompressed()` — arma el array de referencias estratificado (modelo x2, producto x2, ancla, inspiración, marca) y comprime todo antes de enviarlo para evitar errores 413.
- `selectBestRefs()` — si la emprendedora subió muchas fotos del mismo producto, elige las 3 más representativas (primera, medio, última).

**Sistema de locks (inspirado en UGC Studio):**
Cada prompt incluye instrucciones explícitas para que Gemini respete la identidad del modelo, el producto exacto, el estilo visual del ancla y la paleta de marca. Esto garantiza consistencia visual entre todas las imágenes de la campaña.

### `campaignPdfService.ts`
Genera los dos entregables descargables: el PDF y el HTML interactivo.

**Qué hace:**
- `buildHtml(set)` — construye el HTML completo de la campaña con los datos reales. Convierte las URLs de imágenes a base64 para que funcionen offline.
- `downloadCampaignHtml(set)` — descarga el kit como archivo `.html` interactivo. Los checkboxes del calendario guardan el progreso en localStorage (persiste aunque se cierre el navegador). Los hashtags son copiables con un click. Incluye botón para exportar PDF desde el propio archivo.
- `downloadCampaignPdf(set)` — inyecta el HTML en un iframe oculto, espera que carguen las fuentes, y usa html2canvas + jsPDF para generar el PDF con fidelidad visual total.

**Páginas del PDF:**
1. Portada dark con tagline, concepto, stats y resumen ejecutivo
2. Estrategia (concepto, promesa, canales, resumen ejecutivo)
3. Calendario de 7 días con checkboxes interactivos
4. Una página por pieza (imagen + titular + caption + CTA + hashtags + instrucción)
5. Banco de hashtags (3 grupos con explicación de uso)

### `campaignStorage.ts`
Guarda y recupera las campañas generadas en IndexedDB (almacenamiento local del navegador). Cada campaña se guarda con su plan completo, imágenes, ancla elegida y todos los metadatos.

**Métodos:** `save(set)`, `list()`, `delete(id)`

### `types.ts`
Define todos los tipos TypeScript del módulo.

**Tipos principales:**
- `CampaignChannel` — los 5 canales de publicación disponibles
- `ImageSlotRole` — los 4 roles de imágenes que puede subir la emprendedora
- `CampaignPiece` — una pieza individual de la campaña (imagen + copy + instrucciones)
- `CampaignPlan` — el plan completo (concepto, tagline, promesa, piezas, hashtags, calendario)
- `CampaignSet` — lo que se guarda en la biblioteca (plan + slots + ancla + metadatos)
- `ANCHOR_IMAGE_COUNT` y `CREDITS_PER_IMAGE` — constantes de costo

---

## Modelo de costos

| Qué | Costo |
|-----|-------|
| 1 sesión Campaign | 1 pro-credit |
| 2 propuestas de estilo (ancla) | 4 créditos |
| Cada imagen de campaña | 2 créditos |
| Regenerar el ancla | 4 créditos extra |
| Descargar ZIP / PDF / HTML | Gratis |

**Ejemplo:** Campaña de 4 imágenes = 1 pro-credit + 4 cr (ancla) + 8 cr (imágenes) = 1 pro-credit + 12 créditos

---

## Decisiones técnicas importantes

**¿Por qué se generan 2 imágenes ancla antes de la campaña?**  
Para garantizar consistencia visual. La imagen ancla (REF0) actúa como referencia de sesión para todas las imágenes de la campaña — define la luz, la paleta y la estética. Sin ancla, cada imagen se genera de forma independiente y pueden verse muy distintas entre sí. Este sistema está inspirado en cómo funciona UGC Studio.

**¿Por qué se comprimen las imágenes antes de enviarlas?**  
Los endpoints de Vercel tienen un límite de ~4.5MB por request. Fotos de celular sin comprimir pesan 3-5MB cada una. Con múltiples referencias el payload explota. Se comprimen a 768px/0.80 antes de enviarse para generación, y a 512px/0.75 para el análisis de Gemini.

**¿Por qué se genera cada imagen individualmente y no en batch?**  
Para mostrar las imágenes en pantalla a medida que terminan, sin esperar a que termine todo el proceso. Mejora la percepción de velocidad para la emprendedora.

---

## Pendientes / Mejoras futuras

- Integración con el módulo de Proyectos (guardar automáticamente el kit completo en un proyecto)
- Perfil de Marca como módulo separado que alimenta a Campaign con datos del negocio
- Texto en imágenes: instrucción explícita de cuándo usar texto y con qué estilo (alineado a la inspiración visual subida)
- Hoja de configuración/brief/prompts al final del PDF
