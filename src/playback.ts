
import { btnAnterior, btnPlayPause, btnProxima, importFile, btnExportar, btnImportar, btnAddFormacao, btnAddBailarino, playheadEl, buscaBailarinosInput } from './dom';
import { adicionarFormacao, calcularTempoAcumuladoAteFormacao, getTimelineTotalMs, mudarFormacaoAtiva, renderAtGlobalMs, renderizarTudo, ensurePlayheadInView } from './timeline';
import { db, formacaoAtivaId, globalMsAtual, isPlaying, playbackLoopId, tempoInicioPlayback, tempoPausadoAcumulado } from './state';
import { renderizarPalco, renderizarPalcoEmTransicao, renderizarPalcoComFormacao } from './stage';
import { exportarJSON, importarJSON } from './io';
import { ensureAudioContext, getAudioBuffer, getAudioContext, getAudioSource, setAudioSource } from './audio';

let _isPlaying = isPlaying;
let _playbackLoopId: number | undefined = playbackLoopId;
let _tempoInicioPlayback = tempoInicioPlayback;
let _tempoPausadoAcumulado = tempoPausadoAcumulado;

export function initPlaybackAndIO() {
  // Stage render events from timeline
  document.addEventListener('stage-render-transition' as any, (e: any) => {
    const { from, to, t } = e.detail;
    renderizarPalcoEmTransicao(from, to, t);
  });
  document.addEventListener('stage-render-pause' as any, (e: any) => {
    const { formacao } = e.detail;
    if (formacao) renderizarPalcoComFormacao(formacao);
  });

  btnPlayPause.addEventListener('click', ()=> (_isPlaying ? pausePlayback() : startPlayback()));
  btnAnterior.addEventListener('click', ()=> {
    const i = db.formacoes.findIndex(f => f.id === formacaoAtivaId);
    if (i > 0) mudarFormacaoAtiva(db.formacoes[i-1].id);
  });
  btnProxima.addEventListener('click', ()=> {
    const i = db.formacoes.findIndex(f => f.id === formacaoAtivaId);
    if (i < db.formacoes.length - 1) mudarFormacaoAtiva(db.formacoes[i+1].id);
  });

  btnAddFormacao.addEventListener('click', adicionarFormacao);
  btnAddBailarino.addEventListener('click', ()=> {
    if (!db.formacoes.length) { alert('Crie uma formação antes.'); return; }
    const total = db.formacoes[0].marcadores.length;
    const novo = { id: `m${Date.now()}`, rotulo: `D${total + 1}`, x: 50 + Math.random()*100, y: 50 + Math.random()*100, cor: ['#ef4444','#3b82f6','#22c55e','#f97316','#8b5cf6','#eab308','#14b8a6'][total % 7] };
    db.formacoes.forEach(f => f.marcadores.push(JSON.parse(JSON.stringify(novo))));
    renderizarTudo(true);
  });

  btnExportar.addEventListener('click', exportarJSON);
  btnImportar.addEventListener('click', ()=> importFile.click());
  importFile.addEventListener('change', (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) importarJSON(file, () => renderizarTudo(true));
    (e.target as HTMLInputElement).value = '';
  });

  window.addEventListener('keydown', (e) => {
    const tag = (e.target as HTMLElement).tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (e.code === 'Space') { e.preventDefault(); _isPlaying ? pausePlayback() : startPlayback(); }
    else if (e.key === 'ArrowLeft') {
      const i = db.formacoes.findIndex(f => f.id === formacaoAtivaId);
      if (i > 0) mudarFormacaoAtiva(db.formacoes[i-1].id);
    } else if (e.key === 'ArrowRight') {
      const i = db.formacoes.findIndex(f => f.id === formacaoAtivaId);
      if (i < db.formacoes.length - 1) mudarFormacaoAtiva(db.formacoes[i+1].id);
    }
  });

  buscaBailarinosInput.addEventListener('input', ()=> renderizarTudo());
}

export async function startPlayback() {
  if (_isPlaying) return;
  _isPlaying = true;
  playheadEl.style.display = 'block';
  btnPlayPause.textContent = '❚❚ Pause';

  const audioBuffer = getAudioBuffer();
  const ctx = ensureAudioContext();

  if (ctx && ctx.state === 'suspended') await ctx.resume();

  let offsetMs = globalMsAtual;
  if (offsetMs === 0) {
    const idx = db.formacoes.findIndex((f)=> f.id === formacaoAtivaId);
    offsetMs = calcularTempoAcumuladoAteFormacao(idx);
  }

  renderAtGlobalMs(offsetMs);
  ensurePlayheadInView();
  if (audioBuffer && ctx) {
    const node = ctx.createBufferSource();
    node.buffer = audioBuffer;
    node.connect(ctx.destination);
    node.onended = ()=> stopPlayback();
    const offsetSec = Math.min(offsetMs / 1000, Math.max(0, audioBuffer.duration - 0.001));
    node.start(0, offsetSec);
    _tempoInicioPlayback = ctx.currentTime - offsetSec;
    setAudioSource(node);
  } else {
    _tempoInicioPlayback = performance.now() - offsetMs;
  }

  const loop = (timestamp: number) => {
    if (!_isPlaying) return;
    let tempoDecorridoMs: number;
    const ctx = getAudioContext();
    const audioBuffer = getAudioBuffer();
    if (audioBuffer && ctx) tempoDecorridoMs = (ctx.currentTime - _tempoInicioPlayback) * 1000;
    else {
      if (_tempoInicioPlayback === 0) _tempoInicioPlayback = timestamp - _tempoPausadoAcumulado;
      tempoDecorridoMs = timestamp - _tempoInicioPlayback;
    }

    const duracaoTotalMs = getTimelineTotalMs();
    if (tempoDecorridoMs >= duracaoTotalMs) {
      renderAtGlobalMs(duracaoTotalMs);
      stopPlayback();
      return;
    }
    renderAtGlobalMs(tempoDecorridoMs);
    ensurePlayheadInView();
    _playbackLoopId = requestAnimationFrame(loop);
  };
  _playbackLoopId = requestAnimationFrame(loop);
}

export function pausePlayback() {
  if (!_isPlaying) return;
  _isPlaying = false;
  btnPlayPause.textContent = '▶ Play';
  if (_playbackLoopId) cancelAnimationFrame(_playbackLoopId);

  const node = getAudioSource();
  const ctx = getAudioContext();
  if (node && ctx) {
    const current = (ctx.currentTime - _tempoInicioPlayback) * 1000;
    (window as any).globalMsAtual = current;
    renderAtGlobalMs(current);
    ensurePlayheadInView();
    try { node.stop(); } catch {}
    setAudioSource(null);
  }
}

export function stopPlayback() {
  _isPlaying = false;
  btnPlayPause.textContent = '▶ Play';
  if (_playbackLoopId) cancelAnimationFrame(_playbackLoopId);
  const node = getAudioSource();
  if (node) { try { node.stop(); } catch {} setAudioSource(null); }
  playheadEl.style.display = 'block';
}

// tiny helper

