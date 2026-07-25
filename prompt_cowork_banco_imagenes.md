# Prompt para Cowork — Organizar banco de imágenes de referencia (Luz IA Studio)

> Copia todo el contenido de este archivo y pégalo como instrucción a Cowork. Antes de pegarlo, reemplaza `[RUTA_CARPETA_ORIGEN]` por la ruta real de la carpeta con las imágenes, y `[RUTA_CARPETA_DESTINO]` por dónde quieres que quede el banco organizado.

---

## Rol y objetivo

Actúa como organizador experto de banco de imágenes de referencia visual. Tengo una carpeta con más de 500 imágenes descargadas de creators reales de Instagram/TikTok (fotos de outfits, selfies, viajes, unboxings, productos, etc.). Estas imágenes son la carpeta `[RUTA_CARPETA_ORIGEN]`, y hoy están parcialmente organizadas por tema pero sin un criterio consistente.

Necesito que las reorganices en una nueva carpeta `[RUTA_CARPETA_DESTINO]` siguiendo la taxonomía exacta que te doy abajo, porque este banco se usará después para comparar visualmente contra resultados generados por IA: por ejemplo, "compara estos 4 resultados nuevos contra 10 imágenes del banco de outfit_haul" o "contra el banco de selfies auténticos". Por eso la clasificación tiene que ser precisa y consistente, no aproximada.

## Reglas generales

1. **No borres ni modifiques los archivos originales.** Trabaja siempre sobre copias. Si el volumen de datos es un problema, puedes usar accesos directos/symlinks en vez de copiar, pero nunca muevas el original fuera de `[RUTA_CARPETA_ORIGEN]` sin dejar una copia clasificada en el destino.
2. **Conserva el nombre de archivo original** dentro de cada copia (puedes anteponer un prefijo si necesitas evitar colisiones de nombre, pero no lo elimines).
3. Cada imagen puede (y en muchos casos debe) aparecer en **más de una carpeta**, porque hay dos ejes de clasificación distintos y son independientes entre sí (ver abajo). No fuerces que una imagen viva en un solo lugar.
4. Si una imagen no encaja claramente en ninguna categoría, ponla en `_sin_clasificar/` — no la fuerces ni la descartes.
5. Si una imagen es un **mal ejemplo** de algo (pose muy rígida/artificial, mala iluminación, manos/anatomía distorsionada, encuadre confuso, marca de agua invasiva), ponla en `_evitar/` con una nota de por qué. Sirve como contraejemplo de qué NO imitar.
6. Al final de cada categoría, genera un archivo `indice.md` que liste cada imagen incluida con una línea de justificación (por qué calificó, o por qué es "hero"). No hace falta que sea exhaustivo por imagen si vienen en tandas muy similares — puedes agrupar justificaciones para lotes parecidos, pero cada imagen debe quedar mencionada por su nombre de archivo.

## Estructura de carpetas a crear

```
[RUTA_CARPETA_DESTINO]/
├── por_receta/
│   ├── outfit_haul/
│   │   ├── hero/
│   │   └── general/
│   ├── outfit_week/
│   │   ├── hero/
│   │   └── general/
│   ├── outfit_check/
│   │   ├── hero/
│   │   └── general/
│   ├── unboxing/
│   │   ├── hero/
│   │   └── general/
│   ├── product_haul/
│   │   ├── hero/
│   │   └── general/
│   ├── day_in_life/
│   │   ├── hero/
│   │   └── general/
│   ├── bts/
│   │   ├── hero/
│   │   └── general/
│   ├── travel/
│   │   ├── hero/
│   │   └── general/
│   └── campaign_ugc/
│       ├── hero/
│       └── general/
├── por_tipo_shot/
│   ├── full_body_mirror/
│   ├── selfie_close_up/
│   ├── detalle_producto/
│   ├── flat_lay_overview/
│   ├── lifestyle_ambiente/
│   ├── accion_uso/
│   ├── social_acompanante/
│   └── unboxing_reveal/
├── _sin_clasificar/
└── _evitar/
```

## Eje A — Clasificación por receta/módulo

Evalúa qué tipo de contenido/historia muestra la imagen y clasifícala en la(s) receta(s) donde sería más útil como referencia:

- **`outfit_haul`** — Persona probándose o mostrando varias prendas/accesorios de una sola vez (try-on, "esto es lo que me compré", ropa sobre la cama o rack, prendas + persona luciéndolas).
- **`outfit_week`** — Colección de looks/outfits distintos pensada como resumen ("mis favoritos de la semana"), o foco en accesorios/bolsos/joyería/maquillaje como protagonista repetido.
- **`outfit_check`** — Una sola prenda/look, con contexto de "me estoy alistando para algo": espejo, probador, habitación, seguido de la salida a un destino puntual (evento, cena, calle).
- **`unboxing`** — Momento de abrir una caja o empaque: caja cerrada, manos abriendo, producto revelado, packaging visible.
- **`product_haul`** — Persona mostrando o usando varios productos (skincare, maquillaje, gadgets, comida, wellness) sin foco en ropa.
- **`day_in_life`** — Serie de momentos distintos de un día o evento (mañana en el gym, oficina, cena) — varias escenas/lugares distintos en la misma narrativa.
- **`bts`** — Detrás de cámaras de una sesión, backstage, proceso de trabajo/producción (el foco es el "cómo se hizo", no el resultado final).
- **`travel`** — Persona en un viaje o lugar turístico/destino, la escena y el lugar son protagonistas junto con la persona.
- **`campaign_ugc`** — Imagen con tono comercial/publicitario tipo creador recomendando un producto a cámara, pero que no encaja en ninguna receta específica de arriba (más genérica, apta para anuncios).

Una misma imagen puede calificar para más de una receta (ej. una foto de "day_in_life" en un viaje también puede ir en "travel"). Cópiala en ambas.

## Eje B — Clasificación por tipo de shot / composición

Evalúa el encuadre y composición visual, independientemente de la receta:

- **`full_body_mirror`** — Cuerpo completo, de pie, generalmente frente a un espejo o en una pose de "mirar el look completo".
- **`selfie_close_up`** — Selfie o plano medio con la cara como protagonista dominante (expresión facial, mirada a cámara).
- **`detalle_producto`** — Close-up/macro de una prenda, accesorio o producto específico (textura, logo, detalle de diseño), sin que el foco sea la cara o el cuerpo completo.
- **`flat_lay_overview`** — Vista desde arriba o composición plana de varios ítems juntos sobre una superficie (cama, mesa, piso) — nadie los está usando puestos, es una "vista general".
- **`lifestyle_ambiente`** — Toma de ambiente/lugar sin que la persona sea el foco principal (o sin persona visible), transmite mood/lugar.
- **`accion_uso`** — La persona está usando/aplicando activamente el producto o prenda (aplicando skincare, tomando una bebida, ajustándose ropa).
- **`social_acompanante`** — Aparece más de una persona interactuando (amigos, pareja), momento social compartido.
- **`unboxing_reveal`** — Momento específico de abrir algo o revelar un producto recién sacado de su empaque.

## Criterio "hero" vs "general" (dentro de cada carpeta de receta)

Dentro de cada subcarpeta de `por_receta/`, separa las imágenes en:

- **`hero/`** — Las 5 a 10 mejores imágenes de esa categoría. Deben cumplir la mayoría de estos criterios: nitidez alta, pose natural (no rígida ni artificial), buena iluminación (no sobreexpuesta ni muy oscura), encuadre limpio sin elementos que distraigan del sujeto principal, composición que se sentiría "posteable" en Instagram hoy mismo.
- **`general/`** — El resto de imágenes que califican para la categoría pero no son el top absoluto — igual de válidas como referencia, solo no las más ejemplares.

## Entregable final

1. La estructura de carpetas completa de arriba, poblada.
2. Un `indice.md` dentro de cada carpeta hoja (`hero/`, `general/`, y cada carpeta de `por_tipo_shot/`) listando los archivos incluidos y por qué.
3. Un resumen general al final (`RESUMEN.md` en la raíz de `[RUTA_CARPETA_DESTINO]`) con: total de imágenes procesadas, cuántas cayeron en cada receta, cuántas en cada tipo de shot, cuántas quedaron en `_sin_clasificar` y en `_evitar`.

Si tienes dudas sobre a qué categoría pertenece un lote grande de imágenes similares, pregúntame antes de clasificar todo el lote de la misma forma incorrecta.
