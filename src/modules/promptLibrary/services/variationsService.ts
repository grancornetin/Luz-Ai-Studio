import { geminiService } from '../../../services/geminiService';
import { PromptDNA } from '../types/promptTypes';

// ──────────────────────────────────────────
// variationsService
// Usa geminiService.generateText (patrón del proyecto).
// NO importa GoogleGenAI directamente.
// ──────────────────────────────────────────

export interface PromptVariation {
  id: string;
  promptText: string;
  dna: PromptDNA;
  changedLayer: string;
  changedLayerLabel: string;
  description: string;
}

export const MODIFIABLE_LAYERS = ['styles', 'lighting', 'background', 'composition', 'details'];

export const LAYER_LABELS: Record<string, string> = {
  styles:      'Estilo Visual',
  lighting:    'Iluminación',
  background:  'Fondo',
  composition: 'Composición',
  details:     'Detalles',
};

export const LAYER_COLORS: Record<string, string> = {
  styles:      'brand',
  lighting:    'amber',
  background:  'accent',
  composition: 'purple',
  details:     'sky',
};

export const variationsService = {

  async generate(
    promptText: string,
    dna: PromptDNA,
    lockedLayers: string[] = []
  ): Promise<PromptVariation[]> {

    const available = MODIFIABLE_LAYERS.filter(l => !lockedLayers.includes(l));

    if (available.length === 0) {
      throw new Error('Desbloquea al menos una capa para generar variaciones.');
    }

    const systemPrompt = `You are an expert AI image prompt engineer specializing in commercial and fashion photography.

Analyze this prompt and its DNA structure. Generate exactly 3 creative variations.
Each variation must modify a DIFFERENT DNA layer from this list: ${available.join(', ')}

ORIGINAL PROMPT:
"${promptText}"

ORIGINAL DNA:
${JSON.stringify(dna, null, 2)}

STRICT RULES:
1. NEVER change persons[], products[], or personLayers[] — identity must be preserved
2. Each variation changes exactly ONE layer from the available list
3. Changes must be visually significant and creative
4. Keep the full DNA structure intact, only modify the target layer
5. promptText must be a complete coherent prompt reflecting the change
6. Respond ONLY with a valid JSON array, no markdown, no backticks, no explanation

RESPONSE FORMAT:
[
  {
    "promptText": "complete modified prompt",
    "dna": { "persons": [], "products": [], "styles": [], "lighting": [], "background": [], "composition": [], "details": [] },
    "changedLayer": "exact layer key",
    "changedLayerLabel": "layer name in Spanish",
    "description": "brief description in Spanish of what changed, max 7 words"
  }
]`;

    const raw = await geminiService.generateText(systemPrompt);

    let parsed: any[] = [];

    try {
      const clean = (raw || '').replace(/```json|```/g, '').trim();
      parsed = JSON.parse(clean);
      if (!Array.isArray(parsed)) throw new Error('Not an array');
    } catch {
      throw new Error('La IA no pudo generar variaciones. Intenta de nuevo.');
    }

    return parsed.slice(0, 3).map((v: any, i: number) => ({
      id: `var_${Date.now()}_${i}`,
      promptText: typeof v.promptText === 'string' ? v.promptText : promptText,
      dna: v.dna && typeof v.dna === 'object' ? v.dna : dna,
      changedLayer: v.changedLayer || available[i % available.length],
      changedLayerLabel: v.changedLayerLabel || LAYER_LABELS[v.changedLayer] || 'Estilo',
      description: v.description || 'Variación generada'
    }));
  }

};
