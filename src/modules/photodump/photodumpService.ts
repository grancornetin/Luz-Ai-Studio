import { geminiService } from '../../services/geminiService';
import { PhotodumpNarrative, PhotodumpProtagonist, PhotodumpScene, NARRATIVE_META } from './types';

export async function buildPhotodumpScenes(
  basePrompt:  string,
  narrative:   PhotodumpNarrative,
  protagonist: PhotodumpProtagonist,
  customStory: string,
  count:       number,
): Promise<PhotodumpScene[]> {
  const storyContext = narrative === 'custom' ? customStory : NARRATIVE_META[narrative].label;

  const protagonistInstruction =
    protagonist === 'person'  ? 'The protagonist is a person. Focus on them, their emotions, and their environment.' :
    protagonist === 'product' ? 'The protagonist is the product/object. Make it the visual star. Show it in different contexts, angles, and uses.' :
                                'Both the person and the product are protagonists. Show their relationship and interaction.';

  const prompt = `You are a visual storyteller and creative director for social media content.

Create ${count} image prompts that tell a coherent visual story as a photodump/carousel set.

NARRATIVE CONTEXT: ${storyContext}
BASE PROMPT / SUBJECT: "${basePrompt}"
PROTAGONIST: ${protagonistInstruction}

Arc structure for ${count} images:
- First image: establish the world / opening moment (hook)
- Middle images: development, different angles, emotional beats, textures, details
- Last image: resolution / memorable closing moment

Each entry must have:
1. "moment": short name for this story beat (3-5 words)
2. "scenePrompt": visual direction in English (1-2 sentences). Environment, lighting, camera. Do NOT repeat the subject.
3. "caption": short engaging caption in Spanish (max 140 chars, conversational, 1-2 emojis ok)
4. "hashtags": 4-6 hashtags Spanish/English as single string

Rules:
- Feel like a real authentic photodump, not a brand ad
- Vary camera angles: wide, medium, close-up, overhead, candid
- Vary lighting: golden hour, soft indoor, dramatic, natural
- Each moment distinct but connected to the same story

Output ONLY a valid JSON array, no markdown:
[{"moment":"...","scenePrompt":"...","caption":"...","hashtags":"..."}]`;

  try {
    const raw     = await geminiService.generateText(prompt);
    const cleaned = raw.replace(/```json|```/g, '').trim();
    const match   = cleaned.match(/\[[\s\S]*\]/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.slice(0, count);
      }
    }
  } catch (err) {
    console.warn('[photodumpService] Gemini failed:', err);
  }

  // Fallback
  const fallback: PhotodumpScene[] = [
    { moment: 'Apertura',   scenePrompt: 'wide establishing shot, soft morning light, golden hour, warm atmosphere', caption: 'Así empieza todo... ☀️',   hashtags: '#lifestyle #morning #aesthetic' },
    { moment: 'El detalle', scenePrompt: 'close-up detail shot, shallow depth of field, soft natural light',         caption: 'Los detalles importan ✨',   hashtags: '#detail #photography #organic' },
    { moment: 'El momento', scenePrompt: 'candid mid shot, street level, natural light, photorealistic UGC style',   caption: 'Momentos que quedan 💫',    hashtags: '#candid #reallife #moments' },
    { moment: 'La textura', scenePrompt: 'macro texture detail, studio lighting, clean composition, editorial feel', caption: 'Calidad que se siente 🖤',   hashtags: '#texture #quality #editorial' },
    { moment: 'El cierre',  scenePrompt: 'wide atmospheric shot, dusk lighting, cinematic mood, emotional distance', caption: 'Hasta la próxima 🌅',       hashtags: '#sunset #vibes #lifestyle' },
    { moment: 'Overhead',   scenePrompt: 'overhead flat lay, bright natural light, clean organized composition',     caption: 'Todo en orden 📐',           hashtags: '#flatlay #aesthetic #organized' },
  ];
  return fallback.slice(0, count);
}
