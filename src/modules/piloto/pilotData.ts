// Lectura de los datos que necesita la pantalla "Hoy".
// Catálogo: users/{uid}/catalog/{id} (regla ya existente en firestore.rules, W8).
// Plan: se reutiliza contentPlanService (Planner v3) sin cambios.
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { brandProfileService } from '../../services/brandProfileService';
import { contentPlanService } from '../planner/v3/contentPlanService';
import type { ContentPlan } from '../planner/v3/plannerV3Types';
import type { BrandHint } from './contentFactory';
import type { CatalogItem, PilotPlanTask } from './types';

export async function loadCatalog(uid: string): Promise<CatalogItem[]> {
  const snap = await getDocs(collection(db, 'users', uid, 'catalog'));
  return snap.docs
    .map(d => ({ ...(d.data() as Omit<CatalogItem, 'id'>), id: d.id }))
    .filter(i => Array.isArray(i.originalPhotos) && i.originalPhotos.length > 0)
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
}

export interface PilotBrand extends BrandHint {
  id: string;
}

export async function loadBrand(uid: string): Promise<PilotBrand | null> {
  const brands = await brandProfileService.getBrandProfiles(uid);
  const b = brands.find(x => x.isDefault) ?? brands[0];
  if (!b) return null;
  return { id: b.id, name: b.brandName, toneKeywords: b.voice?.toneKeywords ?? [] };
}

export async function loadActivePlan(): Promise<(Omit<ContentPlan, 'tasks'> & { tasks: PilotPlanTask[] }) | null> {
  const plan = await contentPlanService.getActivePlan();
  return plan as (Omit<ContentPlan, 'tasks'> & { tasks: PilotPlanTask[] }) | null;
}

export { contentPlanService };
