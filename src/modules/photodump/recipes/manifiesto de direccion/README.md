# Photodump Refactor — Fases 1 a 7

Este paquete convierte la investigación visual y psicológica en una base de producto y arquitectura accionable.

## Empezar acá si es una conversación nueva

Leer primero **`09_session_log_outfit_night_out_validation.md`** — es la bitácora de la primera validación manual completa (outfit_night_out, Test A, 7/7 shots aprobados), con el proceso paso a paso para replicarlo en la siguiente receta, los 5 hallazgos de arquitectura que salieron de esa validación, el estado del banco SeaDream, y qué falta. El resto de los documentos son la referencia de fondo; ese es el mapa de dónde se quedó el trabajo.

Después leer **`10_experimental_findings_001.md`** — 4 hallazgos experimentales adicionales (validados con comparativas reales en Higgsfield) sobre el límite entre razonamiento del Director y prompt final, y sobre el render fotográfico como capa independiente de la escena. Ya están incorporados a `03_photodump_recipe_architecture.md` (sección 4.3, 4.8 y la nueva sección 19) y al contrato de receta (`05_recipe_contract.ts`).

## Contenido

1. `01_visual_intelligence_database.md` / `.json`
2. `02_the_psychology_behind_photodump_v2.md`
3. `03_photodump_recipe_architecture.md`
4. `04_fashion_mother.md`
5. `05_recipe_contract.ts`
6. `05_outfit_night_out.normalized.ts`
7. `05_outfit_night_out.validation.md`
8. `06_repository_audit.md`
9. `07_manual_revalidation_protocol.md`
10. `07_revalidation_queue.md`
11. `08_knowledge_bank_query_design.md`
12. `09_session_log_outfit_night_out_validation.md`
13. `10_experimental_findings_001.md`
14. `SOURCES_AND_METHOD.md`

## Estado

- Fases 1–6: desarrolladas en este paquete.
- Fase 7: **en curso, ya no bloqueada.** `outfit_night_out` tiene su Test A completo (7 shots visibles + REF0, todos aprobados manualmente en Higgsfield) — ver `09_session_log_outfit_night_out_validation.md`. Faltan Test B y C de esta receta, y arrancar R2 (`outfit_check`) de la cola.
- Banco de conocimiento transversal SeaDream (428 entradas, `categoryFit` por 6 categorías de producto) normalizado y depurado — ver sección 6 de `09_session_log_outfit_night_out_validation.md`. Diseño de consulta conceptual en `08_knowledge_bank_query_design.md`, implementación pendiente.
- Fase 8, integración: deliberadamente no incluida, porque debe ocurrir después de la revalidación visual.

## Decisión científica

El paquete no usa el “cerebro reptil” como una anatomía literal. La teoría del cerebro triuno es una simplificación desactualizada. Se conserva lo útil de la intuición comercial y se transforma en un modelo de **impulsos motivacionales**: seguridad, estatus, atracción, pertenencia, facilidad, exploración y autocuidado.

## Regla central

Photodump no pregunta solamente qué producto mostrar. Decide qué identidad, sensación y experiencia debe desear el espectador, y después integra el producto de forma fiel dentro de esa vida.
