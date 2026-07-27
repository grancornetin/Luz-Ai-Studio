'use strict';

const bankRegistry = require('../core/bank-registry');
const photodumpRecipeAdapter = require('../adapters/photodump-recipe-adapter');
const shotNotes = require('../persistence/shot-notes');
const projects = require('../persistence/projects');
const recipes = require('../persistence/recipes');
const cases = require('../persistence/cases');
const runs = require('../persistence/runs');
const references = require('../persistence/references');
const results = require('../persistence/results');
const evaluations = require('../persistence/evaluations');
const { safeId } = require('../persistence/ids');

const PREFIX = '/api/director-lab/';

function matchPath(pathname, template) {
  // template ej: '/api/director-lab/cases/:id'
  const templateParts = template.split('/');
  const pathParts = pathname.split('/');
  if (templateParts.length !== pathParts.length) return null;
  const params = {};
  for (let i = 0; i < templateParts.length; i += 1) {
    if (templateParts[i].startsWith(':')) {
      params[templateParts[i].slice(1)] = decodeURIComponent(pathParts[i]);
    } else if (templateParts[i] !== pathParts[i]) {
      return null;
    }
  }
  return params;
}

function errorPayload(stage, cause, suggestedAction) {
  return { error: true, stage, cause, suggestedAction };
}

function buildStatus(vertex) {
  const providerStatus = vertex.publicConfig();
  return {
    provider: providerStatus,
    banks: bankRegistry.listBanks()
  };
}

function buildMarkdownReport(caseRecord, runRecords) {
  const lines = [`# Caso: ${caseRecord.name}`, '', `Proyecto: ${caseRecord.projectId}`, `Receta: ${caseRecord.recipeId}`, ''];
  runRecords.forEach(run => {
    lines.push(`## Run ${run.id} (${run.status})`);
    lines.push('');
    lines.push('**Prompt positivo:**');
    lines.push(run.positivePrompt || '(sin prompt — needs_review)');
    lines.push('');
    lines.push('**Prompt negativo:**');
    lines.push(run.negativePrompt || '');
    lines.push('');
    if (run.warnings && run.warnings.length) {
      lines.push('**Warnings:**');
      run.warnings.forEach(w => lines.push(`- ${w}`));
      lines.push('');
    }
  });
  return lines.join('\n');
}

async function handle(req, res, parsed, deps) {
  const { vertex, sendJson, readJson } = deps;
  const pathname = parsed.pathname;
  if (!pathname.startsWith(PREFIX)) return false;
  const query = new URLSearchParams(parsed.query || '');

  try {
    if (req.method === 'GET' && pathname === '/api/director-lab/status') {
      sendJson(res, 200, buildStatus(vertex));
      return true;
    }

    if (req.method === 'GET' && pathname === '/api/director-lab/banks') {
      sendJson(res, 200, { banks: bankRegistry.listBanks() });
      return true;
    }

    // ── Interfaz simplificada (v2): generar una historia + guardar notas ──
    if (req.method === 'POST' && pathname === '/api/director-lab/generate') {
      const body = await readJson(req);
      if (body.recipeId !== 'outfit_night_out') {
        sendJson(res, 400, errorPayload(
          'validation',
          `Receta no soportada todavía: ${body.recipeId}`,
          'Por ahora solo "outfit_night_out" está conectada a Director Lab.'
        ));
        return true;
      }
      const level = ['corto', 'completo', 'extendido'].includes(body.level) ? body.level : 'corto';
      const energy = body.energy === 'fiesta' ? 'fiesta' : 'elegante';
      const gender = body.gender === 'male' ? 'male' : 'female';
      const seed = body.seed || `${body.recipeId}-${Date.now()}`;
      let shots;
      try {
        shots = await photodumpRecipeAdapter.generateOutfitNightOutStory({
          level, seed, energy, gender,
          hasCompanion: !!body.hasCompanion,
          garmentCount: Number(body.garmentCount) || 1,
          hasVenueAnchor: !!body.venueImageUrl,
          venueImageUrl: body.venueImageUrl,
          venueTextFallback: body.venueTextFallback || body.brief || 'a stylish night-out venue',
          noteInjector: shotId => {
            const note = shotNotes.latestFor(body.recipeId, shotId);
            return note ? note.note : null;
          }
        });
      } catch (err) {
        sendJson(res, 500, errorPayload('generation_error', err.message, 'Revisar el brief enviado'));
        return true;
      }
      sendJson(res, 200, { recipeId: body.recipeId, level, energy, seed, shots });
      return true;
    }

    if (req.method === 'POST' && pathname === '/api/director-lab/notes') {
      const body = await readJson(req);
      if (!body.recipeId || !body.shotId || !body.note) {
        sendJson(res, 400, errorPayload('validation', 'Falta recipeId, shotId o note', 'Incluir los tres en el body'));
        return true;
      }
      sendJson(res, 201, shotNotes.create({ recipeId: body.recipeId, shotId: body.shotId, note: body.note }));
      return true;
    }

    if (req.method === 'GET' && pathname === '/api/director-lab/projects') {
      sendJson(res, 200, { projects: projects.list() });
      return true;
    }
    if (req.method === 'POST' && pathname === '/api/director-lab/projects') {
      const body = await readJson(req);
      if (!body.name) { sendJson(res, 400, errorPayload('validation', 'Falta name', 'Incluir name en el body')); return true; }
      sendJson(res, 201, projects.create(body));
      return true;
    }

    if (req.method === 'GET' && pathname === '/api/director-lab/recipes') {
      const projectId = query.get('projectId');
      const all = recipes.list();
      sendJson(res, 200, { recipes: projectId ? all.filter(r => r.projectId === projectId) : all });
      return true;
    }
    if (req.method === 'POST' && pathname === '/api/director-lab/recipes') {
      const body = await readJson(req);
      if (!body.name || !body.projectId) {
        sendJson(res, 400, errorPayload('validation', 'Falta name o projectId', 'Incluir ambos en el body'));
        return true;
      }
      sendJson(res, 201, recipes.create(body));
      return true;
    }

    if (req.method === 'GET' && pathname === '/api/director-lab/cases') {
      const recipeId = query.get('recipeId');
      const all = cases.list();
      sendJson(res, 200, { cases: recipeId ? all.filter(c => c.recipeId === recipeId) : all });
      return true;
    }
    if (req.method === 'POST' && pathname === '/api/director-lab/cases') {
      const body = await readJson(req);
      if (!body.name || !body.projectId || !body.recipeId) {
        sendJson(res, 400, errorPayload('validation', 'Falta name, projectId o recipeId', 'Incluir los tres en el body'));
        return true;
      }
      sendJson(res, 201, cases.create(body));
      return true;
    }
    const caseIdMatch = matchPath(pathname, '/api/director-lab/cases/:id');
    if (req.method === 'GET' && caseIdMatch) {
      const id = safeId(caseIdMatch.id);
      const record = id && cases.get(id);
      if (!record) { sendJson(res, 404, errorPayload('not_found', 'Caso no encontrado', 'Verificar el id')); return true; }
      const caseRuns = runs.list().filter(run => run.caseId === id);
      sendJson(res, 200, { ...record, runs: caseRuns });
      return true;
    }

    if (req.method === 'GET' && pathname === '/api/director-lab/references') {
      const caseId = query.get('caseId');
      const all = references.list();
      sendJson(res, 200, { references: caseId ? all.filter(r => r.caseId === caseId) : all });
      return true;
    }
    if (req.method === 'POST' && pathname === '/api/director-lab/references') {
      const body = await readJson(req);
      if (!body.role || !body.caseId) {
        sendJson(res, 400, errorPayload('validation', 'Falta role o caseId', 'Incluir ambos en el body'));
        return true;
      }
      sendJson(res, 201, references.createWithAsset(body));
      return true;
    }

    if (req.method === 'POST' && pathname === '/api/director-lab/runs') {
      // El flujo genérico "Gemini elige libremente pose/gesture/escena" (v1,
      // director-core.js) se retiró — reemplazado por POST /generate, que usa
      // los contratos reales de receta + HPI real (ver adapters/photodump-recipe-adapter.js).
      sendJson(res, 410, errorPayload(
        'deprecated',
        'Esta ruta (v1) fue retirada.',
        'Usar POST /api/director-lab/generate con { recipeId: "outfit_night_out", ... }'
      ));
      return true;
    }

    const runIdMatch = matchPath(pathname, '/api/director-lab/runs/:id');
    if (req.method === 'GET' && runIdMatch) {
      const id = safeId(runIdMatch.id);
      const record = id && runs.get(id);
      if (!record) { sendJson(res, 404, errorPayload('not_found', 'Run no encontrado', 'Verificar el id')); return true; }
      sendJson(res, 200, { ...record, results: results.listForRun(id) });
      return true;
    }

    const runResultsMatch = matchPath(pathname, '/api/director-lab/runs/:id/results');
    if (req.method === 'POST' && runResultsMatch) {
      const id = safeId(runResultsMatch.id);
      if (!id || !runs.get(id)) { sendJson(res, 404, errorPayload('not_found', 'Run no encontrado', 'Verificar el id')); return true; }
      const body = await readJson(req);
      if (!body.assetDataUrl) {
        sendJson(res, 400, errorPayload('validation', 'Falta assetDataUrl', 'Incluir la imagen como data URL base64'));
        return true;
      }
      sendJson(res, 201, results.create(id, body));
      return true;
    }

    const runEvalMatch = matchPath(pathname, '/api/director-lab/runs/:id/evaluations');
    if (req.method === 'POST' && runEvalMatch) {
      const id = safeId(runEvalMatch.id);
      if (!id || !runs.get(id)) { sendJson(res, 404, errorPayload('not_found', 'Run no encontrado', 'Verificar el id')); return true; }
      const body = await readJson(req);
      if (!body.status) {
        sendJson(res, 400, errorPayload('validation', 'Falta status', 'Incluir aprobada/parcial/rechazada'));
        return true;
      }
      sendJson(res, 201, evaluations.create({ ...body, runId: id }));
      return true;
    }

    if (req.method === 'GET' && pathname === '/api/director-lab/compare') {
      const leftId = safeId(query.get('left'));
      const rightId = safeId(query.get('right'));
      const left = leftId && runs.get(leftId);
      const right = rightId && runs.get(rightId);
      if (!left || !right) {
        sendJson(res, 404, errorPayload('not_found', 'left o right no encontrados', 'Verificar ambos ids de run'));
        return true;
      }
      sendJson(res, 200, { left, right });
      return true;
    }

    const exportMdMatch = matchPath(pathname, '/api/director-lab/export/:caseId/markdown');
    if (req.method === 'GET' && exportMdMatch) {
      const id = safeId(exportMdMatch.caseId);
      const record = id && cases.get(id);
      if (!record) { sendJson(res, 404, errorPayload('not_found', 'Caso no encontrado', 'Verificar el id')); return true; }
      const caseRuns = runs.list().filter(run => run.caseId === id).map(r => runs.get(r.id));
      res.writeHead(200, { 'Content-Type': 'text/markdown; charset=utf-8' });
      res.end(buildMarkdownReport(record, caseRuns));
      return true;
    }

    const exportMatch = matchPath(pathname, '/api/director-lab/export/:caseId');
    if (req.method === 'GET' && exportMatch) {
      const id = safeId(exportMatch.caseId);
      const record = id && cases.get(id);
      if (!record) { sendJson(res, 404, errorPayload('not_found', 'Caso no encontrado', 'Verificar el id')); return true; }
      const caseRuns = runs.list().filter(run => run.caseId === id).map(r => runs.get(r.id));
      const caseReferences = references.list().filter(r => r.caseId === id);
      sendJson(res, 200, { case: record, runs: caseRuns, references: caseReferences });
      return true;
    }

    sendJson(res, 404, errorPayload('not_found', `Ruta de Director Lab no encontrada: ${pathname}`, 'Revisar DIRECTOR_LAB_CONTRACT.md'));
    return true;
  } catch (err) {
    sendJson(res, 500, errorPayload('internal_error', err.message, 'Revisar logs del servidor'));
    return true;
  }
}

module.exports = { handle };
