import {
  Body,
  Bodies,
  Composite,
  Engine,
  Events,
  Render,
  Runner,
  World,
} from "matter-js";

export {};

interface Ring {
  id: number;
  composite: Matter.Composite;
  radius: number;
  speed: number;
  escaped: boolean;
}

const canvas = document.querySelector<HTMLCanvasElement>("#escape-canvas");
const status = document.querySelector<HTMLElement>("#escape-status");
const resetButton = document.querySelector<HTMLButtonElement>("#escape-reset");
const ringCountInput = document.querySelector<HTMLInputElement>("#escape-rings-input");
const speedInput = document.querySelector<HTMLInputElement>("#escape-speed-input");
const DEFAULT_RING_COUNT = 5;
const DEFAULT_BALL_SPEED = 9;
const RING_SEGMENTS = 96;
const RING_THICKNESS = 8;
const BALL_RADIUS = 7;
const MAX_PIXEL_RATIO = 2;

if (canvas && status && resetButton && ringCountInput && speedInput) {
  const engine = Engine.create({
    gravity: { x: 0, y: 0 },
  });
  const world = engine.world;
  const getPixelRatio = () => Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);

  const render = Render.create({
    canvas,
    engine,
    options: {
      background: "#080a2a",
      wireframes: false,
      pixelRatio: getPixelRatio(),
      width: 0,
      height: 0,
    },
  });

  let ball = Bodies.circle(0, 0, BALL_RADIUS);
  let rings: Ring[] = [];
  let ballSpeed = 0;
  let needsSpeedCorrection = false;
  let viewport = { width: 0, height: 0 };

  function rand(min: number, max: number) {
    return min + Math.random() * (max - min);
  }

  function readInputNumber(input: HTMLInputElement, fallback: number, min: number, max: number) {
    const parsed = Number(input.value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(min, Math.min(max, parsed));
  }

  function removeBodies() {
    if (rings.length > 0) {
      World.remove(world, rings.map((ring) => ring.composite));
      rings = [];
    }
    if (ball) {
      World.remove(world, ball);
    }
  }

  function resize() {
    const parent = canvas.parentElement;
    if (!parent) return;

    viewport = {
      width: parent.clientWidth,
      height: parent.clientHeight,
    };

    render.options.width = viewport.width;
    render.options.height = viewport.height;
    const pixelRatio = getPixelRatio();
    render.canvas.width = viewport.width * pixelRatio;
    render.canvas.height = viewport.height * pixelRatio;
    render.canvas.style.width = `${viewport.width}px`;
    render.canvas.style.height = `${viewport.height}px`;
    Render.setPixelRatio(render, pixelRatio);

    rebuildScene();
  }

  function createRing(radius: number, thickness: number, gap: number, speed: number, ringId: number): Ring {
    const pieces: Matter.Body[] = [];
    const segments = RING_SEGMENTS;
    const gapCenter = Math.floor(rand(0, segments));
    const gapHalf = Math.max(2, Math.floor((segments * gap) / 2));
    const centerX = viewport.width / 2;
    const centerY = viewport.height / 2;

    for (let i = 0; i < segments; i++) {
      const distance = Math.min(
        Math.abs(i - gapCenter),
        segments - Math.abs(i - gapCenter),
      );
      if (distance <= gapHalf) continue;

      const angle = (i / segments) * Math.PI * 2;
      const length = (Math.PI * 2 * radius) / segments;
      const body = Bodies.rectangle(
        centerX + Math.cos(angle) * radius,
        centerY + Math.sin(angle) * radius,
        length + 2,
        thickness,
        {
          isStatic: true,
          angle: angle + Math.PI / 2,
          render: {
            fillStyle: "#2e5cff",
            strokeStyle: "#2e5cff",
            lineWidth: 0,
          },
        },
      );

      pieces.push(body);
    }

    const composite = Composite.create({ label: `ring-${ringId}` });
    Composite.add(composite, pieces);

    return {
      id: ringId,
      composite,
      radius,
      speed,
      escaped: false,
    };
  }

  function rebuildScene() {
    if (viewport.width === 0 || viewport.height === 0) return;

    removeBodies();
    const centerX = viewport.width / 2;
    const centerY = viewport.height / 2;
    const minEdge = Math.min(viewport.width, viewport.height);
    const ringCount = Math.round(readInputNumber(ringCountInput, DEFAULT_RING_COUNT, 1, 12));
    const spacing = minEdge / (ringCount * 2.2);

    for (let i = 0; i < ringCount; i++) {
      const ringId = i;
      const radius = spacing * (i + 1.6);
      const gap = rand(0.09, 0.16);
      const speed = rand(0.0015, 0.004) * (Math.random() > 0.5 ? 1 : -1);
      rings.push(createRing(radius, RING_THICKNESS, gap, speed, ringId));
    }

    ball = Bodies.circle(centerX, centerY, BALL_RADIUS, {
      restitution: 1,
      frictionAir: 0,
      friction: 0,
      frictionStatic: 0,
      render: {
        fillStyle: "#ffffff",
      },
    });

    const launchAngle = rand(0, Math.PI * 2);
    ballSpeed = readInputNumber(speedInput, DEFAULT_BALL_SPEED, 1, 20);
    Body.setVelocity(ball, {
      x: Math.cos(launchAngle) * ballSpeed,
      y: Math.sin(launchAngle) * ballSpeed,
    });

    World.add(world, [...rings.map((ring) => ring.composite), ball]);
    status.textContent = `rings: ${ringCount}`;
  }

  Events.on(engine, "beforeUpdate", () => {
    if (viewport.width === 0 || viewport.height === 0) return;

    const centerX = viewport.width / 2;
    const centerY = viewport.height / 2;
    for (const ring of rings) {
      if (ring.escaped) continue;
      Composite.rotate(ring.composite, ring.speed, {
        x: centerX,
        y: centerY,
      });
    }
  });

  Events.on(engine, "collisionStart", (event) => {
    for (const pair of event.pairs) {
      if (pair.bodyA === ball || pair.bodyB === ball) {
        needsSpeedCorrection = true;
        return;
      }
    }
  });

  Events.on(engine, "afterUpdate", () => {
    if (viewport.width === 0 || viewport.height === 0) return;

    const centerX = viewport.width / 2;
    const centerY = viewport.height / 2;
    const distanceFromCenter = Math.hypot(ball.position.x - centerX, ball.position.y - centerY);
    let removedRings = false;
    for (const ring of rings) {
      if (!ring.escaped && distanceFromCenter > ring.radius + RING_THICKNESS + BALL_RADIUS) {
        ring.escaped = true;
        World.remove(world, ring.composite);
        removedRings = true;
      }
    }
    if (removedRings) {
      status.textContent = `rings: ${rings.filter((ring) => !ring.escaped).length}`;
    }

    const velocityMagnitude = Math.hypot(ball.velocity.x, ball.velocity.y);
    if (needsSpeedCorrection && velocityMagnitude > 0) {
      Body.setVelocity(ball, {
        x: (ball.velocity.x / velocityMagnitude) * ballSpeed,
        y: (ball.velocity.y / velocityMagnitude) * ballSpeed,
      });
      needsSpeedCorrection = false;
    }

    const margin = 40;
    if (
      ball.position.x < -margin ||
      ball.position.y < -margin ||
      ball.position.x > viewport.width + margin ||
      ball.position.y > viewport.height + margin
    ) {
      rebuildScene();
    }
  });

  resetButton.addEventListener("click", rebuildScene);
  ringCountInput.addEventListener("change", rebuildScene);
  speedInput.addEventListener("change", rebuildScene);

  const observer = new ResizeObserver(resize);
  if (canvas.parentElement) observer.observe(canvas.parentElement);

  resize();
  Render.run(render);
  Runner.run(Runner.create(), engine);
}
