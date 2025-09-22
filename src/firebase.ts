// src/firebase.ts
import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  type Auth,
} from 'firebase/auth';
import {
  getFirestore,
  type Firestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import {
  getStorage,
  type FirebaseStorage,
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
  deleteObject,
  type UploadMetadata,
  type UploadResult,
} from 'firebase/storage';

type HostMatcher = { literal?: string; suffix?: string };

const normalizeHost = (host?: string | null): string | null => {
  if (!host) return null;
  const trimmed = host.trim();
  if (!trimmed) return null;

  const candidate = trimmed.includes('://') ? trimmed : `https://${trimmed}`;
  try {
    return new URL(candidate).hostname.toLowerCase();
  } catch {
    return trimmed.replace(/^[*]+\./, '').toLowerCase();
  }
};

const parseHostList = (value: string | undefined): string[] =>
  value
    ? value
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean)
    : [];

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID ?? '',
};

const literalAuthHosts = new Set<string>();
const wildcardAuthHosts: HostMatcher[] = [];

const registerHost = (host?: string | null) => {
  const normalized = normalizeHost(host);
  if (!normalized) return;
  literalAuthHosts.add(normalized);
};

const registerWildcardHost = (host?: string | null) => {
  const normalized = normalizeHost(host);
  if (!normalized) return;
  wildcardAuthHosts.push({ suffix: normalized });
};

registerHost(import.meta.env.VITE_FIREBASE_AUTH_FALLBACK_DOMAIN ?? null);
registerHost(firebaseConfig.authDomain);

if (firebaseConfig.projectId) {
  registerHost(`${firebaseConfig.projectId}.firebaseapp.com`);
  registerHost(`${firebaseConfig.projectId}.web.app`);
}

['localhost', '127.0.0.1', '::1', '[::1]'].forEach(registerHost);

const extraDomains = parseHostList(import.meta.env.VITE_FIREBASE_AUTHORIZED_DOMAINS);
extraDomains.forEach((entry) => {
  if (entry.startsWith('*.')) {
    registerWildcardHost(entry.slice(2));
    return;
  }
  registerHost(entry);
});

const wildcardSuffixes = parseHostList(import.meta.env.VITE_FIREBASE_AUTHORIZED_WILDCARDS);
wildcardSuffixes.forEach(registerWildcardHost);

const fallbackAuthHost = (() => {
  const explicitFallback = normalizeHost(import.meta.env.VITE_FIREBASE_AUTH_FALLBACK_DOMAIN ?? null);
  if (explicitFallback) return explicitFallback;
  const normalizedConfigDomain = normalizeHost(firebaseConfig.authDomain);
  if (normalizedConfigDomain) return normalizedConfigDomain;
  if (firebaseConfig.projectId) {
    return normalizeHost(`${firebaseConfig.projectId}.firebaseapp.com`);
  }
  return null;
})();

if (fallbackAuthHost) {
  literalAuthHosts.add(fallbackAuthHost);
}

const hostMatchesWildcard = (host: string, matcher: HostMatcher) => {
  if (!matcher.suffix) return false;
  return host === matcher.suffix || host.endsWith(`.${matcher.suffix}`);
};

const isHostAuthorizedForFirebaseAuth = (host: string): boolean => {
  const normalized = normalizeHost(host);
  if (!normalized) return false;
  if (literalAuthHosts.has(normalized)) return true;
  return wildcardAuthHosts.some((matcher) => hostMatchesWildcard(normalized, matcher));
};

const buildFallbackRedirectUrl = (): string | null => {
  if (typeof window === 'undefined') return null;
  if (!fallbackAuthHost) return null;
  const currentHost = normalizeHost(window.location.hostname);
  if (!currentHost || currentHost === fallbackAuthHost) return null;
  try {
    const target = new URL(window.location.href);
    target.hostname = fallbackAuthHost;
    target.port = '';
    return target.toString();
  } catch (error) {
    console.warn('Não foi possível construir a URL de fallback para autenticação.', error);
    return null;
  }
};

export const isRunningOnAuthorizedAuthHost = (() => {
  if (typeof window === 'undefined') return true;
  return isHostAuthorizedForFirebaseAuth(window.location.hostname);
})();

export const redirectToAuthorizedAuthHost = (): boolean => {
  if (isRunningOnAuthorizedAuthHost) return false;
  const redirectUrl = buildFallbackRedirectUrl();
  if (!redirectUrl) return false;
  console.warn('Domínio atual não autorizado para autenticação. Redirecionando para', redirectUrl);
  window.location.replace(redirectUrl);
  return true;
};

if (typeof window !== 'undefined' && !isRunningOnAuthorizedAuthHost) {
  redirectToAuthorizedAuthHost();
}

export const app: FirebaseApp = initializeApp(firebaseConfig);
export const auth: Auth = getAuth(app);
export const db: Firestore = getFirestore(app);
export const st: FirebaseStorage = getStorage(app);

function normalizeStorageSegment(part: string | number | null | undefined): string {
  if (part === null || part === undefined) return '';
  return `${part}`.replace(/^\/+|\/+$/g, '').trim();
}

export function joinStoragePath(...segments: Array<string | number | null | undefined>): string {
  return segments
    .flatMap(segment => normalizeStorageSegment(segment).split('/'))
    .map(segment => segment.trim())
    .filter(Boolean)
    .join('/');
}

export function uploadToStorage(
  path: string,
  data: Blob | ArrayBuffer | Uint8Array,
  metadata?: UploadMetadata,
): Promise<UploadResult> {
  const normalizedPath = joinStoragePath(path);
  return uploadBytes(storageRef(st, normalizedPath), data, metadata);
}

export function downloadFromStorage(path: string): Promise<string> {
  const normalizedPath = joinStoragePath(path);
  return getDownloadURL(storageRef(st, normalizedPath));
}

export async function deleteFromStorage(path: string): Promise<void> {
  const normalizedPath = joinStoragePath(path);
  await deleteObject(storageRef(st, normalizedPath));
}

export function describeFirebaseError(err: unknown): string {
  if (!err) return 'Erro desconhecido.';
  if (typeof err === 'string') return err;
  const anyErr = err as { code?: string; message?: string };
  const parts: string[] = [];
  if (anyErr.code) parts.push(`${anyErr.code}`);
  if (anyErr.message) parts.push(`${anyErr.message}`);
  if (parts.length === 0) {
    try {
      return JSON.stringify(err);
    } catch {
      return String(err);
    }
  }
  return parts.join(' - ');
}

export function describeFirebaseStorageError(err: unknown): string {
  return describeFirebaseError(err);
}

export const provider = new GoogleAuthProvider();

export { storageRef as ref, storageRef as sRef };

export {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
};
