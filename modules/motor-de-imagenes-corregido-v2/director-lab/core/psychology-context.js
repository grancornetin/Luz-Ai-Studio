'use strict';

const fs = require('fs');
const path = require('path');

// Marco de psicología de venta de Photodump ("vender sin vender") — se lee
// directamente del manifiesto real, no se reescribe a mano, para que si el
// documento cambia, el contexto que recibe Gemini se actualice solo.
const PSYCHOLOGY_MD_PATH = path.join(
  __dirname, '..', '..', '..', '..',
  'src', 'modules', 'photodump', 'recipes', 'manifiesto de direccion',
  '02_the_psychology_behind_photodump_v2.md'
);

// psychologicalIntent por shot de outfit_night_out, portado tal cual desde el
// diseño validado a mano en manifiesto/05_outfit_night_out.normalized.ts
// (nunca se compiló al código real de shotPool.ts/nightMoments.ts). Mapeado
// por shotId real de la implementación en producción (ver shotPool.ts /
// nightMoments.ts) — no por el id NIGHTOUT_* del documento original.
const PSYCHOLOGICAL_INTENT_BY_SHOT = {
  presentation: {
    primaryDrive: 'attraction_self_presentation',
    secondaryDrives: ['exploration_pleasure', 'status_control'],
    desiredIdentity: ['intentional', 'stylish', 'socially confident'],
    desiredFeeling: ['anticipation', 'excitement'],
    desiredExperience: ['getting ready for a memorable night'],
    socialFantasy: 'The viewer wants to participate in the preparation and see the final look.',
    cameraMotivation: 'The outfit choice felt exciting enough to share before putting it on.',
    audienceProjection: 'She plans her looks and has somewhere worth going.'
  },
  tryon_detail: {
    primaryDrive: 'attraction_self_presentation',
    secondaryDrives: ['care_self_regulation'],
    desiredIdentity: ['detail-oriented', 'self-aware'],
    desiredFeeling: ['focus', 'satisfaction'],
    desiredExperience: ['fine-tuning a look before leaving'],
    socialFantasy: 'Getting ready is part of the pleasure of going out.',
    cameraMotivation: 'The fit or texture looked especially good while she adjusted it.',
    audienceProjection: 'She knows how to style herself.'
  },
  mirror_check: {
    primaryDrive: 'attraction_self_presentation',
    secondaryDrives: ['status_control'],
    desiredIdentity: ['confident', 'put-together'],
    desiredFeeling: ['self-approval', 'readiness'],
    desiredExperience: ['the final check before leaving'],
    socialFantasy: 'The viewer wants to feel the same "I look good" confirmation.',
    cameraMotivation: 'The completed look felt too good not to capture.',
    audienceProjection: 'She is ready and knows the look works.'
  },
  // Night moments (posed_portrait/ambient_only/motion_energy/pov_legs/car_transition)
  // no tienen un shot 1:1 en el documento original (ese diseño era una secuencia
  // fija de 7-8 shots; la implementación real usa un banco rotable). Se les
  // asigna el intent más cercano por función narrativa real:
  posed_portrait: {
    primaryDrive: 'exploration_pleasure',
    secondaryDrives: ['status_control', 'belonging_social_validation'],
    desiredIdentity: ['social', 'comfortable in premium spaces'],
    desiredFeeling: ['pleasure', 'confidence'],
    desiredExperience: ['being out and enjoying the evening'],
    socialFantasy: 'The outfit belongs to a life with places and moments worth attending.',
    cameraMotivation: 'A friend captured her once she was relaxed and enjoying the night.',
    audienceProjection: 'She is not merely dressed; she is living the occasion.'
  },
  group_moment: {
    primaryDrive: 'belonging_social_validation',
    secondaryDrives: ['exploration_pleasure', 'attraction_self_presentation'],
    desiredIdentity: ['liked', 'socially connected', 'confident'],
    desiredFeeling: ['warmth', 'joy'],
    desiredExperience: ['a real girls-night memory'],
    socialFantasy: 'Both people would be happy to post the photograph.',
    cameraMotivation: 'A third person caught a genuine exchange or shared laugh.',
    audienceProjection: 'She has a close social circle and memorable nights.'
  },
  ambient_only: {
    primaryDrive: 'exploration_pleasure',
    secondaryDrives: ['status_control'],
    desiredIdentity: ['present', 'attentive to atmosphere'],
    desiredFeeling: ['immersion', 'anticipation'],
    desiredExperience: ['soaking in the venue before or during the night'],
    socialFantasy: 'The place itself is worth remembering.',
    cameraMotivation: 'The atmosphere or view was striking enough to capture on its own.',
    audienceProjection: 'She notices and values good spaces.'
  },
  motion_energy: {
    primaryDrive: 'exploration_pleasure',
    secondaryDrives: ['belonging_social_validation'],
    desiredIdentity: ['fun', 'alive', 'spontaneous'],
    desiredFeeling: ['excitement', 'joy'],
    desiredExperience: ['the peak energy of the night'],
    socialFantasy: 'The night had a real high point worth remembering.',
    cameraMotivation: 'Someone caught a genuine burst of energy mid-moment.',
    audienceProjection: 'She has a good time, not just a good outfit.'
  },
  pov_legs: {
    primaryDrive: 'attraction_self_presentation',
    secondaryDrives: [],
    desiredIdentity: ['stylish', 'detail-aware'],
    desiredFeeling: ['satisfaction'],
    desiredExperience: ['noticing how the look reads from her own point of view'],
    socialFantasy: 'The outfit looks as good from her perspective as from anyone else\'s.',
    cameraMotivation: 'She glanced down and the look/shoes caught her own eye.',
    audienceProjection: 'She is genuinely pleased with the look, not just performing it.'
  },
  car_transition: {
    primaryDrive: 'exploration_pleasure',
    secondaryDrives: ['status_control'],
    desiredIdentity: ['composed', 'in transit to something worthwhile'],
    desiredFeeling: ['anticipation'],
    desiredExperience: ['the in-between moment of getting to the night'],
    socialFantasy: 'The night has stops and a real arc, not just one static scene.',
    cameraMotivation: 'The ride there felt like part of the story worth capturing.',
    audienceProjection: 'She has somewhere to be and a way of getting there.'
  }
};

let cachedPsychologyText = null;

function getPsychologyFrameworkText() {
  if (cachedPsychologyText !== null) return cachedPsychologyText;
  try {
    cachedPsychologyText = fs.readFileSync(PSYCHOLOGY_MD_PATH, 'utf8');
  } catch (err) {
    cachedPsychologyText = '';
  }
  return cachedPsychologyText;
}

function getPsychologicalIntent(shotId) {
  return PSYCHOLOGICAL_INTENT_BY_SHOT[shotId] || null;
}

module.exports = { getPsychologyFrameworkText, getPsychologicalIntent, PSYCHOLOGICAL_INTENT_BY_SHOT };
