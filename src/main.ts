import { renderizarTudo, initScrubHandlers, initZoomControls } from './timeline';
import { initPlaybackAndIO } from './playback';
import { renderizarPalco, renderizarPalcoEmTransicao, renderizarPalcoComFormacao, initBailarinoUI } from './stage'; // <-- ADICIONE initBailarinoUI
import { setZoom } from './state';
import { initAudioUI } from './audio';
import { initAuthUI } from './auth';
import { initPersistenceUI, refreshProjectListUI } from './persist';
import { initUI } from './ui';
import { startRecording, stopRecording } from './record';
import { startPresentationRecording, stopPresentationRecording } from './record_canvas';

document.addEventListener('DOMContentLoaded', () => initUI());


// logo após sua inicialização atual:
initAuthUI();
initPersistenceUI();
// tenta preencher a combo de projetos quando possível
setTimeout(refreshProjectListUI, 600);

document.addEventListener('DOMContentLoaded', () => {
  const btnStart = document.getElementById('btn-start-present-rec') as HTMLButtonElement | null;
  const btnStop  = document.getElementById('btn-stop-present-rec')  as HTMLButtonElement | null;

  btnStart?.addEventListener('click', async () => {
    try {
      await startPresentationRecording();
      if (btnStart) btnStart.disabled = true;
      if (btnStop)  btnStop.disabled  = false;
    } catch (e) {
      console.error(e);
      alert('Falha ao iniciar gravação.');
    }
  });

  btnStop?.addEventListener('click', () => {
    stopPresentationRecording();
    if (btnStart) btnStart.disabled = false;
    if (btnStop)  btnStop.disabled  = true;
  });
});


window.addEventListener('DOMContentLoaded', () => {
  initUI();
});

// Stage hooks from timeline
document.addEventListener('stage-render-transition' as any, (e:any)=> {
  const { from, to, t } = e.detail;
  renderizarPalcoEmTransicao(from, to, t);
});
document.addEventListener('stage-render-pause' as any, (e:any)=> {
  const { formacao } = e.detail || {};
  if (formacao) renderizarPalcoComFormacao(formacao); else renderizarPalco();
});

// 👇 re-render quando o banco muda (cria 1ª formação, adiciona bailarino, etc.)
document.addEventListener('db-changed' as any, () => renderizarTudo(true));

initUI();
initZoomControls(setZoom);
initScrubHandlers();
initPlaybackAndIO();
initAudioUI();
initBailarinoUI(); // <-- LIGA O BOTÃO + Adicionar Bailarino
renderizarTudo(true);

window.addEventListener('resize', ()=> renderizarTudo());

// === Faz o palco ocupar o máximo possível (mantendo 16:9) ===
function fitStageToWrapper() {
  const wrapper = document.querySelector('.palco-wrapper') as HTMLElement | null;
  const palco = document.getElementById('palco') as HTMLElement | null;
  if (!wrapper || !palco) return;

  const recalc = () => {
     // NÃO mexe no palco enquanto grava
  if (document.body.classList.contains('recording')) return;
    const W = wrapper.clientWidth;

    // Altura disponível = altura do wrapper - (altura dos controles do palco, se houver) - folga
    const controls = document.querySelector('.palco-controles') as HTMLElement | null;
    const hControls = controls ? controls.offsetHeight : 0;
    const H = wrapper.clientHeight - hControls - 12;

    // Mantém 16:9 ocupando o máximo
    const targetW = Math.min(W, H * (16 / 9));
    const targetH = targetW / (16 / 9);

    palco.style.width = `${Math.floor(targetW)}px`;
    palco.style.height = `${Math.floor(targetH)}px`;
  };

  // Recalcula quando a janela mudar de tamanho
  new ResizeObserver(recalc).observe(wrapper);
  recalc(); // e já calcula agora
}

document.addEventListener('DOMContentLoaded', () => {
  fitStageToWrapper();
});
// === Cria a camada interna do palco (grid claro) ===
function ensureStageAreaLayer() {
  const palco = document.getElementById('palco');
  if (!palco) return;
  if (!palco.querySelector('.stage-area')) {
    const inner = document.createElement('div');
    inner.className = 'stage-area';
    palco.appendChild(inner);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  ensureStageAreaLayer();
});


