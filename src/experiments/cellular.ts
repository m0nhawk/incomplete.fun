export {};

const fg = () => getComputedStyle(document.documentElement).getPropertyValue("--fg").trim() || "#181817";
const bg = () => getComputedStyle(document.documentElement).getPropertyValue("--bg").trim() || "#fbfbf9";
const muted = () => getComputedStyle(document.documentElement).getPropertyValue("--muted").trim() || "#77736b";

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function canvasPoint(canvas: HTMLCanvasElement, event: PointerEvent): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * canvas.width,
    y: ((event.clientY - rect.top) / rect.height) * canvas.height,
  };
}

function fillCell(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, alive: boolean) {
  ctx.fillStyle = alive ? fg() : bg();
  ctx.fillRect(x * size, y * size, size, size);
}

// 1D elementary automata ----------------------------------------------------
const ca1Canvas = document.querySelector<HTMLCanvasElement>("#ca1-canvas")!;
const ca1RuleInput = document.querySelector<HTMLInputElement>("#ca1-rule")!;
const ca1RuleTable = document.querySelector<HTMLDivElement>("#ca1-rule-table")!;
const ca1Step = document.querySelector<HTMLButtonElement>("#ca1-step")!;
const ca1Play = document.querySelector<HTMLButtonElement>("#ca1-play")!;
const ca1Single = document.querySelector<HTMLButtonElement>("#ca1-single")!;
const ca1Random = document.querySelector<HTMLButtonElement>("#ca1-random")!;
const ca1Clear = document.querySelector<HTMLButtonElement>("#ca1-clear")!;

if (ca1Canvas && ca1RuleInput && ca1RuleTable && ca1Step && ca1Play && ca1Single && ca1Random && ca1Clear) {
  const ctx = ca1Canvas.getContext("2d")!;
  const cols = 96;
  const rows = 56;
  const size = ca1Canvas.width / cols;
  let seed = Array.from({ length: cols }, () => 0);
  let history: number[][] = [];
  let timer: number | null = null;

  const ruleNumber = () => clamp(Math.floor(Number(ca1RuleInput.value) || 0), 0, 255);

  function evolve(row: number[]): number[] {
    const rule = ruleNumber();
    return row.map((_cell, i) => {
      const left = row[(i - 1 + cols) % cols];
      const center = row[i];
      const right = row[(i + 1) % cols];
      const pattern = left * 4 + center * 2 + right;
      return (rule >> pattern) & 1;
    });
  }

  function resetHistory() {
    history = [seed.slice()];
    draw1D();
  }

  function step1D() {
    history.push(evolve(history[history.length - 1]));
    if (history.length > rows) history.shift();
    seed = history[0].slice();
    draw1D();
  }

  function draw1D() {
    ctx.fillStyle = bg();
    ctx.fillRect(0, 0, ca1Canvas.width, ca1Canvas.height);
    history.forEach((row, y) => row.forEach((alive, x) => fillCell(ctx, x, y, size, alive === 1)));
    ctx.strokeStyle = muted();
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, ca1Canvas.width, size);
  }

  function drawRuleTable() {
    const rule = ruleNumber();
    ca1RuleInput.value = String(rule);
    ca1RuleTable.innerHTML = Array.from({ length: 8 }, (_unused, index) => 7 - index).map((pattern) => {
      const bits = [pattern & 4, pattern & 2, pattern & 1].map((bit) => bit ? "is-alive" : "");
      const out = ((rule >> pattern) & 1) ? "is-alive" : "";
      return `<div class="rule-chip"><div class="rule-cells"><span class="rule-cell ${bits[0]}"></span><span class="rule-cell ${bits[1]}"></span><span class="rule-cell ${bits[2]}"></span></div><span>↓</span><span class="rule-out ${out}"></span></div>`;
    }).join("");
  }

  function setPlaying(playing: boolean) {
    if (timer !== null) window.clearInterval(timer);
    timer = playing ? window.setInterval(step1D, 90) : null;
    ca1Play.textContent = playing ? "pause" : "play";
  }

  seed[Math.floor(cols / 2)] = 1;
  resetHistory();
  drawRuleTable();

  ca1RuleInput.addEventListener("input", () => { drawRuleTable(); resetHistory(); });
  ca1Step.addEventListener("click", step1D);
  ca1Play.addEventListener("click", () => setPlaying(timer === null));
  ca1Single.addEventListener("click", () => { seed = Array.from({ length: cols }, () => 0); seed[Math.floor(cols / 2)] = 1; resetHistory(); });
  ca1Random.addEventListener("click", () => { seed = Array.from({ length: cols }, () => Math.random() < 0.38 ? 1 : 0); resetHistory(); });
  ca1Clear.addEventListener("click", () => { seed = Array.from({ length: cols }, () => 0); resetHistory(); });
  ca1Canvas.addEventListener("pointerdown", (event) => {
    const point = canvasPoint(ca1Canvas, event);
    const x = clamp(Math.floor(point.x / size), 0, cols - 1);
    seed[x] = seed[x] ? 0 : 1;
    resetHistory();
  });
}

// 2D outer-totalistic automata ---------------------------------------------
type RuleName = "life" | "highlife" | "seeds" | "daynight" | "majority";

interface RuleDef {
  birth: Set<number>;
  survive: Set<number>;
  label: string;
}

const RULES: Record<RuleName, RuleDef> = {
  life: { birth: new Set([3]), survive: new Set([2, 3]), label: "B3/S23" },
  highlife: { birth: new Set([3, 6]), survive: new Set([2, 3]), label: "B36/S23" },
  seeds: { birth: new Set([2]), survive: new Set([]), label: "B2/S" },
  daynight: { birth: new Set([3, 6, 7, 8]), survive: new Set([3, 4, 6, 7, 8]), label: "B3678/S34678" },
  majority: { birth: new Set([5, 6, 7, 8]), survive: new Set([4, 5, 6, 7, 8]), label: "B5678/S45678" },
};

const ca2Canvas = document.querySelector<HTMLCanvasElement>("#ca2-canvas")!;
const ca2HistoryCanvas = document.querySelector<HTMLCanvasElement>("#ca2-history")!;
const ca2Rule = document.querySelector<HTMLSelectElement>("#ca2-rule")!;
const ca2Step = document.querySelector<HTMLButtonElement>("#ca2-step")!;
const ca2Play = document.querySelector<HTMLButtonElement>("#ca2-play")!;
const ca2Random = document.querySelector<HTMLButtonElement>("#ca2-random")!;
const ca2Clear = document.querySelector<HTMLButtonElement>("#ca2-clear")!;
const ca2Stats = document.querySelector<HTMLDivElement>("#ca2-stats")!;

if (ca2Canvas && ca2HistoryCanvas && ca2Rule && ca2Step && ca2Play && ca2Random && ca2Clear && ca2Stats) {
  const ctx = ca2Canvas.getContext("2d")!;
  const hctx = ca2HistoryCanvas.getContext("2d")!;
  const cols = 64;
  const rows = 40;
  const cell = ca2Canvas.width / cols;
  let grid = Array.from({ length: rows }, () => Array.from({ length: cols }, () => 0));
  let generation = 0;
  let populationHistory: number[] = [];
  let snapshots: number[][][] = [];
  let timer: number | null = null;
  let drawing = false;
  let drawValue = 1;

  function liveCount(): number {
    return grid.reduce((sum, row) => sum + row.reduce((rowSum, value) => rowSum + value, 0), 0);
  }

  function remember() {
    populationHistory.push(liveCount());
    if (populationHistory.length > 140) populationHistory.shift();
    snapshots.push(grid.map((row) => row.slice()));
    if (snapshots.length > 7) snapshots.shift();
  }

  function neighbors(x: number, y: number): number {
    let count = 0;
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        if (dx === 0 && dy === 0) continue;
        count += grid[(y + dy + rows) % rows][(x + dx + cols) % cols];
      }
    }
    return count;
  }

  function step2D() {
    const rule = RULES[ca2Rule.value as RuleName];
    grid = grid.map((row, y) => row.map((alive, x) => {
      const count = neighbors(x, y);
      return alive ? (rule.survive.has(count) ? 1 : 0) : (rule.birth.has(count) ? 1 : 0);
    }));
    generation += 1;
    remember();
    draw2D();
  }

  function draw2D() {
    ctx.fillStyle = bg();
    ctx.fillRect(0, 0, ca2Canvas.width, ca2Canvas.height);
    ctx.fillStyle = fg();
    grid.forEach((row, y) => row.forEach((alive, x) => {
      if (alive) ctx.fillRect(x * cell, y * cell, cell, cell);
    }));
    ctx.strokeStyle = "rgba(128,128,128,0.18)";
    ctx.lineWidth = 1;
    for (let x = 0; x <= cols; x += 8) {
      ctx.beginPath(); ctx.moveTo(x * cell, 0); ctx.lineTo(x * cell, ca2Canvas.height); ctx.stroke();
    }
    for (let y = 0; y <= rows; y += 8) {
      ctx.beginPath(); ctx.moveTo(0, y * cell); ctx.lineTo(ca2Canvas.width, y * cell); ctx.stroke();
    }
    drawHistory();
    ca2Stats.innerHTML = `<strong>generation</strong> ${generation}<br><strong>population</strong> ${liveCount()} / ${cols * rows}<br><strong>rule</strong> ${RULES[ca2Rule.value as RuleName].label}`;
  }

  function drawMini(snapshot: number[][], left: number, top: number, width: number, height: number) {
    const sx = width / cols;
    const sy = height / rows;
    hctx.fillStyle = fg();
    snapshot.forEach((row, y) => row.forEach((alive, x) => {
      if (alive) hctx.fillRect(left + x * sx, top + y * sy, Math.max(1, sx), Math.max(1, sy));
    }));
  }

  function drawHistory() {
    hctx.fillStyle = bg();
    hctx.fillRect(0, 0, ca2HistoryCanvas.width, ca2HistoryCanvas.height);
    const maxPop = Math.max(1, ...populationHistory);
    hctx.strokeStyle = fg();
    hctx.beginPath();
    populationHistory.forEach((pop, i) => {
      const x = (i / Math.max(1, populationHistory.length - 1)) * ca2HistoryCanvas.width;
      const y = 110 - (pop / maxPop) * 100 + 8;
      if (i === 0) hctx.moveTo(x, y); else hctx.lineTo(x, y);
    });
    hctx.stroke();
    hctx.fillStyle = muted();
    hctx.fillText("population", 8, 14);
    snapshots.forEach((snapshot, i) => {
      const w = 84;
      const h = 52;
      const left = 8 + (i % 3) * 90;
      const top = 130 + Math.floor(i / 3) * 66;
      hctx.strokeStyle = muted();
      hctx.strokeRect(left, top, w, h);
      drawMini(snapshot, left, top, w, h);
    });
  }

  function setPlaying(playing: boolean) {
    if (timer !== null) window.clearInterval(timer);
    timer = playing ? window.setInterval(step2D, 120) : null;
    ca2Play.textContent = playing ? "pause" : "play";
  }

  function resetHistory() {
    generation = 0;
    populationHistory = [];
    snapshots = [];
    remember();
    draw2D();
  }

  function paint(event: PointerEvent) {
    const point = canvasPoint(ca2Canvas, event);
    const x = clamp(Math.floor(point.x / cell), 0, cols - 1);
    const y = clamp(Math.floor(point.y / cell), 0, rows - 1);
    grid[y][x] = drawValue;
    resetHistory();
  }

  ca2Canvas.addEventListener("pointerdown", (event) => {
    ca2Canvas.setPointerCapture(event.pointerId);
    const point = canvasPoint(ca2Canvas, event);
    const x = clamp(Math.floor(point.x / cell), 0, cols - 1);
    const y = clamp(Math.floor(point.y / cell), 0, rows - 1);
    drawValue = grid[y][x] ? 0 : 1;
    drawing = true;
    paint(event);
  });
  ca2Canvas.addEventListener("pointermove", (event) => { if (drawing) paint(event); });
  ca2Canvas.addEventListener("pointerup", () => { drawing = false; });
  ca2Canvas.addEventListener("pointercancel", () => { drawing = false; });

  ca2Step.addEventListener("click", step2D);
  ca2Play.addEventListener("click", () => setPlaying(timer === null));
  ca2Rule.addEventListener("change", resetHistory);
  ca2Random.addEventListener("click", () => {
    grid = Array.from({ length: rows }, () => Array.from({ length: cols }, () => Math.random() < 0.28 ? 1 : 0));
    resetHistory();
  });
  ca2Clear.addEventListener("click", () => {
    grid = Array.from({ length: rows }, () => Array.from({ length: cols }, () => 0));
    resetHistory();
  });

  // A small glider and oscillator seed.
  [[1, 0], [2, 1], [0, 2], [1, 2], [2, 2], [18, 12], [19, 12], [20, 12]].forEach(([x, y]) => { grid[y + 10][x + 10] = 1; });
  resetHistory();
}
