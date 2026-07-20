// ─────────────────────────────────────────────────────────────────
// MIS MARCAS 2.0 — Servicio de inteligencia de marca (v2)
//
// Reemplaza la versión anterior de brandIntelligenceService.ts.
// Novedades de esta versión:
//   · Lectura de estadísticas POR RED (Instagram, TikTok, Facebook),
//     con el vocabulario de menús propio de cada una.
//   · Soporta VARIAS capturas en un solo análisis (en el celular una
//     sola captura casi nunca muestra todo): la usuaria sube 2-3
//     imágenes y Gemini las combina en un solo resultado.
//   · Devuelve el objeto NetworkInsights listo para guardar por red.
//
// Sigue usando /api/gemini/content (action: generateText) con
// images[] + mimeTypes[]. NO requiere cambios de backend.
// ─────────────────────────────────────────────────────────────────

import { getAuth } from 'firebase/auth';
import type {
  BrandColor,
  BrandSocialInsights,
  NetworkInsights,
  SocialNetworkKey,
} from '../modules/brandProfiles/types';
import { SOCIAL_NETWORK_LABELS } from '../modules/brandProfiles/types';

const CONTENT_ENDPOINT = '/api/gemini/content';
const MODEL = 'gemini-2.5-flash';

// ── Helpers ──────────────────────────────────────────────────────

async function authHeaders(): Promise<Record<string, string>> {
  const token = await getAuth().currentUser?.getIdToken();
  if (!token) throw new Error('No autenticado');
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

function parseJson<T>(data: { json?: unknown; text?: string }): T {
  if (data.json && typeof data.json === 'object') return data.json as T;
  const raw = (data.text || '')
    .trim()
    .replace(/^```json\n?/, '')
    .replace(/\n?```$/, '')
    .trim();
  return JSON.parse(raw) as T;
}

async function callGemini<T>(body: Record<string, unknown>): Promise<T> {
  const headers = await authHeaders();
  const res = await fetch(CONTENT_ENDPOINT, {
    method: 'POST',
    headers,
    body: JSON.stringify({ action: 'generateText', model: MODEL, ...body }),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'Error de análisis');
  return parseJson<T>(data);
}

function makeColorId(): string {
  return `c_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

// ─────────────────────────────────────────────────────────────────
// 1. LOGO → PALETA + ESTILO (sin cambios respecto de la v1)
// ─────────────────────────────────────────────────────────────────

export interface LogoAnalysis {
  colors: BrandColor[];
  suggestedStyles: string[];
  suggestedMoods: string[];
  readingNote: string;
}

const STYLE_VOCAB = ['Limpio', 'Minimalista', 'Elegante', 'Femenino', 'Colorido', 'Natural', 'Cálido', 'Urbano', 'Premium', 'Divertido', 'Editorial', 'Artesanal', 'Moderno', 'Romántico', 'Atrevido'];
const MOOD_VOCAB = ['Confianza', 'Deseo', 'Cercanía', 'Elegancia', 'Alegría', 'Exclusividad', 'Calidez', 'Profesionalismo', 'Frescura', 'Seguridad', 'Inspiración'];

export async function analyzeLogoForBrand(
  imageBase64: string,
  mimeType: string,
  brandName: string,
  category: string,
): Promise<LogoAnalysis> {
  const prompt = `Eres directora de identidad visual. Esta imagen es el logo de la marca "${brandName}"${category ? ` (rubro: ${category})` : ''}.

Analiza el logo y responde:

1. "palette": una paleta de marca de 4 a 6 colores en hex (#RRGGBB) derivada del logo. El primer color es el protagonista del logo. Completa la paleta con colores armónicos coherentes con el estilo del logo (fondos claro y oscuro, un acento). Cada color con:
   - "hex": "#RRGGBB"
   - "label": nombre corto en español ("Fucsia principal", "Crema de fondo")
   - "role": uno de: "primary" | "secondary" | "accent" | "lightBackground" | "darkBackground" | "text"
2. "suggestedStyles": 2 a 4 de esta lista EXACTA que mejor describan el estilo del logo: ${STYLE_VOCAB.join(', ')}
3. "suggestedMoods": 2 a 3 de esta lista EXACTA: ${MOOD_VOCAB.join(', ')}
4. "readingNote": 1-2 frases en español, cálidas y simples, diciéndole a la dueña qué transmite su logo (ej: "Tu logo transmite elegancia moderna: líneas limpias y un color que destaca sin gritar.")

Si la imagen NO parece un logo (es una foto, un producto, una persona), responde {"notALogo": true}.

Responde ÚNICAMENTE con JSON válido:
{"palette":[{"hex":"#..","label":"..","role":".."}],"suggestedStyles":[".."],"suggestedMoods":[".."],"readingNote":".."}`;

  const parsed = await callGemini<{
    notALogo?: boolean;
    palette?: Array<{ hex: string; label: string; role: string }>;
    suggestedStyles?: string[];
    suggestedMoods?: string[];
    readingNote?: string;
  }>({
    prompt,
    images: [imageBase64],
    mimeTypes: [mimeType],
    generationConfig: { temperature: 0.2 },
  });

  if (parsed.notALogo) throw new Error('NOT_A_LOGO');

  const validRoles = new Set(['primary', 'secondary', 'accent', 'lightBackground', 'darkBackground', 'text', 'support', 'other']);
  const colors: BrandColor[] = (parsed.palette || [])
    .filter(c => HEX_RE.test(c.hex))
    .slice(0, 6)
    .map((c, i) => ({
      id: makeColorId(),
      hex: c.hex.toUpperCase(),
      label: c.label || `Color ${i + 1}`,
      role: (validRoles.has(c.role) ? c.role : i === 0 ? 'primary' : 'other') as BrandColor['role'],
      order: i,
    }));

  if (colors.length === 0) throw new Error('NOT_A_LOGO');

  return {
    colors,
    suggestedStyles: (parsed.suggestedStyles || []).filter(s => STYLE_VOCAB.includes(s)).slice(0, 4),
    suggestedMoods: (parsed.suggestedMoods || []).filter(m => MOOD_VOCAB.includes(m)).slice(0, 3),
    readingNote: parsed.readingNote || '',
  };
}

// ─────────────────────────────────────────────────────────────────
// 2. CAPTURAS DE UN PERFIL → handle + seguidores (por red)
//    Acepta varias imágenes por si la usuaria sube más de una.
// ─────────────────────────────────────────────────────────────────

export interface ProfileShotAnalysis {
  handle: string;
  followers: string;
}

export async function analyzeProfileShots(
  network: SocialNetworkKey,
  imagesBase64: string[],
  mimeTypes: string[],
): Promise<ProfileShotAnalysis> {
  const net = SOCIAL_NETWORK_LABELS[network];
  const prompt = `Estas imágenes son capturas de un perfil de ${net}.

Extrae SOLO lo que se vea claramente en cualquiera de las imágenes:
- "handle": el nombre de usuario (sin @). Si no se ve, "".
- "followers": la cantidad de seguidores como número entero (convierte "1,2 mil"→1200, "3.4K"→3400, "1M"→1000000). Si no se ve, null.

NUNCA inventes datos. Responde ÚNICAMENTE con JSON:
{"handle":"..","followers":number|null}`;

  const parsed = await callGemini<{ handle?: string; followers?: number | null }>({
    prompt,
    images: imagesBase64,
    mimeTypes,
    generationConfig: { temperature: 0 },
  });

  return {
    handle: (parsed.handle || '').replace(/^@/, '').trim(),
    followers: typeof parsed.followers === 'number' ? String(parsed.followers) : '',
  };
}

// ─────────────────────────────────────────────────────────────────
// 3. CAPTURAS DE ESTADÍSTICAS DE LA CUENTA → diagnóstico (por red)
//    Combina varias capturas (alcance + horarios + contenido) en un
//    solo resultado. El vocabulario de menús se adapta a cada red.
// ─────────────────────────────────────────────────────────────────

export interface AccountInsightsAnalysis {
  reachDiagnosis: string;
  bestTime: string;
  videoInsight: string;
  postInsight: string;
  /** true si TODAS las imágenes resultaron ilegibles */
  unreadable: boolean;
}

const NETWORK_VOCAB: Record<SocialNetworkKey, { video: string; post: string; menus: string }> = {
  instagram: {
    video: 'reels',
    post: 'publicaciones y carruseles',
    menus: 'Alcance, Cuentas alcanzadas, Interacciones, Horarios de mayor actividad',
  },
  tiktok: {
    video: 'videos (TikToks)',
    post: 'publicaciones',
    menus: 'Reproducciones de video, Alcance, Espectadores, Horarios más activos, Retención',
  },
  facebook: {
    video: 'videos y reels',
    post: 'publicaciones',
    menus: 'Alcance, Visitas a la página, Interacciones, Me gusta',
  },
};

export async function analyzeAccountInsightsShots(
  network: SocialNetworkKey,
  imagesBase64: string[],
  mimeTypes: string[],
): Promise<AccountInsightsAnalysis> {
  const net = SOCIAL_NETWORK_LABELS[network];
  const vocab = NETWORK_VOCAB[network];

  const prompt = `Estas imágenes son capturas de las Estadísticas (Insights) de una cuenta de ${net}. Pueden ser varias capturas de distintas secciones (en el celular una sola no muestra todo): combínalas en un solo resultado. Términos que podrías ver: ${vocab.menus}.

Extrae SOLO lo que se vea claramente, en español, frases cortas y simples:
- "reachDiagnosis": el alcance del período con su número ("Alcanzaste 4.200 cuentas en los últimos 30 días"). "" si no se ve.
- "bestTime": el horario o rango donde la audiencia está más activa ("19:00–21:00", "Domingos 20:00"). "" si no se ve.
- "videoInsight": qué dicen los datos sobre tus ${vocab.video} ("Tus ${vocab.video} alcanzan en promedio 900 cuentas"). "" si no se ve.
- "postInsight": qué dicen los datos sobre tus ${vocab.post}. "" si no se ve.

Si NINGUNA imagen contiene estadísticas legibles (son otra cosa, están borrosas o vacías), responde {"unreadable": true}.
NUNCA inventes números ni conclusiones que no estén en las imágenes.
Responde ÚNICAMENTE con JSON:
{"reachDiagnosis":"..","bestTime":"..","videoInsight":"..","postInsight":".."}`;

  const parsed = await callGemini<Partial<AccountInsightsAnalysis> & { unreadable?: boolean }>({
    prompt,
    images: imagesBase64,
    mimeTypes,
    generationConfig: { temperature: 0 },
  });

  if (parsed.unreadable) {
    return { reachDiagnosis: '', bestTime: '', videoInsight: '', postInsight: '', unreadable: true };
  }

  return {
    reachDiagnosis: parsed.reachDiagnosis || '',
    bestTime: parsed.bestTime || '',
    videoInsight: parsed.videoInsight || '',
    postInsight: parsed.postInsight || '',
    unreadable: false,
  };
}

// ─────────────────────────────────────────────────────────────────
// 4. Construir NetworkInsights y BrandSocialInsights para guardar
// ─────────────────────────────────────────────────────────────────

export function buildNetworkInsights(
  profile: ProfileShotAnalysis | null,
  insights: AccountInsightsAnalysis | null,
  notes = '',
): NetworkInsights {
  return {
    handle: profile?.handle || '',
    followers: profile?.followers || '',
    reachDiagnosis: insights?.reachDiagnosis || '',
    videoInsight: insights?.videoInsight || '',
    postInsight: insights?.postInsight || '',
    bestTime: insights?.bestTime || '',
    notes,
    updatedAt: Date.now(),
  };
}

/**
 * Fusiona los datos por red en el objeto BrandSocialInsights que se
 * guarda en el perfil. Mantiene los campos planos originales como
 * ESPEJO de Instagram para que el Planner V3 y los informes (que leen
 * instagramHandle / reelsInsight / carouselInsight / bestTime) sigan
 * funcionando sin cambios. Si no hay Instagram, usa la primera red
 * disponible como espejo para que el Planner tenga con qué trabajar.
 */
export function assembleSocialInsights(
  networks: Partial<Record<SocialNetworkKey, NetworkInsights>>,
): BrandSocialInsights {
  const mirror = networks.instagram
    || networks.tiktok
    || networks.facebook
    || null;

  return {
    // Campos planos (espejo, compatibilidad hacia atrás)
    instagramHandle: mirror?.handle || '',
    followers: mirror?.followers || '',
    reachDiagnosis: mirror?.reachDiagnosis || '',
    reelsInsight: mirror?.videoInsight || '',
    carouselInsight: mirror?.postInsight || '',
    bestTime: mirror?.bestTime || '',
    notes: mirror?.notes || '',
    updatedAt: Date.now(),
    // Datos por red (lo nuevo)
    networks,
  };
}

// ─────────────────────────────────────────────────────────────────
// 5. ENTREVISTA → CAMPOS DEL PERFIL (sin cambios respecto de la v1)
// ─────────────────────────────────────────────────────────────────

const MOTIVATION_VOCAB = ['Verse mejor', 'Ahorrar dinero', 'Sentirse elegante', 'Regalar algo especial', 'Resolver una necesidad práctica', 'Sentirse única', 'Cuidarse', 'Decorar su espacio', 'Probar algo nuevo', 'Comprar rápido y fácil'];
const TONE_VOCAB = ['Cercana', 'Elegante', 'Juvenil', 'Divertida', 'Premium', 'Delicada', 'Directa', 'Profesional', 'Emocional', 'Inspiradora', 'Minimalista', 'Atrevida', 'Experta', 'Amigable', 'Sofisticada'];

export interface InterviewExtraction {
  shortDescription: string;
  customerFreeDescription: string;
  buyingMotivation: string[];
  mainDifferentiatorText: string;
  brandPromise: string;
  suggestedTones: string[];
  missing: string[];
}

export async function extractBrandFromInterview(
  interviewText: string,
  brandName: string,
): Promise<InterviewExtraction> {
  const prompt = `Una emprendedora escribió sobre su marca "${brandName}" con sus propias palabras. Tu trabajo es ordenar esa información en los campos de su perfil de marca, SIN inventar nada que ella no haya dicho o que no se deduzca directamente.

LO QUE ESCRIBIÓ:
"""
${interviewText.slice(0, 4000)}
"""

Extrae:
- "shortDescription": su marca en UNA frase clara y natural (qué vende y para quién). Usa sus palabras como base, solo ordénalas.
- "customerFreeDescription": su clienta ideal en 2-3 frases, con lo que ella contó.
- "buyingMotivation": 1 a 4 opciones de esta lista EXACTA que calcen con lo que contó: ${MOTIVATION_VOCAB.join(', ')}. Si nada calza, [].
- "mainDifferentiatorText": por qué alguien le compraría a ELLA y no a otra, en una frase. "" si no lo dijo.
- "brandPromise": qué promete entregar siempre, en una frase. "" si no lo dijo.
- "suggestedTones": 2 a 4 de esta lista EXACTA según cómo escribe y cómo describe su marca: ${TONE_VOCAB.join(', ')}
- "missing": lista en español de lo que NO contó y valdría la pena completar (ej: ["la edad de tu clienta", "qué te diferencia de la competencia"]). Máximo 3.

Todo en español neutro latinoamericano, cálido, sin jerga de marketing.
Responde ÚNICAMENTE con JSON válido:
{"shortDescription":"..","customerFreeDescription":"..","buyingMotivation":[".."],"mainDifferentiatorText":"..","brandPromise":"..","suggestedTones":[".."],"missing":[".."]}`;

  const parsed = await callGemini<Partial<InterviewExtraction>>({
    prompt,
    generationConfig: { temperature: 0.3 },
  });

  return {
    shortDescription: parsed.shortDescription || '',
    customerFreeDescription: parsed.customerFreeDescription || '',
    buyingMotivation: (parsed.buyingMotivation || []).filter(m => MOTIVATION_VOCAB.includes(m)),
    mainDifferentiatorText: parsed.mainDifferentiatorText || '',
    brandPromise: parsed.brandPromise || '',
    suggestedTones: (parsed.suggestedTones || []).filter(t => TONE_VOCAB.includes(t)).slice(0, 4),
    missing: (parsed.missing || []).slice(0, 3),
  };
}
