export {};

type Convergent = { n: number; a: number; p: bigint; q: bigint; value: number; error: number };

const form = document.querySelector<HTMLFormElement>("#cf-form");
const kind = document.querySelector<HTMLSelectElement>("#cf-kind");
const rationalFields = document.querySelector<HTMLElement>(".cf-rational-fields");
const quadraticFields = document.querySelector<HTMLElement>(".cf-quadratic-fields");
const summary = document.querySelector<HTMLElement>("#cf-summary");
const expanded = document.querySelector<HTMLElement>("#cf-expanded");
const table = document.querySelector<HTMLTableElement>("#cf-table");
const errorPlot = document.querySelector<SVGSVGElement>("#cf-error-plot");
const intervals = document.querySelector<SVGSVGElement>("#cf-intervals");

const input = (id: string) => document.querySelector<HTMLInputElement>(id)!;
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" })[c]!);

if (form && kind && rationalFields && quadraticFields && summary && expanded && table && errorPlot && intervals) {
  const pInput = input("#cf-p");
  const qInput = input("#cf-q");
  const aInput = input("#cf-a");
  const bInput = input("#cf-b");
  const dInput = input("#cf-d");
  const cInput = input("#cf-c");
  const termsInput = input("#cf-terms");

  function gcd(a: bigint, b: bigint): bigint {
    a = a < 0n ? -a : a;
    b = b < 0n ? -b : b;
    while (b) [a, b] = [b, a % b];
    return a || 1n;
  }

  function rationalCf(p: bigint, q: bigint): number[] {
    const terms: number[] = [];
    if (q === 0n) return [0];
    if (q < 0n) { p = -p; q = -q; }
    while (q !== 0n && terms.length < 200) {
      let a = p / q;
      let r = p % q;
      if (r < 0n) { a -= 1n; r += q; }
      terms.push(Number(a));
      p = q;
      q = r;
    }
    return terms;
  }

  function numericCf(value: number, limit: number): number[] {
    const terms: number[] = [];
    let x = value;
    for (let i = 0; i < limit; i += 1) {
      const a = Math.floor(x);
      terms.push(a);
      const frac = x - a;
      if (Math.abs(frac) < 1e-13) break;
      x = 1 / frac;
      if (!Number.isFinite(x)) break;
    }
    return terms;
  }

  function nestedHtml(cf: number[], depth = 8): string {
    const shown = cf.slice(0, Math.min(depth, cf.length));
    if (shown.length === 0) return "";
    let inner = cf.length > shown.length ? "…" : String(shown[shown.length - 1]);
    for (let i = shown.length - 2; i >= 0; i -= 1) {
      inner = `${shown[i]} + <span class="cf-frac"><span>1</span><span>${inner}</span></span>`;
    }
    return `<span class="cf-nested">${inner}</span>`;
  }

  function termPills(cf: number[]): string {
    return cf.slice(0, 32).map((a, i) => `<span class="cf-pill"><strong>a${i}</strong> = ${a}</span>`).join(" ") + (cf.length > 32 ? " …" : "");
  }

  function convergents(cf: number[], target: number): Convergent[] {
    let p0 = 0n, p1 = 1n;
    let q0 = 1n, q1 = 0n;
    return cf.map((a, n) => {
      const bigA = BigInt(a);
      const p = bigA * p1 + p0;
      const q = bigA * q1 + q0;
      [p0, p1] = [p1, p];
      [q0, q1] = [q1, q];
      const value = Number(p) / Number(q);
      return { n, a, p, q, value, error: Math.abs(value - target) };
    });
  }

  function fractionText(p: bigint, q: bigint): string {
    const g = gcd(p, q);
    p /= g; q /= g;
    if (q < 0n) { p = -p; q = -q; }
    return q === 1n ? String(p) : `${p}/${q}`;
  }

  function currentValue(): { label: string; value: number; cf: number[] } {
    const limit = Math.max(1, Math.min(80, Number(termsInput.value) || 24));
    if (kind.value === "rational") {
      const p = BigInt(Math.trunc(Number(pInput.value) || 0));
      const q = BigInt(Math.trunc(Number(qInput.value) || 1));
      const value = Number(p) / Number(q || 1n);
      return { label: fractionText(p, q || 1n), value, cf: rationalCf(p, q || 1n).slice(0, limit) };
    }
    const a = Number(aInput.value) || 0;
    const b = Number(bInput.value) || 0;
    const d = Math.max(0, Number(dInput.value) || 0);
    const c = Number(cInput.value) || 1;
    const value = (a + b * Math.sqrt(d)) / c;
    return { label: `(${a} + ${b}√${d}) / ${c}`, value, cf: numericCf(value, limit) };
  }

  function drawError(rows: Convergent[]) {
    const w = 900, h = 220;
    const left = 54, right = 18, top = 24, bottom = 34;
    const scores = rows.map((r) => -Math.log10(Math.max(r.error, 1e-16)));
    const maxScore = Math.max(1, Math.ceil(Math.max(...scores)));
    const x = (i: number) => left + (i / Math.max(1, rows.length - 1)) * (w - left - right);
    const y = (score: number) => h - bottom - (score / maxScore) * (h - top - bottom);
    const path = rows.map((r, i) => `${i ? "L" : "M"}${x(i)},${y(scores[i])}`).join(" ");
    const grid = Array.from({ length: Math.min(maxScore, 8) + 1 }, (_unused, i) => {
      const value = (i / Math.min(maxScore, 8)) * maxScore;
      const yy = y(value);
      return `<line class="cf-grid-line" x1="${left}" y1="${yy}" x2="${w - right}" y2="${yy}"/><text class="cf-muted" x="8" y="${yy + 4}">${value.toFixed(0)}</text>`;
    }).join("");
    errorPlot.innerHTML = `${grid}<line class="cf-axis" x1="${left}" y1="${h - bottom}" x2="${w - right}" y2="${h - bottom}"/><line class="cf-axis" x1="${left}" y1="${top}" x2="${left}" y2="${h - bottom}"/><path class="cf-line" d="${path}"/>${rows.map((_r, i) => `<circle class="cf-mark" cx="${x(i)}" cy="${y(scores[i])}" r="3"><title>n=${i}, about ${scores[i].toFixed(2)} correct decimal digits</title></circle>`).join("")}<text class="cf-muted" x="${left}" y="16">correct decimal digits = −log₁₀(|error|), higher is better</text><text class="cf-muted" x="${w - 64}" y="${h - 8}">n</text>`;
  }

  function drawIntervals(rows: Convergent[], target: number) {
    const w = 900, pad = 36;
    const pairs = rows.slice(1, 13).map((r, i) => [rows[i].value, r.value] as [number, number]);
    const values = pairs.flat().concat(target);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const scale = (v: number) => pad + ((v - min) / Math.max(1e-12, max - min)) * (w - 2 * pad);
    intervals.innerHTML = `<line class="cf-axis" x1="${pad}" y1="24" x2="${w - pad}" y2="24"/><circle class="cf-mark" cx="${scale(target)}" cy="24" r="5"/><text class="cf-muted" x="${scale(target) + 8}" y="28">target</text>${pairs.map(([a, b], i) => {
      const y = 52 + i * 16;
      return `<line class="cf-line" x1="${scale(Math.min(a, b))}" y1="${y}" x2="${scale(Math.max(a, b))}" y2="${y}"/><text class="cf-muted" x="8" y="${y + 4}">${i + 1}</text>`;
    }).join("")}`;
  }

  function render() {
    rationalFields.hidden = kind.value !== "rational";
    quadraticFields.hidden = kind.value !== "quadratic";
    const { label, value, cf } = currentValue();
    const rows = convergents(cf, value);
    summary.innerHTML = `<div><strong>target</strong>: x = ${esc(label)} ≈ ${value.toPrecision(14)}</div><div><strong>compact notation</strong>: [${cf.slice(0, 24).join(", ")}${cf.length > 24 ? ", …" : ""}]</div><div><strong>terms</strong>: ${termPills(cf)}</div>`;
    expanded.innerHTML = `<p>${nestedHtml(cf)}</p><p class="cf-intro">Read this from the outside inward: start with <code>a₀</code>, then repeatedly add the reciprocal of the remaining tail. Truncating at any level gives one convergent below.</p>`;
    table.innerHTML = `<thead><tr><th>n</th><th>aₙ</th><th>pₙ/qₙ</th><th>decimal</th><th>|error|</th><th>meaning</th></tr></thead><tbody>${rows.map((r) => `<tr><td>${r.n}</td><td>${r.a}</td><td>${r.p}/${r.q}</td><td>${r.value.toPrecision(12)}</td><td>${r.error.toExponential(3)}</td><td>${r.n === 0 ? "integer part" : r.error < 1 ? "closer approximation" : "coarse approximation"}</td></tr>`).join("")}</tbody>`;
    drawError(rows);
    drawIntervals(rows, value);
  }

  form.addEventListener("submit", (event) => { event.preventDefault(); render(); });
  kind.addEventListener("change", render);
  form.addEventListener("input", render);
  render();
}
