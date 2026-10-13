// src/components/shared/flow/FlowShell.tsx
// Marco de pantalla para los flujos de tarea de todos los módulos.
// Tres distribuciones (docs/flow-layouts.md):
// — Celular: app nativa. Esconde lo flotante de la app, barra superior
//   translúcida (atrás/cerrar, título compacto al desplazar, progreso fino),
//   un solo título grande y barra de acción fija abajo con área segura y teclado.
// — Tableta: una "ventana" que llena la pantalla; columna ancha, indicador de
//   pasos arriba y el botón principal en línea, pegado abajo si no cabe.
// — Computador (≥1024): dos paneles. Lienzo visual a la izquierda (`aside`) y
//   el paso a la derecha con el botón siempre a la vista. Enter continúa,
//   Esc vuelve; se pueden soltar fotos sobre la ventana.
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { Check, ChevronLeft, ImagePlus, X } from 'lucide-react';
import { FlowActionsContext, useFlowLayout } from './layout';

export type FlowLeading = { kind: 'back' | 'close'; onPress: () => void; label?: string };

interface FlowShellProps {
  /** Nombre corto de la pantalla; aparece en la barra al desplazar. */
  title: string;
  leading?: FlowLeading;
  trailing?: React.ReactNode;
  /** 0..1 — solo en los pasos de configuración (línea de 2px en celular). */
  progress?: number | null;
  /** Pasos con nombre: en tableta y computador reemplazan la línea de progreso. */
  steps?: { labels: string[]; current: number };
  /** Contenido de la barra de acción (celular) o del bloque de acción en línea. */
  actions?: React.ReactNode;
  /** Lienzo visual del panel izquierdo; solo se dibuja en computador. */
  aside?: React.ReactNode;
  /**
   * Pista de distribución para tableta/computador:
   * form (por defecto) · hero (panel centrado en vertical, p. ej. la Entrada)
   * · gallery (a todo el ancho, botón principal en la barra superior).
   */
  layout?: 'form' | 'hero' | 'gallery';
  /** Columna ancha en escritorio (resultados). Se mantiene por compatibilidad. */
  wide?: boolean;
  /** Enter con teclado (tableta/computador). Sin función = desactivado. */
  onEnter?: () => void;
  /** Soltar una foto sobre la ventana (tableta/computador). */
  onDropFile?: (file: File) => void;
  children: React.ReactNode;
}

// Transición entre pasos: adelante entra desde la derecha, atrás es el espejo.
// Usa View Transitions cuando el navegador las tiene; si no, cambia directo.
export function flowTransition(direction: 'forward' | 'back', update: () => void) {
  const d = document as Document & { startViewTransition?: (cb: () => void) => { finished: Promise<void> } };
  if (!d.startViewTransition) { update(); return; }
  const root = document.documentElement;
  root.classList.add(direction === 'forward' ? 'flow-forward' : 'flow-back');
  const t = d.startViewTransition(() => { flushSync(update); });
  t.finished.finally(() => root.classList.remove('flow-forward', 'flow-back'));
}

// Indicador de pasos horizontal (tableta y computador).
const StepIndicator: React.FC<{ labels: string[]; current: number }> = ({ labels, current }) => (
  <ol className="flex items-center gap-2" aria-label="Pasos">
    {labels.map((label, i) => {
      const done = i < current;
      const now = i === current;
      return (
        <li key={label} className="flex items-center gap-2" aria-current={now ? 'step' : undefined}>
          {i > 0 && <span aria-hidden className={`h-px w-5 lg:w-7 ${done || now ? 'bg-[color:var(--brand)]/40' : 'bg-[color:var(--separator)]'}`} />}
          <span
            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold tabular-nums transition-colors duration-200 ${
              now ? 'bg-[color:var(--action)] text-white'
                : done ? 'bg-[color:var(--tint)] text-[color:var(--action)]'
                : 'bg-[color:var(--fill)] text-[color:var(--text-2)]'
            }`}
          >
            {done ? <Check size={13} strokeWidth={3} /> : i + 1}
          </span>
          <span className={`whitespace-nowrap text-[14px] leading-5 ${now ? 'font-semibold text-[color:var(--text)]' : 'font-medium text-[color:var(--text-2)]'}`}>
            {label}
          </span>
        </li>
      );
    })}
  </ol>
);

const hasFiles = (e: React.DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes('Files');

export const FlowShell: React.FC<FlowShellProps> = ({
  title, leading, trailing, progress, steps, actions, aside, layout = 'form', wide, onEnter, onDropFile, children,
}) => {
  const mode = useFlowLayout();
  const compact = mode === 'compact';
  const contentRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLDivElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [compactTitle, setCompactTitle] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [actionsH, setActionsH] = useState(0);
  const [kbOffset, setKbOffset] = useState(0);
  const [stuck, setStuck] = useState(false);
  const [dropping, setDropping] = useState(false);
  const dragDepth = useRef(0);

  // Últimas funciones para el teclado sin re-suscribir en cada render.
  const leadingRef = useRef(leading);
  const enterRef = useRef(onEnter);
  leadingRef.current = leading;
  enterRef.current = onEnter;

  // Modo inmersivo mientras el flujo esté montado.
  useEffect(() => {
    document.body.classList.add('flow-immersive');
    return () => document.body.classList.remove('flow-immersive');
  }, []);

  // El título compacto aparece cuando el título grande pasa bajo la barra.
  useEffect(() => {
    const large = contentRef.current?.querySelector('[data-flow-large-title]');
    if (!large) { setCompactTitle(true); return; }
    const navH = navRef.current?.offsetHeight ?? 44;
    const io = new IntersectionObserver(
      ([entry]) => setCompactTitle(!entry.isIntersecting),
      { rootMargin: `-${navH}px 0px 0px 0px`, threshold: 0 },
    );
    io.observe(large);
    return () => io.disconnect();
  }, [title, mode]);

  // Línea divisoria de la barra solo cuando hay contenido debajo.
  // En celular se desplaza la página; en tableta/computador, el panel.
  useEffect(() => {
    const el = compact ? null : contentRef.current;
    const onScroll = () => setScrolled((el ? el.scrollTop : window.scrollY) > 4);
    onScroll();
    const target: Window | HTMLElement = el ?? window;
    target.addEventListener('scroll', onScroll, { passive: true });
    return () => target.removeEventListener('scroll', onScroll);
  }, [compact]);

  // Celular: el contenido reserva el alto real de la barra de acción.
  useLayoutEffect(() => {
    const el = actionsRef.current;
    if (!compact || !el) { setActionsH(0); return; }
    const ro = new ResizeObserver(() => setActionsH(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, [actions, compact]);

  // Tableta/computador: el bloque de acción en línea se pega abajo cuando el
  // contenido no cabe; solo entonces lleva material y línea divisoria.
  useEffect(() => {
    const root = contentRef.current;
    const s = sentinelRef.current;
    if (compact || !root || !s) { setStuck(false); return; }
    const io = new IntersectionObserver(([e]) => setStuck(!e.isIntersecting), { root, threshold: 0 });
    io.observe(s);
    return () => io.disconnect();
  }, [compact, !!actions, layout]);

  // Teclado en iPhone: la barra sube con él y queda solo el botón principal.
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv || !compact) { setKbOffset(0); return; }
    const update = () => setKbOffset(Math.max(0, window.innerHeight - vv.height - vv.offsetTop));
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => { vv.removeEventListener('resize', update); vv.removeEventListener('scroll', update); };
  }, [compact]);
  const keyboardOpen = kbOffset > 80;

  // Teclado físico (tableta/computador): Enter continúa, Esc vuelve o cierra.
  // Si hay una hoja o visor abierto, ellos manejan sus teclas.
  useEffect(() => {
    if (compact) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.isComposing || e.repeat || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      if (document.querySelector('[aria-modal="true"]')) return;
      const t = e.target as HTMLElement | null;
      if (e.key === 'Escape' && leadingRef.current) {
        e.preventDefault();
        leadingRef.current.onPress();
      } else if (e.key === 'Enter' && enterRef.current) {
        if (t?.closest('button, a, textarea, select, [contenteditable="true"], [role="button"], [role="radio"], [role="switch"]')) return;
        e.preventDefault();
        enterRef.current();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [compact]);

  // ─── Celular ───────────────────────────────────────────────────────────────
  if (compact) {
    const col = wide ? 'md:max-w-[1000px]' : 'md:max-w-[620px]';
    return (
      <div
        className={`flow-root relative min-h-[100dvh] md:min-h-0 md:mx-auto md:rounded-[28px] md:border md:border-[color:var(--separator)] md:overflow-clip ${col}`}
        data-kb={keyboardOpen ? 'open' : undefined}
      >
        <div
          ref={navRef}
          className={`flow-nav sticky top-0 z-40 flow-material md:static md:bg-transparent md:backdrop-blur-none transition-[box-shadow] duration-200 ${
            scrolled ? 'shadow-[0_0.5px_0_var(--separator)]' : ''
          }`}
          style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
        >
          <div className="grid grid-cols-[56px_1fr_56px] items-center h-11 px-1">
            <div className="flex justify-start">
              {leading && (
                <button
                  type="button"
                  onClick={leading.onPress}
                  aria-label={leading.label ?? (leading.kind === 'back' ? 'Volver' : 'Cerrar')}
                  className="w-11 h-11 flex items-center justify-center rounded-full text-[color:var(--action)] active:opacity-60 transition-opacity duration-100"
                >
                  {leading.kind === 'back' ? <ChevronLeft size={28} strokeWidth={2.2} /> : <X size={24} strokeWidth={2.2} />}
                </button>
              )}
            </div>
            <span
              className={`text-center text-[17px] leading-[22px] font-semibold truncate transition-opacity duration-150 ${
                compactTitle ? 'opacity-100' : 'opacity-0'
              }`}
              aria-hidden={!compactTitle}
            >
              {title}
            </span>
            <div className="flex justify-end pr-1">{trailing}</div>
          </div>
          {progress != null && (
            <div className="h-[2px] bg-black/[0.06]" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
              <div
                className="h-full w-full origin-left bg-[color:var(--brand)] transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
                style={{ transform: `scaleX(${progress})` }}
              />
            </div>
          )}
        </div>

        <div
          ref={contentRef}
          className="flow-content px-4 min-[428px]:px-5 md:px-8 pt-2 pb-6"
          style={{ paddingBottom: actions ? actionsH + 24 : 32 }}
        >
          {children}
        </div>

        {actions && (
          <div
            ref={actionsRef}
            className="flow-actions fixed inset-x-0 bottom-0 z-40 flow-material shadow-[0_-0.5px_0_var(--separator)] md:sticky md:bottom-0 md:shadow-none md:bg-white md:backdrop-blur-none"
            style={{
              paddingBottom: keyboardOpen ? 12 : 'max(16px, env(safe-area-inset-bottom, 0px))',
              transform: kbOffset ? `translateY(-${kbOffset}px)` : undefined,
            }}
          >
            <div className="mx-auto flex max-w-[620px] flex-col gap-1 px-4 pt-3 md:px-8">{actions}</div>
          </div>
        )}
      </div>
    );
  }

  // ─── Tableta y computador ──────────────────────────────────────────────────
  const isWide = mode === 'wide';
  const split = isWide && !!aside;
  const gallery = layout === 'gallery';
  const hero = layout === 'hero' && split;
  const toolbarActions = gallery && actions;

  const dropProps = onDropFile ? {
    onDragEnter: (e: React.DragEvent) => { if (!hasFiles(e)) return; e.preventDefault(); dragDepth.current += 1; setDropping(true); },
    onDragOver: (e: React.DragEvent) => { if (!hasFiles(e)) return; e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; },
    onDragLeave: () => { dragDepth.current = Math.max(0, dragDepth.current - 1); if (dragDepth.current === 0) setDropping(false); },
    onDrop: (e: React.DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      dragDepth.current = 0;
      setDropping(false);
      const file = Array.from(e.dataTransfer.files).find((f) => f.type.startsWith('image/'));
      if (file) onDropFile(file);
    },
  } : {};

  const leadingButton = leading && (
    leading.kind === 'back' ? (
      <button
        type="button"
        onClick={leading.onPress}
        aria-label={leading.label ?? 'Volver'}
        title="Volver (Esc)"
        className="flow-hover-bg flex h-10 items-center gap-0.5 rounded-full pl-1 pr-3.5 text-[16px] font-semibold text-[color:var(--action)] active:opacity-60 transition-[opacity,background-color] duration-150"
      >
        <ChevronLeft size={24} strokeWidth={2.2} /> Atrás
      </button>
    ) : (
      <button
        type="button"
        onClick={leading.onPress}
        aria-label={leading.label ?? 'Cerrar'}
        title="Cerrar (Esc)"
        className="flow-hover-bg flex h-10 w-10 items-center justify-center rounded-full text-[color:var(--action)] active:opacity-60 transition-[opacity,background-color] duration-150"
      >
        <X size={22} strokeWidth={2.2} />
      </button>
    )
  );

  const inlineActions = actions && !toolbarActions && (
    <FlowActionsContext.Provider value="inline">
      <div
        className={`flow-actions sticky bottom-0 z-20 -mx-8 mt-8 px-8 pb-6 pt-3 transition-[background-color,box-shadow] duration-200 ${
          stuck ? 'flow-material shadow-[0_-0.5px_0_var(--separator)]' : ''
        }`}
      >
        <div className="flex flex-col gap-1">{actions}</div>
      </div>
    </FlowActionsContext.Provider>
  );

  const paneInner = split
    ? `px-8 ${hero ? 'flex min-h-full flex-col justify-center py-10' : 'pt-6'}`
    : `mx-auto w-full px-8 pt-3 ${gallery ? 'max-w-[1440px]' : 'max-w-[680px]'}`;

  const scroller = (
    <div ref={contentRef} className="flow-content relative min-h-0 flex-1 overflow-y-auto overscroll-contain">
      <div className={`${paneInner} ${actions && !toolbarActions ? '' : 'pb-10'}`}>
        {/* Envoltura plana: en "hero" el panel es flex y estiraría a los hijos */}
        <div>
          {children}
          {inlineActions}
        </div>
      </div>
      <div ref={sentinelRef} aria-hidden className="h-px" />
    </div>
  );

  return (
    <div
      className="flow-root flow-panel relative mx-auto !flex h-[calc(100dvh-24px)] w-full max-w-[1680px] flex-col overflow-clip rounded-[20px]"
      data-layout={mode}
      {...dropProps}
    >
      <div
        ref={navRef}
        className={`flow-nav relative z-30 shrink-0 bg-white transition-[box-shadow] duration-200 ${
          scrolled || split ? 'shadow-[0_0.5px_0_var(--separator)]' : ''
        }`}
      >
        <div className="grid h-14 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 px-3">
          <div className="flex justify-start">{leadingButton}</div>
          <div className="min-w-0">
            {steps ? (
              <StepIndicator labels={steps.labels} current={steps.current} />
            ) : (
              <span
                className={`block truncate text-center text-[16px] leading-[22px] font-semibold transition-opacity duration-150 ${compactTitle ? 'opacity-100' : 'opacity-0'}`}
                aria-hidden={!compactTitle}
              >
                {title}
              </span>
            )}
          </div>
          <div className="flex items-center justify-end gap-1.5">
            {trailing}
            {toolbarActions && <FlowActionsContext.Provider value="toolbar">{actions}</FlowActionsContext.Provider>}
          </div>
        </div>
      </div>

      {split ? (
        <div className="flex min-h-0 flex-1">
          <div className="flow-stage relative min-w-0 flex-1 bg-[color:var(--stage)]">
            <div className="absolute inset-0 flex flex-col p-8">{aside}</div>
          </div>
          <div className="flex min-h-0 w-[420px] shrink-0 flex-col shadow-[-0.5px_0_0_var(--separator)] xl:w-[460px]">{scroller}</div>
        </div>
      ) : (
        scroller
      )}

      {dropping && (
        <div className="pointer-events-none absolute inset-2 z-50 flex flex-col items-center justify-center gap-3 rounded-[16px] border-2 border-dashed border-[color:var(--brand)] bg-white/85 text-[color:var(--action)] backdrop-blur-sm">
          <ImagePlus size={36} strokeWidth={1.8} />
          <p className="text-[17px] font-semibold">Suelta tu foto aquí</p>
        </div>
      )}
    </div>
  );
};
