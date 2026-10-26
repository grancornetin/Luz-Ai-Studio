# Punto de retoma W23 (Mi marca + Catalogo) - pausa por limite de uso
Rama: piloto/w23-marca-catalogo. Estado: EN CURSO (codigo completo, sin probar en navegador ni con llamadas reales).

## Hecho (tsc: solo los 4 errores de base de archivos ignorados)
- services/identityService.ts: opciones, 3 identidades por /api/gemini/content (generateText), reintento, respaldo determinista, filtro de claims, guardado como BrandProfile (campos extra pilotSeed/pilotIdentity, queda marca por defecto).
- screens/MiMarcaScreen.tsx: intro (nombre opcional), 6 preguntas por toque, 3 ideas, confirmar (claims), guardar. Props onDone.
- services/catalogService.ts: grupos de 1-4 fotos, originales a users/{uid}/pilotAssets/originals/{itemId}/ (sin recomprimir si <=2048 px, rutas unicas), vision con respaldo + luz/nitidez local, CRUD en users/{uid}/catalog.
- screens/MiCatalogoScreen.tsx: lista de tarjetas 4:5, agregar pieza, revisar ficha, editar, otro angulo, borrar. Props onDone.
## Decision: coleccion nueva `catalog` (no `products`): products guarda base64 en el doc y otro tipo; las reglas del piloto solo existen para catalog.
## Falta
- Commit de catalogService.ts y MiCatalogoScreen.tsx (se hace en esta pausa).
- Probar en navegador a 375 px, con login real; prueba de humo de textos/vision (0 llamadas gastadas hasta ahora).
- Revisar que ProgressBar/InlineBanner se vean bien dentro de actions del FlowShell.
- node_modules del worktree ahora es instalacion real (npm ci), no union (la del principal esta vacia).
