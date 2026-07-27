'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const url = require('url');
const fs = require('fs');
const os = require('os');
const path = require('path');

function readJson(req, maxBytes = 12 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let data = '';
    let size = 0;
    req.on('data', chunk => {
      size += chunk.length;
      if (size > maxBytes) { reject(new Error('Body demasiado grande')); req.destroy(); return; }
      data += chunk;
    });
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); } catch (err) { reject(err); }
    });
    req.on('error', reject);
  });
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(body);
}

function startTestServer(deps) {
  return new Promise(resolve => {
    const server = http.createServer(async (req, res) => {
      const parsed = url.parse(req.url);
      const handled = await deps.routes.handle(req, res, parsed, { vertex: deps.vertex, sendJson, readJson });
      if (!handled) sendJson(res, 404, { error: true });
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

async function withServer(fn) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'director-lab-http-test-'));
  const previous = process.env.DIRECTOR_LAB_DATA_ROOT;
  process.env.DIRECTOR_LAB_DATA_ROOT = tempDir;
  Object.keys(require.cache).forEach(key => {
    if (key.includes(`${path.sep}director-lab${path.sep}`)) delete require.cache[key];
  });
  const routes = require('../http/routes');
  const stubVertex = {
    publicConfig: () => ({ ready: false, provider: 'Vertex AI', error: 'stub sin credenciales' }),
    async generateAnthropicCompatible() {
      throw new Error('no debería llamarse en estos tests');
    }
  };
  const server = await startTestServer({ routes, vertex: stubVertex });
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;
  try {
    await fn(baseUrl);
  } finally {
    server.close();
    process.env.DIRECTOR_LAB_DATA_ROOT = previous;
    Object.keys(require.cache).forEach(key => {
      if (key.includes(`${path.sep}director-lab${path.sep}`)) delete require.cache[key];
    });
  }
}

test('GET /status nunca expone credenciales, solo ready/error', async () => {
  await withServer(async baseUrl => {
    const res = await fetch(`${baseUrl}/api/director-lab/status`);
    const body = await res.json();
    const raw = JSON.stringify(body);
    assert.ok(!raw.includes('private_key'));
    assert.ok(!raw.includes('client_email'));
    assert.equal(body.provider.ready, false);
    assert.ok(body.banks.length > 0);
  });
});

test('POST /projects crea y GET /projects lo lista', async () => {
  await withServer(async baseUrl => {
    const created = await fetch(`${baseUrl}/api/director-lab/projects`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Proyecto HTTP' })
    }).then(r => r.json());
    assert.ok(created.id);
    const list = await fetch(`${baseUrl}/api/director-lab/projects`).then(r => r.json());
    assert.ok(list.projects.some(p => p.id === created.id));
  });
});

test('subir un resultado a un run inexistente devuelve 404 con stage/cause/suggestedAction', async () => {
  await withServer(async baseUrl => {
    const res = await fetch(`${baseUrl}/api/director-lab/runs/run_nope/results`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assetDataUrl: 'data:image/png;base64,AAAA' })
    });
    assert.equal(res.status, 404);
    const body = await res.json();
    assert.ok(body.stage);
    assert.ok(body.cause);
    assert.ok(body.suggestedAction);
  });
});

test('GET /compare con dos runs devuelve left/right para diff estructurado', async () => {
  await withServer(async baseUrl => {
    const runs = require('../persistence/runs');
    const runA = runs.create({ id: 'run_a', status: 'ready', caseId: 'case_x', positivePrompt: 'prompt A' });
    const runB = runs.create({ id: 'run_b', status: 'ready', caseId: 'case_x', positivePrompt: 'prompt B' });
    const res = await fetch(`${baseUrl}/api/director-lab/compare?left=${runA.id}&right=${runB.id}`);
    const body = await res.json();
    assert.equal(body.left.id, runA.id);
    assert.equal(body.right.id, runB.id);
  });
});

test('IDs con path traversal son rechazados (safeId)', async () => {
  await withServer(async baseUrl => {
    const res = await fetch(`${baseUrl}/api/director-lab/runs/${encodeURIComponent('../../etc/passwd')}`);
    assert.equal(res.status, 404);
  });
});
