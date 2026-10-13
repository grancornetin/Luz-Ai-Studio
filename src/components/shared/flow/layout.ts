// src/components/shared/flow/layout.ts
// Modo de distribución de los flujos según el ancho (ver docs/flow-layouts.md):
//   compact  < 768   celular (marco inmersivo aprobado)
//   regular  768–1023 tableta vertical: una columna ancha, dos donde ayuda
//   wide     ≥ 1024  dos paneles: lienzo a la izquierda, paso a la derecha
// Lo propio del computador (hover, descargar en vez de compartir, arrastrar
// fotos) depende del puntero, no del ancho: usePrecisePointer().
import { createContext, useContext, useSyncExternalStore } from 'react';

export type FlowLayout = 'compact' | 'regular' | 'wide';

const Q_REGULAR = '(min-width: 768px)';
const Q_WIDE = '(min-width: 1024px)';
const Q_FINE = '(hover: hover) and (pointer: fine)';

const mq = (q: string) => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(q) : null);

function subscribeTo(queries: string[]) {
  return (cb: () => void) => {
    const lists = queries.map(mq).filter((m): m is MediaQueryList => !!m);
    lists.forEach((m) => m.addEventListener('change', cb));
    return () => lists.forEach((m) => m.removeEventListener('change', cb));
  };
}

const subscribeLayout = subscribeTo([Q_REGULAR, Q_WIDE]);
const readLayout = (): FlowLayout => (mq(Q_WIDE)?.matches ? 'wide' : mq(Q_REGULAR)?.matches ? 'regular' : 'compact');

export function useFlowLayout(): FlowLayout {
  return useSyncExternalStore(subscribeLayout, readLayout, () => 'compact');
}

const subscribeFine = subscribeTo([Q_FINE]);
const readFine = () => !!mq(Q_FINE)?.matches;

/** true con mouse o trackpad (no en pantallas táctiles). */
export function usePrecisePointer(): boolean {
  return useSyncExternalStore(subscribeFine, readFine, () => false);
}

/** Lectura puntual, fuera de React (p. ej. al decidir compartir o descargar). */
export const hasPrecisePointer = () => readFine();

// Dónde se dibujan las acciones del paso: barra fija (celular), en línea tras
// el contenido (tableta/computador) o en la barra superior (galerías).
export type FlowActionsPlacement = 'bar' | 'inline' | 'toolbar';
export const FlowActionsContext = createContext<FlowActionsPlacement>('bar');
export const useFlowActionsPlacement = () => useContext(FlowActionsContext);
