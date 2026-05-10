export {};

interface Point {
  x: number;
  y: number;
}

interface Elements {
  canvas: HTMLCanvasElement;
  segmentsInput: HTMLInputElement;
  mirrorInput: HTMLInputElement;
  colorInput: HTMLInputElement;
  widthInput: HTMLInputElement;
  widthValue: HTMLElement;
  clearButton: HTMLButtonElement;
}

interface SymmetryState {
  drawing: boolean;
  points: Point[];
  snapshot: ImageData | null;
  segments: number;
  mirror: boolean;
  color: string;
  lineWidth: number;
}

const SEGMENT_STORAGE_KEY = "symmetry-n";
const INITIAL_SEGMENT_RANGE = { min: 1, max: 36, fallback: 6 };
const SEGMENT_INPUT_RANGE = { min: 1, max: 36, fallback: 1 };
const WIDTH_RANGE = { min: 1, max: 20, fallback: 2 };

const elements = getElements();
if (elements) initSymmetry(elements);

function getElements(): Elements | null {
  const canvas = document.querySelector<HTMLCanvasElement>("#symmetry-canvas");
  const segmentsInput = document.querySelector<HTMLInputElement>("#symmetry-segments");
  const mirrorInput = document.querySelector<HTMLInputElement>("#symmetry-mirror");
  const colorInput = document.querySelector<HTMLInputElement>("#symmetry-color");
  const widthInput = document.querySelector<HTMLInputElement>("#symmetry-width");
  const widthValue = document.querySelector<HTMLElement>("#symmetry-width-value");
  const clearButton = document.querySelector<HTMLButtonElement>("#symmetry-clear");

  if (!canvas || !segmentsInput || !mirrorInput || !colorInput || !widthInput || !widthValue || !clearButton) {
    return null;
  }

  return {
    canvas,
    segmentsInput,
    mirrorInput,
    colorInput,
    widthInput,
    widthValue,
    clearButton,
  };
}

function initSymmetry(elements: Elements) {
  const ctx = elements.canvas.getContext("2d");
  if (!ctx) return;

  const state = createInitialState(elements);
  syncControls(elements, state);

  const resizeCanvas = createCanvasResizer(elements.canvas, ctx);
  const drawStroke = createStrokeRenderer(elements.canvas, ctx, state);

  resizeCanvas();
  observeCanvasParent(elements.canvas, resizeCanvas);
  bindControls(elements, ctx, state);
  bindDrawing(elements.canvas, ctx, state, drawStroke);
}

function createInitialState(elements: Elements): SymmetryState {
  const storedSegments = localStorage.getItem(SEGMENT_STORAGE_KEY) ?? elements.segmentsInput.value;

  return {
    drawing: false,
    points: [],
    snapshot: null,
    segments: clampInt(storedSegments, INITIAL_SEGMENT_RANGE),
    mirror: elements.mirrorInput.checked,
    color: elements.colorInput.value,
    lineWidth: clampInt(elements.widthInput.value, WIDTH_RANGE),
  };
}

function syncControls(elements: Elements, state: SymmetryState) {
  elements.segmentsInput.value = String(state.segments);
  elements.widthInput.value = String(state.lineWidth);
  elements.widthValue.textContent = String(state.lineWidth);
}

function createCanvasResizer(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) {
  return () => {
    const parent = canvas.parentElement;
    if (!parent) return;

    const dpr = window.devicePixelRatio || 1;
    const imageData = hasCanvasSize(canvas)
      ? ctx.getImageData(0, 0, canvas.width, canvas.height)
      : null;

    canvas.width = parent.clientWidth * dpr;
    canvas.height = parent.clientHeight * dpr;
    canvas.style.width = `${parent.clientWidth}px`;
    canvas.style.height = `${parent.clientHeight}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    if (imageData) {
      ctx.putImageData(imageData, 0, 0);
    }
  };
}

function hasCanvasSize(canvas: HTMLCanvasElement) {
  return canvas.width > 0 && canvas.height > 0;
}

function observeCanvasParent(canvas: HTMLCanvasElement, resizeCanvas: () => void) {
  if (!canvas.parentElement) return;

  const observer = new ResizeObserver(resizeCanvas);
  observer.observe(canvas.parentElement);
}

function createStrokeRenderer(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  state: SymmetryState,
) {
  return (points: Point[]) => {
    if (points.length < 2) return;

    const center = getCanvasCenter(canvas);
    const angle = (Math.PI * 2) / state.segments;

    ctx.strokeStyle = state.color;
    ctx.lineWidth = state.lineWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    for (let segment = 0; segment < state.segments; segment++) {
      ctx.save();
      ctx.translate(center.x, center.y);
      ctx.rotate(angle * segment);
      drawPath(ctx, points, center, false);
      if (state.mirror) drawPath(ctx, points, center, true);
      ctx.restore();
    }
  };
}

function getCanvasCenter(canvas: HTMLCanvasElement): Point {
  return {
    x: canvas.clientWidth / 2,
    y: canvas.clientHeight / 2,
  };
}

function drawPath(
  ctx: CanvasRenderingContext2D,
  points: Point[],
  center: Point,
  flip: boolean,
) {
  const first = toCenteredPoint(points[0], center, flip);

  ctx.beginPath();
  ctx.moveTo(first.x, first.y);

  for (let i = 0; i < points.length - 1; i++) {
    const current = toCenteredPoint(points[i], center, flip);
    const next = toCenteredPoint(points[i + 1], center, flip);
    const mid = midpoint(current, next);

    ctx.quadraticCurveTo(current.x, current.y, mid.x, mid.y);
  }

  const last = toCenteredPoint(points[points.length - 1], center, flip);
  ctx.lineTo(last.x, last.y);
  ctx.stroke();
}

function toCenteredPoint(point: Point, center: Point, flip: boolean): Point {
  return {
    x: point.x - center.x,
    y: flip ? -(point.y - center.y) : point.y - center.y,
  };
}

function midpoint(a: Point, b: Point): Point {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
  };
}

function bindControls(
  elements: Elements,
  ctx: CanvasRenderingContext2D,
  state: SymmetryState,
) {
  elements.segmentsInput.addEventListener("input", () => {
    state.segments = clampInt(elements.segmentsInput.value, SEGMENT_INPUT_RANGE);
    elements.segmentsInput.value = String(state.segments);
    localStorage.setItem(SEGMENT_STORAGE_KEY, String(state.segments));
  });

  elements.mirrorInput.addEventListener("change", () => {
    state.mirror = elements.mirrorInput.checked;
  });

  elements.colorInput.addEventListener("input", () => {
    state.color = elements.colorInput.value;
  });

  elements.widthInput.addEventListener("input", () => {
    state.lineWidth = clampInt(elements.widthInput.value, WIDTH_RANGE);
    elements.widthValue.textContent = String(state.lineWidth);
  });

  elements.clearButton.addEventListener("click", () => {
    ctx.clearRect(0, 0, elements.canvas.width, elements.canvas.height);
  });
}

function bindDrawing(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  state: SymmetryState,
  drawStroke: (points: Point[]) => void,
) {
  canvas.addEventListener("pointerdown", (event) => {
    state.drawing = true;
    state.points = [getPointerPoint(canvas, event)];
    state.snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
    canvas.setPointerCapture(event.pointerId);
  });

  canvas.addEventListener("pointermove", (event) => {
    if (!state.drawing || !state.snapshot) return;

    state.points.push(getPointerPoint(canvas, event));
    ctx.putImageData(state.snapshot, 0, 0);
    drawStroke(state.points);
  });

  const endDrawing = (event: PointerEvent) => {
    state.drawing = false;
    state.points = [];
    state.snapshot = null;

    if (canvas.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }
  };

  canvas.addEventListener("pointerup", endDrawing);
  canvas.addEventListener("pointercancel", endDrawing);
}

function getPointerPoint(canvas: HTMLCanvasElement, event: PointerEvent): Point {
  const rect = canvas.getBoundingClientRect();

  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };
}

function clampInt(value: string, range: { min: number; max: number; fallback: number }) {
  const parsed = parseInt(value, 10);
  if (Number.isNaN(parsed)) return range.fallback;
  return Math.max(range.min, Math.min(range.max, parsed));
}
