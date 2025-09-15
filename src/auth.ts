// src/auth.ts
import { auth, provider, signInWithPopup, signOut, onAuthStateChanged } from './firebase';
import type { User } from 'firebase/auth';
import { renderizarTudo } from './timeline';
import { btnLogin, btnLogout, userBadgeEl } from './dom';

let _user: User | null = null;
export function getUser(){ return _user; }

export async function signIn() {
  try { await signInWithPopup(auth, provider); } catch (e) { console.error(e); }
}

export function initAuthUI() {
  btnLogin?.addEventListener('click', signIn);

  btnLogout?.addEventListener('click', async () => {
    try { await signOut(auth); } catch (e) { console.error(e); }
  });

  onAuthStateChanged(auth, (u) => {
    _user = u;

    if (u) {
      if (btnLogin) btnLogin.style.display = 'none';
      if (btnLogout) btnLogout.style.display = '';
      if (userBadgeEl) userBadgeEl.textContent = u.displayName || u.email || 'logado';
    } else {
      if (btnLogin) btnLogin.style.display = '';
      if (btnLogout) btnLogout.style.display = 'none';
      if (userBadgeEl) userBadgeEl.textContent = 'offline';
    }

    document.dispatchEvent(new CustomEvent('auth-changed', {
      detail: u ? { uid: u.uid } : null
    }));

    renderizarTudo();
  });
}
