export {};

interface Elements {
  canvas: HTMLCanvasElement;
  limitInput: HTMLInputElement;
  limitValue: HTMLElement;
  viewSelect: HTMLSelectElement;
  modInput: HTMLInputElement;
  residueInput: HTMLInputElement;
  compositesInput: HTMLInputElement;
  status: HTMLElement;
  hover: HTMLElement;
}
interface Point { x: number; y: number; n: number; prime: boolean }
interface Colors { bg: string; fg: string; muted: string }

const elements = getElements();
if (elements) init(elements);

let pointer: { x: number; y: number } | null = null;
let cachedLimit = 0;
let cachedPrimeFlags: boolean[] = [];
let cachedPrimeCount = 0;

function getElements(): Elements | null {
  const canvas = document.querySelector<HTMLCanvasElement>("#primes-canvas");
  const limitInput = document.querySelector<HTMLInputElement>("#primes-limit");
  const limitValue = document.querySelector<HTMLElement>("#primes-limit-value");
  const viewSelect = document.querySelector<HTMLSelectElement>("#primes-view");
  const modInput = document.querySelector<HTMLInputElement>("#primes-mod");
  const residueInput = document.querySelector<HTMLInputElement>("#primes-residue");
  const compositesInput = document.querySelector<HTMLInputElement>("#primes-composites");
  const status = document.querySelector<HTMLElement>("#primes-status");
  const hover = document.querySelector<HTMLElement>("#primes-hover");
  if (!canvas || !limitInput || !limitValue || !viewSelect || !modInput || !residueInput || !compositesInput || !status || !hover) return null;
  return { canvas, limitInput, limitValue, viewSelect, modInput, residueInput, compositesInput, status, hover };
}

function init(elements: Elements) {
  const context = elements.canvas.getContext("2d");
  if (!context) return;
  const render = () => draw(elements, context);
  [elements.limitInput, elements.viewSelect, elements.modInput, elements.residueInput, elements.compositesInput].forEach((input) => {
    input.addEventListener("input", render);
    input.addEventListener("change", render);
  });
  elements.canvas.addEventListener("pointermove", (event) => {
    const rect = elements.canvas.getBoundingClientRect();
    pointer = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    render();
  });
  elements.canvas.addEventListener("pointerleave", () => { pointer = null; render(); });
  if (elements.canvas.parentElement) new ResizeObserver(render).observe(elements.canvas.parentElement);
  render();
}

function draw(elements: Elements, context: CanvasRenderingContext2D) {
  const parent = elements.canvas.parentElement;
  if (!parent) return;
  const width = parent.clientWidth;
  const height = parent.clientHeight;
  const dpr = window.devicePixelRatio || 1;
  elements.canvas.width = Math.max(1, Math.floor(width * dpr));
  elements.canvas.height = Math.max(1, Math.floor(height * dpr));
  elements.canvas.style.width = `${width}px`;
  elements.canvas.style.height = `${height}px`;
  context.setTransform(dpr, 0, 0, dpr, 0, 0);

  const limit = readInt(elements.limitInput.value, 500, 30000, 12000);
  const mod = readInt(elements.modInput.value, 2, 30, 6);
  const residue = modulo(readInt(elements.residueInput.value, 0, 29, 1), mod);
  const showComposites = elements.compositesInput.checked;
  elements.limitInput.value = String(limit);
  elements.limitValue.textContent = limit.toLocaleString();
  elements.modInput.value = String(mod);
  elements.residueInput.max = String(mod - 1);
  elements.residueInput.value = String(residue);
  ensureSieve(limit);

  const colors = readColors();
  context.fillStyle = colors.bg;
  context.fillRect(0, 0, width, height);
  drawAxes(context, width, height, colors);

  const points = elements.viewSelect.value === "polar"
    ? polarPoints(limit, width, height)
    : ulamPoints(limit, width, height);
  const nearest = drawPoints(context, points, cachedPrimeFlags, mod, residue, showComposites, colors, pointer);
  elements.status.textContent = `${cachedPrimeCount.toLocaleString()} primes ≤ ${limit.toLocaleString()} · highlight n ≡ ${residue} mod ${mod}`;
  elements.hover.textContent = nearest ? `${nearest.n} ${nearest.prime ? "prime" : "composite"} · ${nearest.n % mod} mod ${mod}` : "hover a point";
}

function ensureSieve(limit: number) {
  if (limit === cachedLimit) return;
  cachedLimit = limit;
  cachedPrimeFlags = Array.from({ length: limit + 1 }, () => true);
  cachedPrimeFlags[0] = false;
  cachedPrimeFlags[1] = false;
  for (let p = 2; p * p <= limit; p++) if (cachedPrimeFlags[p]) for (let q = p * p; q <= limit; q += p) cachedPrimeFlags[q] = false;
  cachedPrimeCount = cachedPrimeFlags.filter(Boolean).length;
}

function ulamPoints(limit: number, width: number, height: number): Point[] {
  const cell = Math.max(2, Math.min(width, height) / (Math.ceil(Math.sqrt(limit)) + 4));
  let x = 0, y = 0, dx = 1, dy = 0, segmentLength = 1, segmentProgress = 0, turns = 0;
  const center = { x: width / 2, y: height / 2 };
  const points: Point[] = [];
  for (let n = 1; n <= limit; n++) {
    points.push({ x: center.x + x * cell, y: center.y + y * cell, n, prime: cachedPrimeFlags[n] });
    x += dx; y += dy; segmentProgress++;
    if (segmentProgress === segmentLength) {
      segmentProgress = 0;
      [dx, dy] = [-dy, dx];
      turns++;
      if (turns % 2 === 0) segmentLength++;
    }
  }
  return points;
}

function polarPoints(limit: number, width: number, height: number): Point[] {
  const center = { x: width / 2, y: height / 2 };
  const scale = Math.min(width, height) * 0.43 / Math.sqrt(limit);
  const golden = Math.PI * (3 - Math.sqrt(5));
  return Array.from({ length: limit }, (_unused, index) => {
    const n = index + 1;
    const r = Math.sqrt(n) * scale;
    const angle = n * golden;
    return { x: center.x + Math.cos(angle) * r, y: center.y + Math.sin(angle) * r, n, prime: cachedPrimeFlags[n] };
  });
}

function drawPoints(context: CanvasRenderingContext2D, points: Point[], primeFlags: boolean[], mod: number, residue: number, showComposites: boolean, colors: Colors, hover: { x: number; y: number } | null): Point | null {
  let nearest: Point | null = null;
  let nearestDistance = 12;
  for (const point of points) {
    const highlighted = point.n % mod === residue;
    if (!primeFlags[point.n] && !showComposites && !highlighted) continue;
    const alpha = primeFlags[point.n] ? (highlighted ? 0.98 : 0.55) : 0.11;
    const radius = primeFlags[point.n] ? (highlighted ? 2.7 : 1.7) : 0.8;
    context.fillStyle = withAlpha(primeFlags[point.n] ? colors.fg : colors.muted, alpha);
    context.beginPath();
    context.arc(point.x, point.y, radius, 0, Math.PI * 2);
    context.fill();
    if (hover) {
      const distance = Math.hypot(point.x - hover.x, point.y - hover.y);
      if (distance < nearestDistance) { nearestDistance = distance; nearest = point; }
    }
  }
  if (nearest) {
    context.strokeStyle = colors.fg;
    context.lineWidth = 1.5;
    context.beginPath();
    context.arc(nearest.x, nearest.y, 7, 0, Math.PI * 2);
    context.stroke();
  }
  return nearest;
}

function drawAxes(context: CanvasRenderingContext2D, width: number, height: number, colors: Colors) {
  context.strokeStyle = withAlpha(colors.fg, 0.08);
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(width / 2, 0);
  context.lineTo(width / 2, height);
  context.moveTo(0, height / 2);
  context.lineTo(width, height / 2);
  context.stroke();
}

function readInt(value: string, min: number, max: number, fallback: number): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}
function modulo(value: number, modulus: number): number { return ((value % modulus) + modulus) % modulus; }
function readColors(): Colors {
  const style = getComputedStyle(document.documentElement);
  return { bg: style.getPropertyValue("--bg").trim() || "#fff", fg: style.getPropertyValue("--fg").trim() || "#111", muted: style.getPropertyValue("--muted").trim() || "#777" };
}
function withAlpha(color: string, alpha: number): string {
  if (!color.startsWith("#")) return color;
  const hex = color.slice(1);
  const full = hex.length === 3 ? hex.split("").map((digit) => digit + digit).join("") : hex;
  const value = Number.parseInt(full, 16);
  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
}
