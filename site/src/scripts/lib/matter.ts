import { Engine, Events, Render, Runner } from "matter-js";

export interface PhysicsApp {
  engine: Engine;
  runner: Runner;
  render: Render;
  destroy: () => void;
}

export interface PhysicsAppOptions {
  gravity?: { x: number; y: number };
  background?: string;
  maxPixelRatio?: number;
  delta?: number;
  positionIterations?: number;
  velocityIterations?: number;
  constraintIterations?: number;
}

export function createPhysicsApp(
  canvas: HTMLCanvasElement,
  opts: PhysicsAppOptions = {},
): PhysicsApp {
  const {
    gravity = { x: 0, y: 0 },
    background = "#080a2a",
    maxPixelRatio = 2,
    delta = 1000 / 60,
    positionIterations = 10,
    velocityIterations = 8,
    constraintIterations = 4,
  } = opts;

  const engine = Engine.create({
    gravity,
    positionIterations,
    velocityIterations,
    constraintIterations,
  });

  const runner = Runner.create({ delta });

  const render = Render.create({
    canvas,
    engine,
    options: {
      background,
      wireframes: false,
      pixelRatio: Math.min(window.devicePixelRatio || 1, maxPixelRatio),
      width: 0,
      height: 0,
    },
  });

  Render.run(render);
  Runner.run(runner, engine);

  return {
    engine,
    runner,
    render,
    destroy() {
      Runner.stop(runner);
      Render.stop(render);
    },
  };
}

export function resizePhysicsCanvas(
  render: Render,
  viewport: { width: number; height: number },
  maxPixelRatio = 2,
) {
  const pr = Math.min(window.devicePixelRatio || 1, maxPixelRatio);
  render.options.width = viewport.width;
  render.options.height = viewport.height;
  render.canvas.width = viewport.width * pr;
  render.canvas.height = viewport.height * pr;
  render.canvas.style.width = `${viewport.width}px`;
  render.canvas.style.height = `${viewport.height}px`;
  Render.setPixelRatio(render, pr);
}
