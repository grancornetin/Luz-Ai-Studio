# Luz Photodump QA Agent

Agente privado de revisión visual para Photodump. Reemplaza el MVP de la rama
`feat/photodump-qa-worker` (obsoleto, sin memoria y sin conexión al código real).

## Qué hace esta versión (Etapa 1 — solo detección y reporte)

- Vigila automáticamente tu carpeta de Descargas (`QA_DOWNLOADS_DIR`) buscando
  `photodump_debug_*.json` nuevos + sus imágenes hermanas (sueltas o en zip,
  descargadas con los botones "↓ ZIP" y "Debug" de Photodump). No hace falta
  copiar ni renombrar nada a mano.
- Extrae/copia las imágenes a `RESULTS/<prueba>/`.
- Evalúa cada shot generado contra las referencias **ya indexadas** del banco
  y el `prompt`/`objective` reales tomados de `debug.json` (no adivina el
  contexto). Esto es rápido — solo tantas llamadas a Gemini como shots tenga
  la prueba.
- Por cada hallazgo, usa el `recipe` real de `debug.json` para saber en qué
  carpeta del repo buscar, y hace un grep dirigido por palabras clave según
  el criterio (`hands` → anatomía/extraLimb, `product_quantity` → allocator,
  etc.) — devuelve archivo:línea candidato, no una opinión sin base.
- Escribe `REPORTS/<prueba>/report.json` y `report.md` (legible), y un
  resumen de corrida en `REPORTS/batch_<timestamp>.md`.

**Esta versión no crea ramas ni modifica código.** Es diagnóstico, no cirugía
— sirve para calibrar el criterio del evaluador contra tu propio juicio antes
de darle permiso de tocar el repo.

## Dos procesos separados — importante

Evaluar una prueba e indexar el banco de referencias **son cosas distintas
que no deben bloquearse entre sí**:

### 1. Evaluar pruebas (`npm run dev`)

El de siempre — queda corriendo, vigila Descargas, y evalúa cada prueba
nueva contra las referencias que ya estén indexadas hasta ese momento. Rápido
(unos pocos shots por prueba).

### 2. Indexar el banco de referencias (`npm run index-references`)

Aparte, cuando quieras. Le da una descripción a cada imagen nueva de
`REFERENCES/` (recursivo, con subcarpetas) y la guarda para siempre en
`REFERENCES/index.json` — nunca se vuelve a analizar la misma imagen dos
veces. Con un banco grande (cientos de imágenes) puede tardar bastante por
el ritmo lento y seguro contra Gemini — dejalo corriendo en su propia
ventana, se puede cortar y retomar cuando quieras sin perder progreso.

**Mientras el banco no esté 100% indexado**, las pruebas se evalúan igual —
solo que comparando contra las referencias indexadas hasta ese momento, no
las 608 completas. No invalida el análisis, solo lo hace más rico a medida
que avanza la indexación.

## Carpeta externa

```text
LuzPhotodumpAgent/
├── INBOX/<prueba>/          ← armado automático desde Descargas, o a mano
│   ├── debug.json
│   └── (imágenes sueltas o images.zip)
├── REFERENCES/              ← banco de referencias + index.json (memoria)
│   ├── contenido enfocado en outfits/
│   └── contenido influencer/
├── RESULTS/<prueba>/        ← imágenes ya extraídas, histórico
├── APPROVED/ REJECTED/      ← para calibrar el criterio a futuro (aún no usado)
└── REPORTS/<prueba>/
    ├── report.json
    └── report.md
```

## Cómo generar una prueba nueva

1. Generar un set en Photodump (con una cuenta admin, `debugData` solo existe
   para admins).
2. Botón "↓ ZIP" para bajar las imágenes, botón "Debug" para bajar el JSON —
   como siempre, sin tocar nada especial.
3. Listo. El agente los detecta solo en tu carpeta de Descargas (revisa cada
   `QA_DOWNLOADS_POLL_SECONDS`, 30s por defecto) y arma la prueba en `INBOX/`.

Si preferís hacerlo a mano: crear `LuzPhotodumpAgent/INBOX/<nombre>/` con
`debug.json` + las imágenes (sueltas o `images.zip`) adentro.

## Credenciales

El agente usa **las mismas credenciales de Vertex AI que ya usa la app en
producción** (`api/gemini/image-worker.ts`) — no una `GEMINI_API_KEY` suelta
de Google AI Studio. Ver `COMO_FUNCIONA.md` para el detalle completo de cómo
se arma esa conexión (útil si querés recrearla en otra herramienta).

Si la cuenta de servicio original está marcada "Sensitive" en Vercel (queda
irrecuperable para siempre), hay que crear una cuenta de servicio nueva en
Google Cloud Console con rol `Vertex AI User` — ver `COMO_FUNCIONA.md`
sección 1.5.

## Inicio

```bash
npm install
cp .env.example .env
# completar GCP_PROJECT_ID, GEMINI_SERVICE_ACCOUNT_KEY, QA_AGENT_ROOT, QA_REPO_ROOT, QA_DOWNLOADS_DIR en .env
npm run dev
```

En otra terminal, cuando quieras avanzar el banco de referencias:

```bash
npm run index-references
```

## Velocidad y cuota — por qué es lento a propósito

Una cuenta de servicio de Vertex AI recién creada tolera muy poca velocidad
antes de responder con error 429 (`RESOURCE_EXHAUSTED`) — se probó en vivo
que ni siquiera 3 llamadas por minuto era seguro. Por eso:

- Todo pasa de a **1 llamada a la vez** a Gemini, nunca en paralelo.
- Con `QA_DELAY_BETWEEN_CALLS_SECONDS` (25s por defecto) de espera entre
  cada una.
- Con reintento automático (espera creciente) si igual aparece un 429 o un
  corte de red transitorio.

Si tu cuenta de servicio ya tiene más cuota asignada (revisar en Google
Cloud Console → IAM & Admin → Cuotas, filtrando Vertex AI), se puede bajar
`QA_DELAY_BETWEEN_CALLS_SECONDS` con más margen.

## Seguridad y límites

- Solo lee imágenes y JSON dentro de `LuzPhotodumpAgent/` y tu carpeta de
  Descargas, y solo lee código (nunca escribe) dentro del repo, para ubicar
  sospechosos.
- No toca `main`, no crea ramas, no corre `vercel deploy`.
- No borra nada — ni de Descargas, ni de `INBOX/` — queda como histórico.

## Próximas etapas (no implementadas todavía)

1. Calibrar el evaluador comparando sus veredictos contra `APPROVED/`/`REJECTED/`
   etiquetados a mano.
2. Cuando el locator tenga confianza alta y el patrón ya se vio antes (ver
   `12_ESTADO_ACTUAL_retomar_aqui.md` del manifiesto de dirección — ahí están
   documentados 6+ bugs reales ya resueltos con este mismo mecanismo de
   diagnóstico manual), preparar una rama con el fix propuesto, correr lint +
   build, y dejarlo listo para revisión — nunca a `main` directo.
3. Evaluación de continuidad de secuencia completa en una sola llamada
   multimodal (hoy cada shot se evalúa por separado).
