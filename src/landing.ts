type AuthMode = 'login' | 'register';

type AuthModule = typeof import('./auth');
type FirebaseModule = typeof import('./firebase');

const isAuthMode = (value: string | undefined): value is AuthMode =>
  value === 'login' || value === 'register';

type LandingAuthDeps = {
  loginWithEmail: AuthModule['loginWithEmail'];
  loginWithGoogle: AuthModule['loginWithGoogle'];
  registerWithEmail: AuthModule['registerWithEmail'];
  auth: FirebaseModule['auth'];
  onAuthStateChanged: FirebaseModule['onAuthStateChanged'];
};

let authDepsPromise: Promise<LandingAuthDeps | null> | null = null;

const loadAuthDeps = async (): Promise<LandingAuthDeps | null> => {
  if (!authDepsPromise) {
    authDepsPromise = (async () => {
      try {
        const [authModule, firebaseModule] = await Promise.all([
          import('./auth'),
          import('./firebase'),
        ]);

        return {
          loginWithEmail: authModule.loginWithEmail,
          loginWithGoogle: authModule.loginWithGoogle,
          registerWithEmail: authModule.registerWithEmail,
          auth: firebaseModule.auth,
          onAuthStateChanged: firebaseModule.onAuthStateChanged,
        };
      } catch (error) {
        console.error('Não foi possível carregar as dependências de autenticação.', error);
        return null;
      }
    })();
  }

  const deps = await authDepsPromise;
  if (!deps) {
    authDepsPromise = null;
  }
  return deps;
};

const prefetchAuthDeps = () => {
  if (!authDepsPromise) {
    void loadAuthDeps();
  }
};

const authUnavailableMessage =
  'Não foi possível conectar ao serviço de autenticação. Verifique sua configuração e tente novamente.';

const selectors = ['#btn-login', '[data-login-button]'];
const loginTargets = new Set<HTMLElement>();

for (const selector of selectors) {
  document.querySelectorAll<HTMLElement>(selector).forEach((element) => {
    loginTargets.add(element);
  });
}

const loginModal = document.querySelector<HTMLElement>('[data-login-modal]');
const loginBackdrop = document.querySelector<HTMLElement>('[data-login-backdrop]');
const modeButtons = Array.from(
  document.querySelectorAll<HTMLButtonElement>('[data-auth-mode]')
);
const authSections = new Map<AuthMode, HTMLElement>();
const authForms = new Map<AuthMode, HTMLFormElement>();
const errorOutputs = new Map<AuthMode, HTMLElement>();
let currentMode: AuthMode = 'login';

const syncAuthParam = (mode?: AuthMode) => {
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  const url = new URL(window.location.href);

  if (mode) {
    url.searchParams.set('auth', mode);
  } else {
    url.searchParams.delete('auth');
  }

  const next = `${url.pathname}${url.search}${url.hash}`;
  if (next !== current) {
    window.history.replaceState({}, '', next);
  }
};

document
  .querySelectorAll<HTMLElement>('[data-auth-section]')
  .forEach((section) => {
    const mode = section.dataset.authSection;
    if (isAuthMode(mode)) {
      authSections.set(mode, section);
    }
  });

document.querySelectorAll<HTMLFormElement>('[data-auth-form]').forEach((form) => {
  const mode = form.dataset.authForm;
  if (isAuthMode(mode)) {
    authForms.set(mode, form);
  }
});

document.querySelectorAll<HTMLElement>('[data-auth-error]').forEach((output) => {
  const mode = output.dataset.authError;
  if (isAuthMode(mode)) {
    errorOutputs.set(mode, output);
  }
});

const clearErrors = (mode?: AuthMode) => {
  if (mode) {
    const output = errorOutputs.get(mode);
    if (output) {
      output.textContent = '';
      output.setAttribute('hidden', '');
    }
    return;
  }

  for (const output of errorOutputs.values()) {
    output.textContent = '';
    output.setAttribute('hidden', '');
  }
};

const showError = (mode: AuthMode, message: string) => {
  const output = errorOutputs.get(mode);
  if (!output) return;
  if (message) {
    output.textContent = message;
    output.removeAttribute('hidden');
  } else {
    output.textContent = '';
    output.setAttribute('hidden', '');
  }
};

const setButtonLoading = (button: HTMLButtonElement | null, loading: boolean) => {
  if (!button) return;

  if (loading) {
    button.dataset.loading = 'true';
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
  } else {
    delete button.dataset.loading;
    button.disabled = false;
    button.removeAttribute('aria-busy');
  }
};

const focusFirstField = (mode: AuthMode) => {
  if (!loginModal) return;
  const field = loginModal.querySelector<HTMLInputElement>(
    `[data-auth-section="${mode}"] input[type="email"]`
  );
  if (field) {
    window.setTimeout(() => field.focus(), 0);
  }
};

const setAuthMode = (mode: AuthMode, { focusField = true } = {}) => {
  currentMode = mode;
  loginModal?.setAttribute('data-auth-mode', mode);

  syncAuthParam(mode);

  modeButtons.forEach((button) => {
    const isActive = button.dataset.authMode === mode;
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-selected', isActive ? 'true' : 'false');
    button.setAttribute('tabindex', isActive ? '0' : '-1');
  });

  authSections.forEach((section, sectionMode) => {
    const isActive = sectionMode === mode;
    section.toggleAttribute('hidden', !isActive);
    section.setAttribute('aria-hidden', isActive ? 'false' : 'true');
  });

  clearErrors();
  if (focusField) {
    focusFirstField(mode);
  }
};

const showLoginModal = (mode: AuthMode = 'login') => {
  if (!loginModal || !loginBackdrop) return;
  prefetchAuthDeps();
  loginModal.hidden = false;
  loginModal.setAttribute('aria-hidden', 'false');
  loginBackdrop.hidden = false;
  loginBackdrop.setAttribute('aria-hidden', 'false');
  document.body.classList.add('auth-modal-open');
  setAuthMode(mode);
};

const hideLoginModal = () => {
  if (!loginModal || !loginBackdrop) return;
  loginModal.hidden = true;
  loginModal.setAttribute('aria-hidden', 'true');
  loginBackdrop.hidden = true;
  loginBackdrop.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('auth-modal-open');
  clearErrors();
  authForms.forEach((form) => form.reset());
  syncAuthParam();
};

const formatFirebaseError = (error: unknown) => {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = String((error as { code?: string }).code ?? '');
    switch (code) {
      case 'auth/invalid-email':
        return 'Informe um email válido para continuar.';
      case 'auth/missing-password':
      case 'auth/weak-password':
        return 'A senha precisa ter pelo menos 6 caracteres.';
      case 'auth/email-already-in-use':
        return 'Este email já possui cadastro. Tente fazer login.';
      case 'auth/invalid-credential':
      case 'auth/user-not-found':
      case 'auth/wrong-password':
        return 'Não foi possível encontrar uma conta com essas credenciais.';
      case 'auth/popup-closed-by-user':
      case 'auth/cancelled-popup-request':
        return '';
      default:
        return 'Não foi possível completar a solicitação. Tente novamente.';
    }
  }
  return 'Não foi possível completar a solicitação. Tente novamente.';
};

const validateCredentials = (mode: AuthMode, email: string, password: string) => {
  if (!email) {
    showError(mode, 'Informe um email válido para continuar.');
    return false;
  }
  if (!password || password.length < 6) {
    showError(mode, 'A senha precisa ter pelo menos 6 caracteres.');
    return false;
  }
  return true;
};

const handleAuthFormSubmit = async (event: SubmitEvent) => {
  event.preventDefault();
  const form = event.currentTarget as HTMLFormElement;
  const mode = form.dataset.authForm;
  if (!isAuthMode(mode)) return;

  clearErrors(mode);

  const formData = new FormData(form);
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '').trim();

  if (!validateCredentials(mode, email, password)) {
    return;
  }

  const submitButton = form.querySelector<HTMLButtonElement>('button[type="submit"]');
  setButtonLoading(submitButton, true);

  try {
    const deps = await loadAuthDeps();
    if (!deps) {
      showError(mode, authUnavailableMessage);
      return;
    }

    if (mode === 'login') {
      await deps.loginWithEmail(email, password);
    } else {
      await deps.registerWithEmail(email, password);
    }
    form.reset();
    hideLoginModal();
  } catch (error) {
    console.error(error);
    const message = formatFirebaseError(error);
    if (message) {
      showError(mode, message);
    }
  } finally {
    setButtonLoading(submitButton, false);
  }
};

authForms.forEach((form) => {
  form.addEventListener('submit', handleAuthFormSubmit);
});

const handleLoginClick = (event: Event) => {
  event.preventDefault();
  const element = event.currentTarget as HTMLElement;
  const mode = element.dataset.authOpenMode;
  prefetchAuthDeps();
  showLoginModal(isAuthMode(mode) ? mode : 'login');
};

loginTargets.forEach((element) => {
  element.addEventListener('click', handleLoginClick);
  element.addEventListener('pointerenter', prefetchAuthDeps, { once: true });
  element.addEventListener('focus', prefetchAuthDeps, { once: true });
});

const closeButtons = document.querySelectorAll<HTMLElement>('[data-close-login-modal]');
closeButtons.forEach((button) => {
  button.addEventListener('click', (event) => {
    event.preventDefault();
    hideLoginModal();
  });
});

loginBackdrop?.addEventListener('click', () => hideLoginModal());

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !loginModal?.hidden) {
    hideLoginModal();
  }
});

modeButtons.forEach((button) => {
  button.addEventListener('click', (event) => {
    event.preventDefault();
    const mode = (event.currentTarget as HTMLButtonElement).dataset.authMode;
    if (isAuthMode(mode)) {
      setAuthMode(mode);
    }
  });
});

const googleButton = document.querySelector<HTMLButtonElement>('[data-google-login]');

googleButton?.addEventListener('click', async (event) => {
  event.preventDefault();
  setButtonLoading(googleButton, true);
  clearErrors(currentMode);
  try {
    const deps = await loadAuthDeps();
    if (!deps) {
      showError(currentMode, authUnavailableMessage);
      return;
    }

    await deps.loginWithGoogle();
    hideLoginModal();
  } catch (error) {
    console.error(error);
    const message = formatFirebaseError(error);
    if (message) {
      showError(currentMode, message);
    }
  } finally {
    setButtonLoading(googleButton, false);
  }
});

void loadAuthDeps().then((deps) => {
  if (!deps) return;
  const { auth, onAuthStateChanged } = deps;
  onAuthStateChanged(auth, (user) => {
    if (user) {
      window.location.href = 'index.html';
    }
  });
});

const urlParams = new URLSearchParams(window.location.search);
const initialAuthModeParam = urlParams.get('auth') ?? undefined;
if (isAuthMode(initialAuthModeParam)) {
  prefetchAuthDeps();
  showLoginModal(initialAuthModeParam);
}
