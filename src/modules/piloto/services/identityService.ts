// ─────────────────────────────────────────────────────────────────
// Piloto joyería · Pantalla 1 "Mi marca" — servicio de identidad.
//
// Convierte las respuestas (PilotSeed) en 3 identidades completas y guarda
// la elegida como BrandProfile (para que Planner v3 funcione sin cambios).
//
// Reutiliza: geminiService.generateText (endpoint /api/gemini/content, mismo
// patrón que brandProfileAiService) y brandProfileService (Firestore).
// Nunca deja la pantalla en blanco: si el texto falla o viene roto, reintenta
// una vez y luego usa un RESPALDO DETERMINISTA.
// Los claims (hipoalergénico, plata 925, garantía, baño de oro) SOLO salen
// si ella los marcó en confirmedClaims.
// ─────────────────────────────────────────────────────────────────

import { geminiService } from '../../../services/geminiService';
import { brandProfileService } from '../../../services/brandProfileService';
import { EMPTY_BRAND_PROFILE, type BrandColor, type BrandProfile } from '../../brandProfiles/types';
import type {
  PilotAudience, PilotCategory, PilotMaterial, PilotPriceRange, PilotSeed, PilotVoice,
} from '../types';

// ── Catálogo de opciones de las preguntas (la pantalla lo reutiliza) ──

export const CATEGORY_LABEL: Record<PilotCategory, string> = {
  aros: 'Aros', collares: 'Collares', anillos: 'Anillos', pulseras: 'Pulseras', accesorios: 'Otros accesorios',
};
export const MATERIAL_LABEL: Record<PilotMaterial, string> = {
  plata_925: 'Plata 925', banado: 'Bañado en oro u otro metal', acero: 'Acero', otro: 'Otro material', no_se: 'No estoy segura',
};
export const PRICE_LABEL: Record<PilotPriceRange, string> = {
  bajo: 'Accesible (hasta $15.000)', medio: 'Medio ($15.000 a $40.000)', alto: 'Premium (más de $40.000)',
};
export const AUDIENCE_LABEL: Record<PilotAudience, string> = {
  jovenes: 'Mujeres jóvenes (18 a 28 años)', adultas: 'Mujeres adultas (28 a 45 años)',
  regalos: 'Quienes compran para regalar', no_se: 'Todavía no lo sé',
};
export const VOICE_LABEL: Record<PilotVoice, string> = {
  calida: 'Cálida y cercana', elegante: 'Elegante y serena', juvenil: 'Juvenil y alegre',
};

export interface StyleOption { id: string; title: string; hint: string; from: string; to: string }
export const STYLE_OPTIONS: StyleOption[] = [
  { id: 'minimal',  title: 'Minimalista',     hint: 'Pocas cosas, mucho aire',        from: '#F4F4F5', to: '#D4D4D8' },
  { id: 'delicado', title: 'Delicado diario', hint: 'Joyas finas para todos los días', from: '#FDE8EE', to: '#F9BFCD' },
  { id: 'clasico',  title: 'Clásico elegante', hint: 'Brillo sobrio, atemporal',       from: '#2B2B2E', to: '#0A0A0B' },
  { id: 'boho',     title: 'Artesanal boho',  hint: 'Texturas, piedras, hecho a mano', from: '#EADFD3', to: '#C9B49C' },
  { id: 'romantico', title: 'Romántico',      hint: 'Suave, luminoso, para regalar',   from: '#FFF1F4', to: '#F5A3B8' },
  { id: 'urbano',   title: 'Urbano atrevido', hint: 'Piezas con carácter, en capas',   from: '#52525B', to: '#18181B' },
];

export const CLAIM_LABEL: Record<PilotSeed['confirmedClaims'][number], string> = {
  plata_925: 'Mis piezas son de plata 925',
  hipoalergenico: 'Mis piezas son hipoalergénicas',
  garantia: 'Ofrezco garantía',
  banado_oro: 'Mis piezas tienen baño de oro',
};

/** Respuestas preseleccionadas: con 6 toques (o menos) se llega a una marca. */
export function defaultSeed(): PilotSeed {
  return {
    categories: ['aros'],
    material: 'plata_925',
    priceRange: 'medio',
    audience: 'jovenes',
    referenceStyleIds: ['minimal', 'delicado', 'clasico'],
    voice: 'calida',
    brandName: '',
    confirmedClaims: [],
    createdAt: Date.now(),
  };
}

// ── Identidad propuesta ─────────────────────────────────────────

export interface PilotIdentity {
  id: string;
  name: string;
  positioning: string;
  voice: { summary: string; keywords: string[]; preferredWords: string[] };
  palette: Array<{ hex: string; label: string; role: BrandColor['role'] }>;
  pillars: Array<{ title: string; description: string }>;
  instagramBio: string;
  anchorPhrases: string[];
}

export type IdentitySource = 'ai' | 'fallback';

const HEX = /^#[0-9a-fA-F]{6}$/;

// ── Claims: nada se afirma si ella no lo confirmó ───────────────

const CLAIM_PATTERNS: Array<{ claim: PilotSeed['confirmedClaims'][number]; re: RegExp }> = [
  { claim: 'plata_925', re: /plata\s*(de\s*ley|925)|\b925\b|sterling/i },
  { claim: 'hipoalergenico', re: /hipoalerg|libre de alerg|antialerg|no (causa|produce) alerg/i },
  { claim: 'garantia', re: /garant[ií]a|garantizad/i },
  { claim: 'banado_oro', re: /ba[ñn]o de oro|ba[ñn]ad[oa]s? en oro|oro (18|14|laminado)|oro de verdad|enchapad/i },
];
// Siempre prohibidas (no hay forma de que ella las confirme aquí).
const ALWAYS_BANNED = /certificad|no se (oscurece|desgasta|empa[ñn]a)|resistente al agua|m[aá]s vendid|agotad|oro macizo|garant[ií]a de por vida/i;

function offends(text: string, confirmed: PilotSeed['confirmedClaims']): boolean {
  if (ALWAYS_BANNED.test(text)) return true;
  return CLAIM_PATTERNS.some(({ claim, re }) => !confirmed.includes(claim) && re.test(text));
}

/** Quita las frases que afirmen algo no confirmado. Devuelve '' si no queda nada. */
export function cleanClaims(text: string, confirmed: PilotSeed['confirmedClaims']): string {
  if (!text) return '';
  if (!offends(text, confirmed)) return text.trim();
  const parts = text.split(/(?<=[.!?\n])\s+/);
  return parts.filter(p => !offends(p, confirmed)).join(' ').trim();
}

// ── Respaldo determinista (nunca pantalla en blanco) ────────────

interface Archetype { key: string; nameBase: string[]; palette: PilotIdentity['palette']; tone: string }

const PALETTES: Record<string, PilotIdentity['palette']> = {
  nude: [
    { hex: '#C9A892', label: 'Principal', role: 'primary' }, { hex: '#E8D8CC', label: 'Fondo suave', role: 'lightBackground' },
    { hex: '#7A5C4B', label: 'Acento', role: 'accent' }, { hex: '#2B2B2E', label: 'Texto', role: 'text' },
  ],
  rosa: [
    { hex: '#E8758F', label: 'Principal', role: 'primary' }, { hex: '#FDE8EE', label: 'Fondo suave', role: 'lightBackground' },
    { hex: '#B33A5A', label: 'Acento', role: 'accent' }, { hex: '#1F1F22', label: 'Texto', role: 'text' },
  ],
  noche: [
    { hex: '#1F1F22', label: 'Principal', role: 'primary' }, { hex: '#F2EDE6', label: 'Fondo suave', role: 'lightBackground' },
    { hex: '#C8A96A', label: 'Acento', role: 'accent' }, { hex: '#52525B', label: 'Apoyo', role: 'support' },
  ],
  tierra: [
    { hex: '#8A6F5A', label: 'Principal', role: 'primary' }, { hex: '#EFE6DA', label: 'Fondo suave', role: 'lightBackground' },
    { hex: '#C9B49C', label: 'Acento', role: 'accent' }, { hex: '#2E2A26', label: 'Texto', role: 'text' },
  ],
};

function archetypesFor(seed: PilotSeed): Archetype[] {
  const elegant = seed.voice === 'elegante' || seed.priceRange === 'alto' || seed.referenceStyleIds.includes('clasico');
  const young = seed.voice === 'juvenil' || seed.audience === 'jovenes';
  const first: Archetype = elegant
    ? { key: 'serena', nameBase: ['Noche Clara', 'Atelier Brisa', 'Lumbre'], palette: PALETTES.noche, tone: 'serena' }
    : young
      ? { key: 'luminosa', nameBase: ['Brillo Diario', 'Chispa', 'Pequeño Brillo'], palette: PALETTES.rosa, tone: 'luminosa' }
      : { key: 'cercana', nameBase: ['Hilo de Luz', 'Casa Brillo', 'Rayito'], palette: PALETTES.nude, tone: 'cercana' };
  return [
    first,
    { key: 'artesanal', nameBase: ['Tierra y Plata', 'Mano Sur', 'Raíz Fina'], palette: PALETTES.tierra, tone: 'artesanal' },
    { key: 'regalo', nameBase: ['Para Regalar', 'Detalle Fino', 'Un Brillo para Ti'], palette: PALETTES.rosa, tone: 'afectuosa' },
  ];
}

function categoriesText(seed: PilotSeed): string {
  const cats = seed.categories.length ? seed.categories : (['aros'] as PilotCategory[]);
  const names = cats.map(c => CATEGORY_LABEL[c].toLowerCase());
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`;
}

function materialPhrase(seed: PilotSeed): string {
  const c = seed.confirmedClaims;
  if (seed.material === 'plata_925' && c.includes('plata_925')) return 'en plata 925';
  if (seed.material === 'banado' && c.includes('banado_oro')) return 'con baño de oro';
  if (seed.material === 'acero') return 'en acero';
  if (seed.material === 'otro' && seed.materialNote) return `en ${seed.materialNote}`;
  return '';
}

export function buildFallbackIdentities(seed: PilotSeed): PilotIdentity[] {
  const cats = categoriesText(seed);
  const mat = materialPhrase(seed);
  const who = seed.audience === 'regalos' ? 'quienes quieren regalar algo especial'
    : seed.audience === 'adultas' ? 'mujeres que cuidan los detalles'
    : seed.audience === 'jovenes' ? 'mujeres jóvenes que se arman su propio estilo'
    : 'mujeres que disfrutan de una joya con sentido';
  const arch = archetypesFor(seed);
  const userName = (seed.brandName || '').trim();

  const mk = (a: Archetype, i: number): PilotIdentity => {
    const name = userName || a.nameBase[0];
    const sellsLine = `${cats[0].toUpperCase()}${cats.slice(1)} ${mat}`.trim();
    return {
      id: `fallback-${i}`,
      name,
      positioning: `${sellsLine} pensados para ${who}. Una marca ${a.tone}, con piezas que se usan todos los días.`,
      voice: {
        summary: seed.voice === 'elegante' ? 'Habla pausado, con palabras simples y cuidadas.'
          : seed.voice === 'juvenil' ? 'Habla cerca, con energía y humor liviano.'
          : 'Habla como una amiga que te recomienda algo que le encanta.',
        keywords: [a.tone, seed.voice === 'elegante' ? 'cuidada' : seed.voice === 'juvenil' ? 'alegre' : 'cálida'],
        preferredWords: ['brillo', 'detalle', 'todos los días', 'a tu estilo', 'hecho con cariño'],
      },
      palette: a.palette,
      pillars: [
        { title: 'La pieza de cerca', description: 'Mostrar el detalle de cada joya: forma, brillo y terminación.' },
        { title: 'Cómo se usa', description: 'Ideas simples para combinar cada pieza en el día a día.' },
        { title: 'Detrás de la marca', description: 'Quién está detrás, cómo se cuida una joya y por qué nació la marca.' },
      ],
      instagramBio: `${sellsLine}\nPara ${who}\nEscríbenos para pedir`,
      anchorPhrases: [
        'Un detalle que se nota.',
        'Para usar hoy y recordar mañana.',
        'Joyas que se sienten tuyas.',
      ],
    };
  };
  return arch.map(mk).map((idn, i) => ({
    ...idn,
    // Con nombre propio, las 3 opciones difieren en enfoque, no en nombre.
    name: userName || arch[i].nameBase[0],
  }));
}

// ── Prompt y parseo ─────────────────────────────────────────────

export function buildIdentityPrompt(seed: PilotSeed, strict = false): string {
  const styleNames = seed.referenceStyleIds
    .map(id => STYLE_OPTIONS.find(s => s.id === id)?.title).filter(Boolean).join(', ');
  const claims = seed.confirmedClaims.length
    ? `Puedes afirmar SOLO esto, porque ella lo confirmó: ${seed.confirmedClaims.map(c => CLAIM_LABEL[c]).join('; ')}.`
    : 'NO afirmes nada sobre material certificado, hipoalergénico, garantía, baño de oro ni durabilidad: ella no lo ha confirmado.';
  const material = seed.material === 'no_se'
    ? 'No sabe el material: no lo nombres.'
    : `Material: ${MATERIAL_LABEL[seed.material]}${seed.materialNote ? ` (${seed.materialNote})` : ''}.`;

  return `Eres una consultora de marca para emprendedoras chilenas de joyería que parten de cero (sin marca, sin seguidores).
Propón EXACTAMENTE 3 identidades de marca distintas entre sí (enfoques diferentes), listas para usar en Instagram.

Datos de la emprendedora:
- Vende: ${categoriesText(seed)}.
- ${material}
- Rango de precios: ${PRICE_LABEL[seed.priceRange]}.
- Su clienta: ${AUDIENCE_LABEL[seed.audience]}.
- Estilos que le gustan: ${styleNames || 'sin preferencia'}.
- Cómo quiere sonar: ${VOICE_LABEL[seed.voice]}.
- Nombre de marca: ${seed.brandName?.trim() ? `"${seed.brandName.trim()}" (ya lo tiene: úsalo en las 3 opciones)` : 'no tiene; propón un nombre corto, fácil de decir y de recordar en Chile, distinto en cada opción'}.

Reglas:
- Español de Chile, tuteo, sin jerga técnica, SIN emojis.
- Frases cortas y concretas. Nada de "innovadora", "disruptiva" ni palabras de agencia.
- ${claims}
- No inventes clientas, reseñas, cifras ni premios.
- Paleta: 4 colores con hex válido (#RRGGBB), sin verde lima. Roles permitidos: primary, secondary, accent, lightBackground, text, support.
- Exactamente 3 pilares de contenido y exactamente 3 frases ancla (una línea cada una).
- bio de Instagram: máximo 150 caracteres, con saltos de línea (\\n) y sin emojis.
${strict ? '\nIMPORTANTE: tu respuesta anterior no se pudo leer. Responde SOLO con JSON válido, sin texto antes ni después, sin comillas sin cerrar.\n' : ''}
Devuelve EXACTAMENTE este JSON (sin markdown):
{
  "identities": [
    {
      "name": "Nombre de la marca",
      "positioning": "2 frases: qué vende, para quién y qué la hace distinta",
      "voice": { "summary": "una frase sobre cómo habla", "keywords": ["2 a 4 adjetivos"], "preferredWords": ["4 a 6 palabras que usa seguido"] },
      "palette": [ { "hex": "#RRGGBB", "label": "Principal", "role": "primary" } ],
      "pillars": [ { "title": "corto", "description": "una frase" } ],
      "instagramBio": "texto",
      "anchorPhrases": ["frase 1", "frase 2", "frase 3"]
    }
  ]
}`;
}

function str(v: unknown, max = 400): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}
function strArr(v: unknown, max: number): string[] {
  return Array.isArray(v) ? v.map(x => str(x, 80)).filter(Boolean).slice(0, max) : [];
}

const ROLES: BrandColor['role'][] = ['primary', 'secondary', 'accent', 'lightBackground', 'darkBackground', 'text', 'support', 'other'];

/** Extrae el JSON aunque venga con ```json o texto alrededor. */
export function extractJson(text: string): unknown {
  if (!text) return null;
  const cleaned = text.replace(/```json\s*|```/g, '').trim();
  try { return JSON.parse(cleaned); } catch { /* sigue */ }
  const a = cleaned.indexOf('{');
  const b = cleaned.lastIndexOf('}');
  if (a >= 0 && b > a) { try { return JSON.parse(cleaned.slice(a, b + 1)); } catch { /* nada */ } }
  return null;
}

/** Valida y limpia lo que devolvió el texto. Devuelve solo identidades completas. */
export function normalizeIdentities(raw: unknown, seed: PilotSeed): PilotIdentity[] {
  const list = (raw as { identities?: unknown })?.identities ?? raw;
  if (!Array.isArray(list)) return [];
  const fb = buildFallbackIdentities(seed);
  const out: PilotIdentity[] = [];
  list.forEach((r: any, i: number) => {
    const clean = (s: string) => cleanClaims(s, seed.confirmedClaims);
    const name = (seed.brandName?.trim() || str(r?.name, 40));
    const positioning = clean(str(r?.positioning, 400));
    if (!name || !positioning) return;
    const pal = (Array.isArray(r?.palette) ? r.palette : [])
      .filter((c: any) => HEX.test(str(c?.hex, 7)))
      .map((c: any) => ({
        hex: str(c.hex, 7).toUpperCase(),
        label: str(c.label, 30) || 'Color',
        role: (ROLES.includes(c.role) ? c.role : 'other') as BrandColor['role'],
      })).slice(0, 6);
    const pillars = (Array.isArray(r?.pillars) ? r.pillars : [])
      .map((p: any) => ({ title: clean(str(p?.title, 60)), description: clean(str(p?.description, 200)) }))
      .filter((p: { title: string }) => p.title).slice(0, 3);
    const anchors = strArr(r?.anchorPhrases, 3).map(clean).filter(Boolean);
    const bio = clean(str(r?.instagramBio, 220));
    const base = fb[i % fb.length];
    out.push({
      id: `ai-${i}`,
      name,
      positioning,
      voice: {
        summary: clean(str(r?.voice?.summary, 200)) || base.voice.summary,
        keywords: strArr(r?.voice?.keywords, 4).length ? strArr(r?.voice?.keywords, 4) : base.voice.keywords,
        preferredWords: strArr(r?.voice?.preferredWords, 6).filter(w => !offends(w, seed.confirmedClaims)),
      },
      // Cada campo que falte se completa con el respaldo: nunca queda vacío.
      palette: pal.length >= 3 ? pal : base.palette,
      pillars: pillars.length === 3 ? pillars : base.pillars,
      instagramBio: bio || base.instagramBio,
      anchorPhrases: anchors.length === 3 ? anchors : base.anchorPhrases,
    });
  });
  return out.slice(0, 3);
}

/**
 * Pide 3 identidades. Reintenta una vez si el JSON viene roto.
 * Si todo falla, devuelve el respaldo (source: 'fallback'). Nunca lanza.
 */
export async function proposeIdentities(
  seed: PilotSeed,
  gen: (prompt: string) => Promise<string> = (p) => geminiService.generateText(p),
): Promise<{ identities: PilotIdentity[]; source: IdentitySource }> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const text = await gen(buildIdentityPrompt(seed, attempt > 0));
      const ids = normalizeIdentities(extractJson(text), seed);
      if (ids.length === 3) return { identities: ids, source: 'ai' };
      if (ids.length > 0) {
        // Completa hasta 3 con el respaldo, sin repetir nombres.
        const fb = buildFallbackIdentities(seed).filter(f => !ids.some(x => x.name === f.name));
        return { identities: [...ids, ...fb].slice(0, 3), source: 'ai' };
      }
    } catch (e) {
      console.warn('[identityService] intento', attempt + 1, 'falló:', e);
    }
  }
  return { identities: buildFallbackIdentities(seed), source: 'fallback' };
}

// ── Guardado como BrandProfile ──────────────────────────────────

const AGE: Record<PilotAudience, string> = { jovenes: '18-28', adultas: '28-45', regalos: '25-55', no_se: '18-45' };
const LEVEL: Record<PilotPriceRange, string> = { bajo: 'Accesible', medio: 'Intermedio', alto: 'Premium' };
const EMOJI: Record<PilotVoice, string> = { calida: 'Poco', elegante: 'Ninguno', juvenil: 'Poco' };
const FORMALITY: Record<PilotVoice, string> = { calida: 'Cercana', elegante: 'Formal suave', juvenil: 'Informal' };

export function identityToBrandProfile(
  seed: PilotSeed, idn: PilotIdentity, userId: string,
): Omit<BrandProfile, 'id' | 'createdAt' | 'updatedAt'> {
  const colors: BrandColor[] = idn.palette.map((c, i) => ({ id: String(i + 1), hex: c.hex, label: c.label, role: c.role, order: i }));
  const styleNames = seed.referenceStyleIds
    .map(id => STYLE_OPTIONS.find(s => s.id === id)?.title).filter((x): x is string => !!x);
  const banned = ['hipoalergénico', 'garantía de por vida', 'certificado', 'el más vendido', 'agotado']
    .concat(seed.confirmedClaims.includes('plata_925') ? [] : ['plata 925'])
    .concat(seed.confirmedClaims.includes('garantia') ? [] : ['garantía']);
  return {
    ...EMPTY_BRAND_PROFILE,
    userId,
    status: 'basic',
    completionScore: 0,
    isDefault: true,
    brandName: idn.name,
    country: 'Chile',
    businessModel: 'starting',
    mainCategory: 'Joyería',
    shortDescription: idn.positioning,
    targetCustomer: {
      ...EMPTY_BRAND_PROFILE.targetCustomer,
      genderFocus: 'Mujeres',
      ageRange: AGE[seed.audience],
      buyingMotivation: seed.audience === 'regalos' ? ['Regalar'] : ['Verse bien', 'Un detalle para ella'],
      freeDescription: AUDIENCE_LABEL[seed.audience],
    },
    positioning: {
      ...EMPTY_BRAND_PROFILE.positioning,
      perceivedLevel: LEVEL[seed.priceRange],
      mainDifferentiators: idn.pillars.map(p => p.title),
      mainDifferentiatorText: idn.pillars.map(p => p.description).join(' '),
      brandPromise: idn.anchorPhrases[0] ?? '',
    },
    voice: {
      toneKeywords: idn.voice.keywords,
      formality: FORMALITY[seed.voice],
      emojiLevel: EMOJI[seed.voice],
      preferredWords: idn.voice.preferredWords,
      forbiddenWords: banned,
    },
    visualIdentity: {
      visualStyle: styleNames,
      contentMood: idn.voice.keywords,
      avoidVisuals: ['Fondos desordenados', 'Fotos oscuras'],
      colors,
      assets: [],
    },
    commercialRules: {
      mainSalesChannels: ['Instagram'],
      preferredCTA: ['Escríbenos por mensaje directo'],
      businessStage: { key: 'launching', label: 'Recién empezando', description: 'Parte de cero: sin seguidores ni marca previa.' },
      trustBuilders: seed.confirmedClaims.map(c => CLAIM_LABEL[c]),
      customerDoubts: [],
    },
    aiSummary: {
      brandEssence: idn.positioning,
      targetCustomerSummary: AUDIENCE_LABEL[seed.audience],
      positioningSummary: idn.positioning,
      voiceGuidelines: idn.voice.summary,
      visualGuidelines: `Estilo ${styleNames.join(', ').toLowerCase() || 'simple'}; fondos limpios y buena luz.`,
      salesGuidelines: 'Vender mostrando cada pieza de cerca y respondiendo dudas por mensaje directo.',
      contentDo: idn.pillars.map(p => `${p.title}: ${p.description}`),
      contentDont: ['Afirmar materiales o garantías que no están confirmados', 'Inventar reseñas o clientas'],
    },
    // Campos propios del piloto (opcionales, no alteran el contrato de BrandProfile)
    ...({ pilotSeed: seed, pilotIdentity: idn } as object),
  } as Omit<BrandProfile, 'id' | 'createdAt' | 'updatedAt'>;
}

type PilotBrand = BrandProfile & { pilotSeed?: PilotSeed; pilotIdentity?: PilotIdentity };

export const identityService = {
  /** La marca del piloto de esta usuaria, si ya la creó. */
  async getPilotBrand(uid: string): Promise<PilotBrand | null> {
    const all = (await brandProfileService.getBrandProfiles(uid)) as PilotBrand[];
    return all.find(b => !!b.pilotSeed) ?? null;
  },

  /**
   * Guarda la identidad elegida. Si ya había una marca del piloto, la actualiza
   * (no duplica). La deja como marca por defecto para que Planner v3 la use.
   */
  async saveIdentity(uid: string, seed: PilotSeed, idn: PilotIdentity): Promise<string> {
    const data = identityToBrandProfile(seed, idn, uid);
    const existing = await this.getPilotBrand(uid);
    let id: string;
    if (existing) {
      id = existing.id;
      await brandProfileService.updateBrandProfile(uid, id, data as Partial<BrandProfile>);
    } else {
      id = await brandProfileService.createBrandProfile(uid, data as Omit<BrandProfile, 'id'>);
    }
    await brandProfileService.setDefaultBrandProfile(uid, id);
    return id;
  },
};
