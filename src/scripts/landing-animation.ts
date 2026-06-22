export {};

const canvas = document.querySelector<HTMLCanvasElement>('[data-landing-animation]');
const ctx = canvas?.getContext('2d');

function frame(t: number): void {
  if (!canvas || !ctx) return;
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.max(1, Math.floor(rect.width * dpr));
  canvas.height = Math.max(1, Math.floor(rect.height * dpr));
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--fg').trim() || '#111';
  ctx.globalAlpha = 0.32;
  for (let i = 0; i < 36; i++) {
    const a = i * 2.399 + t * 0.00012;
    const r = Math.sqrt(i / 36) * Math.min(w, h) * 0.45;
    const x = w * 0.5 + Math.cos(a) * r;
    const y = h * 0.5 + Math.sin(a) * r;
    ctx.strokeRect(x - 10 * dpr, y - 10 * dpr, 20 * dpr, 20 * dpr);
    ctx.beginPath();
    ctx.arc(x, y, (3 + (i % 7)) * dpr, 0, Math.PI * 2);
    ctx.stroke();
  }
  for (let i = 0; i < 8; i++) {
    const x = (i / 7) * w;
    ctx.beginPath();
    ctx.moveTo(w * 0.5, h * 0.5);
    ctx.lineTo(x, (Math.sin(t * 0.001 + i) * 0.3 + 0.5) * h);
    ctx.stroke();
  }
  requestAnimationFrame(frame);
}

if (canvas && ctx) requestAnimationFrame(frame);
