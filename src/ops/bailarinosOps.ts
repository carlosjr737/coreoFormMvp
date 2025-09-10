// src/ops/bailarinosOps.ts
import { db } from '../state';

/** Remove o bailarino de TODAS as formações no DB (somente dados). */
export function removerBailarinoDoDB(bailarinoId: string) {
  db.formacoes.forEach(f => {
    f.marcadores = (f.marcadores || []).filter(m => m.id !== bailarinoId);
  });
  // Se você guarda seleção no db, limpa também
  if ((db as any).selecionados) {
    (db as any).selecionados = (db as any).selecionados.filter((id: string) => id !== bailarinoId);
  }
}
