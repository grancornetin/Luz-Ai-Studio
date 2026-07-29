const fs = require('fs');
const vertex = require('../vertex-client');
const { getSystemPrompt } = require('../photodump-trainer/core/system-prompt');
const store = require('../photodump-trainer/core/store');

const BACKOFF_STEPS = [10000, 20000, 30000, 60000];

function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

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
  return { text, usage: result.usage };
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
  const items = targetNames.length ? bank.items.filter(i => targetNames.includes(i.name)) : bank.items;

  console.log(`Reprocesando ${items.length} imágenes con capture_signature...\n`);

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    process.stdout.write(`[${i + 1}/${items.length}] ${item.name}... `);
    try {
      const start = Date.now();
      const { text, usage } = await analyzeWithRetry(item);
      const elapsed = Date.now() - start;
      let parsed = null;
      try { parsed = JSON.parse(text); } catch (_) {}

      store.saveAnalysis(item.id, {
        itemId: item.id,
        sourceName: item.name,
        analyzedAt: new Date().toISOString(),
        elapsedMs: elapsed,
        usage,
        analysis: parsed || { raw_text: text }
      });

      item.elapsedMs = elapsed;
      if (parsed && parsed.search_tags) item.searchTags = parsed.search_tags;
      console.log(`OK (${elapsed}ms) — capture_signature: ${parsed?.search_tags?.capture_signature}`);
    } catch (err) {
      console.log(`ERROR: ${err.message}`);
    }

    store.saveBank(bank);
    if (i < items.length - 1) await wait(25000);
  }

  console.log('\nListo.');
}

main().catch(err => { console.error('ERROR:', err.message); process.exit(1); });
