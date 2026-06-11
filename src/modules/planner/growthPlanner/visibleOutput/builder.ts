import type { GrowthProduct, GrowthStrategicPlan, GrowthTask } from '../../growthPlannerTypes';
import {
  BRAND_DISPLAY_NAME,
  PREMIUM_WEAK_PHRASE_PATTERN,
  RAW_VISIBLE_SLOT_PATTERN,
  polishPremiumVisibleCopy,
} from './copyPolish';
import type {
  VisibleOutputQualityResult,
  VisiblePlanFocus,
  VisiblePlannerOutput,
  VisiblePlannerTask,
  VisibleRoadmapItem,
  VisibleShotItem,
  VisibleTaskStep,
} from './types';

const MODULE_LABELS = {
  product: 'Foto de producto',
  ugc: 'UGC Studio',
  scene: 'Scene Clone',
  prompt: 'Prompt Studio',
  outfit: 'Outfit Extractor',
  none: 'No necesitas usar un módulo para esta tarea',
} as const;

const EFFORT_LABELS = { bajo: 'Esfuerzo bajo', medio: 'Esfuerzo medio', alto: 'Esfuerzo alto' } as const;
const PRIORITY_LABELS = { primary: 'Tarea principal', support: 'Tarea de apoyo' } as const;
const TECHNICAL_TERMS = /plannerEngineVersion|blueprintId|creativeSeed|noveltyScore|releaseGate|validationChecks|fixedErrors|contractLockedFields|regenerationAttempts|validationReportMarkdown|moduleReason|variationReason/i;
const BAD_BRAND_PATTERN = /\bLuz\s*Ai\b|\bLuz\s*AI\b|\bLuzIA\b|Luz IA Studio\s+Studio/i;
const UNACCENTED_PATTERN = /\b(suscripcion|produccion|campanas|interaccion|diagnostico|creditos|imagenes|edicion|publicacion|conversion|friccion|modulo|duracion|metricas)\b/i;
const BAD_HASHTAG_PATTERN = /#(?:Emprendedoras?Exitosas?|EscalaTuNegocio|FotosProfesionales|ResultadosInstantaneos|TransformacionDigital|ContenidoQueVende|VendeMas|Brilla|Wow)\b/i;
const COPY_ONLY_CHECKS = new Set(['captionsNaturalValid', 'actionableHooksValid', 'noWeakPhrases', 'spanishOrthographyValid']);

function unique(items: string[]): string[] {
  return Array.from(new Set(items.filter(Boolean)));
}

function taskSearchText(task: GrowthTask): string {
  return [
    task.visualConcept, task.caption, task.prompt, task.supportPrompt, task.engagementHook,
    task.blueprintId, task.ctaTarget, ...task.requiredAssets, ...task.slotInstructions.map(slot => `${slot.slot} ${slot.instruction}`),
    ...task.shotGuide.onScreenText,
  ].filter(Boolean).join(' ').toLowerCase();
}

export function detectTaskPlanFocus(task: GrowthTask): VisiblePlanFocus {
  const text = taskSearchText(task).replace(/luz\s*(?:ia|ai)?\s*studio/gi, '');
  if (/\bcompar|elegir plan|cu[aá]l plan|seg[uú]n tu ritmo/.test(text)) return 'Comparativa de planes';
  if (/\bexplorer\b/.test(text)) return 'Plan Explorer';
  if (/\bstarter\b/.test(text)) return 'Plan Starter';
  if (/\bpro\b/.test(text)) return 'Plan Pro';
  if (/\bstudio\b/.test(text)) return 'Plan Studio';
  if (/\bcr[eé]dito/.test(text)) return 'Créditos en general';
  return 'App en general';
}

export function alignVisibleCtaWithPlanFocus(task: GrowthTask, focus: VisiblePlanFocus): string {
  if (task.ctaTarget === 'Guardar') return 'Guarda esta publicación para revisar la información después.';
  if (task.ctaTarget === 'Link en bio' || task.ctaTarget === 'Link') return 'Revisa los planes en el enlace de la bio y elige según tu ritmo de publicación.';
  if (task.ctaTarget === 'Facebook comentario' || task.ctaTarget === 'Comentario') return 'Comenta PLAN y te recomendamos una opción.';
  switch (focus) {
    case 'Plan Explorer': return 'Envíanos EXPLORER por DM si quieres probar una semana de contenido visual.';
    case 'Plan Starter': return 'Envíanos STARTER por DM y revisamos si 200 créditos te alcanzan para tu ritmo de publicación.';
    case 'Plan Pro': return 'Envíanos PRO por DM si necesitas contenido frecuente para campañas activas.';
    case 'Plan Studio': return 'Envíanos STUDIO por DM si tu marca necesita alto volumen de piezas visuales.';
    case 'Comparativa de planes': return 'Escríbenos PLAN y te recomendamos una opción según tu ritmo de publicación.';
    case 'Créditos en general': return 'Envíanos CRÉDITOS y te explicamos cuántos necesitas según tu calendario de contenido.';
    default:
      if (task.ctaTarget === 'Responder story') return 'Responde esta story y cuéntanos qué contenido quieres preparar.';
      if (task.ctaTarget === 'WhatsApp') return 'Escríbenos por WhatsApp y te orientamos según lo que quieras crear.';
      return 'Envíanos INFO por DM y te orientamos según lo que quieras crear.';
  }
}

function polish(text: string, task: GrowthTask, products: GrowthProduct[], focus: VisiblePlanFocus): string {
  return polishPremiumVisibleCopy(text, { task, products, planFocus: focus });
}

function sentence(text: string): string {
  const trimmed = text.trim().replace(/[,\s]+$/, '');
  if (!trimmed) return '';
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function focusIntro(focus: VisiblePlanFocus, task: GrowthTask): string {
  switch (focus) {
    case 'Plan Explorer': return 'El Plan Explorer permite probar una semana de contenido visual con 60 créditos.';
    case 'Plan Starter': return 'El Plan Starter ofrece 200 créditos para mantener un calendario mensual moderado.';
    case 'Plan Pro': return 'El Plan Pro está pensado para campañas activas y una producción de contenido frecuente.';
    case 'Plan Studio': return 'El Plan Studio acompaña a marcas que necesitan producir un volumen alto de piezas visuales.';
    case 'Comparativa de planes': return 'Esta publicación compara los planes para que cada marca pueda elegir según su ritmo de contenido.';
    case 'Créditos en general': return 'Esta publicación explica cómo calcular los créditos según la cantidad de contenido mensual.';
    default: return sentence(`Esta pieza muestra ${task.visualConcept.replace(/[.!?].*$/, '').toLowerCase()}`);
  }
}

export function buildVisibleCaption(task: GrowthTask, focus: VisiblePlanFocus, products: GrowthProduct[]): string {
  const cta = alignVisibleCtaWithPlanFocus(task, focus);
  const intro = polish(focusIntro(focus, task), task, products, focus);
  const reason = polish(task.whyItWorks, task, products, focus);
  const safeReason = reason.length >= 25 && !/^[a-záéíóúñ]+\s+(?:la|el|los|las)\b/i.test(reason)
    ? sentence(reason.split(/(?<=[.!?])\s+/)[0])
    : 'El objetivo es explicar la oferta con claridad y facilitar una conversación concreta.';
  return [sentence(intro), safeReason, sentence(cta)].filter(Boolean).join(' ');
}

export function polishVisibleHashtags(task: GrowthTask, focus: VisiblePlanFocus): string {
  if (task.platform === 'Stories' || task.platform === 'WhatsApp' || task.platform === 'Facebook') return '';
  const focusTag = {
    'Plan Explorer': '#PlanExplorer',
    'Plan Starter': '#PlanStarter',
    'Plan Pro': '#PlanPro',
    'Plan Studio': '#PlanStudio',
  }[focus as 'Plan Explorer' | 'Plan Starter' | 'Plan Pro' | 'Plan Studio'];
  const preferred = unique([
    '#LuzIAStudio',
    focusTag || '',
    '#ContenidoVisual',
    '#FotosDeProducto',
    '#MarketingVisual',
    '#ContenidoParaRedes',
    '#Emprendedoras',
    '#TiendaOnline',
  ]);
  return preferred.slice(0, task.platform === 'Instagram Feed' ? 8 : 5).join(' ');
}

function buildTaskTitle(task: GrowthTask, focus: VisiblePlanFocus, products: GrowthProduct[]): string {
  if (focus === 'Comparativa de planes') return 'Compara los planes para ayudar a elegir';
  if (focus === 'Créditos en general') return 'Explica los créditos con un ejemplo claro';
  if (task.contentType.toLowerCase().includes('q&a')) return 'Responde dudas frecuentes de tu audiencia';
  if (task.contentType.toLowerCase().includes('encuesta')) return 'Abre una conversación con una encuesta';
  if (/antes.?despu[eé]s/i.test(taskSearchText(task))) return 'Muestra un antes y después de tu producto';
  if (focus !== 'App en general') return `Presenta ${focus} con un ejemplo concreto`;
  return polish(`${task.contentType}: ${task.visualConcept.replace(/[.!?].*$/, '').slice(0, 80)}`, task, products, focus);
}

function buildSteps(task: GrowthTask, products: GrowthProduct[], focus: VisiblePlanFocus, cta: string): VisibleTaskStep[] {
  const assets = task.requiredAssets.length
    ? polish(task.requiredAssets.join(', '), task, products, focus)
    : 'la información principal de la publicación';
  const createInstruction = task.module === 'none'
    ? `No necesitas usar un módulo. Prepara el contenido como ${task.contentType.toLowerCase()} con una sola idea principal.`
    : `Abre ${MODULE_LABELS[task.module]} y crea la pieza siguiendo el objetivo de esta tarea.`;
  return [
    { title: 'Prepara el recurso visual', instruction: `Reúne ${assets}.` },
    { title: 'Crea', instruction: polish(createInstruction, task, products, focus) },
    { title: 'Publica', instruction: `Publica en ${task.platform} y revisa que el mensaje principal se entienda rápido.` },
    { title: 'Responde mensajes o comentarios', instruction: cta },
  ];
}

function buildVisiblePrompt(task: GrowthTask, products: GrowthProduct[], focus: VisiblePlanFocus): string {
  if (task.module === 'none') return '';
  const source = task.prompt || `Crea una pieza ${task.contentType} para ${task.platform} centrada en ${task.visualConcept}.`;
  const polished = polish(source, task, products, focus);
  if (polished.length >= 55) return polished;
  return `${polished} Usa una composición clara, texto legible y una jerarquía visual que ayude a entender la oferta.`;
}

function buildShotGuide(task: GrowthTask, products: GrowthProduct[], focus: VisiblePlanFocus): { label: string; items: VisibleShotItem[] } {
  const contentType = task.contentType.toLowerCase();
  const isVideo = /reel|video|tiktok|demo/.test(contentType);
  const isCarousel = /carrusel/.test(contentType);
  const isStories = task.platform === 'Stories';
  if (!isVideo && !isCarousel && !isStories) return { label: '', items: [] };
  const prefix = isStories ? 'Story' : isCarousel ? 'Placa' : 'Toma';
  return {
    label: isStories ? 'Secuencia de stories' : isCarousel ? 'Guía de placas' : 'Guía de tomas',
    items: task.shotGuide.shots.map(shot => ({
      label: `${prefix} ${shot.shot}`,
      duration: isVideo || isStories ? polish(shot.duration, task, products, focus) : '',
      instruction: polish(shot.instruction, task, products, focus),
    })),
  };
}

function roadmapStage(index: number, total: number): string {
  if (total <= 1) return 'Acción';
  const stages = ['Atracción', 'Demostración', 'Confianza', 'Conversión'];
  return stages[Math.min(stages.length - 1, Math.round((index / (total - 1)) * (stages.length - 1)))];
}

function buildVisibleTask(task: GrowthTask, products: GrowthProduct[]): VisiblePlannerTask {
  const planFocus = detectTaskPlanFocus(task);
  const cta = polish(alignVisibleCtaWithPlanFocus(task, planFocus), task, products, planFocus);
  const shotGuide = buildShotGuide(task, products, planFocus);
  return {
    id: task.id,
    week: task.week,
    status: task.status,
    title: buildTaskTitle(task, planFocus, products),
    dateLabel: polish(task.dayLabel, task, products, planFocus),
    suggestedTime: task.suggestedTime,
    platform: task.platform,
    contentType: polish(task.contentType, task, products, planFocus),
    effortLabel: EFFORT_LABELS[task.estimatedEffort],
    priorityLabel: PRIORITY_LABELS[task.taskPriority],
    goal: polish(task.visualConcept, task, products, planFocus),
    whyThisMatters: polish(task.whyItWorks, task, products, planFocus),
    recommendedModuleLabel: MODULE_LABELS[task.module],
    supportModuleLabel: task.supportModule ? MODULE_LABELS[task.supportModule] : undefined,
    requiredAssetsLabel: task.requiredAssets.length
      ? polish(task.requiredAssets.join(', '), task, products, planFocus)
      : 'No necesitas recursos adicionales',
    steps: buildSteps(task, products, planFocus, cta),
    caption: buildVisibleCaption(task, planFocus, products),
    hashtags: polishVisibleHashtags(task, planFocus),
    prompt: buildVisiblePrompt(task, products, planFocus),
    optionalSupportPrompt: task.supportPrompt ? polish(task.supportPrompt, task, products, planFocus) : undefined,
    cta,
    practicalTip: cta,
    planFocus,
    shotGuideLabel: shotGuide.label,
    shotGuide: shotGuide.items,
    onScreenText: task.shotGuide.onScreenText.map(text => polish(text, task, products, planFocus)),
  };
}

function visibleStrings(output: VisiblePlannerOutput): string[] {
  return [
    output.headline, output.summary, output.strategy, output.strategicTip, output.brandName,
    output.brandCategory, output.brandVoiceGuide, output.mainGoal, output.channelLabel,
    ...output.nicheInsights,
    ...output.commercialFocus.flatMap(product => [product.name, product.price]),
    ...output.roadmap.flatMap(item => [item.title, item.objective, item.stageLabel]),
    ...output.tasks.flatMap(task => [
      task.title, task.dateLabel, task.platform, task.contentType, task.effortLabel, task.priorityLabel,
      task.goal, task.whyThisMatters, task.caption, task.hashtags, task.prompt, task.optionalSupportPrompt || '',
      task.cta, task.practicalTip, task.requiredAssetsLabel, task.recommendedModuleLabel, task.supportModuleLabel || '',
      ...task.steps.flatMap(step => [step.title, step.instruction]),
      ...task.shotGuide.flatMap(item => [item.label, item.duration, item.instruction]),
      ...task.onScreenText,
    ]),
  ].filter(Boolean);
}

function ctaMatchesFocus(task: VisiblePlannerTask): boolean {
  if (task.cta.includes('Guarda esta publicación') || task.cta.includes('enlace de la bio') || task.cta.includes('Comenta PLAN')) return true;
  const expected = {
    'Plan Explorer': 'EXPLORER',
    'Plan Starter': 'STARTER',
    'Plan Pro': 'PRO',
    'Plan Studio': 'STUDIO',
    'Comparativa de planes': 'PLAN',
    'Créditos en general': 'CRÉDITOS',
    'App en general': task.platform === 'Stories' ? 'story' : task.platform === 'WhatsApp' ? 'WhatsApp' : 'INFO',
  }[task.planFocus];
  return task.cta.includes(expected);
}

function countSentences(text: string): number {
  return text.split(/(?<=[.!?])\s+/).filter(Boolean).length;
}

function visibleHashtagsClean(task: VisiblePlannerTask): boolean {
  if ((task.platform === 'Stories' || task.platform === 'WhatsApp' || task.platform === 'Facebook') && task.hashtags) return false;
  const tags = task.hashtags.match(/#[\p{L}\p{N}_]+/gu) || [];
  if (task.platform === 'Instagram Feed' && (tags.length < 5 || tags.length > 8)) return false;
  return !BAD_HASHTAG_PATTERN.test(task.hashtags);
}

export function evaluateVisibleOutputQuality(output: VisiblePlannerOutput): VisibleOutputQualityResult {
  const strings = visibleStrings(output);
  const allText = strings.join('\n');
  const checks = {
    brandNameConsistent: !BAD_BRAND_PATTERN.test(allText.replace(/#LuzIAStudio/g, '')),
    noInflatedMarketingPhrases: !PREMIUM_WEAK_PHRASE_PATTERN.test(allText),
    planFocusAlignedWithCta: output.tasks.every(ctaMatchesFocus),
    captionsPremiumClean: output.tasks.every(task =>
      countSentences(task.caption) >= 2
      && countSentences(task.caption) <= 4
      && !RAW_VISIBLE_SLOT_PATTERN.test(task.caption)
      && !PREMIUM_WEAK_PHRASE_PATTERN.test(task.caption)
      && !/\b(?:mejorar|mejora) la presentaci[oó]n[^.]{0,80}(?:con|im[aá]genes)\b/i.test(task.caption)
      && (task.caption.match(/Luz IA Studio/g) || []).length <= 1),
    promptsUseful: output.tasks.every(task =>
      task.recommendedModuleLabel === MODULE_LABELS.none || (task.prompt.length >= 45 && !RAW_VISIBLE_SLOT_PATTERN.test(task.prompt))),
    recipesActionable: output.tasks.every(task =>
      task.steps.length >= 3 && task.steps.every(step => step.title.length >= 4 && step.instruction.length >= 18)),
    userFacingDebugHidden: !TECHNICAL_TERMS.test(allText),
    platformLanguageNatural: output.tasks.every(task => {
      const text = `${task.goal} ${task.caption} ${task.steps.map(step => step.instruction).join(' ')}`;
      if (task.platform === 'Stories') return !/publica(?:r)? en facebook/i.test(text);
      if (task.platform === 'Facebook') return !/instagram stories|sticker de instagram|publica(?:r)? en instagram/i.test(text);
      return !/\bsticker\b|responde esta story/i.test(text);
    }),
    spanishVisibleCopyClean: !UNACCENTED_PATTERN.test(allText),
    noRawSlotsInVisibleOutput: !RAW_VISIBLE_SLOT_PATTERN.test(allText),
    visibleHashtagsClean: output.tasks.every(visibleHashtagsClean),
  };
  const issues = Object.entries(checks).filter(([, valid]) => !valid).map(([name]) => name);
  return {
    visibleOutputQualityStatus: issues.length ? 'needs_copy_review' : 'premium_ready',
    checks,
    issues,
  };
}

export function isStructurePublishableForVisibleOutput(plan: GrowthStrategicPlan): boolean {
  if (plan.planQualityStatus === 'failed_validation') return false;
  const releaseGate = plan.finalValidationSummary?.releaseGate;
  if ((releaseGate?.hardFailures?.length || 0) > 0 || (releaseGate?.blockingReasons?.length || 0) > 0) return false;
  const checks = plan.finalValidationSummary?.checks || plan.generationLog.validationChecks || {};
  return !Object.entries(checks).some(([name, valid]) => valid === false && !COPY_ONLY_CHECKS.has(name));
}

export function buildVisiblePlannerOutput(
  planOutput: GrowthStrategicPlan,
  _engineMetadata: Record<string, unknown> = {},
  plannerInput?: Partial<GrowthStrategicPlan>,
): VisiblePlannerOutput {
  const products = plannerInput?.products || planOutput.normalizedProducts || planOutput.products;
  const output: VisiblePlannerOutput = {
    headline: polishPremiumVisibleCopy(`Plan de contenido de ${planOutput.duration} días para ${planOutput.mainGoal.toLowerCase()}`),
    summary: polishPremiumVisibleCopy(planOutput.planNarrative),
    strategy: polishPremiumVisibleCopy(planOutput.strategyGoal || planOutput.businessDiagnosis),
    strategicTip: polishPremiumVisibleCopy(planOutput.strategicTip),
    brandName: polishPremiumVisibleCopy(planOutput.brand.name),
    brandCategory: polishPremiumVisibleCopy(planOutput.brand.category),
    brandVoiceGuide: polishPremiumVisibleCopy(planOutput.brandAnalysis.voiceGuide),
    mainGoal: polishPremiumVisibleCopy(planOutput.mainGoal),
    channelLabel: polishPremiumVisibleCopy(planOutput.brand.mainSalesChannel),
    duration: planOutput.duration,
    nicheInsights: planOutput.nicheInsights.map(insight => polishPremiumVisibleCopy(insight)),
    commercialFocus: products.map(product => ({
      id: product.id,
      name: polishPremiumVisibleCopy(product.name),
      price: polishPremiumVisibleCopy(product.price),
    })),
    roadmap: planOutput.roadmap.map((item, index): VisibleRoadmapItem => ({
      week: item.week,
      title: polishPremiumVisibleCopy(item.title),
      objective: polishPremiumVisibleCopy(item.objective),
      stageLabel: roadmapStage(index, planOutput.roadmap.length),
    })),
    tasks: planOutput.tasks.map(task => buildVisibleTask(task, products)),
    quality: null as unknown as VisibleOutputQualityResult,
    canPublishVisibleOutputToUser: false,
  };
  output.quality = evaluateVisibleOutputQuality(output);
  output.canPublishVisibleOutputToUser = isStructurePublishableForVisibleOutput(planOutput)
    && output.quality.visibleOutputQualityStatus === 'premium_ready';
  return output;
}

export { BRAND_DISPLAY_NAME };
