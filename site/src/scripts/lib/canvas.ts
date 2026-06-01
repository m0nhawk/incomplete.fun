export interface Viewport {
  width: number;
  height: number;
}

export interface Canvas2DHandle {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  viewport: Viewport;
  dpr: number;
  resize: () => void;
  destroy: () => void;
}

export function createCanvas2D(
  canvas: HTMLCanvasElement,
  maxDpr = 2,
): Canvas2DHandle {
  const ctx = canvas.getContext("2d")!;
  let viewport: Viewport = { width: 0, height: 0 };
  let dpr = 1;

  function resize() {
    const parent = canvas.parentElement;
    if (!parent) return;
    dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
    viewport = { width: parent.clientWidth, height: parent.clientHeight };
    canvas.width = viewport.width * dpr;
    canvas.height = viewport.height * dpr;
    canvas.style.width = `${viewport.width}px`;
    canvas.style.height = `${viewport.height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  const observer = new ResizeObserver(resize);
  if (canvas.parentElement) observer.observe(canvas.parentElement);

  resize();

  return {
    canvas,
    ctx,
    get viewport() { return viewport; },
    get dpr() { return dpr; },
    resize,
    destroy() { observer.disconnect(); },
  };
}
