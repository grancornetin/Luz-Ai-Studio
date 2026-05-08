/**
 * photodumpDirectorService.ts
 * Director visual para Photodump Mode.
 * Analiza referencias visuales y genera un Story Arc estructurado en 3 actos.
 */
import { geminiService } from '../../services/geminiService';
import {
  PhotodumpNarrative, PhotodumpProtagonist, PhotodumpDestino,
  PhotodumpScene, NARRATIVE_META,
} from './types';

// ── Tipos internos ────────────────────────────────────────────

export type StoryBeat = 'hook' | 'development' | 'closing';

export interface DirectorScene extends PhotodumpScene {
  beat: StoryBeat;
  arcPosition: number; // 1-based
  aspectRatio: string; // "4/5" | "9/16"
}

export interface VisualStyleAnalysis {
  palette:     string;   // e.g. "warm neutrals, terracotta, cream"
  lighting:    string;   // e.g. "soft golden hour, diffused natural"
  mood:        string;   // e.g. "cozy, intimate, aspirational"
  composition: string;   // e.g. "centered subjects, negative space"
  rawSummary:  string;   // full Gemini summary for prompt injection
}

export interface PhotodumpDirectorPlan {
  storyTitle:    string;
  styleAnalysis: VisualStyleAnalysis | null;
  scenes:        DirectorScene[];
}

// ── Helpers ───────────────────────────────────────────────────

function getAspectRatioInstruction(destino: PhotodumpDestino): string {
  if (destino === 'feed')    return 'Compose for 4:5 portrait format (Instagram feed). Subject fills 70-80% of frame.';
  if (destino === 'stories') return 'Compose for 9:16 full vertical format (Stories/TikTok). Subject centered, breathing room top and bottom.';
  if (destino === 'tiktok')  return 'Compose for 9:16 full vertical format (TikTok cover). Bold framing, strong visual impact.';
  return 'Compose for portrait format.';
}

function getBeatDistribution(count: number): StoryBeat[] {
  // Hook: 1 image always
  // Closing: 1 image always
  // Development: everything in between
  if (count <= 2) return ['hook', 'closing'];
  if (count === 3) return ['hook', 'development', 'closing'];
  const beats: StoryBeat[] = ['hook'];
  for (let i = 1; i < count - 1; i++) beats.push('development');
  beats.push('closing');
  return beats;
}

// ── Análisis de referencias visuales ─────────────────────────

export async function analyzeVisualReferences(
  references: string[], // base64 images
): Promise<VisualStyleAnalysis | null> {
  if (!references || references.length === 0) return null;

  const prompt = `You are a visual director analyzing reference images for a social media content shoot.

Analyze the provided reference image(s) and extract the visual style:

1. COLOR PALETTE — dominant colors and tones (e.g. "warm neutrals, terracotta, sage green")
2. LIGHTING — quality and direction (e.g. "soft golden hour, diffused window light, harsh studio")
3. MOOD — emotional tone (e.g. "cozy and intimate", "aspirational lifestyle", "raw and authentic")
4. COMPOSITION — framing patterns (e.g. "centered subjects, lots of negative space", "rule of thirds, layered depth")

Output ONLY a valid JSON object, no markdown:
{"palette":"...","lighting":"...","mood":"...","composition":"...","rawSummary":"One sentence combining all elements for use in an image generation prompt"}`;

  try {
    const raw = await geminiService.analyzeImageWithText(references[0], prompt);
    const cleaned = raw.replace(/```json|```/g, '').trim();
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      if (parsed.palette && parsed.lighting && parsed.mood) {
        return parsed as VisualStyleAnalysis;
      }
    }
  } catch (err) {
    console.warn('[photodumpDirector] analyzeVisualReferences failed:', err);
  }

  return null;
}

// ── Director principal ────────────────────────────────────────

export async function buildPhotodumpDirectorPlan(
  basePrompt:    string,
  narrative:     PhotodumpNarrative,
  protagonist:   PhotodumpProtagonist,
  destino:       PhotodumpDestino,
  customStory:   string,
  count:         number,
  styleAnalysis: VisualStyleAnalysis | null,
): Promise<PhotodumpDirectorPlan> {

  const storyContext = narrative === 'custom' ? customStory : NARRATIVE_META[narrative].label;
  const beats = getBeatDistribution(count);
  const aspectInstruction = getAspectRatioInstruction(destino);

  const protagonistInstruction =
    protagonist === 'person'  ? 'PROTAGONIST: A person/creator. Focus on their emotions, expressions, and genuine moments.' :
    protagonist === 'product' ? 'PROTAGONIST: The product/object. Make it the visual star — textures, details, context of use.' :
                                'PROTAGONIST: Both person and product. Show their relationship, the human using or enjoying it.';

  const styleInstruction = styleAnalysis
    ? `REFERENCE STYLE TO MATCH: ${styleAnalysis.rawSummary}. Palette: ${styleAnalysis.palette}. Lighting: ${styleAnalysis.lighting}. Mood: ${styleAnalysis.mood}. Composition: ${styleAnalysis.composition}.`
    : 'STYLE: Authentic photorealistic UGC — organic, candid, not overly polished. Real-life feel.';

  const beatDescriptions = beats.map((beat, i) => {
    if (beat === 'hook')        return `Image ${i + 1} [HOOK]: The scroll-stopper. Visually striking opening that makes someone stop and look.`;
    if (beat === 'closing')     return `Image ${i + 1} [CLOSING]: The memorable ending that generates saves, shares, or visits to the profile.`;
    return `Image ${i + 1} [DEVELOPMENT]: Story progression — a different angle, texture, emotion, or moment that deepens the narrative.`;
  }).join('\n');

  const prompt = `You are a visual director and social media storyteller creating a ${count}-image photodump.

SUBJECT / CONTEXT: "${basePrompt}"
NARRATIVE ARC: ${storyContext}
${protagonistInstruction}
${styleInstruction}
FORMAT: ${aspectInstruction}

STORY STRUCTURE (3-act arc):
${beatDescriptions}

For each image, provide:
1. "moment": story beat name (3-5 words, Spanish or mixed)
2. "scenePrompt": precise visual direction in English (2-3 sentences). Include: environment, lighting quality, camera angle, specific action or element. Do NOT repeat the subject description.
3. "caption": engaging caption in Spanish (max 150 chars, conversational tone, 1-2 emojis, authentic voice — not branded)
4. "hashtags": 5-7 hashtags mix Spanish/English as single string
5. "beat": one of "hook", "development", or "closing"

Rules:
- Each image must feel like a REAL photo from a real person, not an ad
- Vary camera angles: wide establishing, medium candid, close-up detail, overhead, POV
- Vary lighting across scenes (unless reference style dictates otherwise)
- Captions must sound like a real person wrote them, not a brand
- The set should feel like a cohesive story when swiped through

Output ONLY a valid JSON array, no markdown:
[{"moment":"...","scenePrompt":"...","caption":"...","hashtags":"...","beat":"..."}]`;

  try {
    const raw = await geminiService.generateText(prompt);
    const cleaned = raw.replace(/```json|```/g, '').trim();
    const match = cleaned.match(/\[[\s\S]*\]/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const scenes: DirectorScene[] = parsed.slice(0, count).map((s: any, i: number) => ({
          moment:      s.moment      ?? `Momento ${i + 1}`,
          scenePrompt: s.scenePrompt ?? '',
          caption:     s.caption     ?? '',
          hashtags:    s.hashtags    ?? '',
          beat:        (s.beat as StoryBeat) ?? beats[i] ?? 'development',
          arcPosition: i + 1,
          aspectRatio: destino === 'feed' ? '4/5' : '9/16',
        }));

        // Best-effort title from Gemini
        const storyTitle = `${NARRATIVE_META[narrative].label} · ${basePrompt.slice(0, 40)}`;

        return { storyTitle, styleAnalysis, scenes };
      }
    }
  } catch (err) {
    console.warn('[photodumpDirector] buildDirectorPlan failed:', err);
  }

  // ── Fallback ─────────────────────────────────────────────────
  return buildFallbackPlan(basePrompt, narrative, destino, count, beats, styleAnalysis);
}

function buildFallbackPlan(
  basePrompt:    string,
  narrative:     PhotodumpNarrative,
  destino:       PhotodumpDestino,
  count:         number,
  beats:         StoryBeat[],
  styleAnalysis: VisualStyleAnalysis | null,
): PhotodumpDirectorPlan {
  const fallbackScenes: Omit<DirectorScene, 'arcPosition' | 'aspectRatio'>[] = [
    { moment: 'La apertura',     scenePrompt: 'wide establishing shot, soft morning golden hour light, warm and inviting atmosphere, slight lens flare', caption: 'Así empieza todo ☀️',          hashtags: '#lifestyle #morning #aesthetic #organic #moments',     beat: 'hook'        },
    { moment: 'El detalle',      scenePrompt: 'extreme close-up macro shot, shallow depth of field, soft diffused natural light, texture focus',         caption: 'Los detalles lo dicen todo ✨', hashtags: '#detail #texture #photography #authentic #ugc',          beat: 'development' },
    { moment: 'El momento real', scenePrompt: 'candid medium shot, street level angle, natural ambient light, genuine unposed feeling',                  caption: 'Momentos así, todos los días 💫', hashtags: '#candid #reallife #moments #lifestyle #content',        beat: 'development' },
    { moment: 'La textura',      scenePrompt: 'close-up texture and material study, overhead angle, clean natural light, editorial composition',          caption: 'La calidad se siente 🖤',       hashtags: '#quality #texture #editorial #aesthetic #premium',       beat: 'development' },
    { moment: 'El ambiente',     scenePrompt: 'medium wide lifestyle shot, subject in natural environment, available light, depth and context',           caption: 'En mi elemento 🌿',             hashtags: '#lifestyle #vibes #aesthetic #authentic #daily',         beat: 'development' },
    { moment: 'El cierre',       scenePrompt: 'atmospheric wide shot, dusk or golden hour, cinematic mood, emotional breathing room, memorable framing',  caption: 'Hasta la próxima 🌅',           hashtags: '#sunset #vibes #lifestyle #moments #organic',            beat: 'closing'     },
  ];

  const ar = destino === 'feed' ? '4/5' : '9/16';
  const scenes: DirectorScene[] = fallbackScenes.slice(0, count).map((s, i) => ({
    ...s,
    beat:        beats[i] ?? s.beat,
    arcPosition: i + 1,
    aspectRatio: ar,
  }));

  return {
    storyTitle:    `${NARRATIVE_META[narrative].label} · ${basePrompt.slice(0, 40)}`,
    styleAnalysis,
    scenes,
  };
}

// ── Helpers de construcción de prompt final ───────────────────

export function buildFinalPrompt(
  basePrompt:    string,
  scene:         DirectorScene,
  styleAnalysis: VisualStyleAnalysis | null,
  destino:       PhotodumpDestino,
): string {
  const styleHint = styleAnalysis
    ? `${styleAnalysis.lighting} light, ${styleAnalysis.palette} palette, ${styleAnalysis.mood} mood`
    : 'photorealistic, authentic UGC style, organic feel';

  const formatHint = destino === 'feed'
    ? 'portrait 4:5 composition'
    : 'vertical 9:16 full-frame composition';

  return [
    basePrompt,
    scene.scenePrompt,
    styleHint,
    formatHint,
    'photorealistic, high quality, no text overlays',
  ].filter(Boolean).join(', ');
}
