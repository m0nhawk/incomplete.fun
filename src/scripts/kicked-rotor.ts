export {};

const canvas = document.querySelector<HTMLCanvasElement>("#rotor-canvas");
const kickInput = document.querySelector<HTMLInputElement>("#rotor-kick");
const orbitInput = document.querySelector<HTMLInputElement>("#rotor-orbits");
const randomButton = document.querySelector<HTMLButtonElement>("#rotor-random");
const readout = document.querySelector<HTMLElement>("#rotor-readout");
const TAU = Math.PI * 2;

if (canvas && kickInput && orbitInput && randomButton && readout) {
  const ctx = canvas.getContext("2d");
  if (ctx) init(ctx);
}

function init(ctx: CanvasRenderingContext2D) {
  let seed = 2;
  const resize = () => {
    const rect = canvas!.getBoundingClientRect();
    const scale = window.devicePixelRatio || 1;
    canvas!.width = Math.max(320, Math.floor(rect.width * scale));
    canvas!.height = Math.max(240, Math.floor(rect.height * scale));
    draw(ctx, seed);
  };
  randomButton!.addEventListener("click", () => { seed = (seed * 1664525 + 1013904223) >>> 0; draw(ctx, seed); });
  kickInput!.addEventListener("input", () => draw(ctx, seed));
  orbitInput!.addEventListener("input", () => draw(ctx, seed));
  new ResizeObserver(resize).observe(canvas!.parentElement ?? canvas!);
  resize();
}

function draw(ctx: CanvasRenderingContext2D, seed: number) {
  const w = canvas!.width;
  const h = canvas!.height;
  const k = Number(kickInput!.value) / 100;
  const orbitCount = Number(orbitInput!.value);
  ctx.fillStyle = "rgba(5,6,10,.22)";
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = "lighter";
  for (let o = 0; o < orbitCount; o++) {
    const hue = (o * 360 / orbitCount + k * 23) % 360;
    let x = ((o + 0.5) / orbitCount) * TAU;
    let p = ((hash(seed + o * 97) / 0xffffffff) - 0.5) * .55;
    ctx.fillStyle = `hsla(${hue}, 88%, 62%, .32)`;
    for (let i = 0; i < 900; i++) {
      p = wrapSigned(p + k * Math.sin(x));
      x = wrap(x + p);
      if (i > 24) ctx.fillRect((x / TAU) * w, (0.5 - p / TAU) * h, 1.15, 1.15);
    }
  }
  ctx.globalCompositeOperation = "source-over";
  ctx.strokeStyle = "rgba(255,255,255,.12)";
  ctx.beginPath();
  for (let i = 1; i < 4; i++) {
    ctx.moveTo(0, h * i / 4); ctx.lineTo(w, h * i / 4);
    ctx.moveTo(w * i / 4, 0); ctx.lineTo(w * i / 4, h);
  }
  ctx.stroke();
  readout!.textContent = `K = ${k.toFixed(2)} · ${k < .9 ? "invariant curves" : k < 2.4 ? "resonance islands" : "chaotic sea"}`;
}

function wrap(value: number) { return ((value % TAU) + TAU) % TAU; }
function wrapSigned(value: number) { return wrap(value + Math.PI) - Math.PI; }
function hash(x: number) { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return x >>> 0; }
