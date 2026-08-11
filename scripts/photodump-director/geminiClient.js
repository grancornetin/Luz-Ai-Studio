/**
 * scripts/photodump-director/geminiClient.js
 *
 * Cliente de Gemini/Vertex AI standalone para correr el director fuera de la
 * app (desde un script de Node, no desde un endpoint de Vercel) — mismo
 * paquete (@google/genai) que ya usa en producción api/gemini/content.ts,
 * pero sin depender de un servidor corriendo.
 *
 * Credenciales: lee el archivo de service account JSON directo desde
 * credneciales/luz-ai-studio-bee627582953.json (cuenta luz-ai-vertex@...,
 * la que tiene permiso real de Vertex AI — la otra disponible,
 * gen-lang-client-...json, es de Firebase Admin y NO tiene permiso de
 * aiplatform.endpoints.predict, falla con 403 si se usa acá). Carpeta ya
 * cubierta por .gitignore, nunca se commitea. El valor equivalente en
 * .env.local (GOOGLE_SERVICE_ACCOUNT_KEY) además está corrupto — trae
 * caracteres de escaping sueltos antes del base64 real.
 *
 * Esto es solo para la Fase A (prueba standalone, leer el razonamiento como
 * texto). Cuando se conecte a producción (Fase C del plan), la llamada real
 * pasa a hacerse desde api/gemini/content.ts como cualquier otra acción, no
 * desde este cliente de script.
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const cwd       = resolve(__dirname, '../..');

const SERVICE_ACCOUNT_FILE = 'credneciales/luz-ai-studio-bee627582953.json';

function getCredentials() {
  const raw = readFileSync(resolve(cwd, SERVICE_ACCOUNT_FILE), 'utf-8');
  return JSON.parse(raw);
}

let client = null;

export function getClient() {
  if (client) return client;
  const credentials = getCredentials();
  client = new GoogleGenAI({
    vertexai: true,
    project: credentials.project_id,
    location: 'us-central1',
    googleAuthOptions: { credentials },
  });
  return client;
}

function extractText(response) {
  return response.candidates?.[0]?.content?.parts
    ?.map(p => p.text || '').filter(Boolean).join('') || '';
}

/**
 * Llama a Gemini pidiendo una respuesta JSON validada contra un schema —
 * mismo mecanismo que responseMimeType/responseSchema en api/gemini/content.ts.
 *
 * Reintenta con backoff exponencial ante 429 RESOURCE_EXHAUSTED — mismo
 * mecanismo ya agregado en producción (api/gemini/content.ts,
 * generateContentWithRetry) tras confirmar que es un rate-limit de cuota
 * transitorio, no un error de código. El harness corre varias pruebas
 * seguidas contra el mismo proyecto de Google Cloud, así que necesita el
 * mismo reintento para no fallar en medio de una sesión de investigación.
 */
export async function generateJson(prompt, schema, model = 'gemini-2.5-flash', maxRetries = 4) {
  const genAI = getClient();
  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await genAI.models.generateContent({
        model,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          responseMimeType: 'application/json',
          responseSchema: schema,
        },
      });
      const text = extractText(response);
      try {
        return JSON.parse(text);
      } catch (err) {
        console.error('No se pudo parsear la respuesta de Gemini como JSON. Texto crudo:');
        console.error(text);
        throw err;
      }
    } catch (error) {
      lastError = error;
      const status = error?.status ?? error?.error?.code;
      const message = String(error?.message ?? '');
      const is429 = status === 429 || message.includes('429') || message.includes('RESOURCE_EXHAUSTED') || message.includes('quota');
      if (!is429 || attempt === maxRetries) throw error;
      // Mismo backoff que generateContentWithRetry en api/gemini/content.ts
      // (5s/10s/20s/40s + jitter) — mantenido en sync para que el harness
      // refleje el comportamiento real de producción.
      const backoffMs = 5000 * Math.pow(2, attempt) + Math.floor(Math.random() * 1000);
      console.warn(`[geminiClient] 429 recibido, reintento ${attempt + 1}/${maxRetries} en ${backoffMs}ms...`);
      await new Promise(resolve => setTimeout(resolve, backoffMs));
    }
  }
  throw lastError;
}
