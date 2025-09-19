// src/firebase.ts
import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  type Auth,
} from 'firebase/auth';
import {
  getFirestore,
  type Firestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import {
  getStorage,
  type FirebaseStorage,
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
  deleteObject,
  type UploadMetadata,
  type UploadResult,
} from 'firebase/storage';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID ?? '',
};

export const app: FirebaseApp = initializeApp(firebaseConfig);
export const auth: Auth = getAuth(app);
export const db: Firestore = getFirestore(app);
export const st: FirebaseStorage = getStorage(app);

function normalizeStorageSegment(part: string | number | null | undefined): string {
  if (part === null || part === undefined) return '';
  return `${part}`.replace(/^\/+|\/+$/g, '').trim();
}

export function joinStoragePath(...segments: Array<string | number | null | undefined>): string {
  return segments
    .flatMap(segment => normalizeStorageSegment(segment).split('/'))
    .map(segment => segment.trim())
    .filter(Boolean)
    .join('/');
}

export function uploadToStorage(
  path: string,
  data: Blob | ArrayBuffer | Uint8Array,
  metadata?: UploadMetadata,
): Promise<UploadResult> {
  const normalizedPath = joinStoragePath(path);
  return uploadBytes(storageRef(st, normalizedPath), data, metadata);
}

export function downloadFromStorage(path: string): Promise<string> {
  const normalizedPath = joinStoragePath(path);
  return getDownloadURL(storageRef(st, normalizedPath));
}

export async function deleteFromStorage(path: string): Promise<void> {
  const normalizedPath = joinStoragePath(path);
  await deleteObject(storageRef(st, normalizedPath));
}

export function describeFirebaseError(err: unknown): string {
  if (!err) return 'Erro desconhecido.';
  if (typeof err === 'string') return err;
  const anyErr = err as { code?: string; message?: string };
  const parts: string[] = [];
  if (anyErr.code) parts.push(`${anyErr.code}`);
  if (anyErr.message) parts.push(`${anyErr.message}`);
  if (parts.length === 0) {
    try {
      return JSON.stringify(err);
    } catch {
      return String(err);
    }
  }
  return parts.join(' - ');
}

export function describeFirebaseStorageError(err: unknown): string {
  return describeFirebaseError(err);
}

export const provider = new GoogleAuthProvider();

export { storageRef as ref, storageRef as sRef };

export {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
};
