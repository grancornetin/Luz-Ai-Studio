'use strict';

// Adaptador al banco HPI REAL de Photodump (36 familias curadas de 158
// análisis reales, src/data/HPI/), no al snapshot inventado de la v1 de
// Director Lab. Reusa el servicio compilado (ver scripts/build-vendor.js)
// tal cual funciona en producción — buildHpiBlock/getHpiNegatives no se
// reimplementan acá.

const hpiService = require('../vendor/src/services/hpiService.js');

let readyPromise = null;

function ensureReady() {
  if (!readyPromise) {
    hpiService.initHpiService();
    // initHpiService() no expone su propia promesa; se espera un tick corto
    // para que ensureLoaded() (interno) termine de leer los JSON reales.
    readyPromise = new Promise(resolve => setTimeout(resolve, 300));
  }
  return readyPromise;
}

async function buildHpiBlock(config) {
  await ensureReady();
  return hpiService.buildHpiBlock(config);
}

async function getHpiNegatives(gender) {
  await ensureReady();
  return hpiService.getHpiNegatives(gender);
}

function getStatus() {
  return {
    bankId: 'hpi_real',
    available: true,
    source: 'src/data/HPI/03_reglas_director_hpi_mujer_151.json + ...51 hombre.json (banco real de producción)',
    note: 'Servido vía vendor compilado de src/services/hpiService.ts — no es un snapshot de prueba.'
  };
}

module.exports = { buildHpiBlock, getHpiNegatives, getStatus };
