// ─────────────────────────────────────────────────────────────────
// PLANNER V3 — Playbooks por rubro
//
// QUÉ ES ESTO: el conocimiento de "agencia" por categoría de negocio.
// Gemini lee el playbook del rubro de la marca antes de armar el plan.
//
// CÓMO SE MANTIENE: estos son textos, no código. Nico puede editarlos
// directamente cuando aprenda algo nuevo de sus usuarios (qué formato
// funcionó, qué error se repite). Editar texto aquí mejora TODOS los
// planes futuros de ese rubro sin tocar ninguna otra parte del código.
//
// CÓMO SE ELIGE: pickPlaybook() busca palabras clave en la categoría
// de la marca (mainCategory + shortDescription). Si nada calza, usa
// el playbook genérico, que siempre funciona.
// ─────────────────────────────────────────────────────────────────

export interface Playbook {
  id: string;
  /** Palabras que activan este playbook (en minúsculas, sin tildes). Se buscan como texto contenido. */
  keywords: string[];
  /** Palabras cortas o ambiguas ("aro", "oro"): solo cuentan si aparecen como palabra completa
   *  (con plural simple: aro/aros). Evita que "aro" calce dentro de "aromaterapia". */
  exactKeywords?: string[];
  /** Cuánto pesa cada palabra que calza (por defecto 1). El rubro especializado usa 2
   *  para ganarle al rubro amplio cuando ambos calzan (ej: joyería vs moda). */
  weight?: number;
  content: string;
}

const MODA: Playbook = {
  id: 'moda',
  // Las palabras de joyería (joya, arete, collar, bisutería...) las captura el playbook JOYERIA.
  keywords: ['ropa', 'moda', 'accesorio', 'cartera', 'bolso', 'zapato', 'vestido', 'boutique', 'outfit', 'lenceria', 'traje'],
  content: `
PLAYBOOK: MODA Y ACCESORIOS

Lo que más vende en este rubro:
- El "puesto vs. colgado": la misma prenda en percha convierte 3-5 veces
  menos que puesta en una persona. Priorizar try-on siempre que se pueda.
- Antes/después de outfit y "cómo combinarlo de 3 formas" son los
  formatos con más guardados — y los guardados predicen ventas.
- El detalle macro (textura, costura, broche) responde la duda #1 de la
  compradora online: "¿será de buena calidad?".
- Los Reels de transición (outfit casual → outfit armado) tienen el
  mejor alcance orgánico del rubro.

Errores típicos que el plan debe evitar:
- Publicar solo fotos de catálogo plano toda la semana (aburre y no
  genera confianza).
- No decir el precio: en moda, ocultar el precio mata la conversión en
  LATAM. El caption debe invitar a preguntar o decir el precio directo,
  según la política de la marca.
- Ignorar las tallas: mencionar el rango de tallas disponible reduce
  las preguntas repetidas y las ventas caídas.

Ganchos que funcionan (adaptar a la voz de la marca):
- "El accesorio que salva cualquier outfit básico"
- "POV: encontraste [prenda] que no tiene todo el mundo"
- "3 formas de usar [prenda] esta semana"

Ritmo semanal sugerido: 40% mostrar producto puesto, 20% educar
(cómo combinar), 20% confianza (detalle de calidad, clienta real),
20% conversión directa (disponible ya, últimas unidades).
`,
};

const JOYERIA: Playbook = {
  id: 'joyeria',
  keywords: ['joya', 'joyeria', 'arete', 'collar', 'anillo', 'pulsera', 'bisuteria', 'plata', '925', 'acero', 'resina', 'argolla', 'dije', 'cadena', 'brazalete', 'pendiente', 'topo', 'orfebreria', 'piercing', 'charm'],
  exactKeywords: ['aro', 'oro', 'perla', 'gema', 'tobillera', 'broche', 'choker'],
  weight: 2,
  content: `
PLAYBOOK: JOYERÍA Y ACCESORIOS (marca que parte de cero)

Fuente: estudio de mercado de octubre 2026 (CIERRE_MVP/investigacion). Cada
punto indica su nivel de evidencia: OBSERVADO (visto en una fuente),
INFERIDO (deducción razonada) o HIPÓTESIS (a validar con sus datos reales).
Casi todas las cifras vienen de blogs de marcas o de EE.UU.: son dirección,
no prueba. NUNCA presentes una cifra de este texto como hecho en un caption.

Lo que de verdad ayuda a vender joyería online:
- Resolver la duda de TAMAÑO REAL: es la barrera más citada (OBSERVADO,
  encuesta de 2015: 1 de cada 4 duda por comprar el tamaño equivocado).
  Foto con una moneda o una regla al lado y la medida en milímetros; largo
  del collar; tabla de tallas en anillos.
- Mostrar el DETALLE de la terminación (cierre, borde, color real, textura):
  responde "¿será de buena calidad?" sin prometer nada.
- Contenido que AYUDA A DECIDIR (guías de regalo por presupuesto, "antes de
  comprar aros online revisa 3 cosas", cuidados): los carruseles rinden más
  cuando resuelven una decisión (OBSERVADO, auditoría de joyería de un vendedor).
- Reels para ser descubierta, carruseles para convencer (OBSERVADO, datos 2025:
  en cuentas bajo 1.000 seguidores la mediana de alcance fue 134 en Reels,
  56 en carruseles y 23 en fotos fijas; no es solo joyería). OJO: los videos
  están apagados en esta versión; el plan usa fotos, carruseles y stories, y
  deja los Reels para cuando el video esté disponible.
- Primeras ventas en el círculo cercano: las marcas chicas observadas
  vendieron primero a conocidas y por ferias, antes de la audiencia en frío
  (OBSERVADO en prensa). WhatsApp Estados y mensajes directos son parte del plan.
- Un solo canal de cierre claro (WhatsApp o enlace en la bio) y el precio a la
  vista o fácil de pedir (OBSERVADO: una marca mayorista chica muestra precios
  como destacada).
- Material como identidad: "plata 950 + piedras chilenas", "acero + perlas de
  río". Una marca que dice QUÉ material y de DÓNDE se diferencia de "joyas lindas".
  Solo se dice el material que la dueña confirmó.

Las dudas de compra que cada contenido debe ir respondiendo (una por post):
1. ¿De qué tamaño es realmente? (medida, moneda, largo)
2. ¿De qué material es y cuánto dura? (el baño se desgasta con agua, perfume y
   roce; no se prometen duraciones)
3. ¿Y si no me queda o no me gusta? (política de cambios en una frase, la
   define ella)
4. ¿Cómo llega y cuándo? (plazos reales y "último día de pedido" con fecha)
5. ¿Es buen regalo? (guía por presupuesto y por persona; envoltorio)
6. Piel sensible: invitar a preguntar por mensaje; nunca afirmar
   "hipoalergénico" si ella no lo confirmó.

Fidelidad con el producto (regla dura del piloto): las imágenes muestran la
pieza REAL. La foto nunca "mejora" la joya: no inventa piedras, eslabones,
cierres ni grabados. Por eso el plan usa recetas de producto sobre fondo
simple, detalle de cerca, vista desde arriba y escenas sin personas. Nada de
personas, manos ni avatares generados por ahora. Esto reemplaza cualquier idea
de "priorizar la pieza puesta en el cuerpo" de otros rubros.

Qué NO hacer (todos OBSERVADOS o INFERIDOS en el estudio):
- Prometer "hipoalergénico", "garantía de por vida", "plata 925 certificada",
  "no se oscurece", "no se desgasta" o "resistente al agua" sin respaldo.
- Inventar reseñas, clientas, testimonios, cifras de ventas o de seguidoras.
- Escasez falsa ("quedan 2") si no es real.
- Competir en descuentos contra tiendas grandes (3x2, 60%): una marca nueva
  se diferencia por significado, material explicado, nicho o cercanía.
- Publicar en ráfagas y desaparecer (error visto en cuentas chicas): ritmo
  bajo pero constante.
- Seguir cuentas masivamente para ganar seguidoras: atrae audiencia que no compra.
- Hashtags que no tienen que ver con joyas, o copiar los de otra marca.
- Prometer plazos de entrega que el courier no cumple.
- Mostrar imágenes creadas con inteligencia artificial como si fueran fotos de
  una clienta real. El contenido hecho con inteligencia artificial se etiqueta
  al publicar cuando la plataforma lo pide.

Ritmo sugerido para quien parte de cero (INFERIDO: 3 a 5 publicaciones por
semana más stories casi diarias; HIPÓTESIS hasta medir): 40% atraer
(descubrimiento: pieza bonita, ideas de regalo), 30% generar deseo (detalle,
ambiente, combinaciones), 20% confianza (cómo se prepara un pedido, cuidados,
preguntas frecuentes, quién eres), 10% convertir (cómo pedir, plazos). El
porcentaje de convertir sube solo en las semanas de Black Friday y Navidad.

Calendario de arranque 2026 (fechas verificadas el 22-oct-2026):
- Black Friday Chile: viernes 27 a lunes 30 de noviembre (OBSERVADO). Cada
  tienda define su horario. Solo hay oferta si la dueña la define.
- Navidad: Nochebuena jueves 24 y Navidad viernes 25 de diciembre.
- Último día de pedido sugerido (HIPÓTESIS, ajustar a su courier): regiones
  ~14 de diciembre, Región Metropolitana ~18 de diciembre.
- CyberDay y CyberMonday 2026 ya pasaron: no mencionarlos como futuros.
- Ruta de 6 semanas: 1 base y presentación; 2 dudas de compra; 3 variedad y
  prueba de formatos; 4 calentar Black Friday; 5 Black Friday; 6 cuenta
  regresiva de Navidad.

Ganchos que funcionan (adaptar a la voz; siempre sin promesas):
- "Esto mide {medida} de verdad, al lado de una moneda."
- "Antes de comprar aros por internet, revisa estas tres cosas."
- "Un regalo de {precio} que se ve pensado, no comprado a última hora."
- "El detalle que casi nadie mira antes de comprar un anillo: la talla."
- "Cómo cuidar tus joyas para que se vean bien por más tiempo."
`,
};

const BELLEZA: Playbook = {
  id: 'belleza',
  keywords: ['skincare', 'cosmetic', 'belleza', 'maquillaje', 'crema', 'serum', 'jabon', 'cuidado', 'piel', 'cabello', 'shampoo', 'labial', 'spa', 'unas', 'pestanas'],
  content: `
PLAYBOOK: BELLEZA, SKINCARE Y COSMÉTICA

Lo que más vende en este rubro:
- El resultado visible manda: antes/después reales (con consentimiento)
  o demostración de textura del producto en piel.
- La rutina paso a paso ("tu rutina de noche en 4 pasos con [producto]")
  es el formato con más guardados del rubro.
- La educación vende más que el catálogo: explicar QUÉ ingrediente hace
  QUÉ cosa posiciona a la marca como experta.
- El unboxing con estética cuidada funciona porque el packaging es
  parte del producto en belleza.

Errores típicos que el plan debe evitar:
- Prometer resultados médicos o milagrosos ("elimina el acné en 3 días").
  El plan NUNCA debe generar captions con promesas de salud absolutas.
- Publicar solo el frasco: el frasco solo no comunica nada. Siempre
  contexto de uso, textura o resultado.
- Lenguaje técnico sin traducir ("niacinamida al 10%") sin explicar
  qué le hace a la piel de la clienta.

Ganchos que funcionan:
- "El error que estás cometiendo con tu [rutina/producto]"
- "Esto le pasa a tu piel cuando..."
- "Lo que nadie te dice sobre [problema común]"

Ritmo semanal sugerido: 30% educación, 25% demostración/textura,
25% confianza (testimonios, resultados), 20% conversión directa.
`,
};

const COMIDA: Playbook = {
  id: 'comida',
  keywords: ['comida', 'pasteleria', 'reposteria', 'torta', 'cocina', 'restaurante', 'cafe', 'chocolate', 'galleta', 'catering', 'brownie', 'postre', 'panaderia', 'gastro', 'mermelada', 'saludable'],
  content: `
PLAYBOOK: COMIDA, PASTELERÍA Y GASTRONOMÍA

Lo que más vende en este rubro:
- El "corte": el momento en que se corta la torta / se abre el relleno
  es el segundo más compartido del rubro. Priorizarlo en Reels.
- El proceso hipnotiza: manos trabajando, glaseado cayendo, masa
  estirándose. El behind the scenes AQUÍ es contenido principal, no
  relleno.
- La foto de detalle con luz natural dura (textura del bizcocho, brillo
  del glaseado) genera antojo inmediato — el antojo es la conversión.
- Fechas y ocasiones son el motor de ventas: cumpleaños, día de la
  madre, fiestas. El plan debe mirar el calendario del mes.

Errores típicos que el plan debe evitar:
- Fotos con luz amarilla de interior: la comida mal iluminada repele.
  Los prompts deben pedir luz natural o luz de día.
- No decir cómo pedir: cada post de producto debe cerrar con el canal
  de pedido claro (DM, WhatsApp, link).
- Olvidar los tiempos de encargo ("pedidos con 48h de anticipación")
  cuando aplica.

Ganchos que funcionan:
- "El sonido de este [corte/crujido] es mejor que cualquier alarma"
- "Así se ve un pedido de [ocasión] saliendo del horno"
- "¿Equipo [sabor A] o equipo [sabor B]?" (genera comentarios)

Ritmo semanal sugerido: 35% antojo directo (producto irresistible),
25% proceso/behind the scenes, 20% confianza (pedidos reales,
clientas), 20% conversión con ocasión concreta.
`,
};

const HOGAR: Playbook = {
  id: 'hogar',
  keywords: ['vela', 'decoracion', 'hogar', 'artesania', 'ceramica', 'planta', 'aroma', 'difusor', 'textil', 'cuadro', 'mueble', 'organizacion', 'regalo', 'manualidad', 'tejido', 'macrame'],
  content: `
PLAYBOOK: HOGAR, DECO, VELAS Y ARTESANÍA

Lo que más vende en este rubro:
- El producto en ambiente: una vela sola es un objeto; una vela
  encendida junto a un libro y una taza es un estilo de vida. Siempre
  contexto aspiracional pero alcanzable.
- La historia del hecho a mano: mostrar el proceso artesanal justifica
  el precio y diferencia de lo industrial. Es el pilar de confianza #1.
- El formato "ideas de regalo" ligado a fechas mueve picos de venta.
- Los ASMR visuales (encender la vela, desmoldar la cerámica, el vapor
  del difusor) tienen alcance orgánico alto en Reels.

Errores típicos que el plan debe evitar:
- Competir por precio en el caption: el hecho a mano no compite con el
  retail. El plan debe vender valor (único, hecho para ti), no descuento.
- Fondos caseros desordenados: los prompts deben pedir escenas limpias
  y cálidas.
- No mostrar escala: siempre una referencia de tamaño (mano, mesa) para
  evitar decepciones de compra.

Ganchos que funcionan:
- "El rincón de tu casa que está pidiendo esto"
- "Así se hace [producto] desde cero" (proceso)
- "Regalos para personas que ya lo tienen todo"

Ritmo semanal sugerido: 35% producto en ambiente, 25% proceso
artesanal, 20% ideas de uso/regalo, 20% conversión directa.
`,
};

const SERVICIOS: Playbook = {
  id: 'servicios',
  keywords: ['servicio', 'asesoria', 'consultoria', 'coach', 'clase', 'curso', 'nutricion', 'entrenamiento', 'fotografia', 'diseno', 'agencia', 'terapia', 'abogado', 'contador', 'freelance', 'community'],
  content: `
PLAYBOOK: SERVICIOS Y PROFESIONALES

Lo que más vende en este rubro:
- La demostración de criterio: el contenido educativo ("3 errores que
  veo en...") es el motor del rubro. La gente contrata a quien le
  demostró que sabe, no a quien dijo que sabe.
- El caso real (con permiso): antes/después de un cliente, proceso de
  un proyecto, resultado concreto con números.
- La cara de la persona: en servicios, la marca ES la persona. Los
  posts con rostro superan consistentemente a los gráficos anónimos.
- El contenido "mini consultoría gratis" genera guardados y DMs, que
  son la conversión real del rubro.

Errores típicos que el plan debe evitar:
- Vender el servicio en cada post: en servicios, la proporción correcta
  es mucho valor gratis y poca venta directa (80/20).
- Contenido genérico de frases motivacionales: no diferencia y no
  demuestra criterio.
- No tener un llamado a la acción de bajo compromiso: "agenda una
  llamada" asusta; "escríbeme [palabra] y te mando la guía" convierte.

Ganchos que funcionan:
- "El error #1 que cometen mis clientes antes de llegar a mí"
- "Esto es lo que pasa cuando [problema] no se atiende a tiempo"
- "Te muestro cómo trabajo un caso real, paso a paso"

Ritmo semanal sugerido: 45% educación con criterio propio, 20% caso o
resultado real, 20% cercanía (quién eres, cómo trabajas), 15%
conversión con CTA de bajo compromiso.
`,
};

const GENERICO: Playbook = {
  id: 'generico',
  keywords: [],
  content: `
PLAYBOOK: GENERAL (cuando el rubro no calza con los especializados)

Principios que funcionan en cualquier negocio que vende por redes:
- Mostrar el producto/servicio EN USO supera siempre al producto solo.
- La confianza se construye con contenido real: proceso, quién está
  detrás, clientes reales. Al menos 1 post de confianza por semana.
- La educación posiciona: enseñar algo útil del rubro hace que la
  audiencia vuelva aunque no compre hoy.
- La conversión directa (precio, disponibilidad, cómo comprar) debe
  existir cada semana, pero nunca ser más del 30% del contenido.
- Los Reels alcanzan gente nueva; los carruseles profundizan con la
  audiencia actual; las stories mantienen la relación diaria.

Errores universales que el plan debe evitar:
- Semanas 100% de venta (queman la audiencia).
- Semanas 100% "bonitas" sin ningún llamado a comprar.
- Captions que no dicen cómo comprar o preguntar.
- Repetir el mismo formato dos días seguidos.
`,
};

export const PLAYBOOKS: Playbook[] = [JOYERIA, MODA, BELLEZA, COMIDA, HOGAR, SERVICIOS, GENERICO];

// ── Selector ─────────────────────────────────────────────────────

function normalize(text: string): string {
  return (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ''); // quita tildes
}

/**
 * Elige el playbook según la categoría y descripción de la marca.
 * Si ninguno calza, devuelve el genérico (siempre seguro).
 */
export function pickPlaybook(mainCategory: string, shortDescription: string): Playbook {
  const haystack = normalize(`${mainCategory} ${shortDescription}`);
  // Palabras completas (para las claves cortas/ambiguas): separa por todo lo que no sea letra o número.
  const tokens = new Set(haystack.split(/[^a-z0-9ñ]+/).filter(Boolean));
  const hasWord = (w: string) => tokens.has(w) || tokens.has(`${w}s`) || tokens.has(`${w}es`);

  let best: Playbook = GENERICO;
  let bestScore = 0;

  for (const pb of PLAYBOOKS) {
    if (pb.id === 'generico') continue;
    const hits =
      pb.keywords.reduce((acc, kw) => (haystack.includes(kw) ? acc + 1 : acc), 0) +
      (pb.exactKeywords ?? []).reduce((acc, kw) => (hasWord(kw) ? acc + 1 : acc), 0);
    const score = hits * (pb.weight ?? 1);
    // En empate gana el primero de la lista (JOYERIA va antes que MODA).
    if (score > bestScore) {
      bestScore = score;
      best = pb;
    }
  }
  return best;
}
