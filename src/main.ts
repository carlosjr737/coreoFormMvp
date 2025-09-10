import { renderizarTudo, initScrubHandlers, initZoomControls } from './timeline';
import { initPlaybackAndIO } from './playback';
import { renderizarPalco, renderizarPalcoEmTransicao, renderizarPalcoComFormacao, initBailarinoUI } from './stage'; // <-- ADICIONE initBailarinoUI
import { setZoom } from './state';
import { initAudioUI } from './audio';
import { initSidePanels } from './ui';
import { initAuthUI } from './auth';
import { initPersistenceUI, refreshProjectListUI } from './persist';

// logo após sua inicialização atual:
initAuthUI();
initPersistenceUI();
// tenta preencher a combo de projetos quando possível
setTimeout(refreshProjectListUI, 600);



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


initZoomControls(setZoom);
initScrubHandlers();
initPlaybackAndIO();
initAudioUI();
initBailarinoUI(); // <-- LIGA O BOTÃO + Adicionar Bailarino
initSidePanels();
renderizarTudo(true);

window.addEventListener('resize', ()=> renderizarTudo());

