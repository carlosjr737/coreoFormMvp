
import { renderizarTudo, initScrubHandlers, initZoomControls } from './timeline';
import { initPlaybackAndIO } from './playback';
import { renderizarPalco, renderizarPalcoEmTransicao, renderizarPalcoComFormacao } from './stage';
import { setZoom } from './state';
import { initAudioUI } from './audio';

// Stage hooks from timeline
document.addEventListener('stage-render-transition' as any, (e:any)=> {
  const { from, to, t } = e.detail;
  renderizarPalcoEmTransicao(from, to, t);
});
document.addEventListener('stage-render-pause' as any, (e:any)=> {
  const { formacao } = e.detail || {};
  if (formacao) renderizarPalcoComFormacao(formacao); else renderizarPalco();
});

initZoomControls(setZoom);
initScrubHandlers();
initPlaybackAndIO();
initAudioUI();
renderizarTudo(true);

window.addEventListener('resize', ()=> renderizarTudo());
