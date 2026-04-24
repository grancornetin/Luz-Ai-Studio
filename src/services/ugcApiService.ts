// src/services/ugcApiService.ts
// Servicio cliente para comunicarse con /api/gemini/ugc

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
  bottomType?: 'shorts' | 'pants' | 'skirt' | 'unknown';
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

export interface ProductRelevanceResult {
  isRelevant: boolean;
  suggestion: string;
  productType: string;
}

class UGCApiService {
  private baseUrl = '/api/gemini/ugc';

  // ──────────────────────────────────────────────────────────────
  // generateImageAsync - Generación asíncrona con polling
  // ──────────────────────────────────────────────────────────────
  async generateImageAsync(params: {
    prompt: string;
    referenceImages?: Array<{ data: string; mimeType: string }>;
    aspectRatio?: string;
    shotIndex?: number;
    totalShots?: number;
    modelId?: 'gemini' | 'seedream';
    onStatusChange?: (status: string, image?: string, shotIndex?: number) => void;
  }): Promise<string> {
    // Seedream no soporta reference images — usa el endpoint genérico
    const useSeedream = params.modelId === 'seedream';
    const endpoint    = useSeedream ? '/api/gemini/image' : this.baseUrl;

    // Iniciar generación asíncrona
    const startResponse = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'generateImageAsync',
        payload: {
          prompt: params.prompt,
          referenceImages: params.referenceImages,
          aspectRatio: params.aspectRatio || '3:4',
          shotIndex: params.shotIndex,
          totalShots: params.totalShots,
          modelId: params.modelId || 'gemini',
        },
      }),
    });

    if (!startResponse.ok) {
      const errorText = await startResponse.text();
      throw new Error(`Failed to start generation: ${startResponse.status} - ${errorText}`);
    }

    const { jobId, shotIndex } = await startResponse.json();
    console.log(`[UGC] Job started: ${jobId} for shot ${shotIndex}`);

    if (params.onStatusChange) {
      params.onStatusChange('pending', undefined, shotIndex);
    }

    // Polling cada 2 segundos (más rápido para mejor UX)
    const maxAttempts = 90; // 90 * 2s = 3 minutos máximo
    let attempts = 0;

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000));

      const statusResponse = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'getJobStatus',
          payload: { jobId },
        }),
      });

      if (!statusResponse.ok) {
        throw new Error(`Failed to get job status: ${statusResponse.status}`);
      }

      const job = await statusResponse.json();

      if (params.onStatusChange) {
        params.onStatusChange(job.status, job.image, shotIndex);
      }

      if (job.status === 'completed') {
        console.log(`[UGC] Job ${jobId} completed`);
        return job.image;
      }

      if (job.status === 'failed') {
        throw new Error(`Generation failed: ${job.error}`);
      }

      attempts++;
    }

    throw new Error(`Timeout: generation took more than ${maxAttempts * 2} seconds`);
  }

  // ──────────────────────────────────────────────────────────────
  // generateImage0 - Método legacy síncrono (usa async internamente)
  // ──────────────────────────────────────────────────────────────
  async generateImage0(params: {
    prompt: string;
    referenceImages?: Array<{ data: string; mimeType: string }>;
    aspectRatio?: string;
  }): Promise<string> {
    return this.generateImageAsync(params);
  }

  // ──────────────────────────────────────────────────────────────
  // generateImage0Fast - Versión rápida con modelo FAST (para retry)
  // ──────────────────────────────────────────────────────────────
  async generateImage0Fast(params: {
    prompt: string;
    referenceImages?: Array<{ data: string; mimeType: string }>;
    aspectRatio?: string;
  }): Promise<string> {
    // Usar el mismo método async pero con indicador de FAST
    const startResponse = await fetch(this.baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'generateImageAsync',
        payload: {
          prompt: params.prompt,
          referenceImages: params.referenceImages,
          aspectRatio: params.aspectRatio || '3:4',
          useFastModel: true, // Indicador para usar modelo rápido
        },
      }),
    });

    if (!startResponse.ok) {
      throw new Error(`Failed to start generation: ${startResponse.status}`);
    }

    const { jobId } = await startResponse.json();

    // Polling cada 2 segundos
    const maxAttempts = 60;
    let attempts = 0;

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000));

      const statusResponse = await fetch(this.baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'getJobStatus',
          payload: { jobId },
        }),
      });

      const job = await statusResponse.json();

      if (job.status === 'completed') {
        return job.image;
      }

      if (job.status === 'failed') {
        throw new Error(`Generation failed: ${job.error}`);
      }

      attempts++;
    }

    throw new Error('Timeout waiting for fast generation');
  }

  // ──────────────────────────────────────────────────────────────
  // analyzeREF0 - Análisis de luz/espacio/pose (síncrono, rápido)
  // ──────────────────────────────────────────────────────────────
  async analyzeREF0(params: {
    imageData: string;
    mimeType: string;
  }): Promise<REF0Analysis> {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'analyzeREF0',
        payload: params,
      }),
    });

    if (!response.ok) {
      throw new Error(`Analyze REF0 failed: ${response.status}`);
    }

    return response.json();
  }

  // ──────────────────────────────────────────────────────────────
  // analyzeProductRelevance - Analizar si producto es relevante
  // ──────────────────────────────────────────────────────────────
  async analyzeProductRelevance(params: {
    productRef: { data: string; mimeType: string };
    focus: string;
    outfitRef?: { data: string; mimeType: string } | null;
    sceneRef?: { data: string; mimeType: string } | null;
    sceneText?: string;
  }): Promise<ProductRelevanceResult> {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'analyzeProductRelevance',
        payload: params,
      }),
    });

    if (!response.ok) {
      throw new Error(`Analyze product relevance failed: ${response.status}`);
    }

    return response.json();
  }

  // ──────────────────────────────────────────────────────────────
  // analyzeOutfit - Analizar referencia de outfit
  // ──────────────────────────────────────────────────────────────
  async analyzeOutfit(params: {
    imageData: string;
    mimeType: string;
  }): Promise<OutfitAnalysis> {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'analyzeOutfit',
        payload: params,
      }),
    });

    if (!response.ok) {
      throw new Error(`Analyze outfit failed: ${response.status}`);
    }

    return response.json();
  }

  // ──────────────────────────────────────────────────────────────
  // analyzeScene - Analizar referencia de escena
  // ──────────────────────────────────────────────────────────────
  async analyzeScene(params: {
    imageData: string;
    mimeType: string;
  }): Promise<SceneAnalysis> {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'analyzeScene',
        payload: params,
      }),
    });

    if (!response.ok) {
      throw new Error(`Analyze scene failed: ${response.status}`);
    }

    return response.json();
  }
}

export const ugcApiService = new UGCApiService();