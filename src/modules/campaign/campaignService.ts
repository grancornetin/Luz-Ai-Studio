import { geminiService } from '../../services/geminiService';
import {
  CampaignChannel, CampaignImageSlot, CampaignPiece, CampaignPlan,
  CAMPAIGN_CHANNEL_META,
} from './types';

// ─── buildCampaignPlan ────────────────────────────────────────────────────────
// Piensa como una agencia senior: estrategia → concepto → calendario → copy.
// Devuelve un CampaignPlan completo con piezas listas para generar imágenes.

export async function buildCampaignPlan(
  idea:       string,
  canales:    CampaignChannel[],
  imageCount: number,
  slots:      CampaignImageSlot[],
): Promise<CampaignPlan> {

  const canalesLabel = canales.map(c => CAMPAIGN_CHANNEL_META[c].label).join(', ');

  const hasProduct     = slots.some(s => s.role === 'product');
  const hasInspiration = slots.some(s => s.role === 'inspiration');
  const hasBrand       = slots.some(s => s.role === 'brand');
  const hasModel       = slots.some(s => s.role === 'model');

  const slotsContext = [
    hasProduct     && '- Se adjunta foto del PRODUCTO a promocionar. Analizá colores, forma, tipo de producto y contexto de uso.',
    hasInspiration && '- Se adjunta foto de INSPIRACIÓN / estética deseada. Usá ese estilo visual como referencia.',
    hasBrand       && '- Se adjunta imagen de MARCA (logo/packaging). Mantené coherencia de colores y personalidad.',
    hasModel       && '- Se adjunta foto del MODELO / avatar protagonista. Incluí esa persona en las escenas que corresponda.',
  ].filter(Boolean).join('\n');

  const prompt = `Sos una directora creativa y estratega de marketing senior especializada en marcas latinoamericanas de e-commerce, moda, cosmética y lifestyle. Tu trabajo es crear campañas que compiten con grandes agencias pero que una emprendedora sola puede ejecutar sin frustrarse.

BRIEF DE LA EMPRENDEDORA:
"${idea}"

CANALES DONDE VA A PUBLICAR: ${canalesLabel}
CANTIDAD DE IMÁGENES A GENERAR: ${imageCount}
${slotsContext ? `\nIMÁGENES DE REFERENCIA ADJUNTAS:\n${slotsContext}` : ''}

TU TAREA:
Diseñá una campaña completa y ejecutable. Tenés que pensar como agencia pero entregar algo que una persona sola pueda implementar en 7 días sin frustrarse.

REGLAS ESTRICTAS:
1. El plan tiene exactamente ${imageCount} piezas — ni más, ni menos.
2. Distribuí las piezas entre los días 1 al 7 de forma lógica (no más de 2 piezas por día).
3. Distribuí las piezas entre los canales seleccionados: ${canalesLabel}.
4. Cada pieza tiene un ROL narrativo claro en la historia de la campaña.
5. El copy debe sonar humano, cercano, en español latinoamericano. NUNCA genérico.
6. Las instrucciones para Sofi deben ser simples, concretas, de una sola acción.
7. Los hashtags deben ser reales y específicos al nicho, NO genéricos como #moda o #emprendedor.
8. imagePrompt en inglés, descriptivo y visual, pensado para generar con IA.

ESTRUCTURA DE RESPUESTA — devolvé SOLO JSON válido sin markdown:
{
  "concepto": "El hilo conductor creativo de toda la campaña (1 oración)",
  "promesa": "Qué le prometés al cliente de Sofi con esta campaña (1 oración)",
  "tagline": "Frase memorable de la campaña (máx 8 palabras)",
  "duracionDias": 7,
  "resumen": "2-3 oraciones que explican a Sofi qué debe hacer con este kit y por qué va a funcionar",
  "hashtagsComunidad": ["hashtag1", "hashtag2", "hashtag3"],
  "hashtagsNicho": ["hashtag4", "hashtag5", "hashtag6", "hashtag7"],
  "hashtagsColarga": ["hashtag8", "hashtag9", "hashtag10"],
  "piezas": [
    {
      "id": "pieza_1",
      "dia": 1,
      "semana": 1,
      "canal": "instagram_feed",
      "rol": "Teaser",
      "imagePrompt": "Visual description in English for AI image generation, 1-2 sentences, specific lighting, mood, composition",
      "titular": "Frase corta de impacto (máx 60 caracteres)",
      "caption": "Texto completo del post adaptado al canal, con emojis si corresponde, máx 200 caracteres",
      "cta": "Llamado a la acción específico para este post (máx 40 caracteres)",
      "hashtags": ["#hashtag1", "#hashtag2", "#hashtag3", "#hashtag4"],
      "instruccion": "Instrucción simple y concreta para Sofi sobre cuándo y cómo publicar esta pieza",
      "horaRecomendada": "19:00"
    }
  ]
}`;

  try {
    const raw = await geminiService.generateCampaignPlan(prompt, slots);
    const cleaned = (typeof raw === 'string' ? raw : JSON.stringify(raw))
      .replace(/```json|```/g, '').trim();
    const match = cleaned.match(/\{[\s\S]*\}/);

    if (match) {
      const parsed = JSON.parse(match[0]);
      if (parsed?.piezas && Array.isArray(parsed.piezas)) {
        // Asegurar que imageUrl esté vacío (se llena después de generar)
        parsed.piezas = parsed.piezas.slice(0, imageCount).map((p: any, i: number) => ({
          ...p,
          id:       p.id       ?? `pieza_${i + 1}`,
          imageUrl: '',
          hashtags: Array.isArray(p.hashtags) ? p.hashtags : [],
        }));
        return parsed as CampaignPlan;
      }
    }
  } catch (err) {
    console.warn('[campaignService] buildCampaignPlan failed:', err);
  }

  // Fallback básico si Gemini falla
  return buildFallbackPlan(idea, canales, imageCount);
}

// ─── Fallback ────────────────────────────────────────────────────────────────

function buildFallbackPlan(
  idea:       string,
  canales:    CampaignChannel[],
  imageCount: number,
): CampaignPlan {
  const roles = ['Teaser', 'Lanzamiento', 'Beneficio', 'Confianza', 'Conversión', 'Recordatorio', 'Cierre', 'Bonus'];
  const piezas: CampaignPiece[] = Array.from({ length: imageCount }, (_, i) => ({
    id:              `pieza_${i + 1}`,
    dia:             Math.min(i + 1, 7),
    semana:          1,
    canal:           canales[i % canales.length],
    rol:             roles[i] ?? `Escena ${i + 1}`,
    imagePrompt:     'product on clean surface, soft studio lighting, professional e-commerce style, warm tones',
    imageUrl:        '',
    titular:         `Descubrí lo nuevo`,
    caption:         `Algo especial para vos. ✨ No te lo pierdas.`,
    cta:             'Escribime al DM',
    hashtags:        ['#emprendedora', '#tiendaonline', '#nuevoproducto'],
    instruccion:     `Publicá esta imagen el día ${Math.min(i + 1, 7)} a las 19:00hs.`,
    horaRecomendada: '19:00',
  }));

  return {
    concepto:          'Tu producto, en su mejor versión',
    promesa:           'Mostrar lo que vendés con la calidad visual que merece',
    tagline:           'Hecho para destacar.',
    duracionDias:      7,
    piezas,
    hashtagsComunidad: ['#emprendedoras', '#tiendaonline', '#negocio'],
    hashtagsNicho:     ['#emprendedoralatina', '#ecommercechile', '#shoplocal'],
    hashtagsColarga:   ['#productoshandmade', '#tiendaonlinechile', '#compralocal'],
    resumen:           'Seguí el plan día a día. Publicá cada pieza en el canal indicado y copiá el caption sugerido. Con constancia, esta campaña va a hacer crecer tu alcance.',
  };
}
