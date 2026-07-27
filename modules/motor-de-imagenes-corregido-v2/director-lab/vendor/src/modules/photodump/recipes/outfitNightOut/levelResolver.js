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
var levelResolver_exports = {};
__export(levelResolver_exports, {
  resolveShotsForLevel: () => resolveShotsForLevel
});
module.exports = __toCommonJS(levelResolver_exports);
var import_shotPool = require("./shotPool");
var import_nightMoments = require("./nightMoments");
const NIGHT_MOMENT_COUNT_BY_LEVEL = {
  corto: 2,
  completo: 3,
  extendido: 4
};
function resolveShotsForLevel(level, seed, hasCompanion, energy) {
  const momentCount = NIGHT_MOMENT_COUNT_BY_LEVEL[level];
  const nightMoments = (0, import_nightMoments.pickNightMomentsForSet)(seed, momentCount, hasCompanion, energy);
  const fixedShots = level === "extendido" ? [import_shotPool.PRESENTATION_CONTRACT, import_shotPool.TRYON_DETAIL_CONTRACT, import_shotPool.MIRROR_CHECK_CONTRACT] : level === "completo" ? [import_shotPool.MIRROR_CHECK_CONTRACT, import_shotPool.TRYON_DETAIL_CONTRACT] : [import_shotPool.MIRROR_CHECK_CONTRACT];
  return [
    ...fixedShots.map((fixedContract) => ({ fixedContract })),
    ...nightMoments.map((nightMoment) => ({ nightMoment }))
  ];
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  resolveShotsForLevel
});
