
export interface Marcador {
  id: string;
  rotulo: string;
  x: number;
  y: number;
  cor: string;
}

export interface Formacao {
  id: string;
  nome: string;
  ordem: number;
  duracaoSegundos: number;
  tempoTransicaoEntradaSegundos: number;
  marcadores: Marcador[];
}

export interface Projeto {
  id: string;
  titulo: string;
}

export interface DB {
  projeto: Projeto;
  formacoes: Formacao[];
}
