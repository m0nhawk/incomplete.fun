export {};

interface Point {
  x: number;
  y: number;
}

interface Complex {
  re: number;
  im: number;
}

interface Coefficient {
  frequency: number;
  value: Complex;
  amplitude: number;
}

interface Elements {
  canvas: HTMLCanvasElement;
  harmonicsInput: HTMLInputElement;
  harmonicsValue: HTMLElement;
  speedInput: HTMLInputElement;
  exampleButton: HTMLButtonElement;
  clearButton: HTMLButtonElement;
  status: HTMLElement;
  energy: HTMLElement;
}

interface State {
  drawing: boolean;
  draft: Complex[];
  samples: Complex[];
  coefficients: Coefficient[];
  phase: number;
  harmonics: number;
  speed: number;
  speedScale: number;
  paused: boolean;
  lastTime: number;
}

const SAMPLE_COUNT = 512;
const TRACE_STEPS = 420;

const elements = getElements();
if (elements) init(elements);

function getElements(): Elements | null {
  const canvas = document.querySelector<HTMLCanvasElement>("#fourier-canvas");
  const harmonicsInput = document.querySelector<HTMLInputElement>("#fourier-harmonics");
  const harmonicsValue = document.querySelector<HTMLElement>("#fourier-harmonics-value");
  const speedInput = document.querySelector<HTMLInputElement>("#fourier-speed");
  const exampleButton = document.querySelector<HTMLButtonElement>("#fourier-example");
  const clearButton = document.querySelector<HTMLButtonElement>("#fourier-clear");
  const status = document.querySelector<HTMLElement>("#fourier-status");
  const energy = document.querySelector<HTMLElement>("#fourier-energy");

  if (!canvas || !harmonicsInput || !harmonicsValue || !speedInput || !exampleButton || !clearButton || !status || !energy) {
    return null;
  }

  return { canvas, harmonicsInput, harmonicsValue, speedInput, exampleButton, clearButton, status, energy };
}

function init(elements: Elements) {
  const context = elements.canvas.getContext("2d");
  if (!context) return;

  const state: State = {
    drawing: false,
    draft: [],
    samples: examplePath(),
    coefficients: [],
    phase: 0,
    harmonics: readInt(elements.harmonicsInput.value, 1, 80, 28),
    speed: readInt(elements.speedInput.value, 1, 120, 34),
    speedScale: readFloat(document.querySelector<HTMLInputElement>('[data-control-speed]')?.value, 0, 2, 1),
    paused: document.body.hasAttribute("data-paused"),
    lastTime: performance.now(),
  };
  recompute(state);

  bindControls(elements, state);
  bindDrawing(elements.canvas, state);
  if (elements.canvas.parentElement) new ResizeObserver(() => draw(elements.canvas, context, elements, state)).observe(elements.canvas.parentElement);

  const tick = (time: number) => {
    const delta = Math.min(80, time - state.lastTime);
    state.lastTime = time;
    if (!state.paused && !state.drawing && state.coefficients.length > 0) {
      state.phase = (state.phase + (delta * state.speed * state.speedScale) / 42000) % 1;
    }
    draw(elements.canvas, context, elements, state);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function bindControls(elements: Elements, state: State) {
  const sharedSpeedInput = document.querySelector<HTMLInputElement>('[data-control-speed]');

  elements.harmonicsInput.addEventListener("input", () => {
    state.harmonics = readInt(elements.harmonicsInput.value, 1, 80, 28);
    recompute(state);
  });
  elements.speedInput.addEventListener("input", () => {
    state.speed = readInt(elements.speedInput.value, 1, 120, 34);
  });
  elements.exampleButton.addEventListener("click", () => {
    state.draft = [];
    state.samples = examplePath();
    state.phase = 0;
    recompute(state);
  });
  elements.clearButton.addEventListener("click", () => {
    clear(state);
  });

  sharedSpeedInput?.addEventListener("input", () => {
    state.speedScale = readFloat(sharedSpeedInput.value, 0, 2, 1);
  });

  window.addEventListener("incomplete:pause", (event) => {
    state.paused = Boolean((event as CustomEvent<{ paused?: boolean }>).detail?.paused);
  });
  window.addEventListener("incomplete:reset", () => {
    state.draft = [];
    state.samples = examplePath();
    state.phase = 0;
    recompute(state);
  });
  window.addEventListener("incomplete:randomize", () => {
    state.draft = [];
    state.samples = randomPath();
    state.phase = 0;
    recompute(state);
  });
}

function clear(state: State) {
  state.draft = [];
  state.samples = [];
  state.coefficients = [];
  state.phase = 0;
}

function bindDrawing(canvas: HTMLCanvasElement, state: State) {
  canvas.addEventListener("pointerdown", (event) => {
    canvas.setPointerCapture(event.pointerId);
    state.drawing = true;
    state.draft = [eventToComplex(canvas, event)];
    state.samples = [];
    state.coefficients = [];
    state.phase = 0;
  });

  canvas.addEventListener("pointermove", (event) => {
    if (!state.drawing) return;
    const next = eventToComplex(canvas, event);
    const previous = state.draft[state.draft.length - 1];
    if (!previous || distance(previous, next) > 0.006) state.draft.push(next);
  });

  canvas.addEventListener("pointerup", (event) => finishDrawing(canvas, event.pointerId, state));
  canvas.addEventListener("pointercancel", (event) => finishDrawing(canvas, event.pointerId, state));
}

function finishDrawing(canvas: HTMLCanvasElement, pointerId: number, state: State) {
  if (!state.drawing) return;
  canvas.releasePointerCapture(pointerId);
  state.drawing = false;
  if (state.draft.length >= 8) {
    state.samples = resampleClosed(state.draft, SAMPLE_COUNT);
    recompute(state);
  }
}

function draw(canvas: HTMLCanvasElement, context: CanvasRenderingContext2D, elements: Elements, state: State) {
  const parent = canvas.parentElement;
  if (!parent) return;

  const width = parent.clientWidth;
  const height = parent.clientHeight;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.floor(width * dpr));
  canvas.height = Math.max(1, Math.floor(height * dpr));
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  context.setTransform(dpr, 0, 0, dpr, 0, 0);

  const colors = readColors();
  const scale = Math.min(width, height) * 0.36;
  const center = { x: width / 2, y: height / 2 };

  context.clearRect(0, 0, width, height);
  context.fillStyle = colors.bg;
  context.fillRect(0, 0, width, height);
  drawGrid(context, center, scale, colors);

  const source = state.drawing ? state.draft : state.samples;
  drawPath(context, source, center, scale, colors, 0.24, 1.1);

  if (state.coefficients.length > 0) {
    const epicycleEnd = drawEpicycles(context, state.coefficients, state.phase, center, scale, colors);
    drawTrace(context, state.coefficients, state.phase, center, scale, colors);
    context.fillStyle = colors.fg;
    context.beginPath();
    context.arc(epicycleEnd.x, epicycleEnd.y, 3.8, 0, Math.PI * 2);
    context.fill();
  }

  elements.harmonicsValue.textContent = String(state.harmonics);
  elements.status.textContent = state.drawing ? `${state.draft.length} drawn points` : state.samples.length ? "replaying Fourier reconstruction" : "draw a path";
  const energy = state.coefficients.reduce((total, coefficient) => total + coefficient.amplitude, 0);
  elements.energy.textContent = `${state.coefficients.length} coefficients · energy ${energy.toFixed(3)}`;
}

function drawGrid(context: CanvasRenderingContext2D, center: Point, scale: number, colors: Colors) {
  context.strokeStyle = withAlpha(colors.fg, 0.08);
  context.lineWidth = 1;
  for (let i = 1; i <= 4; i++) {
    context.beginPath();
    context.arc(center.x, center.y, (scale * i) / 4, 0, Math.PI * 2);
    context.stroke();
  }
  context.beginPath();
  context.moveTo(center.x - scale * 1.18, center.y);
  context.lineTo(center.x + scale * 1.18, center.y);
  context.moveTo(center.x, center.y - scale * 1.18);
  context.lineTo(center.x, center.y + scale * 1.18);
  context.stroke();
}

function drawPath(context: CanvasRenderingContext2D, points: Complex[], center: Point, scale: number, colors: Colors, alpha: number, lineWidth: number) {
  if (points.length < 2) return;
  context.strokeStyle = withAlpha(colors.fg, alpha);
  context.lineWidth = lineWidth;
  context.beginPath();
  points.forEach((point, index) => {
    const screen = complexToScreen(point, center, scale);
    if (index === 0) context.moveTo(screen.x, screen.y);
    else context.lineTo(screen.x, screen.y);
  });
  if (points.length === SAMPLE_COUNT) context.closePath();
  context.stroke();
}

function drawEpicycles(context: CanvasRenderingContext2D, coefficients: Coefficient[], phase: number, center: Point, scale: number, colors: Colors): Point {
  let current: Complex = { re: 0, im: 0 };
  context.lineWidth = 1;

  coefficients.forEach((coefficient, index) => {
    const before = current;
    const rotating = multiply(coefficient.value, expi(Math.PI * 2 * coefficient.frequency * phase));
    current = add(current, rotating);
    const beforeScreen = complexToScreen(before, center, scale);
    const afterScreen = complexToScreen(current, center, scale);

    if (index > 0) {
      context.strokeStyle = withAlpha(colors.fg, 0.11);
      context.beginPath();
      context.arc(beforeScreen.x, beforeScreen.y, coefficient.amplitude * scale, 0, Math.PI * 2);
      context.stroke();
    }

    context.strokeStyle = withAlpha(colors.fg, index < 8 ? 0.62 : 0.32);
    context.beginPath();
    context.moveTo(beforeScreen.x, beforeScreen.y);
    context.lineTo(afterScreen.x, afterScreen.y);
    context.stroke();
  });

  return complexToScreen(current, center, scale);
}

function drawTrace(context: CanvasRenderingContext2D, coefficients: Coefficient[], phase: number, center: Point, scale: number, colors: Colors) {
  const steps = Math.max(2, Math.floor(TRACE_STEPS * phase));
  context.strokeStyle = colors.fg;
  context.lineWidth = 2;
  context.beginPath();
  for (let i = 0; i <= steps; i++) {
    const t = i / TRACE_STEPS;
    const point = reconstruct(coefficients, t);
    const screen = complexToScreen(point, center, scale);
    if (i === 0) context.moveTo(screen.x, screen.y);
    else context.lineTo(screen.x, screen.y);
  }
  context.stroke();
}

function recompute(state: State) {
  state.coefficients = state.samples.length ? computeCoefficients(state.samples, state.harmonics) : [];
}

function computeCoefficients(samples: Complex[], harmonics: number): Coefficient[] {
  const frequencies = [0];
  for (let k = 1; k <= harmonics; k++) frequencies.push(k, -k);
  return frequencies.map((frequency) => {
    let sum = { re: 0, im: 0 };
    samples.forEach((sample, index) => {
      const angle = (-Math.PI * 2 * frequency * index) / samples.length;
      sum = add(sum, multiply(sample, expi(angle)));
    });
    const value = scaleComplex(sum, 1 / samples.length);
    return { frequency, value, amplitude: magnitude(value) };
  }).sort((a, b) => (a.frequency === 0 ? -1 : b.frequency === 0 ? 1 : Math.abs(a.frequency) - Math.abs(b.frequency)));
}

function reconstruct(coefficients: Coefficient[], t: number): Complex {
  return coefficients.reduce((sum, coefficient) => add(sum, multiply(coefficient.value, expi(Math.PI * 2 * coefficient.frequency * t))), { re: 0, im: 0 });
}

function examplePath(): Complex[] {
  const raw = Array.from({ length: 420 }, (_unused, index) => {
    const t = (index / 420) * Math.PI * 2;
    const r = 0.58 + 0.15 * Math.sin(5 * t) + 0.08 * Math.cos(3 * t);
    return {
      re: Math.cos(t) * r + 0.18 * Math.cos(2 * t),
      im: Math.sin(t) * r - 0.18 * Math.sin(2 * t),
    };
  });
  return resampleClosed(raw, SAMPLE_COUNT);
}

function randomPath(): Complex[] {
  const lobes = 3 + Math.floor(Math.random() * 6);
  const wobble = Math.random() * Math.PI * 2;
  const raw = Array.from({ length: 420 }, (_unused, index) => {
    const t = (index / 420) * Math.PI * 2;
    const r = 0.45
      + 0.18 * Math.sin(lobes * t + wobble)
      + 0.09 * Math.cos((lobes + 2) * t - wobble * 0.7)
      + 0.05 * Math.sin((lobes * 2 + 1) * t);
    return {
      re: Math.cos(t) * r + 0.14 * Math.cos(2 * t + wobble),
      im: Math.sin(t) * r - 0.14 * Math.sin(3 * t - wobble),
    };
  });
  return resampleClosed(raw, SAMPLE_COUNT);
}

function resampleClosed(points: Complex[], count: number): Complex[] {
  const closed = [...points, points[0]];
  const lengths = [0];
  for (let i = 1; i < closed.length; i++) lengths.push(lengths[i - 1] + distance(closed[i - 1], closed[i]));
  const total = lengths[lengths.length - 1] || 1;

  return Array.from({ length: count }, (_unused, index) => {
    const target = (index / count) * total;
    let segment = 1;
    while (segment < lengths.length - 1 && lengths[segment] < target) segment++;
    const startLength = lengths[segment - 1];
    const endLength = lengths[segment];
    const t = (target - startLength) / (endLength - startLength || 1);
    return lerpComplex(closed[segment - 1], closed[segment], t);
  });
}

function eventToComplex(canvas: HTMLCanvasElement, event: PointerEvent): Complex {
  const rect = canvas.getBoundingClientRect();
  const scale = Math.min(rect.width, rect.height) * 0.36;
  return {
    re: (event.clientX - rect.left - rect.width / 2) / scale,
    im: (event.clientY - rect.top - rect.height / 2) / scale,
  };
}

function complexToScreen(point: Complex, center: Point, scale: number): Point {
  return {
    x: center.x + point.re * scale,
    y: center.y + point.im * scale,
  };
}

function add(a: Complex, b: Complex): Complex {
  return { re: a.re + b.re, im: a.im + b.im };
}

function multiply(a: Complex, b: Complex): Complex {
  return { re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re };
}

function scaleComplex(value: Complex, scale: number): Complex {
  return { re: value.re * scale, im: value.im * scale };
}

function expi(angle: number): Complex {
  return { re: Math.cos(angle), im: Math.sin(angle) };
}

function magnitude(value: Complex): number {
  return Math.hypot(value.re, value.im);
}

function distance(a: Complex, b: Complex): number {
  return Math.hypot(a.re - b.re, a.im - b.im);
}

function lerpComplex(a: Complex, b: Complex, t: number): Complex {
  return {
    re: a.re + (b.re - a.re) * t,
    im: a.im + (b.im - a.im) * t,
  };
}

function readInt(value: string, min: number, max: number, fallback: number): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function readFloat(value: string | undefined, min: number, max: number, fallback: number): number {
  if (value === undefined) return fallback;
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

interface Colors {
  bg: string;
  fg: string;
}

function readColors(): Colors {
  const style = getComputedStyle(document.documentElement);
  return {
    bg: style.getPropertyValue("--bg").trim() || "#ffffff",
    fg: style.getPropertyValue("--fg").trim() || "#111111",
  };
}

function withAlpha(color: string, alpha: number): string {
  if (color.startsWith("#")) {
    const hex = color.slice(1);
    const full = hex.length === 3 ? hex.split("").map((digit) => digit + digit).join("") : hex;
    const value = Number.parseInt(full, 16);
    const red = (value >> 16) & 255;
    const green = (value >> 8) & 255;
    const blue = value & 255;
    return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
  }
  return color;
}
