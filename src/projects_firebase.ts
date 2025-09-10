// src/projects_firebase.ts
import { db as localDb } from './state';
import { getAudioBuffer } from './audio';

import {
  db, st,
  collection, doc, getDocs, setDoc, serverTimestamp,
  sRef, uploadBytes, getDownloadURL, deleteObject
} from './firebase';

type ProjectMeta = {
  id: string;
  titulo: string;
  updatedAt: number;
  hasAudio: boolean;
  durationSec: number;
};

function now() { return Date.now(); }

export async function createNewProjectFirebase(titulo = 'Coreografia'): Promise<string> {
  const id = `p${now()}`;
  localDb.projeto   = { id, titulo };
  localDb.formacoes = [];
  return id;
}

export async function saveProjectFirebase(projectId?: string): Promise<string> {
  const id = projectId || localDb.projeto?.id || `p${now()}`;
  if (!localDb.projeto) localDb.projeto = { id, titulo: 'Coreografia' };

  // 1) estado (JSON) no Storage
  const stateBlob = new Blob([JSON.stringify(localDb)], { type: 'application/json' });
  await uploadBytes(sRef(st, `projects/${id}/state.json`), stateBlob);

  // 2) metadados no Firestore
  const durationSec = (localDb.formacoes || [])
    .reduce((a,f)=> a + (f.tempoTransicaoEntradaSegundos||0) + (f.duracaoSegundos||0), 0);

  const meta: ProjectMeta = {
    id,
    titulo: localDb.projeto.titulo || 'Coreografia',
    updatedAt: now(),
    hasAudio: !!getAudioBuffer(),
    durationSec
  };

  await setDoc(doc(db, 'projects', id), { ...meta, updatedAtTS: serverTimestamp() }, { merge: true });
  return id;
}

export async function listProjectsFirebase(): Promise<Array<{id:string; titulo:string}>> {
  const snap = await getDocs(collection(db, 'projects'));
  return snap.docs
    .map(d => d.data() as any)
    .sort((a,b)=> (b.updatedAt||0) - (a.updatedAt||0))
    .map(p => ({ id: p.id, titulo: p.titulo }));
}

export async function openProjectFirebase(id: string): Promise<void> {
  const url = await getDownloadURL(sRef(st, `projects/${id}/state.json`));
  const json = await (await fetch(url)).json();
  Object.assign(localDb, json);
}

export async function deleteProjectFirebase(id: string): Promise<void> {
  await Promise.allSettled([
    deleteObject(sRef(st, `projects/${id}/state.json`)),
  ]);
  // Se quiser, apague o doc:
  // await deleteDoc(doc(db, 'projects', id));
}
