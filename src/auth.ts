// src/auth.ts
import { onAuthStateChanged, type User } from 'firebase/auth';
import {
  auth,
  provider,
  signInWithPopup,
  signOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from './firebase';

type AuthLandingMode = 'login' | 'register';

let _user: User | null = auth.currentUser;

const AUTH_CHANGED_EVENT = 'auth-changed';

const isLandingPath = (pathname: string) =>
  pathname.endsWith('/landing.html') || pathname.endsWith('/landing');

const isAppPath = (pathname: string) =>
  pathname.endsWith('/index.html') ||
  pathname.endsWith('/index') ||
  pathname === '/' ||
  pathname === '';

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

const handleGlobalAuthState = (user: User | null) => {
  emitAuthChange(user);
  if (!user && isAppPath(window.location.pathname)) {
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
          console.error('Falha ao observar a autenticação.', error);
          cleanup();
          if (!auth.currentUser) {
            redirectToLanding();
          }
          settleReject(error);
        },
      );
    } catch (error) {
      console.error('Falha ao inicializar a verificação de autenticação.', error);
      cleanup();
      if (!auth.currentUser) {
        redirectToLanding();
      }
      const reason = error instanceof Error ? error : new Error('auth-initialization');
      settleReject(reason);
    }
  });
