# Director Lab v2 — Contrato de `POST /api/director-lab/generate`

Reemplaza el contrato de `director-core.js` de la v1 (retirado). Implementado en `director-lab/adapters/photodump-recipe-adapter.js`, expuesto vía `director-lab/http/routes.js`.

## Entrada

```json
{
  "recipeId": "outfit_night_out",
  "level": "corto | completo | extendido",
  "energy": "elegante | fiesta",
  "hasCompanion": false,
  "gender": "female | male",
  "garmentCount": 1,
  "venueImageUrl": null,
  "venueTextFallback": "string (o el mismo brief libre)",
  "seed": "string opcional — mismo seed produce los mismos night moments (determinismo)"
}
```

Solo `recipeId: "outfit_night_out"` está soportado hoy; cualquier otro valor devuelve `400`.

## Salida

```json
{
  "recipeId": "outfit_night_out",
  "level": "corto",
  "energy": "elegante",
  "seed": "string",
  "shots": [
    {
      "shotId": "mirror_check",
      "label": "Espejo de cuerpo completo con el look puesto",
      "isFixed": true,
      "contract": { "shotId": "...", "cameraGrammar": {...}, "hpiPoseFamily": "...", "...": "..." },
      "positivePrompt": "string — texto real de Photodump + HPI real + nota de feedback si existe",
      "negativePrompt": "string"
    }
  ]
}
```

`isFixed: true` = shot de preparación fijo del contrato de la receta (`presentation`/`tryon_detail`/`mirror_check`), siempre presente según el nivel. `isFixed: false` = "night moment" elegido determinísticamente por `seed` del banco rotable real.

## `POST /api/director-lab/notes`

```json
{ "recipeId": "outfit_night_out", "shotId": "mirror_check", "note": "texto libre" }
```

Guarda la nota (persistencia mutable, `persistence/shot-notes.js`). La próxima llamada a `/generate` para el mismo `(recipeId, shotId)` incluye automáticamente la nota más reciente como línea extra en `positivePrompt`.

## Garantías

1. `positivePrompt`/`negativePrompt` de cada shot son el texto **real** que produce `src/modules/photodump/recipes/outfitNightOut/promptBuilder.ts` en producción — cero reescritura ni resumen.
2. Los shots fijos (`presentation`/`tryon_detail`/`mirror_check`) nunca varían su contrato de cámara/pose/HPI entre llamadas — solo cambia el texto de venue/nota inyectada.
3. Los "night moments" se eligen con la función real `pickNightMomentsForSet`/`resolveShotsForLevel` de Photodump — mismo `seed` produce siempre la misma selección (verificado en `tests/photodump-recipe-adapter.test.js`).
4. El HPI inyectado (`EXPRESSION`/`BODY POSE`/`CAMERA RELATIONSHIP`) proviene siempre del banco real de 36 familias — nunca de un placeholder inventado.

## Rutas retiradas (v1)

`POST /api/director-lab/runs` devuelve `410 Gone` con un mensaje señalando el reemplazo. Las rutas CRUD de proyectos/recetas/casos/referencias/resultados/evaluaciones de la v1 siguen respondiendo (no se retiraron), pero no las usa la interfaz actual (`director-lab.html`).
