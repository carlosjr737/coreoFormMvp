import { palcoEl } from './dom';
import * as State from './state';
import { setFormacaoAtiva } from './state';
import { renderizarPainelBailarinos } from './bailarinos';
import type { Marcador, Formacao } from './types';
import { removerBailarinoDoDB } from './ops/bailarinosOps';



/* refs do state (db é o mesmo objeto, live) */
const db = State.db;
const DEFAULT_DANCER_COLOR: string = (State as any).DEFAULT_DANCER_COLOR ?? '#ff4d6d';

/* ===== formação ativa (dinâmica) & bootstrap ===== */
function getFormacaoAtiva(): Formacao | undefined {
  return db.formacoes.find(f => f.id === State.formacaoAtivaId);
}
function ensureFormacaoAtiva(): Formacao {
  let f = getFormacaoAtiva();
  if (f) return f;

  // cria a primeira formação
  const nova: Formacao = {
    id: 'f' + Date.now(),
    nome: 'Formação 1',
    ordem: (db.formacoes.length || 0) + 1,
    duracaoSegundos: 3,
    tempoTransicaoEntradaSegundos: 0,
    marcadores: []
  };
  db.formacoes.push(nova);
  db.formacoes.forEach((ff, i) => (ff.ordem = i + 1));
  setFormacaoAtiva(nova.id);

  // avisa UI (sidebar/timeline) que o DB mudou
  document.dispatchEvent(new CustomEvent('db-changed', { detail: { reason: 'create-first-formation' } }));
  return nova;
}

/* ===== seleção global ===== */
const selecao = new Set<string>();
// Paleta base (usa do state se existir)
const PALETA_CTX: string[] = (State as any).coresBailarinos ?? [
  '#ef4444','#3b82f6','#22c55e','#f97316','#8b5cf6','#eab308','#14b8a6',
  '#f43f5e','#0ea5e9','#10b981','#f59e0b','#a78bfa','#fde047','#06b6d4'
];

/* ===== Toolbar contextual ===== */
let ctxBar: HTMLDivElement | null = null;
let ctxColorInput: HTMLInputElement | null = null;



function ensureCtxBar() {
  if (ctxBar) return ctxBar;

  ctxBar = document.createElement('div');
  ctxBar.className = 'context-toolbar';

  // Label “Bailarino / Selecionados: N”
  const label = document.createElement('span');
  label.className = 'label';
  ctxBar.appendChild(label);

  // Paleta de cores rápidas
  const sws = document.createElement('div');
  sws.className = 'swatches';
  PALETA_CTX.forEach(hex => {
    const s = document.createElement('div');
    s.className = 'swatch';
    s.style.backgroundColor = hex;
    s.title = hex;
    s.addEventListener('click', () => {
      const ids = getSelecaoIds();
      if (!ids.length) return;
      setCorEmGrupo(ids, hex);
      renderizarPalco();
      // permanece aberto para testar outras cores
    });
    sws.appendChild(s);
  });
  ctxBar.appendChild(sws);

  // Botão de cor custom
  const customBtn = document.createElement('button');
  customBtn.className = 'btn-mini';
  customBtn.textContent = 'Custom…';
  ctxBar.appendChild(customBtn);

  // <input type="color"> escondido
  ctxColorInput = document.createElement('input');
  ctxColorInput.type = 'color';
  ctxColorInput.style.position = 'absolute';
  ctxColorInput.style.opacity = '0';
  ctxColorInput.style.pointerEvents = 'none';
  ctxBar.appendChild(ctxColorInput);

  customBtn.addEventListener('click', () => { ctxColorInput?.focus(); ctxColorInput?.click(); });
  ctxColorInput.addEventListener('input', () => {
    const ids = getSelecaoIds();
    if (!ids.length) return;
    setCorEmGrupo(ids, ctxColorInput!.value);
    renderizarPalco(); // preview
  });
  ctxColorInput.addEventListener('change', () => {
    document.dispatchEvent(new CustomEvent('db-changed', { detail: { reason: 'color-change' } }));
  });

  // --------- SEPARADOR (opcional, só pra respiro visual)
  const spacer = document.createElement('span');
  spacer.style.width = '8px';
  ctxBar.appendChild(spacer);

  // ========= BOTÃO EXCLUIR (AQUI) =========
  const btnExcluir = document.createElement('button');
  btnExcluir.className = 'btn-mini';
  btnExcluir.textContent = 'Excluir';
  btnExcluir.title = 'Excluir bailarino(s) selecionado(s) de todas as formações';
  btnExcluir.addEventListener('click', () => {
    const ids = getSelecaoIds();
    if (!ids.length) return;

    // Pega um rótulo para confirmação quando for 1 item
    let rotulo = '';
    if (ids.length === 1) {
      const alvo = ids[0];
      for (const f of db.formacoes) {
        const m = f.marcadores.find(mm => mm.id === alvo);
        if (m) { rotulo = m.rotulo; break; }
      }
    }

    const ok = confirm(
      ids.length === 1
        ? `Excluir "${rotulo || 'bailarino'}" de todas as formações?`
        : `Excluir ${ids.length} bailarinos de todas as formações?`
    );
    if (!ok) return;

    // Remove cada um via ops
    ids.forEach(id => removerBailarinoDoDB(id));

    clearSelecao(true);
    renderizarPalco();
    renderizarPainelBailarinos();
    document.dispatchEvent(new Event('bailarinos-updated'));
    document.dispatchEvent(new CustomEvent('db-changed', { detail: { reason: 'delete-dancers' } }));

    if (ctxBar) ctxBar.style.display = 'none';
  });
  ctxBar.appendChild(btnExcluir);
  // ========= /BOTÃO EXCLUIR =========

  document.body.appendChild(ctxBar);
  ctxBar.classList.add('context-toolbar--below');

  return ctxBar;
}


function hideCtxBar(){ if (ctxBar) ctxBar.style.display = 'none'; }

function positionCtxBarAt(clientX: number, clientY: number) {
  const bar = ensureCtxBar();
  bar.style.display = 'flex';

  const margin = 16;                 // distância do marcador
  const w = bar.offsetWidth || 240;
  const h = bar.offsetHeight || 44;

  // prefere ficar ABAIXO do alvo
  let left = Math.min(Math.max(8, clientX - w/2), window.innerWidth - w - 8);
  let top  = clientY + margin;

  // se não couber abaixo, coloca acima
  if (top + h > window.innerHeight - 8) {
    top = Math.max(8, clientY - margin - h);
    bar.classList.remove('context-toolbar--below');
    bar.classList.add('context-toolbar--above');
  } else {
    bar.classList.remove('context-toolbar--above');
    bar.classList.add('context-toolbar--below');
  }

  bar.style.left = `${left}px`;
  bar.style.top  = `${top}px`;

  const n = getSelecaoIds().length;
  (bar.querySelector('.label') as HTMLElement).textContent =
    n > 1 ? `Selecionados: ${n}` : 'Bailarino';
}


function showCtxBarNearSelection() {
  const ids = getSelecaoIds();
  if (!ids.length) { hideCtxBar(); return; }

  const els = Array.from(palcoEl.querySelectorAll<HTMLElement>('.marcador'))
                   .filter(el => ids.includes(el.dataset.id || ''));
  if (!els.length) { hideCtxBar(); return; }

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  els.forEach(el => {
    const r = el.getBoundingClientRect();
    minX = Math.min(minX, r.left);
    minY = Math.min(minY, r.top);
    maxX = Math.max(maxX, r.right);
    maxY = Math.max(maxY, r.bottom);
  });

  const anchorX = (minX + maxX) / 2;
  const anchorY = maxY;              // base do bounding box (barra vai para baixo)
  positionCtxBarAt(anchorX, anchorY);
}


function notifySelecao() {
  document.dispatchEvent(new CustomEvent('selection-changed', { detail: { ids: getSelecaoIds() } }));
}
export function getSelecaoIds(): string[] { return Array.from(selecao); }
export function clearSelecao(emit = true) { selecao.clear(); emit && notifySelecao(); }
export function setSelecaoIds(ids: string[], emit = true) {
  selecao.clear(); ids.forEach(id => selecao.add(id));
  emit && notifySelecao();
}
export function toggleSelecao(id: string, multi: boolean, emit = true) {
  if (multi) { selecao.has(id) ? selecao.delete(id) : selecao.add(id); }
  else { selecao.clear(); selecao.add(id); }
  emit && notifySelecao();
}

/* ===== helpers ===== */
function ensureColor(m: { cor?: string }): string {
  if (!m.cor || !m.cor.trim()) m.cor = DEFAULT_DANCER_COLOR;
  return m.cor;
}
function setCorDoBailarinoEmTodasFormacoes(id: string, cor: string) {
  db.formacoes.forEach(f => f.marcadores.forEach(m => { if (m.id === id) m.cor = cor; }));
}
export function setCorEmGrupo(ids: string[], cor: string) {
  ids.forEach(id => setCorDoBailarinoEmTodasFormacoes(id, cor));
}

/* ===== palco listeners (inclui caixa de seleção) ===== */
let palcoListenersInstalados = false;
function ensurePalcoListeners() {
  if (palcoListenersInstalados) return;
  palcoListenersInstalados = true;

  palcoEl.addEventListener('mousedown', startMarqueeOrClear);

  let marqueeEl: HTMLDivElement | null = null;
  let startX = 0, startY = 0;
  let addMode = false; // Shift = somar
  let initialSelection: Set<string> = new Set();

  function startMarqueeOrClear(e: MouseEvent) {
    // só inicia marquee se clicar no VAZIO do palco (não num marcador)
    if (e.button !== 0 || (e.target as HTMLElement).closest('.marcador')) return;

    e.preventDefault();
    if (State.isPlaying) return;

    const palcoRect = palcoEl.getBoundingClientRect();
    startX = e.clientX;
    startY = e.clientY;
    addMode = e.shiftKey;
    initialSelection = new Set(getSelecaoIds());

    marqueeEl = document.createElement('div');
    marqueeEl.className = 'marquee-select';
    marqueeEl.style.left = `${startX - palcoRect.left}px`;
    marqueeEl.style.top  = `${startY - palcoRect.top}px`;
    marqueeEl.style.width = '0px';
    marqueeEl.style.height = '0px';
    palcoEl.appendChild(marqueeEl);

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  function onMove(ev: MouseEvent) {
    if (!marqueeEl) return;
    const palcoRect = palcoEl.getBoundingClientRect();

    const x1 = Math.min(startX, ev.clientX) - palcoRect.left;
    const y1 = Math.min(startY, ev.clientY) - palcoRect.top;
    const x2 = Math.max(startX, ev.clientX) - palcoRect.left;
    const y2 = Math.max(startY, ev.clientY) - palcoRect.top;

    marqueeEl.style.left = `${x1}px`;
    marqueeEl.style.top = `${y1}px`;
    marqueeEl.style.width = `${x2 - x1}px`;
    marqueeEl.style.height = `${y2 - y1}px`;

    // Interseção com cada marcador (coords relativas ao palco)
    const novosSel = new Set<string>();
    const els = palcoEl.querySelectorAll<HTMLElement>('.marcador');
    els.forEach(el => {
      const r = el.getBoundingClientRect();
      const pr = palcoRect;
      const rl = r.left   - pr.left;
      const rt = r.top    - pr.top;
      const rr = r.right  - pr.left;
      const rb = r.bottom - pr.top;
      const intersecta = !(rl > x2 || rr < x1 || rt > y2 || rb < y1);
      if (intersecta) novosSel.add(el.dataset.id!);
    });

    if (addMode) initialSelection.forEach(id => novosSel.add(id));

    // aplica visual sem emitir evento toda hora
    setSelecaoIds(Array.from(novosSel), false);
    els.forEach(el => {
      if (novosSel.has(el.dataset.id!)) el.classList.add('selecionado');
      else el.classList.remove('selecionado');
    });
  }

  function onUp() {
    if (!marqueeEl) return;
    const w = parseFloat(marqueeEl.style.width || '0');
    const h = parseFloat(marqueeEl.style.height || '0');
    marqueeEl.remove(); marqueeEl = null;

    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);

    // clique simples no vazio (caixa ~0), e não era addMode → limpa seleção
    if (w < 3 && h < 3 && !addMode) {
      clearSelecao(true);
      renderizarPalco();
      renderizarPainelBailarinos();
      return;
    }
    // emite e reflete UI
    notifySelecao();
    renderizarPainelBailarinos();
  }
}
// quando a seleção muda (lista ou palco), reposiciona/mostra
document.addEventListener('selection-changed' as any, () => {
  showCtxBarNearSelection();
});

// ao terminar um clique/drag no palco, mostra perto do alvo/seleção
palcoEl.addEventListener('mouseup', () => {
  // pequeno delay para garantir que posição/seleção estejam atualizadas
  setTimeout(showCtxBarNearSelection, 0);
});

// clicou no vazio do palco → some a barra (já limpamos seleção no seu código)
palcoEl.addEventListener('mousedown', (e) => {
  if (!(e.target as HTMLElement).closest('.marcador')) {
    hideCtxBar();
  }
});

// mantém posição na resize
window.addEventListener('resize', showCtxBarNearSelection);


/* ===== renders ===== */
export function renderizarPalco() {
  ensurePalcoListeners();
  palcoEl.innerHTML = '';
  const f = getFormacaoAtiva();
  if (!f) return;
  f.marcadores.forEach(criarMarcador);
}

export function renderizarPalcoComFormacao(formacao: Formacao) {
  ensurePalcoListeners();
  palcoEl.innerHTML = '';
  formacao.marcadores.forEach(m => { ensureColor(m); criarMarcador(m); });
}

export function renderizarPalcoEmTransicao(origem: Formacao | undefined, destino: Formacao | undefined, progresso: number) {
  if (!origem || !destino) return;
  ensurePalcoListeners();
  palcoEl.innerHTML = '';

  origem.marcadores.forEach((ma) => {
    const mb = destino.marcadores.find(m => m.id === ma.id);
    if (!mb) return;

    const x = ma.x + (mb.x - ma.x) * progresso;
    const y = ma.y + (mb.y - ma.y) * progresso;

    const div = document.createElement('div');
    div.className = 'marcador';
    if (selecao.has(ma.id)) div.classList.add('selecionado');
    div.textContent = ma.rotulo;
    div.style.backgroundColor = ensureColor(mb) || ensureColor(ma);
    div.style.left = `${x}px`;
    div.style.top = `${y}px`;
    palcoEl.appendChild(div);
  });
}

/* ===== criar elemento marcador (multi-seleção, marquee e drag em grupo) ===== */
export function criarMarcador(marcador: Marcador) {
  ensureColor(marcador);

  const div = document.createElement('div');
  div.className = 'marcador';
  if (selecao.has(marcador.id)) div.classList.add('selecionado');
  div.dataset.id = marcador.id;
  div.textContent = marcador.rotulo;
  div.title = marcador.rotulo;
  div.style.backgroundColor = marcador.cor!;
  div.style.left = `${marcador.x}px`;
  div.style.top = `${marcador.y}px`;

  // ALT+click → trocar cor (em massa, se houver seleção que inclua este)
  div.addEventListener('click', (e) => {
    if (!e.altKey) return;
    e.preventDefault(); e.stopPropagation();
    const ids = selecao.size > 1 && selecao.has(marcador.id) ? getSelecaoIds() : [marcador.id];
    const picker = document.createElement('input');
    picker.type = 'color';
    picker.value = marcador.cor || DEFAULT_DANCER_COLOR;
    picker.style.position = 'fixed';
    picker.style.left = '-10000px';
    document.body.appendChild(picker);
    picker.addEventListener('input', () => {
      const nova = picker.value;
      setCorEmGrupo(ids, nova);
      // feedback imediato
      ids.forEach(id => {
        const el = palcoEl.querySelector<HTMLElement>(`.marcador[data-id="${id}"]`);
        if (el) el.style.backgroundColor = nova;
      });
      renderizarPainelBailarinos();
    });
    picker.addEventListener('change', () => picker.remove());
    picker.click();
  });

  // Duplo clique → renomear
  div.addEventListener('dblclick', (e) => {
    e.preventDefault();
    if (State.isPlaying) return;
    const novo = prompt('Novo nome do bailarino:', marcador.rotulo);
    if (novo !== null) {
      const nome = novo.trim();
      if (nome) {
        db.formacoes.forEach(f => {
          const m = f.marcadores.find(x => x.id === marcador.id);
          if (m) m.rotulo = nome;
        });
        renderizarPalco();
        renderizarPainelBailarinos();
      }
    }
  });

  // Clique direito → remover
  div.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    if (State.isPlaying) return;
    if (confirm(`Remover o bailarino ${marcador.rotulo}?`)) {
      db.formacoes.forEach(f => (f.marcadores = f.marcadores.filter(m => m.id !== marcador.id)));
      clearSelecao(true);
      renderizarPalco();
      renderizarPainelBailarinos();
    }
  });

  // Mousedown no marcador → toggle seleção (Cmd/Ctrl) e drag do grupo
  div.addEventListener('mousedown', (e) => {
    e.preventDefault();
    if (State.isPlaying) return;

    const multiToggle = e.ctrlKey || e.metaKey;

    if (multiToggle) {
      toggleSelecao(marcador.id, true);
      renderizarPalco();
      renderizarPainelBailarinos();
      return; // não inicia drag
    }

    // se não estava selecionado, vira seleção única
    if (!selecao.has(marcador.id)) {
      setSelecaoIds([marcador.id]);
      renderizarPalco();
      renderizarPainelBailarinos();
    }

    // === drag de grupo (todos selecionados) ===
    const startMouseX = e.clientX;
    const startMouseY = e.clientY;

    const f = getFormacaoAtiva();
    if (!f) return;

    const palcoRect = palcoEl.getBoundingClientRect();

    const init = new Map<string, { x: number; y: number; el: HTMLElement; w: number; h: number }>();
    selecao.forEach(id => {
      const m = f.marcadores.find(x => x.id === id);
      const el = palcoEl.querySelector<HTMLElement>(`.marcador[data-id="${id}"]`);
      if (m && el) init.set(id, { x: m.x, y: m.y, el, w: el.offsetWidth || 40, h: el.offsetHeight || 40 });
    });

    function onMove(ev: MouseEvent) {
      const dx = ev.clientX - startMouseX;
      const dy = ev.clientY - startMouseY;

      init.forEach((info, id) => {
        let nx = info.x + dx;
        let ny = info.y + dy;

        if (ev.shiftKey) { nx = Math.round(nx / 40) * 40; ny = Math.round(ny / 40) * 40; }

        nx = Math.max(0, Math.min(nx, palcoRect.width - info.w));
        ny = Math.max(0, Math.min(ny, palcoRect.height - info.h));

        info.el.style.left = `${nx}px`;
        info.el.style.top = `${ny}px`;
        
        if (!f) return;
        const m = f.marcadores.find(x => x.id === id);
        if (m) { m.x = nx; m.y = ny; }
      });
    }
    function onUp() { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });

  palcoEl.appendChild(div);
}

/* ===== API: adicionar bailarino (mantém cor padrão) ===== */
function getNextDLabel(): string {
  let maxN = 0;
  db.formacoes.forEach(f => f.marcadores.forEach(m => {
    const match = /^D(\d+)$/.exec(m.rotulo || '');
    if (match) maxN = Math.max(maxN, parseInt(match[1], 10));
  }));
  return 'D' + (maxN + 1);
}
function criarNovoMarcadorBase(): Marcador {
  const rect = palcoEl.getBoundingClientRect();
  const x = Math.max(0, Math.round(rect.width  / 2 - 20));
  const y = Math.max(0, Math.round(rect.height / 2 - 20));
  return { id: 'm' + Date.now(), rotulo: getNextDLabel(), x, y, cor: DEFAULT_DANCER_COLOR } as Marcador;
}
export function addBailarino() {
  const f = ensureFormacaoAtiva(); // garante que existe uma formação ativa
  const novo = criarNovoMarcadorBase();

  // adiciona o bailarino em TODAS as formações (continuidade)
  db.formacoes.forEach(ff => ff.marcadores.push({ ...novo }));

  setSelecaoIds([novo.id]);
  renderizarPalco();
  renderizarPainelBailarinos();

  // avisa UI (sidebar/timeline) que o DB mudou
  document.dispatchEvent(new CustomEvent('db-changed', { detail: { reason: 'add-bailarino' } }));
}

export function initBailarinoUI() {
  const btn = document.getElementById('btn-add-bailarino') as HTMLButtonElement | null;
  if (!btn) return;
  btn.replaceWith(btn.cloneNode(true));
  const btnNew = document.getElementById('btn-add-bailarino') as HTMLButtonElement | null;
  btnNew?.addEventListener('click', addBailarino);
}
