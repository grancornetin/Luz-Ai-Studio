/**
 * photodumpDirectorService.ts
 * Director visual para Photodump Mode.
 * Analiza referencias estructuradas del protagonista y genera un Story Arc en 3 actos
 * donde la identidad visual (cara, producto, outfit, escena) es CONSISTENTE en toda la historia.
 */
import { geminiService } from '../../services/geminiService';
import {
  PhotodumpNarrative, PhotodumpProtagonist, PhotodumpDestino,
  PhotodumpScene, PhotodumpRefs, NARRATIVE_META,
} from './types';

// ── Tipos internos ────────────────────────────────────────────

export type StoryBeat = 'hook' | 'development' | 'closing';

export interface DirectorScene extends PhotodumpScene {
  beat:        StoryBeat;
  arcPosition: number;
  aspectRatio: string;
}

export interface ProtagonistAnalysis {
  avatarDescription:  string | null;  // "woman, long dark hair, light skin, approx 28yo"
  productDescription: string | null;  // "small amber glass bottle with black dropper cap"
  outfitDescription:  string | null;  // "oversized cream linen shirt, wide-leg beige trousers"
  sceneDescription:   string | null;  // "modern minimal apartment, white walls, plants, golden light"
  identityLock:       string;         // full lock string injected into every scene prompt
}

export interface PhotodumpDirectorPlan {
  storyTitle:           string;
  protagonistAnalysis:  ProtagonistAnalysis;
  scenes:               DirectorScene[];
}

// ── Helpers ───────────────────────────────────────────────────

function getAspectRatioInstruction(destino: PhotodumpDestino): string {
  if (destino === 'feed')    return 'Compose for 4:5 portrait format (Instagram feed). Subject fills 70-80% of frame.';
  if (destino === 'stories') return 'Compose for 9:16 full vertical format (Stories/TikTok). Subject centered with breathing room.';
  if (destino === 'tiktok')  return 'Compose for 9:16 full vertical format (TikTok cover). Bold framing, strong visual impact.';
  return 'Compose for portrait format.';
}

function getBeatDistribution(count: number): StoryBeat[] {
  if (count <= 2) return ['hook', 'closing'];
  if (count === 3) return ['hook', 'development', 'closing'];
  const beats: StoryBeat[] = ['hook'];
  for (let i = 1; i < count - 1; i++) beats.push('development');
  beats.push('closing');
  return beats;
}

function buildIdentityLock(analysis: ProtagonistAnalysis): string {
  const parts: string[] = [];
  if (analysis.avatarDescription)  parts.push(`🔒 PERSON IDENTITY LOCK: same person in every frame — ${analysis.avatarDescription}. Do NOT change face, hair, skin tone, or body type between images.`);
  if (analysis.productDescription) parts.push(`🔒 PRODUCT LOCK: same product in every frame — ${analysis.productDescription}. Do NOT change product shape, color, or packaging.`);
  if (analysis.outfitDescription)  parts.push(`🔒 OUTFIT LOCK: same outfit in every frame — ${analysis.outfitDescription}. Do NOT change clothing items, color, or fit.`);
  if (analysis.sceneDescription)   parts.push(`🔒 SCENE ANCHOR: same environment or consistent ambient — ${analysis.sceneDescription}. Maintain lighting temperature and spatial feel.`);
  return parts.join('\n');
}

// ── Análisis del protagonista ─────────────────────────────────

export async function analyzeProtagonist(
  refs:       PhotodumpRefs,
  basePrompt: string,
): Promise<ProtagonistAnalysis> {

  const hasAnyRef = refs.avatarRef || refs.productRef || refs.outfitRef || refs.sceneRef;

  if (!hasAnyRef) {
    // Sin referencias visuales — extraer del texto del brief
    const textPrompt = `From this description, extract concise visual descriptors for each element present.
Description: "${basePrompt}"

Output ONLY a valid JSON object:
{
  "avatarDescription": "brief visual description of the person if mentioned, or null",
  "productDescription": "brief visual description of the product if mentioned, or null",
  "outfitDescription": "brief visual description of the outfit if mentioned, or null",
  "sceneDescription": "brief visual description of the location/environment if mentioned, or null"
}`;
    try {
      const raw = await geminiService.generateText(textPrompt);
      const match = raw.replace(/```json|```/g, '').trim().match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        const analysis: ProtagonistAnalysis = {
          avatarDescription:  parsed.avatarDescription  || null,
          productDescription: parsed.productDescription || null,
          outfitDescription:  parsed.outfitDescription  || null,
          sceneDescription:   parsed.sceneDescription   || (refs.sceneText || null),
          identityLock:       '',
        };
        analysis.identityLock = buildIdentityLock(analysis);
        return analysis;
      }
    } catch (err) {
      console.warn('[photodumpDirector] text analysis failed:', err);
    }
    return { avatarDescription: null, productDescription: null, outfitDescription: null, sceneDescription: refs.sceneText || null, identityLock: '' };
  }

  // Con referencias visuales — analizar cada imagen disponible
  const analyzePrompt = `You are a visual director analyzing reference images for a photo story.
Extract precise, concise visual descriptors to be used as identity locks across all images.
Be specific but brief — these will be injected into image generation prompts.

Analyze the provided image and output ONLY a valid JSON object with the descriptor for the type of reference it represents:
{
  "description": "concise visual description (max 25 words): physical traits, colors, textures, shapes — whatever makes this element uniquely identifiable"
}`;

  const analysis: ProtagonistAnalysis = {
    avatarDescription:  null,
    productDescription: null,
    outfitDescription:  null,
    sceneDescription:   refs.sceneText || null,
    identityLock:       '',
  };

  const analyses: Promise<void>[] = [];

  if (refs.avatarRef) {
    analyses.push(
      geminiService.analyzeImageWithText(refs.avatarRef, analyzePrompt + '\nThis is a PERSON/AVATAR reference.')
        .then(raw => {
          const match = raw.replace(/```json|```/g, '').trim().match(/\{[\s\S]*\}/);
          if (match) analysis.avatarDescription = JSON.parse(match[0]).description || null;
        }).catch(() => {})
    );
  }

  if (refs.productRef) {
    analyses.push(
      geminiService.analyzeImageWithText(refs.productRef, analyzePrompt + '\nThis is a PRODUCT reference.')
        .then(raw => {
          const match = raw.replace(/```json|```/g, '').trim().match(/\{[\s\S]*\}/);
          if (match) analysis.productDescription = JSON.parse(match[0]).description || null;
        }).catch(() => {})
    );
  }

  if (refs.outfitRef) {
    analyses.push(
      geminiService.analyzeImageWithText(refs.outfitRef, analyzePrompt + '\nThis is an OUTFIT/CLOTHING reference.')
        .then(raw => {
          const match = raw.replace(/```json|```/g, '').trim().match(/\{[\s\S]*\}/);
          if (match) analysis.outfitDescription = JSON.parse(match[0]).description || null;
        }).catch(() => {})
    );
  }

  if (refs.sceneRef) {
    analyses.push(
      geminiService.analyzeImageWithText(refs.sceneRef, analyzePrompt + '\nThis is a SCENE/ENVIRONMENT reference.')
        .then(raw => {
          const match = raw.replace(/```json|```/g, '').trim().match(/\{[\s\S]*\}/);
          if (match) analysis.sceneDescription = JSON.parse(match[0]).description || null;
        }).catch(() => {})
    );
  }

  await Promise.allSettled(analyses);
  analysis.identityLock = buildIdentityLock(analysis);
  return analysis;
}

// ── Director principal ────────────────────────────────────────

export async function buildPhotodumpDirectorPlan(
  basePrompt:  string,
  narrative:   PhotodumpNarrative,
  protagonist: PhotodumpProtagonist,
  destino:     PhotodumpDestino,
  customStory: string,
  count:       number,
  refs:        PhotodumpRefs,
): Promise<PhotodumpDirectorPlan> {

  // 1. Analizar el protagonista para generar los locks de identidad
  const protagonistAnalysis = await analyzeProtagonist(refs, basePrompt);

  const storyContext = narrative === 'custom' ? customStory : NARRATIVE_META[narrative].label;
  const beats        = getBeatDistribution(count);
  const aspectInstr  = getAspectRatioInstruction(destino);

  const protagonistInstr =
    protagonist === 'person'  ? 'The person/creator is the protagonist. Emotions, expressions, and genuine moments are the core.' :
    protagonist === 'product' ? 'The product/object is the hero. Show it from different angles, contexts, textures, and uses.' :
                                'Both the person and the product share the story. Show their relationship, interaction, and moments together.';

  const beatDescriptions = beats.map((beat, i) => {
    if (beat === 'hook')    return `Image ${i + 1} [HOOK]: The scroll-stopper. Visually striking opening — the most compelling frame of the set.`;
    if (beat === 'closing') return `Image ${i + 1} [CLOSING]: The memorable ending — a frame that makes the viewer save, share, or visit the profile.`;
    return `Image ${i + 1} [DEVELOPMENT]: Story progression — a different angle, texture, emotion, or moment that deepens the narrative. Still the same protagonist.`;
  }).join('\n');

  const prompt = `You are a visual director creating a ${count}-image photo story (photodump/carousel) for Instagram/TikTok.

SUBJECT / BASE CONTEXT: "${basePrompt}"
NARRATIVE ARC: ${storyContext}
PROTAGONIST DIRECTION: ${protagonistInstr}
FORMAT: ${aspectInstr}

IDENTITY LOCKS — These must be respected in EVERY single image:
${protagonistAnalysis.identityLock || '(No visual references provided — infer identity from context and maintain consistency)'}

STORY STRUCTURE:
${beatDescriptions}

For each image provide:
1. "moment": story beat name in Spanish (3-5 words)
2. "scenePrompt": visual direction in English (2-3 sentences). Describe: environment, lighting, camera angle, specific action. DO NOT describe the protagonist's identity — that is already locked. DO NOT say "same person" or repeat the locks.
3. "caption": engaging caption in Spanish (max 150 chars, conversational, authentic voice, 1-2 emojis — sounds like a real person, NOT a brand)
4. "hashtags": 5-7 hashtags mix Spanish/English as single string
5. "beat": "hook" | "development" | "closing"

Rules:
- Every scene must feel like it belongs to the SAME STORY — same world, same day, same character arc
- Vary camera angles across scenes: wide, medium, close-up, overhead, candid POV
- Vary lighting quality across scenes while keeping the overall mood coherent
- Captions should sound like someone talking to a friend, not writing an ad

Output ONLY a valid JSON array, no markdown:
[{"moment":"...","scenePrompt":"...","caption":"...","hashtags":"...","beat":"..."}]`;

  try {
    const raw     = await geminiService.generateText(prompt);
    const cleaned = raw.replace(/```json|```/g, '').trim();
    const match   = cleaned.match(/\[[\s\S]*\]/);
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
        return {
          storyTitle:          `${NARRATIVE_META[narrative].label} · ${basePrompt.slice(0, 40)}`,
          protagonistAnalysis,
          scenes,
        };
      }
    }
  } catch (err) {
    console.warn('[photodumpDirector] buildDirectorPlan failed:', err);
  }

  return buildFallbackPlan(narrative, destino, count, beats, protagonistAnalysis, basePrompt);
}

function buildFallbackPlan(
  narrative:           PhotodumpNarrative,
  destino:             PhotodumpDestino,
  count:               number,
  beats:               StoryBeat[],
  protagonistAnalysis: ProtagonistAnalysis,
  basePrompt:          string,
): PhotodumpDirectorPlan {
  const ar = destino === 'feed' ? '4/5' : '9/16';
  const fallback: Omit<DirectorScene, 'arcPosition' | 'aspectRatio'>[] = [
    { moment: 'La apertura',     scenePrompt: 'wide establishing shot, soft morning golden hour light, warm atmosphere, slight lens flare',   caption: 'Así empieza todo ☀️',           hashtags: '#lifestyle #morning #aesthetic #organic #moments',      beat: 'hook'        },
    { moment: 'El detalle',      scenePrompt: 'extreme close-up macro shot, shallow depth of field, soft diffused natural light, texture',    caption: 'Los detalles lo dicen todo ✨',  hashtags: '#detail #texture #photography #authentic #ugc',           beat: 'development' },
    { moment: 'El momento real', scenePrompt: 'candid medium shot, street level angle, natural ambient light, genuine unposed feeling',       caption: 'Momentos así, todos los días 💫',hashtags: '#candid #reallife #moments #lifestyle #content',          beat: 'development' },
    { moment: 'La textura',      scenePrompt: 'close-up texture and material study, overhead angle, clean natural light, editorial',          caption: 'La calidad se siente 🖤',        hashtags: '#quality #texture #editorial #aesthetic #premium',         beat: 'development' },
    { moment: 'El ambiente',     scenePrompt: 'medium wide lifestyle shot, subject in natural environment, available light, depth and context',caption: 'En mi elemento 🌿',              hashtags: '#lifestyle #vibes #aesthetic #authentic #daily',           beat: 'development' },
    { moment: 'El cierre',       scenePrompt: 'atmospheric wide shot, dusk or golden hour, cinematic mood, emotional breathing room',         caption: 'Hasta la próxima 🌅',            hashtags: '#sunset #vibes #lifestyle #moments #organic',             beat: 'closing'     },
  ];
  return {
    storyTitle:          `${NARRATIVE_META[narrative].label} · ${basePrompt.slice(0, 40)}`,
    protagonistAnalysis,
    scenes: fallback.slice(0, count).map((s, i) => ({
      ...s, beat: beats[i] ?? s.beat, arcPosition: i + 1, aspectRatio: ar,
    })),
  };
}

// ── Construcción del prompt final ─────────────────────────────

export function buildFinalPrompt(
  basePrompt:          string,
  scene:               DirectorScene,
  protagonistAnalysis: ProtagonistAnalysis,
  refs:                PhotodumpRefs,
  destino:             PhotodumpDestino,
): string {
  const formatHint = destino === 'feed' ? 'portrait 4:5 composition' : 'vertical 9:16 full-frame composition';

  // Locks de identidad compactos para el prompt de imagen
  const lockParts: string[] = [];
  if (protagonistAnalysis.avatarDescription)  lockParts.push(protagonistAnalysis.avatarDescription);
  if (protagonistAnalysis.productDescription) lockParts.push(protagonistAnalysis.productDescription);
  if (protagonistAnalysis.outfitDescription)  lockParts.push(protagonistAnalysis.outfitDescription);
  if (protagonistAnalysis.sceneDescription)   lockParts.push(`in ${protagonistAnalysis.sceneDescription}`);
  const identityContext = lockParts.join(', ');

  return [
    identityContext || basePrompt,
    scene.scenePrompt,
    'photorealistic, authentic UGC style, organic feel, no text overlays',
    formatHint,
  ].filter(Boolean).join(', ');
}

// ── Helpers para la UI ────────────────────────────────────────

export function getRefsAsArray(refs: PhotodumpRefs): string[] {
  return [refs.avatarRef, refs.productRef, refs.outfitRef, refs.sceneRef].filter(Boolean) as string[];
}
