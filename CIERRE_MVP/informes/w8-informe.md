# W8 informe: libro de gasto en USD y acceso privado

Rama piloto/w8-gasto. Sin push.

## Qué hay
- Contrato: src/modules/piloto/budget/ledgerTypes.ts. Precios (verificados 2026-10-22 en cloud.google.com/vertex-ai/generative-ai/pricing): pricing.ts. Video = 'pendiente' => deshabilitado.
- Servicio: api/piloto/ledger.ts (checkBudget / recordSpend / releaseReservation; Redis INCRBY atómico, falla cerrado). Endpoint POST /api/piloto/ledger con action 'status' y 'reserve'.
- Cliente: src/modules/piloto/budget/reserveSpend.ts => `reserveSpend(kind, estimatedUSD, taskId?)`. Máx. USD 1 por reserva.
- Topes por defecto: total USD 260 (saldo ~290, vence 29-dic-2026), diario USD 4, semanal por tipo imagen 17 / texto 2 / visión 2. Configurables con env.

## Cobertura de rutas (para uids en PILOT_UIDS)
- api/gemini/image.ts + image-worker.ts: medido (reserva antes de concurrencia; confirma/libera en el worker). Solo motor gemini; seedream/gptimage rechazados => evolink-worker NO se alcanza (sus jobs nacen solo en image.ts), queda cubierto.
- api/gemini/content.ts: medido (estimación al iniciar). Cubre texto y visión de Product Studio / imageApiService si pasan por esta ruta.
- api/gemini/ugc.ts y api/avatar/clone.ts: BLOQUEADAS para uids piloto (403 PILOT_ROUTE_OFF).
- api/batch.ts: solo con BATCH_ADMIN_SECRET (no sesión de usuario); no la alcanza la piloto.
- Cualquier llamada nueva que no use image.ts/content.ts debe llamar a reserveSpend antes.
- Ojo: llamadas de imagen que hagan generación DIRECTA a Vertex desde otras rutas no existen en api/ (revisado); si el piloto agrega una, medirla.

## Acceso privado
- PILOT_UIDS (servidor, lista separada por comas). Espejo para el cliente: documento Firestore config/pilot {uids:[...]}, solo lectura para esos uids (regla lista); crearlo a mano en consola.
- Plan: usar `plan: 'admin'` con `role: 'user'` en users/{uid} (mismos bypass de créditos y concurrencia 8; los créditos de la app no se descuentan). NO role 'admin': esa regla da lectura de todos los usuarios. Menor riesgo: no se crea plan nuevo (un plan `private` exigiría tocar creditConfig, credits.ts, concurrency.ts, reglas y UI).
- concurrencyRelease intacto: image.ts libera el cupo si el libro deniega después de adquirir o si falla el encolado.
- Registro cerrado: hoy cualquiera puede registrarse y initUser le regala 20 créditos. Opciones: (1) PILOT_LOCKDOWN=1 => image.ts y content.ts rechazan a todo uid fuera de PILOT_UIDS (cubre gasto de Gemini; ugc.ts/avatar no están en lockdown, quedan cerradas solo a piloto: añadir lockdown ahí si se activa); (2) en Firebase Authentication → Configuración → "Habilitar creación de usuarios" desactivado (Identity Platform), tras crear la cuenta de ella; no rompe cuentas existentes. Recomendado: ambas antes de pruebas masivas.

## Reglas
- firestore.rules: users/{uid}/catalog y pilotAssets (solo dueño), budgetLedger (dueño solo lee, write false), config/pilot (lectura solo uids de la lista, write false). Sin firebase.json ni emulador en el repo: análisis manual. Todas usan isOwner(userId) => otra cuenta no puede leer; el admin de rol no accede a catalog/pilotAssets/budgetLedger (solo dueño) aunque sí lee users/{uid}.
- storage.rules: users/{uid}/pilotAssets solo dueño, imagen/video, <50 MB (la regla general users/{uid}/** ya era solo dueño).

## Variables de entorno de producción
Revisar en Vercel: PILOT_UIDS, PILOT_LOCKDOWN (opcional), PILOT_TOTAL_CAP_USD / PILOT_DAILY_CAP_USD / PILOT_WEEKLY_{IMAGE,TEXT,VISION,VIDEO}_CAP_USD (opcionales), GCP_PROJECT_ID (= luz-creative-engine-2 si es el de los créditos), GEMINI_SERVICE_ACCOUNT_KEY o GOOGLE_SERVICE_ACCOUNT_KEY (servidor; la cuenta de servicio debe ser del proyecto con créditos), KV_REST_API_URL, KV_REST_API_TOKEN, QSTASH_TOKEN, QSTASH_CURRENT_SIGNING_KEY, QSTASH_NEXT_SIGNING_KEY, WORKER_BASE_URL, FIRESTORE_DATABASE_ID (si no es default), BATCH_INTERNAL_API_SECRET, ADMIN_SECRET. Ninguna con prefijo VITE_. Storage: bucket de Firebase del proyecto. Falta confirmar: que GCP_PROJECT_ID apunte al proyecto con créditos (no verificable desde el repo).
- Grep de secretos en api/piloto, src/modules/piloto y scripts/piloto-spikes: sin llaves ni tokens; pricing/ledgerTypes/reserveSpend no leen env sensibles.

## Verificación
- 15 pruebas (node scripts/piloto-spikes/ledger-test.mjs) con Redis falso. tsc: solo 4 errores previos (src/data/trainer/inteligencia ugc/*.json ausentes).
- No verificado: Upstash real, emulador Firestore, flujo extremo a extremo.

## Riesgos
- Reservas huérfanas quedan contadas (conservador, expiran el contador diario/semanal en 3-10 días; el total no).
- userPlan lo manda el cliente (preexistente; no afecta al libro, que se decide por uid verificado).
- Estimaciones de texto son aproximadas (margen 10 %); la alerta de Google (GUIA_PRESUPUESTO_GCP.md) es el respaldo.
- reserveSpend confía en el monto del cliente (acotado a USD 1); el cobro fuerte está en image.ts/content.ts.
