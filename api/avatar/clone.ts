// api/avatar/clone.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Redis } from '@upstash/redis';
import { Client as QStashClient } from '@upstash/qstash';

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

const qstash = new QStashClient({ token: process.env.QSTASH_TOKEN! });

type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';

interface CloneJob {
  id: string;
  mode: 'image' | 'manual';
  status: JobStatus;
  result?: string[];   // [bodyMaster, rear, side, faceMaster]
  error?: string;
  createdAt: number;
  updatedAt: number;
}

function generateJobId(): string {
  return `clone_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
}

function setCors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { action, payload } = req.body;
  if (!action) return res.status(400).json({ error: 'Missing action' });

  // ──────────────────────────────────────────────
  // Acción: startClone (modo imagen o manual)
  // ──────────────────────────────────────────────
  if (action === 'startClone') {
    const { mode, name, files, identityPrompt, negativePrompt, gender, personality, expression } = payload;
    if (!name || !mode) {
      return res.status(400).json({ error: 'Missing name or mode' });
    }
    if (mode === 'image' && (!files || files.length === 0)) {
      return res.status(400).json({ error: 'Missing files for image mode' });
    }
    if (mode === 'manual' && (!identityPrompt || !negativePrompt)) {
      return res.status(400).json({ error: 'Missing identityPrompt or negativePrompt for manual mode' });
    }

    const jobId = generateJobId();
    const job: CloneJob = {
      id: jobId,
      mode,
      status: 'pending',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await redis.set(`clone_job:${jobId}`, JSON.stringify(job), { ex: 3600 });

    const workerUrl = `${process.env.WORKER_BASE_URL}/api/avatar/clone-worker`;
    await qstash.publishJSON({
      url: workerUrl,
      body: { jobId, mode, name, files, identityPrompt, negativePrompt, gender, personality, expression },
      retries: 2,
    });

    return res.status(202).json({ success: true, jobId });
  }

  // ──────────────────────────────────────────────
  // Acción: getJobStatus
  // ──────────────────────────────────────────────
  if (action === 'getJobStatus') {
    const { jobId } = payload;
    if (!jobId) return res.status(400).json({ error: 'Missing jobId' });
    const raw = await redis.get(`clone_job:${jobId}`);
    if (!raw) return res.status(404).json({ error: 'Job not found' });
    const job = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return res.status(200).json({
      jobId: job.id,
      status: job.status,
      result: job.result,
      error: job.error,
      updatedAt: job.updatedAt,
    });
  }

  return res.status(400).json({ error: `Unknown action: ${action}` });
}