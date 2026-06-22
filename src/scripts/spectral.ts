export {};

interface Elements {
  graphSelect: HTMLSelectElement;
  sizeInput: HTMLInputElement;
  matrixSelect: HTMLSelectElement;
  modeInput: HTMLInputElement;
  modeValue: HTMLElement;
  wobbleButton: HTMLButtonElement;
  summary: HTMLElement;
  plot: SVGSVGElement;
  values: HTMLElement;
  vector: HTMLElement;
}

interface Graph {
  nodes: number;
  edges: Edge[];
  positions: Point[];
}

interface Edge {
  a: number;
  b: number;
}

interface Point {
  x: number;
  y: number;
}

interface Eigenpair {
  value: number;
  vector: number[];
}

interface State {
  running: boolean;
  phase: number;
  lastTime: number;
}

type GraphKind = "cycle" | "path" | "star" | "wheel" | "complete" | "grid";
type MatrixKind = "laplacian" | "adjacency";

const elements = getElements();
if (elements) init(elements);

function getElements(): Elements | null {
  const graphSelect = document.querySelector<HTMLSelectElement>("#spectral-graph");
  const sizeInput = document.querySelector<HTMLInputElement>("#spectral-size");
  const matrixSelect = document.querySelector<HTMLSelectElement>("#spectral-matrix");
  const modeInput = document.querySelector<HTMLInputElement>("#spectral-mode");
  const modeValue = document.querySelector<HTMLElement>("#spectral-mode-value");
  const wobbleButton = document.querySelector<HTMLButtonElement>("#spectral-wobble");
  const summary = document.querySelector<HTMLElement>("#spectral-summary");
  const plot = document.querySelector<SVGSVGElement>("#spectral-plot");
  const values = document.querySelector<HTMLElement>("#spectral-values");
  const vector = document.querySelector<HTMLElement>("#spectral-vector");

  if (!graphSelect || !sizeInput || !matrixSelect || !modeInput || !modeValue || !wobbleButton || !summary || !plot || !values || !vector) return null;
  return { graphSelect, sizeInput, matrixSelect, modeInput, modeValue, wobbleButton, summary, plot, values, vector };
}

function init(elements: Elements) {
  const state: State = { running: true, phase: 0, lastTime: performance.now() };
  const render = () => renderSpectral(elements, state);
  [elements.graphSelect, elements.sizeInput, elements.matrixSelect, elements.modeInput].forEach((input) => {
    input.addEventListener("input", render);
    input.addEventListener("change", render);
  });
  elements.wobbleButton.addEventListener("click", () => {
    state.running = !state.running;
    elements.wobbleButton.textContent = state.running ? "pause wobble" : "run wobble";
    render();
  });

  const tick = (time: number) => {
    const delta = Math.min(80, time - state.lastTime);
    state.lastTime = time;
    if (state.running) {
      state.phase = (state.phase + delta / 1500) % (Math.PI * 2);
      renderSpectral(elements, state);
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function renderSpectral(elements: Elements, state: State) {
  const graphKind = readGraphKind(elements.graphSelect.value);
  const matrixKind = readMatrixKind(elements.matrixSelect.value);
  const size = readInt(elements.sizeInput.value, 3, 24, 10);
  elements.sizeInput.value = String(size);
  const graph = createGraph(graphKind, size);
  const pairs = jacobiEigen(matrix(graph, matrixKind));
  const mode = readInt(elements.modeInput.value, 0, pairs.length - 1, Math.min(1, pairs.length - 1));
  elements.modeInput.max = String(pairs.length - 1);
  elements.modeInput.value = String(mode);
  elements.modeValue.textContent = String(mode);

  elements.summary.textContent = `${graph.nodes} nodes · ${graph.edges.length} edges · ${matrixKind} eigenvalue λ${mode} = ${format(pairs[mode].value)}`;
  renderPlot(elements.plot, graph, pairs[mode], state.phase);
  renderValues(elements.values, pairs, mode);
  renderVector(elements.vector, pairs[mode].vector);
}

function createGraph(kind: GraphKind, nodes: number): Graph {
  if (kind === "path") return { nodes, edges: pathEdges(nodes), positions: pathLayout(nodes) };
  if (kind === "star") return { nodes, edges: Array.from({ length: nodes - 1 }, (_unused, i) => ({ a: 0, b: i + 1 })), positions: starLayout(nodes) };
  if (kind === "wheel") return { nodes, edges: wheelEdges(nodes), positions: starLayout(nodes) };
  if (kind === "complete") return { nodes, edges: completeEdges(nodes), positions: circleLayout(nodes) };
  if (kind === "grid") return gridGraph(nodes);
  return { nodes, edges: cycleEdges(nodes), positions: circleLayout(nodes) };
}

function pathEdges(nodes: number): Edge[] {
  return Array.from({ length: nodes - 1 }, (_unused, i) => ({ a: i, b: i + 1 }));
}

function cycleEdges(nodes: number): Edge[] {
  return [...pathEdges(nodes), { a: nodes - 1, b: 0 }];
}

function wheelEdges(nodes: number): Edge[] {
  const rim = Array.from({ length: Math.max(0, nodes - 1) }, (_unused, i) => i + 1);
  return [
    ...rim.map((node) => ({ a: 0, b: node })),
    ...rim.map((node, index) => ({ a: node, b: rim[(index + 1) % rim.length] })),
  ];
}

function completeEdges(nodes: number): Edge[] {
  const edges: Edge[] = [];
  for (let a = 0; a < nodes; a++) {
    for (let b = a + 1; b < nodes; b++) edges.push({ a, b });
  }
  return edges;
}

function gridGraph(nodes: number): Graph {
  const columns = Math.ceil(Math.sqrt(nodes));
  const rows = Math.ceil(nodes / columns);
  const edges: Edge[] = [];
  const positions: Point[] = [];
  for (let node = 0; node < nodes; node++) {
    const x = node % columns;
    const y = Math.floor(node / columns);
    positions.push({ x: columns === 1 ? 0.5 : x / (columns - 1), y: rows === 1 ? 0.5 : y / (rows - 1) });
    if (x + 1 < columns && node + 1 < nodes) edges.push({ a: node, b: node + 1 });
    if (node + columns < nodes) edges.push({ a: node, b: node + columns });
  }
  return { nodes, edges, positions };
}

function circleLayout(nodes: number): Point[] {
  return Array.from({ length: nodes }, (_unused, index) => {
    const angle = (index / nodes) * Math.PI * 2 - Math.PI / 2;
    return { x: 0.5 + Math.cos(angle) * 0.39, y: 0.5 + Math.sin(angle) * 0.39 };
  });
}

function starLayout(nodes: number): Point[] {
  const positions = [{ x: 0.5, y: 0.5 }];
  for (let index = 1; index < nodes; index++) {
    const angle = ((index - 1) / (nodes - 1)) * Math.PI * 2 - Math.PI / 2;
    positions.push({ x: 0.5 + Math.cos(angle) * 0.39, y: 0.5 + Math.sin(angle) * 0.39 });
  }
  return positions;
}

function pathLayout(nodes: number): Point[] {
  return Array.from({ length: nodes }, (_unused, index) => ({
    x: 0.08 + (0.84 * index) / (nodes - 1),
    y: 0.5 + Math.sin((index / (nodes - 1)) * Math.PI * 2) * 0.08,
  }));
}

function matrix(graph: Graph, kind: MatrixKind): number[][] {
  const result = Array.from({ length: graph.nodes }, () => Array.from({ length: graph.nodes }, () => 0));
  graph.edges.forEach((edge) => {
    result[edge.a][edge.b] = 1;
    result[edge.b][edge.a] = 1;
  });
  if (kind === "adjacency") return result;

  for (let node = 0; node < graph.nodes; node++) {
    const degree = result[node].reduce((sum, value) => sum + value, 0);
    result[node][node] = degree;
    for (let other = 0; other < graph.nodes; other++) if (node !== other) result[node][other] *= -1;
  }
  return result;
}

function jacobiEigen(input: number[][]): Eigenpair[] {
  const n = input.length;
  const a = input.map((row) => [...row]);
  const vectors = Array.from({ length: n }, (_row, i) => Array.from({ length: n }, (_column, j) => (i === j ? 1 : 0)));

  for (let sweep = 0; sweep < 120; sweep++) {
    let p = 0;
    let q = 1;
    let max = 0;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const value = Math.abs(a[i][j]);
        if (value > max) {
          max = value;
          p = i;
          q = j;
        }
      }
    }
    if (max < 1e-9) break;

    const theta = (a[q][q] - a[p][p]) / (2 * a[p][q]);
    const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
    const c = 1 / Math.sqrt(t * t + 1);
    const s = t * c;
    rotate(a, vectors, p, q, c, s);
  }

  return Array.from({ length: n }, (_unused, index) => ({
    value: a[index][index],
    vector: normalize(vectors.map((row) => row[index])),
  })).sort((left, right) => left.value - right.value);
}

function rotate(a: number[][], vectors: number[][], p: number, q: number, c: number, s: number) {
  const n = a.length;
  const app = a[p][p];
  const aqq = a[q][q];
  const apq = a[p][q];
  a[p][p] = c * c * app - 2 * s * c * apq + s * s * aqq;
  a[q][q] = s * s * app + 2 * s * c * apq + c * c * aqq;
  a[p][q] = 0;
  a[q][p] = 0;

  for (let k = 0; k < n; k++) {
    if (k !== p && k !== q) {
      const akp = a[k][p];
      const akq = a[k][q];
      a[k][p] = c * akp - s * akq;
      a[p][k] = a[k][p];
      a[k][q] = s * akp + c * akq;
      a[q][k] = a[k][q];
    }
    const vkp = vectors[k][p];
    const vkq = vectors[k][q];
    vectors[k][p] = c * vkp - s * vkq;
    vectors[k][q] = s * vkp + c * vkq;
  }
}

function normalize(vector: number[]): number[] {
  const max = Math.max(...vector.map((value) => Math.abs(value))) || 1;
  return vector.map((value) => value / max);
}

function renderPlot(plot: SVGSVGElement, graph: Graph, pair: Eigenpair, phase: number) {
  const width = 900;
  const height = 560;
  const wobble = Math.sin(phase) * 38;
  const points = graph.positions.map((position, index) => displace(toScreen(position, width, height), graph.positions[index], pair.vector[index], wobble));
  const edges = graph.edges.map((edge) => svg("line", {
    class: `spectral-edge${Math.abs(pair.vector[edge.a] - pair.vector[edge.b]) > 0.55 ? " is-strong" : ""}`,
    x1: points[edge.a].x,
    y1: points[edge.a].y,
    x2: points[edge.b].x,
    y2: points[edge.b].y,
  })).join("");
  const nodes = points.map((point, index) => svg("g", {}, `
    ${svg("circle", { class: `spectral-node${pair.vector[index] >= 0 ? " is-positive" : " is-negative"}`, cx: point.x, cy: point.y, r: 12 + Math.abs(pair.vector[index]) * 6 })}
    ${svg("text", { class: "spectral-label", x: point.x, y: point.y + 4, "text-anchor": "middle" }, String(index))}
  `)).join("");

  plot.setAttribute("viewBox", `0 0 ${width} ${height}`);
  plot.innerHTML = `${edges}${nodes}`;
}

function toScreen(point: Point, width: number, height: number): Point {
  return { x: 54 + point.x * (width - 108), y: 44 + point.y * (height - 88) };
}

function displace(screen: Point, position: Point, value: number, amount: number): Point {
  const dx = position.x - 0.5;
  const dy = position.y - 0.5;
  const length = Math.hypot(dx, dy) || 1;
  return { x: screen.x + (dx / length) * value * amount, y: screen.y + (dy / length) * value * amount };
}

function renderValues(container: HTMLElement, pairs: Eigenpair[], selected: number) {
  const max = Math.max(...pairs.map((pair) => Math.abs(pair.value))) || 1;
  container.innerHTML = pairs.map((pair, index) => bar(`λ${index}`, pair.value, max, index === selected)).join("");
}

function renderVector(container: HTMLElement, vector: number[]) {
  container.innerHTML = vector.map((value, index) => bar(`v${index}`, value, 1, false)).join("");
}

function bar(label: string, value: number, max: number, selected: boolean): string {
  const width = Math.max(2, (Math.abs(value) / max) * 100);
  return `<div class="spectral-bar"><span>${escapeHtml(label)}${selected ? "*" : ""}</span><span class="spectral-bar-track"><span class="spectral-bar-fill" style="width:${width}%"></span></span><span>${format(value)}</span></div>`;
}

function readGraphKind(value: string): GraphKind {
  return value === "path" || value === "star" || value === "wheel" || value === "complete" || value === "grid" ? value : "cycle";
}

function readMatrixKind(value: string): MatrixKind {
  return value === "adjacency" ? "adjacency" : "laplacian";
}

function readInt(value: string, min: number, max: number, fallback: number): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function format(value: number): string {
  return Math.abs(value) < 1e-8 ? "0" : value.toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
}

function svg(tag: string, attrs: Record<string, string | number>, children = ""): string {
  const attrText = Object.entries(attrs).map(([key, value]) => `${key}="${escapeHtml(String(value))}"`).join(" ");
  return `<${tag} ${attrText}>${children}</${tag}>`;
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character]!);
}
