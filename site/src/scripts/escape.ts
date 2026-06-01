import { Body, Bodies, Composite, Events, World } from "matter-js";
import { createPhysicsApp, resizePhysicsCanvas } from "./lib/matter";
import { q } from "./lib/dom";
import { clampInt, rand } from "./lib/math";

interface Ring {
  id: number;
  composite: Matter.Composite;
  radius: number;
  speed: number;
  escaped: boolean;
}

interface Viewport {
  width: number;
  height: number;
}

const INPUT_RANGE = { min: 1, max: 12, fallback: 5 };
const SPEED_RANGE = { min: 1, max: 20, fallback: 9 };
const RING_SEGMENTS = 96;
const RING_THICKNESS = 8;
const BALL_RADIUS = 7;
const RING_ANGULAR_SPEED_MIN = 0.09;
const RING_ANGULAR_SPEED_MAX = 0.24;

const canvas = q<HTMLCanvasElement>("#escape-canvas");
const status = q<HTMLElement>("#escape-status");
const resetButton = q<HTMLButtonElement>("#escape-reset");
const ringCountInput = q<HTMLInputElement>("#escape-rings-input");
const speedInput = q<HTMLInputElement>("#escape-speed-input");

if (canvas && status && resetButton && ringCountInput && speedInput) {
  const { engine, render } = createPhysicsApp(canvas, {
    delta: 1000 / 120,
    gravity: { x: 0, y: 0 },
  });

  let ball = Bodies.circle(0, 0, BALL_RADIUS);
  let rings: Ring[] = [];
  let ballSpeed = 0;
  let needsSpeedCorrection = false;
  let viewport: Viewport = { width: 0, height: 0 };

  function removeBodies() {
    if (rings.length > 0) {
      World.remove(engine.world, rings.map((ring) => ring.composite));
      rings = [];
    }
    if (ball) {
      World.remove(engine.world, ball);
    }
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
          slop: 0,
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

    return { id: ringId, composite, radius, speed, escaped: false };
  }

  function rebuildScene() {
    if (viewport.width === 0 || viewport.height === 0) return;

    removeBodies();
    const centerX = viewport.width / 2;
    const centerY = viewport.height / 2;
    const minEdge = Math.min(viewport.width, viewport.height);
    const ringCount = Math.round(clampInt(ringCountInput.value, INPUT_RANGE.min, INPUT_RANGE.max, INPUT_RANGE.fallback));
    const spacing = minEdge / (ringCount * 2.2);

    for (let i = 0; i < ringCount; i++) {
      const radius = spacing * (i + 1.6);
      const gap = rand(0.09, 0.16);
      const speed = rand(RING_ANGULAR_SPEED_MIN, RING_ANGULAR_SPEED_MAX) * (Math.random() > 0.5 ? 1 : -1);
      rings.push(createRing(radius, RING_THICKNESS, gap, speed, i));
    }

    ball = Bodies.circle(centerX, centerY, BALL_RADIUS, {
      restitution: 1,
      frictionAir: 0,
      friction: 0,
      frictionStatic: 0,
      slop: 0,
      render: { fillStyle: "#ffffff" },
    });

    const launchAngle = rand(0, Math.PI * 2);
    ballSpeed = clampInt(speedInput.value, SPEED_RANGE.min, SPEED_RANGE.max, SPEED_RANGE.fallback);
    Body.setVelocity(ball, {
      x: Math.cos(launchAngle) * ballSpeed,
      y: Math.sin(launchAngle) * ballSpeed,
    });

    World.add(engine.world, [...rings.map((ring) => ring.composite), ball]);
    status.textContent = `rings: ${ringCount}`;
  }

  function resize() {
    const parent = canvas.parentElement;
    if (!parent) return;
    viewport = { width: parent.clientWidth, height: parent.clientHeight };
    resizePhysicsCanvas(render, viewport);
    rebuildScene();
  }

  Events.on(engine, "beforeUpdate", () => {
    if (viewport.width === 0 || viewport.height === 0) return;
    const centerX = viewport.width / 2;
    const centerY = viewport.height / 2;
    const deltaSeconds = engine.timing.lastDelta / 1000;
    for (const ring of rings) {
      if (ring.escaped) continue;
      Composite.rotate(ring.composite, ring.speed * deltaSeconds, {
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
        World.remove(engine.world, ring.composite);
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
}
