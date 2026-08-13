/**
 * modules/photodump/director/hardRules.ts
 *
 * Punto D del diagrama del usuario: reglas duras, no negociables, compartidas
 * por TODAS las recetas — no son parte del banco ni de ninguna receta en
 * particular. Se le pasan al director como contexto fijo en cada llamada de
 * razonamiento. Portado desde scripts/photodump-director/hardRules.js.
 *
 * Corre server-side (importado por api/photodump/director.ts).
 */

export const HARD_RULES_TEXT = `
REGLAS NO NEGOCIABLES (aplican siempre, a cualquier receta):

1. IDENTIDAD: la protagonista de cada shot debe ser la misma persona que las
   referencias de identidad/cuerpo que subió el usuario. Nunca se reemplaza,
   nunca se combina con otra persona.

2. FIDELIDAD DE PRODUCTO: cualquier outfit, prenda o accesorio que el usuario
   subió como referencia debe verse igual en el resultado — mismo diseño,
   color, textura. No se puede "inspirar" en el outfit de un candidato del
   banco si el usuario ya subió su propio outfit real: el outfit real del
   usuario SIEMPRE reemplaza al outfit del candidato del banco.

3. QUÉ ES REUTILIZABLE DE UN CANDIDATO DEL BANCO: cuando un candidato del
   banco es útil pero no calza entero con lo que pide el brief, hay que
   identificar EXACTAMENTE qué partes sirven (pose, gesto, expresión, forma
   de componer los objetos en el encuadre, tipo de plano/ángulo de cámara) y
   cuáles no (el escenario específico, la comida específica, el outfit
   específico, si esos ya están definidos por las referencias reales del
   usuario o por el brief). Nunca copiar un candidato entero solo porque
   tiene buen puntaje — extraer las piezas útiles y descartar el resto.

4. CONTINUIDAD: si varios shots del set comparten el mismo lugar/mundo (ej.
   el mismo venue de la noche), ese lugar debe describirse de forma
   consistente entre todos esos shots — mismo estilo, misma decoración,
   mismos elementos visibles — no puede cambiar de estética entre un shot y
   el siguiente sin que el brief lo pida explícitamente. Esto incluye el
   MOBILIARIO específico (mesa, sillas, barra): si un shot ya describió una
   mesa/silla concreta (tipo, material, color), cualquier shot siguiente que
   comparta esa misma continuidad de venue debe reusar EXACTAMENTE ese mismo
   mueble, no describir uno nuevo — nunca resolver esto con la instrucción
   contraria de "no menciones/no describas la mesa" (eso abre la puerta a
   otro error: un shot sin ningún mueble descrito, cuando el encuadre
   claramente necesita uno). La regla es "reusá lo ya establecido", no
   "evitá mencionarlo".

5. NO INVENTAR PERSONAS: si un shot necesita un acompañante y el usuario no
   subió ninguna foto de esa persona, ese shot no puede mostrar un rostro de
   acompañante inventado — hay que resolverlo mostrando solo a la
   protagonista, o con la otra persona fuera de cuadro/incidental (mano,
   brazo), nunca con un rostro nuevo inventado libremente.

6. COHERENCIA CAUSAL DE PROPS Y SUPERFICIES HEREDADAS DE UN CANDIDATO: cuando
   un candidato del banco usa un elemento físico específico (espejo, vidrio,
   ventana, mueble, decoración) que no es parte del brief real, la pregunta
   NUNCA es "¿este tipo de elemento está prohibido?" — es "¿dónde y cómo
   existiría este elemento, de forma creíble, en el venue real de este
   brief?". Ejemplo con espejos (el mismo razonamiento aplica a cualquier
   prop heredado, no es una regla exclusiva de espejos): un candidato de
   mirror selfie de interior doméstico no se descarta ni se copia literal —
   se razona en qué forma un espejo (o su equivalente) tendría sentido en
   ESTE venue puntual: puede ser el espejo real de un baño del lugar (y
   entonces deben aparecer elementos de baño reales — loza, iluminación
   cerrada — no el resto del venue de fondo), puede ser un espejo decorativo
   real de un rincón del venue (y entonces el fondo reflejado debe mostrar el
   venue mismo, no un interior doméstico inventado), o puede ser el reflejo
   de un vidrio/ventana/baranda que el venue ya tiene. Si ninguna de esas
   variantes es creíble para el venue descrito, se descarta el elemento
   entero y se resuelve la misma pose con una superficie reflectante real
   del lugar o sin ninguna — nunca insertando un mueble/objeto flotante que
   no tiene ningún lugar lógico donde existir.

7. FIDELIDAD DE PROPORCIÓN CORPORAL: la silueta y proporción física real de
   la protagonista (cintura, cadera, busto, contextura general) tal como se
   ve en la imagen de referencia de cuerpo del usuario debe preservarse en
   cada shot — nunca promediarla hacia un cuerpo genérico. Un cuerpo curvilíneo
   marcado no puede volverse recto/atlético, un cuerpo con más volumen no
   puede volverse delgado, un cuerpo delgado no puede ganar curvas que no
   tiene. Esta regla tiene la misma prioridad que la fidelidad de identidad
   (regla 1) — no es un detalle estético secundario.
`.trim();
