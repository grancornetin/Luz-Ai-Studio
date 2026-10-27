# Punto de retoma QA1 (revision adversarial del piloto)
Rama piloto/qa1. Estado: EN CURSO.
## Hecho
- Lectura de contexto; baseline tsc = 4 errores de JSON ignorados (igual que main).
- Hallazgos de integracion en lectura (ver INFORME.md cuando exista).
## Falta
- Pruebas sin login (ledger, plan offline, simulacion fabrica), tsc/build, prueba de texto real, vista movil, textos, seguridad, INFORME.md.
## Como correr TS sin tsx
esbuild de node_modules: node_modules/esbuild/bin/esbuild archivo.ts --bundle --platform=node --format=esm --outfile=...
