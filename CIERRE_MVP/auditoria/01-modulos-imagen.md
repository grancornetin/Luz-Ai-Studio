# Auditoría 01: módulos de imagen y qué se puede reutilizar para el Piloto de joyería

Solo lectura. Rutas desde `src/`. Todo lo citado lo leí en el código; lo que no pude verificar está marcado "NO VERIFICADO".

## 1) Tabla resumen

| Módulo | Qué hace de verdad | ¿Sirve para joyas? | Punto de entrada reutilizable | Cómo protege la fidelidad del producto |
|---|---|---|---|---|
| Product Studio (`modules/productGenerator`) | Dado fotos del producto + nombre, un "director" decide el tipo de fotos (principal, detalle, ángulo, contexto, vista de arriba) y arma el prompt de cada una. Modo "Recrear" copia una foto de inspiración cambiando solo el producto. | SÍ, es el más cercano. Ya tiene categoría `jewelry` (productDirectorService.ts:44, 288-301, 861-869) y un plan de fotos para joyas (1211, 1248, 1267). | `runProductDirector()` (productDirectorService.ts:1557) y `buildPromptPayloadsFromDirectorResult()` (:1651). Son funciones puras: no tocan pantalla. Luego `imageApiService.generateImage()`. | Muy buena en texto: ~20 reglas duras (:442-695), lista negativa (:386-440), fotos del producto rotuladas `PRODUCT_IDENTITY_REF_n` (ProductGeneratorModule.tsx:232-246). PERO la imagen igual se regenera con IA; no hay recorte del producto real. |
| Scene Clone (`modules/sceneClone` + `services/cloneImageService.ts`) | Toma una foto de escena y mete en ella a TU modelo (cara + cuerpo), opcionalmente con otra ropa o reemplazando objetos detectados. | A medias. Sirve para "joya puesta en una persona" porque reemplaza accesorios (`productOverrides`), pero exige foto de rostro y cuerpo. | `cloneImageService.cloneImage()` (cloneImageService.ts:768) y `analyzeScene()` (sceneAnalysisService.ts:16). | Mide la fidelidad de la PERSONA, no la del producto. Al contrario: borra a propósito las joyas de la foto original (cloneImageService.ts:263, 291-308) y "estabiliza" bajando nitidez de logos y detalles (:335-348), lo que daña una joya. |
| Outfit Extractor (`modules/outfitExtractor/outfitService.ts`) | Detecta prendas en una foto de outfit y renderiza cada una aislada en fondo blanco; luego arma el outfit completo. | Poco. Tiene regla "accesorio" (outfitService.ts:132-141) pero su lista negativa base prohíbe `jewelry` (:85) y manda "reconstruir lo oculto" (:82), o sea inventar. | `outfitService.generateItemRender()` (:545), `analyzeOutfit()` (:485). | Reglas de aislamiento (:78-144), pero permiten inventar partes tapadas: riesgo para joyas. |
| UGC Studio (`modules/contentStudioPro`) | Sesión de 6 fotos "tipo iPhone" con una misma persona, luz y lugar. Primero una foto ancla (REF0), luego 5 derivadas. Enfoque PRODUCT con categoría JOYERÍA. | SÍ para estilo de vida y "en el cuerpo", pero SIEMPRE con persona. Obliga a tener foto de rostro (service.ts:1235; sin producto lanza error :1276). | `contentStudioService.buildSessionPlan()` (service.ts:1211), `generateImage0()` (:1235), `generateDerivedShotAsync()` (:1404). | Sistema de candados (service.ts:236-287), candado de producto (:1564-1568), ángulos extra del mismo producto (:1429-1450), anti-deriva (:1488-1513). Texto solamente, sin verificación. |
| Prompt Studio (`promptLibrary/components/PromptComposer.tsx` + `hooks/usePromptComposer.ts`) | Generador libre: texto + hasta 4 referencias con prioridad y "candado". Modos estándar, campaña, photodump. | Como motor genérico sí; no tiene nada de joyería. | NO reutilizar el componente ni el hook (son pantalla + cobro). Sí `promptBuilder.buildPrompt()` (services/promptBuilder.ts:100) y `generationService.generateImage()` (services/generationService.ts:49). | Candado "duro" de producto: forma, materiales, proporciones, marca (promptBuilder.ts:40-41). Es un párrafo genérico. |
| `services/imageApiService.ts` | El único camino a la IA de imágenes: arma el trabajo, espera (cada 2 s), reintenta si hay límite, guarda historial. | Sí, es la base de todo. | `imageApiService.generateImage()` (:335), `generateBatch()` (:372), `extractImageRef()` (:401). | No hace nada de fidelidad; solo transporte. |

## 2) Qué módulo resuelve cada tarea

Resumen del spike de fidelidad (CIERRE_MVP/spikes/fidelidad-informe.md): con IA libre las joyas se deforman; solo el recorte del producto real puesto sobre fondo generado es fiel.

- **Foto de catálogo limpia:** Product Studio, estilo `minimal`, un solo tipo HERO (`count: 1`). Llamar `runProductDirector({productImages, productTitle:'anillo ...', objective:'ecommerce', style:'minimal', mode:'pack', count:1})` y luego `buildPromptPayloadsFromDirectorResult()` (:1651), luego `imageApiService.generateImage({prompt, negative, referenceImages})`. Formato cuadrado 1:1 (:788-802). Fidelidad: buena en texto, pero regenerada. Para fidelidad real falta el recorte (ver punto 4).
- **Detalle macro:** Product Studio, forma `DETAIL` (:1458-1469, "recorte cerrado, no inventar texturas"). Con `count:4` en joyas sale HERO, DETAIL, ANGLE, CONTEXT (:1248). Hay que pedirlo ya en llamada directa.
- **Producto en mano / cuello / oreja:** dos opciones, ninguna probada para joyas reales. (a) UGC Studio enfoque PRODUCT con categoría JEWELRY: la directiva `holding` dice "joya sostenida con dedos delicados o puesta en cuello, muñeca, oreja" (ugcDirectorService.ts:678-682); necesita foto de rostro de un modelo. (b) Scene Clone con `productOverrides`. El spike dice que "en el cuerpo" NO PASA hoy.
- **Escala (el tamaño real de la joya):** NO está resuelta. `productSize` (Chico/Mediano/Grande, ContentStudioProModule.tsx:116-119) solo es una etiqueta de pantalla: llega hasta `buildProductShotDirectives()` pero ese código no la usa en ningún prompt (ugcDirectorService.ts:666-835). Hay que construirla (p. ej. "al lado de una moneda/mano").
- **Flatlay / regalo:** Product Studio forma `TOP` ("vista de arriba, flat-lay", :1471-1479) o estilo `natural`/`premium` (superficie lino, mármol, papel: :1141-1143). La caja de regalo y el empaque NO existen como receta; hay que pedirlos por texto.
- **Escena de estilo de vida:** Product Studio forma `CONTEXT` sin personas (:1481-1491) o estilo `lifestyle`. Con persona: UGC Studio (decorado de joyería ya definido: tocador, luz natural, service.ts:717).
- **Carrusel:** NO existe como pieza de publicación. "Carrusel" aparece solo como control de pantalla (UGC Studio, tarjetas deslizables). Lo más cercano: Product Studio `pack` de 4-6 fotos, o modo `grid` 2x2/3x3 que arma un collage por IA (ProductGeneratorModule.tsx:454-493), el cual vuelve a generar y puede cambiar el producto. Para el Piloto conviene armar el carrusel uniendo fotos ya aprobadas.

## 3) Reglas y prompts valiosos para NO perder

En `productGenerator/productDirectorService.ts`:
- `PRODUCT_IDENTITY_RULES` (:450): las fotos del producto solo dicen cómo es el producto; el fondo/mesa/cables de esas fotos se ignora. "Fidelidad antes que creatividad".
- `PRODUCT_ANATOMY_LOCK_RULES` (:461) y `PRODUCT_SILHOUETTE_RULES` (:484): no inventar cierres, asas, tapas, partes; el producto manda sobre la referencia.
- `PRODUCT_BRANDING_RULES` (:492): si la foto no trae logo ni texto, el resultado tampoco. Clave para joyas sin marca.
- `INPUT_ARTIFACT_RULES` (:518): ignorar muestras de color, capturas, marcas de agua que vengan en la foto.
- `PAIR_AND_MULTIPLE_PRODUCT_RULES` (:510): los aros deben ser el mismo par, sin duplicar.
- `PRODUCT_VISIBILITY_RULES` (:502) y `HUMAN_CONTEXT_RULES` (:661): el producto siempre se lee primero; sin manos/personas por defecto.
- Familia de reglas de "Recrear" (:525-650): leer la intención de la foto de referencia, mantener cámara, izquierda/derecha, props; adaptar la interacción al producto y no al revés (:473).
- `PRODUCT_NEGATIVE_PROMPT` (:386-440): lista de unos 50 vetos (producto híbrido, logo inventado, texto, collage, etc.).
- `sanitizeAnchor` (:713): quita "sostenido por / puesto en maniquí" de la descripción del producto.
- Regla de largo: no repetir bloques de reglas por el tope de 32 000 caracteres de la API (comentario en :1674-1678).

En `contentStudioPro/service.ts`: `LOCK_SYSTEM` (:236-287), candado de producto y ángulos extra (:1564-1568, :1429-1450), `NEGATIVE_FULL/SHORT` (:128), regla "producto manda sobre outfit" (:1319-1326), anti-deriva (:1488-1513), escena y outfit neutros para joyería (:717, :730).

En `cloneImageService.ts`: bloque "autoridad por atributo" (:310-320) y "no mezclar referencias".

En `imageApiService.ts`: errores reembolsables (:60), reintentos por límite de uso y de concurrencia (:24-37, 342-361). Esto conviene mantenerlo tal cual.

Del spike (CIERRE_MVP/spikes/fidelidad-informe.md): estrategia C (recorte real sobre fondo generado), el conteo automático de piedras no sirve de juez.

## 4) Qué NO existe y habría que construir

1. Recorte del producto real y composición determinista sobre fondo (la estrategia C del spike). No encontré nada de recorte/quitar fondo en `modules/` ni `services/` (búsqueda por upscale/cutout/recorte sin resultados útiles).
2. Escala real de la joya (ver punto 2).
3. Verificador de fidelidad (comparar resultado contra original). El spike lo probó ruidoso; hoy el único control es la vista humana.
4. Recetas de joyería: aros en par, cadena colgando, anillo en dedo, caja de regalo/empaque, textura de metal/piedras (el director de Product Studio solo tiene frases genéricas, :1141-1143).
5. Carrusel como pieza (portada + diapositivas) y formatos vertical 4:5 / 9:16 por pieza. Product Studio solo sale 4:5 con objetivo `social` y 1:1 en los demás (:788-802).
6. Joyería sobre cuerpo sin exigir un "modelo" con rostro y cuerpo.
7. Análisis de foto específico de joyas (largo de cadena, número de piedras, tipo de broche). Hoy `geminiAnalyzeProduct` (:990) pide una descripción general (esquema PRODUCT_ANALYZER_SCHEMA en constants.tsx:30-46).

## 5) Riesgos de reutilizar

- **Pantalla pegada a la lógica.** Los módulos grandes (ProductGeneratorModule.tsx 867 líneas, SceneCloneModule 1272, ContentStudioProModule 2502) mezclan estado, cobro y generación. La parte lista para llamar sin pantalla son los servicios: `productDirectorService.ts`, `cloneImageService.ts`, `outfitService.ts`, `contentStudioService`. La orquestación (REF0 + 5 fotos con pausa de 15 s y reintentos, doc UGC) vive dentro del módulo y habría que reescribirla.
- **Créditos en el navegador, no en el servidor.** `imageApiService` no cobra; el cobro y reembolso viven en el hook `useCreditGuard` (hooks/useCreditGuard.ts) y en `usePromptComposer.ts:77-87, 161-164`. Busqué "credit" en `api/gemini/image.ts` y no apareció. Para el Piloto privado, cada llamada gasta dinero real sin freno, salvo que el piloto ponga su propio tope (existe el "ledger" W8 en los contratos del piloto, solo lo vi mencionado).
- **Navegador obligatorio.** `service.ts` usa `document.createElement('canvas')` (:48-72) y `outfitService` usa `compressImageForUpload` (utils/imageUtils, NO VERIFICADO si necesita canvas). No sirven en un proceso de servidor sin ajustes.
- **Formato fijo.** UGC siempre pide 3:4 (service.ts:1166); `generationService.generateImage` también 3:4 (:60). Cuadrado y 4:5 solo en Product Studio.
- **Tope de peso de pedido.** Imágenes comprimidas a 1024 px (service.ts:111) y 768 px los ángulos extra: esto puede borrar detalle fino de una joya.
- **Estilo "foto de iPhone".** UGC y Scene Clone prohíben pulido de estudio y mejoran poco; sirven para humanos creíbles, no para macro nítido de joyas.
- **Reglas que chocan con joyas.** Scene Clone borra joyas; Outfit Extractor prohíbe `jewelry`; ambos inventan zonas tapadas.
- **Doble copia de PromptComposer.** Existe `modules/promptLibrary/PromptComposer.tsx` y `modules/promptLibrary/components/PromptComposer.tsx`; el segundo es el que tiene modos campaña/photodump. Hay que tener claro cuál se usa si se toca.
- **Tamaño del prompt.** La API corta a 32 000 caracteres (productDirectorService.ts:1674).
- **Contenido bloqueado.** El spike vio que una argolla fue bloqueada por filtro de contenido en 2 estrategias; hace falta ruta de reintento.

## No verificado
- Cómo se ve en la práctica el resultado de Product Studio con joyas reales (el spike usó 3 fotos de Wikimedia, no las de la emprendedora).
- `compressImageForUpload` y si cada módulo funciona sin pantalla en un entorno sin navegador.
- Que el servidor no cobre de otra forma (revisé `api/gemini/image.ts` por la palabra "credit": sin resultados).
- Qué hace `ugcApiService.generateImageAsync` en el servidor además de lo leído (:101-120).
