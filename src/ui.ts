import { renderizarBarraLateral } from './timeline';
import { renderizarPainelBailarinos } from './bailarinos';

export function initSidePanels() {
  const btnF = document.getElementById('btn-panel-formacoes') as HTMLButtonElement | null;
  const btnB = document.getElementById('btn-panel-bailarinos') as HTMLButtonElement | null;
  const pF = document.getElementById('panel-formacoes') as HTMLElement | null;
  const pB = document.getElementById('panel-bailarinos') as HTMLElement | null;

  if (!btnF || !btnB || !pF || !pB) return;

  function show(panel: 'f'|'b') {
    const fActive = panel === 'f';
    btnF?.classList.toggle('active', fActive);
    btnB?.classList.toggle('active', !fActive);
    pF?.classList.toggle('hidden', !fActive);
    pB?.classList.toggle('hidden', fActive);

    if (fActive) renderizarBarraLateral();
    else renderizarPainelBailarinos();
  }

  btnF.addEventListener('click', () => show('f'));
  btnB.addEventListener('click', () => show('b'));

  // inicial
  show('f');

  // quando o DB mudar (criou formação, adicionou bailarino etc.), re-render do painel visível
  document.addEventListener('db-changed' as any, () => {
    if (!pF.classList.contains('hidden')) renderizarBarraLateral();
    if (!pB.classList.contains('hidden')) renderizarPainelBailarinos();
  });
  // quando seleção mudar, atualizar painel de bailarinos (highlight)
  document.addEventListener('selection-changed' as any, () => {
    if (!pB.classList.contains('hidden')) renderizarPainelBailarinos();
  });
}
