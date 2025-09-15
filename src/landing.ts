import { auth, provider, signInWithPopup, onAuthStateChanged } from './firebase';

const btn = document.getElementById('btn-login') as HTMLButtonElement | null;

btn?.addEventListener('click', async () => {
  try {
    await signInWithPopup(auth, provider);
  } catch (e) {
    console.error(e);
  }
});

onAuthStateChanged(auth, (user) => {
  if (user) {
    window.location.href = 'index.html';
  }
});
