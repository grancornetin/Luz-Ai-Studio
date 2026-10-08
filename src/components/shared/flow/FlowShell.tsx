// src/components/shared/flow/FlowShell.tsx
// Marco de pantalla para los flujos de tarea de todos los módulos.
// En celular se comporta como una app nativa: esconde lo flotante de la app,
// barra superior translúcida (atrás/cerrar, título compacto que aparece al
// desplazar, progreso fino), un solo título grande por pantalla y una barra
// de acción fija abajo que respeta el área segura y el teclado.
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { ChevronLeft, X } from 'lucide-react';

export type FlowLeading = { kind: 'back' | 'close'; onPress: () => void; label?: string };

interface FlowShellProps {
  /** Nombre corto de la pantalla; aparece en la barra al desplazar. */
  title: string;
  leading?: FlowLeading;
  trailing?: React.ReactNode;
  /** 0..1 — solo en los pasos de configuración. */
  progress?: number | null;
  /** Contenido de la barra de acción inferior. */
  actions?: React.ReactNode;
  /** Columna ancha en escritorio (resultados). */
  wide?: boolean;
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

export const FlowShell: React.FC<FlowShellProps> = ({ title, leading, trailing, progress, actions, wide, children }) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLDivElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  const [compactTitle, setCompactTitle] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [actionsH, setActionsH] = useState(0);
  const [kbOffset, setKbOffset] = useState(0);

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
  }, [title]);

  // Línea divisoria de la barra solo cuando hay contenido debajo.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // El contenido reserva el alto real de la barra de acción.
  useLayoutEffect(() => {
    const el = actionsRef.current;
    if (!el) { setActionsH(0); return; }
    const ro = new ResizeObserver(() => setActionsH(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, [actions]);

  // Teclado en iPhone: la barra sube con él y queda solo el botón principal.
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => setKbOffset(Math.max(0, window.innerHeight - vv.height - vv.offsetTop));
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => { vv.removeEventListener('resize', update); vv.removeEventListener('scroll', update); };
  }, []);
  const keyboardOpen = kbOffset > 80;

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
};
