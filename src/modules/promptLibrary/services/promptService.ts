/**
 * promptService.ts
 * ─────────────────────────────────────────────────────────────
 * Firestore-backed service for the global Prompt Gallery.
 * Replaces the old localStorage implementation.
 *
 * Collections:
 *   globalPrompts/{promptId}
 *   globalPrompts/{promptId}/comments/{commentId}
 *   users/{uid}/savedPrompts/{promptId}
 *   users/{uid}/boards/{boardId}
 *
 * ─────────────────────────────────────────────────────────────
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  deleteDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  increment,
  arrayUnion,
  arrayRemove,
  serverTimestamp,
  Timestamp,
  QueryConstraint,
  writeBatch,
  startAfter,
  DocumentSnapshot,
} from 'firebase/firestore';
import { db } from '../../../firebase';
import {
  Prompt,
  PromptDNA,
  PromptGeneration,
  PromptComment,
  PromptBoard,
  SavedPrompt,
} from '../types/promptTypes';

// ── Constants ──────────────────────────────────────────────
const GLOBAL_PROMPTS = 'globalPrompts';
const PAGE_SIZE = 24;

// ── Normalizers ────────────────────────────────────────────

const emptyDNA = (): PromptDNA => ({
  persons: [], personLayers: [], products: [],
  styles: [], lighting: [], background: [],
  composition: [], details: [],
});

const normalizeDNA = (dna: any): PromptDNA => {
  if (!dna) return emptyDNA();
  return {
    persons:      Array.isArray(dna.persons)      ? dna.persons      : Array.isArray(dna.person)  ? dna.person  : [],
    personLayers: Array.isArray(dna.personLayers) ? dna.personLayers : [],
    products:     Array.isArray(dna.products)     ? dna.products     : Array.isArray(dna.product) ? dna.product : [],
    styles:       Array.isArray(dna.styles)       ? dna.styles       : Array.isArray(dna.style)   ? dna.style   : [],
    lighting:     Array.isArray(dna.lighting)     ? dna.lighting     : [],
    background:   Array.isArray(dna.background)   ? dna.background   : [],
    composition:  Array.isArray(dna.composition)  ? dna.composition  : [],
    details:      Array.isArray(dna.details)      ? dna.details      : [],
  };
};

const normalizeGeneration = (g: any): PromptGeneration => ({
  id:         g?.id         || Date.now().toString(),
  imageUrl:   g?.imageUrl   || '',
  promptText: g?.promptText || '',
  promptDNA:  normalizeDNA(g?.promptDNA || g?.dna),
  authorId:   g?.authorId   || 'anonymous',
  createdAt:  g?.createdAt instanceof Timestamp
    ? g.createdAt.toDate().toISOString()
    : (g?.createdAt || new Date().toISOString()),
});

export const normalizePrompt = (data: any, id?: string): Prompt => ({
  id:             id || data?.id || '',
  title:          data?.title         || 'Untitled Prompt',
  promptText:     data?.promptText    || '',
  promptDNA:      normalizeDNA(data?.promptDNA),
  imageUrl:       data?.imageUrl      || '',
  authorId:       data?.authorId      || 'anonymous',
  authorName:     data?.authorName    || 'Anonymous',
  authorPhotoURL: data?.authorPhotoURL || '',
  tags:           Array.isArray(data?.tags)       ? data.tags       : [],
  likes:          typeof data?.likes === 'number' ? data.likes      : 0,
  likedBy:        Array.isArray(data?.likedBy)    ? data.likedBy    : [],
  saves:          typeof data?.saves === 'number' ? data.saves      : 0,
  commentsCount:  typeof data?.commentsCount === 'number' ? data.commentsCount : 0,
  createdAt:      data?.createdAt instanceof Timestamp
    ? data.createdAt.toDate().toISOString()
    : (data?.createdAt || new Date().toISOString()),
  // 🔥 Solo incluir originPromptId si tiene valor — Firestore rechaza undefined
  ...(data?.originPromptId ? { originPromptId: data.originPromptId } : {}),
  generations:    Array.isArray(data?.generations) ? data.generations.map(normalizeGeneration) : [],
  isPublic:       data?.isPublic !== false, // default true
  isPrivate:      data?.isPrivate || false,
  reportedBy:     Array.isArray(data?.reportedBy) ? data.reportedBy : [],
  isFlagged:      data?.isFlagged || false,
});

// ── Public Gallery ──────────────────────────────────────────

export const promptService = {

  /**
   * Subscribe to public prompts (real-time).
   * Returns unsubscribe function.
   */
  subscribeToPrompts(
    callback: (prompts: Prompt[]) => void,
    opts?: { tag?: string | null; sortBy?: 'recent' | 'likes' | 'variations' }
  ): () => void {
    const constraints: QueryConstraint[] = [
      where('isPublic', '==', true),
      where('isFlagged', '!=', true),
    ];

    if (opts?.tag) {
      constraints.push(where('tags', 'array-contains', opts.tag));
    }

    // Firestore inequality filter on isFlagged requires ordering by that field first
    const sortField = opts?.sortBy === 'likes' ? 'likes' : 'createdAt';
    constraints.push(orderBy('isFlagged'));
    constraints.push(orderBy(sortField, 'desc'));
    constraints.push(limit(PAGE_SIZE));

    const q = query(collection(db, GLOBAL_PROMPTS), ...constraints);

    return onSnapshot(q, (snap) => {
      const prompts = snap.docs.map(d => normalizePrompt(d.data(), d.id));
      callback(prompts);
    }, (err) => {
      console.error('[promptService] subscribeToPrompts error:', err);
      callback([]);
    });
  },

  /**
   * Fetch next page (pagination cursor).
   */
  async getNextPage(
    lastDoc: DocumentSnapshot,
    opts?: { tag?: string | null; sortBy?: 'recent' | 'likes' }
  ): Promise<{ prompts: Prompt[]; lastDoc: DocumentSnapshot | null }> {
    const constraints: QueryConstraint[] = [
      where('isPublic', '==', true),
      where('isFlagged', '!=', true),
      orderBy('isFlagged'),
      orderBy(opts?.sortBy === 'likes' ? 'likes' : 'createdAt', 'desc'),
      startAfter(lastDoc),
      limit(PAGE_SIZE),
    ];

    if (opts?.tag) constraints.push(where('tags', 'array-contains', opts.tag));

    const snap = await getDocs(query(collection(db, GLOBAL_PROMPTS), ...constraints));
    const prompts = snap.docs.map(d => normalizePrompt(d.data(), d.id));
    const newLastDoc = snap.docs[snap.docs.length - 1] ?? null;
    return { prompts, lastDoc: newLastDoc };
  },

  /**
   * Get a single prompt by ID.
   */
  async getPrompt(id: string): Promise<Prompt | null> {
    const snap = await getDoc(doc(db, GLOBAL_PROMPTS, id));
    if (!snap.exists()) return null;
    return normalizePrompt(snap.data(), snap.id);
  },

  /**
   * Save (create or update) a prompt in the global gallery.
   * Assigns authorId, isPublic, createdAt if new.
   */
  async savePrompt(prompt: Partial<Prompt> & { authorId: string; authorName?: string }): Promise<string> {
    const normalized = normalizePrompt(prompt, prompt.id);

    if (normalized.id) {
      // Update existing
      const ref = doc(db, GLOBAL_PROMPTS, normalized.id);
      await setDoc(ref, {
        ...normalized,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      return normalized.id;
    } else {
      // Create new
      const ref = await addDoc(collection(db, GLOBAL_PROMPTS), {
        ...normalized,
        id: '',          // will be patched below
        isPublic: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      // Patch id field
      await updateDoc(ref, { id: ref.id });
      return ref.id;
    }
  },

  // src/modules/promptLibrary/services/promptService.ts
// ... (todo el inicio igual hasta la línea donde está publishPrompt)

  /**
   * Publish a prompt to the global gallery.
   * If there's an existing prompt with the same originPromptId,
   * adds this as a new generation variant.
   */
  async publishPrompt(
    payload: {
      imageUrl: string;
      promptText: string;
      promptDNA: PromptDNA;
      title: string;
      tags: string[];
      authorId: string;
      authorName: string;
      authorPhotoURL?: string;
      originPromptId?: string;
    }
  ): Promise<string> {
    const {
      imageUrl, promptText, promptDNA,
      title, tags, authorId, authorName,
      authorPhotoURL, originPromptId,
    } = payload;

    // Check if origin prompt already exists → add as variation
    if (originPromptId) {
      const originRef = doc(db, GLOBAL_PROMPTS, originPromptId);
      const originSnap = await getDoc(originRef);

      if (originSnap.exists()) {
        const newGeneration: PromptGeneration = {
          id: Date.now().toString(),
          imageUrl,
          promptText,
          promptDNA,
          authorId,
          createdAt: new Date().toISOString(),
        };
        await updateDoc(originRef, {
          generations: arrayUnion(newGeneration),
          updatedAt: serverTimestamp(),
        });
        return originPromptId;
      }
    }

    // Create new prompt
    const newPrompt: Omit<Prompt, 'id'> = {
      title,
      promptText,
      promptDNA,
      imageUrl,
      authorId,
      authorName,
      authorPhotoURL: authorPhotoURL || '',
      tags,
      likes: 0,
      likedBy: [],
      saves: 0,
      commentsCount: 0,
      createdAt: new Date().toISOString(),
      // 🔥 CORRECCIÓN: Firestore no acepta undefined — usar null o excluir el campo
      ...(originPromptId ? { originPromptId } : {}),
      generations: [],
      isPublic: true,
      isPrivate: false,
      reportedBy: [],
      isFlagged: false,
    };

    const ref = await addDoc(collection(db, GLOBAL_PROMPTS), {
      ...newPrompt,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await updateDoc(ref, { id: ref.id });
    return ref.id;
  },

// ... el resto del archivo igual
  /**
   * Delete a prompt. Only author or admin can call this.
   */
  async deletePrompt(id: string, requestingUid: string, isAdmin: boolean): Promise<void> {
    const ref = doc(db, GLOBAL_PROMPTS, id);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;

    const data = snap.data();
    if (!isAdmin && data.authorId !== requestingUid) {
      throw new Error('No permission to delete this prompt');
    }

    await deleteDoc(ref);
  },

  /**
   * Toggle like on a prompt. Atomically updates likes counter and likedBy array.
   * Returns true if liked, false if unliked.
   */
  async toggleLike(promptId: string, uid: string): Promise<boolean> {
    const ref = doc(db, GLOBAL_PROMPTS, promptId);
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error('Prompt not found');

    const data = snap.data();
    const likedBy: string[] = data.likedBy || [];
    const alreadyLiked = likedBy.includes(uid);

    await updateDoc(ref, {
      likes: increment(alreadyLiked ? -1 : 1),
      likedBy: alreadyLiked ? arrayRemove(uid) : arrayUnion(uid),
    });

    return !alreadyLiked;
  },

  /**
   * @deprecated Use toggleLike instead. Kept for backward compat.
   */
  async likePrompt(id: string, uid?: string): Promise<void> {
    if (uid) {
      await this.toggleLike(id, uid);
    } else {
      // Legacy: just increment
      await updateDoc(doc(db, GLOBAL_PROMPTS, id), { likes: increment(1) });
    }
  },

  // ── User-specific queries ─────────────────────────────────

  /**
   * Get all prompts created by a specific user.
   */
  async getUserPrompts(uid: string): Promise<Prompt[]> {
    const q = query(
      collection(db, GLOBAL_PROMPTS),
      where('authorId', '==', uid),
      orderBy('createdAt', 'desc'),
      limit(100)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => normalizePrompt(d.data(), d.id));
  },

  // ── Saved / Bookmarks ─────────────────────────────────────

  /**
   * Subscribe to user's saved prompt IDs.
   */
  subscribeSavedPrompts(uid: string, callback: (ids: Set<string>) => void): () => void {
    const ref = collection(db, `users/${uid}/savedPrompts`);
    return onSnapshot(ref, snap => {
      const ids = new Set(snap.docs.map(d => d.id));
      callback(ids);
    });
  },

  /**
   * Save (bookmark) a prompt to user's personal collection.
   * Optionally assign to a board.
   */
  async saveToCollection(
    uid: string,
    promptId: string,
    boardId?: string
  ): Promise<void> {
    const saved: SavedPrompt = {
      promptId,
      boardId,
      savedAt: new Date().toISOString(),
    };
    await setDoc(doc(db, `users/${uid}/savedPrompts`, promptId), saved);
    // Increment global save counter
    await updateDoc(doc(db, GLOBAL_PROMPTS, promptId), { saves: increment(1) });
  },

  /**
   * Remove a prompt from user's saved collection.
   */
  async removeFromCollection(uid: string, promptId: string): Promise<void> {
    await deleteDoc(doc(db, `users/${uid}/savedPrompts`, promptId));
    await updateDoc(doc(db, GLOBAL_PROMPTS, promptId), { saves: increment(-1) });
  },

  /**
   * Get full prompt objects for user's saved collection.
   */
  async getSavedPrompts(uid: string): Promise<Prompt[]> {
    const savedSnap = await getDocs(collection(db, `users/${uid}/savedPrompts`));
    if (savedSnap.empty) return [];

    const ids = savedSnap.docs.map(d => d.id);
    // Fetch in batches of 10 (Firestore 'in' limit)
    const batches: Prompt[][] = [];
    for (let i = 0; i < ids.length; i += 10) {
      const batch = ids.slice(i, i + 10);
      const q = query(collection(db, GLOBAL_PROMPTS), where('__name__', 'in', batch));
      const snap = await getDocs(q);
      batches.push(snap.docs.map(d => normalizePrompt(d.data(), d.id)));
    }
    return batches.flat();
  },

  // ── Boards ────────────────────────────────────────────────

  /**
   * Subscribe to user's boards.
   */
  subscribeBoards(uid: string, callback: (boards: PromptBoard[]) => void): () => void {
    const ref = collection(db, `users/${uid}/boards`);
    const q = query(ref, orderBy('createdAt', 'desc'));
    return onSnapshot(q, snap => {
      const boards: PromptBoard[] = snap.docs.map(d => ({
        id: d.id,
        ...(d.data() as Omit<PromptBoard, 'id'>),
      }));
      callback(boards);
    });
  },

  /**
   * Create a new board.
   */
  async createBoard(uid: string, name: string, description?: string, isPublic = false): Promise<string> {
    const ref = await addDoc(collection(db, `users/${uid}/boards`), {
      ownerId: uid,
      name,
      description: description || '',
      coverImageUrl: '',
      promptIds: [],
      isPublic,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await updateDoc(ref, { id: ref.id });
    return ref.id;
  },

  /**
   * Add a prompt to a board.
   */
  async addToBoard(uid: string, boardId: string, promptId: string): Promise<void> {
    const ref = doc(db, `users/${uid}/boards`, boardId);
    await updateDoc(ref, {
      promptIds: arrayUnion(promptId),
      updatedAt: serverTimestamp(),
    });
    // Also mark it saved
    await this.saveToCollection(uid, promptId, boardId);
  },

  /**
   * Delete a board.
   */
  async deleteBoard(uid: string, boardId: string): Promise<void> {
    await deleteDoc(doc(db, `users/${uid}/boards`, boardId));
  },

  // ── Comments ──────────────────────────────────────────────

  /**
   * Subscribe to comments on a prompt.
   */
  subscribeComments(
    promptId: string,
    callback: (comments: PromptComment[]) => void
  ): () => void {
    const ref = collection(db, `${GLOBAL_PROMPTS}/${promptId}/comments`);
    const q = query(ref, orderBy('createdAt', 'asc'));
    return onSnapshot(q, snap => {
      const comments: PromptComment[] = snap.docs.map(d => ({
        id: d.id,
        ...(d.data() as Omit<PromptComment, 'id'>),
      }));
      callback(comments);
    });
  },

  /**
   * Post a comment on a prompt.
   */
  async addComment(
    promptId: string,
    uid: string,
    authorName: string,
    text: string,
    authorPhotoURL?: string
  ): Promise<void> {
    const comment: Omit<PromptComment, 'id'> = {
      promptId,
      authorId: uid,
      authorName,
      authorPhotoURL: authorPhotoURL || '',
      text,
      createdAt: new Date().toISOString(),
    };
    const ref = await addDoc(
      collection(db, `${GLOBAL_PROMPTS}/${promptId}/comments`),
      { ...comment, createdAt: serverTimestamp() }
    );
    // Increment comment count
    await updateDoc(doc(db, GLOBAL_PROMPTS, promptId), {
      commentsCount: increment(1),
    });
  },

  /**
   * Delete a comment. Only comment author or admin.
   */
  async deleteComment(
    promptId: string,
    commentId: string,
    requestingUid: string,
    isAdmin: boolean
  ): Promise<void> {
    const ref = doc(db, `${GLOBAL_PROMPTS}/${promptId}/comments`, commentId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;

    if (!isAdmin && snap.data().authorId !== requestingUid) {
      throw new Error('No permission to delete this comment');
    }

    await deleteDoc(ref);
    await updateDoc(doc(db, GLOBAL_PROMPTS, promptId), {
      commentsCount: increment(-1),
    });
  },

  // ── Reports / Moderation ─────────────────────────────────

  /**
   * Report a prompt. Adds uid to reportedBy array.
   * Auto-flags if 5+ reports.
   */
  async reportPrompt(promptId: string, uid: string): Promise<void> {
    const ref = doc(db, GLOBAL_PROMPTS, promptId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;

    const current = snap.data().reportedBy || [];
    if (current.includes(uid)) return; // already reported

    const newReported = [...current, uid];
    await updateDoc(ref, {
      reportedBy: arrayUnion(uid),
      isFlagged: newReported.length >= 5,
    });
  },

  /**
   * Admin: unflag a prompt.
   */
  async unflagPrompt(promptId: string): Promise<void> {
    await updateDoc(doc(db, GLOBAL_PROMPTS, promptId), {
      isFlagged: false,
      reportedBy: [],
    });
  },

  // ── Local storage migration ───────────────────────────────

  /**
   * Migrate existing localStorage prompts to Firestore.
   * Call once after user logs in for the first time after migration.
   */
  async migrateFromLocalStorage(uid: string, authorName: string): Promise<number> {
    const raw = localStorage.getItem('luz_prompts');
    if (!raw) return 0;

    let local: any[];
    try { local = JSON.parse(raw); } catch { return 0; }
    if (!Array.isArray(local) || local.length === 0) return 0;

    const batch = writeBatch(db);
    let count = 0;

    for (const p of local.slice(0, 50)) {
      const ref = doc(collection(db, GLOBAL_PROMPTS));
      const normalized = normalizePrompt({ ...p, authorId: uid, authorName, isPublic: true }, ref.id);
      batch.set(ref, {
        ...normalized,
        id: ref.id,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      count++;
    }

    await batch.commit();
    localStorage.removeItem('luz_prompts');
    return count;
  },
};