// src/services/ugcApiService.ts
// Cliente para llamar a /api/gemini/ugc desde el frontend

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
};