# Cola autónoma de revalidación

## Estado general

| Orden | Unidad | Estado |
|---:|---|---|
| 1 | Visual Intelligence Database | COMPLETADO V1 |
| 2 | Psychology v2 | COMPLETADO |
| 3 | Recipe Architecture | COMPLETADO V1 |
| 4 | Fashion Mother | COMPLETADO V1 |
| 5 | outfit_night_out normalizada | TEST A COMPLETO / PENDIENTE TEST B Y C — ver `09_session_log_outfit_night_out_validation.md` |
| 5b | outfit_reveal_basic (subreceta R2) | TEST A COMPLETO (3/3 shots) / PENDIENTE TEST B Y C — ver `10_session_log_outfit_reveal_basic_validation.md` |
| 5c | outfit_multi_look (subreceta R2, fusiona weekly/then_vs_now/rate_check/trip_recap) | TEST A: weekly completo (5/5), then_vs_now completo (1 par), trip_recap funcionalmente completo (2/3 NY) / FALTA rate_check — ver `11_session_log_outfit_weekly_recap_validation.md` |
| 6 | Auditoría repositorio | COMPLETADA CON ALCANCE DISPONIBLE |
| 7 | Revalidación receta por receta | PREPARADA / BLOQUEO VISUAL |
| 8 | Integración Claude Code | NO INICIAR |

## Orden operativo

### R1 — outfit_night_out

Pack A (identidad completa) completado y aprobado — set de prueba de 7 shots visibles + REF0, todos validados manualmente en Higgsfield (no es un número fijo de shots por dump, ver hallazgo "beats como pool" — un dump real puede usar cualquier subconjunto de este pool). Ver `09_session_log_outfit_night_out_validation.md` para el detalle shot por shot y los hallazgos de arquitectura que salieron de esta validación. Faltan Pack B (solo producto, sin avatar) y Pack C (con escenas de referencia).

**Antes de seguir con Pack B/C:** evaluar si conviene primero aplicar el hallazgo de "beats como pool" (`03_photodump_recipe_architecture.md` sección 13bis) al contrato de esta receta, para no validar dos veces sobre una estructura que ya se sabe que es más rígida de lo necesario.

### R2 — outfit_check

**Antes de arrancar (ya aplicado en outfit_reveal_basic, seguir haciéndolo en las siguientes):** aplicar desde el diseño inicial los 5 hallazgos de `09_session_log_outfit_night_out_validation.md` sección 4 (núcleo narrativo dual, REF0 condicional, beats como pool, VDI-003b, y el diseño de consulta a bancos de `08_knowledge_bank_query_design.md`) — no descubrirlos de nuevo por receta.

No revalidar el archivo actual completo. Dividir en:

1. **outfit_reveal_basic — Test A completo (3/3 shots), ver `10_session_log_outfit_reveal_basic_validation.md`.**
2. **outfit_multi_look — 3 de 4 intenciones con set de prueba, ver `11_session_log_outfit_weekly_recap_validation.md` secciones 6-6ter.** Receta base fusionada: iban a ser 4 recetas separadas (`outfit_weekly_recap`, `outfit_rate_check`, `outfit_then_vs_now`, `outfit_choose_for_occasion`), pero 3 de las 4 comparten el mismo motor técnico de fondo fijo (ancla generada una sola vez + outfit nuevo + pose nueva por shot). La 4ta (`choose_for_occasion`) se renombró a **`trip_recap`** tras descubrir que es un recap de viaje con fondo variable por shot (un lugar icónico distinto en cada uno), no un mecanismo de voto — motor distinto al resto, validado por separado con un set de Nueva York. Falta solo `rate_check` sin set de prueba.

`outfit_night_out` ya cubre la salida nocturna narrativa completa; `outfit_multi_look` no es una variante de lugar, es un motor distinto (repetición controlada vs. arco narrativo) — ver nota en `06_repository_audit.md` sección `outfitCheck.ts`.

### R3 — clothing_haul

Conservar manifest y coverage. Revalidar:

- overview;
- selection;
- try-on;
- adjusting;
- styled result;
- details;
- recap.

Probar pack de prendas completas y pack de piezas sueltas.

### R4 — weeklyFavoritesV2

Antes de generar, obtener archivos de `recipes/weeklyFavoritesV2/`.

Decidir si es:

- weekly_outfits de Fashion;
- weekly_favorites transversal.

No validar el `outfitWeek.ts` legacy.

### R5 — unboxing

Rediseñar en cuatro overlays. Primer test recomendado: device_unboxing.

### R6 — productHaul

Obtener fuente. Comparar con clothing_haul. Extraer coverage común.

### R7 — dayInLife

Conservar multi-world. Añadir:

- motivación por bloque;
- continuidad de hábitos;
- estado temporal;
- transición;
- cierre;
- prueba sin avatar.

## Bloqueo estructural actual

La revalidación visual exige:

- archivos completos de recipes que no están disponibles;
- paquetes de referencias por receta;
- ejecución en Magnific/Higgsfield o app;
- resultados para peritaje.

Hasta ese punto, todo el trabajo previo que no depende de outputs visuales ya fue adelantado.
