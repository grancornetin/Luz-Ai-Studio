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

// ../../src/modules/photodump/recipes/outfitNightOut/promptBuilder.ts
var promptBuilder_exports = {};
__export(promptBuilder_exports, {
  buildShotPrompt: () => buildShotPrompt
});
module.exports = __toCommonJS(promptBuilder_exports);

// ../../src/modules/photodump/recipes/shared.ts
var NEGATIVE_SHORT = `
face replacement, identity change, different person, different face,
different hair color, different hair texture, different eye color,
different bone structure, averaging face with other references,
beautification, skin smoothing, editorial look, studio lighting,
luxury redesign, mannequin pose, catalog stance,
outfit invention, fake fabric, extra clothing, changed shoe design,
different background, scene redesign, person floating over background,
ad feel, commercial polish, branded composition, product catalog look,
composite image, face pasted over body, collage artifact,
phone visible in selfie, color temperature drift, filter drift,
two people in frame, second person in background, crowd in mirror reflection,
duplicated subject, extra person appearing, background figures
`;
var IPHONE_CAMERA_ROLL_LINE = "Camera roll quality: unedited photo, casual handheld feel, everyday smartphone capture, no catalogue finish, no beauty retouching, no editorial polish \u2014 a real, imperfect, authentic photo, not a professionally composed shot.";
var NO_WALKING_LINE = "She is standing still, both feet planted on the ground, not mid-stride \u2014 weight settled mostly on one leg, the other leg relaxed with the knee slightly bent, both feet close to each other, not one foot stepped far ahead of the other.";
var AVOID_EDITORIAL_LINE = "Avoid: editorial or catalog-like finish, overly polished or retouched skin, perfectly centered symmetric composition, walking or mid-stride pose, legs in a walking stance.";
var NO_STUDIO_BACKDROP_LINE = "The background is a real, lived-in domestic or everyday space \u2014 a bedroom, a bathroom, a well-kept hallway, a closet, or a street-level shop window reflection \u2014 never a photography studio, never a seamless backdrop, never a plain concrete or cyclorama floor. It must look like an ordinary room or place someone actually lives in, with a few real, natural details (furniture, wall texture, a mirror frame, soft ambient light) \u2014 but tidy and well cared for, matching someone who dresses with intention and care. Not a blank staged set, but not a messy or cluttered space either.";

// ../../src/modules/photodump/recipes/outfitNightOut/promptBuilder.ts
var import_nightMoments = require("./nightMoments");
var FIXED_SHOT_BLOCKS = {
  presentation: `She is holding up or arranging the night-out outfit \u2014 on a hanger, laid on the bed, or against her own body \u2014 while still wearing her everyday base clothing. This is a "before" moment: the outfit is being shown, not yet worn. The camera motivation is anticipation \u2014 she wanted to record this look before changing into it.`,
  tryon_detail: `A close but not extreme detail of one real styling adjustment \u2014 closing a zipper, adjusting a strap, fixing a hem, buckling a shoe. Hands performing the action, connected naturally to the arm \u2014 never floating. Frame close enough to read the fabric and the action, but keep some body and room context visible.`,
  mirror_check: `A full-body mirror selfie, from head to toe, the complete outfit clearly readable \u2014 the finished, ready-to-leave look. No mirror frame needs to be visible; the raised arm holding the phone, partially covering part of her face, is what reads clearly as a self-taken mirror photo.`
};
function outfitLine(garmentCount, footwearVisible) {
  const base = garmentCount > 1 ? "She is wearing the complete look shown across the outfit reference images \u2014 all pieces combined together as one outfit, fully put on and complete." : "She is wearing the outfit shown in the reference, fully put on and complete.";
  if (footwearVisible) {
    return `${base} This includes the exact shoes/footwear shown in the reference \u2014 same design, color, and style, clearly visible in this shot.`;
  }
  return `${base} The footwear from the reference does not need to be visible in this framing, but every other piece of the outfit must match the reference exactly.`;
}
function venueLine(venueImageUrl, venueTextFallback, hasVenueAnchor) {
  const continuity = hasVenueAnchor ? "SCENE CONTINUITY: this is the SAME venue, shown in the scene reference image \u2014 reuse the exact same background, furniture, and lighting. Do not invent a different place." : "";
  const sceneLine = venueImageUrl ? "The venue is shown in the scene reference image \u2014 replicate its environment, architecture, and lighting as closely as possible, this is the real place, not a similar-looking substitute." : `The venue: ${venueTextFallback}.`;
  return [continuity, sceneLine].filter(Boolean).join("\n");
}
function companionLine(hasCompanion) {
  return hasCompanion ? "" : "\u26A0\uFE0F No companion reference was uploaded \u2014 do NOT invent a second person. Show the protagonist alone in a genuine social-feeling moment instead.";
}
function buildShotPrompt(shotId, intelligence, options) {
  const isFixedPrepShot = shotId === "presentation" || shotId === "tryon_detail" || shotId === "mirror_check";
  let sceneBlock;
  let footwearVisible;
  let extraLine = "";
  if (isFixedPrepShot) {
    sceneBlock = FIXED_SHOT_BLOCKS[shotId];
    footwearVisible = shotId === "mirror_check";
  } else {
    const moment = (0, import_nightMoments.findNightMoment)(shotId);
    sceneBlock = moment.sceneBlockByEnergy[options.energy] ?? moment.sceneBlockByEnergy.elegante ?? "";
    footwearVisible = moment.contract.footwearVisible;
    if (shotId === "group_moment") extraLine = companionLine(options.hasCompanion);
  }
  const lines = isFixedPrepShot ? [
    sceneBlock,
    NO_STUDIO_BACKDROP_LINE,
    outfitLine(options.garmentCount, footwearVisible),
    intelligence.hpiBlock,
    NO_WALKING_LINE,
    IPHONE_CAMERA_ROLL_LINE,
    AVOID_EDITORIAL_LINE
  ] : [
    sceneBlock,
    venueLine(options.venueImageUrl, options.venueTextFallback, options.hasVenueAnchor),
    outfitLine(options.garmentCount, footwearVisible),
    extraLine,
    intelligence.hpiBlock,
    IPHONE_CAMERA_ROLL_LINE,
    AVOID_EDITORIAL_LINE
  ];
  const prompt = lines.filter(Boolean).join("\n\n");
  const negative = intelligence.hpiNegatives.length > 0 ? `${NEGATIVE_SHORT}
${intelligence.hpiNegatives.join(", ")}` : NEGATIVE_SHORT;
  return { prompt, negative };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  buildShotPrompt
});
