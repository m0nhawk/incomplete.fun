export {};

const canvas = document.querySelector<HTMLCanvasElement>("#osc-canvas");
const couplingInput = document.querySelector<HTMLInputElement>("#osc-coupling");
const spreadInput = document.querySelector<HTMLInputElement>("#osc-spread");
const resetButton = document.querySelector<HTMLButtonElement>("#osc-reset");
const readout = document.querySelector<HTMLElement>("#osc-readout");
const TAU = Math.PI * 2;
const N = 32;

if (canvas && couplingInput && spreadInput && resetButton && readout) {
  const ctx = canvas.getContext("2d");
  if (ctx) init(ctx);
}

function init(ctx: CanvasRenderingContext2D) {
  const phases = new Float32Array(N);
  const freqs = new Float32Array(N);
  let seed = 7;
  const reset = () => {
    const spread = Number(spreadInput!.value) / 100;
    for (let i = 0; i < N; i++) {
      phases[i] = random(seed + i * 11) * TAU;
      freqs[i] = 0.012 + (random(seed + i * 31) - .5) * .035 * spread;
    }
    seed += 101;
  };
  const resize = () => {
    const rect = canvas!.getBoundingClientRect();
    const scale = window.devicePixelRatio || 1;
    canvas!.width = Math.max(320, Math.floor(rect.width * scale));
    canvas!.height = Math.max(240, Math.floor(rect.height * scale));
  };
  resetButton!.addEventListener("click", reset);
  spreadInput!.addEventListener("input", reset);
  new ResizeObserver(resize).observe(canvas!.parentElement ?? canvas!);
  reset(); resize();
  const tick = () => { step(phases, freqs); draw(ctx, phases, freqs); requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
}

function step(phases: Float32Array, freqs: Float32Array) {
  const k = Number(couplingInput!.value) / 3500;
  const next = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    let pull = 0;
    for (let j = 0; j < N; j++) if (i !== j) pull += Math.sin(phases[j] - phases[i]);
    next[i] = (phases[i] + freqs[i] + k * pull / N + TAU) % TAU;
  }
  phases.set(next);
}

function draw(ctx: CanvasRenderingContext2D, phases: Float32Array, freqs: Float32Array) {
  const w = canvas!.width, h = canvas!.height;
  ctx.fillStyle = "rgba(6,7,19,.26)"; ctx.fillRect(0, 0, w, h);
  let cx = 0, cy = 0;
  for (const p of phases) { cx += Math.cos(p); cy += Math.sin(p); }
  const order = Math.hypot(cx, cy) / N;
  const radius = Math.min(w, h) * .34;
  const ox = w * .34, oy = h * .5;
  ctx.strokeStyle = "rgba(255,255,255,.16)"; ctx.beginPath(); ctx.arc(ox, oy, radius, 0, TAU); ctx.stroke();
  for (let i = 0; i < N; i++) {
    const x = ox + Math.cos(phases[i]) * radius;
    const y = oy + Math.sin(phases[i]) * radius;
    ctx.strokeStyle = `hsla(${190 + freqs[i] * 3000},80%,65%,.35)`;
    ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(x, y); ctx.stroke();
    ctx.fillStyle = `hsl(${190 + phases[i] * 57},85%,62%)`; ctx.beginPath(); ctx.arc(x, y, 4, 0, TAU); ctx.fill();
  }
  const bx = w * .68, base = h * .75;
  for (let i = 0; i < N; i++) {
    const bar = (Math.sin(phases[i]) * .5 + .5) * h * .35;
    ctx.fillStyle = `hsla(${i * 360 / N},80%,60%,.7)`;
    ctx.fillRect(bx + i * w * .22 / N, base - bar, Math.max(2, w * .18 / N), bar);
  }
  ctx.fillStyle = "rgba(255,255,255,.85)";
  ctx.fillRect(w * .66, h * (.5 - order * .35), w * .24 * order, 5);
  readout!.textContent = `order r = ${order.toFixed(2)} · ${order > .72 ? "synchronized" : "drifting phases"}`;
}

function random(n: number) { return ((Math.sin(n * 12.9898) * 43758.5453) % 1 + 1) % 1; }
