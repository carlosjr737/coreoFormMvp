import { BASE_PX_PER_SEC, db, formacaoAtivaId, globalMsAtual, setFormacaoAtiva, setGlobalMs, zoom } from './state';
import {
  listaFormacoesEl, timeRulerEl, timelineBlocosEl, timelineContainerEl, playheadEl,
  tituloProjetoEl, btnZoomIn, btnZoomOut, btnZoomReset, zoomValueEl, audioTrackEl,
  timeDisplayEl
} from './dom';
import { renderizarPalco } from './stage';
import { renderizarPainelBailarinos } from './bailarinos';
import { getAudioBuffer, renderizarFaixaAudio } from './audio';

const ADD_TILE_TOP_PX = 6;
const ADD_TILE_HEIGHT = 'calc(100% - 12px)';

function deepClone<T>(x: T): T {
  return JSON.parse(JSON.stringify(x));
}
function getFormationWithMostMarkers() {
  if (!db.formacoes.length) return null;
  return db.formacoes.reduce((best, f) =>
    (f.marcadores?.length || 0) > (best.marcadores?.length || 0) ? f : best
  , db.formacoes[0]);
}

/** 00:SS.s ou MM:SS.s */
function formatTimecode(ms: number): string {
  const totalSec = Math.max(0, ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = Math.floor(totalSec % 60);
  const d = Math.floor((totalSec - Math.floor(totalSec)) * 10);
  return (m > 0 ? `${m}:${String(s).padStart(2,'0')}` : `00:${String(s).padStart(2,'0')}`) + `.${d}`;
}

export function getTimelineTotalSegundos(): number {
  const totalFormacoes = db.formacoes.reduce((acc,f)=> acc + f.duracaoSegundos + f.tempoTransicaoEntradaSegundos, 0);
  const audio = getAudioBuffer();
  if (audio) return Math.max(totalFormacoes, audio.duration);
  return totalFormacoes > 0 ? totalFormacoes : 1;
}
export function getTimelineTotalMs(): number { return getTimelineTotalSegundos() * 1000; }
export function getTotalTimelinePx(): number {
  const totalSeg = Math.max(1, getTimelineTotalSegundos());
  return Math.max(1, Math.floor(totalSeg * BASE_PX_PER_SEC * zoom));
}

export function ensurePlayheadInView() {
  const totalPx = getTotalTimelinePx();
  const playheadX = (globalMsAtual / getTimelineTotalMs()) * totalPx;
  const viewStart = timelineContainerEl.scrollLeft;
  const viewWidth = timelineContainerEl.clientWidth;
  const viewEnd = viewStart + viewWidth;

  const margin = Math.max(40, Math.floor(viewWidth * 0.2));
  const leftGuard = viewStart + margin;
  const rightGuard = viewEnd - margin;

  let newScroll: number | null = null;
  if (playheadX < leftGuard) newScroll = Math.max(0, Math.floor(playheadX - viewWidth * 0.5));
  else if (playheadX > rightGuard) newScroll = Math.max(0, Math.floor(playheadX - viewWidth * 0.5));

  if (newScroll !== null) {
    timelineContainerEl.scrollLeft = newScroll;
    (timeRulerEl as any).scrollLeft = newScroll;
  }
}

export function renderizarBarraLateral() {
  listaFormacoesEl.innerHTML = '';
  db.formacoes.sort((a,b)=> a.ordem - b.ordem);
  db.formacoes.forEach(f => {
    const li = document.createElement('li');
    li.dataset.id = f.id;
    if (f.id === formacaoAtivaId) li.classList.add('ativa');

    const nome = document.createElement('span');
    nome.className = 'nome-formacao';
    nome.textContent = `${f.ordem}. ${f.nome}`;

    const btnEdit = document.createElement('button');
    btnEdit.className = 'icon'; btnEdit.textContent = '✎'; btnEdit.title='Renomear formação';
    btnEdit.addEventListener('click', (e)=> { e.stopPropagation(); iniciarEdicaoFormacao(li, f.id, f.nome); });

    const btnDel = document.createElement('button');
    btnDel.className = 'icon'; btnDel.textContent = '×'; btnDel.title='Remover formação';
    btnDel.addEventListener('click', (e)=> { e.stopPropagation(); removerFormacao(f.id); });

    li.appendChild(nome); li.appendChild(btnEdit); li.appendChild(btnDel);
    li.addEventListener('click', ()=> mudarFormacaoAtiva(f.id));
    li.addEventListener('dblclick', (e)=> { e.stopPropagation(); iniciarEdicaoFormacao(li, f.id, f.nome); });

    listaFormacoesEl.appendChild(li);
  });
}
function updateAddTile() {
  const ativaEl = timelineBlocosEl.querySelector('.bloco-formacao.ativa') as HTMLElement | null;
  if (!ativaEl) return;

  const GAP = 8;           // espaço horizontal entre o card e o "+"
  const TILE_W = 140;      // largura do tile

  // cria o tile se ainda não existir
  let addTile = timelineBlocosEl.querySelector('.add-formation-tile') as HTMLButtonElement | null;
  if (!addTile) {
    addTile = document.createElement('button');
    addTile.type = 'button';
    addTile.className = 'add-formation-tile';
    addTile.style.position = 'absolute';
    addTile.style.top = `${ADD_TILE_TOP_PX}px`;            // não “pega” a borda do card
    addTile.style.height = ADD_TILE_HEIGHT;                // fica dentro da faixa, sem encostar
    addTile.style.zIndex = '0';                            // SEMPRE por baixo dos cards
    addTile.innerHTML = '<span class="plus">＋</span>';
    addTile.title = 'Nova formação após a atual';
    addTile.addEventListener('click', (e) => {
      e.stopPropagation();
      adicionarFormacaoDepois(formacaoAtivaId!);
    });
    addTile.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); addTile!.click(); }
    });
    (timelineBlocosEl as HTMLElement).style.position = 'relative';
    timelineBlocosEl.appendChild(addTile);
  }

  // ancora depois do fim da ativa (sem jamais “entrar” no card)
  const left = ativaEl.offsetLeft + ativaEl.offsetWidth + GAP;
  addTile.style.left = `${left}px`;

  // garante largura suficiente para o tile (sem quebrar layout)
  const needWidth = Math.max(getTotalTimelinePx(), left + TILE_W + 16);
  timelineBlocosEl.style.width = needWidth + 'px';
}


function iniciarEdicaoFormacao(li: HTMLLIElement, id: string, nomeAtual: string) {
  const nomeSpan = li.querySelector('.nome-formacao') as HTMLElement | null;
  if (!nomeSpan) return;
  const input = document.createElement('input');
  input.className = 'edit-input';
  input.value = nomeAtual;
  li.replaceChild(input, nomeSpan);
  input.focus(); input.select();
  function confirmar() {
    const novo = input.value.trim();
    const f = db.formacoes.find(x => x.id === id);
    if (novo && f && novo !== nomeAtual) f.nome = novo;
    renderizarBarraLateral();
  }
  function cancelar(){ renderizarBarraLateral(); }
  input.addEventListener('keydown', (e)=> { if (e.key === 'Enter') confirmar(); else if (e.key === 'Escape') cancelar(); });
  input.addEventListener('blur', confirmar);
}

export function renderizarLinhaDoTempo() {
  timelineBlocosEl.innerHTML = '';

  // dimensões totais
  const totalSeg = getTimelineTotalSegundos();
  const totalPx  = getTotalTimelinePx();
  timelineBlocosEl.style.width = totalPx + 'px';
  (timelineBlocosEl as HTMLElement).style.position = 'relative'; // para posicionar o tile absoluto

  // desenha TODOS os cards
  db.formacoes.forEach((f) => {
    const tempoTotalDoBloco = f.tempoTransicaoEntradaSegundos + f.duracaoSegundos;

    const bloco = document.createElement('div');
    bloco.className = 'bloco-formacao';
    if (f.id === formacaoAtivaId) bloco.classList.add('ativa');

    const blocoPx = (tempoTotalDoBloco / Math.max(1e-6, totalSeg)) * totalPx;
    bloco.style.width = `${Math.max(1, Math.round(blocoPx))}px`;

    const texto = document.createElement('span');
    texto.textContent = f.nome;
    bloco.appendChild(texto);

    // clique / duplo clique
    bloco.addEventListener('click', (e: MouseEvent) => {
      if ((e as any).shiftKey) editarTemposFormacao(f);
      else mudarFormacaoAtiva(f.id);
    });
    bloco.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      const novo = prompt('Novo nome da formação:', f.nome);
      if (novo !== null) {
        const n = novo.trim();
        if (n) { f.nome = n; renderizarBarraLateral(); }
      }
    });

    // sub-bloco de transição + handle
    const sub = document.createElement('div');
    sub.className = 'sub-bloco-transicao';
    const totalBloco = tempoTotalDoBloco;
    if (totalBloco > 0) sub.style.width = `${(f.tempoTransicaoEntradaSegundos / totalBloco) * 100}%`;
    sub.title = `Transição: ${f.tempoTransicaoEntradaSegundos}s`;

    const handleSplit = document.createElement('div');
    handleSplit.className = 'handle handle-split';
    handleSplit.title = 'Arraste para ajustar transição';
    handleSplit.addEventListener('mousedown', (e) => {
      e.stopPropagation(); e.preventDefault();
      const blocoRect = bloco.getBoundingClientRect();
      const startX = (e as MouseEvent).clientX;
      const transIni = f.tempoTransicaoEntradaSegundos;

      function onMove(ev: MouseEvent) {
        const dx = ev.clientX - startX;
        const secPerPx = totalBloco / Math.max(1, blocoRect.width);
        let novaTrans = transIni + dx * secPerPx;
        const minDur = 0.1;
        novaTrans = Math.max(0, Math.min(totalBloco - minDur, novaTrans));
        sub.style.width = `${(novaTrans / totalBloco) * 100}%`;
        sub.title = `Transição: ${novaTrans.toFixed(2)}s`;
      }
      function onUp(ev: MouseEvent) {
        const dx = ev.clientX - startX;
        const secPerPx = totalBloco / Math.max(1, blocoRect.width);
        let novaTrans = transIni + dx * secPerPx;
        const minDur = 0.1;
        novaTrans = Math.max(0, Math.min(totalBloco - minDur, novaTrans));
        f.tempoTransicaoEntradaSegundos = +novaTrans.toFixed(2);
        f.duracaoSegundos = +(totalBloco - novaTrans).toFixed(2);
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        renderizarTudo(true);
      }
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
    sub.appendChild(handleSplit);
    bloco.appendChild(sub);

    // handle de duração (fim do card)
    const handleEnd = document.createElement('div');
    handleEnd.className = 'handle handle-end';
    handleEnd.title = 'Arraste para ajustar duração';
    handleEnd.addEventListener('mousedown', (e) => {
      e.stopPropagation(); e.preventDefault();
      const timelineRect = timelineContainerEl.getBoundingClientRect();
      const startX = (e as MouseEvent).clientX;
      const durIni = f.duracaoSegundos;
      const transConst = f.tempoTransicaoEntradaSegundos;
      const totalTimelineLocal = getTimelineTotalSegundos();

      function onMove(ev: MouseEvent) {
        const dx = ev.clientX - startX;
        const secPerPxContainer = totalTimelineLocal / Math.max(1, timelineRect.width);
        let novaDur = durIni + dx * secPerPxContainer * (timelineContainerEl.clientWidth / getTotalTimelinePx());
        novaDur = Math.max(0.1, novaDur);
        sub.style.width = `${(transConst / (transConst + novaDur)) * 100}%`;
        bloco.title = `Duração: ${novaDur.toFixed(2)}s`;
      }
      function onUp(ev: MouseEvent) {
        const dx = ev.clientX - startX;
        const secPerPxContainer = totalTimelineLocal / Math.max(1, timelineRect.width);
        let novaDur = durIni + dx * secPerPxContainer * (timelineContainerEl.clientWidth / getTotalTimelinePx());
        novaDur = Math.max(0.1, novaDur);
        f.duracaoSegundos = +novaDur.toFixed(2);
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        renderizarTudo(true);
      }
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
    bloco.appendChild(handleEnd);

    timelineBlocosEl.appendChild(bloco);
  }); // fecha o forEach

  // tile "+" único, fora dos cards, posicionado após o card ATIVO
  const oldTile = timelineBlocosEl.querySelector('.add-formation-tile');
  if (oldTile) oldTile.remove();

  const ativaEl = timelineBlocosEl.querySelector('.bloco-formacao.ativa') as HTMLElement | null;
  if (!ativaEl) return; // sem ativa, nada pra posicionar

  const GAP = 8, TILE_W = 140;
  const tileLeft = ativaEl.offsetLeft + ativaEl.offsetWidth + GAP;

  // garante largura suficiente pra aparecer o tile
  const alvoW = Math.max(totalPx, tileLeft + TILE_W + 16);
  timelineBlocosEl.style.width = alvoW + 'px';

  const addTile = document.createElement('button');
  addTile.type = 'button';
  addTile.className = 'add-formation-tile';
  addTile.style.position = 'absolute';
  addTile.style.left = `${tileLeft}px`;
  addTile.style.top = `${ADD_TILE_TOP_PX}px`;
  addTile.style.height = ADD_TILE_HEIGHT;
  addTile.innerHTML = '<span class="plus">＋</span>';
  addTile.title = 'Nova formação após a atual';

  addTile.addEventListener('click', (e) => {
    e.stopPropagation();
    adicionarFormacaoDepois(formacaoAtivaId!);
  });
  addTile.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); addTile.click(); }
  });

  timelineBlocosEl.appendChild(addTile);
}

/* ======== RÉGUA (helpers + render) ======== */
const TARGET_MAJOR_PX = 120;

function escolherPassos(pxPorSegundo: number) {
  const candidates = [0.1, 0.2, 0.5, 1, 2, 4, 5, 8, 10, 15, 20, 30, 60, 120, 300, 600];
  let best = candidates[0], bestDiff = Infinity;
  for (const s of candidates) {
    const px = s * pxPorSegundo;
    const diff = Math.abs(px - TARGET_MAJOR_PX);
    if (diff < bestDiff) { best = s; bestDiff = diff; }
  }
  let div = [5,10,20,60,120,300,600].includes(best) ? 5 : 4;
  let minor = best / div;
  while (div > 1 && (minor * pxPorSegundo) < 8) { div -= 1; minor = best / div; }
  return { majorStep: best, minorStep: minor };
}

function formatarTempoLabel(seg: number, majorStep: number) {
  if (majorStep >= 60 || seg >= 60) {
    const m = Math.floor(seg / 60);
    const s = Math.round(seg - m * 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  }
  if (majorStep < 1) return seg.toFixed(1) + 's';
  return String(Math.round(seg));
}

export function renderizarReguaTempo() {
  const total = getTimelineTotalSegundos();
  const totalPx = getTotalTimelinePx();
  const pxPerSec = totalPx / Math.max(1e-6, total);

  timeRulerEl.innerHTML = '';
  (timeRulerEl as any).scrollLeft = timelineContainerEl.scrollLeft;

  const content = document.createElement('div');
  content.id = 'time-ruler-content';
  content.style.position = 'relative';
  content.style.height = '100%';
  content.style.width = totalPx + 'px';
  timeRulerEl.appendChild(content);

  const { majorStep, minorStep } = escolherPassos(pxPerSec);

  for (let tSec = 0; tSec <= total + 1e-6; tSec += majorStep) {
    const x = Math.round((tSec / total) * totalPx);

    const tick = document.createElement('div');
    tick.className = 'tick major';
    tick.style.left = `${x}px`;
    content.appendChild(tick);

    const label = document.createElement('div');
    label.className = 'tick-label';
    label.style.left = `${x}px`;
    label.textContent = formatarTempoLabel(tSec, majorStep);
    content.appendChild(label);

    for (let tm = tSec + minorStep; tm < tSec + majorStep - 1e-9; tm += minorStep) {
      const xm = Math.round((tm / total) * totalPx);
      const minor = document.createElement('div');
      minor.className = 'tick minor';
      minor.style.left = `${xm}px`;
      content.appendChild(minor);
    }
  }
}
/* ======== /RÉGUA ======== */

export function posicionarPlayheadNoPercentual(p: number) {
  const totalPx = getTotalTimelinePx();
  playheadEl.style.transform = `translateX(${p * totalPx}px)`;
  playheadEl.style.display = 'block';
}

export function renderizarTudo(posicionarPlayhead = false) {
  db.formacoes.sort((a,b)=> a.ordem - b.ordem);
  tituloProjetoEl.textContent = db.projeto.titulo;
  renderizarBarraLateral();
  renderizarPalco();
  renderizarLinhaDoTempo();
  renderizarReguaTempo();
  renderizarPainelBailarinos();
  renderizarFaixaAudio();
  if (posicionarPlayhead) posicionarPlayheadNoInicioDaFormacaoAtiva();
  ensurePlayheadInView();
}

export function calcularTempoAcumuladoAteFormacao(idx: number) {
  let t = 0;
  for (let i=0;i<idx;i++) t += db.formacoes[i].tempoTransicaoEntradaSegundos + db.formacoes[i].duracaoSegundos;
  if (db.formacoes[idx]) t += db.formacoes[idx].tempoTransicaoEntradaSegundos;
  return t * 1000;
}

export function posicionarPlayheadNoInicioDaFormacaoAtiva() {
  const idx = db.formacoes.findIndex(f => f.id === formacaoAtivaId);
  const acum = calcularTempoAcumuladoAteFormacao(idx);
  const p = acum / getTimelineTotalMs();
  setGlobalMs(acum);
  posicionarPlayheadNoPercentual(p);
}

export function scrubAt(clientX: number) {
  const rect = timelineContainerEl.getBoundingClientRect();
  const totalPx = getTotalTimelinePx();
  const xContent = (clientX - rect.left) + timelineContainerEl.scrollLeft;
  const p = Math.max(0, Math.min(xContent / totalPx, 1));
  const t = p * getTimelineTotalMs();
  setGlobalMs(t);
  renderAtGlobalMs(t);
  ensurePlayheadInView();
}

export function editarTemposFormacao(f: typeof db.formacoes[number]) {
  const nd = prompt(`Editar DURAÇÃO (s) para "${f.nome}":`, String(f.duracaoSegundos));
  if (nd !== null && !isNaN(+nd) && +nd >= 0) f.duracaoSegundos = parseFloat(nd);
  const nt = prompt(`Editar TRANSIÇÃO (s) para "${f.nome}":`, String(f.tempoTransicaoEntradaSegundos));
  if (nt !== null && !isNaN(+nt) && +nt >= 0) f.tempoTransicaoEntradaSegundos = parseFloat(nt);
  renderizarTudo(true);
}

export function removerFormacao(id: string) {
  const idx = db.formacoes.findIndex(x => x.id === id);
  if (idx < 0) return;
  db.formacoes.splice(idx, 1);
  if (!db.formacoes.length) setFormacaoAtiva(null);
  else if (!db.formacoes.find(f => f.id === formacaoAtivaId)) setFormacaoAtiva(db.formacoes[0].id);
  db.formacoes.forEach((f,i)=> f.ordem = i+1);
  renderizarTudo(true);
}

export function adicionarFormacao() {
  const novaOrdem = db.formacoes.length
    ? Math.max(...db.formacoes.map(f => f.ordem)) + 1
    : 1;

  // base padrão: formação ativa; fallback: formação com MAIS marcadores
  const base =
    db.formacoes.find(f => f.id === formacaoAtivaId) ||
    getFormationWithMostMarkers();

  const nova = {
    id: `f${Date.now()}`,
    nome: `Formação ${novaOrdem}`,
    ordem: novaOrdem,
    duracaoSegundos: 3,
    tempoTransicaoEntradaSegundos: 1,
    marcadores: deepClone(base?.marcadores || [])
  } as any;

  db.formacoes.push(nova);
  mudarFormacaoAtiva(nova.id);
}


export function adicionarFormacaoDepois(id: string) {
  const idx = db.formacoes.findIndex(f => f.id === id);
  const ref = idx >= 0 ? db.formacoes[idx] : null;

  const novaOrdem = ref
    ? ref.ordem + 1
    : (db.formacoes.length ? Math.max(...db.formacoes.map(f=>f.ordem)) + 1 : 1);

  // abre espaço nas ordens
  db.formacoes.forEach(f => { if (f.ordem >= novaOrdem) f.ordem += 1; });

  // base padrão: a "ref"; fallback: a que tem MAIS marcadores
  const base = ref || getFormationWithMostMarkers();

  const nova = {
    id: `f${Date.now()}`,
    nome: `Formação ${novaOrdem}`,
    ordem: novaOrdem,
    duracaoSegundos: 3,
    tempoTransicaoEntradaSegundos: 1,
    marcadores: deepClone(base?.marcadores || [])
  } as any;

  db.formacoes.push(nova);
  db.formacoes.sort((a,b)=> a.ordem - b.ordem);
  mudarFormacaoAtiva(nova.id);
}


export function mudarFormacaoAtiva(id: string) {
  setFormacaoAtiva(id);
  renderizarTudo(true);
  const idx = db.formacoes.findIndex(f => f.id === id);
  const acum = calcularTempoAcumuladoAteFormacao(idx);
  setGlobalMs(acum);
  renderAtGlobalMs(acum);
}

export function renderAtGlobalMs(globalMs: number) {
  setGlobalMs(globalMs);
  const totalMs = getTimelineTotalMs();
  const progressoTotal = Math.max(0, Math.min(globalMs / totalMs, 1));

  let acumulado = 0;
  let fez = false;
  for (let i=0;i<db.formacoes.length;i++) {
    const f = db.formacoes[i];
    const transMs = f.tempoTransicaoEntradaSegundos * 1000;
    const durMs   = f.duracaoSegundos * 1000;

    if (globalMs < acumulado + transMs) {
      const from = db.formacoes[i-1];
      const to = f;
      const t  = transMs === 0 ? 1 : (globalMs - acumulado) / transMs;
      document.dispatchEvent(new CustomEvent('stage-render-transition', { detail: { from, to, t } }));
      fez = true; break;
    }
    acumulado += transMs;

    if (globalMs < acumulado + durMs) {
      document.dispatchEvent(new CustomEvent('stage-render-pause', { detail: { formacao: f } }));
      fez = true; break;
    }
    acumulado += durMs;
  }

  posicionarPlayheadNoPercentual(progressoTotal);
  ensurePlayheadInView();
  if (timeDisplayEl) timeDisplayEl.textContent = formatTimecode(globalMs);
  if (!fez) {
    const last = db.formacoes[db.formacoes.length - 1];
    if (last) document.dispatchEvent(new CustomEvent('stage-render-pause', { detail: { formacao: last } }));
  }

  updateAddTile();
}

export function initZoomControls(onZoomChange: (z:number)=>void) {
  function setZoomUI(z: number) {
    zoomValueEl.textContent = Math.round(z * 100) + '%';
  }
  btnZoomOut.addEventListener('click', ()=> {
    onZoomChange(zoom - 0.25);
    setZoomUI(zoom);
    renderizarReguaTempo(); renderizarLinhaDoTempo(); renderAtGlobalMs(globalMsAtual);
    ensurePlayheadInView(); renderizarFaixaAudio();
    updateAddTile();
  });
  btnZoomIn.addEventListener('click', ()=> {
    onZoomChange(zoom + 0.25);
    setZoomUI(zoom);
    renderizarReguaTempo(); renderizarLinhaDoTempo(); renderAtGlobalMs(globalMsAtual);
    ensurePlayheadInView(); renderizarFaixaAudio();
    updateAddTile();
  });
  btnZoomReset.addEventListener('click', ()=> {
    onZoomChange(1);
    setZoomUI(zoom);
    renderizarReguaTempo(); renderizarLinhaDoTempo(); renderAtGlobalMs(globalMsAtual);
    ensurePlayheadInView(); renderizarFaixaAudio();
    updateAddTile();
  });
  setZoomUI(zoom);
}

export function initScrubHandlers() {
  let dragging = false;
  function mousedown(e: MouseEvent) { dragging = true; scrubAt(e.clientX); }
  function mousemove(e: MouseEvent) { if (dragging) scrubAt(e.clientX); }
  function mouseup() { dragging = false; }

  timeRulerEl.addEventListener('mousedown', mousedown);
  timelineContainerEl.addEventListener('mousedown', mousedown);
  document.addEventListener('mousemove', mousemove);
  document.addEventListener('mouseup', mouseup);

  // sincroniza scroll da régua com timeline
  timelineContainerEl.addEventListener('scroll', () => {
    (timeRulerEl as any).scrollLeft = timelineContainerEl.scrollLeft;
    renderizarFaixaAudio();
  });

  // scrub vindo da faixa de áudio
  (audioTrackEl as any).addEventListener('scrub-request', (e: any) => {
    scrubAt(e.detail.clientX);
  });
}
