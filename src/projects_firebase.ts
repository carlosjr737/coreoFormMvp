// src/projects_firebase.ts
import { db as localDb, getCurrentProjectId, setCurrentProjectId } from './state';
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
  setCurrentProjectId(id);
  clearAudio();
  return id;
}

export async function saveProjectFirebase(projectId?: string): Promise<string> {
  const id = projectId || localDb.projeto?.id || `p${now()}`;
  if (!localDb.projeto) localDb.projeto = { id, titulo: 'Coreografia' };
  localDb.projeto.id = id;
  setCurrentProjectId(id);

  // 1) estado (JSON) no Storage
  const stateBlob = new Blob([JSON.stringify(localDb)], { type: 'application/json' });
  try {
    await uploadBytes(sRef(st, `projects/${id}/state.json`), stateBlob);
  } catch (err) {
    console.error('Falha ao salvar estado do projeto no Storage', err);
    alert('Não foi possível salvar o projeto no Firebase Storage. Verifique as regras de acesso e tente novamente.');
    throw err;
  }

  const projectAudioBuffer = getAudioBuffer();
  const projectAudioBlob = getAudioFileBlob();
  const projectAudioFileName = getAudioFileName();
  const projectAudioContentType = getAudioFileContentType();
  const audioRef = sRef(st, `projects/${id}/${AUDIO_STORAGE_KEY}`);

  if (projectAudioBuffer && projectAudioBlob) {
    try {
      await uploadBytes(
        audioRef,
        projectAudioBlob,
        projectAudioContentType ? { contentType: projectAudioContentType } : undefined,
      );
    } catch (err) {
      console.error('Falha ao enviar áudio do projeto', err);
      alert('Não foi possível salvar o áudio do projeto no Firebase Storage. Verifique as regras de acesso e tente novamente.');
      throw err;
    }
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
    hasAudio: !!projectAudioBuffer,
    durationSec,
    audioFileName: projectAudioBuffer ? (projectAudioFileName || null) : null,
    audioContentType: projectAudioBuffer ? (projectAudioContentType || null) : null,
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
  setCurrentProjectId(id);
  const requestId = id;
  clearAudio();

  try {
    const [stateUrl, metaSnap] = await Promise.all([
      getDownloadURL(sRef(st, `projects/${id}/state.json`)),
      getDoc(doc(db, 'projects', id)).catch(() => null),
    ]);

    if (getCurrentProjectId() !== requestId) {
      return;
    }

    const json = await (await fetch(stateUrl)).json();
    Object.assign(localDb, json);

    if (getCurrentProjectId() !== requestId) {
      return;
    }

    const meta = metaSnap?.exists() ? (metaSnap.data() as ProjectMeta) : null;
    if (meta?.hasAudio) {
      try {
        setAudioStatusMessage('Carregando áudio...');
        const audioUrl = await getDownloadURL(sRef(st, `projects/${id}/${AUDIO_STORAGE_KEY}`));
        if (getCurrentProjectId() !== requestId) return;
        const blob = await (await fetch(audioUrl)).blob();
        if (getCurrentProjectId() !== requestId) return;
        await setAudioFromBlob(blob, {
          fileName: meta.audioFileName || undefined,
          contentType: meta.audioContentType || blob.type || undefined,
        });
      } catch (err) {
        console.error('Falha ao carregar áudio do projeto', err);
        clearAudio();
      }
    }
  } catch (err) {
    if (getCurrentProjectId() === requestId) {
      console.error('Falha ao carregar projeto do Firebase', err);
      alert('Não foi possível carregar o projeto selecionado. Verifique as permissões do Firebase Storage e tente novamente.');
      throw err;
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
