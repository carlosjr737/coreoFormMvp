
import { btnAnterior, btnPlayPause, btnProxima, btnAddFormacao, playheadEl, buscaBailarinosInput } from './dom';
import { adicionarFormacao, calcularTempoAcumuladoAteFormacao, getTimelineTotalMs, mudarFormacaoAtiva, renderAtGlobalMs, renderizarTudo, ensurePlayheadInView } from './timeline';
import { db, formacaoAtivaId, globalMsAtual, isPlaying, playbackLoopId, tempoInicioPlayback, tempoPausadoAcumulado } from './state';
import { renderizarPalco, renderizarPalcoEmTransicao, renderizarPalcoComFormacao } from './stage';
import { ensureAudioContext, getAudioBuffer, getAudioContext, getAudioSource, setAudioSource, wireSourceToGraph } from './audio';

let _isPlaying = isPlaying;
function setPlayUI(playing: boolean) {
  if (!btnPlayPause) return;
  btnPlayPause.textContent = playing ? '⏸' : '▶';
  btnPlayPause.setAttribute('aria-label', playing ? 'Pausar' : 'Tocar');
}

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
  setPlayUI(true);



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
    // Conecta áudio do play ao master (alto-falantes + gravação)
wireSourceToGraph(node);


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
  setPlayUI(false);

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

