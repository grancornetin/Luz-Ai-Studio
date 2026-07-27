'use strict';

const fs = require('fs');
const path = require('path');

const RULES_FILE = path.join(
  __dirname, '..', 'data', 'director-rules', 'campaign_director_rules_ugc.json'
);

const BANK_ID = 'director_rules_ugc';

let cache = null;
let cacheMtime = 0;

function loadRaw() {
  if (!fs.existsSync(RULES_FILE)) return null;
  const stat = fs.statSync(RULES_FILE);
  if (cache && stat.mtimeMs === cacheMtime) return cache;
  cache = JSON.parse(fs.readFileSync(RULES_FILE, 'utf8'));
  cacheMtime = stat.mtimeMs;
  return cache;
}

function getStatus() {
  const raw = loadRaw();
  if (!raw) return { bankId: BANK_ID, available: false };
  return {
    bankId: BANK_ID,
    available: true,
    version: raw.version || null,
    generatedAt: raw.generatedAt || null,
    principlesCount: (raw.globalDirectorPrinciples || []).length,
    riskLockRulesCount: (raw.riskLockRules || []).length,
    anchorDecisionRulesCount: (raw.anchorDecisionRules || []).length
  };
}

function getGlobalPrinciples() {
  const raw = loadRaw();
  return raw ? (raw.globalDirectorPrinciples || []) : [];
}

function getRiskLockRules() {
  const raw = loadRaw();
  return raw ? (raw.riskLockRules || []) : [];
}

function findRiskLock(riskType) {
  return getRiskLockRules().find(rule => rule.riskType === riskType) || null;
}

function search(query = {}) {
  const raw = loadRaw();
  if (!raw) return [];
  const text = (query.text || '').toLowerCase();
  const principles = (raw.globalDirectorPrinciples || []).map((principle, index) => ({
    domain: 'director_rule',
    sourceBank: BANK_ID,
    sourceId: `PRINCIPLE_${index}`,
    curationStatus: 'approved',
    confidence: 100,
    sourceText: principle
  }));
  if (!text) return principles;
  return principles.filter(item => item.sourceText.toLowerCase().includes(text));
}

function getEntry(entryId) {
  return search({}).find(item => item.sourceId === entryId) || null;
}

module.exports = {
  BANK_ID,
  getStatus,
  search,
  getEntry,
  getGlobalPrinciples,
  getRiskLockRules,
  findRiskLock
};
