// src/auth.ts
import { auth, provider } from './firebase';
import { signInWithPopup, onAuthStateChanged, signOut, User } from 'firebase/auth';
import { renderizarTudo } from './timeline';
import { btnLogin, btnLogout, userBadgeEl } from './dom';

let _user: User | null = null;
export function getUser(){ return _user; }

export function initAuthUI() {
  btnLogin?.addEventListener('click', async () => {
    try { await signInWithPopup(auth, provider); } catch (e) { console.error(e); }
  });

  btnLogout?.addEventListener('click', async () => {
    try { await signOut(auth); } catch (e) { console.error(e); }
  });

  onAuthStateChanged(auth, (u) => {
    _user = u;

    // UI básica
    if (u) {
      btnLogin.style.display = 'none';
      btnLogout.style.display = '';
      if (userBadgeEl) userBadgeEl.textContent = u.displayName || u.email || 'logado';
    } else {
      btnLogin.style.display = '';
      btnLogout.style.display = 'none';
      if (userBadgeEl) userBadgeEl.textContent = 'offline';
    }

    // avisa o resto do app (dropdown de projetos, etc.)
    document.dispatchEvent(new CustomEvent('auth-changed', {
      detail: u ? { uid: u.uid } : null
    }));

    renderizarTudo();
  });
}
