import { clampInt } from "./lib/math";
import { q } from "./lib/dom";

interface Point {
  x: number;
  y: number;
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

const canvas = q<HTMLCanvasElement>("#symmetry-canvas");
const segmentsInput = q<HTMLInputElement>("#symmetry-segments");
const mirrorInput = q<HTMLInputElement>("#symmetry-mirror");
const colorInput = q<HTMLInputElement>("#symmetry-color");
const widthInput = q<HTMLInputElement>("#symmetry-width");
const widthValue = q<HTMLElement>("#symmetry-width-value");
const clearButton = q<HTMLButtonElement>("#symmetry-clear");

if (canvas && segmentsInput && mirrorInput && colorInput && widthInput && widthValue && clearButton) {
  const ctx = canvas.getContext("2d")!;
  const state = createState();

  syncControls();
  resizeCanvas();
  observeParent();
  bindControls();
  bindDrawing();

  function createState(): SymmetryState {
    const stored = localStorage.getItem(SEGMENT_STORAGE_KEY) ?? segmentsInput.value;
    return {
      drawing: false,
      points: [],
      snapshot: null,
      segments: clampInt(stored, 1, 36, 6),
      mirror: mirrorInput.checked,
      color: colorInput.value,
      lineWidth: clampInt(widthInput.value, 1, 20, 2),
    };
  }

  function syncControls() {
    segmentsInput.value = String(state.segments);
    widthInput.value = String(state.lineWidth);
    widthValue.textContent = String(state.lineWidth);
  }

  function resizeCanvas() {
    const parent = canvas.parentElement;
    if (!parent) return;

    const dpr = window.devicePixelRatio || 1;
    const imageData = hasSize() ? ctx.getImageData(0, 0, canvas.width, canvas.height) : null;

    canvas.width = parent.clientWidth * dpr;
    canvas.height = parent.clientHeight * dpr;
    canvas.style.width = `${parent.clientWidth}px`;
    canvas.style.height = `${parent.clientHeight}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    if (imageData) ctx.putImageData(imageData, 0, 0);
  }

  function hasSize() {
    return canvas.width > 0 && canvas.height > 0;
  }

  function observeParent() {
    if (!canvas.parentElement) return;
    new ResizeObserver(resizeCanvas).observe(canvas.parentElement);
  }

  function getCenter(): Point {
    return { x: canvas.clientWidth / 2, y: canvas.clientHeight / 2 };
  }

  function drawStroke(points: Point[]) {
    if (points.length < 2) return;
    const center = getCenter();
    const angle = (Math.PI * 2) / state.segments;

    ctx.strokeStyle = state.color;
    ctx.lineWidth = state.lineWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    for (let segment = 0; segment < state.segments; segment++) {
      ctx.save();
      ctx.translate(center.x, center.y);
      ctx.rotate(angle * segment);
      drawPath(points, center, false);
      if (state.mirror) drawPath(points, center, true);
      ctx.restore();
    }
  }

  function drawPath(points: Point[], center: Point, flip: boolean) {
    const first = toCentered(points[0], center, flip);
    ctx.beginPath();
    ctx.moveTo(first.x, first.y);

    for (let i = 0; i < points.length - 1; i++) {
      const current = toCentered(points[i], center, flip);
      const next = toCentered(points[i + 1], center, flip);
      const mid = { x: (current.x + next.x) / 2, y: (current.y + next.y) / 2 };
      ctx.quadraticCurveTo(current.x, current.y, mid.x, mid.y);
    }

    const last = toCentered(points[points.length - 1], center, flip);
    ctx.lineTo(last.x, last.y);
    ctx.stroke();
  }

  function toCentered(point: Point, center: Point, flip: boolean): Point {
    return {
      x: point.x - center.x,
      y: flip ? -(point.y - center.y) : point.y - center.y,
    };
  }

  function bindControls() {
    segmentsInput.addEventListener("input", () => {
      state.segments = clampInt(segmentsInput.value, 1, 36, 1);
      segmentsInput.value = String(state.segments);
      localStorage.setItem(SEGMENT_STORAGE_KEY, String(state.segments));
    });

    mirrorInput.addEventListener("change", () => {
      state.mirror = mirrorInput.checked;
    });

    colorInput.addEventListener("input", () => {
      state.color = colorInput.value;
    });

    widthInput.addEventListener("input", () => {
      state.lineWidth = clampInt(widthInput.value, 1, 20, 2);
      widthValue.textContent = String(state.lineWidth);
    });

    clearButton.addEventListener("click", () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    });
  }

  function bindDrawing() {
    canvas.addEventListener("pointerdown", (event) => {
      state.drawing = true;
      state.points = [getPointerPoint(event)];
      state.snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
      canvas.setPointerCapture(event.pointerId);
    });

    canvas.addEventListener("pointermove", (event) => {
      if (!state.drawing || !state.snapshot) return;
      state.points.push(getPointerPoint(event));
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

  function getPointerPoint(event: PointerEvent): Point {
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }
}
