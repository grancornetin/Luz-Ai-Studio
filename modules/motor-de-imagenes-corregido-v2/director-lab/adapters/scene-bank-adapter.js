'use strict';

const fs = require('fs');
const path = require('path');

const SCENE_BANK_FILE = path.join(__dirname, '..', 'data', 'scene-bank.json');

const BANK_ID = 'scene_bank';

function loadRaw() {
  if (!fs.existsSync(SCENE_BANK_FILE)) {
    return { schemaVersion: null, updatedAt: null, scenes: [] };
  }
  return JSON.parse(fs.readFileSync(SCENE_BANK_FILE, 'utf8'));
}

// Taxonomía real observada en campaign-trainer-data/scene-bank.json: 'approved' | 'needs_review' | 'candidate'.
// No existe 'rejected' ni 'pending_review' literal en los datos actuales; 'needs_review' y 'candidate'
// se tratan como no-elegibles por defecto (equivalentes a "pendiente de curación"), salvo referencia fuerte.
const DEFAULT_ELIGIBLE_STATUSES = ['approved'];

function isEligible(scene, { allowPendingReview = false } = {}) {
  if (DEFAULT_ELIGIBLE_STATUSES.includes(scene.status)) return true;
  if ((scene.strongReferenceCount || 0) > 0) return true;
  return !!allowPendingReview;
}

function toCandidate(scene) {
  return {
    domain: 'scene',
    sourceBank: BANK_ID,
    sourceId: scene.sceneId,
    name: scene.sceneIdentity && scene.sceneIdentity.displayNameEs || scene.name,
    curationStatus: scene.status,
    strongReference: (scene.strongReferenceCount || 0) > 0,
    confidence: scene.confidence || 0,
    evidenceCount: scene.evidenceCount || 0,
    sourceText: scene.scenePromptBlock || '',
    capabilities: scene.capabilities || {},
    lightingEnvironment: scene.lightingEnvironment || {},
    compatibleUses: scene.compatibleUses || [],
    limitations: scene.limitations || [],
    contaminationRisks: scene.contaminationRisks || [],
    sceneFamily: scene.sceneIdentity && scene.sceneIdentity.sceneFamily,
    settingCategory: scene.sceneIdentity && scene.sceneIdentity.settingCategory,
    thumbnailImageId: scene.representativeImageId || null
  };
}

function getStatus() {
  const raw = loadRaw();
  const scenes = raw.scenes || [];
  return {
    bankId: BANK_ID,
    available: fs.existsSync(SCENE_BANK_FILE),
    schemaVersion: raw.schemaVersion || null,
    updatedAt: raw.updatedAt || null,
    total: scenes.length,
    byStatus: scenes.reduce((acc, scene) => {
      acc[scene.status] = (acc[scene.status] || 0) + 1;
      return acc;
    }, {})
  };
}

function search(query = {}, filters = {}) {
  const raw = loadRaw();
  const scenes = raw.scenes || [];
  const text = (query.text || '').toLowerCase();
  return scenes
    .filter(scene => isEligible(scene, filters))
    .filter(scene => {
      if (!text) return true;
      const haystack = [
        scene.name,
        scene.scenePromptBlock,
        scene.sceneIdentity && scene.sceneIdentity.settingCategory,
        scene.sceneIdentity && scene.sceneIdentity.locationConcept
      ].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(text);
    })
    .filter(scene => {
      if (filters.settingCategory && scene.sceneIdentity) {
        return scene.sceneIdentity.settingCategory === filters.settingCategory;
      }
      return true;
    })
    .filter(scene => {
      if (filters.supportsFullBody && scene.capabilities) {
        return scene.capabilities.supportsFullBody === 'yes';
      }
      return true;
    })
    .map(toCandidate);
}

function getEntry(entryId) {
  const raw = loadRaw();
  const scene = (raw.scenes || []).find(item => item.sceneId === entryId);
  return scene ? toCandidate(scene) : null;
}

module.exports = { BANK_ID, getStatus, search, getEntry };
