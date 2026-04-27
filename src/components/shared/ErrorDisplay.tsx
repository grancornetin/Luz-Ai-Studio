import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ErrorCode } from '../../services/imageApiService';

export interface AppError {
  message: string;
  code?: ErrorCode | string;
}

interface ErrorConfig {
  icon: string;
  label: string;
  actionLabel?: string;
  actionType?: 'retry' | 'link';
  actionLink?: string;
  refund?: boolean;
}

const ERROR_CONFIG: Record<string, ErrorConfig> = {
  [ErrorCode.NO_CREDITS]: {
    icon: '💰',
    label: 'Sin créditos',
    actionLabel: 'Comprar créditos',
    actionType: 'link',
    actionLink: '/pricing',
  },
  [ErrorCode.INVALID_IMAGE]: {
    icon: '🖼️',
    label: 'Imagen no válida',
    actionLabel: 'Cambiar imagen',
    actionType: 'retry',
  },
  [ErrorCode.FACE_NOT_DETECTED]: {
    icon: '👤',
    label: 'Rostro no detectado',
    actionLabel: 'Probar otra foto',
    actionType: 'retry',
  },
  [ErrorCode.CONTENT_BLOCKED]: {
    icon: '🚫',
    label: 'Contenido bloqueado',
    actionLabel: 'Ajustar y reintentar',
    actionType: 'retry',
  },
  [ErrorCode.TIMEOUT]: {
    icon: '⏱️',
    label: 'Tiempo agotado',
    actionLabel: 'Reintentar',
    actionType: 'retry',
    refund: true,
  },
  [ErrorCode.SERVER_ERROR]: {
    icon: '🖥️',
    label: 'Error del servidor',
    actionLabel: 'Reintentar',
    actionType: 'retry',
    refund: true,
  },
  [ErrorCode.RATE_LIMIT]: {
    icon: '⏳',
    label: 'Demasiadas solicitudes',
    actionLabel: 'Reintentar',
    actionType: 'retry',
    refund: true,
  },
  [ErrorCode.UNKNOWN]: {
    icon: '⚠️',
    label: 'Error inesperado',
    actionLabel: 'Reintentar',
    actionType: 'retry',
  },
};

const FALLBACK_CONFIG: ErrorConfig = {
  icon: '⚠️',
  label: 'Error',
  actionLabel: 'Reintentar',
  actionType: 'retry',
};

const MAX_RETRIES = 3;

interface ErrorDisplayProps {
  error: AppError;
  onRetry?: () => void;
  onDismiss?: () => void;
  creditsRefunded?: boolean;
  className?: string;
}

export const ErrorDisplay: React.FC<ErrorDisplayProps> = ({
  error,
  onRetry,
  onDismiss,
  creditsRefunded = false,
  className = '',
}) => {
  const navigate = useNavigate();
  const [retryCount, setRetryCount] = useState(0);

  const code = (error.code as string) || ErrorCode.UNKNOWN;
  const cfg = ERROR_CONFIG[code] ?? FALLBACK_CONFIG;
  const isRefundable = cfg.refund === true;
  const retriesExhausted = retryCount >= MAX_RETRIES;

  const handleAction = () => {
    if (cfg.actionType === 'link' && cfg.actionLink) {
      navigate(cfg.actionLink);
      return;
    }
    if (cfg.actionType === 'retry' && onRetry) {
      setRetryCount(c => c + 1);
      onRetry();
    }
  };

  return (
    <div className={`rounded-2xl border p-4 space-y-3 animate-in fade-in duration-300 ${
      isRefundable
        ? 'bg-amber-50 border-amber-200'
        : 'bg-red-50 border-red-200'
    } ${className}`}>

      {/* Header */}
      <div className="flex items-start gap-3">
        <span className="text-2xl flex-shrink-0 leading-none mt-0.5">{cfg.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className={`text-[10px] font-black uppercase tracking-widest ${isRefundable ? 'text-amber-700' : 'text-red-700'}`}>
              {cfg.label}
            </p>
            {onDismiss && (
              <button onClick={onDismiss} className="text-slate-400 hover:text-slate-600 flex-shrink-0 text-xs">✕</button>
            )}
          </div>
          <p className={`text-xs font-medium mt-0.5 leading-relaxed ${isRefundable ? 'text-amber-800' : 'text-red-800'}`}>
            {error.message}
          </p>
        </div>
      </div>

      {/* Reembolso confirmado */}
      {(isRefundable || creditsRefunded) && (
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
          <span className="text-emerald-600 text-sm">✓</span>
          <p className="text-[10px] font-bold text-emerald-700">
            {creditsRefunded
              ? 'Tus créditos han sido reembolsados automáticamente.'
              : 'Los créditos se reembolsarán si este error es del sistema.'}
          </p>
        </div>
      )}

      {/* Acción */}
      {cfg.actionLabel && (
        <div className="flex gap-2 items-center">
          {!retriesExhausted ? (
            <button
              onClick={handleAction}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 ${
                isRefundable
                  ? 'bg-amber-500 hover:bg-amber-600 text-white'
                  : 'bg-red-500 hover:bg-red-600 text-white'
              }`}
            >
              {cfg.actionType === 'retry' && <span>↩</span>}
              {cfg.actionLabel}
              {cfg.actionType === 'retry' && retryCount > 0 && (
                <span className="opacity-70">({retryCount}/{MAX_RETRIES})</span>
              )}
            </button>
          ) : (
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                Límite de reintentos alcanzado
              </p>
              <a
                href="mailto:soporte@luzia.app"
                className="text-[10px] font-medium text-indigo-600 hover:underline"
              >
                Contactar soporte →
              </a>
            </div>
          )}

          {cfg.actionType === 'link' && (
            <button
              onClick={() => navigate('/dashboard')}
              className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all"
            >
              Ver misiones gratis
            </button>
          )}
        </div>
      )}
    </div>
  );
};

/** Helper para convertir cualquier Error en un AppError */
export function toAppError(err: any): AppError {
  return {
    message: err?.message || 'Error inesperado',
    code: err?.code || ErrorCode.UNKNOWN,
  };
}
