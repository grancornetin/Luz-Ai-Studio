# Protocolo de revalidación manual de recetas
Version 1.0

## 1. Objetivo

Validar que una receta produce de forma repetible contenido social orgánico, fiel y psicológicamente dirigido.

Una imagen bonita no valida una receta.

## 2. Paquetes de prueba

Cada receta necesita al menos:

### Pack A — referencias completas

Identidad, cuerpo, producto, escena y brief cuando aplique.

### Pack B — referencias mínimas

Solo lo estrictamente requerido.

### Pack C — contraste

Producto, persona o estética claramente diferente al Pack A.

Una receta no alcanza `VISUALLY_VALIDATED` con un solo paquete.

## 3. Fases

### Fase 0 — contrato

Verificar:

- promesa;
- categoría;
- entradas;
- min/max;
- anchor;
- shots;
- compresión;
- límites.

### Fase 1 — análisis de referencias

Crear fingerprints:

- identidad;
- cuerpo;
- producto;
- materiales;
- escena;
- estados;
- contaminación.

### Fase 2 — REF0

Validar:

- identidad;
- cuerpo;
- mundo;
- luz;
- geometría;
- ropa base;
- fuentes permitidas.

REF0 puede aprobar aunque no sea una imagen social publicable, si su rol es técnico.

### Fase 3 — shot individual

Para cada shot registrar:

- prompt;
- refs y orden;
- output;
- intención psicológica;
- motivo de captura;
- errores;
- severidad;
- decisión.

### Fase 4 — arco completo

Evaluar:

- variedad;
- continuidad;
- progresión;
- repetición;
- estado temporal;
- valor social;
- cierre.

### Fase 5 — segundo paquete

Repetir sin copiar correcciones específicas del primer producto.

### Fase 6 — normalización

Eliminar:

- colores de prueba;
- prendas concretas;
- género accidental;
- lugares rígidos;
- props inventados;
- soluciones exclusivas del laboratorio.

## 4. Scorecard por imagen

| Métrica | 0–10 |
|---|---:|
| Fidelidad producto | |
| Fidelidad identidad | |
| Fidelidad corporal | |
| Anatomía | |
| Física/geométrica | |
| Organicidad | |
| Motivo de captura | |
| Deseo emocional | |
| Integración producto | |
| Valor social | |
| Coherencia con receta | |
| Diferenciación del shot anterior | |

## 5. Fallos críticos automáticos

- producto alterado;
- identidad distinta;
- extremidad extra;
- espejo imposible;
- referencia contaminante usada como producto;
- outfit equivocado;
- shot duplicado;
- cantidad incorrecta;
- texto o marca inventada;
- escena contradictoria;
- perspectiva sin fotógrafo posible.

Un fallo crítico impide aprobación, aunque la estética sea alta.

## 6. Etiquetas de error

```text
ID_FACE_DRIFT
ID_BODY_DRIFT
ITEM_COLOR_DRIFT
ITEM_SHAPE_DRIFT
ITEM_COMPONENT_MISSING
ITEM_COMPONENT_INVENTED
SCENE_GEOMETRY_DRIFT
SCENE_DUPLICATION
CAMERA_ORIGIN_IMPOSSIBLE
MIRROR_GEOMETRY_FAIL
ANATOMY_EXTRA_LIMB
ANATOMY_HAND_FAIL
PROP_DUPLICATION
COMMERCIAL_CATALOG
EDITORIAL_OVERPRODUCTION
NO_CAMERA_MOTIVATION
SHOT_REDUNDANCY
EMOTIONAL_MISMATCH
REFERENCE_OVERLOAD
REFERENCE_CONTAMINATION
```

## 7. Umbrales

### VISUALLY_VALIDATED

- producto promedio ≥ 9;
- identidad/cuerpo ≥ 8;
- organicidad ≥ 8;
- motivo de captura ≥ 8;
- arco ≥ 8;
- cero fallos críticos en selección final;
- dos paquetes probados.

### NORMALIZED

- sin detalles de prueba;
- count exacto;
- routing explícito;
- inputs opcionales realmente soportados;
- límites honestos.

### INTEGRATION_READY

- contrato compatible;
- tests unitarios;
- build;
- debug metadata;
- rollback;
- documentación.

## 8. Registro por intento

```yaml
recipe:
test_pack:
shot:
attempt:
model:
references:
prompt_version:
result:
scores:
critical_failures:
observations:
change:
retest_required:
```

## 9. Regla de corrección

Una corrección se acepta solo si:

1. resuelve el error;
2. no daña otro lock;
3. no contiene detalles del caso;
4. puede expresarse como regla o routing;
5. funciona en el siguiente pack.

## 10. Regla de parada

No iterar infinitamente.

Si después de cinco intentos el mismo fallo crítico persiste:

- revisar referencias;
- dividir el shot;
- cambiar primitive;
- cambiar routing;
- eliminar el shot;
- declarar limitación de modelo.

No seguir agregando texto al prompt sin diagnóstico.
