# Luz IA Studio — instrucciones para el asistente

## Segundo cerebro (conocimiento del proyecto)
Existe una wiki local en `cerebro-luz/` (ignorada por git; solo está en el computador del dueño). Si la carpeta existe:
1. **Al empezar una sesión,** lee `cerebro-luz/wiki/index.md` y el final de `cerebro-luz/wiki/log.md`, y corre `node cerebro-luz/scripts/pendientes.mjs` para ver si hay documentos o memorias nuevos sin ingerir.
2. **Antes de decidir algo de producto, marca, precios, voz o diseño,** busca la página en el cerebro (`wiki/conceptos`, `wiki/modulos`, `wiki/decisiones`). Si choca con lo que vas a hacer, avisa al dueño.
3. **Al cerrar un hito o una decisión,** actualiza la página que toque, agrega una entrada a `wiki/log.md` y termina con `node cerebro-luz/scripts/pendientes.mjs --marcar`.
4. Las reglas completas están en `cerebro-luz/CLAUDE.md`. Si la carpeta no existe, ignora esta sección.

## Estado del trabajo
El estado vivo del piloto está en `RETOMAR.md` (raíz) y `CIERRE_MVP/`. Mantén `RETOMAR.md` al día al cerrar cada hito.
