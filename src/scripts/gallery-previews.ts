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

  const seed = [...key].reduce((n, ch, index) => n + ch.charCodeAt(0) * (index + 1), 0);
  const cx = w / 2;
  const cy = h / 2;
  const r = Math.min(w, h) * 0.34;
  const phase = t * 0.001 + seed;

  if (key.includes('braid')) {
    for (let strand = 0; strand < 5; strand++) {
      ctx.beginPath();
      for (let y = 0; y <= h; y += 7 * dpr) {
        const x = ((strand + 0.5) / 5) * w + Math.sin(y * 0.045 + phase + strand) * 13 * dpr;
        if (y === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  } else if (key.includes('cellular')) {
    const size = Math.max(3, Math.floor(5 * dpr));
    for (let y = 0; y < h; y += size) for (let x = 0; x < w; x += size) {
      if (((x / size) ^ (y / size) ^ Math.floor(t * 0.004)) % 5 === 0) ctx.fillRect(x, y, size * 0.75, size * 0.75);
    }
  } else if (key.includes('complex')) {
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.arc(cx + Math.cos(phase + i) * r * 0.25, cy + Math.sin(phase * 0.7 + i) * r * 0.2, r * (0.35 + i * 0.13), 0, Math.PI * 2);
      ctx.stroke();
    }
  } else if (key.includes('continued')) {
    for (let i = 0; i < 7; i++) {
      ctx.strokeRect(10 * dpr + i * 11 * dpr, 8 * dpr + i * 5 * dpr, w - 20 * dpr - i * 18 * dpr, h - 16 * dpr - i * 8 * dpr);
    }
  } else if (key.includes('chu')) {
    const cols = 6; const rows = 4;
    for (let x = 1; x < cols; x++) { ctx.beginPath(); ctx.moveTo((x / cols) * w, 0); ctx.lineTo((x / cols) * w, h); ctx.stroke(); }
    for (let y = 1; y < rows; y++) { ctx.beginPath(); ctx.moveTo(0, (y / rows) * h); ctx.lineTo(w, (y / rows) * h); ctx.stroke(); }
  } else if (key.includes('dual')) {
    ctx.beginPath();
    ctx.arc(cx - r * 0.35, cy, r * 0.45, 0, Math.PI * 2);
    ctx.moveTo(cx - r * 0.1, cy + r * 0.25);
    ctx.lineTo(cx + r * 0.7, cy - r * 0.35);
    ctx.stroke();
  } else if (key.includes('fib')) {
    let a = 3 * dpr;
    let b = 5 * dpr;
    let x = w * 0.18;
    let y = h * 0.7;
    for (let i = 0; i < 7; i++) {
      ctx.strokeRect(x, y - b, b, b);
      [a, b] = [b, a + b];
      x += a * 0.22;
      y -= (i % 2) * a * 0.18;
    }
  } else if (key.includes('fourier')) {
    ctx.beginPath();
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2 + t * 0.0005;
      ctx.arc(cx + Math.cos(a) * r * 0.7, cy + Math.sin(a * 2) * r * 0.35, r * 0.08, 0, Math.PI * 2);
    }
    ctx.stroke();
  } else if (key.includes('groups')) {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 3 * dpr, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); ctx.stroke();
    }
  } else if (key.includes('hyperbolic')) {
    for (let i = 1; i <= 4; i++) { ctx.beginPath(); ctx.arc(cx, cy, (r * i) / 4, 0, Math.PI * 2); ctx.stroke(); }
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); ctx.stroke(); }
  } else if (key.includes('knot')) {
    ctx.beginPath();
    for (let i = 0; i <= 180; i++) {
      const a = (i / 180) * Math.PI * 2;
      const x = cx + Math.sin(2 * a) * r;
      const y = cy + Math.sin(3 * a) * r * 0.65;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  } else if (key.includes('lsystem')) {
    branch(ctx, cx, h * 0.88, -Math.PI / 2, r * 0.62, 5);
  } else if (key.includes('modular')) {
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
    for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; const b = ((i * 5) % 16) / 16 * Math.PI * 2; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); ctx.lineTo(cx + Math.cos(b) * r, cy + Math.sin(b) * r); ctx.stroke(); }
  } else if (key.includes('morse')) {
    for (let y = 0; y < h; y += h / 7) {
      ctx.beginPath();
      for (let x = 0; x <= w; x += 6 * dpr) {
        const yy = y + Math.sin(x * 0.025 + phase) * 6 * dpr;
        if (x === 0) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }
  } else if (key.includes('padic')) {
    for (let i = 0; i < 18; i++) ctx.strokeText(String((i * 3 + seed) % 7), 10 * dpr + (i % 9) * 15 * dpr, 18 * dpr + Math.floor(i / 9) * 22 * dpr);
  } else if (key.includes('penrose')) {
    for (let i = 0; i < 10; i++) {
      ctx.beginPath();
      ctx.moveTo((i / 9) * w, 0);
      ctx.lineTo(((i * 3 + t * 0.01) % 10 / 9) * w, h);
      ctx.stroke();
    }
  } else if (key.includes('primes')) {
    for (let i = 0; i < 55; i++) {
      if (!isPrime(i + 2)) continue;
      const a = i * 0.55;
      const rr = 2 * dpr + i * 0.55 * dpr;
      ctx.fillRect(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, 2 * dpr, 2 * dpr);
    }
  } else if (key.includes('reaction')) {
    for (let i = 0; i < 22; i++) { ctx.beginPath(); ctx.arc((0.1 + ((i * 37) % 80) / 100) * w, (0.15 + ((i * 29) % 70) / 100) * h, (3 + (i % 5)) * dpr, 0, Math.PI * 2); ctx.stroke(); }
  } else if (key.includes('spectral')) {
    const nodes = Array.from({ length: 7 }, (_v, i) => ({ x: cx + Math.cos(i * 2.4) * r * 0.9, y: cy + Math.sin(i * 2.4) * r * 0.62 }));
    for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) if ((i + j) % 3 === 0) { ctx.beginPath(); ctx.moveTo(nodes[i].x, nodes[i].y); ctx.lineTo(nodes[j].x, nodes[j].y); ctx.stroke(); }
    for (const node of nodes) { ctx.beginPath(); ctx.arc(node.x, node.y, 3 * dpr, 0, Math.PI * 2); ctx.stroke(); }
  } else if (key.includes('surreal')) {
    for (let level = 0; level < 4; level++) for (let i = 0; i <= level; i++) { ctx.beginPath(); ctx.arc(cx + (i - level / 2) * 28 * dpr, 11 * dpr + level * 13 * dpr, 3 * dpr, 0, Math.PI * 2); ctx.stroke(); }
  } else if (key.includes('symmetry')) {
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 5) {
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a + t * 0.0004) * r, cy + Math.sin(a + t * 0.0004) * r);
      ctx.stroke();
    }
  } else if (key.includes('tropical')) {
    for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(0, h * (0.2 + i * 0.13)); ctx.lineTo(w * (0.35 + i * 0.08), h); ctx.lineTo(w, h * (0.1 + i * 0.12)); ctx.stroke(); }
  } else if (key.includes('voronoi')) {
    const pts = [[0.2, 0.3], [0.45, 0.18], [0.78, 0.32], [0.33, 0.72], [0.68, 0.68]];
    for (const [px, py] of pts) { ctx.beginPath(); ctx.arc(px * w, py * h, 3 * dpr, 0, Math.PI * 2); ctx.stroke(); }
    for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) { ctx.beginPath(); ctx.moveTo(pts[i][0] * w, pts[i][1] * h); ctx.lineTo(pts[j][0] * w, pts[j][1] * h); ctx.stroke(); }
  } else {
    ctx.beginPath();
    for (let i = 0; i < 100; i++) {
      const a = i * 0.35 + t * 0.001;
      const rr = r * i / 100;
      const x = cx + Math.cos(a) * rr;
      const y = cy + Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}

function branch(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, length: number, depth: number): void {
  if (depth === 0) return;
  const nx = x + Math.cos(angle) * length;
  const ny = y + Math.sin(angle) * length;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(nx, ny); ctx.stroke();
  branch(ctx, nx, ny, angle - 0.55, length * 0.66, depth - 1);
  branch(ctx, nx, ny, angle + 0.45, length * 0.62, depth - 1);
}

function isPrime(value: number): boolean {
  for (let divisor = 2; divisor * divisor <= value; divisor++) if (value % divisor === 0) return false;
  return value > 1;
}

function frame(t: number): void {
  for (const canvas of canvases) drawPreview(canvas, t);
  requestAnimationFrame(frame);
}

if (canvases.length) requestAnimationFrame(frame);
