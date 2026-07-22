# Luz Photodump QA Agent

Agente privado de revisión visual para Photodump. Reemplaza el MVP de la rama
`feat/photodump-qa-worker` (obsoleto, sin memoria y sin conexión al código real).

## Qué hace esta versión (Etapa 1 — solo detección y reporte)

- Vigila `LuzPhotodumpAgent/INBOX/<prueba>/` esperando `images.zip` + `debug.json`
  (los mismos dos archivos que ya bajan los botones "↓ ZIP" y "Debug" en
  Photodump, dentro de la app).
- Extrae las imágenes a `RESULTS/<prueba>/`.
- Indexa las referencias del banco (`REFERENCES/*.jpg|png|webp`) **una sola
  vez** — guarda un descriptor corto por imagen en `REFERENCES/index.json`,
  identificado por hash de archivo. Corridas siguientes reusan el descriptor
  en vez de volver a mandarle la imagen a Gemini.
- Evalúa cada shot generado contra esas referencias y el `prompt`/`objective`
  reales tomados de `debug.json` (no adivina el contexto).
- Por cada hallazgo, usa el `recipe` real de `debug.json` para saber en qué
  carpeta del repo buscar, y hace un grep dirigido por palabras clave según
  el criterio (`hands` → anatomía/extraLimb, `product_quantity` → allocator,
  etc.) — devuelve archivo:línea candidato, no una opinión sin base.
- Escribe `REPORTS/<prueba>/report.json` y `report.md` (legible), y un
  resumen de corrida en `REPORTS/batch_<timestamp>.md` cuando procesa varias
  pruebas seguidas.

**Esta versión no crea ramas ni modifica código.** Es diagnóstico, no cirugía
— sirve para calibrar el criterio del evaluador contra tu propio juicio antes
de darle permiso de tocar el repo.

## Carpeta externa

```text
LuzPhotodumpAgent/
├── INBOX/<prueba>/
│   ├── images.zip     ← botón "↓ ZIP" de PhotodumpModule
│   └── debug.json     ← botón "Debug" de PhotodumpModule (currentSet.debugData)
├── REFERENCES/         ← banco de referencias + index.json (memoria)
├── RESULTS/<prueba>/   ← imágenes ya extraídas, histórico
├── APPROVED/ REJECTED/ ← para calibrar el criterio a futuro (aún no usado por el agente)
└── REPORTS/<prueba>/
    ├── report.json
    └── report.md
```

## Cómo generar los dos archivos de entrada

Hoy Photodump ya los genera, solo hay que copiarlos a `INBOX/`:

1. Generar un set en Photodump (con una cuenta admin, `debugData` solo existe
   para admins).
2. Botón "↓ ZIP" → guardar como `images.zip`.
3. Botón "Debug" (el mismo panel) → guardar como `debug.json`.
4. Crear `LuzPhotodumpAgent/INBOX/<nombre-de-la-prueba>/` y poner ambos
   archivos ahí. El watcher los detecta solo.

## Inicio

```bash
npm install
cp .env.example .env
# completar GEMINI_API_KEY, QA_AGENT_ROOT, QA_REPO_ROOT en .env
npm run dev
```

En Windows PowerShell, sin `.env`:

```powershell
$env:GEMINI_API_KEY="tu_clave"
$env:QA_AGENT_ROOT="C:\Users\Nico Trabajo\Downloads\luz-ia-studio (1)\LuzPhotodumpAgent"
$env:QA_REPO_ROOT="C:\Users\Nico Trabajo\Downloads\luz-ia-studio (1)"
npm run dev
```

## Seguridad y límites

- Solo lee imágenes y JSON dentro de `LuzPhotodumpAgent/` y solo lee código
  (nunca escribe) dentro del repo, para ubicar sospechosos.
- No toca `main`, no crea ramas, no corre `vercel deploy`.
- No borra nada de `INBOX/` — queda como histórico junto al resultado.

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
