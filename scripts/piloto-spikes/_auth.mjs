// Helper: crea cliente Vertex igual que api/gemini/image-worker.ts. Lee .env.local sin imprimir secretos.
import fs from 'node:fs';
import path from 'node:path';
import { GoogleGenAI } from '@google/genai';

export function loadEnv(root) {
  const env = {};
  for (const f of ['.env.local', '.env.production']) {
    const p = path.join(root, f);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !(m[1] in env)) env[m[1]] = (m[2].startsWith('"') ? (()=>{try{return JSON.parse(m[2])}catch{return m[2].replace(/^"|"$/g,'')}})() : m[2].replace(/^'|'$/g, ''));
    }
  }
  return { ...env, ...Object.fromEntries(Object.entries(process.env).filter(([k]) => /^(GCP|GOOGLE|GEMINI)/.test(k))) };
}

// Credencial: por defecto la cuenta de servicio de credneciales/luz-ai-studio-*.json (proyecto con facturacion activa).
// El proyecto de .env.local (gen-lang-client-...) devuelve 403 "billing not enabled" al 22-oct-2026.
export function makeClient(root) {
  const credDir = path.join(root, 'credneciales');
  const credFile = fs.existsSync(credDir) ? fs.readdirSync(credDir).find(f => f.startsWith('luz-ai-studio') && f.endsWith('.json')) : null;
  if (credFile && !process.env.SPIKE_USE_ENV_CREDS) {
    const credentials = JSON.parse(fs.readFileSync(path.join(credDir, credFile), 'utf8'));
    return new GoogleGenAI({ vertexai: true, project: credentials.project_id, location: 'global', googleAuthOptions: { credentials } });
  }
  const env = loadEnv(root);
  const raw = env.GEMINI_SERVICE_ACCOUNT_KEY || env.GOOGLE_SERVICE_ACCOUNT_KEY || '';
  if (!raw) throw new Error('Falta GOOGLE_SERVICE_ACCOUNT_KEY en .env.local');
  const decoded = raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf-8');
  const credentials = JSON.parse(decoded);
  if (!env.GCP_PROJECT_ID) throw new Error('Falta GCP_PROJECT_ID');
  return new GoogleGenAI({ vertexai: true, project: env.GCP_PROJECT_ID, location: 'global', googleAuthOptions: { credentials } });
}
