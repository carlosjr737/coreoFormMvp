// src/auth.ts
import {
  auth,
  provider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from './firebase';
import type { User } from 'firebase/auth';

let _user: User | null = auth.currentUser;
export function getUser() {
  return _user ?? auth.currentUser ?? null;
}

export async function loginWithGoogle() {
  return signInWithPopup(auth, provider);
}

export const login = loginWithGoogle;

export async function loginWithEmail(email: string, password: string) {
  return signInWithEmailAndPassword(auth, email, password);
}

export async function registerWithEmail(email: string, password: string) {
  return createUserWithEmailAndPassword(auth, email, password);
}

export async function logout() {
  try {
    await signOut(auth);
  } catch (e) {
    console.error(e);
  }
  window.location.href = 'landing.html';
}

function redirectToLanding() {
  const { pathname } = window.location;
  if (pathname.endsWith('/landing.html') || pathname.endsWith('/landing')) {
    return;
  }
  window.location.href = 'landing.html';
}

export function requireAuth() {
  let receivedAuthEvent = false;

  onAuthStateChanged(auth, (u) => {
    receivedAuthEvent = true;
    _user = u;
    document.dispatchEvent(new CustomEvent('auth-changed', {
      detail: u ? { uid: u.uid } : null
    }));
    if (!u) {
      redirectToLanding();
    }
  });

  if (!auth.currentUser) {
    window.setTimeout(() => {
      if (!receivedAuthEvent && !getUser()) {
        redirectToLanding();
      }
    }, 2000);
  }
}
