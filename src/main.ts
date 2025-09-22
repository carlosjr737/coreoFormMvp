import { renderizarTudo, initScrubHandlers, initZoomControls } from './timeline';
import { initPlaybackAndIO } from './playback';
import { renderizarPalco, renderizarPalcoEmTransicao, renderizarPalcoComFormacao, initBailarinoUI } from './stage'; // <-- ADICIONE initBailarinoUI
import { setZoom } from './state';
import { initAudioUI } from './audio';
import { requireAuth, logout, getUser, redirectToLanding } from './auth';
import { initPersistenceUI, refreshProjectListUI } from './persist';
import { initUI } from './ui';
import { startRecording, stopRecording } from './record';
import { startPresentationRecording, stopPresentationRecording } from './record_canvas';
import { btnLogout, userBadgeEl } from './dom';
import { initReportUI } from './report';

const runWhenDomReady = (callback: () => void) => {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', callback, { once: true });
    return;
  }

  callback();
};


if (btnLogout && !btnLogout.hasAttribute('type')) {
  btnLogout.type = 'button';
}

btnLogout?.addEventListener('click', async (event) => {
  event.preventDefault();
  const action = btnLogout?.dataset.authAction;

  if (action === 'login') {

    redirectToLanding();

    return;
  }

  try {
    await logout();
  } catch (e) {
    console.error(e);
  }
});

const updateAuthUI = () => {
  const user = getUser();
  if (btnLogout) {
    btnLogout.style.display = '';
    if (user) {
      btnLogout.textContent = 'Sair';
      btnLogout.dataset.authAction = 'logout';
      btnLogout.setAttribute('aria-label', 'Sair da conta e voltar para a landing');
    } else {
      btnLogout.textContent = 'Entrar';
      btnLogout.dataset.authAction = 'login';
      btnLogout.setAttribute('aria-label', 'Ir para a tela de login');
    }
  }

  if (userBadgeEl) {
    userBadgeEl.textContent = user ? user.displayName || user.email || 'logado' : 'offline';
  }
};

document.addEventListener('auth-changed' as any, updateAuthUI);
updateAuthUI();

document.addEventListener('DOMContentLoaded', () => {
  const btnStart = document.getElementById('btn-start-present-rec') as HTMLButtonElement | null;
  const btnStop  = document.getElementById('btn-stop-present-rec')  as HTMLButtonElement | null;
  const recBar   = document.getElementById('present-rec-bar') as HTMLDivElement | null;
  const startIdleLabel = btnStart?.textContent?.trim() || '🎥 Gravar';
  const stopIdleLabel  = btnStop?.textContent?.trim() || '■ Parar';

  btnStart?.addEventListener('click', async () => {
    try {
      if (btnStart) btnStart.disabled = true;
      await startPresentationRecording();
    } catch (e) {
      console.error(e);
      alert('Falha ao iniciar gravação.');
      if (btnStart) btnStart.disabled = false;
    }
  });

  btnStop?.addEventListener('click', () => {
    stopPresentationRecording();
  });

  document.addEventListener('present-recording-started', () => {
    recBar?.classList.add('is-recording');
    if (btnStart) {
      btnStart.disabled = true;
      btnStart.textContent = '● Gravando…';
      btnStart.setAttribute('aria-pressed', 'true');
    }
    if (btnStop) {
      btnStop.disabled = false;
      btnStop.textContent = '■ Encerrar';
      btnStop.focus();
    }
  });

  document.addEventListener('present-recording-stopped', () => {
    recBar?.classList.remove('is-recording');
    if (btnStart) {
      btnStart.disabled = false;
      btnStart.textContent = startIdleLabel;
      btnStart.removeAttribute('aria-pressed');
    }
    if (btnStop) {
      btnStop.disabled = true;
      btnStop.textContent = stopIdleLabel;
    }
  });
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

const bootstrapAfterAuth = () => {
  runWhenDomReady(() => {
    initUI();
    initPersistenceUI();
    initReportUI();
    window.setTimeout(refreshProjectListUI, 600);

    initZoomControls(setZoom);
    initScrubHandlers();
    initPlaybackAndIO();
    initAudioUI();
    initBailarinoUI(); // <-- LIGA O BOTÃO + Adicionar Bailarino

    renderizarTudo(true);
    window.addEventListener('resize', () => renderizarTudo());
  });
};

const ensureAuthenticated = async () => {
  try {
    await requireAuth();
    bootstrapAfterAuth();
  } catch (error) {
    console.warn('Redirecionando para a landing por ausência de autenticação.', error);
  }
};

void ensureAuthenticated();

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


