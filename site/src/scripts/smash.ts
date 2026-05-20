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

interface GlassShard {
  body: Matter.Body;
  broken: boolean;
}

interface MultiplierZone {
  body: Matter.Body;
  used: boolean;
}

const canvas = document.querySelector<HTMLCanvasElement>("#smash-canvas");
const status = document.querySelector<HTMLElement>("#smash-status");
const resetButton = document.querySelector<HTMLButtonElement>("#smash-reset");
const speedInput = document.querySelector<HTMLInputElement>("#smash-speed-input");
const MAX_PIXEL_RATIO = 2;
const BALL_RADIUS = 8;
const MAX_BALLS = 30;
const DEFAULT_LAUNCH_SPEED = 18;
const BLAST_HORIZONTAL_FORCE = 3;
const BLAST_VERTICAL_FORCE = 2.2;
const GLASS_ROWS = 11;
const GLASS_COLS = 8;
const MULTIPLIER_SIDE_OFFSET = 0.28;
const MULTIPLIER_SIDE_HEIGHT = 145;
const MULTIPLIER_MIDDLE_HEIGHT = 120;
const MULTIPLIER_VELOCITY_DAMPING = 0.92;
const MILLISECONDS_PER_SECOND = 1000;
const PHYSICS_STEPS_PER_SECOND = 120;

if (canvas && status && resetButton && speedInput) {
  const engine = Engine.create({
    gravity: { x: 0, y: 0.22 },
    positionIterations: 10,
    velocityIterations: 8,
    constraintIterations: 4,
  });
  const world = engine.world;
  const runner = Runner.create({
    delta: MILLISECONDS_PER_SECOND / PHYSICS_STEPS_PER_SECOND,
  });
  const getClampedPixelRatio = () => Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);

  const render = Render.create({
    canvas,
    engine,
    options: {
      background: "#04070f",
      wireframes: false,
      pixelRatio: getClampedPixelRatio(),
      width: 0,
      height: 0,
    },
  });

  let viewport = { width: 0, height: 0 };
  let balls: Matter.Body[] = [];
  let shards: GlassShard[] = [];
  let multipliers: MultiplierZone[] = [];
  let boundaries: Matter.Body[] = [];
  const ballActivatedMultipliers = new Map<number, Set<number>>();

  function readSpeed() {
    const parsed = Number(speedInput.value);
    if (!Number.isFinite(parsed)) return DEFAULT_LAUNCH_SPEED;
    return Math.max(8, Math.min(30, parsed));
  }

  function getBallFromPair(pair: Matter.Pair, zoneBody: Matter.Body) {
    if (pair.bodyA === zoneBody && balls.includes(pair.bodyB)) return pair.bodyB;
    if (pair.bodyB === zoneBody && balls.includes(pair.bodyA)) return pair.bodyA;
    return null;
  }

  function clearWorld() {
    if (balls.length > 0) {
      World.remove(world, balls);
      balls = [];
    }
    if (shards.length > 0) {
      World.remove(world, shards.map((shard) => shard.body));
      shards = [];
    }
    if (multipliers.length > 0) {
      World.remove(world, multipliers.map((zone) => zone.body));
      multipliers = [];
    }
    if (boundaries.length > 0) {
      World.remove(world, boundaries);
      boundaries = [];
    }
    ballActivatedMultipliers.clear();
  }

  function spawnBall(x: number, y: number, velocityX: number, velocityY: number) {
    if (balls.length >= MAX_BALLS) return;
    const ball = Bodies.circle(x, y, BALL_RADIUS, {
      restitution: 0.98,
      frictionAir: 0.0012,
      friction: 0,
      frictionStatic: 0,
      slop: 0,
      render: {
        fillStyle: "#ffffff",
      },
    });
    balls.push(ball);
    World.add(world, ball);
    Body.setVelocity(ball, { x: velocityX, y: velocityY });
  }

  function buildGlass(centerX: number, centerY: number, width: number, height: number) {
    const shardWidth = width / GLASS_COLS;
    const shardHeight = height / GLASS_ROWS;

    for (let row = 0; row < GLASS_ROWS; row++) {
      for (let col = 0; col < GLASS_COLS; col++) {
        const shard = Bodies.rectangle(
          centerX - width / 2 + shardWidth * (col + 0.5),
          centerY - height / 2 + shardHeight * (row + 0.5),
          shardWidth - 1.5,
          shardHeight - 1.5,
          {
            isStatic: true,
            restitution: 0.1,
            friction: 0.02,
            frictionAir: 0.002,
            render: {
              fillStyle: "#8bb1ff",
              strokeStyle: "#cfe0ff",
              lineWidth: 0.5,
            },
          },
        );
        shards.push({ body: shard, broken: false });
      }
    }
  }

  function buildMultipliers(centerX: number, centerY: number, width: number) {
    const points = [
      { x: centerX - width * MULTIPLIER_SIDE_OFFSET, y: centerY - MULTIPLIER_SIDE_HEIGHT },
      { x: centerX, y: centerY - MULTIPLIER_MIDDLE_HEIGHT },
      { x: centerX + width * MULTIPLIER_SIDE_OFFSET, y: centerY - MULTIPLIER_SIDE_HEIGHT },
    ];
    for (const point of points) {
      const zone = Bodies.circle(point.x, point.y, 16, {
        isStatic: true,
        isSensor: true,
        render: {
          fillStyle: "#ffcc4d",
          strokeStyle: "#ffe6a3",
          lineWidth: 1,
        },
      });
      multipliers.push({ body: zone, used: false });
    }
  }

  function updateStatus() {
    const intact = shards.filter((shard) => !shard.broken).length;
    const availableMultipliers = multipliers.filter((zone) => !zone.used).length;
    status.textContent = `balls: ${balls.length} · glass: ${intact} · x2: ${availableMultipliers}`;
  }

  function rebuildScene() {
    if (viewport.width === 0 || viewport.height === 0) return;

    clearWorld();

    const floor = Bodies.rectangle(viewport.width / 2, viewport.height + 18, viewport.width + 80, 36, {
      isStatic: true,
      render: { visible: false },
    });
    const leftWall = Bodies.rectangle(-18, viewport.height / 2, 36, viewport.height + 120, {
      isStatic: true,
      render: { visible: false },
    });
    const rightWall = Bodies.rectangle(viewport.width + 18, viewport.height / 2, 36, viewport.height + 120, {
      isStatic: true,
      render: { visible: false },
    });
    boundaries = [floor, leftWall, rightWall];

    const glassWidth = Math.min(260, viewport.width * 0.35);
    const glassHeight = Math.min(340, viewport.height * 0.62);
    const centerX = viewport.width * 0.57;
    const centerY = viewport.height * 0.55;
    buildGlass(centerX, centerY, glassWidth, glassHeight);
    buildMultipliers(centerX, centerY, glassWidth);

    const launchSpeed = readSpeed();
    spawnBall(
      Math.max(50, viewport.width * 0.08),
      Math.max(80, viewport.height * 0.25),
      launchSpeed,
      -Math.max(3.5, launchSpeed * 0.25),
    );

    World.add(world, [...boundaries, ...shards.map((shard) => shard.body), ...multipliers.map((zone) => zone.body)]);
    updateStatus();
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
    const pixelRatio = getClampedPixelRatio();
    render.canvas.width = viewport.width * pixelRatio;
    render.canvas.height = viewport.height * pixelRatio;
    render.canvas.style.width = `${viewport.width}px`;
    render.canvas.style.height = `${viewport.height}px`;
    Render.setPixelRatio(render, pixelRatio);

    rebuildScene();
  }

  Events.on(engine, "collisionStart", (event) => {
    for (const pair of event.pairs) {
      for (const shard of shards) {
        if (shard.broken) continue;
        const touchesShard =
          (pair.bodyA === shard.body && balls.includes(pair.bodyB)) ||
          (pair.bodyB === shard.body && balls.includes(pair.bodyA));
        if (!touchesShard) continue;

        shard.broken = true;
        Body.setStatic(shard.body, false);
        shard.body.render.fillStyle = "#d9e6ff";
        const blastX = (Math.random() - 0.5) * BLAST_HORIZONTAL_FORCE;
        const blastY = -Math.random() * BLAST_VERTICAL_FORCE;
        Body.setVelocity(shard.body, {
          x: shard.body.velocity.x + blastX,
          y: shard.body.velocity.y + blastY,
        });
      }

      for (let i = 0; i < multipliers.length; i++) {
        const zone = multipliers[i];
        if (zone.used) continue;
        const ball = getBallFromPair(pair, zone.body);
        if (!ball || !balls.includes(ball)) continue;

        const triggeredMultipliers = ballActivatedMultipliers.get(ball.id) ?? new Set<number>();
        if (triggeredMultipliers.has(zone.body.id)) continue;
        triggeredMultipliers.add(zone.body.id);
        ballActivatedMultipliers.set(ball.id, triggeredMultipliers);

        zone.used = true;
        zone.body.render.fillStyle = "#6b5f35";
        zone.body.render.strokeStyle = "#8b7b42";

        spawnBall(
          ball.position.x,
          ball.position.y,
          -ball.velocity.x * MULTIPLIER_VELOCITY_DAMPING,
          ball.velocity.y * MULTIPLIER_VELOCITY_DAMPING,
        );
      }
    }
    updateStatus();
  });

  Events.on(engine, "afterUpdate", () => {
    let changed = false;
    const margin = 60;
    for (let i = balls.length - 1; i >= 0; i--) {
      const ball = balls[i];
      if (
        ball.position.x < -margin ||
        ball.position.x > viewport.width + margin ||
        ball.position.y > viewport.height + margin
      ) {
        World.remove(world, ball);
        balls.splice(i, 1);
        ballActivatedMultipliers.delete(ball.id);
        changed = true;
      }
    }

    if (balls.length === 0 && viewport.width > 0 && viewport.height > 0) {
      const launchSpeed = readSpeed();
      spawnBall(
        Math.max(50, viewport.width * 0.08),
        Math.max(80, viewport.height * 0.25),
        launchSpeed,
        -Math.max(3.5, launchSpeed * 0.25),
      );
      changed = true;
    }

    if (changed) {
      updateStatus();
    }
  });

  resetButton.addEventListener("click", rebuildScene);
  speedInput.addEventListener("change", rebuildScene);

  const observer = new ResizeObserver(resize);
  if (canvas.parentElement) observer.observe(canvas.parentElement);

  resize();
  Render.run(render);
  Runner.run(runner, engine);
}
