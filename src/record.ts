// src/record.ts
let mr: MediaRecorder | null = null;
let chunks: BlobPart[] = [];
let stream: MediaStream | null = null;

function pickMime(): string | undefined {
  const candidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm'
  ];
  for (const c of candidates) {
    if ((window as any).MediaRecorder?.isTypeSupported?.(c)) return c;
  }
  return undefined;
}

export async function startRecording() {
  // Dica: escolha a ABA do navegador e marque "compartilhar áudio da guia"
  stream = await (navigator.mediaDevices as any).getDisplayMedia({
    video: { frameRate: 60 }, // 60fps quando possível
    audio: true               // habilita áudio da aba (se selecionado pelo usuário)
  });

  const mimeType = pickMime();
  mr = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  chunks = [];

  mr.ondataavailable = (e) => { if (e.data?.size) chunks.push(e.data); };
  mr.onstop = () => {
    try { stream?.getTracks().forEach(t => t.stop()); } catch {}
    const blob = new Blob(chunks, { type: mimeType || 'video/webm' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `coreo-recording-${new Date().toISOString().replace(/[:.]/g,'-')}.webm`;
    a.click();
    URL.revokeObjectURL(url);
  };

  mr.start(250); // timeslice p/ receber chunks e evitar perda
  document.body.classList.add('recording');
}

export function stopRecording() {
  try { mr?.stop(); } catch {}
  mr = null;
  document.body.classList.remove('recording');
}
