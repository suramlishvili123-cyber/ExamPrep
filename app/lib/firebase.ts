"use client";

import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import {
  browserLocalPersistence,
  getRedirectResult,
  GoogleAuthProvider,
  getAuth,
  onAuthStateChanged,
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
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  setDoc,
  type Firestore,
} from "firebase/firestore";
import type { Attempt, StoredState } from "./core";

interface FirebaseClient {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
}

let client: FirebaseClient | null = null;
const runtimeEnv: Record<string, string | undefined> = typeof process === "undefined" ? {} : process.env;

const firebaseConfig = {
  apiKey: runtimeEnv.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyDm9DnkoYFdzpDsmdKGZNmEJa_WuNBIoN4",
  authDomain: runtimeEnv.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "esat-a6d5d.firebaseapp.com",
  projectId: runtimeEnv.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "esat-a6d5d",
  storageBucket: runtimeEnv.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "esat-a6d5d.firebasestorage.app",
  messagingSenderId: runtimeEnv.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "545060097640",
  appId: runtimeEnv.NEXT_PUBLIC_FIREBASE_APP_ID || "1:545060097640:web:f578c1304b3b28de79b5dd",
  measurementId: runtimeEnv.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-GKKM1NBWYM",
};

function configAvailable(): boolean {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);
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

export async function saveAttemptCloud(uid: string, attempt: Attempt): Promise<void> {
  const firebase = getFirebaseClient();
  if (!firebase) return;
  await setDoc(doc(firebase.db, "users", uid, "attempts", attempt.attemptId), attempt, { merge: true });
}

export async function deleteAttemptCloud(uid: string, attemptId: string): Promise<void> {
  const firebase = getFirebaseClient();
  if (!firebase) return;
  await deleteDoc(doc(firebase.db, "users", uid, "attempts", attemptId));
}

export async function saveUserStateCloud(uid: string, state: StoredState): Promise<void> {
  const firebase = getFirebaseClient();
  if (!firebase) return;
  const batchWrites: Promise<void>[] = [
    setDoc(doc(firebase.db, "users", uid), { updatedAt: Date.now(), schemaVersion: 1 }, { merge: true }),
    setDoc(doc(firebase.db, "users", uid, "settings", "main"), state.settings, { merge: true }),
    setDoc(doc(firebase.db, "users", uid, "targets", "main"), state.targets, { merge: true }),
    setDoc(doc(firebase.db, "users", uid, "notes", "main"), state.notes, { merge: true }),
  ];
  for (const [questionId, progress] of Object.entries(state.progress)) {
    batchWrites.push(
      setDoc(doc(firebase.db, "users", uid, "questionProgress", questionId), progress, { merge: true }),
    );
  }
  for (const [questionId, mistake] of Object.entries(state.mistakes)) {
    batchWrites.push(
      setDoc(doc(firebase.db, "users", uid, "mistakeQueue", questionId), mistake, { merge: true }),
    );
  }
  await Promise.all(batchWrites);
}

export async function loadAttemptsCloud(uid: string): Promise<Attempt[]> {
  const firebase = getFirebaseClient();
  if (!firebase) return [];
  const snapshot = await getDocs(collection(firebase.db, "users", uid, "attempts"));
  return snapshot.docs.map((record) => record.data() as Attempt);
}

export async function loadUserStateCloud(uid: string): Promise<Partial<StoredState>> {
  const firebase = getFirebaseClient();
  if (!firebase) return {};
  const [attempts, settings, targets, notes, progressSnapshot, mistakesSnapshot] = await Promise.all([
    loadAttemptsCloud(uid),
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
  };
}
