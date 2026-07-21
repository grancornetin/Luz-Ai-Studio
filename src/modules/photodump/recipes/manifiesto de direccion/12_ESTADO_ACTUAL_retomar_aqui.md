# ESTADO ACTUAL — Leer esto primero para retomar el trabajo

> **Para qué sirve este documento**: si este chat creció demasiado, o el usuario
> abre un chat nuevo para ahorrar tokens, este archivo debe alcanzar para
> retomar el trabajo de Photodump / `outfit_multi_look` sin perder acuerdos ni
> hallazgos. Se actualiza cada vez que hay un cambio de estado relevante
> (nueva fase completada, bug encontrado, decisión tomada). No reemplaza el
> resto del manifiesto — es el índice de "dónde vamos" que apunta al resto.

Última actualización: 2026-07-21.

## 1. Qué es esto

Luz IA Studio es una app de generación de contenido con IA para creadoras de
moda/belleza en Chile/LATAM (ver `COMERCIAL.md` en la raíz del repo para tono
de voz y buyer persona "Sofi" — **siempre** escribir copy de UI en ese
lenguaje, sin jerga técnica).

El usuario **no programa**. Explicaciones en español, sin jerga, con ejemplos
prácticos (ver memoria `feedback_communication_style`).

`Photodump` es un módulo del sistema que genera sets de fotos tipo "camera
roll real" (no editorial) a partir de recetas narrativas predefinidas
(day_in_life, outfit_week, outfit_haul, etc). Cada receta tiene su propio
motor de prompts en `src/modules/photodump/recipes/`.

## 2. En qué fase estamos

**Fase 8 — piloto de integración de `outfit_multi_look` a la app real —
completada e integrada.** Es la primera receta del grupo "Fashion" que pasa
de "prompts validados a mano en Higgsfield" a código real corriendo en
producción. Las otras 2 recetas Fashion validadas (`outfit_night_out`,
`outfit_reveal_basic`) **todavía NO están integradas** — siguen siendo
documentación pura en esta carpeta, sin código en `src/`.

### Qué es `outfit_multi_look`

Una sola receta con 5 intenciones (el usuario elige una en la UI):

| Intención | Qué cuenta | Fondo |
|---|---|---|
| `weekly` | Mi semana en looks | Fijo, una sola ancla |
| `then_vs_now` | Antes vs. ahora | Fijo, una sola ancla (jerarquía vive en `era` por look, no en 2 anclas) |
| `rate_check` | Califica mi outfit (1 solo look) | Fijo, una sola ancla |
| `curated_ideas` | Ideas para [ocasión/tendencia] | Fijo, una sola ancla |
| `trip_recap` | Los looks de mi viaje | Variable — un lugar distinto por shot, declarado por el usuario |

Motor completo en `src/modules/photodump/recipes/outfitMultiLook/` (13
archivos: types, manifest, anchorFixed, anchorChain, allocator, contracts,
contractValidator, referenceRouter, routingValidator, renderProfile,
intelligenceLayer, promptBuilder, debug, index).

Diseño narrativo completo (por qué existe cada regla) en
`11_session_log_outfit_weekly_recap_validation.md`, secciones 6/6bis/6ter/6quater.

## 3. Reglas de negocio fijas (no re-descubrir, ya están decididas)

- **El motor de generación de imágenes siempre fue Gemini** — Higgsfield fue
  solo la interfaz usada para validar prompts a mano, nunca el motor real.
- **Nunca generar shots de "caminando"** — se ven falsos sin excepción
  (física de piernas en movimiento no resuelta por el modelo). Regla global,
  implementada como `NO_WALKING_LINE` en `renderProfile.ts`.
- **En `trip_recap`, el usuario declara los lugares** — el sistema nunca
  inventa qué es "icónico" de una ciudad, salvo mega-ciudades ultra-reconocidas
  (NY, París, Roma, Londres, Tokio) donde puede sugerir un punto de partida
  editable.
- **Composición debe ser casual/UGC, nunca editorial** — Finding 005:
  sujeto descentrado, mirada fuera de cámara, lugar de fondo "asomándose" no
  centrado, encuadre imperfecto. Implementado como `UGC_CASUAL_COMPOSITION_BLOCK`.
- **El fondo del ancla fija nunca debe ser un estudio fotográfico** — ver
  sección 5 (bug encontrado 2026-07-21). Implementado como
  `NO_STUDIO_BACKDROP_LINE`.
- **"Elements" de Higgsfield no existen como concepto en la app real** — el
  equivalente ya existente es el sistema de `@tags`/`slotCatalog.ts` que cita
  referencias por slot (rostro, cuerpo, etc). No se creó nada nuevo para esto.
- **Alcance del piloto**: solo 1 receta integrada a la vez. No se toca el
  agrupamiento de recetas por categoría (Fashion/Shoes/Beauty) en la UI
  todavía — es un cambio transversal, diferido a después de integrar las 3
  recetas Fashion.
- **Autonomía autorizada**: el usuario dio permiso explícito para implementar,
  commitear, pushear a `main` y correr `vercel deploy --prod` sin pedir
  confirmación en cada paso, específicamente para este trabajo de Photodump.
  (Ver memoria `feedback_commit_deploy` y `feedback_deploy_manual` — commit+push
  automático tras cada cambio, pero el deploy a producción se hace manual con
  `vercel deploy --prod` porque el auto-deploy de Vercel vía GitHub no es
  confiable.)

## 4. Estado técnico verificado

- `npm run lint` (tsc --noEmit) limpio, sin errores, en todo el repo.
- Build de producción (`vercel deploy --prod`) exitoso, último deploy
  2026-07-21, commit `6ef00ea`.
- `outfit_multi_look` aparece en `PDStep1.tsx`, con selector de intención en
  `PDStep2Receta.tsx`, persistencia de preset en `photodumpPresetAdapter.ts`.

## 5. Historial de bugs encontrados en producción (piloto)

### Bug 1 — Fondo de estudio fotográfico en vez de espacio doméstico (RESUELTO)

**Síntoma reportado por el usuario**: al generar `weekly`, las fotos salían
con fondo de estudio de fotografía (backdrop liso, piso de concreto) en vez
del espacio doméstico/orgánico validado manualmente (habitación, baño,
frente a un escaparate).

**Causa**: el ancla fija (`anchorFixed.ts`) y el prompt de cada shot
(`promptBuilder.ts`) nunca describían explícitamente qué TIPO de lugar debía
generarse — solo pedían "mirror selfie" y dejaban el fondo abierto. Sin ese
anclaje textual, el prior más fuerte del modelo para esa composición
("mirror selfie de moda") es literalmente un set de estudio. En el diseño
original validado a mano, el fondo siempre venía de un ejemplo real citado
(ej. el carrusel de Instagram con hall de entrada y espejo dorado) — al
pasar a código, esa descripción implícita se perdió.

**Fix aplicado** (commit `6ef00ea`, 2026-07-21): se agregó
`NO_STUDIO_BACKDROP_LINE` en `renderProfile.ts` — instrucción explícita de
que el fondo debe ser un espacio doméstico/cotidiano real (dormitorio, baño,
pasillo, clóset, o reflejo en vitrina de calle), nunca estudio ni backdrop
liso. Se conectó en `anchorFixed.ts` (el ancla) y en `promptBuilder.ts`
(cada shot con `mirrorSelfieBlock`). `trip_recap` no necesitó el fix porque
ya describe un lugar concreto por shot (`anchorChain.ts` ya dice "at
[placeLabel]"), sin ambigüedad.

**Pendiente de esta parte**: el usuario todavía no confirmó visualmente que
el fix funcionó — falta volver a generar un set de `weekly` en la app y
revisar el fondo.

### Bug 2 — Error de modelo Gemini no encontrado (RESUELTO, causa ajena al código)

**Síntoma**: al generar `rate_check` ("califica mi outfit"), la consola
mostraba: `Publisher model 'projects/luz-ai-studio/locations/global/publishers/google/models/gemini-3.1-flash-image-preview' was not found or your project does not have access to it.`

**Causa real (confirmada por el usuario)**: Google activó autenticación en 2
pasos en la cuenta de Google Cloud del proyecto y, al no estar configurada
todavía del lado del usuario, se perdió el acceso al modelo. **No era un bug
de código** — `gemini-3.1-flash-image-preview` es el modelo correcto y
oficial de todo el sistema (ver `api/gemini/image-worker.ts` línea 151,
documentado a propósito, con `gemini-2.5-flash-image` explícitamente
excluido por decisión de diseño).

**Estado**: el usuario configuró la 2FA, pero además Google deshabilitó del
todo la versión `-preview` de este modelo (no solo un tema de acceso de la
cuenta). **Fix adicional aplicado 2026-07-21** (commit posterior a este): se
cambió el nombre del modelo en todo el código de `gemini-3.1-flash-image-preview`
→ `gemini-3.1-flash-image` (versión oficial, mismo precio/rendimiento, sin
`-preview`). Archivos tocados: `api/gemini/image-worker.ts`,
`api/gemini/image.ts`, `api/gemini/ugc.ts`, `api/gemini/ugc-worker.ts`,
`api/avatar/clone-worker.ts`, `src/services/creditConfig.ts` (fuente única
de verdad, `MODELS.FLASH`), y `PRICING_BRIEF.md`. **Falta confirmar con una
prueba real** que ya genera exitosamente.

**Importante para el futuro**: si vuelve a aparecer un error de "model not
found / no access" en cualquier receta (no solo `outfit_multi_look`), primero
revisar si Google volvió a renombrar/deprecar el modelo de imagen (ya pasó
una vez, de `-preview` a la versión estable) antes de sospechar solo de
2FA/acceso de cuenta. El nombre vigente vive en `src/services/creditConfig.ts`
→ `MODELS.FLASH`, y se referencia también (hardcodeado, no importado desde
ahí) en los 5 archivos de `api/` listados arriba — si cambia de nuevo, hay
que tocar los 6 lugares.

## 6. Qué falta (pendientes explícitos)

1. **Confirmar visualmente** que el Bug 1 (fondo de estudio) quedó resuelto
   — generar un set nuevo de `weekly` en la app y revisar el fondo.
2. **Confirmar** que el Bug 2 (acceso al modelo) quedó resuelto — reintentar
   `rate_check` y cualquier otra receta.
3. Probar las 5 intenciones de `outfit_multi_look` en la app real y reportar
   resultados — hasta ahora solo se probaron manualmente en Higgsfield
   (excepto lo que ya se generó en este piloto). En particular, `rate_check`
   y `curated_ideas` **nunca se generaron visualmente en ningún lado**, ni a
   mano ni en la app.
4. Integrar las otras 2 recetas Fashion (`outfit_night_out`,
   `outfit_reveal_basic`) a la app real — mismo patrón que este piloto,
   diferido a después de que `outfit_multi_look` esté validado en producción.
5. Agrupar recetas por categoría (Fashion/Shoes/Beauty) en `PDStep1.tsx` —
   explícitamente diferido, no tocar hasta que las 3 recetas Fashion estén
   integradas.
6. Formalizar el bloque de composición UGC casual (Finding 005) en
   `03_photodump_recipe_architecture.md` sección 19, como parte oficial del
   perfil `iphone_camera_roll` — mencionado en la bitácora pero nunca
   escrito ahí.
7. Test B y C (sin avatar / con escenas cargadas) de las recetas Fashion ya
   validadas — no iniciados.

## 7. Cómo seguir si este documento se está leyendo desde un chat nuevo

1. Preguntar al usuario si ya probó lo pendiente de la sección 6 (puntos 1 y
   2 especialmente — son los más recientes y urgentes).
2. Si reporta un problema nuevo en `outfit_multi_look`, diagnosticar contra
   `src/modules/photodump/recipes/outfitMultiLook/` y las 3 intercepciones en
   `photodumpDirectorService.ts` (buscar `outfit_multi_look` en ese archivo)
   — no releer el manifiesto narrativo completo desde cero.
3. Si el usuario pide continuar con las recetas 4/5 (integrar
   `outfit_night_out`/`outfit_reveal_basic`), usar este mismo patrón de
   carpeta (`recipes/outfitMultiLook/` como plantilla estructural) y seguir
   el mismo orden: types → manifest/anchor → contracts → prompt → index →
   intercepción en Director → UI → preset adapter → verificación end-to-end.
4. Actualizar este archivo (sección 5 con nuevos bugs, sección 6 marcando
   pendientes como resueltos) cada vez que se cierre un ciclo de prueba real.
