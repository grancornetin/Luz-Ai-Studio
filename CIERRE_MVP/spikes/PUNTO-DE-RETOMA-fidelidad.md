# Punto de retoma - spike de fidelidad (pausa por limite de uso, 22-oct-2026)
Gasto: 32 imagenes OK + 4 fondos incluidos (total 32 imagenes, tope 40) y unos USD 2.3 (tope 4). Detalle: fidelidad-gasto.csv. NO lanzar mas imagenes sin decidir (quedan 8 de margen).
Hecho: auth (proyecto luz-ai-studio via credneciales/; el de .env.local da 403 sin facturacion), precios verificados, 3 fotos Wikimedia (no son de la emprendedora), verificador calibrado (conteo ciego), 4 fondos, composiciones C (r1,r2,r5), generacion A/B de r1..r5 x 3 productos (argolla r1 A y B fueron bloqueadas por IMAGE_RECITATION).
A medias: `node scripts/piloto-spikes/fidelidad.mjs verify` (puntaje automatico de todo lo generado; si fue interrumpido, repetirlo: es incremental, guarda en scripts/piloto-spikes/resultados.json). Falta revision visual de hojas de contacto (imgtools.py sheet) y redactar el informe final.
Siguiente: 1) verify  2) report  3) revisar hojas  4) completar CIERRE_MVP/spikes/fidelidad-informe.md.
