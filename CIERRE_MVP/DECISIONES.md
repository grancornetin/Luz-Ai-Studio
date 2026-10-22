# DECISIONES — Piloto automático para joyería

Registro de decisiones, recortes y verificaciones. Cada entrada con fecha.

## 2026-10-22 — Diferencias entre el plan y el código (verificadas al arrancar)

| # | Plan decía | Código real | Qué hacemos |
|---|---|---|---|
| D1 | `PlanGoal` nuevo `'start'` | Hoy: `'sell' \| 'grow' \| 'launch' \| 'maintain'` (`plannerV3Types.ts:9`). Existe `launch` ("Lanzar algo nuevo") | W4 agrega `'start'` sin quitar los existentes (compatibilidad con planes guardados) |
| D2 | Playbook `joyeria` con keywords "priorizadas sobre moda" | `MODA` ya incluye `joya`, `arete`, `collar`, `accesorio`, `bisuteria` como keywords. `pickPlaybook` elige por puntaje | W1/W4 crean `joyeria` y el puntaje debe ganarle a `moda` en esas palabras; probar con marca de joyería |
| D3 | Plan semanal de 1 semana; `ContentPlan` sin esquema de 6 semanas | `ContentPlan` es una semana (`weekNumber`, `tasks`). `PlanTask` hoy exige `prompt`, `howToConfigure`, `whatToUpload` para otro módulo | W4 extiende con `PilotTaskExtension` (opcional, ver `src/modules/piloto/types.ts`); no se cambia el contrato existente |
| D4 | "Veo: cero código en la app" | Cierto: solo menciones de texto en `photodump` y `playbooks` | Sin cambio |
| D5 | Línea base de `tsc` | `npx tsc --noEmit` = 0 errores (exit 0) el 22-oct | Cualquier error nuevo es de quien lo introdujo |
| D6 | Créditos plan `admin` ilimitado | Existe (`creditConfig.ts`: `admin: 999999`, `MODULES_WITH_PRO_ACCESS` lo incluye) | W8 decide admin vs. plan `private` |
| D7 | Menú condicional | Sidebar en `App.tsx` usa `MENU_GROUPS` fijo + `isAdmin` de `useAuth`; hay `MobileBottomNav` aparte | W0 agregó enlace condicional en Sidebar; ocultar el resto del menú para modo privado queda en W7 (incluye `MobileBottomNav`) |
| D8 | `vercel.json` | `api/gemini/image-worker.ts` maxDuration 120; `api/**/*.ts` 60 s. Video necesitará worker nuevo con función propia | Decisión según spike de video; `vercel.json` lo toca solo el orquestador |
| D9 | Worktree por agente | La herramienta de aislamiento falló ("could not read git config"); se crean a mano con `git worktree add ../luz-piloto-wN` + unión `node_modules` | Procedimiento fijo para W2–W7 |
| D10 | `PLAN_CIERRE_FINAL.md` modificado localmente por otra sesión | Archivo con cambios sin commitear | No se toca ni se incluye en commits |

## 2026-10-22 — Decisiones

- **Modo privado (W0):** hook `usePilotAccess` = cuenta admin O uid en `VITE_PILOT_UIDS`. W8 lo extiende con lista del servidor. Ruta `/mi-negocio/*`.
- **Contratos:** `src/modules/piloto/types.ts` publicado. Los tipos del libro de gasto vienen de W8 (`budget/ledgerTypes.ts`) y se reexportan al mergear.
- **Competencia (W1e / capturas):** el sub-frente 5 (análisis de capturas) queda en espera de insumos U2; en su lugar se lanzó un 5º agente para Meta Ad Library + video público.
- **Pruebas de generación:** tope duro por spike (fidelidad: 40 imágenes/~USD 4; video: 3 clips/USD 8) porque el libro de gasto (W8) aún no estaba mergeado.

## Verificaciones con fecha

- 2026-10-22: tsc limpio en `main` (e8c688e).

## 2026-10-22 — Puerta A (decisión del orquestador)
- **Fidelidad: PASA CON RECETAS RESTRINGIDAS.** Estrategia por defecto: componer el recorte del producto original sobre fondo generado (nunca regenerar la joya). Recetas activas: catálogo limpio, flatlay, macro con revisión. Fuera por ahora: "en el cuerpo" y estilo de vida (no probada). Control automático = alarma, no juez. Sin validar con producto real (U1).
- **Video: CONFIRMADO CON CONDICIONES.** Veo 3.1 fast, ~139 s/clip, requiere worker con sondeo; Veo 3.1 se retira el 17-nov-2026; acceso en luz-creative-engine-2 sin confirmar. Queda detrás de flag; es lo primero que se recorta.
- **Presupuesto:** créditos vencen 29-dic-2026 (~68 días), ~USD 290 → ~USD 4/día.
