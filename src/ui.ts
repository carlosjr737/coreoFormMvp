// src/ui.ts
import { renderizarTudo } from './timeline';
import { db } from './state';
import {
  createNewProjectFirebase,
  saveProjectFirebase,
  listProjectsFirebase,
  openProjectFirebase,
} from './projects_firebase';

// Elements (ajuste os IDs se forem diferentes no seu HTML)
const btnNew  = document.getElementById('btn-new')  as HTMLButtonElement | null;
const btnSave = document.getElementById('btn-save') as HTMLButtonElement | null;
const ddProjects = document.getElementById('projects-dd') as HTMLSelectElement | null;

// Preenche o dropdown de projetos
async function refreshProjectsDD() {
  if (!ddProjects) return;
  const list = await listProjectsFirebase();

  ddProjects.innerHTML = '';
  const opt0 = document.createElement('option');
  opt0.value = '';
  opt0.textContent = '(selecione um projeto)';
  ddProjects.appendChild(opt0);

  list.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.titulo;
    if (db.projeto?.id === p.id) opt.selected = true;
    ddProjects.appendChild(opt);
  });
}

// ==== Handlers esperados pelo build ====
export async function onNew() {
  const nome = prompt('Nome do projeto:', db.projeto?.titulo || 'Coreografia') || 'Coreografia';
  await createNewProjectFirebase(nome);
  await refreshProjectsDD();
  renderizarTudo(true);
}

export async function onSave() {
  await saveProjectFirebase();
  await refreshProjectsDD();
}

// Bootstrap simples da UI
export function initUI() {
  btnNew?.addEventListener('click', onNew);
  btnSave?.addEventListener('click', onSave);

  ddProjects?.addEventListener('change', async (e) => {
    const id = (e.target as HTMLSelectElement).value;
    if (!id) return;
    await openProjectFirebase(id);
    renderizarTudo(true);
  });

  // inicial
  refreshProjectsDD();
}
