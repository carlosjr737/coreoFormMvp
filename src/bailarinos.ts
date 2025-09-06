
import { buscaBailarinosInput, listaBailarinosEl } from './dom';
import { renderizarPalco } from './stage';
import { db } from './state';

type Bailarino = { id: string; rotulo: string; cor: string };

function getBailarinosUnicos(): Bailarino[] {
  const mapa = new Map<string, Bailarino>();
  db.formacoes.forEach(f => {
    f.marcadores.forEach(m => {
      if (!mapa.has(m.id)) {
        mapa.set(m.id, { id: m.id, rotulo: m.rotulo, cor: m.cor });
      }
    });
  });
  return Array.from(mapa.values()).sort((a,b)=> a.rotulo.localeCompare(b.rotulo, 'pt-BR', {sensitivity:'base'}));
}

export function renderizarPainelBailarinos() {
  const termo = (buscaBailarinosInput?.value || '').trim().toLowerCase();
  const todos = getBailarinosUnicos();
  const filtrados = termo ? todos.filter(b => b.rotulo.toLowerCase().includes(termo)) : todos;

  listaBailarinosEl.innerHTML = '';
  filtrados.forEach(b => {
    const li = document.createElement('li');
    li.className = 'bailarino-item';
    li.dataset.id = b.id;

    const cor = document.createElement('span');
    cor.className = 'cor-dot';
    cor.style.backgroundColor = b.cor;

    const nome = document.createElement('span');
    nome.className = 'nome';
    nome.textContent = b.rotulo;

    const btn = document.createElement('button');
    btn.className = 'edit';
    btn.textContent = '✎';
    btn.title = 'Renomear';

    btn.addEventListener('click', () => iniciarEdicao(li, b));

    li.appendChild(cor);
    li.appendChild(nome);
    li.appendChild(btn);
    listaBailarinosEl.appendChild(li);
  });
}

function iniciarEdicao(li: HTMLElement, b: Bailarino) {
  const nomeEl = li.querySelector('.nome') as HTMLElement;
  if (!nomeEl) return;

  const input = document.createElement('input');
  input.className = 'edit-input';
  input.value = b.rotulo;
  li.replaceChild(input, nomeEl);
  input.focus();
  input.select();

  function confirmar() {
    const novo = input.value.trim();
    // volta o span
    const span = document.createElement('span');
    span.className = 'nome';
    span.textContent = novo || b.rotulo;
    li.replaceChild(span, input);

    if (novo && novo !== b.rotulo) {
      // Atualiza em TODAS as formações o marcador de mesmo id
      db.formacoes.forEach(f => {
        f.marcadores.forEach(m => {
          if (m.id === b.id) m.rotulo = novo;
        });
      });
      renderizarPainelBailarinos();
      renderizarPalco(); // <- reflete no grid imediatamente
    } else {
      renderizarPainelBailarinos();
      renderizarPalco();
    }
  }

  function cancelar() {
    const span = document.createElement('span');
    span.className = 'nome';
    span.textContent = b.rotulo;
    li.replaceChild(span, input);
  }

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') confirmar();
    else if (e.key === 'Escape') cancelar();
  });
  input.addEventListener('blur', confirmar);
}

// filtro por texto
buscaBailarinosInput?.addEventListener('input', () => renderizarPainelBailarinos());
