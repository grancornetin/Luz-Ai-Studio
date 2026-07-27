var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var nightMoments_exports = {};
__export(nightMoments_exports, {
  NIGHT_MOMENTS: () => NIGHT_MOMENTS,
  findNightMoment: () => findNightMoment,
  pickNightMomentsForSet: () => pickNightMomentsForSet
});
module.exports = __toCommonJS(nightMoments_exports);
const NIGHT_MOMENTS = [
  {
    id: "posed_portrait",
    contract: {
      shotId: "posed_portrait",
      cameraGrammar: { framing: "MEDIUM_CLOSE", angle: "eye_level", composition: "posed_portrait" },
      referencePolicy: { useIdentityRef: true, useBodyRef: true, useOutfitRefs: true },
      hpiPoseFamily: "SEATED_EDITORIAL_OR_LIFESTYLE_POSE",
      hpiCameraFamily: "OBSERVED_PROFILE_OR_CANDID",
      footwearVisible: false
    },
    sceneBlockByEnergy: {
      elegante: "A posed portrait, medium-close, holding a drink or a small prop close to the body \u2014 glass of wine, cocktail, cup. Warm, intentional lighting. She is looking away from the camera or slightly past it, composed and calm.",
      fiesta: "A posed portrait under colorful venue lighting, holding a drink close to the body \u2014 cocktail, cup, bottle. Playful, confident expression, looking toward or past the camera."
    },
    requiresCompanion: false,
    fiestaOnly: false,
    hasProtagonist: true
  },
  {
    id: "group_moment",
    contract: {
      shotId: "group_moment",
      cameraGrammar: { framing: "MEDIUM_FULL", angle: "eye_level", composition: "group_moment" },
      referencePolicy: { useIdentityRef: true, useBodyRef: true, useOutfitRefs: true, useCompanionRef: true },
      hpiPoseFamily: null,
      footwearVisible: false
    },
    sceneBlockByEnergy: {
      elegante: "A candid moment with one companion \u2014 talking, laughing, or leaning in together at the table. Both people clearly distinct in face and body, genuine interaction, not posed symmetrically for the camera.",
      fiesta: "A candid group moment with one or more companions \u2014 laughing, arms up, celebrating together. Colorful venue lighting, natural unposed energy, each person clearly distinct in face and body."
    },
    requiresCompanion: true,
    fiestaOnly: false,
    hasProtagonist: true
  },
  {
    id: "motion_energy",
    contract: {
      shotId: "motion_energy",
      cameraGrammar: { framing: "MEDIUM_FULL", angle: "eye_level", composition: "motion_energy" },
      referencePolicy: { useIdentityRef: true, useBodyRef: true, useOutfitRefs: true },
      hpiPoseFamily: null,
      hpiCameraFamily: "DYNAMIC_MOTION_CAPTURE_FRAMING",
      footwearVisible: false
    },
    sceneBlockByEnergy: {
      fiesta: "A candid dance-floor moment with genuine motion blur and colorful club lighting (neon, laser, or flash) \u2014 dancing, arms raised, hair in motion. The energy reads as a real captured instant, not a posed photo."
    },
    requiresCompanion: false,
    fiestaOnly: true,
    hasProtagonist: true
  },
  {
    id: "pov_legs",
    contract: {
      shotId: "pov_legs",
      cameraGrammar: { framing: "CLOSE_UP", angle: "looking_down", composition: "pov_legs" },
      referencePolicy: { useIdentityRef: true, useBodyRef: true, useOutfitRefs: true },
      hpiPoseFamily: null,
      hpiCameraFamily: "LOW_ANGLE_SELFIE_POV",
      footwearVisible: true
    },
    sceneBlockByEnergy: {
      elegante: "A first-person point-of-view shot looking down at her own legs and shoes, resting or crossed, with a drink glass visible nearby on a table. No face, no arm holding a phone \u2014 this is literally what she sees looking down.",
      fiesta: "A first-person point-of-view shot looking down at her own legs and shoes, with a drink cup nearby. No face, no arm holding a phone \u2014 this is literally what she sees looking down."
    },
    requiresCompanion: false,
    fiestaOnly: false,
    hasProtagonist: true
  },
  {
    id: "ambient_only",
    contract: {
      shotId: "ambient_only",
      cameraGrammar: { framing: "WIDE", angle: "eye_level", composition: "ambient_only" },
      referencePolicy: { useIdentityRef: false, useBodyRef: false, useOutfitRefs: false },
      hpiPoseFamily: null,
      hpiCameraFamily: "LIFESTYLE_MEDIUM_DISTANCE",
      footwearVisible: false
    },
    sceneBlockByEnergy: {
      elegante: "An ambient shot of the table or venue \u2014 glasses of wine or cocktails, plates, warm lighting. No person in focus, just the atmosphere of the moment.",
      fiesta: "An ambient shot of drinks on a table or bar \u2014 cocktails, cups, bottles, colorful lighting. No person in focus, just the atmosphere of the night."
    },
    requiresCompanion: false,
    fiestaOnly: false,
    hasProtagonist: false
  },
  {
    id: "car_transition",
    contract: {
      shotId: "car_transition",
      cameraGrammar: { framing: "MEDIUM_CLOSE", angle: "eye_level", composition: "car_transition" },
      referencePolicy: { useIdentityRef: false, useBodyRef: false, useOutfitRefs: false },
      hpiPoseFamily: null,
      footwearVisible: false
    },
    sceneBlockByEnergy: {
      elegante: "The interior of a car at night, seen from the passenger view \u2014 dashboard lights, wet or dark windows, city lights outside. No person in frame, just the feeling of the ride there or back.",
      fiesta: "The interior of a car at night, seen from the passenger view \u2014 dashboard lights, city lights or rain outside. No person in frame, just the feeling of the ride there or back."
    },
    requiresCompanion: false,
    fiestaOnly: false,
    hasProtagonist: false
  }
];
function hashString(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = h * 31 + s.charCodeAt(i) | 0;
  }
  return Math.abs(h);
}
function pickDistinctIndices(seed, namespace, count, poolSize) {
  const safeCount = Math.max(0, Math.min(count, poolSize));
  const picked = [];
  const used = /* @__PURE__ */ new Set();
  for (let i = 0; i < safeCount; i++) {
    let idx = hashString(`${seed}::${namespace}::${i}`) % poolSize;
    let attempts = 0;
    while (used.has(idx) && attempts < poolSize) {
      idx = (idx + 1) % poolSize;
      attempts++;
    }
    used.add(idx);
    picked.push(idx);
  }
  return picked;
}
function pickNightMomentsForSet(seed, count, hasCompanion, energy) {
  const pool = NIGHT_MOMENTS.filter((m) => {
    if (m.requiresCompanion && !hasCompanion) return false;
    if (m.fiestaOnly && energy !== "fiesta") return false;
    return true;
  });
  const withProtagonist = pool.filter((m) => m.hasProtagonist);
  const withoutProtagonist = pool.filter((m) => !m.hasProtagonist);
  const safeCount = Math.max(0, Math.min(count, pool.length));
  const preferred = safeCount > 0 && withoutProtagonist.length > 0 ? 1 : 0;
  const floor = Math.max(0, safeCount - withProtagonist.length);
  const noProtagonistCount = Math.min(Math.max(preferred, floor), withoutProtagonist.length, safeCount);
  const protagonistSlots = safeCount - noProtagonistCount;
  const protagonistIndices = pickDistinctIndices(seed, "protagonist", protagonistSlots, withProtagonist.length);
  const noProtagonistIndices = pickDistinctIndices(seed, "no-protagonist", noProtagonistCount, withoutProtagonist.length);
  const picked = [
    ...protagonistIndices.map((idx) => withProtagonist[idx]),
    ...noProtagonistIndices.map((idx) => withoutProtagonist[idx])
  ];
  return picked.map((moment, i) => ({ moment, key: hashString(`${seed}::order::${moment.id}::${i}`) })).sort((a, b) => a.key - b.key).map(({ moment }) => moment);
}
function findNightMoment(id) {
  const moment = NIGHT_MOMENTS.find((m) => m.id === id);
  if (!moment) throw new Error(`NightMoment desconocido: ${id}`);
  return moment;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  NIGHT_MOMENTS,
  findNightMoment,
  pickNightMomentsForSet
});
