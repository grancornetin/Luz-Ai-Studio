export type GrowthPlanDuration = 7 | 14 | 30;

export type GrowthPlatform = 'Instagram Feed' | 'Stories' | 'TikTok' | 'WhatsApp' | 'Facebook';

export type GrowthContentModule = 'product' | 'ugc' | 'scene' | 'prompt' | 'outfit' | 'none';

export type GrowthTaskStatus = 'pending' | 'in_progress' | 'ready' | 'published' | 'skipped';

export type GrowthFunnelRole = 'atraer' | 'generar_deseo' | 'construir_confianza' | 'convertir';

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
  slotInstructions: GrowthSlotInstruction[];
  requiredAssets: string[];
  executionRecipe: GrowthExecutionRecipe;
  shotGuide: GrowthShotGuide;
  engagementHook: string;
  status: GrowthTaskStatus;
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
    warnings: string[];
    validationChecks: Record<string, boolean>;
    fixedErrors: string[];
  };
  validationReportMarkdown: string;
}
