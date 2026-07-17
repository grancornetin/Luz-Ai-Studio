# Cola autónoma de revalidación

## Estado general

| Orden | Unidad | Estado |
|---:|---|---|
| 1 | Visual Intelligence Database | COMPLETADO V1 |
| 2 | Psychology v2 | COMPLETADO |
| 3 | Recipe Architecture | COMPLETADO V1 |
| 4 | Fashion Mother | COMPLETADO V1 |
| 5 | outfit_night_out normalizada | TEST A COMPLETO / PENDIENTE TEST B Y C — ver `09_session_log_outfit_night_out_validation.md` |
| 6 | Auditoría repositorio | COMPLETADA CON ALCANCE DISPONIBLE |
| 7 | Revalidación receta por receta | PREPARADA / BLOQUEO VISUAL |
| 8 | Integración Claude Code | NO INICIAR |

## Orden operativo

### R1 — outfit_night_out

Pack A (identidad completa) completado y aprobado — 7 shots visibles + REF0, todos validados manualmente en Higgsfield. Ver `09_session_log_outfit_night_out_validation.md` para el detalle shot por shot y los hallazgos de arquitectura que salieron de esta validación. Faltan Pack B (solo producto, sin avatar) y Pack C (con escenas de referencia).

**Antes de seguir con Pack B/C:** evaluar si conviene primero aplicar el hallazgo de "beats como pool" (`03_photodump_recipe_architecture.md` sección 13bis) al contrato de esta receta, para no validar dos veces sobre una estructura que ya se sabe que es más rígida de lo necesario.

### R2 — outfit_check

**Antes de arrancar:** aplicar desde el diseño inicial los 5 hallazgos de `09_session_log_outfit_night_out_validation.md` sección 4 (núcleo narrativo dual, REF0 condicional, beats como pool, VDI-003b, y el diseño de consulta a bancos de `08_knowledge_bank_query_design.md`) — no descubrirlos de nuevo por receta.

No revalidar el archivo actual completo. Primero dividir:

1. outfit_reveal_basic;
2. outfit_day_out;
3. outfit_workday;
4. outfit_event;
5. outfit_travel.

`outfit_night_out` ya cubre noche.

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
