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

type AuthLandingMode = 'login' | 'register';

let _user: User | null = auth.currentUser;

const AUTH_CHANGED_EVENT = 'auth-changed';

const isLandingPath = (pathname: string) =>
  pathname.endsWith('/landing.html') || pathname.endsWith('/landing');

const buildLandingUrl = (mode: AuthLandingMode = 'login') => {
  const url = new URL('landing.html', window.location.href);
  url.searchParams.set('auth', mode);
  return url.toString();
};

const emitAuthChange = (user: User | null) => {
  _user = user;
  document.dispatchEvent(
    new CustomEvent(AUTH_CHANGED_EVENT, {
      detail: user ? { uid: user.uid } : null,
    }),
  );
};

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

  window.location.replace(buildLandingUrl(mode));

};

export async function logout() {
  try {
    await signOut(auth);
  } catch (error) {
    console.error('Erro ao encerrar sessão.', error);
  }

  redirectToLanding();
}

export const requireAuth = () => {
  let receivedAuthEvent = false;
  let fallbackTimer: number | undefined;

  const handleAuthState = (user: User | null) => {
    receivedAuthEvent = true;
    window.clearTimeout(fallbackTimer);
    emitAuthChange(user);
    if (!user) {
      redirectToLanding();
    }
  };

  try {
    onAuthStateChanged(
      auth,
      (user) => handleAuthState(user),
      (error) => {
        console.error('Falha ao observar a autenticação.', error);
        window.clearTimeout(fallbackTimer);
        if (!receivedAuthEvent && !getUser()) {
          redirectToLanding();
        }
      },
    );
  } catch (error) {
    console.error('Falha ao inicializar a verificação de autenticação.', error);
    if (!getUser()) {
      redirectToLanding();
    }
    return;
  }

  emitAuthChange(auth.currentUser ?? null);

  if (!auth.currentUser) {
    fallbackTimer = window.setTimeout(() => {

      if (!receivedAuthEvent && !getUser()) {
        redirectToLanding();
      }
    }, 2000);
  }

};
