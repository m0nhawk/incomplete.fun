import {
  Body,
  Bodies,
  Engine,
  Events,
  Render,
  Runner,
  World,
} from "matter-js";

export {};

type FigureType = "box" | "plank" | "circle" | "triangle" | "spiral";

interface PlacedFigure {
  type: FigureType;
  bodies: Matter.Body[];
  cx: number;
  cy: number;
}

const BG_COLOR = "#080a2a";
const BALL_COLOR = "#ffffff";
const START_COLOR = "#22c55e";
const END_COLOR = "#f59e0b";
const WALL_COLOR = "#0c1540";

const FIGURE_COLORS: Record<FigureType, string> = {
  box: "#2e5cff",
  plank: "#7c3aed",
  circle: "#ff6b2e",
  triangle: "#22c55e",
  spiral: "#e879f9",
};

const BALL_RADIUS = 10;
const BOX_SIZE = 48;
const PLANK_W = 90;
const PLANK_H = 12;
const CIRCLE_R = 24;
const TRIANGLE_R = 32;
const SPIRAL_R_START = 16;
const SPIRAL_R_END = 68;
const SPIRAL_TURNS = 2;
const SPIRAL_SEGMENTS = 48;
const SPIRAL_THICKNESS = 8;
const WALL_THICKNESS = 50;

const MAX_PIXEL_RATIO = 2;
const PHYSICS_STEPS_PER_SECOND = 60;
const MS_PER_SECOND = 1000;
const END_ZONE_W = 110;
const END_ZONE_H = 40;
const START_ZONE_R = 20;
const FIGURE_RESTITUTION = 0.5;
const FIGURE_FRICTION = 0.1;

const canvas = document.querySelector<HTMLCanvasElement>("#playground-canvas");
const statusEl = document.querySelector<HTMLElement>("#playground-status");
const clearButton = document.querySelector<HTMLButtonElement>("#playground-clear");
const launchButton = document.querySelector<HTMLButtonElement>("#playground-launch");
const figureButtons = document.querySelectorAll<HTMLButtonElement>("[data-figure]");

if (canvas && statusEl && clearButton && launchButton) {
  const engine = Engine.create({
    gravity: { x: 0, y: 1.2 },
  });
  const world = engine.world;
  const runner = Runner.create({
    delta: MS_PER_SECOND / PHYSICS_STEPS_PER_SECOND,
  });
  const getPixelRatio = () => Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);

  const render = Render.create({
    canvas,
    engine,
    options: {
      background: BG_COLOR,
      wireframes: false,
      pixelRatio: getPixelRatio(),
      width: 0,
      height: 0,
    },
  });

  let viewport = { width: 0, height: 0 };
  let selectedFigure: FigureType = "box";
  let placedFigures: PlacedFigure[] = [];
  let ball: Matter.Body | null = null;
  let walls: Matter.Body[] = [];
  let gameState: "placing" | "launched" | "won" | "lost" = "placing";
  let mousePos = { x: 0, y: 0 };
  let mouseOnCanvas = false;

  function getStartCenter() {
    return { x: viewport.width / 2, y: 50 };
  }

  function getEndZone() {
    const cx = viewport.width / 2;
    const y = viewport.height - END_ZONE_H - 10;
    return { x: cx - END_ZONE_W / 2, y, w: END_ZONE_W, h: END_ZONE_H };
  }

  function createWalls() {
    const { width: w, height: h } = viewport;
    const thick = WALL_THICKNESS;
    walls = [
      Bodies.rectangle(-thick / 2, h / 2, thick, h * 3, {
        isStatic: true,
        render: { fillStyle: WALL_COLOR, strokeStyle: WALL_COLOR, lineWidth: 0 },
      }),
      Bodies.rectangle(w + thick / 2, h / 2, thick, h * 3, {
        isStatic: true,
        render: { fillStyle: WALL_COLOR, strokeStyle: WALL_COLOR, lineWidth: 0 },
      }),
    ];
    World.add(world, walls);
  }

  function makeSingleBody(type: Exclude<FigureType, "spiral">, x: number, y: number): Matter.Body {
    const color = FIGURE_COLORS[type];
    const opts = {
      isStatic: true,
      restitution: FIGURE_RESTITUTION,
      friction: FIGURE_FRICTION,
      slop: 0,
      render: { fillStyle: color, strokeStyle: color, lineWidth: 0 },
    };
    if (type === "box") return Bodies.rectangle(x, y, BOX_SIZE, BOX_SIZE, opts);
    if (type === "plank") return Bodies.rectangle(x, y, PLANK_W, PLANK_H, opts);
    if (type === "circle") return Bodies.circle(x, y, CIRCLE_R, opts);
    return Bodies.polygon(x, y, 3, TRIANGLE_R, opts);
  }

  function makeSpiralBodies(cx: number, cy: number): Matter.Body[] {
    const bodies: Matter.Body[] = [];
    const color = FIGURE_COLORS["spiral"];
    const opts = {
      isStatic: true,
      restitution: FIGURE_RESTITUTION,
      friction: FIGURE_FRICTION,
      slop: 0,
      render: { fillStyle: color, strokeStyle: color, lineWidth: 0 },
    };
    for (let i = 0; i < SPIRAL_SEGMENTS; i++) {
      const t0 = i / SPIRAL_SEGMENTS;
      const t1 = (i + 1) / SPIRAL_SEGMENTS;
      const θ0 = t0 * Math.PI * 2 * SPIRAL_TURNS;
      const θ1 = t1 * Math.PI * 2 * SPIRAL_TURNS;
      const r0 = SPIRAL_R_START + (SPIRAL_R_END - SPIRAL_R_START) * t0;
      const r1 = SPIRAL_R_START + (SPIRAL_R_END - SPIRAL_R_START) * t1;
      const x0 = cx + Math.cos(θ0) * r0;
      const y0 = cy + Math.sin(θ0) * r0;
      const x1 = cx + Math.cos(θ1) * r1;
      const y1 = cy + Math.sin(θ1) * r1;
      const midX = (x0 + x1) / 2;
      const midY = (y0 + y1) / 2;
      const len = Math.hypot(x1 - x0, y1 - y0);
      const angle = Math.atan2(y1 - y0, x1 - x0);
      bodies.push(
        Bodies.rectangle(midX, midY, len + 1, SPIRAL_THICKNESS, {
          ...opts,
          angle,
        }),
      );
    }
    return bodies;
  }

  function isNearProtectedZone(x: number, y: number, extra = 0): boolean {
    const start = getStartCenter();
    if (Math.hypot(x - start.x, y - start.y) < START_ZONE_R + 30 + extra) return true;
    const ez = getEndZone();
    if (
      x > ez.x - 20 - extra &&
      x < ez.x + ez.w + 20 + extra &&
      y > ez.y - 20 - extra
    )
      return true;
    return false;
  }

  function updateFigureButtons() {
    figureButtons.forEach((btn) => {
      const fig = btn.dataset.figure as FigureType;
      const isActive = fig === selectedFigure;
      btn.classList.toggle("is-active", isActive);
      if (isActive) {
        btn.style.background = FIGURE_COLORS[fig];
        btn.style.borderColor = FIGURE_COLORS[fig];
        btn.style.color = "#fff";
      } else {
        btn.style.removeProperty("background");
        btn.style.removeProperty("borderColor");
        btn.style.removeProperty("color");
      }
    });
  }

  function placeFigure(x: number, y: number) {
    if (gameState !== "placing") return;
    const extra = selectedFigure === "spiral" ? SPIRAL_R_END : 0;
    if (isNearProtectedZone(x, y, extra)) return;
    let bodies: Matter.Body[];
    if (selectedFigure === "spiral") {
      bodies = makeSpiralBodies(x, y);
    } else {
      bodies = [makeSingleBody(selectedFigure, x, y)];
    }
    for (const body of bodies) {
      World.add(world, body);
    }
    placedFigures.push({ type: selectedFigure, bodies, cx: x, cy: y });
    updateStatus();
  }

  function removeFigureNear(x: number, y: number) {
    if (gameState !== "placing") return;
    const idx = placedFigures.findIndex(({ cx, cy, type }) => {
      const threshold = type === "spiral" ? SPIRAL_R_END : 45;
      return Math.hypot(cx - x, cy - y) < threshold;
    });
    if (idx >= 0) {
      for (const body of placedFigures[idx].bodies) {
        World.remove(world, body);
      }
      placedFigures.splice(idx, 1);
      updateStatus();
    }
  }

  function launchBall() {
    if (gameState !== "placing") return;
    const { x, y } = getStartCenter();
    const nudge = (Math.random() - 0.5) * 3;
    ball = Bodies.circle(x, y, BALL_RADIUS, {
      restitution: 0.7,
      frictionAir: 0.003,
      friction: 0.05,
      slop: 0,
      render: { fillStyle: BALL_COLOR },
    });
    Body.setVelocity(ball, { x: nudge, y: 2 });
    World.add(world, ball);
    gameState = "launched";
    updateStatus();
  }

  function resetBall() {
    if (ball) {
      World.remove(world, ball);
      ball = null;
    }
    gameState = "placing";
    updateStatus();
  }

  function clearAll() {
    for (const fig of placedFigures) {
      for (const body of fig.bodies) {
        World.remove(world, body);
      }
    }
    placedFigures = [];
    resetBall();
  }

  function updateStatus() {
    launchButton.disabled = gameState === "launched";
    launchButton.textContent = gameState === "placing" ? "launch" : "retry";
    if (gameState === "won") {
      statusEl.textContent = "🎉 reached the goal!";
    } else if (gameState === "lost") {
      statusEl.textContent = "missed · retry to try again";
    } else if (gameState === "launched") {
      statusEl.textContent = "launched…";
    } else {
      const n = placedFigures.length;
      statusEl.textContent =
        n === 0
          ? "click to place · right-click removes"
          : `${n} figure${n !== 1 ? "s" : ""} placed`;
    }
  }

  function drawSpiralPath(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
    ctx.beginPath();
    for (let i = 0; i <= 120; i++) {
      const t = i / 120;
      const θ = t * Math.PI * 2 * SPIRAL_TURNS;
      const r = SPIRAL_R_START + (SPIRAL_R_END - SPIRAL_R_START) * t;
      const px = cx + Math.cos(θ) * r;
      const py = cy + Math.sin(θ) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }

  function drawOverlays() {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const pr = getPixelRatio();
    ctx.save();
    ctx.scale(pr, pr);

    // Wall boundary indicators
    ctx.fillStyle = "#1a2a6f";
    ctx.fillRect(0, 0, 3, viewport.height);
    ctx.fillRect(viewport.width - 3, 0, 3, viewport.height);

    // Start zone
    const start = getStartCenter();
    ctx.beginPath();
    ctx.arc(start.x, start.y, START_ZONE_R, 0, Math.PI * 2);
    ctx.fillStyle = START_COLOR + "33";
    ctx.fill();
    ctx.strokeStyle = START_COLOR;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = START_COLOR;
    ctx.font = "bold 10px monospace";
    ctx.textAlign = "center";
    ctx.fillText("START", start.x, start.y + START_ZONE_R + 14);

    // End zone
    const ez = getEndZone();
    ctx.fillStyle = END_COLOR + "33";
    ctx.fillRect(ez.x, ez.y, ez.w, ez.h);
    ctx.strokeStyle = END_COLOR;
    ctx.lineWidth = 2;
    ctx.strokeRect(ez.x, ez.y, ez.w, ez.h);
    ctx.fillStyle = END_COLOR;
    ctx.font = "bold 10px monospace";
    ctx.textAlign = "center";
    ctx.fillText("GOAL", ez.x + ez.w / 2, ez.y + ez.h / 2 + 4);

    // Placement preview
    if (mouseOnCanvas && gameState === "placing") {
      const extra = selectedFigure === "spiral" ? SPIRAL_R_END : 0;
      const blocked = isNearProtectedZone(mousePos.x, mousePos.y, extra);
      ctx.globalAlpha = blocked ? 0.2 : 0.45;
      ctx.fillStyle = FIGURE_COLORS[selectedFigure];
      const { x, y } = mousePos;
      if (selectedFigure === "box") {
        ctx.fillRect(x - BOX_SIZE / 2, y - BOX_SIZE / 2, BOX_SIZE, BOX_SIZE);
      } else if (selectedFigure === "plank") {
        ctx.fillRect(x - PLANK_W / 2, y - PLANK_H / 2, PLANK_W, PLANK_H);
      } else if (selectedFigure === "circle") {
        ctx.beginPath();
        ctx.arc(x, y, CIRCLE_R, 0, Math.PI * 2);
        ctx.fill();
      } else if (selectedFigure === "triangle") {
        ctx.beginPath();
        for (let i = 0; i < 3; i++) {
          const angle = (i / 3) * Math.PI * 2 - Math.PI / 2;
          const px = x + Math.cos(angle) * TRIANGLE_R;
          const py = y + Math.sin(angle) * TRIANGLE_R;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
      } else if (selectedFigure === "spiral") {
        ctx.strokeStyle = FIGURE_COLORS["spiral"];
        ctx.lineWidth = SPIRAL_THICKNESS;
        ctx.lineCap = "round";
        drawSpiralPath(ctx, x, y);
      }
      ctx.globalAlpha = 1;
    }

    // Win/loss tint
    if (gameState === "won") {
      ctx.fillStyle = "rgba(34, 197, 94, 0.15)";
      ctx.fillRect(0, 0, viewport.width, viewport.height);
    } else if (gameState === "lost") {
      ctx.fillStyle = "rgba(239, 68, 68, 0.10)";
      ctx.fillRect(0, 0, viewport.width, viewport.height);
    }

    ctx.restore();
  }

  Events.on(render, "afterRender", drawOverlays);

  Events.on(engine, "afterUpdate", () => {
    if (gameState !== "launched" || !ball) return;

    const ez = getEndZone();
    const bx = ball.position.x;
    const by = ball.position.y;

    if (bx >= ez.x && bx <= ez.x + ez.w && by >= ez.y && by <= ez.y + ez.h) {
      gameState = "won";
      updateStatus();
      return;
    }

    if (by > viewport.height + BALL_RADIUS * 3) {
      World.remove(world, ball);
      ball = null;
      gameState = "lost";
      updateStatus();
    }
  });

  canvas.addEventListener("mousemove", (e) => {
    const rect = canvas.getBoundingClientRect();
    mousePos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    mouseOnCanvas = true;
  });

  canvas.addEventListener("mouseleave", () => {
    mouseOnCanvas = false;
  });

  canvas.addEventListener("click", (e) => {
    const rect = canvas.getBoundingClientRect();
    placeFigure(e.clientX - rect.left, e.clientY - rect.top);
  });

  canvas.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    removeFigureNear(e.clientX - rect.left, e.clientY - rect.top);
  });

  figureButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      selectedFigure = btn.dataset.figure as FigureType;
      updateFigureButtons();
    });
  });

  launchButton.addEventListener("click", () => {
    if (gameState === "placing") {
      launchBall();
    } else if (gameState === "won" || gameState === "lost") {
      resetBall();
    }
  });

  clearButton.addEventListener("click", clearAll);

  function resize() {
    const parent = canvas.parentElement;
    if (!parent) return;
    viewport = { width: parent.clientWidth, height: parent.clientHeight };

    render.options.width = viewport.width;
    render.options.height = viewport.height;
    const pr = getPixelRatio();
    render.canvas.width = viewport.width * pr;
    render.canvas.height = viewport.height * pr;
    render.canvas.style.width = `${viewport.width}px`;
    render.canvas.style.height = `${viewport.height}px`;
    Render.setPixelRatio(render, pr);

    if (walls.length > 0) {
      for (const wall of walls) {
        World.remove(world, wall);
      }
      walls = [];
    }
    createWalls();
  }

  const observer = new ResizeObserver(resize);
  if (canvas.parentElement) observer.observe(canvas.parentElement);

  updateFigureButtons();
  resize();
  updateStatus();
  Render.run(render);
  Runner.run(runner, engine);
}
