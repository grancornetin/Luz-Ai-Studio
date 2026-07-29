const fs = require('fs');
const vertex = require('../vertex-client');
const { getSystemPrompt } = require('../photodump-trainer/core/system-prompt');
const store = require('../photodump-trainer/core/store');

async function main() {
  const name = process.argv[2];
  const bank = store.loadBank();
  const item = bank.items.find(i => i.name === name);
  if (!item) { console.log('no encontrado'); return; }

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
  console.log(text);
}
main().catch(err => { console.error('ERROR:', err.message); process.exit(1); });
