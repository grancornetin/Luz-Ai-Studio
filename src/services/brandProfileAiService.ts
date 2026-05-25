import { geminiService } from './geminiService';
import type { BrandProfile, BrandColor } from '../modules/brandProfiles/types';

function safeJsonParse<T>(text: string, fallback: T): T {
  try {
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleaned) as T;
  } catch {
    return fallback;
  }
}

export const brandProfileAiService = {
  async improveBrandDescription(input: {
    brandName: string;
    category: string;
    businessModel: string;
    currentDescription: string;
  }): Promise<string> {
    const prompt = `Eres un experto en marketing de marcas para emprendedoras latinoamericanas.
Mejorar esta descripción de marca para que sea más clara, atractiva y represente bien a la marca.
Debe sonar natural, no corporativa. Máximo 2 oraciones.

Marca: ${input.brandName}
Categoría: ${input.category}
Tipo de negocio: ${input.businessModel}
Descripción actual: ${input.currentDescription}

Responde SOLO con la descripción mejorada, sin explicaciones.`;

    try {
      const result = await geminiService.generateText(prompt);
      return result.trim() || input.currentDescription;
    } catch {
      return input.currentDescription;
    }
  },

  async improveCustomerDescription(input: {
    brandName: string;
    currentDescription: string;
    genderFocus: string;
    ageRange: string;
  }): Promise<string> {
    const prompt = `Eres un experto en buyer personas para marcas de emprendedoras.
Mejora esta descripción del cliente ideal para que sea más específica y útil.
Debe hablar de quién es, qué le importa y por qué compraría esta marca.

Marca: ${input.brandName}
Público principal: ${input.genderFocus}, ${input.ageRange} años
Descripción actual: ${input.currentDescription}

Responde SOLO con la descripción mejorada (2-3 oraciones), sin explicaciones.`;

    try {
      const result = await geminiService.generateText(prompt);
      return result.trim() || input.currentDescription;
    } catch {
      return input.currentDescription;
    }
  },

  async findDifferentiator(input: {
    brandName: string;
    category: string;
    perceivedLevel: string;
    currentReasons: string[];
    brandPromise: string;
  }): Promise<{ promise: string; differentiators: string[] }> {
    const prompt = `Eres un consultor de posicionamiento de marca para emprendedoras latinoamericanas.
Ayuda a definir el diferencial de esta marca.

Marca: ${input.brandName}
Categoría: ${input.category}
Nivel percibido: ${input.perceivedLevel}
Razones actuales: ${input.currentReasons.join(', ')}
Promesa actual: ${input.brandPromise}

Devuelve JSON con este formato exacto:
{
  "promise": "promesa de marca clara y poderosa en 1 oración",
  "differentiators": ["diferencial 1", "diferencial 2", "diferencial 3"]
}`;

    try {
      const text = await geminiService.generateText(prompt);
      return safeJsonParse(text, {
        promise: input.brandPromise || '',
        differentiators: input.currentReasons,
      });
    } catch {
      return { promise: input.brandPromise || '', differentiators: input.currentReasons };
    }
  },

  async suggestColorPalette(input: {
    brandName: string;
    category: string;
    visualStyle: string[];
    perceivedLevel: string;
    contentMood: string[];
  }): Promise<BrandColor[]> {
    const prompt = `Eres un diseñador de identidad visual para marcas de emprendedoras.
Sugiere una paleta de 6 colores coherente para esta marca.

Marca: ${input.brandName}
Categoría: ${input.category}
Estilo visual: ${input.visualStyle.join(', ')}
Nivel: ${input.perceivedLevel}
Sensaciones: ${input.contentMood.join(', ')}

Devuelve JSON con este formato exacto (array de 6 objetos):
[
  { "hex": "#XXXXXX", "label": "Principal", "role": "primary" },
  { "hex": "#XXXXXX", "label": "Secundario", "role": "secondary" },
  { "hex": "#XXXXXX", "label": "Acento", "role": "accent" },
  { "hex": "#XXXXXX", "label": "Fondo suave", "role": "lightBackground" },
  { "hex": "#XXXXXX", "label": "Apoyo", "role": "support" },
  { "hex": "#XXXXXX", "label": "Texto", "role": "text" }
]`;

    try {
      const text = await geminiService.generateText(prompt);
      const parsed = safeJsonParse<{ hex: string; label: string; role: string }[]>(text, []);
      if (parsed.length > 0) {
        return parsed.map((c, i) => ({
          id: String(Date.now() + i),
          hex: c.hex || '#F72C5B',
          label: c.label || 'Color',
          role: (c.role as BrandColor['role']) || 'other',
          order: i,
        }));
      }
    } catch { /* fallback below */ }

    return [];
  },

  async detectCustomerDoubts(input: {
    brandName: string;
    category: string;
    perceivedLevel: string;
    salesChannels: string[];
  }): Promise<string[]> {
    const prompt = `Eres un experto en psicología del consumidor para marcas de emprendedoras latinoamericanas.
Lista las 5 principales dudas o miedos que tiene una persona antes de comprar en esta tienda.

Marca: ${input.brandName}
Categoría: ${input.category}
Nivel percibido: ${input.perceivedLevel}
Canales de venta: ${input.salesChannels.join(', ')}

Devuelve JSON con este formato exacto:
{ "doubts": ["duda 1", "duda 2", "duda 3", "duda 4", "duda 5"] }`;

    try {
      const text = await geminiService.generateText(prompt);
      const parsed = safeJsonParse<{ doubts: string[] }>(text, { doubts: [] });
      return parsed.doubts || [];
    } catch {
      return [];
    }
  },

  async generateBrandSummary(profile: Partial<BrandProfile>): Promise<BrandProfile['aiSummary']> {
    const prompt = `Eres un estratega de marca experto en marcas de emprendedoras latinoamericanas.
Basándote en la información de esta marca, genera un resumen estratégico completo.

=== DATOS DE LA MARCA ===
Nombre: ${profile.brandName || ''}
Categoría: ${profile.mainCategory || ''}
País: ${profile.country || ''}
Descripción: ${profile.shortDescription || ''}
Modelo de negocio: ${profile.businessModel || ''}

Cliente ideal:
- Género: ${profile.targetCustomer?.genderFocus || ''}
- Edad: ${profile.targetCustomer?.ageRange || ''}
- Motivaciones: ${profile.targetCustomer?.buyingMotivation?.join(', ') || ''}
- Descripción: ${profile.targetCustomer?.freeDescription || ''}

Posicionamiento:
- Nivel percibido: ${profile.positioning?.perceivedLevel || ''}
- Diferenciadores: ${profile.positioning?.mainDifferentiators?.join(', ') || ''}
- Promesa: ${profile.positioning?.brandPromise || ''}

Voz:
- Tono: ${profile.voice?.toneKeywords?.join(', ') || ''}
- Formalidad: ${profile.voice?.formality || ''}
- Emojis: ${profile.voice?.emojiLevel || ''}

Canales: ${profile.commercialRules?.mainSalesChannels?.join(', ') || ''}
CTAs preferidos: ${profile.commercialRules?.preferredCTA?.join(', ') || ''}

Devuelve JSON con este formato exacto:
{
  "brandEssence": "esencia de marca en 1-2 oraciones poderosas",
  "targetCustomerSummary": "descripción del cliente ideal en 2-3 oraciones",
  "positioningSummary": "cómo se posiciona la marca en 2 oraciones",
  "voiceGuidelines": "cómo debe sonar la comunicación en 2-3 oraciones",
  "visualGuidelines": "cómo debe verse el contenido en 2 oraciones",
  "salesGuidelines": "cómo debe vender la marca en 2 oraciones",
  "contentDo": ["hacer esto", "hacer esto", "hacer esto", "hacer esto"],
  "contentDont": ["evitar esto", "evitar esto", "evitar esto", "evitar esto"]
}`;

    const empty: BrandProfile['aiSummary'] = {
      brandEssence: '',
      targetCustomerSummary: '',
      positioningSummary: '',
      voiceGuidelines: '',
      visualGuidelines: '',
      salesGuidelines: '',
      contentDo: [],
      contentDont: [],
    };

    try {
      const text = await geminiService.generateText(prompt);
      const parsed = safeJsonParse<BrandProfile['aiSummary']>(text, empty);
      return { ...empty, ...parsed };
    } catch {
      return empty;
    }
  },
};
