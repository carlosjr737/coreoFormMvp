import { auth, provider, signInWithPopup, onAuthStateChanged } from './firebase';

const selectors = ['#btn-login', '[data-login-button]'];
const loginTargets = new Set<HTMLElement>();

for (const selector of selectors) {
  document.querySelectorAll<HTMLElement>(selector).forEach((element) => {
    loginTargets.add(element);
  });
}

const handleLoginClick = async (event: Event) => {
  event.preventDefault();
  try {
    await signInWithPopup(auth, provider);
  } catch (e) {
    console.error(e);
  }
};

loginTargets.forEach((element) => {
  element.addEventListener('click', handleLoginClick);
});

onAuthStateChanged(auth, (user) => {
  if (user) {
    window.location.href = 'index.html';
  }
});
