# Photodump Refactor — Fases 1 a 7

Este paquete convierte la investigación visual y psicológica en una base de producto y arquitectura accionable.

## Empezar acá si es una conversación nueva

Leer primero **`09_session_log_outfit_night_out_validation.md`** (proceso completo, 5 hallazgos de arquitectura, estado del banco SeaDream), después **`10_session_log_outfit_reveal_basic_validation.md`** (segunda receta validada, con el hallazgo sobre posición de citas de Elements) y **`11_session_log_outfit_weekly_recap_validation.md`** (tercera receta — nace como "weekly recap" y termina fusionada en `outfit_multi_look`, la receta base que sirve a 5 historias distintas con un solo motor técnico: weekly, then_vs_now, rate_check, trip_recap, curated_ideas). **La sección 6quater de ese último documento tiene la tabla de "qué receta usar para qué historia" — es el punto de entrada más rápido si ya conocés el manifiesto y solo necesitás decidir qué receta corresponde a una historia nueva.** El resto de los documentos son la referencia de fondo; esos tres son el mapa de dónde se quedó el trabajo.

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
13. `10_session_log_outfit_reveal_basic_validation.md`
14. `11_session_log_outfit_weekly_recap_validation.md`
15. `SOURCES_AND_METHOD.md`

## Estado

- Fases 1–6: desarrolladas en este paquete.
- Fase 7: **en curso, ya no bloqueada.** `outfit_night_out` tiene su Test A completo (set de prueba de 7 shots visibles + REF0 — no es un número fijo, ver hallazgo de "beats como pool") — ver `09_session_log_outfit_night_out_validation.md`. `outfit_reveal_basic` (3/3 shots) tiene Test A completo — ver `10_session_log...md`. `outfit_multi_look` (receta base que fusiona weekly/then_vs_now/rate_check/trip_recap/curated_ideas — ver `06_repository_audit.md`) tiene 3 de 5 intenciones con set de prueba (`weekly` completo, `then_vs_now` completo, `trip_recap` funcionalmente completo); faltan `rate_check` y `curated_ideas` — ver `11_session_log...md` sección 6-6quater. Faltan Test B/C de todas.
- Banco de conocimiento transversal SeaDream (428 entradas, `categoryFit` por 6 categorías de producto) normalizado y depurado — ver sección 6 de `09_session_log_outfit_night_out_validation.md`. Diseño de consulta conceptual en `08_knowledge_bank_query_design.md`, implementación pendiente.
- Fase 8, integración: deliberadamente no incluida, porque debe ocurrir después de la revalidación visual.

## Decisión científica

El paquete no usa el “cerebro reptil” como una anatomía literal. La teoría del cerebro triuno es una simplificación desactualizada. Se conserva lo útil de la intuición comercial y se transforma en un modelo de **impulsos motivacionales**: seguridad, estatus, atracción, pertenencia, facilidad, exploración y autocuidado.

## Regla central

Photodump no pregunta solamente qué producto mostrar. Decide qué identidad, sensación y experiencia debe desear el espectador, y después integra el producto de forma fiel dentro de esa vida.
