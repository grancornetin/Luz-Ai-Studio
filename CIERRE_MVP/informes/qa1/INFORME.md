# QA1 - Revision adversarial del piloto de joyeria

Rama `piloto/qa1` (desde main 6a08f1e). Fecha: 2026-10-27. Sin push. Nada se probo con login real ni con generacion real de imagenes (0 imagenes, 0 llamadas de texto gastadas).

## Que se probo de verdad (evidencia)

| Prueba | Resultado |
|---|---|
| `node scripts/piloto-spikes/ledger-test.mjs` | 15 pruebas OK (topes, concurrencia, falla cerrado) |
| Plan offline (`w4-launch-plan-test.ts offline`, compilado con esbuild; no hay `tsx`) | TODO OK tras corregir un falso positivo del propio test (buscaba la palabra "prompt" en nombres de campo) |
| `w4-pickplaybook-test.ts` | 12/12 OK |
| Fabrica simulada `scripts/piloto-spikes/qa1-factory-test.mjs` (nuevo) | 25 casos OK: camino feliz, doble disparo, reanudacion, bloqueo IMAGE_RECITATION, tope 402 (generar y revisar), JSON roto del control, fallback_original tras 2 fallos, limite de 2 simultaneas, ventana hoy+2, recetas |
| `npx tsc --noEmit` | solo los 4 errores base (JSON ignorados por git); 0 nuevos |
| `npm run build` | OK (1m19s) **solo porque copie 3 JSON ignorados desde el repo principal** (ver H-9) |
| Movil 375 y 390 px (Playwright, datos de ejemplo, 13 pantallas/estados x 2 anchos) | 0 desbordes horizontales, 0 errores de pagina, botones >= 44 px salvo 1 (ver H-10). Capturas en esta carpeta; las miré |
| Bundle `dist/` | solo aparece la llave web de Firebase (publica por diseno); ninguna llave privada |
| CORS de Storage para `fetch()` de las fotos | OK: `firebasestorage.googleapis.com` responde `Access-Control-Allow-Origin: *` (curl) |

## Hallazgos

| # | Sev | Hallazgo y evidencia | Archivo:linea | Estado |
|---|---|---|---|---|
| H-1 | P0 | **Nadie creaba el plan de arranque.** `generateLaunchPlan` no se llamaba desde ninguna pantalla; el boton "Armar mi semana" iba al asistente generico `/planner/nuevo`. El motor de 6 semanas (playbook joyeria, recetas, piezas) quedaba sin uso y el camino completo no cerraba. | HoyScreen.tsx (boton) / plannerV3AiService.ts:530 | ARREGLADO: Hoy llama al motor (semana 1, o la siguiente si cerro la anterior), guarda con `contentPlanService.createPlan` |
| H-2 | P0 | **La hibernacion rebotaba el Planner.** Hoy manda a `/planner/:id/cierre` y `/planner/nuevo`; `HibernationGuard` solo dejaba `/mi-negocio` y `/cuenta`, asi que ella (cuenta no admin) volvia a Hoy sin hacer nada. El cierre semanal con estadisticas no funcionaba. | hibernate.tsx:20 | ARREGLADO: `/planner` permitido |
| H-3 | P0 | **Secretos en git.** `.env.production` esta versionado (commit 068b176, 2026-04-29) y esta en `origin/main`: trae la llave de cuenta de servicio de Firebase, tokens de Redis/QStash, llave de Dodo Payments y secretos de batch. No es del piloto, pero cualquiera con acceso al repo los lee. | .env.production | PENDIENTE: requiere rotar llaves en las consolas (ver pasos del dueno) |
| H-4 | P1 | Con solo `config/pilot` creado (como pedia RETOMAR.md) ella quedaba fuera: ningun codigo leia ese documento; el acceso del cliente dependia de `VITE_PILOT_UIDS` (se fija al compilar). | usePilotAccess.ts | ARREGLADO: el hook lee `config/pilot` (y PilotoModule espera la comprobacion en vez de parpadear "preparando") |
| H-5 | P1 | `buildShotPlans` elimina tomas repetidas: `flatlay_regalo` y `estilo_de_vida` daban 1 sola foto (`['TOP','TOP','TOP']` -> 1) y `catalogo_limpio`/`detalle_macro` 2. Incumple "2-3 imagenes" y "Listo" nunca aparecia. | contentFactory.ts (buildPayloads) | ARREGLADO (se repiten tomas hasta completar; cada opcion lleva su variacion). Verificado con simulacion; la parte real del director no se ejecuto (usa red) |
| H-6 | P1 | `carrusel_educativo` y `story_venta` estan activas en recipes.ts y el plan las elige, pero la fabrica no las ejecutaba: caian a "usamos tus fotos originales". | contentFactory.ts:36 | ARREGLADO (fotos, sin texto encima). Las laminas de texto del carrusel y el texto de la story **no se muestran en ninguna parte** (el `sceneBrief` no sale en Hoy): PENDIENTE decision del dueno |
| H-7 | P1 | "Ya lo publiqué" usaba `updateTaskStatus` (lee todo/escribe todo) mientras la fabrica guarda fotos en paralelo: podia borrar las fotos recien hechas de manana/pasado y volver a gastar. | HoyScreen.tsx onPublished | ARREGLADO: va por la misma cola serial de la fabrica (`io.patchTask`). `PlannerV3Closing` sigue usando el metodo viejo (no corre a la vez) |
| H-8 | P1 | El tour "elige un modulo" (OnboardingWizard) aparece a toda cuenta nueva, justo ella, y manda a modulos ocultos. | App.tsx:484 | ARREGLADO: no se muestra si la app esta hibernada |
| H-9 | P1 | `npm run build` falla en un clon limpio: 3 JSON de `src/data/trainer/inteligencia ugc/` estan ignorados por `*.json` en .gitignore y no estan en git. Funciona en la maquina del dueno con `vercel deploy` manual; un deploy desde GitHub fallaria. | .gitignore:22 | PENDIENTE (no toco .gitignore). Seguir con deploy manual desde el repo principal |
| H-10 | P2 | La regla 9 pide recordar la etiqueta de contenido con IA de Meta; el plan la generaba pero Hoy no la mostraba. | HoyScreen.tsx | ARREGLADO (nota en Hoy) |
| H-11 | P1 | **Tres listas de acceso distintas** que hay que llenar con el mismo uid: `PILOT_UIDS` (servidor, Vercel), `VITE_PILOT_UIDS` (cliente) o `config/pilot`. Si falta `PILOT_UIDS` el libro de gasto NO aplica a nadie y el tope no frena nada (devuelve `pilot:false`, sin aviso). | ledger.ts:128 | PENDIENTE (config del dueno) |
| H-12 | P2 | `pilotFidelityCheck` y `analyzeImageWithText` no existen como acciones en `content.ts`; funcionan porque caen en el bloque "resto de acciones" (imagenes + prompt + generationConfig JSON) y el libro las cuenta como vision. Fragil si alguien ordena ese archivo. | content.ts:1550 | PENDIENTE (anotado; no se toco el endpoint) |
| H-13 | P2 | Con tope alcanzado y sin fotos, Hoy muestra dos avisos: "Tus fotos de hoy siguen aqui" (no hay ninguna) y "No pudimos preparar... Reintentar" (volvera a chocar con el tope). Amable pero confuso. | HoyScreen.tsx:347-379 | PENDIENTE |
| H-14 | P2 | `/api/gemini/content` guarda en el libro el gasto de texto/vision al inicio (estimacion fija) sin devolverlo si falla. Con tope semanal de texto/vision USD 2 es holgado (~150 revisiones/semana) pero no exacto. | content.ts:828 | Aceptado |
| H-15 | P2 | Semana 2-6: al cerrar la semana, el boton "siguiente" del cierre lleva al asistente generico, no al motor de arranque. Hoy ahora lo hace bien desde "Armar mi semana", pero el atajo del cierre sigue siendo el generico. Si cierra tarde, las fechas de la semana siguiente pueden quedar en el pasado (calendario fijo desde el dia 1). | PlannerV3Closing.tsx | PENDIENTE |
| H-16 | P2 | Hashtags del plan de ejemplo incluyen `#moda_chile #modachilena` para joyeria. | jewelryCopy.ts | PENDIENTE (menor) |
| H-17 | P2 | Un boton/zona < 44 px en el estado de tope y en catalogo con error (mediciones-movil.json). | Hoy / Catalogo | PENDIENTE (menor) |

Sin hallazgos en: reglas Firestore/Storage (catalog y pilotAssets solo dueña; budgetLedger solo lectura del dueño; otra cuenta no puede leerlos), endpoint `api/piloto/ledger.ts` (exige sesion, 401 si no), rutas de catalogo/fabrica (ambos usan `users/{uid}/catalog`), tipos de `types.ts`, emojis (0), verde lima (0), jerga prohibida en textos para ella (0; "inteligencia artificial" escrito completo solo en el aviso de Meta, a proposito), 402 -> mensaje amable (probado en simulacion y en pantalla).

## Prueba real de texto (punto 3): BLOQUEADA por barrera
`w4-launch-plan-test.ts live 1` no pudo leer la credencial: el `.env.local` del repo principal trae `GOOGLE_SERVICE_ACCOUNT_KEY` ilegible (basura binaria al decodificarla). No la rodee. Pasos abajo.

## Lo que debe hacer el dueño a mano
1. **Rotar las llaves que estan en git (H-3).** En Vercel (proyecto) > Settings > Environment Variables y en cada consola: crear llaves nuevas de Firebase (cuenta de servicio), Upstash (Redis/QStash), Dodo Payments y los secretos de batch; ponerlas en Vercel; despues desactivar las viejas. Cuando lo hagas avisame y saco `.env.production` del repo (`git rm --cached`).
2. **Variables en Vercel** (Production): `PILOT_UIDS` = uid de ella (sin esto no hay tope de gasto), `GCP_PROJECT_ID=luz-creative-engine-2`, `GEMINI_SERVICE_ACCOUNT_KEY` (la de ese proyecto), `PILOT_LOCKDOWN=1` cuando ella ya este registrada. Opcional: `VITE_PILOT_UIDS` con el mismo uid.
3. **Firebase Console > Firestore:** crear el documento `config/pilot` con el campo `uids` (lista) que contenga el uid de ella. Ahora la app si lo lee.
4. **Firebase Console > Firestore > Reglas y Storage > Reglas:** publicar `firestore.rules` y `storage.rules` de esta rama/main (si no, el catalogo no guarda).
5. **Para la prueba real de texto:** pon una credencial valida (`GEMINI_SERVICE_ACCOUNT_KEY` del proyecto luz-creative-engine-2) en el `.env.local` del repo principal y dime; corro `live 3` (max 8 llamadas, centavos).
6. **Probar tu con login (no se pudo hacer sin barrera):** entra con la cuenta de ella, haz Mi marca (6 toques), sube una pieza con 2-3 fotos, toca "Armar mi semana" y revisa Hoy. Genera tu las imagenes (cada una cuesta). Mira en especial: que las 3 opciones se parezcan a la pieza, y el boton "Dame otra idea".
7. **Deploy:** seguir con `vercel deploy --prod` manual desde el repo principal (H-9).
8. **Decidir:** (a) las laminas de texto del carrusel y el texto de la story no salen en pantalla, ¿las agregamos? (b) quieres que el boton de cierre semanal tambien arme la semana siguiente con el motor de 6 semanas.

## Como repetir las pruebas
- Simulacion fabrica: `node scripts/piloto-spikes/qa1-factory-test.mjs`
- Vista movil: `npx vite --config scripts/piloto-spikes/qa1/vite.qa.config.ts --port 5198` y `node scripts/piloto-spikes/qa1/shots.mjs` (monta las pantallas reales con servicios simulados, sin tocar la app).
