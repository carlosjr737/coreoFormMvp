import { getRecordingAudioStream, prepareRecordingAudio } from './audio';
import { palcoEl } from './dom';

/** ====== ESTADO GLOBAL ====== */
let rec: MediaRecorder | null = null;

// Congela/descongela o tamanho do palco
let _palcoPrev = { w: '', h: '' };

function freezePalcoSize() {
  const el = palcoEl as HTMLElement;
  const r = el.getBoundingClientRect();
  _palcoPrev.w = el.style.width;
  _palcoPrev.h = el.style.height;
  el.style.width  = `${Math.round(r.width)}px`;
  el.style.height = `${Math.round(r.height)}px`;
}

function unfreezePalcoSize() {
  const el = palcoEl as HTMLElement;
  el.style.width  = _palcoPrev.w;
  el.style.height = _palcoPrev.h;
  // pede pro layout recalcular depois de sair da gravação
  setTimeout(() => window.dispatchEvent(new Event('resize')), 0);
}



let chunks: BlobPart[] = [];
let reqInt: number | null = null;
let rafId: number | null = null;
let composedStream: MediaStream | null = null;

const STAGE_GAP = 40;   // espaçamento da grade (mesmo do CSS)
const STAGE_INSET = 12; // moldura interna (mesmo do CSS)

let cvs: HTMLCanvasElement | null = null;
let ctx2d: CanvasRenderingContext2D | null = null;

/** ====== CANVAS ====== */
function ensureCanvas(): HTMLCanvasElement {
  if (cvs) return cvs;
  cvs = document.createElement('canvas');
  cvs.id = 'present-canvas';
  // fica “por cima” do palco (deixe invisível via CSS: #present-canvas{opacity:0})
  cvs.style.position = 'absolute';
  cvs.style.inset = '0';
  cvs.style.zIndex = '9999';
  cvs.style.background = 'transparent';
  cvs.style.pointerEvents = 'none';
  document.body.appendChild(cvs);
  ctx2d = cvs.getContext('2d');
  return cvs;
}

function layoutCanvasOverPalco() {
  if (!cvs || !palcoEl) return;
  const r = palcoEl.getBoundingClientRect();
  const dpr = Math.max(1, window.devicePixelRatio || 1);

  // posiciona sobre o palco
  cvs.style.left = `${r.left + window.scrollX}px`;
  cvs.style.top  = `${r.top  + window.scrollY}px`;
  cvs.style.width  = `${r.width}px`;
  cvs.style.height = `${r.height}px`;

  // buffer físico = CSS * dpr (garante nitidez e proporção 1:1 na captura)
  const w = Math.max(1, Math.round(r.width  * dpr));
  const h = Math.max(1, Math.round(r.height * dpr));
  if (cvs.width !== w || cvs.height !== h) {
    cvs.width  = w;
    cvs.height = h;
  }

  // desenhar em “px de tela”
  ctx2d!.setTransform(dpr, 0, 0, dpr, 0, 0);
}

/** ====== GRADE / FUNDO ====== */
function drawGrid() {
  if (!cvs || !ctx2d) return;
  const ctx = ctx2d;
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const W = cvs.width / dpr;
  const H = cvs.height / dpr;

  // fundo
  ctx.fillStyle = '#0b1220';
  ctx.fillRect(0, 0, W, H);

  // grade geral
  ctx.strokeStyle = 'rgba(255,255,255,.06)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= W; x += STAGE_GAP) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }
  for (let y = 0; y <= H; y += STAGE_GAP) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }

  // moldura interna (igual ao CSS, inset 12)
  const x = STAGE_INSET, y = STAGE_INSET, w = W - 2 * STAGE_INSET, h = H - 2 * STAGE_INSET;
  ctx.strokeStyle = '#cc4a7a';
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);
}

/** ====== DESENHO DO FRAME ====== */
function drawFrame() {
  if (!cvs || !ctx2d || !palcoEl) { rafId = requestAnimationFrame(drawFrame); return; }
  const ctx = ctx2d;

  // limpa e redesenha grade
  drawGrid();

  // referência do palco para converter posições DOM → canvas
  const palcoRect = palcoEl.getBoundingClientRect();

  // pegue todos os marcadores (ajuste o seletor se o seu for diferente)
  const markers = Array.from(document.querySelectorAll<HTMLElement>('.marcador'));

  for (const el of markers) {
    const r = el.getBoundingClientRect();

    // centro do marcador relativo ao palco
    const cx = (r.left + r.width / 2) - palcoRect.left;
    const cy = (r.top  + r.height / 2) - palcoRect.top;
    const radius = Math.max(8, Math.floor(r.width / 2));

    // cor do marcador (usa a mesma do DOM, com fallback)
    const bg = getComputedStyle(el).backgroundColor || 'rgb(239, 68, 68)';

    // círculo
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = bg;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(0,0,0,.25)';
    ctx.stroke();

    // rótulo DENTRO do círculo
    const label = el.dataset.label || el.getAttribute('title') || (el.textContent || '').trim();
    if (label) {
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const fontPx = Math.max(10, Math.floor(radius * 0.9));
      ctx.font = `${fontPx}px system-ui, -apple-system, Segoe UI, Roboto, sans-serif`;
      ctx.strokeStyle = 'rgba(0,0,0,.45)';
      ctx.lineWidth = Math.max(1, Math.floor(fontPx / 8));
      ctx.strokeText(label, cx, cy);
      ctx.fillStyle = '#fff';
      ctx.fillText(label, cx, cy);
      ctx.restore();
    }
  }

  rafId = requestAnimationFrame(drawFrame);
}

/** ====== LOOP DE ESPELHO ====== */
function startMirror() {
  ensureCanvas();
  layoutCanvasOverPalco();
  window.addEventListener('resize', layoutCanvasOverPalco);
  window.addEventListener('scroll',  layoutCanvasOverPalco, { passive: true });
  if (rafId) cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(drawFrame);
}

function stopMirror() {
  if (rafId) cancelAnimationFrame(rafId);
  rafId = null;
  window.removeEventListener('resize', layoutCanvasOverPalco);
  window.removeEventListener('scroll',  layoutCanvasOverPalco);
  if (cvs) { cvs.remove(); cvs = null; ctx2d = null; }
}

/** ====== GRAVAÇÃO ====== */
export async function startPresentationRecording() {
  if (rec && rec.state !== 'inactive') return; // já está gravando

  freezePalcoSize();
  document.body.classList.add('presentation');

  ensureCanvas();
  layoutCanvasOverPalco();
  startMirror();

  // garante que já houve pelo menos 1 frame desenhado (evita arquivo vazio)
  await new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res)));

  await prepareRecordingAudio();
  const aStream = getRecordingAudioStream(); // pode ser null/undefined

  const vStream = cvs!.captureStream(60); // vídeo do canvas
  const tracks = [
    ...vStream.getVideoTracks(),
    ...(aStream ? aStream.getAudioTracks() : []),
  ];
  if (!tracks.length) throw new Error('Sem trilhas para gravar');

  composedStream = new MediaStream(tracks);

  const candidates = [
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=vp9,opus',
    'video/webm'
  ];
  const mime = candidates.find(m => (window as any).MediaRecorder?.isTypeSupported?.(m)) || undefined;

  chunks = [];
  rec = new MediaRecorder(composedStream, mime ? { mimeType: mime } : undefined);
  rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
  rec.onerror = (e) => console.error('MediaRecorder error:', e);

  rec.onstop = () => {
    if (!chunks.length) { alert('Nenhum dado de gravação recebido.'); cleanupRecordingUI(); return; }
    const blob = new Blob(chunks, { type: mime || 'video/webm' });
    const url  = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `coreo-present-${new Date().toISOString().replace(/[:.]/g,'-')}.webm`;
    a.click();
    URL.revokeObjectURL(url);
    cleanupRecordingUI();
  };

  rec.start(500);
  reqInt = window.setInterval(() => { try { rec?.requestData(); } catch {} }, 1000);
  document.body.classList.add('recording');
}

export function stopPresentationRecording() {
  if (reqInt) { clearInterval(reqInt); reqInt = null; }
  try {
    if (rec && rec.state !== 'inactive') {
      try { rec.requestData(); } catch {}
      rec.stop();
      return;
    }
  } catch (e) {
    console.error('Erro ao parar recorder:', e);
  }
  // plano B
  fallbackFinalize();
}

function fallbackFinalize() {
  try { composedStream?.getTracks().forEach(t => t.stop()); } catch {}
  if (chunks.length) {
    const blob = new Blob(chunks, { type: 'video/webm' });
    const url  = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `coreo-present-${new Date().toISOString().replace(/[:.]/g,'-')}.webm`;
    a.click();
    URL.revokeObjectURL(url);
  }
  cleanupRecordingUI();
}

function cleanupRecordingUI() {
  document.body.classList.remove('presentation','recording');
  unfreezePalcoSize();   
  stopMirror();
  rec = null;
  composedStream = null;
  chunks = [];
}
