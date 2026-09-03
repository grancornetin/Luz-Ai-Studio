/**
 * modules/photodump/director/hardRules.ts
 *
 * Punto D del diagrama del usuario: reglas duras, no negociables, compartidas
 * por TODAS las recetas — no son parte del banco ni de ninguna receta en
 * particular. Se le pasan al director como contexto fijo en cada llamada de
 * razonamiento. Portado desde scripts/photodump-director/hardRules.js.
 *
 * Generalizado de vocabulario (sep 2026, director genérico — ver
 * director/generic/): las menciones a "venue" se cambiaron a "lugar" —
 * el contenido de las reglas ya era agnóstico de receta, solo el ejemplo
 * usaba lenguaje de outfit_night_out. Sin cambio de significado.
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

4. CONTINUIDAD: si varios shots del set comparten el mismo lugar/mundo, ese
   lugar debe describirse de forma consistente entre todos esos shots —
   mismo estilo, misma decoración, mismos elementos visibles — no puede
   cambiar de estética entre un shot y el siguiente sin que el brief lo
   pida explícitamente. Esto incluye el MOBILIARIO Y CUALQUIER ELEMENTO
   ARQUITECTÓNICO específico (mesa, sillas, barra, baranda, columna,
   escalera, puerta): si un shot ya describió un elemento concreto (tipo,
   material, color), cualquier shot siguiente que comparta esa misma
   continuidad de lugar debe reusar EXACTAMENTE ese mismo elemento, no
   describir uno nuevo — nunca resolver esto con la instrucción contraria
   de "no menciones/no describas la mesa" (eso abre la puerta a otro
   error: un shot sin ningún mueble descrito, cuando el encuadre
   claramente necesita uno). La regla es "reusá lo ya establecido", no
   "evitá mencionarlo".
   Caso inverso (bug real confirmado): el candidato del banco elegido para UN
   shot puntual puede tener un elemento propio (ej. una baranda/reja
   metálica) que NINGÚN shot anterior de ese mismo lugar estableció — copiar
   ese elemento literal introduce algo que "aparece de la nada" en medio de
   un set por lo demás consistente (mesas y sillas ya establecidas en varios
   shots, y de repente una baranda nueva en uno solo, sin que ningún otro
   shot la muestre antes o después). Si el elemento del candidato no fue
   parte de la continuidad ya establecida por shots anteriores del mismo
   lugar, tenés 2 opciones válidas — nunca copiarlo sin más: (a) descartalo
   y resolvé la misma pose/gesto contra el mobiliario/fondo ya establecido,
   o (b) si el elemento es genuinamente necesario para la pose (ej. la pose
   depende físicamente de apoyarse en algo), incorporalo como parte NUEVA y
   permanente de ese lugar — y entonces cualquier shot posterior que
   comparta esa continuidad también debería poder reusarlo, no que aparezca
   en un único shot aislado del set.
   Tercer caso (bug real confirmado, distinto de los 2 anteriores): el
   mueble SÍ es consistente entre shots (ej. "reuse the same table and
   chairs"), pero su UBICACIÓN respecto a otros elementos ya establecidos
   del lugar (la baranda, otras mesas ocupadas, un pasillo) nunca queda
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
   lugar (ej. "the same table, positioned right against the railing, part
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

   CASO ESPECÍFICO — ÁNGULO DE CÁMARA EN PICADO SOBRE EL ROSTRO (bug real
   confirmado: un shot de flat lay de comida con la protagonista sentada a
   la mesa, tomado desde un ángulo picado (cámara por encima, apuntando
   hacia abajo sobre la mesa), incluyó su rostro en el encuadre y quedó con
   una distorsión facial notoria — el escorzo que ese ángulo genera sobre
   la cara es la misma familia de riesgo geométrico que una extremidad en
   escorzo). Si un shot combina flat lay/detalle de mesa CON el rostro de
   la protagonista en cuadro, el ángulo de cámara no puede ser un picado
   pronunciado sobre su cara — dos soluciones válidas: (a) un ángulo más
   frontal/a la altura de los ojos que igual capture la mesa en primer
   plano y el rostro sin distorsión, o (b) si el picado es necesario para
   mostrar bien el detalle de la comida, dejar a la protagonista fuera de
   cuadro en ese shot (detail shot sin protagonista) en vez de forzar su
   rostro dentro de un ángulo que lo va a distorsionar.
   Referencia real de la opción (a) bien resuelta (bug real confirmado,
   prueba 17 ago 2026, banco tiene decenas de ejemplos de este patrón):
   cámara a la altura de los ojos (no picada), la protagonista con una
   interacción real — sonriendo a cámara, con la mano en el mentón, o
   mirando el trago/comida con actitud — nunca sentada mirando pasivamente
   hacia abajo con el plato solo porque la cámara está arriba. La comida
   entra en primer plano de forma natural aunque la cámara no esté picada
   desde arriba — el picado no es necesario para que el detalle de comida
   se vea bien.

   CASO ESPECÍFICO — CONTRAPICADO PRONUNCIADO EN PLANO DE CUERPO ENTERO CON
   ROSTRO VISIBLE (bug real confirmado 2 veces, pruebas 18 y 21 ago 2026,
   ambas en el shot de apertura del set): un "full body shot" redactado con
   cámara por debajo de la altura de la cintura mirando hacia arriba
   ("camera positioned slightly below waist height, looking up slightly,
   low-angle shot") dejó el rostro de la protagonista chico dentro del
   encuadre Y en un ángulo marcado — en ambos casos el resultado generado
   no se pareció a la persona real de la referencia (rasgos faciales
   distintos: forma de rostro, ojos, nariz), aunque el prompt no describía
   ningún rasgo físico propio, solo pose/cámara — es la misma familia de
   riesgo geométrico que el picado sobre comida (regla 6 arriba), pero en
   la dirección opuesta: cuanto más lejos y en ángulo extremo queda el
   rostro respecto a la cámara, más margen tiene el generador para
   "improvisar" en vez de preservar la identidad real. Contraste real que
   confirma que el ángulo bajo en sí no es el problema (prueba 7 ago 2026):
   un mirror selfie con ángulo bajo pero rostro grande y relativamente
   frontal en el encuadre preservó bien la identidad — el riesgo real es la
   combinación cuerpo-entero + rostro lejano + ángulo marcado, no el
   contrapicado aislado.
   Si un shot pide plano de cuerpo completo CON el rostro identificable en
   cuadro, el ángulo de cámara no puede ser un contrapicado pronunciado
   (cámara muy por debajo de la cintura mirando marcadamente hacia arriba)
   — usar cámara a la altura del pecho/ojos o un contrapicado apenas
   perceptible (leve elevación de la pierna, sin que la cámara quede muy
   por debajo del cuerpo) es suficiente para transmitir el mismo efecto
   favorecedor sin sacrificar la fidelidad del rostro. Si el shot
   específicamente necesita un contrapicado marcado (ej. para un efecto
   dramático puntual), preferir que el rostro no sea el punto focal del
   encuadre en ese shot puntual (ángulo/mirada que lo aleje de cámara, o
   cuadro cortado antes de la cabeza) en vez de combinarlo con un plano de
   cuerpo entero donde el rostro completo debe leerse con fidelidad.

7. COHERENCIA CAUSAL DE PROPS Y SUPERFICIES HEREDADAS DE UN CANDIDATO: cuando
   un candidato del banco usa un elemento físico específico (espejo, vidrio,
   ventana, mueble, decoración) que no es parte del brief real, la pregunta
   NUNCA es "¿este tipo de elemento está prohibido?" — es "¿dónde y cómo
   existiría este elemento, de forma creíble, en el lugar real de este
   brief?". Ejemplo con espejos (el mismo razonamiento aplica a cualquier
   prop heredado, no es una regla exclusiva de espejos): un candidato de
   mirror selfie de interior doméstico no se descarta ni se copia literal —
   se razona en qué forma un espejo (o su equivalente) tendría sentido en
   ESTE lugar puntual: puede ser el espejo real de un baño del lugar (y
   entonces deben aparecer elementos de baño reales — loza, iluminación
   cerrada — no el resto del lugar de fondo), puede ser un espejo decorativo
   real de un rincón del lugar (y entonces el fondo reflejado debe mostrar el
   lugar mismo, no un interior doméstico inventado), o puede ser el reflejo
   de un vidrio/ventana/baranda que el lugar ya tiene. Si ninguna de esas
   variantes es creíble para el lugar descrito, se descarta el elemento
   entero y se resuelve la misma pose con una superficie reflectante real
   del lugar o sin ninguna — nunca insertando un mueble/objeto flotante que
   no tiene ningún lugar lógico donde existir.

   CASO ESPECÍFICO — EL FONDO ENTERO DEL CANDIDATO, NO SOLO UN PROP SUELTO
   (bug real confirmado, prueba 15 ago 2026: un shot que debía ocurrir en
   el mismo rooftop del resto del set terminó descrito como "the interior
   of a formal, high-end hotel corridor or hall, featuring a dark wooden
   door... a metallic silver handrail... polished marble floor" — un
   escenario entero distinto, no un solo objeto suelto, se coló del
   candidato del banco sin adaptar). Esta regla no aplica solo a props
   individuales (espejo, mueble): si el candidato elegido es de un
   shot_type/escena que ocurre en un lugar estructuralmente distinto al
   lugar real (ej. un pasillo/hall interior cuando el lugar real es un
   rooftop exterior), NO alcanza con la instrucción "mismo lugar, no
   inventes otro lugar" — hay que reescribir explícitamente el fondo
   completo en términos del lugar real (qué se ve, qué materiales, qué
   mobiliario), nunca dejar que el fondo original del candidato quede
   implícito o se filtre por default. Si no es posible adaptar creíblemente
   ese fondo al lugar real, se descarta el candidato entero y se elige otro
   con un shot_type/escena más cercana al lugar real del brief.

8. FIDELIDAD DE PROPORCIÓN CORPORAL: la silueta y proporción física real de
   la protagonista (cintura, cadera, busto, contextura general) tal como se
   ve en la imagen de referencia de cuerpo del usuario debe preservarse en
   cada shot — nunca promediarla hacia un cuerpo genérico. Un cuerpo curvilíneo
   marcado no puede volverse recto/atlético, un cuerpo con más volumen no
   puede volverse delgado, un cuerpo delgado no puede ganar curvas que no
   tiene. Esta regla tiene la misma prioridad que la fidelidad de identidad
   (regla 1) — no es un detalle estético secundario.

9. PROHIBIDA LA "POSE MUGSHOT" — SIMÉTRICA, FRONTAL, SIN VIDA (bug real
   recurrente, confirmado en al menos 4 sesiones distintas — pruebas 13,
   14, 15 y 16, ago 2026 — con una redacción casi idéntica cada vez, señal
   de que es la salida "por default" del redactor cuando no tiene una pose
   fuerte del candidato para heredar): una pose donde el cuerpo queda de
   pie, torso frontal o casi frontal a cámara, peso repartido parejo en
   ambas piernas (nunca se menciona que el peso esté cargado en una pierna),
   ambos brazos simétricos sosteniendo apenas el borde de la ropa a la
   altura de la cintura/cadera, mirada neutra directo a cámara, sin ningún
   objeto ni elemento del entorno con el que interactúe. Esta pose se lee
   como una foto de documento, no como una foto real que alguien subiría a
   redes — nadie se para así para una foto real, siempre hay al menos un
   quiebre de postura, un ángulo favorecedor, o una interacción real.
   Texto real que produjo este bug las 4 veces (patrón a evitar, no copiar
   ni parafrasear): "torso slightly turned to the left, head looking
   frontally at the camera... both arms are flexed with hands at waist
   height, lightly holding the edge of her skirt" — la combinación de
   "manos solo sosteniendo el borde de la ropa" + "sin mención de peso
   cargado en una pierna" + "mirada neutra directo a cámara" es la firma
   exacta de esta pose muerta, evitala explícitamente. Ojo: esto puede
   pasar incluso cuando el candidato REAL del banco elegido tiene una pose
   viva (piernas cruzadas, codos marcados, actitud) — si el texto de
   análisis de ese candidato resumió la pose en términos neutros/genéricos,
   heredar ese texto literal produce esta pose plana aunque la foto
   original no lo fuera. El objetivo es el texto final, no descartar
   candidatos: si vas a describir una pose de pie, escribila con al menos
   uno de los elementos de vida de abajo, más allá de lo que diga el
   resumen del candidato.
   Toda pose de pie, en cualquier shot (no solo el primero del set), tiene
   que tener al menos UNO de estos elementos reales:
   (a) peso claramente cargado en una pierna, con la otra relajada/apoyada
       apenas (quiebre de cadera real, no cuerpo simétrico),
   (b) una interacción real con el entorno (apoyada en algo, sosteniendo
       un trago/accesorio con intención, tocándose el pelo, con una mano
       en la cadera con el codo marcado hacia atrás — no solo tocando la
       propia ropa),
   (c) la mirada o el torso dirigidos hacia algo del entorno (la vista, un
       punto fuera de cámara) en vez de neutro y directo a cámara.
   El primer shot del set (el que suele establecer el outfit completo) es
   el más propenso a caer en este patrón porque prioriza mostrar el outfit
   entero legible — pero mostrar el outfit completo y tener una pose viva
   NO son mutuamente excluyentes: un quiebre de cadera o un brazo en la
   cintura con el codo hacia atrás siguen dejando el outfit igual de
   legible.
`.trim();
