// src/auth.ts
import { auth, provider, signInWithPopup, signOut as fbSignOut, onAuthStateChanged as fbOnAuthStateChanged } from './firebase';
import type { User } from 'firebase/auth';

let _user: User | null = null;
export function getUser() { return _user; }

export async function signIn() {
  await signInWithPopup(auth, provider);
}

export async function signOut() {
  await fbSignOut(auth);
}

export function onAuthStateChanged(callback: (u: User | null) => void) {
  return fbOnAuthStateChanged(auth, (u) => {
    _user = u;
    callback(u);
  });
}
