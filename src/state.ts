import type { DB } from './types';

export const DEFAULT_DANCER_COLOR = '#ff4d6d';
export const coresBailarinos = ['#ef4444', '#3b82f6', '#22c55e', '#f97316', '#8b5cf6', '#eab308', '#14b8a6'] as const;

export let db: DB = {
  projeto: { id: 'proj1', titulo: 'Coreografia' },
  formacoes: [] // <-- começa sem nenhuma formação
};

export let formacaoAtivaId: string | null = null; // <-- nada selecionado ao abrir

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
// src/state.ts (adicione algo assim)
export function replaceDbShallow(snapshot: any) {
  if (!snapshot) return;
  if (snapshot.projeto) db.projeto = snapshot.projeto;
  if (Array.isArray(snapshot.formacoes)) db.formacoes = snapshot.formacoes;
  document.dispatchEvent(new CustomEvent('db-changed', { detail: { reason: 'replace-db' }}));
}
export let currentProjectId: string | null = null;

export function setCurrentProjectId(id: string | null) {
  currentProjectId = id;
}

export function getCurrentProjectId() {
  return currentProjectId;
}
