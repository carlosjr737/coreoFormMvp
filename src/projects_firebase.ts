// src/projects_firebase.ts
import { db as localDb } from './state';
import {
  getAudioBuffer,
  getAudioFileBlob,
  getAudioFileContentType,
  getAudioFileName,
  setAudioFromBlob,
  clearAudio,
  setAudioStatusMessage,
} from './audio';

import {
  db, st,
  collection, doc, getDoc, getDocs, setDoc, serverTimestamp,
  sRef, uploadBytes, getDownloadURL, deleteObject
} from './firebase';

type ProjectMeta = {
  id: string;
  titulo: string;
  updatedAt: number;
  hasAudio: boolean;
  durationSec: number;
  audioFileName?: string | null;
  audioContentType?: string | null;
};

function now() { return Date.now(); }

const AUDIO_STORAGE_KEY = 'audio.bin';

export async function createNewProjectFirebase(titulo = 'Coreografia'): Promise<string> {
  const id = `p${now()}`;
  localDb.projeto   = { id, titulo };
  localDb.formacoes = [];
  clearAudio();
  return id;
}

export async function saveProjectFirebase(projectId?: string): Promise<string> {
  const id = projectId || localDb.projeto?.id || `p${now()}`;
  if (!localDb.projeto) localDb.projeto = { id, titulo: 'Coreografia' };
  localDb.projeto.id = id;

  // 1) estado (JSON) no Storage
  const stateBlob = new Blob([JSON.stringify(localDb)], { type: 'application/json' });
  await uploadBytes(sRef(st, `projects/${id}/state.json`), stateBlob);

  const audioBuffer = getAudioBuffer();
  const audioBlob = getAudioFileBlob();
  const audioFileName = getAudioFileName();
  const audioContentType = getAudioFileContentType();
  const audioRef = sRef(st, `projects/${id}/${AUDIO_STORAGE_KEY}`);

  if (audioBuffer && audioBlob) {
    await uploadBytes(audioRef, audioBlob, audioContentType ? { contentType: audioContentType } : undefined);
  } else {
    try {
      await deleteObject(audioRef);
    } catch (err: any) {
      // ignora se não existir
      if (err?.code !== 'storage/object-not-found') console.warn('Falha ao remover áudio do projeto', err);
    }
  }

  // 2) metadados no Firestore
  const durationSec = (localDb.formacoes || [])
    .reduce((a,f)=> a + (f.tempoTransicaoEntradaSegundos||0) + (f.duracaoSegundos||0), 0);

  const meta: ProjectMeta = {
    id,
    titulo: localDb.projeto.titulo || 'Coreografia',
    updatedAt: now(),
    hasAudio: !!audioBuffer,
    durationSec,
    audioFileName: audioBuffer ? (audioFileName || null) : null,
    audioContentType: audioBuffer ? (audioContentType || null) : null,
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
  clearAudio();

  const [stateUrl, metaSnap] = await Promise.all([
    getDownloadURL(sRef(st, `projects/${id}/state.json`)),
    getDoc(doc(db, 'projects', id)).catch(() => null),
  ]);

  const json = await (await fetch(stateUrl)).json();
  Object.assign(localDb, json);

  const meta = metaSnap?.exists() ? (metaSnap.data() as ProjectMeta) : null;
  if (meta?.hasAudio) {
    try {
      setAudioStatusMessage('Carregando áudio...');
      const audioUrl = await getDownloadURL(sRef(st, `projects/${id}/${AUDIO_STORAGE_KEY}`));
      const blob = await (await fetch(audioUrl)).blob();
      await setAudioFromBlob(blob, {
        fileName: meta.audioFileName || undefined,
        contentType: meta.audioContentType || blob.type || undefined,
      });
    } catch (err) {
      console.error('Falha ao carregar áudio do projeto', err);
      clearAudio();
    }
  }
}

export async function deleteProjectFirebase(id: string): Promise<void> {
  await Promise.allSettled([
    deleteObject(sRef(st, `projects/${id}/state.json`)),
    deleteObject(sRef(st, `projects/${id}/${AUDIO_STORAGE_KEY}`)),
  ]);
  // Se quiser, apague o doc:
  // await deleteDoc(doc(db, 'projects', id));
}
