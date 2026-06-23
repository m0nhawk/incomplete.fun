export {};

const canvas = document.querySelector<HTMLCanvasElement>("#heat-canvas");
const diffusionInput = document.querySelector<HTMLInputElement>("#heat-diffusion");
const brushInput = document.querySelector<HTMLInputElement>("#heat-brush");
const coolButton = document.querySelector<HTMLButtonElement>("#heat-cool");
const readout = document.querySelector<HTMLElement>("#heat-readout");
const W = 128, H = 96;

if (canvas && diffusionInput && brushInput && coolButton && readout) {
  const ctx = canvas.getContext("2d");
  if (ctx) init(ctx);
}

function init(ctx: CanvasRenderingContext2D) {
  let field = new Float32Array(W * H);
  let next = new Float32Array(W * H);
  let cooling = false;
  seed(field);
  const image = ctx.createImageData(W, H);
  const resize = () => {
    const rect = canvas!.getBoundingClientRect();
    const scale = window.devicePixelRatio || 1;
    canvas!.width = Math.max(320, Math.floor(rect.width * scale));
    canvas!.height = Math.max(240, Math.floor(rect.height * scale));
    ctx.imageSmoothingEnabled = false;
  };
  const paint = (event: PointerEvent) => {
    const rect = canvas!.getBoundingClientRect();
    const x = Math.floor((event.clientX - rect.left) / rect.width * W);
    const y = Math.floor((event.clientY - rect.top) / rect.height * H);
    const r = Number(brushInput!.value);
    for (let yy = -r; yy <= r; yy++) for (let xx = -r; xx <= r; xx++) if (xx * xx + yy * yy <= r * r) {
      const px = x + xx, py = y + yy;
      if (px >= 0 && px < W && py >= 0 && py < H) field[py * W + px] = 1;
    }
  };
  canvas!.addEventListener("pointerdown", (event) => { canvas!.setPointerCapture(event.pointerId); paint(event); });
  canvas!.addEventListener("pointermove", (event) => { if (event.buttons) paint(event); });
  coolButton!.addEventListener("click", () => { cooling = !cooling; coolButton!.textContent = cooling ? "insulated edge" : "cool boundary"; });
  new ResizeObserver(resize).observe(canvas!.parentElement ?? canvas!); resize();
  const tick = () => {
    diffuse(field, next, Number(diffusionInput!.value) / 220, cooling);
    [field, next] = [next, field];
    draw(ctx, image, field);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function diffuse(a: Float32Array, b: Float32Array, rate: number, cooling: boolean) {
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    const c = a[i];
    const n = y > 0 ? a[i - W] : cooling ? 0 : c;
    const s = y < H - 1 ? a[i + W] : cooling ? 0 : c;
    const e = x < W - 1 ? a[i + 1] : cooling ? 0 : c;
    const w = x > 0 ? a[i - 1] : cooling ? 0 : c;
    b[i] = Math.max(0, Math.min(1, c + rate * (n + s + e + w - 4 * c)));
  }
}

function draw(ctx: CanvasRenderingContext2D, image: ImageData, field: Float32Array) {
  let total = 0;
  for (let i = 0; i < field.length; i++) {
    const v = field[i]; total += v;
    const p = i * 4;
    image.data[p] = Math.min(255, v * 480);
    image.data[p + 1] = Math.max(0, Math.min(255, (v - .18) * 520));
    image.data[p + 2] = Math.max(0, Math.min(255, (1 - v) * 90));
    image.data[p + 3] = 255;
  }
  const off = new OffscreenCanvas(W, H); off.getContext("2d")!.putImageData(image, 0, 0);
  ctx.clearRect(0, 0, canvas!.width, canvas!.height);
  ctx.drawImage(off, 0, 0, canvas!.width, canvas!.height);
  readout!.textContent = `paint heat · total ${(total / field.length).toFixed(3)} · eigenmodes decay`;
}

function seed(field: Float32Array) {
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const d1 = Math.hypot(x - W * .35, y - H * .45), d2 = Math.hypot(x - W * .65, y - H * .55);
    field[y * W + x] = d1 < 10 || d2 < 7 ? 1 : 0;
  }
}
