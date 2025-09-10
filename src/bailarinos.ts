// src/bailarinos.ts
import { buscaBailarinosInput, listaBailarinosEl } from './dom';
import { removerBailarinoDoDB } from './ops/bailarinosOps';
import { renderizarPalco, getSelecaoIds, toggleSelecao, setCorEmGrupo } from './stage';
import { db, coresBailarinos as paletteFromState } from './state';

type Bailarino = { id: string; rotulo: string; cor: string };

const PALETA: string[] = (paletteFromState as unknown as string[]) ?? [
  '#ef4444','#3b82f6','#22c55e','#f97316','#8b5cf6','#eab308','#14b8a6',
  '#f43f5e','#0ea5e9','#10b981','#f59e0b','#a78bfa','#fde047','#06b6d4'
];

/* ---------- utils ---------- */
function getBailarinosUnicos(): Bailarino[] {
  const mapa = new Map<string, Bailarino>();
  db.formacoes.forEach(f => (f.marcadores || []).forEach(m => {
    if (!mapa.has(m.id)) mapa.set(m.id, { id: m.id, rotulo: m.rotulo, cor: m.cor });
  }));
  return Array.from(mapa.values()).sort((a,b)=> a.rotulo.localeCompare(b.rotulo, 'pt-BR', {sensitivity:'base'}));
}

/* ---------- popover de cor (individual) ---------- */
let popoverEl: HTMLDivElement | null = null;
function closePopover() {
  if (popoverEl) { popoverEl.remove(); popoverEl = null; }
  document.removeEventListener('mousedown', handleOutside);
  document.removeEventListener('keydown', handleEsc);
}
function handleOutside(e: MouseEvent) {
  if (!popoverEl) return;
  if (!popoverEl.contains(e.target as Node)) closePopover();
}
function handleEsc(e: KeyboardEvent) { if (e.key === 'Escape') closePopover(); }

function openColorPopover(anchor: HTMLElement, onPick: (hex: string, phase: 'preview'|'commit') => void) {
  closePopover();
  const r = anchor.getBoundingClientRect();

  popoverEl = document.createElement('div');
  popoverEl.className = 'color-popover';
  popoverEl.style.left = `${Math.min(r.left, window.innerWidth - 220)}px`;
  popoverEl.style.top  = `${r.bottom + 6}px`;

  const title = document.createElement('div');
  title.className = 'popover-title';
  title.textContent = 'Cor rápida';
  popoverEl.appendChild(title);

  const grid = document.createElement('div');
  grid.className = 'swatches';
  PALETA.forEach(hex => {
    const s = document.createElement('div');
    s.className = 'swatch';
    s.style.backgroundColor = hex;
    s.title = hex;
    s.addEventListener('click', () => { onPick(hex, 'commit'); closePopover(); });
    grid.appendChild(s);
  });
  popoverEl.appendChild(grid);

  const actions = document.createElement('div');
  actions.className = 'actions';
  const customBtn = document.createElement('button');
  customBtn.className = 'btn-mini';
  customBtn.textContent = 'Custom…';
  actions.appendChild(customBtn);

  const input = document.createElement('input');
  input.type = 'color';
  input.style.position = 'absolute';
  input.style.opacity = '0';
  input.style.pointerEvents = 'none';
  popoverEl.appendChild(input);

  customBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    input.focus(); input.click();
  });
  input.addEventListener('input', () => onPick(input.value, 'preview'));
  input.addEventListener('change', () => { onPick(input.value, 'commit'); closePopover(); });

  popoverEl.appendChild(actions);
  document.body.appendChild(popoverEl);

  // close handlers
  setTimeout(() => {
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleEsc);
  }, 0);
}

/* ---------- render ---------- */
export function renderizarPainelBailarinos() {
  const termo = (buscaBailarinosInput?.value || '').trim().toLowerCase();
  const todos = getBailarinosUnicos();
  const filtrados = termo ? todos.filter(b => b.rotulo.toLowerCase().includes(termo)) : todos;

  listaBailarinosEl.innerHTML = '';
  const selNow = new Set(getSelecaoIds());

  filtrados.forEach(b => {
    const li = document.createElement('li');
    li.className = 'bailarino-item' + (selNow.has(b.id) ? ' selected' : '');
    li.dataset.id = b.id;

    // Seleção: Cmd/Ctrl = toggle; clique simples = seleção única
    li.addEventListener('click', (e) => {
      const multi = e.ctrlKey || e.metaKey;
      toggleSelecao(b.id, multi);
      renderizarPalco();
      renderizarPainelBailarinos();
    });

    // DOT de cor (abre popover minimalista)
    const corDot = document.createElement('span');
    corDot.className = 'cor-dot';
    corDot.style.backgroundColor = b.cor;
    corDot.title = (selNow.size > 1 && selNow.has(b.id))
      ? 'Trocar cor do grupo selecionado'
      : 'Trocar cor deste bailarino';

    const openForThis = (anchor: HTMLElement) => {
      openColorPopover(anchor, (hex, phase) => {
        const liveSel = new Set(getSelecaoIds());
        const ids = (liveSel.size > 1 && liveSel.has(b.id)) ? Array.from(liveSel) : [b.id];
        setCorEmGrupo(ids, hex);
        corDot.style.backgroundColor = hex; // feedback no card
        renderizarPalco();                   // feedback no grid
        if (phase === 'commit') renderizarPainelBailarinos();
      });
    };
    corDot.addEventListener('click', (e) => { e.stopPropagation(); openForThis(corDot); });

    // Nome
    const nome = document.createElement('span');
    nome.className = 'nome';
    nome.textContent = b.rotulo;

    // Renomear
    const btnRename = document.createElement('button');
    btnRename.className = 'edit';
    btnRename.textContent = '✎';
    btnRename.title = 'Renomear';
    btnRename.addEventListener('click', (e) => { e.stopPropagation(); iniciarEdicao(li, b); });

    // EXCLUIR (corrigido: usar "b", não "m"; e chaves no lugar)
    const btnDel = document.createElement('button');
    btnDel.className = 'btn-mini';
    btnDel.title = 'Excluir bailarino de todas as formações';
    btnDel.textContent = 'Excluir';
    btnDel.addEventListener('click', (e) => {
      e.stopPropagation();
      if (confirm(`Excluir "${b.rotulo}" de todas as formações?`)) {
        removerBailarinoDoDB(b.id);
        renderizarPalco();              // atualiza o palco
        renderizarPainelBailarinos();   // atualiza a lista
      }
    });

    // Monta o item
    li.appendChild(corDot);
    li.appendChild(nome);
    li.appendChild(btnRename);
    li.appendChild(btnDel);
    listaBailarinosEl.appendChild(li);
  });
}

/* ---------- edição de nome ---------- */
function iniciarEdicao(li: HTMLElement, b: Bailarino) {
  const nomeEl = li.querySelector('.nome') as HTMLElement;
  if (!nomeEl) return;

  const input = document.createElement('input');
  input.className = 'edit-input';
  input.value = b.rotulo;
  li.replaceChild(input, nomeEl);
  input.focus(); input.select();

  function confirmar() {
    const novo = input.value.trim();
    const span = document.createElement('span');
    span.className = 'nome';
    span.textContent = novo || b.rotulo;
    li.replaceChild(span, input);

    if (novo && novo !== b.rotulo) {
      db.formacoes.forEach(f => (f.marcadores || []).forEach(m => { if (m.id === b.id) m.rotulo = novo; }));
    }
    renderizarPainelBailarinos();
    renderizarPalco();
  }
  function cancelar() {
    const span = document.createElement('span');
    span.className = 'nome';
    span.textContent = b.rotulo;
    li.replaceChild(span, input);
  }

  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') confirmar(); else if (e.key === 'Escape') cancelar(); });
  input.addEventListener('blur', confirmar);
}

/* ---------- eventos globais ---------- */
// quando outra parte do app pedir atualização do painel
document.addEventListener('bailarinos-updated', () => {
  renderizarPainelBailarinos();
});

// re-render em busca
buscaBailarinosInput?.addEventListener('input', () => renderizarPainelBailarinos());
