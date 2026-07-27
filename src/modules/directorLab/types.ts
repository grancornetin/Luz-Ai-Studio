export type ReferenceRole = 'identity' | 'body' | 'outfit' | 'product' | 'scene' | 'accessory' | 'auxiliary';

export interface DirectorLabProject {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DirectorLabRecipe {
  id: string;
  projectId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface DirectorLabCase {
  id: string;
  projectId: string;
  recipeId: string;
  name: string;
  brief?: DirectorBrief;
  createdAt: string;
  updatedAt: string;
  runs?: DirectorRun[];
}

export interface DirectorBrief {
  testName?: string;
  recipeName?: string;
  shotName?: string;
  narrativeGoal?: string;
  photodumpStage?: string;
  contentType?: string;
  desiredLocation?: string;
  timeOfDay?: string;
  captureMechanism?: string;
  desiredFraming?: string;
  requiredReferenceRoles?: string[];
  constraintsFreeText?: string;
  evaluatorNotes?: string;
  freeformBrief?: string;
}

export interface DirectorReference {
  id: string;
  caseId: string;
  role: ReferenceRole;
  alias?: string;
  notes?: string;
  hasAsset?: boolean;
  assetMimeType?: string;
}

export interface Candidate {
  domain: string;
  sourceBank: string;
  sourceId: string;
  name?: string;
  curationStatus?: string;
  strongReference?: boolean;
  confidence?: number;
  sourceText?: string;
  rankScore?: number;
  compatibilityReason?: string;
}

export interface Rejection {
  domain: string;
  sourceBank: string;
  sourceId: string;
  reason: string;
}

export interface ValidationResult {
  validatorId: string;
  ruleId: string;
  passed: boolean;
  warnings: string[];
  blocks: string[];
}

export interface DirectorRun {
  id: string;
  runId?: string;
  caseId: string;
  status: 'ready' | 'blocked' | 'needs_review';
  briefInterpretation: Record<string, unknown>;
  consultedBanks: Array<{ bankId: string; label: string; status: Record<string, unknown> }>;
  candidates: Record<string, Candidate[]>;
  selections: Record<string, Candidate | null>;
  rejections: Rejection[];
  rulesApplied: Array<{ ruleId: string; ruleVersion: string; domain: string }>;
  conflicts: Array<{ description: string }>;
  validations: ValidationResult[];
  positivePrompt: string;
  negativePrompt: string;
  warnings: string[];
  provenance: Record<string, unknown>;
  createdAt: string;
  previousRunId?: string | null;
  results?: DirectorResult[];
}

export interface DirectorResult {
  id: string;
  runId: string;
  note?: string;
  assetMimeType?: string;
  createdAt: string;
}

export interface DirectorEvaluation {
  id: string;
  runId: string;
  status: 'approved' | 'partial' | 'rejected';
  score?: number;
  notes?: string;
  tags?: string[];
  createdAt: string;
}

export interface BankStatus {
  bankId: string;
  label: string;
  domain: string;
  status: Record<string, unknown>;
}

export interface DirectorLabStatus {
  provider: { ready: boolean; provider?: string; model?: string; error?: string };
  banks: BankStatus[];
}
