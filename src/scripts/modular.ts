export {};

interface Elements {
  nInput: HTMLInputElement;
  aInput: HTMLInputElement;
  curveInput: HTMLInputElement;
  labelsInput: HTMLInputElement;
  randomButton: HTMLButtonElement;
  plot: SVGSVGElement;
  summary: HTMLElement;
  orbits: HTMLElement;
}

interface Point {
  x: number;
  y: number;
}

const elements = getElements();
if (elements) init(elements);

function getElements(): Elements | null {
  const nInput = document.querySelector<HTMLInputElement>("#modular-n");
  const aInput = document.querySelector<HTMLInputElement>("#modular-a");
  const curveInput = document.querySelector<HTMLInputElement>("#modular-curve");
  const labelsInput = document.querySelector<HTMLInputElement>("#modular-labels");
  const randomButton = document.querySelector<HTMLButtonElement>("#modular-random");
  const plot = document.querySelector<SVGSVGElement>("#modular-plot");
  const summary = document.querySelector<HTMLElement>("#modular-summary");
  const orbits = document.querySelector<HTMLElement>("#modular-orbits");

  if (!nInput || !aInput || !curveInput || !labelsInput || !randomButton || !plot || !summary || !orbits) {
    return null;
  }

  return { nInput, aInput, curveInput, labelsInput, randomButton, plot, summary, orbits };
}

function init(elements: Elements) {
  const render = () => renderModular(elements);
  [elements.nInput, elements.aInput, elements.curveInput, elements.labelsInput].forEach((input) => {
    input.addEventListener("input", render);
    input.addEventListener("change", render);
  });
  elements.randomButton.addEventListener("click", () => {
    const n = readInt(elements.nInput.value, 2, 120, 48);
    const units = Array.from({ length: n }, (_unused, index) => index).filter((value) => gcd(value, n) === 1);
    elements.aInput.value = String(units[Math.floor(Math.random() * units.length)] ?? 1);
    render();
  });
  render();
}

function renderModular(elements: Elements) {
  const n = readInt(elements.nInput.value, 2, 120, 48);
  const rawA = readInt(elements.aInput.value, 0, 10000, 2);
  const a = modulo(rawA, n);
  const curve = readInt(elements.curveInput.value, 0, 100, 54) / 100;
  const showLabels = elements.labelsInput.checked;

  elements.nInput.value = String(n);
  elements.aInput.value = String(rawA);

  const unit = gcd(a, n) === 1;
  const orderText = unit ? ` · order ${multiplicativeOrder(a, n)}` : " · not a unit";
  elements.summary.textContent = `x → ${a}x mod ${n} · gcd(${a}, ${n}) = ${gcd(a, n)}${orderText}`;

  renderPlot(elements.plot, n, a, curve, showLabels);
  renderOrbits(elements.orbits, n, a);
}

function renderPlot(plot: SVGSVGElement, n: number, a: number, curve: number, showLabels: boolean) {
  const size = 760;
  const center = { x: size / 2, y: size / 2 };
  const radius = 300;
  const labelRadius = 336;
  const points = Array.from({ length: n }, (_unused, index) => circlePoint(index, n, center, radius));
  const labelStep = n <= 72 ? 1 : Math.ceil(n / 60);

  const chords = points.map((point, index) => {
    const targetIndex = modulo(a * index, n);
    const target = points[targetIndex];
    const mid = midpoint(point, target);
    const pull = lerp(mid, center, curve);
    const same = index === targetIndex;
    if (same) {
      const loopRadius = 11 + curve * 18;
      return svg("circle", {
        class: "modular-chord",
        cx: point.x,
        cy: point.y,
        r: loopRadius,
        "stroke-width": 1.1,
        "stroke-opacity": 0.38,
      });
    }
    return svg("path", {
      class: "modular-chord",
      d: `M${point.x.toFixed(2)} ${point.y.toFixed(2)} Q${pull.x.toFixed(2)} ${pull.y.toFixed(2)} ${target.x.toFixed(2)} ${target.y.toFixed(2)}`,
      "stroke-width": gcd(index, n) === 1 ? 1.45 : 0.75,
      "stroke-opacity": index === 0 ? 0.72 : 0.2 + (0.48 * (index % 9)) / 8,
    });
  }).join("");

  const nodes = points.map((point, index) => {
    const isFixed = modulo(a * index, n) === index;
    return svg("circle", {
      class: `modular-node${isFixed ? " is-fixed" : ""}`,
      cx: point.x,
      cy: point.y,
      r: isFixed ? 4.7 : 3.3,
      "stroke-width": 1.1,
    });
  }).join("");

  const labels = showLabels
    ? points.map((_point, index) => {
      if (index % labelStep !== 0) return "";
      const labelPoint = circlePoint(index, n, center, labelRadius);
      return svg("text", {
        class: "modular-label",
        x: labelPoint.x,
        y: labelPoint.y + 4,
        "text-anchor": "middle",
      }, String(index));
    }).join("")
    : "";

  plot.setAttribute("viewBox", `0 0 ${size} ${size}`);
  plot.innerHTML = `
    ${svg("circle", { class: "modular-axis", cx: center.x, cy: center.y, r: radius, fill: "none" })}
    ${Array.from({ length: 12 }, (_unused, index) => circlePoint(index, 12, center, radius)).map((point) => svg("line", { class: "modular-axis", x1: center.x, y1: center.y, x2: point.x, y2: point.y, "stroke-opacity": 0.35 })).join("")}
    ${chords}
    ${nodes}
    ${labels}
    ${svg("text", { class: "modular-label", x: center.x, y: center.y + 4, "text-anchor": "middle" }, `×${a} mod ${n}`)}
  `;
}

function renderOrbits(container: HTMLElement, n: number, a: number) {
  const rows: string[] = [];
  const visited = new Set<number>();

  for (let start = 0; start < n; start++) {
    if (visited.has(start)) continue;
    const path: number[] = [];
    const seenInPath = new Map<number, number>();
    let current = start;

    while (!seenInPath.has(current) && !visited.has(current)) {
      seenInPath.set(current, path.length);
      path.push(current);
      current = modulo(a * current, n);
    }

    path.forEach((value) => visited.add(value));
    const cycleStart = seenInPath.get(current) ?? path.length;
    const tail = path.slice(0, cycleStart);
    const cycle = path.slice(cycleStart);
    const text = tail.length
      ? `${tail.join(" → ")} → (${cycle.join(" → ")})`
      : `(${cycle.join(" → ")})`;
    rows.push(`<div class="modular-orbit-row"><strong>${start}</strong>: ${escapeHtml(text)}</div>`);
  }

  const hidden = Math.max(0, rows.length - 22);
  container.innerHTML = `${rows.slice(0, 22).join("")}${hidden ? `<div class="modular-orbit-row modular-muted">${hidden} more components hidden</div>` : ""}`;
}

function circlePoint(index: number, count: number, center: Point, radius: number): Point {
  const angle = (index / count) * Math.PI * 2 - Math.PI / 2;
  return {
    x: center.x + Math.cos(angle) * radius,
    y: center.y + Math.sin(angle) * radius,
  };
}

function midpoint(a: Point, b: Point): Point {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
  };
}

function lerp(a: Point, b: Point, t: number): Point {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
  };
}

function multiplicativeOrder(a: number, n: number): number {
  if (gcd(a, n) !== 1) return 0;
  let value = 1;
  for (let order = 1; order <= n * 2; order++) {
    value = modulo(value * a, n);
    if (value === 1) return order;
  }
  return 0;
}

function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y !== 0) [x, y] = [y, x % y];
  return x;
}

function modulo(value: number, modulus: number): number {
  return ((value % modulus) + modulus) % modulus;
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
