'use strict';

const sceneBank = require('../adapters/scene-bank-adapter');
const hpi = require('../adapters/hpi-adapter');
const directorRules = require('../adapters/director-rules-adapter');

// Nota: el HPI real (adapters/hpi-adapter.js) ya no se expone acá como un
// banco "buscable por candidatos" — las recetas de Photodump (ver
// core/photodump-recipe-adapter.js) ya declaran hpiPoseFamily/hpiCameraFamily
// fijos por contrato validado a mano, no eligen entre opciones vía Gemini.
// Sigue disponible en /api/director-lab/status para mostrar que está conectado.
const BANKS = {
  scene_bank: {
    label: 'Scene Bank',
    domain: 'scene',
    getStatus: sceneBank.getStatus,
    search: (query, filters) => sceneBank.search(query, filters),
    getEntry: sceneBank.getEntry
  },
  director_rules_ugc: {
    label: 'Director Rules (UGC v3.5.1)',
    domain: 'director_rule',
    getStatus: directorRules.getStatus,
    search: (query) => directorRules.search(query),
    getEntry: directorRules.getEntry
  }
};

function listBanks() {
  const banks = Object.keys(BANKS).map(bankId => ({
    bankId,
    label: BANKS[bankId].label,
    domain: BANKS[bankId].domain,
    status: BANKS[bankId].getStatus()
  }));
  banks.push({ bankId: 'hpi_real', label: 'HPI real (Photodump)', domain: 'human_performance', status: hpi.getStatus() });
  return banks;
}

function getBankStatus(bankId) {
  const bank = BANKS[bankId];
  if (!bank) return { bankId, available: false, error: 'Banco desconocido' };
  return bank.getStatus();
}

function searchBank(bankId, query, filters) {
  const bank = BANKS[bankId];
  if (!bank) throw new Error(`Banco desconocido: ${bankId}`);
  return bank.search(query || {}, filters || {});
}

function getEntry(bankId, entryId) {
  const bank = BANKS[bankId];
  if (!bank) throw new Error(`Banco desconocido: ${bankId}`);
  return bank.getEntry(entryId);
}

module.exports = { listBanks, getBankStatus, searchBank, getEntry, BANKS };
