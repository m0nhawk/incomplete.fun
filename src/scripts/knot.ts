export {};

type Point = { x: number; y: number };
type Crossing = { i: number; j: number; p: Point; sign: 1 | -1; over: number };

const canvas = document.querySelector<HTMLCanvasElement>("#knot-canvas");
const stats = document.querySelector<HTMLElement>("#knot-stats");
const crossingBox = document.querySelector<HTMLElement>("#knot-crossings");
const polyBox = document.querySelector<HTMLElement>("#knot-polys");
const status = document.querySelector<HTMLElement>("#knot-status");
const clearButton = document.querySelector<HTMLButtonElement>("#knot-clear");
const circleButton = document.querySelector<HTMLButtonElement>("#knot-circle");
const trefoilButton = document.querySelector<HTMLButtonElement>("#knot-trefoil");
const r1Button = document.querySelector<HTMLButtonElement>("#knot-r1");
const r2Button = document.querySelector<HTMLButtonElement>("#knot-r2");

const fg = () => getComputedStyle(document.documentElement).getPropertyValue("--fg").trim() || "#181817";
const bg = () => getComputedStyle(document.documentElement).getPropertyValue("--bg").trim() || "#fbfbf9";
const muted = () => getComputedStyle(document.documentElement).getPropertyValue("--muted").trim() || "#77736b";

if (canvas && stats && crossingBox && polyBox && status && clearButton && circleButton && trefoilButton && r1Button && r2Button) {
  const ctx = canvas.getContext("2d")!;
  let points: Point[] = [];
  let crossings: Crossing[] = [];
  let drawing = false;
  const flipped = new Set<string>();
  let statusTimer = 0;

  function announce(message: string) {
    status.textContent = message;
    status.classList.add("is-active");
    window.clearTimeout(statusTimer);
    statusTimer = window.setTimeout(() => status.classList.remove("is-active"), 1400);
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    draw();
  }

  function pointer(event: PointerEvent): Point {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  const sub = (a: Point, b: Point) => ({ x: a.x - b.x, y: a.y - b.y });
  const cross = (a: Point, b: Point) => a.x * b.y - a.y * b.x;
  const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
  const key = (i: number, j: number) => `${Math.min(i, j)}:${Math.max(i, j)}`;

  function segmentIntersection(a: Point, b: Point, c: Point, d: Point): Point | null {
    const r = sub(b, a);
    const s = sub(d, c);
    const den = cross(r, s);
    if (Math.abs(den) < 1e-6) return null;
    const u = cross(sub(c, a), r) / den;
    const t = cross(sub(c, a), s) / den;
    if (t <= 0.02 || t >= 0.98 || u <= 0.02 || u >= 0.98) return null;
    return { x: a.x + t * r.x, y: a.y + t * r.y };
  }

  function computeCrossings() {
    crossings = [];
    const n = points.length;
    if (n < 4) return;
    for (let i = 0; i < n; i += 1) {
      const a = points[i];
      const b = points[(i + 1) % n];
      for (let j = i + 2; j < n; j += 1) {
        if (i === 0 && j === n - 1) continue;
        const c = points[j];
        const d = points[(j + 1) % n];
        const p = segmentIntersection(a, b, c, d);
        if (!p) continue;
        const sign = cross(sub(b, a), sub(d, c)) > 0 ? 1 : -1;
        const over = flipped.has(key(i, j)) ? j : i;
        crossings.push({ i, j, p, sign, over });
      }
    }
  }

  function resample(maxPoints = 260) {
    if (points.length <= maxPoints) return;
    const step = points.length / maxPoints;
    points = Array.from({ length: maxPoints }, (_unused, index) => points[Math.floor(index * step)]);
  }

  function r1Smooth() {
    if (points.length < 4) return;
    const smoothed: Point[] = [];
    for (let i = 0; i < points.length; i += 1) {
      const a = points[i];
      const b = points[(i + 1) % points.length];
      smoothed.push({ x: a.x * 0.75 + b.x * 0.25, y: a.y * 0.75 + b.y * 0.25 });
      smoothed.push({ x: a.x * 0.25 + b.x * 0.75, y: a.y * 0.25 + b.y * 0.75 });
    }
    points = smoothed;
    resample();
    announce("Smoothed every corner: more vertices were inserted, then resampled into a rounder curve.");
    draw();
  }

  function r2Simplify() {
    computeCrossings();
    if (crossings.length === 0) {
      announce("No crossings found, so this falls back to smoothing the curve.");
      return r1Smooth();
    }

    // A polygonal 2-opt move: reverse the strand between the two crossing
    // segments. This visibly removes the selected transverse intersection,
    // serving as a Reidemeister-II style simplification for hand sketches.
    const target = crossings[0];
    const start = target.i + 1;
    const end = target.j;
    if (start >= end) {
      announce("Could not isolate that crossing, so this falls back to smoothing the curve.");
      return r1Smooth();
    }
    points = [
      ...points.slice(0, start),
      ...points.slice(start, end + 1).reverse(),
      ...points.slice(end + 1),
    ];
    flipped.clear();
    announce(`Removed crossing near segments ${target.i} and ${target.j} by reversing the strand between them.`);
    draw();
  }

  function drawPath() {
    if (points.length < 2) return;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 5;
    ctx.strokeStyle = fg();
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    points.slice(1).forEach((p) => ctx.lineTo(p.x, p.y));
    if (!drawing && points.length > 2) ctx.closePath();
    ctx.stroke();
  }

  function drawCrossings() {
    ctx.font = `${12 * (window.devicePixelRatio || 1)}px monospace`;
    crossings.forEach((crossing, index) => {
      ctx.save();
      ctx.strokeStyle = bg();
      ctx.lineWidth = 12;
      const a = points[crossing.over];
      const b = points[(crossing.over + 1) % points.length];
      const v = sub(b, a);
      const len = Math.hypot(v.x, v.y) || 1;
      ctx.beginPath();
      ctx.moveTo(crossing.p.x - (v.x / len) * 14, crossing.p.y - (v.y / len) * 14);
      ctx.lineTo(crossing.p.x + (v.x / len) * 14, crossing.p.y + (v.y / len) * 14);
      ctx.stroke();
      ctx.strokeStyle = fg();
      ctx.lineWidth = 5;
      ctx.stroke();
      ctx.fillStyle = crossing.sign > 0 ? fg() : muted();
      ctx.fillText(String(index + 1), crossing.p.x + 8, crossing.p.y - 8);
      ctx.restore();
    });
  }

  function polynomialText() {
    const writhe = crossings.reduce((sum, c) => sum + c.sign, 0);
    const pos = crossings.filter((c) => c.sign > 0).length;
    const neg = crossings.length - pos;
    const wrPoly = crossings.map((c, i) => `${c.sign > 0 ? "+" : "-"}t^${i + 1}`).join(" ").replace(/^\+/, "") || "0";
    const bracket = crossings.length === 0 ? "1" : `(-A^3)^-${writhe} · (A^${pos - neg} + ${crossings.length}A^${writhe})`;
    return `<div>W(t) = ${wrPoly}</div><div>writhe-normalized bracket sketch = ${bracket}</div>`;
  }

  function updateReadout() {
    const writhe = crossings.reduce((sum, c) => sum + c.sign, 0);
    stats.innerHTML = `<dt>components</dt><dd>1</dd><dt>vertices</dt><dd>${points.length}</dd><dt>crossings</dt><dd>${crossings.length}</dd><dt>writhe</dt><dd>${writhe}</dd><dt>linking number</dt><dd>0</dd>`;
    crossingBox.innerHTML = crossings.length === 0 ? "no crossings" : crossings.map((c, i) => `<div class="knot-crossing-row"><span>#${i + 1}: segments ${c.i}/${c.j}</span><span>${c.sign > 0 ? "+" : "−"}, over ${c.over}</span></div>`).join("");
    polyBox.innerHTML = polynomialText();
  }

  function draw() {
    computeCrossings();
    ctx.fillStyle = bg();
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawPath();
    drawCrossings();
    updateReadout();
  }

  function setCircle() {
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const r = Math.min(canvas.width, canvas.height) * 0.32;
    points = Array.from({ length: 96 }, (_unused, i) => ({ x: cx + Math.cos((i / 96) * Math.PI * 2) * r, y: cy + Math.sin((i / 96) * Math.PI * 2) * r }));
    flipped.clear();
    draw();
  }

  function setTrefoil() {
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const s = Math.min(canvas.width, canvas.height) * 0.17;
    points = Array.from({ length: 220 }, (_unused, i) => {
      const t = (i / 220) * Math.PI * 2;
      return { x: cx + s * Math.sin(t) + 2 * s * Math.sin(2 * t), y: cy + s * Math.cos(t) - 2 * s * Math.cos(2 * t) };
    });
    flipped.clear();
    draw();
  }

  function nearestCrossingAt(p: Point): Crossing | undefined {
    return crossings.find((c) => dist(c.p, p) < 18 * (window.devicePixelRatio || 1));
  }

  function flipCrossing(crossing: Crossing) {
    const crossingKey = key(crossing.i, crossing.j);
    if (flipped.has(crossingKey)) flipped.delete(crossingKey);
    else flipped.add(crossingKey);
    announce(`Flipped crossing at segments ${crossing.i} and ${crossing.j}: the other strand is now on top.`);
    draw();
  }

  canvas.addEventListener("pointerdown", (event) => {
    const p = pointer(event);
    const crossing = nearestCrossingAt(p);
    if (crossing) {
      flipCrossing(crossing);
      return;
    }

    drawing = true;
    points = [p];
    flipped.clear();
    canvas.setPointerCapture(event.pointerId);
    draw();
  });

  canvas.addEventListener("pointermove", (event) => {
    if (!drawing) return;
    const p = pointer(event);
    if (dist(points[points.length - 1], p) > 5) points.push(p);
    draw();
  });

  canvas.addEventListener("pointerup", () => {
    drawing = false;
    announce("Closed the curve and recomputed crossings/writhe.");
    draw();
  });
  clearButton.addEventListener("click", () => { points = []; flipped.clear(); announce("Cleared the diagram."); draw(); });
  circleButton.addEventListener("click", () => { setCircle(); announce("Loaded an unknot: a crossing-free circle."); });
  trefoilButton.addEventListener("click", () => { setTrefoil(); announce("Loaded a trefoil-like sample with detected crossings."); });
  r1Button.addEventListener("click", r1Smooth);
  r2Button.addEventListener("click", r2Simplify);
  window.addEventListener("resize", resize);
  resize();
  setTrefoil();
}
