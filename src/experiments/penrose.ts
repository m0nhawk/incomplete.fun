export {};

interface Point {
  x: number;
  y: number;
}

interface Triangle {
  kind: "thin" | "thick";
  a: Point;
  b: Point;
  c: Point;
}

interface ScreenTriangle extends Triangle {
  screenA: Point;
  screenB: Point;
  screenC: Point;
}

interface Elements {
  canvas: HTMLCanvasElement;
  presetSelect: HTMLSelectElement;
  depthInput: HTMLInputElement;
  depthValue: HTMLElement;
  rulesInput: HTMLInputElement;
  resetButton: HTMLButtonElement;
  count: HTMLElement;
  hover: HTMLElement;
}

interface State {
  preset: Preset;
  depth: number;
  showRules: boolean;
  pointer: Point | null;
  hoveredIndex: number | null;
}

type Preset = "star" | "sun" | "decagon";

const PHI = (1 + Math.sqrt(5)) / 2;
const TAU = Math.PI * 2;
const INITIAL: State = {
  preset: "star",
  depth: 5,
  showRules: true,
  pointer: null,
  hoveredIndex: null,
};

const elements = getElements();
if (elements) init(elements);

function getElements(): Elements | null {
  const canvas = document.querySelector<HTMLCanvasElement>("#penrose-canvas");
  const presetSelect = document.querySelector<HTMLSelectElement>("#penrose-preset");
  const depthInput = document.querySelector<HTMLInputElement>("#penrose-depth");
  const depthValue = document.querySelector<HTMLElement>("#penrose-depth-value");
  const rulesInput = document.querySelector<HTMLInputElement>("#penrose-rules");
  const resetButton = document.querySelector<HTMLButtonElement>("#penrose-reset");
  const count = document.querySelector<HTMLElement>("#penrose-count");
  const hover = document.querySelector<HTMLElement>("#penrose-hover");

  if (!canvas || !presetSelect || !depthInput || !depthValue || !rulesInput || !resetButton || !count || !hover) {
    return null;
  }

  return { canvas, presetSelect, depthInput, depthValue, rulesInput, resetButton, count, hover };
}

function init(elements: Elements) {
  const context = elements.canvas.getContext("2d");
  if (!context) return;

  const state: State = {
    ...INITIAL,
    preset: readPreset(elements.presetSelect.value),
    depth: readInt(elements.depthInput.value, 0, 7, INITIAL.depth),
    showRules: elements.rulesInput.checked,
  };

  const render = () => {
    syncControls(elements, state);
    draw(elements.canvas, context, elements, state);
  };

  bindControls(elements, state, render);
  bindPointer(elements.canvas, state, render);
  if (elements.canvas.parentElement) new ResizeObserver(render).observe(elements.canvas.parentElement);
  render();
}

function bindControls(elements: Elements, state: State, render: () => void) {
  elements.presetSelect.addEventListener("change", () => {
    state.preset = readPreset(elements.presetSelect.value);
    render();
  });
  elements.depthInput.addEventListener("input", () => {
    state.depth = readInt(elements.depthInput.value, 0, 7, INITIAL.depth);
    render();
  });
  elements.rulesInput.addEventListener("change", () => {
    state.showRules = elements.rulesInput.checked;
    render();
  });
  elements.resetButton.addEventListener("click", () => {
    state.preset = INITIAL.preset;
    state.depth = INITIAL.depth;
    state.showRules = INITIAL.showRules;
    state.pointer = null;
    state.hoveredIndex = null;
    render();
  });
}

function bindPointer(canvas: HTMLCanvasElement, state: State, render: () => void) {
  canvas.addEventListener("pointermove", (event) => {
    const rect = canvas.getBoundingClientRect();
    state.pointer = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    render();
  });
  canvas.addEventListener("pointerleave", () => {
    state.pointer = null;
    state.hoveredIndex = null;
    render();
  });
}

function syncControls(elements: Elements, state: State) {
  elements.presetSelect.value = state.preset;
  elements.depthInput.value = String(state.depth);
  elements.depthValue.textContent = String(state.depth);
  elements.rulesInput.checked = state.showRules;
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
  context.clearRect(0, 0, width, height);
  context.fillStyle = colors.bg;
  context.fillRect(0, 0, width, height);

  const triangles = subdivide(seedTriangles(state.preset), state.depth);
  const screenTriangles = fitTriangles(triangles, width, height);
  state.hoveredIndex = state.pointer ? findHovered(screenTriangles, state.pointer) : null;

  drawCompass(context, width, height, colors);
  screenTriangles.forEach((triangle, index) => {
    drawTriangle(context, triangle, colors, state.hoveredIndex === index);
  });
  if (state.showRules) {
    screenTriangles.forEach((triangle, index) => {
      drawMatchingMarks(context, triangle, colors, state.hoveredIndex === index);
    });
  }

  elements.count.textContent = `${triangles.length.toLocaleString()} tiles · ${state.preset} · depth ${state.depth}`;
  if (state.hoveredIndex === null) {
    elements.hover.textContent = "hover the patch";
  } else {
    const triangle = screenTriangles[state.hoveredIndex];
    elements.hover.textContent = `${triangle.kind} triangle · area ${format(area(triangle.screenA, triangle.screenB, triangle.screenC))}`;
  }
}

function seedTriangles(preset: Preset): Triangle[] {
  if (preset === "decagon") return decagonSeed();

  const triangles: Triangle[] = [];
  const outer = preset === "star" ? 1 : 0.78;
  const inner = preset === "star" ? 0 : -0.12;
  for (let i = 0; i < 10; i++) {
    const a = pointFromAngle((i / 10) * TAU, inner);
    const b = pointFromAngle(((i + 1) / 10) * TAU, inner);
    const c = pointFromAngle(((i + 0.5) / 10) * TAU, outer);
    triangles.push({ kind: preset === "star" ? "thin" : "thick", a, b, c });
  }
  return triangles;
}

function decagonSeed(): Triangle[] {
  const points = Array.from({ length: 10 }, (_unused, i) => pointFromAngle((i / 10) * TAU - Math.PI / 2, 1));
  const center = { x: 0, y: 0 };
  const triangles: Triangle[] = [];
  for (let i = 0; i < points.length; i++) {
    const next = points[(i + 1) % points.length];
    triangles.push({ kind: i % 2 === 0 ? "thick" : "thin", a: center, b: points[i], c: next });
  }
  return triangles;
}

function pointFromAngle(angle: number, radius: number): Point {
  return {
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius,
  };
}

function subdivide(triangles: Triangle[], depth: number): Triangle[] {
  let current = triangles;
  for (let step = 0; step < depth; step++) {
    current = current.flatMap(deflate);
  }
  return current;
}

function deflate(triangle: Triangle): Triangle[] {
  const { a, b, c } = triangle;

  if (triangle.kind === "thin") {
    const p = lerpPoint(a, b, 1 / PHI);
    return [
      { kind: "thin", a: c, b: p, c: b },
      { kind: "thick", a: p, b: c, c: a },
    ];
  }

  const q = lerpPoint(b, a, 1 / PHI);
  const r = lerpPoint(b, c, 1 / PHI);
  return [
    { kind: "thick", a: r, b: c, c: a },
    { kind: "thick", a: q, b: r, c: b },
    { kind: "thin", a: r, b: q, c: a },
  ];
}

function lerpPoint(a: Point, b: Point, t: number): Point {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
  };
}

function fitTriangles(triangles: Triangle[], width: number, height: number): ScreenTriangle[] {
  const bounds = getBounds(triangles.flatMap((triangle) => [triangle.a, triangle.b, triangle.c]));
  const margin = 36;
  const scale = Math.min((width - margin * 2) / (bounds.maxX - bounds.minX || 1), (height - margin * 2) / (bounds.maxY - bounds.minY || 1));
  const offsetX = width / 2 - ((bounds.minX + bounds.maxX) / 2) * scale;
  const offsetY = height / 2 - ((bounds.minY + bounds.maxY) / 2) * scale;

  return triangles.map((triangle) => ({
    ...triangle,
    screenA: toScreen(triangle.a, scale, offsetX, offsetY),
    screenB: toScreen(triangle.b, scale, offsetX, offsetY),
    screenC: toScreen(triangle.c, scale, offsetX, offsetY),
  }));
}

function getBounds(points: Point[]) {
  return points.reduce(
    (bounds, point) => ({
      minX: Math.min(bounds.minX, point.x),
      minY: Math.min(bounds.minY, point.y),
      maxX: Math.max(bounds.maxX, point.x),
      maxY: Math.max(bounds.maxY, point.y),
    }),
    { minX: Number.POSITIVE_INFINITY, minY: Number.POSITIVE_INFINITY, maxX: Number.NEGATIVE_INFINITY, maxY: Number.NEGATIVE_INFINITY },
  );
}

function toScreen(point: Point, scale: number, offsetX: number, offsetY: number): Point {
  return {
    x: point.x * scale + offsetX,
    y: point.y * scale + offsetY,
  };
}

function drawTriangle(context: CanvasRenderingContext2D, triangle: ScreenTriangle, colors: Colors, isHovered: boolean) {
  context.beginPath();
  context.moveTo(triangle.screenA.x, triangle.screenA.y);
  context.lineTo(triangle.screenB.x, triangle.screenB.y);
  context.lineTo(triangle.screenC.x, triangle.screenC.y);
  context.closePath();
  context.fillStyle = triangle.kind === "thin"
    ? withAlpha(colors.fg, isHovered ? 0.18 : 0.045)
    : withAlpha(colors.fg, isHovered ? 0.24 : 0.09);
  context.strokeStyle = withAlpha(colors.fg, isHovered ? 0.78 : 0.28);
  context.lineWidth = isHovered ? 1.35 : 0.8;
  context.fill();
  context.stroke();
}

function drawMatchingMarks(context: CanvasRenderingContext2D, triangle: ScreenTriangle, colors: Colors, isHovered: boolean) {
  const center = centroid(triangle.screenA, triangle.screenB, triangle.screenC);
  const pairs: Array<[Point, Point, number]> = [
    [triangle.screenA, triangle.screenB, 0.45],
    [triangle.screenB, triangle.screenC, 0.58],
    [triangle.screenC, triangle.screenA, 0.72],
  ];
  context.strokeStyle = withAlpha(colors.fg, isHovered ? 0.85 : 0.36);
  context.lineWidth = isHovered ? 1.4 : 1;

  pairs.forEach(([from, to, t], index) => {
    const mark = lerpPoint(from, to, t);
    context.beginPath();
    context.arc(center.x, center.y, Math.hypot(mark.x - center.x, mark.y - center.y), angleTo(center, from), angleTo(center, mark));
    if ((triangle.kind === "thin" && index === 1) || (triangle.kind === "thick" && index === 2)) context.setLineDash([4, 5]);
    else context.setLineDash([]);
    context.stroke();
  });
  context.setLineDash([]);
}

function drawCompass(context: CanvasRenderingContext2D, width: number, height: number, colors: Colors) {
  const center = { x: width / 2, y: height / 2 };
  const radius = Math.min(width, height) * 0.43;
  context.strokeStyle = withAlpha(colors.fg, 0.07);
  context.lineWidth = 1;
  for (let i = 0; i < 10; i++) {
    const end = pointFromAngle((i / 10) * TAU - Math.PI / 2, radius);
    context.beginPath();
    context.moveTo(center.x, center.y);
    context.lineTo(center.x + end.x, center.y + end.y);
    context.stroke();
  }
}

function findHovered(triangles: ScreenTriangle[], point: Point): number | null {
  for (let i = triangles.length - 1; i >= 0; i--) {
    const triangle = triangles[i];
    if (pointInTriangle(point, triangle.screenA, triangle.screenB, triangle.screenC)) return i;
  }
  return null;
}

function pointInTriangle(point: Point, a: Point, b: Point, c: Point): boolean {
  const d1 = sign(point, a, b);
  const d2 = sign(point, b, c);
  const d3 = sign(point, c, a);
  const hasNegative = d1 < 0 || d2 < 0 || d3 < 0;
  const hasPositive = d1 > 0 || d2 > 0 || d3 > 0;
  return !(hasNegative && hasPositive);
}

function sign(p1: Point, p2: Point, p3: Point): number {
  return (p1.x - p3.x) * (p2.y - p3.y) - (p2.x - p3.x) * (p1.y - p3.y);
}

function centroid(a: Point, b: Point, c: Point): Point {
  return {
    x: (a.x + b.x + c.x) / 3,
    y: (a.y + b.y + c.y) / 3,
  };
}

function angleTo(from: Point, to: Point): number {
  return Math.atan2(to.y - from.y, to.x - from.x);
}

function area(a: Point, b: Point, c: Point): number {
  return Math.abs((a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y)) / 2);
}

function readPreset(value: string): Preset {
  return value === "sun" || value === "decagon" ? value : "star";
}

function readInt(value: string, min: number, max: number, fallback: number): number {
  const number = Number.parseInt(value, 10);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, number));
}

function format(value: number): string {
  if (value >= 1000) return value.toFixed(0);
  if (value >= 100) return value.toFixed(1);
  return value.toFixed(2);
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
