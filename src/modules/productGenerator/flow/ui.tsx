// Piezas visuales compartidas por las pantallas del flujo de Fotos de producto.
// Pensadas para reutilizarse en los demás módulos cuando adopten el mismo molde.
import React from 'react';
import { ArrowLeft } from 'lucide-react';

export const FlowTopBar: React.FC<{
  title: string;
  onBack?: () => void;
  progress?: { current: number; total: number };
  right?: React.ReactNode;
}> = ({ title, onBack, progress, right }) => (
  <div className="flex items-center gap-2 min-h-11 mb-3">
    {onBack && (
      <button
        type="button"
        onClick={onBack}
        aria-label="Volver"
        className="-ml-2 w-11 h-11 rounded-full flex items-center justify-center text-slate-700 hover:bg-slate-100 active:scale-95 transition-transform duration-150"
      >
        <ArrowLeft size={20} />
      </button>
    )}
    <span className="flex-1 text-[15px] font-bold text-slate-900 truncate">{title}</span>
    {progress && (
      <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-500" aria-label={`Paso ${progress.current} de ${progress.total}`}>
        {Array.from({ length: progress.total }, (_, i) => (
          <span key={i} className={`block w-[18px] h-1 rounded-full ${i < progress.current ? 'bg-brand-600' : 'bg-slate-200'}`} />
        ))}
        <span className="ml-1 tabular-nums">{progress.current} de {progress.total}</span>
      </span>
    )}
    {right}
  </div>
);

export const FlowHeading: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <h2 className={`font-display font-extrabold italic tracking-tight text-slate-900 text-[24px] md:text-[30px] leading-[1.05] text-balance ${className}`}>
    {children}
  </h2>
);

export const PrimaryButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({ className = '', children, ...rest }) => (
  <button
    type="button"
    {...rest}
    className={`w-full min-h-[54px] rounded-[18px] bg-brand-600 hover:bg-brand-700 text-white text-base font-bold flex items-center justify-center gap-2 shadow-[0_12px_26px_-10px_rgba(247,44,91,0.6)] active:scale-[0.97] transition-[transform,background-color] duration-150 disabled:bg-slate-300 disabled:shadow-none disabled:cursor-not-allowed disabled:active:scale-100 ${className}`}
  >
    {children}
  </button>
);

export const SecondaryButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({ className = '', children, ...rest }) => (
  <button
    type="button"
    {...rest}
    className={`w-full min-h-12 rounded-2xl border border-slate-200 bg-white text-slate-900 text-[15px] font-semibold flex items-center justify-center gap-2 hover:border-slate-300 active:scale-[0.97] transition-transform duration-150 disabled:opacity-60 ${className}`}
  >
    {children}
  </button>
);

export const Chip: React.FC<{
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  hint?: string;
}> = ({ selected, onClick, children, hint }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={selected}
    className={`min-h-[42px] px-3.5 rounded-[14px] border-[1.5px] text-sm font-semibold flex items-center gap-1.5 active:scale-[0.96] transition-transform duration-150 ${
      selected ? 'border-brand-600 bg-brand-50 text-brand-800' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
    }`}
  >
    {children}
    {hint && <span className={`text-xs font-medium ${selected ? 'text-brand-800' : 'text-slate-500'}`}>{hint}</span>}
  </button>
);

// Barra inferior fija con el botón principal. En mobile queda por encima de
// la barra de navegación flotante de la app.
export const StickyActions: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="sticky z-20 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] md:bottom-6 mt-6 -mx-4 px-4 pt-6 pb-1 bg-gradient-to-t from-slate-50 via-slate-50/95 to-transparent flex flex-col gap-2">
    {children}
  </div>
);

export const FieldLabel: React.FC<{ htmlFor?: string; children: React.ReactNode; optional?: boolean }> = ({ htmlFor, children, optional }) => (
  <label htmlFor={htmlFor} className="block text-[13px] font-bold text-slate-700 mb-1.5">
    {children}
    {optional && <span className="font-medium text-slate-500"> · opcional</span>}
  </label>
);

export const Hint: React.FC<{ icon?: React.ReactNode; children: React.ReactNode }> = ({ icon, children }) => (
  <p className="mt-1.5 flex gap-1.5 items-start text-[12.5px] leading-snug text-slate-500">
    {icon && <span className="mt-[1px] shrink-0">{icon}</span>}
    <span>{children}</span>
  </p>
);
