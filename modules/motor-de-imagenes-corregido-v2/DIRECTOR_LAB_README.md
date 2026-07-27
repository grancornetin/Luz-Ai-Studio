# Director Lab — Cómo iniciarlo

Herramienta interna de diagnóstico (solo para el desarrollador). Le das una receta real de Photodump y una idea, y arma la historia completa de shots con prompts reales — usando los contratos de shot ya validados a mano, el banco HPI real (36 familias, `src/data/HPI/`), y el Scene Bank curado — listos para copiar y probar manualmente en Higgsfield/Magnific.

## Requisito previo (una sola vez)

1. Verifica que exista `Luz IA secrets/vertex-service-account.json` dentro de `modules/motor-de-imagenes-corregido-v2/`.
2. Si vas a compilar de nuevo el "vendor" (ver más abajo), necesitás `esbuild` — ya viene instalado como dependencia del proyecto principal (`node_modules/esbuild`), no hace falta instalar nada aparte.

## Arrancar

**Doble-click en `iniciar-director-lab.bat`** (raíz del proyecto `luz-ia-studio`). Levanta un solo proceso (`node server.js`, puerto 3131) y abre el navegador directo en `http://localhost:3131/director-lab.html` — sin login, sin Vite, sin la app de producción.

**Importante:** tu Campaign Trainer original (en tu carpeta de Descargas, fuera de este proyecto) también usa el puerto 3131 con su propio `iniciar.bat`. No abras los dos al mismo tiempo — el segundo que abras va a fallar porque el puerto ya está ocupado por el primero. Usalos de a uno.

## Cómo se usa

1. Elegís la receta (por ahora solo **"Look de noche" / `outfit_night_out`** está conectada; las demás aparecen listadas como "próximamente").
2. Elegís nivel (Corto: 3 fotos, Completo: 5, Extendido: 7), energía (elegante/fiesta), si hay acompañante.
3. Escribís la idea/lugar en el cuadro de texto.
4. Apretás **"Crear historia"**.
5. Aparece la lista de shots, cada uno con su prompt positivo/negativo real (idéntico al que produce Photodump en producción para esa receta) y un botón de copiar.
6. Copiás el prompt y lo probás en Higgsfield/Magnific.
7. Si algo salió mal en un shot, escribís una nota corta ahí mismo ("la pose se ve forzada") y la guardás — la próxima vez que generes esa misma receta, esa nota se incluye automáticamente en el prompt de ese shot.

## Qué reusa y qué no reimplementa

- **HPI real**: `src/services/hpiService.ts` (36 familias curadas, reglas de compatibilidad, salvaguardas anatómicas) — compilado tal cual a Node, cero reimplementación.
- **Contrato de shots de `outfit_night_out`**: `src/modules/photodump/recipes/outfitNightOut/` (shots fijos validados a mano, banco rotable de "night moments" con selección determinista por seed, `promptBuilder.ts` real) — mismo mecanismo.
- El compilado vive en `director-lab/vendor/` (generado, no se edita a mano). Si cambiás algo en los archivos fuente reales de Photodump o de `hpiService.ts`, corré de nuevo:
  ```
  cd modules/motor-de-imagenes-corregido-v2
  node scripts/build-vendor.js
  ```

## Correr las pruebas

```
cd modules/motor-de-imagenes-corregido-v2
node --test "director-lab/tests/*.test.js"
```

34 pruebas, incluyendo generación real de historias con `outfit_night_out`, determinismo por seed, y reinyección de notas de feedback.

## Limitaciones reales de este MVP

- Solo `outfit_night_out` está conectada. Las otras 12 recetas de Photodump aparecen en el desplegable pero deshabilitadas — conectar una receta nueva sigue el mismo patrón (agregar sus archivos a `scripts/build-vendor.js` y un adaptador análogo a `photodump-recipe-adapter.js`).
- No hay carga de fotos de referencia todavía (identidad/outfit) — el brief de texto libre se usa como descripción del lugar cuando no hay venue de referencia.
- El feedback es una nota de texto libre por (receta, shot) — no hay historial visible de notas anteriores en la UI, solo la más reciente se reinyecta.
- No hay integración automática de subida a Higgsfield/Magnific — copiás el prompt y lo pegás manualmente.
