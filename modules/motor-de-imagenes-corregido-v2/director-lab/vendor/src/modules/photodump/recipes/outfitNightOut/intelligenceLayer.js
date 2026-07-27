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
var intelligenceLayer_exports = {};
__export(intelligenceLayer_exports, {
  applyIntelligence: () => applyIntelligence
});
module.exports = __toCommonJS(intelligenceLayer_exports);
var import_hpiService = require("../../../../services/hpiService");
function hpiConfigFor(contract, gender) {
  if (!contract.hpiPoseFamily) {
    return { enabled: false, gender, modoVisual: "ugc", includeGesture: false, includePerformance: false };
  }
  return {
    enabled: true,
    gender,
    modoVisual: "ugc",
    includeGesture: false,
    includePerformance: false,
    allowedFamilies: {
      pose: [contract.hpiPoseFamily],
      camera: contract.hpiCameraFamily ? [contract.hpiCameraFamily] : void 0
    }
  };
}
function applyIntelligence(contract, gender) {
  const config = hpiConfigFor(contract, gender);
  const hpiBlock = (0, import_hpiService.buildHpiBlock)(config);
  const hpiNegatives = config.enabled ? (0, import_hpiService.getHpiNegatives)(gender) : [];
  return { hpiBlock, hpiNegatives };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  applyIntelligence
});
