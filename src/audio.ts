
import { audioCanvas, audioFileInput, audioStatusEl, audioTrackEl, btnCarregarAudio, timelineContainerEl } from './dom';
import { getTotalTimelinePx, getTimelineTotalSegundos, renderizarTudo } from './timeline';
import { globalMsAtual } from './state';


let audioContext: AudioContext | null = null;
let masterGain: GainNode | null = null;
let recDest: MediaStreamAudioDestinationNode | null = null;
export let audioBuffer: AudioBuffer | null = null;
let audioSourceNode: AudioBufferSourceNode | null = null;
let waveformData: number[] | null = null;
let audioFileBlob: Blob | null = null;
let audioFileName: string | null = null;
let audioFileContentType: string | null = null;




export function getAudioBuffer() { return audioBuffer; }
export function getAudioSource() { return audioSourceNode; }
export function setAudioSource(n: AudioBufferSourceNode | null) { audioSourceNode = n; }
export function getWaveformData() { return waveformData; }
export function setWaveformData(d: number[] | null){ waveformData = d; }
export function getAudioFileBlob(): Blob | null { return audioFileBlob; }
export function getAudioFileName(): string | null { return audioFileName; }
export function getAudioFileContentType(): string | null { return audioFileContentType; }
export function setAudioStatusMessage(msg: string) {
  if (audioStatusEl) audioStatusEl.textContent = msg;
}

export function refreshAudioStatusLabel() {
  updateAudioStatus(audioBuffer?.duration);
}

function updateAudioStatus(durationSec?: number) {
  if (!audioStatusEl) return;
  if (audioBuffer && audioFileName) {
    const trimmedName = audioFileName.length > 32 ? `${audioFileName.slice(0, 29)}…` : audioFileName;
    const durationText = durationSec !== undefined ? ` (${durationSec.toFixed(1)}s)` : '';
    audioStatusEl.textContent = `Áudio: ${trimmedName}${durationText}`;
  } else {
    audioStatusEl.textContent = 'Sem áudio';
  }
}
export function getAudioContext(): AudioContext {
  if (!audioContext) audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  return audioContext;
}
export function getMasterGain(): GainNode {
  const ctx = ensureAudioContext();
  if (!masterGain) {
    masterGain = ctx.createGain();
    masterGain.connect(ctx.destination); // alto-falantes
  }
  return masterGain;
}

/** Conecta o source atual no grafo (alto-falantes + gravação). */
export function wireSourceToGraph(src: AudioBufferSourceNode) {
  const mg = getMasterGain();
  try { src.disconnect(); } catch {}
  src.connect(mg); // masterGain alimenta saída normal e (quando existir) o recDest
}

/** Prepara o destino de gravação e garante AudioContext ativo. */
export async function prepareRecordingAudio(): Promise<void> {
  const ctx = ensureAudioContext();
  try { await (ctx as any).resume?.(); } catch {}
  if (!recDest) {
    recDest = ctx.createMediaStreamDestination();
    getMasterGain().connect(recDest); // espelha tudo que passa no master
  }
}
/** Stream para o MediaRecorder. */
export function getRecordingAudioStream(): MediaStream | null {
  return recDest?.stream ?? null;
}

export function ensureAudioContext() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioContext;
}

export function initAudioUI() {
  btnCarregarAudio.addEventListener('click', () => audioFileInput.click());
  audioFileInput.addEventListener('change', (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) carregarArquivoDeAudio(file);
  });
  audioTrackEl.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement)?.closest('#btn-carregar-audio')) return;
    const onMove = (ev: MouseEvent) =>
      audioTrackEl.dispatchEvent(new CustomEvent('scrub-request', { detail: { clientX: ev.clientX } }));
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    audioTrackEl.dispatchEvent(new CustomEvent('scrub-request', { detail: { clientX: e.clientX } }));
  });

  updateAudioStatus();
}

async function decodeAndApplyAudio(arrayBuffer: ArrayBuffer, fileName?: string): Promise<void> {
  ensureAudioContext();
  if (!audioContext) return;
  const decoded = await audioContext.decodeAudioData(arrayBuffer.slice(0));
  audioBuffer = decoded;
  if (fileName) audioFileName = fileName;
  updateAudioStatus(audioBuffer.duration);
  processarAudioParaVisualizacao();
}

export async function carregarArquivoDeAudio(file: File) {
  ensureAudioContext();
  if (!audioContext) return;
  setAudioStatusMessage('Processando áudio...');

  try {
    audioFileBlob = file;
    audioFileName = file.name;
    audioFileContentType = file.type || null;
    const arrayBuffer = await file.arrayBuffer();
    await decodeAndApplyAudio(arrayBuffer, file.name);
  } catch (err: any) {
    clearAudio();
    setAudioStatusMessage('Erro ao carregar áudio');
    alert('Não foi possível processar este arquivo de áudio. ' + (err?.message || ''));
  }
}

export async function setAudioFromBlob(blob: Blob, options: { fileName?: string; contentType?: string } = {}): Promise<void> {
  ensureAudioContext();
  if (!audioContext) return;
  audioFileBlob = blob;
  audioFileName = options.fileName || audioFileName || 'Áudio';
  audioFileContentType = options.contentType || blob.type || audioFileContentType || null;
  setAudioStatusMessage('Processando áudio...');
  try {
    const arrayBuffer = await blob.arrayBuffer();
    await decodeAndApplyAudio(arrayBuffer, audioFileName || undefined);
  } catch (err) {
    console.error('Falha ao decodificar áudio', err);
    clearAudio();
    throw err;
  }
}

export function clearAudio() {
  if (audioSourceNode) {
    try { audioSourceNode.stop(); } catch {}
    audioSourceNode = null;
  }
  audioBuffer = null;
  waveformData = null;
  audioFileBlob = null;
  audioFileName = null;
  audioFileContentType = null;
  updateAudioStatus();
  const ctx = audioCanvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, audioCanvas.width, audioCanvas.height);
  }
  renderizarTudo(true);
  requestAnimationFrame(renderizarFaixaAudio);
}
// src/audio.ts  (ADICIONE ao final do arquivo ou numa seção adequada)
let _recDest: MediaStreamAudioDestinationNode | null = null;

// src/audio.ts
export async function ensureRecordingAudioReady(): Promise<void> {
  const ctx = getAudioContext?.();
  if (!ctx) return;
  // Alguns browsers exigem linha abaixo dentro de gesto do usuário
  await ctx.resume().catch(() => {});
  // Conecte seu masterGain aqui se existir:
  // masterGain.connect(_recDest)
  const node = getAudioSource?.();
  if (_recDest && node && !(node as any)._connectedToRecDest) {
    node.connect(_recDest);
    (node as any)._connectedToRecDest = true;
  }
}



export function processarAudioParaVisualizacao() {
  if (!audioBuffer) return;
  const raw = audioBuffer.getChannelData(0);
  const samples = 256;
  const blockSize = Math.floor(raw.length / samples);
  const filtered: number[] = [];
  for (let i = 0; i < samples; i++) {
    const start = blockSize * i;
    let sum = 0;
    for (let j = 0; j < blockSize; j++) sum += Math.abs(raw[start + j]);
    filtered.push(sum / blockSize);
  }
  const maxVal = Math.max(...filtered);
  const mult = 1 / (maxVal > 0 ? maxVal : 1);
  waveformData = filtered.map(n => n * mult);

  renderizarTudo(true);
  requestAnimationFrame(renderizarFaixaAudio);
}

export function renderizarFaixaAudio() {
  const ctx = audioCanvas.getContext('2d')!;
  const dpr = window.devicePixelRatio || 1;
  const wCss = Math.max(1, audioTrackEl.clientWidth);
  const hCss = Math.max(1, audioTrackEl.clientHeight);
  audioCanvas.width = Math.floor(wCss * dpr);
  audioCanvas.height = Math.floor(hCss * dpr);
  const w = audioCanvas.width, h = audioCanvas.height;

  ctx.clearRect(0,0,w,h);
  ctx.fillStyle = '#0d1730';
  ctx.fillRect(0,0,w,h);

  if (!waveformData || waveformData.length === 0) {
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.beginPath();
    ctx.moveTo(0, h/2);
    ctx.lineTo(w, h/2);
    ctx.stroke();
    return;
  }

  const totalPx = getTotalTimelinePx();
  const viewStartPx = timelineContainerEl.scrollLeft;
  const viewEndPx = viewStartPx + timelineContainerEl.clientWidth;
  const startP = totalPx > 0 ? viewStartPx / totalPx : 0;
  const endP   = totalPx > 0 ? viewEndPx   / totalPx : 1;

  const startIndex = Math.floor(startP * waveformData.length);
  const endIndex = Math.min(waveformData.length, Math.ceil(endP * waveformData.length));
  const slice = waveformData.slice(startIndex, endIndex);

  const waveColor = getComputedStyle(document.documentElement).getPropertyValue('--cor-onda-audio').trim() || '#5eead4';
  ctx.fillStyle = waveColor;

  const barWidth = w / Math.max(1, slice.length);
  for (let i=0;i<slice.length;i++) {
    const value = slice[i];
    const barH = value * h;
    const y = (h - barH)/2;
    const x = Math.floor(i * barWidth);
    const bw = Math.max(1, Math.floor(barWidth));
    ctx.fillRect(x, y, bw, barH);
  }
  
}
