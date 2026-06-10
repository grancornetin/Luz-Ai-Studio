export type GrowthPlanDuration = 7 | 14 | 30;

export type GrowthPlatform = 'Instagram Feed' | 'Stories' | 'TikTok' | 'WhatsApp' | 'Facebook';

export type GrowthContentModule = 'product' | 'ugc' | 'scene' | 'prompt' | 'outfit' | 'none';

export type GrowthTaskStatus = 'pending' | 'in_progress' | 'ready' | 'published' | 'skipped';

export type GrowthFunnelRole = 'atraer' | 'generar_deseo' | 'construir_confianza' | 'convertir';

export type GrowthEstimatedEffort = 'bajo' | 'medio' | 'alto';

export type GrowthTaskPriority = 'primary' | 'support';

export type GrowthCtaTarget =
  | 'Instagram DM'
  | 'Comentario'
  | 'Facebook comentario'
  | 'DM Facebook'
  | 'Link'
  | 'WhatsApp'
  | 'Link en bio'
  | 'Guardar'
  | 'Responder story';

export interface GrowthBrand {
  name: string;
  category: string;
  idealClient: string;
  tone: string;
  mainSalesChannel: string;
  activeSocials: GrowthPlatform[];
}

export interface GrowthProduct {
  id: string;
  name: string;
  category: string;
  description: string;
  price: string;
  stock: string;
  benefit: string;
  credits?: string;
  idealFor?: string;
  useCases?: string[];
  messageKey?: string;
  inferredFields?: string[];
  rawSourceLines?: string[];
  warnings?: string[];
}

export interface GrowthInstagramMetrics {
  followers: string;
  reachDiagnosis: string;
  reelsInsight: string;
  carouselInsight: string;
  bestTime: string;
}

export interface GrowthSlotInstruction {
  slot: string;
  instruction: string;
}

export interface GrowthExecutionStep {
  id: string;
  title: string;
  module: GrowthContentModule;
  instruction: string;
  ctaLabel: string;
  status: 'pending' | 'ready';
}

export interface GrowthExecutionRecipe {
  overview: string;
  steps: GrowthExecutionStep[];
}

export interface GrowthShot {
  shot: number;
  duration: string;
  instruction: string;
}

export interface GrowthShotGuide {
  duration: string;
  shots: GrowthShot[];
  onScreenText: string[];
  inspirationSearches: string[];
  whatToAvoid: string[];
}

export interface GrowthTask {
  id: string;
  week: number;
  dayLabel: string;
  date: string;
  platform: GrowthPlatform;
  contentType: string;
  funnelRole: GrowthFunnelRole;
  module: GrowthContentModule;
  moduleReason: string;
  suggestedTime: string;
  visualConcept: string;
  whyItWorks: string;
  caption: string;
  hashtags: string;
  prompt: string;
  supportPrompt?: string;
  supportModule?: GrowthContentModule;
  slotInstructions: GrowthSlotInstruction[];
  requiredAssets: string[];
  executionRecipe: GrowthExecutionRecipe;
  shotGuide: GrowthShotGuide;
  engagementHook: string;
  estimatedEffort: GrowthEstimatedEffort;
  taskPriority: GrowthTaskPriority;
  ctaTarget: GrowthCtaTarget;
  status: GrowthTaskStatus;
  blueprintId?: string;
  campaignAngle?: string;
  variationReason?: string;
  needsManualReview?: boolean;
  validationErrors?: string[];
  regenerationAttempts?: number;
}

export interface GrowthRoadmapItem {
  week: number;
  title: string;
  objective: string;
  funnelRole: GrowthFunnelRole;
  hint: string;
}

export interface GrowthStrategicPlan {
  id: string;
  createdAt: string;
  duration: GrowthPlanDuration;
  brand: GrowthBrand;
  products: GrowthProduct[];
  normalizedProducts?: GrowthProduct[];
  instagramMetrics: GrowthInstagramMetrics;
  businessStage: string;
  mainGoal: string;
  commercialFocus: string;
  strategyGoal: string;
  businessDiagnosis: string;
  nicheInsights: string[];
  planNarrative: string;
  strategicTip: string;
  roadmap: GrowthRoadmapItem[];
  tasks: GrowthTask[];
  brandAnalysis: {
    stageInterpretation: string;
    targetAnalysis: string;
    voiceGuide: string;
  };
  productAnalysis: {
    productWarnings: string[];
    confidenceByProduct: { productId: string; level: number; reason: string }[];
    categorizationSummary: string;
  };
  socialMetricsAnalysis: {
    audienceInsights: string;
    engagementLevel: string;
    confidenceMapping: string;
  };
  nicheResearch: {
    trends: string[];
    competitorGaps: string[];
    researchMode: string;
  };
  generationLog: {
    timestamp: string;
    steps: string[];
    hasImages: boolean;
    hasMetrics: boolean;
    researchMode: string;
    dateBaseUsed?: string;
    dateFixesApplied?: number;
    expectedTasks?: number;
    generatedTasks?: number;
    tasksAddedByFallback?: number;
    roadmapWeeksGenerated?: number;
    channelUsage?: Record<string, number>;
    warnings: string[];
    validationChecks: Record<string, boolean>;
    fixedErrors: string[];
    legacyNormalizersSkipped?: string[];
    v2ValidatorsApplied?: string[];
    contractLockedFields?: string[];
    tasksRegenerated?: number;
    tasksMarkedForReview?: number;
  };
  validationReportMarkdown: string;
  plannerEngineVersion?: 'v2-blueprint';
  planningDepth?: 'guided' | 'advanced';
  campaignAngle?: string;
  campaignAngleReason?: string;
  creativeSeed?: string;
  noveltyScore?: number;
  planQualityStatus?: 'ready' | 'needs_review' | 'failed_validation';
  blueprintsUsed?: string[];
  previousPlanComparison?: string;
  finalValidationSummary?: {
    status: 'ready' | 'needs_review' | 'failed_validation';
    checks: Record<string, boolean>;
    criticalErrors: string[];
    reviewWarnings: string[];
    releaseGate?: {
      canPublishToUser: boolean;
      planQualityStatus: 'ready' | 'needs_review' | 'failed_validation';
      hardFailures: string[];
      softWarnings: string[];
      blockingReasons: string[];
      releaseNotes: string[];
    };
  };
  engineV2Metadata?: Record<string, unknown>;
  visiblePlanOutput?: import('./growthPlanner/visibleOutput').VisiblePlannerOutput;
  visibleOutputQualityStatus?: import('./growthPlanner/visibleOutput').VisibleOutputQualityResult['visibleOutputQualityStatus'];
}
