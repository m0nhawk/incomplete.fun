export {};

interface Point {
  x: number;
  y: number;
}

interface Elements {
  canvas: HTMLCanvasElement;
  pInput: HTMLInputElement;
  qInput: HTMLInputElement;
  ringsInput: HTMLInputElement;
  ringValue: HTMLElement;
  geodesicsInput: HTMLInputElement;
  resetButton: HTMLButtonElement;
  symbol: HTMLElement;
  hover: HTMLElement;
}

interface State {
  p: number;
  q: number;
  rings: number;
  showGeodesics: boolean;
  pointer: Point | null;
  hover: TileAddress | null;
}

interface TileAddress {
  ring: number;
  index: number;
  count: number;
  innerRadius: number;
  outerRadius: number;
  startAngle: number;
  endAngle: number;
}

const TAU = Math.PI * 2;
const INITIAL = { p: 5, q: 4, rings: 6 };

const elements = getElements();
if (elements) init(elements);

function getElements(): Elements | null {
  const canvas = document.querySelector<HTMLCanvasElement>("#hyperbolic-canvas");
  const pInput = document.querySelector<HTMLInputElement>("#hyperbolic-p");
  const qInput = document.querySelector<HTMLInputElement>("#hyperbolic-q");
  const ringsInput = document.querySelector<HTMLInputElement>("#hyperbolic-rings");
  const ringValue = document.querySelector<HTMLElement>("#hyperbolic-ring-value");
  const geodesicsInput = document.querySelector<HTMLInputElement>("#hyperbolic-geodesics");
  const resetButton = document.querySelector<HTMLButtonElement>("#hyperbolic-reset");
  const symbol = document.querySelector<HTMLElement>("#hyperbolic-symbol");
  const hover = document.querySelector<HTMLElement>("#hyperbolic-hover");

  if (!canvas || !pInput || !qInput || !ringsInput || !ringValue || !geodesicsInput || !resetButton || !symbol || !hover) {
    return null;
  }

  return { canvas, pInput, qInput, ringsInput, ringValue, geodesicsInput, resetButton, symbol, hover };
}

function init(elements: Elements) {
  const context = elements.canvas.getContext("2d");
  if (!context) return;

  const state: State = {
    p: readInt(elements.pInput, 3, 9, INITIAL.p),
    q: readInt(elements.qInput, 3, 12, INITIAL.q),
    rings: readInt(elements.ringsInput, 1, 9, INITIAL.rings),
    showGeodesics: elements.geodesicsInput.checked,
    pointer: null,
    hover: null,
  };

  const render = () => {
    syncControls(elements, state);
    draw(elements.canvas, context, state, elements);
  };

  bindControls(elements, state, render);
  bindPointer(elements.canvas, state, render);
  observeResize(elements.canvas, render);
  render();
}

function bindControls(elements: Elements, state: State, render: () => void) {
  const handleInput = () => {
    state.p = readInt(elements.pInput, 3, 9, INITIAL.p);
    state.q = readInt(elements.qInput, 3, 12, INITIAL.q);
    state.rings = readInt(elements.ringsInput, 1, 9, INITIAL.rings);
    state.showGeodesics = elements.geodesicsInput.checked;
    render();
  };

  [elements.pInput, elements.qInput, elements.ringsInput].forEach((input) => {
    input.addEventListener("input", handleInput);
  });
  elements.geodesicsInput.addEventListener("change", handleInput);
  elements.resetButton.addEventListener("click", () => {
    state.p = INITIAL.p;
    state.q = INITIAL.q;
    state.rings = INITIAL.rings;
    state.showGeodesics = true;
    elements.pInput.value = String(INITIAL.p);
    elements.qInput.value = String(INITIAL.q);
    elements.ringsInput.value = String(INITIAL.rings);
    elements.geodesicsInput.checked = true;
    render();
  });
}

function bindPointer(canvas: HTMLCanvasElement, state: State, render: () => void) {
  canvas.addEventListener("pointermove", (event) => {
    const rect = canvas.getBoundingClientRect();
    state.pointer = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
    render();
  });

  canvas.addEventListener("pointerleave", () => {
    state.pointer = null;
    state.hover = null;
    render();
  });
}

function observeResize(canvas: HTMLCanvasElement, render: () => void) {
  if (!canvas.parentElement) return;
  new ResizeObserver(render).observe(canvas.parentElement);
}

function syncControls(elements: Elements, state: State) {
  elements.pInput.value = String(state.p);
  elements.qInput.value = String(state.q);
  elements.ringsInput.value = String(state.rings);
  elements.ringValue.textContent = String(state.rings);
  elements.geodesicsInput.checked = state.showGeodesics;

  const curvature = hyperbolicCondition(state.p, state.q);
  elements.symbol.textContent = `{${state.p},${state.q}} ${curvature}`;
}

function draw(canvas: HTMLCanvasElement, context: CanvasRenderingContext2D, state: State, elements: Elements) {
  const parent = canvas.parentElement;
  if (!parent) return;

  const dpr = window.devicePixelRatio || 1;
  const width = parent.clientWidth;
  const height = parent.clientHeight;
  canvas.width = Math.max(1, Math.floor(width * dpr));
  canvas.height = Math.max(1, Math.floor(height * dpr));
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  context.setTransform(dpr, 0, 0, dpr, 0, 0);

  const colors = readColors();
  const center = { x: width / 2, y: height / 2 };
  const radius = Math.max(24, Math.min(width, height) * 0.44);

  context.clearRect(0, 0, width, height);
  context.fillStyle = colors.bg;
  context.fillRect(0, 0, width, height);
  drawBackground(context, center, radius, colors);

  state.hover = state.pointer ? findTile(state.pointer, center, radius, state) : null;

  drawTiles(context, center, radius, state, colors);
  drawBoundary(context, center, radius, state, colors);
  if (state.showGeodesics) drawGeodesics(context, center, radius, state, colors);
  drawCenterLabel(context, center, state, colors);
  updateHover(elements, state);
}

function drawBackground(context: CanvasRenderingContext2D, center: Point, radius: number, colors: Colors) {
  context.save();
  context.beginPath();
  context.arc(center.x, center.y, radius, 0, TAU);
  context.clip();

  const gradient = context.createRadialGradient(center.x, center.y, radius * 0.08, center.x, center.y, radius);
  gradient.addColorStop(0, withAlpha(colors.fg, 0.055));
  gradient.addColorStop(0.68, withAlpha(colors.fg, 0.02));
  gradient.addColorStop(1, withAlpha(colors.fg, 0.075));
  context.fillStyle = gradient;
  context.fillRect(center.x - radius, center.y - radius, radius * 2, radius * 2);
  context.restore();
}

function drawTiles(context: CanvasRenderingContext2D, center: Point, radius: number, state: State, colors: Colors) {
  for (let ring = state.rings; ring >= 1; ring--) {
    const count = tileCountForRing(ring, state);
    const innerRadius = ringRadius(ring - 1, state.rings, state.p, state.q);
    const outerRadius = ringRadius(ring, state.rings, state.p, state.q);
    const offset = (ring % 2) * Math.PI / count;

    for (let index = 0; index < count; index++) {
      const startAngle = offset + (index / count) * TAU;
      const endAngle = offset + ((index + 1) / count) * TAU;
      const isHovered = sameTile(state.hover, { ring, index });
      drawTile(context, center, radius, { ring, index, count, innerRadius, outerRadius, startAngle, endAngle }, isHovered, colors);
    }
  }

  drawCentralPolygon(context, center, radius, state, colors, state.hover?.ring === 0);
}

function drawTile(
  context: CanvasRenderingContext2D,
  center: Point,
  radius: number,
  tile: TileAddress,
  isHovered: boolean,
  colors: Colors,
) {
  const outer = tile.outerRadius * radius;
  const inner = tile.innerRadius * radius;
  const mid = (tile.startAngle + tile.endAngle) / 2;
  const pinch = Math.min(0.32, 0.12 + tile.ring * 0.018);
  const start = tile.startAngle + pinch / tile.count;
  const end = tile.endAngle - pinch / tile.count;

  context.beginPath();
  arc(context, center, outer, start, end, false);
  quadraticToPolar(context, center, inner, end, mid);
  arc(context, center, inner, end, start, true);
  quadraticToPolar(context, center, outer, start, mid);
  context.closePath();

  context.fillStyle = isHovered ? withAlpha(colors.fg, 0.16) : withAlpha(colors.fg, tile.ring % 2 === 0 ? 0.028 : 0.045);
  context.strokeStyle = withAlpha(colors.fg, isHovered ? 0.72 : 0.22);
  context.lineWidth = isHovered ? 1.5 : 1;
  context.fill();
  context.stroke();
}

function drawCentralPolygon(
  context: CanvasRenderingContext2D,
  center: Point,
  radius: number,
  state: State,
  colors: Colors,
  isHovered: boolean,
) {
  const r = ringRadius(0, state.rings, state.p, state.q) * radius;
  context.beginPath();
  for (let i = 0; i < state.p; i++) {
    const angle = -Math.PI / 2 + (i / state.p) * TAU;
    const point = polar(center, r, angle);
    if (i === 0) context.moveTo(point.x, point.y);
    else context.lineTo(point.x, point.y);
  }
  context.closePath();
  context.fillStyle = isHovered ? withAlpha(colors.fg, 0.18) : withAlpha(colors.fg, 0.07);
  context.strokeStyle = withAlpha(colors.fg, isHovered ? 0.78 : 0.36);
  context.lineWidth = isHovered ? 1.7 : 1.2;
  context.fill();
  context.stroke();
}

function drawBoundary(context: CanvasRenderingContext2D, center: Point, radius: number, state: State, colors: Colors) {
  context.strokeStyle = colors.fg;
  context.lineWidth = 1.25;
  context.beginPath();
  context.arc(center.x, center.y, radius, 0, TAU);
  context.stroke();

  context.strokeStyle = withAlpha(colors.fg, 0.16);
  context.lineWidth = 1;
  for (let ring = 1; ring < state.rings; ring++) {
    context.beginPath();
    context.arc(center.x, center.y, ringRadius(ring, state.rings, state.p, state.q) * radius, 0, TAU);
    context.stroke();
  }
}

function drawGeodesics(context: CanvasRenderingContext2D, center: Point, radius: number, state: State, colors: Colors) {
  if (!state.hover) {
    const spokes = state.p * state.q;
    context.strokeStyle = withAlpha(colors.fg, 0.1);
    context.lineWidth = 1;
    for (let i = 0; i < spokes; i++) {
      const angle = (i / spokes) * TAU;
      const start = polar(center, radius * 0.08, angle);
      const end = polar(center, radius * 0.98, angle);
      context.beginPath();
      context.moveTo(start.x, start.y);
      context.lineTo(end.x, end.y);
      context.stroke();
    }
    return;
  }

  const tile = state.hover;
  const angle = (tile.startAngle + tile.endAngle) / 2;
  const endRadius = ((tile.innerRadius + tile.outerRadius) / 2) * radius;
  const end = polar(center, endRadius, angle);
  const boundary = polar(center, radius * 0.99, angle);

  context.strokeStyle = colors.fg;
  context.lineWidth = 2;
  context.setLineDash([7, 5]);
  context.beginPath();
  context.moveTo(center.x, center.y);
  context.lineTo(boundary.x, boundary.y);
  context.stroke();
  context.setLineDash([]);

  context.fillStyle = colors.fg;
  context.beginPath();
  context.arc(end.x, end.y, 4, 0, TAU);
  context.fill();
}

function drawCenterLabel(context: CanvasRenderingContext2D, center: Point, state: State, colors: Colors) {
  context.fillStyle = withAlpha(colors.fg, 0.58);
  context.font = "12px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
  context.textAlign = "center";
  context.fillText(`{${state.p},${state.q}}`, center.x, center.y + 4);
}

function updateHover(elements: Elements, state: State) {
  if (!state.pointer) {
    elements.hover.textContent = "hover the disk";
    return;
  }
  if (!state.hover) {
    elements.hover.textContent = "outside boundary";
    return;
  }
  if (state.hover.ring === 0) {
    elements.hover.textContent = "central tile · p-sided seed";
    return;
  }
  elements.hover.textContent = `ring ${state.hover.ring}/${state.rings} · tile ${state.hover.index + 1}/${state.hover.count}`;
}

function findTile(point: Point, center: Point, radius: number, state: State): TileAddress | null {
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  const r = Math.hypot(dx, dy) / radius;
  if (r > 1) return null;

  const centerRadius = ringRadius(0, state.rings, state.p, state.q);
  if (r <= centerRadius) {
    return {
      ring: 0,
      index: 0,
      count: 1,
      innerRadius: 0,
      outerRadius: centerRadius,
      startAngle: 0,
      endAngle: TAU,
    };
  }

  for (let ring = 1; ring <= state.rings; ring++) {
    const innerRadius = ringRadius(ring - 1, state.rings, state.p, state.q);
    const outerRadius = ringRadius(ring, state.rings, state.p, state.q);
    if (r <= outerRadius) {
      const count = tileCountForRing(ring, state);
      const offset = (ring % 2) * Math.PI / count;
      const angle = normalizeAngle(Math.atan2(dy, dx) - offset);
      const index = Math.min(count - 1, Math.floor((angle / TAU) * count));
      return {
        ring,
        index,
        count,
        innerRadius,
        outerRadius,
        startAngle: offset + (index / count) * TAU,
        endAngle: offset + ((index + 1) / count) * TAU,
      };
    }
  }

  return null;
}

function tileCountForRing(ring: number, state: State): number {
  return Math.max(state.p, state.p * Math.max(1, state.q - 2) * ring);
}

function ringRadius(ring: number, rings: number, p: number, q: number): number {
  if (ring <= 0) return 0.16;
  const step = hyperbolicStep(p, q);
  const raw = Math.tanh((ring + 0.7) * step * 0.5);
  const max = Math.tanh((rings + 0.9) * step * 0.5);
  return Math.min(0.975, (raw / max) * 0.96);
}

function hyperbolicStep(p: number, q: number): number {
  const value = Math.cos(Math.PI / q) / Math.sin(Math.PI / p);
  if (value > 1) return Math.max(0.42, Math.acosh(value));
  return 0.42 + Math.max(0, (p - 3) * 0.04 + (q - 3) * 0.025);
}

function hyperbolicCondition(p: number, q: number): string {
  const curvature = (p - 2) * (q - 2);
  if (curvature > 4) return "hyperbolic";
  if (curvature === 4) return "euclidean limit";
  return "spherical limit";
}

function arc(context: CanvasRenderingContext2D, center: Point, radius: number, start: number, end: number, anticlockwise: boolean) {
  context.arc(center.x, center.y, radius, start, end, anticlockwise);
}

function quadraticToPolar(context: CanvasRenderingContext2D, center: Point, radius: number, angle: number, bendAngle: number) {
  const control = polar(center, radius * 1.03, bendAngle);
  const end = polar(center, radius, angle);
  context.quadraticCurveTo(control.x, control.y, end.x, end.y);
}

function polar(center: Point, radius: number, angle: number): Point {
  return {
    x: center.x + Math.cos(angle) * radius,
    y: center.y + Math.sin(angle) * radius,
  };
}

function sameTile(a: TileAddress | null, b: { ring: number; index: number }) {
  return Boolean(a && a.ring === b.ring && a.index === b.index);
}

function normalizeAngle(angle: number): number {
  return ((angle % TAU) + TAU) % TAU;
}

function readInt(input: HTMLInputElement, min: number, max: number, fallback: number): number {
  const value = Number.parseInt(input.value, 10);
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, value));
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
