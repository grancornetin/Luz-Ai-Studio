// api/gemini/queue-dispatcher.ts
// Despacha el siguiente job de la cola de prioridad hacia ugc-worker.
// Es invocado por QStash inmediatamente después de encolar cada job,
// y también puede invocarse como scheduled job cada 30s como respaldo.
//
// Cola: sorted set Redis `queue:gemini`
//   score = (prioridad * 1e13) + timestamp_ms
//   prioridad: studio=1, pro=2, starter=3, weekly=4, free=5, default=5
//   Menor score = mayor prioridad (ZPOPMIN toma el primero).

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Receiver } from '@upstash/qstash';
import { Redis } from '@upstash/redis';
import { Client as QStashClient } from '@upstash/qstash';

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

const receiver = new Receiver({
  currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
  nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY!,
});

const QUEUE_KEY = 'queue:gemini';

// Cuántos jobs despachar por invocación (1 = secuencial estricto)
const DISPATCH_BATCH = 1;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verificar firma QStash
  const signature = req.headers['upstash-signature'] as string;
  if (!signature) {
    return res.status(401).json({ error: 'Missing signature' });
  }
  try {
    await receiver.verify({ signature, body: JSON.stringify(req.body) });
  } catch {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const dispatched: string[] = [];

  for (let i = 0; i < DISPATCH_BATCH; i++) {
    // ZPOPMIN atomicamente saca el job con menor score (mayor prioridad)
    const entries = await redis.zpopmin(QUEUE_KEY, 1);

    // entries puede ser [] o [jobId, score] o [{member, score}] según versión
    let jobId: string | null = null;
    if (Array.isArray(entries) && entries.length >= 1) {
      const first = entries[0];
      if (typeof first === 'string') {
        jobId = first;
      } else if (first && typeof (first as any).member === 'string') {
        jobId = (first as any).member;
      }
    }

    if (!jobId) break; // Cola vacía

    // Despachar al ugc-worker via QStash
    const qstash = new QStashClient({ token: process.env.QSTASH_TOKEN! });
    const workerUrl = `${process.env.WORKER_BASE_URL}/api/gemini/ugc-worker`;

    try {
      await qstash.publishJSON({ url: workerUrl, body: { jobId }, retries: 2 });
      dispatched.push(jobId);
      console.log(`[QueueDispatcher] Dispatched job ${jobId} to ugc-worker`);
    } catch (err: any) {
      // Si falla el dispatch, devolver el job a la cola con el score original
      // para que no se pierda. Leemos el score del job guardado en Redis.
      console.error(`[QueueDispatcher] Failed to dispatch ${jobId}:`, err.message);
      const jobData = await redis.get(`job:${jobId}`);
      if (jobData) {
        const job = typeof jobData === 'string' ? JSON.parse(jobData) : jobData as any;
        const score = job._queueScore ?? Date.now();
        await redis.zadd(QUEUE_KEY, { score, member: jobId });
      }
    }
  }

  return res.status(200).json({ ok: true, dispatched });
}
