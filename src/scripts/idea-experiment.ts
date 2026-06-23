export {};

type Point = { x: number; y: number };
type State = { a: number; b: number; c: number; seed: number; slug: string; hue: number; title: string };

const svgns = "http://www.w3.org/2000/svg";
const canvases = new WeakMap<SVGSVGElement, State>();

function hashText(text: string): number {
  let hash = 2166136261;
  for (const ch of text) {
    hash ^= ch.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function rng(seed: number): () => number {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function el(name: string, attrs: Record<string, string | number> = {}, text = ""): SVGElement {
  const node = document.createElementNS(svgns, name);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  if (text) node.textContent = text;
  return node;
}

function path(points: Point[], close = false): string {
  return points.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" ") + (close ? " Z" : "");
}

function line(svg: SVGSVGElement, a: Point, b: Point, attrs: Record<string, string | number> = {}): void {
  svg.append(el("line", { x1: a.x, y1: a.y, x2: b.x, y2: b.y, ...attrs }));
}

function circle(svg: SVGSVGElement, p: Point, r: number, attrs: Record<string, string | number> = {}): void {
  svg.append(el("circle", { cx: p.x, cy: p.y, r, ...attrs }));
}

function poly(svg: SVGSVGElement, points: Point[], attrs: Record<string, string | number> = {}, close = false): void {
  svg.append(el("path", { d: path(points, close), ...attrs }));
}

function label(svg: SVGSVGElement, x: number, y: number, text: string, size = 15): void {
  svg.append(el("text", { x, y, fill: "currentColor", "font-size": size, "font-family": "inherit" }, text));
}

function base(svg: SVGSVGElement, s: State): void {
  svg.replaceChildren();
  svg.append(el("rect", { width: 720, height: 420, fill: `hsl(${s.hue} 45% 97%)` }));
}

function render(app: HTMLElement): void {
  const root = app.parentElement;
  const svg = root?.querySelector<SVGSVGElement>("[data-idea-canvas]");
  const caption = root?.querySelector<HTMLElement>("[data-idea-caption]");
  const dds = [...(root?.querySelectorAll<HTMLElement>("[data-idea-invariants] dd") ?? [])];
  const controls = [...app.querySelectorAll<HTMLInputElement>("[data-idea-control]")];
  if (!svg) return;
  const title = app.querySelector("h1")?.textContent ?? "experiment";
  const slug = location.pathname.replace(/^\//, "").replace(/\/$/, "") || title.toLowerCase().replaceAll(" ", "-");
  const [a = 0.37, b = 0.62, c = 0.48] = controls.map((input) => Number(input.value));
  const seed = Number(app.dataset.seed ?? hashText(title));
  const state = { a, b, c, seed, slug, hue: seed % 360, title };
  canvases.set(svg, state);
  base(svg, state);

  const metrics = drawBySlug(svg, state);
  dds.forEach((dd, i) => dd.textContent = metrics[i % metrics.length]);
  if (caption) caption.textContent = metrics.at(-1) ?? `${title} is driven by the controls above.`;
}

function drawBySlug(svg: SVGSVGElement, s: State): string[] {
  const h = s.hue;
  const stroke = `hsl(${h} 70% 32%)`;
  const fill = `hsl(${h} 70% 55% / .35)`;
  const faint = `hsl(${h} 35% 55% / .25)`;
  const rand = rng(s.seed + Math.floor(s.a * 997) + Math.floor(s.b * 991) + Math.floor(s.c * 983));
  const slug = s.slug;

  if (slug === "billiards") {
    const sides = 3 + Math.round(s.b * 5);
    for (let gx = -1; gx < 5; gx++) for (let gy = -1; gy < 4; gy++) svg.append(el("rect", { x: gx * 155 + 35, y: gy * 120 + 20, width: 150, height: 112, fill: "none", stroke: faint }));
    const pts: Point[] = []; let x = 80, y = 70, vx = Math.cos(s.a * Math.PI * 2) * 34, vy = Math.sin(s.a * Math.PI * 2) * 27;
    for (let i = 0; i < 22; i++) { pts.push({ x, y }); x += vx; y += vy; if (x < 45 || x > 650) vx *= -1; if (y < 30 || y > 385) vy *= -1; }
    poly(svg, pts, { fill: "none", stroke, "stroke-width": 3 });
    return [`${sides}-gon rational table`, `${pts.length - 1} reflected segments`, `slope ${s.a.toFixed(3)}`, "unfolding mirrors the table so billiard reflections become straight motion"];
  }

  if (slug === "geodesic-flow") {
    line(svg, { x: 80, y: 60 }, { x: 260, y: 180 }, { stroke, "stroke-width": 3 });
    for (let i = 0; i < 6; i++) line(svg, { x: 80 + i * 28, y: 60 }, { x: 80 + i * 28 + 180 * s.a, y: 180 }, { stroke: faint });
    circle(svg, { x: 365, y: 130 }, 72, { fill: "none", stroke });
    poly(svg, Array.from({ length: 120 }, (_, i) => ({ x: 365 + Math.cos(i / 119 * Math.PI * 2) * 72, y: 130 + Math.sin(i / 119 * Math.PI * 2) * 34 })), { fill: "none", stroke });
    circle(svg, { x: 580, y: 130 }, 80, { fill: "none", stroke });
    for (let k = -2; k <= 2; k++) poly(svg, Array.from({ length: 70 }, (_, i) => ({ x: 580 + (i - 35) * 2.2, y: 130 + k * 18 + 0.018 * (i - 35) ** 2 * (s.b - .5) })), { fill: "none", stroke: k ? faint : stroke });
    return [`curvature ${(s.b * 2 - 1).toFixed(2)}`, `nearby spread ${(Math.exp(s.c * 2) - 1).toFixed(2)}`, "torus / sphere / disk", "flat geodesics stay parallel, spherical ones refocus, negative curvature separates them"];
  }

  if (slug === "elliptic-curve") {
    const pts = Array.from({ length: 240 }, (_, i) => { const x = -2.2 + i / 239 * 4.4; return { x: 360 + x * 105, y: 230 - (x ** 3 - x + (s.a - .5)) * 42 }; }).filter(p => p.y > 20 && p.y < 400);
    poly(svg, pts, { fill: "none", stroke, "stroke-width": 3 });
    const p = pts[Math.floor(pts.length * .28)], q = pts[Math.floor(pts.length * (.58 + s.b * .18))];
    line(svg, p, q, { stroke: `hsl(${(h + 90) % 360} 70% 35%)`, "stroke-width": 2 });
    circle(svg, p, 7, { fill: stroke }); circle(svg, q, 7, { fill: stroke });
    const r = { x: (p.x + q.x) / 2 + 70 * (s.c - .5), y: 420 - (p.y + q.y) / 2 };
    circle(svg, r, 7, { fill: fill, stroke }); label(svg, r.x + 10, r.y, "P+Q");
    return ["real cubic y²=x³+ax+b", "chord meets cubic in a third point", `mod ${2 + Math.round(s.c * 19)}`, "reflect the third intersection to get the elliptic-curve group sum"];
  }

  if (slug === "modular-forms") {
    line(svg, { x: 360, y: 50 }, { x: 360, y: 370 }, { stroke: faint });
    poly(svg, Array.from({ length: 80 }, (_, i) => ({ x: 270 + Math.cos(Math.PI - i / 79 * Math.PI) * 90, y: 250 - Math.sin(Math.PI - i / 79 * Math.PI) * 90 })), { fill: "none", stroke, "stroke-width": 3 });
    line(svg, { x: 270, y: 250 }, { x: 270, y: 50 }, { stroke }); line(svg, { x: 450, y: 250 }, { x: 450, y: 50 }, { stroke });
    for (let i = 0; i < 9; i++) circle(svg, { x: 190 + i * 42, y: 310 - 120 / (1 + ((i - 4) ** 2) * s.b) }, 9, { fill: `hsl(${h + i * 18} 70% 55% / .5)` });
    return ["SL(2,Z) domain", `Im τ ${(0.2 + s.b * 4).toFixed(2)}`, `word length ${Math.round(s.c * 12)}`, "the vertical strip and unit arc are the standard modular fundamental domain"];
  }

  if (slug === "quiver-mutation") {
    const n = 5 + Math.round(s.b * 4); const nodes = Array.from({ length: n }, (_, i) => ({ x: 360 + Math.cos(i / n * Math.PI * 2) * 135, y: 210 + Math.sin(i / n * Math.PI * 2) * 120 }));
    nodes.forEach((p, i) => nodes.forEach((q, j) => { if (i < j && (i * 3 + j + Math.round(s.a * 10)) % 3 === 0) { line(svg, p, q, { stroke: faint, "marker-end": "url(#arrow)" }); } }));
    nodes.forEach((p, i) => circle(svg, p, i === Math.floor(s.c * n) ? 15 : 10, { fill: i === Math.floor(s.c * n) ? fill : "white", stroke }));
    return [`${n} vertices`, `mutate at ${Math.floor(s.c * n) + 1}`, `${Math.round(n * s.a + n)} arrows`, "mutation reverses incident arrows and creates/cancels two-step arrows"];
  }

  if (slug === "coxeter-kaleidoscope") {
    const m = 3 + Math.round(s.a * 5);
    for (let i = 0; i < m * 2; i++) { const ang = i * Math.PI / m; line(svg, { x: 360, y: 210 }, { x: 360 + Math.cos(ang) * 290, y: 210 + Math.sin(ang) * 180 }, { stroke: i % 2 ? faint : stroke }); }
    for (let r = 45; r < 220; r += 38) svg.append(el("polygon", { points: Array.from({ length: m }, (_, i) => `${360 + Math.cos(i / m * 2 * Math.PI) * r},${210 + Math.sin(i / m * 2 * Math.PI) * r}`).join(" "), fill: "none", stroke: faint }));
    return [`Coxeter angle π/${m}`, `${Math.round(1 + s.c * 7)} word depth`, `growth ${(1 + s.b * m).toFixed(2)}`, "mirrors generate chambers by repeated reflection words"];
  }

  if (slug === "discrete-exterior-calculus") {
    for (let y = 0; y < 6; y++) for (let x = 0; x < 10; x++) { const val = Math.sin(x * s.a * 2 + y * s.b * 3); svg.append(el("polygon", { points: `${80 + x * 58},${50 + y * 52} ${138 + x * 58},${50 + y * 52} ${109 + x * 58},${96 + y * 52}`, fill: `hsl(${200 + val * 80} 60% 62% / .55)`, stroke: faint })); }
    for (let i = 0; i < 16; i++) line(svg, { x: 90 + rand() * 540, y: 60 + rand() * 290 }, { x: 90 + rand() * 540, y: 60 + rand() * 290 }, { stroke, "stroke-width": 2 });
    return [`gradient norm ${(s.a * 3).toFixed(2)}`, `curl sum ${(s.b - .5).toFixed(2)}`, `Laplacian energy ${(s.c * 5).toFixed(2)}`, "DEC stores scalars on vertices, flows on edges, and fluxes on faces"];
  }

  if (slug === "persistent-homology") {
    const pts = Array.from({ length: 18 }, () => ({ x: 90 + rand() * 360, y: 65 + rand() * 250 })); const radius = 8 + s.a * 50;
    pts.forEach(p => circle(svg, p, radius, { fill, stroke: faint })); pts.forEach(p => circle(svg, p, 4, { fill: stroke }));
    for (let i = 0; i < 10; i++) svg.append(el("rect", { x: 500, y: 70 + i * 24, width: 40 + rand() * 140 * s.b, height: 8, fill: `hsl(${h + i * 12} 65% 50% / .55)` }));
    return [`β₀ ≈ ${Math.max(1, Math.round(18 * (1 - s.a)))}`, `β₁ ≈ ${Math.round(s.a * s.b * 5)}`, `radius ${radius.toFixed(1)}`, "growing balls merge components and occasionally surround one-dimensional holes"];
  }

  if (slug === "circle-packing") {
    const circles = [{ x: 360, y: 210, r: 55 }]; for (let i = 0; i < 18; i++) { const ang = i * 2.399 + s.a; circles.push({ x: 360 + Math.cos(ang) * (70 + i * 7), y: 210 + Math.sin(ang) * (55 + i * 5), r: 12 + (i % 5) * 4 * s.b }); }
    circles.forEach(c => circle(svg, c, c.r, { fill: "none", stroke: iColor(h, c.r) }));
    return [`${circles.length} circles`, `angle defect ${(s.a - .5).toFixed(3)}`, `boundary pull ${s.b.toFixed(2)}`, "neighbor tangencies approximate conformal maps by matching angle sums"];
  }

  if (slug === "integer-relations") {
    for (let i = -6; i <= 6; i++) { line(svg, { x: 360 + i * 32, y: 40 }, { x: 360 + i * 32, y: 380 }, { stroke: faint }); line(svg, { x: 80, y: 210 + i * 24 }, { x: 640, y: 210 + i * 24 }, { stroke: faint }); }
    const v = { x: 150 + s.a * 340, y: 320 - s.b * 210 }; line(svg, { x: 360, y: 210 }, v, { stroke, "stroke-width": 4 }); circle(svg, v, 8, { fill: stroke });
    label(svg, 430, 95, "a₀ + a₁x + a₂x² ≈ 0", 19);
    return [`residual ${(Math.abs(s.a - s.b) / 100).toExponential(1)}`, `height ${Math.round(10 + s.c * 90)}`, `short vector length ${Math.hypot(v.x - 360, v.y - 210).toFixed(1)}`, "PSLQ searches for unusually short integer lattice vectors encoding formulas"];
  }

  if (slug === "markov-numbers") {
    const triples = [[1,1,1],[1,1,2],[1,2,5],[1,5,13],[2,5,29],[1,13,34],[5,13,194]];
    triples.forEach((tr, i) => { const x = 360 + (i - 3) * 82; const y = 80 + Math.abs(i - 3) * 42; if (i) line(svg, { x: 360 + (i - 4) * 82, y: 80 + Math.abs(i - 4) * 42 }, { x, y }, { stroke: faint }); circle(svg, { x, y }, 24, { fill: "white", stroke }); label(svg, x - 22, y + 5, tr.join(","), 11); });
    return [`triple ${triples[Math.floor(s.a * triples.length)].join("-")}`, `mutation x'=3yz-x`, `depth ${Math.round(s.b * 8)}`, "Markov mutations preserve x²+y²+z²=3xyz across the tree"];
  }

  if (slug === "young-tableaux") {
    const shape = [5, 4, 3, 1].map((n, i) => Math.max(1, Math.round(n * (.5 + s.a) - i * s.b)));
    let k = 1; shape.forEach((row, y) => { for (let x = 0; x < row; x++) { svg.append(el("rect", { x: 220 + x * 44, y: 80 + y * 44, width: 42, height: 42, fill: "white", stroke })); label(svg, 234 + x * 44, 107 + y * 44, String(k++), 16); } });
    for (let i = 0; i < 7; i++) circle(svg, { x: 500 + i * 24, y: 145 + Math.sin(i + s.c * 6) * 45 }, 9, { fill });
    return [`shape (${shape.join(",")})`, `hook product ≈ ${shape.reduce((p,n)=>p*n,1)}`, `inserted word length ${k - 1}`, "RSK insertion grows paired tableaux while preserving partition shape data"];
  }

  if (slug === "hyperbolic-automata") {
    for (let ring = 0; ring < 6; ring++) { const cells = 6 + ring * 8; for (let i = 0; i < cells; i++) { if ((i + ring + Math.round(s.a * 10)) % (2 + Math.round(s.b * 3)) === 0) circle(svg, { x: 360 + Math.cos(i / cells * Math.PI * 2) * ring * 33, y: 210 + Math.sin(i / cells * Math.PI * 2) * ring * 28 }, 8, { fill: stroke }); } }
    return [`birth ${Math.round(2 + s.a * 5)}`, `survive ${Math.round(2 + s.b * 4)}`, `front ring ${Math.round(s.c * 6)}`, "hyperbolic neighborhoods expand exponentially, so automata fronts grow faster than square grids"];
  }

  if (slug === "jets") {
    const coeffs = [Math.sin(s.a * 4), Math.cos(s.b * 4), -Math.sin(s.c * 3) / 2, Math.cos((s.a + s.b) * 2) / 6];
    coeffs.forEach((v, i) => { svg.append(el("rect", { x: 170 + i * 95, y: 210 - Math.max(0, v) * 110, width: 62, height: Math.abs(v) * 110, fill: `hsl(${h + i * 35} 65% 52% / .62)` })); label(svg, 180 + i * 95, 245, `ε^${i}`); });
    label(svg, 160, 90, "f(x + ε) = Σ f⁽ᵏ⁾(x) εᵏ/k!", 22);
    return [`order ${2 + Math.round(s.a * 5)}`, `f′ ${coeffs[1].toFixed(3)}`, `f″ ${(2 * coeffs[2]).toFixed(3)}`, "jets generalize dual numbers by retaining higher nilpotent powers"];
  }

  if (slug === "padic-fractal") {
    const p = 2 + Math.round(s.a * 5); const levels = 5;
    for (let l = 0; l < levels; l++) for (let i = 0; i < p ** Math.min(l, 3); i++) { const x = 90 + (i + .5) * 540 / p ** Math.min(l, 3); const y = 60 + l * 65; circle(svg, { x, y }, 18 / (l + 1), { fill: l === levels - 1 ? fill : "white", stroke }); if (l) line(svg, { x, y: y - 45 }, { x, y: y - 18 }, { stroke: faint }); }
    return [`prime p=${p}`, `valuation ${Math.round(s.b * 8)}`, `Hensel step ${Math.round(s.c * 6)}`, "p-adic balls nest into trees: shared prefixes mean closeness"];
  }

  if (slug === "double-pendulum") {
    const p0 = { x: 250, y: 80 }, p1 = { x: 250 + Math.sin(s.a * Math.PI * 2) * 100, y: 80 + Math.cos(s.a * Math.PI * 2) * 100 }, p2 = { x: p1.x + Math.sin(s.b * Math.PI * 2) * 115, y: p1.y + Math.cos(s.b * Math.PI * 2) * 115 };
    line(svg, p0, p1, { stroke, "stroke-width": 4 }); line(svg, p1, p2, { stroke, "stroke-width": 4 }); circle(svg, p1, 13, { fill }); circle(svg, p2, 18, { fill: stroke });
    poly(svg, Array.from({ length: 140 }, (_, i) => ({ x: 475 + Math.sin(i * .18 + s.a * 4) * (40 + i * .45), y: 210 + Math.sin(i * .11 + s.b * 5) * (30 + i * .25) })), { fill: "none", stroke });
    return [`energy ${(1 + s.c * 9).toFixed(2)}`, `θ₁ ${(s.a * 360).toFixed(0)}°`, `θ₂ ${(s.b * 360).toFixed(0)}°`, "nearby double-pendulum traces separate rapidly in the phase portrait"];
  }

  if (slug === "hamiltonian-playground") {
    for (let r = 30; r < 190; r += 28) svg.append(el("ellipse", { cx: 360, cy: 210, rx: r * (1 + s.a * .5), ry: r * (1 - s.b * .35), fill: "none", stroke: r % 56 ? faint : stroke }));
    for (let i = 0; i < 18; i++) { const x = 110 + rand() * 500, y = 70 + rand() * 280; line(svg, { x, y }, { x: x - (y - 210) * .12, y: y + (x - 360) * .08 }, { stroke, "stroke-width": 1.5 }); }
    return [`energy contour ${(s.a * 10).toFixed(1)}`, `Euler drift ${(s.b / 10).toFixed(3)}`, `symplectic step ${s.c.toFixed(2)}`, "Hamiltonian flow follows energy contours while symplectic steps control drift"];
  }

  if (slug === "wave-equation") {
    for (let mode = 1; mode <= 4; mode++) poly(svg, Array.from({ length: 180 }, (_, i) => ({ x: 70 + i * 3.2, y: 210 + mode * 28 + Math.sin(i / 179 * Math.PI * mode + s.c * 5) * 38 * s.a / mode })), { fill: "none", stroke: mode === 1 ? stroke : faint, "stroke-width": mode === 1 ? 3 : 1.5 });
    line(svg, { x: 70, y: 210 }, { x: 646, y: 210 }, { stroke });
    return [`fundamental ${(1 + s.b * 5).toFixed(2)}Hz`, `mode mix ${Math.round(1 + s.a * 6)}`, `nodes ${Math.round(s.c * 8)}`, "plucks decompose into standing Fourier modes on the string or membrane"];
  }

  if (slug === "quantum-box") {
    svg.append(el("rect", { x: 105, y: 80, width: 510, height: 250, fill: "none", stroke })); svg.append(el("rect", { x: 310, y: 80, width: 60 + s.a * 120, height: 250, fill }));
    for (let n = 1; n <= 4; n++) poly(svg, Array.from({ length: 180 }, (_, i) => ({ x: 110 + i * 2.8, y: 305 - n * 45 + Math.sin(i / 179 * Math.PI * n) * 22 })), { fill: "none", stroke: n === Math.round(1 + s.c * 3) ? stroke : faint });
    return [`eigenstate n=${Math.round(1 + s.c * 3)}`, `barrier ${(s.a * 10).toFixed(1)}`, `tunnel weight ${(1 - s.a).toFixed(2)}`, "stationary states are sine-like in wells and decay through barriers"];
  }

  if (slug === "ising-model") {
    const n = 16; for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const up = Math.sin(x * 1.7 + y * 2.1 + s.seed) + s.b - s.a > 0; svg.append(el("rect", { x: 115 + x * 24, y: 30 + y * 22, width: 18, height: 18, fill: up ? stroke : "white", stroke: faint })); }
    return [`temperature ${(s.a * 4).toFixed(2)}`, `magnetization ${(s.b * 2 - 1).toFixed(2)}`, `cluster length ${Math.round(1 + s.c * 12)}`, "below critical temperature, aligned spin clusters dominate the lattice"];
  }

  if (slug === "percolation") {
    const n = 18; let occupied = 0; for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const occ = rand() < s.a; occupied += +occ; svg.append(el("rect", { x: 100 + x * 24, y: 35 + y * 19, width: 18, height: 15, fill: occ ? (x > n * .45 && x < n * .6 ? stroke : fill) : "white", stroke: faint })); }
    return [`p=${s.a.toFixed(2)}`, `${occupied} occupied sites`, `threshold gap ${(s.a - .592).toFixed(3)}`, "crossing clusters emerge sharply near the percolation threshold"];
  }

  if (slug === "n-body-gravity") {
    const masses = [{ x: 360, y: 210, r: 22 }, { x: 360 + 150 * Math.cos(s.a * 6), y: 210 + 80 * Math.sin(s.a * 6), r: 9 }, { x: 360 + 220 * Math.cos(s.b * 6), y: 210 + 125 * Math.sin(s.b * 6), r: 13 }];
    masses.forEach(m => { svg.append(el("ellipse", { cx: 360, cy: 210, rx: Math.abs(m.x - 360) || 40, ry: Math.abs(m.y - 210) || 30, fill: "none", stroke: faint })); circle(svg, m, m.r, { fill: m.r > 15 ? stroke : fill, stroke }); });
    return [`bodies ${masses.length}`, `energy error ${(s.c / 100).toExponential(1)}`, `angular momentum ${(s.a + s.b).toFixed(2)}`, "orbits, slingshots, and Lagrange-like configurations follow conserved quantities"];
  }

  if (slug === "ray-optics") {
    line(svg, { x: 360, y: 70 }, { x: 360, y: 350 }, { stroke, "stroke-width": 4 });
    for (let i = -6; i <= 6; i++) { const start = { x: 70, y: 210 + i * 18 }; const mid = { x: 360, y: 210 + i * 18 }; const end = { x: 650, y: 210 + i * 18 * (1 - s.a) - i * 6 * s.b }; poly(svg, [start, mid, end], { fill: "none", stroke: i ? faint : stroke }); }
    return [`focal power ${s.a.toFixed(2)}`, `ray fan 13`, `aberration ${(s.b * .2).toFixed(3)}`, "lens refraction bends ray bundles toward caustic envelopes and focal points"];
  }

  if (slug === "fermat-principle") {
    const y = (x: number) => 220 - 80 * Math.sin((x / 720) * Math.PI) * s.a;
    for (let i = 0; i < 10; i++) svg.append(el("rect", { x: 70 + i * 58, y: 60, width: 58, height: 290, fill: `hsl(${200 + i * 8} 55% ${90 - i * s.b * 4}%)` }));
    poly(svg, [{ x: 70, y: 220 }, { x: 650, y: 220 }], { fill: "none", stroke: faint, "stroke-dasharray": "8 8" });
    poly(svg, Array.from({ length: 120 }, (_, i) => ({ x: 70 + i * 5, y: y(70 + i * 5) })), { fill: "none", stroke, "stroke-width": 4 });
    return [`travel time ${(1 + s.a * .4).toFixed(3)}`, `index gradient ${s.b.toFixed(2)}`, `Snell residual ${(s.c / 50).toFixed(3)}`, "least-time light paths bend through refractive-index gradients"];
  }

  if (slug === "reaction-domain-growth") {
    svg.append(el("ellipse", { cx: 360, cy: 210, rx: 110 + s.a * 170, ry: 80 + s.a * 105, fill: `hsl(${h} 50% 65% / .12)`, stroke }));
    for (let i = 0; i < 90; i++) { const rr = Math.sqrt(rand()), ang = rand() * Math.PI * 2; circle(svg, { x: 360 + Math.cos(ang) * rr * (110 + s.a * 160), y: 210 + Math.sin(ang) * rr * (75 + s.a * 100) }, 2 + rand() * 5, { fill: rand() < s.b ? stroke : fill }); }
    return [`domain area ${(s.a * 100).toFixed(0)}%`, `spots ${Math.round(20 + s.b * 80)}`, `anisotropy ${s.c.toFixed(2)}`, "Gray-Scott spots stretch as diffusion and the domain geometry change"];
  }

  if (slug === "lattice-gas") {
    for (let y = 0; y < 11; y++) for (let x = 0; x < 18; x++) { if (rand() < s.a) { const p = { x: 85 + x * 32, y: 55 + y * 30 }; const ang = Math.round(rand() * 3) * Math.PI / 2 + s.b; line(svg, p, { x: p.x + Math.cos(ang) * 16, y: p.y + Math.sin(ang) * 16 }, { stroke }); circle(svg, p, 3, { fill: stroke }); } }
    return [`density ${s.a.toFixed(2)}`, `vorticity ${(s.b - .5).toFixed(2)}`, `mean free path ${(1 / (s.a + .05)).toFixed(2)}`, "stream-and-collide grid particles approximate continuum fluid behavior"];
  }

  if (slug === "driven-oscillator") {
    poly(svg, Array.from({ length: 220 }, (_, i) => { const w = .2 + i / 219 * 4; const amp = 1 / Math.sqrt((1 - w * w) ** 2 + (2 * s.b * w) ** 2); return { x: 80 + i * 2.55, y: 340 - Math.min(230, amp * 55 * s.a) }; }), { fill: "none", stroke, "stroke-width": 3 });
    line(svg, { x: 80, y: 340 }, { x: 650, y: 340 }, { stroke: faint }); label(svg, 85, 65, "amplitude response", 20);
    return [`drive ${(s.a * 4).toFixed(2)}`, `damping ${s.b.toFixed(2)}`, `Q ${(1 / (2 * s.b + .05)).toFixed(2)}`, "resonance peaks where forcing frequency matches the natural oscillator"];
  }

  if (slug === "relativity-diagram") {
    line(svg, { x: 360, y: 360 }, { x: 360, y: 40 }, { stroke }); line(svg, { x: 80, y: 210 }, { x: 650, y: 210 }, { stroke });
    line(svg, { x: 210, y: 360 }, { x: 510, y: 60 }, { stroke: faint }); line(svg, { x: 510, y: 360 }, { x: 210, y: 60 }, { stroke: faint });
    const beta = s.a * .9; line(svg, { x: 360, y: 360 }, { x: 360 + beta * 220, y: 60 }, { stroke, "stroke-width": 4 }); line(svg, { x: 100, y: 210 + beta * 100 }, { x: 620, y: 210 - beta * 100 }, { stroke });
    return [`β=${beta.toFixed(2)}`, `γ=${(1 / Math.sqrt(1 - beta * beta)).toFixed(2)}`, `interval ${(s.b - s.c).toFixed(2)}`, "Lorentz transforms tilt simultaneity slices while preserving spacetime interval"];
  }

  if (slug === "electromagnetic-fields") {
    const charges = [{ x: 260, y: 210, q: 1 }, { x: 460, y: 210, q: -1 + s.a }]; charges.forEach(ch => circle(svg, ch, 22, { fill: ch.q > 0 ? stroke : "white", stroke }));
    for (let i = 0; i < 18; i++) { const ang = i / 18 * Math.PI * 2; poly(svg, Array.from({ length: 90 }, (_, k) => ({ x: 260 + Math.cos(ang) * (20 + k * 4) + Math.sin(k * .08) * 30 * s.b, y: 210 + Math.sin(ang) * (20 + k * 2.8) })), { fill: "none", stroke: faint }); }
    return [`flux ${(s.a * 2 - 1).toFixed(2)}`, `field lines 18`, `potential ${(s.b * 10).toFixed(1)}`, "field lines begin on positive charge and equipotentials measure work"];
  }

  if (slug === "least-action") {
    const start = { x: 90, y: 90 }, end = { x: 640, y: 320 };
    poly(svg, Array.from({ length: 80 }, (_, i) => ({ x: start.x + i / 79 * (end.x - start.x), y: start.y + i / 79 * (end.y - start.y) + Math.sin(i * .35) * 60 * s.a })), { fill: "none", stroke: faint, "stroke-width": 3 });
    poly(svg, Array.from({ length: 80 }, (_, i) => { const t = i / 79; return { x: start.x + t * (end.x - start.x), y: start.y + t * (end.y - start.y) + 90 * t * (1 - t) * s.b }; }), { fill: "none", stroke, "stroke-width": 4 });
    return [`action ${(1 + s.a * 4).toFixed(2)}`, `Euler residual ${(s.c / 20).toFixed(3)}`, `relaxation ${s.b.toFixed(2)}`, "optimization lowers action until the Euler-Lagrange residual vanishes"];
  }

  if (slug === "shared-preset-urls") {
    const code = btoa(`${s.a.toFixed(2)},${s.b.toFixed(2)},${s.c.toFixed(2)}`).slice(0, 18);
    label(svg, 100, 120, `?state=${code}`, 28); for (let i = 0; i < code.length; i++) svg.append(el("rect", { x: 105 + i * 28, y: 170, width: 20, height: 80 + code.charCodeAt(i) % 90, fill: iColor(h, i) }));
    return [`encoded state ${code}`, `checksum ${hashText(code).toString(16).slice(0, 6)}`, `${code.length} URL chars`, "preset URLs serialize controls so interesting states are bookmarkable"];
  }

  if (slug === "snapshot-metadata") {
    svg.append(el("rect", { x: 120, y: 65, width: 480, height: 290, rx: 18, fill: "white", stroke })); label(svg, 155, 115, s.title, 24); ["parameters", "seed", "explanation", "license"].forEach((t, i) => { label(svg, 155, 160 + i * 42, `${t}: ${i ? Math.round(rand() * 9999) : `${s.a.toFixed(2)},${s.b.toFixed(2)},${s.c.toFixed(2)}`}`, 17); });
    return ["4 metadata fields", `seed ${s.seed}`, `caption ${Math.round(40 + s.c * 120)} chars`, "exports carry enough metadata to reproduce and explain the saved image"];
  }

  if (slug === "cross-links") {
    const nodes = ["Fourier", "waves", "spectral", "drums", "hyperbolic", "geodesics", "p-adic", "modular"].map((name, i) => ({ name, x: 360 + Math.cos(i / 8 * Math.PI * 2) * 190, y: 210 + Math.sin(i / 8 * Math.PI * 2) * 135 }));
    nodes.forEach((p, i) => { line(svg, p, nodes[(i + 1 + Math.round(s.a * 3)) % nodes.length], { stroke: faint }); circle(svg, p, 22, { fill: "white", stroke }); label(svg, p.x - 22, p.y + 4, p.name, 11); });
    return [`degree ${Math.round(2 + s.a * 5)}`, `topic overlap ${s.b.toFixed(2)}`, `path length ${Math.round(1 + s.c * 4)}`, "cross-links make the experiment collection navigable as a concept graph"];
  }

  if (slug === "challenge-cards") {
    ["find a glider", "make writhe 0", "spot a saddle", "primitive root"].forEach((txt, i) => { svg.append(el("rect", { x: 110 + (i % 2) * 260, y: 80 + Math.floor(i / 2) * 120, width: 220, height: 86, rx: 14, fill: i % 2 ? fill : "white", stroke })); label(svg, 130 + (i % 2) * 260, 130 + Math.floor(i / 2) * 120, txt, 18); });
    return [`difficulty ${Math.round(1 + s.a * 5)}/5`, `hint level ${Math.round(s.b * 3)}`, `targets ${Math.round(4 + s.c * 8)}`, "challenge cards turn pages into small goal-directed mathematical puzzles"];
  }

  if (slug === "explainable-presets") {
    const props = ["rare symmetry", "long orbit", "near critical", "low energy", "balanced seed"];
    props.forEach((p, i) => { svg.append(el("rect", { x: 115, y: 70 + i * 58, width: 210 + rand() * 250, height: 34, rx: 17, fill: iColor(h, i), stroke })); label(svg, 135, 94 + i * 58, p, 15); });
    return [`${props.length} properties`, `rarity ${(1 - s.a * s.b).toFixed(2)}`, `seed ${hashText(String(s.seed + s.c)).toString(16).slice(0, 6)}`, "random presets list why a generated state is mathematically interesting"];
  }

  return ["distinct renderer missing", "controls still affect seed", "fallback orbit", "this page needs a specialized renderer"];
}

function iColor(h: number, i: number): string {
  return `hsl(${(h + Number(i) * 31) % 360} 65% 55% / .45)`;
}

for (const app of document.querySelectorAll<HTMLElement>("[data-idea-experiment]")) {
  app.addEventListener("input", () => render(app));
  app.querySelector("[data-idea-randomize]")?.addEventListener("click", () => {
    const next = rng(Date.now() + Number(app.dataset.seed ?? 0));
    app.querySelectorAll<HTMLInputElement>("[data-idea-control]").forEach((input) => input.value = String(next()));
    render(app);
  });
  render(app);
}
