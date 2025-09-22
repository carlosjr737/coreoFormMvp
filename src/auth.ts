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

export const requireAuth = (): Promise<User> => {
  let fallbackTimer: number | undefined;
  let settled = false;

  const clearFallbackTimer = () => {
    if (fallbackTimer !== undefined) {
      window.clearTimeout(fallbackTimer);
      fallbackTimer = undefined;
    }
  };

  const resolveOnce = (resolve: (user: User) => void, user: User) => {
    if (settled) return;
    settled = true;
    clearFallbackTimer();
    resolve(user);
  };

  const rejectOnce = (reject: (reason?: unknown) => void, reason?: unknown) => {
    if (settled) return;
    settled = true;
    clearFallbackTimer();
    reject(reason ?? new Error('auth-required'));
  };

  return new Promise<User>((resolve, reject) => {
    const handleAuthState = (user: User | null) => {
      emitAuthChange(user);
      if (user) {
        resolveOnce(resolve, user);
      } else {
        redirectToLanding();
        rejectOnce(reject, new Error('auth-required'));
      }
    };

    try {
      onAuthStateChanged(
        auth,
        (user) => {
          clearFallbackTimer();
          handleAuthState(user);
        },
        (error) => {
          console.error('Falha ao observar a autenticação.', error);
          clearFallbackTimer();
          if (!getUser()) {
            redirectToLanding();
          }
          rejectOnce(reject, error);
        },
      );
    } catch (error) {
      console.error('Falha ao inicializar a verificação de autenticação.', error);
      if (!getUser()) {
        redirectToLanding();
      }
      rejectOnce(reject, error);
      return;
    }

    const initialUser = auth.currentUser ?? null;
    emitAuthChange(initialUser);
    if (initialUser) {
      resolveOnce(resolve, initialUser);
      return;
    }

    fallbackTimer = window.setTimeout(() => {
      if (!settled && !getUser()) {
        console.warn('Tempo limite ao verificar autenticação. Redirecionando para a landing.');
        redirectToLanding();
        rejectOnce(reject, new Error('auth-timeout'));
      }
    }, 2000);
  });
};
