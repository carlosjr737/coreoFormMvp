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
  apiKey:            env('VITE_FB_API_KEY',             'VITE_FIREBASE_API_KEY'),
  authDomain:        env('VITE_FB_AUTH_DOMAIN',         'VITE_FIREBASE_AUTH_DOMAIN'),
  projectId:         env('VITE_FB_PROJECT_ID',          'VITE_FIREBASE_PROJECT_ID'),
  storageBucket:     env('VITE_FB_STORAGE_BUCKET',      'VITE_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: env('VITE_FB_MESSAGING_SENDER_ID', 'VITE_FIREBASE_MESSAGING_SENDER_ID'),
  appId:             env('VITE_FB_APP_ID',              'VITE_FIREBASE_APP_ID'),
} as const;

// Falhe cedo se faltar algo (evita auth/invalid-api-key)
for (const [k, v] of Object.entries(firebaseConfig)) {
  if (!v) {
    console.error('Missing Firebase env:', k);
    throw new Error(`Missing Firebase env: ${k}`);
  }
}

/* =========================================================
   Autorização de domínios para Auth (somente checagem local)
   ========================================================= */
type HostMatcher = { suffix?: string };

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

const parseHostList = (value?: string): string[] =>
  value ? value.split(',').map((e) => e.trim()).filter(Boolean) : [];

const literalAuthHosts = new Set<string>();
const wildcardAuthHosts: HostMatcher[] = [];

const registerHost = (host?: string | null) => {
  const normalized = normalizeHost(host);
  if (normalized) literalAuthHosts.add(normalized);
};

const registerWildcardHost = (host?: string | null) => {
  const normalized = normalizeHost(host);
  if (normalized) wildcardAuthHosts.push({ suffix: normalized });
};

// hosts explícitos
registerHost(firebaseConfig.authDomain);

// hosts padrão de dev
['localhost', '127.0.0.1', '::1', '[::1]'].forEach(registerHost);

// extras por env (ex.: coreo-form-mvp.vercel.app)
parseHostList((import.meta.env as any).VITE_FIREBASE_AUTHORIZED_DOMAINS).forEach((entry) => {
  if (entry.startsWith('*.')) registerWildcardHost(entry.slice(2));
  else registerHost(entry);
});

// curingas extras
parseHostList((import.meta.env as any).VITE_FIREBASE_AUTHORIZED_WILDCARDS).forEach(registerWildcardHost);

// fallback só se explicitamente configurado por env (NÃO inferir firebaseapp.com)
const fallbackAuthHost = normalizeHost((import.meta.env as any).VITE_FIREBASE_AUTH_FALLBACK_DOMAIN ?? null);

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

// status de host (apenas informativo)
export const isRunningOnAuthorizedAuthHost = (() => {
  if (typeof window === 'undefined') return true;
  return isHostAuthorizedForFirebaseAuth(window.location.hostname);
})();

// redireciona para fallback SOMENTE se o fallback existir
export const redirectToAuthorizedAuthHost = (): boolean => {
  if (isRunningOnAuthorizedAuthHost) return false;
  if (!fallbackAuthHost) return false; // sem fallback definido, não redireciona
  const redirectUrl = buildFallbackRedirectUrl();
  if (!redirectUrl) return false;
  console.warn('Domínio atual não autorizado para autenticação. Redirecionando para', redirectUrl);
  window.location.replace(redirectUrl);
  return true;
};

// ⚠️ Não faça redirecionamento automático no boot.
// Apenas loga um aviso para diagnóstico local:
if (typeof window !== 'undefined' && !isRunningOnAuthorizedAuthHost) {
  console.warn(
    '[Auth] Host não listado localmente. Se o domínio estiver autorizado no Firebase Console, o login por popup funcionará.'
  );
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

export async function uploadToStorage(
  path: string,
  data: Blob | ArrayBuffer | Uint8Array,
  metadata?: UploadMetadata,
): Promise<UploadResult> {
  const ref = storageRef(st, joinStoragePath(path));
  // Garante um contentType válido mesmo se não vier do chamador
  const contentType =
    (metadata as any)?.contentType ||
    (data as any)?.type ||
    'application/octet-stream';
  const meta: UploadMetadata = { contentType, ...metadata };
  return uploadBytes(ref, data as any, meta);
}

export function downloadFromStorage(path: string): Promise<string> {
  return getDownloadURL(storageRef(st, joinStoragePath(path)));
}

export async function deleteFromStorage(path: string): Promise<void> {
  await deleteObject(storageRef(st, joinStoragePath(path)));
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
