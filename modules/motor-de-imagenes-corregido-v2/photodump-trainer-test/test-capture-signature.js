const fs = require('fs');
const vertex = require('../vertex-client');
const { getSystemPrompt } = require('../photodump-trainer/core/system-prompt');
const store = require('../photodump-trainer/core/store');

function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

const BACKOFF_STEPS = [10000, 20000, 30000, 60000];

async function analyzeOne(item) {
  const buffer = fs.readFileSync(store.imagePath(item.id, item.ext));
  const base64 = buffer.toString('base64');
  const result = await vertex.generateAnthropicCompatible({
    system: getSystemPrompt(),
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: 'Analiza esta imagen según las instrucciones del sistema. Responde solo el JSON.' },
        { type: 'image', source: { type: 'base64', media_type: item.mimeType, data: base64 } }
      ]
    }],
    response_mime_type: 'application/json',
    max_tokens: 4000
  });
  const text = (result.content || []).map(b => b.text || '').join('');
  return text;
}

async function analyzeWithRetry(item) {
  let attempt = 0;
  while (true) {
    try {
      return await analyzeOne(item);
    } catch (err) {
      const isRateLimit = /429|rate|quota/i.test(err.message || '');
      const isOverloaded = /503|overload|unavailable/i.test(err.message || '');
      if (!isRateLimit && !isOverloaded) throw err;
      const delay = BACKOFF_STEPS[Math.min(attempt, BACKOFF_STEPS.length - 1)];
      console.log(`  -> rate limit, esperando ${delay / 1000}s...`);
      await wait(delay);
      attempt++;
    }
  }
}

async function main() {
  const targetNames = process.argv.slice(2);
  const bank = store.loadBank();
  const items = targetNames.length
    ? bank.items.filter(i => targetNames.includes(i.name))
    : bank.items.slice(0, 3);

  console.log(`Probando capture_signature en ${items.length} imágenes...\n`);

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    process.stdout.write(`[${i + 1}/${items.length}] ${item.name}... `);
    const text = await analyzeWithRetry(item);
    let parsed = null;
    try { parsed = JSON.parse(text); } catch (_) {}
    if (parsed) {
      console.log('OK');
      console.log('  capture_signature (raw):', parsed.raw_visual_description?.capture_signature);
      console.log('  capture_signature (tags):', parsed.search_tags?.capture_signature);
      console.log('  lighting:', parsed.raw_visual_description?.lighting);
      console.log('  camera_framing:', parsed.raw_visual_description?.camera_framing);
    } else {
      console.log('PARSE ERROR');
      console.log(text.slice(0, 300));
    }
    console.log('');
    if (i < items.length - 1) await wait(25000);
  }
}

main().catch(err => { console.error('ERROR:', err.message); process.exit(1); });
