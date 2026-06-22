export {};

interface Elements {
  functionSelect: HTMLSelectElement;
  contoursInput: HTMLInputElement;
  flowsInput: HTMLInputElement;
  criticalInput: HTMLInputElement;
  summary: HTMLElement;
  plot: SVGSVGElement;
}
interface Point { x: number; y: number }
interface Sample { value: number; grad: Point }
type FunctionKind = "peaks" | "monkey" | "ripples" | "basins";

const GRID = 72;
const elements = getElements();
if (elements) init(elements);

function getElements(): Elements | null {
  const functionSelect = document.querySelector<HTMLSelectElement>("#morse-function");
  const contoursInput = document.querySelector<HTMLInputElement>("#morse-contours");
  const flowsInput = document.querySelector<HTMLInputElement>("#morse-flows");
  const criticalInput = document.querySelector<HTMLInputElement>("#morse-critical");
  const summary = document.querySelector<HTMLElement>("#morse-summary");
  const plot = document.querySelector<SVGSVGElement>("#morse-plot");
  if (!functionSelect || !contoursInput || !flowsInput || !criticalInput || !summary || !plot) return null;
  return { functionSelect, contoursInput, flowsInput, criticalInput, summary, plot };
}

function init(elements: Elements) {
  const render = () => renderMorse(elements);
  [elements.functionSelect, elements.contoursInput, elements.flowsInput, elements.criticalInput].forEach((input) => {
    input.addEventListener("input", render);
    input.addEventListener("change", render);
  });
  render();
}

function renderMorse(elements: Elements) {
  const kind = readKind(elements.functionSelect.value);
  const contours = readInt(elements.contoursInput.value, 5, 28, 16);
  const flows = readInt(elements.flowsInput.value, 0, 60, 28);
  elements.contoursInput.value = String(contours);
  elements.flowsInput.value = String(flows);

  const samples = sampleField(kind);
  const values = samples.map((sample) => sample.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const levels = Array.from({ length: contours }, (_unused, i) => min + ((i + 1) / (contours + 1)) * (max - min));
  const paths = levels.flatMap((level) => contourPaths(samples, level));
  const critical = findCritical(samples);
  draw(elements.plot, kind, paths, flowPaths(kind, flows), elements.criticalInput.checked ? critical : [], min, max);
  elements.summary.textContent = `${kind} · ${contours} contours · ${flows} flow lines · ${critical.length} critical candidates`;
}

function sampleField(kind: FunctionKind): Sample[] {
  return Array.from({ length: GRID * GRID }, (_unused, index) => {
    const x = -2 + (4 * (index % GRID)) / (GRID - 1);
    const y = -2 + (4 * Math.floor(index / GRID)) / (GRID - 1);
    return evaluate(kind, x, y);
  });
}

function evaluate(kind: FunctionKind, x: number, y: number): Sample {
  const value = height(kind, x, y);
  const h = 0.002;
  return {
    value,
    grad: { x: (height(kind, x + h, y) - height(kind, x - h, y)) / (2 * h), y: (height(kind, x, y + h) - height(kind, x, y - h)) / (2 * h) },
  };
}

function height(kind: FunctionKind, x: number, y: number): number {
  if (kind === "monkey") return x * x * x - 3 * x * y * y + 0.18 * (x * x + y * y);
  if (kind === "ripples") return Math.sin(4 * x) * Math.cos(3 * y) / (1 + 0.22 * (x * x + y * y));
  if (kind === "basins") return -Math.exp(-((x + 0.9) ** 2 + (y + 0.6) ** 2) * 2) - 0.8 * Math.exp(-((x - 0.9) ** 2 + (y - 0.5) ** 2) * 3) + 0.2 * (x * x + y * y);
  return 3 * (1 - x) ** 2 * Math.exp(-x * x - (y + 1) ** 2) - 10 * (x / 5 - x ** 3 - y ** 5) * Math.exp(-x * x - y * y) - (1 / 3) * Math.exp(-((x + 1) ** 2) - y * y);
}

function contourPaths(samples: Sample[], level: number): string[] {
  const paths: string[] = [];
  for (let y = 0; y < GRID - 1; y++) {
    for (let x = 0; x < GRID - 1; x++) {
      const corners = [sampleAt(samples, x, y), sampleAt(samples, x + 1, y), sampleAt(samples, x + 1, y + 1), sampleAt(samples, x, y + 1)];
      const positions = [screenPoint(x, y), screenPoint(x + 1, y), screenPoint(x + 1, y + 1), screenPoint(x, y + 1)];
      const hits: Point[] = [];
      for (let edge = 0; edge < 4; edge++) {
        const next = (edge + 1) % 4;
        const a = corners[edge].value;
        const b = corners[next].value;
        if ((level >= a && level <= b) || (level >= b && level <= a)) {
          if (Math.abs(a - b) < 1e-9) continue;
          hits.push(lerp(positions[edge], positions[next], (level - a) / (b - a)));
        }
      }
      if (hits.length >= 2) paths.push(`M${format(hits[0].x)} ${format(hits[0].y)} L${format(hits[1].x)} ${format(hits[1].y)}`);
      if (hits.length === 4) paths.push(`M${format(hits[2].x)} ${format(hits[2].y)} L${format(hits[3].x)} ${format(hits[3].y)}`);
    }
  }
  return paths;
}

function flowPaths(kind: FunctionKind, count: number): string[] {
  const starts = Array.from({ length: count }, (_unused, i) => {
    const angle = (i / Math.max(1, count)) * Math.PI * 2;
    const ring = 0.45 + 1.35 * ((i * 37) % 17) / 16;
    return { x: Math.cos(angle) * ring, y: Math.sin(angle) * ring };
  });
  return starts.map((start) => traceFlow(kind, start));
}

function traceFlow(kind: FunctionKind, start: Point): string {
  let point = { ...start };
  const parts = [`M${format(toSvg(point.x))} ${format(toSvg(point.y))}`];
  for (let step = 0; step < 90; step++) {
    const gradient = evaluate(kind, point.x, point.y).grad;
    const length = Math.hypot(gradient.x, gradient.y);
    if (length < 0.015) break;
    point = { x: clamp(point.x + (gradient.x / length) * 0.045, -2, 2), y: clamp(point.y + (gradient.y / length) * 0.045, -2, 2) };
    parts.push(`L${format(toSvg(point.x))} ${format(toSvg(point.y))}`);
  }
  return parts.join(" ");
}

function findCritical(samples: Sample[]): Array<{ point: Point; kind: "min" | "max" | "saddle" }> {
  const candidates: Array<{ point: Point; kind: "min" | "max" | "saddle"; strength: number }> = [];
  for (let y = 2; y < GRID - 2; y++) {
    for (let x = 2; x < GRID - 2; x++) {
      const sample = sampleAt(samples, x, y);
      const strength = Math.hypot(sample.grad.x, sample.grad.y);
      if (strength > 0.08) continue;
      const v = sample.value;
      const neighbors = [sampleAt(samples, x - 1, y).value, sampleAt(samples, x + 1, y).value, sampleAt(samples, x, y - 1).value, sampleAt(samples, x, y + 1).value];
      const kind = neighbors.every((n) => n > v) ? "min" : neighbors.every((n) => n < v) ? "max" : "saddle";
      candidates.push({ point: screenPoint(x, y), kind, strength });
    }
  }
  return candidates.sort((a, b) => a.strength - b.strength).slice(0, 18).map(({ point, kind }) => ({ point, kind }));
}

function draw(plot: SVGSVGElement, kind: FunctionKind, contours: string[], flows: string[], critical: Array<{ point: Point; kind: "min" | "max" | "saddle" }>, min: number, max: number) {
  plot.setAttribute("viewBox", "0 0 900 620");
  plot.innerHTML = `
    ${svg("line", { class: "morse-axis", x1: 450, y1: 30, x2: 450, y2: 590 })}
    ${svg("line", { class: "morse-axis", x1: 170, y1: 310, x2: 730, y2: 310 })}
    ${contours.map((d, i) => svg("path", { class: "morse-contour", d, "stroke-opacity": 0.18 + 0.58 * (i / Math.max(1, contours.length - 1)) })).join("")}
    ${flows.map((d) => svg("path", { class: "morse-flow", d, "stroke-opacity": 0.42 })).join("")}
    ${critical.map((c) => svg("circle", { class: `morse-critical-${c.kind}`, cx: c.point.x, cy: c.point.y, r: c.kind === "saddle" ? 5 : 6 })).join("")}
    ${svg("text", { class: "morse-label", x: 28, y: 28 }, `${kind} · z ${format(min)} … ${format(max)}`)}
  `;
}

function sampleAt(samples: Sample[], x: number, y: number): Sample { return samples[y * GRID + x]; }
function screenPoint(x: number, y: number): Point { return { x: 170 + (x / (GRID - 1)) * 560, y: 590 - (y / (GRID - 1)) * 560 }; }
function toSvg(value: number): number { return 450 + value * 140; }
function lerp(a: Point, b: Point, t: number): Point { return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }; }
function clamp(value: number, min: number, max: number): number { return Math.max(min, Math.min(max, value)); }
function readKind(value: string): FunctionKind { return value === "monkey" || value === "ripples" || value === "basins" ? value : "peaks"; }
function readInt(value: string, min: number, max: number, fallback: number): number { const parsed = Number.parseInt(value, 10); return Number.isFinite(parsed) ? Math.max(min, Math.min(max, parsed)) : fallback; }
function format(value: number): string { return value.toFixed(3).replace(/0+$/, "").replace(/\.$/, ""); }
function svg(tag: string, attrs: Record<string, string | number>, children = ""): string { return `<${tag} ${Object.entries(attrs).map(([k, v]) => `${k}="${escapeHtml(String(v))}"`).join(" ")}>${children}</${tag}>`; }
function escapeHtml(text: string): string { return text.replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]!); }
