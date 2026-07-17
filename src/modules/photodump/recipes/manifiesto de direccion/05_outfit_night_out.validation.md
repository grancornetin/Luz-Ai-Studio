# outfit_night_out — Estado de normalización

## Estado (actualizado julio 2026 — ver bitácora completa en `09_session_log_outfit_night_out_validation.md`)

- Validación conceptual: completada.
- Validación visual original: completada con un paquete de referencias.
- Normalización: completada.
- **Test A (identidad completa, sin escenas de referencia): completado.** Los 7 shots visibles + REF0 fueron generados en Higgsfield y aprobados manualmente uno por uno. Ver bitácora de sesión para el detalle de cada shot, cuántas iteraciones tomó y qué falló en el camino.
- Test B (solo producto, sin rostro/cuerpo) y Test C (con escenas cargadas): pendientes.
- Integración: bloqueada hasta completar Test B y C.
- **Nota:** durante Test A surgieron 5 hallazgos de arquitectura que modifican cómo debe leerse este mismo contrato — ver sección 4 de `09_session_log_outfit_night_out_validation.md`. En particular, el núcleo narrativo dual y el rediseño de `compression` como pool de beats (no secuencia fija) implican que este archivo (`05_outfit_night_out.normalized.ts`) va a necesitar una revisión estructural antes de integrarse, no solo pasar Test B/C tal como está.

## Cambios respecto del primer archivo

1. REF0 fue separado de los shots visibles.
2. Se eliminaron prendas específicas del outfit de prueba.
3. `maxShots` se redujo a siete, porque no existe interpolación validada.
4. La distribución devuelve exactamente 3–7 shots.
5. Mirror check en casa y pausa en baño del venue son momentos distintos.
6. Cada shot declara routing de referencias.
7. Se soporta identidad entregada, parcial o generada.
8. Cada shot contiene intención psicológica y motivo de captura.
9. El shot social limita a una acompañante.
10. La escena de preparación no se reutiliza como venue.

## Tests obligatorios pendientes

### Test A — identidad completa

- rostro;
- cuerpo;
- outfit;
- brief;
- sin escenas.

### Test B — solo producto

- outfit;
- sin rostro;
- sin cuerpo;
- sin escenas.

### Test C — escenas cargadas

- rostro;
- cuerpo;
- outfit;
- habitación;
- venue.

## Métricas de aprobación

- fidelidad outfit: ≥ 9/10;
- identidad: ≥ 8/10;
- silueta: ≥ 8/10;
- continuidad de mundo: ≥ 8/10;
- organicidad: ≥ 8/10;
- diversidad: ≥ 8/10;
- motivo de captura creíble: presente en 100%;
- errores anatómicos críticos: 0;
- producto inventado o alterado: 0.

## Decisión

No integrar todavía. Test A quedó completo y aprobado (ver bitácora), pero antes de Test B/C conviene incorporar los hallazgos de arquitectura de la sección 4 de `09_session_log_outfit_night_out_validation.md` — en especial revisar si el arco de 7 shots fijos sigue siendo la forma correcta de estructurar esta receta, o si debería rediseñarse como pool de beats. Integrar el contrato actual tal cual, sin esa revisión, arrastraría la rigidez que ya se demostró innecesaria.
