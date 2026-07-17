/**
 * Fashion / outfit_night_out
 * Normalized recipe contract.
 *
 * Manual visual concept: validated.
 * Technical status: NORMALIZED — pending second-reference visual validation.
 */

import type {
  AnchorTemplate,
  PhotodumpRecipeDefinition,
  RecipeShotTemplate,
} from './recipe.contract';

const identityRefs = ['avatarFace', 'avatarBody'];
const outfitRef = ['outfitNight'];

const sharedIdentityRules = [
  'IDENTITY AUTHORITY: preserve the same face, skin tone, hair and body proportions across the full set.',
  'If avatarFace or avatarBody is missing, the generated PREP_ANCHOR becomes the sole identity and body source.',
  'Clothing visible in identity references is identity contamination, never active wardrobe.',
];

const sharedOutfitRules = [
  'OUTFIT AUTHORITY: outfitNight is the sole source of truth for every visible garment, shoe and included accessory.',
  'Preserve exact color, cut, length, pattern, material, layering and footwear geometry.',
  'Do not add, remove, upgrade, simplify or replace outfit components.',
];

const sharedOrganicRules = [
  'Authentic medium-influencer Instagram content captured with a phone.',
  'Aspirational but attainable; no campaign, runway, catalog or ecommerce visual language.',
  'The photograph exists because the moment felt worth recording, not because someone needed an advertisement.',
  'Single photo only. No collage, grid, typography, interface or watermark.',
];

const anchor: AnchorTemplate = {
  id: 'NIGHTOUT_PREP_ANCHOR',
  mode: 'identity_body_world',
  visibleInOutput: false,
  required: [
    'one stable protagonist identity',
    'body proportions readable through fitted or semi-fitted neutral base clothing',
    'credible prep room or user supplied prep scene',
    'stable light, furniture and spatial layout',
  ],
  forbidden: [
    'night outfit already worn',
    'oversized clothing hiding body proportions',
    'catalog pose',
    'studio lighting',
    'invented extra person',
    'multiple beds or duplicate furniture',
  ],
  referenceRoute: {
    identity: identityRefs,
    activeItems: [],
    world: ['prepScene'],
    continuity: [],
    optional: ['outfitNight'],
    forbiddenSources: ['venueScene', 'companion'],
    maxReferences: 6,
  },
  promptBlocks: [
    ...sharedIdentityRules,
    `Create a stable PREPARATION WORLD ANCHOR. The protagonist is getting ready at home or in a believable dressing space.
She wears simple fitted or semi-fitted neutral base clothing that reveals real body proportions without imitating the night outfit.
The room must feel lived-in, tidy enough for social content, and physically coherent.
This anchor defines identity, body, prep-room geometry, lighting and atmosphere. It is not a visible story shot.`,
    ...sharedOrganicRules,
  ],
};

const shots: RecipeShotTemplate[] = [
  {
    id: 'NIGHTOUT_PRESENTATION',
    beat: 'anticipate',
    role: 'OUTFIT INTENTION',
    primitive: 'garment_presentation',
    purpose: 'Communicate “this is what I am wearing tonight” before the transformation.',
    psychologicalIntent: {
      primaryDrive: 'attraction_self_presentation',
      secondaryDrives: ['exploration_pleasure', 'status_control'],
      desiredIdentity: ['intentional', 'stylish', 'socially confident'],
      desiredFeeling: ['anticipation', 'excitement'],
      desiredExperience: ['getting ready for a memorable night'],
      socialFantasy: 'The viewer wants to participate in the preparation and see the final look.',
      cameraMotivation: 'The outfit choice felt exciting enough to share before putting it on.',
      audienceProjection: 'She plans her looks and has somewhere worth going.',
    },
    captureMode: 'friend_pov',
    awareness: 'intentional_social',
    productRole: 'hero',
    required: ['night outfit fully readable', 'protagonist still in base look', 'prep room continuity'],
    forbidden: ['night outfit already worn', 'catalog rack display', 'garment obscuring face and body completely'],
    referenceRoute: {
      identity: identityRefs,
      activeItems: outfitRef,
      world: ['prepAnchor'],
      continuity: ['prepAnchor'],
      optional: ['prepScene'],
      forbiddenSources: ['venueScene'],
      maxReferences: 7,
    },
    promptBlocks: [
      ...sharedIdentityRules,
      ...sharedOutfitRules,
      `Camera motivation: she wanted to record the outfit choice before changing.
Show a believable presentation: holding the look up, checking it against herself, or arranging it naturally on a bed/chair while remaining part of the frame.
The action must signal anticipation, not product demonstration.`,
      ...sharedOrganicRules,
    ],
  },
  {
    id: 'NIGHTOUT_TRYON_DETAIL',
    beat: 'transform',
    role: 'TRANSFORMATION DETAIL',
    primitive: 'styling_adjustment',
    purpose: 'Show a physically plausible transition into the outfit through one meaningful material or fit detail.',
    psychologicalIntent: {
      primaryDrive: 'attraction_self_presentation',
      secondaryDrives: ['care_self_regulation'],
      desiredIdentity: ['detail-oriented', 'self-aware'],
      desiredFeeling: ['focus', 'satisfaction'],
      desiredExperience: ['fine-tuning a look before leaving'],
      socialFantasy: 'Getting ready is part of the pleasure of going out.',
      cameraMotivation: 'The fit or texture looked especially good while she adjusted it.',
      audienceProjection: 'She knows how to style herself.',
    },
    captureMode: 'detail',
    awareness: 'aware_candid',
    productRole: 'hero',
    required: ['hands performing one adjustment', 'outfit material and fit readable', 'prep room trace visible'],
    forbidden: ['floating hands', 'multiple simultaneous adjustments', 'finished catalog pose', 'different room'],
    referenceRoute: {
      identity: identityRefs,
      activeItems: outfitRef,
      world: ['prepAnchor'],
      continuity: ['prepAnchor'],
      optional: [],
      forbiddenSources: ['venueScene'],
      maxReferences: 7,
    },
    promptBlocks: [
      ...sharedIdentityRules,
      ...sharedOutfitRules,
      `Choose exactly one real styling action: adjust a sleeve, neckline, closure, hem, waistband, shoe strap or included accessory.
Frame close enough to read material and action, but preserve enough body and room context to avoid ecommerce detail photography.`,
      ...sharedOrganicRules,
    ],
  },
  {
    id: 'NIGHTOUT_HOME_MIRROR_CHECK',
    beat: 'validate',
    role: 'FINAL LOOK VALIDATION',
    primitive: 'full_body_mirror_check',
    purpose: 'Deliver the transformation payoff in the preparation world.',
    psychologicalIntent: {
      primaryDrive: 'attraction_self_presentation',
      secondaryDrives: ['status_control'],
      desiredIdentity: ['confident', 'put-together'],
      desiredFeeling: ['self-approval', 'readiness'],
      desiredExperience: ['the final check before leaving'],
      socialFantasy: 'The viewer wants to feel the same “I look good” confirmation.',
      cameraMotivation: 'The completed look felt too good not to capture.',
      audienceProjection: 'She is ready and knows the look works.',
    },
    captureMode: 'mirror_selfie',
    awareness: 'intentional_social',
    productRole: 'hero',
    required: ['phone visible in mirror', 'full outfit readable', 'coherent mirror geometry', 'same prep world'],
    forbidden: ['third-person view pretending to be selfie', 'floating mirror', 'venue restroom', 'outfit incomplete'],
    referenceRoute: {
      identity: identityRefs,
      activeItems: outfitRef,
      world: ['prepAnchor'],
      continuity: ['prepAnchor'],
      optional: ['prepScene'],
      forbiddenSources: ['venueScene'],
      maxReferences: 7,
    },
    promptBlocks: [
      ...sharedIdentityRules,
      ...sharedOutfitRules,
      `A real full-body mirror selfie inside the established preparation room.
The phone is visibly held in one hand and reflected in the same mirror used to see the outfit.
Mirror, floor, body and furniture geometry must agree.
Expression and posture communicate genuine self-approval, not a mannequin stance.`,
      ...sharedOrganicRules,
    ],
  },
  {
    id: 'NIGHTOUT_VENUE_SETTLED',
    beat: 'experience',
    role: 'LIVED NIGHT OUT',
    primitive: 'seated_everyday',
    purpose: 'Move from preparation to a night already in progress.',
    psychologicalIntent: {
      primaryDrive: 'exploration_pleasure',
      secondaryDrives: ['status_control', 'belonging_social_validation'],
      desiredIdentity: ['social', 'comfortable in premium spaces'],
      desiredFeeling: ['pleasure', 'confidence'],
      desiredExperience: ['being out and enjoying the evening'],
      socialFantasy: 'The outfit belongs to a life with places and moments worth attending.',
      cameraMotivation: 'A friend captured her once she was relaxed and enjoying the night.',
      audienceProjection: 'She is not merely dressed; she is living the occasion.',
    },
    captureMode: 'friend_pov',
    awareness: 'aware_candid',
    productRole: 'integrated',
    required: ['evidence time has passed', 'outfit readable', 'venue context', 'relaxed posture'],
    forbidden: ['artificial arrival pose', 'untouched staged table', 'prep-room furniture', 'studio nightlife'],
    referenceRoute: {
      identity: identityRefs,
      activeItems: outfitRef,
      world: ['venueScene'],
      continuity: [],
      optional: ['prepAnchor'],
      forbiddenSources: ['prepSceneAsVenue'],
      maxReferences: 7,
    },
    promptBlocks: [
      ...sharedIdentityRules,
      ...sharedOutfitRules,
      `The night is already underway. Include one or two credible time signals: partially consumed drink, used napkin, shifted chair, active conversation or food already started.
The outfit remains legible but is integrated into the lived venue moment.`,
      ...sharedOrganicRules,
    ],
  },
  {
    id: 'NIGHTOUT_SOCIAL_CONNECTION',
    beat: 'connect',
    role: 'GENUINE CONNECTION',
    primitive: 'social_outfit_moment',
    purpose: 'Show belonging and friendship rather than a staged group portrait.',
    psychologicalIntent: {
      primaryDrive: 'belonging_social_validation',
      secondaryDrives: ['exploration_pleasure', 'attraction_self_presentation'],
      desiredIdentity: ['liked', 'socially connected', 'confident'],
      desiredFeeling: ['warmth', 'joy'],
      desiredExperience: ['a real girls-night memory'],
      socialFantasy: 'Both people would be happy to post the photograph.',
      cameraMotivation: 'A third person caught a genuine exchange or shared laugh.',
      audienceProjection: 'She has a close social circle and memorable nights.',
    },
    captureMode: 'third_person_candid',
    awareness: 'unaware',
    productRole: 'integrated',
    required: ['maximum one companion', 'interaction between people', 'distinct companion identity', 'outfit readable enough'],
    forbidden: ['both staring at camera', 'cloned faces', 'more than one companion', 'identical body/face', 'duplicated drinks'],
    referenceRoute: {
      identity: identityRefs,
      activeItems: outfitRef,
      world: ['venueScene'],
      continuity: [],
      optional: ['companion'],
      forbiddenSources: ['prepAnchorAsScene'],
      maxReferences: 8,
    },
    promptBlocks: [
      ...sharedIdentityRules,
      ...sharedOutfitRules,
      `Show exactly one companion. If no companion reference exists, create a clearly distinct secondary person or use a solo social alternative; never clone the protagonist.
The main action is interaction between them: talking, laughing, leaning closer or reacting to each other.
Assign any drink or prop to one exact hand and keep the other hand free.`,
      ...sharedOrganicRules,
    ],
  },
  {
    id: 'NIGHTOUT_VENUE_PAUSE',
    beat: 'reflect',
    role: 'UNGUARDED PAUSE',
    primitive: 'full_body_mirror_check',
    purpose: 'Create a later-night in-between moment that is clearly different from the home mirror check.',
    psychologicalIntent: {
      primaryDrive: 'care_self_regulation',
      secondaryDrives: ['attraction_self_presentation'],
      desiredIdentity: ['self-aware', 'comfortable with herself'],
      desiredFeeling: ['intimacy', 'satisfaction'],
      desiredExperience: ['a private pause during a social night'],
      socialFantasy: 'Even the in-between moments feel worth remembering.',
      cameraMotivation: 'She checked herself in the venue restroom and saved a less-polished moment.',
      audienceProjection: 'The night has history and time has passed.',
    },
    captureMode: 'mirror_selfie',
    awareness: 'intentional_social',
    productRole: 'integrated',
    required: ['phone visible', 'venue restroom geometry', 'later-night signals', 'unguarded expression'],
    forbidden: ['same room as home check', 'identical pose to prior mirror shot', 'perfect beauty-ad expression'],
    referenceRoute: {
      identity: identityRefs,
      activeItems: outfitRef,
      world: ['venueScene'],
      continuity: [],
      optional: [],
      forbiddenSources: ['prepAnchorAsScene'],
      maxReferences: 7,
    },
    promptBlocks: [
      ...sharedIdentityRules,
      ...sharedOutfitRules,
      `This is a venue-restroom mirror selfie, not the home mirror check.
Use different lighting, posture and emotional state. The phone is visible.
Include subtle evidence of time: slightly relaxed hair, softened makeup, used counter area or a less formal posture.
Keep the person attractive and recognizable without beauty-ad polish.`,
      ...sharedOrganicRules,
    ],
  },
  {
    id: 'NIGHTOUT_CLOSURE',
    beat: 'close',
    role: 'END OF NIGHT',
    primitive: 'end_of_event_closure',
    purpose: 'Close with ownership, motion or satisfied reflection.',
    psychologicalIntent: {
      primaryDrive: 'status_control',
      secondaryDrives: ['exploration_pleasure'],
      desiredIdentity: ['independent', 'confident', 'memorable'],
      desiredFeeling: ['satisfaction', 'freedom'],
      desiredExperience: ['the emotional residue of a good night'],
      socialFantasy: 'The viewer imagines having a night worth closing this way.',
      cameraMotivation: 'The last light, street or ride-home moment felt like the right ending.',
      audienceProjection: 'She owned the night and leaves with a memory.',
    },
    captureMode: 'friend_pov',
    awareness: 'aware_candid',
    productRole: 'integrated',
    required: ['solo protagonist', 'night context', 'closure signal', 'natural motion or pause'],
    forbidden: ['new group', 'catalog full-body pose', 'forced cinematic drama', 'unrelated daylight'],
    referenceRoute: {
      identity: identityRefs,
      activeItems: outfitRef,
      world: ['venueScene'],
      continuity: [],
      optional: ['streetScene'],
      forbiddenSources: ['prepScene'],
      maxReferences: 7,
    },
    promptBlocks: [
      ...sharedIdentityRules,
      ...sharedOutfitRules,
      `Create a believable end-of-night photograph: leaving, waiting for a ride, walking, looking back, sitting briefly, or holding shoes only if the referenced outfit and action make this physically plausible.
The emotional read is satisfied and self-possessed, not vulnerable or theatrically dramatic.`,
      ...sharedOrganicRules,
    ],
  },
];

const compression: Record<number, string[]> = {
  3: ['NIGHTOUT_PRESENTATION', 'NIGHTOUT_HOME_MIRROR_CHECK', 'NIGHTOUT_VENUE_SETTLED'],
  4: ['NIGHTOUT_PRESENTATION', 'NIGHTOUT_HOME_MIRROR_CHECK', 'NIGHTOUT_VENUE_SETTLED', 'NIGHTOUT_CLOSURE'],
  5: ['NIGHTOUT_PRESENTATION', 'NIGHTOUT_TRYON_DETAIL', 'NIGHTOUT_HOME_MIRROR_CHECK', 'NIGHTOUT_VENUE_SETTLED', 'NIGHTOUT_CLOSURE'],
  6: ['NIGHTOUT_PRESENTATION', 'NIGHTOUT_TRYON_DETAIL', 'NIGHTOUT_HOME_MIRROR_CHECK', 'NIGHTOUT_VENUE_SETTLED', 'NIGHTOUT_SOCIAL_CONNECTION', 'NIGHTOUT_CLOSURE'],
  7: shots.map((shot) => shot.id),
};

export const OUTFIT_NIGHT_OUT_RECIPE: PhotodumpRecipeDefinition = {
  metadata: {
    id: 'fashion.outfit_night_out',
    displayName: 'Outfit — Night Out',
    category: 'fashion',
    version: '2.0.0-normalized',
    status: 'NORMALIZED',
    minShots: 3,
    recommendedShots: 7,
    maxShots: 7,
  },
  inputContract: {
    outfitNight: {
      status: 'required',
      maxCount: 1,
      description: 'Complete night-out outfit or a clearly documented set of pieces.',
    },
    avatarFace: {
      status: 'optional',
      maxCount: 1,
      description: 'Facial identity. When absent, create and lock an identity in the prep anchor.',
    },
    avatarBody: {
      status: 'optional',
      maxCount: 1,
      description: 'Body silhouette. When absent, create and lock a body in the prep anchor.',
    },
    prepScene: {
      status: 'optional',
      maxCount: 1,
      description: 'Preparation room reference.',
    },
    venueScene: {
      status: 'optional',
      maxCount: 1,
      description: 'Venue reference. When absent, infer from the brief without reusing prep-room geometry.',
    },
    companion: {
      status: 'optional',
      maxCount: 1,
      description: 'One companion reference for the social shot.',
    },
    brief: {
      status: 'recommended',
      description: 'Minimal context such as girls night, dinner, concert or bar.',
    },
  },
  anchor,
  shots,
  compression,
  knownLimitations: [
    'A second-reference visual test is still required before INTEGRATION_READY.',
    'Maximum is intentionally seven visible shots; interpolation beyond seven is not yet validated.',
    'Companion generation without a reference can still produce facial drift and must be manually tested.',
    'Venue continuity needs validation when no venue reference is supplied.',
    'Identity and body fidelity without uploaded references depend entirely on the prep anchor.',
  ],
};

export function selectOutfitNightOutShots(count: number): RecipeShotTemplate[] {
  const safeCount = Math.max(3, Math.min(7, Math.floor(count || 7)));
  const ids = compression[safeCount];
  return ids.map((id) => {
    const shot = shots.find((candidate) => candidate.id === id);
    if (!shot) throw new Error(`Missing outfit_night_out shot template: ${id}`);
    return shot;
  });
}

export function buildOutfitNightOutPrompt(shot: RecipeShotTemplate): string {
  return [
    `RECIPE: ${OUTFIT_NIGHT_OUT_RECIPE.metadata.id}`,
    `SHOT: ${shot.id} · ${shot.role}`,
    `PURPOSE: ${shot.purpose}`,
    `CAMERA MOTIVATION: ${shot.psychologicalIntent.cameraMotivation}`,
    `DESIRED IDENTITY: ${shot.psychologicalIntent.desiredIdentity.join(', ')}`,
    `DESIRED FEELING: ${shot.psychologicalIntent.desiredFeeling.join(', ')}`,
    `DESIRED EXPERIENCE: ${shot.psychologicalIntent.desiredExperience.join(', ')}`,
    `CAPTURE: ${shot.captureMode} · ${shot.awareness}`,
    `PRODUCT ROLE: ${shot.productRole}`,
    `REQUIRED: ${shot.required.join(', ')}`,
    `FORBIDDEN: ${shot.forbidden.join(', ')}`,
    ...shot.promptBlocks,
  ].join('\n\n');
}
