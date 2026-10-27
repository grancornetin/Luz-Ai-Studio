// @ts-nocheck
import { ph, qaState, wait } from './qa';

const iso = (add: number) => {
  const d = new Date(); d.setDate(d.getDate() + add);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const DAY = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const label = (add: number) => { const d = new Date(); d.setDate(d.getDate() + add); return `${DAY[d.getDay()]} ${d.getDate()}`; };

const asset = (taskId: string, i: number, status: any = 'ready', score = 92) => ({
  id: `${taskId}_v0_${i}`, taskId, recipeId: 'catalogo_limpio', catalogItemId: 'c1', kind: 'image', url: ph(i + taskId.length),
  costUSD: 0.08, fidelityScore: status === 'ready' ? score : undefined, status, createdAt: 1,
});

const LONG = 'Te presento Aros Gota Verde: una pieza liviana, hecha a mano, para que tus días se vean más bonitos. '.repeat(4) + 'Si quieres saber el valor, escríbeme por mensaje directo.';

function task(id: string, add: number, o: any = {}) {
  return {
    id, date: iso(add), dayLabel: label(add), status: 'pending', title: 'Aros Gota Verde, tal como son', contentType: 'Foto de la pieza',
    format: 'Foto', platform: 'Instagram Feed', suggestedTime: '19:30', funnelRole: 'atraer', toolModule: 'none', toolReason: '', prompt: '',
    caption: 'Te presento Aros Gota Verde.\n\nHechos a mano, livianos y con un verde que cambia con la luz.\n\nGuárdalo para acordarte cuando busques un regalo.',
    hashtags: '#joyeriachilena #arosartesanales #emprendimientochileno #regalosoriginales',
    whatToUpload: [], howToConfigure: [], whyThisContent: 'Mostrar la pieza tal como es ayuda a que confíen desde el primer vistazo.',
    expectedResult: '', howToMeasure: '', engagementHook: 'Envíaselo a quien siempre dice "no sé qué regalar".',
    recipeId: 'catalogo_limpio', catalogItemIds: ['c1'], generationStatus: 'idle', assets: [], ...o,
  };
}

export interface PilotBrand { id: string; name?: string; toneKeywords?: string[] }

export async function loadCatalog(_uid: string): Promise<any[]> {
  const s = qaState();
  if (s === 'error') throw new Error('x');
  if (s === 'empty-catalog') return [];
  return [1, 2, 3].map(n => ({ id: `c${n}`, name: `Aros ${n}`, category: 'aros', material: 'resina', color: 'verde', role: 'normal',
    originalPhotos: [{ url: ph(n), path: 'p' }, { url: ph(n + 1), path: 'p2' }], aiTags: [], createdAt: n, updatedAt: n }));
}
export async function loadBrand(_uid: string): Promise<PilotBrand | null> {
  const s = qaState();
  if (s === 'error') throw new Error('x');
  if (s === 'loading') await wait(1e9);
  return s === 'empty-brand' ? null : { id: 'b1', name: 'Mar de Resina', toneKeywords: ['cercana', 'cálida'] };
}
export async function loadActivePlan(): Promise<any> {
  const s = qaState();
  if (s === 'empty-plan') return null;
  const mk = (todayT: any, t2: any, t3: any) => ({ id: 'plan1', brandId: 'b1', brandName: 'Mar de Resina', status: 'active', weekNumber: 1, aiDisclosureReminder: 'x', tasks: [todayT, t2, t3] });
  if (s === 'done') return mk(task('t1', 0, { status: 'done' }), task('t2', 1, { status: 'done' }), task('t3', 2, { status: 'done' }));
  const readyAssets = (id: string) => [asset(id, 0), asset(id, 1, 'ready', 78), asset(id, 2, 'fallback_original')];
  if (s === 'generating' || s === 'budget') return mk(task('t1', 0), task('t2', 1), task('t3', 2));
  if (s === 'long') return mk(task('t1', 0, { caption: LONG, title: 'Un título muy largo '.repeat(6), hashtags: '#' + 'palabramuylarga'.repeat(8) + ' #x', generationStatus: 'ready', assets: readyAssets('t1') }), task('t2', 1), task('t3', 2));
  if (s === 'failed') return mk(task('t1', 0, { generationStatus: 'failed' }), task('t2', 1), task('t3', 2));
  return mk(
    task('t1', 0, { generationStatus: 'ready', assets: readyAssets('t1') }),
    task('t2', 1, { title: 'Detalle de cerca', generationStatus: 'ready', assets: [asset('t2', 0), asset('t2', 1)] }),
    task('t3', 2, { title: 'Foto desde arriba para regalo', generationStatus: 'generating' }),
  );
}
export const contentPlanService = {
  async updateTaskStatus() {},
  async listPlans() { return []; },
  async getHistoryForBrand() { return []; },
  async createPlan() { return 'plan1'; },
  async getActivePlan() { return loadActivePlan(); },
};
