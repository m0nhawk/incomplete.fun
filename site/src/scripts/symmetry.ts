interface Point {
  x: number;
  y: number;
}

const canvas = document.querySelector<HTMLCanvasElement>("#symmetry-canvas");
const segmentsInput = document.querySelector<HTMLInputElement>("#symmetry-segments");
const mirrorInput = document.querySelector<HTMLInputElement>("#symmetry-mirror");
const colorInput = document.querySelector<HTMLInputElement>("#symmetry-color");
const widthInput = document.querySelector<HTMLInputElement>("#symmetry-width");
const widthValue = document.querySelector<HTMLElement>("#symmetry-width-value");
const clearButton = document.querySelector<HTMLButtonElement>("#symmetry-clear");

if (canvas && segmentsInput && mirrorInput && colorInput && widthInput && widthValue && clearButton) {
  const ctx = canvas.getContext("2d");

  if (ctx) {
    let drawing = false;
    let currentPoints: Point[] = [];
    let strokeSnapshot: ImageData | null = null;
    let segments = clampInt(localStorage.getItem("symmetry-n") ?? segmentsInput.value, 1, 36, 6);
    let mirror = mirrorInput.checked;
    let color = colorInput.value;
    let lineWidth = clampInt(widthInput.value, 1, 20, 2);

    segmentsInput.value = String(segments);
    widthInput.value = String(lineWidth);
    widthValue.textContent = String(lineWidth);

    function clampInt(value: string, min: number, max: number, fallback: number) {
      const parsed = parseInt(value, 10);
      if (Number.isNaN(parsed)) return fallback;
      return Math.max(min, Math.min(max, parsed));
    }

    function resizeCanvas() {
      const parent = canvas.parentElement;
      if (!parent) return;

      const dpr = window.devicePixelRatio || 1;
      const imageData = canvas.width > 0 && canvas.height > 0
        ? ctx.getImageData(0, 0, canvas.width, canvas.height)
        : null;

      canvas.width = parent.clientWidth * dpr;
      canvas.height = parent.clientHeight * dpr;
      canvas.style.width = `${parent.clientWidth}px`;
      canvas.style.height = `${parent.clientHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      if (imageData) {
        ctx.putImageData(imageData, 0, 0);
      }
    }

    function drawStroke(points: Point[]) {
      if (points.length < 2) return;

      const cx = canvas.clientWidth / 2;
      const cy = canvas.clientHeight / 2;
      const angle = (Math.PI * 2) / segments;

      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      const drawPath = (flip: boolean) => {
        const px = (p: Point) => p.x - cx;
        const py = (p: Point) => flip ? -(p.y - cy) : p.y - cy;

        ctx.beginPath();
        ctx.moveTo(px(points[0]), py(points[0]));
        for (let i = 0; i < points.length - 1; i++) {
          const mid = {
            x: (px(points[i]) + px(points[i + 1])) / 2,
            y: (py(points[i]) + py(points[i + 1])) / 2,
          };
          ctx.quadraticCurveTo(px(points[i]), py(points[i]), mid.x, mid.y);
        }
        ctx.lineTo(px(points[points.length - 1]), py(points[points.length - 1]));
        ctx.stroke();
      };

      for (let i = 0; i < segments; i++) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(angle * i);
        drawPath(false);
        if (mirror) drawPath(true);
        ctx.restore();
      }
    }

    function getPoint(e: PointerEvent): Point {
      const rect = canvas.getBoundingClientRect();
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    }

    function startDrawing(e: PointerEvent) {
      drawing = true;
      currentPoints = [getPoint(e)];
      strokeSnapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
      canvas.setPointerCapture(e.pointerId);
    }

    function moveDrawing(e: PointerEvent) {
      if (!drawing || !strokeSnapshot) return;
      currentPoints.push(getPoint(e));
      ctx.putImageData(strokeSnapshot, 0, 0);
      drawStroke(currentPoints);
    }

    function endDrawing(e: PointerEvent) {
      drawing = false;
      currentPoints = [];
      strokeSnapshot = null;
      if (canvas.hasPointerCapture(e.pointerId)) {
        canvas.releasePointerCapture(e.pointerId);
      }
    }

    resizeCanvas();
    const observer = new ResizeObserver(resizeCanvas);
    if (canvas.parentElement) observer.observe(canvas.parentElement);

    segmentsInput.addEventListener("input", () => {
      segments = clampInt(segmentsInput.value, 1, 36, 1);
      segmentsInput.value = String(segments);
      localStorage.setItem("symmetry-n", String(segments));
    });

    mirrorInput.addEventListener("change", () => {
      mirror = mirrorInput.checked;
    });

    colorInput.addEventListener("input", () => {
      color = colorInput.value;
    });

    widthInput.addEventListener("input", () => {
      lineWidth = clampInt(widthInput.value, 1, 20, 2);
      widthValue.textContent = String(lineWidth);
    });

    clearButton.addEventListener("click", () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    });

    canvas.addEventListener("pointerdown", startDrawing);
    canvas.addEventListener("pointermove", moveDrawing);
    canvas.addEventListener("pointerup", endDrawing);
    canvas.addEventListener("pointercancel", endDrawing);
  }
}
