const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');
const vertex = require('./vertex-client');
const directorLabRoutes = require('./director-lab/http/routes');
const directorLabSeed = require('./director-lab/seed/seed-t5b');
const photodumpTrainerRoutes = require('./photodump-trainer/http/routes');

const PORT = Number(process.env.PORT || 3131);
const DATA_DIR = path.join(__dirname, '.server-batch-data');
const IMAGES_DIR = path.join(DATA_DIR, 'images');
const JOBS_FILE = path.join(DATA_DIR, 'jobs.json');
const GENERATE_JOBS_FILE = path.join(DATA_DIR, 'generate-jobs.json');
const OPTIMIZE_JOBS_FILE = path.join(DATA_DIR, 'optimize-jobs.json');
const BANK_FILE = path.join(DATA_DIR, 'prompt-bank.json');
const LOGS_FILE = path.join(DATA_DIR, 'api-logs.json');
const CAMPAIGN_DATA_DIR = path.join(__dirname, 'campaign-trainer-data');
const CAMPAIGN_ANALYSES_DIR = path.join(CAMPAIGN_DATA_DIR, 'analyses');
const CAMPAIGN_IMAGES_DIR = path.join(CAMPAIGN_DATA_DIR, 'images');
const CAMPAIGN_THUMBS_DIR = path.join(CAMPAIGN_DATA_DIR, 'thumbnails');
const CAMPAIGN_QUEUE_DIR = path.join(CAMPAIGN_DATA_DIR, 'queue');
const CAMPAIGN_LOGS_DIR = path.join(CAMPAIGN_DATA_DIR, 'logs');
const CAMPAIGN_MANIFEST_FILE = path.join(CAMPAIGN_DATA_DIR, 'manifest.json');
const CAMPAIGN_SCENE_BANK_FILE = path.join(CAMPAIGN_DATA_DIR, 'scene-bank.json');
const MAX_JSON_BODY = 12 * 1024 * 1024;
const SERVER_BATCH_PARALLEL = 2;
const SERVER_BATCH_DELAY_MS = 1200;
const MAX_LOG_ENTRIES = 2000;
const GEMINI_MODEL = process.env.VERTEX_GEMINI_MODEL || 'gemini-2.5-flash';
const ANALYSIS_MODEL = GEMINI_MODEL;
const SERVER_MANAGED_CREDENTIAL = 'vertex-server-managed';

// Precios Anthropic por millón de tokens (input/output) — actualizar si cambian
const MODEL_PRICING = {
  // Valores opcionales para estimación local; confirma precios vigentes en Vertex antes de facturar usuarios.
  'gemini-2.5-flash': { input: 0.30, output: 2.50 },
  'gemini-2.5-pro': { input: 1.25, output: 10.00 },
};

const jobs = new Map();
const generateJobs = new Map();
const optimizeJobs = new Map();

// ─── LOG SYSTEM ───────────────────────────────────────────────────────────────
const apiLogs = [];

function loadLogs() {
  if (fs.existsSync(LOGS_FILE)) {
    try {
      const saved = JSON.parse(fs.readFileSync(LOGS_FILE, 'utf8'));
      apiLogs.push(...saved.slice(-MAX_LOG_ENTRIES));
    } catch (_) {}
  }
}

function persistLogs() {
  try {
    ensureDataDir();
    fs.writeFileSync(LOGS_FILE, JSON.stringify(apiLogs.slice(-MAX_LOG_ENTRIES), null, 2), 'utf8');
    ensureCampaignDataDir();
    atomicWriteFileSync(
      path.join(CAMPAIGN_LOGS_DIR, 'vertex-api-logs.json'),
      JSON.stringify(apiLogs.slice(-MAX_LOG_ENTRIES), null, 2),
      'utf8'
    );
  } catch (_) {}
}

function addLog(entry) {
  apiLogs.push(entry);
  if (apiLogs.length > MAX_LOG_ENTRIES) apiLogs.splice(0, apiLogs.length - MAX_LOG_ENTRIES);
  persistLogs();
}

function calcCost(model, inputTokens, outputTokens) {
  const p = MODEL_PRICING[model];
  if (!p) return null;
  return (inputTokens / 1e6) * p.input + (outputTokens / 1e6) * p.output;
}
// ─────────────────────────────────────────────────────────────────────────────

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(IMAGES_DIR)) fs.mkdirSync(IMAGES_DIR, { recursive: true });
}

function ensureCampaignDataDir() {
  [
    CAMPAIGN_DATA_DIR,
    CAMPAIGN_ANALYSES_DIR,
    CAMPAIGN_IMAGES_DIR,
    CAMPAIGN_THUMBS_DIR,
    CAMPAIGN_QUEUE_DIR,
    CAMPAIGN_LOGS_DIR
  ].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  });
}

function safeCampaignId(value) {
  const id = String(value || '').trim();
  if (!/^[a-zA-Z0-9_-]{4,160}$/.test(id)) throw new Error('ID de imagen inválido');
  return id;
}

function atomicWriteFileSync(target, contents, encoding) {
  const temp = target + '.tmp-' + process.pid + '-' + Date.now();
  fs.writeFileSync(temp, contents, encoding);
  fs.renameSync(temp, target);
}

function dataUrlToBuffer(dataUrl) {
  const match = String(dataUrl || '').match(/^data:([^;,]+);base64,([\s\S]+)$/);
  if (!match) return null;
  return { mimeType: match[1].toLowerCase(), buffer: Buffer.from(match[2], 'base64') };
}

function extensionForMime(mimeType) {
  if (mimeType === 'image/png') return '.png';
  if (mimeType === 'image/webp') return '.webp';
  if (mimeType === 'image/gif') return '.gif';
  return '.jpg';
}

function removeCampaignAssetVariants(directory, id) {
  for (const ext of ['.jpg', '.png', '.webp', '.gif']) {
    const candidate = path.join(directory, id + ext);
    if (fs.existsSync(candidate)) fs.unlinkSync(candidate);
  }
}

function findCampaignAsset(directory, id) {
  for (const ext of ['.jpg', '.png', '.webp', '.gif']) {
    const candidate = path.join(directory, id + ext);
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function writeCampaignAsset(directory, id, dataUrl) {
  const parsed = dataUrlToBuffer(dataUrl);
  if (!parsed) return findCampaignAsset(directory, id);
  removeCampaignAssetVariants(directory, id);
  const target = path.join(directory, id + extensionForMime(parsed.mimeType));
  atomicWriteFileSync(target, parsed.buffer);
  return target;
}

function campaignRecordPath(id) {
  return path.join(CAMPAIGN_ANALYSES_DIR, safeCampaignId(id) + '.json');
}

function readCampaignRecord(id) {
  const target = campaignRecordPath(id);
  if (!fs.existsSync(target)) return null;
  return JSON.parse(fs.readFileSync(target, 'utf8'));
}

function listCampaignRecords() {
  ensureCampaignDataDir();
  return fs.readdirSync(CAMPAIGN_ANALYSES_DIR)
    .filter(name => name.endsWith('.json'))
    .map(name => {
      try { return JSON.parse(fs.readFileSync(path.join(CAMPAIGN_ANALYSES_DIR, name), 'utf8')); }
      catch (_) { return null; }
    })
    .filter(Boolean)
    .sort((a, b) => String(a.createdAt || a.updatedAt || '').localeCompare(String(b.createdAt || b.updatedAt || '')));
}

function campaignStoreStats(records) {
  const list = records || listCampaignRecords();
  return {
    total: list.length,
    pending: list.filter(item => item.status === 'pending').length,
    processing: list.filter(item => item.status === 'processing').length,
    completed: list.filter(item => item.status === 'completed').length,
    failed: list.filter(item => item.status === 'failed').length
  };
}

function persistCampaignManifest(records) {
  const list = records || listCampaignRecords();
  const manifest = {
    schemaVersion: '3.5-disk-store',
    updatedAt: new Date().toISOString(),
    stats: campaignStoreStats(list),
    records: list.map(item => ({
      id: item.id,
      filename: item.filename,
      status: item.status,
      curStatus: item.curStatus,
      trainingMode: item.trainingMode,
      analysisAttempt: item.analysisAttempt || 0,
      inQueue: item.inQueue === true,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt
    }))
  };
  atomicWriteFileSync(CAMPAIGN_MANIFEST_FILE, JSON.stringify(manifest, null, 2), 'utf8');
  atomicWriteFileSync(path.join(CAMPAIGN_QUEUE_DIR, 'state.json'), JSON.stringify({
    schemaVersion: '3.5-queue-state',
    updatedAt: manifest.updatedAt,
    stats: manifest.stats,
    pendingIds: list.filter(item => item.inQueue === true && item.status === 'pending').map(item => item.id),
    failedIds: list.filter(item => item.inQueue === true && item.status === 'failed').map(item => item.id)
  }, null, 2), 'utf8');
}

function upsertCampaignManifestRecord(record) {
  ensureCampaignDataDir();
  let manifestRecords = [];
  if (fs.existsSync(CAMPAIGN_MANIFEST_FILE)) {
    try {
      const existing = JSON.parse(fs.readFileSync(CAMPAIGN_MANIFEST_FILE, 'utf8'));
      if (Array.isArray(existing.records)) manifestRecords = existing.records;
    } catch (_) {}
  }
  const summary = {
    id: record.id,
    filename: record.filename,
    status: record.status,
    curStatus: record.curStatus,
    trainingMode: record.trainingMode,
    analysisAttempt: record.analysisAttempt || 0,
    inQueue: record.inQueue === true,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt
  };
  const index = manifestRecords.findIndex(item => item.id === record.id);
  if (index >= 0) manifestRecords[index] = summary;
  else manifestRecords.push(summary);
  persistCampaignManifest(manifestRecords);
}

function saveCampaignRecord(body) {
  ensureCampaignDataDir();
  const incoming = body && body.record && typeof body.record === 'object' ? body.record : {};
  const id = safeCampaignId(incoming.id);
  const previous = readCampaignRecord(id) || {};
  const now = new Date().toISOString();
  const imagePath = writeCampaignAsset(CAMPAIGN_IMAGES_DIR, id, body.dataUrl || '');
  const thumbPath = writeCampaignAsset(CAMPAIGN_THUMBS_DIR, id, body.thumbDataUrl || '');
  const record = {
    ...previous,
    ...incoming,
    id,
    dataUrl: undefined,
    thumbUrl: undefined,
    createdAt: previous.createdAt || incoming.createdAt || now,
    updatedAt: now,
    imageStored: Boolean(imagePath),
    thumbnailStored: Boolean(thumbPath),
    diskSchemaVersion: '3.5'
  };
  delete record.dataUrl;
  delete record.thumbUrl;
  atomicWriteFileSync(campaignRecordPath(id), JSON.stringify(record, null, 2), 'utf8');
  upsertCampaignManifestRecord(record);
  return record;
}

function clearCampaignQueue() {
  const records = listCampaignRecords();
  let changed = 0;
  for (const record of records) {
    if (record.inQueue !== true) continue;
    record.inQueue = false;
    record.updatedAt = new Date().toISOString();
    atomicWriteFileSync(campaignRecordPath(record.id), JSON.stringify(record, null, 2), 'utf8');
    changed += 1;
  }
  persistCampaignManifest(records);
  return changed;
}

function publicCampaignRecord(record) {
  return {
    ...record,
    thumbUrl: record.thumbnailStored ? '/api/campaign-store/records/' + encodeURIComponent(record.id) + '/thumbnail' : '',
    serverImageUrl: record.imageStored ? '/api/campaign-store/records/' + encodeURIComponent(record.id) + '/image' : ''
  };
}

// Guarda el base64 de una imagen en disco y devuelve la ruta relativa
function saveImageToDisk(jobId, itemIndex, data) {
  ensureDataDir();
  const file = path.join(IMAGES_DIR, `${jobId}_${itemIndex}.b64`);
  fs.writeFileSync(file, data, 'utf8');
  return file;
}

// Carga el base64 desde disco si existe
function loadImageFromDisk(jobId, itemIndex) {
  const file = path.join(IMAGES_DIR, `${jobId}_${itemIndex}.b64`);
  if (fs.existsSync(file)) return fs.readFileSync(file, 'utf8');
  return null;
}

// Elimina el archivo de imagen del disco cuando ya no se necesita
function deleteImageFromDisk(jobId, itemIndex) {
  try {
    const file = path.join(IMAGES_DIR, `${jobId}_${itemIndex}.b64`);
    if (fs.existsSync(file)) fs.unlinkSync(file);
  } catch (_) {}
}

function publicJob(job) {
  return {
    id: job.id,
    status: job.status,
    createdAt: job.createdAt,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
    total: job.items.length,
    done: job.items.filter(item => ['done', 'incomplete', 'error'].includes(item.status)).length,
    errors: job.items.filter(item => item.status === 'error').length,
    incomplete: job.items.filter(item => item.status === 'incomplete').length,
    current: job.current || '',
    options: job.options || {},
    items: job.items.map(item => ({
      index: item.index,
      name: item.name,
      mediaType: item.mediaType,
      status: item.status,
      error: item.error || '',
      thumb: item.thumb || null,
      result: item.result || null
    })),
    results: job.results || []
  };
}

function persistJobs() {
  ensureDataDir();
  const safeJobs = Array.from(jobs.values()).map(job => {
    const pub = publicJob(job);
    return { ...pub, items: pub.items.map(item => ({ ...item, result: item.result || null })) };
  });
  fs.writeFileSync(JOBS_FILE, JSON.stringify(safeJobs, null, 2), 'utf8');
}

function publicGenerateJob(job) {
  return {
    id: job.id,
    status: job.status,
    createdAt: job.createdAt,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
    current: job.current || '',
    error: job.error || '',
    thumb: job.thumb || null,
    mediaType: job.mediaType || 'image/jpeg',
    result: job.result || null,
    raw: job.raw || ''
  };
}

function persistGenerateJobs() {
  ensureDataDir();
  const safeJobs = Array.from(generateJobs.values()).map(publicGenerateJob);
  fs.writeFileSync(GENERATE_JOBS_FILE, JSON.stringify(safeJobs, null, 2), 'utf8');
}

function publicOptimizeJob(job) {
  return {
    id: job.id,
    status: job.status,
    createdAt: job.createdAt,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
    current: job.current || '',
    error: job.error || '',
    originalLength: job.originalLength || 0,
    result: job.result || ''
  };
}

function persistOptimizeJobs() {
  ensureDataDir();
  const safeJobs = Array.from(optimizeJobs.values()).map(publicOptimizeJob);
  fs.writeFileSync(OPTIMIZE_JOBS_FILE, JSON.stringify(safeJobs, null, 2), 'utf8');
}

function loadJobs() {
  ensureDataDir();
  if (fs.existsSync(JOBS_FILE)) {
    try {
      const saved = JSON.parse(fs.readFileSync(JOBS_FILE, 'utf8'));
      saved.forEach(savedJob => {
        jobs.set(savedJob.id, {
          ...savedJob,
          status: ['running', 'paused', 'uploading', 'queued'].includes(savedJob.status) ? 'interrupted' : savedJob.status,
          apiKey: null,
          processing: false,
          paused: false,
          items: (savedJob.items || []).map(item => ({ ...item, data: null })),
          results: savedJob.results || []
        });
      });
    } catch (err) {
      console.warn('Could not load saved server batch jobs:', err.message);
    }
  }

  if (fs.existsSync(GENERATE_JOBS_FILE)) {
    try {
      const savedGenerateJobs = JSON.parse(fs.readFileSync(GENERATE_JOBS_FILE, 'utf8'));
      savedGenerateJobs.forEach(savedJob => {
        generateJobs.set(savedJob.id, {
          ...savedJob,
          status: ['running', 'queued'].includes(savedJob.status) ? 'interrupted' : savedJob.status,
          apiKey: null,
          imageData: null,
          processing: false
        });
      });
    } catch (err) {
      console.warn('Could not load saved server generate jobs:', err.message);
    }
  }

  if (fs.existsSync(OPTIMIZE_JOBS_FILE)) {
    try {
      const savedOptimizeJobs = JSON.parse(fs.readFileSync(OPTIMIZE_JOBS_FILE, 'utf8'));
      savedOptimizeJobs.forEach(savedJob => {
        optimizeJobs.set(savedJob.id, {
          ...savedJob,
          status: ['running', 'queued'].includes(savedJob.status) ? 'interrupted' : savedJob.status,
          apiKey: null,
          text: '',
          processing: false
        });
      });
    } catch (err) {
      console.warn('Could not load saved server optimize jobs:', err.message);
    }
  }
}

function sendJson(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function sendText(res, status, text, contentType = 'text/plain; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': contentType });
  res.end(text);
}

function readJson(req, maxBytes = MAX_JSON_BODY) {
  return new Promise((resolve, reject) => {
    let body = '';
    let tooLarge = false;
    req.on('data', chunk => {
      if (tooLarge) return;
      body += chunk;
      if (Buffer.byteLength(body) > maxBytes) {
        tooLarge = true;
        reject(new Error('Payload demasiado grande'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (tooLarge) return;
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(new Error('JSON invalido'));
      }
    });
    req.on('error', reject);
  });
}

function parseJsonFromText(raw) {
  const clean = String(raw || '').replace(/```json|```/g, '').trim();
  const match = clean.match(/\{[\s\S]*\}/);
  return JSON.parse(match ? match[0] : clean);
}

function parseJsonArrayFromText(raw) {
  const clean = String(raw || '').replace(/```json|```/g, '').trim();
  const match = clean.match(/\[[\s\S]*\]/);
  if (!match) return [];
  return JSON.parse(match[0]);
}

function anthropicMessagesOnce(_apiKey, payload, logContext) {
  const startedAt = Date.now();
  const model = GEMINI_MODEL;

  return new Promise((resolve, reject) => {
    Promise.resolve().then(() => vertex.generateAnthropicCompatible({ ...payload, model })).then(parsed => {
        const durationMs = Date.now() - startedAt;
        const usage = parsed && parsed.usage ? parsed.usage : {};
        const inputTokens  = usage.input_tokens  || 0;
        const outputTokens = usage.output_tokens || 0;
        const costUSD = calcCost(model, inputTokens, outputTokens);

        addLog({
          ts: new Date().toISOString(),
          status: 'ok',
          httpCode: 200,
          model,
          error: null,
          durationMs,
          inputTokens,
          outputTokens,
          costUSD,
          charged: true,
          ...(logContext || {})
        });

        resolve(parsed || {});
    }).catch(err => {
      addLog({
        ts: new Date().toISOString(),
        status: 'network_error',
        model,
        error: err.message,
        durationMs: Date.now() - startedAt,
        inputTokens: null, outputTokens: null, costUSD: null,
        charged: false,
        ...(logContext || {})
      });
      reject(err);
    });
  });
}

// Reintenta automáticamente en Overloaded (529) y RateLimit (429).
// Backoff: 10s, 20s, 30s, 60s, luego 60s indefinidamente hasta que responda o el job se pause/cancele.
async function anthropicMessages(apiKey, payload, logContext, jobRef) {
  const BACKOFF = [10000, 20000, 30000, 60000];
  let attempt = 0;
  while (true) {
    // Si el job fue pausado o cancelado externamente, abortar
    if (jobRef && (jobRef.paused || jobRef.status === 'failed')) {
      throw new Error('Job pausado o cancelado durante reintento');
    }
    try {
      const ctx = attempt > 0 ? { ...logContext, retryAttempt: attempt } : logContext;
      return await anthropicMessagesOnce(apiKey, payload, ctx);
    } catch (err) {
      if (err.isOverloaded || err.isRateLimit) {
        const delay = BACKOFF[Math.min(attempt, BACKOFF.length - 1)];
        const label = err.isOverloaded ? 'Overloaded' : 'RateLimit';
        console.log(`[batch] API ${label} — esperando ${delay/1000}s (intento ${attempt + 1})`);
        // Actualizar status del job para que la UI lo muestre
        if (jobRef) {
          jobRef.current = `API ${label} — reintentando en ${delay/1000}s (intento ${attempt + 1})...`;
        }
        await wait(delay);
        attempt++;
        continue;
      }
      throw err;
    }
  }
}

// ─── IMAGE TYPE CLASSIFIER ───
// Returns 'expression' if image is primarily a face/gesture/microexpression shot,
// 'body' otherwise. Single fast Claude call.
function fallbackModelsFor(payload) {
  const model = String(payload && payload.model || '');
  return [];
}

// Retry 529/429 briefly. If Sonnet remains overloaded, fall back to Haiku
// so image analysis does not hang forever.
async function anthropicMessagesWithFallback(apiKey, payload, logContext, jobRef, options = {}) {
  const retryPolicy = payload && payload.retry_policy && typeof payload.retry_policy === 'object'
    ? payload.retry_policy
    : {};
  const maxRetries = Number.isFinite(options.maxRetries)
    ? options.maxRetries
    : Math.max(0, Math.min(20, Number(retryPolicy.maxRetries ?? 2)));
  const baseDelayMs = Math.max(10000, Math.min(300000, Number(retryPolicy.baseDelayMs || 10000)));
  const maxDelayMs = Math.max(baseDelayMs, Math.min(600000, Number(retryPolicy.maxDelayMs || 30000)));
  const models = [
    payload.model || ANALYSIS_MODEL,
    ...(options.fallbackModels || fallbackModelsFor(payload))
  ].filter((model, idx, arr) => model && arr.indexOf(model) === idx);
  let lastErr = null;

  for (let modelIndex = 0; modelIndex < models.length; modelIndex++) {
    const model = models[modelIndex];
    let attempt = 0;
    while (attempt <= maxRetries) {
      if (jobRef && (jobRef.paused || jobRef.status === 'failed')) {
        throw new Error('Job pausado o cancelado durante reintento');
      }
      try {
        const ctx = {
          ...(logContext || {}),
          ...(attempt > 0 ? { retryAttempt: attempt } : {}),
          ...(modelIndex > 0 ? { fallbackFrom: models[0] } : {})
        };
        return await anthropicMessagesOnce(apiKey, { ...payload, model }, ctx);
      } catch (err) {
        lastErr = err;
        if (!(err.isOverloaded || err.isRateLimit)) throw err;
        if (attempt >= maxRetries) break;

        const delay = Math.min(maxDelayMs, baseDelayMs * Math.pow(2, Math.min(attempt, 6)));
        const label = err.isOverloaded ? 'Overloaded' : 'RateLimit';
        console.log(`[api] ${model} ${label} - esperando ${delay/1000}s (intento ${attempt + 1})`);
        if (jobRef) {
          jobRef.current = `API ${label} en ${model} - reintentando en ${delay/1000}s (intento ${attempt + 1})...`;
          persistJobs();
        }
        await wait(delay);
        attempt++;
      }
    }

    if (models[modelIndex + 1] && jobRef) {
      jobRef.current = `Sonnet saturado - cambiando a fallback ${models[modelIndex + 1]}...`;
      persistJobs();
    }
  }

  throw lastErr || new Error('API no disponible');
}

async function classifyImageType(item, apiKey, jobId, jobRef) {
  const data = await anthropicMessagesWithFallback(apiKey, {
    model: ANALYSIS_MODEL,
    max_tokens: 20,
    system: 'You are an image classifier. Respond with ONLY one word: "expression" or "body".\n\nexpression: image is primarily a close-up of a face, mouth, eyes, lips, tongue, or a gesture/microexpression with no significant body/outfit context. Also use for POV-from-above shots focused on the face, hand-on-face/neck interactions, or any shot where the dominant visual is facial expression or oral/eye gesture.\n\nbody: image shows body, outfit, pose, full figure, or the face is secondary to clothing/body emphasis.',
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: item.mediaType, data: item.data } },
        { type: 'text', text: 'Classify this image.' }
      ]
    }]
  }, { jobId, itemIndex: item.index, itemName: item.name, call: 'classify' }, jobRef);
  const raw = (data.content || []).map(b => b.text || '').join('').trim().toLowerCase();
  return raw.includes('expression') ? 'expression' : 'body';
}

function buildBodySystemPrompt() {
  return `You are an elite forensic image analyst and prompt engineer specializing in SFW-edge visual content for AI image generation.

YOUR PRIMARY MISSION: Extract every visual detail that makes an image sensually impactful, and translate it into prompt language precise enough to reproduce that exact effect in a generated image. Auto-detect the dominant visual intent from the image itself.

EDGE DETECTION PROTOCOL — actively scan every image for these signals and describe them EXPLICITLY, never euphemize:

OUTFIT EDGE SIGNALS:
- Fabric transparency: if fabric turns sheer or semi-transparent from stretch, light, or thinness — state it literally
- Coverage failure: if garment does not cover what it nominally should — state the exact uncovered zone
- Fabric tension: if fabric pulls, clings, or creates visible body outline — describe the exact body part outlined
- Ride-up: if pose causes garment to shift from its intended position — describe where it ended up
- Fit edge: ultra-tight, second-skin, painted-on fits that reveal every curve — describe them as such

POSE EDGE SIGNALS:
- Pose-induced exposure: when a pose (kneeling, bending, sitting) causes clothing to shift and expose — describe the resulting exposure FIRST, then the pose mechanics
- SEATED ON FLOOR — CRITICAL: a mini skirt or short hemline CANNOT physically cover the glutes when seated on the floor with legs extended. State exactly what is and is not covered
- KNEELING — CRITICAL: mini skirts/shorts ride entirely above the glute crease when kneeling. State the hemline position and the exact skin zone now visible
- Body emphasis angles: describe exactly which body part is maximized and why
- Tension points: where clothing pulls tightest against skin due to position

BODY EMPHASIS SIGNALS:
- Visible skin zones that would normally be covered: name them precisely
- Stocking tops, garter straps, waistband edges, bra lines — if visible, describe placement exactly
- Lower glute crease, inner thigh, lower back, hip dip — if any is exposed, say so directly

INTENT AUTO-DETECTION (body images) — choose the single best:
- glute_emphasis: glutes are the dominant visual
- bust_emphasis: bust/chest is the hero element
- edge_sfw_pose: pose itself is the main hook
- edge_sfw_outfit: outfit transparency/coverage is the hook
- high_impact_scroll_stop: extreme hourglass full-body curves
- aspirational_lifestyle: setting and mood carry the image
- outfit_showcase: outfit described as hero, every piece in detail

PHYSIQUE RULE: Copy the fixed physique block verbatim at START of positive prompt. NEVER extract physical traits from the image.
TAGS RULE: tags describe pose mechanics, outfit pieces, setting — NEVER physical traits (no hair/eye color).
OUTPUT: ONLY valid raw JSON. No markdown. No truncation.`;
}

function buildBodyUserPrompt(item, job) {
  const options = job.options || {};
  const physique = String(options.physique || '').trim();
  const ctx = String(options.context || '').trim();
  const ctxBlock = ctx ? `\nBatch context/style: ${ctx}` : '';
  const isNsfw = options.mode === 'nsfw';
  const nsfwNote = isNsfw ? '\nNSFW mode: describe all clothing coverage and nudity explicitly.' : '';

  return `Analyze this image. Auto-detect intent.${ctxBlock}${nsfwNote}

CHARACTER PHYSIQUE — copy verbatim at START of prompt:
${physique}

CRITICAL POSE RULE: Wrap the pose/body position in [square brackets] in the prompt field.

Return ONLY this JSON:
{"schemaType":"body","intent":"glute_emphasis|bust_emphasis|edge_sfw_pose|edge_sfw_outfit|high_impact_scroll_stop|aspirational_lifestyle|outfit_showcase","prompt":"ultra realistic UGC style photo, ${physique.slice(0,80)}..., [POSE DESCRIPTION HERE], wearing [outfit]... [scene] [lighting]","negativePrompt":"cartoon,anime,illustration,painting,drawing,CGI,3D render,artificial skin,plastic skin,airbrushed,over-smoothed,extra limbs,deformed hands,bad anatomy,blurry,watermark,text,logo,distorted face,flat lighting","pose":{"description":"pose in Spanish","bodyPosition":"frontal|posterior|lateral|3/4","focalPoints":["list"],"anatomicalNotes":"key detail"},"framing":{"shotType":"close_up|medium_close_up|medium_shot|medium_full|full_shot|hero","angle":"eye_level|low_angle|high_angle|slight_low_angle|contrapicado","label":"short label in Spanish"},"outfit":{"description":"ultra-detailed outfit with edge elements","pieces":["every piece"],"fit":"how it fits at most revealing point","texture":"fabrics","edgeLevel":"fully_sfw|sfw_edge|near_limit"},"scenario":{"location":"place","background":"background","mood":"mood"},"lighting":{"type":"type","source":"source","quality":"quality","effect":"skin effect"},"scrollStop":{"intent":"SAME AS TOP LEVEL","mechanisms":["mechanism1"],"hookStrength":7},"variations":[{"label":"Variación 1","poseText":"pose text only","framingOverride":{"shotType":"type or null","angle":"angle or null","label":"label"}},{"label":"Variación 2","poseText":"pose text only","framingOverride":{"shotType":"type or null","angle":"angle or null","label":"label"}}],"tags":["tag1","tag2"]}`;
}

function buildExpressionSystemPrompt() {
  return `You are an elite forensic micro-expression analyst and prompt engineer for AI image generation.

YOUR PRIMARY MISSION: Extract the exact facial expression, gesture, eye state, mouth position, and visual dynamic from the image with surgical precision. This will be used to reproduce the exact same expression/gesture/attitude in a generated image.

EXPRESSION DETECTION — scan and describe EXPLICITLY:

EYE STATE: direction (direct camera contact, downward, rolled back, half-closed, upward), openness (wide open, heavy lidded, barely open), intensity (vacant, intense, glazed, sharp), emotional signal
MOUTH/LIP STATE: open or closed, degree of opening, lip shape (parted slightly, wide open, pout, O-shape), tongue position (hidden, tip visible, fully extended, licking lip, biting lip, sucking object), teeth visibility, wetness/gloss
EXPRESSION CATEGORY — choose the most accurate:
- submissive_gaze: downward eyes, soft jaw, exposed neck, yielding posture, receiving energy
- rolled_eyes_ecstasy: eyes rolled back or upward, glazed, expression of overwhelm or ecstasy
- oral_gesture: tongue out, finger/object in mouth, licking, biting lip as dominant visual element
- dominant_pov: camera angle from above looking down at subject creating power dynamic
- intense_eye_contact: direct piercing gaze straight into lens, dominant or challenging energy
- emotional_release: raw emotion on face — overwhelm, crying, pleasure, surrender
- playful_expression: fun, spontaneous, silly or playful gesture (tongue out playfully, laughing, candid)
- external_contact: hand on face/neck/jaw from another person, creates power/intimacy dynamic
FRAMING: angle relative to face (from above=contrapicado_invertido, eye level, from below=contrapicado), distance (extreme close-up lips only, close-up face, medium close-up)
INTERACTION: if another hand/body part is present — describe exactly where it touches, how it holds, the grip type, the dynamic it creates
PROMPT HOOK: the single most precise phrase that reproduces this exact visual — must be specific enough that an AI model generates it accurately

PHYSIQUE CONTAMINATION RULE: Expression images have NO body. NEVER include body measurements, bust size, glute descriptions, hip measurements, or any physique block in the prompt field. The prompt must contain ONLY: expression mechanics, gesture detail, framing, lighting, mood, background. A prompt like "ultra realistic photo, toned curvy hourglass figure, 34DD..." is FORBIDDEN for expression entries.

OUTPUT: ONLY valid raw JSON. No markdown. No truncation.`;
}

function buildExpressionUserPrompt(item, job) {
  const options = job.options || {};
  const ctx = String(options.context || '').trim();
  const ctxBlock = ctx ? `\nBatch context/style: ${ctx}` : '';

  return `Analyze this image. Extract the micro-expression, gesture, and visual dynamic with maximum precision.${ctxBlock}

PHYSIQUE RULE: This is an expression/gesture image — DO NOT include any body physique block in the prompt. The prompt field must describe ONLY: the expression, the gesture, the framing, the lighting, the mood. No body measurements, no bust/glute descriptions, nothing about body shape.

Return ONLY this JSON:
{"schemaType":"expression","intent":"submissive_gaze|rolled_eyes_ecstasy|oral_gesture|dominant_pov|intense_eye_contact|emotional_release|playful_expression|external_contact","prompt":"ultra realistic UGC style photo, [EXPRESSION/GESTURE HERE], [framing] [mood] [lighting]","negativePrompt":"cartoon,anime,illustration,painting,drawing,CGI,3D render,artificial skin,plastic skin,airbrushed,over-smoothed,extra limbs,deformed hands,bad anatomy,blurry,watermark,text,logo,distorted face,flat lighting","expression":{"description":"exact expression description in Spanish","eyeState":"exact eye position, direction, openness, intensity","mouthState":"exact lip/mouth/tongue position and shape","emotionalSignal":"what it transmits — one clear phrase","gestureDetail":"if hands/objects involved — exact description of what and how"},"interaction":{"present":true,"type":"hand_on_face|hand_on_neck|hand_grabbing_hair|object_in_mouth|self_touch|none","description":"who is touching what, where, with what grip, what dynamic it creates","powerDynamic":"dominant|submissive|neutral"},"framing":{"shotType":"extreme_close_up|close_up|medium_close_up","angle":"eye_level|contrapicado_invertido|slight_high_angle","label":"short label in Spanish"},"promptHook":"the single most precise English phrase that reproduces this exact expression/gesture — e.g. 'eyes rolled back, mouth slightly open, glossy lips parted in ecstasy, heavy-lidded gaze unfocused upward'","scenario":{"location":"place or unknown","background":"what is visible","mood":"mood in one phrase","lighting":"lighting description"},"variations":[{"label":"Variación 1","expressionText":"variation of this expression — same gesture different intensity or angle","framingOverride":{"shotType":"type or null","angle":"angle or null","label":"label"}},{"label":"Variación 2","expressionText":"second variation","framingOverride":{"shotType":"type or null","angle":"angle or null","label":"label"}}],"tags":["expression_type","gesture","framing","mood — NO physical traits"]}`;
}

async function genServerBatchEntry(item, job) {
  // Step 1: fast classify
  const imageType = await classifyImageType(item, job.apiKey, job.id, job);

  // Step 2: full analysis with matching schema
  const isExpression = imageType === 'expression';
  const system = isExpression ? buildExpressionSystemPrompt() : buildBodySystemPrompt();
  const userPrompt = isExpression ? buildExpressionUserPrompt(item, job) : buildBodyUserPrompt(item, job);

  const data = await anthropicMessagesWithFallback(job.apiKey, {
    model: ANALYSIS_MODEL,
    max_tokens: 2200,
    system,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: item.mediaType, data: item.data } },
        { type: 'text', text: userPrompt }
      ]
    }]
  }, { jobId: job.id, itemIndex: item.index, itemName: item.name, call: 'analyze', imageType }, job);
  const raw = (data.content || []).map(block => block.text || '').join('').trim();
  return parseJsonFromText(raw);
}

function bankAppendEntry(entry) {
  ensureDataDir();
  let entries = [];
  if (fs.existsSync(BANK_FILE)) {
    try { entries = JSON.parse(fs.readFileSync(BANK_FILE, 'utf8')); } catch {}
  }
  if (!Array.isArray(entries)) entries = [];
  // skip exact id duplicates
  if (entries.some(e => e.id === entry.id)) return;
  entries.push(entry);
  fs.writeFileSync(BANK_FILE, JSON.stringify(entries, null, 2), 'utf8');
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitIfPaused(job) {
  while (job.paused && job.status !== 'completed' && job.status !== 'failed') {
    job.status = 'paused';
    persistJobs();
    await wait(700);
  }
}

async function processServerBatchJob(job) {
  if (!job || job.processing) return;
  if (!job.apiKey) {
    job.status = 'interrupted';
    job.current = 'Servidor reiniciado: no se puede continuar sin API key.';
    persistJobs();
    return;
  }

  job.processing = true;
  job.paused = false;
  job.status = 'running';
  job.startedAt = job.startedAt || Date.now();
  job.finishedAt = null;
  job.current = 'Procesando lote en servidor...';
  persistJobs();

  try {
    while (true) {
      await waitIfPaused(job);
      const pending = job.items.filter(item => item.status === 'pending' || item.status === 'incomplete');
      if (!pending.length) break;

      const batch = pending.slice(0, SERVER_BATCH_PARALLEL);
      batch.forEach(item => {
        item.status = 'processing';
        item.error = '';
      });
      job.status = 'running';
      job.current = 'Procesando imagenes ' + batch.map(item => item.index + 1).join(', ') + '...';
      persistJobs();

      await Promise.all(batch.map(async item => {
        try {
          // Si el data no está en memoria, intentar cargarlo desde disco
          if (!item.data) {
            item.data = loadImageFromDisk(job.id, item.index);
          }
          if (!item.data) throw new Error('Imagen no disponible. Reinicia el batch desde el cliente.');
          const parsed = await genServerBatchEntry(item, job);
          const hasVars = parsed.variations && parsed.variations.length >= 1;
          const entryId = 'batch_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
          const isExpression = parsed.schemaType === 'expression';
          const bankEntry = {
            id: entryId,
            source: 'batch',
            schemaType: parsed.schemaType || 'body',
            createdAt: new Date().toISOString(),
            name: item.name,
            thumb: item.thumb || null,
            mediaType: item.mediaType || 'image/jpeg',
            intent: parsed.intent || 'high_impact_scroll_stop',
            prompt: parsed.prompt || '',
            negativePrompt: parsed.negativePrompt || '',
            // body fields
            pose: isExpression ? null : (parsed.pose || {}),
            framing: parsed.framing || {},
            outfit: isExpression ? null : (parsed.outfit || {}),
            scenario: parsed.scenario || {},
            lighting: isExpression ? null : (parsed.lighting || {}),
            scrollStop: isExpression ? null : (parsed.scrollStop || {}),
            // expression fields
            expression: isExpression ? (parsed.expression || {}) : null,
            interaction: isExpression ? (parsed.interaction || {}) : null,
            promptHook: isExpression ? (parsed.promptHook || '') : null,
            // shared
            variations: parsed.variations || [],
            tags: parsed.tags || []
          };
          // Build assembled variations for the batch results UI/PDF
          // Replace [bracketed] section in base prompt with each variation's pose/expression text
          const basePrompt = parsed.prompt || '';
          const baseNeg = parsed.negativePrompt || '';
          const isExpr = parsed.schemaType === 'expression';
          const assembledVariations = (parsed.variations || []).map(v => {
            const swapText = isExpr
              ? (v.expressionText || v.poseText || '')
              : (v.poseText || '');
            const assembled = swapText
              ? basePrompt.replace(/\[.*?\]/, swapText)
              : basePrompt;
            return {
              label: v.label || '',
              positive: assembled,
              negative: baseNeg
            };
          });

          const result = {
            index: item.index,
            name: item.name,
            positive: basePrompt,
            negative: baseNeg,
            intent: parsed.intent || '',
            schemaType: parsed.schemaType || 'body',
            promptHook: parsed.promptHook || '',
            variations: assembledVariations,
            thumb: item.thumb,
            mediaType: item.mediaType,
            bankEntry,
            hasVars: assembledVariations.length > 0
          };
          item.status = 'done';
          item.result = result;
          item.data = null;
          // Borrar imagen del disco — ya no se necesita
          deleteImageFromDisk(job.id, item.index);
          job.results = (job.results || []).filter(existing => existing.index !== item.index);
          job.results.push(result);
          job.results.sort((a, b) => a.index - b.index);
          // auto-append to bank
          bankAppendEntry(bankEntry);
        } catch (err) {
          item.status = 'error';
          item.error = err.message || 'Error desconocido';
          item.data = null;
          // NO borrar imagen del disco — puede reintentarse
        }
        persistJobs();
      }));

      if (job.items.some(item => item.status === 'pending' || item.status === 'incomplete')) {
        await wait(SERVER_BATCH_DELAY_MS);
      }
    }

    job.processing = false;
    job.status = 'completed';
    job.finishedAt = Date.now();
    job.current = 'Completado';
    persistJobs();
  } catch (err) {
    job.processing = false;
    job.status = 'failed';
    job.current = err.message || 'Error general del servidor';
    persistJobs();
  }
}

function createBatchJob(apiKey, options) {
  const id = 'job_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
  const job = {
    id,
    apiKey,
    status: 'uploading',
    createdAt: Date.now(),
    startedAt: null,
    finishedAt: null,
    current: 'Recibiendo imagenes...',
    options: options || {},
    items: [],
    results: [],
    processing: false,
    paused: false
  };
  jobs.set(id, job);
  persistJobs();
  return job;
}

function getJobFromPath(pathname) {
  const match = pathname.match(/^\/api\/server-batch\/jobs\/([^/]+)(?:\/([^/]+))?$/);
  if (!match) return null;
  const job = jobs.get(match[1]);
  return { jobId: match[1], action: match[2] || '', job };
}

function getGenerateJobFromPath(pathname) {
  const match = pathname.match(/^\/api\/server-generate\/jobs\/([^/]+)$/);
  if (!match) return null;
  const job = generateJobs.get(match[1]);
  return { jobId: match[1], job };
}

function getOptimizeJobFromPath(pathname) {
  const match = pathname.match(/^\/api\/server-optimize\/jobs\/([^/]+)$/);
  if (!match) return null;
  const job = optimizeJobs.get(match[1]);
  return { jobId: match[1], job };
}

function getCampaignStoreRoute(pathname) {
  const match = pathname.match(/^\/api\/campaign-store\/records\/([^/]+)(?:\/(image|thumbnail))?$/);
  if (!match) return null;
  let id = '';
  try { id = safeCampaignId(decodeURIComponent(match[1])); } catch (_) { return null; }
  return { id, asset: match[2] || null };
}

function createOptimizeJob(body) {
  const text = String(body.text || '');
  const id = 'opt_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
  const job = {
    id,
    apiKey: SERVER_MANAGED_CREDENTIAL,
    text,
    originalLength: text.length,
    status: 'queued',
    createdAt: Date.now(),
    startedAt: null,
    finishedAt: null,
    current: 'Optimizacion en cola...',
    error: '',
    result: '',
    processing: false
  };
  optimizeJobs.set(id, job);
  persistOptimizeJobs();
  return job;
}

async function processOptimizeJob(job) {
  if (!job || job.processing) return;
  if (!job.apiKey || !job.text) {
    job.status = 'failed';
    job.error = 'Falta texto para optimizar.';
    job.current = job.error;
    persistOptimizeJobs();
    return;
  }

  job.processing = true;
  job.status = 'running';
  job.startedAt = job.startedAt || Date.now();
  job.current = 'Optimizando prompt en servidor...';
  persistOptimizeJobs();

  try {
    const data = await anthropicMessagesWithFallback(job.apiKey, {
      model: ANALYSIS_MODEL,
      max_tokens: 800,
      system: 'Compress this image generation prompt to under 2200 characters. Preserve all key information. Return ONLY the compressed prompt text.',
      messages: [{ role: 'user', content: 'Compress:\n\n' + job.text }]
    });
    job.result = (data.content || []).map(block => block.text || '').join('').trim();
    job.text = '';
    job.status = 'completed';
    job.current = 'Prompt optimizado';
    job.finishedAt = Date.now();
    job.processing = false;
    persistOptimizeJobs();
  } catch (err) {
    job.text = '';
    job.status = 'failed';
    job.error = err.message || 'Error optimizando prompt';
    job.current = job.error;
    job.finishedAt = Date.now();
    job.processing = false;
    persistOptimizeJobs();
  }
}

function createGenerateJob(body) {
  const id = 'gen_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
  const image = body.image || {};
  const request = body.request || {};
  const job = {
    id,
    apiKey: SERVER_MANAGED_CREDENTIAL,
    status: 'queued',
    createdAt: Date.now(),
    startedAt: null,
    finishedAt: null,
    current: 'Generacion individual en cola...',
    error: '',
    imageData: String(image.data || ''),
    thumb: String(image.thumb || image.data || ''),
    mediaType: String(image.mediaType || 'image/jpeg'),
    request: {
      system: String(request.system || ''),
      userPrompt: String(request.userPrompt || ''),
      maxTokens: Number(request.maxTokens || 1800)
    },
    raw: '',
    result: null,
    processing: false
  };
  generateJobs.set(id, job);
  persistGenerateJobs();
  return job;
}

async function processGenerateJob(job) {
  if (!job || job.processing) return;
  if (!job.apiKey || !job.imageData || !job.request || !job.request.userPrompt) {
    job.status = 'failed';
    job.error = 'Faltan datos para procesar esta generacion.';
    job.current = job.error;
    persistGenerateJobs();
    return;
  }

  job.processing = true;
  job.status = 'running';
  job.startedAt = job.startedAt || Date.now();
  job.finishedAt = null;
  job.current = 'Analizando imagen con IA...';
  persistGenerateJobs();

  try {
    const data = await anthropicMessagesWithFallback(job.apiKey, {
      model: ANALYSIS_MODEL,
      max_tokens: job.request.maxTokens || 1800,
      system: job.request.system,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: job.mediaType, data: job.imageData } },
          { type: 'text', text: job.request.userPrompt }
        ]
      }]
    });
    const raw = (data.content || []).map(block => block.text || '').join('').trim();
    const parsed = parseJsonFromText(raw);
    job.raw = raw;
    job.result = {
      positive: parsed.positive || '',
      negative: parsed.negative || ''
    };
    job.status = 'completed';
    job.current = 'Prompt generado';
    job.finishedAt = Date.now();
    job.imageData = null;
    job.processing = false;
    persistGenerateJobs();
  } catch (err) {
    job.status = 'failed';
    job.error = err.message || 'Error generando prompt';
    job.current = job.error;
    job.finishedAt = Date.now();
    job.imageData = null;
    job.processing = false;
    persistGenerateJobs();
  }
}

loadJobs();
loadLogs();
ensureCampaignDataDir();
directorLabSeed.ensureSeeded();

const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url);

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key, anthropic-version');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  try {
    if (parsed.pathname.startsWith('/api/director-lab/')) {
      const handled = await directorLabRoutes.handle(req, res, parsed, { vertex, sendJson, readJson });
      if (handled) return;
    }

    if (parsed.pathname.startsWith('/api/photodump-trainer/')) {
      const handled = await photodumpTrainerRoutes.handle(req, res, parsed, { vertex, sendJson, readJson });
      if (handled) return;
    }

    if (req.method === 'GET' && parsed.pathname === '/api/campaign-store/status') {
      ensureCampaignDataDir();
      const records = listCampaignRecords();
      sendJson(res, 200, {
        ok: true,
        schemaVersion: '3.5-disk-store',
        directory: CAMPAIGN_DATA_DIR,
        stats: campaignStoreStats(records)
      });
      return;
    }

    if (req.method === 'GET' && parsed.pathname === '/api/campaign-store/records') {
      const records = listCampaignRecords().map(publicCampaignRecord);
      sendJson(res, 200, {
        schemaVersion: '3.5-disk-store',
        records,
        stats: campaignStoreStats(records)
      });
      return;
    }

    if (req.method === 'GET' && parsed.pathname === '/api/campaign-store/scene-bank') {
      ensureCampaignDataDir();
      if (!fs.existsSync(CAMPAIGN_SCENE_BANK_FILE)) {
        sendJson(res, 200, { ok: true, bank: null });
        return;
      }
      try {
        const bank = JSON.parse(fs.readFileSync(CAMPAIGN_SCENE_BANK_FILE, 'utf8'));
        sendJson(res, 200, { ok: true, bank });
      } catch (error) {
        sendJson(res, 500, { error: 'No se pudo leer scene-bank.json: ' + error.message });
      }
      return;
    }

    if (req.method === 'POST' && parsed.pathname === '/api/campaign-store/scene-bank') {
      const body = await readJson(req, 24 * 1024 * 1024);
      const bank = body && body.bank;
      if (!bank || typeof bank !== 'object' || !Array.isArray(bank.scenes)) {
        sendJson(res, 400, { error: 'Banco de escenas inválido' });
        return;
      }
      ensureCampaignDataDir();
      const stored = {
        ...bank,
        schemaVersion: bank.schemaVersion || 'scene_bank_v1',
        updatedAt: new Date().toISOString()
      };
      atomicWriteFileSync(CAMPAIGN_SCENE_BANK_FILE, JSON.stringify(stored, null, 2), 'utf8');
      sendJson(res, 200, {
        ok: true,
        updatedAt: stored.updatedAt,
        totalScenes: stored.scenes.length
      });
      return;
    }

    if (req.method === 'POST' && parsed.pathname === '/api/campaign-store/records') {
      const body = await readJson(req, 30 * 1024 * 1024);
      const record = saveCampaignRecord(body);
      sendJson(res, 200, { ok: true, record: publicCampaignRecord(record) });
      return;
    }

    if (req.method === 'POST' && parsed.pathname === '/api/campaign-store/queue/clear') {
      const changed = clearCampaignQueue();
      sendJson(res, 200, { ok: true, changed });
      return;
    }

    if (req.method === 'GET' && parsed.pathname === '/api/campaign-store/export') {
      const records = listCampaignRecords().map(publicCampaignRecord);
      sendJson(res, 200, {
        schemaVersion: '3.5-disk-store-export',
        exportedAt: new Date().toISOString(),
        stats: campaignStoreStats(records),
        records
      });
      return;
    }

    if (req.method === 'DELETE' && parsed.pathname === '/api/campaign-store/records') {
      ensureCampaignDataDir();
      fs.rmSync(CAMPAIGN_DATA_DIR, { recursive: true, force: true });
      ensureCampaignDataDir();
      persistCampaignManifest([]);
      sendJson(res, 200, { ok: true, deleted: true });
      return;
    }

    const campaignStoreRoute = getCampaignStoreRoute(parsed.pathname);
    if (campaignStoreRoute && req.method === 'GET') {
      if (!campaignStoreRoute.asset) {
        const record = readCampaignRecord(campaignStoreRoute.id);
        if (!record) { sendJson(res, 404, { error: 'Registro no encontrado' }); return; }
        sendJson(res, 200, { record: publicCampaignRecord(record) });
        return;
      }
      const directory = campaignStoreRoute.asset === 'thumbnail' ? CAMPAIGN_THUMBS_DIR : CAMPAIGN_IMAGES_DIR;
      const asset = findCampaignAsset(directory, campaignStoreRoute.id);
      if (!asset) { sendJson(res, 404, { error: 'Imagen no encontrada' }); return; }
      const ext = path.extname(asset).toLowerCase();
      const mimeType = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : ext === '.gif' ? 'image/gif' : 'image/jpeg';
      res.writeHead(200, {
        'Content-Type': mimeType,
        'Cache-Control': 'private, max-age=3600',
        'Content-Length': fs.statSync(asset).size
      });
      fs.createReadStream(asset).pipe(res);
      return;
    }

    if (req.method === 'GET' && parsed.pathname === '/api/server-optimize/jobs') {
      const list = Array.from(optimizeJobs.values())
        .map(publicOptimizeJob)
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, 20);
      sendJson(res, 200, { jobs: list });
      return;
    }

    const optimizeRoute = getOptimizeJobFromPath(parsed.pathname);
    if (optimizeRoute && req.method === 'GET') {
      if (!optimizeRoute.job) {
        sendJson(res, 404, { error: 'Optimizacion no encontrada' });
        return;
      }
      sendJson(res, 200, { job: publicOptimizeJob(optimizeRoute.job) });
      return;
    }

    if (req.method === 'POST' && parsed.pathname === '/api/server-optimize/jobs') {
      const body = await readJson(req);
      if (!vertex.publicConfig().ready) {
        sendJson(res, 503, { error: vertex.publicConfig().error });
        return;
      }
      if (!String(body.text || '').trim()) {
        sendJson(res, 400, { error: 'Falta texto para optimizar' });
        return;
      }
      const job = createOptimizeJob(body);
      processOptimizeJob(job);
      sendJson(res, 201, { job: publicOptimizeJob(job) });
      return;
    }

    if (optimizeRoute && req.method === 'DELETE') {
      if (!optimizeRoute.job) {
        sendJson(res, 404, { error: 'Optimizacion no encontrada' });
        return;
      }
      optimizeJobs.delete(optimizeRoute.jobId);
      persistOptimizeJobs();
      sendJson(res, 200, { ok: true });
      return;
    }

    if (req.method === 'GET' && parsed.pathname === '/api/server-generate/jobs') {
      const list = Array.from(generateJobs.values())
        .map(publicGenerateJob)
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, 20);
      sendJson(res, 200, { jobs: list });
      return;
    }

    const generateRoute = getGenerateJobFromPath(parsed.pathname);
    if (generateRoute && req.method === 'GET') {
      if (!generateRoute.job) {
        sendJson(res, 404, { error: 'Generacion no encontrada' });
        return;
      }
      sendJson(res, 200, { job: publicGenerateJob(generateRoute.job) });
      return;
    }

    if (req.method === 'POST' && parsed.pathname === '/api/server-generate/jobs') {
      const body = await readJson(req);
      if (!vertex.publicConfig().ready) {
        sendJson(res, 503, { error: vertex.publicConfig().error });
        return;
      }
      if (!body.image || !body.image.data) {
        sendJson(res, 400, { error: 'Falta la imagen' });
        return;
      }
      const job = createGenerateJob(body);
      processGenerateJob(job);
      sendJson(res, 201, { job: publicGenerateJob(job) });
      return;
    }

    if (generateRoute && req.method === 'DELETE') {
      if (!generateRoute.job) {
        sendJson(res, 404, { error: 'Generacion no encontrada' });
        return;
      }
      generateJobs.delete(generateRoute.jobId);
      persistGenerateJobs();
      sendJson(res, 200, { ok: true });
      return;
    }

    if (req.method === 'GET' && parsed.pathname === '/api/server-batch/jobs') {
      const list = Array.from(jobs.values())
        .map(publicJob)
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, 20);
      sendJson(res, 200, { jobs: list });
      return;
    }

    const batchRoute = getJobFromPath(parsed.pathname);
    if (batchRoute && req.method === 'GET' && batchRoute.job) {
      sendJson(res, 200, { job: publicJob(batchRoute.job) });
      return;
    }

    if (req.method === 'POST' && parsed.pathname === '/api/server-batch/jobs') {
      const body = await readJson(req);
      if (!vertex.publicConfig().ready) {
        sendJson(res, 503, { error: vertex.publicConfig().error });
        return;
      }
      const job = createBatchJob(SERVER_MANAGED_CREDENTIAL, body.options || {});
      sendJson(res, 201, { job: publicJob(job) });
      return;
    }

    if (batchRoute && req.method === 'POST') {
      const { job, action } = batchRoute;
      if (!job) {
        sendJson(res, 404, { error: 'Trabajo no encontrado' });
        return;
      }

      if (action === 'items') {
        if (job.status !== 'uploading') {
          sendJson(res, 409, { error: 'Este trabajo ya no esta recibiendo imagenes' });
          return;
        }
        const body = await readJson(req);
        const data = String(body.data || '');
        const thumb = String(body.thumb || '');
        const mediaType = String(body.mediaType || 'image/jpeg');
        const name = String(body.name || 'image-' + (job.items.length + 1));
        if (!data) {
          sendJson(res, 400, { error: 'Imagen vacia' });
          return;
        }
        const itemIndex = job.items.length;
        // Guardar imagen en disco para sobrevivir reinicios y reintentos
        saveImageToDisk(job.id, itemIndex, data);
        const item = {
          index: itemIndex,
          name,
          mediaType,
          data,
          thumb: thumb || data,
          status: 'pending',
          error: '',
          result: null
        };
        job.items.push(item);
        job.current = 'Imagenes recibidas: ' + job.items.length;
        persistJobs();
        sendJson(res, 201, { job: publicJob(job) });
        return;
      }

      if (action === 'start') {
        if (!job.items.length) {
          sendJson(res, 400, { error: 'No hay imagenes cargadas' });
          return;
        }
        job.status = 'queued';
        job.current = 'Trabajo en cola...';
        persistJobs();
        processServerBatchJob(job);
        sendJson(res, 200, { job: publicJob(job) });
        return;
      }

      if (action === 'pause') {
        job.paused = true;
        job.status = 'paused';
        job.current = 'Pausado';
        persistJobs();
        sendJson(res, 200, { job: publicJob(job) });
        return;
      }

      if (action === 'resume') {
        job.paused = false;
        job.status = 'queued';
        job.current = 'Reanudando...';
        persistJobs();
        processServerBatchJob(job);
        sendJson(res, 200, { job: publicJob(job) });
        return;
      }

      if (action === 'retry-errors') {
        // Resetea los items en error a pending y carga sus imágenes desde disco
        const errorItems = job.items.filter(i => i.status === 'error');
        if (!errorItems.length) {
          sendJson(res, 400, { error: 'No hay items con error para reintentar' });
          return;
        }
        let restoredCount = 0;
        errorItems.forEach(item => {
          const diskData = loadImageFromDisk(job.id, item.index);
          if (diskData) {
            item.data = diskData;
            item.status = 'pending';
            item.error = '';
            restoredCount++;
          } else {
            item.error = 'Imagen no disponible en disco — re-sube el batch';
          }
        });
        if (!restoredCount) {
          sendJson(res, 400, { error: 'No se pudo recuperar ninguna imagen del disco. Debes re-subir el batch.' });
          return;
        }
        await readJson(req).catch(() => ({}));
        job.apiKey = SERVER_MANAGED_CREDENTIAL;
        job.status = 'queued';
        job.finishedAt = null;
        job.current = `Reintentando ${restoredCount} items con error...`;
        persistJobs();
        processServerBatchJob(job);
        sendJson(res, 200, { job: publicJob(job), restored: restoredCount });
        return;
      }
    }

    if (batchRoute && req.method === 'DELETE') {
      if (!batchRoute.job) {
        sendJson(res, 404, { error: 'Trabajo no encontrado' });
        return;
      }
      jobs.delete(batchRoute.jobId);
      persistJobs();
      sendJson(res, 200, { ok: true });
      return;
    }

    // ── PROMPT BANK ──────────────────────────────────────────
    // ── LOGS ─────────────────────────────────────────────────────────────────
    if (req.method === 'GET' && parsed.pathname === '/api/logs') {
      const qp = new URLSearchParams(parsed.query || '');
      const limit = Math.min(parseInt(qp.get('limit') || '200', 10), 2000);
      const since = qp.get('since'); // ISO timestamp — devuelve solo logs más nuevos
      let logs = apiLogs.slice(-limit);
      if (since) {
        logs = logs.filter(l => l.ts > since);
      }
      // Totales acumulados
      const totals = apiLogs.reduce((acc, l) => {
        if (l.charged) {
          acc.totalInputTokens  += l.inputTokens  || 0;
          acc.totalOutputTokens += l.outputTokens || 0;
          acc.totalCostUSD      += l.costUSD      || 0;
          acc.successCalls++;
        } else {
          acc.errorCalls++;
        }
        return acc;
      }, { totalInputTokens: 0, totalOutputTokens: 0, totalCostUSD: 0, successCalls: 0, errorCalls: 0 });
      sendJson(res, 200, { logs, totals, total: apiLogs.length });
      return;
    }

    if (req.method === 'DELETE' && parsed.pathname === '/api/logs') {
      apiLogs.splice(0, apiLogs.length);
      persistLogs();
      sendJson(res, 200, { ok: true });
      return;
    }
    // ─────────────────────────────────────────────────────────────────────────

    if (req.method === 'GET' && parsed.pathname === '/api/bank/status') {
      sendJson(res, 200, { ok: true, file: BANK_FILE });
      return;
    }

    if (req.method === 'GET' && parsed.pathname === '/api/bank') {
      ensureDataDir();
      let entries = [];
      if (fs.existsSync(BANK_FILE)) {
        try { entries = JSON.parse(fs.readFileSync(BANK_FILE, 'utf8')); } catch {}
      }
      sendJson(res, 200, { entries });
      return;
    }

    if (req.method === 'POST' && parsed.pathname === '/api/bank') {
      const body = await readJson(req);
      const entries = Array.isArray(body.entries) ? body.entries : [];
      ensureDataDir();
      fs.writeFileSync(BANK_FILE, JSON.stringify(entries, null, 2), 'utf8');
      sendJson(res, 200, { ok: true, count: entries.length });
      return;
    }

    if (req.method === 'POST' && parsed.pathname === '/api/bank/append') {
      const body = await readJson(req);
      const entry = body.entry;
      if (!entry || !entry.id) { sendJson(res, 400, { error: 'entry missing' }); return; }
      bankAppendEntry(entry);
      sendJson(res, 200, { ok: true });
      return;
    }
    // ─────────────────────────────────────────────────────────

    // Serve HTML files
    if (req.method === 'GET') {
      let filename = null;
      if (parsed.pathname === '/' || parsed.pathname === '/index.html' || parsed.pathname === '/director-lab.html') {
        filename = 'director-lab.html';
      }
      if (parsed.pathname === '/photodump-trainer.html') {
        filename = 'photodump-trainer.html';
      }
      if (filename) {
        const htmlPath = path.join(__dirname, filename);
        fs.readFile(htmlPath, (err, data) => {
          if (err) { sendText(res, 404, 'Not found'); return; }
          sendText(res, 200, data, 'text/html; charset=utf-8');
        });
        return;
      }
    }

    if (req.method === 'GET' && parsed.pathname === '/api/provider/status') {
      sendJson(res, 200, vertex.publicConfig());
      return;
    }

    // Compatibility endpoint: old UI request shape in, Gemini/Vertex result out.
    if (req.method === 'POST' && parsed.pathname === '/api/messages') {
      try {
        const payload = await readJson(req, 20 * 1024 * 1024);
        const data = await anthropicMessagesWithFallback(SERVER_MANAGED_CREDENTIAL, payload, { call: 'proxy' });
        sendJson(res, 200, data);
      } catch (err) {
        sendJson(res, err.statusCode || 502, { error: { message: err.message || 'API error' } });
      }
      return;
    }

    // Proxy /api/proxy-image -> fetch external image
    if (req.method === 'GET' && parsed.pathname === '/api/proxy-image') {
      const imgUrl = new URLSearchParams(parsed.query).get('url');
      if (!imgUrl || !imgUrl.match(/^https?:\/\//)) {
        sendText(res, 400, 'URL invalida');
        return;
      }
      const proto = imgUrl.startsWith('https') ? https : http;
      const proxyReq = proto.get(imgUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } }, proxyRes => {
        if (proxyRes.statusCode >= 300 && proxyRes.statusCode < 400 && proxyRes.headers.location) {
          const redir = proxyRes.headers.location;
          const rProto = redir.startsWith('https') ? https : http;
          rProto.get(redir, { headers: { 'User-Agent': 'Mozilla/5.0' } }, r2 => {
            const ct = r2.headers['content-type'] || 'image/jpeg';
            res.writeHead(r2.statusCode, { 'Content-Type': ct, 'Access-Control-Allow-Origin': '*' });
            r2.pipe(res);
          }).on('error', err => { sendText(res, 502, err.message); });
          return;
        }
        const ct = proxyRes.headers['content-type'] || 'image/jpeg';
        res.writeHead(proxyRes.statusCode, { 'Content-Type': ct, 'Access-Control-Allow-Origin': '*' });
        proxyRes.pipe(res);
      });
      proxyReq.on('error', err => { sendText(res, 502, err.message); });
      return;
    }

    // Proxy /ollama/* -> local Ollama
    if (parsed.pathname.startsWith('/ollama/')) {
      const ollamaPath = parsed.pathname.replace('/ollama', '');
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        const options = {
          hostname: '127.0.0.1',
          port: 11434,
          path: ollamaPath,
          method: req.method,
          headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
        };
        const proxyReq = http.request(options, proxyRes => {
          res.writeHead(proxyRes.statusCode, { 'Content-Type': 'application/json' });
          proxyRes.pipe(res);
        });
        proxyReq.on('error', err => {
          sendJson(res, 502, { error: err.message });
        });
        proxyReq.write(body);
        proxyReq.end();
      });
      return;
    }

    if (parsed.pathname === '/favicon.ico') { res.writeHead(204); res.end(); return; }

    sendText(res, 404, 'Not found');
  } catch (err) {
    if (!res.headersSent) sendJson(res, 500, { error: err.message || 'Server error' });
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('');
  console.log('  SeaDream Prompt Studio');
  console.log('  Local:   http://localhost:' + PORT);
  console.log('  Provider: Vertex AI / ' + GEMINI_MODEL);
  console.log('');
  console.log('  Ctrl+C para detener.');
  console.log('');
});
