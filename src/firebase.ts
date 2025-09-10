// src/firebase.ts
import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, type Auth
} from 'firebase/auth';
import {
  getFirestore, type Firestore,
  collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc, serverTimestamp
} from 'firebase/firestore';
import {
  getStorage, type FirebaseStorage,
  ref as storageRef, uploadBytes, getDownloadURL, deleteObject
} from 'firebase/storage';

// Variáveis de ambiente (ou usa os defaults abaixo)
const cfg = {
  apiKey:            import.meta?.env?.VITE_FIREBASE_API_KEY            ?? "AIzaSyBUd7mOWqTXP3E_dNAs-TXAeF9d_WE5rS4",
  authDomain:        import.meta?.env?.VITE_FIREBASE_AUTH_DOMAIN        ?? "pinaform-a5fec.firebaseapp.com",
  projectId:         import.meta?.env?.VITE_FIREBASE_PROJECT_ID         ?? "pinaform-a5fec",
  storageBucket:     import.meta?.env?.VITE_FIREBASE_STORAGE_BUCKET     ?? "pinaform-a5fec.firebasestorage.app",
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
  GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged,
  collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc, serverTimestamp,
  uploadBytes, getDownloadURL, deleteObject,
};
