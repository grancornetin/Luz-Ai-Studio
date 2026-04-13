

import { Type } from "@google/genai";

export const AVATAR_EXTRACTOR_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    physical_description: { type: Type.STRING },
    identity_prompt: { type: Type.STRING, description: "Prompt descriptivo detallado para regenerar este personaje." },
    negative_prompt: { type: Type.STRING },
    metadata: {
      type: Type.OBJECT,
      properties: {
        gender: { type: Type.STRING, enum: ["hombre", "mujer"] },
        age: { type: Type.STRING },
        build: { type: Type.STRING },
        ethnicity: { type: Type.STRING },
        eyes: { type: Type.STRING },
        hairColor: { type: Type.STRING },
        hairType: { type: Type.STRING },
        hairLength: { type: Type.STRING },
        personality: { type: Type.STRING },
        expression: { type: Type.STRING }
      }
    }
  },
  required: ["physical_description", "identity_prompt", "negative_prompt", "metadata"]
};

export const PRODUCT_ANALYZER_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    technical_description: { type: Type.STRING },
    commercial_description: { type: Type.STRING },
    product_prompt: { type: Type.STRING },
    metadata: {
      type: Type.OBJECT,
      properties: {
        material: { type: Type.STRING },
        color: { type: Type.STRING },
        category: { type: Type.STRING }
      }
    }
  },
  required: ["technical_description", "commercial_description", "product_prompt", "metadata"]
};

export const OUTFIT_ANALYZER_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    items: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING, description: "Nombre corto de la prenda en español" },
          category: { type: Type.STRING, enum: ["main_garment", "top", "bottom", "footwear", "bag", "accessory"] },
          visual_description: { type: Type.STRING, description: "Descripción técnica visual exhaustiva" },
          ghost_mannequin_prompt: { type: Type.STRING, description: "Prompt específico para renderizado de producto aislado" },
          confidence_score: { type: Type.NUMBER },
          coordinates: {
            type: Type.OBJECT,
            properties: {
              x: { type: Type.NUMBER, description: "Centro X (0-1000)" },
              y: { type: Type.NUMBER, description: "Centro Y (0-1000)" }
            },
            required: ["x", "y"]
          }
        },
        required: ["name", "category", "visual_description", "ghost_mannequin_prompt", "coordinates", "confidence_score"]
      }
    }
  },
  required: ["items"]
};

export const PRODUCT_HARD_RULES = `
ONLY ONE PRODUCT as the sole subject. Output must contain ONLY the product. Remove any hands, feet, people, body parts, mannequin, hanger, clothing-on-body, or human reflections. 
Do not change the product identity: no shape change, no silhouette change, no proportion change, no color shift (including undertones), no material/texture change, no added or removed accessories, no invented variants, keep orientation of parts (buckles, zippers, closures). 
Product must be fully in frame, centered or clean commercial composition, sharp focus, no creative blur, no warped geometry, no extreme perspective distortion. Must look like a real photo, not CGI / not 3D render.
`;

export const PRODUCT_NEGATIVE_PROMPT = `
people, person, human, hands, fingers, feet, legs, arms, face, skin, model, mannequin, hanger, body parts, human reflection, mirror reflection, text, typography, letters, logo, brand mark, watermark, signature, extra objects, extra props, packaging (unless it is part of the original product), duplicate product, invented accessories, wrong product, wrong color, color shift, deformed, warped, melted, stretched, broken geometry, lowres, blurry, bokeh, depth of field blur, CGI, 3d render, cartoon, illustration
`;

export const PRODUCT_BASE_STYLES = {
  comercial: `
High-end commercial studio photography. Background: SEAMLESS INFINITE WHITE CYCLORAMA, pure white floor and wall with no visible transition, NO FABRIC BACKDROP, no folds, no edges. Lighting: Professional studio multi-light setup (Key, Fill, Rim). Shadows: NATURAL SOFT CONTACT SHADOWS UNDER FEET/PRODUCT on the floor. Aesthetic: Produced, elegant, polished. Photo-realistic.
`,
  organico: `
Realistic product photography. Background: soft neutral textured surface. Lighting: natural window light. Aesthetic: subtle imperfections, premium, natural feel. Photo-realistic.
`
};

export const ORGANIC_PROPS_BY_CATEGORY: { [key: string]: string } = {
  clothing: "a subtle fabric drape or smooth wooden surface as prop.",
  jewelry: "linen, soft paper, or smooth marble slab as prop.",
  electronics: "a clean minimalist desk or matte surface as prop.",
  other: "a subtle, neutral textured surface as prop."
};

export const PRODUCT_SHOT_INTENTS = {
  comercial: {
    1: "hero product shot, full product, premium catalog composition, front view",
    2: "alternative angle, slight rotation from hero, not duplicated, 45 degree angle",
    3: "informative view showing functional details (back, side, or top-down view depending on product features), no repetition of angle",
    4: "macro close-up of texture and material details, sharp and undistorted",
    5: "premium ad-style composition, clean air, subtle reflection on floor, no text, no branding"
  },
  organico: {
    1: "hero product shot, full product, premium organic composition, front view",
    2: "alternative angle, slight rotation from hero, not duplicated, 45 degree angle",
    3: "informative view showing functional details (back, side, or top-down view depending on product features), no repetition of angle",
    4: "macro close-up of texture and material details, sharp and undistorted",
    5: (category: string) => {
      const propSuggestion = ORGANIC_PROPS_BY_CATEGORY[category] || ORGANIC_PROPS_BY_CATEGORY.other;
      return `simple lifestyle composition with minimal neutral props on ${propSuggestion} No complex scene, no distracting elements.`;
    }
  }
};


export const LIGHTING_PRESETS = [
  { id: 'natural', label: 'Luz Natural', icon: '☀️' },
  { id: 'suave', label: 'Suave / Difusa', icon: '☁️' },
  { id: 'contrastada', label: 'Contrastada (Noir)', icon: '🌓' },
  { id: 'nocturna', label: 'Nocturna / Neón', icon: '🌙' },
  { id: 'estudio', label: 'Estudio Pro', icon: '💡' }
];

export const AGE_OPTIONS = [
  { id: 'adolescente', label: 'adolescente (18-20 años)' },
  { id: 'joven', label: 'joven (21-30 años)' },
  { id: 'adulto', label: 'adulto (31-40 años)' },
  { id: 'mayor', label: 'mayor (41-60 años)' },
  { id: 'anciano', label: 'anciano (+61 años)' }
];

export const BUILD_OPTIONS = [
  { id: 'delgada', label: 'delgada' },
  { id: 'tonificada', label: 'tonificada' },
  { id: 'curvy', label: 'curvy' },
  { id: 'rellena', label: 'rellena' },
  { id: 'grande', label: 'grande' }
];

export const ETHNICITY_OPTIONS = [
  { id: 'latina', label: 'Latina' },
  { id: 'caucasica', label: 'caucasica' },
  { id: 'asiatica', label: 'asiatica' },
  { id: 'afrodescendiente', label: 'afrodescendiente' },
  { id: 'sudasiatica', label: 'sudasiatica' },
  { id: 'nordica', label: 'nordica' },
  { id: 'arabe', label: 'arabe' }
];

export const PERSONALITY_OPTIONS = [
  "Profesional y elegante",
  "Alegre y Juvenil",
  "Serio y misterioso",
  "Atrevido y rebelde",
  "Reservado y Minimalista",
  "Coqueta y Atrevida",
  "Influencer y Fresa"
];

export const EXPRESSION_OPTIONS = [
  "Alegre",
  "Seria",
  "Atrevida",
  "Coqueta",
  "Misteriosa",
  "Desafiante",
  "Natural"
];

export const HAIR_COLORS = ["castaño claro", "castaño oscuro", "negro", "rubio", "colorin", "cenizo"];
export const HAIR_LENGTHS = ["rapado", "corto", "melena", "hasta los hombros", "bajos los hombros", "hasta la cintura"];
export const HAIR_TYPES = ["liso perfecto", "ondulado", "rizado", "afro"];
export const EYE_COLORS = ["marron", "miel", "verdes", "gricaseos", "celeste", "azules"];

export const OUTFITS_MUJER = [
  "bikini elegante",
  "top corto y minifalda",
  "dress to impress",
  "vestido de fiesta ajustado",
  "leggins y top deportivo",
  "conjunto de gimnasio corto",
  "traje de baño de una pieza",
  "camiseta y jeans",
  "vestido elegante",
  "traje de 2 piezas"
];

export const OUTFITS_HOMBRE = [
  "camiseta y jeans",
  "chaqueta de cuero y jeans",
  "camiseta sin mangas y short",
  "traje de baño",
  "ropa oversize",
  "streetwear"
];