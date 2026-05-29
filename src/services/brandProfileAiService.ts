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

  // ── Paso 2: Identidad — mejorar descripción corta de la marca ────────────────
  async improveBrandDescription(input: {
    brandName: string;
    category: string;
    businessModel: string;
    currentDescription: string;
  }): Promise<string> {
    const prompt = `Eres un experto en branding para emprendedoras latinoamericanas.
Tu tarea es mejorar la frase corta con la que una marca se presenta. La frase debe:
- Decir claramente QUÉ vende la marca
- Transmitir a QUIÉN va dirigida
- Sonar natural y humana, no corporativa ni técnica
- Tener máximo 2 oraciones
- NO incluir comillas, guiones, puntos al final innecesarios ni formato especial

Datos de la marca:
- Nombre: ${input.brandName}
- Categoría: ${input.category}
- Tipo de negocio: ${input.businessModel}

Frase actual: "${input.currentDescription}"

Responde ÚNICAMENTE con la frase mejorada. Sin explicaciones, sin comillas envolventes, sin puntos finales si no son necesarios.`;

    try {
      const result = await geminiService.generatePlainText(prompt);
      return result.trim() || input.currentDescription;
    } catch {
      return input.currentDescription;
    }
  },

  // ── Paso 3: Cliente ideal — mejorar descripción libre de la clienta ──────────
  async improveCustomerDescription(input: {
    brandName: string;
    currentDescription: string;
    genderFocus: string;
    ageRange: string;
  }): Promise<string> {
    const prompt = `Eres un experto en conocer al cliente ideal para marcas de emprendedoras.
Tu tarea es mejorar una descripción libre que una emprendedora escribió sobre su cliente ideal.

La descripción mejorada debe:
- Hablar de esa persona como si la conocieras: quién es, qué hace en su día a día, qué le importa
- Explicar por qué esa persona compraría en esta marca específicamente
- Sonar cercana y empática, no como un informe de marketing
- Tener 2 a 3 oraciones
- Estar escrita en español latinoamericano, sin jerga técnica
- NO tener formato JSON, no usar llaves {}, corchetes [], ni comillas técnicas
- NO comenzar con "Ella es" si se puede evitar para sonar más natural

Marca: ${input.brandName}
Público: ${input.genderFocus}, ${input.ageRange} años
Descripción actual: "${input.currentDescription}"

Responde ÚNICAMENTE con la descripción mejorada. Texto corrido, sin listas ni formato.`;

    try {
      const result = await geminiService.generatePlainText(prompt);
      return result.trim() || input.currentDescription;
    } catch {
      return input.currentDescription;
    }
  },

  // ── Paso 4: Percepción — encontrar diferencial y promesa de marca ────────────
  async findDifferentiator(input: {
    brandName: string;
    category: string;
    perceivedLevel: string;
    currentReasons: string[];
    brandPromise: string;
  }): Promise<{ promise: string; differentiators: string[] }> {
    const prompt = `Eres un consultor de posicionamiento de marca para emprendedoras latinoamericanas.
Tu tarea es ayudar a definir el diferencial y la promesa de marca.

Marca: ${input.brandName}
Categoría: ${input.category}
Nivel percibido: ${input.perceivedLevel}
Razones actuales por las que compran: ${input.currentReasons.join(', ')}
Promesa actual: ${input.brandPromise}

Devuelve EXACTAMENTE este JSON (sin markdown, sin texto extra antes o después):
{
  "promise": "Una oración clara y poderosa que resume qué promete siempre esta marca a su cliente",
  "differentiators": ["diferencial concreto 1", "diferencial concreto 2", "diferencial concreto 3"]
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

  // ── Paso 6: Visual — sugerir paleta de colores ───────────────────────────────
  async suggestColorPalette(input: {
    brandName: string;
    category: string;
    visualStyle: string[];
    perceivedLevel: string;
    contentMood: string[];
  }): Promise<BrandColor[]> {
    const prompt = `Eres un diseñador de identidad visual para marcas de emprendedoras.
Sugiere una paleta de 6 colores coherente y profesional para esta marca.

Marca: ${input.brandName}
Categoría: ${input.category}
Estilo visual: ${input.visualStyle.join(', ')}
Nivel de marca: ${input.perceivedLevel}
Sensaciones que debe transmitir: ${input.contentMood.join(', ')}

Devuelve EXACTAMENTE este JSON (sin markdown, sin texto extra antes o después):
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

  // ── Pasos 3 y 7: detectar dudas del cliente ──────────────────────────────────
  async detectCustomerDoubts(input: {
    brandName: string;
    category: string;
    perceivedLevel: string;
    salesChannels: string[];
  }): Promise<string[]> {
    const prompt = `Eres un experto en psicología del consumidor para marcas de emprendedoras latinoamericanas.
Tu tarea es identificar las 5 principales dudas o miedos que tiene una persona antes de comprar en esta tienda.

Marca: ${input.brandName}
Categoría: ${input.category}
Nivel de marca: ${input.perceivedLevel}
Canales de venta: ${input.salesChannels.join(', ')}

Devuelve EXACTAMENTE este JSON (sin markdown, sin texto extra antes o después):
{ "doubts": ["duda 1", "duda 2", "duda 3", "duda 4", "duda 5"] }

Cada duda debe ser una frase corta, como hablaría un cliente real. Ejemplo: "No sé si la calidad es buena".`;

    try {
      const text = await geminiService.generateText(prompt);
      const parsed = safeJsonParse<{ doubts: string[] }>(text, { doubts: [] });
      return parsed.doubts || [];
    } catch {
      return [];
    }
  },

  // ── Paso 8: Resumen estratégico completo de la marca ─────────────────────────
  async generateBrandSummary(profile: Partial<BrandProfile>): Promise<BrandProfile['aiSummary']> {
    const prompt = `Eres un estratega de marca experto en emprendedoras latinoamericanas.
Basándote en la información completa de esta marca, genera un resumen estratégico que sirva como guía de comunicación.

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

Voz y tono:
- Tono: ${profile.voice?.toneKeywords?.join(', ') || ''}
- Formalidad: ${profile.voice?.formality || ''}
- Emojis: ${profile.voice?.emojiLevel || ''}

Canales de venta: ${profile.commercialRules?.mainSalesChannels?.join(', ') || ''}
CTAs preferidos: ${profile.commercialRules?.preferredCTA?.join(', ') || ''}

Devuelve EXACTAMENTE este JSON (sin markdown, sin texto extra antes o después):
{
  "brandEssence": "Esencia de la marca en 1-2 oraciones que capturen su espíritu",
  "targetCustomerSummary": "Descripción del cliente ideal en 2-3 oraciones, como si lo conocieras",
  "positioningSummary": "Cómo se posiciona esta marca frente a sus competidores en 2 oraciones",
  "voiceGuidelines": "Cómo debe sonar la comunicación de esta marca en 2-3 oraciones concretas",
  "visualGuidelines": "Cómo debe verse el contenido de esta marca en 2 oraciones concretas",
  "salesGuidelines": "Cómo debe vender esta marca: tono, argumentos y canales en 2 oraciones",
  "contentDo": ["acción concreta de contenido que sí hacer", "otra acción", "otra", "otra"],
  "contentDont": ["cosa concreta que evitar en el contenido", "otra", "otra", "otra"]
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
