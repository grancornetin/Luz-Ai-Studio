# Director Lab — Changelog de archivos

## Archivos existentes modificados (mínimo, no destructivo)

- `server.js`: +2 líneas de `require` (`director-lab/http/routes`, `director-lab/seed/seed-t5b`), +1 línea de llamada a `directorLabSeed.ensureSeeded()` junto a `loadJobs()/loadLogs()`, +4 líneas de dispatch (`if (parsed.pathname.startsWith('/api/director-lab/'))`) dentro del `try` existente, antes del primer chequeo de `/api/campaign-store/status`. Ninguna ruta ni lógica existente fue tocada o eliminada.

## Archivo nuevo agregado (fix de bug preexistente, no relacionado a lógica de Director Lab)

- `package.json` (nuevo, raíz de `motor-de-imagenes-corregido-v2/`): agregado con `"type": "commonjs"` porque el proyecto no tenía ningún `package.json` propio y, al copiarse dentro de `luz-ia-studio (1)/modules/`, heredaba `"type": "module"` del `package.json` del proyecto padre, rompiendo todos los `require()` de `server.js`. Ver `DIRECTOR_LAB_AUDIT.md`.

## Archivos de datos copiados (sin modificar el original)

- `campaign-trainer-data/director-rules/campaign_director_rules_ugc.json` (nuevo): copia de `Downloads/campaign_director_rules_ugc (1).json` (versión más completa, verificada por hash MD5 contra la copia `(2)`, idénticas).

## Archivos/carpetas nuevos (todo el código de Director Lab)

```
director-lab/
├── core/schemas.js, bank-registry.js, candidate-retrieval.js, candidate-ranking.js,
│        rule-engine.js, gemini-selector.js, prompt-composer.js, validators.js, director-core.js
├── adapters/scene-bank-adapter.js, hpi-adapter.js, director-rules-adapter.js
├── persistence/atomic-write.js, ids.js, store.js, assets.js, projects.js, recipes.js,
│              cases.js, runs.js, references.js, results.js, evaluations.js, learning-proposals.js
├── http/routes.js
├── seed/seed-t5b.js
└── tests/ (9 archivos, 35 tests con node:test)

director-lab-data/                          (persistencia física nueva, vacía salvo hpi-snapshot.json)
└── hpi-snapshot.json                       (snapshot curado a mano, documentado como limitación del MVP)

DIRECTOR_LAB_AUDIT.md
DIRECTOR_LAB_ARCHITECTURE.md
DIRECTOR_LAB_README.md
DIRECTOR_LAB_CONTRACT.md
DIRECTOR_LAB_CHANGELOG.md (este archivo)
```

En `luz-ia-studio (1)/src/`:

```
src/modules/directorLab/
├── DirectorLabModule.tsx
├── directorLabClient.ts
├── types.ts
└── components/
    ├── ProjectSidebar.tsx, BriefForm.tsx, ReferencesPanel.tsx, RunResultView.tsx,
    │   TraceSection.tsx, CandidateList.tsx, EvaluationPanel.tsx, CompareView.tsx, BankStatusPanel.tsx
```

## Archivos existentes modificados en `luz-ia-studio (1)/src/`

- `src/App.tsx`: +2 líneas (import lazy dev-only de `DirectorLabModule`, ruta `/director-lab` envuelta en `{import.meta.env.DEV && ...}`).
- `src/views/Dashboard.tsx`: +1 grupo condicional `...(import.meta.env.DEV ? [...] : [])` agregado al final de `MODULE_GROUPS`, con una sola tarjeta "Director Lab" bajo el grupo "Dev tools". Ninguna tarjeta ni grupo existente fue modificado.

## Nada fue borrado ni migrado destructivamente

`campaign-trainer-data/` (scene-bank.json, manifest.json, analyses/, images/, thumbnails/, queue/, logs/) permanece intacto. `facial-expression-intelligence/` permanece intacto. `campaign-trainer.html`, `campaign-trainer-v2.html`, `seadream-prompt-studio.html`, `seadream-combinador.html` no fueron tocados.
