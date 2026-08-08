# Director Lab — Estado actual (leer esto primero al retomar)

> **Para qué sirve este documento**: si este chat creció demasiado, o el
> usuario abre un chat nuevo para trabajar solo en Director Lab (separado
> del chat donde se editan las recetas de Photodump), este archivo debe
> alcanzar para retomar sin perder acuerdos ni hallazgos. Se actualiza cada
> vez que hay un cambio de estado relevante (nueva fase, bug encontrado,
> decisión tomada, feedback del usuario aplicado a una receta). Mismo
> espíritu que `src/modules/photodump/recipes/manifiesto de direccion/12_ESTADO_ACTUAL_retomar_aqui.md`,
> pero para la capa de Director Lab — son dos documentos de bitácora
> separados a propósito (ver sección "Dos capas de trabajo" abajo).

Última actualización: 2026-07-28.

## 1. Qué es esto

Director Lab es una herramienta interna (solo para el desarrollador, nunca
para usuarios finales) que permite probar el "cerebro creativo" de Photodump
sin generar imágenes reales: le das una receta + un brief libre, el Director
razona (usando Gemini 2.5 real + la psicología de venta de Photodump + los
bancos reales de escenas/HPI) y devuelve los prompts de cada foto de la
historia, listos para copiar y probar manualmente en Higgsfield/Magnific.

Vive en `modules/motor-de-imagenes-corregido-v2/` (un proyecto Node
standalone dentro del repo de `luz-ia-studio`, separado de la app de
producción — no pasa por login ni por Vercel). Se abre con doble-click en
`iniciar-director-lab.bat` (raíz del repo).

## 2. Dos capas de trabajo, dos documentos de bitácora

El usuario decidió (2026-07-28) trabajar esto en **dos chats separados**:

- **Chat "recetas"**: diseña/corrige la lógica real de Photodump en
  `src/modules/photodump/recipes/` — usa su propio documento
  `12_ESTADO_ACTUAL_retomar_aqui.md`.
- **Chat "Director"**: prueba y pule Director Lab — usa este documento.

Como cada chat no tiene memoria del otro, este archivo (y el de recetas)
son el puente. Si en el chat del Director se identifica un problema que
requiere editar una receta real, se edita igual (ver sección 4, "cómo se
conectan"), y se anota acá qué se tocó y por qué — así el chat de recetas
puede enterarse leyendo este documento si hace falta.

## 3. En qué fase estamos

**v3 — razonamiento con Gemini real conectado y probado (2026-07-28).**

- v1 (retirada): Gemini elegía libremente entre candidatos de un banco HPI
  inventado a mano. Se descartó por completo (`director-core.js`,
  `gemini-selector.js`, `candidate-ranking.js` eliminados).
- v2: conectó datos reales — banco HPI real de Photodump (36 familias,
  `src/data/HPI/`), contratos de shot ya validados de `outfit_night_out`
  (`shotPool.ts`, `nightMoments.ts`, `levelResolver.ts`, `promptBuilder.ts`,
  `intelligenceLayer.ts`) vendorizados con esbuild. 100% determinístico,
  sin Gemini.
- **v3 (actual)**: Gemini razona sobre el brief libre del usuario usando el
  marco de psicología de `recipes/manifiesto de direccion/02_the_psychology_behind_photodump_v2.md`
  (leído en vivo desde el `.md` real, no copiado a mano) + elige una escena
  real del Scene Bank (501 escenas) cuando no hay foto de referencia,
  validando que el ID exista (si Gemini inventa un ID, se rechaza y
  reintenta una vez; si sigue fallando, cae a un nivel/energía por defecto
  sin romper la generación). Pose/gesto/HPI siguen sin tocar por Gemini —
  eso sigue viniendo 100% de los contratos ya validados a mano.
- Cada shot ahora también lleva su `psychologicalIntent` real (portado desde
  `05_outfit_night_out.normalized.ts`, que nunca se había compilado al código
  de producción — ver `director-lab/core/psychology-context.js`).
- **Probado en vivo con credenciales reales de `luz-ai-studio`** (2026-07-28):
  brief "night out en un rooftop en Manhattan, quiero verme sofisticada" →
  Gemini explicó que no había rooftop exacto en el banco y eligió un salón
  de restaurante opulento con justificación coherente, resolvió nivel
  "completo"/energía "elegante", identificó impulso `attraction_self_presentation`
  y sensación "poder" — coincide con el marco de psicología real.

## 4. Cómo se conectan Director Lab y las recetas reales (mecanismo técnico)

Director Lab **no lee en vivo** los archivos de
`src/modules/photodump/recipes/outfitNightOut/` — los archivos están en
TypeScript y Director Lab corre en Node plano (CommonJS), no puede
`require()`-arlos directo. Hay un paso de compilación intermedio:

```
cd modules/motor-de-imagenes-corregido-v2
node scripts/build-vendor.js
```

Este script compila los archivos reales (`hpiService.ts`, `shotPool.ts`,
`nightMoments.ts`, `levelResolver.ts`, `intelligenceLayer.ts`,
`promptBuilder.ts`) a `director-lab/vendor/` con `esbuild`. **Cualquier
cambio a esos archivos fuente no se refleja en Director Lab hasta que se
corre este comando.**

**Regla operativa acordada con el usuario**: cuando el usuario da feedback
sobre un shot ("esto no me gustó por X") y el fix real implica editar un
archivo fuente de la receta, quien esté atendiendo ese chat debe:
1. Editar el archivo real en `src/modules/photodump/recipes/outfitNightOut/`.
2. Correr `node scripts/build-vendor.js` inmediatamente después, en el mismo
   turno — sin pedirle al usuario que lo haga ni que se acuerde de este paso.
3. Anotar acá qué se cambió y por qué (ver sección 5).

Si el chat activo es el de "recetas" (no el de Director Lab) y el cambio
afecta a `outfit_night_out`, igual conviene correr el build ahí mismo si el
usuario va a seguir probando en Director Lab — o dejar anotado en este
documento que el vendor quedó desactualizado, para que el chat de Director
Lab lo note y lo regenere antes de asumir que un resultado raro es un bug
del Director y no un vendor viejo.

## 5. Historial de cambios a recetas reales, motivados por pruebas en Director Lab

(Vacío por ahora — se completa cada vez que un feedback de Director Lab
resulte en una edición real de `src/modules/photodump/recipes/`. Formato:
fecha, qué se probó, qué falló, qué archivo se tocó, qué se cambió.)

## 6. Qué falta / próximos pasos

1. Ninguna otra receta está conectada todavía (`outfit_haul`, `outfit_week`,
   etc. aparecen en el desplegable de `director-lab.html` pero deshabilitadas).
   Conectar una receta nueva sigue el patrón de
   `director-lab/adapters/photodump-recipe-adapter.js` (agregar sus archivos
   a `scripts/build-vendor.js` + un adaptador análogo).
2. `outfit_night_out` sigue sin integrarse a la app real de Photodump — eso
   es intencional (decisión del usuario, 2026-07-27): primero se pule acá,
   con feedback manual iterativo, y solo cuando el usuario apruebe la receta
   se integra siguiendo el mismo patrón que `outfit_multi_look`/
   `outfit_reveal_basic` (ver `12_ESTADO_ACTUAL_retomar_aqui.md` sección 7).
3. No hay carga de fotos de referencia (identidad/outfit) en
   `director-lab.html` todavía — el brief de texto libre se usa como
   descripción del venue cuando no hay foto.
4. `PSYCHOLOGICAL_INTENT_BY_SHOT` en `psychology-context.js` cubre los shots
   de `outfit_night_out` conocidos hoy — si se agrega un night moment nuevo
   al banco real (`nightMoments.ts`), hay que agregarle también su entrada
   ahí o quedará sin línea de intención psicológica en el prompt (no rompe,
   solo omite esa línea).

## 7. Cómo seguir si este documento se está leyendo desde un chat nuevo

1. Preguntar al usuario si ya probó algo desde la última actualización de
   este documento y qué feedback tiene.
2. Si el feedback implica tocar una receta real, seguir el mecanismo de la
   sección 4 (editar + recompilar vendor + anotar en sección 5).
3. Si el usuario reporta algo raro en un prompt, primero descartar que el
   vendor esté desactualizado (`node scripts/build-vendor.js` de nuevo) antes
   de asumir que es un bug de razonamiento de Gemini.
4. Actualizar este archivo (sección 3 con el nuevo estado, sección 5 con el
   historial de cambios) al cerrar el ciclo de esa sesión.
