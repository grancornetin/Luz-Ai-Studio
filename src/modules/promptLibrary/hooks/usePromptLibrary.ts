import { useState, useEffect, useCallback, useMemo } from 'react';
import { Prompt, PromptGeneration } from '../types/promptTypes';
import { promptService } from '../services/promptService';

export type SortOption = 'recent' | 'likes' | 'variations';

export const usePromptLibrary = () => {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>('recent');

  useEffect(() => {
    setLoading(true);
    const unsubscribe = promptService.subscribeToPrompts((data) => {
      setPrompts(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const filteredPrompts = useMemo(() => {
    const filtered = prompts.filter(p => {
      const matchesSearch =
        p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.promptText.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesTag = !activeTag || p.tags.includes(activeTag);
      return matchesSearch && matchesTag;
    });

    // ── SORT ──
    return [...filtered].sort((a, b) => {
      if (sortBy === 'likes') {
        return (b.likes || 0) - (a.likes || 0);
      }
      if (sortBy === 'variations') {
        const aCount = (a.generations?.length || 0) + 1;
        const bCount = (b.generations?.length || 0) + 1;
        return bCount - aCount;
      }
      // 'recent' — by createdAt desc
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [prompts, searchQuery, activeTag, sortBy]);

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    prompts.forEach(p => p.tags.forEach(t => tags.add(t)));
    return Array.from(tags);
  }, [prompts]);

  const likePrompt = useCallback(async (id: string) => {
    try {
      await promptService.likePrompt(id);
    } catch (err) {
      console.error('Error liking prompt:', err);
    }
  }, []);

  // ── DELETE (admin only) ──
  const deletePrompt = useCallback(async (id: string) => {
    try {
      await promptService.deletePrompt(id);
    } catch (err) {
      console.error('Error deleting prompt:', err);
    }
  }, []);

  const publishPrompt = useCallback(async (prompt: Prompt) => {
    try {
      const originId = prompt.originPromptId || prompt.id;
      const existing = prompts.find(p => (p.originPromptId || p.id) === originId);

      if (existing) {
        const newGeneration: PromptGeneration = {
          id: prompt.id,
          imageUrl: prompt.imageUrl,
          promptText: prompt.promptText,
          promptDNA: prompt.promptDNA,
          authorId: prompt.authorId,
          createdAt: prompt.createdAt
        };

        const updatedPrompt: Prompt = {
          ...existing,
          generations: [newGeneration, ...(existing.generations || [])]
        };

        await promptService.savePrompt(updatedPrompt);
      } else {
        await promptService.savePrompt(prompt);
      }
    } catch (err) {
      console.error('Error publishing prompt:', err);
    }
  }, [prompts]);

  return {
    prompts: filteredPrompts,
    allTags,
    loading,
    searchQuery,
    setSearchQuery,
    activeTag,
    setActiveTag,
    sortBy,
    setSortBy,
    likePrompt,
    deletePrompt,
    publishPrompt
  };
};