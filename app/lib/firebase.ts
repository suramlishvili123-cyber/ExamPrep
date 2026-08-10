"use client";

import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import {
  GoogleAuthProvider,
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type Auth,
  type User,
} from "firebase/auth";
import {
  collection,
  doc,
  enableIndexedDbPersistence,
  getDocs,
  getFirestore,
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
let persistenceAttempted = false;

function configAvailable(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_FIREBASE_API_KEY && process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID);
}

export function getFirebaseClient(): FirebaseClient | null {
  if (client) return client;
  if (!configAvailable()) return null;
  const app = getApps().length
    ? getApp()
    : initializeApp({
        apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
        authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
        appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
        measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
      });
  const db = getFirestore(app);
  if (!persistenceAttempted && typeof window !== "undefined") {
    persistenceAttempted = true;
    enableIndexedDbPersistence(db).catch(() => {
      // Another tab may already own IndexedDB persistence. Local attempt state
      // remains authoritative during an active module.
    });
  }
  client = { app, auth: getAuth(app), db };
  return client;
}

export function observeUser(callback: (user: User | null) => void): () => void {
  const firebase = getFirebaseClient();
  if (!firebase) {
    callback(null);
    return () => undefined;
  }
  return onAuthStateChanged(firebase.auth, callback);
}

export async function signInWithGoogle(): Promise<User> {
  const firebase = getFirebaseClient();
  if (!firebase) throw new Error("Firebase environment variables are not configured.");
  const result = await signInWithPopup(firebase.auth, new GoogleAuthProvider());
  return result.user;
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

export async function saveUserStateCloud(uid: string, state: StoredState): Promise<void> {
  const firebase = getFirebaseClient();
  if (!firebase) return;
  const batchWrites: Promise<void>[] = [
    setDoc(doc(firebase.db, "users", uid), { updatedAt: Date.now(), schemaVersion: 1 }, { merge: true }),
    setDoc(doc(firebase.db, "users", uid, "settings", "main"), state.settings, { merge: true }),
    setDoc(doc(firebase.db, "users", uid, "targets", "main"), state.targets, { merge: true }),
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
