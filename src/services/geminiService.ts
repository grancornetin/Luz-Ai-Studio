// services/geminiService.ts
// ═══════════════════════════════════════════════════════════════════
// REFACTORED: Calls Vercel API routes → Vertex AI (GCP billing)
// Ya NO usa @firebase/vertexai-preview ni ningún SDK de IA en el browser.
// Todas las llamadas a Gemini pasan por /api/gemini/*
// ═══════════════════════════════════════════════════════════════════

import {
  AVATAR_EXTRACTOR_SCHEMA,
  PRODUCT_ANALYZER_SCHEMA,
  OUTFIT_ANALYZER_SCHEMA,
} from "../constants";

// ── Config ──────────────────────────────────────────────────────
const API_BASE = '/api/gemini';
const CONTENT_ENDPOINT = `${API_BASE}/content`;
const IMAGE_ENDPOINT = `${API_BASE}/image`;

// ── Helpers ─────────────────────────────────────────────────────

function parseDataUrl(image: string) {
  const trimmed = (image || "").trim();
  const match = trimmed.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.*)$/);
  if (!match) return null;
  return { mimeType: match[1], base64: match[2] };
}

function isProbablyBase64(data: string) {
  if (!data) return false;
  const cleaned = data.replace(/\s+/g, "");
  const okChars = /^[A-Za-z0-9+/=]+$/.test(cleaned);
  return okChars && cleaned.length > 64;
}

function guessMimeFromBase64Header(base64: string) {
  const head = (base64 || "").slice(0, 30);
  if (head.startsWith("iVBORw0KGgo")) return "image/png";
  if (head.startsWith("/9j/")) return "image/jpeg";
  if (head.startsWith("UklGR")) return "image/webp";
  return "image/jpeg";
}

/**
 * Extrae base64 limpio y mimeType de cualquier formato de imagen.
 * Soporta data URLs y raw base64.
 */
function extractImageData(img: string, refLabel?: string): { data: string; mimeType: string } {
  const raw = (img || "").trim();

  if (!raw || raw === "null" || raw === "undefined") {
    throw new Error(`Referencia de imagen inválida (vacía)${refLabel ? `: ${refLabel}` : ""}.`);
  }

  // Data URL format
  const parsed = parseDataUrl(raw);
  if (parsed) {
    const base64 = (parsed.base64 || "").replace(/\s+/g, "");
    if (!isProbablyBase64(base64)) {
      throw new Error(`Referencia de imagen inválida (DataURL corrupto)${refLabel ? `: ${refLabel}` : ""}.`);
    }
    return { data: base64, mimeType: parsed.mimeType || "image/jpeg" };
  }

  // Raw base64 (puede tener prefix de comma)
  const maybeBase64 = raw.includes(",") ? raw.split(",")[1] : raw;
  const cleaned = (maybeBase64 || "").replace(/\s+/g, "");

  if (!isProbablyBase64(cleaned)) {
    throw new Error(`Referencia de imagen inválida (base64 corrupto)${refLabel ? `: ${refLabel}` : ""}.`);
  }

  return { data: cleaned, mimeType: guessMimeFromBase64Header(cleaned) };
}

function safeJsonParse(text: any) {
  try {
    return JSON.parse(typeof text === "string" ? text : "{}");
  } catch {
    return {};
  }
}

/**
 * Helper genérico para llamar al endpoint de content.
 */
async function callContentApi(payload: {
  action: string;
  images?: string[];
  mimeTypes?: string[];
  prompt: string;
  schema?: Record<string, unknown>;
  model?: string;
}): Promise<any> {
  const response = await fetch(CONTENT_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Network error' }));
    throw new Error(errorData.error || `API error: ${response.status}`);
  }

  const data = await response.json();

  if (!data.success) {
    throw new Error(data.error || 'API call failed');
  }

  return data;
}

/**
 * Helper genérico para llamar al endpoint de image.
 */
async function callImageApi(payload: {
  action: string;
  prompt: string;
  negative?: string;
  referenceImages?: Array<{ data: string; mimeType: string }>;
  model?: string;
  aspectRatio?: string;
}): Promise<string> {
  const response = await fetch(IMAGE_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Network error' }));
    throw new Error(errorData.error || `Image API error: ${response.status}`);
  }

  const data = await response.json();

  if (!data.success || !data.image) {
    throw new Error(data.error || 'Image generation failed');
  }

  return data.image;
}

// ═══════════════════════════════════════════════════════════════════
// SERVICIO PÚBLICO — Misma interfaz que el original
// ═══════════════════════════════════════════════════════════════════

export const geminiService = {

  async ensureAccess() {
    // No-op: la autenticación la maneja el servidor
  },

  async handleApiError(error: any): Promise<never> {
    console.error("Vertex AI Error:", error);
    throw error;
  },

  // ── Extracción de perfil de avatar ──────────────────────────────
  async extractAvatarProfile(images: string[]): Promise<any> {
    try {
      const extracted = images.map((img, idx) =>
        extractImageData(img, `extractAvatarProfile[${idx}]`)
      );

      const result = await callContentApi({
        action: 'extractAvatarProfile',
        images: extracted.map(e => e.data),
        mimeTypes: extracted.map(e => e.mimeType),
        prompt: "BIOMETRIC ANALYST: Extract exact facial features and identity profile. Output in strict JSON.",
        schema: AVATAR_EXTRACTOR_SCHEMA as any,
        model: 'gemini-1.5-pro',
      });

      return result.json || safeJsonParse(result.text);
    } catch (e) {
      return this.handleApiError(e);
    }
  },

  // ── Análisis de producto ────────────────────────────────────────
  async analyzeProduct(images: string[], userDescription?: string): Promise<any> {
    try {
      const extracted = images.map((img, idx) =>
        extractImageData(img, `analyzeProduct[${idx}]`)
      );

      const prompt = `PRODUCT ANALYST: Identify materials, textures and commercial dimensions. Output in JSON.${
        userDescription ? `\nUser description: ${userDescription}` : ""
      }`;

      const result = await callContentApi({
        action: 'analyzeProduct',
        images: extracted.map(e => e.data),
        mimeTypes: extracted.map(e => e.mimeType),
        prompt,
        schema: PRODUCT_ANALYZER_SCHEMA as any,
        model: 'gemini-1.5-pro',
      });

      return result.json || safeJsonParse(result.text);
    } catch (e) {
      return this.handleApiError(e);
    }
  },

  // ── Análisis de outfit ──────────────────────────────────────────
  async analyzeOutfit(image: string): Promise<any> {
    try {
      const extracted = extractImageData(image, "analyzeOutfit");

      const result = await callContentApi({
        action: 'analyzeOutfit',
        images: [extracted.data],
        mimeTypes: [extracted.mimeType],
        prompt: "FASHION ANALYST: Detect coordinates (X, Y) and describe each garment with precision. Output in JSON.",
        schema: OUTFIT_ANALYZER_SCHEMA as any,
        model: 'gemini-1.5-pro',
      });

      return result.json || safeJsonParse(result.text);
    } catch (e) {
      return this.handleApiError(e);
    }
  },

  // ── Generación de imagen (con referencias) ─────────────────────
  async generateImage(
    prompt: string,
    negative: string,
    usePro: boolean = true,
    size: string = "1K",
    referenceImages?: (string | null)[],
    aspectRatio: "1:1" | "3:4" | "4:3" | "9:16" | "16:9" = "3:4"
  ): Promise<string> {
    try {
      const refs: Array<{ data: string; mimeType: string }> = [];

      if (referenceImages && referenceImages.length > 0) {
        for (let i = 0; i < referenceImages.length; i++) {
          const img = referenceImages[i];
          if (img && img.trim().length > 0) {
            try {
              refs.push(extractImageData(img, `REF${i}`));
            } catch {
              // Skip invalid refs silently
            }
          }
        }
      }

      const instruction = `SYSTEM: Follow prompt exactly. REF slots are reference images.\nPROMPT: ${prompt}\nNEGATIVE: ${negative}`;

      return await callImageApi({
        action: 'generateImage',
        prompt: instruction,
        negative,
        referenceImages: refs.length > 0 ? refs : undefined,
        aspectRatio,
      });
    } catch (e) {
      return this.handleApiError(e);
    }
  },

  // ── Generación de imagen con modelo específico ─────────────────
  async generateImageWithModel(
    prompt: string,
    negative: string,
    modelName: string,
    size: string = "1K",
    referenceImages?: (string | null)[],
    aspectRatio: "1:1" | "3:4" | "4:3" | "9:16" | "16:9" = "3:4"
  ): Promise<string> {
    // Reutiliza generateImage — el modelo se maneja server-side
    return this.generateImage(prompt, negative, true, size, referenceImages, aspectRatio);
  },

  // ── Generación rápida (Imagen 3, solo texto) ──────────────────
  async generateImageFast(
    prompt: string,
    aspectRatio: "1:1" | "3:4" | "4:3" | "9:16" | "16:9" = "3:4"
  ): Promise<string> {
    try {
      return await callImageApi({
        action: 'generateImageFast',
        prompt,
        aspectRatio,
      });
    } catch (e) {
      return this.handleApiError(e);
    }
  },

  // ── Generación de texto (JSON mode) ────────────────────────────
  async generateText(prompt: string): Promise<string> {
    try {
      const result = await callContentApi({
        action: 'generateText',
        prompt,
        model: 'gemini-1.5-flash',
      });

      return result.text || '';
    } catch (e) {
      return this.handleApiError(e);
    }
  },
};