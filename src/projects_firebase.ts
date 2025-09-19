// src/projects_firebase.ts

import { db as localDb, getCurrentProjectId, setCurrentProjectId } from './state';
import { getUser } from './auth';

import {
  getAudioBuffer,
  getAudioFileBlob,
  getAudioFileContentType,
  getAudioFileName,

  refreshAudioStatusLabel,

  setAudioFromBlob,
  clearAudio,
  setAudioStatusMessage,
} from './audio';

import {

  db,
  collection, doc, getDoc, getDocs, setDoc, serverTimestamp,
  uploadToStorage,
  downloadFromStorage,
  deleteFromStorage,
  joinStoragePath,
  describeFirebaseStorageError,

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


function projectStatePath(id: string) {
  return joinStoragePath('projects', id, 'state.json');
}

function projectAudioPath(id: string) {
  return joinStoragePath('projects', id, AUDIO_STORAGE_KEY);
}

export async function createNewProjectFirebase(titulo = 'Coreografia'): Promise<string> {
  const id = `p${now()}`;
  localDb.projeto   = { id, titulo };
  localDb.formacoes = [];

  setCurrentProjectId(id);

  clearAudio();
  return id;
}

function describeFirebaseError(err: unknown): string {
  if (!err) return 'Erro desconhecido.';
  if (typeof err === 'string') return err;
  const anyErr = err as { code?: string; message?: string };
  const code = anyErr?.code ? `${anyErr.code}` : '';
  const msg = anyErr?.message ? `${anyErr.message}` : '';
  if (code && msg) return `${code} - ${msg}`;
  if (code) return code;
  if (msg) return msg;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

export async function saveProjectFirebase(projectId?: string): Promise<string> {
  const user = getUser();
  if (!user) {
    throw new Error('Não autenticado.');
  }
  const id = projectId || localDb.projeto?.id || `p${now()}`;
  if (!localDb.projeto) localDb.projeto = { id, titulo: 'Coreografia' };
  localDb.projeto.id = id;

  setCurrentProjectId(id);


  // 1) estado (JSON) no Storage
  const stateBlob = new Blob([JSON.stringify(localDb)], { type: 'application/json' });
  try {

    await uploadToStorage(projectStatePath(id), stateBlob, { contentType: 'application/json' });

  } catch (err) {
    console.error('Falha ao salvar estado do projeto no Storage', err);
    alert('Não foi possível salvar o projeto no Firebase Storage. Verifique as regras de acesso e tente novamente.');
    throw err;
  }

  const projectAudioBuffer = getAudioBuffer();
  const projectAudioBlob = getAudioFileBlob();
  const projectAudioFileName = getAudioFileName();
  const projectAudioContentType = getAudioFileContentType();

  const audioPath = projectAudioPath(id);

  if (projectAudioBuffer && projectAudioBlob) {
    try {
      setAudioStatusMessage('Enviando áudio para o Firebase...');
      await uploadToStorage(
        audioPath,
        projectAudioBlob,
        projectAudioContentType ? { contentType: projectAudioContentType } : undefined,
      );
      refreshAudioStatusLabel();
    } catch (err) {
      console.error('Falha ao enviar áudio do projeto', err);
      const detail = describeFirebaseStorageError(err);
      setAudioStatusMessage('Erro ao salvar áudio');
      alert(`Não foi possível salvar o áudio do projeto no Firebase Storage.\n${detail}\nVerifique as regras de acesso e tente novamente.`);

      throw err;
    }
  } else {
    try {

      await deleteFromStorage(audioPath);
    } catch (err: any) {
      // ignora se não existir
      if (err?.code !== 'storage/object-not-found') {
        const detail = describeFirebaseStorageError(err);

        console.warn('Falha ao remover áudio do projeto', err);
        setAudioStatusMessage('Erro ao remover áudio');
        alert(`Não foi possível remover o áudio associado a este projeto.\n${detail}\nVerifique as permissões do Firebase Storage e tente novamente.`);
      }
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
  if (!getUser()) {
    return [];
  }
  const snap = await getDocs(collection(db, 'projects'));
  return snap.docs
    .map(d => d.data() as any)
    .sort((a,b)=> (b.updatedAt||0) - (a.updatedAt||0))
    .map(p => ({ id: p.id, titulo: p.titulo }));
}

export async function openProjectFirebase(id: string): Promise<void> {
  const user = getUser();
  if (!user) {
    throw new Error('Não autenticado.');
  }
  setCurrentProjectId(id);
  const requestId = id;
  clearAudio();

  try {
    const [stateUrl, metaSnap] = await Promise.all([

      downloadFromStorage(projectStatePath(id)),

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

        const audioUrl = await downloadFromStorage(projectAudioPath(id));

        if (getCurrentProjectId() !== requestId) return;
        const blob = await (await fetch(audioUrl)).blob();
        if (getCurrentProjectId() !== requestId) return;
        await setAudioFromBlob(blob, {
          fileName: meta.audioFileName || undefined,
          contentType: meta.audioContentType || blob.type || undefined,
        });
      } catch (err) {
        console.error('Falha ao carregar áudio do projeto', err);

        setAudioStatusMessage('Erro ao carregar áudio');
        if ((err as any)?.code === 'storage/object-not-found') {
          console.warn('Áudio do projeto não encontrado no Storage; prosseguindo sem áudio.', err);
          clearAudio();
        } else {
          const detail = describeFirebaseStorageError(err);
          alert(`Não foi possível carregar o áudio deste projeto.\n${detail}\nVerifique as permissões do Firebase Storage e tente novamente.`);
          clearAudio();
        }

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
  const user = getUser();
  if (!user) {
    throw new Error('Não autenticado.');
  }
  await Promise.allSettled([

    deleteFromStorage(projectStatePath(id)),
    deleteFromStorage(projectAudioPath(id)),

  ]);
  // Se quiser, apague o doc:
  // await deleteDoc(doc(db, 'projects', id));
}
