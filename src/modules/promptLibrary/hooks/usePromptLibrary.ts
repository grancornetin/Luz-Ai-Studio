/**
 * usePromptLibrary.ts
 * ─────────────────────────────────────────────────────────────
 * Central hook for the global Prompt Gallery (Pinterest-like).
 *
 * Features:
 *  - Real-time subscription to public prompts
 *  - Client-side search (Firestore doesn't do full-text)
 *  - Tag filter + sort
 *  - Like / unlike with optimistic UI
 *  - Save / unsave to personal collection
 *  - Board management
 *  - Comments
 *  - Delete (author + admin)
 *  - Publish (create or add variation)
 * ─────────────────────────────────────────────────────────────
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Prompt, PromptDNA, PromptBoard, PromptComment } from '../types/promptTypes';
import { promptService } from '../services/promptService';
import { useAuth } from '../../auth/AuthContext';

export type SortOption = 'recent' | 'likes' | 'variations' | 'personalized';

function computeRelevance(prompt: Prompt, tags: string[], categories: string[]): number {
  let score = 0;
  const matchedTags = prompt.tags.filter(t => tags.includes(t));
  score += matchedTags.length * 2;
  score += (prompt.likes / 10) + ((prompt.saves || 0) / 5);
  const daysSince = (Date.now() - new Date(prompt.createdAt).getTime()) / (1000 * 3600 * 24);
  score += Math.max(0, 5 - daysSince);
  return score;
}

export const usePromptLibrary = () => {
  const { user, profile, isAdmin, updateProfile } = useAuth();

  // ── Gallery state ───────────────────────────────────────
  const [prompts, setPrompts]         = useState<Prompt[]>([]);
  const [loading, setLoading]         = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTag, setActiveTag]     = useState<string | null>(null);
  // Inicializa desde preferencias del perfil
  const [sortBy, setSortByState]      = useState<SortOption>(
    (profile?.preferences?.feedSortBy as SortOption) || 'recent'
  );

  // Sincroniza sortBy con perfil cuando carga
  useEffect(() => {
    if (profile?.preferences?.feedSortBy) {
      setSortByState(profile.preferences.feedSortBy as SortOption);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.preferences?.feedSortBy]);

  const setSortBy = useCallback((opt: SortOption) => {
    setSortByState(opt);
    // Persiste en Firestore (excepto 'variations' que es local)
    if (opt !== 'variations' && profile) {
      updateProfile({ preferences: { ...profile.preferences, feedSortBy: opt === 'personalized' ? 'personalized' : opt as 'recent' | 'likes' } }).catch(() => {});
    }
  }, [profile, updateProfile]);

  // ── Saves & boards ──────────────────────────────────────
  const [savedIds, setSavedIds]   = useState<Set<string>>(new Set());
  const [boards, setBoards]       = useState<PromptBoard[]>([]);

  // ── Optimistic like tracking ────────────────────────────
  const pendingLikes = useRef<Set<string>>(new Set());

  // Subscribe to global prompts
  useEffect(() => {
    setLoading(true);
    const unsub = promptService.subscribeToPrompts(
      (data) => {
        setPrompts(data);
        setLoading(false);
      },
      { tag: activeTag || undefined, sortBy: (sortBy === 'variations' || sortBy === 'personalized') ? 'recent' : sortBy as 'recent' | 'likes' }
    );
    return () => unsub();
  }, [activeTag, sortBy]);

  // Subscribe to user's saved prompt IDs
  useEffect(() => {
    if (!user) { setSavedIds(new Set()); return; }
    const unsub = promptService.subscribeSavedPrompts(user.uid, setSavedIds);
    return () => unsub();
  }, [user]);

  // Subscribe to user's boards
  useEffect(() => {
    if (!user) { setBoards([]); return; }
    const unsub = promptService.subscribeBoards(user.uid, setBoards);
    return () => unsub();
  }, [user]);

  // ── Derived: filtered + client-sorted ──────────────────
  const filteredPrompts = useMemo(() => {
    const q = searchQuery.toLowerCase();
    const filtered = prompts.filter(p => {
      if (!q) return true;
      return (
        p.title.toLowerCase().includes(q) ||
        p.promptText.toLowerCase().includes(q) ||
        p.tags.some(t => t.toLowerCase().includes(q)) ||
        (p.authorName || '').toLowerCase().includes(q)
      );
    });

    if (sortBy === 'variations') {
      return [...filtered].sort((a, b) => {
        const ac = (a.generations?.length || 0) + 1;
        const bc = (b.generations?.length || 0) + 1;
        return bc - ac;
      });
    }

    if (sortBy === 'personalized') {
      const userTags       = profile?.interests?.tags       || [];
      const userCategories = profile?.interests?.categories || [];
      return [...filtered].sort((a, b) =>
        computeRelevance(b, userTags, userCategories) - computeRelevance(a, userTags, userCategories)
      );
    }

    return filtered; // Firestore already sorted by likes or createdAt
  }, [prompts, searchQuery, sortBy]);

  // ── All tags from visible prompts ───────────────────────
  const allTags = useMemo(() => {
    const tags = new Set<string>();
    prompts.forEach(p => p.tags.forEach(t => tags.add(t)));
    return Array.from(tags).sort();
  }, [prompts]);

  // ── Actions ─────────────────────────────────────────────

  /**
   * Toggle like with optimistic UI.
   */
  const likePrompt = useCallback(async (id: string) => {
    if (!user) return;
    if (pendingLikes.current.has(id)) return;

    pendingLikes.current.add(id);

    // Optimistic update
    setPrompts(prev => prev.map(p => {
      if (p.id !== id) return p;
      const liked = p.likedBy.includes(user.uid);
      return {
        ...p,
        likes: liked ? p.likes - 1 : p.likes + 1,
        likedBy: liked
          ? p.likedBy.filter(u => u !== user.uid)
          : [...p.likedBy, user.uid],
      };
    }));

    try {
      await promptService.toggleLike(id, user.uid);
    } catch (err) {
      console.error('[usePromptLibrary] likePrompt error:', err);
      // Rollback optimistic update on error
      setPrompts(prev => prev.map(p => {
        if (p.id !== id) return p;
        const liked = p.likedBy.includes(user.uid);
        return {
          ...p,
          likes: liked ? p.likes - 1 : p.likes + 1,
          likedBy: liked
            ? p.likedBy.filter(u => u !== user.uid)
            : [...p.likedBy, user.uid],
        };
      }));
    } finally {
      pendingLikes.current.delete(id);
    }
  }, [user]);

  /**
   * Toggle save (bookmark) with optimistic UI.
   */
  const toggleSave = useCallback(async (promptId: string, boardId?: string) => {
    if (!user) return;

    const alreadySaved = savedIds.has(promptId);

    // Optimistic
    setSavedIds(prev => {
      const next = new Set(prev);
      alreadySaved ? next.delete(promptId) : next.add(promptId);
      return next;
    });
    setPrompts(prev => prev.map(p =>
      p.id === promptId
        ? { ...p, saves: Math.max(0, p.saves + (alreadySaved ? -1 : 1)) }
        : p
    ));

    try {
      if (alreadySaved) {
        await promptService.removeFromCollection(user.uid, promptId);
      } else {
        await promptService.saveToCollection(user.uid, promptId, boardId);
      }
    } catch (err) {
      console.error('[usePromptLibrary] toggleSave error:', err);
      // Rollback
      setSavedIds(prev => {
        const next = new Set(prev);
        alreadySaved ? next.add(promptId) : next.delete(promptId);
        return next;
      });
    }
  }, [user, savedIds]);

  /**
   * Delete a prompt (author or admin only).
   */
  const deletePrompt = useCallback(async (id: string) => {
    if (!user) return;
    try {
      await promptService.deletePrompt(id, user.uid, isAdmin);
      setPrompts(prev => prev.filter(p => p.id !== id));
    } catch (err) {
      console.error('[usePromptLibrary] deletePrompt error:', err);
    }
  }, [user, isAdmin]);

  const editPrompt = useCallback(async (id: string, changes: { title?: string; tags?: string[] }) => {
    if (!user) return;
    await promptService.updatePrompt(id, user.uid, isAdmin, changes);
    setPrompts(prev => prev.map(p => p.id === id ? { ...p, ...changes } : p));
  }, [user, isAdmin]);

  /**
   * Publish a prompt to the global gallery.
   * Shows PublishPromptModal first to collect title + tags.
   */
  const publishPrompt = useCallback(async (
    imageUrl: string,
    promptText: string,
    promptDNA: PromptDNA,
    title: string,
    tags: string[],
    originPromptId?: string
  ): Promise<string | null> => {
    if (!user) return null;

    try {
      const id = await promptService.publishPrompt({
        imageUrl,
        promptText,
        promptDNA,
        title,
        tags,
        authorId: user.uid,
        authorName: profile?.username || profile?.displayName || user.displayName || 'Anonymous',
        authorPhotoURL: profile?.photoURL || user.photoURL || '',
        originPromptId,
      });
      return id;
    } catch (err) {
      console.error('[usePromptLibrary] publishPrompt error:', err);
      return null;
    }
  }, [user, profile]);

  /**
   * Report a prompt.
   */
  const reportPrompt = useCallback(async (promptId: string) => {
    if (!user) return;
    try {
      await promptService.reportPrompt(promptId, user.uid);
    } catch (err) {
      console.error('[usePromptLibrary] reportPrompt error:', err);
    }
  }, [user]);

  /**
   * Create a board.
   */
  const createBoard = useCallback(async (name: string, description?: string): Promise<string | null> => {
    if (!user) return null;
    try {
      return await promptService.createBoard(user.uid, name, description);
    } catch (err) {
      console.error('[usePromptLibrary] createBoard error:', err);
      return null;
    }
  }, [user]);

  /**
   * Add prompt to board.
   */
  const addToBoard = useCallback(async (boardId: string, promptId: string) => {
    if (!user) return;
    try {
      await promptService.addToBoard(user.uid, boardId, promptId);
    } catch (err) {
      console.error('[usePromptLibrary] addToBoard error:', err);
    }
  }, [user]);

  return {
    // Data
    prompts: filteredPrompts,
    allTags,
    loading,
    savedIds,
    boards,

    // Filters
    searchQuery,
    setSearchQuery,
    activeTag,
    setActiveTag,
    sortBy: sortBy,
    setSortBy,

    // Actions
    likePrompt,
    toggleSave,
    deletePrompt,
    editPrompt,
    publishPrompt,
    reportPrompt,
    createBoard,
    addToBoard,

    // Utils
    isLiked: (id: string) => user ? prompts.find(p => p.id === id)?.likedBy.includes(user.uid) ?? false : false,
    isSaved: (id: string) => savedIds.has(id),
  };
};

// ── Comments hook (used in PromptDetailModal) ──────────────

export const usePromptComments = (promptId: string | null) => {
  const { user, profile, isAdmin } = useAuth();
  const [comments, setComments] = useState<PromptComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    if (!promptId) { setComments([]); return; }
    setLoading(true);
    const unsub = promptService.subscribeComments(promptId, (data) => {
      setComments(data);
      setLoading(false);
    });
    return () => unsub();
  }, [promptId]);

  const addComment = useCallback(async (text: string) => {
    if (!user || !promptId || !text.trim()) return;
    setPosting(true);
    try {
      await promptService.addComment(
        promptId,
        user.uid,
        profile?.username || profile?.displayName || user.displayName || 'Anonymous',
        text.trim(),
        profile?.photoURL || user.photoURL || ''
      );
    } catch (err) {
      console.error('[usePromptComments] addComment error:', err);
    } finally {
      setPosting(false);
    }
  }, [user, profile, promptId]);

  const deleteComment = useCallback(async (commentId: string) => {
    if (!user || !promptId) return;
    try {
      await promptService.deleteComment(promptId, commentId, user.uid, isAdmin);
    } catch (err) {
      console.error('[usePromptComments] deleteComment error:', err);
    }
  }, [user, promptId, isAdmin]);

  return { comments, loading, posting, addComment, deleteComment };
};