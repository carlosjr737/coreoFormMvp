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
  type Auth
} from 'firebase/auth';
import {
  getFirestore, type Firestore,
  collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc, serverTimestamp
} from 'firebase/firestore';
import {
  getStorage,
  type FirebaseStorage,
  ref as storageRef,
  uploadBytes as uploadBytesNative,
  getDownloadURL as getDownloadURLNative,
  deleteObject as deleteObjectNative,
  type UploadMetadata,
  type UploadResult,
} from 'firebase/storage';

const DEFAULT_PROJECT_ID = "pinaform-a5fec";

function sanitizeBucketName(raw?: string | null): string | undefined {
  if (!raw) return undefined;
  return raw.replace(/^gs:\/\//i, '').trim() || undefined;
}

const envProjectId = import.meta?.env?.VITE_FIREBASE_PROJECT_ID ?? null;
const projectId = (envProjectId && `${envProjectId}`.trim()) || DEFAULT_PROJECT_ID;

const envBucket = sanitizeBucketName(import.meta?.env?.VITE_FIREBASE_STORAGE_BUCKET ?? null);

const DEFAULT_BUCKET_SUFFIXES = ['appspot.com', 'firebasestorage.app'] as const;

function buildStorageBucketCandidates(project: string, explicit?: string | undefined): string[] {
  const normalized: string[] = [];
  if (explicit) normalized.push(explicit);
  for (const suffix of DEFAULT_BUCKET_SUFFIXES) {
    normalized.push(`${project}.${suffix}`);
  }
  return Array.from(new Set(normalized.filter(Boolean)));
}

const storageBucketCandidates = buildStorageBucketCandidates(projectId, envBucket);
const storageBucket = storageBucketCandidates[0];

// Variáveis de ambiente (ou usa os defaults abaixo)
const cfg = {
  apiKey:            import.meta?.env?.VITE_FIREBASE_API_KEY            ?? "AIzaSyBUd7mOWqTXP3E_dNAs-TXAeF9d_WE5rS4",
  authDomain:        import.meta?.env?.VITE_FIREBASE_AUTH_DOMAIN        ?? `${projectId}.firebaseapp.com`,
  projectId,
  storageBucket,
  messagingSenderId: import.meta?.env?.VITE_FIREBASE_MESSAGING_SENDER_ID?? "885677342214",
  appId:             import.meta?.env?.VITE_FIREBASE_APP_ID             ?? "1:885677342214:web:fe9f74a1065f0ec9ce4d87",
};

export const app: FirebaseApp = initializeApp(cfg);

// Núcleo
export const auth: Auth = getAuth(app);
export const db: Firestore = getFirestore(app);

const storageInstances: FirebaseStorage[] = (storageBucketCandidates.length ? storageBucketCandidates : [undefined])
  .map(bucket => (bucket ? getStorage(app, `gs://${bucket}`) : getStorage(app)));

let activeStorageIndex = 0;
let activeStorageBucket = storageBucketCandidates[activeStorageIndex] ?? storageBucket;

export let st: FirebaseStorage = storageInstances[activeStorageIndex];

function setActiveStorage(index: number) {
  activeStorageIndex = index;
  st = storageInstances[index];
  activeStorageBucket = storageBucketCandidates[index] ?? activeStorageBucket;
}

type StorageOperation<T> = (storage: FirebaseStorage, bucket: string) => Promise<T>;

function normalizeStorageSegment(part: string | number | null | undefined): string {
  if (part === null || part === undefined) return '';
  return `${part}`.replace(/^\/+|\/+$/g, '').trim();
}

export function joinStoragePath(...segments: Array<string | number | null | undefined>): string {
  return segments
    .flatMap(seg => normalizeStorageSegment(seg).split('/'))
    .map(seg => seg.trim())
    .filter(Boolean)
    .join('/');
}

function shouldRetryStorageError(err: unknown, remainingBuckets: number): boolean {
  if (remainingBuckets <= 0) return false;
  if (!err || typeof err !== 'object') return false;
  const code = (err as any)?.code ? String((err as any).code) : '';
  const message = (err as any)?.message ? String((err as any).message) : '';
  if (code === 'storage/object-not-found' || code === 'storage/unauthorized' || code === 'storage/bucket-not-found' || code === 'storage/unknown') {
    return true;
  }
  if (!message) return false;
  return /bucket|project|appspot|firebasestorage|permission|unauthorized/i.test(message);
}

async function runStorageOperation<T>(path: string, operation: StorageOperation<T>): Promise<T> {
  const indices = storageInstances.map((_, idx) => idx);
  if (activeStorageIndex !== 0) {
    const currentIdx = indices.indexOf(activeStorageIndex);
    if (currentIdx > 0) {
      indices.splice(currentIdx, 1);
      indices.unshift(activeStorageIndex);
    }
  }

  let lastError: unknown;

  for (let i = 0; i < indices.length; i++) {
    const index = indices[i];
    const storage = storageInstances[index];
    const bucket = storageBucketCandidates[index] ?? storageBucketCandidates[activeStorageIndex] ?? storageBucket ?? '';
    try {
      const result = await operation(storage, bucket);
      if (index !== activeStorageIndex) {
        setActiveStorage(index);
        console.info(`[firebase] usando bucket de armazenamento ${bucket}`);
      }
      return result;
    } catch (err) {
      lastError = err;
      const remaining = indices.length - (i + 1);
      const shouldRetry = shouldRetryStorageError(err, remaining);
      const bucketLabel = bucket ? `gs://${bucket}/${path}` : path;
      if (shouldRetry && remaining > 0) {
        console.warn(`[firebase] falha ao acessar ${bucketLabel}; tentando próximo bucket`, err);
        continue;
      }
      throw err;
    }
  }

  throw lastError ?? new Error('Falha ao executar operação no Firebase Storage.');
}

export function getActiveStorageBucket(): string | undefined {
  return activeStorageBucket;
}

export function getStorageBucketCandidates(): string[] {
  return [...storageBucketCandidates];
}

export async function uploadToStorage(
  path: string,
  data: Blob | ArrayBuffer | Uint8Array,
  metadata?: UploadMetadata,
): Promise<UploadResult> {
  const normalizedPath = joinStoragePath(path);
  return runStorageOperation(normalizedPath, async (storage, bucket) => {
    const result = await uploadBytesNative(storageRef(storage, normalizedPath), data, metadata);
    if (bucket) console.info(`[firebase] Upload concluído: gs://${bucket}/${normalizedPath}`);
    return result;
  });
}

export async function downloadFromStorage(path: string): Promise<string> {
  const normalizedPath = joinStoragePath(path);
  return runStorageOperation(normalizedPath, async (storage, bucket) => {
    const url = await getDownloadURLNative(storageRef(storage, normalizedPath));
    if (bucket) console.info(`[firebase] URL obtida para gs://${bucket}/${normalizedPath}`);
    return url;
  });
}

export async function deleteFromStorage(path: string): Promise<void> {
  const normalizedPath = joinStoragePath(path);
  await runStorageOperation(normalizedPath, async (storage, bucket) => {
    await deleteObjectNative(storageRef(storage, normalizedPath));
    if (bucket) console.info(`[firebase] Objeto removido: gs://${bucket}/${normalizedPath}`);
    return undefined;
  });
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
  const base = describeFirebaseError(err);
  const bucket = getActiveStorageBucket();
  const candidates = getStorageBucketCandidates().filter(b => b && b !== bucket);
  const extras: string[] = [];
  if (bucket) extras.push(`bucket ativo: ${bucket}`);
  if (candidates.length) extras.push(`alternativas: ${candidates.join(', ')}`);
  if (!extras.length) return base;
  const suffix = `(${extras.join(' | ')})`;
  return base ? `${base}\n${suffix}` : suffix;
}

// Provider de login
export const provider = new GoogleAuthProvider();

// Atalhos de Storage
export { storageRef as ref, storageRef as sRef };

// Re-exports (pra importar tudo só de './firebase')
export {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc, serverTimestamp,
};
