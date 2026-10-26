// ─────────────────────────────────────────────────────────────────
// PLANNER V3 — Banco de textos de joyería (español de Chile, con tildes)
//
// Origen: src/data/jewelry-market/copy-bank.json y hashtags.json
// (los JSON vienen sin tildes ni eñes; aquí están corregidos).
// Textos ORIGINALES redactados para la app, no copiados de ninguna marca.
// Su efectividad es HIPÓTESIS hasta medirla en la cuenta real.
//
// Reglas del banco:
// - Tuteo, sin jerga, sin emojis.
// - Los {placeholders} se llenan solo con datos que ella confirmó.
//   Si falta el dato, la frase NO se usa.
// ─────────────────────────────────────────────────────────────────

import hashtagBank from '../../../data/jewelry-market/hashtags.json';
import type { PilotSeed } from '../../piloto/types';

export interface Gancho {
  id: string;
  formato: 'foto' | 'carrusel' | 'story';
  tipo: string;
  texto: string;
}

/** Ganchos del banco, ya corregidos. Los de "reel" se adaptan a foto/carrusel/story. */
export const GANCHOS: Gancho[] = [
  { id: 'g01', formato: 'carrusel', tipo: 'duda', texto: 'El detalle que casi nadie mira antes de comprar un anillo por internet: la talla.' },
  { id: 'g02', formato: 'foto', tipo: 'tamaño', texto: 'Esto mide {medida} de verdad, puesto al lado de una moneda.' },
  { id: 'g03', formato: 'carrusel', tipo: 'duda', texto: 'Antes de comprar aros online, revisa estas tres cosas.' },
  { id: 'g04', formato: 'story', tipo: 'regalo', texto: 'Si no sabes qué regalarle, parte por esta pregunta.' },
  { id: 'g05', formato: 'carrusel', tipo: 'cuidado', texto: 'Cómo cuidar tus joyas para que se vean bien por más tiempo.' },
  { id: 'g06', formato: 'story', tipo: 'proceso', texto: 'Así se prepara un pedido en mi mesa, de principio a fin.' },
  { id: 'g07', formato: 'foto', tipo: 'regalo', texto: 'Un regalo de {precio} que se ve pensado, no comprado a última hora.' },
  { id: 'g08', formato: 'carrusel', tipo: 'regalo', texto: 'Regalos para {ocasion} según cuánto quieres gastar.' },
  { id: 'g09', formato: 'carrusel', tipo: 'estilo', texto: 'Un mismo collar, tres formas de usarlo esta semana.' },
  { id: 'g10', formato: 'carrusel', tipo: 'estilo', texto: 'Cómo combinar aros con lo que ya tienes en el clóset.' },
  { id: 'g11', formato: 'foto', tipo: 'marca', texto: 'Partí {nombre_marca} desde cero y esto es lo que he aprendido esta semana.' },
  { id: 'g12', formato: 'story', tipo: 'detrás de cámara', texto: 'Lo que no se ve de una joya antes de llegar a tus manos.' },
  { id: 'g13', formato: 'carrusel', tipo: 'guía', texto: 'Guía rápida: qué aros le quedan mejor a cada tipo de rostro.' },
  { id: 'g14', formato: 'carrusel', tipo: 'guía', texto: 'Cómo saber tu talla de anillo en casa con un hilo.' },
  { id: 'g15', formato: 'story', tipo: 'comparación', texto: 'Aros chicos o aros grandes: cuál va contigo.' },
  { id: 'g16', formato: 'carrusel', tipo: 'mito', texto: 'Un mito sobre las joyas de baño que conviene aclarar.' },
  { id: 'g17', formato: 'carrusel', tipo: 'cuidado', texto: 'Tres cosas que no deberías hacer con tus joyas al llegar a casa.' },
  { id: 'g19', formato: 'foto', tipo: 'urgencia real', texto: 'Último día para pedir con despacho antes de Navidad: {fecha_corte}.' },
  { id: 'g21', formato: 'carrusel', tipo: 'precio', texto: 'Joyas bajo {precio} para regalar sin pasarte del presupuesto.' },
  { id: 'g25', formato: 'carrusel', tipo: 'envío', texto: 'Cómo llega tu pedido: del paquete a tu puerta, paso a paso.' },
  { id: 'g27', formato: 'story', tipo: 'pregunta', texto: 'Qué te gustaría que te explique antes de comprar joyas online. Te leo.' },
  { id: 'g28', formato: 'carrusel', tipo: 'preguntas', texto: 'Las preguntas que más me hacen por mensaje, respondidas de una vez.' },
  { id: 'g30', formato: 'foto', tipo: 'básicos', texto: 'Joyas simples para todos los días: lo básico que sí usarías.' },
  { id: 'g33', formato: 'carrusel', tipo: 'regalo', texto: 'Ideas de regalo para una amiga que ya tiene de todo.' },
  { id: 'g35', formato: 'carrusel', tipo: 'regalo', texto: 'Navidad en joyas: qué regalar según la persona.' },
];

export interface CtaItem {
  objetivo: 'guardar' | 'compartir' | 'dm' | 'comentar' | 'compra' | 'seguir';
  texto: string;
}

export const CTAS: CtaItem[] = [
  { objetivo: 'guardar', texto: 'Guarda este post para cuando busques regalo.' },
  { objetivo: 'guardar', texto: 'Guárdalo para acordarte del cuidado de tus joyas.' },
  { objetivo: 'compartir', texto: 'Envíaselo a quien siempre dice "no sé qué regalar".' },
  { objetivo: 'compartir', texto: 'Mándaselo a quien le gustaría recibir esto en Navidad.' },
  { objetivo: 'dm', texto: 'Escríbeme por mensaje directo y te ayudo a elegir.' },
  { objetivo: 'dm', texto: 'Si dudas de la talla, mándame un mensaje y lo vemos juntas.' },
  { objetivo: 'comentar', texto: 'Cuéntame en comentarios cuál te gustó más.' },
  { objetivo: 'comentar', texto: '¿Qué te gustaría que te muestre la próxima semana?' },
  { objetivo: 'compra', texto: 'El link para pedir está en la bio.' },
  { objetivo: 'compra', texto: 'Haz tu pedido hasta el {fecha_corte} para recibirlo antes de Navidad.' },
  { objetivo: 'compra', texto: 'Si quieres que te lo envíe envuelto para regalo, avísame al hacer el pedido.' },
  { objetivo: 'seguir', texto: 'Sígueme para ver ideas de regalo hasta Navidad.' },
  { objetivo: 'seguir', texto: 'Si te sirvió, sigue la cuenta: subo ideas nuevas cada semana.' },
];

export interface CaptionStructure {
  id: string;
  nombre: string;
  plantilla: string;
}

export const ESTRUCTURAS_CAPTION: CaptionStructure[] = [
  { id: 'c01', nombre: 'Problema, solución, pedido', plantilla: 'Muchas veces no sabes si {producto} te va a quedar bien. Por eso lo mostré con medida real: {medida}. Si tienes dudas de talla o largo, escríbeme por mensaje directo.' },
  { id: 'c02', nombre: 'Pregunta y respuesta corta', plantilla: 'Pregunta que me hacen seguido: ¿de qué material es {producto}? Respuesta: {material_confirmado}. Si quieres saber cómo cuidarlo, guarda este post.' },
  { id: 'c03', nombre: 'Lista de tres', plantilla: 'Tres cosas que me gustan de {producto}: 1) {detalle_1} 2) {detalle_2} 3) {detalle_3}. Link para pedirlo en la bio.' },
  { id: 'c04', nombre: 'Guía de regalo', plantilla: 'Para {ocasion}: si buscas algo en torno a {precio}, esta es mi sugerencia. Último día de pedido con despacho a {zona_envio}: {fecha_corte}.' },
  { id: 'c06', nombre: 'Cuidado de la joya', plantilla: 'Cómo cuidar {producto}: guárdala seca, lejos del perfume y límpiala con un paño suave. Guarda este post para cuando la necesites.' },
  { id: 'c07', nombre: 'Detrás de cámara', plantilla: 'Así preparo cada pedido de {nombre_marca}: reviso la pieza, la limpio y la empaco a mano. Hoy te muestro el paso de {paso}.' },
  { id: 'c08', nombre: 'Antes de comprar', plantilla: 'Antes de pedir {categoria} online, revisa: medida real ({medida}), material declarado y política de cambios. Aquí las tengo claras.' },
  { id: 'c09', nombre: 'Envío y plazos', plantilla: 'Despacho a {zona_envio}. Para que llegue antes de Navidad, haz tu pedido hasta el {fecha_corte}. Dudas de plazo, escríbeme.' },
  { id: 'c10', nombre: 'Combinaciones', plantilla: '{producto} con tres looks distintos: uno para el día a día, uno para el trabajo y uno para salir. ¿Cuál te gusta más? Responde con el número.' },
  { id: 'c12', nombre: 'Pregunta abierta', plantilla: '¿Qué joya usas todos los días sin sacártela? Cuéntame la tuya en comentarios.' },
];

// ── Frases que NO se pueden afirmar ──────────────────────────────

export type ClaimKey = PilotSeed['confirmedClaims'][number];

export interface ClaimRule {
  /** Nombre legible del claim */
  label: string;
  pattern: RegExp;
  /** Si está, la frase se permite solo cuando ella confirmó este claim. null = nunca. */
  requires: ClaimKey | null;
}

/** Texto normalizado (sin tildes, minúsculas) sobre el que se prueban los patrones. */
export const CLAIM_RULES: ClaimRule[] = [
  { label: 'hipoalergénico', pattern: /hipoalerg|libre de alergia|no da alergia|no produce alergia|antialerg/, requires: 'hipoalergenico' },
  { label: 'garantía', pattern: /garanti/, requires: 'garantia' },
  { label: 'plata 925', pattern: /\b925\b|plata de ley|plata esterlina|sterling/, requires: 'plata_925' },
  { label: 'baño o chapa de oro', pattern: /ba[nñ]o de oro|ba[nñ]ad[oa]s? (en|de|con) oro|oro laminado|chapado en oro|chapa de oro|oro de \d+ ?k|oro 18|oro 14|gold ?filled|vermeil/, requires: 'banado_oro' },
  { label: 'certificada', pattern: /certificad[oa]/, requires: null },
  { label: 'no se oscurece / no se desgasta', pattern: /no se (oscurece|desgasta|empaña|empana|descascara|saca|destine|decolora|oxida)|nunca se (oscurece|desgasta|oxida)|(duradera|dura) para siempre|de por vida|inoxidable|anti ?alerg|anti ?oxid/, requires: null },
  { label: 'resistente al agua', pattern: /resistente al agua|a prueba de agua|waterproof|sumergible|puedes ducharte|con(?:tigo)? en la ducha/, requires: null },
  { label: 'oro de verdad', pattern: /oro de verdad|oro real|oro puro|oro macizo|oro solido/, requires: null },
  { label: 'acero quirúrgico', pattern: /acero quirurgico|quirurgico|316l|acero medico/, requires: null },
  { label: 'escasez o éxito no verificado', pattern: /mas vendid[oa]|best ?seller|agotad[oa]|ultimas? unidades|quedan \d+|solo quedan|se acaba(n)? hoy|liquidacion|[uú]ltimas? piezas/, requires: null },
];

/** Promesas de resultados o efectos (nunca se permiten). */
export const PROMISE_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  { label: 'promesa de resultado', pattern: /te aseguro|te garantizo|garantizad[oa]|resultados? (garantizad|asegurad|comprobad)|vas a (verte|sentirte) (mas )?(joven|delgad|poderos)|cambiar[aá] tu vida|conquista(r|s|ras)? a|conseguir[aá]s (pareja|el amor)|atraer[aá]s|atrae(s)? (el )?(amor|dinero|suerte|buena energia)|energia (positiva|protectora)|proteccion energetica|\b(cura|curar|curan|sanar|sana tu|sanan)\b|bajar de peso|mejora tu autoestima garantizada/ },
  { label: 'promesa de viralidad', pattern: /viral|miles de (seguidoras|seguidores|likes|ventas)|\d+ ?k seguidor|llenar(as)? tu (agenda|cuenta)|vas a vender|venderas|exito asegurado|ventas aseguradas/ },
];

/** Testimonios, clientas o métricas inventadas (nunca se permiten sin dato real). */
export const INVENTED_SOCIAL_PROOF: Array<{ label: string; pattern: RegExp }> = [
  { label: 'testimonio o reseña', pattern: /testimonio|rese[nñ]as?\b|opinion(es)? de (mis|nuestras) clientas|lo que dicen (mis|nuestras) clientas|(mis|nuestras) clientas (dicen|aman|me|nos|estan|opinan|comparten)|clienta(s)? (feliz|felices|satisfecha|contenta)|mensaje que me lleg[oó]|me escribi[oó] (una|mi) clienta|compartimos con permiso/ },
  { label: 'cifra de clientas o ventas', pattern: /\d[\d.,]* ?(clientas|clientes|ventas|pedidos|seguidoras|seguidores|piezas vendidas|vendidas|reviews|estrellas)|miles de clientas|cientos de clientas|mas de \d+ (clientas|clientes|pedidos)|(\d{2,3}) ?% (de )?(clientas|satisfaccion|recomienda)/ },
];

/** Marcas y cuentas estudiadas: nunca van como hashtag ni se nombran en los textos. */
export const COMPETITOR_TERMS = [
  'silene', 'pandora', 'tatuara', 'love it', 'loveit', 'victoria oddo', 'victoriaoddo', 'mestiza', 'ancharmante', 'an charmante',
  'divas joyeria', 'la catalana', 'lacatalana', 'threads', 'delacons', 'silverice', 'karat', 'boaz', 'bettina', 'mis joyas',
];

/** Palabras que no deben aparecer en textos para ella. */
export const JARGON_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  { label: '"IA"', pattern: /(^|[^a-zA-Záéíóúñ])IA([^a-zA-Záéíóúñ]|$)/ },
  { label: '"prompt"', pattern: /\bprompts?\b/i },
  { label: '"modelo"', pattern: /\bmodelos?\b/i },
  { label: '"algoritmo"', pattern: /\balgoritmos?\b/i },
  { label: '"generado por"', pattern: /\bgenerad[oa]s? por\b/i },
];

// ── Etiquetado de contenido hecho con inteligencia artificial ────

/**
 * Recordatorio para la dueña (política de Meta, verificada el 22-oct-2026).
 * Se escribe "inteligencia artificial" completo: es lenguaje simple para ella.
 */
export const AI_DISCLOSURE_REMINDER =
  'Si una imagen o un video se creó o se retocó con inteligencia artificial y se ve como una foto real, marca la opción de contenido creado con inteligencia artificial al publicar. Meta lo exige para video y audio realistas y puede aplicar penalizaciones si no se hace; por precaución, hazlo también con las fotos. Nunca presentes estas imágenes como si fueran de una clienta real: son tu pieza, mostrada con un fondo distinto.';

export const AI_DISCLOSURE_TASK_STEP =
  'Al publicar, activa la etiqueta de contenido creado con inteligencia artificial que ofrece la red social (aparece en las opciones avanzadas, antes de compartir; el lugar exacto cambia según tu versión de la app).';

// ── Hashtags ─────────────────────────────────────────────────────

type HashtagGroup = { nicho: string[]; medio: string[]; grande: string[] };
const HASHTAGS = (hashtagBank as { categorias: Record<string, HashtagGroup> }).categorias;

const CATEGORY_TO_BANK: Record<string, string> = {
  aros: 'aros',
  collares: 'collares',
  anillos: 'anillos',
  pulseras: 'pulseras',
};

/** Hashtags que exigen cuidado: solo se usan si el claim está confirmado. */
export const HASHTAG_CLAIM_GATES: Array<{ pattern: RegExp; requires: ClaimKey | null }> = [
  { pattern: /^#hipoalergenic/i, requires: 'hipoalergenico' },
  { pattern: /^#(oro|orolaminado|ban(i|o|a)dodeoro)\b/i, requires: 'banado_oro' },
  { pattern: /^#plata925/i, requires: 'plata_925' },
  { pattern: /^#(joyasdeplata925|silverjewelry|sterlingsilver)\b/i, requires: 'plata_925' },
  { pattern: /^#.*plata/i, requires: 'plata_925' },
  { pattern: /^#sorteo/i, requires: null },
];

/** Candidatos de hashtags para el plan, según lo que vende. Estimación de tamaño: HIPÓTESIS. */
export function hashtagCandidates(seed?: Pick<PilotSeed, 'categories' | 'confirmedClaims'>): {
  nicho: string[];
  medio: string[];
  grande: string[];
} {
  const keys = new Set<string>(['chile', 'regalos', 'evergreen_joyeria']);
  for (const c of seed?.categories ?? []) if (CATEGORY_TO_BANK[c]) keys.add(CATEGORY_TO_BANK[c]);
  if (seed?.confirmedClaims.includes('plata_925')) keys.add('plata_925');
  const out = { nicho: [] as string[], medio: [] as string[], grande: [] as string[] };
  for (const k of keys) {
    const g = HASHTAGS[k];
    if (!g) continue;
    out.nicho.push(...g.nicho);
    out.medio.push(...g.medio);
    out.grande.push(...g.grande);
  }
  const allowed = (t: string) =>
    !HASHTAG_CLAIM_GATES.some(g => g.pattern.test(fold(t)) && !(g.requires && seed?.confirmedClaims.includes(g.requires)));
  const uniq = (a: string[]) => Array.from(new Set(a)).filter(allowed);
  return { nicho: uniq(out.nicho), medio: uniq(out.medio), grande: uniq(out.grande) };
}

// ── Utilidades ───────────────────────────────────────────────────

/** Minúsculas y sin tildes (para probar patrones). */
export function fold(text: string): string {
  return (text || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Elimina emojis y símbolos pictográficos. */
export function stripEmojis(text: string): string {
  return (text || '')
    .replace(/[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\u{FE0F}\u{200D}]/gu, '')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

export function hasEmoji(text: string): boolean {
  return /[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}]/u.test(text || '');
}

/** Hay llaves sin rellenar tipo {medida}. */
export function hasUnfilledPlaceholder(text: string): boolean {
  return /\{[a-z_0-9]+\}/i.test(text || '');
}

export function formatCLP(n: number): string {
  return '$' + Math.round(n).toLocaleString('es-CL');
}
