
import { db } from './state';

export function exportarJSON() {
  const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${db.projeto.titulo.replace(/\s+/g,'_').toLowerCase()}_${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function importarJSON(arquivo: File, onLoaded: () => void) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(String(e.target?.result));
      if (!data?.formacoes?.length) throw new Error('Formato inválido');
      Object.assign(db, data);
      onLoaded();
    } catch (err: any) {
      alert('Falha ao importar JSON: ' + err.message);
    }
  };
  reader.readAsText(arquivo);
}
