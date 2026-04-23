// api/_middleware.ts
// Middleware de seguridad centralizado para todos los endpoints.
// Aplica: CORS restringido, security headers, verificación de Firebase Auth, rate limiting.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// ── Rate limiters por tipo de operación ───────────────────────────────────────
// Se crean lazy para no fallar si Redis no está disponible en build time
let _redisClient: Redis | null = null;
function getRedis(): Redis {
  if (!_redisClient) {
    _redisClient = new Redis({
      url:   process.env.KV_REST_API_URL!,
      token: process.env.KV_REST_API_TOKEN!,
    });
  }
  return _redisClient;
}

// Generación de imágenes: máx 30 por hora por usuario
let _imageRatelimit: Ratelimit | null = null;
export function getImageRatelimit(): Ratelimit {
  if (!_imageRatelimit) {
    _imageRatelimit = new Ratelimit({
      redis:   getRedis(),
      limiter: Ratelimit.slidingWindow(30, '1 h'),
      prefix:  'rl:image',
    });
  }
  return _imageRatelimit;
}

// Historia / datos: máx 120 por hora por usuario
let _dataRatelimit: Ratelimit | null = null;
export function getDataRatelimit(): Ratelimit {
  if (!_dataRatelimit) {
    _dataRatelimit = new Ratelimit({
      redis:   getRedis(),
      limiter: Ratelimit.slidingWindow(120, '1 h'),
      prefix:  'rl:data',
    });
  }
  return _dataRatelimit;
}

export async function checkRateLimit(
  limiter: Ratelimit,
  uid: string,
  res: VercelResponse,
): Promise<boolean> {
  try {
    const { success, limit, remaining, reset } = await limiter.limit(uid);
    res.setHeader('X-RateLimit-Limit',     String(limit));
    res.setHeader('X-RateLimit-Remaining', String(remaining));
    res.setHeader('X-RateLimit-Reset',     String(reset));
    if (!success) {
      res.status(429).json({ error: 'Rate limit exceeded. Try again later.' });
      return false;
    }
    return true;
  } catch {
    // Si Redis falla no bloqueamos — fail open para no interrumpir el servicio
    return true;
  }
}

// ── Firebase Admin Init ────────────────────────────────────────────────────────
function initFirebaseAdmin() {
  if (getApps().length > 0) return;
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY || '';
  const decoded = raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf-8');
  const credentials = JSON.parse(decoded);
  initializeApp({ credential: cert(credentials) });
}

// ── CORS ───────────────────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = [
  'https://luz-ia-studio.vercel.app',
  'https://www.luz-ia-studio.vercel.app',
  // Agrega tu dominio personalizado aquí cuando lo tengas
];

// En desarrollo local también permitir localhost
if (process.env.NODE_ENV !== 'production') {
  ALLOWED_ORIGINS.push('http://localhost:5173', 'http://localhost:3000');
}

export function setCorsHeaders(req: VercelRequest, res: VercelResponse): boolean {
  const origin = req.headers.origin || '';
  // En Vercel preview deployments el origin termina en .vercel.app
  const isVercelPreview = origin.endsWith('.vercel.app');
  const isAllowed = ALLOWED_ORIGINS.includes(origin) || isVercelPreview;

  if (isAllowed) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return true; // handled
  }
  return false;
}

// ── Security Headers ───────────────────────────────────────────────────────────
export function setSecurityHeaders(res: VercelResponse): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
}

// ── Firebase Auth Verification ─────────────────────────────────────────────────
// Verifica el token de Firebase en el header Authorization.
// Retorna el uid verificado o lanza un error.
export async function verifyAuth(req: VercelRequest): Promise<string> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('UNAUTHORIZED: Missing or invalid Authorization header');
  }
  const token = authHeader.slice(7);
  try {
    initFirebaseAdmin();
    const decoded = await getAuth().verifyIdToken(token);
    return decoded.uid;
  } catch {
    throw new Error('UNAUTHORIZED: Invalid or expired token');
  }
}

// ── Input Validators ───────────────────────────────────────────────────────────
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB decoded
const ALLOWED_MIMES   = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const MAX_PROMPT_LEN  = 8000;

export function validateBase64Image(data: string, mimeType: string): string | null {
  if (!data || data.length < 64) return 'Image data too short';
  try {
    const decoded = Buffer.from(data, 'base64');
    if (decoded.length > MAX_IMAGE_BYTES) return `Image exceeds 5MB limit (${(decoded.length / 1024 / 1024).toFixed(1)}MB)`;
  } catch {
    return 'Invalid base64 data';
  }
  if (!ALLOWED_MIMES.has(mimeType)) return `Invalid MIME type: ${mimeType}`;
  return null; // ok
}

export function validatePrompt(prompt: string): string | null {
  if (!prompt || typeof prompt !== 'string') return 'Prompt is required';
  if (prompt.length > MAX_PROMPT_LEN) return `Prompt too long (max ${MAX_PROMPT_LEN} chars)`;
  return null;
}

// ── Redis Key Sanitizer ────────────────────────────────────────────────────────
export function sanitizeUid(uid: string): string {
  return uid.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 128);
}

// ── Wrapper helper ─────────────────────────────────────────────────────────────
// Envuelve un handler aplicando CORS + security headers automáticamente.
// Si requireAuth=true, también verifica el token y pasa el uid verificado.
type Handler = (req: VercelRequest, res: VercelResponse, uid?: string) => Promise<void>;

export function withSecurity(handler: Handler, requireAuth = true) {
  return async (req: VercelRequest, res: VercelResponse) => {
    setSecurityHeaders(res);
    if (setCorsHeaders(req, res)) return; // OPTIONS handled

    let uid: string | undefined;
    if (requireAuth) {
      try {
        uid = await verifyAuth(req);
      } catch (err: any) {
        return res.status(401).json({ error: err.message });
      }
    }

    try {
      await handler(req, res, uid);
    } catch (err: any) {
      console.error('[API Error]', err.message);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
}
