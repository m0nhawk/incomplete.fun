export {};

const svgns = "http://www.w3.org/2000/svg";

function hashText(text: string): number {
  let hash = 2166136261;
  for (const ch of text) {
    hash ^= ch.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function el(name: string, attrs: Record<string, string | number> = {}): SVGElement {
  const node = document.createElementNS(svgns, name);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  return node;
}

function pointPath(points: { x: number; y: number }[], close = false): string {
  return points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" ") + (close ? " Z" : "");
}

function fmt(n: number): string {
  return n.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
}

function render(app: HTMLElement): void {
  const svg = app.parentElement?.querySelector<SVGSVGElement>("[data-idea-canvas]");
  const caption = app.parentElement?.querySelector<HTMLElement>("[data-idea-caption]");
  const dds = [...(app.parentElement?.querySelectorAll<HTMLElement>("[data-idea-invariants] dd") ?? [])];
  const controls = [...app.querySelectorAll<HTMLInputElement>("[data-idea-control]")];
  if (!svg) return;
  const [a = 0.4, b = 0.6, c = 0.5] = controls.map((input) => Number(input.value));
  const title = app.querySelector("h1")?.textContent ?? "experiment";
  const kind = app.dataset.kind ?? "math";
  const seed = Number(app.dataset.seed ?? hashText(title));
  const rng = mulberry32(seed + Math.floor(a * 1000) * 31 + Math.floor(b * 1000) * 17 + Math.floor(c * 1000) * 13);
  svg.replaceChildren();

  const hue = (seed + (kind === "physics" ? 80 : kind === "extension" ? 155 : 0)) % 360;
  svg.append(el("rect", { width: 720, height: 420, fill: `hsl(${hue} 55% 96%)` }));
  for (let i = 0; i < 18; i++) {
    const x = 40 + i * 38;
    svg.append(el("line", { x1: x, y1: 0, x2: x - 130 * b, y2: 420, stroke: `hsl(${hue} 25% 80%)`, "stroke-width": 1 }));
  }

  const cx = 360;
  const cy = 210;
  const loops = 3 + Math.floor(seed % 5);
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < 240; i++) {
    const t = (i / 239) * Math.PI * 2 * loops;
    const radius = 36 + 148 * (0.35 + 0.65 * i / 239) * (0.7 + 0.3 * Math.sin(t * (1 + b * 3) + seed));
    pts.push({ x: cx + radius * Math.cos(t + a * Math.PI * 2), y: cy + radius * Math.sin(t * (0.55 + c) + b * 2) });
  }
  svg.append(el("path", { d: pointPath(pts), fill: "none", stroke: `hsl(${hue} 75% 38%)`, "stroke-width": 3, "stroke-linecap": "round" }));

  const n = 5 + Math.floor(12 * b);
  for (let i = 0; i < n; i++) {
    const angle = (i / n) * Math.PI * 2 + c * 6;
    const r = 70 + 120 * rng();
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    svg.append(el("line", { x1: cx, y1: cy, x2: x, y2: y, stroke: `hsl(${(hue + 45) % 360} 70% 45% / 0.38)`, "stroke-width": 1.5 }));
    svg.append(el("circle", { cx: x, cy: y, r: 5 + 13 * rng(), fill: `hsl(${(hue + 130 * rng()) % 360} 70% 55% / 0.72)` }));
  }

  const poly = Array.from({ length: 3 + (seed % 6) }, (_, i) => {
    const angle = (i / (3 + (seed % 6))) * Math.PI * 2 + a * 2;
    return { x: cx + Math.cos(angle) * (42 + 70 * c), y: cy + Math.sin(angle) * (42 + 70 * c) };
  });
  svg.append(el("path", { d: pointPath(poly, true), fill: `hsl(${hue} 80% 58% / 0.16)`, stroke: `hsl(${hue} 75% 30%)`, "stroke-width": 2 }));
  svg.append(el("text", { x: 24, y: 392, fill: `hsl(${hue} 45% 24%)`, "font-size": 18 }));
  svg.lastElementChild!.textContent = `${title}: seed ${seed}`;

  const energy = Math.abs(Math.sin(seed + a * 5) + Math.cos(b * 7) + c).toFixed(3);
  const orbit = Math.round(loops * n * (1 + c));
  const symmetry = Math.max(2, Math.round((seed % 9) + a * 5));
  const values = [`energy-like score ${energy}`, `${orbit} sampled orbit points`, `${symmetry}-fold visible symmetry`, `preset hash ${hashText(title + a + b + c).toString(16).slice(0, 6)}`];
  dds.forEach((dd, i) => dd.textContent = values[i % values.length]);
  if (caption) caption.textContent = `This compact model turns the idea into a manipulable orbit: ${n} markers, ${loops} turns, and parameters (${fmt(a)}, ${fmt(b)}, ${fmt(c)}).`;
}

for (const app of document.querySelectorAll<HTMLElement>("[data-idea-experiment]")) {
  app.addEventListener("input", () => render(app));
  app.querySelector("[data-idea-randomize]")?.addEventListener("click", () => {
    const seed = hashText(`${Date.now()}-${app.dataset.seed}`);
    const rng = mulberry32(seed);
    app.querySelectorAll<HTMLInputElement>("[data-idea-control]").forEach((input) => input.value = String(rng()));
    render(app);
  });
  render(app);
}
