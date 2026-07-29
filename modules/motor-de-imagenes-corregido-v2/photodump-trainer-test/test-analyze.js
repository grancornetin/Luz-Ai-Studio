const fs = require('fs');
const path = require('path');
const { generateAnthropicCompatible } = require('../vertex-client');

const SYSTEM_PROMPT = fs.readFileSync(path.join(__dirname, 'system-prompt.txt'), 'utf8');

async function main() {
  const imagePath = process.argv[2];
  if (!imagePath) {
    console.error('Uso: node test-analyze.js <ruta-imagen>');
    process.exit(1);
  }
  const buffer = fs.readFileSync(imagePath);
  const base64 = buffer.toString('base64');
  const ext = path.extname(imagePath).toLowerCase();
  const mimeType = ext === '.png' ? 'image/png' : 'image/jpeg';

  const start = Date.now();
  const result = await generateAnthropicCompatible({
    system: SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: 'Analiza esta imagen según las instrucciones del sistema. Responde solo el JSON.' },
        { type: 'image', source: { type: 'base64', media_type: mimeType, data: base64 } }
      ]
    }],
    response_mime_type: 'application/json',
    max_tokens: 4000
  });
  const elapsed = Date.now() - start;

  const text = (result.content || []).map(b => b.text || '').join('');
  console.log('--- TIEMPO ---', elapsed + 'ms');
  console.log('--- USAGE ---', JSON.stringify(result.usage || {}, null, 2));
  console.log('--- RESPUESTA ---');
  console.log(text);
}

main().catch(err => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
