// src/components/shared/flow/primitives.tsx
// Piezas de interfaz de los flujos, con la escala tipográfica y los tokens
// definidos en index.css (.flow-root). Inter en todo; Syne solo en el título
// de entrada de cada módulo (LargeTitle display).
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronRight, Loader2 } from 'lucide-react';

// ─── Texto ────────────────────────────────────────────────────────────────────

export const LargeTitle: React.FC<{ children: React.ReactNode; display?: boolean; subtitle?: React.ReactNode }> = ({ children, display, subtitle }) => (
  <div className="pt-2 pb-1">
    <h1
      data-flow-large-title
      className={display
        ? 'flow-display text-[32px] leading-[36px] text-balance'
        : 'text-[28px] leading-[34px] font-bold tracking-[-0.021em] text-balance'}
    >
      {children}
    </h1>
    {subtitle && <p className="mt-1.5 text-[16px] leading-6 text-[color:var(--text-2)]">{subtitle}</p>}
  </div>
);

export const SectionTitle: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <h2 className={`mt-8 mb-2 text-[20px] leading-[25px] font-semibold tracking-[-0.017em] ${className}`}>{children}</h2>
);

export const FieldLabel: React.FC<{ htmlFor?: string; children: React.ReactNode; optional?: boolean }> = ({ htmlFor, children, optional }) => (
  <label htmlFor={htmlFor} className="mb-2 block text-[15px] leading-5 font-semibold tracking-[-0.009em]">
    {children}
    {optional && <span className="font-normal text-[color:var(--text-2)]"> · opcional</span>}
  </label>
);

export const Footnote: React.FC<{ icon?: React.ReactNode; children: React.ReactNode; className?: string }> = ({ icon, children, className = '' }) => (
  <p className={`flex items-start gap-1.5 text-[13px] leading-[18px] font-medium tracking-normal text-[color:var(--text-2)] ${className}`}>
    {icon && <span className="mt-[1px] shrink-0">{icon}</span>}
    <span>{children}</span>
  </p>
);

// ─── Botones ──────────────────────────────────────────────────────────────────

export const PrimaryButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean; icon?: React.ReactNode }> = ({
  children, loading, icon, className = '', disabled, ...rest
}) => (
  <button
    type="button"
    disabled={disabled}
    {...rest}
    className={`flow-press w-full h-[52px] rounded-full bg-[color:var(--action)] active:bg-[color:var(--action-pressed)] text-white text-[17px] leading-[22px] font-semibold flex items-center justify-center gap-2 disabled:bg-[color:var(--fill)] disabled:text-[color:var(--placeholder)] disabled:active:scale-100 ${className}`}
  >
    {loading ? <Loader2 size={20} className="animate-spin" /> : icon}
    {children}
  </button>
);

export const TextButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({ children, className = '', ...rest }) => (
  <button
    type="button"
    {...rest}
    className={`min-h-11 px-3 rounded-full text-[16px] leading-[22px] font-semibold text-[color:var(--action)] active:opacity-60 transition-opacity duration-100 disabled:opacity-40 ${className}`}
  >
    {children}
  </button>
);

export const ActionCaption: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="flow-kb-hide pb-0.5 text-center text-[13px] leading-[18px] font-medium tracking-normal text-[color:var(--text-2)] tabular-nums">{children}</p>
);

// ─── Campo de texto ───────────────────────────────────────────────────────────

export const TextField = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className = '', ...rest }, ref) => (
  <input
    ref={ref}
    type="text"
    autoComplete="off"
    {...rest}
    className={`w-full h-[52px] rounded-[12px] bg-[color:var(--fill)] px-4 text-[16px] font-normal text-[color:var(--text)] placeholder:text-[color:var(--placeholder)] outline-none focus:ring-2 focus:ring-[color:var(--brand)] transition-shadow duration-150 ${className}`}
  />
));
TextField.displayName = 'TextField';

// ─── Control segmentado ───────────────────────────────────────────────────────

export function SegmentedControl<T extends string | number>({
  options, value, onChange, ariaLabel,
}: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; ariaLabel: string }) {
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="relative grid h-9 rounded-[12px] bg-[color:var(--fill)] p-[2px]" style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}>
      <span
        aria-hidden
        className="absolute top-[2px] bottom-[2px] left-[2px] rounded-[10px] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.12)] transition-transform duration-[250ms] ease-[cubic-bezier(0.32,0.72,0,1)]"
        style={{ width: `calc((100% - 4px) / ${options.length})`, transform: `translateX(${index * 100}%)` }}
      />
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={`relative z-10 text-[15px] font-semibold transition-colors duration-150 ${o.value === value ? 'text-[color:var(--text)]' : 'text-[color:var(--text-2)]'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ─── Listas agrupadas ─────────────────────────────────────────────────────────

export const GroupedList: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`overflow-hidden rounded-[12px] bg-[color:var(--fill)] ${className}`}>{children}</div>
);

interface GroupedRowProps {
  leading?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  trailing?: React.ReactNode;
  chevron?: boolean;
  onPress?: () => void;
  /** separador interno: alinea con el texto */
  inset?: number;
  last?: boolean;
  ariaPressed?: boolean;
}

export const GroupedRow: React.FC<GroupedRowProps> = ({ leading, title, subtitle, trailing, chevron, onPress, inset = 16, last, ariaPressed }) => {
  const body = (
    <>
      {leading && <span className="shrink-0">{leading}</span>}
      <span className="relative flex min-h-[52px] flex-1 items-center gap-3 py-2.5 pr-4 min-w-0">
        <span className="flex-1 min-w-0 text-left">
          <span className="block text-[16px] leading-[21px] font-normal text-[color:var(--text)] truncate">{title}</span>
          {subtitle && <span className="block text-[13px] leading-[18px] font-normal tracking-normal text-[color:var(--text-2)]">{subtitle}</span>}
        </span>
        {trailing}
        {chevron && <ChevronRight size={17} className="shrink-0 text-[color:var(--placeholder)]" />}
        {!last && <span aria-hidden className="absolute bottom-0 left-0 right-0 h-px bg-[color:var(--separator)]" />}
      </span>
    </>
  );
  const cls = 'flex w-full items-center gap-3';
  const style = { paddingLeft: inset };
  return onPress ? (
    <button type="button" onClick={onPress} aria-pressed={ariaPressed} className={`${cls} active:bg-[color:var(--fill-pressed)] transition-colors duration-150`} style={style}>{body}</button>
  ) : (
    <div className={cls} style={style}>{body}</div>
  );
};

export function ChoiceList<T extends string>({
  options, value, onChange,
}: { options: { value: T; title: string; hint?: string }[]; value: T | null; onChange: (v: T) => void }) {
  return (
    <GroupedList>
      <div role="radiogroup">
        {options.map((o, i) => (
          <GroupedRow
            key={o.value}
            title={o.title}
            subtitle={o.hint}
            onPress={() => onChange(o.value)}
            ariaPressed={o.value === value}
            last={i === options.length - 1}
            trailing={o.value === value ? <Check size={20} strokeWidth={2.6} className="shrink-0 text-[color:var(--brand)]" /> : <span className="w-5 shrink-0" />}
          />
        ))}
      </div>
    </GroupedList>
  );
}

// ─── Interruptor iOS ──────────────────────────────────────────────────────────

export const Switch: React.FC<{ checked: boolean; onChange: (v: boolean) => void; label: string }> = ({ checked, onChange, label }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    onClick={() => onChange(!checked)}
    className={`relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors duration-200 ${checked ? 'bg-[#34C759]' : 'bg-[#E9E9EA]'}`}
  >
    <span className={`absolute left-[2px] top-[2px] h-[27px] w-[27px] rounded-full bg-white shadow-[0_3px_8px_rgba(0,0,0,0.15),0_1px_1px_rgba(0,0,0,0.16)] transition-transform duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] ${checked ? 'translate-x-5' : ''}`} />
  </button>
);

// ─── Avisos en línea ──────────────────────────────────────────────────────────

export const InlineBanner: React.FC<{
  tone: 'warn' | 'danger';
  icon: React.ReactNode;
  children: React.ReactNode;
  action?: { label: string; onPress: () => void; loading?: boolean };
}> = ({ tone, icon, children, action }) => (
  <div role={tone === 'danger' ? 'alert' : 'status'} className="flex items-start gap-3 rounded-[12px] bg-[color:var(--fill)] p-3">
    <span className={`mt-0.5 shrink-0 ${tone === 'danger' ? 'text-[color:var(--danger-fg)]' : 'text-[color:var(--warn-fg)]'}`}>{icon}</span>
    <p className="flex-1 text-[15px] leading-5 text-[color:var(--text)]">{children}</p>
    {action && (
      <button type="button" onClick={action.onPress} disabled={action.loading} className="shrink-0 -my-1 min-h-9 px-1 text-[15px] font-semibold text-[color:var(--action)] active:opacity-60 disabled:opacity-50">
        {action.loading ? <Loader2 size={18} className="animate-spin" /> : action.label}
      </button>
    )}
  </div>
);

// ─── Hoja inferior ────────────────────────────────────────────────────────────

export const BottomSheet: React.FC<{ open: boolean; onClose: () => void; title: string; children: React.ReactNode }> = ({ open, onClose, title, children }) => {
  const sheetRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y: number; t: number; dy: number } | null>(null);
  const [dy, setDy] = useState(0);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  useEffect(() => { if (!open) setDy(0); }, [open]);

  if (!open) return null;

  // Arrastrar hacia abajo para cerrar: basta pasar 30% del alto o un gesto rápido.
  const onPointerDown = (e: React.PointerEvent) => {
    drag.current = { y: e.clientY, t: performance.now(), dy: 0 };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const d = e.clientY - drag.current.y;
    drag.current.dy = d;
    setDy(d > 0 ? d : d / 6);
  };
  const onPointerUp = () => {
    if (!drag.current) return;
    const { dy: d, t } = drag.current;
    const velocity = d / Math.max(1, performance.now() - t);
    const h = sheetRef.current?.offsetHeight ?? 400;
    drag.current = null;
    if (d > h * 0.3 || velocity > 0.11) onClose();
    else setDy(0);
  };

  return createPortal(
    <div className="flow-root fixed inset-0 z-[960] flex items-end md:items-center justify-center bg-transparent">
      <div className="flow-scrim absolute inset-0 bg-black/35" onClick={onClose} />
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="flow-sheet relative w-full md:max-w-[480px] max-h-[86dvh] overflow-y-auto rounded-t-[24px] md:rounded-[24px] bg-white shadow-[0_-8px_32px_rgba(0,0,0,0.12)]"
        style={{
          transform: dy ? `translateY(${dy}px)` : undefined,
          transition: drag.current ? 'none' : 'transform 300ms cubic-bezier(0.32,0.72,0,1)',
          paddingBottom: 'max(20px, env(safe-area-inset-bottom, 0px))',
        }}
      >
        <div className="sticky top-0 z-10 bg-white pt-2 pb-1 touch-none" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
          <div className="mx-auto h-[5px] w-9 rounded-full bg-[#D1D1D6]" />
          <p className="mt-3 px-4 text-center text-[17px] leading-[22px] font-semibold">{title}</p>
        </div>
        <div className="px-4 pt-3">{children}</div>
      </div>
    </div>,
    document.body,
  );
};

// ─── Galería: regla de distribución ───────────────────────────────────────────
// 1 foto = ancho completo · par = 2 columnas · impar = la primera ocupa 2.
// El collage siempre al final, a ancho completo. Nunca filas a medias.

export const PhotoLayout: React.FC<{ items: React.ReactNode[]; trailingWide?: React.ReactNode }> = ({ items, trailingWide }) => {
  const n = items.length;
  return (
    <div className={`grid grid-cols-2 gap-3 ${n >= 4 ? 'md:grid-cols-4' : ''}`}>
      {items.map((item, i) => (
        <div key={i} className={n === 1 || (n % 2 === 1 && i === 0) ? 'col-span-2' : ''}>{item}</div>
      ))}
      {trailingWide && <div className={`col-span-2 ${n >= 4 ? 'md:col-span-4' : ''}`}>{trailingWide}</div>}
    </div>
  );
};

// ─── Progreso estimado ────────────────────────────────────────────────────────
// Avanza suave según el tiempo esperado (nunca pasa de 90% solo) y salta con
// cada foto terminada. Llega a 100% cuando todo está listo.

export function useEstimatedProgress(running: boolean, done: number, total: number, expectedSeconds: number) {
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef<number | null>(null);
  useEffect(() => {
    if (!running) { startRef.current = null; setElapsed(0); return; }
    startRef.current = performance.now();
    const id = window.setInterval(() => setElapsed((performance.now() - (startRef.current ?? 0)) / 1000), 250);
    return () => window.clearInterval(id);
  }, [running]);
  if (total > 0 && done >= total) return 1;
  const tau = expectedSeconds / 2.5;
  const estimate = 0.9 * (1 - Math.exp(-elapsed / tau));
  const byPhotos = total > 0 ? (done / total) * 0.95 : 0;
  return Math.max(0.04, estimate, byPhotos);
}

export const ProgressBar: React.FC<{ value: number; label: string }> = ({ value, label }) => (
  <div className="h-1 overflow-hidden rounded-full bg-[color:var(--fill)]" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value * 100)}>
    <div className="h-full w-full origin-left rounded-full bg-[color:var(--brand)] transition-transform duration-500 ease-[cubic-bezier(0.23,1,0.32,1)]" style={{ transform: `scaleX(${value})` }} />
  </div>
);
