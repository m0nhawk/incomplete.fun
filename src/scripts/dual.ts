export {};

interface Dual {
  real: number;
  eps: number;
}

interface FunctionSpec {
  name: string;
  fn: (x: number) => number;
  derivative: (x: number) => number;
  domain: (x: number) => boolean;
  domainMessage: string;
}

const arithmeticForm = document.querySelector<HTMLFormElement>("#dual-arithmetic-form");
const aInput = document.querySelector<HTMLInputElement>("#dual-a");
const bInput = document.querySelector<HTMLInputElement>("#dual-b");
const cInput = document.querySelector<HTMLInputElement>("#dual-c");
const dInput = document.querySelector<HTMLInputElement>("#dual-d");
const opInput = document.querySelector<HTMLSelectElement>("#dual-op");
const nInput = document.querySelector<HTMLInputElement>("#dual-n");
const powerLabel = document.querySelector<HTMLLabelElement>("#dual-power-label");
const arithmeticOutput = document.querySelector<HTMLDivElement>("#dual-arithmetic-output");

const functionForm = document.querySelector<HTMLFormElement>("#dual-function-form");
const xInput = document.querySelector<HTMLInputElement>("#dual-x");
const seedInput = document.querySelector<HTMLInputElement>("#dual-seed");
const functionInput = document.querySelector<HTMLSelectElement>("#dual-function");
const functionOutput = document.querySelector<HTMLDivElement>("#dual-function-output");
const graph = document.querySelector<SVGSVGElement>("#dual-graph");

const functions: Record<string, FunctionSpec> = {
  square: { name: "x²", fn: (x) => x * x, derivative: (x) => 2 * x, domain: Number.isFinite, domainMessage: "x must be finite" },
  cube: { name: "x³", fn: (x) => x * x * x, derivative: (x) => 3 * x * x, domain: Number.isFinite, domainMessage: "x must be finite" },
  sin: { name: "sin x", fn: Math.sin, derivative: Math.cos, domain: Number.isFinite, domainMessage: "x must be finite" },
  cos: { name: "cos x", fn: Math.cos, derivative: (x) => -Math.sin(x), domain: Number.isFinite, domainMessage: "x must be finite" },
  tan: { name: "tan x", fn: Math.tan, derivative: (x) => 1 / Math.cos(x) ** 2, domain: (x) => Number.isFinite(x) && Math.abs(Math.cos(x)) > 1e-6, domainMessage: "tan is undefined near π/2 + kπ" },
  exp: { name: "exp x", fn: Math.exp, derivative: Math.exp, domain: (x) => Number.isFinite(x) && Math.abs(x) < 50, domainMessage: "choose a finite x with |x| < 50" },
  log: { name: "log x", fn: Math.log, derivative: (x) => 1 / x, domain: (x) => x > 0, domainMessage: "log requires x > 0" },
  sqrt: { name: "sqrt x", fn: Math.sqrt, derivative: (x) => 1 / (2 * Math.sqrt(x)), domain: (x) => x > 0, domainMessage: "sqrt derivative here requires x > 0" },
  reciprocal: { name: "1/x", fn: (x) => 1 / x, derivative: (x) => -1 / (x * x), domain: (x) => x !== 0 && Number.isFinite(x), domainMessage: "1/x requires x ≠ 0" },
  logistic: {
    name: "1/(1+e⁻ˣ)",
    fn: (x) => 1 / (1 + Math.exp(-x)),
    derivative: (x) => {
      const y = 1 / (1 + Math.exp(-x));
      return y * (1 - y);
    },
    domain: Number.isFinite,
    domainMessage: "x must be finite",
  },
};

function readNumber(input: HTMLInputElement | null, name: string): number {
  const value = Number(input?.value);
  if (!Number.isFinite(value)) throw new Error(`${name} must be a finite number`);
  return value;
}

function add(z: Dual, w: Dual): Dual {
  return { real: z.real + w.real, eps: z.eps + w.eps };
}

function sub(z: Dual, w: Dual): Dual {
  return { real: z.real - w.real, eps: z.eps - w.eps };
}

function mul(z: Dual, w: Dual): Dual {
  return { real: z.real * w.real, eps: z.real * w.eps + z.eps * w.real };
}

function div(z: Dual, w: Dual): Dual {
  if (w.real === 0) throw new Error("division requires the denominator real part c to be nonzero");
  return { real: z.real / w.real, eps: (z.eps * w.real - z.real * w.eps) / (w.real * w.real) };
}

function pow(z: Dual, n: number): Dual {
  if (!Number.isInteger(n)) throw new Error("n must be an integer");
  if (n < 0 && z.real === 0) throw new Error("negative powers require nonzero real part");
  if (n === 0) return { real: 1, eps: 0 };
  return { real: z.real ** n, eps: n * z.real ** (n - 1) * z.eps };
}

function fmtNumber(n: number): string {
  if (Object.is(n, -0)) n = 0;
  if (!Number.isFinite(n)) return String(n);
  const abs = Math.abs(n);
  if (abs !== 0 && (abs >= 1e6 || abs < 1e-5)) return n.toExponential(6).replace(/\.0+e/, "e");
  return n.toFixed(8).replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
}

function fmtDual(z: Dual): string {
  const sign = z.eps < 0 ? "−" : "+";
  return `${fmtNumber(z.real)} ${sign} ${fmtNumber(Math.abs(z.eps))}ε`;
}

function setHtml(el: HTMLElement | null, html: string): void {
  if (el) el.innerHTML = html;
}

function showError(el: HTMLElement | null, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  setHtml(el, `<p class="dual-error">${escapeHtml(message)}</p>`);
}

function escapeHtml(text: string): string {
  return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function updatePowerVisibility(): void {
  if (powerLabel && opInput) powerLabel.style.display = opInput.value === "pow" ? "grid" : "none";
}

function computeArithmetic(): void {
  try {
    const z = { real: readNumber(aInput, "a"), eps: readNumber(bInput, "b") };
    const w = { real: readNumber(cInput, "c"), eps: readNumber(dInput, "d") };
    const op = opInput?.value ?? "mul";
    const n = Number(nInput?.value);
    const result = op === "add" ? add(z, w) : op === "sub" ? sub(z, w) : op === "mul" ? mul(z, w) : op === "div" ? div(z, w) : pow(z, n);
    const formula = op === "add" ? "componentwise addition" : op === "sub" ? "componentwise subtraction" : op === "mul" ? "ac + (ad+bc)ε" : op === "div" ? "a/c + (bc−ad)/c² ε" : "aⁿ + n aⁿ⁻¹bε";
    setHtml(arithmeticOutput, `<div class="dual-result-line"><strong>${escapeHtml(fmtDual(result))}</strong></div><div>rule: <code>${formula}</code></div><div>real projection: <code>${fmtNumber(result.real)}</code>; ε coefficient: <code>${fmtNumber(result.eps)}</code></div>`);
  } catch (error) {
    showError(arithmeticOutput, error);
  }
}

function computeFunction(): void {
  try {
    const x = readNumber(xInput, "x");
    const seed = readNumber(seedInput, "seed");
    const spec = functions[functionInput?.value ?? "sin"];
    if (!spec.domain(x)) throw new Error(spec.domainMessage);
    const value = spec.fn(x);
    const derivative = spec.derivative(x);
    const result = { real: value, eps: seed * derivative };
    setHtml(functionOutput, `<div class="dual-result-line"><strong>${escapeHtml(spec.name)} at ${fmtNumber(x)} = ${escapeHtml(fmtDual(result))}</strong></div><div>value: <code>${fmtNumber(value)}</code></div><div>derivative: <code>${fmtNumber(derivative)}</code> ${seed === 1 ? "" : `(ε coefficient divided by seed ${fmtNumber(seed)})`}</div>`);
    drawGraph(spec, x, value, derivative);
  } catch (error) {
    showError(functionOutput, error);
  }
}

function drawGraph(spec: FunctionSpec, x0: number, y0: number, slope: number): void {
  if (!graph) return;
  const width = 640;
  const height = 260;
  const left = Math.max(-6, x0 - 4);
  const right = Math.min(6, x0 + 4);
  const samples: { x: number; y: number }[] = [];
  for (let i = 0; i <= 180; i++) {
    const x = left + (right - left) * (i / 180);
    if (spec.domain(x)) {
      const y = spec.fn(x);
      if (Number.isFinite(y)) samples.push({ x, y });
    }
  }
  const tangent = [left, right].map((x) => ({ x, y: y0 + slope * (x - x0) }));
  const ys = [...samples.map((p) => p.y), ...tangent.map((p) => p.y), 0];
  let minY = Math.min(...ys);
  let maxY = Math.max(...ys);
  if (maxY - minY < 1e-6) {
    minY -= 1;
    maxY += 1;
  }
  const padY = (maxY - minY) * 0.12;
  minY -= padY;
  maxY += padY;
  const sx = (x: number) => ((x - left) / (right - left)) * width;
  const sy = (y: number) => height - ((y - minY) / (maxY - minY)) * height;
  const curve = samples.map((p, i) => `${i === 0 ? "M" : "L"}${sx(p.x).toFixed(2)},${sy(p.y).toFixed(2)}`).join(" ");
  const tangentPath = `M${sx(tangent[0].x).toFixed(2)},${sy(tangent[0].y).toFixed(2)} L${sx(tangent[1].x).toFixed(2)},${sy(tangent[1].y).toFixed(2)}`;
  const xAxis = 0 >= minY && 0 <= maxY ? `<line class="dual-graph-axis" x1="0" y1="${sy(0)}" x2="${width}" y2="${sy(0)}" />` : "";
  const yAxis = 0 >= left && 0 <= right ? `<line class="dual-graph-axis" x1="${sx(0)}" y1="0" x2="${sx(0)}" y2="${height}" />` : "";
  graph.innerHTML = `${xAxis}${yAxis}<path class="dual-graph-curve" d="${curve}"/><path class="dual-graph-tangent" d="${tangentPath}"/><circle class="dual-graph-point" cx="${sx(x0)}" cy="${sy(y0)}" r="4"/><text class="dual-graph-label" x="12" y="22">${escapeHtml(spec.name)}</text><text class="dual-graph-label" x="12" y="242">tangent slope ${fmtNumber(slope)}</text>`;
}

arithmeticForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  computeArithmetic();
});

functionForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  computeFunction();
});

for (const input of [aInput, bInput, cInput, dInput, nInput]) input?.addEventListener("input", computeArithmetic);
opInput?.addEventListener("change", () => {
  updatePowerVisibility();
  computeArithmetic();
});
for (const input of [xInput, seedInput]) input?.addEventListener("input", computeFunction);
functionInput?.addEventListener("change", computeFunction);

updatePowerVisibility();
computeArithmetic();
computeFunction();
