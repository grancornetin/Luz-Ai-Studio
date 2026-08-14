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
   MOBILIARIO Y CUALQUIER ELEMENTO ARQUITECTÓNICO específico (mesa, sillas,
   barra, baranda, columna, escalera, puerta): si un shot ya describió un
   elemento concreto (tipo, material, color), cualquier shot siguiente que
   comparta esa misma continuidad de venue debe reusar EXACTAMENTE ese mismo
   elemento, no describir uno nuevo — nunca resolver esto con la instrucción
   contraria de "no menciones/no describas la mesa" (eso abre la puerta a
   otro error: un shot sin ningún mueble descrito, cuando el encuadre
   claramente necesita uno). La regla es "reusá lo ya establecido", no
   "evitá mencionarlo".
   Caso inverso (bug real confirmado): el candidato del banco elegido para UN
   shot puntual puede tener un elemento propio (ej. una baranda/reja
   metálica) que NINGÚN shot anterior de ese mismo venue estableció — copiar
   ese elemento literal introduce algo que "aparece de la nada" en medio de
   un set por lo demás consistente (mesas y sillas ya establecidas en varios
   shots, y de repente una baranda nueva en uno solo, sin que ningún otro
   shot la muestre antes o después). Si el elemento del candidato no fue
   parte de la continuidad ya establecida por shots anteriores del mismo
   venue, tenés 2 opciones válidas — nunca copiarlo sin más: (a) descartalo
   y resolvé la misma pose/gesto contra el mobiliario/fondo ya establecido,
   o (b) si el elemento es genuinamente necesario para la pose (ej. la pose
   depende físicamente de apoyarse en algo), incorporalo como parte NUEVA y
   permanente de ese venue — y entonces cualquier shot posterior que
   comparta esa continuidad también debería poder reusarlo, no que aparezca
   en un único shot aislado del set.
   Tercer caso (bug real confirmado, distinto de los 2 anteriores): el
   mueble SÍ es consistente entre shots (ej. "reuse the same table and
   chairs"), pero su UBICACIÓN respecto a otros elementos ya establecidos
   del venue (la baranda, otras mesas ocupadas, un pasillo) nunca queda
   anclada — solo se nombra el mueble, nunca dónde queda parado dentro del
   layout ya visible en shots anteriores. Resultado real: una silla junto a
   la baranda, sin mesa propia visible ni ningún otro mueble alrededor,
   mientras el fondo muestra una fila entera de mesas ocupadas con sillas
   idénticas — se lee como si alguien hubiera arrastrado una silla suelta
   solo para la foto, aunque la silla en sí sea "la misma" de shots
   anteriores. Y por separado: cuando el prompt dice que la protagonista
   apoya el brazo/mano en un mueble (mesa, barra), ese mueble tiene que
   estar descrito como visible y cercano en ESE shot — si el encuadre real
   termina mostrando su brazo apoyado contra la baranda de fondo en vez de
   contra ninguna mesa en primer plano, es la misma falta de anclaje
   espacial. Regla: cuando un shot reusa mobiliario de continuidad, ubicalo
   explícitamente respecto al elemento fijo más cercano ya establecido del
   venue (ej. "the same table, positioned right against the railing, part
   of the same row of tables visible in the background") — no alcanza con
   nombrar el mueble suelto.

5. NO INVENTAR PERSONAS: si un shot necesita un acompañante y el usuario no
   subió ninguna foto de esa persona, ese shot no puede mostrar un rostro de
   acompañante inventado — hay que resolverlo mostrando solo a la
   protagonista, o con la otra persona fuera de cuadro/incidental (mano,
   brazo), nunca con un rostro nuevo inventado libremente.

   INTERIOR DE AUTO — CASO ESPECÍFICO (bug real confirmado: un shot de auto
   redactado como "sentada como pasajera" sin ningún ancla visual quedó
   ambiguo, se leyó como si estuviera en el asiento del conductor sin
   volante). Nunca alcanza con decir "es una pasajera" en abstracto — el
   prompt debe anclar un elemento visual concreto que lo confirme: el
   volante/tablero del lado del conductor visible al otro lado del cuadro,
   o la puerta/ventana del lado del copiloto/pasajero trasero como
   referencia espacial clara. Sin ese ancla, la imagen resultante no tiene
   forma de comunicar de qué lado del auto está sentada.

6. RIESGO GEOMÉTRICO DE LA POSE ELEGIDA: antes de heredar la pose de un
   candidato del banco, evaluar si implica un ángulo extremo, un escorzo
   marcado de una extremidad, o una posición espacial ambigua (ej. una
   pierna extendida en diagonal vista desde arriba, un brazo cruzado detrás
   del cuerpo fuera de vista) — ese tipo de geometría es exactamente donde
   los generadores de imagen fallan con más frecuencia (proporciones rotas,
   articulaciones imposibles). Si existe una variante más simple del mismo
   momento narrativo en el banco (misma pose en términos generales, menor
   complejidad geométrica), preferirla — la pose compleja solo se justifica
   cuando es genuinamente necesaria para lo que ese shot puntual necesita
   contar, no por default.

7. COHERENCIA CAUSAL DE PROPS Y SUPERFICIES HEREDADAS DE UN CANDIDATO: cuando
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

8. FIDELIDAD DE PROPORCIÓN CORPORAL: la silueta y proporción física real de
   la protagonista (cintura, cadera, busto, contextura general) tal como se
   ve en la imagen de referencia de cuerpo del usuario debe preservarse en
   cada shot — nunca promediarla hacia un cuerpo genérico. Un cuerpo curvilíneo
   marcado no puede volverse recto/atlético, un cuerpo con más volumen no
   puede volverse delgado, un cuerpo delgado no puede ganar curvas que no
   tiene. Esta regla tiene la misma prioridad que la fidelidad de identidad
   (regla 1) — no es un detalle estético secundario.
`.trim();
