// src/landing.ts
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase';

type AuthMode = 'login' | 'register';
type AuthModule = typeof import('./auth');

const isAuthMode = (value: string | undefined): value is AuthMode =>
  value === 'login' || value === 'register';

type LandingAuthDeps = {
  loginWithEmail: AuthModule['loginWithEmail'];
  loginWithGoogle: AuthModule['loginWithGoogle'];
  registerWithEmail: AuthModule['registerWithEmail'];
};

let authDepsPromise: Promise<LandingAuthDeps | null> | null = null;

/* ------------------------- lazy import do módulo auth ------------------------ */
const loadAuthDeps = async (): Promise<LandingAuthDeps | null> => {
  if (!authDepsPromise) {
    authDepsPromise = (async () => {
      try {
        const authModule = await import('./auth');
        return {
          loginWithEmail: authModule.loginWithEmail,
          loginWithGoogle: authModule.loginWithGoogle,
          registerWithEmail: authModule.registerWithEmail,
        };
      } catch (error) {
        console.error('Não foi possível carregar as dependências de autenticação.', error);
        return null;
      }
    })();
  }
  const deps = await authDepsPromise;
  if (!deps) authDepsPromise = null;
  return deps;
};

const prefetchAuthDeps = () => {
  if (!authDepsPromise) void loadAuthDeps();
};

/* ------------------------------ utilidades UI ------------------------------- */
const authUnavailableMessage =
  'Não foi possível conectar ao serviço de autenticação. Verifique sua configuração e tente novamente.';

const selectors = ['#btn-login', '[data-login-button]'];
const loginTargets = new Set<HTMLElement>();
for (const selector of selectors) {
  document.querySelectorAll<HTMLElement>(selector).forEach((el) => loginTargets.add(el));
}

const loginModal = document.querySelector<HTMLElement>('[data-login-modal]');
const loginBackdrop = document.querySelector<HTMLElement>('[data-login-backdrop]');
const modeButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-auth-mode]'));
const authSections = new Map<AuthMode, HTMLElement>();
const authForms = new Map<AuthMode, HTMLFormElement>();
const errorOutputs = new Map<AuthMode, HTMLElement>();
let currentMode: AuthMode = 'login';

const isLandingPath = (pathname: string) =>
  pathname.endsWith('/landing.html') || pathname.endsWith('/landing') || pathname === '/landing';

const redirectToApp = () => {
  const target = new URL('/', window.location.origin).toString();
  if (window.location.href !== target) window.location.replace(target);
};

const syncAuthParam = (mode?: AuthMode) => {
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  const url = new URL(window.location.href);
  if (mode) url.searchParams.set('auth', mode);
  else url.searchParams.delete('auth');
  const next = `${url.pathname}${url.search}${url.hash}`;
  if (next !== current) window.history.replaceState({}, '', next);
};

document.querySelectorAll<HTMLElement>('[data-auth-section]').forEach((section) => {
  const mode = section.dataset.authSection;
  if (isAuthMode(mode)) authSections.set(mode, section);
});
document.querySelectorAll<HTMLFormElement>('[data-auth-form]').forEach((form) => {
  const mode = form.dataset.authForm;
  if (isAuthMode(mode)) authForms.set(mode, form);
});
document.querySelectorAll<HTMLElement>('[data-auth-error]').forEach((output) => {
  const mode = output.dataset.authError;
  if (isAuthMode(mode)) errorOutputs.set(mode, output);
});

const clearErrors = (mode?: AuthMode) => {
  if (mode) {
    const out = errorOutputs.get(mode);
    if (out) {
      out.textContent = '';
      out.setAttribute('hidden', '');
    }
    return;
  }
  for (const out of errorOutputs.values()) {
    out.textContent = '';
    out.setAttribute('hidden', '');
  }
};

const showError = (mode: AuthMode, message: string) => {
  const out = errorOutputs.get(mode);
  if (!out) return;
  if (message) {
    out.textContent = message;
    out.removeAttribute('hidden');
  } else {
    out.textContent = '';
    out.setAttribute('hidden', '');
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
    `[data-auth-section="${mode}"] input[type="email"]`,
  );
  if (field) window.setTimeout(() => field.focus(), 0);
};

const setAuthMode = (mode: AuthMode, { focusField = true } = {}) => {
  currentMode = mode;
  loginModal?.setAttribute('data-auth-mode', mode);
  syncAuthParam(mode);

  modeButtons.forEach((btn) => {
    const active = btn.dataset.authMode === mode;
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-selected', active ? 'true' : 'false');
    btn.setAttribute('tabindex', active ? '0' : '-1');
  });

  authSections.forEach((section, sectionMode) => {
    const active = sectionMode === mode;
    section.toggleAttribute('hidden', !active);
    section.setAttribute('aria-hidden', active ? 'false' : 'true');
  });

  clearErrors();
  if (focusField) focusFirstField(mode);
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
      case 'auth/unauthorized-domain':
        return 'Este domínio ainda não está autorizado para login. Abra o app pelo link oficial enviado pela equipe.';
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

/* ----------------------------- handlers de forms ---------------------------- */
const handleAuthFormSubmit = async (event: SubmitEvent) => {
  event.preventDefault();
  const form = event.currentTarget as HTMLFormElement;
  const mode = form.dataset.authForm;
  if (!isAuthMode(mode)) return;

  clearErrors(mode);

  const formData = new FormData(form);
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '').trim();

  if (!validateCredentials(mode, email, password)) return;

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
    hideLoginModal(); // o onAuthStateChanged fará o redirect
  } catch (error) {
    console.error(error);
    const message = formatFirebaseError(error);
    if (message) showError(mode, message);
  } finally {
    setButtonLoading(submitButton, false);
  }
};

authForms.forEach((form) => form.addEventListener('submit', handleAuthFormSubmit));

/* --------------------------- botões que abrem modal ------------------------- */
const handleLoginClick = (event: Event) => {
  event.preventDefault();
  const el = event.currentTarget as HTMLElement;
  const mode = el.dataset.authOpenMode;
  prefetchAuthDeps();
  showLoginModal(isAuthMode(mode) ? mode : 'login');
};

loginTargets.forEach((el) => {
  el.addEventListener('click', handleLoginClick);
  el.addEventListener('pointerenter', prefetchAuthDeps, { once: true });
  el.addEventListener('focus', prefetchAuthDeps, { once: true });
});

/* ------------------------ fechar modal / teclas / bg ------------------------ */
document
  .querySelectorAll<HTMLElement>('[data-close-login-modal]')
  .forEach((btn) => btn.addEventListener('click', (e) => { e.preventDefault(); hideLoginModal(); }));

loginBackdrop?.addEventListener('click', () => hideLoginModal());

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !loginModal?.hidden) hideLoginModal();
});

/* ------------------------------ tabs login/reg ------------------------------ */
modeButtons.forEach((button) => {
  button.addEventListener('click', (e) => {
    e.preventDefault();
    const mode = (e.currentTarget as HTMLButtonElement).dataset.authMode;
    if (isAuthMode(mode)) setAuthMode(mode);
  });
});

/* ------------------------------ login com google ---------------------------- */
const googleButton = document.querySelector<HTMLButtonElement>('[data-google-login]');
googleButton?.addEventListener('click', async (e) => {
  e.preventDefault();
  setButtonLoading(googleButton, true);
  clearErrors(currentMode);
  try {
    const deps = await loadAuthDeps();
    if (!deps) {
      showError(currentMode, authUnavailableMessage);
      return;
    }
    await deps.loginWithGoogle();
    hideLoginModal(); // onAuthStateChanged redireciona
  } catch (error) {
    console.error(error);
    const message = formatFirebaseError(error);
    if (message) showError(currentMode, message);
  } finally {
    setButtonLoading(googleButton, false);
  }
});

/* ------------------------ estado inicial e redireciono ---------------------- */
document.documentElement.classList.toggle('is-authenticated', !!auth.currentUser);

// Se já estiver logado e estivermos na landing, vai pro app.
if (auth.currentUser && isLandingPath(window.location.pathname)) {
  redirectToApp();
}

onAuthStateChanged(auth, (user) => {
  document.documentElement.classList.toggle('is-authenticated', !!user);
  // Depois do login (popup/credenciais), estamos na landing → redireciona.
  if (user && isLandingPath(window.location.pathname)) {
    redirectToApp();
  }
});

/* ------------------------ abre modal conforme ?auth= ------------------------ */
const urlParams = new URLSearchParams(window.location.search);
const initialAuthModeParam = urlParams.get('auth') ?? undefined;
if (isAuthMode(initialAuthModeParam)) {
  prefetchAuthDeps();
  showLoginModal(initialAuthModeParam);
}
