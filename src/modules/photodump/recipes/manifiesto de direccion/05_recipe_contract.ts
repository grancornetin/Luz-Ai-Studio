/**
 * Photodump recipe contract — proposed architecture.
 * This file is intentionally independent from the legacy PhotodumpShotDirective.
 */

export type MotivationalDrive =
  | 'safety_relief'
  | 'status_control'
  | 'attraction_self_presentation'
  | 'belonging_social_validation'
  | 'ease_energy_saving'
  | 'exploration_pleasure'
  | 'care_self_regulation';

export type StoryBeat =
  | 'establish'
  | 'anticipate'
  | 'transform'
  | 'validate'
  | 'experience'
  | 'connect'
  | 'reflect'
  | 'close';

export type CaptureMode =
  | 'mirror_selfie'
  | 'front_camera_selfie'
  | 'self_pov'
  | 'friend_pov'
  | 'third_person_candid'
  | 'object_pov'
  | 'overhead'
  | 'detail';

export type AwarenessMode =
  | 'unaware'
  | 'aware_candid'
  | 'intentional_social';

export type ProductRole = 'hero' | 'integrated' | 'support' | 'absent';

/**
 * Photographic Rendering Layer — independent from scene/psychology.
 * See 03_photodump_recipe_architecture.md, section 19.
 * Only 'iphone_camera_roll' is validated (10_experimental_findings_001.md, Finding 004);
 * the rest are architecture-anticipated profiles pending their own manual validation.
 */
export type RenderProfileId =
  | 'iphone_camera_roll'
  | 'instagram_story'
  | 'whatsapp'
  | 'editorial'
  | 'fashion_campaign'
  | 'dslr'
  | 'security_camera'
  | 'vintage_camera'
  | 'disposable_camera';

export type InputStatus =
  | 'required'
  | 'recommended'
  | 'optional'
  | 'generated_if_missing'
  | 'forbidden';

export interface RecipeInputField {
  status: InputStatus;
  maxCount?: number;
  description: string;
}

export interface PsychologicalIntent {
  primaryDrive: MotivationalDrive;
  secondaryDrives: MotivationalDrive[];
  desiredIdentity: string[];
  desiredFeeling: string[];
  desiredExperience: string[];
  socialFantasy: string;
  cameraMotivation: string;
  audienceProjection: string;
}

export interface ReferenceRoute {
  identity: string[];
  activeItems: string[];
  world: string[];
  continuity: string[];
  optional: string[];
  forbiddenSources: string[];
  maxReferences: number;
}

export interface RecipeShotTemplate {
  id: string;
  beat: StoryBeat;
  role: string;
  primitive: string;
  purpose: string;
  psychologicalIntent: PsychologicalIntent;
  captureMode: CaptureMode;
  awareness: AwarenessMode;
  productRole: ProductRole;
  required: string[];
  forbidden: string[];
  referenceRoute: ReferenceRoute;
  promptBlocks: string[];
  /** Overrides the recipe-level renderProfile for this shot only. Omit to inherit. */
  renderProfileOverride?: RenderProfileId;
}

export interface AnchorTemplate {
  id: string;
  mode:
    | 'world_only'
    | 'identity_world'
    | 'identity_body_world'
    | 'product_world'
    | 'multi_world_chain'
    | 'none';
  visibleInOutput: boolean;
  required: string[];
  forbidden: string[];
  referenceRoute: ReferenceRoute;
  promptBlocks: string[];
}

export interface RecipeMetadata {
  id: string;
  displayName: string;
  category: string;
  version: string;
  status:
    | 'DISCOVERY'
    | 'MANUAL_TESTING'
    | 'VISUALLY_VALIDATED'
    | 'NORMALIZED'
    | 'INTEGRATION_READY'
    | 'APP_VALIDATED'
    | 'PRODUCTION_STABLE';
  minShots: number;
  recommendedShots: number;
  maxShots: number;
}

export interface PhotodumpRecipeDefinition {
  metadata: RecipeMetadata;
  inputContract: Record<string, RecipeInputField>;
  anchor: AnchorTemplate;
  shots: RecipeShotTemplate[];
  compression: Record<number, string[]>;
  /** Default Photographic Rendering Layer for this recipe. See 03, section 19. */
  renderProfile: RenderProfileId;
  knownLimitations: string[];
}
