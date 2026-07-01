// api/admin/circuit-reset.ts
// Endpoint exclusivo para admins — resetea los circuit breakers de proveedores de IA
// y el contador de concurrencia de un usuario específico.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Redis } from '@upstash/redis';
import { verifyAuth } from './middleware.js';

const redis = new Redis({
  url:   process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

const ADMIN_UIDS = (process.env.ADMIN_UIDS || '').split(',').map(s => s.trim()).filter(Boolean);

const CIRCUIT_KEYS = ['circuit:gemini', 'circuit:gptimage', 'circuit:seedream'];

export async function handleAdminCircuitResetRequest(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Solo admins autenticados
  let uid: string;
  try {
    uid = await verifyAuth(req);
  } catch {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const isAdmin = ADMIN_UIDS.includes(uid) || uid === process.env.ADMIN_UID;
  if (!isAdmin) {
    return res.status(403).json({ error: 'Forbidden — admin only' });
  }

  const { action, targetUid } = req.body || {};

  // Resetear todos los circuit breakers
  if (action === 'reset_circuits' || !action) {
    await Promise.all(CIRCUIT_KEYS.map(k => redis.del(k).catch(() => {})));
    console.log(`[AdminCircuit] Reset por uid=${uid}: ${CIRCUIT_KEYS.join(', ')}`);
    return res.status(200).json({ ok: true, reset: CIRCUIT_KEYS });
  }

  // Resetear concurrencia de un usuario específico (o del propio admin)
  if (action === 'reset_concurrency') {
    const target = targetUid || uid;
    await redis.del(`concurrency:${target}`).catch(() => {});
    console.log(`[AdminCircuit] Concurrencia reseteada para uid=${target} por admin=${uid}`);
    return res.status(200).json({ ok: true, reset: `concurrency:${target}` });
  }

  return res.status(400).json({ error: 'Unknown action' });
}
