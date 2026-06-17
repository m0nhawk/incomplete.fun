export {};

interface Rational {
  num: bigint;
  den: bigint;
}

interface Expansion {
  valuation: number;
  digits: bigint[];
  residues: { power: number; modulus: bigint; residue: bigint }[];
}

const expansionForm = document.querySelector<HTMLFormElement>("#padic-expansion-form");
const primeInput = document.querySelector<HTMLInputElement>("#padic-prime");
const rationalInput = document.querySelector<HTMLInputElement>("#padic-rational");
const digitsInput = document.querySelector<HTMLInputElement>("#padic-digits");
const expansionOutput = document.querySelector<HTMLDivElement>("#padic-expansion-output");

const inverseForm = document.querySelector<HTMLFormElement>("#padic-inverse-form");
const inverseAInput = document.querySelector<HTMLInputElement>("#padic-inverse-a");
const inversePInput = document.querySelector<HTMLInputElement>("#padic-inverse-p");
const inverseKInput = document.querySelector<HTMLInputElement>("#padic-inverse-k");
const inverseOutput = document.querySelector<HTMLDivElement>("#padic-inverse-output");

const henselForm = document.querySelector<HTMLFormElement>("#padic-hensel-form");
const polyInput = document.querySelector<HTMLInputElement>("#padic-poly");
const rootInput = document.querySelector<HTMLInputElement>("#padic-root");
const henselPInput = document.querySelector<HTMLInputElement>("#padic-hensel-p");
const henselKInput = document.querySelector<HTMLInputElement>("#padic-hensel-k");
const henselOutput = document.querySelector<HTMLDivElement>("#padic-hensel-output");

function gcd(a: bigint, b: bigint): bigint {
  a = abs(a);
  b = abs(b);
  while (b !== 0n) {
    const t = a % b;
    a = b;
    b = t;
  }
  return a;
}

function abs(n: bigint): bigint {
  return n < 0n ? -n : n;
}

function mod(a: bigint, m: bigint): bigint {
  return ((a % m) + m) % m;
}

function powBig(base: bigint, exp: number): bigint {
  let result = 1n;
  for (let i = 0; i < exp; i++) result *= base;
  return result;
}

function isPrime(n: number): boolean {
  if (!Number.isInteger(n) || n < 2) return false;
  for (let d = 2; d * d <= n; d++) {
    if (n % d === 0) return false;
  }
  return true;
}

function readPrime(input: HTMLInputElement): number {
  const p = Number(input.value);
  if (!isPrime(p) || p > 97) throw new Error("p must be a prime between 2 and 97");
  return p;
}

function readPositiveInt(input: HTMLInputElement, name: string, max: number): number {
  const n = Number(input.value);
  if (!Number.isInteger(n) || n < 1 || n > max) throw new Error(`${name} must be from 1 to ${max}`);
  return n;
}

function parseInteger(text: string): bigint {
  const trimmed = text.trim();
  if (!/^[+-]?\d+$/.test(trimmed)) throw new Error(`not an integer: ${text}`);
  return BigInt(trimmed);
}

function parseRational(text: string): Rational {
  const trimmed = text.trim().replace(/\s+/g, "");
  if (trimmed.includes("/")) {
    const parts = trimmed.split("/");
    if (parts.length !== 2) throw new Error("use one slash for a rational number");
    return normalize({ num: parseInteger(parts[0]), den: parseInteger(parts[1]) });
  }

  if (/^[+-]?\d+(\.\d+)?$/.test(trimmed)) {
    const sign = trimmed.startsWith("-") ? -1n : 1n;
    const unsigned = trimmed.replace(/^[+-]/, "");
    const [whole, frac = ""] = unsigned.split(".");
    return normalize({ num: sign * BigInt(`${whole}${frac}`), den: 10n ** BigInt(frac.length) });
  }

  throw new Error("enter an integer, decimal, or fraction like -7/12");
}

function normalize(r: Rational): Rational {
  if (r.den === 0n) throw new Error("denominator cannot be 0");
  if (r.den < 0n) r = { num: -r.num, den: -r.den };
  const g = gcd(r.num, r.den);
  return { num: r.num / g, den: r.den / g };
}

function valuationInteger(n: bigint, p: bigint): number {
  if (n === 0n) return Number.POSITIVE_INFINITY;
  let v = 0;
  n = abs(n);
  while (n % p === 0n) {
    v++;
    n /= p;
  }
  return v;
}

function inverseMod(a: bigint, m: bigint): bigint {
  let t = 0n;
  let newT = 1n;
  let r = m;
  let newR = mod(a, m);

  while (newR !== 0n) {
    const q = r / newR;
    [t, newT] = [newT, t - q * newT];
    [r, newR] = [newR, r - q * newR];
  }

  if (r !== 1n) throw new Error(`${a} has no inverse modulo ${m}`);
  return mod(t, m);
}

function padicExpansion(r: Rational, pNumber: number, precision: number): Expansion {
  if (r.num === 0n) {
    return {
      valuation: Number.POSITIVE_INFINITY,
      digits: Array.from({ length: precision }, () => 0n),
      residues: Array.from({ length: precision }, (_, i) => {
        const power = i + 1;
        return { power, modulus: powBig(BigInt(pNumber), power), residue: 0n };
      }),
    };
  }

  const p = BigInt(pNumber);
  const vNum = valuationInteger(r.num, p);
  const vDen = valuationInteger(r.den, p);
  const valuation = vNum - vDen;
  const unitNum = r.num / powBig(p, vNum);
  const unitDen = r.den / powBig(p, vDen);
  const modulus = powBig(p, precision);
  const residue = mod(unitNum * inverseMod(unitDen, modulus), modulus);

  const digits: bigint[] = [];
  let rest = residue;
  for (let i = 0; i < precision; i++) {
    digits.push(rest % p);
    rest /= p;
  }

  const residues = Array.from({ length: precision }, (_, i) => {
    const power = i + 1;
    const modulusAtPower = powBig(p, power);
    return { power, modulus: modulusAtPower, residue: mod(residue, modulusAtPower) };
  });

  return { valuation, digits, residues };
}

function digitText(digits: bigint[]): string {
  return digits.map(String).join(" + ");
}

function expansionFormula(expansion: Expansion, p: number): string {
  if (expansion.valuation === Number.POSITIVE_INFINITY) return "0";
  const terms = expansion.digits
    .map((digit, i) => ({ digit, exponent: i + expansion.valuation }))
    .filter((term) => term.digit !== 0n)
    .map((term) => term.exponent === 0 ? `${term.digit}` : `${term.digit}·${p}^${term.exponent}`);
  const last = expansion.valuation + expansion.digits.length;
  return `${terms.length ? terms.join(" + ") : "0"} + O(${p}^${last})`;
}

function renderError(container: HTMLElement, error: unknown) {
  container.innerHTML = `<p class="padic-error">${escapeHtml(error instanceof Error ? error.message : String(error))}</p>`;
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" })[ch]!);
}

function renderExpansion() {
  if (!primeInput || !rationalInput || !digitsInput || !expansionOutput) return;
  try {
    const p = readPrime(primeInput);
    const digits = readPositiveInt(digitsInput, "digits", 40);
    const rational = parseRational(rationalInput.value);
    const expansion = padicExpansion(rational, p, digits);
    const valuation = expansion.valuation === Number.POSITIVE_INFINITY ? "∞" : String(expansion.valuation);
    const rows = expansion.residues.map((row) => (
      `<tr><td>${row.power}</td><td>${row.modulus}</td><td>${row.residue}</td></tr>`
    )).join("");

    expansionOutput.innerHTML = `
      <div class="padic-result">
        <div>v<sub>${p}</sub>(${escapeHtml(rationalInput.value)}) = <strong>${valuation}</strong></div>
        <div class="padic-muted">digits low to high: <code>${escapeHtml(digitText(expansion.digits))}</code></div>
        <div><code>${escapeHtml(expansionFormula(expansion, p))}</code></div>
        <table class="padic-table">
          <thead><tr><th>k</th><th>p^k</th><th>unit residue mod p^k</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  } catch (error) {
    renderError(expansionOutput, error);
  }
}

function renderInverse() {
  if (!inverseAInput || !inversePInput || !inverseKInput || !inverseOutput) return;
  try {
    const a = parseInteger(inverseAInput.value);
    const p = readPrime(inversePInput);
    const k = readPositiveInt(inverseKInput, "k", 30);
    const modulus = powBig(BigInt(p), k);
    const inverse = inverseMod(a, modulus);
    inverseOutput.innerHTML = `
      <div class="padic-result">
        <div><code>${escapeHtml(String(a))}⁻¹ mod ${p}^${k}</code></div>
        <div><strong>${inverse}</strong></div>
        <div class="padic-muted">check: ${escapeHtml(String(a))} · ${inverse} ≡ ${mod(a * inverse, modulus)} (mod ${modulus})</div>
      </div>`;
  } catch (error) {
    renderError(inverseOutput, error);
  }
}

function parsePolynomial(text: string): bigint[] {
  const coefficients = text.split(",").map((part) => parseInteger(part));
  if (coefficients.length === 0) throw new Error("enter at least one coefficient");
  return coefficients;
}

function evalPoly(coefficients: bigint[], x: bigint): bigint {
  let total = 0n;
  for (let i = coefficients.length - 1; i >= 0; i--) {
    total = total * x + coefficients[i];
  }
  return total;
}

function derivative(coefficients: bigint[]): bigint[] {
  return coefficients.slice(1).map((coefficient, i) => coefficient * BigInt(i + 1));
}

function henselLift(coefficients: bigint[], root: bigint, pNumber: number, k: number): { root: bigint; steps: bigint[] } {
  const p = BigInt(pNumber);
  const deriv = derivative(coefficients);
  let lifted = mod(root, p);
  if (mod(evalPoly(coefficients, lifted), p) !== 0n) throw new Error("initial root is not a root modulo p");
  if (mod(evalPoly(deriv, lifted), p) === 0n) throw new Error("derivative is 0 modulo p; this simple Hensel lift does not apply");

  const steps = [lifted];
  let modulus = p;
  for (let n = 1; n < k; n++) {
    const f = evalPoly(coefficients, lifted);
    const c = mod(f / modulus, p);
    const d = mod(evalPoly(deriv, lifted), p);
    const t = mod(-c * inverseMod(d, p), p);
    lifted += t * modulus;
    modulus *= p;
    lifted = mod(lifted, modulus);
    steps.push(lifted);
  }
  return { root: lifted, steps };
}

function renderHensel() {
  if (!polyInput || !rootInput || !henselPInput || !henselKInput || !henselOutput) return;
  try {
    const coefficients = parsePolynomial(polyInput.value);
    const root = parseInteger(rootInput.value);
    const p = readPrime(henselPInput);
    const k = readPositiveInt(henselKInput, "k", 30);
    const lift = henselLift(coefficients, root, p, k);
    const modulus = powBig(BigInt(p), k);
    const rows = lift.steps.map((step, i) => `<tr><td>${i + 1}</td><td>${p}<sup>${i + 1}</sup></td><td>${step}</td></tr>`).join("");
    henselOutput.innerHTML = `
      <div class="padic-result">
        <div>root modulo ${p}<sup>${k}</sup>: <strong>${lift.root}</strong></div>
        <div class="padic-muted">f(root) ≡ ${mod(evalPoly(coefficients, lift.root), modulus)} (mod ${modulus})</div>
        <table class="padic-table">
          <thead><tr><th>k</th><th>modulus</th><th>root</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  } catch (error) {
    renderError(henselOutput, error);
  }
}

expansionForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  renderExpansion();
});

inverseForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  renderInverse();
});

henselForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  renderHensel();
});

renderExpansion();
renderInverse();
renderHensel();
