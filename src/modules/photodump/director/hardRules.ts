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
   el siguiente sin que el brief lo pida explícitamente.

5. NO INVENTAR PERSONAS: si un shot necesita un acompañante y el usuario no
   subió ninguna foto de esa persona, ese shot no puede mostrar un rostro de
   acompañante inventado — hay que resolverlo mostrando solo a la
   protagonista, o con la otra persona fuera de cuadro/incidental (mano,
   brazo), nunca con un rostro nuevo inventado libremente.
`.trim();
