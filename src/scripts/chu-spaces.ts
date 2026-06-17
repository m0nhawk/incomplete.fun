export {};

interface ChuSpace {
  id: string;
  name: string;
  values: string[];
  points: string[];
  states: string[];
  matrix: string[][];
  description: string;
}

interface DisplaySpace {
  name: string;
  values: string[];
  points: string[];
  states: string[];
  matrix: string[][];
  description: string;
  dual: boolean;
}

const spaces: ChuSpace[] = [
  {
    id: "sierpinski",
    name: "Sierpiński open-set tester",
    values: ["0", "1"],
    points: ["⊥", "⊤"],
    states: ["∅", "{⊤}", "{⊥,⊤}"],
    matrix: [["0", "0", "1"], ["0", "1", "1"]],
    description: "Two points observed by the open subsets of the Sierpiński space; a cell says whether the point lies in the open.",
  },
  {
    id: "powerset",
    name: "subsets versus membership",
    values: ["0", "1"],
    points: ["a", "b", "c"],
    states: ["{a}", "{b,c}", "{a,c}", "∅"],
    matrix: [["1", "0", "1", "0"], ["0", "1", "0", "0"], ["0", "1", "1", "0"]],
    description: "A small incidence relation: points are elements and states are selected subsets.",
  },
  {
    id: "preorder",
    name: "three-point preorder",
    values: ["0", "1"],
    points: ["x", "y", "z"],
    states: ["↑x", "↑y", "↑z"],
    matrix: [["1", "1", "1"], ["0", "1", "1"], ["0", "0", "1"]],
    description: "The specialization order x ≤ y ≤ z, encoded by principal upper-set membership.",
  },
  {
    id: "ratings",
    name: "objects rated by observers",
    values: ["0", "1", "2"],
    points: ["moon", "sun", "comet"],
    states: ["Ada", "Bert", "Cy"],
    matrix: [["2", "1", "2"], ["1", "2", "2"], ["0", "1", "2"]],
    description: "A many-valued Chu space: each observer assigns a score in K = {0,1,2}.",
  },
];

const byId = new Map(spaces.map((space) => [space.id, space]));

const spaceSelect = document.querySelector<HTMLSelectElement>("#chu-space-select");
const viewSelect = document.querySelector<HTMLSelectElement>("#chu-view-select");
const summaryOutput = document.querySelector<HTMLDivElement>("#chu-summary");
const matrixOutput = document.querySelector<HTMLDivElement>("#chu-matrix");
const diagnosticsOutput = document.querySelector<HTMLDivElement>("#chu-diagnostics");
const profileOutput = document.querySelector<HTMLDivElement>("#chu-profile");
const sourceSelect = document.querySelector<HTMLSelectElement>("#chu-source-select");
const targetSelect = document.querySelector<HTMLSelectElement>("#chu-target-select");
const morphismOutput = document.querySelector<HTMLDivElement>("#chu-morphism-output");

function escapeHtml(text: string): string {
  return text.replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" })[ch]!);
}

function currentSpace(select: HTMLSelectElement | null): ChuSpace {
  return byId.get(select?.value ?? "") ?? spaces[0];
}

function display(space: ChuSpace, dual: boolean): DisplaySpace {
  if (!dual) return { ...space, dual: false };
  return {
    name: `${space.name} (dual)`,
    values: space.values,
    points: space.states,
    states: space.points,
    matrix: transpose(space.matrix),
    description: `Dual of ${space.name}: states are now points and points are now states.`,
    dual: true,
  };
}

function transpose(matrix: string[][]): string[][] {
  return matrix[0].map((_unused, col) => matrix.map((row) => row[col]));
}

function renderMatrix(space: DisplaySpace): string {
  const header = `<tr><th>r</th>${space.states.map((state) => `<th>${escapeHtml(state)}</th>`).join("")}</tr>`;
  const rows = space.points.map((point, row) => `<tr><th>${escapeHtml(point)}</th>${space.matrix[row].map((value) => `<td>${escapeHtml(value)}</td>`).join("")}</tr>`).join("");
  return `<table class="chu-table">${header}${rows}</table>`;
}

function duplicates(items: string[]): string[][] {
  const groups = new Map<string, string[]>();
  items.forEach((signature, i) => groups.set(signature, [...(groups.get(signature) ?? []), String(i)]));
  return [...groups.values()].filter((group) => group.length > 1);
}

function renderDiagnostics(space: DisplaySpace): string {
  const rowSignatures = space.matrix.map((row) => row.join("¦"));
  const colSignatures = transpose(space.matrix).map((col) => col.join("¦"));
  const duplicateRows = duplicates(rowSignatures).map((group) => group.map((i) => space.points[Number(i)]));
  const duplicateCols = duplicates(colSignatures).map((group) => group.map((i) => space.states[Number(i)]));
  const separated = duplicateRows.length === 0;
  const extensional = duplicateCols.length === 0;
  return `
    <ul class="chu-list">
      <li><strong>${separated ? "separated" : "not separated"}</strong>${separated ? ": all rows are distinct" : `: duplicate point rows ${formatGroups(duplicateRows)}`}</li>
      <li><strong>${extensional ? "extensional" : "not extensional"}</strong>${extensional ? ": all columns are distinct" : `: duplicate state columns ${formatGroups(duplicateCols)}`}</li>
      <li><strong>${separated && extensional ? "biextensional" : "not biextensional"}</strong></li>
    </ul>`;
}

function formatGroups(groups: string[][]): string {
  return groups.map((group) => `{${group.map(escapeHtml).join(", ")}}`).join(" ");
}

function renderProfile(space: DisplaySpace): string {
  return `<ul class="chu-list">${space.values.map((value) => {
    const count = space.matrix.flat().filter((cell) => cell === value).length;
    return `<li><span class="chu-chip">${escapeHtml(value)}</span> occurs ${count} time${count === 1 ? "" : "s"}</li>`;
  }).join("")}</ul>`;
}

function renderSpace(): void {
  if (!summaryOutput || !matrixOutput || !diagnosticsOutput || !profileOutput) return;
  const base = currentSpace(spaceSelect);
  const shown = display(base, viewSelect?.value === "dual");
  summaryOutput.innerHTML = `<strong>${escapeHtml(shown.name)}</strong> · ${shown.points.length} points · ${shown.states.length} states · K = { ${shown.values.map(escapeHtml).join(", ")} }<br>${escapeHtml(shown.description)}`;
  matrixOutput.innerHTML = renderMatrix(shown);
  diagnosticsOutput.innerHTML = renderDiagnostics(shown);
  profileOutput.innerHTML = renderProfile(shown);
}

function allMaps(domainSize: number, codomainSize: number): number[][] {
  const result: number[][] = [];
  const current = Array(domainSize).fill(0) as number[];
  const step = (index: number) => {
    if (index === domainSize) {
      result.push([...current]);
      return;
    }
    for (let value = 0; value < codomainSize; value++) {
      current[index] = value;
      step(index + 1);
    }
  };
  step(0);
  return result;
}

function isMorphism(source: ChuSpace, target: ChuSpace, f: number[], g: number[]): boolean {
  return source.points.every((_point, a) => target.states.every((_state, y) => target.matrix[f[a]][y] === source.matrix[a][g[y]]));
}

function formatMap(domain: string[], codomain: string[], map: number[]): string {
  return domain.map((name, i) => `${escapeHtml(name)}↦${escapeHtml(codomain[map[i]])}`).join(", ");
}

function renderMorphisms(): void {
  if (!morphismOutput) return;
  const source = currentSpace(sourceSelect);
  const target = currentSpace(targetSelect);
  const pointMaps = allMaps(source.points.length, target.points.length);
  const stateMaps = allMaps(target.states.length, source.states.length);
  const found: { f: number[]; g: number[] }[] = [];
  for (const f of pointMaps) {
    for (const g of stateMaps) {
      if (isMorphism(source, target, f, g)) found.push({ f, g });
    }
  }
  const examples = found.slice(0, 8).map(({ f, g }) => `<li><strong>f</strong>: ${formatMap(source.points, target.points, f)}<br><strong>g</strong>: ${formatMap(target.states, source.states, g)}</li>`).join("");
  morphismOutput.innerHTML = `
    <p><strong>${found.length}</strong> morphism${found.length === 1 ? "" : "s"} from ${escapeHtml(source.name)} to ${escapeHtml(target.name)}.</p>
    ${found.length > 0 ? `<ol class="chu-list">${examples}</ol>${found.length > 8 ? `<p>showing 8 of ${found.length}</p>` : ""}` : "<p>No pair of maps satisfies the Chu adjointness equations.</p>"}
  `;
}

function populateMorphSelectors(): void {
  for (const select of [sourceSelect, targetSelect]) {
    if (!select) continue;
    select.innerHTML = spaces.map((space) => `<option value="${space.id}">${escapeHtml(space.name)}</option>`).join("");
  }
  if (sourceSelect) sourceSelect.value = "sierpinski";
  if (targetSelect) targetSelect.value = "powerset";
}

spaceSelect?.addEventListener("change", renderSpace);
viewSelect?.addEventListener("change", renderSpace);
sourceSelect?.addEventListener("change", renderMorphisms);
targetSelect?.addEventListener("change", renderMorphisms);
populateMorphSelectors();
renderSpace();
renderMorphisms();
