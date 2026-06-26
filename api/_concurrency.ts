// api/_concurrency.ts
// Control de concurrencia por usuario — limita cuántos jobs Gemini puede tener
// activos simultáneamente una misma cuenta, sin importar cuántos módulos tenga abiertos.
//
// Flujo:
//   1. Al encolar un job: concurrencyAcquire(uid, plan) → true si hay cupo, false si no
//   2. Al terminar el job (éxito o fallo): concurrencyRelease(uid)
//
// Redis key: `concurrency:{uid}` — contador entero con TTL de seguridad (10 min)
// Si el worker muere sin liberar, el TTL evita que el usuario quede bloqueado para siempre.

import { Redis } from '@upstash/redis';

const redis = new Redis({
  url:   process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

// Límites por plan — cuántos jobs Gemini puede tener activos a la vez
const PLAN_CONCURRENCY: Record<string, number> = {
  admin:   8,
  studio:  6,
  pro:     3,
  starter: 2,
  weekly:  2,
  free:    1,
};

const KEY_TTL_SECONDS = 600; // 10 min — safety net si el worker muere sin liberar

function concurrencyKey(uid: string): string {
  return `concurrency:${uid}`;
}

/**
 * Intenta reservar un slot de concurrencia para el usuario.
 * Devuelve true si hay cupo y lo reserva, false si el usuario ya llegó al límite.
 */
export async function concurrencyAcquire(uid: string, plan: string): Promise<boolean> {
  const limit = PLAN_CONCURRENCY[plan] ?? PLAN_CONCURRENCY.free;
  const key   = concurrencyKey(uid);

  // INCR es atómico en Redis — incrementa y devuelve el nuevo valor
  const current = await redis.incr(key);

  // Refrescar TTL cada vez que se toca la key (el timer reinicia con cada job)
  await redis.expire(key, KEY_TTL_SECONDS);

  if (current > limit) {
    // Sin cupo — deshacer el incremento y rechazar
    await redis.decr(key);
    console.log(`[Concurrency] uid=${uid} plan=${plan} limit=${limit} — sin cupo (activos=${current - 1})`);
    return false;
  }

  console.log(`[Concurrency] uid=${uid} acquired slot ${current}/${limit}`);
  return true;
}

/**
 * Libera un slot de concurrencia al terminar un job (éxito o fallo).
 * Nunca baja de 0.
 */
export async function concurrencyRelease(uid: string): Promise<void> {
  const key = concurrencyKey(uid);
  try {
    const current = await redis.get<number>(key);
    if (current && current > 0) {
      await redis.decr(key);
      console.log(`[Concurrency] uid=${uid} released slot (activos ahora=${current - 1})`);
    }
  } catch (err: any) {
    console.error(`[Concurrency] Release failed for uid=${uid}:`, err.message);
  }
}

/**
 * Cuántos slots activos tiene el usuario ahora mismo.
 */
export async function concurrencyCount(uid: string): Promise<number> {
  const val = await redis.get<number>(concurrencyKey(uid));
  return val ?? 0;
}
