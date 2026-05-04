// src/components/NotificationsHUD.tsx
// Heads-Up Display global para notificaciones:
//   1. Burbuja flotante (persistente) — visible cuando hay sets en progreso.
//   2. Toasts (transitorios) — aparecen cuando un set pasa de in_progress a un estado final.
//
// Se monta una sola vez en App.tsx, leyendo el mismo hook useNotifications que el panel.

import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle2, AlertTriangle, XCircle, Loader2, X, ImageIcon, ArrowRight,
} from 'lucide-react';
import { useNotifications } from '../hooks/useNotifications';
import {
  AppNotification, NotificationStatus,
} from '../services/notificationsService';

const TOAST_DURATION_MS = 5000;
const MAX_VISIBLE_TOASTS = 3;

// ── Tipos ─────────────────────────────────────────────────────────────────────
interface ToastItem {
  id:      string;            // sessionId (estable por notificación)
  status:  NotificationStatus;
  module:  string;
  label:   string;
  message: string;
  thumb?:  string;
}

// ── Helpers de presentación ───────────────────────────────────────────────────
function buildToastForFinalStatus(n: AppNotification): ToastItem {
  const thumb = n.shots.find(s => s.status === 'completed' && s.imageUrl)?.imageUrl;
  let message = '';
  if (n.status === 'completed') {
    message = n.totalShots === 1 ? 'Imagen lista' : `${n.totalShots} imágenes listas`;
  } else if (n.status === 'partial') {
    message = `${n.completedShots} de ${n.totalShots} listas — ${n.failedShots} fallaron`;
  } else if (n.status === 'failed') {
    message = 'No se pudo generar';
  } else {
    message = `${n.completedShots} de ${n.totalShots} listas`;
  }
  return {
    id:      n.sessionId,
    status:  n.status,
    module:  n.module,
    label:   n.moduleLabel,
    message,
    thumb,
  };
}

function statusColors(status: NotificationStatus) {
  switch (status) {
    case 'completed': return { bg: 'bg-emerald-500',  ring: 'ring-emerald-200', icon: CheckCircle2 };
    case 'partial':   return { bg: 'bg-amber-500',    ring: 'ring-amber-200',   icon: AlertTriangle };
    case 'failed':    return { bg: 'bg-rose-500',     ring: 'ring-rose-200',    icon: XCircle };
    default:          return { bg: 'bg-indigo-500',   ring: 'ring-indigo-200',  icon: Loader2 };
  }
}

// ── HUD principal ─────────────────────────────────────────────────────────────
const NotificationsHUD: React.FC = () => {
  const navigate = useNavigate();
  const { notifications, loaded } = useNotifications();
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  // Snapshot anterior por sessionId para detectar transiciones in_progress → final.
  // Se inicializa con el primer snapshot recibido para no disparar toasts de
  // notificaciones que ya estaban en estado final cuando el usuario abrió la app.
  const prevStatusRef = useRef<Map<string, NotificationStatus> | null>(null);
  // Set de toasts ya disparados (evita re-disparar cuando un mismo toast se cierra).
  const firedToastsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!loaded) return;

    // Primera vez: solo grabamos el snapshot, no disparamos nada.
    if (prevStatusRef.current === null) {
      const initial = new Map<string, NotificationStatus>();
      notifications.forEach(n => initial.set(n.sessionId, n.status));
      prevStatusRef.current = initial;
      // Todas las notificaciones ya vistas se marcan como "ya disparadas"
      // para que un cambio de pestaña no re-dispare toasts de cosas viejas.
      notifications.forEach(n => firedToastsRef.current.add(n.sessionId));
      return;
    }

    const prev = prevStatusRef.current;
    const newToasts: ToastItem[] = [];

    notifications.forEach(n => {
      const before = prev.get(n.sessionId);
      const isFinal = n.status === 'completed' || n.status === 'partial' || n.status === 'failed';

      if (isFinal && before !== n.status && !firedToastsRef.current.has(n.sessionId)) {
        firedToastsRef.current.add(n.sessionId);
        newToasts.push(buildToastForFinalStatus(n));
      }
    });

    // Actualizar snapshot
    const next = new Map<string, NotificationStatus>();
    notifications.forEach(n => next.set(n.sessionId, n.status));
    prevStatusRef.current = next;

    if (newToasts.length > 0) {
      setToasts(prev => [...newToasts, ...prev].slice(0, MAX_VISIBLE_TOASTS * 2));
    }
  }, [notifications, loaded]);

  // Auto-dismiss de toasts después de TOAST_DURATION_MS
  useEffect(() => {
    if (toasts.length === 0) return;
    const timer = setTimeout(() => {
      setToasts(prev => prev.slice(0, -1));
    }, TOAST_DURATION_MS);
    return () => clearTimeout(timer);
  }, [toasts]);

  const inProgress = notifications.filter(n => n.status === 'in_progress');
  const showBubble = inProgress.length > 0;

  const dismissToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const goToPanel = () => navigate('/notifications');

  const goToSession = (module: string, sessionId: string) => {
    const route = MODULE_ROUTE[module] || '/notifications';
    const sep = route.includes('?') ? '&' : '?';
    navigate(`${route}${sep}session=${encodeURIComponent(sessionId)}`);
  };

  return (
    <>
      {/* Toasts apilados arriba (debajo del header) */}
      {toasts.length > 0 && (
        <div
          className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 max-w-sm w-[calc(100%-2rem)]"
          aria-live="polite"
          aria-atomic="true"
        >
          {toasts.slice(0, MAX_VISIBLE_TOASTS).map(t => (
            <ToastCard
              key={t.id}
              toast={t}
              onClick={() => { dismissToast(t.id); goToSession(t.module, t.id); }}
              onClose={() => dismissToast(t.id)}
            />
          ))}
        </div>
      )}

      {/* Burbuja flotante (in_progress) */}
      {showBubble && (
        <button
          onClick={goToPanel}
          aria-label={`${inProgress.length} ${inProgress.length === 1 ? 'generación' : 'generaciones'} en curso`}
          className="fixed right-4 md:right-6 bottom-24 md:bottom-24 z-[90] bg-white rounded-2xl shadow-2xl border border-slate-100 px-4 py-3 flex items-center gap-3 hover:shadow-indigo-200 hover:border-indigo-200 transition-all max-w-[280px] group"
        >
          <div className="relative w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
            <Loader2 size={18} className="text-indigo-600 animate-spin" />
            {inProgress.length > 1 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 bg-indigo-600 text-white text-[10px] font-black rounded-full flex items-center justify-center shadow-md">
                {inProgress.length}
              </span>
            )}
          </div>
          <div className="flex-1 min-w-0 text-left">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-tight">
              {inProgress.length === 1 ? 'Generando' : `${inProgress.length} en curso`}
            </p>
            <p className="text-xs font-black text-slate-700 truncate">
              {inProgress.length === 1
                ? `${inProgress[0].moduleLabel} · ${inProgress[0].completedShots}/${inProgress[0].totalShots}`
                : 'Toca para ver el progreso'}
            </p>
          </div>
          <ArrowRight size={14} className="text-slate-300 group-hover:text-indigo-600 flex-shrink-0 transition-colors" />
        </button>
      )}
    </>
  );
};

// ── Subcomponente: ToastCard ──────────────────────────────────────────────────
const ToastCard: React.FC<{
  toast: ToastItem;
  onClick: () => void;
  onClose: () => void;
}> = ({ toast, onClick, onClose }) => {
  const colors = statusColors(toast.status);
  const Icon = colors.icon;

  return (
    <div
      role="status"
      className={`bg-white rounded-2xl shadow-2xl border border-slate-100 ring-2 ${colors.ring} p-3 flex items-center gap-3 animate-in fade-in`}
    >
      {/* Thumb o icono */}
      <div className="flex-shrink-0 w-12 h-12 rounded-xl overflow-hidden bg-slate-50 border border-slate-100 flex items-center justify-center">
        {toast.thumb ? (
          <img src={toast.thumb} alt="" className="w-full h-full object-cover" />
        ) : (
          <ImageIcon size={20} className="text-slate-300" />
        )}
      </div>

      {/* Cuerpo clickeable */}
      <button
        onClick={onClick}
        className="flex-1 min-w-0 text-left"
      >
        <div className="flex items-center gap-1.5 mb-0.5">
          <Icon size={12} className={`text-white rounded-full ${colors.bg} p-[2px]`} />
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest truncate">
            {toast.label}
          </p>
        </div>
        <p className="text-xs font-black text-slate-700 truncate">{toast.message}</p>
      </button>

      <button
        onClick={onClose}
        aria-label="Cerrar"
        className="flex-shrink-0 p-1.5 text-slate-300 hover:text-slate-500 hover:bg-slate-50 rounded-lg transition-colors"
      >
        <X size={14} />
      </button>
    </div>
  );
};

// ── Mapa módulo → ruta (espejo del panel) ─────────────────────────────────────
const MODULE_ROUTE: Record<string, string> = {
  product:            '/productos',
  product_director:   '/productos',
  clone:              '/crear/clonar',
  model_dna:          '/crear/clonar',
  model_dna_manual:   '/crear/manual',
  outfit:             '/outfit-extractor',
  outfit_kit:         '/outfit-extractor',
  outfit_extractor:   '/outfit-extractor',
  scene:              '/clonar',
  scene_clone:        '/clonar',
  content_studio:     '/studio-pro',
  content_studio_pro: '/studio-pro',
  prompt_studio:      '/prompt-studio',
};

export default NotificationsHUD;
