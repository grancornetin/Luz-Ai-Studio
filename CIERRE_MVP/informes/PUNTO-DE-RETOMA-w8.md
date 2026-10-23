# Punto de retoma W8 (libro de gasto + acceso privado)

Rama: piloto/w8-gasto (worktree luz-piloto-w8). Sin push.

## Hecho y verificado
- src/modules/piloto/budget/ledgerTypes.ts (contrato) y pricing.ts (precios verificados 2026-10-22 en cloud.google.com/vertex-ai/generative-ai/pricing; video = 'pendiente' => deshabilitado).
- api/piloto/ledger.ts: checkBudget / recordSpend / releaseReservation (Redis INCRBY+rollback, falla cerrado), PILOT_UIDS, PILOT_LOCKDOWN, endpoint status.
- scripts/piloto-spikes/ledger-test.mjs: 15 pruebas OK (`node scripts/piloto-spikes/ledger-test.mjs`): tope diario, total, semanal, concurrencia, uid ajeno, video off, Redis caido.
- Integracion: api/gemini/image.ts (reserva antes de concurrencyAcquire; libera si 429/falla de encolado), image-worker.ts (confirma/ libera tras concurrencyRelease), content.ts (cobro estimado al inicio), ugc.ts (cerrada para uids piloto).
- tsc: solo 4 errores previos (src/data/trainer/inteligencia ugc/*.json no existen), ninguno mio.

## Pendiente: NADA. W8 cerrado (ver w8-informe.md)
1. firestore.rules: agregar users/{uid}/catalog, pilotAssets (owner rw), budgetLedger (owner SOLO read; write false), config/pilot (read si uid in resource.data.uids; write false). Probar: no hay firebase.json/emulador en el repo -> analisis manual.
2. storage.rules: ya cubre users/{uid}/** solo-dueno; opcional regla explicita pilotAssets con limite de tamano/tipo.
3. CIERRE_MVP/GUIA_PRESUPUESTO_GCP.md (5 pasos: Billing > Budgets & alerts, 50/80/100 %, cuotas Vertex).
4. CIERRE_MVP/informes/w8-informe.md: decision plan `admin` con role 'user' (NO role admin: da lectura de todos los usuarios en rules); registro cerrado (Identity Platform "deshabilitar sign-up" / blocking functions; hoy initUser da 20 creditos a cualquiera y cualquier sesion puede gastar saldo -> usar PILOT_LOCKDOWN=1); env vars (PILOT_UIDS, PILOT_LOCKDOWN, PILOT_*_CAP_USD, GCP_PROJECT_ID, GEMINI/GOOGLE_SERVICE_ACCOUNT_KEY, KV_REST_API_URL/TOKEN, QSTASH_*, WORKER_BASE_URL, FIRESTORE_DATABASE_ID); vercel.json: api/piloto/ledger.ts cae en la regla api/**/*.ts (60 s), no requiere cambio.
5. Riesgos a anotar: rutas sin medir (api/avatar/clone*, api/batch.ts, evolink-worker) siguen abiertas; evolink-worker no libera concurrencia (preexistente); userPlan lo manda el cliente; reservas huerfanas quedan contadas (conservador); config/pilot espejo aun no se escribe (solo status endpoint).
6. grep de secretos en archivos nuevos (no hay llaves en cliente: pricing/ledgerTypes no leen env).
