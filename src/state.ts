
import type { DB } from './types';

export const coresBailarinos = ['#ef4444', '#3b82f6', '#22c55e', '#f97316', '#8b5cf6', '#eab308', '#14b8a6'] as const;

export let db: DB = {
  projeto: { id: 'proj1', titulo: 'Coreografia v8.7' },
  formacoes: [
    { id: 'f1', nome: 'Início', ordem: 1, duracaoSegundos: 2, tempoTransicaoEntradaSegundos: 0,
      marcadores: [ { id: 'm1', rotulo: 'D1', x: 100, y: 150, cor: '#ef4444' },
                    { id: 'm2', rotulo: 'D2', x: 200, y: 150, cor: '#3b82f6' } ] },
    { id: 'f2', nome: 'Abertura', ordem: 2, duracaoSegundos: 1.5, tempoTransicaoEntradaSegundos: 1,
      marcadores: [ { id: 'm1', rotulo: 'D1', x: 150, y: 50, cor: '#ef4444' },
                    { id: 'm2', rotulo: 'D2', x: 150, y: 250, cor: '#3b82f6' } ] },
    { id: 'f3', nome: 'Final', ordem: 3, duracaoSegundos: 3, tempoTransicaoEntradaSegundos: 2,
      marcadores: [ { id: 'm1', rotulo: 'D1', x: 400, y: 150, cor: '#ef4444' },
                    { id: 'm2', rotulo: 'D2', x: 500, y: 150, cor: '#3b82f6' } ] }
  ]
};

export let formacaoAtivaId: string | null = db.formacoes[0]?.id ?? null;

// Zoom / time base
export let zoom = 1;
export const ZOOM_MIN = 0.25, ZOOM_MAX = 8, ZOOM_STEP = 0.25;
export const BASE_PX_PER_SEC = 120;

// Playback state
export let isPlaying = false;
export let playbackLoopId = 0 as number | undefined;
export let tempoInicioPlayback = 0;
export let tempoPausadoAcumulado = 0;
export let globalMsAtual = 0;

export function setFormacaoAtiva(id: string | null) { formacaoAtivaId = id; }
export function setZoom(z: number) { zoom = z; }
export function setGlobalMs(t: number) { globalMsAtual = t; }
