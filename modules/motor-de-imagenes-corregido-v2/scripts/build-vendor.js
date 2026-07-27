'use strict';

// Compila a CommonJS (Node) los archivos TypeScript REALES de la app de
// producción que Director Lab necesita reusar tal cual (HPI real, contrato
// de la receta outfit_night_out) — sin reescribirlos ni duplicar su lógica.
//
// Volver a correr este script cada vez que cambien los archivos fuente
// listados abajo: `node scripts/build-vendor.js`.

const path = require('path');
const fs = require('fs');
const esbuild = require(path.join(__dirname, '..', '..', '..', 'node_modules', 'esbuild'));

const REPO_ROOT = path.join(__dirname, '..', '..', '..');
const VENDOR_DIR = path.join(__dirname, '..', 'director-lab', 'vendor');

const ENTRY_POINTS = [
  { src: 'src/services/hpiService.ts', out: 'src/services/hpiService.js' },
  { src: 'src/modules/photodump/recipes/outfitNightOut/types.ts', out: 'src/modules/photodump/recipes/outfitNightOut/types.js' },
  { src: 'src/modules/photodump/recipes/outfitNightOut/shotPool.ts', out: 'src/modules/photodump/recipes/outfitNightOut/shotPool.js' },
  { src: 'src/modules/photodump/recipes/outfitNightOut/nightMoments.ts', out: 'src/modules/photodump/recipes/outfitNightOut/nightMoments.js' },
  { src: 'src/modules/photodump/recipes/outfitNightOut/levelResolver.ts', out: 'src/modules/photodump/recipes/outfitNightOut/levelResolver.js' },
  { src: 'src/modules/photodump/recipes/outfitNightOut/intelligenceLayer.ts', out: 'src/modules/photodump/recipes/outfitNightOut/intelligenceLayer.js' },
  // promptBuilder.ts importa 5 constantes de texto puro directo desde
  // shared.ts, que además importa compressImageForUpload (usa Canvas/DOM, no
  // corre en Node). Se bundlea con tree-shaking para quedarse solo con el
  // código realmente alcanzado y descartar el resto de shared.ts (incluido
  // el import de imageUtils, que no se usa en el código alcanzable desde
  // buildShotPrompt/las 5 constantes que consume).
  { src: 'src/modules/photodump/recipes/outfitNightOut/promptBuilder.ts', out: 'src/modules/photodump/recipes/outfitNightOut/promptBuilder.js', bundle: true, external: ['./nightMoments', './intelligenceLayer'] },
];

// Los JSON de reglas de HPI se cargan con `await import('../data/HPI/...json')`
// dentro de hpiService.ts — deben existir en la misma ruta relativa dentro del
// árbol vendor para que esa ruta relativa siga resolviendo tras compilar.
const DATA_FILES_TO_COPY = [
  'src/data/HPI/03_reglas_director_hpi_mujer_151.json',
  'src/data/HPI/03_reglas_director_hpi_51 hombre.json',
];

// esbuild deja `await import('./algo.json')` literal en la salida CommonJS.
// Node exige `import(x, {with:{type:'json'}})` para import() dinámico de JSON
// bajo reglas ESM, lo que rompe en tiempo de ejecución dentro de un .js.
// require() de JSON en cambio siempre funciona en CommonJS sin restricciones
// — se reemplaza el import() dinámico compilado por un require() equivalente,
// envuelto en Promise.resolve() para conservar la firma `await`.
function fixDynamicJsonImports(fileContents) {
  return fileContents.replace(
    /await import\((["'])([^"']+\.json)\1\)/g,
    (match, quote, importPath) => `await Promise.resolve(require(${quote}${importPath}${quote}))`
  );
}

async function build() {
  for (const entry of ENTRY_POINTS) {
    const absoluteSrc = path.join(REPO_ROOT, entry.src);
    const absoluteOut = path.join(VENDOR_DIR, entry.out);
    fs.mkdirSync(path.dirname(absoluteOut), { recursive: true });
    await esbuild.build({
      entryPoints: [absoluteSrc],
      outfile: absoluteOut,
      bundle: !!entry.bundle,
      external: entry.external || [],
      treeShaking: true,
      format: 'cjs',
      platform: 'node',
      target: 'node18',
      loader: { '.ts': 'ts' },
      logLevel: 'warning',
    });
    const compiled = fs.readFileSync(absoluteOut, 'utf8');
    const fixed = fixDynamicJsonImports(compiled);
    if (fixed !== compiled) fs.writeFileSync(absoluteOut, fixed, 'utf8');
    console.log('compilado:', entry.src, '->', path.relative(VENDOR_DIR, absoluteOut));
  }

  for (const dataFile of DATA_FILES_TO_COPY) {
    const absoluteSrc = path.join(REPO_ROOT, dataFile);
    const absoluteOut = path.join(VENDOR_DIR, dataFile);
    fs.mkdirSync(path.dirname(absoluteOut), { recursive: true });
    fs.copyFileSync(absoluteSrc, absoluteOut);
    console.log('copiado:', dataFile);
  }

  console.log('\nVendor build completo en', VENDOR_DIR);
}

build().catch(err => {
  console.error('FALLO build-vendor:', err.message);
  process.exit(1);
});
