import { signIn } from './auth';

const btn = document.getElementById('btn-entrar');

btn?.addEventListener('click', async () => {
  try {
    await signIn();
    window.location.href = 'index.html';
  } catch (e) {
    console.error(e);
  }
});
