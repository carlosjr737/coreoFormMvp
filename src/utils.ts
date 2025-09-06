
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function escolherStep(total: number, width: number) {
  const alvoTicks = Math.max(8, Math.min(12, Math.floor((width || 800) / 120)));
  const bruto = total / Math.max(1, alvoTicks);
  const steps = [0.1, 0.2, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600];
  for (const s of steps) if (s >= bruto) return s;
  return Math.ceil(bruto);
}

export function formatarTempo(seg: number) {
  if (seg >= 60) {
    const m = Math.floor(seg / 60);
    const s = Math.round(seg - m * 60);
    return `${m}:${String(s).padStart(2,'0')}`;
  }
  return seg < 10 ? seg.toFixed(1) + 's' : Math.round(seg) + 's';
}
