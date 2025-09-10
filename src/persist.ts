// src/persist.ts
import { dbx } from './firebase';
import { getUser } from './auth';
import {
  collection, addDoc, setDoc, getDocs, doc, getDoc,
  serverTimestamp, query, orderBy
} from 'firebase/firestore';
import * as State from './state';
import { setCurrentProjectId, getCurrentProjectId } from './state';
import { renderizarTudo } from './timeline';
import { btnSalvarProjeto, btnNovoProjeto, selProjeto } from './dom';

type ProjetoDoc = {
  title: string;
  updatedAt: any;
  createdAt: any;
  db: any; // snapshot do State.db
};

export async function listProjects(): Promise<{id:string; title:string}[]> {
  const user = getUser();
  if (!user) return [];
  const colRef = collection(dbx, 'users', user.uid, 'projects');
  const q = query(colRef, orderBy('updatedAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, title: (d.data() as any).title || '(sem título)' }));
}

export async function loadProject(projectId: string) {
  const user = getUser();
  if (!user) throw new Error('Não autenticado.');
  const ref = doc(dbx, 'users', user.uid, 'projects', projectId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Projeto não encontrado');
  const data = snap.data() as ProjetoDoc;

  // aplica no State.db
  State.db.projeto = data.db?.projeto ?? State.db.projeto;
  State.db.formacoes = Array.isArray(data.db?.formacoes) ? data.db.formacoes : [];

  setCurrentProjectId(projectId);
  localStorage.setItem('lastProjectId', projectId);

  document.dispatchEvent(new CustomEvent('db-changed', { detail: { reason: 'load-project' }}));
  renderizarTudo(true);
}

export async function saveProject(explicitId?: string) {
  const user = getUser();
  if (!user) throw new Error('Não autenticado.');

  const payload: ProjetoDoc = {
    title: State.db?.projeto?.titulo || 'Projeto sem título',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    db: JSON.parse(JSON.stringify(State.db)),
  };

  const colRef = collection(dbx, 'users', user.uid, 'projects');

  if (explicitId) {
    const ref = doc(dbx, 'users', user.uid, 'projects', explicitId);
    await setDoc(ref, payload, { merge: true });
    setCurrentProjectId(explicitId);
    localStorage.setItem('lastProjectId', explicitId);
  } else {
    const result = await addDoc(colRef, payload);
    setCurrentProjectId(result.id);
    localStorage.setItem('lastProjectId', result.id);
  }
}

export async function createNewProject(title = 'Novo projeto') {
  // zera e coloca título
  State.db.projeto.titulo = title;
  State.db.formacoes = [];
  setCurrentProjectId(null);

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
