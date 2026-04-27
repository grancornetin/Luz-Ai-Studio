// src/hooks/useGlobalSearch.ts
import Fuse from 'fuse.js';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '../modules/auth/AuthContext';
import { generationHistoryService } from '../services/generationHistoryService';
import { promptLibraryService } from '../modules/promptLibrary/services/promptLibraryService';
import { getProjects } from '../services/projectService';
import { dbService } from '../services/dbService';
import { outfitStorage } from '../modules/outfitExtractor/outfitStorage';

export interface SearchableItem {
  id: string;
  type: 'project' | 'image' | 'prompt' | 'avatar' | 'outfit';
  title: string;
  subtitle?: string;
  url: string;
  imageUrl?: string;
  metadata?: Record<string, any>;
}

import type { IFuseOptions } from 'fuse.js';

const FUSE_OPTIONS: IFuseOptions<SearchableItem> = {
  keys: [
    { name: 'title', weight: 0.6 },
    { name: 'subtitle', weight: 0.2 },
    { name: 'metadata.prompt', weight: 0.1 },
    { name: 'metadata.module', weight: 0.1 },
  ],
  threshold: 0.35,
  includeScore: true,
  minMatchCharLength: 2,
};

export const useGlobalSearch = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<SearchableItem[]>([]);
  const fuseRef = useRef<Fuse<SearchableItem> | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const loadData = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    const newItems: SearchableItem[] = [];

    // Proyectos (Firestore)
    try {
      const projects = await getProjects();
      projects.forEach(p => newItems.push({
        id: p.id,
        type: 'project',
        title: p.name,
        subtitle: `${p.items?.length ?? 0} imágenes`,
        url: `/projects/${p.id}`,
      }));
    } catch { /* si falla, omitir */ }

    // Historial de imágenes generadas
    try {
      const history = await generationHistoryService.getAll(200);
      history.forEach(h => newItems.push({
        id: h.id,
        type: 'image',
        title: h.moduleLabel || 'Imagen generada',
        subtitle: h.promptText ? h.promptText.slice(0, 60) : undefined,
        url: '/historial',
        imageUrl: h.imageUrl,
        metadata: { prompt: h.promptText, module: h.module },
      }));
    } catch { /* si falla, omitir */ }

    // Prompts guardados (localStorage)
    try {
      const prompts = promptLibraryService.getAll();
      prompts.forEach(p => newItems.push({
        id: p.id,
        type: 'prompt',
        title: p.name || 'Prompt sin nombre',
        subtitle: p.rawPrompt?.slice(0, 60),
        url: `/prompt-gallery`,
        metadata: { prompt: p.rawPrompt },
      }));
    } catch { /* si falla, omitir */ }

    // Modelos/Avatares (dbService)
    try {
      const avatars = await dbService.getAvatars();
      (avatars || []).forEach((a: any) => newItems.push({
        id: a.id,
        type: 'avatar',
        title: a.name || 'Modelo sin nombre',
        subtitle: a.metadata?.gender || 'Modelo digital',
        url: '/modelos',
        imageUrl: a.baseImages?.[3] || a.baseImages?.[0],
      }));
    } catch { /* si falla, omitir */ }

    // Outfits (IndexedDB local)
    try {
      const kits = await outfitStorage.listKits();
      kits.forEach((o: any) => newItems.push({
        id: o.id,
        type: 'outfit',
        title: o.name || `Outfit ${String(o.id).slice(-4)}`,
        subtitle: o.items?.map((i: any) => i.category).filter(Boolean).join(', ') || 'Prendas',
        url: '/outfit-extractor',
        imageUrl: o.items?.[0]?.imageUrl,
      }));
    } catch { /* si falla, omitir */ }

    setItems(newItems);
    fuseRef.current = new Fuse(newItems, FUSE_OPTIONS);
    setIsLoading(false);
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const search = useCallback((query: string): SearchableItem[] => {
    if (!query.trim() || !fuseRef.current) return [];
    const results = fuseRef.current.search(query);
    return results.slice(0, 12).map(r => r.item);
  }, []);

  return { search, items, isLoading, reload: loadData };
};
