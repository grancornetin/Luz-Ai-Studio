import { PromptDNA } from '../types/promptTypes';

const KEYWORDS = {
  STYLE: [
    'campaign',
    'editorial',
    'photography',
    'style',
    'aesthetic',
    'vibe',
    'look',
    'cinematic',
    'minimalist',
    'luxury'
  ],

  PERSON: [
    'model',
    'woman',
    'man',
    'person',
    'character',
    'face',
    'portrait',
    'subject'
  ],

  PRODUCT: [
    'lipstick',
    'bottle',
    'watch',
    'jewelry',
    'product',
    'item',
    'object',
    'packaging'
  ],

  LIGHTING: [
    'lighting',
    'light',
    'shadow',
    'sunlight',
    'neon',
    'studio lights',
    'soft light',
    'dramatic'
  ],

  BACKGROUND: [
    'background',
    'backdrop',
    'setting',
    'location',
    'environment',
    'wall',
    'floor',
    'outdoor'
  ],

  COMPOSITION: [
    'composition',
    'angle',
    'shot',
    'view',
    'perspective',
    'framing',
    'close-up',
    'wide shot'
  ]
};

const ROLE_TOKEN_REGEX = /@([a-zA-Z]+)/g;

const unique = (arr: string[]) => Array.from(new Set(arr));

const contains = (text: string, list: string[]) =>
  list.some(k => text.includes(k));

export const promptParserService = {

  parse(text: string): PromptDNA {

    const dna: PromptDNA = {
      persons: [],
      personLayers: [], // 👈 NUEVO
      products: [],
      styles: [],
      lighting: [],
      background: [],
      composition: [],
      details: []
    };

    if (!text.trim()) return dna;

    const segments = text
      .split(/[,.;\n]/)
      .map(s => s.trim())
      .filter(Boolean);

    segments.forEach(segment => {

      const lower = segment.toLowerCase();

      const isPerson = contains(lower, KEYWORDS.PERSON);
      const isProduct = contains(lower, KEYWORDS.PRODUCT);
      const isStyle = contains(lower, KEYWORDS.STYLE);
      const isLighting = contains(lower, KEYWORDS.LIGHTING);
      const isBackground = contains(lower, KEYWORDS.BACKGROUND);
      const isComposition = contains(lower, KEYWORDS.COMPOSITION);

      // 🔥 PRIORIDAD CONTROLADA (fix bug duplicación)
      if (isLighting) {
        dna.lighting!.push(segment);
        return;
      }

      if (isBackground) {
        dna.background!.push(segment);
        return;
      }

      if (isPerson) {
        dna.persons!.push(segment);

        // 🧠 SUBCAPAS
        const words = segment.split(' ');
        const base = words[0];
        const attributes = words.slice(1);

        dna.personLayers!.push({
          base,
          attributes
        });

        return;
      }

      if (isProduct) {
        dna.products!.push(segment);
        return;
      }

      if (isStyle) {
        dna.styles!.push(segment);
        return;
      }

      if (isComposition) {
        dna.composition!.push(segment);
        return;
      }

      dna.details!.push(segment);

    });

    // limpiar duplicados
    dna.persons = unique(dna.persons!);
    dna.products = unique(dna.products!);
    dna.styles = unique(dna.styles!);
    dna.lighting = unique(dna.lighting!);
    dna.background = unique(dna.background!);
    dna.composition = unique(dna.composition!);
    dna.details = unique(dna.details!);

    return dna;
  },

  rebuild(dna: PromptDNA): string {

    const parts = [

      ...(dna.styles || []),
      ...(dna.persons || []),
      ...(dna.products || []),
      ...(dna.lighting || []),
      ...(dna.background || []),
      ...(dna.composition || []),
      ...(dna.details || [])

    ];

    return unique(parts).join(', ');
  },

  extractReferenceRoles(prompt: string): string[] {

    const matches = prompt.match(ROLE_TOKEN_REGEX);

    if (!matches) return [];

    return matches.map(token => token.replace('@', '').toLowerCase());

  }

};