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

type AuthLandingMode = 'login' | 'register';

function isLandingPath(pathname: string) {
  return pathname.endsWith('/landing.html') || pathname.endsWith('/landing');
}

function buildLandingUrl(mode: AuthLandingMode = 'login') {
  const url = new URL('landing.html', window.location.href);
  url.searchParams.set('auth', mode);
  return url.toString();
}


export const redirectToLanding = (mode: AuthLandingMode = 'login') => {
  if (isLandingPath(window.location.pathname)) {
    const current = new URL(window.location.href);
    current.searchParams.set('auth', mode);
    const target = current.toString();
    if (target !== window.location.href) {
      window.location.replace(target);
    }
    return;
  }

  window.location.href = buildLandingUrl(mode);
};

export async function logout() {
  try {
    await signOut(auth);
  } catch (e) {
    console.error(e);
  }
  redirectToLanding();

}

export const requireAuth = () => {

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

};

