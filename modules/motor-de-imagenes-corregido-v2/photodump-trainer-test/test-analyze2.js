const fs = require('fs');
const path = require('path');
const { generateAnthropicCompatible } = require('../vertex-client');
const { getSystemPrompt } = require('../photodump-trainer/core/system-prompt');

async function main() {
  const imagePath = process.argv[2];
  const buffer = fs.readFileSync(imagePath);
  const base64 = buffer.toString('base64');
  const ext = path.extname(imagePath).toLowerCase();
  const mimeType = ext === '.png' ? 'image/png' : 'image/jpeg';

  const result = await generateAnthropicCompatible({
    system: getSystemPrompt(),
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
  const text = (result.content || []).map(b => b.text || '').join('');
  console.log(text);
}
main().catch(err => { console.error('ERROR:', err.message); process.exit(1); });
