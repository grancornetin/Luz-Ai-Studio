/**
 * src/utils/migratePrompts.ts
 * ─────────────────────────────────────────────────────────────
 * Migración one-time: localStorage → Firestore globalPrompts.
 * UBICACIÓN: src/utils/migratePrompts.ts
 * ─────────────────────────────────────────────────────────────
 */

import { doc, getDoc, setDoc, collection, addDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';          // src/firebase.ts  ← ruta correcta desde src/utils/

/**
 * Ejecuta la migración para un usuario.
 * Seguro llamarlo varias veces — usa un flag en Firestore.
 */
export async function runMigration(uid: string, displayName: string): Promise<void> {
  try {
    // 1. Verificar si ya se migró
    const flagRef  = doc(db, `users/${uid}/meta/migration`);
    const flagSnap = await getDoc(flagRef);

    if (flagSnap.exists() && flagSnap.data()?.promptsMigrated === true) {
      return; // ya migrado, sin acción
    }

    // 2. Verificar si hay datos en localStorage
    const raw = localStorage.getItem('luz_prompts');
    if (!raw) {
      await setDoc(flagRef, {
        promptsMigrated: true,
        migratedAt: new Date().toISOString(),
        count: 0,
      });
      return;
    }

    let local: any[];
    try {
      local = JSON.parse(raw);
    } catch {
      local = [];
    }

    if (!Array.isArray(local) || local.length === 0) {
      await setDoc(flagRef, {
        promptsMigrated: true,
        migratedAt: new Date().toISOString(),
        count: 0,
      });
      return;
    }

    // 3. Migrar a Firestore en batch (máx 50)
    const batch = writeBatch(db);
    let count = 0;

    for (const p of local.slice(0, 50)) {
      const ref = doc(collection(db, 'globalPrompts'));
      batch.set(ref, {
        id:             ref.id,
        title:          p.title          || 'Prompt migrado',
        promptText:     p.promptText     || '',
        promptDNA:      p.promptDNA      || {},
        imageUrl:       p.imageUrl       || '',
        authorId:       uid,
        authorName:     displayName,
        authorPhotoURL: '',
        tags:           Array.isArray(p.tags) ? p.tags : [],
        likes:          0,
        likedBy:        [],
        saves:          0,
        commentsCount:  0,
        isPublic:       true,
        isPrivate:      false,
        reportedBy:     [],
        isFlagged:      false,
        generations:    Array.isArray(p.generations) ? p.generations : [],
        originPromptId: p.originPromptId || null,
        createdAt:      p.createdAt      || new Date().toISOString(),
        migratedFrom:   'localStorage',
      });
      count++;
    }

    await batch.commit();

    // 4. Limpiar localStorage
    localStorage.removeItem('luz_prompts');

    // 5. Marcar como completado
    await setDoc(flagRef, {
      promptsMigrated: true,
      migratedAt:      new Date().toISOString(),
      count,
    });

    if (count > 0) {
      console.log(`[migratePrompts] ✅ ${count} prompts migrados a Firestore.`);
    }

  } catch (err) {
    // Falla silenciosamente — no debe romper el login
    console.error('[migratePrompts] Error durante migración:', err);
  }
}