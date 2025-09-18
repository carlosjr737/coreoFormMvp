
/** Helper to get DOM elements with types */
function el<T extends HTMLElement>(id: string): T {
  const e = document.getElementById(id);
  if (!e) throw new Error(`Elemento não encontrado: #${id}`);
  return e as T;
}

export const tituloProjetoEl = el<HTMLHeadingElement>('titulo-projeto');
export const listaFormacoesEl = el<HTMLUListElement>('lista-formacoes');
export const listaBailarinosEl = el<HTMLUListElement>('lista-bailarinos');
export const buscaBailarinosInput = el<HTMLInputElement>('busca-bailarinos');
export const palcoEl = el<HTMLElement>('palco');
export const timelineBlocosEl = el<HTMLDivElement>('timeline-blocos');
export const timelineContainerEl = el<HTMLDivElement>('timeline-container');
export const timeRulerEl = el<HTMLDivElement>('time-ruler');
export const audioTrackEl = el<HTMLDivElement>('audio-track');
export const audioCanvas = el<HTMLCanvasElement>('audio-canvas');
export const playheadEl = el<HTMLDivElement>('playhead');
export const timeDisplayEl = document.getElementById('time-display') as HTMLSpanElement;


// Buttons & inputs
export const btnPlayPause = el<HTMLButtonElement>('btn-play-pause');
export const btnAnterior = el<HTMLButtonElement>('btn-anterior');
export const btnProxima = el<HTMLButtonElement>('btn-proxima');
export const btnAddFormacao = el<HTMLButtonElement>('btn-add-formacao');

export const btnCarregarAudio = el<HTMLButtonElement>('btn-carregar-audio');
export const audioFileInput = el<HTMLInputElement>('audio-file-input');
export const audioStatusEl = el<HTMLSpanElement>('audio-status');

export const btnZoomOut = el<HTMLButtonElement>('zoom-out');
export const btnZoomIn = el<HTMLButtonElement>('zoom-in');
export const btnZoomReset = el<HTMLButtonElement>('zoom-reset');
export const zoomValueEl = el<HTMLSpanElement>('zoom-value');

// Firebase/auth/projetos
export const btnLogout      = document.getElementById('btn-logout') as HTMLButtonElement;
export const userBadgeEl    = document.getElementById('user-badge') as HTMLSpanElement;

export const btnSalvarProjeto = document.getElementById('btn-salvar-projeto') as HTMLButtonElement;
export const btnNovoProjeto   = document.getElementById('btn-novo-projeto') as HTMLButtonElement;
export const selProjeto       = document.getElementById('sel-projeto') as HTMLSelectElement;

