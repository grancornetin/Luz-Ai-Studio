/**
 * scripts/compileBankSnapshot.js
 *
 * Junta bank.json + los análisis individuales (analyses/<itemId>.json) del
 * banco de fotos de Photodump en UN solo archivo JSON, filtrado a las
 * imágenes ya aprobadas (review: 'approved') — para que el Director
 * Creativo lea un solo archivo compilado en vez de abrir miles de archivos
 * sueltos, sin perder sincronía con lo que el usuario fue aprobando/
 * rechazando en el banco vivo.
 *
 * Uso:
 *   node scripts/compileBankSnapshot.js
 *   node scripts/compileBankSnapshot.js --out=ruta/personalizada.json
 *
 * Por defecto lee del directorio en la variable de entorno
 * PHOTODUMP_TRAINER_DATA_DIR (o del default de abajo si no está seteada),
 * y escribe el compilado en src/data/photodump-bank/bank-snapshot.json.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const cwd       = resolve(__dirname, '..');

const args = process.argv.slice(2).reduce((acc, arg) => {
  const m = arg.match(/^--([^=]+)=(.*)$/);
  if (m) acc[m[1]] = m[2];
  return acc;
}, {});

const DATA_DIR = process.env.PHOTODUMP_TRAINER_DATA_DIR
  || 'C:\\Users\\Nico Trabajo\\Downloads\\contenido de prueba\\photodump';

const OUT_PATH = args.out
  ? resolve(cwd, args.out)
  : resolve(cwd, 'src/data/photodump-bank/bank-snapshot.json');

const bankJsonPath = join(DATA_DIR, 'bank.json');
const analysesDir  = join(DATA_DIR, 'analyses');

if (!existsSync(bankJsonPath)) {
  console.error(`No se encontró bank.json en: ${bankJsonPath}`);
  console.error('Seteá PHOTODUMP_TRAINER_DATA_DIR o pasá --out para otra ruta de salida.');
  process.exit(1);
}

const bank = JSON.parse(readFileSync(bankJsonPath, 'utf-8'));
const items = Array.isArray(bank.items) ? bank.items : bank;

if (!Array.isArray(items)) {
  console.error('bank.json no tiene la forma esperada (array de items, o { items: [...] }).');
  process.exit(1);
}

const approved = items.filter(i => i.review === 'approved');
console.log(`bank.json: ${items.length} items totales, ${approved.length} aprobados.`);

const compiled = [];
let missing = 0;

for (const item of approved) {
  const analysisPath = join(analysesDir, `${item.id}.json`);
  if (!existsSync(analysisPath)) {
    missing++;
    continue;
  }
  try {
    const analysis = JSON.parse(readFileSync(analysisPath, 'utf-8'));
    compiled.push(analysis);
  } catch (err) {
    console.error(`Error leyendo/parseando ${analysisPath}: ${err.message}`);
    missing++;
  }
}

if (missing > 0) {
  console.warn(`Aviso: ${missing} items aprobados no tenían archivo de análisis legible (se omitieron).`);
}

const outDir = resolve(OUT_PATH, '..');
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

const snapshot = {
  compiledAt: new Date().toISOString(),
  sourceApprovedCount: approved.length,
  itemCount: compiled.length,
  items: compiled,
};

writeFileSync(OUT_PATH, JSON.stringify(snapshot), 'utf-8');

console.log(`Compilado: ${compiled.length} análisis escritos en ${OUT_PATH}`);
