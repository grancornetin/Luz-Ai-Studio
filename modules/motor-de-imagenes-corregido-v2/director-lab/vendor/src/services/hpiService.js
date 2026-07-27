var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
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
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var hpiService_exports = {};
__export(hpiService_exports, {
  buildHpiBlock: () => buildHpiBlock,
  getHpiNegatives: () => getHpiNegatives,
  initHpiService: () => initHpiService,
  resetHpiSessionMemory: () => resetHpiSessionMemory
});
module.exports = __toCommonJS(hpiService_exports);
let _female = {};
let _male = {};
let _loaded = false;
async function ensureLoaded() {
  if (_loaded) return;
  _loaded = true;
  try {
    const mod = await Promise.resolve(require("../data/HPI/03_reglas_director_hpi_mujer_151.json"));
    _female = mod.default ?? mod;
  } catch {
    _female = {};
  }
  try {
    const mod = await Promise.resolve(require("../data/HPI/03_reglas_director_hpi_51 hombre.json"));
    _male = mod.default ?? mod;
  } catch {
    _male = {};
  }
}
function initHpiService() {
  ensureLoaded().catch(() => {
  });
}
const RECENT_HISTORY_SIZE = 4;
const _recentByBank = {};
function rememberFamily(bankKey, familyId) {
  if (!familyId) return;
  const history = _recentByBank[bankKey] ?? (_recentByBank[bankKey] = []);
  history.push(familyId);
  if (history.length > RECENT_HISTORY_SIZE) history.shift();
}
function resetHpiSessionMemory() {
  for (const key of Object.keys(_recentByBank)) delete _recentByBank[key];
}
function getBank(gender) {
  if (gender === "male") return _male;
  if (gender === "female") return _female;
  return _female;
}
function pickFamily(bank, options = {}) {
  if (!bank || bank.length === 0) return null;
  const { allowedFamilyIds, preferFamilyIds, preferTags, requireActionMatch, sessionBankKey } = options;
  const scoped = allowedFamilyIds ? bank.filter((f) => allowedFamilyIds.includes(f.familyId)) : bank;
  if (scoped.length === 0) return null;
  const stable = scoped.filter((f) => f.quality === "stable_family");
  let pool = stable.length > 0 ? stable : scoped;
  if (requireActionMatch) {
    pool = pool.filter(
      (f) => f.amplifiesAction === "none" || f.amplifiesAction != null && requireActionMatch.includes(f.amplifiesAction)
    );
    if (pool.length === 0) return null;
  }
  if (preferFamilyIds && preferFamilyIds.length > 0) {
    const compatible = pool.filter((f) => preferFamilyIds.includes(f.familyId));
    if (compatible.length > 0) pool = compatible;
  }
  if (preferTags && preferTags.length > 0) {
    const tagged = pool.filter(
      (f) => (f.dominantTags ?? []).some((tag) => preferTags.includes(tag))
    );
    if (tagged.length > 0) pool = tagged;
  }
  if (sessionBankKey) {
    const recent = _recentByBank[sessionBankKey] ?? [];
    const fresh = pool.filter((f) => !recent.includes(f.familyId));
    if (fresh.length > 0) pool = fresh;
  }
  const chosen = pool[Math.floor(Math.random() * pool.length)];
  if (sessionBankKey) rememberFamily(sessionBankKey, chosen?.familyId);
  return chosen;
}
function extractPromptText(family) {
  if (!family) return "";
  const raw = family.promptBlocks?.basePromptBlock ?? family.mechanics?.baseDirectives ?? family.mechanics?.summary ?? "";
  if (!raw) return "";
  const sentences = raw.split(/\.\s+/).slice(0, 3).join(". ").trim();
  return sentences.endsWith(".") ? sentences : sentences + ".";
}
function extractSafeGuards(family) {
  if (!family) return [];
  const safe = family.promptBlocks?.safePromptBlock ?? "";
  if (!safe) return [];
  return safe.split(";").map((s) => s.trim()).filter(Boolean).slice(0, 2);
}
function buildHpiBlock(config) {
  if (!config.enabled) return "";
  const bank = getBank(config.gender);
  const posebank = config.gender === "neutral" ? _male : bank;
  const sessionScope = `${config.gender}`;
  const contextTags = config.contextTags;
  const poseFamily = pickFamily(posebank.poseBanks, {
    allowedFamilyIds: config.allowedFamilies?.pose,
    preferTags: contextTags,
    sessionBankKey: `pose:${sessionScope}`
  });
  const poseCompatible = poseFamily?.compatibleFamilies;
  const poseHandActions = poseFamily?.handActions;
  const expressionFamily = pickFamily(bank.expressionBanks, {
    preferTags: contextTags,
    sessionBankKey: `expression:${sessionScope}`
  });
  const cameraFamily = pickFamily(bank.cameraRelationshipBanks, {
    allowedFamilyIds: config.allowedFamilies?.camera,
    preferFamilyIds: config.allowedFamilies?.camera ? void 0 : poseCompatible,
    sessionBankKey: `camera:${sessionScope}`
  });
  const gestureFamily = config.includeGesture ? pickFamily(bank.gestureBanks, {
    allowedFamilyIds: config.allowedFamilies?.gesture,
    requireActionMatch: !config.allowedFamilies?.gesture && poseHandActions ? poseHandActions : void 0,
    preferFamilyIds: config.allowedFamilies?.gesture ? void 0 : poseCompatible,
    sessionBankKey: `gesture:${sessionScope}`
  }) : null;
  const performanceFamily = config.includePerformance ? pickFamily(bank.performanceBanks, {
    preferFamilyIds: poseCompatible,
    preferTags: contextTags,
    sessionBankKey: `performance:${sessionScope}`
  }) : null;
  const amplifiers = (bank.amplifierBanks ?? []).slice(0, 2).map((a) => a.mechanics?.summary ?? a.familyId).filter(Boolean);
  const expressionText = extractPromptText(expressionFamily);
  const poseText = extractPromptText(poseFamily);
  const cameraText = extractPromptText(cameraFamily);
  const gestureText = extractPromptText(gestureFamily);
  const performanceText = extractPromptText(performanceFamily);
  const ampText = amplifiers.slice(0, 2).join(" \xB7 ");
  if (!expressionText && !poseText && !cameraText) return "";
  const sections = [];
  if (expressionText) sections.push(`EXPRESSION: ${expressionText}`);
  if (poseText) sections.push(`BODY POSE: ${poseText}`);
  if (gestureText) sections.push(`GESTURE: ${gestureText}`);
  if (cameraText) sections.push(`CAMERA RELATIONSHIP: ${cameraText}`);
  if (performanceText) sections.push(`PERFORMANCE INTENT: ${performanceText}`);
  if (ampText) sections.push(`VISUAL AMPLIFIERS: ${ampText}`);
  const safeguards = [
    ...extractSafeGuards(gestureFamily),
    ...extractSafeGuards(expressionFamily)
  ].slice(0, 2);
  if (safeguards.length > 0) {
    sections.push(`ANATOMICAL SAFEGUARDS: ${safeguards.join(" ")}`);
  }
  return [
    "\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550",
    "\u2726 HUMAN PERFORMANCE INTELLIGENCE (HPI) LAYER",
    "\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550",
    "This layer guides human expression, pose, gesture, and camera",
    "relationship ONLY. It does NOT override identity locks, product",
    "locks, or outfit locks defined elsewhere in this prompt.",
    "Transfer visual conduct \u2014 NOT identity, face, body, or clothing.",
    "",
    ...sections,
    "\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550"
  ].join("\n");
}
function getHpiNegatives(gender = "female") {
  const bank = getBank(gender);
  const rules = bank.riskRules ?? [];
  const hints = [];
  for (const rule of rules) {
    if (rule.negativePromptHints) hints.push(...rule.negativePromptHints);
    if (rule.globalSafeguards) hints.push(...rule.globalSafeguards);
  }
  const always = [
    "extra fingers",
    "missing fingers",
    "merged fingers",
    "wrong number of fingers",
    "deformed hands",
    "dead eyes",
    "frozen expression",
    "stiff pose",
    "exaggerated pout",
    "duck lips",
    "fake smile",
    "mannequin expression",
    "disconnected body parts",
    "distorted proportions"
  ];
  const all = Array.from(/* @__PURE__ */ new Set([...always, ...hints]));
  return all.slice(0, 20);
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  buildHpiBlock,
  getHpiNegatives,
  initHpiService,
  resetHpiSessionMemory
});
