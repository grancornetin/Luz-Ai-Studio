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
var shotPool_exports = {};
__export(shotPool_exports, {
  MIRROR_CHECK_CONTRACT: () => MIRROR_CHECK_CONTRACT,
  PRESENTATION_CONTRACT: () => PRESENTATION_CONTRACT,
  TRYON_DETAIL_CONTRACT: () => TRYON_DETAIL_CONTRACT
});
module.exports = __toCommonJS(shotPool_exports);
const PRESENTATION_CONTRACT = {
  shotId: "presentation",
  cameraGrammar: { framing: "MEDIUM_FULL", angle: "eye_level", composition: "garment_presentation" },
  referencePolicy: { useIdentityRef: true, useBodyRef: true, useOutfitRefs: true },
  hpiPoseFamily: null,
  footwearVisible: false
};
const TRYON_DETAIL_CONTRACT = {
  shotId: "tryon_detail",
  cameraGrammar: { framing: "MEDIUM_CLOSE", angle: "eye_level", composition: "styling_adjustment" },
  referencePolicy: { useIdentityRef: true, useBodyRef: true, useOutfitRefs: true },
  hpiPoseFamily: null,
  footwearVisible: false
};
const MIRROR_CHECK_CONTRACT = {
  shotId: "mirror_check",
  cameraGrammar: { framing: "FULL_BODY", angle: "eye_level", composition: "mirror_selfie" },
  referencePolicy: { useIdentityRef: true, useBodyRef: true, useOutfitRefs: true },
  hpiPoseFamily: "STANDING_ASYMMETRIC_FASHION_POSE",
  hpiCameraFamily: "MIRROR_SELFIE_REFLECTION",
  footwearVisible: true
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  MIRROR_CHECK_CONTRACT,
  PRESENTATION_CONTRACT,
  TRYON_DETAIL_CONTRACT
});
