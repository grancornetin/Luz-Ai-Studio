// src/services/ugcApiService.ts
// Cliente para llamar a /api/gemini/ugc desde el frontend
// NO usa GoogleGenAI directamente — todo va al backend de Vercel

interface ReferenceImage {
  data: string;
  mimeType: string;
}

interface GenerateImage0Params {
  prompt: string;
  referenceImages?: ReferenceImage[];
  aspectRatio?: string;
}

interface GenerateDerivedShotParams {
  prompt: string;
  referenceImages?: ReferenceImage[];
  aspectRatio?: string;
}

interface AnalyzeProductRelevanceParams {
  productRef: { data: string; mimeType: string } | null;
  focus: string;
  outfitRef?: { data: string; mimeType: string } | null;
  sceneRef?: { data: string; mimeType: string } | null;
  sceneText?: string;
}

// Tipos para los análisis
export interface REF0Analysis {
  lighting: {
    primarySource: string;
    direction: string;
    colorTemperature: string;
    shadowType: string;
    intensity: string;
  };
  spatial: {
    elements: string[];
    walls: string;
    floor: string;
    geometry: string;
  };
  poseContext: {
    hasSeating: boolean;
    hasLeaningSurface: boolean;
    hasTable: boolean;
    availableActions: string[];
  };
}

export interface OutfitAnalysis {
  hasJacket: boolean;
  hasPants: boolean;
  hasShoes: boolean;
  hasAccessories: boolean;
  hasDetail: boolean;
  fabricType: string;
  colors: string[];
  hasTop: boolean;
  hasBottom: boolean;
  hasBelt: boolean;
  hasBag: boolean;
  hasHat: boolean;
  hasNecklace: boolean;
}

export interface SceneAnalysis {
  hasFurniture: boolean;
  hasNature: boolean;
  hasEquipment: boolean;
  hasTable: boolean;
  hasSeating: boolean;
  hasWindows: boolean;
  hasProps: boolean;
  sceneType: string;
}

async function callUgcApi(action: string, payload: any): Promise<any> {
  const response = await fetch('/api/gemini/ugc', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, payload }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
    throw new Error(errorData.error || 'UGC API error');
  }

  return response.json();
}

export const ugcApiService = {
  // ── Generación de imágenes ─────────────────────────────────────────
  async generateImage0(params: GenerateImage0Params): Promise<string> {
    const result = await callUgcApi('generateImage0', params);
    if (!result.success || !result.image) {
      throw new Error(result.error || 'No image generated');
    }
    return result.image;
  },

  async generateDerivedShot(params: GenerateDerivedShotParams): Promise<string> {
    const result = await callUgcApi('generateDerivedShot', params);
    if (!result.success || !result.image) {
      throw new Error(result.error || 'No image generated');
    }
    return result.image;
  },

  // ── Análisis de producto ──────────────────────────────────────────
  async analyzeProductRelevance(params: AnalyzeProductRelevanceParams): Promise<{
    isRelevant: boolean;
    suggestion: string;
    productType: string;
  }> {
    const result = await callUgcApi('analyzeProductRelevance', params);
    return {
      isRelevant: result.isRelevant ?? false,
      suggestion: result.suggestion ?? '',
      productType: result.productType ?? 'other',
    };
  },

  // ── Análisis de REF0 (luz, espacio, pose) ─────────────────────────
  async analyzeREF0(params: { imageData: string; mimeType: string }): Promise<REF0Analysis> {
    const result = await callUgcApi('analyzeREF0', params);
    return result;
  },

  // ── Análisis de outfit ────────────────────────────────────────────
  async analyzeOutfit(params: { imageData: string; mimeType: string }): Promise<OutfitAnalysis> {
    const result = await callUgcApi('analyzeOutfit', params);
    return result;
  },

  // ── Análisis de escena ────────────────────────────────────────────
  async analyzeScene(params: { imageData: string; mimeType: string }): Promise<SceneAnalysis> {
    const result = await callUgcApi('analyzeScene', params);
    return result;
  },
};