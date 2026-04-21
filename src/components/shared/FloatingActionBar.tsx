import React from 'react';
import { X, Download, Trash2, Check } from 'lucide-react';

export interface FloatingActionBarProps {
  isVisible: boolean;
  selectedCount?: number;
  onDownload?: () => void;
  onDelete?: () => void;
  onClearSelection?: () => void;
  primaryAction?: {
    label: string;
    icon?: React.ReactNode;
    onClick: () => void;
    loading?: boolean;
  };
  className?: string;
}

export const FloatingActionBar: React.FC<FloatingActionBarProps> = ({
  isVisible,
  selectedCount = 0,
  onDownload,
  onDelete,
  onClearSelection,
  primaryAction,
  className = '',
}) => {
  if (!isVisible) return null;

  const hasSelection = selectedCount > 0;

  return (
    <div
      className={`
        fixed bottom-6 left-1/2 -translate-x-1/2 z-50
        w-[calc(100%-2rem)] max-w-lg
        bg-slate-900 text-white rounded-full shadow-2xl
        flex items-center justify-between gap-2 px-4 py-2
        animate-in slide-in-from-bottom-5 fade-in duration-200
        ${className}
      `}
      style={{ minHeight: 56 }}
    >
      {/* Left: selection info */}
      <div className="text-sm font-medium">
        {hasSelection ? (
          <span>{selectedCount} seleccionada{selectedCount !== 1 ? 's' : ''}</span>
        ) : primaryAction ? (
          <span className="opacity-70">{primaryAction.label}</span>
        ) : null}
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-1">
        {hasSelection ? (
          <>
            {onDownload && (
              <button
                onClick={onDownload}
                className="flex items-center gap-1.5 px-3 py-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors text-sm font-medium"
                style={{ minHeight: 40, minWidth: 40 }}
              >
                <Download size={16} />
                <span className="hidden sm:inline">Descargar</span>
              </button>
            )}
            {onDelete && (
              <button
                onClick={onDelete}
                className="flex items-center gap-1.5 px-3 py-2 bg-red-500/20 hover:bg-red-500/30 rounded-full transition-colors text-red-200 text-sm font-medium"
                style={{ minHeight: 40, minWidth: 40 }}
              >
                <Trash2 size={16} />
                <span className="hidden sm:inline">Eliminar</span>
              </button>
            )}
            {onClearSelection && (
              <button
                onClick={onClearSelection}
                className="p-2 hover:bg-white/10 rounded-full transition-colors"
                aria-label="Limpiar selección"
                style={{ minHeight: 40, minWidth: 40 }}
              >
                <X size={18} />
              </button>
            )}
          </>
        ) : primaryAction ? (
          <button
            onClick={primaryAction.onClick}
            disabled={primaryAction.loading}
            className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 rounded-full transition-colors text-white text-sm font-bold shadow-lg disabled:opacity-50"
            style={{ minHeight: 40 }}
          >
            {primaryAction.loading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              primaryAction.icon || <Check size={16} />
            )}
            {primaryAction.label}
          </button>
        ) : null}
      </div>
    </div>
  );
};