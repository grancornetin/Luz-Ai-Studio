# Spike de video (Veo / Omni) - informe
Fecha: 2026-10-22. Gasto: 1 clip generado (tope 3 clips / USD 8). Registro: video-gasto.csv. Clip y fotogramas: video-salidas/. Script: scripts/piloto-spikes/video.mjs.

## DECISION: VIDEO CONFIRMADO (con 3 condiciones)
- Modelo: Veo 3.1 Fast GA, `veo-3.1-fast-generate-001`, region `us-central1` (unica listada), imagen->video, 720p, 6 s (opciones 4/6/8 s).
- Costo por clip de 6 s: ~USD 0,60 a 0,90 (techo supuesto USD 0,10-0,15/s; el precio oficial de Vertex NO se pudo leer, ver abajo). 8 s: ~USD 0,80 a 1,20. NO se pudo medir el costo real (no hay lectura de facturacion desde aqui): mirar el reporte de facturacion de GCP del 22-oct para el proyecto luz-ai-studio y anotarlo en el CSV.
- Tope sugerido: 8 s max por clip; 1 clip/dia de promedio (~USD 1,2 de los USD 3,3/dia), max 5 por semana en piloto, tope duro USD 6/semana en video. Sin audio por defecto (el audio fue en tarifa mayor en versiones anteriores; confirmar).
- Arquitectura: asincrona con QStash (ver seccion 10). Una funcion NO puede esperar el clip.
- Condiciones: (1) U3 resuelto a medias: el acceso a Veo funciona en el proyecto `luz-ai-studio` (cuenta `luz-ai-vertex`), pero el proyecto `gen-lang-client-0895574081` (el de GCP_PROJECT_ID en .env.local y de vercel.json) respondio 403 "requires billing". El dueno debe decir en cual proyecto estan los USD 300 y alinear GCP_PROJECT_ID/clave de Vercel. (2) Veo 3.1 GA se retira "17-nov-2026 o despues" y Google ya pide migrar a Omni: planear revalidar a fines de noviembre. (3) Revision humana del clip antes de entregar.

## Resultado de la prueba real
- Entrada: foto de anillo (Unsplash, licencia libre) 1280x853, prompt de giro lento con "no cambiar la joya". Clip 1280x720, 24 fps, 6 s, 1,9 MB, devuelto como BYTES (base64) en la respuesta de la operacion (sin GCS).
- Tiempo real: 139 s (extremo a extremo). Mas que los 120 s del image-worker.
- Fidelidad (3 fotogramas inicio/medio/fin): muy buena. Misma forma de aro, mismos 4 garras, halo de piedras y banda partida; sin piedras extra visibles ni deformaciones. Detalles: el giro real (~90 deg + vista frontal) muestra lados que la foto no tenia, inventados de forma plausible (no verificables contra la joya real); la base negra cambia de geometria; barras negras laterales porque la foto 3:2 se metio en 16:9 (usar foto 16:9 o 9:16). Manos/cuello ("me lo puse") NO probado: se necesita otro clip (y riesgo mayor de deformar mano). No se hicieron mas clips para no gastar el tope sin pedirlo.

## Datos verificados (consulta 2026-10-22)
| # | Dato | Valor | Fuente |
|---|---|---|---|
| 1 | IDs vigentes en Vertex | `veo-3.1-generate-001` (GA), `veo-3.1-fast-generate-001` (GA, con terminos preview), `veo-3.1-lite-generate-001` (Preview, abr-2026). Los `-preview` de Gemini API se apagan HOY 22-oct-2026 | https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/veo/3-1-generate ; https://ai.google.dev/gemini-api/docs/video |
| 2 | Regiones | solo us-central1 | misma pagina (Vertex) |
| 3 | Precio/s | Gemini API (ai.google.dev/gemini-api/docs/pricing): Standard USD 0,40 (720p/1080p), Fast 0,10 (720p) / 0,12 (1080p), Lite 0,05 / 0,08, con audio. Vertex: NO verificado (cloud.google.com/vertex-ai/generative-ai/pricing no se deja leer por WebFetch; agregadores terceros dicen Fast 0,10 sin audio... y 0,15 con audio, contradictorios). Asumir techo 0,15 | https://ai.google.dev/gemini-api/docs/pricing ; https://cloud.google.com/vertex-ai/generative-ai/pricing |
| 4 | Duraciones/resolucion | 4, 6, 8 s; entrada 720p/1080p; salida 720p/1080p (4K solo Standard); 16:9 y 9:16; 24 fps; hasta 4 videos por prompt; imagen max 20 MB | pagina Vertex arriba |
| 5 | Imagen->video | Si: primer fotograma, primer+ultimo, y "desde referencias" (Standard/Fast, 8 s; cantidad de imagenes no indicada en la pagina). Lite: sin referencias | docs.cloud.google.com ... (indice de video) |
| 6 | Tiempo tipico | no documentado; medido 139 s (Fast, 6 s, 720p) | prueba propia |
| 7 | Cuotas/acceso | pagina dice "50 tokens por minuto por modelo base" (valor raro, tomar con cautela); consumo: cuota fija y Provisioned Throughput; "pay-as-you-go no soportado" segun la ficha, pero la llamada normal funcionó sin allowlist en luz-ai-studio. Requiere facturacion activa | pagina Vertex arriba; prueba propia |
| 8 | "Omni" | Existe: **Gemini Omni Flash** (`gemini-omni-1.1-flash`; `gemini-omni-flash-preview` se apaga 22-oct-2026), modelo multimodal para generar y editar video. GA en Gemini API (pago): USD 1,50/M tokens entrada, 17,50/M salida de video, 5.792 tokens/s de 720p = ~USD 0,10/s. En Vertex: no confirmado como GA (hilo de foro pide allowlist; fuentes de prensa dicen "en semanas"). NO probado (tope). Google recomienda migrar a el | https://ai.google.dev/gemini-api/docs/pricing ; https://ai.google.dev/gemini-api/docs/video ; https://discuss.ai.google.dev/t/allowlist-request-gemini-omni-flash-preview-access-on-vertex-ai/172552 ; https://venturebeat.com/technology/google-unveils-gemini-omni-any-to-any-ai-model-what-enterprises-should-know |
| 9 | Operacion | `ai.models.generateVideos` devuelve operacion larga (`projects/.../models/<id>/operations/<uuid>`); se sondea con `ai.operations.getVideosOperation`; sin `outputGcsUri` el resultado llega como bytes en `response.generatedVideos[0].video.videoBytes`; con GCS, como `uri` | prueba propia (SDK @google/genai 1.48.0) |
| 10 | Vercel | vercel.json: image-worker 120 s, evolink-worker/clone-worker 300 s, resto 60 s. Clip tardo 139 s | vercel.json; prueba propia |

## Arquitectura propuesta (patron de sondeo con QStash)
1. `video-start` (60 s): valida creditos, llama `generateVideos` con `outputGcsUri` (evita cargar 2 MB en memoria/Redis), guarda `{jobId, operationName}` en Redis y publica en QStash un mensaje con `delay` 30 s hacia `video-poll`.
2. `video-poll` (30 s): `getVideosOperation`; si no esta listo, vuelve a publicar con delay 15 s (max ~12 reintentos = tope 5 min); si termino, copia a Storage de la app y marca el job listo + notificacion (ya existe infraestructura de notificaciones nivel 3). Si falla, reembolsa el credito (patron igual al de reportShotResult).
3. Concurrencia limitada a 1-2 clips simultaneos y contador diario en Redis con el tope de USD. Cobrar creditos propios por clip.
Alternativa mas simple: un unico worker de 300 s (como evolink-worker) cabe (139 s medidos) pero se cae con picos; se recomienda el sondeo.

## Pendientes
- Medir costo real en facturacion GCP y corregir el CSV.
- Un clip de "me lo puse" (mano/cuello) para validar deformaciones; 8 s con audio opcional.
- Probar Omni cuando haya acceso en Vertex (y antes de la retirada de Veo 3.1).
