import { useState, useEffect, useCallback } from 'react';
import { brandProfileService } from '../services/brandProfileService';
import type { BrandProfile } from '../modules/brandProfiles/types';

interface UseBrandProfilesReturn {
  profiles: BrandProfile[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  deleteProfile: (brandId: string) => Promise<void>;
  setDefault: (brandId: string) => Promise<void>;
}

export function useBrandProfiles(userId: string | undefined): UseBrandProfilesReturn {
  const [profiles, setProfiles] = useState<BrandProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const data = await brandProfileService.getBrandProfiles(userId);
      setProfiles(data);
    } catch (err: any) {
      setError(err.message || 'Error al cargar marcas');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const deleteProfile = useCallback(async (brandId: string) => {
    if (!userId) return;
    await brandProfileService.deleteBrandProfile(userId, brandId);
    setProfiles(prev => prev.filter(p => p.id !== brandId));
  }, [userId]);

  const setDefault = useCallback(async (brandId: string) => {
    if (!userId) return;
    await brandProfileService.setDefaultBrandProfile(userId, brandId);
    setProfiles(prev => prev.map(p => ({ ...p, isDefault: p.id === brandId })));
  }, [userId]);

  return { profiles, loading, error, reload: load, deleteProfile, setDefault };
}
