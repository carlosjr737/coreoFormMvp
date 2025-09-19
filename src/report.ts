import { db, collection, doc, addDoc, setDoc, serverTimestamp } from './firebase';
import { getUser } from './auth';


const offlineStatusMessage =
  'Parece que você está offline. Conecte-se à internet e tente novamente.';

const encouragementMessage =
  'Compartilhe ideias, bugs, sugestões ou melhorias que podem fortalecer o CoreoForm. Quanto mais detalhes, melhor!';

type StatusType = 'idle' | 'error' | 'success';


const mapReportError = (error: unknown): string => {
  if (error && typeof error === 'object') {
    const { code, message } = error as { code?: string; message?: string };
    if (code === 'permission-denied' || code === 'unauthenticated') {
      return 'Sua sessão expirou. Faça login novamente para enviar seu feedback.';
    }
    if (code === 'failed-precondition' || code === 'unavailable') {
      return offlineStatusMessage;
    }
    if (typeof message === 'string') {
      const normalized = message.toLowerCase();
      if (normalized.includes('offline') || normalized.includes('unavailable')) {
        return offlineStatusMessage;
      }
    }
  }

  return 'Não foi possível enviar agora. Tente novamente em instantes.';
};


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

  let previousBodyOverflow: string | null = null;

  const lockBodyScroll = (shouldLock: boolean) => {
    const body = document.body;
    if (!body) return;

    if (shouldLock) {
      if (previousBodyOverflow === null) {
        previousBodyOverflow = body.style.overflow;
      }
      body.dataset.reportModalOpen = 'true';
      body.style.overflow = 'hidden';
      return;
    }

    delete body.dataset.reportModalOpen;
    if (previousBodyOverflow !== null) {
      if (previousBodyOverflow) {
        body.style.overflow = previousBodyOverflow;
      } else {
        body.style.removeProperty('overflow');
      }
      previousBodyOverflow = null;
    } else {
      body.style.removeProperty('overflow');
    }
  };


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

    lockBodyScroll(true);

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

    lockBodyScroll(false);

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


    if (typeof navigator !== 'undefined' && navigator && navigator.onLine === false) {
      setStatus(offlineStatusMessage, 'error');
      return;
    }

    try {
      setLoading(true);
      const userDocRef = doc(db, 'users', user.uid);
      const reportsCollection = collection(userDocRef, 'reports');
      const payload = {
        uid: user.uid,
        message,
        createdAt: serverTimestamp(),
        source: 'app-report',
        userEmail: user.email ?? null,
        userName: user.displayName ?? null,
      };

      await setDoc(
        userDocRef,
        {
          uid: user.uid,
          email: user.email ?? null,
          displayName: user.displayName ?? null,
          lastFeedbackAt: serverTimestamp(),
        },
        { merge: true }
      );

      await addDoc(reportsCollection, payload);
      setStatus('Obrigado! Sua contribuição foi enviada.', 'success');
      form.reset();
      window.setTimeout(() => {
        closeModal();
      }, 900);
    } catch (error) {
      console.error('Erro ao enviar report', error);

      setStatus(mapReportError(error), 'error');

    } finally {
      setLoading(false);
    }
  });
}
