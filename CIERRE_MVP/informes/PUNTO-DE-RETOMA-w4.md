# Punto de retoma W4 (motor de estrategia sobre Planner v3)

Rama: piloto/w4-plan (worktree luz-piloto-w4-plan). Sin push. Estado: EN CURSO (pausado por limite de uso).

## Entorno
- node_modules del worktree es una union a una instalacion en el scratchpad de la sesion (el del repo principal esta vacio; sin firebase-admin => 9 errores tsc de api/ y server/ que no son mios, mas los 4 JSON conocidos). Si se pierde: copiar package.json a una carpeta, `npm i --legacy-peer-deps` + tsx, y `mklink /J node_modules <esa carpeta>`.
- Pruebas: `npx tsx scripts/piloto-spikes/w4-pickplaybook-test.ts`, `npx tsx scripts/piloto-spikes/w4-launch-plan-test.ts offline` (sin gasto) y `... live 3` (Gemini, max 8 llamadas).

## Hecho y verificado
- plannerV3Types.ts: PlanGoal 'start'; ContentPlan.launchOutline? y aiDisclosureReminder? (opcionales).
- playbooks.ts: playbook joyeria (exactKeywords + weight), MODA sin palabras de joyeria. 12 casos OK.
- piloto/recipes.ts: mapa receta -> tomas del director (en_el_cuerpo, escala, videos apagadas).
- planner/v3: launchTypes.ts, launchCalendar.ts (6 semanas desde manana, BF en semana 5, cortes en semana 6), jewelryCopy.ts (banco con tildes, reglas de claims), launchPlanValidator.ts, launchPlanEngine.ts (prompt, reintento, relleno determinista, fallback total).
- plannerV3AiService.ts: embudo 'start' en prompt semanal; generateLaunchPlan() y launchResultToPlanFields().
- Prueba offline: 14 de 15 OK. El "MAL" (respuesta hostil, fuga "prompt") es falso positivo del test: busca la palabra en el JSON y aparece el nombre del campo `"prompt":""`. Corregir el test para revisar solo los textos.

## Falta (nada de esto se hizo)
1. Arreglar ese falso positivo en w4-launch-plan-test.ts.
2. Correr `live 3` (ya NO se hicieron llamadas a Gemini) y guardar CIERRE_MVP/informes/w4-ejemplo-plan.json. Verificar semana 1 con receta+producto real y 3 corridas sin errores de formato.
3. `npx tsc --noEmit` final tras los cambios del servicio (el ultimo tsc corrio quiza antes de editarlo): no debe haber errores en archivos nuevos.
4. Revisar calidad de los captions reales y afinar prompt si hay muchas reparaciones.
