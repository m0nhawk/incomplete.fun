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

interface RingSegment {
  body: Matter.Body;
  ringId: number;
  radius: number;
  angle: number;
  speed: number;
}

interface Ring {
  id: number;
  radius: number;
  parts: Matter.Body[];
  escaped: boolean;
}

const canvas = document.querySelector<HTMLCanvasElement>("#escape-canvas");
const status = document.querySelector<HTMLElement>("#escape-status");
const resetButton = document.querySelector<HTMLButtonElement>("#escape-reset");
const RING_COUNT_MIN = 4;
const RING_COUNT_MAX = 6;
const RING_THICKNESS = 8;
const BALL_RADIUS = 7;

if (canvas && status && resetButton) {
  const engine = Engine.create({
    gravity: { x: 0, y: 0 },
  });
  const world = engine.world;

  const render = Render.create({
    canvas,
    engine,
    options: {
      background: "#080a2a",
      wireframes: false,
      pixelRatio: window.devicePixelRatio || 1,
      width: 0,
      height: 0,
    },
  });

  let ball = Bodies.circle(0, 0, BALL_RADIUS);
  let rings: Ring[] = [];
  let ringSegments: RingSegment[] = [];
  let ballSpeed = 0;
  let needsSpeedCorrection = false;
  let viewport = { width: 0, height: 0 };

  function rand(min: number, max: number) {
    return min + Math.random() * (max - min);
  }

  function randInt(min: number, max: number) {
    return Math.floor(rand(min, max + 1));
  }

  function removeBodies() {
    if (rings.length > 0) {
      World.remove(world, rings.flatMap((ring) => ring.parts));
      rings = [];
    }
    if (ball) {
      World.remove(world, ball);
    }
    ringSegments = [];
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
    render.canvas.width = viewport.width * (window.devicePixelRatio || 1);
    render.canvas.height = viewport.height * (window.devicePixelRatio || 1);
    render.canvas.style.width = `${viewport.width}px`;
    render.canvas.style.height = `${viewport.height}px`;
    Render.setPixelRatio(render, window.devicePixelRatio || 1);

    rebuildScene();
  }

  function createRing(radius: number, thickness: number, gap: number, speed: number, ringId: number): Ring {
    const pieces: Matter.Body[] = [];
    const segments = 48;
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
            strokeStyle: "#ff2f93",
            lineWidth: 1,
          },
        },
      );

      pieces.push(body);
      ringSegments.push({
        body,
        ringId,
        radius,
        angle,
        speed,
      });
    }

    return {
      id: ringId,
      radius,
      parts: pieces,
      escaped: false,
    };
  }

  function rebuildScene() {
    if (viewport.width === 0 || viewport.height === 0) return;

    removeBodies();
    const centerX = viewport.width / 2;
    const centerY = viewport.height / 2;
    const minEdge = Math.min(viewport.width, viewport.height);
    const ringCount = randInt(RING_COUNT_MIN, RING_COUNT_MAX);
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
    ballSpeed = rand(8, 10);
    Body.setVelocity(ball, {
      x: Math.cos(launchAngle) * ballSpeed,
      y: Math.sin(launchAngle) * ballSpeed,
    });

    World.add(world, [...rings.flatMap((ring) => ring.parts), ball]);
    status.textContent = `rings: ${ringCount}`;
  }

  Events.on(engine, "beforeUpdate", () => {
    if (viewport.width === 0 || viewport.height === 0) return;

    const centerX = viewport.width / 2;
    const centerY = viewport.height / 2;
    for (const part of ringSegments) {
      part.angle += part.speed;
      Body.setPosition(part.body, {
        x: centerX + Math.cos(part.angle) * part.radius,
        y: centerY + Math.sin(part.angle) * part.radius,
      });
      Body.setAngle(part.body, part.angle + Math.PI / 2);
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
      if (!ring.escaped && distanceFromCenter > ring.radius + RING_THICKNESS) {
        ring.escaped = true;
        World.remove(world, ring.parts);
        ringSegments = ringSegments.filter((segment) => segment.ringId !== ring.id);
        removedRings = true;
      }
    }
    if (removedRings) {
      status.textContent = `rings: ${rings.filter((ring) => !ring.escaped).length}`;
    }

    const velocityMagnitude = Math.hypot(ball.velocity.x, ball.velocity.y);
    if (needsSpeedCorrection && velocityMagnitude > 0 && ballSpeed > 0) {
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

  const observer = new ResizeObserver(resize);
  if (canvas.parentElement) observer.observe(canvas.parentElement);

  resize();
  Render.run(render);
  Runner.run(Runner.create(), engine);
}
