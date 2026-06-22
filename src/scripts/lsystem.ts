export {};

interface Preset {
  axiom: string;
  rules: string;
  angle: number;
  iterations: number;
  heading: number;
}

interface Elements {
  form: HTMLFormElement;
  preset: HTMLSelectElement;
  axiom: HTMLInputElement;
  rules: HTMLTextAreaElement;
  iterations: HTMLInputElement;
  angle: HTMLInputElement;
  summary: HTMLElement;
  plot: SVGSVGElement;
  download: HTMLButtonElement;
  grow: HTMLButtonElement;
}

interface TurtleState {
  x: number;
  y: number;
  heading: number;
}

interface RenderedPath {
  path: string;
  segments: number;
  bounds: Bounds;
}

interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

const MAX_EXPANSION = 160_000;
const PRESETS: Record<string, Preset> = {
  koch: {
    axiom: "F--F--F",
    rules: "F=F+F--F+F",
    angle: 60,
    iterations: 4,
    heading: 0,
  },
  dragon: {
    axiom: "FX",
    rules: "X=X+YF+\nY=-FX-Y",
    angle: 90,
    iterations: 10,
    heading: 0,
  },
  sierpinski: {
    axiom: "A",
    rules: "A=B-A-B\nB=A+B+A",
    angle: 60,
    iterations: 7,
    heading: 0,
  },
  plant: {
    axiom: "X",
    rules: "X=F+[[X]-X]-F[-FX]+X\nF=FF",
    angle: 25,
    iterations: 5,
    heading: -90,
  },
};

initWhenReady();

function initWhenReady() {
  const elements = getElements();
  if (elements) {
    init(elements);
    return;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      const elements = getElements();
      if (elements) init(elements);
    }, { once: true });
  }
}

function getElements(): Elements | null {
  const form = document.querySelector<HTMLFormElement>("#lsystem-form");
  const preset = document.querySelector<HTMLSelectElement>("#lsystem-preset");
  const axiom = document.querySelector<HTMLInputElement>("#lsystem-axiom");
  const rules = document.querySelector<HTMLTextAreaElement>("#lsystem-rules");
  const iterations = document.querySelector<HTMLInputElement>("#lsystem-iterations");
  const angle = document.querySelector<HTMLInputElement>("#lsystem-angle");
  const summary = document.querySelector<HTMLElement>("#lsystem-summary");
  const plot = document.querySelector<SVGSVGElement>("#lsystem-plot");
  const download = document.querySelector<HTMLButtonElement>("#lsystem-download");
  const grow = document.querySelector<HTMLButtonElement>("#lsystem-grow");

  if (!form || !preset || !axiom || !rules || !iterations || !angle || !summary || !plot || !download || !grow) return null;
  return { form, preset, axiom, rules, iterations, angle, summary, plot, download, grow };
}

function init(elements: Elements) {
  applyPreset(elements, "koch");
  elements.form.addEventListener("submit", (event) => {
    event.preventDefault();
    render(elements);
  });
  elements.grow.addEventListener("click", () => render(elements));
  elements.preset.addEventListener("change", () => {
    applyPreset(elements, elements.preset.value);
    render(elements);
  });
  [elements.axiom, elements.rules, elements.iterations, elements.angle].forEach((input) => input.addEventListener("input", () => render(elements)));
  elements.download.addEventListener("click", async () => {
    await navigator.clipboard?.writeText(elements.plot.outerHTML);
    elements.download.textContent = "copied";
    setTimeout(() => { elements.download.textContent = "copy svg"; }, 900);
  });
  render(elements);
}

function applyPreset(elements: Elements, key: string) {
  const preset = PRESETS[key] ?? PRESETS.koch;
  elements.axiom.value = preset.axiom;
  elements.rules.value = preset.rules;
  elements.angle.value = String(preset.angle);
  elements.iterations.value = String(preset.iterations);
}

function render(elements: Elements) {
  try {
    const axiom = elements.axiom.value.trim() || "F";
    const rules = parseRules(elements.rules.value);
    const iterations = readInt(elements.iterations.value, 0, 10, 4);
    const angle = readNumber(elements.angle.value, 1, 180, 60);
    const heading = (PRESETS[elements.preset.value] ?? PRESETS.koch).heading;
    elements.iterations.value = String(iterations);
    elements.angle.value = String(angle);

    const expanded = expand(axiom, rules, iterations);
    const rendered = renderTurtle(expanded, angle, heading);
    draw(elements.plot, rendered, expanded.length, angle);
    elements.summary.innerHTML = `
      <p><strong>${iterations}</strong> iterations · <strong>${expanded.length.toLocaleString()}</strong> symbols · <strong>${rendered.segments.toLocaleString()}</strong> drawn segments</p>
      <p>rules: ${[...rules.entries()].map(([key, value]) => `${escapeHtml(key)}→${escapeHtml(value)}`).join(", ") || "none"}</p>
    `;
  } catch (error) {
    elements.summary.innerHTML = `<p>${escapeHtml(error instanceof Error ? error.message : String(error))}</p>`;
  }
}

function parseRules(text: string): Map<string, string> {
  const rules = new Map<string, string>();
  text.split("\n").map((line) => line.trim()).filter(Boolean).forEach((line) => {
    const separator = line.includes("=") ? "=" : "→";
    const [left, ...rest] = line.split(separator);
    const key = left?.trim();
    const value = rest.join(separator).trim();
    if (!key || key.length !== 1) throw new Error(`invalid rule: ${line}`);
    rules.set(key, value);
  });
  return rules;
}

function expand(axiom: string, rules: Map<string, string>, iterations: number): string {
  let current = axiom;
  for (let step = 0; step < iterations; step++) {
    let next = "";
    for (const symbol of current) {
      next += rules.get(symbol) ?? symbol;
      if (next.length > MAX_EXPANSION) throw new Error(`expansion stopped above ${MAX_EXPANSION.toLocaleString()} symbols`);
    }
    current = next;
  }
  return current;
}

function renderTurtle(commands: string, angleDegrees: number, headingDegrees: number): RenderedPath {
  const stack: TurtleState[] = [];
  const state: TurtleState = { x: 0, y: 0, heading: (headingDegrees * Math.PI) / 180 };
  const turn = (angleDegrees * Math.PI) / 180;
  const bounds = createBounds(state.x, state.y);
  const pathParts = [`M${format(state.x)} ${format(state.y)}`];
  let segments = 0;

  for (const command of commands) {
    if (command === "F" || command === "G" || command === "A" || command === "B") {
      state.x += Math.cos(state.heading);
      state.y += Math.sin(state.heading);
      extendBounds(bounds, state.x, state.y);
      pathParts.push(`L${format(state.x)} ${format(state.y)}`);
      segments++;
    } else if (command === "f") {
      state.x += Math.cos(state.heading);
      state.y += Math.sin(state.heading);
      extendBounds(bounds, state.x, state.y);
      pathParts.push(`M${format(state.x)} ${format(state.y)}`);
    } else if (command === "+") {
      state.heading += turn;
    } else if (command === "-") {
      state.heading -= turn;
    } else if (command === "|") {
      state.heading += Math.PI;
    } else if (command === "[") {
      stack.push({ ...state });
    } else if (command === "]") {
      const previous = stack.pop();
      if (previous) {
        state.x = previous.x;
        state.y = previous.y;
        state.heading = previous.heading;
        pathParts.push(`M${format(state.x)} ${format(state.y)}`);
      }
    }
  }

  return { path: pathParts.join(" "), segments, bounds };
}

function draw(plot: SVGSVGElement, rendered: RenderedPath, symbolCount: number, angle: number) {
  const pad = 2;
  const width = rendered.bounds.maxX - rendered.bounds.minX || 1;
  const height = rendered.bounds.maxY - rendered.bounds.minY || 1;
  const lineWidth = Math.max(width, height) / 520;
  const labelSize = Math.max(lineWidth * 10, 0.45);
  const frameX = rendered.bounds.minX - pad;
  const frameY = rendered.bounds.minY - pad;
  const viewBox = [frameX, frameY, width + pad * 2, height + pad * 2].map(format).join(" ");
  plot.setAttribute("viewBox", viewBox);
  plot.innerHTML = `
    ${svg("rect", { class: "lsystem-frame", x: frameX, y: frameY, width: width + pad * 2, height: height + pad * 2, "stroke-width": lineWidth })}
    ${svg("path", { class: "lsystem-path", d: rendered.path, "stroke-width": lineWidth })}
    ${svg("text", { class: "lsystem-label", x: frameX + labelSize * 0.75, y: frameY + labelSize * 1.35, "font-size": labelSize }, `${symbolCount.toLocaleString()} symbols · ${angle}°`)}
  `;
}

function createBounds(x: number, y: number): Bounds {
  return { minX: x, minY: y, maxX: x, maxY: y };
}

function extendBounds(bounds: Bounds, x: number, y: number) {
  bounds.minX = Math.min(bounds.minX, x);
  bounds.minY = Math.min(bounds.minY, y);
  bounds.maxX = Math.max(bounds.maxX, x);
  bounds.maxY = Math.max(bounds.maxY, y);
}

function readInt(value: string, min: number, max: number, fallback: number): number {
  const number = Number.parseInt(value, 10);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, number));
}

function readNumber(value: string, min: number, max: number, fallback: number): number {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, number));
}

function format(value: number): string {
  return value.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
}

function svg(tag: string, attrs: Record<string, string | number>, children = ""): string {
  const attrText = Object.entries(attrs).map(([key, value]) => `${key}="${escapeHtml(String(value))}"`).join(" ");
  return `<${tag} ${attrText}>${children}</${tag}>`;
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character]!);
}
