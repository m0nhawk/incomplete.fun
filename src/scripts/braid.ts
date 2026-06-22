export {};

interface Crossing { index: number; sign: 1 | -1 }
interface Elements {
  strandsInput: HTMLInputElement;
  generatorSelect: HTMLSelectElement;
  addPositive: HTMLButtonElement;
  addNegative: HTMLButtonElement;
  reduceButton: HTMLButtonElement;
  clearButton: HTMLButtonElement;
  summary: HTMLElement;
  word: HTMLElement;
  plot: SVGSVGElement;
  permutation: HTMLElement;
  closure: HTMLElement;
}

let word: Crossing[] = [
  { index: 1, sign: 1 },
  { index: 2, sign: 1 },
  { index: 1, sign: 1 },
  { index: 3, sign: -1 },
  { index: 2, sign: 1 },
];

const elements = getElements();
if (elements) init(elements);

function getElements(): Elements | null {
  const strandsInput = document.querySelector<HTMLInputElement>("#braid-strands");
  const generatorSelect = document.querySelector<HTMLSelectElement>("#braid-generator");
  const addPositive = document.querySelector<HTMLButtonElement>("#braid-add-positive");
  const addNegative = document.querySelector<HTMLButtonElement>("#braid-add-negative");
  const reduceButton = document.querySelector<HTMLButtonElement>("#braid-reduce");
  const clearButton = document.querySelector<HTMLButtonElement>("#braid-clear");
  const summary = document.querySelector<HTMLElement>("#braid-summary");
  const wordEl = document.querySelector<HTMLElement>("#braid-word");
  const plot = document.querySelector<SVGSVGElement>("#braid-plot");
  const permutation = document.querySelector<HTMLElement>("#braid-permutation");
  const closure = document.querySelector<HTMLElement>("#braid-closure");
  if (!strandsInput || !generatorSelect || !addPositive || !addNegative || !reduceButton || !clearButton || !summary || !wordEl || !plot || !permutation || !closure) return null;
  return { strandsInput, generatorSelect, addPositive, addNegative, reduceButton, clearButton, summary, word: wordEl, plot, permutation, closure };
}

function init(elements: Elements) {
  const render = () => renderBraid(elements);
  elements.strandsInput.addEventListener("input", render);
  elements.addPositive.addEventListener("click", () => { word.push({ index: selectedGenerator(elements), sign: 1 }); render(); });
  elements.addNegative.addEventListener("click", () => { word.push({ index: selectedGenerator(elements), sign: -1 }); render(); });
  elements.reduceButton.addEventListener("click", () => { word = reduce(word); render(); });
  elements.clearButton.addEventListener("click", () => { word = []; render(); });
  render();
}

function renderBraid(elements: Elements) {
  const strands = readInt(elements.strandsInput.value, 2, 8, 4);
  elements.strandsInput.value = String(strands);
  word = word.filter((crossing) => crossing.index < strands);
  syncGenerators(elements, strands);
  const perm = permutation(strands, word);
  elements.summary.textContent = `${strands} strands · ${word.length} crossings · ${closureComponents(perm).length} closure component${closureComponents(perm).length === 1 ? "" : "s"}`;
  elements.word.innerHTML = word.length ? word.map(formatCrossing).join(" ") : `<span class="braid-chip">identity</span>`;
  elements.permutation.innerHTML = `
    <p><strong>bottom order</strong>: ${perm.map((value) => value + 1).join(" ")}</p>
    <p><strong>cycles</strong>: ${closureComponents(perm).map((cycle) => `(${cycle.map((value) => value + 1).join(" ")})`).join(" ") || "()"}</p>
  `;
  elements.closure.innerHTML = closureComponents(perm).map((cycle, index) => `<span class="braid-chip">component ${index + 1}: ${cycle.map((value) => value + 1).join(" → ")}</span>`).join("") || `<span class="braid-chip">empty</span>`;
  renderPlot(elements.plot, strands, word, perm);
}

function syncGenerators(elements: Elements, strands: number) {
  const selected = selectedGenerator(elements);
  elements.generatorSelect.innerHTML = Array.from({ length: strands - 1 }, (_unused, i) => `<option value="${i + 1}">σ${i + 1}</option>`).join("");
  elements.generatorSelect.value = String(Math.min(selected, strands - 1));
}

function selectedGenerator(elements: Elements): number {
  return readInt(elements.generatorSelect.value, 1, 7, 1);
}

function renderPlot(plot: SVGSVGElement, strands: number, crossings: Crossing[], perm: number[]) {
  const width = 900;
  const height = 600;
  const top = 56;
  const bottom = height - 84;
  const left = 110;
  const right = width - 110;
  const stepY = crossings.length ? (bottom - top) / (crossings.length + 1) : bottom - top;
  const xs = Array.from({ length: strands }, (_unused, i) => left + (i / Math.max(1, strands - 1)) * (right - left));
  const positions = Array.from({ length: strands }, (_unused, i) => i);
  const paths = Array.from({ length: strands }, (_unused, strand) => [`M${xs[strand]} ${top}`]);
  const labels: string[] = [];

  crossings.forEach((crossing, level) => {
    const y1 = top + level * stepY + stepY * 0.35;
    const y2 = top + (level + 1) * stepY + stepY * 0.35;
    const aPos = crossing.index - 1;
    const bPos = crossing.index;
    const strandA = positions[aPos];
    const strandB = positions[bPos];
    for (let pos = 0; pos < strands; pos++) if (pos !== aPos && pos !== bPos) paths[positions[pos]].push(`L${xs[pos]} ${y2}`);
    paths[strandA].push(`C${xs[aPos]} ${y1 + stepY * 0.35}, ${xs[bPos]} ${y1 + stepY * 0.25}, ${xs[bPos]} ${y2}`);
    paths[strandB].push(`C${xs[bPos]} ${y1 + stepY * 0.35}, ${xs[aPos]} ${y1 + stepY * 0.25}, ${xs[aPos]} ${y2}`);
    labels.push(svg("text", { class: "braid-label", x: (xs[aPos] + xs[bPos]) / 2, y: y1 + 6, "text-anchor": "middle" }, crossing.sign === 1 ? `σ${crossing.index}` : `σ${crossing.index}⁻¹`));
    [positions[aPos], positions[bPos]] = [positions[bPos], positions[aPos]];
  });

  for (let pos = 0; pos < strands; pos++) paths[positions[pos]].push(`L${xs[pos]} ${bottom}`);
  const guides = xs.map((x, i) => `${svg("line", { class: "braid-guide", x1: x, y1: top - 22, x2: x, y2: bottom + 22 })}${svg("text", { class: "braid-label", x, y: top - 30, "text-anchor": "middle" }, String(i + 1))}${svg("text", { class: "braid-label", x, y: bottom + 42, "text-anchor": "middle" }, String(perm[i] + 1))}`).join("");
  const strandsSvg = paths.map((parts, i) => svg("path", { class: i % 2 === 0 ? "braid-strand" : "braid-under", d: parts.join(" ") })).join("");
  const closures = perm.map((topStrand, bottomPos) => {
    const x1 = xs[bottomPos];
    const x2 = xs[topStrand];
    return svg("path", { class: "braid-guide", d: `M${x1} ${bottom} C${x1} ${height - 20}, ${x2} ${height - 20}, ${x2} ${top}` });
  }).join("");
  plot.setAttribute("viewBox", `0 0 ${width} ${height}`);
  plot.innerHTML = `${guides}${closures}${strandsSvg}${labels.join("")}`;
}

function permutation(strands: number, crossings: Crossing[]): number[] {
  const order = Array.from({ length: strands }, (_unused, i) => i);
  crossings.forEach((crossing) => {
    const i = crossing.index - 1;
    [order[i], order[i + 1]] = [order[i + 1], order[i]];
  });
  return order;
}

function closureComponents(perm: number[]): number[][] {
  const visited = new Set<number>();
  const cycles: number[][] = [];
  for (let start = 0; start < perm.length; start++) {
    if (visited.has(start)) continue;
    const cycle: number[] = [];
    let current = start;
    while (!visited.has(current)) {
      visited.add(current);
      cycle.push(current);
      current = perm[current];
    }
    cycles.push(cycle);
  }
  return cycles;
}

function reduce(crossings: Crossing[]): Crossing[] {
  const reduced: Crossing[] = [];
  crossings.forEach((crossing) => {
    const last = reduced[reduced.length - 1];
    if (last && last.index === crossing.index && last.sign + crossing.sign === 0) reduced.pop();
    else reduced.push(crossing);
  });
  return reduced;
}

function formatCrossing(crossing: Crossing): string {
  return `<span class="braid-chip">σ${crossing.index}${crossing.sign === -1 ? "⁻¹" : ""}</span>`;
}

function readInt(value: string, min: number, max: number, fallback: number): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function svg(tag: string, attrs: Record<string, string | number>, children = ""): string {
  const attrText = Object.entries(attrs).map(([key, value]) => `${key}="${escapeHtml(String(value))}"`).join(" ");
  return `<${tag} ${attrText}>${children}</${tag}>`;
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character]!);
}
