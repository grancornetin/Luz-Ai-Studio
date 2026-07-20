# Bitácora de sesión — Validación manual de outfit_reveal_basic
Julio 2026. Segunda receta validada manualmente, primera de las 5 subrecetas que reemplazan a `outfit_check` (ver `06_repository_audit.md` y R2 de `07_revalidation_queue.md`). Leer `09_session_log_outfit_night_out_validation.md` primero si esta es la primera vez que se retoma el trabajo — ese documento tiene el proceso completo y los 5 hallazgos de arquitectura que ya se aplicaron acá desde el diseño.

## 1. Qué se hizo en esta sesión

Se definió el núcleo narrativo y el pool de shots de `outfit_reveal_basic` desde cero, aplicando los 5 hallazgos de `outfit_night_out` en vez de descubrirlos de nuevo, y se validaron manualmente en Higgsfield los 3 shots del pool. Es la primera receta que se diseña ya con el modelo de "beats como pool" en vez de secuencia fija — no se intentó llenar un arco de 7 shots porque la receta no lo necesita.

## 2. Núcleo narrativo de esta receta

A diferencia de `outfit_night_out` (dos ejes independientes: "la noche fue memorable" + "se veía increíble"), `outfit_reveal_basic` no tiene venue ni evento — es la receta más pura de Fashion Mother: "solo mostrar el resultado" (ver `04_fashion_mother.md` sección 15). Sus dos ejes:

- **Eje A — "el look funciona"**: validación del outfit en sí mismo.
- **Eje B — "así me veo / me siento hoy"**: identidad y estado de ánimo del momento de la foto, sin requerir compañía ni lugar.

A diferencia de night_out, estos dos ejes conviven en el mismo shot casi siempre — no hay venue que los separe. Por eso lo que varía entre shots no es el momento narrativo, sino **ángulo de cámara, distancia y modo de consciencia**.

## 3. Pool de shots — diseño y resultado

No hubo REF0 técnico separado (aplicando el hallazgo de "REF0 condicional" desde el diseño): el Shot 1 cumple la doble función de anclar identidad/cuerpo/cuarto y ser el primer shot publicable.

1. **Mirror Check Full Body** — `full_body_mirror_check` (Fashion Mother) + HPI `STANDING_ASYMMETRIC_FASHION_POSE`. Mirror selfie de cuerpo completo, celular visible, outfit completo. **Aprobado en 1 iteración.** Observación del usuario: el encuadre del espejo muestra muy poco del cuarto (recorta casi todos los muebles) — esta imagen NO sirve como ancla de continuidad si algún shot futuro necesitara reconocer el cuarto completo. No fue un problema acá porque los shots 2 y 3 son POV/close-up y no dependen del fondo.

2. **Self-POV Outfit** — perspectiva en primera persona genuina, cámara = los propios ojos mirando hacia abajo al cuerpo, sin celular ni brazo ni rostro visibles. HPI no tiene una familia para esto (está construido sobre fotos de persona-visible sosteniendo cámara, no POV puro de ojos) — se escribió describiendo la escena completa sin apoyo de banco. **Aprobado en 3 iteraciones**, con un hallazgo importante en el camino — ver sección 4.

3. **Close Selfie Detail** — selfie genuina de cerca (rostro/torso), mano propia en el pelo, celular visible. HPI `UPPER_BODY_SELFIE_POSE`. Reemplazó al primitive `styling_adjustment` original del diseño inicial (ver sección 5, por qué se descartó). **Aprobado en 1 iteración.**

Se decidió **no agregar un 4º shot** ("Material Detail", textura de tela) porque no aportaba un ángulo o distancia nuevos — aplicando el hallazgo de beats-como-pool: la lista original de candidatos no es una cuota a cumplir, solo un menú de opciones.

**Estado formal:** Test A completo (identidad + outfit, sin escenas de referencia) para las 3 tomas del pool. Test B (sin avatar) y Test C (con escenas cargadas) no se han hecho.

## 4. Hallazgo nuevo — posición de la cita de Element dentro del prompt

Ver el detalle completo en `09_session_log_outfit_night_out_validation.md` sección 4bis (se documentó ahí porque es un hallazgo de mecánica de Higgsfield, transversal a todas las recetas, no específico de esta).

Resumen: citar una referencia (`@PIA-BODY`) a mitad de párrafo, aunque sea con instrucciones explícitas de "solo toma esto, no aquello", hizo que Higgsfield copiara la pose de la imagen de referencia en vez de solo las proporciones — rompiendo por completo la postura pedida en el texto (de "parada mirando hacia abajo" pasó a "reclinada con piernas dobladas"). Citar la misma referencia como primera palabra absoluta del prompt, antes de cualquier descripción, resolvió el problema sin cambiar una sola palabra del resto del prompt.

**Regla ya aplicada a los prompts de aquí en adelante:** todas las citas de Elements van en bloque, al inicio absoluto del prompt.

## 5. Por qué se descartó `styling_adjustment` del pool original

El diseño inicial proponía un shot de "ajuste de prenda" (manos acomodando el outfit) con foto de tercera persona, siguiendo la primitive `styling_adjustment` de Fashion Mother. El usuario lo descartó antes de generar nada: ese tipo de shot casi siempre se ve extraño porque implica que alguien más sostiene la cámara mientras el personaje se arregla, y el prompt no puede resolver de forma inequívoca quién es esa persona ni por qué está ahí — la misma clase de ambigüedad que ya había fallado en `outfit_night_out` (ver lección de "pensar la escena completa, no dejar que el modelo resuelva solo"). Se reemplazó por una segunda variante de selfie genuina (`self_pov_outfit`) en vez de forzar una foto de tercera persona sin justificación narrativa.

## 6. Qué falta

- Test B y C de `outfit_reveal_basic`.
- Seguir con la siguiente subreceta de R2: `outfit_day_out`, `outfit_workday`, `outfit_event`, o `outfit_travel` (sin orden obligatorio — ver `06_repository_audit.md`).
- Documentar en HPI (o donde corresponda) que no existe una familia para "POV puro de ojos sin cámara visible" — si esta perspectiva se vuelve a necesitar en otra receta, ya hay un prompt de referencia que funcionó (este documento, shot 2) en vez de tener que redescubrirlo.
