import type { GrowthPlatform, GrowthTaskStatus } from '../../growthPlannerTypes';

export type VisiblePlanFocus =
  | 'Plan Explorer'
  | 'Plan Starter'
  | 'Plan Pro'
  | 'Plan Studio'
  | 'Comparativa de planes'
  | 'Créditos en general'
  | 'App en general';

export interface VisibleTaskStep {
  title: string;
  instruction: string;
}

export interface VisibleShotItem {
  label: string;
  duration: string;
  instruction: string;
}

export interface VisiblePlannerTask {
  id: string;
  week: number;
  status: GrowthTaskStatus;
  title: string;
  dateLabel: string;
  suggestedTime: string;
  platform: GrowthPlatform;
  contentType: string;
  effortLabel: string;
  priorityLabel: string;
  goal: string;
  whyThisMatters: string;
  recommendedModuleLabel: string;
  supportModuleLabel?: string;
  requiredAssetsLabel: string;
  steps: VisibleTaskStep[];
  caption: string;
  hashtags: string;
  prompt: string;
  optionalSupportPrompt?: string;
  cta: string;
  practicalTip: string;
  planFocus: VisiblePlanFocus;
  shotGuideLabel: string;
  shotGuide: VisibleShotItem[];
  onScreenText: string[];
}

export interface VisibleRoadmapItem {
  week: number;
  title: string;
  objective: string;
  stageLabel: string;
}

export interface VisibleProductItem {
  id: string;
  name: string;
  price: string;
}

export interface VisibleOutputQualityChecks {
  brandNameConsistent: boolean;
  noInflatedMarketingPhrases: boolean;
  planFocusAlignedWithCta: boolean;
  captionsPremiumClean: boolean;
  promptsUseful: boolean;
  recipesActionable: boolean;
  userFacingDebugHidden: boolean;
  platformLanguageNatural: boolean;
  spanishVisibleCopyClean: boolean;
  noRawSlotsInVisibleOutput: boolean;
  visibleHashtagsClean: boolean;
}

export interface VisibleOutputQualityResult {
  visibleOutputQualityStatus: 'premium_ready' | 'needs_copy_review';
  checks: VisibleOutputQualityChecks;
  issues: string[];
}

export interface VisiblePlannerOutput {
  headline: string;
  summary: string;
  strategy: string;
  strategicTip: string;
  brandName: string;
  brandCategory: string;
  brandVoiceGuide: string;
  mainGoal: string;
  channelLabel: string;
  duration: number;
  nicheInsights: string[];
  commercialFocus: VisibleProductItem[];
  roadmap: VisibleRoadmapItem[];
  tasks: VisiblePlannerTask[];
  quality: VisibleOutputQualityResult;
  canPublishVisibleOutputToUser: boolean;
}

export type GenerationSessionStatus =
  | 'started'
  | 'skeleton_created'
  | 'tasks_generated'
  | 'validated'
  | 'ready';
