import type {
  GrowthBrand,
  GrowthContentModule,
  GrowthCtaTarget,
  GrowthEstimatedEffort,
  GrowthFunnelRole,
  GrowthInstagramMetrics,
  GrowthPlanDuration,
  GrowthPlatform,
  GrowthProduct,
  GrowthRoadmapItem,
  GrowthTask,
} from '../../growthPlannerTypes';

export type Channel = GrowthPlatform;
export type ContentModule = GrowthContentModule;
export type FunnelRole = GrowthFunnelRole;
export type TaskPriority = 'primary' | 'support';
export type EstimatedEffort = GrowthEstimatedEffort;
export type SalesAggressiveness = 'soft' | 'balanced' | 'direct';
export type PlanningDepth = 'guided' | 'advanced';
export type PlanQualityStatus = 'ready' | 'needs_review' | 'failed_validation';
export type ResearchMode = 'grounded' | 'gemini_without_grounding' | 'fallback' | 'skipped';

export type BusinessArchetype =
  | 'physical_product'
  | 'digital_product'
  | 'local_service'
  | 'professional_service'
  | 'saas_subscription'
  | 'personal_brand'
  | 'food_business'
  | 'event_experience'
  | 'marketplace_catalog'
  | 'prelaunch'
  | 'stock_clearance'
  | 'course_education'
  | 'other';

export type CampaignAngle =
  | 'dolor_visual'
  | 'ahorro_tiempo'
  | 'comparacion_planes'
  | 'prueba_social'
  | 'educacion_creditos'
  | 'objeciones_compra'
  | 'lanzamiento_producto'
  | 'reactivacion_audiencia'
  | 'decision_plan_correcto'
  | 'producto_en_uso'
  | 'antes_despues'
  | 'autoridad'
  | 'comunidad'
  | 'temporada'
  | 'stock_limitado';

export interface PlannerEngineV2Input {
  duration: GrowthPlanDuration;
  brand: GrowthBrand;
  products: GrowthProduct[];
  instagramMetrics: GrowthInstagramMetrics;
  businessStage: string;
  mainGoal: string;
  commercialFocus: string;
  planningDepth?: PlanningDepth;
}

export interface TaskBlueprint {
  id: string;
  name: string;
  platform: Channel;
  contentType: string;
  funnelRole: FunnelRole;
  defaultModule: ContentModule;
  allowedModules: ContentModule[];
  defaultSupportModule?: ContentModule;
  allowedSupportModules?: ContentModule[];
  ctaTargets: GrowthCtaTarget[];
  estimatedEffort: EstimatedEffort;
  taskPriority: TaskPriority;
  requiresPrompt: boolean;
  allowsSupportPrompt: boolean;
  requiredSlots: string[];
  forbiddenTerms: string[];
  requiredTerms: string[];
  businessArchetypes: BusinessArchetype[];
  campaignAngles: CampaignAngle[];
  objectiveTags: string[];
  outputContract: {
    mustUsePlatformLanguage: boolean;
    mustHaveActionableHook: boolean;
    mustNotMentionOtherPlatforms: boolean;
    mustRespectModuleRules: boolean;
    mustRespectCTA: boolean;
  };
}

export interface PlanSkeletonTask {
  id: string;
  week: number;
  date: string;
  dayLabel: string;
  blueprintId: string;
  campaignAngle: CampaignAngle;
  platform: Channel;
  contentType: string;
  funnelRole: FunnelRole;
  module: ContentModule;
  supportModule?: ContentModule;
  ctaTarget: GrowthCtaTarget;
  estimatedEffort: EstimatedEffort;
  taskPriority: TaskPriority;
  productId?: string;
  variationReason: string;
}

export interface GeneratedTaskV2 extends GrowthTask {
  blueprintId: string;
  campaignAngle: CampaignAngle;
  variationReason: string;
  needsManualReview: boolean;
  validationErrors: string[];
  regenerationAttempts: number;
}

export interface PreviousPlanMemory {
  brandId: string;
  objectiveSignature: string;
  productSignature: string;
  previousCampaignAngles: CampaignAngle[];
  previousBlueprintsUsed: string[];
  previousCaptions: string[];
  previousTaskConcepts: string[];
  previousCTAs: string[];
  previousProductsHighlighted: string[];
  lastGeneratedAt: string;
}

export interface CampaignAngleSelection {
  campaignAngle: CampaignAngle;
  campaignAngleReason: string;
  creativeSeed: string;
}

export interface ArchetypeDetection {
  businessArchetype: BusinessArchetype;
  confidence: 'high' | 'medium' | 'low';
  warnings: string[];
}

export interface NicheAdapter {
  id: string;
  archetypes: BusinessArchetype[];
  keywords: string[];
  examples: string[];
  typicalObjections: string[];
  usefulProof: string[];
  visualStyle: string[];
  suggestedAssets: string[];
}

export interface SkeletonResult {
  tasks: PlanSkeletonTask[];
  roadmap: GrowthRoadmapItem[];
  blueprintsUsed: string[];
  variationDecisions: string[];
  noveltyScore: number;
}

export interface BlueprintValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface FinalValidationSummary {
  status: PlanQualityStatus;
  checks: Record<string, boolean>;
  criticalErrors: string[];
  reviewWarnings: string[];
}

export interface EngineV2Metadata {
  plannerEngineVersion: 'v2-blueprint';
  planningDepth: PlanningDepth;
  planQualityStatus: PlanQualityStatus;
  campaignAngle: CampaignAngle;
  campaignAngleReason: string;
  creativeSeed: string;
  noveltyScore: number;
  blueprintsUsed: string[];
  blueprintValidation: Record<string, BlueprintValidationResult>;
  taskRegenerationAttempts: Record<string, number>;
  tasksNeedingManualReview: string[];
  previousPlanComparison: string;
  repeatedBlueprintsDetected: string[];
  repeatedCaptionsDetected: string[];
  variationDecisions: string[];
  finalValidationSummary: FinalValidationSummary;
  businessArchetype: BusinessArchetype;
  nicheAdapterUsed: string;
  salesAggressiveness: SalesAggressiveness;
  researchMode: ResearchMode;
  researchConfidence: 'high' | 'medium' | 'low';
  researchedInsights: string[];
  inferredInsights: string[];
  fallbackInsights: string[];
}
