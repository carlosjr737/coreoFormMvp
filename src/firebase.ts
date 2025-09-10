// src/firebase.ts
// src/firebase.ts
import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, type Auth
} from 'firebase/auth';
import {
  getFirestore, type Firestore, collection, doc, getDoc, getDocs,
  setDoc, addDoc, updateDoc, deleteDoc, serverTimestamp
} from 'firebase/firestore';
import {
  getStorage, type FirebaseStorage, ref as storageRef,
  uploadBytes, getDownloadURL, deleteObject
} from 'firebase/storage';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FB_API_KEY,
  authDomain: import.meta.env.VITE_FB_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FB_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FB_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FB_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FB_APP_ID,
};

export const app: FirebaseApp = initializeApp(firebaseConfig);

// Auth / DB / Storage
export const auth: Auth = getAuth(app);
export const dbFs: Firestore = getFirestore(app);
export const st: FirebaseStorage = getStorage(app);

// Re-exports de conveniência (assim outros arquivos importam só de './firebase')
export {
  GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged,
  collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc, serverTimestamp,
  storageRef as ref, uploadBytes, getDownloadURL, deleteObject,
};
