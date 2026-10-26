# RETOMAR: Piloto automático para joyería (Luz IA Studio)
Actualizado: 2026-10-22 (día 1)  ·  Cuenta/sesión: orquestador, cuenta A

## Estado en una frase
Día 1 en curso: cimientos (W0) y dossier de mercado v1 (W1) ya están en main; faltan terminar el spike de fidelidad, el spike de video y W8 (libro de gasto), que siguen corriendo.

## ESTADO 26-oct (PAUSA por uso 92 %, retomar en ~2 h)
- main al día (be0366c W8 + decisiones). Camino principal de fotos = Fotos de producto con varios ángulos, estilo minimal: VERIFICADO por el dueño con fotos reales (fiel). Recorte = plan B (rama piloto/w5-recorte, sin mergear, falla con fotos en mano).
- 3 agentes en worktrees (pausa pedida; cada uno deja su PUNTO-DE-RETOMA en su carpeta, relanzar con 'Ya existe trabajo previo; léelo y continúa'):
  - ../luz-piloto-w23-marca-catalogo (rama piloto/w23-marca-catalogo): Mi marca + Catálogo → CIERRE_MVP/informes/PUNTO-DE-RETOMA-w23.md
  - ../luz-piloto-w4-plan (piloto/w4-plan): Planner arranque 6 semanas + playbook joyería → ...-w4.md
  - ../luz-piloto-w57-hoy (piloto/w57-hoy): contentFactory + pantalla Hoy + interruptor de hibernación → ...-w57.md
- Orden de merge: w23 → w4 → w57; tras cada uno tsc + build; push; recién al final vercel deploy --prod.
- Respaldo de la app completa: tag y rama archive/luz-completa-2026-10-23.
- Pendiente del dueño: crear config/pilot en Firebase, GCP_PROJECT_ID=luz-creative-engine-2 en Vercel, alerta de presupuesto (CIERRE_MVP/GUIA_PRESUPUESTO_GCP.md), PILOT_LOCKDOWN=1 y cerrar registro, uid de ella (U4), reponer fotos con datos de material/precio.

## AVISO DE USO (22-oct)
El dueño informó 87 % de la sesión y 80 % semanal. Se pidió pausa a los agentes en marcha (fidelidad y W8). No se lanza trabajo nuevo hasta cambiar de cuenta.
Spike de video TERMINADO: ver CIERRE_MVP/spikes/video-informe.md (Veo 3.1 fast funciona, ~139 s por clip; proyecto con USD 300 por confirmar, U3; Veo 3.1 se retira el 17-nov-2026).

## Créditos de Google Cloud (confirmado por captura del dueño, 22-oct)
- Proyecto con los créditos: `luz-creative-engine-2` (cuenta herrera.importaciones1@gmail.com). Ya hay un VERTEX_SETUP.md que explica la rotación: en Vercel solo se tocan `GEMINI_SERVICE_ACCOUNT_KEY` y `GCP_PROJECT_ID`; NUNCA `GOOGLE_SERVICE_ACCOUNT_KEY` (es Firebase, proyecto gen-lang-client-0895574081).
- Saldo en la consola: "$7.944 de $276.998 créditos usados", vence el 29-dic-2026. La consola está en pesos (CLP), así que son ~USD 290 en total, no más. Vencen en ~68 días, no 90: el presupuesto diario sube a ~USD 4/día. W8 debe ajustar topes y el plan debe dejar de contar con "3 meses". (Conversión CLP→USD aproximada; confirmar en facturación.)
- El spike de video falló en gen-lang-client-0895574081 porque ese es el proyecto de Firebase, no el de Vertex; funcionó en otro proyecto. Falta repetir el chequeo de acceso a Veo en luz-creative-engine-2 (1 clip).
- Hooks globales corregidos hoy (comillas en settings.json, respaldo settings.json.bak-comillas-hooks); el aviso de RETOMAR.md ya funciona. Aún no hay usage-snapshot.json: el % lo informa el dueño.

## Fuente de verdad
- Plan: CIERRE_MVP/PLAN_PILOTO_3_DIAS.md · Instrucciones del orquestador: CIERRE_MVP/PROMPT_ORQUESTADOR.md
- Tablero vivo: CIERRE_MVP/ESTADO.md · Decisiones y diferencias plan/código: CIERRE_MVP/DECISIONES.md

## Hecho y verificado
- W0: contratos src/modules/piloto/types.ts, hook usePilotAccess, ruta /mi-negocio, enlace condicional en el menú. tsc y build verdes. Commit 8da9afb.
- W1 dossier v1 (sin revisión del orquestador aún): CIERRE_MVP/investigacion/01..05 y huecos-01..05; datos en src/data/jewelry-market/*.json (se agregó excepción en .gitignore). Commit ced2c9b.
- Línea base: tsc 0 errores; build ok.

## A medias (agentes; cada uno deja su PUNTO-DE-RETOMA)
- Spike fidelidad: CORTADO por error 529 de la API (no por culpa del trabajo). Gastó 32 de 40 imágenes y ~USD 2,3 (tope 4); sus datos están en CIERRE_MVP/spikes/fidelidad-gasto.csv y fidelidad-salidas/. Falta: correr `node scripts/piloto-spikes/fidelidad.mjs verify` (puntaje automático, incremental), mirar las hojas de contacto y redactar fidelidad-informe.md (aún NO existe, no hay veredicto de Puerta A). Detalle: CIERRE_MVP/spikes/PUNTO-DE-RETOMA-fidelidad.md. No generar más imágenes sin decidir (quedan 8 de margen). Usó el proyecto luz-ai-studio; el de créditos es luz-creative-engine-2.
- Spike video: CIERRE_MVP/spikes/PUNTO-DE-RETOMA-video.md (tope 3 clips / USD 8).
- W8 gasto y acceso: A MEDIAS. Worktree ../luz-piloto-w8, rama piloto/w8-gasto (commits 821d48d, 563924a, sin push, sin mergear). Hecho: ledger, precios verificados, integración en image/image-worker/content, 15 pruebas con Redis falso. Falta: reglas Firestore/Storage + config/pilot, GUIA_PRESUPUESTO_GCP.md, w8-informe.md, grep de secretos. Plan privado = plan 'admin' con role 'user' (nunca role 'admin'). Los 4 errores de tsc del worktree vienen de JSON ignorados por git que no existen allí; en main tsc está limpio. Retoma: CIERRE_MVP/informes/PUNTO-DE-RETOMA-w8.md en ese worktree.
- Si un agente quedó cortado: relanzarlo con "Ya existe trabajo previo; léelo y continúa sin rehacer lo terminado".

## Siguiente paso exacto
1. (HECHO) Puerta A decidida en DECISIONES.md: fidelidad restringida (estrategia C), video con condiciones.
2. Mergear W8 (revisar diff, tsc, build), reexportar los tipos del libro en piloto/types.ts.
3. Corregir tildes/eñes de los JSON de copy-bank, hashtags y calendar-chile.
4. Redactar el Checkpoint de flujo para el dueño (3 pantallas + bloqueos U1–U5) y lanzar W3, W2, W7 (worktrees a mano: git worktree add -b piloto/wN ../luz-piloto-wN + unión node_modules).
5. Sintetizar playbook joyeria y recipes.json con W1 + spike de fidelidad.

## Decisiones pendientes del dueño
1. U1: 5-10 fotos reales, material y precios de ella. 2. U2: capturas del feed de Silene (ver huecos-01..05). 3. U3: alerta de presupuesto en Google Cloud (guía de W8) y acceso a Veo. 4. U4: uid de la cuenta de ella.

## Cómo probar
npx tsc --noEmit  ·  npm run build  ·  entrar a /mi-negocio con cuenta admin.
Deploy: vercel deploy --prod manual al cierre de cada día (aún no se hizo hoy).

## Cómo retomar (frase para Claude)
"Retoma el Piloto de joyería: lee RETOMAR.md, CIERRE_MVP/ESTADO.md y los PUNTO-DE-RETOMA de cada agente, revisa git status y continúa."

## Advertencias
- No tocar ni commitear: *.bat, modules/motor-de-imagenes-corregido-v2/**, package.json, package-lock.json, PRODUCT.md, scripts/higgsfield-seedance-example.mjs, PLAN_CIERRE_FINAL.md.
- Nunca git add . ni -A. Sin claves en documentos.
