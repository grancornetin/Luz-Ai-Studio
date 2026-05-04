// src/views/NotificationsPanel.tsx
// Panel principal de notificaciones (Nivel 3).
// Muestra sets agrupados por sesión: en progreso, completados, parciales, fallidos.
// Click → módulo original con ?session=xxx para retomar la sesión.

import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell, BellOff, CheckCheck, Trash2, ImageIcon,
  Clock, CheckCircle2, AlertTriangle, XCircle, Loader2,
  Filter, ArrowRight,
} from 'lucide-react';
import { useNotifications } from '../hooks/useNotifications';
import { AppNotification, NotificationStatus } from '../services/notificationsService';

// ── Mapa de módulo → ruta para "retomar sesión" ──────────────────────────────
const MODULE_ROUTES: Record<string, string> = {
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

function moduleRoute(module: string, sessionId: string): string {
  const base = MODULE_ROUTES[module] || '/historial';
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}session=${encodeURIComponent(sessionId)}`;
}

// ── Helpers de presentación ──────────────────────────────────────────────────
function timeAgo(ms: number): string {
  const diff = Date.now() - ms;
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return 'ahora';
  if (mins < 60) return `hace ${mins}m`;
  if (hours < 24) return `hace ${hours}h`;
  return `hace ${days}d`;
}

function statusMeta(n: AppNotification) {
  switch (n.status) {
    case 'completed':
      return {
        icon: CheckCircle2,
        text: `${n.totalShots} ${n.totalShots === 1 ? 'imagen lista' : 'imágenes listas'}`,
        chip: 'bg-emerald-50 text-emerald-700',
        ring: 'ring-emerald-100',
      };
    case 'partial':
      return {
        icon: AlertTriangle,
        text: `${n.completedShots} de ${n.totalShots} listas — ${n.failedShots} fallaron`,
        chip: 'bg-amber-50 text-amber-700',
        ring: 'ring-amber-100',
      };
    case 'failed':
      return {
        icon: XCircle,
        text: 'No se pudo generar',
        chip: 'bg-rose-50 text-rose-700',
        ring: 'ring-rose-100',
      };
    case 'in_progress':
    default:
      return {
        icon: Loader2,
        text: `${n.completedShots} de ${n.totalShots} en progreso…`,
        chip: 'bg-indigo-50 text-indigo-700',
        ring: 'ring-indigo-100',
        spin: true,
      };
  }
}

// ── Filtros ───────────────────────────────────────────────────────────────────
type FilterId = 'all' | 'unread' | NotificationStatus;

const FILTERS: { id: FilterId; label: string }[] = [
  { id: 'all',         label: 'Todas' },
  { id: 'unread',      label: 'Sin leer' },
  { id: 'in_progress', label: 'En progreso' },
  { id: 'completed',   label: 'Completas' },
  { id: 'partial',     label: 'Parciales' },
  { id: 'failed',      label: 'Fallidas' },
];

// ── Componente ────────────────────────────────────────────────────────────────
const NotificationsPanel: React.FC = () => {
  const navigate = useNavigate();
  const { notifications, unreadCount, loaded, markAsRead, markAllAsRead, deleteOne } = useNotifications();
  const [filter, setFilter] = useState<FilterId>('all');

  const filtered = useMemo(() => {
    if (filter === 'all') return notifications;
    if (filter === 'unread') return notifications.filter(n => !n.read);
    return notifications.filter(n => n.status === filter);
  }, [notifications, filter]);

  const handleOpen = async (n: AppNotification) => {
    if (!n.read) {
      markAsRead(n.id).catch(() => {});
    }
    navigate(moduleRoute(n.module, n.sessionId));
  };

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-3xl font-black text-slate-800 uppercase italic tracking-tighter">
            Notificaciones
          </h1>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">
            {unreadCount > 0
              ? `${unreadCount} sin leer`
              : loaded ? 'Todo al día' : 'Cargando…'}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={() => markAllAsRead().catch(() => {})}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl text-xs font-black uppercase tracking-widest transition-colors"
          >
            <CheckCheck size={14} />
            <span className="hidden sm:inline">Marcar todas leídas</span>
            <span className="sm:hidden">Leídas</span>
          </button>
        )}
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2 -mx-1 px-1">
        <Filter size={14} className="text-slate-400 flex-shrink-0" />
        {FILTERS.map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-colors ${
              filter === f.id
                ? 'bg-indigo-600 text-white'
                : 'bg-white border border-slate-200 text-slate-500 hover:border-indigo-300'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Lista */}
      {!loaded ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 size={28} className="text-slate-300 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState filter={filter} />
      ) : (
        <ul className="space-y-3">
          {filtered.map(n => (
            <NotificationCard
              key={n.id}
              notification={n}
              onOpen={() => handleOpen(n)}
              onDelete={() => deleteOne(n.id).catch(() => {})}
            />
          ))}
        </ul>
      )}
    </div>
  );
};

// ── Subcomponente: tarjeta ────────────────────────────────────────────────────
interface CardProps {
  notification: AppNotification;
  onOpen: () => void;
  onDelete: () => void;
}

const NotificationCard: React.FC<CardProps> = ({ notification: n, onOpen, onDelete }) => {
  const meta = statusMeta(n);
  const Icon = meta.icon;
  const thumb = n.shots.find(s => s.status === 'completed' && s.imageUrl)?.imageUrl;

  return (
    <li
      className={`group relative bg-white rounded-3xl border border-slate-100 p-4 transition-all hover:shadow-lg hover:border-indigo-200 cursor-pointer ${
        !n.read ? `ring-2 ${meta.ring}` : ''
      }`}
      onClick={onOpen}
    >
      <div className="flex items-stretch gap-4">
        {/* Thumbnail */}
        <div className="flex-shrink-0 w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden bg-slate-50 border border-slate-100 flex items-center justify-center">
          {thumb ? (
            <img src={thumb} alt="" className="w-full h-full object-cover" />
          ) : (
            <ImageIcon size={28} className="text-slate-300" />
          )}
        </div>

        {/* Cuerpo */}
        <div className="flex-1 min-w-0 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              {!n.read && <span className="w-2 h-2 bg-indigo-600 rounded-full flex-shrink-0" aria-label="Sin leer" />}
              <h3 className="text-sm font-black text-slate-800 truncate">{n.moduleLabel}</h3>
            </div>
            <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${meta.chip}`}>
              <Icon size={11} className={meta.spin ? 'animate-spin' : ''} />
              {meta.text}
            </div>
            {n.creditsRefunded > 0 && (
              <p className="text-[10px] font-bold text-emerald-600 mt-1.5 uppercase tracking-widest">
                {n.creditsRefunded} {n.creditsRefunded === 1 ? 'crédito reembolsado' : 'créditos reembolsados'}
              </p>
            )}
          </div>

          <div className="flex items-center justify-between mt-2">
            <span className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              <Clock size={11} />
              {timeAgo(n.createdAt)}
            </span>
            <span className="flex items-center gap-1 text-[10px] font-black text-indigo-600 uppercase tracking-widest">
              Abrir <ArrowRight size={11} />
            </span>
          </div>
        </div>
      </div>

      {/* Botón borrar (aparece en hover/touch) */}
      <button
        aria-label="Borrar notificación"
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        className="absolute top-3 right-3 p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl opacity-0 group-hover:opacity-100 sm:focus:opacity-100 transition-opacity"
      >
        <Trash2 size={14} />
      </button>
    </li>
  );
};

// ── Subcomponente: estado vacío ───────────────────────────────────────────────
const EmptyState: React.FC<{ filter: FilterId }> = ({ filter }) => (
  <div className="bg-white rounded-3xl border border-slate-100 p-12 text-center">
    <div className="w-16 h-16 bg-slate-50 rounded-3xl flex items-center justify-center mx-auto mb-4">
      {filter === 'unread' ? (
        <CheckCheck size={28} className="text-slate-300" />
      ) : (
        <BellOff size={28} className="text-slate-300" />
      )}
    </div>
    <h3 className="text-sm font-black text-slate-700 uppercase tracking-widest mb-2">
      {filter === 'unread' ? 'Todo leído' : 'Sin avisos'}
    </h3>
    <p className="text-xs font-bold text-slate-400 max-w-xs mx-auto">
      {filter === 'unread'
        ? 'Cuando llegue una notificación nueva la verás acá.'
        : 'Cada vez que generes contenido vas a ver acá su progreso, aunque cierres la app.'}
    </p>
  </div>
);

export default NotificationsPanel;
