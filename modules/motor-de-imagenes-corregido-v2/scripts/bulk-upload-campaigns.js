// Script de subida en bloque para campaign-trainer, replicando la lógica de chunking del
// front-end (bloques de 20, reintento por bloque) para poder subir carpetas grandes sin
// depender del navegador. Uso: node scripts/bulk-upload-campaigns.js "<carpeta>" [...más carpetas]
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const http = require('http');

const API = 'http://localhost:3131/api/campaign-trainer';
const CHUNK_SIZE = 20;
const MAX_RETRIES = 3;
const IMAGE_EXT = /\.(jpg|jpeg|png|webp)$/i;

function mimeFromExt(ext) {
  ext = ext.toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  return 'image/jpeg';
}

function postJson(pathname, bodyObj) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(bodyObj);
    const req = http.request(API + pathname, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, res => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) resolve(JSON.parse(data));
        else reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 300)}`));
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function uploadChunkWithRetry(items, label) {
  let attempt = 0;
  while (true) {
    try {
      await postJson('/jobs', { items });
      console.log(`  OK ${label} (${items.length} imágenes)`);
      return true;
    } catch (err) {
      attempt++;
      console.log(`  falló intento ${attempt}/${MAX_RETRIES} de ${label}: ${err.message}`);
      if (attempt >= MAX_RETRIES) return false;
      await new Promise(r => setTimeout(r, 3000 * attempt));
    }
  }
}

async function main() {
  const folders = process.argv.slice(2);
  if (!folders.length) {
    console.error('Uso: node bulk-upload-campaigns.js <carpeta1> [carpeta2...]');
    process.exit(1);
  }

  let totalUploaded = 0;
  let totalFailed = 0;

  for (const folder of folders) {
    if (!fs.existsSync(folder)) { console.log(`Carpeta no existe, se salta: ${folder}`); continue; }
    const files = fs.readdirSync(folder).filter(n => IMAGE_EXT.test(n));
    if (!files.length) { console.log(`Sin imágenes en: ${folder}`); continue; }

    console.log(`\n=== ${path.basename(folder)}: ${files.length} imágenes ===`);
    const chunks = chunk(files, CHUNK_SIZE);

    for (let c = 0; c < chunks.length; c++) {
      const items = chunks[c].map(name => {
        const filePath = path.join(folder, name);
        const buffer = fs.readFileSync(filePath);
        const ext = path.extname(name);
        return {
          name,
          mimeType: mimeFromExt(ext),
          dataBase64: buffer.toString('base64'),
          contentHash: crypto.createHash('sha256').update(buffer).digest('hex')
        };
      });

      const label = `bloque ${c + 1}/${chunks.length}`;
      const ok = await uploadChunkWithRetry(items, label);
      if (ok) totalUploaded += items.length;
      else totalFailed += items.length;
    }
  }

  console.log(`\n=== Resumen: ${totalUploaded} subidas, ${totalFailed} fallidas tras reintentos ===`);
}

main().catch(err => { console.error('Error fatal:', err); process.exit(1); });
