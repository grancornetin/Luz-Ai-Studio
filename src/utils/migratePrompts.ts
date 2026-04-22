/**
 * scripts/migratePrompts.ts
 * ─────────────────────────────────────────────────────────────
 * One-time migration: move prompts from localStorage → Firestore.
 *
 * USAGE:
 *   Call promptService.migrateFromLocalStorage(uid, displayName)
 *   once after the user logs in for the first time after deployment.
 *
 * Recommended: call it in AuthContext after login, guarded by a
 * Firestore flag so it only runs once per user.
 * ─────────────────────────────────────────────────────────────
 */

import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../src/firebase';
import { promptService } from '../src/modules/promptLibrary/services/promptService';

/**
 * Run migration for a user.
 * Safe to call multiple times — uses a migration flag in Firestore.
 */
export async function runMigration(uid: string, displayName: string): Promise<void> {
  // Check if already migrated
  const flagRef = doc(db, `users/${uid}/meta/migration`);
  const flagSnap = await getDoc(flagRef);
  if (flagSnap.exists() && flagSnap.data()?.promptsMigrated) {
    console.log('[migration] Already migrated, skipping.');
    return;
  }

  const count = await promptService.migrateFromLocalStorage(uid, displayName);

  // Mark as migrated
  await setDoc(flagRef, { promptsMigrated: true, migratedAt: new Date().toISOString(), count });

  if (count > 0) {
    console.log(`[migration] Migrated ${count} prompts for ${uid}`);
  } else {
    console.log('[migration] No local prompts to migrate.');
  }
}

/*
 * ═══════════════════════════════════════════════════════════════
 * FIRESTORE INDEXES REQUIRED
 * Create these in Firebase Console → Firestore → Indexes
 * ═══════════════════════════════════════════════════════════════
 *
 * The main gallery query uses:
 *   where('isPublic', '==', true)
 *   where('isFlagged', '!=', true)
 *   orderBy('isFlagged')
 *   orderBy('createdAt', 'desc')
 *
 * Firestore requires a COMPOSITE INDEX for this query.
 *
 * INDEX 1 — Default gallery (sort by recent):
 *   Collection: globalPrompts
 *   Fields:
 *     isFlagged    ASC
 *     createdAt    DESC
 *     isPublic     (=)   ← Firestore adds this automatically
 *
 * INDEX 2 — Gallery sorted by likes:
 *   Collection: globalPrompts
 *   Fields:
 *     isFlagged    ASC
 *     likes        DESC
 *     isPublic     (=)
 *
 * INDEX 3 — User prompts:
 *   Collection: globalPrompts
 *   Fields:
 *     authorId     ASC
 *     createdAt    DESC
 *
 * ──────────────────────────────────────────────────────────────
 * You can also add these to firestore.indexes.json and deploy
 * with: firebase deploy --only firestore:indexes
 * ──────────────────────────────────────────────────────────────
 */

export const firestoreIndexesJson = {
  indexes: [
    {
      collectionGroup: "globalPrompts",
      queryScope: "COLLECTION",
      fields: [
        { fieldPath: "isPublic",   order: "ASCENDING"  },
        { fieldPath: "isFlagged",  order: "ASCENDING"  },
        { fieldPath: "createdAt",  order: "DESCENDING" }
      ]
    },
    {
      collectionGroup: "globalPrompts",
      queryScope: "COLLECTION",
      fields: [
        { fieldPath: "isPublic",  order: "ASCENDING"  },
        { fieldPath: "isFlagged", order: "ASCENDING"  },
        { fieldPath: "likes",     order: "DESCENDING" }
      ]
    },
    {
      collectionGroup: "globalPrompts",
      queryScope: "COLLECTION",
      fields: [
        { fieldPath: "authorId",  order: "ASCENDING"  },
        { fieldPath: "createdAt", order: "DESCENDING" }
      ]
    }
  ],
  fieldOverrides: []
};

/*
 * ═══════════════════════════════════════════════════════════════
 * HOW TO WIRE THE MIGRATION IN AuthContext.tsx
 * ═══════════════════════════════════════════════════════════════
 *
 * In the onAuthStateChanged callback, after fetching the user profile,
 * add this call:
 *
 *   import { runMigration } from '../../../scripts/migratePrompts';
 *
 *   // Inside onAuthStateChanged, after profile is loaded:
 *   runMigration(
 *     firebaseUser.uid,
 *     firebaseUser.displayName || 'Anonymous'
 *   ).catch(console.error); // fire-and-forget
 *
 * This is safe because:
 *   1. It checks a Firestore flag before running
 *   2. It's fire-and-forget (won't block login)
 *   3. It removes localStorage data after migrating
 *   4. It's limited to 50 prompts per batch
 *
 * ═══════════════════════════════════════════════════════════════
 * DEPLOYMENT CHECKLIST
 * ═══════════════════════════════════════════════════════════════
 *
 * [ ] 1. Copy all files from /outputs/ to their src/ destinations
 * [ ] 2. Deploy Firestore security rules (firestore.rules)
 * [ ] 3. Create Firestore composite indexes (see above or firestore.indexes.json)
 * [ ] 4. Wire runMigration() in AuthContext.tsx
 * [ ] 5. Re-enable real Firebase auth in AuthContext.tsx (remove mock)
 * [ ] 6. Test: publish a prompt, like it from another account, comment
 * [ ] 7. Test: save to board, check SavedPromptsPanel
 * [ ] 8. Test admin: flag/unflag, delete any prompt
 *
 * ═══════════════════════════════════════════════════════════════
 * FUTURE FEATURES (ready to build when you want)
 * ═══════════════════════════════════════════════════════════════
 *
 * [ ] Full-text search → Algolia or Typesense integration
 *     (Firestore doesn't support full-text; current search is client-side
 *     and works fine for up to ~500 prompts)
 *
 * [ ] Image storage → Upload base64 to Firebase Storage on publish,
 *     save public URL. Prevents Firestore document size issues (1MB limit).
 *     Add to promptService.publishPrompt():
 *       const storageRef = ref(storage, `prompts/${promptId}.jpg`);
 *       await uploadString(storageRef, imageUrl, 'data_url');
 *       const url = await getDownloadURL(storageRef);
 *
 * [ ] Notifications → When someone likes/comments your prompt
 *     Collection: users/{uid}/notifications
 *
 * [ ] Follow system → Follow users, see their feed
 *     Collection: users/{uid}/following/{targetUid}
 *
 * [ ] Trending algorithm → Decay-based score (likes + recency weight)
 *     Can be computed by a Cloud Function on a schedule
 */