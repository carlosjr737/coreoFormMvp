// src/firebase.ts
import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
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

/* =========================================================
   ENV helper: prioriza VITE_FB_* e cai para VITE_FIREBASE_*
   ========================================================= */
const env = (kFB: string, kFirebase: string) =>
  (import.meta.env as any)[kFB] ?? (import.meta.env as any)[kFirebase] ?? '';

const firebaseConfig = {
  apiKey:            env('VITE_FB_API_KEY',            'VITE_FIREBASE_API_KEY'),
  authDomain:        env('VITE_FB_AUTH_DOMAIN',        'VITE_FIREBASE_AUTH_DOMAIN'),
  projectId:         env('VITE_FB_PROJECT_ID',         'VITE_FIREBASE_PROJECT_ID'),
  storageBucket:     env('VITE_FB_STORAGE_BUCKET',     'VITE_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: env('VITE_FB_MESSAGING_SENDER_ID','VITE_FIREBASE_MESSAGING_SENDER_ID'),
  appId:             env('VITE_FB_APP_ID',             'VITE_FIREBASE_APP_ID'),
} as const;

// Falhe cedo se faltar algo (evita auth/invalid-api-key)
for (const [k, v] of Object.entries(firebaseConfig)) {
  if (!v) {
    console.error('Missing Firebase env:', k);
    throw new Error(`Missing Firebase env: ${k}`);
  }
}

/* =========================================================
   Autorização de domínios para Auth (seu código original)
   ========================================================= */
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
  value ? value.split(',').map((e) => e.trim()).filter(Boolean) : [];

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

registerHost((import.meta.env as any).VITE_FIREBASE_AUTH_FALLBACK_DOMAIN ?? null);
registerHost(firebaseConfig.authDomain);

if (firebaseConfig.projectId) {
  registerHost(`${firebaseConfig.projectId}.firebaseapp.com`);
  registerHost(`${firebaseConfig.projectId}.web.app`);
}

['localhost', '127.0.0.1', '::1', '[::1]'].forEach(registerHost);

const extraDomains = parseHostList((import.meta.env as any).VITE_FIREBASE_AUTHORIZED_DOMAINS);
extraDomains.forEach((entry) => {
  if (entry.startsWith('*.')) registerWildcardHost(entry.slice(2));
  else registerHost(entry);
});

const wildcardSuffixes = parseHostList((import.meta.env as any).VITE_FIREBASE_AUTHORIZED_WILDCARDS);
wildcardSuffixes.forEach(registerWildcardHost);

const fallbackAuthHost = (() => {
  const explicitFallback = normalizeHost((import.meta.env as any).VITE_FIREBASE_AUTH_FALLBACK_DOMAIN ?? null);
  if (explicitFallback) return explicitFallback;
  const normalizedConfigDomain = normalizeHost(firebaseConfig.authDomain);
  if (normalizedConfigDomain) return normalizedConfigDomain;
  if (firebaseConfig.projectId) return normalizeHost(`${firebaseConfig.projectId}.firebaseapp.com`);
  return null;
})();

if (fallbackAuthHost) literalAuthHosts.add(fallbackAuthHost);

const hostMatchesWildcard = (host: string, matcher: HostMatcher) =>
  !!matcher.suffix && (host === matcher.suffix || host.endsWith(`.${matcher.suffix}`));

const isHostAuthorizedForFirebaseAuth = (host: string): boolean => {
  const normalized = normalizeHost(host);
  if (!normalized) return false;
  if (literalAuthHosts.has(normalized)) return true;
  return wildcardAuthHosts.some((m) => hostMatchesWildcard(normalized, m));
};

const buildFallbackRedirectUrl = (): string | null => {
  if (typeof window === 'undefined' || !fallbackAuthHost) return null;
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

/* =========================================================
   Inicialização do Firebase (idempotente)
   ========================================================= */
const app: FirebaseApp = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export { app };

export const auth: Auth = getAuth(app);
export const db: Firestore = getFirestore(app);
export const st: FirebaseStorage = getStorage(app);

/* =========================================================
   Helpers de Storage + utilitários e re-exports
   ========================================================= */
function normalizeStorageSegment(part: string | number | null | undefined): string {
  if (part === null || part === undefined) return '';
  return `${part}`.replace(/^\/+|\/+$/g, '').trim();
}

export function joinStoragePath(...segments: Array<string | number | null | undefined>): string {
  return segments
    .flatMap((segment) => normalizeStorageSegment(segment).split('/'))
    .map((segment) => segment.trim())
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
    try { return JSON.stringify(err); } catch { return String(err); }
  }
  return parts.join(' - ');
}

export function describeFirebaseStorageError(err: unknown): string {
  return describeFirebaseError(err);
}

export const provider = new GoogleAuthProvider();
export { storageRef as ref, storageRef as sRef };

// Re-exports usados pelo restante do app
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
