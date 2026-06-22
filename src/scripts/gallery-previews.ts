export {};

const canvases = Array.from(document.querySelectorAll<HTMLCanvasElement>('[data-preview-canvas]'));

function drawPreview(canvas: HTMLCanvasElement, t: number): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const rect = canvas.getBoundingClientRect();
  const w = Math.max(1, Math.floor(rect.width * dpr));
  const h = Math.max(1, Math.floor(rect.height * dpr));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }

  const key = canvas.dataset.previewCanvas || '';
  ctx.clearRect(0, 0, w, h);
  ctx.lineWidth = Math.max(1, dpr);
  ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--fg').trim() || '#111';
  ctx.globalAlpha = 0.66;

  const seed = [...key].reduce((n, ch) => n + ch.charCodeAt(0), 0);
  const mode = seed % 5;
  const cx = w / 2;
  const cy = h / 2;
  const r = Math.min(w, h) * 0.34;

  if (mode === 0) {
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2 + t * 0.0005;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * r * 0.7, cy + Math.sin(a * 2) * r * 0.35, r * 0.08, 0, Math.PI * 2);
      ctx.stroke();
    }
  } else if (mode === 1) {
    for (let i = 0; i < 10; i++) {
      ctx.beginPath();
      ctx.moveTo((i / 9) * w, 0);
      ctx.lineTo(((i * 3 + t * 0.01) % 10 / 9) * w, h);
      ctx.stroke();
    }
  } else if (mode === 2) {
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 5) {
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a + t * 0.0004) * r, cy + Math.sin(a + t * 0.0004) * r);
      ctx.stroke();
    }
  } else if (mode === 3) {
    ctx.beginPath();
    for (let i = 0; i < 100; i++) {
      const a = i * 0.35 + t * 0.001;
      const rr = r * i / 100;
      const x = cx + Math.cos(a) * rr;
      const y = cy + Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  } else {
    for (let y = 0; y < h; y += h / 6) {
      ctx.beginPath();
      for (let x = 0; x <= w; x += 6 * dpr) {
        const yy = y + Math.sin(x * 0.025 + t * 0.002 + seed) * 6 * dpr;
        if (x === 0) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }
  }
}

function frame(t: number): void {
  for (const canvas of canvases) drawPreview(canvas, t);
  requestAnimationFrame(frame);
}

if (canvases.length) requestAnimationFrame(frame);
