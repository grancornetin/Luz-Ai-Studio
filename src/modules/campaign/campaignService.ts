import { geminiService } from '../../services/geminiService';
import {
  CampaignType, CampaignObjective, CampaignAudience,
  CampaignScene, CAMPAIGN_TYPE_META, CAMPAIGN_OBJECTIVE_META, CAMPAIGN_AUDIENCE_META,
} from './types';

export async function buildCampaignScenes(
  basePrompt:         string,
  productDescription: string,
  campaignType:       CampaignType,
  objective:          CampaignObjective,
  audience:           CampaignAudience,
  imageCount:         number,
): Promise<CampaignScene[]> {
  const typeLabel      = CAMPAIGN_TYPE_META[campaignType].label;
  const objectiveLabel = CAMPAIGN_OBJECTIVE_META[objective];
  const audienceLabel  = CAMPAIGN_AUDIENCE_META[audience];

  const prompt = `You are a professional creative director and marketing strategist for Latin American brands.

A brand needs ${imageCount} campaign images. Generate a structured shot list.

BRIEF:
- Base subject/prompt: "${basePrompt}"
- Product/service: "${productDescription || 'not specified'}"
- Campaign type: ${typeLabel}
- Objective: ${objectiveLabel}
- Target audience: ${audienceLabel}

Generate exactly ${imageCount} scene entries. Each must have:
1. sceneName: short name (3-5 words, e.g. "Hero Product Shot")
2. scenePrompt: visual direction in English (1-2 sentences) describing environment, mood, lighting, camera angle. Do NOT repeat the subject — only the scene context.
3. caption: short social media caption in Spanish (max 120 chars, include 3-4 hashtags)
4. adCopy: punchy ad headline in Spanish (max 60 chars, action-oriented)

Scene logic by type:
- product: hero shot → detail shot → lifestyle context → CTA moment
- brand: aspirational wide → emotional close-up → brand lifestyle → community moment
- social: opening hook → value shots → closing CTA (carousel-optimized)
- ecommerce: clean product angles → texture detail → in-use context → packaging

Adapt tone to audience (${audienceLabel}).
Scenes must be progressive and coherent like a real campaign.

Output ONLY a valid JSON array, no markdown:
[{"sceneName":"...","scenePrompt":"...","caption":"...","adCopy":"..."}]`;

  try {
    const raw     = await geminiService.generateText(prompt);
    const cleaned = raw.replace(/```json|```/g, '').trim();
    const match   = cleaned.match(/\[[\s\S]*\]/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.slice(0, imageCount);
      }
    }
  } catch (err) {
    console.warn('[campaignService] Gemini scene generation failed:', err);
  }

  // Fallback genérico
  const fallback = [
    { sceneName: 'Hero Shot',  scenePrompt: 'wide establishing shot, golden hour, cinematic mood', caption: 'Descúbrelo hoy. #marca #producto #diseño', adCopy: 'Conoce la nueva colección' },
    { sceneName: 'Detalle',    scenePrompt: 'close-up detail, studio lighting, clean background',  caption: 'Los detalles importan. #calidad #premium',  adCopy: 'Calidad que se siente' },
    { sceneName: 'Lifestyle',  scenePrompt: 'lifestyle context, natural light, candid feel',       caption: 'Tu estilo, tu identidad. #lifestyle #moda',  adCopy: 'Viví tu estilo' },
    { sceneName: 'En Uso',     scenePrompt: 'product in use, warm ambient, organic setting',       caption: 'Hecho para tu día a día. #vida #real',       adCopy: 'Diseñado para ti' },
    { sceneName: 'Editorial',  scenePrompt: 'overhead flat lay, bright neutral, editorial style',  caption: 'Todo en orden. #editorial #clean',           adCopy: 'El detalle perfecto' },
  ];
  return fallback.slice(0, imageCount);
}
