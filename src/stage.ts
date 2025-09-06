
import { palcoEl } from './dom';
import { db, formacaoAtivaId, isPlaying } from './state';
import type { Marcador, Formacao } from './types';

export function renderizarPalco() {
  palcoEl.innerHTML = '';
  const f = db.formacoes.find(x => x.id === formacaoAtivaId);
  if (!f) return;
  f.marcadores.forEach(criarMarcador);
}

export function renderizarPalcoEmTransicao(origem: Formacao | undefined, destino: Formacao | undefined, progresso: number) {
  if (!origem || !destino) return;
  palcoEl.innerHTML = '';
  origem.marcadores.forEach((ma) => {
    const mb = destino.marcadores.find(m => m.id === ma.id);
    if (!mb) return;
    const x = ma.x + (mb.x - ma.x) * progresso;
    const y = ma.y + (mb.y - ma.y) * progresso;
    const div = document.createElement('div');
    div.className = 'marcador';
    div.textContent = ma.rotulo;
    div.style.backgroundColor = ma.cor;
    div.style.left = `${x}px`;
    div.style.top = `${y}px`;
    palcoEl.appendChild(div);
  });
}

export function criarMarcador(marcador: Marcador) {
  const div = document.createElement('div');
  div.className = 'marcador';
  div.dataset.id = marcador.id;
  div.textContent = marcador.rotulo;
  div.title = marcador.rotulo;
  div.style.backgroundColor = marcador.cor;
  div.style.left = `${marcador.x}px`;
  div.style.top = `${marcador.y}px`;

  div.addEventListener('dblclick', (e) => {
    e.preventDefault();
    if (isPlaying) return;
    const novo = prompt('Novo nome do bailarino:', marcador.rotulo);
    if (novo !== null) {
      const nome = novo.trim();
      if (nome.length) {
        db.formacoes.forEach(f => {
          const m = f.marcadores.find(x => x.id === marcador.id);
          if (m) m.rotulo = nome;
        });
      }
    }
  });

  div.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    if (isPlaying) return;
    if (confirm(`Remover o bailarino ${marcador.rotulo}?`)) {
      db.formacoes.forEach(f => f.marcadores = f.marcadores.filter(m => m.id !== marcador.id));
      // palco re-render é disparado de fora
    }
  });

  div.addEventListener('mousedown', (e) => {
    e.preventDefault();
    if (isPlaying) return;
    const startRect = div.getBoundingClientRect();
    const palcoRect = palcoEl.getBoundingClientRect();
    const oX = e.clientX - startRect.left;
    const oY = e.clientY - startRect.top;
    function onMove(ev: MouseEvent) {
      let x = ev.clientX - palcoRect.left - oX;
      let y = ev.clientY - palcoRect.top - oY;
      x = Math.max(0, Math.min(x, palcoRect.width - startRect.width));
      y = Math.max(0, Math.min(y, palcoRect.height - startRect.height));
      if (ev.shiftKey) {
        x = Math.round(x / 40) * 40;
        y = Math.round(y / 40) * 40;
      }
      div.style.left = `${x}px`;
      div.style.top = `${y}px`;
      // persist position in active formation only
      const f = db.formacoes.find(x => x.id === formacaoAtivaId);
      const m = f?.marcadores.find(x => x.id === marcador.id);
      if (m) { m.x = x; m.y = y; }
    }
    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });

  palcoEl.appendChild(div);
}


// Renderiza o palco usando explicitamente uma formação (sem depender da seleção da UI)
export function renderizarPalcoComFormacao(formacao: Formacao) {
  palcoEl.innerHTML = '';
  formacao.marcadores.forEach(criarMarcador);
}
