import type { GrowthProduct, GrowthStrategicPlan, GrowthTask } from '../../growthPlannerTypes';
import { BRAND_DISPLAY_NAME, polishVisibleCopy } from './copyPolish';
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
  none: 'No necesitas módulo',
} as const;

const EFFORT_LABELS = { bajo: 'Esfuerzo bajo', medio: 'Esfuerzo medio', alto: 'Esfuerzo alto' } as const;
const PRIORITY_LABELS = { primary: 'Tarea principal', support: 'Tarea de apoyo' } as const;
const TECHNICAL_TERMS = /plannerEngineVersion|blueprintId|creativeSeed|noveltyScore|releaseGate|validationChecks|fixedErrors|contractLockedFields|regenerationAttempts|validationReportMarkdown/i;
const RAW_SLOT_PATTERN = /@(plan|resultado|app_screen|producto|referencia)\d+/i;
const INFLATED_PATTERN = /soluci[oó]n (?:visual )?definitiva|revista|sin esfuerzo|vende m[aá]s|contenido que vende|fotos que venden|\b[eé]xito\b|\bbrillar\b|\bwow\b|\bmagia\b|aliado visual|sin l[ií]mites|profesional al instante/i;
const BAD_BRAND_PATTERN = /\bLuz\s*Ai\b|\bLuz\s*AI\b|\bLuzIA\b/;
const UNACCENTED_PATTERN = /\b(suscripcion|produccion|campanas|interaccion|diagnostico|creditos|imagenes|edicion|publicacion|conversion|friccion|modulo|duracion|metricas)\b/i;

function unique(items: string[]): string[] {
  return Array.from(new Set(items.filter(Boolean)));
}

function taskSearchText(task: GrowthTask): string {
  return [
    task.visualConcept, task.whyItWorks, task.caption, task.prompt, task.supportPrompt,
    task.engagementHook, task.executionRecipe.overview, ...task.requiredAssets,
  ].filter(Boolean).join(' ').toLowerCase();
}

export function detectTaskPlanFocus(task: GrowthTask, products: GrowthProduct[]): VisiblePlanFocus {
  const taskText = taskSearchText(task);
  const referencedProducts = products.filter(product => taskText.includes(product.name.toLowerCase()));
  const text = `${taskText} ${referencedProducts.map(product => `${product.name} ${product.benefit}`).join(' ')}`.toLowerCase();
  if (/\bcompar|elegir plan|cu[aá]l plan|seg[uú]n tu ritmo/.test(text)) return 'Comparativa de planes';
  if (/\bexplorer\b/.test(text)) return 'Plan Explorer';
  if (/\bstarter\b/.test(text)) return 'Plan Starter';
  if (/\bpro\b/.test(text)) return 'Plan Pro';
  if (/\bstudio\b/.test(text) && !/luz\s+ia\s+studio/.test(text.replace(/luz\s+ia\s+studio/g, ''))) return 'Plan Studio';
  if (/\bcr[eé]dito/.test(text)) return 'Créditos en general';
  return 'App en general';
}

function ctaForFocus(focus: VisiblePlanFocus, platform: GrowthTask['platform']): string {
  const action = platform === 'Facebook' ? 'Comenta' : platform === 'Stories' ? 'Responde esta story con' : 'Envíanos';
  switch (focus) {
    case 'Plan Explorer': return `${action} EXPLORER y te explicamos si sirve para validar una semana de contenido visual.`;
    case 'Plan Starter': return `${action} STARTER y revisamos si 200 créditos alcanzan para tu ritmo de publicación.`;
    case 'Plan Pro': return `${action} PRO si necesitas contenido frecuente para campañas activas.`;
    case 'Plan Studio': return `${action} STUDIO si tu marca necesita un volumen alto de piezas visuales.`;
    case 'Comparativa de planes': return `${action} PLAN y te recomendamos una opción según tu ritmo de publicación.`;
    case 'Créditos en general': return `${action} CRÉDITOS y te explicamos cuántos necesitas para tu contenido mensual.`;
    default: return `${action} INFO y te orientamos según lo que quieras crear.`;
  }
}

function cleanCaption(task: GrowthTask, cta: string): string {
  const cleaned = polishVisibleCopy(task.caption, { replaceSlots: true })
    .replace(/(?:env[ií]anos|escr[ií]benos|comenta|responde)[^.?!]*(?:[.?!]|$)/gi, '')
    .trim();
  const sentences = cleaned.split(/(?<=[.!?])\s+/).filter(Boolean).slice(0, 3);
  const body = sentences.join(' ').replace(/[,\s]+$/, '');
  const separatedBody = body && !/[.!?]$/.test(body) ? `${body}.` : body;
  return polishVisibleCopy(`${separatedBody} ${cta}`, { replaceSlots: true });
}

function polishHashtags(task: GrowthTask): string {
  if (task.platform === 'Stories' || task.platform === 'WhatsApp') return '';
  const tags = unique(task.hashtags.match(/#[\p{L}\p{N}_]+/gu) || [])
    .filter(tag => !/#EmprendedoraExitosa|#ContenidoQueVende|#TransformacionDigital/i.test(tag));
  if (task.platform === 'Facebook') return tags.slice(0, 3).join(' ');
  return unique([...tags, '#LuzIAStudio', '#ContenidoVisual', '#ContenidoParaRedes']).slice(0, 8).join(' ');
}

function buildTaskTitle(task: GrowthTask, focus: VisiblePlanFocus): string {
  if (focus === 'Comparativa de planes') return 'Compara los planes para ayudar a elegir';
  if (focus === 'Créditos en general') return 'Explica los créditos con un ejemplo claro';
  if (task.contentType.toLowerCase().includes('q&a')) return 'Responde dudas frecuentes de tu audiencia';
  if (task.contentType.toLowerCase().includes('encuesta')) return 'Abre una conversación con una encuesta';
  if (/antes.?despu[eé]s/i.test(taskSearchText(task))) return 'Muestra un antes y después de tu producto';
  if (focus !== 'App en general') return `Presenta ${focus} con un ejemplo concreto`;
  return `${task.contentType}: ${polishVisibleCopy(task.visualConcept).replace(/[.!?].*$/, '').slice(0, 80)}`;
}

function buildSteps(task: GrowthTask): VisibleTaskStep[] {
  const source = task.executionRecipe.steps.slice(0, 4);
  const labels = ['Prepara', task.module === 'none' ? 'Crea' : `Crea en ${MODULE_LABELS[task.module]}`, 'Publica', 'Responde y revisa'];
  const steps = source.map((step, index) => ({
    title: labels[index] || polishVisibleCopy(step.title),
    instruction: polishVisibleCopy(step.instruction, { replaceSlots: true }),
  }));
  if (!steps.length) {
    return [
      { title: 'Prepara', instruction: `Reúne ${task.requiredAssets.join(', ') || 'la información necesaria'}.` },
      { title: 'Publica', instruction: `Publica la pieza en ${task.platform} y revisa que el CTA sea visible.` },
      { title: 'Responde y revisa', instruction: 'Responde las consultas con una recomendación concreta y anota las dudas repetidas.' },
    ];
  }
  return steps;
}

function buildShotGuide(task: GrowthTask): { label: string; items: VisibleShotItem[] } {
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
      duration: isVideo || isStories ? polishVisibleCopy(shot.duration) : '',
      instruction: polishVisibleCopy(shot.instruction, { replaceSlots: true }),
    })),
  };
}

function roadmapStage(index: number, total: number): string {
  if (total <= 1) return 'Acción';
  const stages = ['Atracción', 'Demostración', 'Confianza', 'Conversión'];
  return stages[Math.min(stages.length - 1, Math.round((index / (total - 1)) * (stages.length - 1)))];
}

function buildVisibleTask(task: GrowthTask, products: GrowthProduct[]): VisiblePlannerTask {
  const planFocus = detectTaskPlanFocus(task, products);
  const cta = polishVisibleCopy(ctaForFocus(planFocus, task.platform));
  const shotGuide = buildShotGuide(task);
  const prompt = task.module === 'none'
    ? ''
    : polishVisibleCopy(task.prompt || `Crea una pieza ${task.contentType} para ${task.platform}. Usa una composición clara y enfócala en ${task.visualConcept}.`);
  return {
    id: task.id,
    week: task.week,
    status: task.status,
    title: polishVisibleCopy(buildTaskTitle(task, planFocus)),
    dateLabel: polishVisibleCopy(task.dayLabel),
    suggestedTime: task.suggestedTime,
    platform: task.platform,
    contentType: polishVisibleCopy(task.contentType),
    effortLabel: EFFORT_LABELS[task.estimatedEffort],
    priorityLabel: PRIORITY_LABELS[task.taskPriority],
    goal: polishVisibleCopy(task.visualConcept, { replaceSlots: true }),
    whyThisMatters: polishVisibleCopy(task.whyItWorks, { replaceSlots: true }),
    recommendedModuleLabel: MODULE_LABELS[task.module],
    supportModuleLabel: task.module === 'none' && task.supportModule ? MODULE_LABELS[task.supportModule] : undefined,
    requiredAssetsLabel: task.requiredAssets.length
      ? polishVisibleCopy(task.requiredAssets.join(', '), { replaceSlots: true })
      : 'No necesitas recursos adicionales',
    steps: buildSteps(task),
    caption: cleanCaption(task, cta),
    hashtags: polishHashtags(task),
    prompt,
    optionalSupportPrompt: task.supportPrompt ? polishVisibleCopy(task.supportPrompt) : undefined,
    cta,
    practicalTip: polishVisibleCopy(task.engagementHook, { replaceSlots: true }) || cta,
    planFocus,
    shotGuideLabel: shotGuide.label,
    shotGuide: shotGuide.items,
    onScreenText: task.shotGuide.onScreenText.map(text => polishVisibleCopy(text, { replaceSlots: true })),
    sourceModule: task.module,
    sourceEffort: task.estimatedEffort,
    sourcePriority: task.taskPriority,
  };
}

function visibleStrings(output: VisiblePlannerOutput): string[] {
  return [
    output.headline, output.summary, output.strategy, output.strategicTip, output.brandName,
    ...output.roadmap.flatMap(item => [item.title, item.objective, item.stageLabel]),
    ...output.tasks.flatMap(task => [
      task.title, task.goal, task.whyThisMatters, task.caption, task.prompt, task.optionalSupportPrompt || '',
      task.cta, task.practicalTip, task.requiredAssetsLabel, task.recommendedModuleLabel,
      ...task.steps.flatMap(step => [step.title, step.instruction]),
      ...task.shotGuide.flatMap(item => [item.label, item.duration, item.instruction]),
      ...task.onScreenText,
    ]),
  ].filter(Boolean);
}

export function buildVisiblePlannerOutput(
  planOutput: GrowthStrategicPlan,
  engineMetadata: Record<string, unknown> = {},
  plannerInput?: Partial<GrowthStrategicPlan>,
): VisiblePlannerOutput {
  const products = plannerInput?.products || planOutput.normalizedProducts || planOutput.products;
  const roadmap: VisibleRoadmapItem[] = planOutput.roadmap.map((item, index) => ({
    week: item.week,
    title: polishVisibleCopy(item.title),
    objective: polishVisibleCopy(item.objective),
    stageLabel: roadmapStage(index, planOutput.roadmap.length),
  }));
  const output: VisiblePlannerOutput = {
    headline: `Plan de contenido de ${planOutput.duration} días para ${polishVisibleCopy(planOutput.mainGoal).toLowerCase()}`,
    summary: polishVisibleCopy(planOutput.planNarrative),
    strategy: polishVisibleCopy(planOutput.strategyGoal || planOutput.businessDiagnosis),
    strategicTip: polishVisibleCopy(planOutput.strategicTip),
    brandName: polishVisibleCopy(planOutput.brand.name),
    brandCategory: polishVisibleCopy(planOutput.brand.category),
    brandVoiceGuide: polishVisibleCopy(planOutput.brandAnalysis.voiceGuide),
    mainGoal: polishVisibleCopy(planOutput.mainGoal),
    duration: planOutput.duration,
    roadmap,
    tasks: planOutput.tasks.map(task => buildVisibleTask(task, products)),
    warningsForAdminOnly: unique([
      ...planOutput.generationLog.warnings,
      ...((engineMetadata.releaseGate as { softWarnings?: string[] } | undefined)?.softWarnings || []),
    ]),
    qualityBadges: [],
  };
  const quality = evaluateVisibleOutputQuality(output);
  output.qualityBadges = Object.entries(quality.checks).filter(([, valid]) => valid).map(([name]) => name);
  return output;
}

function ctaMatchesFocus(task: VisiblePlannerTask): boolean {
  const expected = {
    'Plan Explorer': 'EXPLORER',
    'Plan Starter': 'STARTER',
    'Plan Pro': 'PRO',
    'Plan Studio': 'STUDIO',
    'Comparativa de planes': 'PLAN',
    'Créditos en general': 'CRÉDITOS',
    'App en general': 'INFO',
  }[task.planFocus];
  return task.cta.includes(expected);
}

export function evaluateVisibleOutputQuality(output: VisiblePlannerOutput): VisibleOutputQualityResult {
  const strings = visibleStrings(output);
  const allText = strings.join('\n');
  const checks = {
    brandNameConsistent: !BAD_BRAND_PATTERN.test(allText),
    noInflatedMarketingPhrases: !INFLATED_PATTERN.test(allText),
    planFocusAlignedWithCta: output.tasks.every(ctaMatchesFocus),
    captionsClean: output.tasks.every(task => task.caption.length >= 30 && task.caption.split(/(?<=[.!?])\s+/).length <= 4),
    promptsUseful: output.tasks.every(task => task.sourceModule === 'none' || task.prompt.length >= 35),
    recipesActionable: output.tasks.every(task => task.steps.length >= 2 && task.steps.every(step => step.instruction.length >= 15)),
    userFacingDebugHidden: !TECHNICAL_TERMS.test(allText),
    platformLanguageNatural: output.tasks.every(task => {
      const text = `${task.goal} ${task.caption} ${task.steps.map(step => step.instruction).join(' ')}`;
      if (task.platform === 'Stories') return !/publica(?:r)? en facebook/i.test(text);
      if (task.platform === 'Facebook') return !/instagram stories|sticker de instagram|publica(?:r)? en instagram/i.test(text);
      return !/\bsticker\b|responde esta story/i.test(text);
    }),
    spanishVisibleCopyClean: !UNACCENTED_PATTERN.test(allText),
    noRawSlotsInCaptions: output.tasks.every(task => !RAW_SLOT_PATTERN.test(task.caption)),
    noTechnicalMetadataVisible: !TECHNICAL_TERMS.test(allText),
  };
  const warnings = Object.entries(checks).filter(([, valid]) => !valid).map(([name]) => name);
  return {
    visibleOutputQualityStatus: warnings.length ? 'needs_copy_review' : 'premium_ready',
    checks,
    warnings,
  };
}

export { BRAND_DISPLAY_NAME };
