/**
 * ResultLibraryGrid — contenedor estándar de biblioteca para todos los módulos.
 *
 * Provee:
 *   - Toolbar con búsqueda, filtro y botón de acción principal
 *   - Fila de stats resumen (configurable)
 *   - Grid 3 columnas responsive (1 en móvil, 2 en tablet, 3 en desktop)
 *   - Estado vacío con CTA
 *   - Estado de carga (spinner)
 *
 * Los módulos pasan sus ResultCard como children. La búsqueda filtra sobre
 * un campo `searchText` que cada módulo provee por item.
 *
 * Uso:
 *   <ResultLibraryGrid
 *     loading={loadingSets}
 *     stats={[{ label: 'Total', value: sets.length, sub: 'campañas' }]}
 *     emptyTitle="Biblioteca vacía"
 *     emptyDescription="Creá tu primera campaña para guardarla aquí"
 *     onEmpty={() => setActiveTab('create')}
 *     emptyCtaLabel="Crear campaña"
 *   >
 *     {sets.map(set => <ResultCard key={set.id} ... />)}
 *   </ResultLibraryGrid>
 */

import React, { useState, useMemo } from 'react';
import { Search, SlidersHorizontal, CheckSquare, X, Trash2 } from 'lucide-react';

// ── Tipos ────────────────────────────────────────────────────────────────────

export interface LibraryStat {
  label: string;
  value: number | string;
  sub?:  string;
  color?: string;   // tailwind text color, ej: 'text-brand-600'
}

export interface LibraryFilterOption {
  label: string;
  value: string;
}

export interface ResultLibraryGridProps {
  children:    React.ReactNode;

  // Estado
  loading?:    boolean;
  itemCount?:  number;   // número real de items (para el conteo en toolbar)

  // Stats
  stats?:      LibraryStat[];

  // Búsqueda — si se provee searchTexts, el grid filtra internamente
  // Cada string corresponde al texto de búsqueda de cada child (mismo orden)
  searchTexts?: string[];
  onSearchChange?: (q: string) => void;  // alternativa: el padre maneja la búsqueda

  // Filtro opcional (dropdown)
  filterOptions?: LibraryFilterOption[];
  onFilterChange?: (value: string) => void;

  // Estado vacío
  emptyTitle?:       string;
  emptyDescription?: string;
  emptyCtaLabel?:    string;
  emptyIcon?:        React.ReactNode;
  onEmpty?:          () => void;

  // Botón de acción principal (ej: "Nueva campaña")
  primaryAction?: {
    label:   string;
    onClick: () => void;
    icon?:   React.ReactNode;
  };

  // Número de columnas en desktop (default 3)
  columns?: 1 | 2 | 3 | 4;

  // Selección y borrado en masa (opt-in — sin bulkActions, la toolbar y el
  // grid se comportan exactamente igual que antes). El módulo controla el
  // estado real de selección en sus propios items (mismo criterio que
  // selectable/selected/onToggleSelect en ResultCard) — este componente
  // solo muestra el botón que activa el modo y la barra con el conteo.
  bulkActions?: {
    active:           boolean;
    onToggleActive:   () => void;
    selectedCount:    number;
    onDeleteSelected: () => void;
    deleting?:        boolean;
  };
}

// ── Componente ───────────────────────────────────────────────────────────────

export const ResultLibraryGrid: React.FC<ResultLibraryGridProps> = ({
  children,
  loading = false,
  itemCount,
  stats,
  searchTexts,
  onSearchChange,
  filterOptions,
  onFilterChange,
  emptyTitle       = 'Sin resultados',
  emptyDescription = 'Todavía no hay nada guardado aquí',
  emptyCtaLabel    = 'Crear nuevo',
  emptyIcon,
  onEmpty,
  primaryAction,
  columns = 3,
  bulkActions,
}) => {
  const [query, setQuery] = useState('');

  const childArray = React.Children.toArray(children);

  // Filtrado interno opcional
  const visibleChildren = useMemo(() => {
    if (!searchTexts || !query.trim()) return childArray;
    const q = query.toLowerCase();
    return childArray.filter((_, i) =>
      (searchTexts[i] ?? '').toLowerCase().includes(q)
    );
  }, [childArray, searchTexts, query]);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    onSearchChange?.(e.target.value);
  };

  const colClass = columns === 1
    ? 'grid-cols-1'
    : columns === 2
    ? 'grid-cols-1 sm:grid-cols-2'
    : columns === 4
    ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
    : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3';

  const isEmpty = !loading && visibleChildren.length === 0;

  return (
    <div className="animate-in fade-in duration-300">

      {/* ── Toolbar ── */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        {/* Búsqueda */}
        <div className="flex-1 min-w-[180px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={handleSearch}
            placeholder="Buscar..."
            className="w-full h-9 pl-8 pr-3 rounded-xl border border-slate-200 bg-white text-[13px] text-slate-700 placeholder-slate-400 outline-none focus:border-brand-400 transition-colors"
          />
        </div>

        {/* Filtro */}
        {filterOptions && filterOptions.length > 0 && (
          <div className="relative">
            <SlidersHorizontal className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            <select
              onChange={e => onFilterChange?.(e.target.value)}
              className="h-9 pl-8 pr-3 rounded-xl border border-slate-200 bg-white text-[13px] text-slate-600 outline-none focus:border-brand-400 transition-colors appearance-none cursor-pointer"
            >
              {filterOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        )}

        {/* Selección en masa — botón que activa/desactiva el modo */}
        {bulkActions && (
          <button
            type="button"
            onClick={bulkActions.onToggleActive}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12px] font-bold transition-colors flex-shrink-0 border ${
              bulkActions.active
                ? 'bg-slate-700 text-white border-slate-700 hover:bg-slate-800'
                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
            }`}
          >
            {bulkActions.active ? <X size={13} /> : <CheckSquare size={13} />}
            {bulkActions.active ? 'Cancelar' : 'Seleccionar'}
          </button>
        )}

        {/* Acción principal */}
        {primaryAction && (
          <button
            type="button"
            onClick={primaryAction.onClick}
            className="flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-[12px] font-bold transition-colors flex-shrink-0"
          >
            {primaryAction.icon}
            {primaryAction.label}
          </button>
        )}
      </div>

      {/* ── Barra de selección activa ── */}
      {bulkActions?.active && (
        <div className="flex items-center justify-between gap-3 mb-5 px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl flex-wrap">
          <span className="text-[12px] font-semibold text-slate-600">
            {bulkActions.selectedCount === 0
              ? 'Tocá las tarjetas para seleccionarlas'
              : `${bulkActions.selectedCount} seleccionado${bulkActions.selectedCount === 1 ? '' : 's'}`}
          </span>
          <button
            type="button"
            onClick={bulkActions.onDeleteSelected}
            disabled={bulkActions.selectedCount === 0 || bulkActions.deleting}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-100 rounded-xl text-[12px] font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
          >
            {bulkActions.deleting
              ? <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
              : <Trash2 size={13} />}
            Eliminar {bulkActions.selectedCount > 0 ? `(${bulkActions.selectedCount})` : ''}
          </button>
        </div>
      )}

      {/* ── Stats ── */}
      {stats && stats.length > 0 && (
        <div className={`grid gap-3 mb-5 ${stats.length <= 2 ? 'grid-cols-2' : stats.length === 3 ? 'grid-cols-3' : 'grid-cols-2 sm:grid-cols-4'}`}>
          {stats.map((s, i) => (
            <div key={i} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
              <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">{s.label}</p>
              <p className={`text-[22px] font-black ${s.color ?? 'text-slate-900'}`} style={{ fontFamily: 'Syne, Inter, sans-serif' }}>
                {s.value}
              </p>
              {s.sub && <p className="text-[11px] text-slate-400">{s.sub}</p>}
            </div>
          ))}
        </div>
      )}

      {/* ── Loading ── */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* ── Vacío ── */}
      {isEmpty && (
        <div className="flex flex-col items-center justify-center py-20 text-center bg-white border-2 border-dashed border-slate-200 rounded-2xl">
          <div className="text-4xl mb-4 text-slate-200">
            {emptyIcon ?? '🗂️'}
          </div>
          <p className="text-[14px] font-bold text-slate-500 mb-1">{emptyTitle}</p>
          <p className="text-[12px] text-slate-400 mb-5 max-w-xs">{emptyDescription}</p>
          {onEmpty && (
            <button
              type="button"
              onClick={onEmpty}
              className="flex items-center gap-2 px-5 py-2.5 bg-brand-600 text-white rounded-xl text-[12px] font-bold hover:bg-brand-700 transition-colors"
            >
              {emptyCtaLabel}
            </button>
          )}
        </div>
      )}

      {/* ── Grid ── */}
      {!loading && !isEmpty && (
        <div className={`grid ${colClass} gap-4`}>
          {visibleChildren}
        </div>
      )}
    </div>
  );
};

export default ResultLibraryGrid;
