export {};

const arithmeticForm = document.querySelector<HTMLFormElement>("#tropical-arithmetic-form");
const aInput = document.querySelector<HTMLInputElement>("#tropical-a");
const bInput = document.querySelector<HTMLInputElement>("#tropical-b");
const arithmeticOutput = document.querySelector<HTMLDivElement>("#tropical-arithmetic-output");

const polyForm = document.querySelector<HTMLFormElement>("#tropical-poly-form");
const coefficientsInput = document.querySelector<HTMLInputElement>("#tropical-coefficients");
const xInput = document.querySelector<HTMLInputElement>("#tropical-x");
const xMinInput = document.querySelector<HTMLInputElement>("#tropical-x-min");
const xMaxInput = document.querySelector<HTMLInputElement>("#tropical-x-max");
const polyOutput = document.querySelector<HTMLDivElement>("#tropical-poly-output");
const rootsOutput = document.querySelector<HTMLDivElement>("#tropical-roots-output");
const plot = document.querySelector<SVGSVGElement>("#tropical-plot");

interface TermValue {
  degree: number;
  coefficient: number;
  value: number;
}

interface Root {
  x: number;
  terms: number[];
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" })[ch]!);
}

function readNumber(input: HTMLInputElement, name: string): number {
  const value = Number(input.value);
  if (!Number.isFinite(value)) throw new Error(`${name} must be a finite number`);
  return value;
}

function parseCoefficients(text: string): number[] {
  const coefficients = text.split(",").map((part) => part.trim()).map((part) => part === "∞" || part.toLowerCase() === "inf" ? Number.POSITIVE_INFINITY : Number(part));
  if (coefficients.length === 0 || coefficients.some((value) => Number.isNaN(value))) {
    throw new Error("enter comma-separated numbers, using ∞ or inf to omit a term");
  }
  if (coefficients.every((value) => !Number.isFinite(value))) throw new Error("at least one coefficient must be finite");
  return coefficients;
}

function termsAt(coefficients: number[], x: number): TermValue[] {
  return coefficients
    .map((coefficient, degree) => ({ degree, coefficient, value: coefficient + degree * x }))
    .filter((term) => Number.isFinite(term.coefficient));
}

function evaluate(coefficients: number[], x: number): { value: number; winners: TermValue[]; terms: TermValue[] } {
  const terms = termsAt(coefficients, x);
  const value = Math.min(...terms.map((term) => term.value));
  const winners = terms.filter((term) => Math.abs(term.value - value) < 1e-9);
  return { value, winners, terms };
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return "∞";
  return Math.abs(value - Math.round(value)) < 1e-9 ? String(Math.round(value)) : value.toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
}

function monomial(term: TermValue): string {
  const coefficient = formatNumber(term.coefficient);
  if (term.degree === 0) return coefficient;
  return `${coefficient}x${term.degree === 1 ? "" : `<sup>${term.degree}</sup>`}`;
}

function roots(coefficients: number[]): Root[] {
  const candidates = new Map<string, Root>();
  const finite = coefficients.map((coefficient, degree) => ({ coefficient, degree })).filter((term) => Number.isFinite(term.coefficient));

  finite.forEach((a, i) => {
    finite.slice(i + 1).forEach((b) => {
      if (a.degree === b.degree) return;
      const x = (b.coefficient - a.coefficient) / (a.degree - b.degree);
      const result = evaluate(coefficients, x);
      if (result.winners.length >= 2) {
        candidates.set(formatNumber(x), { x, terms: result.winners.map((term) => term.degree) });
      }
    });
  });

  return [...candidates.values()].sort((a, b) => a.x - b.x);
}

function renderArithmetic() {
  if (!aInput || !bInput || !arithmeticOutput) return;
  try {
    const a = readNumber(aInput, "a");
    const b = readNumber(bInput, "b");
    arithmeticOutput.innerHTML = `
      <table class="tropical-table">
        <tr><th>operation</th><th>ordinary</th><th>tropical</th></tr>
        <tr><td>addition</td><td>${formatNumber(a)} + ${formatNumber(b)} = ${formatNumber(a + b)}</td><td>${formatNumber(a)} ⊕ ${formatNumber(b)} = min(...) = <strong>${formatNumber(Math.min(a, b))}</strong></td></tr>
        <tr><td>multiplication</td><td>${formatNumber(a)} × ${formatNumber(b)} = ${formatNumber(a * b)}</td><td>${formatNumber(a)} ⊗ ${formatNumber(b)} = ${formatNumber(a)} + ${formatNumber(b)} = <strong>${formatNumber(a + b)}</strong></td></tr>
      </table>
    `;
  } catch (error) {
    arithmeticOutput.innerHTML = `<p>${escapeHtml(error instanceof Error ? error.message : String(error))}</p>`;
  }
}

function renderPolynomial() {
  if (!coefficientsInput || !xInput || !xMinInput || !xMaxInput || !polyOutput || !rootsOutput) return;
  try {
    const coefficients = parseCoefficients(coefficientsInput.value);
    const x = readNumber(xInput, "x");
    const result = evaluate(coefficients, x);
    const rootList = roots(coefficients);
    const expression = result.terms.map(monomial).join(" ⊕ ");

    polyOutput.innerHTML = `
      <p><strong>f(x)</strong> = ${expression}</p>
      <p>f(${formatNumber(x)}) = min(${result.terms.map((term) => `${formatNumber(term.coefficient)} + ${term.degree}·${formatNumber(x)} = ${formatNumber(term.value)}`).join(", ")}) = <strong>${formatNumber(result.value)}</strong></p>
      <p class="tropical-muted">winning term${result.winners.length === 1 ? "" : "s"}: ${result.winners.map(monomial).join(", ")}</p>
    `;

    rootsOutput.innerHTML = rootList.length
      ? `<p><strong>tropical roots</strong> occur where at least two terms tie for the minimum:</p><ul>${rootList.map((root) => `<li>x = <strong>${formatNumber(root.x)}</strong> from degrees ${root.terms.join(", ")}</li>`).join("")}</ul>`
      : `<p class="tropical-muted">No tropical roots: a single term wins everywhere in the visible lower envelope.</p>`;

    renderPlot(coefficients, readNumber(xMinInput, "x min"), readNumber(xMaxInput, "x max"));
  } catch (error) {
    polyOutput.innerHTML = `<p>${escapeHtml(error instanceof Error ? error.message : String(error))}</p>`;
  }
}

function svg(tag: string, attrs: Record<string, string | number>, children = ""): string {
  const attrText = Object.entries(attrs).map(([key, value]) => `${key}="${escapeHtml(String(value))}"`).join(" ");
  return `<${tag} ${attrText}>${children}</${tag}>`;
}

function renderPlot(coefficients: number[], xMin: number, xMax: number) {
  if (!plot) return;
  if (xMax <= xMin) throw new Error("x max must be greater than x min");

  const width = 900;
  const height = 420;
  const pad = 46;
  const samples = Array.from({ length: 241 }, (_unused, i) => xMin + (i / 240) * (xMax - xMin));
  const values = samples.map((x) => evaluate(coefficients, x).value);
  const yMin = Math.min(...values);
  const yMax = Math.max(...values);
  const ySpan = yMax - yMin || 1;
  const xToSvg = (x: number) => pad + ((x - xMin) / (xMax - xMin)) * (width - 2 * pad);
  const yToSvg = (y: number) => height - pad - ((y - yMin) / ySpan) * (height - 2 * pad);
  const path = samples.map((x, i) => `${i === 0 ? "M" : "L"}${xToSvg(x).toFixed(2)},${yToSvg(values[i]).toFixed(2)}`).join(" ");
  const rootMarks = roots(coefficients)
    .filter((root) => root.x >= xMin && root.x <= xMax)
    .map((root) => svg("g", {}, `${svg("circle", { cx: xToSvg(root.x), cy: yToSvg(evaluate(coefficients, root.x).value), r: 5, fill: "currentColor" })}${svg("text", { x: xToSvg(root.x) + 8, y: yToSvg(evaluate(coefficients, root.x).value) - 8, "font-size": 12, fill: "currentColor" }, `x=${formatNumber(root.x)}`)}`))
    .join("");
  const termLines = coefficients.map((coefficient, degree) => ({ coefficient, degree })).filter((term) => Number.isFinite(term.coefficient)).map((term) => {
    const y1 = term.coefficient + term.degree * xMin;
    const y2 = term.coefficient + term.degree * xMax;
    return svg("line", { x1: xToSvg(xMin), y1: yToSvg(y1), x2: xToSvg(xMax), y2: yToSvg(y2), stroke: "currentColor", "stroke-opacity": 0.18, "stroke-width": 1 });
  }).join("");

  plot.setAttribute("viewBox", `0 0 ${width} ${height}`);
  plot.innerHTML = `
    ${svg("line", { x1: pad, y1: height - pad, x2: width - pad, y2: height - pad, stroke: "currentColor", "stroke-opacity": 0.35 })}
    ${svg("line", { x1: pad, y1: pad, x2: pad, y2: height - pad, stroke: "currentColor", "stroke-opacity": 0.35 })}
    ${termLines}
    ${svg("path", { d: path, fill: "none", stroke: "currentColor", "stroke-width": 3, "stroke-linejoin": "round" })}
    ${rootMarks}
    ${svg("text", { x: pad, y: height - 14, "font-size": 12, fill: "currentColor" }, `x ${formatNumber(xMin)} … ${formatNumber(xMax)}`)}
    ${svg("text", { x: pad, y: 20, "font-size": 12, fill: "currentColor" }, `f(x) ${formatNumber(yMin)} … ${formatNumber(yMax)}`)}
  `;
}

arithmeticForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  renderArithmetic();
});

polyForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  renderPolynomial();
});

[aInput, bInput].forEach((input) => input?.addEventListener("input", renderArithmetic));
[coefficientsInput, xInput, xMinInput, xMaxInput].forEach((input) => input?.addEventListener("input", renderPolynomial));

renderArithmetic();
renderPolynomial();
