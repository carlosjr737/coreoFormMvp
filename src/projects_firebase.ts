// src/projects_firebase.ts
import { db as localDb } from './state';
import { dbFs, st } from './firebase';
import {
  doc, setDoc, getDoc, getDocs, collection, serverTimestamp
} from 'firebase/firestore';
import {
  ref, uploadBytes, getDownloadURL, deleteObject
} from 'firebase/storage';
import { ensureAudioContext, getAudioBuffer } from './audio';

// Tipos simples
type ProjectMeta = {
  id: string;
  titulo: string;
  updatedAt: number;
  hasAudio: boolean;
  durationSec: number;
};

// util
function now() { return Date.now(); }

export async function createNewProjectFirebase(titulo = 'Coreografia'): Promise<string> {
  const id = `p${now()}`;
  // zera seu estado local
  localDb.projeto   = { id, titulo };
  localDb.formacoes = [];
  return id;
}

export async function saveProjectFirebase(projectId?: string): Promise<string> {
  const id = projectId || localDb.projeto?.id || `p${now()}`;
  localDb.projeto = localDb.projeto || { id, titulo: 'Coreografia' };

  // 1) salva JSON no Storage
  const stateBlob = new Blob([JSON.stringify(localDb)], { type: 'application/json' });
  await uploadBytes(ref(st, `projects/${id}/state.json`), stateBlob);

  // 2) se houver áudio decodificado, salve também o arquivo bruto se você o tiver (opcional).
  // Se seu fluxo já guarda o Blob do áudio original, suba aqui. Como fallback, só meta a flag.
  const hasAudio = !!getAudioBuffer();
  // 3) metadados no Firestore
  const durationSec = localDb.formacoes
    .reduce((a,f)=> a + f.tempoTransicaoEntradaSegundos + f.duracaoSegundos, 0);

  const meta: ProjectMeta = {
    id,
    titulo: localDb.projeto.titulo || 'Coreografia',
    updatedAt: now(),
    hasAudio,
    durationSec
  };
  await setDoc(doc(dbFs, 'projects', id), { ...meta, updatedAtTS: serverTimestamp() });
  return id;
}

export async function listProjectsFirebase(): Promise<Array<{id:string; titulo:string}>> {
  const snap = await getDocs(collection(dbFs, 'projects'));
  return snap.docs
    .map(d => d.data() as any)
    .sort((a,b)=> (b.updatedAt||0) - (a.updatedAt||0))
    .map(p => ({ id: p.id, titulo: p.titulo }));
}

export async function openProjectFirebase(id: string): Promise<void> {
  const url = await getDownloadURL(ref(st, `projects/${id}/state.json`));
  const json = await (await fetch(url)).json();
  // aplica no estado
  Object.assign(localDb, json);
}

export async function deleteProjectFirebase(id: string): Promise<void> {
  // apaga arquivos conhecidos; ignore erros
  await Promise.allSettled([
    deleteObject(ref(st, `projects/${id}/state.json`)),
  ]);
  // Firestore
  // (Você pode também deletar o doc do Firestore se quiser)
}
