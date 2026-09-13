import React, { useRef, useState, useCallback, useEffect } from 'react';
import { MoveHorizontal } from 'lucide-react';

interface BeforeAfterSliderProps {
  beforeSrc: string;
  afterSrc: string;
  beforeLabel?: string;
  afterLabel?: string;
  /** Alto fijo del comparador (se adapta al contenedor en ancho). */
  className?: string;
}

/**
 * Comparador con línea divisoria arrastrable: revela "after" a la izquierda
 * del handle y "before" a la derecha. Funciona mejor cuando ambas imágenes
 * comparten el mismo encuadre/composición (mismo caso que "Antes/Después"
 * en Clone Image) — con encuadres distintos el efecto no comunica nada.
 */
export const BeforeAfterSlider: React.FC<BeforeAfterSliderProps> = ({
  beforeSrc,
  afterSrc,
  beforeLabel = 'Antes',
  afterLabel = 'Después',
  className = '',
}) => {
  const [pct, setPct] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  const updateFromClientX = useCallback((clientX: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const raw = ((clientX - rect.left) / rect.width) * 100;
    setPct(Math.min(100, Math.max(0, raw)));
  }, []);

  const handlePointerDown = (e: React.PointerEvent) => {
    draggingRef.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    updateFromClientX(e.clientX);
  };
  const handlePointerMove = (e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    updateFromClientX(e.clientX);
  };
  const handlePointerUp = () => { draggingRef.current = false; };

  // Soporte de teclado sobre el handle (accesibilidad + desktop sin mouse drag)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') setPct(p => Math.max(0, p - 4));
    if (e.key === 'ArrowRight') setPct(p => Math.min(100, p + 4));
  };

  // Evita que el swipe horizontal del lightbox (cambiar de imagen) se
  // dispare mientras se arrastra el handle.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const stop = (e: TouchEvent) => { if (draggingRef.current) e.stopPropagation(); };
    el.addEventListener('touchmove', stop, { passive: true });
    return () => el.removeEventListener('touchmove', stop);
  }, []);

  return (
    <div
      ref={containerRef}
      className={`relative aspect-[3/4] rounded-2xl overflow-hidden select-none touch-none ${className}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      {/* Después — capa de fondo, se ve completa */}
      <img src={afterSrc} alt={afterLabel} className="absolute inset-0 w-full h-full object-cover pointer-events-none" draggable={false} />
      <span className="absolute top-2 right-2 bg-black/50 text-white text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full pointer-events-none">
        {afterLabel}
      </span>

      {/* Antes — capa recortada por el handle, tapa la parte derecha de "después" */}
      <div
        className="absolute inset-0 overflow-hidden pointer-events-none"
        style={{ clipPath: `inset(0 ${100 - pct}% 0 0)` }}
      >
        <img src={beforeSrc} alt={beforeLabel} className="absolute inset-0 w-full h-full object-cover" draggable={false} />
        <span className="absolute top-2 left-2 bg-black/50 text-white text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full">
          {beforeLabel}
        </span>
      </div>

      {/* Línea + handle arrastrable */}
      <div
        className="absolute top-0 bottom-0 w-[2px] bg-white/90 shadow-[0_0_8px_rgba(0,0,0,0.4)]"
        style={{ left: `${pct}%`, transform: 'translateX(-50%)' }}
      >
        <div
          role="slider"
          tabIndex={0}
          aria-label="Deslizar para comparar antes y después"
          aria-valuenow={Math.round(pct)}
          aria-valuemin={0}
          aria-valuemax={100}
          onKeyDown={handleKeyDown}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white shadow-lg flex items-center justify-center text-slate-700 cursor-ew-resize"
        >
          <MoveHorizontal size={16} />
        </div>
      </div>
    </div>
  );
};

export default BeforeAfterSlider;
