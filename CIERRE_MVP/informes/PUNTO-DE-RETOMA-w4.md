# Punto de retoma W4 (motor de estrategia sobre Planner v3)

Rama: piloto/w4-plan (worktree luz-piloto-w4-plan). Sin push. Estado: EN CURSO.

## Entorno
- node_modules del worktree apunta a una instalacion en el scratchpad (el del repo principal esta vacio). Es solo una union local, no se versiona.
- Pruebas: `npx tsx scripts/piloto-spikes/w4-*.ts`.

## Hecho y verificado
- [x] PlanGoal 'start' + GOAL_LABELS (plannerV3Types.ts); ContentPlan.launchOutline? y aiDisclosureReminder? (opcionales).
- [x] Playbook `joyeria` (+ exactKeywords/weight, MODA sin palabras de joyeria). Prueba: scripts/piloto-spikes/w4-pickplaybook-test.ts (12 casos OK).
- [x] src/modules/piloto/recipes.ts (mapa receta -> tomas del director).
- [x] launchTypes.ts

## Falta
- launchCalendar.ts, jewelryCopy.ts, launchPlanValidator.ts, launchPlanEngine.ts, integracion en plannerV3AiService.ts, embudo 'start' en prompt semanal.
- Pruebas con Gemini (max 8 llamadas) -> CIERRE_MVP/informes/w4-ejemplo-plan.json
- tsc sin errores nuevos.
