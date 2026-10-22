# Spike de fidelidad — informe (22-oct-2026)

**Fotos:** 3 piezas de Wikimedia (anillo con piedras, collar de cadena trenzada con dos cabezas, argolla). NO son de la emprendedora: el criterio queda **NO VALIDADO con producto real** (bloqueo U1).
**Gasto real:** 32 imágenes, USD 2,65 (tope 4). Costo medio USD 0,068 por imagen, 18 s. Detalle: `fidelidad-gasto.csv`. Resultados: `scripts/piloto-spikes/resultados.json`.
**Estrategias:** A = generación libre con la foto de referencia. B = edición conservadora. C = recorte del producto original compuesto sobre fondo generado (el pixel del producto no cambia).

## Hallazgo clave
El control automático (conteo de piedras/eslabones con Gemini visión) es **ruidoso**: puntúa 70 a piezas que a simple vista son idénticas (cuenta 13 piedras donde hay 8), y bloqueó cosas buenas. Sirve como alarma, no como juez único. Lo que decide es la revisión visual + la estrategia C.

## Veredicto por receta (revisión visual de una hoja de contacto con 2 productos; la argolla solo por puntaje automático)
| Receta | Veredicto | Estrategia a usar |
|---|---|---|
| 1 Catálogo limpio | **PASA** | C (recorte sobre fondo neutro/seda/piedra). Fiel por construcción |
| 5 Flatlay / regalo | **PASA** | C (recorte + lino + caja kraft) |
| 2 Detalle macro | **PASA RESTRINGIDA** | B/C; el anillo en B se ve fiel, la cadena en C también; revisar siempre y reintentar. A falló en argolla (20) y cadena (50) |
| 4 Escala | **PASA RESTRINGIDA** | Solo donde la pieza se vea completa; resultados desiguales (1/3 por receta) |
| 3 En el cuerpo (mano/cuello) | **NO PASA hoy** | En el anillo sobre mano la pieza sale diminuta e infiel; en el collar de cuello la cadena cambia de forma. Dejar fuera o solo con foto original recortada sobre cuerpo generado |
| 6 Estilo de vida | **NO PROBADA** | Sin generaciones por tope de gasto |

## Recomendación para W5
1. Estrategia por defecto = **C (composición determinista)**: el producto real nunca se regenera. Es la única que garantiza fidelidad.
2. Generación libre (A) solo para fondos/escenas sin producto, o para macro con revisión.
3. Control automático = alarma, umbral 80 solo como filtro, con **fallback a la foto original mejorada**; no confiar en el conteo de piedras para piezas complejas.
4. Receta "en el cuerpo" apagada hasta probar con fotos reales y recorte; recetas de video (loop de brillo imagen→video) sí dieron fidelidad en el spike de video.
5. Filtro de contenido: la argolla en r1 A/B fue bloqueada por IMAGE_RECITATION; manejar como reintento con otra estrategia.
6. Repetir con las fotos reales de ella (U1) antes de dar por validado.

## Puerta A (propuesta)
Fidelidad: **PASA CON RECETAS RESTRINGIDAS** (catálogo, flatlay y macro con revisión; sin "en el cuerpo"). Video: **CONFIRMADO CON CONDICIONES** (ver `video-informe.md`).
