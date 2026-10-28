// @ts-nocheck
// QA1: servidor de vista previa SOLO para revisión visual de las pantallas de Mi negocio, con datos de ejemplo.
// No toca la app: monta las pantallas reales con servicios simulados (sin login, sin red, sin gasto).
// Uso (desde la raíz del repo):  npx vite --config scripts/piloto-spikes/qa1/vite.qa.config.ts --port 5199
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

const repo = path.resolve(__dirname, '../../..');
const fwd = (p: string) => p.split(path.sep).join('/');
const src = fwd(path.join(repo, 'src'));
const mocks = fwd(path.join(__dirname, 'mocks'));

// Módulos de la app que se reemplazan (se comparan por la ruta absoluta ya resuelta).
const REPLACE: Record<string, string> = {
  [`${src}/modules/auth/AuthContext`]: `${mocks}/AuthContext.tsx`,
  [`${src}/firebase`]: `${mocks}/firebase.ts`,
  [`${src}/services/brandProfileService`]: `${mocks}/brandProfileService.ts`,
  [`${src}/services/imageApiService`]: `${mocks}/imageApiService.ts`,
  [`${src}/modules/productGenerator/productDirectorService`]: `${mocks}/productDirectorService.ts`,
  [`${src}/modules/piloto/pilotData`]: `${mocks}/pilotData.ts`,
  [`${src}/modules/piloto/contentFactory`]: `${mocks}/contentFactory.ts`,
  [`${src}/modules/piloto/services/catalogService`]: `${mocks}/catalogService.ts`,
  [`${src}/modules/piloto/services/identityService`]: `${mocks}/identityService.ts`,
};

export default defineConfig({
  root: __dirname,
  plugins: [
    {
      name: 'qa1-replace',
      enforce: 'pre',
      resolveId(source, importer) {
        if (!importer || source.includes('?real')) return null;
        let abs: string;
        if (source.startsWith('.')) abs = fwd(path.resolve(path.dirname(importer.split('?')[0]), source));
        else if (source.startsWith('@repo/')) abs = `${src}/${source.slice(6)}`;
        else return null;
        abs = abs.replace(/\.(tsx?|jsx?)$/, '');
        return REPLACE[abs] ?? null;
      },
    },
    react(),
  ],
  resolve: {
    alias: [
      { find: /^firebase\/(auth|firestore|storage|app)$/, replacement: `${mocks}/firebaseSdk.ts` },
      { find: '@repo', replacement: src },
    ],
  },
  css: { postcss: repo },
  server: { fs: { allow: [repo] } },
  define: { 'import.meta.env.VITE_PILOT_UIDS': '""' },
});
