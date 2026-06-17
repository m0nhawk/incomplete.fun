export {};

const daysEl = document.querySelector<HTMLDivElement>("#surreal-days");
const form = document.querySelector<HTMLFormElement>("#surreal-cut-form");
const leftInput = document.querySelector<HTMLInputElement>("#surreal-left");
const rightInput = document.querySelector<HTMLInputElement>("#surreal-right");
const output = document.querySelector<HTMLDivElement>("#surreal-cut-output");
const exampleButtons = document.querySelectorAll<HTMLButtonElement>(".surreal-examples button");

interface Rational {
  numerator: number;
  denominator: number;
}

function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y !== 0) [x, y] = [y, x % y];
  return x || 1;
}

function rational(numerator: number, denominator = 1): Rational {
  if (denominator === 0) throw new Error("denominator cannot be zero");
  const sign = denominator < 0 ? -1 : 1;
  const divisor = gcd(numerator, denominator);
  return { numerator: sign * numerator / divisor, denominator: Math.abs(denominator) / divisor };
}

function valueOf(q: Rational): number {
  return q.numerator / q.denominator;
}

function compare(a: Rational, b: Rational): number {
  return a.numerator * b.denominator - b.numerator * a.denominator;
}

function format(q: Rational): string {
  return q.denominator === 1 ? String(q.numerator) : `${q.numerator}/${q.denominator}`;
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" })[ch]!);
}

function parseRational(text: string): Rational {
  const trimmed = text.trim();
  if (!trimmed) throw new Error("empty option");
  if (trimmed.includes("/")) {
    const [top, bottom, extra] = trimmed.split("/");
    if (extra !== undefined) throw new Error(`cannot parse ${trimmed}`);
    const numerator = Number(top.trim());
    const denominator = Number(bottom.trim());
    if (!Number.isInteger(numerator) || !Number.isInteger(denominator)) throw new Error(`use integer fractions, not ${trimmed}`);
    return rational(numerator, denominator);
  }
  const value = Number(trimmed);
  if (!Number.isFinite(value)) throw new Error(`cannot parse ${trimmed}`);
  const parts = trimmed.split(".");
  if (parts.length === 2) {
    const scale = 10 ** parts[1].length;
    return rational(Math.round(value * scale), scale);
  }
  if (!Number.isInteger(value)) throw new Error(`cannot parse ${trimmed}`);
  return rational(value);
}

function parseList(text: string): Rational[] {
  if (!text.trim()) return [];
  return text.split(",").map(parseRational);
}

function birthday(q: Rational): number {
  if (q.denominator === 1) return Math.abs(q.numerator);
  return Math.ceil(Math.abs(valueOf(q))) + Math.log2(q.denominator);
}

function allBornBy(maxDay: number): Rational[] {
  const values: Rational[] = [];
  const maxDenominatorPower = maxDay;
  const limit = maxDay;
  for (let power = 0; power <= maxDenominatorPower; power += 1) {
    const denominator = 2 ** power;
    for (let numerator = -limit * denominator; numerator <= limit * denominator; numerator += 1) {
      const q = rational(numerator, denominator);
      if (q.denominator === denominator && birthday(q) <= maxDay) values.push(q);
    }
  }
  const unique = new Map(values.map((q) => [format(q), q]));
  return [...unique.values()].sort(compare);
}

function simplestBetween(left: Rational[], right: Rational[]): Rational {
  const lower = left.length ? Math.max(...left.map(valueOf)) : Number.NEGATIVE_INFINITY;
  const upper = right.length ? Math.min(...right.map(valueOf)) : Number.POSITIVE_INFINITY;
  if (!(lower < upper)) throw new Error("invalid cut: every left option must be less than every right option");

  for (let day = 0; day <= 16; day += 1) {
    const candidate = allBornBy(day).find((q) => valueOf(q) > lower && valueOf(q) < upper);
    if (candidate) return candidate;
  }
  throw new Error("no simple finite dyadic found; try closer finite options");
}

function renderDays(): void {
  if (!daysEl) return;
  const maxDay = 5;
  const byDay = Array.from({ length: maxDay + 1 }, (_unused, day) => allBornBy(day).filter((q) => birthday(q) === day));
  daysEl.innerHTML = byDay.map((values, day) => `
    <div class="surreal-day">
      <strong>day ${day}</strong>
      <div class="surreal-values">${values.map((q) => `<span class="surreal-pill">${format(q)}</span>`).join("")}</div>
    </div>
  `).join("");
}

function renderCut(): void {
  if (!leftInput || !rightInput || !output) return;
  try {
    const left = parseList(leftInput.value);
    const right = parseList(rightInput.value);
    const result = simplestBetween(left, right);
    const leftText = left.length ? left.map(format).join(", ") : "";
    const rightText = right.length ? right.map(format).join(", ") : "";
    output.innerHTML = `
      <p><code>{ ${escapeHtml(leftText)} | ${escapeHtml(rightText)} }</code> creates <strong>${format(result)}</strong>.</p>
      <p class="surreal-muted">birthday: day ${birthday(result)}. It is the earliest-born dyadic number strictly between the two sides.</p>
    `;
  } catch (error) {
    output.innerHTML = `<p>${escapeHtml(error instanceof Error ? error.message : String(error))}</p>`;
  }
}

form?.addEventListener("submit", (event) => {
  event.preventDefault();
  renderCut();
});

[leftInput, rightInput].forEach((input) => input?.addEventListener("input", renderCut));

exampleButtons.forEach((button) => {
  button.addEventListener("click", () => {
    if (!leftInput || !rightInput) return;
    leftInput.value = button.dataset.left ?? "";
    rightInput.value = button.dataset.right ?? "";
    renderCut();
  });
});

renderDays();
renderCut();
