// src/persist.ts

import { db, st, sRef, uploadBytes, getDownloadURL, deleteObject } from './firebase';
import { getUser } from './auth';
import {
  collection, setDoc, getDocs, doc, getDoc,
  serverTimestamp, query, orderBy
} from 'firebase/firestore';
import * as State from './state';
import { setCurrentProjectId, getCurrentProjectId } from './state';
import { renderizarTudo } from './timeline';
import { btnSalvarProjeto, btnNovoProjeto, selProjeto } from './dom';
import {
  clearAudio,
  getAudioBuffer,
  getAudioFileBlob,
  getAudioFileContentType,
  getAudioFileName,
  refreshAudioStatusLabel,
  setAudioFromBlob,
  setAudioStatusMessage,
} from './audio';

type ProjetoDoc = {
  title: string;
  updatedAt: any;
  createdAt: any;
  db: any; // snapshot do State.db
  hasAudio?: boolean;
  audioFileName?: string | null;
  audioContentType?: string | null;
  audioUpdatedAt?: any;
};

const AUDIO_STORAGE_KEY = 'audio.bin';

function projectAudioRef(userId: string, projectId: string) {
  return sRef(st, `users/${userId}/projects/${projectId}/${AUDIO_STORAGE_KEY}`);
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

export async function listProjects(): Promise<{id:string; title:string}[]> {
  const user = getUser();
  if (!user) return [];
  const colRef = collection(db, 'users', user.uid, 'projects');
  const q = query(colRef, orderBy('updatedAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, title: (d.data() as any).title || '(sem título)' }));
}

export async function loadProject(projectId: string) {
  const user = getUser();
  if (!user) throw new Error('Não autenticado.');
  const requestId = projectId;
  setCurrentProjectId(requestId);
  localStorage.setItem('lastProjectId', requestId);
  clearAudio();

  const ref = doc(db, 'users', user.uid, 'projects', projectId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Projeto não encontrado');
  const data = snap.data() as ProjetoDoc;

  if (getCurrentProjectId() !== requestId) return;

  // aplica no State.db
  State.db.projeto = data.db?.projeto ?? State.db.projeto;
  State.db.projeto.id = projectId;
  State.db.formacoes = Array.isArray(data.db?.formacoes) ? data.db.formacoes : [];

  document.dispatchEvent(new CustomEvent('db-changed', { detail: { reason: 'load-project' }}));
  renderizarTudo(true);

  if (data.hasAudio) {
    try {
      setAudioStatusMessage('Carregando áudio...');
      const audioUrl = await getDownloadURL(projectAudioRef(user.uid, projectId));
      if (getCurrentProjectId() !== requestId) return;
      const blob = await (await fetch(audioUrl)).blob();
      if (getCurrentProjectId() !== requestId) return;
      await setAudioFromBlob(blob, {
        fileName: data.audioFileName || undefined,
        contentType: data.audioContentType || blob.type || undefined,
      });
    } catch (err: any) {
      if (getCurrentProjectId() === requestId) {
        console.error('Falha ao carregar áudio do projeto', err);
        const detail = describeFirebaseError(err);
        alert(`Não foi possível carregar o áudio deste projeto.\n${detail}\nVerifique as permissões do Firebase Storage e tente novamente.`);
        clearAudio();
      }
    }
  }
}

export async function saveProject(explicitId?: string) {
  const user = getUser();
  if (!user) throw new Error('Não autenticado.');

  const colRef = collection(db, 'users', user.uid, 'projects');
  let targetId = explicitId || getCurrentProjectId() || State.db.projeto?.id || null;
  const docRef = targetId ? doc(colRef, targetId) : doc(colRef);
  if (!targetId) targetId = docRef.id;

  // garante que o snapshot salvo tenha o ID correto
  State.db.projeto.id = targetId;
  if (!State.db.projeto.titulo) State.db.projeto.titulo = 'Projeto sem título';

  const audioBuffer = getAudioBuffer();
  const audioBlob = getAudioFileBlob();
  const audioFileName = getAudioFileName();
  const audioContentType = getAudioFileContentType();
  const hasAudio = !!audioBuffer && !!audioBlob;

  const payload: ProjetoDoc = {
    title: State.db?.projeto?.titulo || 'Projeto sem título',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    db: JSON.parse(JSON.stringify(State.db)),
    hasAudio,
    audioFileName: hasAudio ? (audioFileName || null) : null,
    audioContentType: hasAudio ? (audioContentType || null) : null,
    audioUpdatedAt: hasAudio ? serverTimestamp() : null,
  };

  const audioRef = projectAudioRef(user.uid, targetId);
  if (hasAudio && audioBlob) {
    try {
      setAudioStatusMessage('Enviando áudio para o Firebase...');
      await uploadBytes(
        audioRef,
        audioBlob,
        audioContentType ? { contentType: audioContentType } : undefined,
      );
      refreshAudioStatusLabel();
    } catch (err) {
      console.error('Falha ao enviar áudio do projeto', err);
      const detail = describeFirebaseError(err);
      setAudioStatusMessage('Erro ao salvar áudio');
      alert(`Não foi possível salvar o áudio do projeto no Firebase Storage.\n${detail}\nVerifique as regras de acesso e tente novamente.`);
      throw err;
    }
  } else {
    try {
      await deleteObject(audioRef);
    } catch (err: any) {
      if (err?.code !== 'storage/object-not-found') {
        const detail = describeFirebaseError(err);
        console.warn('Falha ao remover áudio do projeto', err);
        setAudioStatusMessage('Erro ao remover áudio');
        alert(`Não foi possível remover o áudio associado a este projeto.\n${detail}\nVerifique as permissões do Firebase Storage e tente novamente.`);
      }
    }
  }

  await setDoc(docRef, payload, { merge: true });

  setCurrentProjectId(targetId);
  localStorage.setItem('lastProjectId', targetId);
}

export async function createNewProject(title = 'Novo projeto') {
  // zera e coloca título
  State.db.projeto.titulo = title;
  State.db.formacoes = [];
  setCurrentProjectId(null);
  clearAudio();

  document.dispatchEvent(new CustomEvent('db-changed', { detail: { reason: 'new-project' }}));
  renderizarTudo(true);

  await saveProject(); // cria no Firestore e define o ID
}

export async function refreshProjectListUI() {
    if (!selProjeto) return;
  
    selProjeto.innerHTML = '';
    const items = await listProjects();
  
    for (const it of items) {
      const opt = document.createElement('option');
      opt.value = it.id; opt.textContent = it.title || '(sem título)';
      selProjeto.appendChild(opt);
    }
  
    // alvo: current -> lastLocal -> primeiro da lista
    const cur   = getCurrentProjectId();
    const last  = localStorage.getItem('lastProjectId');
    const has   = (id:string|null) => !!id && items.some(i=>i.id === id);
  
    let targetId: string | null =
        (has(cur)  ? cur :
        (has(last) ? last :
        (items[0]?.id || null)));
  
    if (targetId) {
      selProjeto.value = targetId;
      // se ainda não está carregado, carrega agora
      if (cur !== targetId) {
        await loadProject(targetId);
      }
    }
  }
  

export function initPersistenceUI() {
  btnSalvarProjeto?.addEventListener('click', async () => {
    try {
      await saveProject(getCurrentProjectId() || undefined);
      await refreshProjectListUI();
      btnSalvarProjeto.textContent = 'Salvo ✓';
      setTimeout(() => (btnSalvarProjeto.textContent = 'Salvar'), 1000);
    } catch (e) { console.error(e); }
  });

  btnNovoProjeto?.addEventListener('click', async () => {
    const nome = prompt('Nome do novo projeto:', 'Novo projeto');
    if (nome === null) return;
    try {
      await createNewProject(nome || 'Novo projeto');
      await refreshProjectListUI();
    } catch (e) { console.error(e); }
  });

  selProjeto?.addEventListener('change', async () => {
    const id = selProjeto.value;
    if (!id) return;
    try {
      await loadProject(id);
      await refreshProjectListUI();
    } catch (e) { console.error(e); }
  });

  // quando logar/deslogar, atualiza dropdown
  document.addEventListener('auth-changed' as any, () => {
    refreshProjectListUI();
  });
}
