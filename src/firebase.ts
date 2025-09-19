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
  type Auth
} from 'firebase/auth';
import {
  getFirestore, type Firestore,
  collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc, serverTimestamp
} from 'firebase/firestore';
import {
  getStorage, type FirebaseStorage,
  ref as storageRef, uploadBytes, getDownloadURL, deleteObject
} from 'firebase/storage';

const DEFAULT_PROJECT_ID = "pinaform-a5fec";

function sanitizeBucketName(raw?: string | null): string | undefined {
  if (!raw) return undefined;
  return raw.replace(/^gs:\/\//i, '').trim() || undefined;
}

const envProjectId = import.meta?.env?.VITE_FIREBASE_PROJECT_ID ?? null;
const projectId = (envProjectId && `${envProjectId}`.trim()) || DEFAULT_PROJECT_ID;

const envBucket = sanitizeBucketName(import.meta?.env?.VITE_FIREBASE_STORAGE_BUCKET ?? null);
const storageBucket = envBucket || `${projectId}.appspot.com`;

// Variáveis de ambiente (ou usa os defaults abaixo)
const cfg = {
  apiKey:            import.meta?.env?.VITE_FIREBASE_API_KEY            ?? "AIzaSyBUd7mOWqTXP3E_dNAs-TXAeF9d_WE5rS4",

  authDomain:        import.meta?.env?.VITE_FIREBASE_AUTH_DOMAIN        ?? `${projectId}.firebaseapp.com`,
  projectId,
  storageBucket,

  messagingSenderId: import.meta?.env?.VITE_FIREBASE_MESSAGING_SENDER_ID?? "885677342214",
  appId:             import.meta?.env?.VITE_FIREBASE_APP_ID             ?? "1:885677342214:web:fe9f74a1065f0ec9ce4d87",
};

export const app: FirebaseApp = initializeApp(cfg);

// Núcleo
export const auth: Auth = getAuth(app);
export const db: Firestore = getFirestore(app);
export const st: FirebaseStorage = getStorage(app);

// Provider de login
export const provider = new GoogleAuthProvider();

// Atalhos de Storage
export { storageRef as ref, storageRef as sRef };

// Re-exports (pra importar tudo só de './firebase')
export {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc, serverTimestamp,
  uploadBytes, getDownloadURL, deleteObject,
};
