// src/auth.ts
import { onAuthStateChanged, type User } from 'firebase/auth';
import type { FirebaseError } from 'firebase/app';

import {
  auth,
  provider,
  signInWithPopup,
  signOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  redirectToAuthorizedAuthHost,
} from './firebase';

type AuthLandingMode = 'login' | 'register';

let _user: User | null = auth.currentUser;

const AUTH_CHANGED_EVENT = 'auth-changed';

// A landing pode ser /landing ou /landing.html
const isLandingPath = (pathname: string) =>
  pathname.endsWith('/landing.html') || pathname.endsWith('/landing');

// O app na Vercel fica na RAIZ (/). Mantemos compat com /index(.html)
const isAppPath = (pathname: string) =>
  pathname === '/' ||
  pathname === '' ||
  pathname.endsWith('/index.html') ||
  pathname.endsWith('/index');

// landing.html?auth=login|register
const buildLandingUrl = (mode: AuthLandingMode = 'login') => {
  const url = new URL('landing.html', window.location.origin);
  url.searchParams.set('auth', mode);
  return url.toString();
};

// >>> App na raiz <<<
const buildAppUrl = () => new URL('/', window.location.origin).toString();

export const redirectToApp = () => {
  const { pathname, href } = window.location;
  if (isAppPath(pathname)) return; // já está no app
  const target = buildAppUrl();
  if (target !== href) window.location.replace(target);
};

const emitAuthChange = (user: User | null) => {
  _user = user;
  document.dispatchEvent(
    new CustomEvent(AUTH_CHANGED_EVENT, {
      detail: user ? { uid: user.uid } : null,
    }),
  );
};

const isFirebaseAuthError = (error: unknown): error is FirebaseError =>
  !!error && typeof error === 'object' && 'code' in (error as Record<string, unknown>);

const handleFirebaseAuthError = (error: unknown) => {
  if (!isFirebaseAuthError(error)) return;
  if (error.code === 'auth/unauthorized-domain') {
    const redirected = redirectToAuthorizedAuthHost();
    if (!redirected) {
      console.error('Domínio não autorizado para autenticação e nenhum fallback configurado.', error);
    }
  }
};

export function getUser() {
  return _user ?? auth.currentUser ?? null;
}

// ✅ Após logar com Google, vá para o app
export async function loginWithGoogle() {
  try {
    const res = await signInWithPopup(auth, provider);
    redirectToApp();
    return res;
  } catch (error) {
    handleFirebaseAuthError(error);
    throw error;
  }
}

export const login = loginWithGoogle;

// ✅ Após logar com email/senha, vá para o app
export async function loginWithEmail(email: string, password: string) {
  try {
    const res = await signInWithEmailAndPassword(auth, email, password);
    redirectToApp();
    return res;
  } catch (error) {
    handleFirebaseAuthError(error);
    throw error;
  }
}

// ✅ Após registrar, vá para o app
export async function registerWithEmail(email: string, password: string) {
  try {
    const res = await createUserWithEmailAndPassword(auth, email, password);
    redirectToApp();
    return res;
  } catch (error) {
    handleFirebaseAuthError(error);
    throw error;
  }
}

export const redirectToLanding = (mode: AuthLandingMode = 'login') => {
  const target = buildLandingUrl(mode);
  const { pathname } = window.location;

  if (isAppPath(pathname)) {
    window.location.replace(target);
    return;
  }

  if (isLandingPath(pathname)) {
    const current = new URL(window.location.href);
    current.searchParams.set('auth', mode);
    const next = current.toString();
    if (next !== window.location.href) {
      window.location.replace(next);
    }
    return;
  }

  window.location.href = target;
};

// 🔁 Inclui ida para o APP quando já logado e na landing
const handleGlobalAuthState = (user: User | null) => {
  emitAuthChange(user);
  const path = window.location.pathname;

  if (user) {
    if (isLandingPath(path)) redirectToApp();
    return;
  }

  if (isAppPath(path)) {
    redirectToLanding();
  }
};

emitAuthChange(auth.currentUser ?? null);
onAuthStateChanged(auth, handleGlobalAuthState);

export async function logout() {
  try {
    await signOut(auth);
  } catch (error) {
    console.error('Erro ao encerrar sessão.', error);
  }
  redirectToLanding();
}

export const requireAuth = (): Promise<User> =>
  new Promise<User>((resolve, reject) => {
    let settled = false;
    let unsubscribe: (() => void) | undefined;
    let timeoutId: number | undefined;

    const settleResolve = (user: User) => {
      if (settled) return;
      settled = true;
      resolve(user);
    };

    const settleReject = (reason: unknown) => {
      if (settled) return;
      settled = true;
      reject(reason);
    };

    const cleanup = () => {
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
        timeoutId = undefined;
      }
      if (unsubscribe) {
        unsubscribe();
        unsubscribe = undefined;
      }
    };

    timeoutId = window.setTimeout(() => {
      if (!auth.currentUser) {
        cleanup();
        redirectToLanding();
        settleReject(new Error('auth-timeout'));
      }
    }, 2000);

    try {
      unsubscribe = onAuthStateChanged(
        auth,
        (user) => {
          cleanup();
          if (user) {
            settleResolve(user);
          } else {
            redirectToLanding();
            settleReject(new Error('not-authenticated'));
          }
        },
        (error) => {
          handleFirebaseAuthError(error);
          console.error('Falha ao observar a autenticação.', error);
          cleanup();
          if (!auth.currentUser) {
            redirectToLanding();
          }
          settleReject(error);
        },
      );
    } catch (error) {
      handleFirebaseAuthError(error);
      console.error('Falha ao inicializar a verificação de autenticação.', error);
      cleanup();
      if (!auth.currentUser) {
        redirectToLanding();
      }
      const reason = error instanceof Error ? error : new Error('auth-initialization');
      settleReject(reason);
    }
  });
