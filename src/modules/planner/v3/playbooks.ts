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
  /** Palabras que activan este playbook (en minúsculas, sin tildes) */
  keywords: string[];
  content: string;
}

const MODA: Playbook = {
  id: 'moda',
  keywords: ['ropa', 'moda', 'accesorio', 'joya', 'arete', 'collar', 'cartera', 'bolso', 'zapato', 'vestido', 'boutique', 'outfit', 'bisuteria', 'lenceria', 'traje'],
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

export const PLAYBOOKS: Playbook[] = [MODA, BELLEZA, COMIDA, HOGAR, SERVICIOS, GENERICO];

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
  let best: Playbook = GENERICO;
  let bestScore = 0;

  for (const pb of PLAYBOOKS) {
    if (pb.id === 'generico') continue;
    const score = pb.keywords.reduce(
      (acc, kw) => (haystack.includes(kw) ? acc + 1 : acc),
      0,
    );
    if (score > bestScore) {
      bestScore = score;
      best = pb;
    }
  }
  return best;
}
