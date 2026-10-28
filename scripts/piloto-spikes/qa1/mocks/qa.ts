// @ts-nocheck
export function qaState(): string {
  try {
    const u = new URLSearchParams(location.search).get('state');
    if (u) sessionStorage.setItem('qa-state', u);
    return sessionStorage.getItem('qa-state') || 'ready';
  } catch { return 'ready'; }
}
const PAL = [['#E9DCD0', '#B79A86'], ['#D9E2EA', '#8EA3B5'], ['#EADBE0', '#B58A97'], ['#E2E6D6', '#9AA38A'], ['#E8E0F0', '#9C8FB5']];
/** Imagen de ejemplo 4:5 (sin fotos reales). */
export function ph(i: number): string {
  const [a, b] = PAL[i % PAL.length];
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='800' height='1000' viewBox='0 0 800 1000'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='${a}'/><stop offset='1' stop-color='${b}'/></linearGradient></defs><rect width='800' height='1000' fill='url(#g)'/><circle cx='400' cy='520' r='150' fill='none' stroke='#fff' stroke-width='26' opacity='.85'/><circle cx='400' cy='370' r='22' fill='#fff' opacity='.9'/></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
export const wait = (ms: number) => new Promise(r => setTimeout(r, ms));
