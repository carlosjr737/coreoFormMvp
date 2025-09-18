import { db, collection, addDoc, serverTimestamp } from './firebase';
import { getUser } from './auth';

const encouragementMessage =
  'Compartilhe ideias, bugs, sugestões ou melhorias que podem fortalecer o CoreoForm. Quanto mais detalhes, melhor!';

type StatusType = 'idle' | 'error' | 'success';

export function initReportUI() {
  const reportButton = document.getElementById('btn-open-report') as HTMLButtonElement | null;
  const modal = document.querySelector<HTMLElement>('[data-report-modal]');
  const backdrop = document.querySelector<HTMLElement>('[data-report-backdrop]');
  const form = document.querySelector<HTMLFormElement>('[data-report-form]');
  const textarea = document.querySelector<HTMLTextAreaElement>('[data-report-input]');
  const statusEl = document.querySelector<HTMLElement>('[data-report-status]');

  if (!reportButton || !modal || !backdrop || !form || !textarea || !statusEl) {
    return;
  }

  const submitButton = form.querySelector<HTMLButtonElement>('button[type="submit"]');

  const setStatus = (message: string, type: StatusType = 'idle') => {
    statusEl.textContent = message;
    if (type === 'idle') {
      delete statusEl.dataset.status;
    } else {
      statusEl.dataset.status = type;
    }
  };

  const setLoading = (loading: boolean) => {
    if (!submitButton) return;
    submitButton.disabled = loading;
    if (loading) {
      submitButton.setAttribute('aria-busy', 'true');
    } else {
      submitButton.removeAttribute('aria-busy');
    }
  };

  const openModal = () => {
    modal.hidden = false;
    modal.setAttribute('aria-hidden', 'false');
    backdrop.hidden = false;
    backdrop.setAttribute('aria-hidden', 'false');
    document.body.classList.add('report-modal-open');
    setStatus('');
    if (!textarea.placeholder) {
      textarea.placeholder = encouragementMessage;
    }
    window.setTimeout(() => textarea.focus(), 0);
  };

  const closeModal = () => {
    modal.hidden = true;
    modal.setAttribute('aria-hidden', 'true');
    backdrop.hidden = true;
    backdrop.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('report-modal-open');
    form.reset();
    setStatus('');
  };

  reportButton.addEventListener('click', (event) => {
    event.preventDefault();
    openModal();
  });

  backdrop.addEventListener('click', () => {
    closeModal();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !modal.hidden) {
      closeModal();
    }
  });

  form.querySelectorAll<HTMLElement>('[data-close-report-modal]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.preventDefault();
      closeModal();
    });
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    setStatus('');

    const message = textarea.value.trim();
    if (!message) {
      setStatus('Escreva sua sugestão para enviar.', 'error');
      textarea.focus();
      return;
    }

    const user = getUser();
    if (!user) {
      setStatus('Faça login novamente para enviar seu feedback.', 'error');
      return;
    }

    const payload = {
      uid: user.uid,
      message,
      createdAt: serverTimestamp(),
      source: 'app-report',
      userEmail: user.email ?? null,
      userName: user.displayName ?? null,
    };

    try {
      setLoading(true);
      await addDoc(collection(db, 'reports'), payload);
      setStatus('Obrigado! Sua contribuição foi enviada.', 'success');
      form.reset();
      window.setTimeout(() => {
        closeModal();
      }, 900);
    } catch (error) {
      console.error('Erro ao enviar report', error);
      setStatus('Não foi possível enviar agora. Tente novamente em instantes.', 'error');
    } finally {
      setLoading(false);
    }
  });
}
