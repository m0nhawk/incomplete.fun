export {};

type Mode = "mandelbrot" | "julia";
type Complex = { re: number; im: number };

const fg = () => getComputedStyle(document.documentElement).getPropertyValue("--fg").trim() || "#181817";
const bg = () => getComputedStyle(document.documentElement).getPropertyValue("--bg").trim() || "#fbfbf9";
const muted = () => getComputedStyle(document.documentElement).getPropertyValue("--muted").trim() || "#77736b";

const VERT = `#version 300 es
in vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

const FRAG = `#version 300 es
precision highp float;

const int MAX_ITER = 1000;

uniform vec2 u_res;
uniform vec2 u_center_re;
uniform vec2 u_center_im;
uniform vec2 u_view_height;
uniform int u_mode;
uniform vec2 u_julia_c_re;
uniform vec2 u_julia_c_im;
uniform int u_max_iter;
uniform int u_supersample;
uniform vec3 u_inside;

out vec4 fragColor;

// Double-single arithmetic: each number is hi + lo. This keeps deep zooms
// recalculated from high-precision coordinates instead of collapsing many
// pixels to the same 32-bit float value.
vec2 ds(float hi, float lo) { return vec2(hi, lo); }

vec2 dsAdd(vec2 a, vec2 b) {
  float s = a.x + b.x;
  float v = s - a.x;
  float e = (a.x - (s - v)) + (b.x - v) + a.y + b.y;
  float hi = s + e;
  return vec2(hi, e - (hi - s));
}

vec2 dsSub(vec2 a, vec2 b) { return dsAdd(a, vec2(-b.x, -b.y)); }

vec2 dsMul(vec2 a, vec2 b) {
  float c = 4097.0;
  float cona = a.x * c;
  float conb = b.x * c;
  float a1 = cona - (cona - a.x);
  float b1 = conb - (conb - b.x);
  float a2 = a.x - a1;
  float b2 = b.x - b1;
  float p = a.x * b.x;
  float e = ((a1 * b1 - p) + a1 * b2 + a2 * b1) + a2 * b2 + (a.x * b.y + a.y * b.x);
  float hi = p + e;
  return vec2(hi, e - (hi - p));
}

vec2 dsMulFloat(vec2 a, float b) { return dsMul(a, vec2(b, 0.0)); }

vec3 palette(float t) {
  float hue = 6.28318530718 * (0.72 + 2.6 * t);
  return vec3(
    0.5 + 0.5 * cos(hue),
    0.5 + 0.5 * cos(hue + 4.18879020479),
    0.5 + 0.5 * cos(hue + 2.09439510239)
  );
}

vec3 renderSample(vec2 uv) {
  float aspect = u_res.x / max(1.0, u_res.y);
  float ox = (uv.x - 0.5) * aspect;
  float oy = -(uv.y - 0.5);

  vec2 pointRe = dsAdd(u_center_re, dsMulFloat(u_view_height, ox));
  vec2 pointIm = dsAdd(u_center_im, dsMulFloat(u_view_height, oy));

  vec2 zr = u_mode == 0 ? vec2(0.0) : pointRe;
  vec2 zi = u_mode == 0 ? vec2(0.0) : pointIm;
  vec2 cr = u_mode == 0 ? pointRe : u_julia_c_re;
  vec2 ci = u_mode == 0 ? pointIm : u_julia_c_im;
  int iteration = 0;

  for (int i = 0; i < MAX_ITER; i++) {
    float mag2 = zr.x * zr.x + zi.x * zi.x;
    if (i >= u_max_iter || mag2 > 4.0) break;
    vec2 zr2 = dsMul(zr, zr);
    vec2 zi2 = dsMul(zi, zi);
    vec2 zri = dsMul(zr, zi);
    zi = dsAdd(dsAdd(zri, zri), ci);
    zr = dsAdd(dsSub(zr2, zi2), cr);
    iteration = i + 1;
  }

  if (iteration >= u_max_iter) return u_inside;

  float logZn = log(zr.x * zr.x + zi.x * zi.x) * 0.5;
  float nu = log(max(0.000001, logZn / log(2.0))) / log(2.0);
  float smoothIteration = float(iteration) + 1.0 - nu;
  float t = clamp(smoothIteration / float(u_max_iter), 0.0, 1.0);
  vec3 color = palette(t);
  return mix(color * color, color, 0.35);
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_res;

  if (u_supersample == 0) {
    fragColor = vec4(renderSample(uv), 1.0);
    return;
  }

  vec2 px = 1.0 / u_res;
  vec3 color = vec3(0.0);
  color += renderSample(uv + px * vec2(-0.25, -0.25));
  color += renderSample(uv + px * vec2( 0.25, -0.25));
  color += renderSample(uv + px * vec2(-0.25,  0.25));
  color += renderSample(uv + px * vec2( 0.25,  0.25));
  fragColor = vec4(color * 0.25, 1.0);
}
`;

const canvas = document.querySelector<HTMLCanvasElement>("#complex-canvas");
const orbitCanvas = document.querySelector<HTMLCanvasElement>("#complex-orbit");
const stage = document.querySelector<HTMLDivElement>("#complex-stage");
const mandelbrotButton = document.querySelector<HTMLButtonElement>("#complex-mandelbrot");
const juliaButton = document.querySelector<HTMLButtonElement>("#complex-julia");
const cRealInput = document.querySelector<HTMLInputElement>("#complex-c-real");
const cImagInput = document.querySelector<HTMLInputElement>("#complex-c-imag");
const iterationsInput = document.querySelector<HTMLInputElement>("#complex-iterations");
const iterationValue = document.querySelector<HTMLSpanElement>("#complex-iteration-value");
const resetButton = document.querySelector<HTMLButtonElement>("#complex-reset");
const coords = document.querySelector<HTMLSpanElement>("#complex-coords");
const status = document.querySelector<HTMLSpanElement>("#complex-status");

if (
  canvas && orbitCanvas && stage && mandelbrotButton && juliaButton && cRealInput && cImagInput &&
  iterationsInput && iterationValue && resetButton && coords && status
) {
  const gl = canvas.getContext("webgl2", { alpha: false, antialias: false, premultipliedAlpha: false });
  const orbitCtx = orbitCanvas.getContext("2d")!;

  if (!gl || !orbitCtx) {
    status.textContent = "WebGL2 is required for fast rendering.";
  } else {
    let mode: Mode = "mandelbrot";
    let center: Complex = { re: -0.55, im: 0 };
    let viewHeight = 3.0;
    let juliaC: Complex = { re: -0.8, im: 0.156 };
    let maxIterations = 180;
    let dpr = 1;
    let latestPointer: Complex | null = null;
    let dragStart: { x: number; y: number; center: Complex } | null = null;
    let pointerDown: { x: number; y: number } | null = null;
    let moved = false;
    let pendingRender = false;

    const prog = gl.createProgram();
    if (!prog) throw new Error("Unable to create WebGL program");

    gl.attachShader(prog, compileShader(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compileShader(gl, gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      throw new Error(`Unable to link WebGL program: ${gl.getProgramInfoLog(prog) ?? "unknown error"}`);
    }
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1, 1, -1, -1, 1,
      -1, 1, 1, -1, 1, 1,
    ]), gl.STATIC_DRAW);

    const loc = gl.getAttribLocation(prog, "a_pos");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const uniforms = {
      res: gl.getUniformLocation(prog, "u_res"),
      centerRe: gl.getUniformLocation(prog, "u_center_re"),
      centerIm: gl.getUniformLocation(prog, "u_center_im"),
      viewHeight: gl.getUniformLocation(prog, "u_view_height"),
      mode: gl.getUniformLocation(prog, "u_mode"),
      juliaCRe: gl.getUniformLocation(prog, "u_julia_c_re"),
      juliaCIm: gl.getUniformLocation(prog, "u_julia_c_im"),
      maxIter: gl.getUniformLocation(prog, "u_max_iter"),
      supersample: gl.getUniformLocation(prog, "u_supersample"),
      inside: gl.getUniformLocation(prog, "u_inside"),
    };

    function compileShader(glContext: WebGL2RenderingContext, type: number, src: string) {
      const shader = glContext.createShader(type);
      if (!shader) throw new Error("Unable to create WebGL shader");
      glContext.shaderSource(shader, src);
      glContext.compileShader(shader);
      if (!glContext.getShaderParameter(shader, glContext.COMPILE_STATUS)) {
        const message = glContext.getShaderInfoLog(shader) ?? "unknown error";
        glContext.deleteShader(shader);
        throw new Error(`Unable to compile WebGL shader: ${message}`);
      }
      return shader;
    }

    function cssToRgb(color: string): [number, number, number] {
      const hex = color.trim();
      if (/^#[0-9a-f]{6}$/i.test(hex)) {
        return [
          Number.parseInt(hex.slice(1, 3), 16) / 255,
          Number.parseInt(hex.slice(3, 5), 16) / 255,
          Number.parseInt(hex.slice(5, 7), 16) / 255,
        ];
      }
      return [0.02, 0.02, 0.02];
    }

    function splitDouble(value: number): [number, number] {
      const high = Math.fround(value);
      return [high, value - high];
    }

    function resize() {
      const rect = stage.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 3);
      const width = Math.max(1, Math.floor(rect.width * dpr));
      const height = Math.max(1, Math.floor(rect.height * dpr));
      canvas.width = width;
      canvas.height = height;
      orbitCanvas.width = width;
      orbitCanvas.height = height;
      gl.viewport(0, 0, width, height);
      render();
      drawOrbit();
    }

    function screenToComplex(clientX: number, clientY: number): Complex {
      const rect = canvas.getBoundingClientRect();
      const aspect = rect.width / Math.max(1, rect.height);
      const x = (clientX - rect.left) / rect.width;
      const y = (clientY - rect.top) / rect.height;
      return {
        re: center.re + (x - 0.5) * viewHeight * aspect,
        im: center.im + (y - 0.5) * viewHeight,
      };
    }

    function complexToPixel(z: Complex): { x: number; y: number } {
      const aspect = canvas.width / Math.max(1, canvas.height);
      return {
        x: ((z.re - center.re) / (viewHeight * aspect) + 0.5) * canvas.width,
        y: ((z.im - center.im) / viewHeight + 0.5) * canvas.height,
      };
    }

    function formatComplex(z: Complex): string {
      const sign = z.im < 0 ? "-" : "+";
      return `${z.re.toFixed(5)} ${sign} ${Math.abs(z.im).toFixed(5)}i`;
    }

    function setMode(nextMode: Mode) {
      mode = nextMode;
      if (mode === "mandelbrot") {
        center = { re: -0.55, im: 0 };
        viewHeight = 3.0;
      } else {
        center = { re: 0, im: 0 };
        viewHeight = 3.2;
      }
      mandelbrotButton.classList.toggle("is-active", mode === "mandelbrot");
      juliaButton.classList.toggle("is-active", mode === "julia");
      render();
      drawOrbit();
    }

    function syncInputs() {
      cRealInput.value = juliaC.re.toFixed(3);
      cImagInput.value = juliaC.im.toFixed(3);
      iterationValue.textContent = String(maxIterations);
    }

    function render() {
      if (pendingRender) return;
      pendingRender = true;
      window.requestAnimationFrame(() => {
        pendingRender = false;
        const inside = cssToRgb(bg());
        gl.useProgram(prog);
        gl.viewport(0, 0, canvas.width, canvas.height);
        const centerRe = splitDouble(center.re);
        const centerIm = splitDouble(center.im);
        const height = splitDouble(viewHeight);
        const juliaRe = splitDouble(juliaC.re);
        const juliaIm = splitDouble(juliaC.im);
        gl.uniform2f(uniforms.res, canvas.width, canvas.height);
        gl.uniform2f(uniforms.centerRe, centerRe[0], centerRe[1]);
        gl.uniform2f(uniforms.centerIm, centerIm[0], centerIm[1]);
        gl.uniform2f(uniforms.viewHeight, height[0], height[1]);
        gl.uniform1i(uniforms.mode, mode === "mandelbrot" ? 0 : 1);
        gl.uniform2f(uniforms.juliaCRe, juliaRe[0], juliaRe[1]);
        gl.uniform2f(uniforms.juliaCIm, juliaIm[0], juliaIm[1]);
        gl.uniform1i(uniforms.maxIter, maxIterations);
        gl.uniform1i(uniforms.supersample, viewHeight < 0.5 ? 1 : 0);
        gl.uniform3f(uniforms.inside, inside[0], inside[1], inside[2]);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        status.textContent = `${mode} · height ${viewHeight.toPrecision(3)} · c ${formatComplex(juliaC)}`;
      });
    }

    function drawOrbit() {
      orbitCtx.clearRect(0, 0, orbitCanvas.width, orbitCanvas.height);
      if (!latestPointer) return;

      const orbit: Complex[] = [];
      let z = mode === "mandelbrot" ? { re: 0, im: 0 } : latestPointer;
      const c = mode === "mandelbrot" ? latestPointer : juliaC;
      orbit.push({ ...z });

      for (let i = 0; i < Math.min(maxIterations, 120); i += 1) {
        z = { re: z.re * z.re - z.im * z.im + c.re, im: 2 * z.re * z.im + c.im };
        orbit.push(z);
        if (z.re * z.re + z.im * z.im > 16) break;
      }

      orbitCtx.lineWidth = 1.5 * dpr;
      orbitCtx.strokeStyle = fg();
      orbitCtx.fillStyle = bg();
      orbitCtx.beginPath();
      orbit.forEach((value, index) => {
        const pixel = complexToPixel(value);
        if (index === 0) orbitCtx.moveTo(pixel.x, pixel.y);
        else orbitCtx.lineTo(pixel.x, pixel.y);
      });
      orbitCtx.stroke();

      orbit.slice(0, 36).forEach((value, index) => {
        const pixel = complexToPixel(value);
        const radius = (index === 0 ? 4 : 2.4) * dpr;
        orbitCtx.beginPath();
        orbitCtx.arc(pixel.x, pixel.y, radius, 0, Math.PI * 2);
        orbitCtx.fill();
        orbitCtx.strokeStyle = index === 0 ? fg() : muted();
        orbitCtx.stroke();
      });
    }

    function zoomAt(clientX: number, clientY: number, factor: number) {
      const before = screenToComplex(clientX, clientY);
      viewHeight *= factor;
      const after = screenToComplex(clientX, clientY);
      center = { re: center.re + before.re - after.re, im: center.im + before.im - after.im };
      render();
      drawOrbit();
    }

    mandelbrotButton.addEventListener("click", () => setMode("mandelbrot"));
    juliaButton.addEventListener("click", () => setMode("julia"));

    cRealInput.addEventListener("change", () => {
      juliaC = { re: Number(cRealInput.value) || 0, im: juliaC.im };
      syncInputs();
      render();
      drawOrbit();
    });

    cImagInput.addEventListener("change", () => {
      juliaC = { re: juliaC.re, im: Number(cImagInput.value) || 0 };
      syncInputs();
      render();
      drawOrbit();
    });

    iterationsInput.addEventListener("input", () => {
      maxIterations = Number(iterationsInput.value) || 180;
      syncInputs();
      render();
      drawOrbit();
    });

    resetButton.addEventListener("click", () => setMode(mode));

    stage.addEventListener("wheel", (event) => {
      event.preventDefault();
      zoomAt(event.clientX, event.clientY, event.deltaY < 0 ? 0.78 : 1.28);
    }, { passive: false });

    stage.addEventListener("pointerdown", (event) => {
      stage.setPointerCapture(event.pointerId);
      dragStart = { x: event.clientX, y: event.clientY, center: { ...center } };
      pointerDown = { x: event.clientX, y: event.clientY };
      moved = false;
    });

    stage.addEventListener("pointermove", (event) => {
      latestPointer = screenToComplex(event.clientX, event.clientY);
      coords.textContent = `${mode === "mandelbrot" ? "c" : "z"} = ${formatComplex(latestPointer)}`;
      drawOrbit();

      if (!dragStart) return;
      const rect = canvas.getBoundingClientRect();
      const dx = ((event.clientX - dragStart.x) / rect.width) * viewHeight * (rect.width / Math.max(1, rect.height));
      const dy = ((event.clientY - dragStart.y) / rect.height) * viewHeight;
      if (Math.hypot(event.clientX - dragStart.x, event.clientY - dragStart.y) > 3) moved = true;
      center = { re: dragStart.center.re - dx, im: dragStart.center.im - dy };
      render();
      drawOrbit();
    });

    stage.addEventListener("pointerup", (event) => {
      if (pointerDown && !moved && mode === "mandelbrot") {
        juliaC = screenToComplex(event.clientX, event.clientY);
        syncInputs();
        setMode("julia");
      }
      dragStart = null;
      pointerDown = null;
    });

    stage.addEventListener("pointercancel", () => {
      dragStart = null;
      pointerDown = null;
    });

    stage.addEventListener("dblclick", (event) => zoomAt(event.clientX, event.clientY, 0.5));

    window.addEventListener("resize", resize);
    syncInputs();
    resize();
  }
}
