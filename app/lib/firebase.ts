"use client";

import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import {
  browserLocalPersistence,
  deleteUser as deleteFirebaseUser,
  getRedirectResult,
  GoogleAuthProvider,
  getAuth,
  onAuthStateChanged,
  reauthenticateWithPopup,
  setPersistence,
  signInWithRedirect,
  signInWithPopup,
  signOut,
  type Auth,
  type User,
} from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getDocsFromServer,
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  runTransaction,
  setDoc,
  waitForPendingWrites,
  writeBatch,
  type DocumentReference,
  type Firestore,
  type WriteBatch,
} from "firebase/firestore";
import {
  normalizeSyncMetadata,
  type Attempt,
  type StoredState,
  type SyncMetadata,
} from "./core";

interface FirebaseClient {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
}

let client: FirebaseClient | null = null;

/**
 * Vite substitutes `import.meta.env` at build time. Under a plain ESM loader — the
 * component test runner, or any non-bundled import of this module — it is absent, and
 * reading a property through it would throw while the module is merely being imported.
 */
const buildEnv: Record<string, string | undefined> = import.meta.env ?? {};

const firebaseConfig = {
  apiKey: buildEnv.VITE_FIREBASE_API_KEY ?? "AIzaSyDm9DnkoYFdzpDsmdKGZNmEJa_WuNBIoN4",
  authDomain: buildEnv.VITE_FIREBASE_AUTH_DOMAIN ?? "esat-a6d5d.firebaseapp.com",
  projectId: buildEnv.VITE_FIREBASE_PROJECT_ID ?? "esat-a6d5d",
  storageBucket: buildEnv.VITE_FIREBASE_STORAGE_BUCKET ?? "esat-a6d5d.firebasestorage.app",
  messagingSenderId: buildEnv.VITE_FIREBASE_MESSAGING_SENDER_ID ?? "545060097640",
  appId: buildEnv.VITE_FIREBASE_APP_ID ?? "1:545060097640:web:f578c1304b3b28de79b5dd",
  measurementId: buildEnv.VITE_FIREBASE_MEASUREMENT_ID ?? "G-GKKM1NBWYM",
};

function configAvailable(): boolean {
  return Boolean(
    firebaseConfig.apiKey
    && firebaseConfig.authDomain
    && firebaseConfig.projectId
    && firebaseConfig.storageBucket
    && firebaseConfig.messagingSenderId
    && firebaseConfig.appId,
  );
}

const ACTIVE_ATTEMPT_COLLECTION = "activeAttempts";
const ACTIVE_ATTEMPT_DOCUMENT = "current";
const FIRESTORE_BATCH_LIMIT = 450;
/** Collections whose document IDs are arbitrary, so a purge has to enumerate them. */
const ENUMERATED_USER_COLLECTIONS = ["attempts", "questionProgress", "mistakeQueue"] as const;

/**
 * Documents this schema stores at one fixed, known ID.
 *
 * They must be deleted by path rather than listed. Their security rules pin the document
 * name (`documentId == "main"`), and Cloud Firestore rules are not filters: it will only
 * allow a list when the query itself guarantees every possible result is permitted. An
 * unconstrained `getDocs` on these collections is therefore rejected outright, which
 * would make account deletion fail with permission-denied.
 */
const FIXED_USER_DOCUMENTS: ReadonlyArray<readonly [string, string]> = [
  [ACTIVE_ATTEMPT_COLLECTION, ACTIVE_ATTEMPT_DOCUMENT],
  ["settings", "main"],
  ["targets", "main"],
  ["notes", "main"],
];

function isCompletedAttempt(attempt: Attempt): boolean {
  return attempt.completionStatus !== "active" && attempt.endedAt !== null && attempt.rawScore !== null;
}

function activeAttemptReference(db: Firestore, uid: string): DocumentReference {
  return doc(db, "users", uid, ACTIVE_ATTEMPT_COLLECTION, ACTIVE_ATTEMPT_DOCUMENT);
}

async function commitOperations(
  db: Firestore,
  operations: Array<(batch: WriteBatch) => void>,
): Promise<void> {
  for (let offset = 0; offset < operations.length; offset += FIRESTORE_BATCH_LIMIT) {
    const batch = writeBatch(db);
    for (const operation of operations.slice(offset, offset + FIRESTORE_BATCH_LIMIT)) operation(batch);
    await batch.commit();
  }
}

export function firebaseConfigured(): boolean {
  return configAvailable();
}

export function getFirebaseClient(): FirebaseClient | null {
  if (client) return client;
  if (!configAvailable()) return null;
  const app = getApps().length
    ? getApp()
    : initializeApp(firebaseConfig);
  let db: Firestore;
  try {
    db = initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
  } catch {
    // Hot reload can preserve an already-initialized Firebase app.
    db = getFirestore(app);
  }
  client = { app, auth: getAuth(app), db };
  return client;
}

export function observeUser(
  callback: (user: User | null) => void,
  onRedirectError?: (error: unknown) => void,
): () => void {
  const firebase = getFirebaseClient();
  if (!firebase) {
    callback(null);
    return () => undefined;
  }
  getRedirectResult(firebase.auth).catch((error: unknown) => onRedirectError?.(error));
  return onAuthStateChanged(firebase.auth, callback);
}

export async function signInWithGoogle(): Promise<User | null> {
  const firebase = getFirebaseClient();
  if (!firebase) throw new Error("Firebase environment variables are not configured.");
  await setPersistence(firebase.auth, browserLocalPersistence);
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  try {
    const result = await signInWithPopup(firebase.auth, provider);
    return result.user;
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
    if (code === "auth/popup-blocked") {
      await signInWithRedirect(firebase.auth, provider);
      return null;
    }
    throw error;
  }
}

export async function signOutUser(): Promise<void> {
  const firebase = getFirebaseClient();
  if (firebase) await signOut(firebase.auth);
}

/**
 * Persist exactly what one completed attempt changed: the attempt itself, and the
 * progress and retrieval records for the questions it contained.
 *
 * The alternative — replaying the whole profile through `saveUserStateCloud` on every
 * submission — costs one write per stored question plus one per stored attempt, so a
 * candidate who has revised for a month pays hundreds of writes to finish a 27-question
 * module. Nothing outside this attempt's questions can have changed.
 */
export async function saveAttemptOutcomeCloud(
  uid: string,
  attempt: Attempt,
  state: Pick<StoredState, "progress" | "mistakes">,
): Promise<void> {
  const firebase = getFirebaseClient();
  if (!firebase) return;
  if (!isCompletedAttempt(attempt)) {
    throw new Error("saveAttemptOutcomeCloud only accepts completed attempts; use saveActiveAttemptCloud while a session is active.");
  }
  const operations: Array<(batch: WriteBatch) => void> = [
    // merge:true so the sibling syncMetadata written by profile saves is preserved.
    (batch) => batch.set(
      doc(firebase.db, "users", uid),
      { updatedAt: Date.now(), schemaVersion: 3 },
      { merge: true },
    ),
    (batch) => batch.set(doc(firebase.db, "users", uid, "attempts", attempt.attemptId), attempt, { merge: true }),
  ];
  for (const questionId of new Set(attempt.questionIds)) {
    const progress = state.progress[questionId];
    if (progress) {
      operations.push((batch) => batch.set(doc(firebase.db, "users", uid, "questionProgress", questionId), progress, { merge: true }));
    }
    const mistake = state.mistakes[questionId];
    if (mistake) {
      operations.push((batch) => batch.set(doc(firebase.db, "users", uid, "mistakeQueue", questionId), mistake, { merge: true }));
    }
  }
  await commitOperations(firebase.db, operations);
}

/** Store the one resumable session separately from immutable attempt history. */
export async function saveActiveAttemptCloud(uid: string, attempt: Attempt): Promise<void> {
  const firebase = getFirebaseClient();
  if (!firebase) return;
  if (attempt.completionStatus !== "active" || attempt.endedAt !== null || attempt.rawScore !== null) {
    throw new Error("Only an unfinished active attempt can be stored as the cloud autosave.");
  }
  await setDoc(activeAttemptReference(firebase.db, uid), attempt);
}

export async function loadActiveAttemptCloud(uid: string): Promise<Attempt | null> {
  const firebase = getFirebaseClient();
  if (!firebase) return null;
  const snapshot = await getDoc(activeAttemptReference(firebase.db, uid));
  if (!snapshot.exists()) return null;
  const attempt = snapshot.data() as Attempt;
  if (attempt.completionStatus !== "active" || attempt.endedAt !== null || attempt.rawScore !== null) {
    throw new Error("The cloud active-attempt record is malformed or already complete.");
  }
  return attempt;
}

/** Delete only the expected autosave, protecting a newer session created in another tab. */
export async function deleteActiveAttemptCloud(uid: string, expectedAttemptId?: string): Promise<void> {
  const firebase = getFirebaseClient();
  if (!firebase) return;
  const reference = activeAttemptReference(firebase.db, uid);
  if (!expectedAttemptId) {
    await deleteDoc(reference);
    return;
  }
  await runTransaction(firebase.db, async (transaction) => {
    const snapshot = await transaction.get(reference);
    if (!snapshot.exists() || snapshot.data().attemptId !== expectedAttemptId) return;
    transaction.delete(reference);
  });
}

/** The profile sections this write replaces; attempts and progress are synced separately. */
export type UserProfile = Pick<StoredState, "settings" | "targets" | "notes" | "syncMetadata">;

/** Persist all independently editable profile sections using replacement semantics. */
export async function saveUserProfileCloud(uid: string, state: UserProfile): Promise<void> {
  const firebase = getFirebaseClient();
  if (!firebase) return;
  const syncMetadata = normalizeSyncMetadata(state.syncMetadata);
  const batch = writeBatch(firebase.db);
  batch.set(
    doc(firebase.db, "users", uid),
    { updatedAt: Date.now(), schemaVersion: 3, syncMetadata },
    { merge: true },
  );
  batch.set(doc(firebase.db, "users", uid, "settings", "main"), state.settings);
  batch.set(doc(firebase.db, "users", uid, "targets", "main"), state.targets);
  batch.set(doc(firebase.db, "users", uid, "notes", "main"), state.notes);
  await batch.commit();
}

export async function deleteAttemptCloud(uid: string, attemptId: string): Promise<void> {
  const firebase = getFirebaseClient();
  if (!firebase) return;
  await deleteDoc(doc(firebase.db, "users", uid, "attempts", attemptId));
}

export async function saveUserStateCloud(uid: string, state: StoredState): Promise<void> {
  const firebase = getFirebaseClient();
  if (!firebase) return;
  const syncMetadata = normalizeSyncMetadata(state.syncMetadata);
  const operations: Array<(batch: WriteBatch) => void> = [
    (batch) => batch.set(
      doc(firebase.db, "users", uid),
      { updatedAt: Date.now(), schemaVersion: 3, syncMetadata },
      { merge: true },
    ),
    (batch) => batch.set(doc(firebase.db, "users", uid, "settings", "main"), state.settings),
    (batch) => batch.set(doc(firebase.db, "users", uid, "targets", "main"), state.targets),
    (batch) => batch.set(doc(firebase.db, "users", uid, "notes", "main"), state.notes),
  ];
  for (const [questionId, progress] of Object.entries(state.progress)) {
    operations.push(
      (batch) => batch.set(doc(firebase.db, "users", uid, "questionProgress", questionId), progress, { merge: true }),
    );
  }
  for (const [questionId, mistake] of Object.entries(state.mistakes)) {
    operations.push(
      (batch) => batch.set(doc(firebase.db, "users", uid, "mistakeQueue", questionId), mistake, { merge: true }),
    );
  }
  const completedAttempts = new Map(
    state.attempts.filter(isCompletedAttempt).map((attempt) => [attempt.attemptId, attempt]),
  );
  for (const attempt of completedAttempts.values()) {
    operations.push(
      (batch) => batch.set(doc(firebase.db, "users", uid, "attempts", attempt.attemptId), attempt, { merge: true }),
    );
  }
  await commitOperations(firebase.db, operations);
}

export async function loadAttemptsCloud(uid: string): Promise<Attempt[]> {
  const firebase = getFirebaseClient();
  if (!firebase) return [];
  const snapshot = await getDocs(collection(firebase.db, "users", uid, "attempts"));
  return snapshot.docs
    .map((record) => record.data() as Attempt)
    .filter(isCompletedAttempt);
}

export async function loadUserStateCloud(uid: string): Promise<Partial<StoredState>> {
  const firebase = getFirebaseClient();
  if (!firebase) return {};
  const [attempts, userRoot, settings, targets, notes, progressSnapshot, mistakesSnapshot] = await Promise.all([
    loadAttemptsCloud(uid),
    getDoc(doc(firebase.db, "users", uid)),
    getDoc(doc(firebase.db, "users", uid, "settings", "main")),
    getDoc(doc(firebase.db, "users", uid, "targets", "main")),
    getDoc(doc(firebase.db, "users", uid, "notes", "main")),
    getDocs(collection(firebase.db, "users", uid, "questionProgress")),
    getDocs(collection(firebase.db, "users", uid, "mistakeQueue")),
  ]);
  return {
    attempts,
    settings: settings.exists() ? (settings.data() as StoredState["settings"]) : undefined,
    targets: targets.exists() ? (targets.data() as StoredState["targets"]) : undefined,
    notes: notes.exists() ? (notes.data() as StoredState["notes"]) : undefined,
    progress: Object.fromEntries(progressSnapshot.docs.map((record) => [record.id, record.data()])) as StoredState["progress"],
    mistakes: Object.fromEntries(mistakesSnapshot.docs.map((record) => [record.id, record.data()])) as StoredState["mistakes"],
    syncMetadata: normalizeSyncMetadata(
      userRoot.exists() ? (userRoot.data().syncMetadata as Partial<SyncMetadata> | undefined) : undefined,
    ),
  };
}

/**
 * Delete every collection owned by this client schema, then the user root. Server reads and
 * acknowledged writes are required so account deletion cannot strand offline-only deletes.
 * The operation is idempotent: retrying after a partial failure safely finishes the purge.
 */
export async function deleteUserStateCloud(uid: string): Promise<void> {
  const firebase = getFirebaseClient();
  if (!firebase) throw new Error("Firebase is not configured for this deployment.");
  if (!firebase.auth.currentUser || firebase.auth.currentUser.uid !== uid) {
    throw new Error("The signed-in Firebase user does not match the requested data owner.");
  }
  const snapshots = await Promise.all(
    ENUMERATED_USER_COLLECTIONS.map((name) => getDocsFromServer(collection(firebase.db, "users", uid, name))),
  );
  const references = snapshots.flatMap((snapshot) => snapshot.docs.map((record) => record.ref));
  // Deleting a document that does not exist is a no-op, so the fixed paths keep the
  // whole purge idempotent without an extra existence read.
  for (const [collectionName, documentId] of FIXED_USER_DOCUMENTS) {
    references.push(doc(firebase.db, "users", uid, collectionName, documentId));
  }
  references.push(doc(firebase.db, "users", uid));
  await commitOperations(
    firebase.db,
    references.map((reference) => (batch) => batch.delete(reference)),
  );
  await waitForPendingWrites(firebase.db);
}

/** Reauthenticate in-place, purge server data, then remove the Firebase Auth identity. */
export async function deleteAccountAndData(user: User): Promise<void> {
  const firebase = getFirebaseClient();
  if (!firebase) throw new Error("Firebase is not configured for this deployment.");
  if (!firebase.auth.currentUser || firebase.auth.currentUser.uid !== user.uid) {
    throw new Error("The account is no longer the active signed-in Firebase user.");
  }
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  await reauthenticateWithPopup(user, provider);
  await deleteUserStateCloud(user.uid);
  await deleteFirebaseUser(user);
}
