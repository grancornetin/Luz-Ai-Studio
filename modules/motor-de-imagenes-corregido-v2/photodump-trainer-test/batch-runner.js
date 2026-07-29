const fs = require('fs');
const path = require('path');
const { generateAnthropicCompatible } = require('../vertex-client');

const SYSTEM_PROMPT = fs.readFileSync(path.join(__dirname, 'system-prompt.txt'), 'utf8');

const MIN_INTERVAL_MS = 2000;      // piso: nunca más rápido que esto entre imágenes
const START_INTERVAL_MS = 9000;    // arranque optimista, cerca de lo medido en pruebas sueltas
const MAX_INTERVAL_MS = 60000;     // techo: si el 429 persiste, no seguir doblando sin límite
const BACKOFF_STEPS = [10000, 20000, 30000, 60000]; // reintento de LA MISMA imagen tras 429/503

function wait(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

function mimeTypeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  return 'image/jpeg';
}

async function analyzeOnce(imagePath) {
  const buffer = fs.readFileSync(imagePath);
  const base64 = buffer.toString('base64');
  const result = await generateAnthropicCompatible({
    system: SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: 'Analiza esta imagen según las instrucciones del sistema. Responde solo el JSON.' },
        { type: 'image', source: { type: 'base64', media_type: mimeTypeFor(imagePath), data: base64 } }
      ]
    }],
    response_mime_type: 'application/json',
    max_tokens: 4000
  });
  const text = (result.content || []).map(b => b.text || '').join('');
  return { text, usage: result.usage };
}

// Reintenta LA MISMA imagen en 429/503 con backoff creciente, sin frenar el resto del lote
// (misma política que server.js: anthropicMessagesWithFallback).
async function analyzeWithRetry(imagePath, onStatus) {
  let attempt = 0;
  while (true) {
    try {
      return await analyzeOnce(imagePath);
    } catch (err) {
      const isRateLimit = err.isRateLimit || /429|rate|quota/i.test(err.message || '');
      const isOverloaded = err.isOverloaded || /503|overload|unavailable/i.test(err.message || '');
      if (!isRateLimit && !isOverloaded) throw err;
      const delay = BACKOFF_STEPS[Math.min(attempt, BACKOFF_STEPS.length - 1)];
      onStatus && onStatus(`  RateLimit/Overloaded en "${path.basename(imagePath)}" — reintentando en ${delay / 1000}s (intento ${attempt + 1})`);
      await wait(delay);
      attempt++;
    }
  }
}

async function runBatch(imagePaths, { outputDir, onProgress } = {}) {
  if (outputDir) fs.mkdirSync(outputDir, { recursive: true });

  let intervalMs = START_INTERVAL_MS;
  const results = [];

  for (let i = 0; i < imagePaths.length; i++) {
    const imagePath = imagePaths[i];
    const label = `[${i + 1}/${imagePaths.length}] ${path.basename(imagePath)}`;
    onProgress && onProgress(`${label} — analizando...`);

    let hitRateLimit = false;
    const start = Date.now();
    const { text, usage } = await analyzeWithRetry(imagePath, msg => {
      hitRateLimit = true;
      onProgress && onProgress(msg);
    });
    const elapsed = Date.now() - start;

    let parsed = null;
    try { parsed = JSON.parse(text); } catch (_) { /* se guarda igual el texto crudo */ }

    const entry = {
      sourceFile: path.basename(imagePath),
      analyzedAt: new Date().toISOString(),
      elapsedMs: elapsed,
      usage,
      analysis: parsed || { raw_text: text }
    };
    results.push(entry);

    if (outputDir) {
      const outFile = path.join(outputDir, path.basename(imagePath).replace(/\.[^.]+$/, '') + '.json');
      fs.writeFileSync(outFile, JSON.stringify(entry, null, 2), 'utf8');
    }

    onProgress && onProgress(`${label} — OK (${elapsed}ms, ${usage.input_tokens + usage.output_tokens} tokens)`);

    // Ritmo adaptativo: si esta imagen disparó un 429/503, duplicar el intervalo para el resto
    // del lote (hasta el techo); si no, mantener el ritmo actual sin acelerar de nuevo solo,
    // para no volver a golpear el límite apenas se relaja.
    if (hitRateLimit) {
      intervalMs = Math.min(MAX_INTERVAL_MS, intervalMs * 2);
      onProgress && onProgress(`  Ritmo ajustado: ahora ${intervalMs / 1000}s entre imágenes.`);
    }

    const isLast = i === imagePaths.length - 1;
    if (!isLast) {
      const remaining = Math.max(MIN_INTERVAL_MS, intervalMs - elapsed);
      await wait(remaining);
    }
  }

  return results;
}

module.exports = { runBatch };

// Uso directo por CLI: node batch-runner.js <carpeta-de-imagenes> <carpeta-de-salida>
if (require.main === module) {
  const inputDir = process.argv[2];
  const outputDir = process.argv[3];
  if (!inputDir || !outputDir) {
    console.error('Uso: node batch-runner.js <carpeta-de-imagenes> <carpeta-de-salida>');
    process.exit(1);
  }
  const files = fs.readdirSync(inputDir)
    .filter(f => /\.(jpe?g|png|webp)$/i.test(f))
    .map(f => path.join(inputDir, f));

  console.log(`Encontradas ${files.length} imágenes en ${inputDir}`);
  runBatch(files, { outputDir, onProgress: msg => console.log(msg) })
    .then(results => {
      console.log(`\nListo. ${results.length} imágenes procesadas. Resultados en ${outputDir}`);
    })
    .catch(err => {
      console.error('ERROR en el batch:', err.message);
      process.exit(1);
    });
}
