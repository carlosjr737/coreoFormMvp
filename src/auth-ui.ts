// src/auth-ui.ts
import type { User } from 'firebase/auth';
import { signIn, signOut, onAuthStateChanged } from './auth';
import { renderizarTudo } from './timeline';

export interface AuthUIElements {
  btnLogin?: HTMLButtonElement | null;
  btnLogout?: HTMLButtonElement | null;
  userBadgeEl?: HTMLElement | null;
}

export function initAuthUI({ btnLogin, btnLogout, userBadgeEl }: AuthUIElements) {
  btnLogin?.addEventListener('click', async () => {
    try {
      await signIn();
    } catch (e) {
      console.error(e);
    }
  });

  btnLogout?.addEventListener('click', async () => {
    try {
      await signOut();
    } catch (e) {
      console.error(e);
    }
  });

  onAuthStateChanged((u: User | null) => {
    if (u) {
      if (btnLogin) btnLogin.style.display = 'none';
      if (btnLogout) btnLogout.style.display = '';
      if (userBadgeEl) userBadgeEl.textContent = u.displayName || u.email || 'logado';
    } else {
      if (btnLogin) btnLogin.style.display = '';
      if (btnLogout) btnLogout.style.display = 'none';
      if (userBadgeEl) userBadgeEl.textContent = 'offline';
    }

    document.dispatchEvent(
      new CustomEvent('auth-changed', { detail: u ? { uid: u.uid } : null })
    );

    renderizarTudo();
  });
}
