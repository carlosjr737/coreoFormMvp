
import { audioCanvas, audioFileInput, audioInfoEl, audioTrackEl, btnCarregarAudio, timelineContainerEl } from './dom';
import { getTotalTimelinePx, getTimelineTotalSegundos, renderizarTudo } from './timeline';
import { globalMsAtual } from './state';

let audioContext: AudioContext | null = null;
export let audioBuffer: AudioBuffer | null = null;
let audioSourceNode: AudioBufferSourceNode | null = null;
let waveformData: number[] | null = null;

export function getAudioBuffer() { return audioBuffer; }
export function getAudioSource() { return audioSourceNode; }
export function setAudioSource(n: AudioBufferSourceNode | null) { audioSourceNode = n; }
export function getWaveformData() { return waveformData; }
export function setWaveformData(d: number[] | null){ waveformData = d; }
export function getAudioContext() { return audioContext; }
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
  const onMove = (ev: MouseEvent) => audioTrackEl.dispatchEvent(new CustomEvent('scrub-request', { detail: { clientX: ev.clientX } }));
  const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
  audioTrackEl.dispatchEvent(new CustomEvent('scrub-request', { detail: { clientX: e.clientX } }));
});
}

export function carregarArquivoDeAudio(file: File) {
  ensureAudioContext();
  if (!audioContext) return;
  audioInfoEl.innerHTML = `<span class="hint">Processando áudio...</span>`;

  const reader = new FileReader();
  reader.onload = (e) => {
    const arrayBuffer = e.target?.result as ArrayBuffer;
    audioContext!.decodeAudioData(arrayBuffer).then((decoded) => {
      audioBuffer = decoded;
      audioInfoEl.textContent = `Áudio: ${file.name.substring(0,25)}... (${audioBuffer.duration.toFixed(1)}s)`;

      processarAudioParaVisualizacao();
    }).catch((err) => {
      audioInfoEl.innerHTML = `<span class="hint">Erro ao carregar áudio</span>`;
      alert('Não foi possível processar este arquivo de áudio. ' + err?.message);
    });
  };
  reader.readAsArrayBuffer(file);
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
