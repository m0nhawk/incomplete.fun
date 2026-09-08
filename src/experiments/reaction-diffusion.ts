export {};

interface Elements {
  canvas: HTMLCanvasElement;
  presetSelect: HTMLSelectElement;
  feedInput: HTMLInputElement;
  feedValue: HTMLElement;
  killInput: HTMLInputElement;
  killValue: HTMLElement;
  brushInput: HTMLInputElement;
  pauseButton: HTMLButtonElement;
  seedButton: HTMLButtonElement;
  clearButton: HTMLButtonElement;
  status: HTMLElement;
  stats: HTMLElement;
}

interface State {
  width: number;
  height: number;
  u: Float32Array;
  v: Float32Array;
  nextU: Float32Array;
  nextV: Float32Array;
  feed: number;
  kill: number;
  brush: number;
  paused: boolean;
  painting: boolean;
  steps: number;
}

interface Preset {
  feed: number;
  kill: number;
}

interface Color {
  r: number;
  g: number;
  b: number;
}

const WIDTH = 192;
const HEIGHT = 128;
const DU = 0.16;
const DV = 0.08;
const DT = 1;
const STEPS_PER_FRAME = 8;
const PRESETS: Record<string, Preset> = {
  coral: { feed: 0.054, kill: 0.062 },
  mitosis: { feed: 0.036, kill: 0.062 },
  worms: { feed: 0.078, kill: 0.061 },
  maze: { feed: 0.029, kill: 0.057 },
};

const elements = getElements();
if (elements) init(elements);

function getElements(): Elements | null {
  const canvas = document.querySelector<HTMLCanvasElement>("#reaction-canvas");
  const presetSelect = document.querySelector<HTMLSelectElement>("#reaction-preset");
  const feedInput = document.querySelector<HTMLInputElement>("#reaction-feed");
  const feedValue = document.querySelector<HTMLElement>("#reaction-feed-value");
  const killInput = document.querySelector<HTMLInputElement>("#reaction-kill");
  const killValue = document.querySelector<HTMLElement>("#reaction-kill-value");
  const brushInput = document.querySelector<HTMLInputElement>("#reaction-brush");
  const pauseButton = document.querySelector<HTMLButtonElement>("#reaction-pause");
  const seedButton = document.querySelector<HTMLButtonElement>("#reaction-seed");
  const clearButton = document.querySelector<HTMLButtonElement>("#reaction-clear");
  const status = document.querySelector<HTMLElement>("#reaction-status");
  const stats = document.querySelector<HTMLElement>("#reaction-stats");

  if (!canvas || !presetSelect || !feedInput || !feedValue || !killInput || !killValue || !brushInput || !pauseButton || !seedButton || !clearButton || !status || !stats) {
    return null;
  }

  return { canvas, presetSelect, feedInput, feedValue, killInput, killValue, brushInput, pauseButton, seedButton, clearButton, status, stats };
}

function init(elements: Elements) {
  const context = elements.canvas.getContext("2d");
  if (!context) return;

  const state = createState();
  applyPreset(elements, state, "coral");
  seed(state);
  bindControls(elements, state);
  bindPainting(elements, state);
  if (elements.canvas.parentElement) new ResizeObserver(() => resizeCanvas(elements.canvas)).observe(elements.canvas.parentElement);
  resizeCanvas(elements.canvas);

  const image = context.createImageData(state.width, state.height);
  const tick = () => {
    if (!state.paused) {
      for (let i = 0; i < STEPS_PER_FRAME; i++) step(state);
    }
    draw(context, image, state, elements);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function createState(): State {
  const length = WIDTH * HEIGHT;
  const state: State = {
    width: WIDTH,
    height: HEIGHT,
    u: new Float32Array(length),
    v: new Float32Array(length),
    nextU: new Float32Array(length),
    nextV: new Float32Array(length),
    feed: PRESETS.coral.feed,
    kill: PRESETS.coral.kill,
    brush: 7,
    paused: false,
    painting: false,
    steps: 0,
  };
  clear(state);
  return state;
}

function bindControls(elements: Elements, state: State) {
  elements.presetSelect.addEventListener("change", () => applyPreset(elements, state, elements.presetSelect.value));
  elements.feedInput.addEventListener("input", () => {
    state.feed = readScaled(elements.feedInput.value, 0.054);
    syncControls(elements, state);
  });
  elements.killInput.addEventListener("input", () => {
    state.kill = readScaled(elements.killInput.value, 0.062);
    syncControls(elements, state);
  });
  elements.brushInput.addEventListener("input", () => {
    state.brush = readInt(elements.brushInput.value, 2, 18, 7);
  });
  elements.pauseButton.addEventListener("click", () => {
    state.paused = !state.paused;
    syncControls(elements, state);
  });
  elements.seedButton.addEventListener("click", () => seed(state));
  elements.clearButton.addEventListener("click", () => clear(state));
}

function bindPainting(elements: Elements, state: State) {
  elements.canvas.addEventListener("pointerdown", (event) => {
    elements.canvas.setPointerCapture(event.pointerId);
    state.painting = true;
    paint(elements.canvas, state, event);
  });
  elements.canvas.addEventListener("pointermove", (event) => {
    if (state.painting) paint(elements.canvas, state, event);
  });
  elements.canvas.addEventListener("pointerup", (event) => {
    state.painting = false;
    elements.canvas.releasePointerCapture(event.pointerId);
  });
  elements.canvas.addEventListener("pointercancel", (event) => {
    state.painting = false;
    elements.canvas.releasePointerCapture(event.pointerId);
  });
}

function applyPreset(elements: Elements, state: State, key: string) {
  const preset = PRESETS[key] ?? PRESETS.coral;
  state.feed = preset.feed;
  state.kill = preset.kill;
  elements.feedInput.value = String(Math.round(preset.feed * 1000));
  elements.killInput.value = String(Math.round(preset.kill * 1000));
  syncControls(elements, state);
}

function syncControls(elements: Elements, state: State) {
  elements.feedValue.textContent = state.feed.toFixed(3);
  elements.killValue.textContent = state.kill.toFixed(3);
  elements.pauseButton.textContent = state.paused ? "run" : "pause";
  elements.status.textContent = state.paused ? "paused" : "running";
}

function clear(state: State) {
  state.u.fill(1);
  state.v.fill(0);
  state.steps = 0;
}

function seed(state: State) {
  clear(state);
  for (let blob = 0; blob < 28; blob++) {
    const x = Math.floor(Math.random() * state.width);
    const y = Math.floor(Math.random() * state.height);
    addChemical(state, x, y, 4 + Math.floor(Math.random() * 8));
  }
  addChemical(state, state.width / 2, state.height / 2, 13);
}

function paint(canvas: HTMLCanvasElement, state: State, event: PointerEvent) {
  const rect = canvas.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * state.width;
  const y = ((event.clientY - rect.top) / rect.height) * state.height;
  addChemical(state, x, y, state.brush);
}

function addChemical(state: State, centerX: number, centerY: number, radius: number) {
  const minX = Math.max(0, Math.floor(centerX - radius));
  const maxX = Math.min(state.width - 1, Math.ceil(centerX + radius));
  const minY = Math.max(0, Math.floor(centerY - radius));
  const maxY = Math.min(state.height - 1, Math.ceil(centerY + radius));

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (Math.hypot(x - centerX, y - centerY) > radius) continue;
      const index = y * state.width + x;
      state.u[index] = 0.42;
      state.v[index] = 0.92;
    }
  }
}

function step(state: State) {
  for (let y = 0; y < state.height; y++) {
    for (let x = 0; x < state.width; x++) {
      const index = y * state.width + x;
      const u = state.u[index];
      const v = state.v[index];
      const uvv = u * v * v;
      const nextU = u + (DU * laplace(state.u, state, x, y) - uvv + state.feed * (1 - u)) * DT;
      const nextV = v + (DV * laplace(state.v, state, x, y) + uvv - (state.feed + state.kill) * v) * DT;
      state.nextU[index] = clamp01(nextU);
      state.nextV[index] = clamp01(nextV);
    }
  }
  [state.u, state.nextU] = [state.nextU, state.u];
  [state.v, state.nextV] = [state.nextV, state.v];
  state.steps++;
}

function laplace(values: Float32Array, state: State, x: number, y: number): number {
  const center = values[indexOf(state, x, y)] * -1;
  const cardinal = (
    values[indexOf(state, x - 1, y)] +
    values[indexOf(state, x + 1, y)] +
    values[indexOf(state, x, y - 1)] +
    values[indexOf(state, x, y + 1)]
  ) * 0.2;
  const diagonal = (
    values[indexOf(state, x - 1, y - 1)] +
    values[indexOf(state, x + 1, y - 1)] +
    values[indexOf(state, x - 1, y + 1)] +
    values[indexOf(state, x + 1, y + 1)]
  ) * 0.05;
  return center + cardinal + diagonal;
}

function indexOf(state: State, x: number, y: number): number {
  const wrappedX = (x + state.width) % state.width;
  const wrappedY = (y + state.height) % state.height;
  return wrappedY * state.width + wrappedX;
}

function draw(context: CanvasRenderingContext2D, image: ImageData, state: State, elements: Elements) {
  const colors = readColors();
  for (let i = 0; i < state.u.length; i++) {
    const value = clamp01((state.v[i] - state.u[i] * 0.28) * 1.7 + 0.18);
    const shade = smoothstep(0.12, 0.86, value);
    const color = mix(colors.bg, colors.fg, shade);
    const offset = i * 4;
    image.data[offset] = color.r;
    image.data[offset + 1] = color.g;
    image.data[offset + 2] = color.b;
    image.data[offset + 3] = 255;
  }
  context.putImageData(image, 0, 0);
  elements.stats.textContent = `${state.steps.toLocaleString()} steps · ${state.width}×${state.height}`;
}

function resizeCanvas(canvas: HTMLCanvasElement) {
  const parent = canvas.parentElement;
  if (!parent) return;
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  canvas.style.width = `${parent.clientWidth}px`;
  canvas.style.height = `${parent.clientHeight}px`;
}

function readScaled(value: string, fallback: number): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, parsed) / 1000;
}

function readInt(value: string, min: number, max: number, fallback: number): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = clamp01((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function mix(a: Color, b: Color, t: number): Color {
  return {
    r: Math.round(a.r + (b.r - a.r) * t),
    g: Math.round(a.g + (b.g - a.g) * t),
    b: Math.round(a.b + (b.b - a.b) * t),
  };
}

function readColors(): { bg: Color; fg: Color } {
  const style = getComputedStyle(document.documentElement);
  return {
    bg: parseColor(style.getPropertyValue("--bg").trim()) ?? { r: 255, g: 255, b: 255 },
    fg: parseColor(style.getPropertyValue("--fg").trim()) ?? { r: 17, g: 17, b: 17 },
  };
}

function parseColor(value: string): Color | null {
  if (!value.startsWith("#")) return null;
  const hex = value.slice(1);
  const full = hex.length === 3 ? hex.split("").map((digit) => digit + digit).join("") : hex;
  const number = Number.parseInt(full, 16);
  if (!Number.isFinite(number)) return null;
  return {
    r: (number >> 16) & 255,
    g: (number >> 8) & 255,
    b: number & 255,
  };
}
