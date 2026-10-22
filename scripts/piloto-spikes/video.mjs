// SPIKE VIDEO: 1 clip Veo (Vertex) imagen->video. Uso: node scripts/piloto-spikes/video.mjs [modelo] [segundos] [foto] [etiqueta] [prompt]
// Tope duro: 3 clips y USD 8 (registro en CIERRE_MVP/spikes/video-gasto.csv). No imprime secretos.
import fs from 'node:fs';
import path from 'node:path';
import { GoogleGenAI } from '@google/genai';
import { loadEnv } from './_auth.mjs';

const root = process.cwd();
const csv = path.join(root, 'CIERRE_MVP/spikes/video-gasto.csv');
const outDir = path.join(root, 'CIERRE_MVP/spikes/video-salidas');
const [model = 'veo-3.1-fast-generate-001', secs = '6', foto = 'scripts/piloto-spikes/fotos-prueba/anillo-unsplash.jpg', tag = 'clip', ...p] = process.argv.slice(2);
const prompt = p.join(' ') || 'Slow elegant 360-degree rotation of the ring on its black base with soft sparkling highlights on the diamonds. Keep the ring exactly identical: same shape, same stones, no extra stones. Macro jewelry commercial, static camera.';
const PRICE_MAX = { 'veo-3.1-generate-001': 0.40, 'veo-3.1-fast-generate-001': 0.15, 'veo-3.1-lite-generate-001': 0.08 }; // USD/s con audio, techo supuesto
const CAP_CLIPS = 3, CAP_USD = 8;

if (!fs.existsSync(csv)) fs.writeFileSync(csv, 'fecha_hora,etiqueta,modelo,region,segundos,audio,resolucion,costo_estimado_usd,costo_real_usd,tiempo_gen_s,estado,notas\n');
const rows = fs.readFileSync(csv, 'utf8').trim().split('\n').slice(1).filter(Boolean);
const gastado = rows.reduce((a, r) => a + (parseFloat(r.split(',')[7]) || 0), 0);
const est = (PRICE_MAX[model] ?? 0.40) * Number(secs);
if (rows.length >= CAP_CLIPS || gastado + est > CAP_USD) { console.error(`TOPE: clips=${rows.length}, gastado~${gastado}, esta=${est}. Detenido.`); process.exit(2); }

const env = loadEnv(root);
let credentials; const raw = env.GEMINI_SERVICE_ACCOUNT_KEY || '';
if (raw) credentials = JSON.parse(raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf-8'));
else { // respaldo: credneciales/ cuyo project_id coincida con GCP_PROJECT_ID
  for (const f of fs.readdirSync(path.join(root, 'credneciales'))) {
    const j = JSON.parse(fs.readFileSync(path.join(root, 'credneciales', f), 'utf8'));
    if (j.project_id === (env.VIDEO_PROJECT || env.GCP_PROJECT_ID)) { credentials = j; break; }
  }
}
const project = env.VIDEO_PROJECT || env.GCP_PROJECT_ID;
if (!credentials || !project) { console.error('BLOQUEO: sin credenciales/proyecto'); process.exit(3); }
const location = env.VIDEO_LOCATION || 'us-central1';
const ai = new GoogleGenAI({ vertexai: true, project, location, googleAuthOptions: { credentials } });

const t0 = Date.now(); let estado = 'ok', notas = '', op;
const log = (e) => fs.appendFileSync(csv, [new Date().toISOString(), tag, model, location, secs, 'no', '720p', e.est, e.real, e.t, e.estado, e.notas.replace(/[,\n]/g, ';')].join(',') + '\n');
try {
  const img = fs.readFileSync(path.join(root, foto));
  op = await ai.models.generateVideos({
    model, prompt,
    image: { imageBytes: img.toString('base64'), mimeType: 'image/jpeg' },
    config: { numberOfVideos: 1, durationSeconds: Number(secs), aspectRatio: '16:9', resolution: '720p', generateAudio: false },
  });
  console.log('operacion:', op.name);
  while (!op.done) { await new Promise(r => setTimeout(r, 10000)); op = await ai.operations.getVideosOperation({ operation: op }); process.stdout.write('.'); }
  const t = ((Date.now() - t0) / 1000).toFixed(0);
  if (op.error) throw new Error(JSON.stringify(op.error).slice(0, 300));
  const v = op.response?.generatedVideos?.[0]?.video;
  if (!v) throw new Error('sin video: ' + JSON.stringify(op.response || {}).slice(0, 300));
  const file = path.join(outDir, `${tag}.mp4`);
  if (v.videoBytes) fs.writeFileSync(file, Buffer.from(v.videoBytes, 'base64')); else notas = 'uri=' + v.uri;
  console.log('\nlisto en', t, 's;', v.videoBytes ? 'bytes' : 'uri', fs.existsSync(file) ? fs.statSync(file).size + ' B' : '');
  log({ est: est.toFixed(2), real: '', t, estado, notas: notas + ' respuesta=' + (v.videoBytes ? 'bytes' : 'uri') });
} catch (e) {
  const msg = String(e.message || e).replace(/ya29\.[\w.-]+/g, '<r>').slice(0, 400);
  console.error('\nFALLO:', msg);
  log({ est: '0', real: '0', t: ((Date.now() - t0) / 1000).toFixed(0), estado: 'error', notas: msg });
  process.exit(1);
}
