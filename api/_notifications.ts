// api/_notifications.ts
// Helpers compartidos para que los workers (image-worker, evolink-worker)
// escriban notificaciones a Firestore y reembolsen créditos cuando un shot falla.
//
// Diseño:
//   - Firebase Admin SDK se inicializa lazy + singleton (Vercel reusa la instancia
//     entre invocaciones del mismo container, así no pagamos init cada vez).
//   - Si GOOGLE_SERVICE_ACCOUNT_KEY no está en el entorno, los helpers no-opean
//     (loggean warning) en vez de crashear — permite mergear el código sin bloquear deploys.
//   - reportShotResult() es la única función que llaman los workers. Internamente
//     usa una transacción Firestore para que dos shots que terminan al mismo tiempo
//     no se pisen el documento de la notificación.

const PRICE_PER_SHOT = 1; // créditos por imagen — debe coincidir con el cliente

// ── Firebase Admin singleton ──────────────────────────────────────────────────
let _adminInitPromise: Promise<any> | null = null;
let _adminAvailable = true;

async function getAdmin(): Promise<{ db: any; FieldValue: any; Timestamp: any } | null> {
  if (!_adminAvailable) return null;

  if (!_adminInitPromise) {
    _adminInitPromise = (async () => {
      try {
        const { initializeApp, getApps, cert } = await import('firebase-admin/app' as any);
        const { getFirestore, FieldValue, Timestamp } = await import('firebase-admin/firestore' as any);

        if (getApps().length === 0) {
          const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY || '';
          if (!raw) {
            console.warn('[Notifications] GOOGLE_SERVICE_ACCOUNT_KEY not set — notifications disabled');
            _adminAvailable = false;
            return null;
          }
          const decoded = raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf-8');
          const credentials = JSON.parse(decoded);
          initializeApp({ credential: cert(credentials) });
        }

        return { db: getFirestore(), FieldValue, Timestamp };
      } catch (err: any) {
        console.error('[Notifications] Failed to init Firebase Admin:', err.message);
        _adminAvailable = false;
        return null;
      }
    })();
  }

  return _adminInitPromise;
}

// ── Tipos ─────────────────────────────────────────────────────────────────────
export type NotificationStatus = 'in_progress' | 'completed' | 'partial' | 'failed';
export type ShotStatus = 'completed' | 'failed';

export interface ShotRecord {
  index: number;
  status: ShotStatus;
  imageUrl?: string;       // data URL o https — depende del proveedor
  error?: string;
  completedAt: number;     // epoch ms
}

export interface ReportShotInput {
  uid: string;
  sessionId: string;
  module: string;          // 'product', 'clone', 'outfit', etc.
  moduleLabel?: string;    // legible: 'Foto de producto'
  totalShots: number;
  shotIndex: number;       // 0-based
  shotStatus: ShotStatus;
  imageUrl?: string;
  error?: string;
  metadata?: Record<string, any>;
  creditsPerShot?: number; // default PRICE_PER_SHOT
}

// ── Etiquetas legibles por módulo ────────────────────────────────────────────
const MODULE_LABELS: Record<string, string> = {
  product:            'Foto de producto',
  product_director:   'Foto de producto',
  clone:              'Clone de modelo',
  model_dna:          'Clone de modelo',
  model_dna_manual:   'Clone de modelo',
  outfit:             'Outfit',
  outfit_kit:         'Outfit',
  outfit_extractor:   'Outfit',
  scene:              'Escena',
  scene_clone:        'Escena',
  content_studio:     'Content Studio',
  content_studio_pro: 'Content Studio',
  prompt_studio:      'AI Generator',
  catalog:            'Catálogo',
  campaign:           'Campaign',
  photodump:          'Photodump',
};

function resolveLabel(module: string, override?: string): string {
  return override || MODULE_LABELS[module] || module;
}

// ── reportShotResult ─────────────────────────────────────────────────────────
// Llamado por el worker cuando termina UN shot (sea éxito o falla).
// - Si la notificación de la sesión no existe, la crea con status 'in_progress'.
// - Si existe, le agrega este shot al array `shots`.
// - Cuando todos los shots están reportados, calcula el status final y dispara
//   el reembolso de los fallidos en la misma transacción.
//
// La transacción evita que dos shots que terminan al mismo tiempo se pisen
// el documento (cada uno leería el estado y escribiría su propio array).
export async function reportShotResult(input: ReportShotInput): Promise<void> {
  const admin = await getAdmin();
  if (!admin) return; // no-op si Firebase Admin no está disponible

  const { db, FieldValue } = admin;
  const {
    uid, sessionId, module: moduleName, moduleLabel,
    totalShots, shotIndex, shotStatus, imageUrl, error, metadata = {},
    creditsPerShot = PRICE_PER_SHOT,
  } = input;

  if (!uid || !sessionId) {
    console.warn(`[Notifications] Skipping reportShotResult — missing uid or sessionId (uid=${uid}, sessionId=${sessionId})`);
    return;
  }

  const notifRef = db
    .collection('users').doc(uid)
    .collection('notifications').doc(sessionId);

  const userRef = db.collection('users').doc(uid);

  try {
    await db.runTransaction(async (tx: any) => {
      // Todas las lecturas primero — Firestore requiere que no haya
      // escrituras antes de lecturas dentro de la misma transacción.
      const [snap, userSnap] = await Promise.all([
        tx.get(notifRef),
        tx.get(userRef),
      ]);
      const now = Date.now();

      const newShot: ShotRecord = {
        index: shotIndex,
        status: shotStatus,
        completedAt: now,
        ...(imageUrl ? { imageUrl } : {}),
        ...(error ? { error } : {}),
      };

      // Helper: espejo exacto de la lógica de descuento en api/credits.ts.
      // El descuento usa primero suscripción (período) y luego topUp como respaldo,
      // así que el reembolso devuelve primero al período y el resto al topUp.
      const buildRefundUpdate = (amount: number): Record<string, any> => {
        if (!userSnap.exists) return {};
        const d    = userSnap.data();
        const used = Number(d.creditsUsedThisPeriod) || 0;
        const topUp = Number(d.topUpCredits) || 0;

        const periodRefund = Math.min(amount, used);
        const topUpRefund  = amount - periodRefund;

        const upd: Record<string, any> = {
          'credits.available': FieldValue.increment(amount),
        };
        if (periodRefund > 0) upd.creditsUsedThisPeriod = Math.max(0, used - periodRefund);
        if (topUpRefund  > 0) upd.topUpCredits          = topUp + topUpRefund;
        return upd;
      };

      if (!snap.exists) {
        // Primer (y único) shot que reporta — crear la notificación.
        const isSingleFailure = shotStatus === 'failed' && totalShots === 1;
        tx.set(notifRef, {
          id: sessionId,
          sessionId,
          module: moduleName,
          moduleLabel: resolveLabel(moduleName, moduleLabel),
          status: (isSingleFailure ? 'failed' : 'in_progress') as NotificationStatus,
          totalShots,
          completedShots: shotStatus === 'completed' ? 1 : 0,
          failedShots: shotStatus === 'failed' ? 1 : 0,
          shots: [newShot],
          creditsCharged: totalShots * creditsPerShot,
          creditsRefunded: isSingleFailure ? creditsPerShot : 0,
          metadata,
          read: false,
          createdAt: now,
          updatedAt: now,
        });

        if (isSingleFailure) {
          const refundUpd = buildRefundUpdate(creditsPerShot);
          if (Object.keys(refundUpd).length > 0) tx.update(userRef, refundUpd);
        }
        return;
      }

      // Notificación existente — appendear shot y recalcular status
      const data = snap.data() || {};
      const existingShots: ShotRecord[] = Array.isArray(data.shots) ? data.shots : [];

      // Idempotencia: no duplicar si este shot ya fue reportado
      if (existingShots.some(s => s.index === shotIndex)) {
        console.log(`[Notifications] Shot ${shotIndex} of session ${sessionId} already reported — skipping`);
        return;
      }

      const updatedShots = [...existingShots, newShot];
      const completedCount = updatedShots.filter(s => s.status === 'completed').length;
      const failedCount    = updatedShots.filter(s => s.status === 'failed').length;
      const allReported    = updatedShots.length >= totalShots;

      let newStatus: NotificationStatus = 'in_progress';
      let creditsToRefund = 0;

      if (allReported) {
        if (failedCount === 0)      newStatus = 'completed';
        else if (completedCount === 0) newStatus = 'failed';
        else                           newStatus = 'partial';
        creditsToRefund = failedCount * creditsPerShot;
      }

      const update: Record<string, any> = {
        shots: updatedShots,
        completedShots: completedCount,
        failedShots: failedCount,
        status: newStatus,
        updatedAt: now,
      };
      if (creditsToRefund > 0) update.creditsRefunded = creditsToRefund;

      tx.update(notifRef, update);

      if (creditsToRefund > 0) {
        const refundUpd = buildRefundUpdate(creditsToRefund);
        if (Object.keys(refundUpd).length > 0) tx.update(userRef, refundUpd);
      }
    });
  } catch (err: any) {
    console.error(`[Notifications] reportShotResult failed for session ${sessionId}:`, err.message);
  }
}

// ── appendToHistory ──────────────────────────────────────────────────────────
// Mantenemos el historial actual (Redis) como malla de seguridad.
// Cuando un shot termina con éxito, también lo escribimos al historial
// directamente desde el worker — así sobrevive al cierre del navegador.
export async function appendToHistory(input: {
  uid: string;
  imageUrl: string;
  module: string;
  moduleLabel?: string;
  promptText?: string;
  creditsUsed: number;
  metadata?: Record<string, any>;
  config?: Record<string, any>;
}): Promise<void> {
  const { Redis } = await import('@upstash/redis');
  const redis = new Redis({
    url:   process.env.KV_REST_API_URL!,
    token: process.env.KV_REST_API_TOKEN!,
  });

  const MAX_ENTRIES = 100;
  const TTL_SECONDS = 90 * 24 * 60 * 60;
  const key = `history:${input.uid.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 128)}`;
  const imageKey = input.imageUrl.startsWith('data:')
    ? `data:${input.imageUrl.length}:${input.imageUrl.slice(0, 96)}:${input.imageUrl.slice(-96)}`
    : input.imageUrl;

  try {
    const existing = await redis.get<any[]>(key) || [];
    const duplicate = existing.find((r: any) => r.imageKey === imageKey || r.imageUrl === input.imageUrl);
    const record = {
      ...(duplicate || {}),
      id: duplicate?.id || `gen_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      imageUrl: input.imageUrl,
      imageKey,
      module: input.module,
      moduleLabel: resolveLabel(input.module, input.moduleLabel),
      promptText: input.promptText || duplicate?.promptText,
      creditsUsed: Math.max(input.creditsUsed || 0, duplicate?.creditsUsed || 0),
      createdAt: duplicate?.createdAt || new Date().toISOString(),
      metadata: { ...(duplicate?.metadata || {}), ...(input.metadata || {}) },
      config: { ...(duplicate?.config || {}), ...(input.config || {}) },
      source: duplicate?.source || 'worker',
      syncedAt: new Date().toISOString(),
    };
    const updated = [
      record,
      ...existing.filter((r: any) => r.id !== duplicate?.id && r.imageKey !== imageKey && r.imageUrl !== input.imageUrl),
    ].slice(0, MAX_ENTRIES);
    await redis.set(key, updated, { ex: TTL_SECONDS });
  } catch (err: any) {
    console.error(`[Notifications] appendToHistory failed for ${input.uid}:`, err.message);
  }
}
