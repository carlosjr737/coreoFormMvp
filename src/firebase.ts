// src/firebase.ts
import { initializeApp } from 'firebase/app';
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// 🔧 Substitua pelos valores do seu projeto
// Import the functions you need from the SDKs you need
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBUd7mOWqTXP3E_dNAs-TXAeF9d_WE5rS4",
  authDomain: "pinaform-a5fec.firebaseapp.com",
  projectId: "pinaform-a5fec",
  storageBucket: "pinaform-a5fec.firebasestorage.app",
  messagingSenderId: "885677342214",
  appId: "1:885677342214:web:fe9f74a1065f0ec9ce4d87"
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();
export const dbx = getFirestore(app);
export const storage = getStorage(app);
