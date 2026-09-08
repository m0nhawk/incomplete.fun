export {};

const canvas = document.querySelector<HTMLCanvasElement>("#mag-canvas");
const dampingInput = document.querySelector<HTMLInputElement>("#mag-damping");
const gridInput = document.querySelector<HTMLInputElement>("#mag-grid");
const renderButton = document.querySelector<HTMLButtonElement>("#mag-render");
const readout = document.querySelector<HTMLElement>("#mag-readout");
const magnets = [{ x: 0, y: -.52, h: 200 }, { x: -.48, y: .3, h: 340 }, { x: .48, y: .3, h: 36 }];

if (canvas && dampingInput && gridInput && renderButton && readout) {
  const ctx = canvas.getContext("2d");
  if (ctx) init(ctx);
}

function init(ctx: CanvasRenderingContext2D) {
  const resize = () => {
    const rect = canvas!.getBoundingClientRect();
    const scale = window.devicePixelRatio || 1;
    canvas!.width = Math.max(320, Math.floor(rect.width * scale));
    canvas!.height = Math.max(240, Math.floor(rect.height * scale));
    render(ctx);
  };
  renderButton!.addEventListener("click", () => render(ctx));
  dampingInput!.addEventListener("input", () => render(ctx));
  gridInput!.addEventListener("input", () => render(ctx));
  canvas!.addEventListener("pointerdown", (event) => trace(ctx, event));
  new ResizeObserver(resize).observe(canvas!.parentElement ?? canvas!); resize();
}

function render(ctx: CanvasRenderingContext2D) {
  const w = canvas!.width, h = canvas!.height, n = Number(gridInput!.value);
  const cell = Math.max(2, Math.floor(Math.min(w, h) / n));
  ctx.fillStyle = "#05050b"; ctx.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += cell) for (let x = 0; x < w; x += cell) {
    const result = simulate((x / w - .5) * 2.6, (y / h - .5) * 2);
    ctx.fillStyle = `hsl(${magnets[result.which].h},82%,${34 + Math.max(0, 30 - result.steps / 4)}%)`;
    ctx.fillRect(x, y, cell + 1, cell + 1);
  }
  drawMagnets(ctx);
  readout!.textContent = `${n}×${n} basin samples · click to trace orbit`;
}

function simulate(x: number, y: number) {
  let vx = 0, vy = 0, which = 0;
  const damping = Number(dampingInput!.value) / 200;
  for (let step = 0; step < 520; step++) {
    let ax = -0.05 * x, ay = -0.05 * y;
    for (let i = 0; i < magnets.length; i++) {
      const m = magnets[i], dx = m.x - x, dy = m.y - y, r2 = dx * dx + dy * dy + .035;
      const f = .0035 / Math.pow(r2, 1.5);
      ax += dx * f; ay += dy * f;
      if (r2 < .018 && Math.hypot(vx, vy) < .018) return { which: i, steps: step };
      if (r2 < ((magnets[which].x - x) ** 2 + (magnets[which].y - y) ** 2 + .035)) which = i;
    }
    vx = (vx + ax) * (1 - damping); vy = (vy + ay) * (1 - damping);
    x += vx; y += vy;
  }
  return { which, steps: 520 };
}

function trace(ctx: CanvasRenderingContext2D, event: PointerEvent) {
  const w = canvas!.width, h = canvas!.height, rect = canvas!.getBoundingClientRect();
  let x = ((event.clientX - rect.left) / rect.width - .5) * 2.6, y = ((event.clientY - rect.top) / rect.height - .5) * 2;
  let vx = 0, vy = 0;
  ctx.strokeStyle = "rgba(255,255,255,.85)"; ctx.beginPath(); ctx.moveTo((x / 2.6 + .5) * w, (y / 2 + .5) * h);
  for (let step = 0; step < 360; step++) {
    let ax = -0.05 * x, ay = -0.05 * y;
    for (const m of magnets) { const dx = m.x - x, dy = m.y - y, r2 = dx * dx + dy * dy + .035, f = .0035 / Math.pow(r2, 1.5); ax += dx * f; ay += dy * f; }
    vx = (vx + ax) * .955; vy = (vy + ay) * .955; x += vx; y += vy;
    ctx.lineTo((x / 2.6 + .5) * w, (y / 2 + .5) * h);
  }
  ctx.stroke(); drawMagnets(ctx);
}

function drawMagnets(ctx: CanvasRenderingContext2D) {
  const w = canvas!.width, h = canvas!.height;
  for (const m of magnets) { ctx.fillStyle = `hsl(${m.h},90%,62%)`; ctx.beginPath(); ctx.arc((m.x / 2.6 + .5) * w, (m.y / 2 + .5) * h, 8, 0, Math.PI * 2); ctx.fill(); }
}
